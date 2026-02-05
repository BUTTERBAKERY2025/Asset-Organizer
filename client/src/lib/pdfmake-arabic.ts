import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { loadAmiriFonts } from "./pdfmake-fonts";

// Initialize pdfMake with default fonts
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).vfs || (pdfFonts as any).default?.pdfMake?.vfs || {};

// Track font loading state
let arabicFontsLoaded = false;
let fontLoadPromise: Promise<void> | null = null;

async function ensureArabicFonts(): Promise<void> {
  if (arabicFontsLoaded) return;
  
  if (!fontLoadPromise) {
    fontLoadPromise = (async () => {
      try {
        const fonts = await loadAmiriFonts();
        
        // Add fonts to vfs
        (pdfMake as any).vfs['Amiri-Regular.ttf'] = fonts.regular;
        (pdfMake as any).vfs['Amiri-Bold.ttf'] = fonts.bold;
        
        // Register font family
        (pdfMake as any).fonts = {
          ...(pdfMake as any).fonts,
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
        console.error('Failed to load Arabic fonts:', error);
        throw error;
      }
    })();
  }
  
  return fontLoadPromise;
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
    // Load Arabic fonts first
    await ensureArabicFonts();
    
    // Update doc definition to use Amiri font
    const enhancedDoc = {
      ...docDefinition,
      defaultStyle: {
        ...(docDefinition.defaultStyle || {}),
        font: 'Amiri',
      },
    };
    
    // Update all styles to use Amiri
    if (enhancedDoc.styles) {
      for (const key in enhancedDoc.styles) {
        enhancedDoc.styles[key] = {
          ...enhancedDoc.styles[key],
          font: 'Amiri',
        };
      }
    }
    
    const pdf = pdfMake.createPdf(enhancedDoc);
    pdf.download(filename);
  } catch (error) {
    console.error('PDF generation error:', error);
    
    // Fallback to Roboto
    try {
      console.log('Falling back to Roboto font...');
      const pdf = pdfMake.createPdf(docDefinition);
      pdf.download(filename);
    } catch (fallbackError) {
      alert('خطأ في إنشاء ملف PDF');
    }
  }
}

export { pdfMake };
