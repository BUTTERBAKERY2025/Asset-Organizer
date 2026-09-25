import { describe, expect, it, vi } from "vitest";

vi.mock("../server/storage", () => ({ storage: {
  getUserPermissions: vi.fn(async () => []),
} }));
vi.mock("../server/db", () => ({ db: {}, pool: {} }));
vi.mock("../server/security", () => ({ isLoginBlocked: vi.fn(), trackLoginAttempt: vi.fn() }));
vi.mock("../server/shareholder-security", () => ({
  getTwoFactorConfig: vi.fn(), issueOtpForUser: vi.fn(),
  verifyOtpForUser: vi.fn(), logShareholderActivity: vi.fn(),
}));

import { JOB_ROLE_PERMISSION_TEMPLATES } from "../shared/schema";
import { requirePermission, requireAnyPermission } from "../server/auth";

async function authorize(
  handler: ReturnType<typeof requirePermission>,
  role: string,
  jobTitle: string,
  method = "GET",
) {
  const next = vi.fn();
  const response: any = { status: vi.fn(() => response), json: vi.fn() };
  await handler({
    currentUser: { id: "delivery-test", role, jobTitle },
    method,
  } as any, response, next);
  return { next, response };
}

describe("delivery job title runtime permissions", () => {
  it("matches only the view/edit actions in the delivery template", () => {
    const entry = JOB_ROLE_PERMISSION_TEMPLATES.delivery.find((p) => p.module === "delivery_tasks");
    expect(entry?.actions).toEqual(["view", "edit"]);
  });

  it("allows existing employee drivers to view and update only delivery tasks", async () => {
    for (const action of ["view", "edit"] as const) {
      expect((await authorize(requirePermission("delivery_tasks", action), "employee", "delivery")).next).toHaveBeenCalledOnce();
      expect((await authorize(requireAnyPermission("delivery_tasks", ["delete", action]), "employee", "delivery")).next).toHaveBeenCalledOnce();
    }
    expect((await authorize(requirePermission("delivery_tasks"), "employee", "delivery", "GET")).next).toHaveBeenCalledOnce();
    expect((await authorize(requirePermission("delivery_tasks"), "employee", "delivery", "PATCH")).next).toHaveBeenCalledOnce();
    for (const method of ["POST", "DELETE"]) {
      expect((await authorize(requirePermission("delivery_tasks"), "employee", "delivery", method)).response.status).toHaveBeenCalledWith(403);
    }
    for (const action of ["create", "approve", "export", "delete"]) {
      expect((await authorize(requirePermission("delivery_tasks", action), "employee", "delivery")).response.status).toHaveBeenCalledWith(403);
    }
    expect((await authorize(requireAnyPermission("delivery_tasks", ["create", "approve"]), "employee", "delivery")).response.status).toHaveBeenCalledWith(403);
    expect((await authorize(requirePermission("users", "view"), "employee", "delivery")).response.status).toHaveBeenCalledWith(403);
  });

  it("does not grant access by job title to viewer roles or other employees", async () => {
    expect((await authorize(requirePermission("delivery_tasks", "edit"), "viewer", "delivery")).response.status).toHaveBeenCalledWith(403);
    expect((await authorize(requireAnyPermission("delivery_tasks", ["edit"]), "viewer", "delivery")).response.status).toHaveBeenCalledWith(403);
    expect((await authorize(requirePermission("delivery_tasks", "view"), "employee", "cashier")).response.status).toHaveBeenCalledWith(403);
    expect((await authorize(requireAnyPermission("delivery_tasks", ["view"]), "employee", "cashier")).response.status).toHaveBeenCalledWith(403);
  });
});