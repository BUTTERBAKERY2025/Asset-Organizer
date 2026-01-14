import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

// Initialize pdfMake with default fonts
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).vfs || (pdfFonts as any).default?.pdfMake?.vfs || {};

let arabicFontsLoaded = false;

async function loadArabicFonts(): Promise<void> {
  if (arabicFontsLoaded) return;
  
  try {
    const fonts = await import("./fonts/arabic-fonts");
    const vfs = (pdfMake as any).vfs || {};
    
    vfs["DroidKufi-Regular.ttf"] = fonts.droidKufiRegularBase64;
    vfs["NotoKufiArabic-Regular.ttf"] = fonts.notoKufiArabicRegularBase64;
    
    (pdfMake as any).vfs = vfs;
    (pdfMake as any).fonts = {
      Roboto: {
        normal: "Roboto-Regular.ttf",
        bold: "Roboto-Medium.ttf",
        italics: "Roboto-Italic.ttf",
        bolditalics: "Roboto-MediumItalic.ttf"
      },
      Arabic: {
        normal: "DroidKufi-Regular.ttf",
        bold: "NotoKufiArabic-Regular.ttf",
        italics: "DroidKufi-Regular.ttf",
        bolditalics: "NotoKufiArabic-Regular.ttf"
      }
    };
    
    arabicFontsLoaded = true;
  } catch (error) {
    console.error("Failed to load Arabic fonts:", error);
  }
}

export function getArabicDefaultStyle() {
  return {
    font: 'Arabic',
    fontSize: 10,
    alignment: 'right' as const,
  };
}

export function getArabicTableHeaderStyle() {
  return {
    font: 'Arabic',
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
    await loadArabicFonts();
    
    if (!docDefinition.defaultStyle) {
      docDefinition.defaultStyle = {};
    }
    docDefinition.defaultStyle.font = 'Arabic';
    
    const pdf = pdfMake.createPdf(docDefinition);
    pdf.download(filename);
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('خطأ في إنشاء ملف PDF: ' + (error as Error).message);
  }
}

export { pdfMake };
