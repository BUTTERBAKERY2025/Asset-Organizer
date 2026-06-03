// =====================================================
// Wallet service — Apple Wallet (.pkpass) + Google Wallet
// for loyalty cards. Both providers degrade gracefully:
// when their credentials are absent the feature is simply
// reported as unavailable and the web card keeps working.
// Live pass updates are intentionally out of scope.
// =====================================================
import path from "path";
import fs from "fs";
import { PKPass } from "passkit-generator";
import forge from "node-forge";
import jwt from "jsonwebtoken";

export interface WalletCardData {
  code: string;
  customerName: string;
  campaignName: string;
  discountText: string;
  remainingUses: number;
  maxUses: number;
  validTo?: string | null;
  terms?: string | null;
}

// ---- Credential presence helpers --------------------

const APPLE_ENV = [
  "APPLE_PASS_TYPE_ID",
  "APPLE_TEAM_ID",
  "APPLE_PASS_CERT_P12_BASE64",
  "APPLE_PASS_CERT_PASSWORD",
  "APPLE_WWDR_CERT_BASE64",
] as const;

const GOOGLE_ENV = [
  "GOOGLE_WALLET_ISSUER_ID",
  "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON",
] as const;

export function isAppleWalletConfigured(): boolean {
  return APPLE_ENV.every((k) => !!process.env[k] && process.env[k]!.trim() !== "");
}

export function isGoogleWalletConfigured(): boolean {
  return GOOGLE_ENV.every((k) => !!process.env[k] && process.env[k]!.trim() !== "");
}

// ---- Brand assets -----------------------------------

const LOGO_CANDIDATES = [
  "client/public/butter-bakery-logo.png",
  "client/public/butter-logo.png",
  "client/public/company-logo.png",
];

let cachedLogo: Buffer | null = null;
function loadLogoBuffer(): Buffer {
  if (cachedLogo) return cachedLogo;
  for (const rel of LOGO_CANDIDATES) {
    const abs = path.resolve(process.cwd(), rel);
    if (fs.existsSync(abs)) {
      cachedLogo = fs.readFileSync(abs);
      return cachedLogo;
    }
  }
  throw new Error("Brand logo asset not found for wallet pass");
}

// ---- Apple Wallet -----------------------------------

interface PemPair {
  cert: string;
  key: string;
}

function p12ToPem(p12Base64: string, password: string): PemPair {
  const der = forge.util.decode64(p12Base64.trim());
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  let keyObj: forge.pki.PrivateKey | undefined;
  const shrouded = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  keyObj = shrouded[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;
  if (!keyObj) {
    const plain = p12.getBags({ bagType: forge.pki.oids.keyBag });
    keyObj = plain[forge.pki.oids.keyBag]?.[0]?.key;
  }
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certObj = certBags[forge.pki.oids.certBag]?.[0]?.cert;
  if (!keyObj || !certObj) {
    throw new Error("Could not extract certificate/key from Apple .p12");
  }
  return {
    key: forge.pki.privateKeyToPem(keyObj),
    cert: forge.pki.certificateToPem(certObj),
  };
}

function normalizeCertToPem(b64: string): string {
  const trimmed = b64.trim();
  const decoded = Buffer.from(trimmed, "base64").toString("utf8");
  if (decoded.includes("BEGIN CERTIFICATE")) return decoded;
  // Assume DER-encoded certificate
  const der = forge.util.decode64(trimmed);
  const asn1 = forge.asn1.fromDer(der);
  const cert = forge.pki.certificateFromAsn1(asn1);
  return forge.pki.certificateToPem(cert);
}

export async function generateApplePass(card: WalletCardData): Promise<Buffer> {
  if (!isAppleWalletConfigured()) {
    throw new Error("Apple Wallet is not configured");
  }

  const { cert, key } = p12ToPem(
    process.env.APPLE_PASS_CERT_P12_BASE64!,
    process.env.APPLE_PASS_CERT_PASSWORD!,
  );
  const wwdr = normalizeCertToPem(process.env.APPLE_WWDR_CERT_BASE64!);
  const logo = loadLogoBuffer();

  const pass = new PKPass(
    {
      "icon.png": logo,
      "icon@2x.png": logo,
      "logo.png": logo,
      "logo@2x.png": logo,
    },
    {
      wwdr,
      signerCert: cert,
      signerKey: key,
    },
    {
      formatVersion: 1,
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID!,
      teamIdentifier: process.env.APPLE_TEAM_ID!,
      organizationName: "BUTTER BAKERY",
      serialNumber: card.code,
      description: card.campaignName || "بطاقة ولاء",
      foregroundColor: "rgb(255, 255, 255)",
      backgroundColor: "rgb(30, 41, 59)",
      labelColor: "rgb(251, 146, 60)",
    },
  );

  pass.type = "storeCard";

  pass.setBarcodes({
    message: card.code,
    format: "PKBarcodeFormatQR",
    messageEncoding: "iso-8859-1",
    altText: card.code,
  });

  pass.headerFields.push({
    key: "remaining",
    label: "المتبقي",
    value: `${card.remainingUses}/${card.maxUses}`,
  });

  pass.primaryFields.push({
    key: "discount",
    label: "الخصم",
    value: card.discountText,
  });

  pass.secondaryFields.push({
    key: "customer",
    label: "العميل",
    value: card.customerName,
  });

  if (card.validTo) {
    pass.auxiliaryFields.push({
      key: "validTo",
      label: "صالح حتى",
      value: card.validTo,
    });
  }

  pass.backFields.push({
    key: "campaign",
    label: "الحملة",
    value: card.campaignName,
  });
  pass.backFields.push({
    key: "cardCode",
    label: "رمز البطاقة",
    value: card.code,
  });
  if (card.terms) {
    pass.backFields.push({
      key: "terms",
      label: "الشروط والأحكام",
      value: card.terms,
    });
  }

  return pass.getAsBuffer();
}

// ---- Google Wallet ----------------------------------
// Uses a self-contained ("fat") Save-to-Google-Wallet JWT
// that embeds both the loyalty class and object, so no
// Google API calls are required to mint the save link.

interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
}

