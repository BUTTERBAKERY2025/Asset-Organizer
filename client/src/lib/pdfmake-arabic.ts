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

// Format currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ar-SA', { 
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value) + ' ريال';
}

// Format percentage
function formatPercent(value: number): string {
  return value.toFixed(1) + '%';
}

// Generate and print PDF using browser print
export async function downloadEnhancedPnLPdf(
  branchName: string,
  period: string,
  enhancedData: any,
  filename: string
): Promise<void> {
  const totals = enhancedData.totals || {};
  const today = new Date().toLocaleDateString('ar-SA');
  
  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${filename}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
        * { 
          font-family: 'Cairo', 'Arial', sans-serif; 
          direction: rtl; 
          box-sizing: border-box;
        }
        body { 
          padding: 20px; 
          font-size: 12px;
          background: white;
          color: #333;
        }
        .header { 
          display: flex; 
          justify-content: space-between; 
          border-bottom: 3px solid #D4AF37; 
          padding-bottom: 15px; 
          margin-bottom: 20px; 
        }
        .company-name { font-size: 18px; font-weight: bold; color: #D4AF37; }
        .company-name-en { font-size: 12px; color: #666; }
        .sub-text { font-size: 10px; color: #888; }
        .report-title { font-size: 16px; font-weight: bold; }
        .section-header { 
          background: #f8f9fa; 
          padding: 10px; 
          font-weight: bold; 
          margin: 15px 0 10px; 
          border-right: 4px solid #D4AF37;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 20px; 
        }
        th { 
          background: #f3f4f6; 
          padding: 10px; 
          border: 1px solid #ddd; 
          font-weight: bold; 
          text-align: center; 
        }
        td { 
          padding: 10px; 
          border: 1px solid #ddd; 
          text-align: center; 
        }
        .text-right { text-align: right; }
        .text-green { color: #28a745; }
        .text-red { color: #dc3545; }
        .text-orange { color: #fd7e14; }
        .bold { font-weight: bold; }
        .bg-green { background-color: #d4edda; }
        .bg-red { background-color: #f8d7da; }
        .bg-yellow { background-color: #fff3cd; }
        .footer { 
          text-align: center; 
          margin-top: 30px; 
          font-size: 10px; 
          color: #888; 
        }
        @media print {
          body { padding: 0; }
          @page { margin: 1cm; }
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        <div>
          <div class="company-name">شركة الزبد الأفضل التجارية</div>
          <div class="company-name-en">Best Butter Trading Co.</div>
          <div class="sub-text">سجل تجاري: 7026155296</div>
        </div>
        <div style="text-align: left;">
          <div class="report-title">تقرير الأرباح والخسائر</div>
          <div>الفرع: ${branchName}</div>
          <div>الفترة: ${period}</div>
          <div class="sub-text">تاريخ التقرير: ${today}</div>
        </div>
      </div>
      
      <!-- Summary -->
      <div class="section-header">ملخص الأداء المالي</div>
      <table>
        <tr>
          <th>التقييم</th>
          <th>صافي الربح</th>
          <th>صافي المبيعات</th>
          <th>إجمالي المبيعات</th>
        </tr>
        <tr>
          <td class="${(totals.netMargin || 0) >= 15 ? 'bg-green' : (totals.netMargin || 0) >= 5 ? 'bg-yellow' : 'bg-red'}">
            ${(totals.netMargin || 0) >= 15 ? 'ممتاز' : (totals.netMargin || 0) >= 10 ? 'جيد' : (totals.netMargin || 0) >= 5 ? 'متوسط' : 'ضعيف'}
          </td>
          <td class="bold ${(totals.netProfit || 0) >= 0 ? 'text-green' : 'text-red'}">
            ${formatCurrency(totals.netProfit || 0)}
          </td>
          <td>${formatCurrency(totals.netSales || 0)}</td>
          <td>${formatCurrency(totals.grossSales || 0)}</td>
        </tr>
      </table>
      
      <!-- Revenue Details -->
      <div class="section-header">تفاصيل الإيرادات</div>
      <table>
        <tr>
          <th>القيمة</th>
          <th>البند</th>
        </tr>
        <tr>
          <td>${formatCurrency(totals.grossSales || 0)}</td>
          <td class="text-right">إجمالي المبيعات (شامل الضريبة)</td>
        </tr>
        <tr>
          <td class="text-red">- ${formatCurrency(totals.vatAmount || 0)}</td>
          <td class="text-right">ضريبة القيمة المضافة (15%)</td>
        </tr>
        <tr class="bold">
          <td>${formatCurrency(totals.netSales || 0)}</td>
          <td class="text-right">صافي المبيعات</td>
        </tr>
      </table>
      
      <!-- Employee Costs -->
      <div class="section-header">تكاليف الموظفين (${totals.employeeCount || 0} موظف)</div>
      <table>
        <tr>
          <th>القيمة</th>
          <th>البند</th>
        </tr>
        <tr>
          <td>${formatCurrency(totals.employeeCosts?.salaries || 0)}</td>
          <td class="text-right">الرواتب والبدلات</td>
        </tr>
        <tr>
          <td>${formatCurrency(totals.employeeCosts?.gosi || 0)}</td>
          <td class="text-right">التأمينات الاجتماعية (GOSI) - 12%</td>
        </tr>
        <tr>
          <td>${formatCurrency(totals.employeeCosts?.nonSaudiCosts || 0)}</td>
          <td class="text-right">رسوم غير السعوديين</td>
        </tr>
        <tr class="bold">
          <td class="text-red">${formatCurrency(totals.employeeCosts?.total || 0)}</td>
          <td class="text-right">إجمالي تكاليف الموظفين</td>
        </tr>
      </table>
      
      <!-- Fixed Costs -->
      <div class="section-header">المصروفات الثابتة والمرافق</div>
      <table>
        <tr>
          <th>القيمة</th>
          <th>البند</th>
        </tr>
        <tr>
          <td>${formatCurrency(totals.rent || 0)}</td>
          <td class="text-right">الإيجار الشهري</td>
        </tr>
        <tr>
          <td>${formatCurrency(totals.utilities?.electricity || 0)}</td>
          <td class="text-right">الكهرباء</td>
        </tr>
        <tr>
          <td>${formatCurrency(totals.utilities?.water || 0)}</td>
          <td class="text-right">المياه</td>
        </tr>
        <tr class="bold">
          <td class="text-orange">${formatCurrency((totals.rent || 0) + (totals.utilities?.total || 0))}</td>
          <td class="text-right">الإجمالي</td>
        </tr>
      </table>
      
      <!-- Net Results -->
      <div class="section-header">صافي النتائج</div>
      <table>
        <tr>
          <th>النسبة</th>
          <th>القيمة</th>
          <th>البند</th>
        </tr>
        <tr>
          <td>${formatPercent(totals.grossMargin || 0)}</td>
          <td>${formatCurrency(totals.grossProfit || 0)}</td>
          <td class="text-right">إجمالي الربح</td>
        </tr>
        <tr>
          <td>${formatPercent((totals.netSales || 0) > 0 ? ((totals.operatingProfit || 0) / totals.netSales) * 100 : 0)}</td>
          <td>${formatCurrency(totals.operatingProfit || 0)}</td>
          <td class="text-right">الربح التشغيلي</td>
        </tr>
        <tr class="bold">
          <td>${formatPercent(totals.netMargin || 0)}</td>
          <td class="${(totals.netProfit || 0) >= 0 ? 'text-green' : 'text-red'}">${formatCurrency(totals.netProfit || 0)}</td>
          <td class="text-right">صافي الربح</td>
        </tr>
      </table>
      
      <div class="footer">
        تم إنشاء هذا التقرير آلياً من نظام باتر - ${today}
      </div>
      
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;
  
  // Open in new window and print
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    alert('يرجى السماح بالنوافذ المنبثقة لتصدير التقرير');
  }
}

// Legacy function for compatibility
export async function downloadArabicPdf(docDefinition: any, filename: string): Promise<void> {
  alert('يرجى استخدام زر التصدير المحسن');
}
