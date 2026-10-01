import { describe, expect, it, vi } from "vitest";
import {
  createOperationsEmployeeFlight, employeeStatusLabel, operationsBranchPrerequisite,
  operationsEmployeeCanTransfer, operationsEmployeePage, operationsEmployeeQueryNeeded, operationsEmployeeSection,
  operationsEmployeeSectionHref, operationsJoiningAction, operationsJoiningSendFeedback, orderedOperationsJoining,
  sendOperationsJoining, validateOperationsTransferPage,
  type OperationsEmployee, type OperationsJoining, type OperationsJoiningSendResult, type OperationsTransferPage,
} from "../client/src/lib/operations-employees";
import { operationsReadState } from "../client/src/lib/operations-payroll-report";
import { createOperationsHrCommandGuard, operationsHrSelectionHref } from "../client/src/lib/operations-hr-state";

const branches = [{ id: "a", name: "أ" }, { id: "b", name: "ب" }];
const employee = (id: number, patch: Partial<OperationsEmployee> = {}): OperationsEmployee => ({
  id, branchId: "a", employeeName: `موظف ${id}`, employeeNumber: `EMP-${id}`,
  jobTitle: "بائع", status: "active", ...patch,
});
const joining = (id: number, status: string, patch: Partial<OperationsJoining> = {}): OperationsJoining => ({
  id, candidateName: `مرشح ${id}`, branchId: "a", position: "بائع", status: "accepted",
  blockedExisting: false, blockedReason: null,
  notification: {
    id: id + 100, branchId: "a", status, notificationNumber: `ON-${id}`, actualStartDate: "2026-10-02",
    sentAt: null, expiresAt: null, signedAt: status === "signed" ? "2026-10-01T10:00:00Z" : null,
    confirmedAt: null, confirmedBy: null, confirmedByName: null, confirmedNotes: null,
  }, ...patch,
});
const sent: OperationsJoiningSendResult = {
  link: "https://app.test/onboarding/opaque", notificationNumber: "ON-1", expiresAt: "2026-10-03T10:00:00Z",
  sentAt: "2026-10-01T10:00:00Z", tokenReused: false, whatsapp: { success: false, skipped: true, status: "skipped" },
};
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};

