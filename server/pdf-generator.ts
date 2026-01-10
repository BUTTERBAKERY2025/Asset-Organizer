import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export interface SalaryClosingEmployee {
  employeeName: string;
  jobTitle: string;
  presentDays: number;
  absentDays: number;
  totalHours: number;
  baseSalary: number;
  allowances: number;
  socialInsurance: number;
  netSalary: number;
}

export interface SalaryClosingPdfData {
  branchName: string;
  month: string;
  employees: SalaryClosingEmployee[];
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

export async function generateSalaryClosingPdf(data: SalaryClosingPdfData): Promise<Buffer> {
  const totals = data.employees.reduce(
    (acc, emp) => ({
      baseSalary: acc.baseSalary + emp.baseSalary,
      allowances: acc.allowances + emp.allowances,
      socialInsurance: acc.socialInsurance + emp.socialInsurance,
      netSalary: acc.netSalary + emp.netSalary,
    }),
    { baseSalary: 0, allowances: 0, socialInsurance: 0, netSalary: 0 }
  );

  const employeeRows = data.employees.map((emp, index) => `
    <tr>
      <td style="text-align: center;">${index + 1}</td>
      <td style="text-align: right;">${emp.employeeName}</td>
      <td style="text-align: right;">${emp.jobTitle}</td>
      <td style="text-align: center;">${emp.presentDays}</td>
      <td style="text-align: center;">${emp.absentDays}</td>
      <td style="text-align: center;">${emp.totalHours}</td>
      <td style="text-align: center;">${formatNumber(emp.baseSalary)}</td>
      <td style="text-align: center;">${formatNumber(emp.allowances)}</td>
      <td style="text-align: center; color: ${emp.socialInsurance > 0 ? 'red' : 'inherit'};">${emp.socialInsurance > 0 ? formatNumber(emp.socialInsurance) : '-'}</td>
      <td style="text-align: center; font-weight: bold;">${formatNumber(emp.netSalary)}</td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Cairo', sans-serif;
      direction: rtl;
      text-align: right;
      padding: 20px;
      font-size: 10px;
    }
    
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    
    .header h1 {
      font-size: 18px;
      margin-bottom: 10px;
    }
    
    .header .info {
      font-size: 12px;
      color: #666;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    
    th, td {
      border: 1px solid #ddd;
      padding: 6px 4px;
      font-size: 9px;
    }
    
    th {
      background-color: #f3f4f6;
      font-weight: bold;
      text-align: center;
    }
    
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    
    .totals-table {
      margin-top: 20px;
    }
    
    .totals-table td {
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>تقرير إغلاق الرواتب الشهرية</h1>
    <div class="info">الفرع: ${data.branchName} | الشهر: ${data.month}</div>
    <div class="info">عدد الموظفين: ${data.employees.length} | إجمالي الرواتب: ${formatNumber(totals.netSalary)} ريال</div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>م</th>
        <th>الموظف</th>
        <th>الوظيفة</th>
        <th>الحضور</th>
        <th>الغياب</th>
        <th>الساعات</th>
        <th>الراتب</th>
        <th>البدلات</th>
        <th>التأمينات</th>
        <th>الصافي</th>
      </tr>
    </thead>
    <tbody>
      ${employeeRows}
    </tbody>
  </table>
  
  <table class="totals-table">
    <tr>
      <td style="text-align: right;">الإجمالي</td>
      <td style="text-align: center;">${formatNumber(totals.baseSalary)} ريال</td>
      <td style="text-align: center;">${formatNumber(totals.allowances)} ريال</td>
      <td style="text-align: center; color: red;">${formatNumber(totals.socialInsurance)} ريال</td>
      <td style="text-align: center;">${formatNumber(totals.netSalary)} ريال</td>
    </tr>
  </table>
</body>
</html>
  `;

  console.log("[PDF] Starting Puppeteer with @sparticuz/chromium...");
  
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    console.log("[PDF] Browser launched, creating page...");
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    console.log("[PDF] Generating PDF...");
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });

    console.log("[PDF] PDF generated successfully, size:", pdfBuffer.length);
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
    console.log("[PDF] Browser closed");
  }
}

