import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "http";
import {
  buildCashierDailyChallengeToday,
  calculateCashierChallengeActual,
  type CashierDailyChallengeDefinition,
  type CashierDailyChallengeJournal,
} from "@shared/cashier-daily-challenges";

const routeMocks = vi.hoisted(() => {
  const state = {
    currentUserId: null as string | null,
    employees: {} as Record<string, any>,
    journals: [] as any[],
    challenges: [] as any[],
    settings: {
      isActive: true,
      seasonalMultiplier: 1,
      maxDailyPoints: null as number | null,
    } as any,
  };

  const db = {
    select: vi.fn((selection?: unknown) => {
      const builder: any = {
        from: vi.fn(() => builder),
        where: vi.fn(() => builder),
        limit: vi.fn(async () => {
          // getMyEmployee calls select() without a projection; every other
          // query used by this endpoint supplies one.
          if (selection !== undefined) return state.journals;
          const employee = state.currentUserId ? state.employees[state.currentUserId] : undefined;
          return employee ? [employee] : [];
        }),
        orderBy: vi.fn(async () => state.journals),
      };
      return builder;
    }),
  };

  const storage = {
    getActiveDailyChallenges: vi.fn(async () => state.challenges),
    getPointSettings: vi.fn(async () => state.settings),
  };

  return { state, db, storage };
});

vi.mock("../server/db", () => ({ db: routeMocks.db, pool: {} }));
vi.mock("../server/storage", () => ({ storage: routeMocks.storage }));
vi.mock("../server/auth", () => {
  const pass = () => (_req: any, _res: any, next: any) => next();
  return {
    isAuthenticated: (req: any, _res: any, next: any) => {
      req.currentUser = routeMocks.state.currentUserId
        ? { id: routeMocks.state.currentUserId }
        : undefined;
      next();
    },
    requirePermission: pass,
    requireAnyPermission: pass,
    getEffectiveBranchFilter: () => ({ hasAccess: true, singleBranchId: undefined }),
    parseUserAgent: () => ({ browser: "test", os: "test", device: "test" }),
    getCachedPermissionsForUser: () => [],
    HR_SPECIALIST_PERMISSIONS: {},
  };
});

const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Riyadh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

function journal(overrides: Partial<CashierDailyChallengeJournal> = {}): CashierDailyChallengeJournal {
  return {
    id: 10,
    branchId: "branch-a",
    cashierId: "cashier-a",
    journalDate: date,
    shiftType: "morning",
    averageTicket: 0,
    totalSales: 1200,
    transactionCount: 40,
    customerCount: 35,
    ...overrides,
  };
}

function challenge(
  overrides: Partial<CashierDailyChallengeDefinition> = {},
): CashierDailyChallengeDefinition {
  return {
    id: 1,
    name: "متوسط الفاتورة",
    challengeType: "avg_ticket",
    branchId: null,
    cashierId: null,
    targetValue: 30,
    basePoints: 10,
    bonusPointsPerUnit: 1,
    shiftType: null,
    isActive: true,
    validFrom: date,
    validTo: date,
    ...overrides,
  };
}

