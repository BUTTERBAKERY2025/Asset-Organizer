import logo from "@assets/logo_butter_bakery__1768502624540.png";
import type { OwnerOverviewResponse, OwnerSalesResponse } from "@shared/owner-portal";

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

export async function exportOwnerPdf(input: { overview: OwnerOverviewResponse; sales?: OwnerSalesResponse; section?: ExportSection; branchName: string; period: string; sectionPage?: number }) {
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
    { text: `الفترة: ${input.period}    |    إعداد: ${new Date().toLocaleString("ar-SA-u-nu-latn")}`, fontSize: 9, color: "#655976", alignment: "right", margin: [0, 0, 0, 12] },
    { text: "نظرة عامة", style: "heading" },
    table(["المؤشر", "البيانات"], [
      ["المبيعات المسجلة", ownerMoney(sales.totals.sales)],
      ["تغطية التقارير", `${ownerNumber(sales.totals.reportedBranches)} من ${ownerNumber(sales.totals.branchCount)} فرع`],
      ["المقارنة", ownerDelta(sales.totals.sales, sales.totals.previousSales)],
      ["الأصول", ownerNumber(input.overview.assets.total)],
      ["أصول تحتاج اهتماماً", ownerNumber(input.overview.assets.needsAttention)],
      ["المساهمون", ownerNumber(input.overview.shareholders.count)],
      ["الحملات النشطة", ownerNumber(input.overview.marketing.activeCampaigns)],
    ]),
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
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("استغرق تجهيز PDF وقتاً أطول من المتوقع؛ حاول مرة أخرى")), 20_000);
    try {
      pdf.createPdf(definition, undefined, pdf.fonts, pdf.vfs).download(`butter-owner-${new Date().toISOString().slice(0, 10)}.pdf`, () => {
        window.clearTimeout(timeout);
        resolve();
      });
    }
    catch (error) { window.clearTimeout(timeout); reject(error); }
  });
}