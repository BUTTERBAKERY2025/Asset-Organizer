export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export async function exportToExcel(
  data: any[],
  columns: ExportColumn[],
  fileName: string,
  sheetName: string = "البيانات",
  headerInfo?: { label: string; value: string }[]
) {
  const XLSX = await import("xlsx");
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

  let worksheet: any;
  
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

export interface PrintOptions {
  landscape?: boolean;
  companyName?: string;
  showLogo?: boolean;
}

export function printAsPDF(
  data: any[],
  columns: ExportColumn[],
  title: string,
  subtitle?: string,
  headerInfo?: { label: string; value: string }[],
  options?: PrintOptions
) {
  const { landscape = false, companyName = "شركة الزبد الأفضل التجارية", showLogo = true } = options || {};
  
  const tableRows = data
    .map((item, idx) => {
      const cells = columns
        .map((col) => {
          const keys = col.key.split(".");
          let value = item;
          for (const k of keys) {
            value = value?.[k];
          }
          return `<td>${value ?? ""}</td>`;
        })
        .join("");
      return `<tr class="${idx % 2 === 0 ? 'even' : 'odd'}">${cells}</tr>`;
    })
    .join("");

  const tableHeaders = columns
    .map((col) => `<th>${col.header}</th>`)
    .join("");

  const headerInfoHtml = headerInfo?.length ? `
    <div class="stats-container">
      ${headerInfo.map(h => `
        <div class="stat-card">
          <div class="stat-label">${h.label}</div>
          <div class="stat-value">${h.value}</div>
        </div>
      `).join("")}
    </div>
  ` : "";

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        @page { size: ${landscape ? 'A4 landscape' : 'A4 portrait'}; margin: 15mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Cairo', 'Segoe UI', sans-serif; padding: 0; margin: 0; direction: rtl; background: #fff; color: #1a1a1a; font-size: 11px; line-height: 1.4; }
        .document { max-width: 100%; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #1a3a2f 0%, #2d5a47 100%); color: white; padding: 20px 25px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        .header-right { display: flex; align-items: center; gap: 15px; }
        .logo-placeholder { width: 60px; height: 60px; background: linear-gradient(135deg, #f5a623 0%, #e67e22 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; color: #1a3a2f; }
        .company-info h1 { margin: 0; font-size: 18px; font-weight: 700; }
        .company-info .subtitle { margin: 4px 0 0; font-size: 12px; opacity: 0.9; color: #f5a623; }
        .header-left { text-align: left; font-size: 10px; opacity: 0.85; }
        .header-left div { margin: 3px 0; }
        .document-title { background: #f8f9fa; border-right: 4px solid #f5a623; padding: 12px 20px; margin-bottom: 20px; border-radius: 0 8px 8px 0; }
        .document-title h2 { margin: 0; font-size: 16px; color: #1a3a2f; font-weight: 700; }
        .document-title p { margin: 4px 0 0; color: #666; font-size: 11px; }
        .stats-container { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .stat-card { background: linear-gradient(135deg, #fef9f3 0%, #fff5eb 100%); border: 1px solid #f5a623; border-radius: 8px; padding: 12px 15px; text-align: center; }
        .stat-label { font-size: 10px; color: #666; margin-bottom: 4px; }
        .stat-value { font-size: 14px; font-weight: 700; color: #1a3a2f; }
        table { width: 100%; border-collapse: collapse; margin-top: 5px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        thead { background: linear-gradient(135deg, #1a3a2f 0%, #2d5a47 100%); }
        th { color: white; padding: 12px 10px; text-align: right; font-weight: 600; font-size: 10px; border-left: 1px solid rgba(255,255,255,0.1); white-space: nowrap; }
        th:last-child { border-left: none; }
        td { padding: 10px; text-align: right; border-bottom: 1px solid #eee; font-size: 10px; border-left: 1px solid #f0f0f0; }
        td:last-child { border-left: none; }
        tr.even { background: #fff; }
        tr.odd { background: #fafbfc; }
        tbody tr:hover { background: #fff8f0; }
        tbody tr:last-child td { border-bottom: none; }
        .footer { margin-top: 25px; padding-top: 15px; border-top: 2px solid #1a3a2f; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #666; }
        .footer-brand { display: flex; align-items: center; gap: 8px; }
        .footer-brand-icon { width: 20px; height: 20px; background: #f5a623; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: #1a3a2f; }
        .footer-text { font-weight: 600; color: #1a3a2f; }
        .confidential { background: #fee2e2; color: #991b1b; padding: 3px 10px; border-radius: 4px; font-size: 8px; font-weight: 600; }
        @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } .header, thead, .stat-card, .footer-brand-icon, .logo-placeholder { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      <div class="document">
        <div class="header">
          <div class="header-right">
            ${showLogo ? '<div class="logo-placeholder">ز</div>' : ''}
            <div class="company-info">
              <h1>${companyName}</h1>
              <div class="subtitle">BUTTER BAKERY - CEO COMMAND</div>
            </div>
          </div>
          <div class="header-left">
            <div>تاريخ الإصدار: ${new Date().toLocaleDateString("ar-SA-u-nu-latn", { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div>رقم المرجع: DOC-${Date.now().toString(36).toUpperCase()}</div>
          </div>
        </div>
        <div class="document-title">
          <h2>${title}</h2>
          ${subtitle ? `<p>${subtitle}</p>` : ""}
        </div>
        ${headerInfoHtml}
        <table>
          <thead><tr>${tableHeaders}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div class="footer">
          <div class="footer-brand">
            <div class="footer-brand-icon">ز</div>
            <span class="footer-text">BUTTER BAKERY SYSTEM</span>
          </div>
          <div>إجمالي السجلات: ${data.length}</div>
          <div class="confidential">سري - للاستخدام الداخلي فقط</div>
        </div>
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

export function downloadAsPDF(
  data: any[],
  columns: ExportColumn[],
  fileName: string,
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
          return `<td style="border: 1px solid #ddd; padding: 6px 8px; text-align: right; font-size: 11px;">${value ?? ""}</td>`;
        })
        .join("");
      return `<tr style="background-color: ${idx % 2 === 0 ? "#fff" : "#f9f9f9"};">${cells}</tr>`;
    })
    .join("");

  const tableHeaders = columns
    .map(
      (col) =>
        `<th style="border: 1px solid #ddd; padding: 8px; background-color: #f5a623; color: white; text-align: right; font-size: 11px;">${col.header}</th>`
    )
    .join("");

  const headerInfoHtml = headerInfo?.length ? `
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; background: #f9f9f9; padding: 12px; border-radius: 6px; margin-bottom: 12px; border: 1px solid #eee;">
      ${headerInfo.map(h => `<div style="font-size: 11px;"><span style="color: #666; font-weight: 600;">${h.label}:</span> <span style="color: #333;">${h.value}</span></div>`).join("")}
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
        * { box-sizing: border-box; }
        body { font-family: 'Cairo', sans-serif; padding: 15px; direction: rtl; margin: 0; font-size: 12px; }
        .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #f5a623; padding-bottom: 10px; }
        .header h1 { color: #333; margin: 0 0 5px 0; font-size: 20px; }
        .header p { color: #666; margin: 0; font-size: 13px; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 11px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .footer { margin-top: 15px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
        @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } @page { size: A4 landscape; margin: 10mm; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        ${subtitle ? `<p>${subtitle}</p>` : ""}
      </div>
      ${headerInfoHtml}
      <div class="meta">
        <span>تاريخ التصدير: ${new Date().toLocaleDateString("en-GB")}</span>
        <span>إجمالي السجلات: ${data.length}</span>
      </div>
      <table>
        <thead><tr>${tableHeaders}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <div class="footer">
        <p>BUTTER BAKERY SYSTEM - CEO COMMAND | ${new Date().getFullYear()}</p>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "width=1200,height=800");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  }
}

// طباعة مستند HTML جاهز (للتقارير المخصّصة متعددة الجداول) عبر إطار مخفي ثم نافذة الطباعة
export function printHtmlDocument(html: string) {
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
  return value.toLocaleString("en-GB");
}

export function formatDateForExport(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("en-GB");
}
