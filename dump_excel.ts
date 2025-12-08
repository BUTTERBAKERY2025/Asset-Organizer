import * as XLSX from 'xlsx';
import * as fs from 'fs';

try {
  const buf = fs.readFileSync('attached_assets/تقرير_المعدات_1765202969495.xlsx');
  const workbook = XLSX.read(buf, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  const items = data.map((row: any) => ({
    description: row["__EMPTY_3"],
    qty: row["__EMPTY_4"] && row["__EMPTY_4"] > 0 ? "Check Desc" : "Unknown", // Qty is not clearly in a column in previous snippets, often inside Description string
    cost: row["__EMPTY_4"],
    row: row
  })).filter((i: any) => typeof i.cost === 'number');

  console.log(JSON.stringify(items, null, 2));
} catch (error) {
  console.error(error);
}
