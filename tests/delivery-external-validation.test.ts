import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import pg from "pg";
import {
  carrierClosureReady, deliveryAssignmentCreateSchema,
  validateCarrierEvidence, validateTransport,
} from "../server/delivery-routes";
import { ObjectNotFoundError, ObjectStorageService } from "../server/replit_integrations/object_storage/objectStorage";

const base = { sourceType: "material_transfer" as const, sourceId: 9 };
const carrier = { ...base, transportMode: "external" as const,
  carrier: "other" as const, carrierName: "Independent Logistics",
  waybill: "WAY-83", packageCount: 2 };
const parse = (payload: object) => validateTransport(deliveryAssignmentCreateSchema.parse(payload));

describe("carrier assignment boundary (in-memory)", () => {
  it("rejects a forged driver, incomplete carrier, non-HTTPS tracking and URL-based evidence", () => {
    expect(() => parse(carrier)).not.toThrow();
    expect(() => parse({ ...carrier, driverId: "some-user" })).toThrow();
    expect(() => parse({ ...carrier, carrierName: undefined })).toThrow();
    expect(() => parse({ ...carrier, trackingUrl: "http://carrier.example/track" })).toThrow();
    expect(() => parse({ ...carrier, shipmentPhotoUrl: "https://example.test/fake.png" })).toThrow();
    expect(() => parse({ ...base, driverId: "d", vehicleNumber: "V", carrier: "road" })).toThrow();
    expect(() => parse({ ...base, driverId: "d", vehicleNumber: "V" })).not.toThrow();
  });

  it("rejects mislabeled MIME, fake bytes and PDFs pretending to be shipment photos", () => {
    const pdf = Buffer.from("%PDF-1.7\n%%EOF");
    expect(() => validateCarrierEvidence({ buffer: pdf, mimetype: "application/pdf" }, "shipment_photo")).toThrow();
    expect(validateCarrierEvidence({ buffer: pdf, mimetype: "application/pdf" }, "carrier_receipt").extension).toBe("pdf");
    expect(() => validateCarrierEvidence({ buffer: pdf, mimetype: "image/png" }, "carrier_receipt")).toThrow();
    expect(() => validateCarrierEvidence({ buffer: Buffer.from("arbitrary"), mimetype: "image/jpeg" }, "shipment_photo")).toThrow();
    expect(() => validateCarrierEvidence({ buffer: Buffer.alloc(10 * 1024 * 1024 + 1), mimetype: "image/jpeg" }, "shipment_photo")).toThrow();
  });
  it("never serves private carrier objects through generic object downloads", async () => {
    const objects = new ObjectStorageService();
    await expect(objects.getObjectEntityFile("/objects/delivery-carriers/2/evidence.pdf"))
      .rejects.toBeInstanceOf(ObjectNotFoundError);
    await expect(objects.getObjectEntityFile("/objects/%64elivery-carriers/2/evidence.pdf"))
      .rejects.toBeInstanceOf(ObjectNotFoundError);
  });

  it("never treats tracking or an unattested receiver as actual source receipt", () => {
    const source = { sourceType: "material_transfer" as const, sourceStatus: "delivered", receivedBy: "real-receiver" };
    const proof = { receiptApprovedBy: "real-receiver", exceptionReason: null, handoverRecordedAt: new Date() };
    const kinds = ["shipment_photo", "carrier_receipt"];
    expect(carrierClosureReady(source, proof, kinds)).toBe(true);
    expect(carrierClosureReady(source, { ...proof, receiptApprovedBy: "carrier" }, kinds)).toBe(false);
    expect(carrierClosureReady({ ...source, receivedBy: null }, proof, kinds)).toBe(false);
    expect(carrierClosureReady({ ...source, sourceStatus: "in_transit" }, proof, kinds)).toBe(false);
    expect(carrierClosureReady(source, { ...proof, exceptionReason: "Missing cartons" }, kinds)).toBe(false);
    expect(carrierClosureReady(source, proof, ["shipment_photo"])).toBe(false);
  });

  it("keeps the additive SQL safe to reapply without touching stock/accounts", () => {
    const migration = readFileSync(new URL("../migrations/delivery_external_carriers.sql", import.meta.url), "utf8");
    expect(migration.match(/ADD COLUMN IF NOT EXISTS/g)?.length).toBe(9);
    expect(migration).toMatch(/IF NOT EXISTS \(SELECT 1 FROM pg_constraint[\s\S]+?delivery_transport_fields_check/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS delivery_carrier_attachments/);
    expect(migration).toMatch(/CREATE INDEX IF NOT EXISTS delivery_carrier_attachments_assignment_idx/);
    expect(migration).not.toMatch(/\b(?:DELETE FROM|DROP TABLE|TRUNCATE|UPDATE users|UPDATE inventory)\b/i);
  });
  it("executes the migration twice against isolated temporary tables (local PostgreSQL only)", async () => {
    const url = new URL(process.env.DATABASE_URL || "postgres://invalid/");
    if (process.env.USE_SUPABASE === "true" || url.hostname !== "helium" || url.pathname !== "/heliumdb") return;
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query("BEGIN");
      if ((await client.query("SELECT current_database() db")).rows[0].db !== "heliumdb")
        throw Error("Refusing to test migration on nonlocal database");
      await client.query("CREATE TEMP TABLE users (id varchar PRIMARY KEY)");
      await client.query(`CREATE TEMP TABLE delivery_assignments
        (id bigint PRIMARY KEY,driver_id varchar NOT NULL REFERENCES users(id),vehicle_number text NOT NULL)`);
      await client.query("SET LOCAL search_path=pg_temp");
      const migration = readFileSync(new URL("../migrations/delivery_external_carriers.sql", import.meta.url), "utf8");
      await client.query(migration);
      await client.query(migration);
      const { rows } = await client.query(`SELECT table_schema FROM information_schema.tables
        WHERE table_name='delivery_carrier_attachments' AND table_schema=current_schema()`);
      expect(rows).toHaveLength(1);
      expect(rows[0].table_schema).toMatch(/^pg_temp_/);
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  }, 30_000);
});