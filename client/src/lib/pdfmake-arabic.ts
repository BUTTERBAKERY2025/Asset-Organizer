import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

// Initialize pdfMake with default fonts
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).vfs || (pdfFonts as any).default?.pdfMake?.vfs || {};

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

export function createArabicPdf(docDefinition: any): any {
  return pdfMake.createPdf(docDefinition);
}

export async function downloadArabicPdf(docDefinition: any, filename: string): Promise<void> {
  try {
    const pdf = pdfMake.createPdf(docDefinition);
    pdf.download(filename);
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('خطأ في إنشاء ملف PDF: ' + (error as Error).message);
  }
}

export { pdfMake };
