import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificationReads, systemNotifications, users } from "../shared/schema";

const state = vi.hoisted(() => ({
  role: "branch_manager",
  notices: [] as any[],
  reads: [] as any[],
  queryTables: [] as unknown[],
  filters: [] as unknown[],
  kitchen: vi.fn(async (_db: unknown, _notice: unknown, ids: string[]) => ids),
  delivery: vi.fn(async (_notice: unknown, ids: string[]) => ids),
  warehouse: vi.fn(async (_db: unknown, _notice: unknown, ids: string[]) => ids),
}));

vi.mock("../server/db", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => {
        state.queryTables.push(table);
        return {
          where: (filter: unknown) => {
            state.filters.push(filter);
            if (table === users) return Promise.resolve([{ role: state.role }]);
            if (table === notificationReads) return Promise.resolve(state.reads);
            if (table === systemNotifications) return {
              orderBy: () => Promise.resolve(state.notices.filter(n =>
                n.isActive && (!n.startDate || n.startDate <= new Date()) &&
                (!n.endDate || n.endDate >= new Date()))),
            };
            throw new Error("Unexpected notification query");
          },
        };
      },
    }),
  },
  pool: {},
}));
vi.mock("../server/central-kitchen-notifications", () => ({
  filterAuthorizedCentralKitchenNotificationUsers: state.kitchen,
}));
vi.mock("../server/delivery-notifications", () => ({
  filterAuthorizedDeliveryNoticeUsers: state.delivery,
}));
vi.mock("../server/warehouse-transfer-notifications", () => ({
  filterAuthorizedWarehouseTransferNotificationUsers: state.warehouse,
}));

import { DatabaseStorage } from "../server/storage";

const notice = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  isActive: true,
  targetAllBranches: false,
  targetBranchIds: ["a"],
  targetUserIds: null,
  targetRoleIds: null,
  accessBranchIds: null,
  showOnce: false,
  displayTimeStart: null,
  displayTimeEnd: null,
  accessModule: null,
  autoSource: null,
  ...overrides,
});

const storage = new DatabaseStorage();
const grants = vi.fn(async () => [{ branchId: "a" }, { branchId: "b" }]);
storage.getUserBranchAccess = grants as any;

beforeEach(() => {
  state.role = "branch_manager";
  state.notices = [];
  state.reads = [];
  state.queryTables = [];
  state.filters = [];
  state.kitchen.mockClear();
  state.delivery.mockClear();
  state.warehouse.mockClear();
  grants.mockClear();
});

describe("bulk notification retrieval", () => {
  it("is the ordered union of single-branch results, preserving exact user bypass, role and global targets", async () => {
    state.notices = [
      notice(1),
      notice(2, { targetBranchIds: ["b"] }),
      notice(3, { targetBranchIds: ["c"] }),
      notice(4, { targetBranchIds: ["c"], targetRoleIds: ["admin"], targetUserIds: ["u"] }),
      notice(5, { targetUserIds: ["other"], targetAllBranches: true }),
      notice(6, { targetAllBranches: true, targetRoleIds: ["branch_manager"] }),
      notice(7, { targetAllBranches: true, targetRoleIds: ["admin"] }),
      notice(8, { targetBranchIds: ["a", "b"] }),
    ];
    const singleA = await storage.getActiveNotificationsForUser("u", "a");
    const singleB = await storage.getActiveNotificationsForUser("u", "b");
    state.queryTables = [];
    const bulk = await storage.getActiveNotificationsForUserInBranches("u", ["a", "b", "a"]);
    expect(bulk.map(n => n.id)).toEqual([1, 2, 4, 6, 8]);
    expect(bulk.map(n => n.id).sort((a, b) => a - b))
      .toEqual([...new Set([...singleA, ...singleB].map(n => n.id))].sort((a, b) => a - b));
    expect(state.queryTables).toEqual([users, systemNotifications, notificationReads]);
    expect(await storage.getActiveNotificationsForUserInBranches("u", [])).toEqual([]);
    expect(state.queryTables).toHaveLength(3);
    expect((await storage.getActiveNotificationsForUser("u", undefined as unknown as string)).map(n => n.id))
      .toEqual([4, 6]);
  });

  it("intersects explicit/access branches with fresh operations grants without overriding exact-user branch bypass", async () => {
    state.role = "operations_manager";
    state.notices = [
      notice(1, { targetUserIds: ["u"], targetBranchIds: ["c"], accessBranchIds: ["b"] }),
      notice(2, { targetUserIds: ["u"], targetAllBranches: true, accessBranchIds: ["c"] }),
      notice(3, { targetBranchIds: ["c"] }),
      notice(4, { targetBranchIds: ["b"], accessBranchIds: ["c"] }),
      notice(5, { targetAllBranches: true }),
      notice(6, { targetBranchIds: ["b"] }),
    ];
    const singleA = await storage.getActiveNotificationsForUser("u", "a");
    const singleB = await storage.getActiveNotificationsForUser("u", "b");
    expect((await storage.getActiveNotificationsForUserInBranches("u", ["a", "b"])).map(n => n.id))
      .toEqual([...new Set([...singleA, ...singleB].map(n => n.id))]);
    expect((await storage.getActiveNotificationsForUserInBranches("u", ["a", "b"])).map(n => n.id))
      .toEqual([1, 5, 6]);
    grants.mockClear();
    state.queryTables = [];
    await storage.getActiveNotificationsForUserInBranches("u",
      Array.from({ length: 14 }, (_, index) => index === 0 ? "a" : `branch-${index}`));
    expect(grants).toHaveBeenCalledTimes(1);
    expect(state.queryTables).toEqual([users, systemNotifications, notificationReads]);
    grants.mockResolvedValueOnce([]);
    expect(await storage.getActiveNotificationsForUserInBranches("u", ["a"])).toEqual([]);
  });

  it("keeps active/date/read filtering and authorizes each workflow notice once regardless of branch count", async () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    state.notices = [
      notice(1, { targetAllBranches: true, accessModule: "central_kitchen_orders" }),
      notice(2, { targetAllBranches: true, accessModule: "warehouse", autoSource: "warehouse_material_transfer" }),
      notice(3, { targetAllBranches: true, accessModule: "delivery_tasks", autoSource: "delivery_task" }),
      notice(4, { showOnce: true }), notice(5), notice(6, { isActive: false }),
      notice(7, { endDate: past }), notice(8, { startDate: future }),
    ];
    state.reads = [{ notificationId: 4, dismissed: false }, { notificationId: 5, dismissed: true }];
    state.kitchen.mockResolvedValue([]);
    const branches = Array.from({ length: 14 }, (_, i) => i === 0 ? "a" : `branch-${i}`);
    const result = await storage.getActiveNotificationsForUserInBranches("u", branches);
    expect(result.map(n => n.id)).toEqual([2, 3]);
    expect(state.queryTables).toEqual([users, systemNotifications, notificationReads]);
    expect(state.kitchen).toHaveBeenCalledTimes(1);
    expect(state.delivery).toHaveBeenCalledTimes(1);
    expect(state.warehouse).toHaveBeenCalledTimes(1);
    expect(state.kitchen).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 1 }), ["u"]);
    expect(state.delivery).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }), ["u"]);
  });
});