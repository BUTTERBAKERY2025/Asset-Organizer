import * as fs from 'fs';
import * as path from 'path';

let cachedLogoBase64: string | null = null;

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
      width: 120px;
      height: auto;
      max-height: 60px;
      object-fit: contain;
    }
    
    .pdf-header-text {
      flex: 1;
      text-align: center;
    }
    
    .pdf-title {
      font-size: 20px;
      font-weight: bold;
      color: #92400e;
      margin: 0;
    }
    
    .pdf-subtitle {
      font-size: 12px;
      color: #666;
      margin: 5px 0 0 0;
    }`;
}
