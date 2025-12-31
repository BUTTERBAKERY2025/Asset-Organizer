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
  sheetName: string = "البيانات",
  headerInfo?: { label: string; value: string }[]
) {
  const headerRows: any[][] = [];
  
  if (headerInfo?.length) {
    headerRows.push([fileName]);
    headerRows.push([]);
    headerInfo.forEach(h => {
      headerRows.push([h.label, h.value]);
    });
    headerRows.push([]);
    headerRows.push(columns.map(c => c.header));
  }

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

  let worksheet: XLSX.WorkSheet;
  
  if (headerInfo?.length) {
    const dataRows = exportData.map(item => columns.map(col => item[col.header]));
    const allRows = [...headerRows, ...dataRows];
    worksheet = XLSX.utils.aoa_to_sheet(allRows);
  } else {
    worksheet = XLSX.utils.json_to_sheet(exportData);
  }
  
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
  subtitle?: string,
  headerInfo?: { label: string; value: string }[]
) {
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

  const headerInfoHtml = headerInfo?.length ? `
    <div class="info-grid">
      ${headerInfo.map(h => `<div class="info-item"><span class="info-label">${h.label}:</span> <span class="info-value">${h.value}</span></div>`).join("")}
    </div>
  ` : "";

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
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          background: #f9f9f9;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 15px;
          border: 1px solid #eee;
        }
        .info-item {
          font-size: 13px;
        }
        .info-label {
          color: #666;
          font-weight: 600;
        }
        .info-value {
          color: #333;
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
      ${headerInfoHtml}
      <div class="meta">
        <span>تاريخ الطباعة: ${new Date().toLocaleDateString("en-GB")}</span>
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

  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.left = "-9999px";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (iframeDoc) {
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 250);
    };
  }
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
