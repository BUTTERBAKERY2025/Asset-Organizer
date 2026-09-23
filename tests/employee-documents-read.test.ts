import { describe, expect, it } from "vitest";
import { classifyEmployeeDocument, saudiDateParts } from "../server/employee-documents-read";

describe("employee document metadata dates", () => {
  const today = "2026-03-10";
  const end = "2026-04-09";

  it("uses inclusive today and 30-day boundaries", () => {
    expect(classifyEmployeeDocument("2026-03-09", "active", today, end)).toBe("expired");
    expect(classifyEmployeeDocument(today, "active", today, end)).toBe("expiring_soon");
    expect(classifyEmployeeDocument(end, "active", today, end)).toBe("expiring_soon");
    expect(classifyEmployeeDocument("2026-04-10", "active", today, end)).toBe("active");
  });

  it("treats missing and malformed expiry as unknown and archive as authoritative", () => {
    expect(classifyEmployeeDocument(null, "active", today, end)).toBe("unknown");
    expect(classifyEmployeeDocument("not-a-date", "expired", today, end)).toBe("unknown");
    expect(classifyEmployeeDocument("2026-99-99", "active", today, end)).toBe("unknown");
    expect(classifyEmployeeDocument("2026-02-30", "active", today, end)).toBe("unknown");
    expect(classifyEmployeeDocument("2024-02-29", "active", today, end)).toBe("expired");
    expect(classifyEmployeeDocument("2026-02-29", "active", today, end)).toBe("unknown");
    expect(classifyEmployeeDocument("2020-01-01", "archived", today, end)).toBe("archived");
  });

  it("derives the current date in Saudi time", () => {
    expect(saudiDateParts(new Date("2026-03-09T22:30:00.000Z"))).toEqual({
      today: "2026-03-10",
      thirtyDaysOut: "2026-04-09",
    });
  });
});