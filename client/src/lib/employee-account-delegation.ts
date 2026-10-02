import type { DelegatedPermission } from "@shared/employee-account-delegation";

export const EMPLOYEE_ACCOUNTS_ENDPOINT = "/api/operations/employee-accounts";
export const EMPLOYEE_ACCOUNT_POLICY_ENDPOINT = "/api/admin/employee-account-policy";

export function canManageEmployeeAccounts(role: string | null | undefined) {
  return role === "admin" || role === "operations_manager";
}

/** Normalize using the server's catalog, never the global RBAC templates. */
export function constrainDelegatedPermissions(selected: readonly DelegatedPermission[], available: readonly DelegatedPermission[]): DelegatedPermission[] {
  return available.flatMap(permission => {
    const actions = permission.actions.filter(action =>
      selected.some(row => row.module === permission.module && row.actions.includes(action)));
    return actions.length ? [{ module: permission.module, actions: Array.from(new Set(actions)) }] : [];
  });
}

export function hasUnapprovedPermissions(selected: readonly DelegatedPermission[], available: readonly DelegatedPermission[]) {
  return selected.some(permission => permission.actions.some(action =>
    !available.some(row => row.module === permission.module && row.actions.includes(action))));
}

export function hasMissingViewPermission(selected: readonly DelegatedPermission[]) {
  return selected.some(row => row.actions.some(action => action !== "view") && !row.actions.includes("view"));
}

/** Never silently add view beyond approval or retain actions after removing view. */
export function toggleDelegatedPermission(selected: readonly DelegatedPermission[], available: readonly DelegatedPermission[], module: string, action: string, checked: boolean) {
  const next = selected.map(row => ({ ...row, actions: [...row.actions] }));
  let row = next.find(permission => permission.module === module);
  if (checked) {
    if (action !== "view" && !available.some(permission => permission.module === module && permission.actions.includes("view")))
      return constrainDelegatedPermissions(next, available);
    if (!row) { row = { module, actions: [] }; next.push(row); }
    row.actions = Array.from(new Set([...row.actions, action, ...(action !== "view" ? ["view"] : [])]));
  } else if (row) {
    row.actions = action === "view" ? [] : row.actions.filter(value => value !== action);
  }
  return constrainDelegatedPermissions(next, available);
}

export function employeeAccountScope(user: {
  id: string; role: string; branchId?: string | null; activeBranchId?: string | null;
  allowedBranches?: { branchId: string; accessLevel?: string }[];
}) {
  return JSON.stringify([user.id, user.role, user.branchId ?? null, user.activeBranchId ?? null,
    (user.allowedBranches ?? []).map(branch => `${branch.branchId}:${branch.accessLevel ?? ""}`).sort()]);
}

/** A→B→A and close/reopen must not accept a late credential response. */
export function createEmployeeAccountCommandGuard() {
  let generation = 0;
  return {
    capture: () => generation,
    invalidate: () => { generation++; },
    isCurrent: (token: number) => generation === token,
  };
}

export class EmployeeAccountRequestError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string) {
    super(message);
    this.name = "EmployeeAccountRequestError";
  }
}

/** No query/mutation cache, request deduplication, logging, or storage of responses. */
export async function requestEmployeeAccount<T>(url: string, options: {
  method?: "GET" | "POST" | "PUT" | "PATCH"; body?: unknown; signal?: AbortSignal;
} = {}): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener("abort", cancel, { once: true });
  // Keep the deadline through body consumption, not just response headers.
  // A timed-out mutation is NOT retried: the server may have committed it.
  const deadline = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), 30_000);
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    if (!response.ok) {
      let detail = "تعذر تنفيذ الطلب";
      let code: string | undefined;
      try {
        const data: { error?: unknown; code?: unknown } = await response.json();
        if (typeof data.error === "string" && data.error) detail = data.error;
        if (typeof data.code === "string") code = data.code;
      } catch {
        detail = "استجابة غير صالحة من الخادم";
      }
      throw new EmployeeAccountRequestError(response.status, `${detail} (${response.status})`, code);
    }
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(deadline);
    options.signal?.removeEventListener("abort", cancel);
  }
}

export function employeeAccountErrorMessage(error: unknown) {
  if (error instanceof EmployeeAccountRequestError) return error.message;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError"))
    return "انتهت مهلة الطلب. حدّث قائمة الحسابات للتحقق من نتيجة العملية قبل إعادة المحاولة.";
  return "تعذر الاتصال بالخادم. حدّث قائمة الحسابات للتحقق من نتيجة العملية قبل إعادة المحاولة.";
}