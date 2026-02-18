import type { MaterialTransfer, MaterialTransferItem } from "@shared/schema";

let pdfMake: any = null;
let amiriFontLoaded = false;
let cachedLogoBase64: string | null = null;

async function getPdfMake() {
  if (pdfMake) return pdfMake;
  const [pdfModule, vfsModule] = await Promise.all([
    import("@digicole/pdfmake-rtl/build/pdfmake"),
    import("@digicole/pdfmake-rtl/build/vfs_fonts"),
  ]);
  pdfMake = pdfModule.default as any;
  const vfs = vfsModule.default as any;
  pdfMake.vfs = vfs.default || vfs;
  pdfMake.fonts = {
    Nillima: { normal: 'Nillima.ttf', bold: 'Nillima.ttf', italics: 'Nillima.ttf', bolditalics: 'Nillima.ttf' },
    Roboto: { normal: 'Nillima.ttf', bold: 'Nillima.ttf', italics: 'Nillima.ttf', bolditalics: 'Nillima.ttf' },
  };
  return pdfMake;
}

async function loadAmiriFont(): Promise<void> {
  if (amiriFontLoaded) return;
  const pm = await getPdfMake();
  try {
    const [regularRes, boldRes] = await Promise.all([
      fetch('/assets/Amiri-Regular.ttf'),
      fetch('/assets/Amiri-Bold.ttf')
    ]);
    if (regularRes.ok && boldRes.ok) {
      const [regularBlob, boldBlob] = await Promise.all([regularRes.blob(), boldRes.blob()]);
      const [regularBase64, boldBase64] = await Promise.all([
        blobToBase64(regularBlob),
        blobToBase64(boldBlob)
      ]);
      pm.vfs['Amiri-Regular.ttf'] = regularBase64.split(',')[1];
      pm.vfs['Amiri-Bold.ttf'] = boldBase64.split(',')[1];
      pm.fonts = {
        Amiri: { normal: 'Amiri-Regular.ttf', bold: 'Amiri-Bold.ttf', italics: 'Amiri-Regular.ttf', bolditalics: 'Amiri-Bold.ttf' },
        Nillima: { normal: 'Nillima.ttf', bold: 'Nillima.ttf', italics: 'Nillima.ttf', bolditalics: 'Nillima.ttf' },
        Roboto: { normal: 'Nillima.ttf', bold: 'Nillima.ttf', italics: 'Nillima.ttf', bolditalics: 'Nillima.ttf' },
      };
      amiriFontLoaded = true;
    }
  } catch (e) {
    console.warn('Failed to load Amiri font, using default');
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function getLogoBase64(): Promise<string | null> {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const response = await fetch('/assets/logo.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoBase64 = reader.result as string;
        resolve(cachedLogoBase64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return '-';
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return '-';
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export type MaterialTransferWithNames = MaterialTransfer & {
  sourceBranchName?: string | null;
  destinationBranchName?: string | null;
};

export type TransferItemWithAvailable = MaterialTransferItem & {
  availableQuantity?: number | null;
};

const STATUS_OPTIONS = [
  { value: 'pending', labelAr: 'قيد الانتظار', labelEn: 'Pending' },
  { value: 'approved', labelAr: 'تمت الموافقة', labelEn: 'Approved' },
  { value: 'in_transit', labelAr: 'قيد النقل', labelEn: 'In Transit' },
  { value: 'delivered', labelAr: 'تم التسليم', labelEn: 'Delivered' },
  { value: 'cancelled', labelAr: 'ملغي', labelEn: 'Cancelled' },
];

export async function generateTransferPdf(
  transfer: MaterialTransferWithNames,
  items: TransferItemWithAvailable[]
): Promise<void> {
  const pm = await getPdfMake();
  await loadAmiriFont();
  const logoBase64 = await getLogoBase64();
  const statusLabel = STATUS_OPTIONS.find(s => s.value === transfer.status)?.labelAr || transfer.status;
  const destName = transfer.destinationBranchName || 'غير محدد';
  const srcName = transfer.sourceBranchName || 'المستودع الرئيسي';
  const requestDate = formatDateTime(transfer.createdAt);
  const printDate = formatDateTime(new Date());
  const transferDate = formatDate(transfer.transferDate);
  
  const tableBody = [
    [
      { text: 'ملاحظات', style: 'tableHeader', alignment: 'center' },
      { text: 'الوحدة', style: 'tableHeader', alignment: 'center' },
      { text: 'الكمية', style: 'tableHeader', alignment: 'center' },
      { text: 'المتوفر', style: 'tableHeader', alignment: 'center' },
      { text: 'التصنيف', style: 'tableHeader', alignment: 'center' },
      { text: 'اسم الصنف', style: 'tableHeader', alignment: 'center' },
      { text: 'م', style: 'tableHeader', alignment: 'center' },
    ],
    ...items.map((item, index) => [
      { text: item.notes || '-', fontSize: 8, alignment: 'center' },
      { text: item.unit, fontSize: 9, alignment: 'center' },
      { text: item.quantity.toString(), fontSize: 9, bold: true, alignment: 'center' },
      { text: item.availableQuantity != null ? item.availableQuantity.toString() : '-', fontSize: 9, alignment: 'center' },
      { text: item.category || '-', fontSize: 8, alignment: 'center' },
      { text: item.itemName, fontSize: 9, alignment: 'center' },
      { text: (index + 1).toString(), fontSize: 9, alignment: 'center' },
    ])
  ];

  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [20, 15, 20, 30],
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `صفحة ${currentPage} من ${pageCount}`, alignment: 'center', fontSize: 8, color: '#666' },
      ],
      margin: [20, 5, 20, 0]
    }),
    content: [
      {
        columns: [
          logoBase64 ? { image: logoBase64, width: 50, alignment: 'right' } : { text: '', width: 50 },
          { stack: [{ text: 'BUTTER BAKERY', fontSize: 14, bold: true, color: '#D4A853', alignment: 'center' }], width: '*', margin: [0, 12, 0, 0] },
          { text: 'أمر تحويل مواد', fontSize: 12, bold: true, alignment: 'left', width: 80, margin: [0, 12, 0, 0] },
        ],
        margin: [0, 0, 0, 8]
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 2, lineColor: '#D4A853' }], margin: [0, 0, 0, 10] },
      {
        table: { widths: ['auto', '*', 'auto', '*', 'auto', '*'], body: [[
          { text: 'رقم التحويل:', fontSize: 9, color: '#666', border: [false, false, false, false] },
          { text: transfer.transferNumber, fontSize: 10, bold: true, border: [false, false, false, false] },
          { text: 'الحالة:', fontSize: 9, color: '#666', border: [false, false, false, false] },
          { text: statusLabel, fontSize: 10, bold: true, color: '#16a34a', border: [false, false, false, false] },
          { text: 'التاريخ:', fontSize: 9, color: '#666', border: [false, false, false, false] },
          { text: transferDate, fontSize: 10, bold: true, border: [false, false, false, false] },
        ]] },
        layout: 'noBorders', margin: [0, 0, 0, 6]
      },
      {
        table: { widths: ['auto', '*', 'auto', 'auto', 'auto', '*'], body: [[
          { text: 'من:', fontSize: 8, color: '#666', border: [false, false, false, false] },
          { text: srcName, fontSize: 9, bold: true, border: [false, false, false, false] },
          { text: '←', fontSize: 10, alignment: 'center', border: [false, false, false, false] },
          { text: 'إلى:', fontSize: 8, color: '#666', border: [false, false, false, false] },
          { text: destName, fontSize: 9, bold: true, border: [false, false, false, false] },
          { text: '', border: [false, false, false, false] },
        ]] },
        layout: 'noBorders', margin: [0, 0, 0, 4]
      },
      {
        columns: [
          { text: `وقت الطلب: ${requestDate}`, fontSize: 7, color: '#888', alignment: 'right' },
          { text: `وقت الطباعة: ${printDate}`, fontSize: 7, color: '#888', alignment: 'left' },
        ],
        margin: [0, 0, 0, 6]
      },
      ...(transfer.driverName || transfer.vehicleNumber ? [{
        table: { widths: ['auto', '*', 'auto', '*'], body: [[
          { text: 'السائق:', fontSize: 8, color: '#666', border: [false, false, false, false] },
          { text: transfer.driverName || '-', fontSize: 9, bold: true, border: [false, false, false, false] },
          { text: 'المركبة:', fontSize: 8, color: '#666', border: [false, false, false, false] },
          { text: transfer.vehicleNumber || '-', fontSize: 9, bold: true, border: [false, false, false, false] },
        ]] },
        layout: 'noBorders', margin: [0, 0, 0, 6]
      }] : []),
      { text: 'الأصناف المحولة:', fontSize: 10, bold: true, margin: [0, 2, 0, 4] },
      {
        table: { headerRows: 1, widths: [60, 30, 30, 35, 50, '*', 18], body: tableBody },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 0.5 : 0.25,
          vLineWidth: () => 0.25, hLineColor: () => '#ccc', vLineColor: () => '#ccc',
          paddingTop: () => 2, paddingBottom: () => 2, paddingLeft: () => 3, paddingRight: () => 3,
          fillColor: (rowIndex: number) => rowIndex === 0 ? '#f0f0f0' : null
        },
        margin: [0, 0, 0, 6]
      },
      ...(transfer.notes ? [{
        columns: [
          { text: 'ملاحظات:', fontSize: 8, color: '#666', width: 'auto' },
          { text: transfer.notes, fontSize: 8, margin: [5, 0, 0, 0] }
        ],
        margin: [0, 0, 0, 8]
      }] : []),
      {
        table: { widths: ['*', '*', '*'], body: [[
          { stack: [{ text: 'توقيع المستلم', fontSize: 8, bold: true, alignment: 'center' }, { text: '', margin: [0, 15, 0, 0] }, { text: '_______________', fontSize: 10, alignment: 'center' }], border: [true, true, true, true], margin: [2, 3, 2, 3] },
          { stack: [{ text: 'توقيع المُرسل', fontSize: 8, bold: true, alignment: 'center' }, { text: '', margin: [0, 15, 0, 0] }, { text: '_______________', fontSize: 10, alignment: 'center' }], border: [true, true, true, true], margin: [2, 3, 2, 3] },
          { stack: [{ text: 'توقيع المدير', fontSize: 8, bold: true, alignment: 'center' }, { text: '', margin: [0, 15, 0, 0] }, { text: '_______________', fontSize: 10, alignment: 'center' }], border: [true, true, true, true], margin: [2, 3, 2, 3] },
        ]] },
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#ccc', vLineColor: () => '#ccc' },
        margin: [0, 6, 0, 0]
      }
    ],
    styles: { tableHeader: { bold: true, fontSize: 8, fillColor: '#f0f0f0' } },
    defaultStyle: { font: amiriFontLoaded ? 'Amiri' : 'Nillima', fontSize: 10, alignment: 'right' }
  };

  pm.createPdf(docDefinition as any).download(`transfer-${transfer.transferNumber}.pdf`);
}

