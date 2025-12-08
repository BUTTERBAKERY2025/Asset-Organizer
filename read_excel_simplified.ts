import * as XLSX from 'xlsx';
import * as fs from 'fs';

try {
  const buf = fs.readFileSync('attached_assets/تقرير_المعدات_1765202969495.xlsx');
  const workbook = XLSX.read(buf, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  // Print a simplified list to help matching
  const simplified = data.map((row: any) => {
    return {
      name: row["__EMPTY_3"],
      qty: row["__EMPTY_1"] ? "Ref: " + row["__EMPTY_1"] : "N/A", // Actually Qty is not clearly in a column named "Qty".
      // Wait, looking at previous output:
      // Row 1: "... - ك 1" -> Quantity 1?
      // Row 2: "... - الكمية 2" -> Quantity 2?
      // The Quantity seems embedded in the text description or implied.
      // Let's look at Total / Cost.
      cost: row["__EMPTY_4"], // Cost per unit? Or Total Cost?
      // Row 1: Cost 48695.65. Total 55999...
      // Row 2: Cost 1800. Total 2070.
      // Row 3: Cost 920. Total 1058. (Qty 2 in text? " الكمية 2 ") -> 920 is total or unit?
      // If 920 is unit, total should be 1840.
      // If 920 is total, unit is 460.
      // Let's assume Column 4 is "Total Cost Excl VAT" or "Unit Cost"?
      // Row 1: La Marzocco. Market price ~50k. So 48695 is likely Unit Cost.
      // Row 3: "Airpot... الكمية 2". Cost 920. If it's unit cost 460, total 920.
      // Let's print the whole thing to analyze.
      description: row["__EMPTY_3"],
      value: row["__EMPTY_4"]
    };
  }).filter(item => item.description && typeof item.value === 'number');

  console.log(JSON.stringify(simplified, null, 2));
} catch (error) {
  console.error("Error:", error);
}
