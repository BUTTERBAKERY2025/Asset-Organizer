// إنشاء النسخة المعتمدة من مستند القوائم المالية:
// يضيف «صفحة اعتماد» في نهاية ملف PDF تحتوي التوقيعات وختم الإدارة المالية.
// تُرسم الصفحة بالكامل على كانفس (لدعم العربية) ثم تُدمج كصورة عبر pdf-lib.
import { PDFDocument } from "pdf-lib";

export interface StampSigner {
  signerName: string;
  signerPosition: string;
  signatureData: string | null;
  signedAt: string | Date | null;
  status: string;
}

export interface StampDocInfo {
  title: string;
  category?: string | null;
  cycleTitle?: string;
  periodStart?: string;
  periodEnd?: string;
}

const POSITION_LABELS: Record<string, string> = {
  cfo: "المدير المالي",
  ceo: "الرئيس التنفيذي",
  chairman: "رئيس مجلس الإدارة",
  vice_chairman: "نائب رئيس مجلس الإدارة",
  board_member: "عضو مجلس الإدارة",
  auditor: "المراجع الداخلي",
  hr_manager: "مدير الموارد البشرية",
  procurement_manager: "مدير المشتريات",
  accounts_supervisor: "مشرف الحسابات",
  operations_manager: "مدير التشغيل",
  marketing_manager: "مدير التسويق",
  it_manager: "مدير تقنية المعلومات",
  branch_manager: "مدير فرع",
  general_manager: "المدير العام",
};
export function positionLabel(p: string): string {
  return POSITION_LABELS[p] || p;
}

function isValidSignature(sig: string | null): sig is string {
  return !!sig && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(sig);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fmtDate(d: string | Date | null): string {
  if (!d) return "";
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} — ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

// رسم ختم الإدارة المالية (مستطيل مزدوج الإطار بنص عربي)
function drawStamp(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale = 1, approvalDate?: Date) {
  const w = 340 * scale;
  const h = 150 * scale;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.06);
  ctx.strokeStyle = "#1b4f8a";
  ctx.fillStyle = "#1b4f8a";
  ctx.globalAlpha = 0.88;
  ctx.lineWidth = 3.5 * scale;
  const r = 16 * scale;
  const rr = (x: number, y: number, ww: number, hh: number, rad: number) => {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + ww, y, x + ww, y + hh, rad);
    ctx.arcTo(x + ww, y + hh, x, y + hh, rad);
    ctx.arcTo(x, y + hh, x, y, rad);
    ctx.arcTo(x, y, x + ww, y, rad);
    ctx.closePath();
  };
  rr(-w / 2, -h / 2, w, h, r);
  ctx.stroke();
  ctx.lineWidth = 1.6 * scale;
  rr(-w / 2 + 8 * scale, -h / 2 + 8 * scale, w - 16 * scale, h - 16 * scale, r * 0.7);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${26 * scale}px 'Segoe UI', Tahoma, Arial`;
  ctx.fillText("شركة الزبد الأفضل", 0, -34 * scale);
  ctx.font = `bold ${23 * scale}px 'Segoe UI', Tahoma, Arial`;
  ctx.fillText("ختم الإدارة المالية", 0, 2 * scale);
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 40 * scale, 22 * scale);
  ctx.lineTo(w / 2 - 40 * scale, 22 * scale);
  ctx.lineWidth = 1.2 * scale;
  ctx.stroke();
  ctx.font = `${17 * scale}px 'Segoe UI', Tahoma, Arial`;
  // تاريخ الاعتماد = تاريخ آخر توقيع (ثابت مهما أُعيد إنشاء الملف)
  const d = approvalDate || new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  ctx.fillText(`معتمد بتاريخ ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, 0, 45 * scale);
  ctx.restore();
}

