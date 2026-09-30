import logo from "@assets/logo_butter_bakery__1768502624540.png";
import type { OwnerOverviewResponse, OwnerSalesResponse } from "@shared/owner-portal";
import { assertOwnerAccessGeneration } from "@/hooks/use-owner-portal";

type ExportSection = { title: string; columns: string[]; rows: string[][]; note?: string };

async function base64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("تعذر تحميل خط التقرير أو الشعار");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("تعذر تجهيز التقرير"));
    reader.readAsDataURL(blob);
  });
}

export const ownerNumber = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-latn", { maximumFractionDigits: 2 }).format(value);
export const ownerMoney = (value: number | null) => value === null ? "لا يوجد تقرير" : `${ownerNumber(value)} ر.س`;
export const ownerDelta = (sales: number, previous: number | null) => previous === null ? "لا تتوفر فترة سابقة للمقارنة" : previous === 0 ? "لا يمكن حساب التغير من فترة سابقة صفرية" : `${sales >= previous ? "+" : ""}${ownerNumber(((sales - previous) / previous) * 100)}% عن الفترة السابقة`;
export const ownerComparison = (sales: OwnerSalesResponse) => sales.totals.comparisonComparable === true && sales.totals.reportedBranches > 0
  ? ownerDelta(sales.totals.sales, sales.totals.previousSales)
  : "المقارنة غير متاحة لاختلاف تغطية التقارير أو غياب الفترة السابقة";
export const ownerCoverageWarning = (sales: OwnerSalesResponse) =>
  sales.totals.reportedBranches < sales.totals.branchCount || (sales.totals.previousReportedBranches !== undefined && sales.totals.previousReportedBranches !== sales.totals.reportedBranches)
    ? `تنبيه: تغطية التقارير الحالية ${ownerNumber(sales.totals.reportedBranches)} من ${ownerNumber(sales.totals.branchCount)}؛ السابقة ${sales.totals.previousReportedBranches === undefined ? "غير متاحة" : ownerNumber(sales.totals.previousReportedBranches)}. لا تمثل الأرقام جميع الفروع.`
    : null;
