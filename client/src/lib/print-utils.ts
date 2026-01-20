export function printHtmlContent(htmlContent: string): void {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  
  if (!printWindow) {
    alert('الرجاء السماح بالنوافذ المنبثقة لطباعة التقرير');
    return;
  }
  
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  const printAndCheck = () => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch (e) {
      console.error('Print error:', e);
    }
  };
  
  if (printWindow.document.fonts && printWindow.document.fonts.ready) {
    printWindow.document.fonts.ready.then(() => {
      setTimeout(printAndCheck, 500);
    }).catch(() => {
      setTimeout(printAndCheck, 1500);
    });
  } else {
    setTimeout(printAndCheck, 2000);
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
