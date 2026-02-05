import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

// Initialize pdfMake with default fonts
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).vfs || (pdfFonts as any).default?.pdfMake?.vfs || {};

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

// Track font loading state
let arabicFontsLoaded = false;
let fontLoadPromise: Promise<boolean> | null = null;

async function loadArabicFonts(): Promise<boolean> {
  if (arabicFontsLoaded) return true;
  if (fontLoadPromise) return fontLoadPromise;
  
  fontLoadPromise = (async () => {
    try {
      // Load Amiri fonts from public assets
      const [regularResponse, boldResponse] = await Promise.all([
        fetch('/assets/fonts/Amiri-Regular.ttf'),
        fetch('/assets/fonts/Amiri-Bold.ttf')
      ]);
      
      if (!regularResponse.ok || !boldResponse.ok) {
        console.warn('Could not load Arabic fonts, using Roboto fallback');
        return false;
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
      return true;
    } catch (error) {
      console.error('Error loading Arabic fonts:', error);
      return false;
    }
  })();
  
  return fontLoadPromise;
}

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
    // Try to load Arabic fonts first
    const fontsLoaded = await loadArabicFonts();
    
    // Create enhanced doc definition
    const enhancedDoc = {
      ...docDefinition,
      defaultStyle: {
        ...docDefinition.defaultStyle,
        font: fontsLoaded ? 'Amiri' : 'Roboto',
      },
    };
    
    // If fonts loaded, also update any explicit font references in styles
    if (fontsLoaded && enhancedDoc.styles) {
      for (const styleName in enhancedDoc.styles) {
        if (enhancedDoc.styles[styleName] && !enhancedDoc.styles[styleName].font) {
          enhancedDoc.styles[styleName].font = 'Amiri';
        }
      }
    }
    
    const pdf = pdfMake.createPdf(enhancedDoc);
    pdf.download(filename);
  } catch (error) {
    console.error('PDF generation error:', error);
    
    // Fallback: try with Roboto font if Arabic fonts fail
    try {
      const fallbackDoc = {
        ...docDefinition,
        defaultStyle: {
          ...docDefinition.defaultStyle,
          font: 'Roboto',
        },
      };
      const pdf = pdfMake.createPdf(fallbackDoc);
      pdf.download(filename);
    } catch (fallbackError) {
      console.error('Fallback PDF generation also failed:', fallbackError);
      alert('خطأ في إنشاء ملف PDF: ' + (error as Error).message);
    }
  }
}

export { pdfMake };
