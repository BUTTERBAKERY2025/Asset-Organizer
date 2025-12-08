import * as XLSX from 'xlsx';
import * as fs from 'fs';

// Helper to clean strings
const clean = (str: string) => str ? str.replace(/\s+/g, ' ').trim().toLowerCase() : "";

try {
  const buf = fs.readFileSync('attached_assets/تقرير_المعدات_1765202969495.xlsx');
  const workbook = XLSX.read(buf, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  const excelItems = data.map((row: any) => {
    // Column mappings based on previous inspection
    const description = row["__EMPTY_3"];
    const cost = row["__EMPTY_4"]; // Cost (Total usually, based on Qty check)
    // In previous check:
    // "Mahlkonig Omnia ... Qty 1" -> Cost 10000. (Unit 10000)
    // "Baratza ... Qty 2" -> Cost 7800. (Unit 3900)
    // So Column 4 is TOTAL COST for that row.
    
    return {
      description: description,
      totalCost: cost,
      originalRow: row
    };
  }).filter(item => item.description && typeof item.totalCost === 'number' && item.description !== "البيان" && item.description !== "-");

  // We need to compare with what we have in data.ts.
  // Since we can't easily import data.ts here without compiling, I'll paste the known total costs I've already implemented.
  
  // Implemented Items (Total Costs):
  const implementedCosts = [
    48695.65, // La Marzocco
    1800,     // L4D-10 (Qty 1)
    920,      // Airpot (Qty 2 * 460) -> My data has 460 * 2 = 920.
    10000,    // Omnia
    869.57,   // Tamper
    1600,     // Samovar
    5652.17,  // Orange Juicer
    7391.3,   // Ice Maker
    9539.13,  // Fetco
    30000,    // Koz Tree
    10450,    // Mahlkonig E80
    1906.89,  // Salamander
    3137.62,  // Stove
    1430.17,  // Slicer
    130.43,   // Pizza Peel (65.22 * 2 = 130.44) ~ 130.43
    17136.02, // Pizza Oven
    3029.4,   // Grill
    16000,    // Mixer
    62640,    // iRhea
    7800,     // Baratza (3900 * 2)
    16500,    // Bancool 1.5m (8250 * 2)
    7400,     // Bancool 1.2m
    3900,     // Bancool 1.5m Steel
    3500      // Bancool Pizza
  ];

  const missingItems = [];
  
  for (const item of excelItems) {
    // Check if this item's cost exists in our implemented list (with small margin for float errors)
    const isImplemented = implementedCosts.some(cost => Math.abs(cost - item.totalCost) < 1.0);
    
    if (!isImplemented) {
      missingItems.push(item);
    }
  }

  console.log("Missing Items Count:", missingItems.length);
  console.log(JSON.stringify(missingItems, null, 2));

} catch (error) {
  console.error("Error:", error);
}