describe("cashier daily challenge progress helper", () => {
  it("shows a zero target as achieved only when a saved journal exists", () => {
    const input = {
      date, branchId: "branch-a", cashierId: "cashier-a",
      challenges: [challenge({ targetValue: 0, bonusPointsPerUnit: 0 })],
      settings: { isActive: true, seasonalMultiplier: 1, maxDailyPoints: null },
    };
    expect(buildCashierDailyChallengeToday({ ...input, journals: [journal()] })
      .journals[0].challenges[0]).toMatchObject({ progress: 100, expectedPoints: 10 });
    expect(buildCashierDailyChallengeToday({ ...input, journals: [] })
      .journals[0].challenges[0]).toMatchObject({ progress: 0, expectedPoints: 0 });
  });

  it("uses the journal incentive average-ticket fallback and caps progress at 100", () => {
    expect(calculateCashierChallengeActual("avg_ticket", journal())).toBe(30);
    const result = buildCashierDailyChallengeToday({
      date,
      branchId: "branch-a",
      cashierId: "cashier-a",
      journals: [journal()],
      challenges: [challenge()],
      settings: { isActive: true, seasonalMultiplier: 1, maxDailyPoints: null },
    });

    expect(result.journals[0].challenges[0]).toEqual({
      id: 1,
      name: "متوسط الفاتورة",
      challengeType: "avg_ticket",
      target: 30,
      actual: 30,
      progress: 100,
      expectedPoints: 10,
    });
  });

  it("applies the seasonal multiplier and the per-journal daily cap without writing anything", () => {
    const result = buildCashierDailyChallengeToday({
      date,
      branchId: "branch-a",
      cashierId: "cashier-a",
      journals: [journal({ id: 11, totalSales: 200, transactionCount: 2 })],
      challenges: [
        challenge({ id: 1, challengeType: "shift_sales", targetValue: 100, basePoints: 10, bonusPointsPerUnit: 0 }),
        challenge({ id: 2, challengeType: "customer_count", targetValue: 1, basePoints: 10, bonusPointsPerUnit: 0 }),
      ],
      settings: { isActive: true, seasonalMultiplier: 2, maxDailyPoints: 15 },
    });

    expect(result.journals[0].challenges.map((item) => item.expectedPoints)).toEqual([7, 7]);
  });

  it("filters scope/date/cashier and shift-specific challenges, while showing generic challenges in a no-journal row", () => {
    const result = buildCashierDailyChallengeToday({
      date,
      branchId: "branch-a",
      cashierId: "cashier-a",
      journals: [],
      challenges: [
        challenge({ id: 1 }),
        challenge({ id: 2, shiftType: "evening" }),
        challenge({ id: 3, cashierId: "cashier-b" }),
        challenge({ id: 4, branchId: "branch-b" }),
        challenge({ id: 5, validTo: "2000-01-01" }),
        challenge({ id: 6, isActive: false }),
      ],
      settings: undefined,
    });

    expect(result.settingsActive).toBe(false);
    expect(result.journals).toHaveLength(1);
    expect(result.journals[0]).toMatchObject({ id: 0, shiftType: null });
    expect(result.journals[0].challenges.map((item) => item.id)).toEqual([1]);
    expect(result.journals[0].challenges[0]).toMatchObject({
      actual: 0,
      progress: 0,
      expectedPoints: 0,
    });
  });

  it("keeps journals separate and matches only their own shifts", () => {
    const result = buildCashierDailyChallengeToday({
      date,
      branchId: "branch-a",
      cashierId: "cashier-a",
      journals: [
        journal({ id: 10, shiftType: "morning", totalSales: 100 }),
        journal({ id: 11, shiftType: "evening", totalSales: 200 }),
        journal({ id: 12, cashierId: "cashier-b" }),
        journal({ id: 13, journalDate: "2035-06-14" }),
      ],
      challenges: [
        challenge({ id: 1, challengeType: "shift_sales", targetValue: 50, shiftType: "morning" }),
        challenge({ id: 2, challengeType: "shift_sales", targetValue: 150, shiftType: "evening" }),
        challenge({ id: 3, challengeType: "shift_sales", targetValue: 1, shiftType: null }),
      ],
      settings: { isActive: true, seasonalMultiplier: 1, maxDailyPoints: null },
    });

    expect(result.journals.map((item) => item.id)).toEqual([10, 11]);
    expect(result.journals[0].challenges.map((item) => item.id)).toEqual([1, 3]);
    expect(result.journals[1].challenges.map((item) => item.id)).toEqual([2, 3]);
  });
});

