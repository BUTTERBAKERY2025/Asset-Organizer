import html2pdf from 'html2pdf.js';

export function getArabicDefaultStyle() {
  return {
    fontSize: 11,
    alignment: 'right' as const,
  };
}

export function getArabicTableHeaderStyle() {
  return {
    bold: true,
    fontSize: 10,
    fillColor: '#f3f4f6',
    alignment: 'center' as const,
  };
}

// Generate PDF from HTML content - supports Arabic properly
export async function downloadArabicPdf(docDefinition: any, filename: string): Promise<void> {
  try {
    // Create HTML from doc definition
    const html = generateHtmlFromDocDefinition(docDefinition);
    
    // Create temporary container
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm';
    document.body.appendChild(container);
    
    // Generate PDF
    const options = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: filename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        letterRendering: true
      },
      jsPDF: { 
        unit: 'mm' as const, 
        format: 'a4' as const, 
        orientation: 'portrait' as const 
      }
    };
    
    await html2pdf().set(options).from(container).save();
    
    // Clean up
    document.body.removeChild(container);
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('خطأ في إنشاء ملف PDF: ' + (error as Error).message);
  }
}

function generateHtmlFromDocDefinition(doc: any): string {
  let html = `
    <style>
      * { font-family: 'Cairo', 'Amiri', 'Arial', sans-serif; direction: rtl; }
      body { padding: 20px; }
      .header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #D4AF37; padding-bottom: 15px; }
      .company-name { font-size: 16px; font-weight: bold; color: #D4AF37; }
      .company-name-en { font-size: 12px; color: #666; }
      .sub-text { font-size: 10px; color: #888; }
      .report-title { font-size: 18px; font-weight: bold; }
      .section-header { font-size: 14px; font-weight: bold; margin: 15px 0 10px 0; background: #f8f9fa; padding: 8px; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      th { background: #f3f4f6; padding: 8px; border: 1px solid #ddd; font-weight: bold; text-align: center; }
      td { padding: 8px; border: 1px solid #ddd; text-align: center; }
      .text-right { text-align: right; }
      .text-green { color: #28a745; }
      .text-red { color: #dc3545; }
      .bold { font-weight: bold; }
      .bg-green { background-color: #d4edda; }
      .bg-red { background-color: #f8d7da; }
      .bg-yellow { background-color: #fff3cd; }
      .bg-blue { background-color: #cce5ff; }
    </style>
  `;
  
  if (doc.content && Array.isArray(doc.content)) {
    for (const item of doc.content) {
      html += renderContentItem(item);
    }
  }
  
  return html;
}

function renderContentItem(item: any): string {
  if (!item) return '';
  
  // Handle string
  if (typeof item === 'string') {
    return `<p>${item}</p>`;
  }
  
  // Handle text object
  if (item.text !== undefined) {
    const style = item.style || '';
    const alignment = item.alignment || 'right';
    const bold = item.bold ? 'font-weight: bold;' : '';
    const color = item.color ? `color: ${item.color};` : '';
    const fontSize = item.fontSize ? `font-size: ${item.fontSize}px;` : '';
    
    let className = '';
    if (style === 'companyName') className = 'company-name';
    else if (style === 'companyNameEn') className = 'company-name-en';
    else if (style === 'subText') className = 'sub-text';
    else if (style === 'reportTitle') className = 'report-title';
    else if (style === 'sectionHeader') className = 'section-header';
    
    return `<div class="${className}" style="text-align: ${alignment}; ${bold} ${color} ${fontSize}">${item.text}</div>`;
  }
  
  // Handle columns
  if (item.columns && Array.isArray(item.columns)) {
    let html = '<div style="display: flex; justify-content: space-between;">';
    for (const col of item.columns) {
      html += '<div style="flex: 1;">';
      if (col.stack && Array.isArray(col.stack)) {
        for (const stackItem of col.stack) {
          html += renderContentItem(stackItem);
        }
      } else {
        html += renderContentItem(col);
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }
  
  // Handle table
  if (item.table && item.table.body) {
    let html = '<table>';
    const body = item.table.body;
    for (let i = 0; i < body.length; i++) {
      const row = body[i];
      html += '<tr>';
      for (const cell of row) {
        const tag = i === 0 ? 'th' : 'td';
        let cellContent = '';
        let cellStyle = '';
        let cellClass = '';
        
        if (typeof cell === 'object' && cell !== null) {
          cellContent = cell.text !== undefined ? cell.text : '';
          if (cell.bold) cellStyle += 'font-weight: bold;';
          if (cell.color) cellStyle += `color: ${cell.color};`;
          if (cell.fillColor === '#d4edda') cellClass = 'bg-green';
          else if (cell.fillColor === '#f8d7da') cellClass = 'bg-red';
          else if (cell.fillColor === '#fff3cd') cellClass = 'bg-yellow';
          else if (cell.fillColor === '#cce5ff') cellClass = 'bg-blue';
          if (cell.alignment === 'right') cellClass += ' text-right';
        } else {
          cellContent = cell || '';
        }
        
        html += `<${tag} class="${cellClass}" style="${cellStyle}">${cellContent}</${tag}>`;
      }
      html += '</tr>';
    }
    html += '</table>';
    return html;
  }
  
  // Handle canvas (line separator)
  if (item.canvas) {
    return '<hr style="border: none; border-top: 2px solid #D4AF37; margin: 15px 0;">';
  }
  
  return '';
}
