import { INVENTORY_DATA } from './client/src/lib/data';

// Excel Items (Costs)
const excelCosts = [
    48695.65, 1800, 920, 10000, 869.57, 1600, 5652.17, 7391.3, 9539.13, 30000, 10450, 1906.89, 3137.62, 1430.17, 130.43, 17136.02, 3029.4, 16000, 19000, 13914, 12000, 3456, 11000, 31600, 11000, 7000, 62640, 7800, 16500, 7400, 3900, 3500
];

const medina = INVENTORY_DATA.find(b => b.id === 'medina');
if (medina) {
    let myTotal = 0;
    const extraItems = [];
    
    medina.inventory.forEach(item => {
        if (item.price) {
            const itemTotal = item.price * (item.quantity || 1);
            // Check if this specific item total matches one of the excel costs roughly
            // Note: My data.ts has unit prices mostly, but some might be total.
            // Actually, in previous steps I set `price` to match unit price or total depending on the item.
            // Wait, for `Koz Tree` I set price 30000 (which is total in excel).
            // For `Baratza` I set price 3900 (unit), qty 2. Total 7800.
            
            // Let's calculate the line total
            const lineTotal = item.price * (item.quantity || 1);
            myTotal += lineTotal;

            // Try to match with Excel "Total Cost" list
            // We need to account for floating point
            const matchIndex = excelCosts.findIndex(c => Math.abs(c - lineTotal) < 1.0);
            
            if (matchIndex !== -1) {
                // Found match, remove from pool to handle duplicates
                excelCosts.splice(matchIndex, 1);
            } else {
                extraItems.push({ ...item, lineTotal });
            }
        }
    });

    console.log("My Calculated Total:", myTotal.toFixed(2));
    console.log("Remaining Excel Costs (Not matched in my data):", excelCosts);
    console.log("Extra Items in My Data (Not in Excel):", extraItems);
}
