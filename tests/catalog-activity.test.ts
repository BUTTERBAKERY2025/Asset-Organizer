import { describe, expect, it } from "vitest";
import { isCatalogRecordActive } from "../shared/catalog-activity";

describe("catalog activity", () => {
  it.each([false, 0, "false", "inactive", "0", "f", " no "])(
    "recognizes explicit inactive value %p",
    (value) => {
      expect(isCatalogRecordActive(value)).toBe(false);
    },
  );

  it.each([true, 1, "true", "active", "1", undefined, null])(
    "keeps active and legacy values selectable: %p",
    (value) => {
      expect(isCatalogRecordActive(value)).toBe(true);
    },
  );
});