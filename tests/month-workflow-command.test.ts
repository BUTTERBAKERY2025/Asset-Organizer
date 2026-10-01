import { describe, expect, it } from "vitest";
import type { OperationsMonthCommandResult, OperationsMonthWorkflow } from "../shared/operations-month-workflow";
import { readMonthCommandResult } from "../client/src/components/operations-center/month-workflow-command";

const expected = { action: "close" as const,
  body: { branchId: "b1", month: "2025-02", revision: 0, note: "reviewed" } };
const command = { committed: true as const, branchId: "b1", month: "2025-02",
  action: "close" as const, revision: 1, changed: true };

describe("monthly committed-command client recovery", () => {
  it("recognizes a saved command even when no refreshed workflow is available", () => {
    const response: OperationsMonthCommandResult = { command, refresh: "unavailable", workflow: null,
      message: "تم حفظ الإجراء؛ تعذر تحديث الملف. لا تُعد إرسال الإجراء." };
    expect(readMonthCommandResult(response, expected)).toBe(response);
    expect(readMonthCommandResult(response, expected).command.committed).toBe(true);
    expect(readMonthCommandResult(response, expected).workflow).toBe(null);
    expect(readMonthCommandResult(response, expected).message).toContain("تم حفظ");
  });
  it("accepts a partial workflow with unavailable review evidence without calling the command failed", () => {
    const workflow = { branchId: "b1", month: "2025-02", sourceFailures: ["review"],
      closing: { revision: null, canClose: false } } as OperationsMonthWorkflow;
    const response: OperationsMonthCommandResult = { command, refresh: "partial", workflow,
      message: "تم حفظ الإجراء؛ تعذر تحديث بعض المصادر." };
    expect(readMonthCommandResult(response, expected).refresh).toBe("partial");
    expect(readMonthCommandResult(response, expected).workflow?.closing.canClose).toBe(false);
  });
  it("accepts unchanged/idempotent receipts and preserves the saved revision", () => {
    const response: OperationsMonthCommandResult = { command: { ...command, revision: 4, changed: false },
      refresh: "unavailable", workflow: null, message: "الإجراء محفوظ مسبقاً؛ حدّث الملف." };
    expect(readMonthCommandResult(response, expected).command).toMatchObject({ revision: 4, changed: false });
  });
  it.each([
    { ...command, branchId: "b2" },
    { ...command, month: "2025-03" },
    { ...command, action: "reopen" },
    { ...command, committed: false },
    { ...command, revision: null },
  ])("does not accept a mismatched or unconfirmed receipt as success: %j", saved => {
    expect(() => readMonthCommandResult({ command: saved, refresh: "unavailable", workflow: null,
      message: "saved" }, expected)).toThrow("قبل إعادة إرسال");
  });
  it.each([
    null, {}, { ...command },
    { command, refresh: "available", workflow: null, message: "saved" },
    { command, refresh: "unavailable", workflow: {}, message: "saved" },
    { command, refresh: "partial", workflow: { branchId: "b2", month: "2025-02" }, message: "saved" },
  ])("requires reliable refresh and scope metadata: %j", response => {
    expect(() => readMonthCommandResult(response, expected)).toThrow("لم يصل تأكيد موثوق");
  });
});