describe("consumed operations employee UI state", () => {
  it("has one prerequisite state and never defaults to the first of multiple branches", () => {
    expect(operationsBranchPrerequisite("loading", branches, "a", false)).toBe("loading");
    expect(operationsBranchPrerequisite("error", branches, "a", false)).toBe("error");
    expect(operationsBranchPrerequisite("error", branches, "a", true)).toBe("denied");
    expect(operationsBranchPrerequisite("ready", [], "", false)).toBe("no-grants");
    expect(operationsBranchPrerequisite("ready", branches, "other", false)).toBe("denied");
    expect(operationsBranchPrerequisite("ready", branches, "", false)).toBe("choose");
    expect(operationsBranchPrerequisite("ready", [branches[0]], "", false)).toBe("ready");
    expect(operationsBranchPrerequisite("ready", branches, "b", false)).toBe("ready");
  });
  it("suppresses old/placeholder/failed data during scope refresh", () => {
    const ready = { isPending: false, isFetching: false, isError: false, isPlaceholderData: false, data: [employee(1)] };
    expect(operationsReadState(false, ready)).toBe("scope");
    expect(operationsReadState(true, { ...ready, isFetching: true })).toBe("loading");
    expect(operationsReadState(true, { ...ready, isPlaceholderData: true })).toBe("loading");
    expect(operationsReadState(true, { ...ready, isError: true })).toBe("error");
  });
  it("loads directory employees only in directory or when a transfer dialog needs them", () => {
    expect(operationsEmployeeQueryNeeded("directory", false)).toBe(true);
    expect(operationsEmployeeQueryNeeded("joining", false)).toBe(false);
    expect(operationsEmployeeQueryNeeded("transfers", false)).toBe(false);
    expect(operationsEmployeeQueryNeeded("transfers", true)).toBe(true);
  });
  it("keeps selected subsection, branch, payroll month and return metadata in the real URL", () => {
    const search = "?branchId=a&month=2026-09&tab=employees&from=operations-center&centerBranchIds=a,b&centerWorkspace=monthly&centerMonthFile=payroll";
    const href = operationsEmployeeSectionHref("/hr-hub", search, "transfers");
    const url = new URL(href, "https://app.test");
    expect(operationsEmployeeSection(url.search)).toBe("transfers");
    expect(url.searchParams.get("branchId")).toBe("a");
    expect(url.searchParams.get("month")).toBe("2026-09");
    expect(url.searchParams.get("centerBranchIds")).toBe("a,b");
    const payroll = new URL(operationsHrSelectionHref(url.pathname, url.search, "b", "2026-08", "payroll", ["a", "b"]), url.origin);
    expect(payroll.searchParams.get("section")).toBe("transfers");
    expect(payroll.searchParams.get("centerMonthBranchId")).toBe("b");
    expect(payroll.searchParams.get("centerMonthFile")).toBe("payroll");
    expect(operationsEmployeeSection("?section=not-a-section")).toBe("directory");
  });
  it("uses authentic minimal directory fields for search, filter and page bounds", () => {
    const employees = Array.from({ length: 32 }, (_, index) => employee(index + 1));
    employees[1] = employee(2, { status: "inactive", jobTitle: "خباز", employeeName: "أحمد" });
    expect(operationsEmployeePage(employees, { search: "EMP-32", status: "all", jobTitle: "all" }, 1).rows[0].id).toBe(32);
    expect(operationsEmployeePage(employees, { search: "أحمد", status: "inactive", jobTitle: "خباز" }, 5)).toMatchObject({ total: 1, page: 1, pages: 1 });
    expect(operationsEmployeePage(employees, { search: "غير نشط", status: "all", jobTitle: "all" }, 1).total).toBe(1);
    expect(operationsEmployeePage(employees, { search: "", status: "active", jobTitle: "all" }, 99)).toMatchObject({ total: 31, page: 3, pages: 3 });
    expect(operationsEmployeePage(employees, { search: "لا يطابق", status: "all", jobTitle: "all" }, 2)).toMatchObject({ rows: [], total: 0, page: 1 });
    expect(employeeStatusLabel("on_leave")).toBe("في إجازة");
    expect(employeeStatusLabel("new-backend-code")).toBe("حالة غير معروفة");
  });
  it("offers immediate transfer only for a currently scoped active employee with create capability", () => {
    expect(operationsEmployeeCanTransfer(employee(1), "a", true)).toBe(true);
    expect(operationsEmployeeCanTransfer(employee(1), "a", false)).toBe(false);
    expect(operationsEmployeeCanTransfer(employee(1), "b", true)).toBe(false);
    for (const status of ["inactive", "on_leave", "terminated"])
      expect(operationsEmployeeCanTransfer(employee(1, { status }), "a", true)).toBe(false);
  });
  it("puts signed decisions first, then pending, sent, confirmed and terminal records", () => {
    const records = [joining(1, "expired"), joining(2, "confirmed"), joining(3, "sent"), joining(4, "pending"), joining(5, "signed")];
    expect(orderedOperationsJoining(records).map(item => item.id)).toEqual([5, 4, 3, 2, 1]);
    expect(records[0].id).toBe(1); // The query's shared cache is not mutated.
    expect(operationsJoiningAction(records[4], true, true)).toBe("confirm");
    expect(operationsJoiningAction(records[4], true, false)).toBe("approval-denied");
    expect(operationsJoiningAction(records[3], true, false)).toBe("send");
    expect(operationsJoiningAction(records[3], false, false)).toBe("send-denied");
    for (const status of ["confirmed", "converted", "cancelled", "expired"])
      expect(operationsJoiningAction(joining(1, status), true, true)).toBe("terminal");
    expect(operationsJoiningAction(joining(1, "pending", { status: "converted", notification: null }), true, true)).toBe("terminal");
    expect(operationsJoiningAction(joining(1, "pending", { blockedExisting: true, notification: null }), true, true)).toBe("blocked");
  });
  it("distinguishes link creation, failed channel and provider acceptance, never claiming delivery", () => {
    expect(operationsJoiningSendFeedback(sent)).toContain("لم تُستخدم قناة واتساب");
    expect(operationsJoiningSendFeedback({ ...sent, whatsapp: { success: false, skipped: false, status: "failed" } })).toContain("تعذر إرساله");
    expect(operationsJoiningSendFeedback({ ...sent, whatsapp: { success: true, skipped: false, status: "sent" } })).toContain("لا يعني ذلك تأكيد التسليم");
  });
  it("validates branch-scoped transfer pages and exact opaque next cursor metadata", () => {
    const page: OperationsTransferPage = {
      transfers: [{
        id: 7, employeeId: 1, employeeName: "موظف", employeeNumber: "EMP-1", jobTitle: "بائع",
        sourceBranchId: "a", destinationBranchId: "b", reason: "سبب مسجل", status: "completed",
        requestedAt: "2026-10-01T10:00:00Z", effectiveDate: "2026-10-01", completedAt: "2026-10-01T10:00:00Z",
        requestedBy: "actor", requestedByName: "منفذ مسجل", history: [],
      }], nextCursor: "opaque+/=", hasMore: true, truncated: true, limit: 50,
    };
    expect(validateOperationsTransferPage(page, "a", ["a", "b"]).nextCursor).toBe("opaque+/=");
    expect(validateOperationsTransferPage(page, "b", ["a", "b"])).toBe(page);
    expect(() => validateOperationsTransferPage(page, "c", ["a", "b", "c"])).toThrow();
    expect(() => validateOperationsTransferPage(page, "a", ["a"])).toThrow();
    expect(() => validateOperationsTransferPage({ ...page, nextCursor: null }, "a", ["a", "b"])).toThrow();
  });
});

