import { db } from "../server/db";
import { branches, inventoryItems } from "../shared/schema";
import { INVENTORY_DATA } from "../client/src/lib/data";

async function migrateData() {
  console.log("Starting data migration...");

  try {
    // Clear existing data
    console.log("Clearing existing data...");
    await db.delete(inventoryItems);
    await db.delete(branches);

    // Insert branches
    console.log("Inserting branches...");
    for (const branch of INVENTORY_DATA) {
      await db.insert(branches).values({
        id: branch.id,
        name: branch.name,
      });
      console.log(`  - Inserted branch: ${branch.name}`);
    }

    // Insert inventory items
    console.log("Inserting inventory items...");
    let totalItems = 0;
    for (const branch of INVENTORY_DATA) {
      for (const item of branch.inventory) {
        await db.insert(inventoryItems).values({
          id: item.id,
          branchId: branch.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          price: item.price || null,
          status: item.status || null,
          lastCheck: item.lastCheck || null,
          notes: item.notes || null,
          serialNumber: item.serialNumber || null,
        });
        totalItems++;
      }
      console.log(`  - Inserted ${branch.inventory.length} items for ${branch.name}`);
    }

    console.log(`\nMigration complete! Total items: ${totalItems}`);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

migrateData();
