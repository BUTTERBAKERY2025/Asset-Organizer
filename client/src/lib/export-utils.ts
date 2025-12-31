import * as XLSX from "xlsx";

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export function exportToExcel(
  data: any[],
  columns: ExportColumn[],
  fileName: string,
  sheetName: string = "البيانات"
) {
  const exportData = data.map((item) => {
    const row: Record<string, any> = {};
    columns.forEach((col) => {
      const keys = col.key.split(".");
      let value = item;
      for (const k of keys) {
        value = value?.[k];
      }
      row[col.header] = value ?? "";
    });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  
  const colWidths = columns.map((col) => ({ wch: col.width || 15 }));
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export function exportToCSV(
  data: any[],
  columns: ExportColumn[],
  fileName: string
) {
  const BOM = "\uFEFF";
  
  const headers = columns.map((col) => col.header).join(",");
  
  const rows = data.map((item) => {
    return columns
      .map((col) => {
        const keys = col.key.split(".");
        let value = item;
        for (const k of keys) {
          value = value?.[k];
        }
        const strValue = String(value ?? "");
        if (strValue.includes(",") || strValue.includes('"') || strValue.includes("\n")) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      })
      .join(",");
  });

  const csv = BOM + headers + "\n" + rows.join("\n");
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function printAsPDF(
  data: any[],
  columns: ExportColumn[],
  title: string,
  subtitle?: string
) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("يرجى السماح بالنوافذ المنبثقة لطباعة التقرير");
    return;
  }

  const tableRows = data
    .map((item, idx) => {
      const cells = columns
        .map((col) => {
          const keys = col.key.split(".");
          let value = item;
          for (const k of keys) {
            value = value?.[k];
          }
          return `<td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${value ?? ""}</td>`;
        })
        .join("");
      return `<tr style="background-color: ${idx % 2 === 0 ? "#fff" : "#f9f9f9"};">${cells}</tr>`;
    })
    .join("");

  const tableHeaders = columns
    .map(
      (col) =>
        `<th style="border: 1px solid #ddd; padding: 10px; background-color: #f5a623; color: white; text-align: right;">${col.header}</th>`
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
        body {
          font-family: 'Cairo', sans-serif;
          padding: 20px;
          direction: rtl;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #f5a623;
          padding-bottom: 15px;
        }
        .header h1 {
          color: #333;
          margin: 0 0 5px 0;
        }
        .header p {
          color: #666;
          margin: 0;
        }
        .meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 15px;
          font-size: 12px;
          color: #666;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        .footer {
          margin-top: 20px;
          text-align: center;
          font-size: 11px;
          color: #999;
          border-top: 1px solid #ddd;
          padding-top: 10px;
        }
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        ${subtitle ? `<p>${subtitle}</p>` : ""}
      </div>
      <div class="meta">
        <span>تاريخ الطباعة: ${new Date().toLocaleDateString("ar-SA")}</span>
        <span>إجمالي السجلات: ${data.length}</span>
      </div>
      <table>
        <thead>
          <tr>${tableHeaders}</tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <div class="footer">
        <p>نظام إدارة باتر بيكري - ${new Date().getFullYear()}</p>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  
  printWindow.onload = () => {
    printWindow.print();
  };
}

export function formatCurrencyForExport(value: number | null | undefined): string {
  if (value == null) return "0";
  return value.toLocaleString("ar-SA");
}

export function formatDateForExport(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("ar-SA");
}
