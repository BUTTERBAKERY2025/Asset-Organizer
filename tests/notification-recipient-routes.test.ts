import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { publicRecipientNotice } from "../shared/notification-recipient";

const file = ts.createSourceFile("server/routes.ts", readFileSync("server/routes.ts", "utf8"), ts.ScriptTarget.Latest, true);
function recipientHandler(method: "get" | "post", path: string, storage: object,
  notificationRecipientBranches: (req: any) => Promise<string[]> = async () => ["a"]) {
  let handler: ts.ArrowFunction | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(file) === "app" && node.expression.name.text === method &&
      ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === path) {
      const candidate = node.arguments.at(-1);
      if (candidate && ts.isArrowFunction(candidate)) handler = candidate;
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (!handler) throw new Error(`No ${method} ${path} handler`);
  const expression = handler.getText(file)
    .replaceAll('await import("./notification-receiver-access")', "deps")
    .replaceAll('await import("@shared/notification-recipient")', "deps");
  const compiled = ts.transpileModule(`const handler = ${expression};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function("storage", "deps", `${compiled}; return handler;`)(
    storage, { notificationRecipientBranches, publicRecipientNotice }) as (req: any, res: any) => Promise<void>;
}
function res() {
  const result: any = { status: vi.fn(() => result), json: vi.fn(), setHeader: vi.fn() };
  return result;
}
const req = (id: string) => ({ params: { id }, session: { userId: "u" }, currentUser: { id: "u" } });

describe("actual recipient endpoint handlers", () => {
  it("returns only display fields without the other recipients or internal push keys", async () => {
    const storage = { getActiveNotificationsForUserInBranches: vi.fn(async () => [{
      id: 1, content: "Visible", targetUserIds: ["SECRET"], createdBy: "SECRET", buttonText: "افتح",
      buttonAction: "/source", pushClaimedAt: "SECRET",
    }]) };
    const handler = recipientHandler("get", "/api/active-notifications", storage);
    const result = res();
    await handler(req(""), result);
    expect(result.json.mock.calls[0][0][0]).toMatchObject({ id: 1, content: "Visible", buttonAction: "/source" });
    expect(JSON.stringify(result.json.mock.calls[0][0])).not.toContain("SECRET");
    expect(storage.getActiveNotificationsForUserInBranches).toHaveBeenCalledWith("u", ["a"]);
    expect(result.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it.each(["read", "dismiss"] as const)("rejects revoked/not-targeted %s IDs even if globally present", async (action) => {
    const storage = {
      getActiveNotificationsForUserInBranches: vi.fn(async () => [{ id: 4 }]),
      markNotificationRead: vi.fn(), dismissNotification: vi.fn(),
    };
    const handler = recipientHandler("post", `/api/system-notifications/:id/${action}`, storage);
    const result = res();
    await handler(req("5"), result);
    expect(result.status).toHaveBeenCalledWith(403);
    expect(storage.getActiveNotificationsForUserInBranches).toHaveBeenCalledWith("u", ["a"], true);
    expect(storage.markNotificationRead).not.toHaveBeenCalled();
    expect(storage.dismissNotification).not.toHaveBeenCalled();
    await handler(req("4extra"), res());
    expect(storage.getActiveNotificationsForUserInBranches).toHaveBeenCalledTimes(1);
    const granted = res();
    await handler(req("4"), granted);
    expect(storage[action === "read" ? "markNotificationRead" : "dismissNotification"]).toHaveBeenCalledWith(4, "u");
  });
  it("never falls back to a different branch after session revocation", async () => {
    const storage = { getActiveNotificationsForUserInBranches: vi.fn(), markNotificationRead: vi.fn() };
    const denied = async () => { throw Object.assign(new Error("Revoked"), { status: 403 }); };
    await recipientHandler("post", "/api/system-notifications/:id/read", storage, denied)(req("4"), res());
    expect(storage.getActiveNotificationsForUserInBranches).not.toHaveBeenCalled();
    expect(storage.markNotificationRead).not.toHaveBeenCalled();
  });
});