// إنشاء النسخة المعتمدة من مستند القوائم المالية:
// يضيف «صفحة اعتماد» في نهاية ملف PDF تحتوي التوقيعات وختم الإدارة المالية.
// تُرسم الصفحة بالكامل على كانفس (لدعم العربية) ثم تُدمج كصورة عبر pdf-lib.
import { PDFDocument } from "pdf-lib";
import stampUrl from "@/assets/finance-stamp.png";
import hrStampUrl from "@/assets/hr-stamp.png";
import mainStampUrl from "@/assets/main-stamp.png";
import chairmanSigUrl from "@/assets/chairman-signature.png";

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


// تحويل صورة (توقيع/ختم) إلى شفافة: البكسلات الفاتحة تختفي ويبقى الحبر فقط
// حتى تُطبع مباشرة على خلفية الملف الأصلي بدون مربع أبيض تحتها
function toTransparentInk(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const cx = c.getContext("2d")!;
  cx.drawImage(img, 0, 0);
  const imgData = cx.getImageData(0, 0, c.width, c.height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (d[i + 3] === 0) continue; // شفاف أصلاً
    if (lum >= 235) {
      d[i + 3] = 0; // أبيض → شفاف
    } else if (lum > 160) {
      // تدرّج ناعم على الحواف
      d[i + 3] = Math.round(d[i + 3] * ((235 - lum) / 75));
    }
  }
  cx.putImageData(imgData, 0, 0);
  return c;
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

// أنواع الأختام المتاحة (المالية PNG، والبقية SVG بنفس الطراز الدائري)
export type StampKind = "finance" | "hr" | "main" | "chairman";
export const STAMP_LABELS: Record<StampKind, string> = {
  finance: "ختم الإدارة المالية",
  hr: "ختم شؤون الموظفين",
  main: "الختم الرئيسي (الإدارة العامة)",
  chairman: "توقيع رئيس مجلس الإدارة",
};
const STAMP_URLS: Record<StampKind, string> = {
  finance: stampUrl,
  hr: hrStampUrl,
  main: mainStampUrl,
  chairman: chairmanSigUrl,
};

// تحميل صورة الختم (تُحوَّل لعنصر صورة مرة واحدة لكل نوع)
const stampImgPromises: Partial<Record<StampKind, Promise<HTMLImageElement>>> = {};
function getStampImage(kind: StampKind = "finance"): Promise<HTMLImageElement> {
  if (!stampImgPromises[kind]) stampImgPromises[kind] = loadImage(STAMP_URLS[kind]);
  return stampImgPromises[kind]!;
}

// إنشاء «شريط الاعتماد» الناعم الذي يُطبع أسفل محتوى آخر صفحة من المستند نفسه
// بدون لوحة خلفية — شفاف تماماً ليتماشى مع خلفية الورقة الأصلية
async function renderApprovalOverlay(
  doc: StampDocInfo,
  signers: StampSigner[]
): Promise<{ dataUrl: string; w: number; h: number }> {
  const signed = signers.filter((s) => s.status === "signed");
  const W = 1500;
  const PAD = 20;
  const TITLE_H = 58;
  const perRow = Math.min(Math.max(signed.length, 1), 4);
  const rows = Math.max(1, Math.ceil(signed.length / perRow));
  const GAP = 14;
  const cellW = (W - PAD * 2 - GAP * (perRow - 1)) / perRow;
  const cellH = 172;
  const STAMP_H = 210;
  const FOOTER_H = 34;
  const H = PAD + TITLE_H + rows * (cellH + GAP) + STAMP_H + FOOTER_H;

  // رسم بدقة أعلى (x1.6) — وضوح جيد مع حجم صورة متوافق مع كل العارضات
  const SS = 1.6;
  const canvas = document.createElement("canvas");
  canvas.width = W * SS;
  canvas.height = H * SS;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SS, SS);
  // شفاف بالكامل — لا خلفية ولا إطار

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // عنوان ناعم مع خطين قصيرين على الجانبين
  ctx.fillStyle = "#3d4661";
  ctx.font = "bold 30px 'Segoe UI', Tahoma, Arial";
  const title = "الاعتمادات والتوقيعات";
  ctx.fillText(title, W / 2, PAD + 20);
  const tw = ctx.measureText(title).width;
  ctx.strokeStyle = "rgba(185,162,92,0.55)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(W / 2 + tw / 2 + 30, PAD + 20);
  ctx.lineTo(W / 2 + tw / 2 + 190, PAD + 20);
  ctx.moveTo(W / 2 - tw / 2 - 30, PAD + 20);
  ctx.lineTo(W / 2 - tw / 2 - 190, PAD + 20);
  ctx.stroke();

  // أعمدة التوقيعات بدون صناديق — فواصل رأسية خفيفة فقط
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

    // فاصل رأسي خفيف بين الأعمدة (ليس بعد آخر عمود يساراً)
    if (col < rowCount - 1) {
      ctx.strokeStyle = "rgba(185,162,92,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - GAP / 2, cy + 14);
      ctx.lineTo(x - GAP / 2, cy + cellH - 14);
      ctx.stroke();
    }

    ctx.fillStyle = "#8a6d1f";
    ctx.font = "bold 21px 'Segoe UI', Tahoma, Arial";
    ctx.fillText(positionLabel(signed[i].signerPosition), x + cellW / 2, cy + 14);
    ctx.fillStyle = "#2c3347";
    ctx.font = "bold 22px 'Segoe UI', Tahoma, Arial";
    ctx.fillText(signed[i].signerName, x + cellW / 2, cy + 48);
    if (isValidSignature(signed[i].signatureData)) {
      try {
        const img = await loadImage(signed[i].signatureData!);
        const maxW = cellW - 60, maxH = 66;
        const ratio = Math.min(maxW / img.width, maxH / img.height);
        const iw = img.width * ratio, ih = img.height * ratio;
        ctx.drawImage(toTransparentInk(img), x + (cellW - iw) / 2, cy + 66, iw, ih);
      } catch { /* تجاهل صورة تالفة */ }
    }
    // خط توقيع رفيع تحت التوقيع
    ctx.strokeStyle = "rgba(120,128,148,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 50, cy + cellH - 32);
    ctx.lineTo(x + cellW - 50, cy + cellH - 32);
    ctx.stroke();
    ctx.fillStyle = "#9aa0ad";
    ctx.font = "16px 'Segoe UI', Tahoma, Arial";
    ctx.fillText("موقّع إلكترونياً — " + fmtDate(signed[i].signedAt), x + cellW / 2, cy + cellH - 14);
  }

  // الختم الرسمي (الصورة المعتمدة) بميل خفيف + تاريخ الاعتماد تحته
  const lastSignedAt = signed
    .map((s) => (s.signedAt ? new Date(s.signedAt).getTime() : 0))
    .reduce((a, b) => Math.max(a, b), 0);
  const stampTop = top + rows * (cellH + GAP) + 4;
  try {
    const stamp = await getStampImage();
    const sh = STAMP_H - 40;
    const sw = sh * (stamp.width / stamp.height);
    ctx.save();
    ctx.translate(W / 2, stampTop + sh / 2);
    ctx.rotate(-0.07);
    ctx.globalAlpha = 0.92;
    ctx.drawImage(toTransparentInk(stamp), -sw / 2, -sh / 2, sw, sh);
    ctx.restore();
  } catch { /* في حال تعذّر تحميل الختم نتجاوزه */ }
  if (lastSignedAt) {
    const d = new Date(lastSignedAt);
    const pad2 = (n: number) => String(n).padStart(2, "0");
    ctx.fillStyle = "#1b4f8a";
    ctx.font = "bold 18px 'Segoe UI', Tahoma, Arial";
    ctx.fillText(
      `معتمد بتاريخ ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`,
      W / 2,
      stampTop + STAMP_H - 16
    );
  }

  // تذييل صغير
  ctx.fillStyle = "rgba(154,160,173,0.85)";
  ctx.font = "15px 'Segoe UI', Tahoma, Arial";
  const parts = [doc.cycleTitle, doc.title].filter(Boolean).join(" — ");
  ctx.fillText(
    (parts ? parts + " · " : "") + "اعتماد إلكتروني موثّق أُنشئ آلياً ويُعد جزءاً من هذا المستند",
    W / 2,
    H - 12
  );

  return { dataUrl: canvas.toDataURL("image/png"), w: W, h: H };
}