function parseGoogleServiceAccount(): GoogleServiceAccount {
  const raw = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON!;
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Google service account JSON missing client_email/private_key");
  }
  // Support keys whose newlines were escaped when stored as an env var.
  parsed.private_key = String(parsed.private_key).replace(/\\n/g, "\n");
  return parsed as GoogleServiceAccount;
}

export function buildGoogleSaveUrl(card: WalletCardData, logoUrl?: string): string {
  if (!isGoogleWalletConfigured()) {
    throw new Error("Google Wallet is not configured");
  }

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!.trim();
  const sa = parseGoogleServiceAccount();

  const classId = `${issuerId}.butter_loyalty`;
  const objectId = `${issuerId}.${card.code}`;

  const loyaltyClass: Record<string, any> = {
    id: classId,
    issuerName: "BUTTER BAKERY",
    programName: "بطاقة ولاء BUTTER BAKERY",
    reviewStatus: "UNDER_REVIEW",
    hexBackgroundColor: "#1e293b",
  };
  if (logoUrl) {
    loyaltyClass.programLogo = {
      sourceUri: { uri: logoUrl },
      contentDescription: {
        defaultValue: { language: "ar", value: "BUTTER BAKERY" },
      },
    };
  }

  const loyaltyObject: Record<string, any> = {
    id: objectId,
    classId,
    state: "ACTIVE",
    accountName: card.customerName,
    accountId: card.code,
    barcode: {
      type: "QR_CODE",
      value: card.code,
      alternateText: card.code,
    },
    loyaltyPoints: {
      label: "المتبقي",
      balance: { string: `${card.remainingUses}/${card.maxUses}` },
    },
    textModulesData: [
      { id: "discount", header: "الخصم", body: card.discountText },
      { id: "campaign", header: "الحملة", body: card.campaignName },
    ],
  };
  if (card.validTo) {
    loyaltyObject.textModulesData.push({
      id: "validTo",
      header: "صالح حتى",
      body: card.validTo,
    });
  }

  const claims = {
    iss: sa.client_email,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    payload: {
      loyaltyClasses: [loyaltyClass],
      loyaltyObjects: [loyaltyObject],
    },
  };

  const token = jwt.sign(claims, sa.private_key, { algorithm: "RS256" });
  return `https://pay.google.com/gp/v/save/${token}`;
}