describe("GET /api/my/challenges/today isolation", () => {
  let server: Server;
  let base: string;
  let registerSelfServiceRoutes: (app: express.Express) => void;

  beforeAll(async () => {
    ({ registerSelfServiceRoutes } = await import("../server/self-service-routes"));
    const app = express();
    registerSelfServiceRoutes(app);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("لم يبدأ خادم الاختبار");
    base = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    routeMocks.state.currentUserId = "user-a";
    routeMocks.state.employees = {
      "user-a": { id: 1, branchId: "branch-a", linkedUserId: "user-a", employeeName: "A" },
      "user-b": { id: 2, branchId: "branch-a", linkedUserId: "user-b", employeeName: "B" },
    };
    routeMocks.state.journals = [
      journal({ id: 101, cashierId: "user-a", branchId: "branch-a" }),
      journal({ id: 102, cashierId: "user-a", branchId: "branch-b" }),
      journal({ id: 103, cashierId: "user-b", branchId: "branch-a" }),
      journal({ id: 104, cashierId: "user-a", journalDate: "2000-01-01" }),
    ];
    routeMocks.state.challenges = [
      challenge({
        id: 201,
        name: "own",
        branchId: "branch-a",
        cashierId: "user-a",
        challengeType: "shift_sales",
        targetValue: 100,
      }),
      challenge({
        id: 202,
        name: "other cashier",
        branchId: "branch-a",
        cashierId: "user-b",
        challengeType: "shift_sales",
        targetValue: 1,
      }),
      challenge({
        id: 203,
        name: "other branch",
        branchId: "branch-b",
        cashierId: "user-a",
        challengeType: "shift_sales",
        targetValue: 1,
      }),
      challenge({
        id: 204,
        name: "global generic",
        branchId: null,
        cashierId: null,
        challengeType: "customer_count",
        shiftType: null,
        targetValue: 100,
      }),
    ];
    routeMocks.state.settings = {
      isActive: true,
      seasonalMultiplier: 1,
      maxDailyPoints: null,
    };
    routeMocks.db.select.mockClear();
    routeMocks.storage.getActiveDailyChallenges.mockClear();
    routeMocks.storage.getPointSettings.mockClear();
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function api(path: string) {
    const response = await fetch(`${base}${path}`);
    let json: any = null;
    try { json = await response.json(); } catch { /* no body */ }
    return { status: response.status, headers: response.headers, json };
  }

  it("requires authentication and still sends no-store", async () => {
    routeMocks.state.currentUserId = null;
    const response = await api("/api/my/challenges/today");
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("ignores query-param identity/branch tampering and returns only own branch data", async () => {
    const response = await api("/api/my/challenges/today?userId=user-b&branchId=branch-b&cashierId=user-b");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.json.date).toBe(date);
    expect(response.json.journals.map((item: any) => item.id)).toEqual([101]);
    expect(response.json.journals[0].challenges.map((item: any) => item.id)).toEqual([201, 204]);
    expect(response.json.journals[0].challenges.some((item: any) => item.id === 202 || item.id === 203)).toBe(false);
    expect(Object.keys(response.json.journals[0].challenges[0]).sort()).toEqual([
      "actual",
      "challengeType",
      "expectedPoints",
      "id",
      "name",
      "progress",
      "target",
    ]);
  });

  it("returns no employee data for an unlinked account", async () => {
    routeMocks.state.currentUserId = "unlinked-user";
    const response = await api("/api/my/challenges/today");
    expect(response.status).toBe(200);
    expect(response.json).toEqual({ date, settingsActive: false, journals: [] });
    expect(routeMocks.storage.getActiveDailyChallenges).not.toHaveBeenCalled();
    expect(routeMocks.storage.getPointSettings).not.toHaveBeenCalled();
  });

  it("does not expose another employee's journal or cashier-targeted challenge", async () => {
    routeMocks.state.currentUserId = "user-b";
    const response = await api("/api/my/challenges/today");
    expect(response.status).toBe(200);
    expect(response.json.journals.map((item: any) => item.id)).toEqual([103]);
    expect(response.json.journals[0].challenges.map((item: any) => item.id)).toEqual([202, 204]);
    expect(response.json.journals[0].challenges.some((item: any) => item.id === 201)).toBe(false);
  });
});