// تحليل آخر صفحة عبر pdf.js وإرجاع «الفراغات الرأسية» فيها (بالنقاط من أعلى الصفحة)
// حتى يوضع شريط الاعتماد في أقرب فراغ بعد آخر نص — حتى لو كان هناك تذييل أسفل الصفحة
async function detectVerticalGaps(
  pdfBytes: ArrayBuffer
): Promise<{ topPt: number; heightPt: number }[] | null> {
  try {
    const pdfjs = await import("pdfjs-dist");
    // @ts-ignore — استيراد رابط الـ worker عبر Vite
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const loaded = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes.slice(0)) }).promise;
    const page = await loaded.getPage(loaded.numPages);
    const scale = 1.2;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport } as any).promise;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    // هل يحتوي الصف على محتوى فعلي (نص/جداول/صور)؟
    const rowHasContent = (y: number): boolean => {
      let hits = 0;
      const rowOff = y * canvas.width * 4;
      for (let x = 0; x < canvas.width; x += 2) {
        const o = rowOff + x * 4;
        const lum = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
        if (lum < 190) {
          hits++;
          if (hits >= 3) return true;
        }
      }
      return false;
    };
    const gaps: { topPt: number; heightPt: number }[] = [];
    let gapStart: number | null = 0;
    for (let y = 0; y < canvas.height; y++) {
      if (rowHasContent(y)) {
        if (gapStart != null) {
          gaps.push({ topPt: gapStart / scale, heightPt: (y - gapStart) / scale });
          gapStart = null;
        }
      } else if (gapStart == null) {
        gapStart = y;
      }
    }
    if (gapStart != null) gaps.push({ topPt: gapStart / scale, heightPt: (canvas.height - gapStart) / scale });
    loaded.destroy();
    return gaps;
  } catch {
    return null; // أي فشل → نرجع للوضع الافتراضي
  }
}

