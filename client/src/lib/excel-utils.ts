import * as XLSX from "xlsx";

const BRANDING_SHEET_NAME = "غلاف التقرير";

export function addBrandingSheet(workbook: XLSX.WorkBook, reportTitle: string) {
  if (workbook.SheetNames.includes(BRANDING_SHEET_NAME)) {
    return workbook;
  }
  
  const currentDate = new Date().toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
  
  const brandingData = [
    [""],
    ["باتر بيكري - Butter Bakery"],
    [""],
    ["نظام إدارة المشروعات والأصول والصيانة"],
    [""],
    [reportTitle],
    [""],
    [`تاريخ التقرير: ${currentDate}`],
    [""],
    ["---"],
    [""],
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(brandingData);
  
  ws['!cols'] = [{ wch: 50 }];
  
  ws['!merges'] = [
    { s: { r: 1, c: 0 }, e: { r: 1, c: 0 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 0 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: 0 } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: 0 } },
  ];
  
  XLSX.utils.book_append_sheet(workbook, ws, BRANDING_SHEET_NAME);
  
  const existingNames = [...workbook.SheetNames];
  const brandingIndex = existingNames.indexOf(BRANDING_SHEET_NAME);
  if (brandingIndex > 0) {
    existingNames.splice(brandingIndex, 1);
    existingNames.unshift(BRANDING_SHEET_NAME);
    workbook.SheetNames = existingNames;
  }
  
  return workbook;
}

export function createBrandedWorkbook(reportTitle: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  return wb;
}

export function finalizeBrandedWorkbook(workbook: XLSX.WorkBook, reportTitle: string): XLSX.WorkBook {
  return addBrandingSheet(workbook, reportTitle);
}
