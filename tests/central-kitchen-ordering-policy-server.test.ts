import { describe, expect, it } from "vitest";
import {
  CENTRAL_KITCHEN_ORDERING_POLICY_SETTING_KEY,
  CentralKitchenOrderingPolicyError,
  canManageCentralKitchenOrderingPolicy,
  loadCentralKitchenOrderingPolicy,
  parseCentralKitchenOrderingPolicyBody,
  registerCentralKitchenOrderingPolicyPutRoute,
  saveCentralKitchenOrderingPolicy,
} from "../server/central-kitchen-ordering-policy";
import { PORTAL_SETTING_KEYS } from "../shared/schema";

function queryResult<T>(result: T) {
  const builder: any = {
    from: () => builder,
    where: () => builder,
    limit: () => Promise.resolve(result),
  };
  return builder;
}

describe("persisted central kitchen ordering policy", () => {
  it("uses only the canonical kitchen manager roles", () => {
    expect(canManageCentralKitchenOrderingPolicy("admin")).toBe(true);
    expect(canManageCentralKitchenOrderingPolicy("operations_manager")).toBe(true);
    expect(canManageCentralKitchenOrderingPolicy("production_development_manager")).toBe(true);
    expect(canManageCentralKitchenOrderingPolicy("branch_manager")).toBe(false);
    expect(canManageCentralKitchenOrderingPolicy("kitchen_manager")).toBe(false);
  });

  it("does not expose the namespaced value through general portal settings", () => {
    expect(Object.values(PORTAL_SETTING_KEYS))
      .not.toContain(CENTRAL_KITCHEN_ORDERING_POLICY_SETTING_KEY);
  });

  it("defaults only when the namespaced setting is absent and rejects corruption", async () => {
    await expect(loadCentralKitchenOrderingPolicy({
      select: () => queryResult([]),
      insert: () => null,
    })).resolves.toEqual({
      requestDeadline: "17:00", reviewTime: "19:00", defaultNeededTime: "07:00",
    });
    await expect(loadCentralKitchenOrderingPolicy({
      select: () => queryResult([{ value: "{\"requestDeadline\":\"bad\"}" }]),
      insert: () => null,
    })).rejects.toMatchObject({ kind: "corrupt" });
  });

  it("validates the exact PUT body", () => {
    expect(parseCentralKitchenOrderingPolicyBody({
      requestDeadline: "16:00", reviewTime: "18:00", defaultNeededTime: "06:30",
    })).toEqual({
      requestDeadline: "16:00", reviewTime: "18:00", defaultNeededTime: "06:30",
    });
    expect(parseCentralKitchenOrderingPolicyBody({
      requestDeadline: "20:00", reviewTime: "18:00", defaultNeededTime: "06:30",
    })).toBeNull();
  });

  it("atomically writes one namespaced JSON value and its audit record", async () => {
    const inserted: Array<{ table: unknown; value: any }> = [];
    const tx: any = {
      select: () => queryResult([]),
      insert: (table: unknown) => {
        const builder: any = {
          values: (value: any) => {
            inserted.push({ table, value });
            return builder;
          },
          onConflictDoUpdate: () => Promise.resolve(),
          then: (resolve: (value: unknown) => unknown) => Promise.resolve().then(() => resolve(undefined)),
        };
        return builder;
      },
    };
    const database: any = {
      ...tx,
      transaction: async (callback: (executor: any) => Promise<any>) => callback(tx),
    };
    const policy = { requestDeadline: "16:00", reviewTime: "18:00", defaultNeededTime: "06:30" };
    await expect(saveCentralKitchenOrderingPolicy(database, policy, { id: "actor-1" }))
      .resolves.toEqual(policy);
    expect(inserted).toHaveLength(2);
    expect(inserted[0].value).toEqual({
      key: CENTRAL_KITCHEN_ORDERING_POLICY_SETTING_KEY,
      value: JSON.stringify(policy),
    });
    expect(inserted[1].value).toMatchObject({
      module: "central_kitchen_orders",
      entityId: CENTRAL_KITCHEN_ORDERING_POLICY_SETTING_KEY,
      action: "update",
      userId: "actor-1",
    });
  });

  it("enforces edit middleware and manager roles through the registered PUT handler", async () => {
    const inserted: Array<{ table: unknown; value: any }> = [];
    const tx: any = {
      select: () => queryResult([]),
      insert: (table: unknown) => {
        const builder: any = {
          values: (value: any) => {
            inserted.push({ table, value });
            return builder;
          },
          onConflictDoUpdate: () => Promise.resolve(),
          then: (resolve: (value: unknown) => unknown) => Promise.resolve().then(() => resolve(undefined)),
        };
        return builder;
      },
    };
    const database: any = {
      ...tx,
      transaction: async (callback: (executor: any) => Promise<any>) => callback(tx),
    };
    let handlers: any[] = [];
    const app: any = {
      put: (path: string, ...registered: any[]) => {
        expect(path).toBe("/api/central-kitchen-orders/policy");
        handlers = registered;
      },
    };
    const authenticated = (_req: any, _res: any, next: () => void) => next();
    const requireEdit = (req: any, res: any, next: () => void) =>
      req.hasEdit ? next() : res.status(403).json({ error: "missing edit" });
    registerCentralKitchenOrderingPolicyPutRoute(
      app,
      database,
      authenticated,
      requireEdit,
      req => req.user,
    );

    const invoke = async (role: string, hasEdit: boolean, branchId = "foreign-branch") => {
      let status = 200;
      let output: any;
      const req: any = {
        user: { id: `${role}-1`, role, username: role },
        hasEdit,
        body: { requestDeadline: "16:00", reviewTime: "18:00", defaultNeededTime: "08:30" },
        params: { branchId },
        ip: "127.0.0.1",
        get: () => "vitest",
      };
      const res: any = {
        set: () => res,
        status: (value: number) => { status = value; return res; },
        json: (value: any) => { output = value; return res; },
      };
      let index = 0;
      const next = async (): Promise<void> => {
        const handler = handlers[index++];
        if (handler) await handler(req, res, next);
      };
      await next();
      return { status, output };
    };

    for (const role of ["admin", "operations_manager", "production_development_manager"]) {
      const result = await invoke(role, true);
      expect(result.status).toBe(200);
      expect(result.output).toMatchObject({ defaultNeededTime: "08:30" });
    }
    expect((await invoke("branch_manager", true)).status).toBe(403);
    expect((await invoke("employee", true)).status).toBe(403);
    expect((await invoke("admin", false)).status).toBe(403);
    expect(inserted).toHaveLength(6);
    expect(inserted.filter(entry => entry.value?.branchId !== undefined)).toEqual([]);
  });

  it("surfaces database failures instead of silently using defaults", async () => {
    const failure = loadCentralKitchenOrderingPolicy({
      select: () => { throw new Error("offline"); },
      insert: () => null,
    });
    await expect(failure).rejects.toBeInstanceOf(CentralKitchenOrderingPolicyError);
    await expect(failure).rejects.toMatchObject({ kind: "database" });
  });
});