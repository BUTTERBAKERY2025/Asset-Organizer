export function printHtmlContent(htmlContent: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.visibility = 'hidden';
  
  document.body.appendChild(iframe);
  
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    alert('فشل في إنشاء نافذة الطباعة');
    document.body.removeChild(iframe);
    return;
  }
  
  iframeDoc.open();
  iframeDoc.write(htmlContent);
  iframeDoc.close();
  
  const printAndCleanup = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Print error:', e);
    }
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };
  
  if (iframeDoc.fonts && iframeDoc.fonts.ready) {
    iframeDoc.fonts.ready.then(() => {
      setTimeout(printAndCleanup, 300);
    }).catch(() => {
      setTimeout(printAndCleanup, 1000);
    });
  } else {
    setTimeout(printAndCleanup, 1500);
  }
}

export function generatePrintStyles(): string {
  return `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      @page { size: A4; margin: 10mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; 
        direction: rtl; 
        background: white; 
        color: #333; 
        font-size: 11px; 
        padding: 10px; 
        -webkit-print-color-adjust: exact; 
        print-color-adjust: exact; 
      }
    </style>
  `;
}
