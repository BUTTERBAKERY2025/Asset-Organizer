import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { canonicalAuditMime } from "../server/audit-file-types";

const zip = Buffer.from("504b030400000000", "hex");
const ole = Buffer.from("d0cf11e0a1b11ae1", "hex");
describe("audit upload canonical MIME", () => {
  it.each([
    [".pdf", Buffer.from("%PDF-1.7\n"), "application/pdf"],
    [".png", Buffer.from("89504e470d0a1a0a", "hex"), "image/png"],
    [".JPG", Buffer.from("ffd8ffe000000000", "hex"), "image/jpeg"],
    [".jpeg", Buffer.from("ffd8ffe100000000", "hex"), "image/jpeg"],
    [".webp", Buffer.from("RIFF0000WEBP"), "image/webp"],
    [".gif", Buffer.from("GIF89a0000"), "image/gif"],
    [".gif", Buffer.from("GIF87a0000"), "image/gif"],
    [".xlsx", zip, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    [".docx", zip, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    [".xls", ole, "application/vnd.ms-excel"],
    [".doc", ole, "application/msword"],
    [".csv", Buffer.from("a,b\n1,2"), "text/csv"],
    [".zip", zip, "application/zip"],
  ])("derives %s without trusting browser metadata", (ext, bytes, expected) => {
    expect(canonicalAuditMime(ext as string, bytes as Buffer)).toBe(expected);
  });
  it.each([
    [".pdf", zip],
    [".png", Buffer.from("<html>bad</html>")],
    [".webp", Buffer.from("RIFF0000WAVE")],
    [".gif", Buffer.from("GIFxxx0000")],
    [".csv", Buffer.from("a\0b")],
    [".csv", zip],
    [".svg", Buffer.from("<svg></svg>")],
    [".pdf", Buffer.alloc(0)],
  ])("rejects mismatched or unsupported %s", (ext, bytes) => {
    expect(canonicalAuditMime(ext, bytes)).toBeNull();
  });
  it("uses the canonical type for both storage and database, not browser MIME", () => {
    const route = readFileSync("server/audit-portal-routes.ts", "utf8");
    expect(route).toContain("canonicalAuditMime(ext, f.buffer)");
    expect(route).toContain("uploadToSupabase(f.buffer, storageName, mimeType)");
    expect(route).toMatch(/fileSize: f.size,\s+mimeType,/);
    expect(route).not.toContain("mimeType: f.mimetype");
  });
});