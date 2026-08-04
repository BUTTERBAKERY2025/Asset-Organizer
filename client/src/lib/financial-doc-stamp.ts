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

// إنشاء «شريط الاعتماد» المضغوط الذي يُطبع أسفل آخر صفحة من المستند نفسه
// (لوحة بيضاء بإطار ذهبي: خلايا التوقيعات في صف + الختم بجانبها/أسفلها)
async function renderApprovalOverlay(
  doc: StampDocInfo,
  signers: StampSigner[]
): Promise<{ dataUrl: string; w: number; h: number }> {
  const signed = signers.filter((s) => s.status === "signed");
  const W = 1500;
  const PAD = 34;
  const TITLE_H = 64;
  const perRow = Math.min(Math.max(signed.length, 1), 4);
  const rows = Math.max(1, Math.ceil(signed.length / perRow));
  const GAP = 18;
  const cellW = (W - PAD * 2 - GAP * (perRow - 1)) / perRow;
  const cellH = 195;
  const STAMP_H = 150;
  const FOOTER_H = 40;
  const H = PAD + TITLE_H + rows * (cellH + GAP) + STAMP_H + FOOTER_H;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // لوحة بيضاء بحواف دائرية وإطار ذهبي مزدوج
  const rr = (x: number, y: number, ww: number, hh: number, rad: number) => {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + ww, y, x + ww, y + hh, rad);
    ctx.arcTo(x + ww, y + hh, x, y + hh, rad);
    ctx.arcTo(x, y + hh, x, y, rad);
    ctx.arcTo(x, y, x + ww, y, rad);
    ctx.closePath();
  };
  ctx.fillStyle = "rgba(255,253,248,0.97)";
  rr(2, 2, W - 4, H - 4, 18);
  ctx.fill();
  ctx.strokeStyle = "#b9a25c";
  ctx.lineWidth = 3;
  rr(2, 2, W - 4, H - 4, 18);
  ctx.stroke();
  ctx.lineWidth = 1;
  rr(10, 10, W - 20, H - 20, 12);
  ctx.stroke();

  // العنوان
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1a2340";
  ctx.font = "bold 34px 'Segoe UI', Tahoma, Arial";
  ctx.fillText("اعتمادات وتوقيعات — شركة الزبد الأفضل", W / 2, PAD + 18);
  ctx.strokeStyle = "#d8c990";
  ctx.beginPath();
  ctx.moveTo(PAD + 40, PAD + TITLE_H - 16);
  ctx.lineTo(W - PAD - 40, PAD + TITLE_H - 16);
  ctx.stroke();

  // خلايا التوقيعات (من اليمين إلى اليسار)
  const top = PAD + TITLE_H;
  for (let i = 0; i < signed.length; i++) {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const rowCount = Math.min(perRow, signed.length - row * perRow);
    const totalW = rowCount * cellW + (rowCount - 1) * GAP;
    const startX = (W - totalW) / 2;
    // RTL: أول موقّع في أقصى اليمين
    const x = startX + (rowCount - 1 - col) * (cellW + GAP);
    const cy = top + row * (cellH + GAP);
    ctx.strokeStyle = "#cfc39a";
    ctx.lineWidth = 1.4;
    rr(x, cy, cellW, cellH, 10);
    ctx.stroke();
    ctx.fillStyle = "#f5f0e2";
    rr(x, cy, cellW, 40, 10);
    ctx.fill();
    ctx.fillStyle = "#1a2340";
    ctx.font = "bold 22px 'Segoe UI', Tahoma, Arial";
    ctx.fillText(positionLabel(signed[i].signerPosition), x + cellW / 2, cy + 21);
    ctx.font = "bold 22px 'Segoe UI', Tahoma, Arial";
    ctx.fillText(signed[i].signerName, x + cellW / 2, cy + 62);
    if (isValidSignature(signed[i].signatureData)) {
      try {
        const img = await loadImage(signed[i].signatureData!);
        const maxW = cellW - 70, maxH = 72;
        const ratio = Math.min(maxW / img.width, maxH / img.height);
        const iw = img.width * ratio, ih = img.height * ratio;
        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        ctx.drawImage(img, x + (cellW - iw) / 2, cy + 80, iw, ih);
        ctx.restore();
      } catch { /* تجاهل صورة تالفة */ }
    }
    ctx.fillStyle = "#8a8f9e";
    ctx.font = "17px 'Segoe UI', Tahoma, Arial";
    ctx.fillText("موقّع إلكترونياً — " + fmtDate(signed[i].signedAt), x + cellW / 2, cy + cellH - 20);
  }

  // الختم — تاريخه = تاريخ آخر توقيع مكتمل
  const lastSignedAt = signed
    .map((s) => (s.signedAt ? new Date(s.signedAt).getTime() : 0))
    .reduce((a, b) => Math.max(a, b), 0);
  const stampCy = top + rows * (cellH + GAP) + STAMP_H / 2 - 6;
  drawStamp(ctx, W / 2, stampCy, 0.82, lastSignedAt ? new Date(lastSignedAt) : undefined);

  // تذييل
  ctx.fillStyle = "#9aa0ad";
  ctx.font = "16px 'Segoe UI', Tahoma, Arial";
  const parts = [doc.cycleTitle, doc.title].filter(Boolean).join(" — ");
  ctx.fillText(
    (parts ? parts + " · " : "") + "اعتماد إلكتروني موثّق أُنشئ آلياً ويُعد جزءاً من هذا المستند",
    W / 2,
    H - PAD + 6
  );

  return { dataUrl: canvas.toDataURL("image/png"), w: W, h: H };
}

// الدالة الرئيسية: تستلم بايتات PDF الأصلي وتعيد النسخة المعتمدة
// بطباعة شريط الاعتماد والختم أسفل آخر صفحة من الملف نفسه
export async function buildApprovedPdf(
  originalPdfBytes: ArrayBuffer,
  doc: StampDocInfo,
  signers: StampSigner[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true });
  const overlay = await renderApprovalOverlay(doc, signers);
  const pngBytes = Uint8Array.from(atob(overlay.dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
  const png = await pdfDoc.embedPng(pngBytes);

  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width: pw, height: ph } = lastPage.getSize();

  // عرض الشريط = عرض الصفحة مع هوامش، مع سقف للارتفاع = 40% من الصفحة
  const margin = 18;
  let drawW = pw - margin * 2;
  let drawH = drawW * (overlay.h / overlay.w);
  const maxH = ph * 0.4;
  if (drawH > maxH) {
    drawH = maxH;
    drawW = drawH * (overlay.w / overlay.h);
  }
  lastPage.drawImage(png, {
    x: (pw - drawW) / 2,
    y: margin,
    width: drawW,
    height: drawH,
  });
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
