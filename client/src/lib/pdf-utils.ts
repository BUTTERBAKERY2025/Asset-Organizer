import type { MaterialTransfer, MaterialTransferItem } from "@shared/schema";
import pdfMakeRtl from "@digicole/pdfmake-rtl/build/pdfmake";
import vfs from "@digicole/pdfmake-rtl/build/vfs_fonts";

// Initialize pdfMake-RTL with fonts (supports Arabic)
const pdfMake = pdfMakeRtl as any;
// vfs_fonts exports vfs directly as default export
pdfMake.vfs = (vfs as any).default || vfs;
pdfMake.fonts = {
  Nillima: {
    normal: 'Nillima.ttf',
    bold: 'Nillima.ttf',
    italics: 'Nillima.ttf',
    bolditalics: 'Nillima.ttf',
  }
};

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
  
  const statusLabel = STATUS_OPTIONS.find(s => s.value === transfer.status)?.labelAr || transfer.status;
  const destName = transfer.destinationBranchName || 'غير محدد';
  const srcName = transfer.sourceBranchName || 'المستودع الرئيسي';
  const requestDate = transfer.createdAt ? new Date(transfer.createdAt).toLocaleString('ar-SA') : '-';
  const printDate = new Date().toLocaleString('ar-SA');
  const transferDate = transfer.transferDate ? new Date(transfer.transferDate).toLocaleDateString('ar-SA') : '-';
  
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
          { text: 'مخابز باتر | BUTTER BAKERY', fontSize: 14, bold: true, color: '#333', alignment: 'right' },
          { text: 'أمر تحويل مواد', fontSize: 14, bold: true, alignment: 'left' },
        ],
        margin: [0, 0, 0, 3]
      },
      
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 1, lineColor: '#D4A853' }], margin: [0, 0, 0, 6] },
      
      {
        table: {
          widths: ['auto', '*', 'auto', '*', 'auto', '*'],
          body: [
            [
              { text: 'رقم التحويل:', fontSize: 8, color: '#666', border: [false, false, false, false] },
              { text: transfer.transferNumber, fontSize: 9, bold: true, border: [false, false, false, false] },
              { text: 'الحالة:', fontSize: 8, color: '#666', border: [false, false, false, false] },
              { text: statusLabel, fontSize: 9, bold: true, color: '#16a34a', border: [false, false, false, false] },
              { text: 'التاريخ:', fontSize: 8, color: '#666', border: [false, false, false, false] },
              { text: transferDate, fontSize: 9, bold: true, border: [false, false, false, false] },
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 4]
      },
      
      {
        table: {
          widths: ['auto', '*', 'auto', 'auto', 'auto', '*'],
          body: [
            [
              { text: 'من:', fontSize: 8, color: '#666', border: [false, false, false, false] },
              { text: srcName, fontSize: 9, bold: true, border: [false, false, false, false] },
              { text: '←', fontSize: 10, alignment: 'center', border: [false, false, false, false] },
              { text: 'إلى:', fontSize: 8, color: '#666', border: [false, false, false, false] },
              { text: destName, fontSize: 9, bold: true, border: [false, false, false, false] },
              { text: '', border: [false, false, false, false] },
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 4]
      },
      
      {
        columns: [
          { text: `وقت الطلب: ${requestDate}`, fontSize: 7, color: '#888', alignment: 'right' },
          { text: `وقت الطباعة: ${printDate}`, fontSize: 7, color: '#888', alignment: 'left' },
        ],
        margin: [0, 0, 0, 6]
      },
      
      ...(transfer.driverName || transfer.vehicleNumber ? [
        {
          table: {
            widths: ['auto', '*', 'auto', '*'],
            body: [
              [
                { text: 'السائق:', fontSize: 8, color: '#666', border: [false, false, false, false] },
                { text: transfer.driverName || '-', fontSize: 9, bold: true, border: [false, false, false, false] },
                { text: 'المركبة:', fontSize: 8, color: '#666', border: [false, false, false, false] },
                { text: transfer.vehicleNumber || '-', fontSize: 9, bold: true, border: [false, false, false, false] },
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 6]
        }
      ] : []),
      
      { text: 'الأصناف المحولة:', fontSize: 10, bold: true, margin: [0, 2, 0, 4] },
      
      {
        table: {
          headerRows: 1,
          widths: [60, 30, 30, 35, 50, '*', 18],
          body: tableBody
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 0.5 : 0.25,
          vLineWidth: () => 0.25,
          hLineColor: () => '#ccc',
          vLineColor: () => '#ccc',
          paddingTop: () => 2,
          paddingBottom: () => 2,
          paddingLeft: () => 3,
          paddingRight: () => 3,
          fillColor: (rowIndex: number) => rowIndex === 0 ? '#f0f0f0' : null
        },
        margin: [0, 0, 0, 6]
      },
      
      ...(transfer.notes ? [
        {
          columns: [
            { text: 'ملاحظات:', fontSize: 8, color: '#666', width: 'auto' },
            { text: transfer.notes, fontSize: 8, margin: [5, 0, 0, 0] }
          ],
          margin: [0, 0, 0, 8]
        }
      ] : []),
      
      {
        table: {
          widths: ['*', '*', '*'],
          body: [
            [
              { 
                stack: [
                  { text: 'توقيع المستلم', fontSize: 8, bold: true, alignment: 'center' },
                  { text: '', margin: [0, 15, 0, 0] },
                  { text: '_______________', fontSize: 10, alignment: 'center' },
                ],
                border: [true, true, true, true],
                margin: [2, 3, 2, 3]
              },
              { 
                stack: [
                  { text: 'توقيع المُرسل', fontSize: 8, bold: true, alignment: 'center' },
                  { text: '', margin: [0, 15, 0, 0] },
                  { text: '_______________', fontSize: 10, alignment: 'center' },
                ],
                border: [true, true, true, true],
                margin: [2, 3, 2, 3]
              },
              { 
                stack: [
                  { text: 'توقيع المدير', fontSize: 8, bold: true, alignment: 'center' },
                  { text: '', margin: [0, 15, 0, 0] },
                  { text: '_______________', fontSize: 10, alignment: 'center' },
                ],
                border: [true, true, true, true],
                margin: [2, 3, 2, 3]
              }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#ccc',
          vLineColor: () => '#ccc',
        },
        margin: [0, 6, 0, 0]
      }
    ],
    styles: {
      tableHeader: { bold: true, fontSize: 8, fillColor: '#f0f0f0' }
    },
    defaultStyle: {
      font: 'Nillima',
      fontSize: 9,
      alignment: 'right'
    }
  };

  pdfMake.createPdf(docDefinition as any).download(`transfer-${transfer.transferNumber}.pdf`);
}

export async function generateQuickTransferPdf(transfer: MaterialTransferWithNames): Promise<void> {
  const statusLabel = STATUS_OPTIONS.find(s => s.value === transfer.status)?.labelAr || transfer.status;
  const destName = transfer.destinationBranchName || 'غير محدد';
  const srcName = transfer.sourceBranchName || 'المستودع الرئيسي';
  const requestDate = transfer.createdAt ? new Date(transfer.createdAt).toLocaleString('ar-SA') : '-';
  const printDate = new Date().toLocaleString('ar-SA');
  const transferDate = transfer.transferDate ? new Date(transfer.transferDate).toLocaleDateString('ar-SA') : '-';
  
  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [20, 15, 20, 30],
    
    footer: {
      columns: [
        { text: 'صفحة 1 من 1', alignment: 'center', fontSize: 8, color: '#666' },
      ],
      margin: [20, 5, 20, 0]
    },
    
    content: [
      {
        columns: [
          { text: 'مخابز باتر | BUTTER BAKERY', fontSize: 14, bold: true, color: '#333', alignment: 'right' },
          { text: 'أمر تحويل مواد', fontSize: 14, bold: true, alignment: 'left' },
        ],
        margin: [0, 0, 0, 3]
      },
      
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 1, lineColor: '#D4A853' }], margin: [0, 0, 0, 6] },
      
      {
        table: {
          widths: ['auto', '*', 'auto', '*', 'auto', '*'],
          body: [
            [
              { text: 'رقم التحويل:', fontSize: 8, color: '#666', border: [false, false, false, false] },
              { text: transfer.transferNumber, fontSize: 9, bold: true, border: [false, false, false, false] },
              { text: 'الحالة:', fontSize: 8, color: '#666', border: [false, false, false, false] },
              { text: statusLabel, fontSize: 9, bold: true, color: '#16a34a', border: [false, false, false, false] },
              { text: 'التاريخ:', fontSize: 8, color: '#666', border: [false, false, false, false] },
              { text: transferDate, fontSize: 9, bold: true, border: [false, false, false, false] },
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 4]
      },
      
      {
        table: {
          widths: ['auto', '*', 'auto', 'auto', '*', 'auto'],
          body: [
            [
              { text: 'من:', fontSize: 8, color: '#666', border: [false, false, false, false] },
              { text: srcName, fontSize: 9, bold: true, border: [false, false, false, false] },
              { text: '←', fontSize: 10, alignment: 'center', border: [false, false, false, false] },
              { text: 'إلى:', fontSize: 8, color: '#666', border: [false, false, false, false] },
              { text: destName, fontSize: 9, bold: true, border: [false, false, false, false] },
              { text: '', border: [false, false, false, false] },
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 4]
      },
      
      {
        columns: [
          { text: `وقت الطلب: ${requestDate}`, fontSize: 7, color: '#888', alignment: 'right' },
          { text: `وقت الطباعة: ${printDate}`, fontSize: 7, color: '#888', alignment: 'left' },
        ],
        margin: [0, 0, 0, 6]
      },
      
      ...(transfer.driverName || transfer.vehicleNumber ? [
        {
          table: {
            widths: ['auto', '*', 'auto', '*'],
            body: [
              [
                { text: 'السائق:', fontSize: 8, color: '#666', border: [false, false, false, false] },
                { text: transfer.driverName || '-', fontSize: 9, bold: true, border: [false, false, false, false] },
                { text: 'المركبة:', fontSize: 8, color: '#666', border: [false, false, false, false] },
                { text: transfer.vehicleNumber || '-', fontSize: 9, bold: true, border: [false, false, false, false] },
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 6]
        }
      ] : []),
      
      {
        text: 'ملاحظة: للحصول على قائمة الأصناف، استخدم زر عرض ثم PDF',
        fontSize: 8,
        color: '#888',
        alignment: 'center',
        margin: [0, 10, 0, 10]
      },
      
      ...(transfer.notes ? [
        {
          columns: [
            { text: 'ملاحظات:', fontSize: 8, color: '#666', width: 'auto' },
            { text: transfer.notes, fontSize: 8, margin: [5, 0, 0, 0] }
          ],
          margin: [0, 0, 0, 8]
        }
      ] : []),
      
      {
        table: {
          widths: ['*', '*', '*'],
          body: [
            [
              { 
                stack: [
                  { text: 'توقيع المستلم', fontSize: 8, bold: true, alignment: 'center' },
                  { text: '', margin: [0, 15, 0, 0] },
                  { text: '_______________', fontSize: 10, alignment: 'center' },
                ],
                border: [true, true, true, true],
                margin: [2, 3, 2, 3]
              },
              { 
                stack: [
                  { text: 'توقيع المُرسل', fontSize: 8, bold: true, alignment: 'center' },
                  { text: '', margin: [0, 15, 0, 0] },
                  { text: '_______________', fontSize: 10, alignment: 'center' },
                ],
                border: [true, true, true, true],
                margin: [2, 3, 2, 3]
              },
              { 
                stack: [
                  { text: 'توقيع المدير', fontSize: 8, bold: true, alignment: 'center' },
                  { text: '', margin: [0, 15, 0, 0] },
                  { text: '_______________', fontSize: 10, alignment: 'center' },
                ],
                border: [true, true, true, true],
                margin: [2, 3, 2, 3]
              }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#ccc',
          vLineColor: () => '#ccc',
        },
        margin: [0, 6, 0, 0]
      }
    ],
    defaultStyle: {
      font: 'Nillima',
      fontSize: 9,
      alignment: 'right'
    }
  };

  pdfMake.createPdf(docDefinition as any).download(`transfer-${transfer.transferNumber}.pdf`);
}