// الدالة الرئيسية: تستلم بايتات PDF الأصلي وتعيد النسخة المعتمدة
// بطباعة شريط الاعتماد والختم مباشرة تحت محتوى آخر صفحة من الملف نفسه
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

  const sideMargin = 26;
  const bottomMargin = 20;
  let drawW = pw - sideMargin * 2;
  let drawH = drawW * (overlay.h / overlay.w);
  const maxH = ph * 0.38;
  if (drawH > maxH) {
    drawH = maxH;
    drawW = drawH * (overlay.w / overlay.h);
  }

  // البحث عن أنسب فراغ في آخر صفحة: أقرب فراغ كافٍ بعد آخر نص (يتجاوز تذييل الصفحة)
  const gaps = await detectVerticalGaps(originalPdfBytes);
  let placePage = lastPage;
  let yTop: number; // موضع أعلى الشريط بالقياس من أعلى الصفحة
  const gapPad = 14; // مسافة صغيرة بين النص والشريط
  if (gaps && gaps.length) {
    const fits = gaps.filter((g) => g.heightPt >= drawH + gapPad + 8 && g.topPt > 40);
    if (fits.length) {
      // آخر فراغ كافٍ في الصفحة = مباشرة بعد آخر كتلة نص قبله
      const g = fits[fits.length - 1];
      yTop = g.topPt + gapPad;
      // لو الفراغ أكبر بكثير من الشريط لا نلصقه بأسفل الفراغ بل بعد النص مباشرة (وهذا ما يحدث تلقائياً)
    } else {
      // لا فراغ كافٍ → جرّب أكبر فراغ مع تصغير الشريط، وإلا صفحة جديدة
      const largest = gaps.reduce((a, b) => (b.heightPt > a.heightPt ? b : a));
      const usable = largest.heightPt - gapPad - 8;
      if (usable >= 130) {
        drawH = usable;
        drawW = drawH * (overlay.w / overlay.h);
        if (drawW > pw - sideMargin * 2) {
          drawW = pw - sideMargin * 2;
          drawH = drawW * (overlay.h / overlay.w);
        }
        yTop = largest.topPt + gapPad;
      } else {
        placePage = pdfDoc.addPage([pw, ph]);
        yTop = 40;
      }
    }
  } else {
    // تعذّر التحليل → أسفل الصفحة كما السابق
    yTop = ph - bottomMargin - drawH;
  }

  placePage.drawImage(png, {
    x: (pw - drawW) / 2,
    y: ph - yTop - drawH,
    width: drawW,
    height: drawH,
  });
  return await pdfDoc.save({ useObjectStreams: false });
}


