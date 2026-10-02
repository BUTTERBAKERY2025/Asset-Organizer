import { describe, expect, it } from "vitest";
import { portalDocumentLink } from "../client/src/lib/portal-document-link";

describe("private portal download cache identity", () => {
  it.each(["/uploads/a.pdf", "/api/uploads/file/a.pdf", "/api/documents/file/a.pdf"])("invalidates pre-no-store cached %s", url => {
    expect(portalDocumentLink(url, "employee-a")).toBe(`${url}?portal_private_v2=employee-a`);
    expect(portalDocumentLink(url, "employee-a")).not.toBe(portalDocumentLink(url, "employee-b"));
  });
  it("preserves query and fragment and encodes identity", () => {
    expect(portalDocumentLink("/uploads/a.pdf?download=1#page=2", "a&b")).toBe("/uploads/a.pdf?download=1&portal_private_v2=a%26b#page=2");
  });
  it("does not alter externally signed URLs", () => {
    const url = "https://example.com/a.pdf?signature=original";
    expect(portalDocumentLink(url, "a")).toBe(url);
  });
});