export interface BranchComparisonData {
  branchName: string;
  employeeCount: number;
  saudiPercentage: number;
  totalSalary: number;
  attendanceRate: number;
  totalHours: number;
}

export interface BranchComparisonPdfData {
  month: string;
  branches: BranchComparisonData[];
}

export async function generateBranchComparisonPdf(data: BranchComparisonPdfData): Promise<Buffer> {
  const rows = data.branches.map((branch, index) => `
    <tr>
      <td style="text-align: center;">${index + 1}</td>
      <td style="text-align: right;">${branch.branchName}</td>
      <td style="text-align: center;">${branch.employeeCount}</td>
      <td style="text-align: center;">${branch.saudiPercentage}%</td>
      <td style="text-align: center;">${formatNumber(branch.totalSalary)}</td>
      <td style="text-align: center;">${branch.attendanceRate}%</td>
      <td style="text-align: center;">${branch.totalHours}</td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; padding: 20px; font-size: 11px; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 20px; margin-bottom: 10px; }
    .header .info { font-size: 14px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #ddd; padding: 8px 6px; font-size: 10px; }
    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
    tr:nth-child(even) { background-color: #f9f9f9; }
  </style>
</head>
<body>
  <div class="header">
    <h1>تقرير مقارنة الفروع</h1>
    <div class="info">الشهر: ${data.month}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>م</th>
        <th>الفرع</th>
        <th>الموظفين</th>
        <th>السعودة %</th>
        <th>الرواتب</th>
        <th>الحضور %</th>
        <th>الساعات</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  return await generatePdfFromHtml(html, true);
}

export interface JobBranchData {
  branchName: string;
  count: number;
  avgSalary: number;
}

export interface JobComparisonData {
  jobTitle: string;
  avgSalary: number;
  branches: JobBranchData[];
}

export interface JobComparisonPdfData {
  month: string;
  jobs: JobComparisonData[];
}

export async function generateJobComparisonPdf(data: JobComparisonPdfData): Promise<Buffer> {
  const rows: string[] = [];
  data.jobs.forEach((job) => {
    job.branches.forEach((branch, idx) => {
      const diff = branch.avgSalary - job.avgSalary;
      const diffColor = diff >= 0 ? 'green' : 'red';
      rows.push(`
        <tr>
          <td style="text-align: right;">${idx === 0 ? job.jobTitle : ''}</td>
          <td style="text-align: right;">${branch.branchName}</td>
          <td style="text-align: center;">${branch.count}</td>
          <td style="text-align: center;">${formatNumber(branch.avgSalary)}</td>
          <td style="text-align: center; color: ${diffColor};">${formatNumber(diff)}</td>
        </tr>
      `);
    });
  });

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; padding: 20px; font-size: 11px; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 20px; margin-bottom: 10px; }
    .header .info { font-size: 14px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #ddd; padding: 8px 6px; font-size: 10px; }
    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
    tr:nth-child(even) { background-color: #f9f9f9; }
  </style>
</head>
<body>
  <div class="header">
    <h1>تقرير مقارنة الوظائف عبر الفروع</h1>
    <div class="info">الشهر: ${data.month}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>الوظيفة</th>
        <th>الفرع</th>
        <th>العدد</th>
        <th>متوسط الراتب</th>
        <th>الفرق</th>
      </tr>
    </thead>
    <tbody>${rows.join('')}</tbody>
  </table>
</body>
</html>`;

  return await generatePdfFromHtml(html, false);
}

export interface SalaryTableEmployee {
  employeeName: string;
  jobTitle: string;
  salary: number;
  allowances: number;
  insurance: number;
  netSalary: number;
}

export interface SalaryTablePdfData {
  month: string;
  employees: SalaryTableEmployee[];
}

export async function generateSalariesTablePdf(data: SalaryTablePdfData): Promise<Buffer> {
  const rows = data.employees.map((emp, index) => `
    <tr>
      <td style="text-align: center;">${index + 1}</td>
      <td style="text-align: right;">${emp.employeeName}</td>
      <td style="text-align: right;">${emp.jobTitle}</td>
      <td style="text-align: center;">${formatNumber(emp.salary)}</td>
      <td style="text-align: center;">${formatNumber(emp.allowances)}</td>
      <td style="text-align: center; color: red;">${emp.insurance > 0 ? formatNumber(emp.insurance) : '-'}</td>
      <td style="text-align: center; font-weight: bold;">${formatNumber(emp.netSalary)}</td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; padding: 20px; font-size: 11px; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 20px; margin-bottom: 10px; }
    .header .info { font-size: 14px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #ddd; padding: 8px 6px; font-size: 10px; }
    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
    tr:nth-child(even) { background-color: #f9f9f9; }
  </style>
</head>
<body>
  <div class="header">
    <h1>جدول الرواتب التفصيلي</h1>
    <div class="info">الشهر: ${data.month} | عدد الموظفين: ${data.employees.length}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>م</th>
        <th>الموظف</th>
        <th>الوظيفة</th>
        <th>الراتب</th>
        <th>البدلات</th>
        <th>التأمينات</th>
        <th>الصافي</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  return await generatePdfFromHtml(html, true);
}

export interface TopEmployee {
  employeeName: string;
  jobTitle: string;
  salary: number;
}

export interface KPIsPdfData {
  month: string;
  totalEmployees: number;
  attendanceRate: number;
  totalSalaries: number;
  saudiPercentage: number;
  totalInsurance: number;
  topEmployees: TopEmployee[];
}

export async function generateKPIsPdf(data: KPIsPdfData): Promise<Buffer> {
  const topRows = data.topEmployees.map((emp, index) => `
    <tr>
      <td style="text-align: center;">${index + 1}</td>
      <td style="text-align: right;">${emp.employeeName}</td>
      <td style="text-align: right;">${emp.jobTitle}</td>
      <td style="text-align: center;">${formatNumber(emp.salary)}</td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; padding: 20px; font-size: 12px; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 22px; margin-bottom: 10px; }
    .header .info { font-size: 14px; color: #666; }
    .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
    .kpi-card { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; text-align: center; }
    .kpi-value { font-size: 24px; font-weight: bold; color: #1e40af; }
    .kpi-label { font-size: 12px; color: #6b7280; margin-top: 5px; }
    h2 { font-size: 16px; margin: 25px 0 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px 6px; font-size: 11px; }
    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
    tr:nth-child(even) { background-color: #f9f9f9; }
  </style>
</head>
<body>
  <div class="header">
    <h1>تقرير مؤشرات الأداء الرئيسية</h1>
    <div class="info">الشهر: ${data.month}</div>
  </div>
  
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-value">${formatNumber(data.totalEmployees)}</div>
      <div class="kpi-label">إجمالي الموظفين</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${data.attendanceRate}%</div>
      <div class="kpi-label">نسبة الحضور</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${formatNumber(data.totalSalaries)}</div>
      <div class="kpi-label">إجمالي الرواتب</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${data.saudiPercentage}%</div>
      <div class="kpi-label">نسبة السعودة</div>
    </div>
  </div>
  
  <p style="text-align: center; font-size: 14px;">إجمالي التأمينات الاجتماعية: <strong>${formatNumber(data.totalInsurance)} ريال</strong></p>
  
  <h2>أعلى 10 موظفين راتباً</h2>
  <table>
    <thead>
      <tr>
        <th>م</th>
        <th>الموظف</th>
        <th>الوظيفة</th>
        <th>الراتب</th>
      </tr>
    </thead>
    <tbody>${topRows}</tbody>
  </table>
</body>
</html>`;

  return await generatePdfFromHtml(html, false);
}

export interface HealthCertificateEmployee {
  employeeName: string;
  branchName: string;
  jobTitle: string;
  status: string;
  expiryDate: string;
}

export interface HealthCertificatePdfData {
  month: string;
  complianceRate: number;
  employees: HealthCertificateEmployee[];
}

export async function generateHealthCertificatesPdf(data: HealthCertificatePdfData): Promise<Buffer> {
  const rows = data.employees.map((emp) => `
    <tr>
      <td style="text-align: right;">${emp.employeeName}</td>
      <td style="text-align: right;">${emp.branchName}</td>
      <td style="text-align: right;">${emp.jobTitle}</td>
      <td style="text-align: center;">${emp.status}</td>
      <td style="text-align: center;">${emp.expiryDate}</td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; padding: 20px; font-size: 12px; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 22px; margin-bottom: 10px; }
    .header .info { font-size: 14px; color: #666; }
    .compliance { text-align: center; font-size: 18px; margin: 15px 0; padding: 10px; background: #f0fdf4; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #ddd; padding: 8px 6px; font-size: 11px; }
    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
    tr:nth-child(even) { background-color: #f9f9f9; }
  </style>
</head>
<body>
  <div class="header">
    <h1>تقرير الشهادات الصحية</h1>
    <div class="info">الشهر: ${data.month}</div>
  </div>
  
  <div class="compliance">نسبة الامتثال: <strong>${data.complianceRate}%</strong></div>
  
  <table>
    <thead>
      <tr>
        <th>الموظف</th>
        <th>الفرع</th>
        <th>الوظيفة</th>
        <th>الحالة</th>
        <th>تاريخ الانتهاء</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  return await generatePdfFromHtml(html, false);
}

export interface BranchSalaryStat {
  branchName: string;
  employeeCount: number;
  avgSalary: number;
  maxSalary: number;
  minSalary: number;
}

export interface NationalityStat {
  nationality: string;
  count: number;
  percentage: number;
  avgSalary: number;
}

export interface ComparisonsPdfData {
  month: string;
  branchStats: BranchSalaryStat[];
  nationalityStats: NationalityStat[];
}

export async function generateComparisonsPdf(data: ComparisonsPdfData): Promise<Buffer> {
  const branchRows = data.branchStats.map((b) => `
    <tr>
      <td style="text-align: right;">${b.branchName}</td>
      <td style="text-align: center;">${b.employeeCount}</td>
      <td style="text-align: center;">${formatNumber(b.avgSalary)}</td>
      <td style="text-align: center;">${formatNumber(b.maxSalary)}</td>
      <td style="text-align: center;">${formatNumber(b.minSalary)}</td>
    </tr>
  `).join('');

  const natRows = data.nationalityStats.map((n) => `
    <tr>
      <td style="text-align: right;">${n.nationality}</td>
      <td style="text-align: center;">${n.count}</td>
      <td style="text-align: center;">${n.percentage}%</td>
      <td style="text-align: center;">${formatNumber(n.avgSalary)}</td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; padding: 20px; font-size: 12px; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 22px; margin-bottom: 10px; }
    .header .info { font-size: 14px; color: #666; }
    h2 { font-size: 16px; margin: 25px 0 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px 6px; font-size: 11px; }
    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
    tr:nth-child(even) { background-color: #f9f9f9; }
  </style>
</head>
<body>
  <div class="header">
    <h1>تقرير المقارنات الشامل</h1>
    <div class="info">الشهر: ${data.month}</div>
  </div>
  
  <h2>مقارنة الفروع</h2>
  <table>
    <thead>
      <tr>
        <th>الفرع</th>
        <th>العدد</th>
        <th>المتوسط</th>
        <th>الأعلى</th>
        <th>الأقل</th>
      </tr>
    </thead>
    <tbody>${branchRows}</tbody>
  </table>
  
  <h2>مقارنة الجنسيات</h2>
  <table>
    <thead>
      <tr>
        <th>الجنسية</th>
        <th>العدد</th>
        <th>النسبة</th>
        <th>متوسط الراتب</th>
      </tr>
    </thead>
    <tbody>${natRows}</tbody>
  </table>
</body>
</html>`;

  return await generatePdfFromHtml(html, false);
}

async function generatePdfFromHtml(html: string, landscape: boolean): Promise<Buffer> {
  console.log("[PDF] Starting Puppeteer with @sparticuz/chromium...");
  
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    console.log("[PDF] Browser launched, creating page...");
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    console.log("[PDF] Generating PDF...");
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape,
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });

    console.log("[PDF] PDF generated successfully, size:", pdfBuffer.length);
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
    console.log("[PDF] Browser closed");
  }
}
