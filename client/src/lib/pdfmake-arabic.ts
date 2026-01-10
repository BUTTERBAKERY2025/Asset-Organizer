import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

// Initialize pdfMake with default fonts
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).vfs || (pdfFonts as any).default?.pdfMake?.vfs || {};

let arabicFontsLoaded = false;
let loadingPromise: Promise<void> | null = null;

async function loadFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function ensureArabicFontsLoaded(): Promise<void> {
  if (arabicFontsLoaded) return;
  
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      console.log("Loading Cairo Arabic font...");
      const cairoBase64 = await loadFontAsBase64('/fonts/Cairo-Regular.ttf');
      
      // Register font in VFS
      (pdfMake as any).vfs['Cairo-Regular.ttf'] = cairoBase64;
      
      // Define font family
      (pdfMake as any).fonts = {
        Roboto: {
          normal: 'Roboto-Regular.ttf',
          bold: 'Roboto-Medium.ttf',
          italics: 'Roboto-Italic.ttf',
          bolditalics: 'Roboto-MediumItalic.ttf'
        },
        Cairo: {
          normal: 'Cairo-Regular.ttf',
          bold: 'Cairo-Regular.ttf',
          italics: 'Cairo-Regular.ttf',
          bolditalics: 'Cairo-Regular.ttf'
        }
      };
      
      arabicFontsLoaded = true;
      console.log("Cairo Arabic font loaded successfully");
    } catch (error) {
      console.error("Error loading Arabic font:", error);
      throw error;
    }
  })();

  return loadingPromise;
}

export function getArabicDefaultStyle() {
  return {
    font: 'Cairo',
    fontSize: 10,
    alignment: 'right' as const,
  };
}

export function getArabicTableHeaderStyle() {
  return {
    font: 'Cairo',
    bold: true,
    fontSize: 9,
    fillColor: '#f3f4f6',
    alignment: 'center' as const,
  };
}

export function createArabicPdf(docDefinition: any): any {
  return pdfMake.createPdf(docDefinition);
}

export async function downloadArabicPdf(docDefinition: any, filename: string): Promise<void> {
  try {
    await ensureArabicFontsLoaded();
    
    // Ensure default font is Cairo for Arabic support
    if (!docDefinition.defaultStyle) {
      docDefinition.defaultStyle = {};
    }
    docDefinition.defaultStyle.font = 'Cairo';
    
    const pdf = pdfMake.createPdf(docDefinition);
    pdf.download(filename);
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('خطأ في إنشاء ملف PDF: ' + (error as Error).message);
  }
}

export { pdfMake };
