import * as XLSX from 'xlsx';
import * as fs from 'fs';

try {
  const buf = fs.readFileSync('attached_assets/تقرير_المعدات_1765202969495.xlsx');
  const workbook = XLSX.read(buf, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  let totalCost = 0;
  let totalTax = 0;
  let totalWithTax = 0;

  data.forEach((row: any) => {
    // Skip header/empty rows if any, usually numerical values in column E (__EMPTY_4) imply a valid item row
    const cost = row["__EMPTY_4"];
    const tax = row["__EMPTY_5"];
    const withTax = row["__EMPTY_6"];

    if (typeof cost === 'number') {
        totalCost += cost;
    }
    if (typeof tax === 'number') {
        totalTax += tax;
    }
    if (typeof withTax === 'number') {
        totalWithTax += withTax;
    }
  });

  console.log("Excel File Totals:");
  console.log("Total Cost (Before Tax):", totalCost.toFixed(2));
  console.log("Total Tax:", totalTax.toFixed(2));
  console.log("Total With Tax:", totalWithTax.toFixed(2));

} catch (error) {
  console.error("Error:", error);
}
