import puppeteer from "puppeteer";

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

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
