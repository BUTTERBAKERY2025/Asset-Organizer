import pdfMakeLib from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

// Get existing VFS from pdfFonts
const pdfFontsAny = pdfFonts as any;
const existingVfs = pdfFontsAny.pdfMake?.vfs || pdfFontsAny.vfs || pdfFontsAny.default?.pdfMake?.vfs || pdfFontsAny.default?.vfs || {};

// Use Roboto font (built-in) - Arabic text will render but may not look optimal
const customVfs: Record<string, string> = existingVfs;

const customFonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
};

export function getArabicDefaultStyle() {
  return {
    font: 'Roboto',
    fontSize: 10,
    alignment: 'right' as const,
  };
}

export function getArabicTableHeaderStyle() {
  return {
    bold: true,
    fontSize: 9,
    fillColor: '#f3f4f6',
    alignment: 'center' as const,
    font: 'Roboto',
  };
}

export function createArabicPdf(docDefinition: any): any {
  const enhancedDocDefinition = {
    ...docDefinition,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      ...docDefinition.defaultStyle,
    },
    styles: {
      tableHeader: { 
        bold: true, 
        fontSize: 9, 
        fillColor: '#f3f4f6', 
        alignment: 'center' as const,
        font: 'Roboto',
      },
      header: { 
        fontSize: 18, 
        bold: true, 
        margin: [0, 0, 0, 10],
        font: 'Roboto',
        alignment: 'center' as const,
      },
      ...docDefinition.styles,
    },
  };
  
  return pdfMakeLib.createPdf(enhancedDocDefinition, undefined, customFonts, customVfs);
}

export function downloadArabicPdf(docDefinition: any, filename: string): void {
  try {
    console.log('Starting PDF generation...');
    console.log('VFS keys:', Object.keys(customVfs));
    const pdf = createArabicPdf(docDefinition);
    console.log('PDF created, downloading...');
    pdf.download(filename);
    console.log('PDF download initiated');
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('خطأ في إنشاء ملف PDF: ' + (error as Error).message);
  }
}

export const pdfMake = pdfMakeLib;