export const ownerRiyadhDate = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export async function exportOwnerPdf(input: { overview: OwnerOverviewResponse; sales?: OwnerSalesResponse; section?: ExportSection; branchName: string; period: string; sectionPage?: number; accessGeneration: number; assertSnapshot?: () => void }) {
  const check = () => { assertOwnerAccessGeneration(input.accessGeneration); input.assertSnapshot?.(); };
  check();
  const [pdfModule, vfsModule, brand] = await Promise.all([
    import("@digicole/pdfmake-rtl/build/pdfmake"),
    import("@digicole/pdfmake-rtl/build/vfs_fonts"),
    base64(logo),
  ]);
  const pdf = pdfModule.default as any;
  pdf.vfs = (vfsModule.default as any).default || vfsModule.default;
  // Use the fork's bundled, valid Arabic font. The legacy /assets/fonts/Amiri
  // files are HTML, and its fontkit crashes on even the valid older Amiri TTF.
  const arabicFont = { normal: "Nillima.ttf", bold: "Nillima.ttf", italics: "Nillima.ttf", bolditalics: "Nillima.ttf" };
  pdf.fonts = { Nillima: arabicFont, Roboto: arabicFont };
  const sales = input.sales || input.overview;
  const salesUnavailable = !input.sales && !!input.overview.sectionErrors?.sales;
  const unavailable = "غير متاح حالياً";
  const text = (value: string, boldText = false) => ({ text: value, alignment: "right", bold: boldText, margin: [0, 3, 0, 3] });
  const table = (columns: string[], rows: string[][]) => ({
    // This RTL fork places its first array cell at the visual right edge.
    // Keep headers, cells, and widths in the same logical order.
    table: { headerRows: 1, widths: columns.map(() => "*"), body: [
      columns.map(v => ({ ...text(v, true), fillColor: "#eee8f4" })),
      ...rows.map(row => row.map(v => text(v))),
    ] },
    layout: { hLineColor: "#ddd4e8", vLineColor: "#ddd4e8", paddingLeft: () => 7, paddingRight: () => 7 },
    margin: [0, 8, 0, 16],
  });
  const content: any[] = [
    { columns: [{ image: brand, fit: [78, 58], alignment: "right" }, { stack: [text("باتر بيكري | بوابة المالك", true), text(`تقرير ملخص · ${input.branchName}`)], alignment: "right" }], margin: [0, 0, 0, 15] },
    { text: `الفترة: ${input.period}    |    إعداد: ${new Date().toLocaleString("ar-SA-u-nu-latn", { timeZone: "Asia/Riyadh" })} (الرياض)`, fontSize: 9, color: "#655976", alignment: "right", margin: [0, 0, 0, 12] },
    { text: "نظرة عامة", style: "heading" },
    table(["المؤشر", "البيانات"], [
      ["إجمالي المبيعات (شامل الضريبة) كما سُجلت في يوميات الكاشير", salesUnavailable ? unavailable : sales.totals.reportedBranches === 0 ? "لم يصل تقرير للفترة" : ownerMoney(sales.totals.sales)],
      ["تغطية التقارير", salesUnavailable ? unavailable : `${ownerNumber(sales.totals.reportedBranches)} من ${ownerNumber(sales.totals.branchCount)} فرع`],
      ["المقارنة", salesUnavailable ? unavailable : ownerComparison(sales)],
      ["الأصول", input.overview.assets && !input.overview.sectionErrors?.assets ? ownerNumber(input.overview.assets.total) : unavailable],
      ["أصول تحتاج اهتماماً", input.overview.assets && !input.overview.sectionErrors?.assets ? ownerNumber(input.overview.assets.needsAttention) : unavailable],
      ["المساهمون", input.overview.shareholders && !input.overview.sectionErrors?.shareholders ? ownerNumber(input.overview.shareholders.count) : unavailable],
      ["الحملات النشطة", input.overview.marketing && !input.overview.sectionErrors?.marketing ? ownerNumber(input.overview.marketing.activeCampaigns) : unavailable],
    ]),
    ...(!salesUnavailable && ownerCoverageWarning(sales) ? [text(ownerCoverageWarning(sales)!)] : []),
    { text: sales.sourceLabel, fontSize: 9, color: "#655976", alignment: "right" },
  ];
  if (input.section) {
    content.push({ text: input.section.title, style: "heading", margin: [0, 17, 0, 2] });
    content.push({ text: `تصدير الصفحة المعروضة فقط${input.sectionPage ? ` (${input.sectionPage})` : ""} · ${input.section.note || "بيانات للقراءة فقط"}`, fontSize: 9, alignment: "right", color: "#655976" });
    if (input.section.rows.length) content.push(table(input.section.columns, input.section.rows));
    else content.push(text("لا توجد بيانات في الصفحة الحالية."));
  }
  const definition = {
    pageSize: "A4", pageMargins: [34, 38, 34, 48], content,
    defaultStyle: { font: "Nillima", fontSize: 11, alignment: "right", color: "#282339" },
    styles: { heading: { fontSize: 16, bold: true, color: "#4d337a", alignment: "right" } },
    footer: (page: number, total: number) => ({ columns: [
      { text: `صفحة ${page} من ${total}`, alignment: "left" },
      { text: "باتر بيكري · تقرير داخلي للمالك", alignment: "right" },
    ], margin: [34, 0, 34, 0], fontSize: 8, color: "#81798e" }),
  };
  check();
  await new Promise<void>((resolve, reject) => {
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      reject(new Error("استغرق تجهيز PDF وقتاً أطول من المتوقع؛ حاول مرة أخرى"));
    }, 20_000);
    try {
      pdf.createPdf(definition, undefined, pdf.fonts, pdf.vfs).getBlob((blob: Blob) => {
        if (timedOut) return;
        window.clearTimeout(timeout);
        let url: string | undefined;
        try {
          check();
          url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `butter-owner-${ownerRiyadhDate()}.pdf`;
          check();
          link.click();
          resolve();
        } catch (error) { reject(error); }
        finally { if (url) { const downloadUrl = url; window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000); } }
      });
    }
    catch (error) { window.clearTimeout(timeout); reject(error); }
  });
}