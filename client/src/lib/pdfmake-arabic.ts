import pdfMakeLib from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { droidKufiRegularBase64, notoKufiArabicRegularBase64 } from "./fonts/arabic-fonts";

const existingVfs = (pdfFonts as any).pdfMake?.vfs || {};

const customVfs = {
  ...existingVfs,
  'DroidKufi-Regular.ttf': droidKufiRegularBase64,
  'NotoKufi-Regular.ttf': notoKufiArabicRegularBase64,
};

const customFonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
  Arabic: {
    normal: 'DroidKufi-Regular.ttf',
    bold: 'NotoKufi-Regular.ttf',
    italics: 'DroidKufi-Regular.ttf',
    bolditalics: 'NotoKufi-Regular.ttf',
  },
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
    bold: true,
    fontSize: 9,
    fillColor: '#f3f4f6',
    alignment: 'center' as const,
    font: 'Arabic',
  };
}

export function createArabicPdf(docDefinition: any): any {
  const enhancedDocDefinition = {
    ...docDefinition,
    defaultStyle: {
      font: 'Arabic',
      fontSize: 10,
      ...docDefinition.defaultStyle,
    },
    styles: {
      tableHeader: { 
        bold: true, 
        fontSize: 9, 
        fillColor: '#f3f4f6', 
        alignment: 'center' as const,
        font: 'Arabic',
      },
      header: { 
        fontSize: 18, 
        bold: true, 
        margin: [0, 0, 0, 10],
        font: 'Arabic',
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