// إنشاء صورة صفحة الاعتماد A4
async function renderApprovalPage(doc: StampDocInfo, signers: StampSigner[]): Promise<string> {
  const W = 1240, H = 1754; // A4 @150dpi
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#faf7f0";
  ctx.fillRect(0, 0, W, H);

  // إطار الصفحة الرسمي
  ctx.strokeStyle = "#b9a25c";
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.lineWidth = 1;
  ctx.strokeRect(52, 52, W - 104, H - 104);

  ctx.textAlign = "center";
  ctx.fillStyle = "#1a2340";
  ctx.font = "bold 46px 'Segoe UI', Tahoma, Arial";
  ctx.fillText("شركة الزبد الأفضل", W / 2, 150);
  ctx.font = "bold 34px 'Segoe UI', Tahoma, Arial";
  ctx.fillStyle = "#8a6d1f";
  ctx.fillText("صفحة اعتماد القوائم المالية", W / 2, 215);

  ctx.strokeStyle = "#b9a25c";
  ctx.beginPath();
  ctx.moveTo(200, 250);
  ctx.lineTo(W - 200, 250);
  ctx.stroke();

  // بيانات المستند
  ctx.fillStyle = "#2c3347";
  ctx.font = "26px 'Segoe UI', Tahoma, Arial";
  let y = 320;
  const line = (label: string, value: string) => {
    if (!value) return;
    ctx.font = "bold 26px 'Segoe UI', Tahoma, Arial";
    ctx.fillText(label + ": " + value, W / 2, y);
    y += 52;
  };
  line("الدورة", doc.cycleTitle || "");
  if (doc.periodStart && doc.periodEnd) line("الفترة المالية", `${doc.periodStart} إلى ${doc.periodEnd}`);
  line("المستند", doc.title);
  if (doc.category) line("النوع", doc.category);

  y += 30;
  ctx.font = "bold 30px 'Segoe UI', Tahoma, Arial";
  ctx.fillStyle = "#1a2340";
  ctx.fillText("الاعتمادات والتوقيعات", W / 2, y);
  y += 30;

  // بطاقات التوقيعات
  const signed = signers.filter((s) => s.status === "signed");
  const cardW = 480, cardH = 240, gap = 60;
  const perRow = 2;
  for (let i = 0; i < signed.length; i++) {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const rowCount = Math.min(perRow, signed.length - row * perRow);
    const totalW = rowCount * cardW + (rowCount - 1) * gap;
    const x = (W - totalW) / 2 + col * (cardW + gap);
    const cy = y + 30 + row * (cardH + 40);
    ctx.strokeStyle = "#cfc39a";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, cy, cardW, cardH);
    ctx.fillStyle = "#f3eee1";
    ctx.fillRect(x, cy, cardW, 46);
    ctx.fillStyle = "#1a2340";
    ctx.font = "bold 24px 'Segoe UI', Tahoma, Arial";
    ctx.fillText(positionLabel(signed[i].signerPosition), x + cardW / 2, cy + 31);
    ctx.font = "bold 25px 'Segoe UI', Tahoma, Arial";
    ctx.fillText(signed[i].signerName, x + cardW / 2, cy + 85);
    if (isValidSignature(signed[i].signatureData)) {
      try {
        const img = await loadImage(signed[i].signatureData!);
        const maxW = cardW - 120, maxH = 85;
        const ratio = Math.min(maxW / img.width, maxH / img.height);
        const iw = img.width * ratio, ih = img.height * ratio;
        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        ctx.drawImage(img, x + (cardW - iw) / 2, cy + 100, iw, ih);
        ctx.restore();
      } catch { /* تجاهل صورة تالفة */ }
    }
    ctx.fillStyle = "#8a8f9e";
    ctx.font = "19px 'Segoe UI', Tahoma, Arial";
    ctx.fillText("موقّع إلكترونياً — " + fmtDate(signed[i].signedAt), x + cardW / 2, cy + cardH - 18);
  }

  const rows = Math.ceil(signed.length / perRow);
  const afterCards = y + 30 + rows * (cardH + 40);

  // الختم — تاريخه هو تاريخ آخر توقيع مكتمل
  const lastSignedAt = signed
    .map((s) => (s.signedAt ? new Date(s.signedAt).getTime() : 0))
    .reduce((a, b) => Math.max(a, b), 0);
  drawStamp(ctx, W / 2, Math.min(H - 260, afterCards + 180), 1.15, lastSignedAt ? new Date(lastSignedAt) : undefined);

  // تذييل
  ctx.fillStyle = "#8a8f9e";
  ctx.font = "18px 'Segoe UI', Tahoma, Arial";
  ctx.fillText("هذه الصفحة أُنشئت إلكترونياً وتُعد جزءاً لا يتجزأ من المستند المرفق", W / 2, H - 90);

  return canvas.toDataURL("image/jpeg", 0.92);
}

// الدالة الرئيسية: تستلم بايتات PDF الأصلي وتعيد بايتات النسخة المعتمدة
export async function buildApprovedPdf(
  originalPdfBytes: ArrayBuffer,
  doc: StampDocInfo,
  signers: StampSigner[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true });
  const pageImgDataUrl = await renderApprovalPage(doc, signers);
  const jpgBytes = Uint8Array.from(atob(pageImgDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
  const jpg = await pdfDoc.embedJpg(jpgBytes);
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 pt
  page.drawImage(jpg, { x: 0, y: 0, width: 595.28, height: 841.89 });
  return await pdfDoc.save();
}

export function downloadPdf(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes as any], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}
