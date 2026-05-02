import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import * as fs from 'fs';
import * as path from 'path';
import { 
  getPdfHeaderHtml, 
  getPdfHeaderStyles, 
  getPdfFooterStyles, 
  getPdfFooterHtml, 
  getSummaryHtml,
  formatPrintDate,
  type PdfMetadata 
} from "./pdf-assets";

export interface SalaryClosingEmployee {
  employeeName: string;
  jobTitle: string;
  scheduledWorkDays?: number;
  offDays?: number;
  presentDays: number;
  absentDays: number;
  totalHours: number;
  baseSalary: number;
  allowances: number;
  dailyRate?: number;
  absenceDeduction?: number;
  socialInsurance: number;
  netSalary: number;
}

export interface SalaryClosingPdfData {
  branchName: string;
  month: string;
  employees: SalaryClosingEmployee[];
}

function formatNumber(num: number): string {
  if (isNaN(num) || !isFinite(num)) return '0';
  return new Intl.NumberFormat("en-US").format(num);
}

function safeAverage(sum: number, count: number): number {
  return count > 0 ? sum / count : 0;
}

export async function generateSalaryClosingPdf(data: SalaryClosingPdfData): Promise<Buffer> {
  const totals = data.employees.reduce(
    (acc, emp) => ({
      baseSalary: acc.baseSalary + emp.baseSalary,
      allowances: acc.allowances + emp.allowances,
      grossSalary: acc.grossSalary + (emp.baseSalary + emp.allowances),
      absenceDeduction: acc.absenceDeduction + (emp.absenceDeduction || 0),
      socialInsurance: acc.socialInsurance + emp.socialInsurance,
      netSalary: acc.netSalary + emp.netSalary,
    }),
    { baseSalary: 0, allowances: 0, grossSalary: 0, absenceDeduction: 0, socialInsurance: 0, netSalary: 0 }
  );

  const employeeRows = data.employees.map((emp, index) => {
    const dailyRate = emp.dailyRate ?? ((emp.baseSalary + emp.allowances) / 30);
    const absenceDeduction = emp.absenceDeduction ?? 0;
    return `
    <tr>
      <td style="text-align: center;">${index + 1}</td>
      <td style="text-align: right;">${emp.employeeName}</td>
      <td style="text-align: right;">${emp.jobTitle}</td>
      <td style="text-align: center; background:#eff6ff;">${emp.scheduledWorkDays ?? '-'}</td>
      <td style="text-align: center; background:#ecfdf5;">${emp.presentDays}</td>
      <td style="text-align: center; background:#fef2f2;">${emp.absentDays}</td>
      <td style="text-align: center; background:#fffbeb;">${emp.offDays ?? '-'}</td>
      <td style="text-align: center;">${emp.totalHours}</td>
      <td style="text-align: center;">${formatNumber(emp.baseSalary)}</td>
      <td style="text-align: center;">${formatNumber(emp.allowances)}</td>
      <td style="text-align: center; color:#6b7280; font-size:8px;">${formatNumber(Math.round(dailyRate * 100) / 100)}</td>
      <td style="text-align: center; color: ${absenceDeduction > 0 ? 'red' : 'inherit'};">${absenceDeduction > 0 ? '- ' + formatNumber(absenceDeduction) : '-'}</td>
      <td style="text-align: center; color: ${emp.socialInsurance > 0 ? 'red' : 'inherit'};">${emp.socialInsurance > 0 ? '- ' + formatNumber(emp.socialInsurance) : '-'}</td>
      <td style="text-align: center; font-weight: bold;">${formatNumber(emp.netSalary)}</td>
    </tr>
  `;
  }).join('');

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
    
    ${getPdfHeaderStyles()}
    ${getPdfFooterStyles()}
    
    .info-row {
      text-align: center;
      font-size: 11px;
      color: #666;
      margin-bottom: 15px;
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
  ${getPdfHeaderHtml('تقرير إغلاق الرواتب الشهرية', `الفرع: ${data.branchName} | الشهر: ${data.month}`)}
  <div class="info-row">عدد الموظفين: ${data.employees.length} | إجمالي الرواتب: ${formatNumber(totals.grossSalary)} ريال | صافي المستحق: ${formatNumber(totals.netSalary)} ريال</div>
  
  <table>
    <thead>
      <tr>
        <th>م</th>
        <th>الموظف</th>
        <th>الوظيفة</th>
        <th>أيام العمل</th>
        <th>الحضور</th>
        <th>الغياب</th>
        <th>الإجازات</th>
        <th>الساعات</th>
        <th>الراتب</th>
        <th>البدلات</th>
        <th>قيمة اليوم</th>
        <th>خصم الغياب</th>
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
      <td style="text-align: center; color: red;">- ${formatNumber(totals.absenceDeduction)} ريال</td>
      <td style="text-align: center; color: red;">- ${formatNumber(totals.socialInsurance)} ريال</td>
      <td style="text-align: center; font-weight: bold;">${formatNumber(totals.netSalary)} ريال</td>
    </tr>
  </table>
  
  ${getSummaryHtml('ملخص إغلاق الرواتب', [
    { label: 'إجمالي الموظفين', value: formatNumber(data.employees.length) },
    { label: 'إجمالي الرواتب الأساسية', value: formatNumber(totals.baseSalary) + ' ريال' },
    { label: 'إجمالي البدلات', value: formatNumber(totals.allowances) + ' ريال' },
    { label: 'إجمالي الرواتب (شامل البدلات)', value: formatNumber(totals.grossSalary) + ' ريال' },
    { label: 'إجمالي خصم الغياب', value: '- ' + formatNumber(totals.absenceDeduction) + ' ريال' },
    { label: 'إجمالي التأمينات', value: '- ' + formatNumber(totals.socialInsurance) + ' ريال' },
    { label: 'صافي الرواتب المستحقة', value: formatNumber(totals.netSalary) + ' ريال' },
    { label: 'متوسط الصافي', value: formatNumber(Math.round(safeAverage(totals.netSalary, data.employees.length))) + ' ريال' },
  ])}
</body>
</html>
  `;

  return await generatePdfFromHtml(html, { landscape: true });
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
    ${getPdfHeaderStyles()}
    ${getPdfFooterStyles()}
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #ddd; padding: 8px 6px; font-size: 10px; }
    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
    tr:nth-child(even) { background-color: #f9f9f9; }
  </style>
</head>
<body>
  ${getPdfHeaderHtml('تقرير مقارنة الفروع', `الشهر: ${data.month}`)}
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
  
  ${getSummaryHtml('ملخص مقارنة الفروع', [
    { label: 'عدد الفروع', value: formatNumber(data.branches.length) },
    { label: 'إجمالي الموظفين', value: formatNumber(data.branches.reduce((sum, b) => sum + b.employeeCount, 0)) },
    { label: 'إجمالي الرواتب', value: formatNumber(data.branches.reduce((sum, b) => sum + b.totalSalary, 0)) + ' ريال' },
    { label: 'متوسط نسبة الحضور', value: safeAverage(data.branches.reduce((sum, b) => sum + b.attendanceRate, 0), data.branches.length).toFixed(1) + '%' },
  ])}
</body>
</html>`;

  return await generatePdfFromHtml(html, { landscape: true });
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
    ${getPdfHeaderStyles()}
    ${getPdfFooterStyles()}
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #ddd; padding: 8px 6px; font-size: 10px; }
    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
    tr:nth-child(even) { background-color: #f9f9f9; }
  </style>
</head>
<body>
  ${getPdfHeaderHtml('تقرير مقارنة الوظائف عبر الفروع', `الشهر: ${data.month}`)}
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
  
  ${getSummaryHtml('ملخص مقارنة الوظائف', [
    { label: 'عدد الوظائف', value: formatNumber(data.jobs.length) },
    { label: 'إجمالي الموظفين', value: formatNumber(data.jobs.reduce((sum, j) => sum + j.branches.reduce((s, b) => s + b.count, 0), 0)) },
    { label: 'متوسط الرواتب العام', value: formatNumber(Math.round(safeAverage(data.jobs.reduce((sum, j) => sum + j.avgSalary, 0), data.jobs.length))) + ' ريال' },
  ])}
</body>
</html>`;

  return await generatePdfFromHtml(html, { landscape: false });
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
    ${getPdfHeaderStyles()}
    ${getPdfFooterStyles()}
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #ddd; padding: 8px 6px; font-size: 10px; }
    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
    tr:nth-child(even) { background-color: #f9f9f9; }
  </style>
</head>
<body>
  ${getPdfHeaderHtml('جدول الرواتب التفصيلي', `الشهر: ${data.month} | عدد الموظفين: ${data.employees.length}`)}
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
  
  ${getSummaryHtml('ملخص جدول الرواتب', [
    { label: 'عدد الموظفين', value: formatNumber(data.employees.length) },
    { label: 'إجمالي الرواتب', value: formatNumber(data.employees.reduce((s, e) => s + e.salary, 0)) + ' ريال' },
    { label: 'إجمالي البدلات', value: formatNumber(data.employees.reduce((s, e) => s + e.allowances, 0)) + ' ريال' },
    { label: 'إجمالي التأمينات', value: formatNumber(data.employees.reduce((s, e) => s + e.insurance, 0)) + ' ريال' },
    { label: 'صافي الرواتب', value: formatNumber(data.employees.reduce((s, e) => s + e.netSalary, 0)) + ' ريال' },
  ])}
</body>
</html>`;

  return await generatePdfFromHtml(html, { landscape: true });
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
    ${getPdfHeaderStyles()}
    ${getPdfFooterStyles()}
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
  ${getPdfHeaderHtml('تقرير مؤشرات الأداء الرئيسية', `الشهر: ${data.month}`)}
  
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
  
  ${getSummaryHtml('ملخص مؤشرات الأداء', [
    { label: 'إجمالي الموظفين', value: formatNumber(data.totalEmployees) },
    { label: 'نسبة الحضور', value: data.attendanceRate + '%' },
    { label: 'إجمالي الرواتب', value: formatNumber(data.totalSalaries) + ' ريال' },
    { label: 'نسبة السعودة', value: data.saudiPercentage + '%' },
    { label: 'إجمالي التأمينات', value: formatNumber(data.totalInsurance) + ' ريال' },
  ])}
</body>
</html>`;

  return await generatePdfFromHtml(html, { landscape: false });
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
    ${getPdfHeaderStyles()}
    ${getPdfFooterStyles()}
    .compliance { text-align: center; font-size: 18px; margin: 15px 0; padding: 10px; background: #f0fdf4; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #ddd; padding: 8px 6px; font-size: 11px; }
    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
    tr:nth-child(even) { background-color: #f9f9f9; }
  </style>
</head>
<body>
  ${getPdfHeaderHtml('تقرير الشهادات الصحية', `الشهر: ${data.month}`)}
  
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
  
  ${getSummaryHtml('ملخص الشهادات الصحية', [
    { label: 'إجمالي الموظفين', value: formatNumber(data.employees.length) },
    { label: 'نسبة الامتثال', value: data.complianceRate + '%' },
    { label: 'الشهادات السارية', value: formatNumber(data.employees.filter(e => e.status === 'سارية' || e.status === 'active').length) },
    { label: 'تحتاج تجديد', value: formatNumber(data.employees.filter(e => e.status !== 'سارية' && e.status !== 'active').length) },
  ])}
</body>
</html>`;

  return await generatePdfFromHtml(html, { landscape: false });
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
    ${getPdfHeaderStyles()}
    ${getPdfFooterStyles()}
    h2 { font-size: 16px; margin: 25px 0 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px 6px; font-size: 11px; }
    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
    tr:nth-child(even) { background-color: #f9f9f9; }
  </style>
</head>
<body>
  ${getPdfHeaderHtml('تقرير المقارنات الشامل', `الشهر: ${data.month}`)}
  
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
  
  ${getSummaryHtml('ملخص المقارنات', [
    { label: 'عدد الفروع', value: formatNumber(data.branchStats.length) },
    { label: 'إجمالي الموظفين', value: formatNumber(data.branchStats.reduce((s, b) => s + b.employeeCount, 0)) },
    { label: 'عدد الجنسيات', value: formatNumber(data.nationalityStats.length) },
    { label: 'متوسط الرواتب العام', value: formatNumber(Math.round(safeAverage(data.branchStats.reduce((s, b) => s + b.avgSalary, 0), data.branchStats.length))) + ' ريال' },
  ])}
</body>
</html>`;

  return await generatePdfFromHtml(html, { landscape: false });
}

// Marketing Report PDF
export interface MarketingReportPdfData {
  date: string;
  filtersText: string;
  stats: {
    totalCampaigns: number;
    totalBudget: number;
    spentBudget: number;
    budgetUtilization: number;
  };
  campaigns: Array<{ name: string; status: string; budget: number; spent: number; remaining: number }>;
  expenses: Array<{ description: string; category: string; amount: number; status: string; date: string }>;
  influencers: Array<{ name: string; specialty: string; followers: number; status: string }>;
}

export async function generateMarketingReportPdf(data: MarketingReportPdfData): Promise<Buffer> {
  const campaignRows = data.campaigns.map(c => `
    <tr>
      <td style="text-align: right;">${c.name}</td>
      <td style="text-align: center;">${c.status}</td>
      <td style="text-align: center;">${formatNumber(c.budget)}</td>
      <td style="text-align: center;">${formatNumber(c.spent)}</td>
      <td style="text-align: center;">${formatNumber(c.remaining)}</td>
    </tr>
  `).join('');

  const expenseRows = data.expenses.map(e => `
    <tr>
      <td style="text-align: right;">${e.description}</td>
      <td style="text-align: center;">${e.category}</td>
      <td style="text-align: center;">${formatNumber(e.amount)}</td>
      <td style="text-align: center;">${e.status}</td>
      <td style="text-align: center;">${e.date}</td>
    </tr>
  `).join('');

  const influencerRows = data.influencers.map(i => `
    <tr>
      <td style="text-align: right;">${i.name}</td>
      <td style="text-align: center;">${i.specialty}</td>
      <td style="text-align: center;">${formatNumber(i.followers)}</td>
      <td style="text-align: center;">${i.status}</td>
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
    ${getPdfHeaderStyles()}
    ${getPdfFooterStyles()}
    .filters { font-size: 10px; color: #888; margin-bottom: 15px; text-align: center; font-style: italic; }
    .section { margin: 20px 0; }
    .section h2 { font-size: 14px; color: #d946ef; margin-bottom: 10px; border-bottom: 2px solid #f0abfc; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th, td { border: 1px solid #ddd; padding: 6px 4px; font-size: 9px; }
    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .marketing-summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
    .marketing-summary-card { background: #fdf4ff; border: 1px solid #f0abfc; border-radius: 8px; padding: 10px; text-align: center; }
    .marketing-summary-value { font-size: 16px; font-weight: bold; color: #a21caf; }
    .marketing-summary-label { font-size: 10px; color: #86198f; }
  </style>
</head>
<body>
  ${getPdfHeaderHtml('تقرير أداء التسويق الشامل', `تاريخ التقرير: ${data.date}`)}
  ${data.filtersText ? `<div class="filters">الفلاتر المطبقة: ${data.filtersText}</div>` : ''}
  
  <div class="marketing-summary-grid">
    <div class="marketing-summary-card">
      <div class="marketing-summary-value">${data.stats.totalCampaigns}</div>
      <div class="marketing-summary-label">إجمالي الحملات</div>
    </div>
    <div class="marketing-summary-card">
      <div class="marketing-summary-value">${formatNumber(data.stats.totalBudget)}</div>
      <div class="marketing-summary-label">إجمالي الميزانية</div>
    </div>
    <div class="marketing-summary-card">
      <div class="marketing-summary-value">${formatNumber(data.stats.spentBudget)}</div>
      <div class="marketing-summary-label">المصروف</div>
    </div>
    <div class="marketing-summary-card">
      <div class="marketing-summary-value">${data.stats.budgetUtilization}%</div>
      <div class="marketing-summary-label">نسبة الاستخدام</div>
    </div>
  </div>
  
  <div class="section">
    <h2>الحملات</h2>
    <table>
      <thead><tr><th>اسم الحملة</th><th>الحالة</th><th>الميزانية</th><th>المصروف</th><th>المتبقي</th></tr></thead>
      <tbody>${campaignRows}</tbody>
    </table>
  </div>
  
  <div class="section">
    <h2>المصروفات</h2>
    <table>
      <thead><tr><th>الوصف</th><th>الفئة</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr></thead>
      <tbody>${expenseRows}</tbody>
    </table>
  </div>
  
  <div class="section">
    <h2>المؤثرين</h2>
    <table>
      <thead><tr><th>اسم المؤثر</th><th>التخصص</th><th>عدد المتابعين</th><th>الحالة</th></tr></thead>
      <tbody>${influencerRows}</tbody>
    </table>
  </div>
  
  ${getSummaryHtml('ملخص أداء التسويق', [
    { label: 'عدد الحملات', value: formatNumber(data.stats.totalCampaigns) },
    { label: 'إجمالي الميزانية', value: formatNumber(data.stats.totalBudget) + ' ريال' },
    { label: 'المصروف الفعلي', value: formatNumber(data.stats.spentBudget) + ' ريال' },
    { label: 'المتبقي', value: formatNumber(data.stats.totalBudget - data.stats.spentBudget) + ' ريال' },
    { label: 'عدد المصروفات', value: formatNumber(data.expenses.length) },
    { label: 'عدد المؤثرين', value: formatNumber(data.influencers.length) },
  ])}
</body>
</html>`;

  return await generatePdfFromHtml(html, { landscape: true });
}

// Production Reports PDF
export interface ProductionReportPdfData {
  startDate: string;
  endDate: string;
  totalBatches: number;
  totalQuantity: number;
  completionRate: number;
}

export async function generateProductionReportPdf(data: ProductionReportPdfData): Promise<Buffer> {
  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; padding: 30px; font-size: 12px; }
    ${getPdfHeaderStyles()}
    ${getPdfFooterStyles()}
    h2 { font-size: 16px; margin: 20px 0 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 10px 8px; font-size: 12px; }
    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
  </style>
</head>
<body>
  ${getPdfHeaderHtml('تقارير الإنتاج الشاملة', `الفترة: ${data.startDate} - ${data.endDate}`)}
  
  <h2>ملخص الإنتاج</h2>
  <table>
    <thead><tr><th>البند</th><th>القيمة</th></tr></thead>
    <tbody>
      <tr><td>إجمالي الدفعات</td><td style="text-align: center;">${data.totalBatches}</td></tr>
      <tr><td>إجمالي الكمية</td><td style="text-align: center;">${formatNumber(data.totalQuantity)}</td></tr>
      <tr><td>نسبة الإنجاز</td><td style="text-align: center;">${data.completionRate.toFixed(1)}%</td></tr>
    </tbody>
  </table>
  
  ${getSummaryHtml('ملخص الإنتاج', [
    { label: 'إجمالي الدفعات', value: formatNumber(data.totalBatches) },
    { label: 'إجمالي الكمية', value: formatNumber(data.totalQuantity) },
    { label: 'نسبة الإنجاز', value: data.completionRate.toFixed(1) + '%' },
  ])}
</body>
</html>`;

  return await generatePdfFromHtml(html, { landscape: false });
}

// Production Order PDF
export interface ProductionOrderPdfData {
  orderNumber: string;
  title: string;
  status: string;
  priority: string;
  orderType: string;
  branchName: string;
  targetDate: string;
  notes: string;
  estimatedCost: number;
  actualCost: number;
  targetSalesValue?: number;
  sourceSalesValue?: number;
  items: Array<{
    productName: string;
    category: string;
    targetQuantity: number;
    producedQuantity: number;
    unitPrice: number;
    total: number;
    originalQuantity?: number;
    increaseQuantity?: number;
  }>;
}

// Department/Category mapping based on system categories:
// إفطار، مخبوزات، حلويات، بيتزا، باريستا، تجمعات
const DEPARTMENT_MAPPING: Record<string, string> = {
  // إفطار
  'إفطار': 'إفطار',
  'افطار': 'إفطار',
  'فطور': 'إفطار',
  'breakfast': 'إفطار',
  // مخبوزات
  'مخبوزات': 'مخبوزات',
  'معجنات': 'مخبوزات',
  'خبز': 'مخبوزات',
  'بيكري': 'مخبوزات',
  'bakery': 'مخبوزات',
  'bread': 'مخبوزات',
  'فطائر': 'مخبوزات',
  'كرواسون': 'مخبوزات',
  'croissant': 'مخبوزات',
  'دونات': 'مخبوزات',
  'donut': 'مخبوزات',
  // حلويات
  'حلويات': 'حلويات',
  'كيك': 'حلويات',
  'تورتات': 'حلويات',
  'تورتة': 'حلويات',
  'باستري': 'حلويات',
  'pastry': 'حلويات',
  'desserts': 'حلويات',
  'dessert': 'حلويات',
  'حلواني': 'حلويات',
  'sweets': 'حلويات',
  'شوكولاتة': 'حلويات',
  'chocolate': 'حلويات',
  'كوكيز': 'حلويات',
  'cookie': 'حلويات',
  // بيتزا
  'بيتزا': 'بيتزا',
  'pizza': 'بيتزا',
  'ساندويتشات': 'بيتزا',
  'ساندويش': 'بيتزا',
  'sandwich': 'بيتزا',
  // باريستا
  'باريستا': 'باريستا',
  'barista': 'باريستا',
  'مشروبات': 'باريستا',
  'مشروبات باردة': 'باريستا',
  'مشروبات ساخنة': 'باريستا',
  'قهوة': 'باريستا',
  'coffee': 'باريستا',
  'شاي': 'باريستا',
  'عصائر': 'باريستا',
  'سموذي': 'باريستا',
  'smoothie': 'باريستا',
  'drinks': 'باريستا',
  'beverages': 'باريستا',
  // تجمعات
  'تجمعات': 'تجمعات',
  'تجمع': 'تجمعات',
  'gathering': 'تجمعات',
  'catering': 'تجمعات',
  // أخرى
  'عام': 'أخرى',
  'other': 'أخرى',
  'general': 'أخرى',
};

// Keywords in product names to infer category when category is missing
const PRODUCT_NAME_KEYWORDS: Record<string, string> = {
  // باريستا keywords
  'latte': 'باريستا',
  'لاتيه': 'باريستا',
  'coffee': 'باريستا',
  'قهوة': 'باريستا',
  'espresso': 'باريستا',
  'اسبريسو': 'باريستا',
  'cappuccino': 'باريستا',
  'كابتشينو': 'باريستا',
  'americano': 'باريستا',
  'امريكانو': 'باريستا',
  'mocha': 'باريستا',
  'موكا': 'باريستا',
  'flat white': 'باريستا',
  'فلات وايت': 'باريستا',
  'cortado': 'باريستا',
  'كورتادو': 'باريستا',
  'juice': 'باريستا',
  'عصير': 'باريستا',
  'tea': 'باريستا',
  'شاي': 'باريستا',
  'hot chocolate': 'باريستا',
  'هوت شوكليت': 'باريستا',
  'ماء': 'باريستا',
  'water': 'باريستا',
  'ice coffee': 'باريستا',
  'breeze': 'باريستا',
  'بريز': 'باريستا',
  // مخبوزات keywords
  'croissant': 'مخبوزات',
  'كرواسون': 'مخبوزات',
  'danish': 'مخبوزات',
  'دانش': 'مخبوزات',
  'brioche': 'مخبوزات',
  'بريوش': 'مخبوزات',
  'pain': 'مخبوزات',
  'بان': 'مخبوزات',
  'bun': 'مخبوزات',
  // حلويات keywords
  'cake': 'حلويات',
  'كيك': 'حلويات',
  'cheesecake': 'حلويات',
  'تشيز كيك': 'حلويات',
  'pudding': 'حلويات',
  'بودنج': 'حلويات',
  // إفطار keywords
  'egg': 'إفطار',
  'بيض': 'إفطار',
  'bruschetta': 'إفطار',
  'بروسكيتا': 'إفطار',
  'turkish egg': 'إفطار',
  // بيتزا keywords
  'sandwich': 'بيتزا',
  'ساندوتش': 'بيتزا',
  'ساندويش': 'بيتزا',
  'tuna': 'بيتزا',
  'تونة': 'بيتزا',
};

function inferCategoryFromProductName(productName: string): string | null {
  if (!productName) return null;
  const lowerName = productName.toLowerCase();
  
  for (const [keyword, category] of Object.entries(PRODUCT_NAME_KEYWORDS)) {
    if (lowerName.includes(keyword.toLowerCase())) {
      return category;
    }
  }
  return null;
}

function getDepartment(category: string, productName?: string): string {
  // First try to get department from category
  if (category) {
    const lowerCategory = category.toLowerCase().trim();
    
    // Exact match
    for (const [key, dept] of Object.entries(DEPARTMENT_MAPPING)) {
      if (lowerCategory === key.toLowerCase()) {
        return dept;
      }
    }
    
    // Partial match
    for (const [key, dept] of Object.entries(DEPARTMENT_MAPPING)) {
      if (lowerCategory.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerCategory)) {
        return dept;
      }
    }
  }
  
  // If no category, try to infer from product name
  if (productName) {
    const inferred = inferCategoryFromProductName(productName);
    if (inferred) return inferred;
  }
  
  return 'أخرى';
}

// Invalid product names to filter out (metadata rows from Excel)
const INVALID_PRODUCT_NAMES = [
  'النطاق الزمني',
  'الفترة',
  'التاريخ',
  'الإجمالي',
  'المجموع',
  'total',
  'sum',
  'date range',
  'period',
  'header',
  'footer',
];

function isValidProductName(name: string): boolean {
  if (!name || name.trim().length < 2) return false;
  const lowerName = name.toLowerCase().trim();
  return !INVALID_PRODUCT_NAMES.some(invalid => 
    lowerName.includes(invalid.toLowerCase()) || invalid.toLowerCase().includes(lowerName)
  );
}

export async function generateProductionOrderPdf(data: ProductionOrderPdfData): Promise<Buffer> {
  // Filter out invalid items (metadata rows from Excel)
  const validItems = data.items.filter(item => isValidProductName(item.productName));
  
  // Group items by department (use product name for inference if category is missing)
  const groupedItems: Record<string, typeof validItems> = {};
  validItems.forEach(item => {
    const dept = getDepartment(item.category, item.productName);
    if (!groupedItems[dept]) groupedItems[dept] = [];
    groupedItems[dept].push(item);
  });

  // Sort departments based on system categories
  const deptOrder = ['إفطار', 'مخبوزات', 'حلويات', 'بيتزا', 'باريستا', 'تجمعات', 'أخرى'];
  const sortedDepts = Object.keys(groupedItems).sort((a, b) => {
    const aIdx = deptOrder.indexOf(a);
    const bIdx = deptOrder.indexOf(b);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  // Build grouped table rows
  let itemRows = '';
  let globalIndex = 1;
  
  for (const dept of sortedDepts) {
    const deptItems = groupedItems[dept];
    const deptTotal = deptItems.reduce((s, i) => s + i.total, 0);
    const deptQty = deptItems.reduce((s, i) => s + i.targetQuantity, 0);
    
    // Department header row
    itemRows += `
      <tr class="dept-header">
        <td colspan="7" style="background: #92400e; color: white; font-weight: bold; text-align: right; padding: 8px;">
          ${dept} (${deptItems.length} صنف)
        </td>
      </tr>
    `;
    
    // Items in this department
    for (const item of deptItems) {
      const increaseNote = item.increaseQuantity && item.increaseQuantity > 0 
        ? `<span style="color: #16a34a; font-size: 9px;"> (+${item.increaseQuantity})</span>` 
        : '';
      itemRows += `
        <tr>
          <td style="text-align: center;">${globalIndex++}</td>
          <td style="text-align: right;">${item.productName}</td>
          <td style="text-align: center;">${item.category}</td>
          <td style="text-align: center;">${item.targetQuantity}${increaseNote}</td>
          <td style="text-align: center;">${item.producedQuantity}</td>
          <td style="text-align: center;">${formatNumber(item.unitPrice)}</td>
          <td style="text-align: center;">${formatNumber(item.total)}</td>
        </tr>
      `;
    }
    
    // Department subtotal row
    itemRows += `
      <tr class="dept-subtotal">
        <td colspan="3" style="background: #fef3c7; font-weight: bold; text-align: right;">إجمالي ${dept}</td>
        <td style="background: #fef3c7; font-weight: bold; text-align: center;">${deptQty}</td>
        <td style="background: #fef3c7;"></td>
        <td style="background: #fef3c7;"></td>
        <td style="background: #fef3c7; font-weight: bold; text-align: center;">${formatNumber(deptTotal)} ريال</td>
      </tr>
    `;
  }

  // Grand totals (using filtered valid items)
  const grandTotalQty = validItems.reduce((s, i) => s + i.targetQuantity, 0);
  const grandTotalValue = validItems.reduce((s, i) => s + i.total, 0);
  const totalOriginalQty = validItems.reduce((s, i) => s + (i.originalQuantity || 0), 0);
  const totalIncrease = validItems.reduce((s, i) => s + (i.increaseQuantity || 0), 0);

  // Comparison section (source vs target)
  const hasComparison = data.sourceSalesValue && data.targetSalesValue && data.sourceSalesValue > 0;
  const increaseRatio = hasComparison ? ((data.targetSalesValue! / data.sourceSalesValue!) * 100 - 100).toFixed(1) : '0';
  
  const comparisonHtml = hasComparison ? `
    <div class="comparison-section" style="margin-top: 20px; padding: 15px; background: #eff6ff; border: 2px solid #3b82f6; border-radius: 8px;">
      <h3 style="color: #1e40af; margin-bottom: 10px; font-size: 13px;">مقارنة البيانات المصدر والمستهدف</h3>
      <table style="width: 100%;">
        <tr>
          <td style="width: 50%; padding: 8px; background: #dbeafe;">
            <div style="font-size: 10px; color: #1e40af;">مبيعات الملف المصدر</div>
            <div style="font-size: 14px; font-weight: bold; color: #1e3a8a;">${formatNumber(data.sourceSalesValue!)} ريال</div>
          </td>
          <td style="width: 50%; padding: 8px; background: #dcfce7;">
            <div style="font-size: 10px; color: #166534;">المبيعات المستهدفة</div>
            <div style="font-size: 14px; font-weight: bold; color: #15803d;">${formatNumber(data.targetSalesValue!)} ريال</div>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; background: #fef9c3;">
            <div style="font-size: 10px; color: #854d0e;">إجمالي الكمية الأصلية</div>
            <div style="font-size: 14px; font-weight: bold; color: #a16207;">${formatNumber(totalOriginalQty)} وحدة</div>
          </td>
          <td style="padding: 8px; background: #d1fae5;">
            <div style="font-size: 10px; color: #166534;">الزيادة في الكمية</div>
            <div style="font-size: 14px; font-weight: bold; color: #16a34a;">+${formatNumber(totalIncrease)} وحدة (${increaseRatio}%)</div>
          </td>
        </tr>
      </table>
    </div>
    
    <h3 style="color: #92400e; margin: 20px 0 10px; font-size: 13px;">تفصيل الزيادات حسب القسم</h3>
    <table>
      <thead>
        <tr>
          <th>القسم</th>
          <th>عدد الأصناف</th>
          <th>الكمية الأصلية</th>
          <th>الكمية المستهدفة</th>
          <th>الزيادة</th>
          <th>الإجمالي (ريال)</th>
        </tr>
      </thead>
      <tbody>
        ${sortedDepts.map(dept => {
          const deptItems = groupedItems[dept];
          const origQty = deptItems.reduce((s, i) => s + (i.originalQuantity || 0), 0);
          const targetQty = deptItems.reduce((s, i) => s + i.targetQuantity, 0);
          const incQty = deptItems.reduce((s, i) => s + (i.increaseQuantity || 0), 0);
          const deptTotal = deptItems.reduce((s, i) => s + i.total, 0);
          return `
            <tr>
              <td style="font-weight: bold;">${dept}</td>
              <td style="text-align: center;">${deptItems.length}</td>
              <td style="text-align: center;">${formatNumber(origQty)}</td>
              <td style="text-align: center;">${formatNumber(targetQty)}</td>
              <td style="text-align: center; color: #16a34a;">+${formatNumber(incQty)}</td>
              <td style="text-align: center;">${formatNumber(deptTotal)}</td>
            </tr>
          `;
        }).join('')}
        <tr style="background: #fef3c7; font-weight: bold;">
          <td>الإجمالي</td>
          <td style="text-align: center;">${validItems.length}</td>
          <td style="text-align: center;">${formatNumber(totalOriginalQty)}</td>
          <td style="text-align: center;">${formatNumber(grandTotalQty)}</td>
          <td style="text-align: center; color: #16a34a;">+${formatNumber(totalIncrease)}</td>
          <td style="text-align: center;">${formatNumber(grandTotalValue)}</td>
        </tr>
      </tbody>
    </table>
  ` : '';

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; padding: 25px; font-size: 11px; }
    ${getPdfHeaderStyles()}
    ${getPdfFooterStyles()}
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
    .info-item { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 10px; }
    .info-label { font-size: 10px; color: #92400e; }
    .info-value { font-size: 12px; font-weight: bold; color: #78350f; }
    h2 { font-size: 14px; margin: 15px 0 10px; color: #92400e; }
    h3 { font-size: 12px; color: #78350f; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th, td { border: 1px solid #ddd; padding: 8px 6px; font-size: 10px; }
    th { background-color: #fef3c7; font-weight: bold; text-align: center; }
    tr:nth-child(even) { background-color: #fffbeb; }
    .dept-header td { font-size: 11px !important; }
    .costs { display: flex; justify-content: space-around; margin-top: 20px; padding: 15px; background: #f0fdf4; border-radius: 8px; }
    .cost-item { text-align: center; }
    .cost-label { font-size: 11px; color: #166534; }
    .cost-value { font-size: 16px; font-weight: bold; color: #15803d; }
    .grand-total { background: #fcd34d !important; font-weight: bold; }
  </style>
</head>
<body>
  ${getPdfHeaderHtml(data.title || 'أمر إنتاج', `رقم الأمر: ${data.orderNumber}`)}
  
  <div class="info-grid">
    <div class="info-item"><div class="info-label">الحالة</div><div class="info-value">${data.status}</div></div>
    <div class="info-item"><div class="info-label">الأولوية</div><div class="info-value">${data.priority}</div></div>
    <div class="info-item"><div class="info-label">النوع</div><div class="info-value">${data.orderType}</div></div>
    <div class="info-item"><div class="info-label">الفرع</div><div class="info-value">${data.branchName}</div></div>
    <div class="info-item"><div class="info-label">تاريخ التسليم</div><div class="info-value">${data.targetDate}</div></div>
    <div class="info-item"><div class="info-label">المبيعات المستهدفة</div><div class="info-value">${data.targetSalesValue ? formatNumber(data.targetSalesValue) + ' ريال' : '-'}</div></div>
  </div>
  
  ${data.notes ? `<div style="background: #fef3c7; padding: 10px; border-radius: 6px; margin-bottom: 15px;"><strong>ملاحظات:</strong> ${data.notes}</div>` : ''}
  
  <h2>بنود الأمر حسب القسم</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>المنتج</th>
        <th>الفئة</th>
        <th>الكمية المطلوبة</th>
        <th>الكمية المنتجة</th>
        <th>سعر الوحدة</th>
        <th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr class="grand-total">
        <td colspan="3" style="text-align: right;">الإجمالي الكلي</td>
        <td style="text-align: center;">${grandTotalQty}</td>
        <td style="text-align: center;">${data.items.reduce((s, i) => s + i.producedQuantity, 0)}</td>
        <td></td>
        <td style="text-align: center;">${formatNumber(grandTotalValue)} ريال</td>
      </tr>
    </tbody>
  </table>
  
  ${comparisonHtml}
  
  <div class="costs">
    <div class="cost-item"><div class="cost-label">التكلفة المقدرة</div><div class="cost-value">${formatNumber(data.estimatedCost)} ريال</div></div>
    <div class="cost-item"><div class="cost-label">التكلفة الفعلية</div><div class="cost-value">${formatNumber(data.actualCost)} ريال</div></div>
    <div class="cost-item"><div class="cost-label">عدد الأصناف</div><div class="cost-value">${data.items.length}</div></div>
  </div>
  
  ${getSummaryHtml('ملخص أمر الإنتاج', [
    { label: 'عدد البنود', value: formatNumber(data.items.length) },
    { label: 'إجمالي الكمية المطلوبة', value: formatNumber(grandTotalQty) },
    { label: 'إجمالي الكمية المنتجة', value: formatNumber(data.items.reduce((s, i) => s + i.producedQuantity, 0)) },
    { label: 'التكلفة المقدرة', value: formatNumber(data.estimatedCost) + ' ريال' },
    { label: 'التكلفة الفعلية', value: formatNumber(data.actualCost) + ' ريال' },
    { label: 'الفرق', value: formatNumber(data.estimatedCost - data.actualCost) + ' ريال' },
  ])}
</body>
</html>`;

  return await generatePdfFromHtml(html, { landscape: false });
}

export interface WeeklyScheduleDay {
  day: string;
  date: string;
  isOff: boolean;
  startTime: string;
  endTime: string;
}

export interface WeeklyScheduleEmployee {
  employeeName: string;
  jobTitle: string;
  days: WeeklyScheduleDay[];
}

export interface WeeklySchedulePdfData {
  branchName: string;
  periodStart: string;
  periodEnd: string;
  weekDates: { day: string; date: string }[];
  employees: WeeklyScheduleEmployee[];
}

function formatTimeTo12Hour(time24: string): string {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'م' : 'ص';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Determine shift type based on start time
function getShiftType(startTime: string): { type: string; class: string } {
  if (!startTime) return { type: '-', class: '' };
  const [hours] = startTime.split(':').map(Number);
  if (hours >= 5 && hours < 12) {
    return { type: 'صباحي AM', class: 'shift-morning' };
  } else if (hours >= 12 && hours < 18) {
    return { type: 'مسائي PM', class: 'shift-evening' };
  } else {
    return { type: 'ليلي Night', class: 'shift-night' };
  }
}

export async function generateWeeklySchedulePdf(data: WeeklySchedulePdfData): Promise<Buffer> {
  const headerCells = data.weekDates.map(d => 
    `<th class="day-header">${d.day} / ${(d as any).dayEn || ''}<br/>${d.date}</th>`
  ).join('');

  // Group employees by job title
  const sortedEmployees = [...data.employees].sort((a, b) => a.jobTitle.localeCompare(b.jobTitle, 'ar'));
  
  // Count shift types and build job title analytics
  let morningCount = 0;
  let eveningCount = 0;
  let nightCount = 0;
  
  // Analytics: Per job title shift distribution
  const jobTitleAnalytics: Map<string, { morning: number; evening: number; night: number; total: number }> = new Map();
  
  let currentJobTitle = '';
  let seqNum = 0;
  const rows = sortedEmployees.map((emp) => {
    const showJobTitle = emp.jobTitle !== currentJobTitle;
    if (showJobTitle) {
      currentJobTitle = emp.jobTitle;
      seqNum = 0;
    }
    seqNum++;
    
    // Determine employee's primary shift type from first work day
    const firstWorkDay = emp.days.find(d => !d.isOff && d.startTime);
    const shiftInfo = firstWorkDay ? getShiftType(firstWorkDay.startTime!) : { type: '-', class: '' };
    
    // Count shift types
    if (shiftInfo.type.includes('صباحي')) morningCount++;
    else if (shiftInfo.type.includes('مسائي')) eveningCount++;
    else if (shiftInfo.type.includes('ليلي')) nightCount++;
    
    // Build job title analytics
    if (!jobTitleAnalytics.has(emp.jobTitle)) {
      jobTitleAnalytics.set(emp.jobTitle, { morning: 0, evening: 0, night: 0, total: 0 });
    }
    const jobStats = jobTitleAnalytics.get(emp.jobTitle)!;
    jobStats.total++;
    if (shiftInfo.type.includes('صباحي')) jobStats.morning++;
    else if (shiftInfo.type.includes('مسائي')) jobStats.evening++;
    else if (shiftInfo.type.includes('ليلي')) jobStats.night++;
    
    const dayCells = emp.days.map(d => {
      if (d.isOff) {
        return `<td class="cell-off">إجازة<br/>Off</td>`;
      } else if (d.startTime && d.endTime) {
        const start12 = formatTimeTo12Hour(d.startTime);
        const end12 = formatTimeTo12Hour(d.endTime);
        return `<td class="cell-work">${start12}<br/>${end12}</td>`;
      }
      return `<td class="cell-empty">-</td>`;
    }).join('');
    
    const jobTitleRow = showJobTitle ? `<tr class="job-title-row"><td colspan="11" class="job-title-cell">${emp.jobTitle}</td></tr>` : '';
    
    return `${jobTitleRow}
      <tr>
        <td class="cell-seq">${seqNum}</td>
        <td class="cell-employee">${emp.employeeName}</td>
        <td class="cell-shift ${shiftInfo.class}">${shiftInfo.type}</td>
        ${dayCells}
      </tr>
    `;
  }).join('');
  
  // Store counts for summary
  const shiftSummary = { morning: morningCount, evening: eveningCount, night: nightCount };
  
  // Build job title analytics HTML
  const analyticsRows = Array.from(jobTitleAnalytics.entries()).map(([title, stats]) => {
    const total = stats.total || 1;
    const mPct = Math.round((stats.morning / total) * 100);
    const ePct = Math.round((stats.evening / total) * 100);
    const nPct = Math.round((stats.night / total) * 100);
    
    return `
      <div class="analytics-row">
        <div class="analytics-title">${title}</div>
        <div class="analytics-badges">
          ${stats.morning > 0 ? `<span class="badge-morning">${stats.morning}</span>` : ''}
          ${stats.evening > 0 ? `<span class="badge-evening">${stats.evening}</span>` : ''}
          ${stats.night > 0 ? `<span class="badge-night">${stats.night}</span>` : ''}
          <span class="badge-total">${stats.total}</span>
        </div>
        <div class="analytics-bar">
          ${stats.morning > 0 ? `<div class="bar-morning" style="width: ${mPct}%"></div>` : ''}
          ${stats.evening > 0 ? `<div class="bar-evening" style="width: ${ePct}%"></div>` : ''}
          ${stats.night > 0 ? `<div class="bar-night" style="width: ${nPct}%"></div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const totalOffDays = data.employees.reduce((sum, e) => sum + e.days.filter(d => d.isOff).length, 0);
  // Employees who have NO off days this week
  const noOffDaysEmployees = data.employees.filter(e => !e.days.some(d => d.isOff)).length;

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body { 
      font-family: 'Cairo', sans-serif; 
      direction: rtl; 
      text-align: right; 
      padding: 10px 15px; 
      font-size: 8px;
      background: #fff;
    }
    
    ${getPdfHeaderStyles()}
    ${getPdfFooterStyles()}
    
    .info-bar {
      display: flex;
      justify-content: space-between;
      margin: 8px 0;
      padding: 6px 12px;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      font-size: 9px;
    }
    
    .info-bar span { color: #374151; }
    .info-bar strong { color: #1f2937; }
    
    table { 
      width: 100%; 
      border-collapse: collapse;
      margin-top: 8px;
      border: 1px solid #374151;
    }
    
    th, td { 
      padding: 4px 3px;
      border: 1px solid #9ca3af;
      font-size: 8px;
      line-height: 1.2;
    }
    
    thead tr th {
      background: #374151;
      color: white;
      font-weight: 600;
      font-size: 8px;
    }
    
    .day-header {
      text-align: center;
      min-width: 55px;
      font-size: 8px;
    }
    
    .col-seq { width: 20px; text-align: center; }
    .col-name { min-width: 80px; text-align: right; }
    .col-shift { width: 40px; text-align: center; }
    
    .job-title-row td {
      background: #d4a853 !important;
      color: white;
      font-weight: 700;
      font-size: 9px;
      text-align: right;
      padding: 4px 8px;
    }
    
    .job-title-cell {
      border-color: #b8942d !important;
    }
    
    tbody tr:not(.job-title-row):nth-child(even) { background: #f9fafb; }
    tbody tr:not(.job-title-row):nth-child(odd) { background: #ffffff; }
    
    .cell-seq {
      text-align: center;
      color: #6b7280;
      font-size: 8px;
    }
    
    .cell-employee {
      text-align: right;
      font-weight: 500;
      color: #1f2937;
      font-size: 8px;
      padding-right: 6px;
    }
    
    .cell-work {
      text-align: center;
      background: #ecfdf5 !important;
      color: #065f46;
      font-size: 7px;
    }
    
    .cell-off {
      text-align: center;
      background: #fef3c7 !important;
      color: #92400e;
      font-weight: 600;
      font-size: 7px;
    }
    
    .cell-empty {
      text-align: center;
      color: #d1d5db;
    }
    
    .cell-shift {
      text-align: center;
      font-weight: 600;
      font-size: 7px;
    }
    
    .shift-morning {
      background: #dbeafe !important;
      color: #1e40af;
    }
    
    .shift-evening {
      background: #fef3c7 !important;
      color: #92400e;
    }
    
    .shift-night {
      background: #e0e7ff !important;
      color: #3730a3;
    }
    
    .footer-section {
      margin-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    
    .summary-compact {
      display: flex;
      gap: 15px;
      font-size: 8px;
    }
    
    .summary-compact span { color: #6b7280; }
    .summary-compact strong { color: #1f2937; }
    
    .shift-morning-badge { background: #dbeafe; padding: 2px 6px; border-radius: 3px; }
    .shift-morning-badge strong { color: #1e40af; }
    .shift-evening-badge { background: #fef3c7; padding: 2px 6px; border-radius: 3px; }
    .shift-evening-badge strong { color: #92400e; }
    .shift-night-badge { background: #e0e7ff; padding: 2px 6px; border-radius: 3px; }
    .shift-night-badge strong { color: #3730a3; }
    .no-off-badge { background: #fee2e2; padding: 2px 6px; border-radius: 3px; }
    .no-off-badge strong { color: #dc2626; }
    
    /* Job Title Analytics Section */
    .analytics-section {
      margin-top: 10px;
      padding: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    
    .analytics-header {
      font-size: 9px;
      font-weight: 700;
      color: #374151;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
    }
    
    .analytics-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    
    .analytics-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      font-size: 7px;
    }
    
    .analytics-title {
      font-weight: 600;
      color: #374151;
      min-width: 70px;
    }
    
    .analytics-badges {
      display: flex;
      gap: 3px;
    }
    
    .badge-morning {
      background: #dbeafe;
      color: #1e40af;
      padding: 1px 5px;
      border-radius: 3px;
      font-weight: 600;
      font-size: 7px;
    }
    
    .badge-evening {
      background: #fef3c7;
      color: #92400e;
      padding: 1px 5px;
      border-radius: 3px;
      font-weight: 600;
      font-size: 7px;
    }
    
    .badge-night {
      background: #e0e7ff;
      color: #3730a3;
      padding: 1px 5px;
      border-radius: 3px;
      font-weight: 600;
      font-size: 7px;
    }
    
    .badge-total {
      background: #374151;
      color: white;
      padding: 1px 5px;
      border-radius: 3px;
      font-weight: 600;
      font-size: 7px;
    }
    
    .analytics-bar {
      display: flex;
      width: 50px;
      height: 6px;
      background: #e5e7eb;
      border-radius: 3px;
      overflow: hidden;
    }
    
    .bar-morning { background: #3b82f6; }
    .bar-evening { background: #f59e0b; }
    .bar-night { background: #6366f1; }
    
    .legend-row {
      display: flex;
      gap: 10px;
      font-size: 7px;
      color: #6b7280;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: 3px;
    }
    
    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 2px;
    }
    
    .signatures-compact {
      display: flex;
      gap: 30px;
    }
    
    .sig-box {
      text-align: center;
      font-size: 8px;
    }
    
    .sig-label {
      color: #374151;
      font-weight: 600;
      margin-bottom: 15px;
    }
    
    .sig-line {
      width: 80px;
      border-top: 1px solid #374151;
      padding-top: 2px;
      color: #9ca3af;
      font-size: 7px;
    }
  </style>
</head>
<body>
  ${getPdfHeaderHtml('جدول الدوام الأسبوعي', `${data.branchName}`)}
  
  <div class="info-bar">
    <span>الفترة: <strong>${data.periodStart} - ${data.periodEnd}</strong></span>
    <span>عدد الموظفين: <strong>${data.employees.length}</strong></span>
    <span>تاريخ الإصدار: <strong>${formatPrintDate()}</strong></span>
  </div>
  
  <table>
    <thead>
      <tr>
        <th class="col-seq">م<br/>No</th>
        <th class="col-name">الموظف Employee</th>
        <th class="col-shift">الوردية<br/>Shift</th>
        ${headerCells}
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  
  <!-- Job Title Analytics Section -->
  <div class="analytics-section">
    <div class="analytics-header">
      <span>📊 توزيع الورديات حسب الوظيفة / Shift Distribution by Job Title</span>
      <div class="legend-row">
        <div class="legend-item"><div class="legend-dot" style="background: #3b82f6;"></div>صباحي AM</div>
        <div class="legend-item"><div class="legend-dot" style="background: #f59e0b;"></div>مسائي PM</div>
        <div class="legend-item"><div class="legend-dot" style="background: #6366f1;"></div>ليلي Night</div>
      </div>
    </div>
    <div class="analytics-grid">
      ${analyticsRows}
    </div>
  </div>
  
  <div class="footer-section">
    <div class="summary-compact">
      <span>إجمالي Total: <strong>${data.employees.length}</strong></span>
      <span class="shift-morning-badge">صباحي Morning: <strong>${shiftSummary.morning}</strong></span>
      <span class="shift-evening-badge">مسائي Evening: <strong>${shiftSummary.evening}</strong></span>
      <span class="shift-night-badge">ليلي Night: <strong>${shiftSummary.night}</strong></span>
      <span class="no-off-badge">بدون إجازة No Off: <strong>${noOffDaysEmployees}</strong></span>
    </div>
    <div class="signatures-compact">
      <div class="sig-box"><div class="sig-label">إعداد Prepared</div><div class="sig-line">التوقيع Sign</div></div>
      <div class="sig-box"><div class="sig-label">مراجعة Reviewed</div><div class="sig-line">التوقيع Sign</div></div>
      <div class="sig-box"><div class="sig-label">اعتماد Approved</div><div class="sig-line">التوقيع Sign</div></div>
    </div>
  </div>
</body>
</html>`;

  return await generatePdfFromHtml(html, { landscape: true });
}

export interface ShiftScheduleEmployee {
  employeeName: string;
  workDays: number;
  offDays: number;
  attendedDays: number;
  absentDays: number;
  rate: number;
}

export interface ShiftSchedulePdfData {
  branchName: string;
  periodStart: string;
  periodEnd: string;
  employees: ShiftScheduleEmployee[];
}

export async function generateShiftSchedulePdf(data: ShiftSchedulePdfData): Promise<Buffer> {
  const rows = data.employees.map((emp, index) => {
    const badgeStyle = emp.rate >= 80 
      ? 'background: #d4edda; color: #155724; padding: 2px 8px; border-radius: 4px;'
      : emp.rate >= 50 
        ? 'background: #fff3cd; color: #856404; padding: 2px 8px; border-radius: 4px;'
        : 'background: #f8d7da; color: #721c24; padding: 2px 8px; border-radius: 4px;';
    
    return `
    <tr>
      <td style="text-align: center;">${index + 1}</td>
      <td style="text-align: right;">${emp.employeeName}</td>
      <td style="text-align: center;">${emp.workDays}</td>
      <td style="text-align: center;">${emp.offDays}</td>
      <td style="text-align: center; color: green;">${emp.attendedDays}</td>
      <td style="text-align: center; color: ${emp.absentDays > 0 ? 'red' : 'inherit'};">${emp.absentDays}</td>
      <td style="text-align: center;"><span style="${badgeStyle}">${emp.rate}%</span></td>
    </tr>
  `;
  }).join('');

  const totals = {
    workDays: data.employees.reduce((sum, e) => sum + e.workDays, 0),
    offDays: data.employees.reduce((sum, e) => sum + e.offDays, 0),
    attendedDays: data.employees.reduce((sum, e) => sum + e.attendedDays, 0),
    absentDays: data.employees.reduce((sum, e) => sum + e.absentDays, 0),
  };
  const avgRate = data.employees.length > 0 
    ? Math.round(data.employees.reduce((sum, e) => sum + e.rate, 0) / data.employees.length) 
    : 0;

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; padding: 20px; font-size: 11px; }
    ${getPdfHeaderStyles()}
    ${getPdfFooterStyles()}
    .info-row { text-align: center; font-size: 11px; color: #666; margin-bottom: 15px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #ddd; padding: 8px 6px; font-size: 10px; }
    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .totals-row { background-color: #e5e7eb !important; font-weight: bold; }
  </style>
</head>
<body>
  ${getPdfHeaderHtml('تقرير جدول الدوام الأسبوعي', `الفرع: ${data.branchName}`)}
  <div class="info-row">الفترة: ${data.periodStart} - ${data.periodEnd}</div>
  
  <table>
    <thead>
      <tr>
        <th>م</th>
        <th>اسم الموظف</th>
        <th>أيام العمل</th>
        <th>أيام الإجازة</th>
        <th>أيام الحضور</th>
        <th>أيام الغياب</th>
        <th>نسبة الحضور</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="totals-row">
        <td colspan="2" style="text-align: right;">الإجمالي</td>
        <td style="text-align: center;">${totals.workDays}</td>
        <td style="text-align: center;">${totals.offDays}</td>
        <td style="text-align: center; color: green;">${totals.attendedDays}</td>
        <td style="text-align: center; color: red;">${totals.absentDays}</td>
        <td style="text-align: center;">${avgRate}%</td>
      </tr>
    </tbody>
  </table>
  
  ${getSummaryHtml('ملخص تقرير الدوام', [
    { label: 'عدد الموظفين', value: formatNumber(data.employees.length) },
    { label: 'إجمالي أيام العمل', value: formatNumber(totals.workDays) },
    { label: 'إجمالي أيام الإجازات', value: formatNumber(totals.offDays) },
    { label: 'إجمالي أيام الحضور', value: formatNumber(totals.attendedDays) },
    { label: 'إجمالي أيام الغياب', value: formatNumber(totals.absentDays) },
    { label: 'متوسط نسبة الحضور', value: avgRate + '%' },
  ])}
</body>
</html>`;

  return await generatePdfFromHtml(html, { landscape: false });
}

// Inventory Count Report PDF
export interface InventoryCountItem {
  id: number;
  name: string;
  category: string;
  status: string;
  quantity: number;
  imageUrl?: string | null;
  notes?: string | null;
}

export interface InventoryCountPdfData {
  branchName: string;
  countDate: string;
  items: InventoryCountItem[];
  statusLabels: Record<string, string>;
}

// Helper function to convert image path to base64 data URL
async function imageUrlToBase64(imageUrl: string): Promise<string | null> {
  try {
    // Handle relative paths (local files)
    if (imageUrl.startsWith('/')) {
      // Remove leading slash and resolve to project root
      const relativePath = imageUrl.slice(1);
      const filePath = path.resolve(process.cwd(), relativePath);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }
      
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString('base64');
      
      // Determine content type from extension
      const ext = path.extname(filePath).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
      };
      const contentType = contentTypes[ext] || 'image/jpeg';
      
      return `data:${contentType};base64,${base64}`;
    }
    
    // Handle full URLs (http/https)
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      return null;
    }
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${base64}`;
  } catch (err: any) {
    return null;
  }
}

export async function generateInventoryCountPdf(data: InventoryCountPdfData): Promise<Buffer> {
  const statusLabels = data.statusLabels;
  const statusColors: Record<string, string> = {
    good: '#22c55e',
    maintenance: '#eab308',
    damaged: '#ef4444',
    missing: '#6b7280',
  };

  // Pre-fetch and cache images as base64
  console.log("[PDF] Pre-fetching images for inventory count report...");
  const imageCache: Record<string, string | null> = {};
  const uniqueUrls = Array.from(new Set(data.items.filter(i => i.imageUrl).map(i => i.imageUrl!)));
  if (uniqueUrls.length > 0) {
    console.log(`[PDF] Sample image URLs: ${uniqueUrls.slice(0, 3).join(', ')}`);
  }
  
  // Fetch images in parallel (max 10 at a time to avoid overwhelming)
  let successCount = 0;
  let failCount = 0;
  for (let i = 0; i < uniqueUrls.length; i += 10) {
    const batch = uniqueUrls.slice(i, i + 10);
    const results = await Promise.all(batch.map(url => imageUrlToBase64(url)));
    batch.forEach((url, idx) => {
      imageCache[url] = results[idx];
      if (results[idx]) {
        successCount++;
      } else {
        failCount++;
      }
    });
  }
  console.log(`[PDF] Image fetch results: ${successCount} success, ${failCount} failed out of ${uniqueUrls.length} total`);

  // Group items by category
  const categoryGroups: Record<string, InventoryCountItem[]> = {};
  data.items.forEach((item) => {
    const cat = item.category || 'أخرى';
    if (!categoryGroups[cat]) categoryGroups[cat] = [];
    categoryGroups[cat].push(item);
  });

  // Generate category sections
  let categoryHtml = '';
  let globalIndex = 0;
  
  for (const [category, items] of Object.entries(categoryGroups)) {
    const itemRows = items.map((item) => {
      globalIndex++;
      const statusColor = statusColors[item.status] || '#6b7280';
      const cachedImage = item.imageUrl ? imageCache[item.imageUrl] : null;
      const imageCell = cachedImage 
        ? `<img src="${cachedImage}" alt="${item.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;" />`
        : `<span style="color: #999;">-</span>`;
      
      return `
        <tr>
          <td style="text-align: center;">${globalIndex}</td>
          <td style="text-align: center;">${imageCell}</td>
          <td style="text-align: right;">${item.name}</td>
          <td style="text-align: center;"><span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 8px;">${statusLabels[item.status] || item.status}</span></td>
          <td style="text-align: center; font-weight: bold;">${item.quantity}</td>
          <td style="text-align: center; background: #fffde7;"></td>
          <td style="text-align: center;"></td>
          <td style="text-align: center; font-size: 8px;">${item.notes || '-'}</td>
        </tr>
      `;
    }).join('');

    categoryHtml += `
      <div style="margin-top: 20px;">
        <div style="background: #d4a853; color: white; padding: 8px 12px; font-weight: bold; text-align: center; border-radius: 4px 4px 0 0;">
          ${category} (${items.length} صنف)
        </div>
        <table style="margin-top: 0;">
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th style="width: 50px;">الصورة</th>
              <th>اسم الصنف</th>
              <th style="width: 60px;">الحالة</th>
              <th style="width: 60px;">العدد بالنظام</th>
              <th style="width: 60px; background: #fffde7;">العدد الفعلي</th>
              <th style="width: 50px;">الفرق</th>
              <th style="width: 100px;">ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>
      </div>
    `;
  }

  const totalQuantity = data.items.reduce((sum, item) => sum + item.quantity, 0);
  const goodCount = data.items.filter(i => i.status === 'good').length;
  const needsFollowup = data.items.filter(i => i.status !== 'good').length;
  
  // Use English date format and numerals
  const dateObj = new Date(data.countDate);
  const formattedDateEn = `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}`;

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
    
    ${getPdfHeaderStyles()}
    ${getPdfFooterStyles()}
    
    .report-intro {
      border: 2px solid #d4a853;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 25px;
      background: linear-gradient(to bottom, #fffdf7, #fff);
    }
    
    .report-intro h2 {
      text-align: center;
      color: #d4a853;
      margin-bottom: 15px;
      font-size: 14px;
    }
    
    .report-intro p {
      line-height: 1.8;
      font-size: 11px;
      text-align: justify;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 10px;
      background: #f9fafb;
      border-radius: 4px;
      margin-bottom: 20px;
    }
    
    .info-item {
      text-align: center;
    }
    
    .info-label {
      font-weight: bold;
      color: #666;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
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
    
    .summary-box {
      margin-top: 30px;
      padding: 15px;
      background: #f3f4f6;
      border-radius: 8px;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      text-align: center;
    }
    
    .summary-item {
      padding: 10px;
      background: white;
      border-radius: 4px;
    }
    
    .summary-value {
      font-size: 18px;
      font-weight: bold;
      color: #d4a853;
    }
    
    .unlisted-items-section {
      margin-top: 20px;
      border: 2px solid #d4a853;
      border-radius: 6px;
      padding: 10px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .unlisted-items-section h3 {
      text-align: center;
      color: #d4a853;
      margin-bottom: 6px;
      font-size: 10px;
    }
    
    .unlisted-items-section p {
      font-size: 8px;
      color: #666;
      margin-bottom: 6px;
      text-align: center;
    }
    
    .unlisted-items-table {
      width: 100%;
    }
    
    .unlisted-items-table td {
      height: 20px;
      border: 1px solid #ddd;
      font-size: 8px;
      padding: 2px 4px;
    }
    
    .unlisted-items-table th {
      font-size: 8px;
      padding: 4px;
    }
    
    .committee-section {
      margin-top: 25px;
      border: 2px solid #333;
      border-radius: 6px;
      padding: 12px;
      page-break-before: always;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .committee-section h3 {
      text-align: center;
      margin-bottom: 10px;
      font-size: 11px;
      background: #333;
      color: white;
      padding: 6px;
      margin: -12px -12px 12px -12px;
      border-radius: 4px 4px 0 0;
    }
    
    .committee-table {
      width: 100%;
      margin-bottom: 8px;
    }
    
    .committee-table th {
      background: #f3f4f6;
      padding: 3px;
      font-size: 8px;
    }
    
    .committee-table td {
      padding: 3px 4px;
      height: 18px;
      vertical-align: bottom;
      font-size: 8px;
    }
    
    .signature-line-bottom {
      border-bottom: 1px solid #999;
      height: 14px;
    }
    
    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>
  ${getPdfHeaderHtml('محضر جرد الأصول والمعدات', 'Asset Inventory Count Report')}
  
  <!-- نص المحضر الرسمي -->
  <div class="report-intro">
    <h2>محضر جرد الأصول والمعدات</h2>
    <p>
      نحن الموقعين أدناه، أعضاء لجنة الجرد المكلفة من إدارة <strong>BUTTER BAKERY</strong>، قمنا بتاريخ <strong>${formattedDateEn}</strong> 
      بإجراء جرد شامل لجميع الأصول والمعدات الموجودة في فرع <strong>${data.branchName}</strong>.
      وقد تم حصر عدد <strong>${data.items.length}</strong> صنفاً بإجمالي كمية <strong>${totalQuantity}</strong> وحدة.
      وفيما يلي تفصيل الأصناف المجرودة حسب التصنيف، مع بيان حالة كل صنف والعدد الفعلي المتوفر.
    </p>
  </div>
  
  <div class="info-row">
    <div class="info-item">
      <div class="info-label">الفرع</div>
      <div>${data.branchName}</div>
    </div>
    <div class="info-item">
      <div class="info-label">تاريخ الجرد</div>
      <div>${formattedDateEn}</div>
    </div>
    <div class="info-item">
      <div class="info-label">إجمالي الأصناف</div>
      <div>${data.items.length}</div>
    </div>
    <div class="info-item">
      <div class="info-label">إجمالي الكميات</div>
      <div>${totalQuantity}</div>
    </div>
  </div>
  
  ${categoryHtml}
  
  <div class="summary-box">
    <h3 style="margin-bottom: 15px; text-align: center;">ملخص الجرد</h3>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-value">${data.items.length}</div>
        <div>إجمالي الأصناف</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${totalQuantity}</div>
        <div>إجمالي الكميات</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #22c55e;">${goodCount}</div>
        <div>بحالة جيدة</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #eab308;">${needsFollowup}</div>
        <div>تحتاج متابعة</div>
      </div>
    </div>
  </div>
  
  <!-- مربع الأصناف غير المذكورة -->
  <div class="unlisted-items-section">
    <h3>أصناف غير مذكورة في النظام تم إيجادها بالفرع</h3>
    <p>في حالة وجود أصناف لم تذكر في قائمة الجرد أعلاه وتم إيجادها أو إرسالها للفرع، يرجى تسجيلها هنا:</p>
    <table class="unlisted-items-table">
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>اسم الصنف</th>
          <th style="width: 80px;">التصنيف</th>
          <th style="width: 60px;">العدد</th>
          <th style="width: 60px;">الحالة</th>
          <th>ملاحظات</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>1</td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td>2</td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td>3</td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td>4</td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td>5</td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td>6</td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td>7</td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td>8</td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td>9</td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td>10</td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td>11</td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td>12</td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td>13</td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td>14</td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td>15</td><td></td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
  </div>
  
  <!-- قسم لجنة الجرد والتوقيعات -->
  <div class="committee-section">
    <h3>أعضاء لجنة الجرد والتوقيعات</h3>
    <table class="committee-table">
      <thead>
        <tr>
          <th style="width: 30px;">م</th>
          <th>المسمى الوظيفي</th>
          <th>الاسم (بخط اليد)</th>
          <th style="width: 120px;">التوقيع</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="text-align: center;">1</td>
          <td>رئيس لجنة الجرد</td>
          <td><div class="signature-line-bottom"></div></td>
          <td><div class="signature-line-bottom"></div></td>
        </tr>
        <tr>
          <td style="text-align: center;">2</td>
          <td>عضو اللجنة</td>
          <td><div class="signature-line-bottom"></div></td>
          <td><div class="signature-line-bottom"></div></td>
        </tr>
        <tr>
          <td style="text-align: center;">3</td>
          <td>عضو اللجنة</td>
          <td><div class="signature-line-bottom"></div></td>
          <td><div class="signature-line-bottom"></div></td>
        </tr>
        <tr>
          <td style="text-align: center;">4</td>
          <td>مدير الفرع</td>
          <td><div class="signature-line-bottom"></div></td>
          <td><div class="signature-line-bottom"></div></td>
        </tr>
        <tr>
          <td style="text-align: center;">5</td>
          <td>المراجع / المدقق</td>
          <td><div class="signature-line-bottom"></div></td>
          <td><div class="signature-line-bottom"></div></td>
        </tr>
      </tbody>
    </table>
    <p style="text-align: center; font-size: 9px; color: #666; margin-top: 15px;">
      نقر نحن الموقعين أعلاه بصحة البيانات الواردة في هذا المحضر وأن الجرد تم بشكل دقيق وشامل.
    </p>
    <p style="text-align: center; font-size: 10px; color: #c00; font-weight: bold; margin-top: 10px; padding: 8px; background: #fff5f5; border: 1px solid #c00; border-radius: 4px;">
      ⚠️ يُشترط توقيع جميع أعضاء اللجنة على كافة صفحات هذا المحضر، كلٌّ حسب صفته الوظيفية
    </p>
    
    <!-- إقرار استخدام الأدوات والمعدات -->
    <div style="margin-top: 10px; padding: 8px; background: linear-gradient(135deg, #fff8e1 0%, #fffde7 100%); border: 1px solid #d4a853; border-radius: 4px;">
      <p style="text-align: center; font-weight: bold; font-size: 8px; color: #8b6914; margin-bottom: 5px; border-bottom: 1px solid #d4a853; padding-bottom: 3px;">
        ⚠️ إقرار الاطلاع والمسؤولية | Acknowledgment & Responsibility Statement ⚠️
      </p>
      <p style="font-size: 7px; text-align: justify; line-height: 1.4; color: #333; margin-bottom: 4px;">
        <strong>باللغة العربية:</strong> يُشترط على جميع الموظفين المستخدمين للأدوات والمعدات (أدوات المطبخ، أدوات الباريستا، أدوات البيتزا، أدوات الكاشير، وكل ما هو مستخدم وملموس ويتم التعامل به بشكل يومي) التوقيع على هذا الإقرار. يلتزم الموظف بالاستخدام الصحيح والمحافظة على هذه الأدوات والمعدات. في حالة تبيُّن سوء استخدام أو إهمال أو ضياع أو فقدان لأي من هذه الأدوات، يتم محاسبة المتسبب مادياً وإدارياً، ويتحمل المسؤولية الكاملة عن التلف أو الفقدان.
      </p>
      <p style="font-size: 6px; text-align: justify; line-height: 1.3; color: #555; direction: ltr; margin-bottom: 5px;">
        <strong>In English:</strong> All employees using equipment and tools (kitchen tools, barista tools, pizza tools, cashier tools, and all tangible items used daily) are required to sign this acknowledgment. The employee commits to proper use and maintenance of these tools and equipment. In case of misuse, negligence, loss, or damage to any of these tools, the responsible person will be held financially and administratively accountable and bears full responsibility for damage or loss.
      </p>
      
      <!-- جدول توقيعات الموظفين على الإقرار -->
      <p style="text-align: center; font-size: 7px; font-weight: bold; color: #8b6914; margin-bottom: 3px;">توقيعات الموظفين المعنيين | Employee Signatures</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 7px; border: 1px solid #d4a853;">
        <thead>
          <tr style="background: #d4a853; color: white;">
            <th style="padding: 2px; width: 20px; border: 1px solid #c49b48;">م</th>
            <th style="padding: 2px; border: 1px solid #c49b48;">اسم الموظف</th>
            <th style="padding: 2px; width: 60px; border: 1px solid #c49b48;">القسم</th>
            <th style="padding: 2px; width: 60px; border: 1px solid #c49b48;">التوقيع</th>
            <th style="padding: 2px; width: 50px; border: 1px solid #c49b48;">التاريخ</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="text-align: center; border: 1px solid #d4a853; height: 16px;">1</td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td></tr>
          <tr><td style="text-align: center; border: 1px solid #d4a853; height: 16px;">2</td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td></tr>
          <tr><td style="text-align: center; border: 1px solid #d4a853; height: 16px;">3</td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td></tr>
          <tr><td style="text-align: center; border: 1px solid #d4a853; height: 16px;">4</td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td></tr>
          <tr><td style="text-align: center; border: 1px solid #d4a853; height: 16px;">5</td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td></tr>
          <tr><td style="text-align: center; border: 1px solid #d4a853; height: 16px;">6</td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td></tr>
          <tr><td style="text-align: center; border: 1px solid #d4a853; height: 16px;">7</td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td></tr>
          <tr><td style="text-align: center; border: 1px solid #d4a853; height: 16px;">8</td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td></tr>
          <tr><td style="text-align: center; border: 1px solid #d4a853; height: 16px;">9</td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td></tr>
          <tr><td style="text-align: center; border: 1px solid #d4a853; height: 16px;">10</td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td><td style="border: 1px solid #d4a853;"></td></tr>
        </tbody>
      </table>
    </div>
    
    <!-- قسم التسليم والتسلم - مدمج مع جدول التوقيعات -->
    <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #999;">
      <p style="text-align: center; font-size: 10px; font-weight: bold; margin-bottom: 10px; color: #333;">
        في حالة التسليم والتسلم يُشترط التوقيع من الطرفين:
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
        <tr>
          <td style="width: 50%; padding: 5px; vertical-align: top;">
            <div style="border: 1px solid #ddd; border-radius: 4px; padding: 8px; background: #fafafa;">
              <p style="font-weight: bold; margin-bottom: 6px; text-align: center;">المُسَلِّم (الطرف الأول)</p>
              <p style="margin: 4px 0;">الاسم: <span style="border-bottom: 1px solid #999; display: inline-block; width: 120px;"></span></p>
              <p style="margin: 4px 0;">التوقيع: <span style="border-bottom: 1px solid #999; display: inline-block; width: 120px;"></span></p>
            </div>
          </td>
          <td style="width: 50%; padding: 5px; vertical-align: top;">
            <div style="border: 1px solid #ddd; border-radius: 4px; padding: 8px; background: #fafafa;">
              <p style="font-weight: bold; margin-bottom: 6px; text-align: center;">المُسْتَلِم (الطرف الثاني)</p>
              <p style="margin: 4px 0;">الاسم: <span style="border-bottom: 1px solid #999; display: inline-block; width: 120px;"></span></p>
              <p style="margin: 4px 0;">التوقيع: <span style="border-bottom: 1px solid #999; display: inline-block; width: 120px;"></span></p>
            </div>
          </td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>`;

  return await generatePdfFromHtml(html, { landscape: true });
}

interface PdfOptions {
  landscape?: boolean;
  printedBy?: string;
}

export async function generatePdfFromHtml(html: string, options: PdfOptions = {}): Promise<Buffer> {
  const { landscape = false, printedBy = 'النظام' } = options;
  const printedAt = formatPrintDate();
  
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
      margin: { top: '15mm', right: '10mm', bottom: '25mm', left: '10mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width: 100%; font-size: 9px; font-family: 'Cairo', Arial, sans-serif; padding: 0 20px; display: flex; justify-content: space-between; align-items: center; direction: rtl;">
          <span style="flex: 1; text-align: right;">طُبع بواسطة: ${printedBy}</span>
          <span style="flex: 1; text-align: center;">صفحة <span class="pageNumber"></span> من <span class="totalPages"></span></span>
          <span style="flex: 1; text-align: left;">${printedAt}</span>
        </div>
      `
    });

    console.log("[PDF] PDF generated successfully, size:", pdfBuffer.length);
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
    console.log("[PDF] Browser closed");
  }
}

// ==================== Today's Attendance Report PDF ====================

export interface TodayAttendanceEmployee {
  employeeName: string;
  scheduledTime: string;
  actualCheckIn: string;
  actualCheckOut: string;
  hasSigned: boolean;
  status: string;
}

export interface TodayAttendancePdfData {
  branchName: string;
  date: string;
  dateArabic: string;
  summary: {
    present: number;
    absent: number;
    off: number;
    total: number;
    attendanceRate: number;
  };
  employees: TodayAttendanceEmployee[];
}

// Employee Attendance Report with Signatures - تقرير حضور الموظف مع التوقيع
export interface EmployeeAttendanceReportRecord {
  date: string;
  dayName: string;
  scheduledTime: string;
  actualCheckIn: string;
  actualCheckOut: string;
  workHours: string;
  status: string;
  checkInSignature?: string | null;
  checkOutSignature?: string | null;
}

export interface EmployeeAttendanceLeaveDay {
  date: string;
  dayName: string;
  notes?: string;
}

export interface EmployeeAttendanceReportPdfData {
  employeeName: string;
  branchName: string;
  periodStart: string;
  periodEnd: string;
  summary: {
    totalDays: number;
    completeDays: number;
    signedDays: number;
    totalWorkHours: string;
    leaveDays?: number;
  };
  records: EmployeeAttendanceReportRecord[];
  leaveDays?: EmployeeAttendanceLeaveDay[];
}

export async function generateEmployeeAttendanceReportPdf(data: EmployeeAttendanceReportPdfData): Promise<Buffer> {
  const statusColors: Record<string, { bg: string; text: string }> = {
    'مكتمل': { bg: '#dcfce7', text: '#166534' },
    'حاضر': { bg: '#fef3c7', text: '#92400e' },
    'غائب': { bg: '#fee2e2', text: '#991b1b' }
  };

  const recordRows = data.records.map((record, index) => {
    const colors = statusColors[record.status] || statusColors['غائب'];
    
    // Signature display - show actual signature image if available
    let checkInSigHtml = '-';
    let checkOutSigHtml = '-';
    
    if (record.checkInSignature && record.checkInSignature.startsWith('data:image')) {
      checkInSigHtml = `<img src="${record.checkInSignature}" style="max-width: 60px; max-height: 30px; border: 1px solid #e5e7eb; border-radius: 4px;" />`;
    } else if (record.checkInSignature) {
      checkInSigHtml = '<span style="color: #166534;">✓</span>';
    }
    
    if (record.checkOutSignature && record.checkOutSignature.startsWith('data:image')) {
      checkOutSigHtml = `<img src="${record.checkOutSignature}" style="max-width: 60px; max-height: 30px; border: 1px solid #e5e7eb; border-radius: 4px;" />`;
    } else if (record.checkOutSignature) {
      checkOutSigHtml = '<span style="color: #166534;">✓</span>';
    }

    return `
      <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
        <td style="text-align: center; padding: 8px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
        <td style="text-align: center; padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${record.date}</td>
        <td style="text-align: center; padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px;">${record.dayName}</td>
        <td style="text-align: center; padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px;">${record.scheduledTime}</td>
        <td style="text-align: center; padding: 8px; border-bottom: 1px solid #e5e7eb; color: #166534; font-weight: 500;">${record.actualCheckIn}</td>
        <td style="text-align: center; padding: 8px; border-bottom: 1px solid #e5e7eb; color: #2563eb; font-weight: 500;">${record.actualCheckOut}</td>
        <td style="text-align: center; padding: 8px; border-bottom: 1px solid #e5e7eb;">${record.workHours}</td>
        <td style="text-align: center; padding: 8px; border-bottom: 1px solid #e5e7eb;">
          <span style="background: ${colors.bg}; color: ${colors.text}; padding: 3px 12px; border-radius: 4px; font-size: 10px; font-weight: 600;">${record.status}</span>
        </td>
        <td style="text-align: center; padding: 8px; border-bottom: 1px solid #e5e7eb;">${checkInSigHtml}</td>
        <td style="text-align: center; padding: 8px; border-bottom: 1px solid #e5e7eb;">${checkOutSigHtml}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Cairo', Arial, sans-serif;
          direction: rtl;
          padding: 20px;
          color: #1f2937;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #0d9488;
        }
        .header h1 {
          font-size: 22px;
          color: #0d9488;
          margin-bottom: 10px;
        }
        .header .subtitle {
          font-size: 14px;
          color: #6b7280;
        }
        .employee-info {
          background: #f0fdfa;
          border: 1px solid #99f6e4;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .employee-name {
          font-size: 18px;
          font-weight: 700;
          color: #0f766e;
        }
        .period {
          font-size: 12px;
          color: #6b7280;
        }
        .summary {
          display: flex;
          justify-content: space-around;
          margin-bottom: 20px;
          gap: 15px;
        }
        .summary-item {
          flex: 1;
          text-align: center;
          padding: 15px;
          background: #f9fafb;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }
        .summary-value {
          font-size: 24px;
          font-weight: 700;
          color: #0d9488;
        }
        .summary-label {
          font-size: 11px;
          color: #6b7280;
          margin-top: 5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        th {
          background: #0d9488;
          color: white;
          padding: 10px 6px;
          text-align: center;
          font-weight: 600;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 10px;
          color: #9ca3af;
          padding-top: 15px;
          border-top: 1px solid #e5e7eb;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>تقرير حضور الموظف التفصيلي</h1>
        <div class="subtitle">شركة الزبد الأفضل التجارية - ${data.branchName}</div>
      </div>

      <div class="employee-info">
        <div>
          <div class="employee-name">${data.employeeName}</div>
          <div class="period">الفترة: ${data.periodStart} إلى ${data.periodEnd}</div>
        </div>
        <div style="background: #ccfbf1; color: #0f766e; padding: 8px 16px; border-radius: 8px; font-weight: 600;">
          ${data.records.length} سجل
        </div>
      </div>

      <div class="summary">
        <div class="summary-item">
          <div class="summary-value">${data.summary.totalDays}</div>
          <div class="summary-label">إجمالي الأيام</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${data.summary.completeDays}</div>
          <div class="summary-label">أيام مكتملة</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${data.summary.totalWorkHours}</div>
          <div class="summary-label">ساعات العمل</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${data.summary.signedDays}</div>
          <div class="summary-label">أيام موقعة</div>
        </div>
        ${(data.summary.leaveDays !== undefined && data.summary.leaveDays > 0) ? `
        <div class="summary-item" style="background: #fef3c7; border-color: #fcd34d;">
          <div class="summary-value" style="color: #92400e;">${data.summary.leaveDays}</div>
          <div class="summary-label">أيام إجازة</div>
        </div>
        ` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th>التاريخ</th>
            <th>اليوم</th>
            <th>الدوام المحدد</th>
            <th>الحضور</th>
            <th>الانصراف</th>
            <th>ساعات العمل</th>
            <th>الحالة</th>
            <th>توقيع الحضور</th>
            <th>توقيع الانصراف</th>
          </tr>
        </thead>
        <tbody>
          ${recordRows}
        </tbody>
      </table>

      ${(data.leaveDays && data.leaveDays.length > 0) ? `
        <div style="margin-top: 25px;">
          <div style="display: flex; align-items: center; justify-content: space-between; background: #fef3c7; border-right: 4px solid #f59e0b; padding: 10px 15px; border-radius: 6px; margin-bottom: 10px;">
            <div style="font-size: 14px; font-weight: 700; color: #92400e;">
              أيام الإجازة خلال الفترة
            </div>
            <div style="background: #f59e0b; color: white; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 600;">
              ${data.leaveDays.length} يوم
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px; background: #f59e0b;">#</th>
                <th style="background: #f59e0b;">التاريخ</th>
                <th style="background: #f59e0b;">اليوم</th>
                <th style="background: #f59e0b;">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${data.leaveDays.map((leave, index) => {
                const escapeHtml = (s: string) => String(s)
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#39;');
                return `
                <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#fffbeb'};">
                  <td style="text-align: center; padding: 8px; border-bottom: 1px solid #fde68a;">${index + 1}</td>
                  <td style="text-align: center; padding: 8px; border-bottom: 1px solid #fde68a; font-weight: 500;">${escapeHtml(leave.date)}</td>
                  <td style="text-align: center; padding: 8px; border-bottom: 1px solid #fde68a;">${escapeHtml(leave.dayName)}</td>
                  <td style="text-align: center; padding: 8px; border-bottom: 1px solid #fde68a; color: #6b7280; font-size: 11px;">${leave.notes ? escapeHtml(leave.notes) : '-'}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <div class="footer">
        تم إنشاء هذا التقرير بتاريخ ${formatPrintDate()} - نظام باتر لإدارة الموارد البشرية
      </div>
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "15mm", right: "10mm", bottom: "15mm", left: "10mm" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

export async function generateTodayAttendancePdf(data: TodayAttendancePdfData): Promise<Buffer> {
  const statusColors: Record<string, { bg: string; text: string }> = {
    'حاضر': { bg: '#dcfce7', text: '#166534' },
    'غائب': { bg: '#fee2e2', text: '#991b1b' },
    'إجازة': { bg: '#f3f4f6', text: '#4b5563' }
  };

  const employeeRows = data.employees.map((emp, index) => {
    const colors = statusColors[emp.status] || statusColors['إجازة'];
    const signedBadge = emp.hasSigned 
      ? '<span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 9px;">✓ موقّع</span>'
      : emp.status === 'حاضر'
        ? '<span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 9px;">بدون توقيع</span>'
        : '-';

    return `
      <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
        <td style="text-align: center; padding: 8px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
        <td style="text-align: right; padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${emp.employeeName}</td>
        <td style="text-align: center; padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px;">${emp.scheduledTime}</td>
        <td style="text-align: center; padding: 8px; border-bottom: 1px solid #e5e7eb; color: ${emp.actualCheckIn !== '-' ? '#166534' : '#991b1b'}; font-weight: 500;">${emp.actualCheckIn}</td>
        <td style="text-align: center; padding: 8px; border-bottom: 1px solid #e5e7eb; color: #2563eb;">${emp.actualCheckOut}</td>
        <td style="text-align: center; padding: 8px; border-bottom: 1px solid #e5e7eb;">${signedBadge}</td>
        <td style="text-align: center; padding: 8px; border-bottom: 1px solid #e5e7eb;">
          <span style="background: ${colors.bg}; color: ${colors.text}; padding: 3px 12px; border-radius: 4px; font-size: 10px; font-weight: 600;">${emp.status}</span>
        </td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Cairo', Arial, sans-serif;
          direction: rtl;
          padding: 20px;
          background: #fff;
          font-size: 12px;
        }
        .header {
          text-align: center;
          margin-bottom: 25px;
          padding-bottom: 15px;
          border-bottom: 3px solid #d4a853;
        }
        .company-name {
          font-size: 18px;
          font-weight: 700;
          color: #1e3a5f;
          margin-bottom: 5px;
        }
        .report-title {
          font-size: 16px;
          font-weight: 600;
          color: #d4a853;
          margin-bottom: 5px;
        }
        .report-info {
          font-size: 12px;
          color: #666;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 25px;
        }
        .summary-card {
          padding: 15px;
          border-radius: 8px;
          text-align: center;
        }
        .summary-card.present { background: #dcfce7; }
        .summary-card.absent { background: #fee2e2; }
        .summary-card.off { background: #f3f4f6; }
        .summary-card.rate { background: #dbeafe; }
        .summary-value {
          font-size: 28px;
          font-weight: 700;
        }
        .summary-card.present .summary-value { color: #166534; }
        .summary-card.absent .summary-value { color: #991b1b; }
        .summary-card.off .summary-value { color: #4b5563; }
        .summary-card.rate .summary-value { color: #1d4ed8; }
        .summary-label {
          font-size: 11px;
          margin-top: 4px;
        }
        .summary-card.present .summary-label { color: #166534; }
        .summary-card.absent .summary-label { color: #991b1b; }
        .summary-card.off .summary-label { color: #4b5563; }
        .summary-card.rate .summary-label { color: #1d4ed8; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        thead {
          background: #1e3a5f;
          color: white;
        }
        th {
          padding: 10px 8px;
          text-align: center;
          font-size: 11px;
          font-weight: 600;
        }
        th:nth-child(2) {
          text-align: right;
        }
        .footer-note {
          margin-top: 20px;
          padding: 10px;
          background: #fffbeb;
          border: 1px solid #fbbf24;
          border-radius: 6px;
          font-size: 10px;
          color: #92400e;
          text-align: center;
        }
        .signature-section {
          display: flex;
          justify-content: space-between;
          margin-top: 40px;
          padding-top: 20px;
        }
        .signature-box {
          text-align: center;
          width: 200px;
        }
        .signature-line {
          border-top: 1px solid #333;
          margin-top: 40px;
          padding-top: 5px;
          font-size: 11px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">شركة الزبد الأفضل التجارية</div>
        <div class="report-title">تقرير الحضور اليومي</div>
        <div class="report-info">
          الفرع: <strong>${data.branchName}</strong> | التاريخ: <strong>${data.dateArabic}</strong>
        </div>
      </div>

      <div class="summary-grid">
        <div class="summary-card present">
          <div class="summary-value">${data.summary.present}</div>
          <div class="summary-label">حاضر</div>
        </div>
        <div class="summary-card absent">
          <div class="summary-value">${data.summary.absent}</div>
          <div class="summary-label">غائب</div>
        </div>
        <div class="summary-card off">
          <div class="summary-value">${data.summary.off}</div>
          <div class="summary-label">إجازة</div>
        </div>
        <div class="summary-card rate">
          <div class="summary-value">${data.summary.attendanceRate}%</div>
          <div class="summary-label">نسبة الحضور</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 35px;">#</th>
            <th>اسم الموظف</th>
            <th style="width: 100px;">الوردية</th>
            <th style="width: 80px;">وقت الحضور</th>
            <th style="width: 80px;">وقت الانصراف</th>
            <th style="width: 80px;">التوقيع</th>
            <th style="width: 70px;">الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${employeeRows}
        </tbody>
      </table>

      <div class="footer-note">
        إجمالي الموظفين: ${data.summary.total} | المُجدولين للعمل: ${data.summary.present + data.summary.absent} | في إجازة: ${data.summary.off}
      </div>

      <div class="signature-section">
        <div class="signature-box">
          <div class="signature-line">مدير الفرع</div>
        </div>
        <div class="signature-box">
          <div class="signature-line">مسؤول الموارد البشرية</div>
        </div>
      </div>
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '10mm', bottom: '15mm', left: '10mm' }
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

export interface AttendanceLogPdfData {
  branchName: string;
  periodStart: string;
  periodEnd: string;
  employees: Array<{
    employeeName: string;
    jobTitle: string;
    days: Array<{
      day: string;
      date: string;
      checkIn: string;
      checkOut: string;
      status: string;
    }>;
    presentCount: number;
    absentCount: number;
  }>;
}

export async function generateAttendanceLogPdf(data: AttendanceLogPdfData): Promise<Buffer> {
  const statusColors: Record<string, { bg: string; text: string }> = {
    'حاضر': { bg: '#dcfce7', text: '#166534' },
    'متأخر': { bg: '#fef3c7', text: '#92400e' },
    'غائب': { bg: '#fee2e2', text: '#991b1b' },
    'إجازة': { bg: '#dbeafe', text: '#1e40af' },
    'مجدول': { bg: '#f3f4f6', text: '#6b7280' },
  };

  const totalPresent = data.employees.reduce((s, e) => s + e.presentCount, 0);
  const totalAbsent = data.employees.reduce((s, e) => s + e.absentCount, 0);
  const totalScheduled = totalPresent + totalAbsent;
  const attendanceRate = totalScheduled > 0 ? Math.round((totalPresent / totalScheduled) * 100) : 0;

  const employeeSections = data.employees.map((emp, empIdx) => {
    const dayRows = emp.days.map((d, i) => {
      const colors = statusColors[d.status] || statusColors['مجدول'];
      return `<tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
        <td style="text-align: center; padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${d.day}</td>
        <td style="text-align: center; padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${d.date}</td>
        <td style="text-align: center; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; color: ${d.checkIn !== '-' ? '#166534' : '#9ca3af'}; font-weight: 500;">${d.checkIn}</td>
        <td style="text-align: center; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; color: ${d.checkOut !== '-' ? '#2563eb' : '#9ca3af'};">${d.checkOut}</td>
        <td style="text-align: center; padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">
          <span style="background: ${colors.bg}; color: ${colors.text}; padding: 2px 10px; border-radius: 4px; font-size: 10px; font-weight: 600;">${d.status}</span>
        </td>
      </tr>`;
    }).join('');

    return `
      <div style="margin-bottom: 20px; page-break-inside: avoid;">
        <div style="background: ${empIdx % 2 === 0 ? '#f0f9ff' : '#fefce8'}; padding: 10px 15px; border-radius: 8px 8px 0 0; border: 1px solid #e5e7eb; border-bottom: none; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-weight: 700; font-size: 13px; color: #1e3a5f;">${emp.employeeName}</span>
            <span style="margin-right: 10px; font-size: 11px; color: #6b7280;">${emp.jobTitle}</span>
          </div>
          <div style="display: flex; gap: 10px;">
            <span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 10px;">حضور: ${emp.presentCount}</span>
            <span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 10px;">غياب: ${emp.absentCount}</span>
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; overflow: hidden;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 8px; text-align: center; font-size: 11px; font-weight: 600; color: #475569; border-bottom: 2px solid #d4a853;">اليوم</th>
              <th style="padding: 8px; text-align: center; font-size: 11px; font-weight: 600; color: #475569; border-bottom: 2px solid #d4a853;">التاريخ</th>
              <th style="padding: 8px; text-align: center; font-size: 11px; font-weight: 600; color: #475569; border-bottom: 2px solid #d4a853;">وقت الحضور</th>
              <th style="padding: 8px; text-align: center; font-size: 11px; font-weight: 600; color: #475569; border-bottom: 2px solid #d4a853;">وقت الانصراف</th>
              <th style="padding: 8px; text-align: center; font-size: 11px; font-weight: 600; color: #475569; border-bottom: 2px solid #d4a853;">الحالة</th>
            </tr>
          </thead>
          <tbody>${dayRows}</tbody>
        </table>
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 20px; background: #fff; font-size: 12px; }
      </style>
    </head>
    <body>
      <div style="text-align: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid #d4a853;">
        <div style="font-size: 18px; font-weight: 700; color: #1e3a5f; margin-bottom: 5px;">شركة الزبد الأفضل التجارية</div>
        <div style="font-size: 16px; font-weight: 600; color: #d4a853; margin-bottom: 5px;">سجل الحضور والانصراف</div>
        <div style="font-size: 12px; color: #666;">الفرع: ${data.branchName} | الفترة: ${data.periodStart} إلى ${data.periodEnd}</div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 25px;">
        <div style="background: #f0fdf4; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: #166534;">${totalPresent}</div>
          <div style="font-size: 11px; color: #166534;">أيام الحضور</div>
        </div>
        <div style="background: #fef2f2; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: #991b1b;">${totalAbsent}</div>
          <div style="font-size: 11px; color: #991b1b;">أيام الغياب</div>
        </div>
        <div style="background: #eff6ff; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: #1d4ed8;">${data.employees.length}</div>
          <div style="font-size: 11px; color: #1d4ed8;">عدد الموظفين</div>
        </div>
        <div style="background: #fefce8; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: #a16207;">${attendanceRate}%</div>
          <div style="font-size: 11px; color: #a16207;">نسبة الحضور</div>
        </div>
      </div>
      ${employeeSections}
      <div style="display: flex; justify-content: space-around; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <div style="text-align: center; width: 200px;">
          <div style="border-bottom: 1px solid #333; margin-bottom: 5px; padding-bottom: 30px;"></div>
          <div style="font-size: 11px; color: #666;">مدير الفرع</div>
        </div>
        <div style="text-align: center; width: 200px;">
          <div style="border-bottom: 1px solid #333; margin-bottom: 5px; padding-bottom: 30px;"></div>
          <div style="font-size: 11px; color: #666;">مسؤول الموارد البشرية</div>
        </div>
      </div>
    </body>
    </html>`;

  return await generatePdfFromHtml(html, { landscape: false });
}

// ==================== Branch-Wide Timesheet PDF (Multi-page) ====================

export interface BranchTimesheetEntry {
  date: string;
  dayName: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualCheckIn: string;
  actualCheckOut: string;
  workHours: string;
  status: string;
  isOff: boolean;
  checkInSignature?: string | null;
}

export interface BranchTimesheetEmployeeReport {
  employeeName: string;
  jobTitle: string;
  employeeNumber?: string;
  scheduledDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  offDays: number;
  totalScheduledHours: number;
  totalActualHours: number;
  totalLateMinutes: number;
  totalOvertimeMinutes: number;
  entries: BranchTimesheetEntry[];
}

export interface BranchTimesheetPdfData {
  branchName: string;
  periodStart: string;
  periodEnd: string;
  monthLabel: string;
  employees: BranchTimesheetEmployeeReport[];
}

export async function generateBranchTimesheetPdf(data: BranchTimesheetPdfData): Promise<Buffer> {
  const escapeHtml = (s: string | null | undefined) => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const statusColors: Record<string, { bg: string; text: string }> = {
    'حاضر': { bg: '#dcfce7', text: '#166534' },
    'متأخر': { bg: '#fef3c7', text: '#92400e' },
    'غائب': { bg: '#fee2e2', text: '#991b1b' },
    'إجازة': { bg: '#dbeafe', text: '#1e40af' },
    'معلق': { bg: '#f3f4f6', text: '#374151' },
  };

  const renderEntries = (entries: BranchTimesheetEntry[]) => entries.map((e, i) => {
    const colors = statusColors[e.status] || statusColors['معلق'];
    let sigHtml = '<span style="color:#9ca3af;">-</span>';
    if (e.checkInSignature && e.checkInSignature.startsWith('data:image')) {
      sigHtml = `<img src="${e.checkInSignature}" style="max-width:55px;max-height:25px;" />`;
    }
    return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};">
        <td style="text-align:center;padding:5px;border:1px solid #e5e7eb;">${i + 1}</td>
        <td style="text-align:center;padding:5px;border:1px solid #e5e7eb;font-weight:500;">${escapeHtml(e.date)}</td>
        <td style="text-align:center;padding:5px;border:1px solid #e5e7eb;">${escapeHtml(e.dayName)}</td>
        <td style="text-align:center;padding:5px;border:1px solid #e5e7eb;">${escapeHtml(e.scheduledStart)}</td>
        <td style="text-align:center;padding:5px;border:1px solid #e5e7eb;">${escapeHtml(e.scheduledEnd)}</td>
        <td style="text-align:center;padding:5px;border:1px solid #e5e7eb;color:#166534;font-weight:500;">${escapeHtml(e.actualCheckIn)}</td>
        <td style="text-align:center;padding:5px;border:1px solid #e5e7eb;color:#2563eb;font-weight:500;">${escapeHtml(e.actualCheckOut)}</td>
        <td style="text-align:center;padding:5px;border:1px solid #e5e7eb;">${escapeHtml(e.workHours)}</td>
        <td style="text-align:center;padding:5px;border:1px solid #e5e7eb;">
          <span style="background:${colors.bg};color:${colors.text};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">${escapeHtml(e.status)}</span>
        </td>
        <td style="text-align:center;padding:5px;border:1px solid #e5e7eb;">${sigHtml}</td>
      </tr>`;
  }).join('');

  const employeePages = data.employees.map((emp, idx) => `
    <div class="employee-page">
      <div class="page-header">
        <div class="brand">BUTTER BAKERY</div>
        <h1>تقرير التايم شيت الشهري</h1>
        <div class="period">${escapeHtml(data.branchName)} — ${escapeHtml(data.monthLabel)} (${escapeHtml(data.periodStart)} → ${escapeHtml(data.periodEnd)})</div>
      </div>
      <div class="employee-info">
        <div>
          <div class="employee-name">${escapeHtml(emp.employeeName)}</div>
          <div class="employee-meta">${escapeHtml(emp.jobTitle || '-')}${emp.employeeNumber ? ' • ' + escapeHtml(emp.employeeNumber) : ''}</div>
        </div>
        <div class="employee-counter">موظف ${idx + 1} من ${data.employees.length}</div>
      </div>
      <div class="summary">
        <div class="summary-item"><div class="summary-value">${emp.scheduledDays}</div><div class="summary-label">أيام العمل</div></div>
        <div class="summary-item ok"><div class="summary-value">${emp.presentDays}</div><div class="summary-label">الحضور</div></div>
        <div class="summary-item bad"><div class="summary-value">${emp.absentDays}</div><div class="summary-label">الغياب</div></div>
        <div class="summary-item warn"><div class="summary-value">${emp.lateDays}</div><div class="summary-label">التأخير</div></div>
        <div class="summary-item off"><div class="summary-value">${emp.offDays}</div><div class="summary-label">الإجازات</div></div>
        <div class="summary-item info"><div class="summary-value">${emp.totalActualHours.toFixed(1)}</div><div class="summary-label">ساعات العمل</div></div>
      </div>
      <table class="entries-table">
        <thead>
          <tr>
            <th style="width:24px;">#</th>
            <th>التاريخ</th>
            <th>اليوم</th>
            <th>بداية الدوام</th>
            <th>نهاية الدوام</th>
            <th>الحضور</th>
            <th>الانصراف</th>
            <th>الساعات</th>
            <th>الحالة</th>
            <th>توقيع الموظف</th>
          </tr>
        </thead>
        <tbody>${renderEntries(emp.entries)}</tbody>
      </table>
      <div class="signatures">
        <div class="sig-box">
          <div class="sig-title">إقرار الموظف</div>
          <div class="sig-text">أقر بصحة بيانات الحضور والانصراف</div>
          <div class="sig-line"></div>
          <div class="sig-label">التوقيع / التاريخ</div>
        </div>
        <div class="sig-box">
          <div class="sig-title">اعتماد المدير المباشر</div>
          <div class="sig-text">أصادق على صحة بيانات الحضور والانصراف</div>
          <div class="sig-line"></div>
          <div class="sig-label">التوقيع / التاريخ</div>
        </div>
      </div>
    </div>
  `).join('');

  const html = `<!DOCTYPE html>
  <html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @page { size: A4 landscape; margin: 6mm 8mm; }
      html, body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; color: #1f2937; }
      body { font-size: 10px; }

      /* Each employee = exactly one page. Force a page break BEFORE every employee
         except the first, and prevent any internal element from splitting. */
      .employee-page {
        page-break-after: always;
        break-after: page;
        page-break-inside: avoid;
        break-inside: avoid;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      .employee-page:last-child { page-break-after: auto; break-after: auto; }

      .page-header { text-align: center; margin-bottom: 6px; padding-bottom: 5px; border-bottom: 2px solid #D4AF37; }
      .page-header .brand { font-size: 14px; font-weight: 700; color: #D4AF37; letter-spacing: 2px; }
      .page-header h1 { font-size: 12px; color: #1a1a1a; margin: 2px 0; }
      .page-header .period { font-size: 9px; color: #6b7280; }

      .employee-info { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 5px 10px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; }
      .employee-name { font-size: 13px; font-weight: 700; color: #92400e; }
      .employee-meta { font-size: 9px; color: #78350f; margin-top: 1px; }
      .employee-counter { background: #D4AF37; color: white; padding: 2px 10px; border-radius: 16px; font-size: 9px; font-weight: 600; }

      .summary { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-bottom: 6px; }
      .summary-item { text-align: center; padding: 3px 2px; background: #f9fafb; border-radius: 4px; border: 1px solid #e5e7eb; }
      .summary-item.ok { background: #f0fdf4; border-color: #bbf7d0; }
      .summary-item.bad { background: #fef2f2; border-color: #fecaca; }
      .summary-item.warn { background: #fffbeb; border-color: #fde68a; }
      .summary-item.off { background: #eff6ff; border-color: #bfdbfe; }
      .summary-item.info { background: #f5f3ff; border-color: #ddd6fe; }
      .summary-value { font-size: 13px; font-weight: 700; color: #1f2937; line-height: 1; }
      .summary-label { font-size: 8px; color: #6b7280; margin-top: 1px; }

      .entries-table { width: 100%; border-collapse: collapse; font-size: 8.5px; margin-bottom: 6px; table-layout: fixed; }
      .entries-table th { background: #D4AF37; color: white; padding: 3px 2px; font-weight: 600; border: 1px solid #b8941f; font-size: 9px; }
      .entries-table td { padding: 2px 3px !important; border: 1px solid #e5e7eb; line-height: 1.15; }
      .entries-table tr { page-break-inside: avoid; break-inside: avoid; }

      .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: auto; }
      .sig-box { border: 1px dashed #9ca3af; border-radius: 4px; padding: 5px 8px; }
      .sig-title { font-size: 10px; font-weight: 700; color: #1f2937; margin-bottom: 2px; }
      .sig-text { font-size: 8px; color: #6b7280; margin-bottom: 14px; }
      .sig-line { border-bottom: 1px solid #1f2937; margin-bottom: 2px; }
      .sig-label { font-size: 7.5px; color: #6b7280; }
    </style>
  </head>
  <body>
    ${employeePages}
  </body>
  </html>`;

  return await generatePdfFromHtml(html, { landscape: true });
}