describe("actual joining orchestration and whole-command flight lock", () => {
  it("holds the lock through creation, intermediate refresh, send and final refresh", async () => {
    const gates = [deferred(), deferred(), deferred(), deferred()];
    const calls: string[] = [];
    const io = {
      create: vi.fn(async () => { calls.push("create"); await gates[0].promise; return { id: 101 }; }),
      send: vi.fn(async () => { calls.push("send"); await gates[2].promise; return sent; }),
      refresh: vi.fn(async () => { calls.push("refresh"); await gates[calls.length === 2 ? 1 : 3].promise; }),
      isCurrent: () => true,
    };
    const flight = createOperationsEmployeeFlight();
    const busy: boolean[] = [];
    const work = () => sendOperationsJoining(joining(1, "pending", { notification: null }), "2026-10-02", io).then(() => {});
    const running = flight.run(work, value => busy.push(value));
    expect(flight.isBusy()).toBe(true);
    expect(await flight.run(work, value => busy.push(value))).toBe(false);
    gates[0].resolve();
    await vi.waitFor(() => expect(io.refresh).toHaveBeenCalledTimes(1));
    expect(await flight.run(work, value => busy.push(value))).toBe(false);
    gates[1].resolve();
    await vi.waitFor(() => expect(io.send).toHaveBeenCalledTimes(1));
    expect(flight.isBusy()).toBe(true);
    gates[2].resolve();
    await vi.waitFor(() => expect(io.refresh).toHaveBeenCalledTimes(2));
    expect(flight.isBusy()).toBe(true);
    gates[3].resolve();
    expect(await running).toBe(true);
    expect(calls).toEqual(["create", "refresh", "send", "refresh"]);
    expect(busy).toEqual([true, false]);
    expect(flight.isBusy()).toBe(false);
  });
  it("refreshes a 409 without blindly retrying creation, releasing the lock only after reconciliation", async () => {
    const error = new Error("409: إشعار موجود بالفعل");
    const refreshGate = deferred();
    const io = {
      create: vi.fn(async () => { throw error; }), send: vi.fn(async () => sent),
      refresh: vi.fn(() => refreshGate.promise), isCurrent: () => true,
    };
    const flight = createOperationsEmployeeFlight();
    const command = flight.run(async () => {
      await expect(sendOperationsJoining(joining(1, "pending", { notification: null }), "2026-10-02", io)).rejects.toBe(error);
    }, () => {});
    await vi.waitFor(() => expect(io.refresh).toHaveBeenCalledTimes(1));
    expect(flight.isBusy()).toBe(true);
    expect(io.send).not.toHaveBeenCalled();
    refreshGate.resolve();
    await command;
    expect(io.create).toHaveBeenCalledTimes(1);
    expect(flight.isBusy()).toBe(false);
  });
  it("reconciles persisted creation even when sending fails", async () => {
    const io = {
      create: vi.fn(async () => ({ id: 101 })), send: vi.fn(async () => { throw new Error("send failed"); }),
      refresh: vi.fn(async () => {}), isCurrent: () => true,
    };
    await expect(sendOperationsJoining(joining(1, "pending", { notification: null }), "2026-10-02", io)).rejects.toThrow("send failed");
    expect(io.refresh).toHaveBeenCalledTimes(2);
  });
  it("does not send or surface links after A→B→A scope navigation", async () => {
    const guard = createOperationsHrCommandGuard();
    guard.update("a");
    const token = guard.capture();
    const io = {
      create: vi.fn(async () => ({ id: 101 })), send: vi.fn(async () => sent),
      refresh: vi.fn(async () => { guard.update("b"); guard.update("a"); }),
      isCurrent: () => guard.isCurrent(token),
    };
    expect(await sendOperationsJoining(joining(1, "pending", { notification: null }), "2026-10-02", io)).toBeUndefined();
    expect(io.send).not.toHaveBeenCalled();
    const nextToken = guard.capture();
    io.isCurrent = () => guard.isCurrent(nextToken);
    expect(await sendOperationsJoining(joining(1, "sent"), "", io)).toBeUndefined();
    expect(io.create).toHaveBeenCalledTimes(1);
  });
});