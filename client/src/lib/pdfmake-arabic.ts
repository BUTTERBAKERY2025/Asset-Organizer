import * as pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import { droidKufiRegularBase64, notoKufiArabicRegularBase64 } from "./fonts/arabic-fonts";

let fontsInitialized = false;

function initializeFonts(): void {
  if (fontsInitialized) return;

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

  (pdfMake as any).vfs = customVfs;
  (pdfMake as any).fonts = customFonts;

  fontsInitialized = true;
}

initializeFonts();

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
  initializeFonts();
  
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
  
  return (pdfMake as any).createPdf(enhancedDocDefinition);
}

export function downloadArabicPdf(docDefinition: any, filename: string): void {
  const pdf = createArabicPdf(docDefinition);
  pdf.download(filename);
}

export { pdfMake };
