import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { droidKufiRegularBase64, notoKufiArabicRegularBase64 } from "./fonts/arabic-fonts";

// Initialize pdfMake with default fonts
const vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).vfs || (pdfFonts as any).default?.pdfMake?.vfs || {};

// Add Arabic fonts to vfs
vfs["DroidKufi-Regular.ttf"] = droidKufiRegularBase64;
vfs["NotoKufiArabic-Regular.ttf"] = notoKufiArabicRegularBase64;

(pdfMake as any).vfs = vfs;

// Register Arabic font family
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

export function downloadArabicPdf(docDefinition: any, filename: string): void {
  try {
    // Ensure Arabic font is used by default
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