export async function generateQuickTransferPdf(transfer: MaterialTransferWithNames): Promise<void> {
  const pm = await getPdfMake();
  await loadAmiriFont();
  const logoBase64 = await getLogoBase64();
  const statusLabel = STATUS_OPTIONS.find(s => s.value === transfer.status)?.labelAr || transfer.status;
  const destName = transfer.destinationBranchName || 'غير محدد';
  const srcName = transfer.sourceBranchName || 'المستودع الرئيسي';
  const requestDate = formatDateTime(transfer.createdAt);
  const printDate = formatDateTime(new Date());
  const transferDate = formatDate(transfer.transferDate);
  
  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [20, 15, 20, 30],
    footer: { columns: [{ text: 'صفحة 1 من 1', alignment: 'center', fontSize: 8, color: '#666' }], margin: [20, 5, 20, 0] },
    content: [
      {
        columns: [
          logoBase64 ? { image: logoBase64, width: 50, alignment: 'right' } : { text: '', width: 50 },
          { stack: [{ text: 'BUTTER BAKERY', fontSize: 14, bold: true, color: '#D4A853', alignment: 'center' }], width: '*', margin: [0, 12, 0, 0] },
          { text: 'أمر تحويل مواد', fontSize: 12, bold: true, alignment: 'left', width: 80, margin: [0, 12, 0, 0] },
        ],
        margin: [0, 0, 0, 8]
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 2, lineColor: '#D4A853' }], margin: [0, 0, 0, 10] },
      {
        table: { widths: ['auto', '*', 'auto', '*', 'auto', '*'], body: [[
          { text: 'رقم التحويل:', fontSize: 9, color: '#666', border: [false, false, false, false] },
          { text: transfer.transferNumber, fontSize: 10, bold: true, border: [false, false, false, false] },
          { text: 'الحالة:', fontSize: 9, color: '#666', border: [false, false, false, false] },
          { text: statusLabel, fontSize: 10, bold: true, color: '#16a34a', border: [false, false, false, false] },
          { text: 'التاريخ:', fontSize: 9, color: '#666', border: [false, false, false, false] },
          { text: transferDate, fontSize: 10, bold: true, border: [false, false, false, false] },
        ]] },
        layout: 'noBorders', margin: [0, 0, 0, 6]
      },
      {
        table: { widths: ['auto', '*', 'auto', 'auto', '*', 'auto'], body: [[
          { text: 'من:', fontSize: 8, color: '#666', border: [false, false, false, false] },
          { text: srcName, fontSize: 9, bold: true, border: [false, false, false, false] },
          { text: '←', fontSize: 10, alignment: 'center', border: [false, false, false, false] },
          { text: 'إلى:', fontSize: 8, color: '#666', border: [false, false, false, false] },
          { text: destName, fontSize: 9, bold: true, border: [false, false, false, false] },
          { text: '', border: [false, false, false, false] },
        ]] },
        layout: 'noBorders', margin: [0, 0, 0, 4]
      },
      {
        columns: [
          { text: `وقت الطلب: ${requestDate}`, fontSize: 7, color: '#888', alignment: 'right' },
          { text: `وقت الطباعة: ${printDate}`, fontSize: 7, color: '#888', alignment: 'left' },
        ],
        margin: [0, 0, 0, 6]
      },
      ...(transfer.driverName || transfer.vehicleNumber ? [{
        table: { widths: ['auto', '*', 'auto', '*'], body: [[
          { text: 'السائق:', fontSize: 8, color: '#666', border: [false, false, false, false] },
          { text: transfer.driverName || '-', fontSize: 9, bold: true, border: [false, false, false, false] },
          { text: 'المركبة:', fontSize: 8, color: '#666', border: [false, false, false, false] },
          { text: transfer.vehicleNumber || '-', fontSize: 9, bold: true, border: [false, false, false, false] },
        ]] },
        layout: 'noBorders', margin: [0, 0, 0, 6]
      }] : []),
      { text: 'ملاحظة: للحصول على قائمة الأصناف، استخدم زر عرض ثم PDF', fontSize: 8, color: '#888', alignment: 'center', margin: [0, 10, 0, 10] },
      ...(transfer.notes ? [{
        columns: [
          { text: 'ملاحظات:', fontSize: 8, color: '#666', width: 'auto' },
          { text: transfer.notes, fontSize: 8, margin: [5, 0, 0, 0] }
        ],
        margin: [0, 0, 0, 8]
      }] : []),
      {
        table: { widths: ['*', '*', '*'], body: [[
          { stack: [{ text: 'توقيع المستلم', fontSize: 8, bold: true, alignment: 'center' }, { text: '', margin: [0, 15, 0, 0] }, { text: '_______________', fontSize: 10, alignment: 'center' }], border: [true, true, true, true], margin: [2, 3, 2, 3] },
          { stack: [{ text: 'توقيع المُرسل', fontSize: 8, bold: true, alignment: 'center' }, { text: '', margin: [0, 15, 0, 0] }, { text: '_______________', fontSize: 10, alignment: 'center' }], border: [true, true, true, true], margin: [2, 3, 2, 3] },
          { stack: [{ text: 'توقيع المدير', fontSize: 8, bold: true, alignment: 'center' }, { text: '', margin: [0, 15, 0, 0] }, { text: '_______________', fontSize: 10, alignment: 'center' }], border: [true, true, true, true], margin: [2, 3, 2, 3] },
        ]] },
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#ccc', vLineColor: () => '#ccc' },
        margin: [0, 6, 0, 0]
      }
    ],
    defaultStyle: { font: amiriFontLoaded ? 'Amiri' : 'Nillima', fontSize: 10, alignment: 'right' }
  };

  pm.createPdf(docDefinition as any).download(`transfer-${transfer.transferNumber}.pdf`);
}