// ====== الختم السريع: ختم أي ملف PDF على صفحة محددة وبموضع محدد (بدون توقيعات) ======
export type QuickStampPosition =
  | "bottom-right" | "bottom-center" | "bottom-left"
  | "center"
  | "top-right" | "top-center" | "top-left";

export async function getPdfPageCount(pdfBytes: ArrayBuffer): Promise<number> {
  const d = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  return d.getPageCount();
}

export async function quickStampPdf(
  originalPdfBytes: ArrayBuffer,
  pageIndex: number, // 0-based
  position: QuickStampPosition,
  sizePt: number, // قطر الختم بالنقاط (72pt = بوصة)
  stampKind: StampKind = "finance"
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const page = pages[Math.min(Math.max(pageIndex, 0), pages.length - 1)];
  const { width: pw, height: ph } = page.getSize();

  // تجهيز صورة الختم الشفافة بدقة عالية وميل خفيف
  const stampImg = await getStampImage(stampKind);
  const inked = toTransparentInk(stampImg);
  // نسبة أبعاد الصورة (التوقيع عريض، الأختام مربعة) — نحافظ عليها بدون تشويه
  const ar = inked.height / inked.width;
  const SS = 2.2; // دقة إضافية
  const px = Math.round(sizePt * SS * 2);
  const c = document.createElement("canvas");
  c.width = px;
  c.height = Math.round(px * ar);
  const cx = c.getContext("2d")!;
  cx.translate(c.width / 2, c.height / 2);
  cx.rotate(-0.08);
  cx.globalAlpha = 0.93;
  const s = px * 0.86; // هامش يمنع قص الحواف بعد الدوران
  cx.drawImage(inked, -s / 2, (-s * ar) / 2, s, s * ar);
  const pngBytes = Uint8Array.from(atob(c.toDataURL("image/png").split(",")[1]), (ch) => ch.charCodeAt(0));
  const png = await pdfDoc.embedPng(pngBytes);

  const m = 24; // هامش من حواف الصفحة
  const drawW = sizePt / 0.86;
  const drawH = drawW * ar;
  const xs: Record<string, number> = {
    left: m,
    center: (pw - drawW) / 2,
    right: pw - m - drawW,
  };
  const ys: Record<string, number> = {
    top: ph - m - drawH,
    middle: (ph - drawH) / 2,
    bottom: m,
  };
  const [vPos, hPos] = position === "center" ? ["middle", "center"] : (position.split("-") as [string, string]);
  page.drawImage(png, { x: xs[hPos], y: ys[vPos], width: drawW, height: drawH });
  return await pdfDoc.save({ useObjectStreams: false });
}

export function downloadPdf(bytes: Uint8Array, fileName: string) {
  // نسخة مستقلة من البايتات + تأخير إلغاء الرابط — بعض المتصفحات/العارضات
  // تفتح الملف قبل اكتمال قراءته فيبدو تالفاً أو «يفتح ويقفل»
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 1000);
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}
