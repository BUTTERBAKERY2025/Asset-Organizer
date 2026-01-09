import pdfMake from "pdfmake/build/pdfmake";

let arabicFontInitialized = false;
let fontLoadPromise: Promise<void> | null = null;

async function loadFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function initializeArabicFonts(): Promise<void> {
  if (arabicFontInitialized) return;
  
  if (fontLoadPromise) {
    return fontLoadPromise;
  }

  fontLoadPromise = (async () => {
    try {
      const [regularFont, boldFont] = await Promise.all([
        loadFontAsBase64('https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvangtZmpcWmhzfH5lWWgcQyyS4J0.woff2'),
        loadFontAsBase64('https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvangtZmpcWmhzfH5l92gcQyyS4J0.woff2'),
      ]);

      (pdfMake as any).vfs = {
        'Cairo-Regular.woff2': regularFont,
        'Cairo-Bold.woff2': boldFont,
      };

      (pdfMake as any).fonts = {
        Cairo: {
          normal: 'Cairo-Regular.woff2',
          bold: 'Cairo-Bold.woff2',
          italics: 'Cairo-Regular.woff2',
          bolditalics: 'Cairo-Bold.woff2',
        },
        Roboto: {
          normal: 'Roboto-Regular.ttf',
          bold: 'Roboto-Medium.ttf',
          italics: 'Roboto-Italic.ttf',
          bolditalics: 'Roboto-MediumItalic.ttf',
        },
      };

      arabicFontInitialized = true;
    } catch (error) {
      console.error('Failed to load Arabic fonts:', error);
      throw error;
    }
  })();

  return fontLoadPromise;
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
    bold: true,
    fontSize: 9,
    fillColor: '#f3f4f6',
    alignment: 'center' as const,
    font: 'Cairo',
  };
}

export async function createArabicPdf(docDefinition: any): Promise<any> {
  await initializeArabicFonts();
  
  const enhancedDocDefinition = {
    ...docDefinition,
    defaultStyle: {
      ...getArabicDefaultStyle(),
      ...docDefinition.defaultStyle,
    },
    styles: {
      tableHeader: getArabicTableHeaderStyle(),
      header: { 
        fontSize: 18, 
        bold: true, 
        margin: [0, 0, 0, 10],
        font: 'Cairo',
        alignment: 'center' as const,
      },
      ...docDefinition.styles,
    },
  };
  
  return pdfMake.createPdf(enhancedDocDefinition);
}

export async function downloadArabicPdf(docDefinition: any, filename: string): Promise<void> {
  const pdf = await createArabicPdf(docDefinition);
  pdf.download(filename);
}

export { pdfMake };
