import html2pdf from 'html2pdf.js';

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

// Generate PDF directly from enhanced P&L data
export async function downloadEnhancedPnLPdf(
  branchName: string,
  period: string,
  enhancedData: any,
  filename: string
): Promise<void> {
  const totals = enhancedData.totals || {};
  const today = new Date().toLocaleDateString('ar-SA');
  
  const getRatingClass = (margin: number) => {
    if (margin >= 15) return 'bg-green';
    if (margin >= 10) return 'bg-blue';
    if (margin >= 5) return 'bg-yellow';
    return 'bg-red';
  };
  
  const html = `
    <div style="font-family: 'Cairo', 'Amiri', Arial, sans-serif; direction: rtl; padding: 20px; font-size: 12px;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; border-bottom: 3px solid #D4AF37; padding-bottom: 15px; margin-bottom: 20px;">
        <div>
          <div style="font-size: 18px; font-weight: bold; color: #D4AF37;">شركة الزبد الأفضل التجارية</div>
          <div style="font-size: 12px; color: #666;">Best Butter Trading Co.</div>
          <div style="font-size: 10px; color: #888;">سجل تجاري: 7026155296</div>
        </div>
        <div style="text-align: left;">
          <div style="font-size: 16px; font-weight: bold;">تقرير الأرباح والخسائر</div>
          <div>الفرع: ${branchName}</div>
          <div>الفترة: ${period}</div>
          <div style="font-size: 10px; color: #888;">تاريخ التقرير: ${today}</div>
        </div>
      </div>
      
      <!-- Summary -->
      <div style="background: #f8f9fa; padding: 10px; font-weight: bold; margin: 15px 0 10px;">ملخص الأداء المالي</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background: #f3f4f6;">
          <th style="border: 1px solid #ddd; padding: 8px;">التقييم</th>
          <th style="border: 1px solid #ddd; padding: 8px;">صافي الربح</th>
          <th style="border: 1px solid #ddd; padding: 8px;">صافي المبيعات</th>
          <th style="border: 1px solid #ddd; padding: 8px;">إجمالي المبيعات</th>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center; ${totals.netMargin >= 15 ? 'background: #d4edda;' : totals.netMargin >= 5 ? 'background: #fff3cd;' : 'background: #f8d7da;'}">
            ${totals.netMargin >= 15 ? 'ممتاز' : totals.netMargin >= 10 ? 'جيد' : totals.netMargin >= 5 ? 'متوسط' : 'ضعيف'}
          </td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: ${(totals.netProfit || 0) >= 0 ? '#28a745' : '#dc3545'}; font-weight: bold;">
            ${formatCurrency(totals.netProfit || 0)}
          </td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatCurrency(totals.netSales || 0)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatCurrency(totals.grossSales || 0)}</td>
        </tr>
      </table>
      
      <!-- Revenue Details -->
      <div style="background: #f8f9fa; padding: 10px; font-weight: bold; margin: 15px 0 10px;">تفاصيل الإيرادات</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background: #f3f4f6;">
          <th style="border: 1px solid #ddd; padding: 8px;">القيمة</th>
          <th style="border: 1px solid #ddd; padding: 8px;">البند</th>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatCurrency(totals.grossSales || 0)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">إجمالي المبيعات (شامل الضريبة)</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #dc3545;">- ${formatCurrency(totals.vatAmount || 0)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">ضريبة القيمة المضافة (15%)</td>
        </tr>
        <tr style="font-weight: bold;">
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatCurrency(totals.netSales || 0)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">صافي المبيعات</td>
        </tr>
      </table>
      
      <!-- Employee Costs -->
      <div style="background: #f8f9fa; padding: 10px; font-weight: bold; margin: 15px 0 10px;">تكاليف الموظفين (${totals.employeeCount || 0} موظف)</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background: #f3f4f6;">
          <th style="border: 1px solid #ddd; padding: 8px;">القيمة</th>
          <th style="border: 1px solid #ddd; padding: 8px;">البند</th>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatCurrency(totals.employeeCosts?.salaries || 0)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">الرواتب والبدلات</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatCurrency(totals.employeeCosts?.gosi || 0)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">التأمينات الاجتماعية (GOSI) - 12%</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatCurrency(totals.employeeCosts?.nonSaudiCosts || 0)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">رسوم غير السعوديين</td>
        </tr>
        <tr style="font-weight: bold;">
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #dc3545;">${formatCurrency(totals.employeeCosts?.total || 0)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">إجمالي تكاليف الموظفين</td>
        </tr>
      </table>
      
      <!-- Fixed Costs -->
      <div style="background: #f8f9fa; padding: 10px; font-weight: bold; margin: 15px 0 10px;">المصروفات الثابتة والمرافق</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background: #f3f4f6;">
          <th style="border: 1px solid #ddd; padding: 8px;">القيمة</th>
          <th style="border: 1px solid #ddd; padding: 8px;">البند</th>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatCurrency(totals.rent || 0)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">الإيجار الشهري</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatCurrency(totals.utilities?.electricity || 0)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">الكهرباء</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatCurrency(totals.utilities?.water || 0)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">المياه</td>
        </tr>
        <tr style="font-weight: bold;">
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #fd7e14;">${formatCurrency((totals.rent || 0) + (totals.utilities?.total || 0))}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">الإجمالي</td>
        </tr>
      </table>
      
      <!-- Net Results -->
      <div style="background: #f8f9fa; padding: 10px; font-weight: bold; margin: 15px 0 10px;">صافي النتائج</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background: #f3f4f6;">
          <th style="border: 1px solid #ddd; padding: 8px;">النسبة</th>
          <th style="border: 1px solid #ddd; padding: 8px;">القيمة</th>
          <th style="border: 1px solid #ddd; padding: 8px;">البند</th>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatPercent(totals.grossMargin || 0)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatCurrency(totals.grossProfit || 0)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">إجمالي الربح</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatPercent((totals.netSales || 0) > 0 ? ((totals.operatingProfit || 0) / totals.netSales) * 100 : 0)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatCurrency(totals.operatingProfit || 0)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">الربح التشغيلي</td>
        </tr>
        <tr style="font-weight: bold;">
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatPercent(totals.netMargin || 0)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: ${(totals.netProfit || 0) >= 0 ? '#28a745' : '#dc3545'};">${formatCurrency(totals.netProfit || 0)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">صافي الربح</td>
        </tr>
      </table>
      
      <div style="text-align: center; margin-top: 30px; font-size: 10px; color: #888;">
        تم إنشاء هذا التقرير آلياً من نظام باتر - ${today}
      </div>
    </div>
  `;
  
  try {
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm';
    container.style.background = 'white';
    document.body.appendChild(container);
    
    const options = {
      margin: 10,
      filename: filename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      },
      jsPDF: { 
        unit: 'mm' as const, 
        format: 'a4' as const, 
        orientation: 'portrait' as const 
      }
    };
    
    await html2pdf().set(options).from(container).save();
    document.body.removeChild(container);
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('خطأ في إنشاء ملف PDF: ' + (error as Error).message);
  }
}

// Legacy function for compatibility
export async function downloadArabicPdf(docDefinition: any, filename: string): Promise<void> {
  // If it's enhanced data, use the new function
  if (docDefinition._enhancedData) {
    return downloadEnhancedPnLPdf(
      docDefinition._branchName,
      docDefinition._period,
      docDefinition._enhancedData,
      filename
    );
  }
  
  // Fallback - just show an alert
  alert('يرجى استخدام زر التصدير المحسن');
}
