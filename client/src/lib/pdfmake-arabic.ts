import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Initialize pdfMake with default fonts
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).vfs || (pdfFonts as any).default?.pdfMake?.vfs || {};

// Load Arabic fonts dynamically
let arabicFontsLoaded = false;

async function loadArabicFonts(): Promise<void> {
  if (arabicFontsLoaded) return;
  
  try {
    // Load Amiri fonts from assets
    const [regularResponse, boldResponse] = await Promise.all([
      fetch('/assets/fonts/Amiri-Regular.ttf'),
      fetch('/assets/fonts/Amiri-Bold.ttf')
    ]);
    
    if (!regularResponse.ok || !boldResponse.ok) {
      console.warn('Could not load Arabic fonts, using fallback');
      return;
    }
    
    const [regularBuffer, boldBuffer] = await Promise.all([
      regularResponse.arrayBuffer(),
      boldResponse.arrayBuffer()
    ]);
    
    // Convert to base64
    const regularBase64 = arrayBufferToBase64(regularBuffer);
    const boldBase64 = arrayBufferToBase64(boldBuffer);
    
    // Add to vfs
    (pdfMake as any).vfs['Amiri-Regular.ttf'] = regularBase64;
    (pdfMake as any).vfs['Amiri-Bold.ttf'] = boldBase64;
    
    // Register the font
    (pdfMake as any).fonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
      },
      Amiri: {
        normal: 'Amiri-Regular.ttf',
        bold: 'Amiri-Bold.ttf',
        italics: 'Amiri-Regular.ttf',
        bolditalics: 'Amiri-Bold.ttf'
      }
    };
    
    arabicFontsLoaded = true;
    console.log('Arabic fonts loaded successfully');
  } catch (error) {
    console.error('Error loading Arabic fonts:', error);
  }
}

export function getArabicDefaultStyle() {
  return {
    font: 'Amiri',
    fontSize: 11,
    alignment: 'right' as const,
  };
}

export function getArabicTableHeaderStyle() {
  return {
    font: 'Amiri',
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
    // Load fonts first
    await loadArabicFonts();
    
    // Add default font to doc definition
    const enhancedDoc = {
      ...docDefinition,
      defaultStyle: {
        ...docDefinition.defaultStyle,
        font: 'Amiri',
      },
    };
    
    const pdf = pdfMake.createPdf(enhancedDoc);
    pdf.download(filename);
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('خطأ في إنشاء ملف PDF: ' + (error as Error).message);
  }
}

export { pdfMake };
