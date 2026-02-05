// Arabic fonts for pdfMake - Amiri font
export const amiriFonts = {
  regular: '',
  bold: ''
};

// Load fonts asynchronously
export async function loadAmiriFonts(): Promise<{regular: string, bold: string}> {
  try {
    const [regularRes, boldRes] = await Promise.all([
      fetch('/assets/fonts/Amiri-Regular.ttf'),
      fetch('/assets/fonts/Amiri-Bold.ttf')
    ]);
    
    if (!regularRes.ok || !boldRes.ok) {
      throw new Error('Failed to fetch font files');
    }
    
    const [regularBuf, boldBuf] = await Promise.all([
      regularRes.arrayBuffer(),
      boldRes.arrayBuffer()
    ]);
    
    // Convert to base64
    const toBase64 = (buf: ArrayBuffer) => {
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    };
    
    return {
      regular: toBase64(regularBuf),
      bold: toBase64(boldBuf)
    };
  } catch (error) {
    console.error('Error loading Amiri fonts:', error);
    throw error;
  }
}
