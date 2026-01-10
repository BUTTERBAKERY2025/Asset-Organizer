import PdfPrinter from "pdfmake";
import path from "path";
import { fileURLToPath } from "url";
// @ts-ignore
import ArabicReshaper from "arabic-reshaper";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fonts = {
  Amiri: {
    normal: path.join(__dirname, "fonts", "Amiri-Regular.ttf"),
    bold: path.join(__dirname, "fonts", "Amiri-Regular.ttf"),
    italics: path.join(__dirname, "fonts", "Amiri-Regular.ttf"),
    bolditalics: path.join(__dirname, "fonts", "Amiri-Regular.ttf"),
  },
};

const printer = new PdfPrinter(fonts);

function shapeArabic(text: string): string {
  if (!text) return text;
  try {
    const reshaped = ArabicReshaper.convertArabic(text);
    return reshaped.split('').reverse().join('');
  } catch (e) {
    return text;
  }
}

export interface SalaryClosingEmployee {
  employeeName: string;
  jobTitle: string;
  presentDays: number;
  absentDays: number;
  totalHours: number;
  baseSalary: number;
  allowances: number;
  socialInsurance: number;
  netSalary: number;
}

export interface SalaryClosingPdfData {
  branchName: string;
  month: string;
  employees: SalaryClosingEmployee[];
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

function formatCurrency(num: number): string {
  return new Intl.NumberFormat("en-US").format(num) + " ريال";
}

export function generateSalaryClosingPdf(data: SalaryClosingPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const totals = data.employees.reduce(
        (acc, emp) => ({
          baseSalary: acc.baseSalary + emp.baseSalary,
          allowances: acc.allowances + emp.allowances,
          socialInsurance: acc.socialInsurance + emp.socialInsurance,
          netSalary: acc.netSalary + emp.netSalary,
        }),
        { baseSalary: 0, allowances: 0, socialInsurance: 0, netSalary: 0 }
      );

      const tableBody = [
        [
          { text: shapeArabic("م"), style: "tableHeader" },
          { text: shapeArabic("الموظف"), style: "tableHeader" },
          { text: shapeArabic("الوظيفة"), style: "tableHeader" },
          { text: shapeArabic("الحضور"), style: "tableHeader" },
          { text: shapeArabic("الغياب"), style: "tableHeader" },
          { text: shapeArabic("الساعات"), style: "tableHeader" },
          { text: shapeArabic("الراتب"), style: "tableHeader" },
          { text: shapeArabic("البدلات"), style: "tableHeader" },
          { text: shapeArabic("التأمينات"), style: "tableHeader" },
          { text: shapeArabic("الصافي"), style: "tableHeader" },
        ],
        ...data.employees.map((emp, index) => [
          { text: String(index + 1), alignment: "center" as const },
          { text: shapeArabic(emp.employeeName), alignment: "right" as const },
          { text: shapeArabic(emp.jobTitle), alignment: "right" as const },
          { text: String(emp.presentDays), alignment: "center" as const },
          { text: String(emp.absentDays), alignment: "center" as const },
          { text: String(emp.totalHours), alignment: "center" as const },
          { text: formatNumber(emp.baseSalary), alignment: "center" as const },
          { text: formatNumber(emp.allowances), alignment: "center" as const },
          { text: emp.socialInsurance > 0 ? formatNumber(emp.socialInsurance) : "-", alignment: "center" as const, color: "red" },
          { text: formatNumber(emp.netSalary), alignment: "center" as const, bold: true },
        ]),
      ];

      const docDefinition: any = {
        pageOrientation: "landscape",
        content: [
          { text: shapeArabic("تقرير إغلاق الرواتب الشهرية"), style: "header", alignment: "center" },
          {
            text: shapeArabic(`الفرع: ${data.branchName} | الشهر: ${data.month}`),
            alignment: "center",
            margin: [0, 0, 0, 10],
          },
          {
            text: shapeArabic(`عدد الموظفين: ${data.employees.length} | إجمالي الرواتب: ${formatNumber(totals.netSalary)} ريال`),
            alignment: "center",
            margin: [0, 0, 0, 20],
          },
          {
            table: {
              headerRows: 1,
              widths: ["auto", "*", "auto", "auto", "auto", "auto", "auto", "auto", "auto", "auto"],
              body: tableBody,
            },
            layout: "lightHorizontalLines",
          },
          { text: "", margin: [0, 20, 0, 0] },
          {
            table: {
              widths: ["*", "auto", "auto", "auto", "auto"],
              body: [
                [
                  { text: shapeArabic("الإجمالي"), bold: true, alignment: "right" as const },
                  { text: shapeArabic(`${formatNumber(totals.baseSalary)} ريال`), alignment: "center" as const },
                  { text: shapeArabic(`${formatNumber(totals.allowances)} ريال`), alignment: "center" as const },
                  { text: shapeArabic(`${formatNumber(totals.socialInsurance)} ريال`), alignment: "center" as const, color: "red" },
                  { text: shapeArabic(`${formatNumber(totals.netSalary)} ريال`), alignment: "center" as const, bold: true },
                ],
              ],
            },
          },
        ],
        styles: {
          header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
          tableHeader: { bold: true, fontSize: 9, fillColor: "#f3f4f6", alignment: "center" },
        },
        defaultStyle: {
          font: "Amiri",
          fontSize: 8,
        },
      };

      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];

      pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", reject);

      pdfDoc.end();
    } catch (error) {
      reject(error);
    }
  });
}
