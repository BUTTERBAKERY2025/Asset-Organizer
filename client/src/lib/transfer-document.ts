export type TransferDocumentInput = {
  id: number;
  transferNumber: string;
  status: string;
  transferDate?: string | Date | null;
  createdAt?: string | Date | null;
  sourceBranchName?: string | null;
  destinationBranchName?: string | null;
  driverName?: string | null;
  vehicleNumber?: string | null;
  createdByName?: string | null;
  receivedByName?: string | null;
  receiverSignature?: string | null;
  notes?: string | null;
  deliveryNotes?: string | null;
};

export type TransferDocumentItemInput = {
  itemId: number;
  itemName: string;
  unit: string;
  quantity: number;
  originalQuantity?: number | null;
  availableQuantity?: number | null;
  receivedQuantity?: number | null;
  discrepancy?: number | null;
  discrepancyNotes?: string | null;
  notes?: string | null;
};

export const TRANSFER_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  pending: "قيد الانتظار",
  approved: "معتمد",
  rejected: "مرفوض",
  in_transit: "قيد النقل",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

export const TRANSFER_BRAND = {
  name: "BUTTER",
  logoPath: "/assets/logo.png",
  dark: "#24211d",
  gold: "#b58a3a",
  pale: "#f7f3ea",
};

export const TRANSFER_ITEM_HEADINGS = {
  identifier: "معرّف الصنف",
  quantity: "كمية التحويل",
} as const;

export function formatTransferQuantity(value: number | null | undefined): string {
  if (value == null) return "—";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(6).replace(/\.?0+$/, "") : "—";
}

export function formatTransferDate(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const datePart = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
    timeZone: "Asia/Riyadh",
  }).format(date);
  if (!withTime) return datePart;
  return `${datePart} ${new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "Asia/Riyadh",
  }).format(date)}`;
}

export function isSafeSignatureImage(value: unknown): value is string {
  return typeof value === "string"
    && /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(value)
    && value.length <= 2_000_000;
}

export type TransferDocumentModel = ReturnType<typeof mapTransferDocument>;

export function mapTransferDocument(
  transfer: TransferDocumentInput,
  items: TransferDocumentItemInput[],
) {
  return {
    reference: transfer.transferNumber,
    status: transfer.status,
    statusLabel: TRANSFER_STATUS_LABELS[transfer.status] || transfer.status,
    isUnapproved: transfer.status === "draft" || transfer.status === "pending",
    transferDate: formatTransferDate(transfer.transferDate),
    createdAt: formatTransferDate(transfer.createdAt, true),
    source: transfer.sourceBranchName || "المستودع الرئيسي",
    destination: transfer.destinationBranchName || "—",
    driver: transfer.driverName || null,
    vehicle: transfer.vehicleNumber || null,
    notes: transfer.notes || null,
    deliveryNotes: transfer.deliveryNotes || null,
    signatures: {
      preparer: { name: transfer.createdByName || null, image: null as string | null },
      // There is no dispatcher identity/signature field in the current schema.
      // Keep this line blank rather than assigning the driver a different role.
      dispatcher: { name: null as string | null, image: null as string | null },
      receiver: {
        name: transfer.receivedByName || null,
        image: isSafeSignatureImage(transfer.receiverSignature) ? transfer.receiverSignature : null,
      },
    },
    items: items.map((item, index) => ({
      sequence: index + 1,
      code: String(item.itemId),
      name: item.itemName,
      unit: item.unit,
      available: item.availableQuantity ?? null,
      requested: item.originalQuantity ?? item.quantity,
      sent: item.quantity,
      received: item.receivedQuantity ?? null,
      discrepancy: item.discrepancy ?? null,
      notes: item.discrepancyNotes || item.notes || null,
    })),
  };
}

export function safeTransferFilePart(value: string, fallback = "transfer"): string {
  const cleaned = value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim().replace(/\s+/g, "-");
  return (cleaned || fallback).slice(0, 80);
}

export function safeTransferSheetName(value: string): string {
  const cleaned = value
    .replace(/[\\/:*?[\]\u0000-\u001f]/g, "-")
    .replace(/^'+|'+$/g, "")
    .trim();
  return (cleaned || "تحويل").slice(0, 31);
}