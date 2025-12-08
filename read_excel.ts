import * as XLSX from 'xlsx';
import * as fs from 'fs';

try {
  console.log("Reading file...");
  const buf = fs.readFileSync('attached_assets/تقرير_المعدات_1765202969495.xlsx');
  console.log("Parsing workbook...");
  const workbook = XLSX.read(buf, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  console.log("Sheet name:", sheetName);
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  console.log(JSON.stringify(data, null, 2));
} catch (error) {
  console.error("Error:", error);
}
