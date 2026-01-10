import * as fs from 'fs';
import * as path from 'path';

let cachedLogoBase64: string | null = null;

export interface PdfMetadata {
  printedBy: string;
  printedAt: string;
  pageInfo?: string;
}

export function getLogoDataUrl(): string {
  if (cachedLogoBase64) {
    return cachedLogoBase64;
  }
  
  try {
    const logoPath = path.join(process.cwd(), 'server', 'assets', 'logo.png');
    const logoBuffer = fs.readFileSync(logoPath);
    cachedLogoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    return cachedLogoBase64;
  } catch (error) {
    console.error('Error loading logo:', error);
    return '';
  }
}

export function formatPrintDate(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Riyadh'
  };
  return now.toLocaleString('ar-SA', options);
}

export function getPdfHeaderHtml(title: string, subtitle?: string): string {
  const logoUrl = getLogoDataUrl();
  
  return `
  <div class="pdf-header">
    <div class="pdf-header-content">
      <div class="pdf-header-text">
        <h1 class="pdf-title">${title}</h1>
        ${subtitle ? `<p class="pdf-subtitle">${subtitle}</p>` : ''}
      </div>
      ${logoUrl ? `<img src="${logoUrl}" alt="Butter Bakery" class="pdf-logo" />` : ''}
    </div>
  </div>`;
}

export function getPdfHeaderStyles(): string {
  return `
    .pdf-header {
      border-bottom: 3px solid #f59e0b;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    
    .pdf-header-content {
      display: flex;
      flex-direction: row-reverse;
      align-items: center;
      justify-content: space-between;
    }
    
    .pdf-logo {
      width: 180px;
      height: auto;
      max-height: 90px;
      object-fit: contain;
    }
    
    .pdf-header-text {
      flex: 1;
      text-align: center;
    }
    
    .pdf-title {
      font-size: 22px;
      font-weight: bold;
      color: #92400e;
      margin: 0;
    }
    
    .pdf-subtitle {
      font-size: 13px;
      color: #666;
      margin: 5px 0 0 0;
    }`;
}

export function getPdfFooterStyles(): string {
  return `
    @page {
      margin-bottom: 25mm;
    }
    
    .pdf-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 20mm;
      display: flex;
      flex-direction: row-reverse;
      justify-content: space-between;
      align-items: center;
      padding: 5px 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 9px;
      color: #6b7280;
      background: white;
    }
    
    .pdf-footer-right {
      text-align: right;
    }
    
    .pdf-footer-center {
      text-align: center;
    }
    
    .pdf-footer-left {
      text-align: left;
    }
    
    .page-break {
      page-break-before: always;
    }
    
    .summary-section {
      page-break-before: always;
      padding-top: 20px;
    }
    
    .summary-title {
      font-size: 18px;
      font-weight: bold;
      color: #92400e;
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #f59e0b;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin: 20px 0;
    }
    
    .summary-card {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      border: 1px solid #f59e0b;
      border-radius: 10px;
      padding: 20px;
      text-align: center;
    }
    
    .summary-card-value {
      font-size: 28px;
      font-weight: bold;
      color: #92400e;
    }
    
    .summary-card-label {
      font-size: 12px;
      color: #78350f;
      margin-top: 5px;
    }
    
    .signature-section {
      margin-top: 40px;
      display: flex;
      flex-direction: row-reverse;
      justify-content: space-between;
    }
    
    .signature-box {
      width: 200px;
      text-align: center;
    }
    
    .signature-line {
      border-bottom: 1px solid #333;
      height: 40px;
      margin-bottom: 5px;
    }
    
    .signature-label {
      font-size: 10px;
      color: #666;
    }`;
}

export function getPdfFooterHtml(printedBy: string, printedAt: string): string {
  return `
  <div class="pdf-footer">
    <div class="pdf-footer-right">
      <span>طُبع بواسطة: ${printedBy}</span>
    </div>
    <div class="pdf-footer-center">
      <span>مخبز باتر - نظام إدارة الإنتاج</span>
    </div>
    <div class="pdf-footer-left">
      <span>تاريخ الطباعة: ${printedAt}</span>
    </div>
  </div>`;
}

export function getSummaryHtml(title: string, items: Array<{label: string; value: string}>): string {
  const cards = items.map(item => `
    <div class="summary-card">
      <div class="summary-card-value">${item.value}</div>
      <div class="summary-card-label">${item.label}</div>
    </div>
  `).join('');

  return `
  <div class="summary-section">
    <div class="summary-title">${title}</div>
    <div class="summary-grid">${cards}</div>
    
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">توقيع المسؤول</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">توقيع المدير</div>
      </div>
    </div>
  </div>`;
}
