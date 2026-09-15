import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrations = [
  {
    file: "migrations/026_central_kitchen_shadow_inventory.sql",
    bytes: 2356,
    sha256: "6a38cfd07be877cb3b58b6de288896524c21e2698e9c46e356020a861fff770c",
  },
  {
    file: "migrations/027_central_kitchen_pilot_metrics.sql",
    bytes: 344,
    sha256: "9a566e55be323c469465dd83c7f3c6b0a04a61b32ac3ae90c665e83a62e672be",
  },
  {
    file: "migrations/028_central_kitchen_catalog_linkage.sql",
    bytes: 1945,
    sha256: "9f36bd0f36e47b73afe05e035a548780bb312de24f4e7e0e5017ac6fbac8053d",
  },
  {
    file: "migrations/031_central_kitchen_recipes.sql",
    bytes: 8083,
    sha256: "5315e467596f245ddbde7a54f810bfc9fd60e0236c87b076f8f4627a4ccc255e",
  },
  {
    file: "migrations/032_material_stock_decimals.sql",
    bytes: 5436,
    sha256: "63688db7600b8942f28451e4e396ed303a8510427c5e5d968121dfaa220f4b24",
  },
  {
    file: "migrations/033_central_kitchen_batch_materials.sql",
    bytes: 6064,
    sha256: "db6bf970304ac5be6c0e7ea16790c6c6540e1408686635e705717219593043bc",
  },
  {
    file: "migrations/034_manual_production_operations.sql",
    bytes: 624,
    sha256: "543671b8f6e1207511d922e0171270fbc05704d80b0666e826102b7057bbf2c3",
  },
  {
    file: "migrations/035_central_kitchen_preparation_sources.sql",
    bytes: 2500,
    sha256: "f0bfedcf81ba3da7dd3404099c564e2d649b982e4c2e9e14ea33bbbf75378801",
  },
] as const;

describe("central-kitchen migration transaction integrity", () => {
  it("keeps one top-level transaction and one canonical payload per migration", () => {
    for (const migration of migrations) {
      // Ignore only a conventional final newline; pin every SQL payload byte.
      const source = Buffer.from(
        readFileSync(resolve(__dirname, "..", migration.file), "utf8").replace(/\r?\n$/, ""),
      );
      const sourceText = source.toString("utf8");

      expect(sourceText.match(/^BEGIN;[ \t]*$/gm) ?? []).toHaveLength(1);
      expect(sourceText.match(/^COMMIT;[ \t]*$/gm) ?? []).toHaveLength(1);
      expect(sourceText).not.toContain("COMMIT;BEGIN;");
      expect(sourceText.endsWith("COMMIT;")).toBe(true);

      // Pin the reviewed canonical payload so a concatenated/repeated copy
      // cannot pass merely because its SQL remains syntactically valid.
      expect(source.byteLength).toBe(migration.bytes);
      expect(createHash("sha256").update(source).digest("hex")).toBe(migration.sha256);
    }
  });
});