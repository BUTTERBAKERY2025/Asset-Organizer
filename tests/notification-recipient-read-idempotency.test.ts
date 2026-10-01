import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificationReads } from "../shared/schema";

const state = vi.hoisted(() => ({
  entries: new Map<string, any>(),
  updates: vi.fn(),
  inserts: vi.fn(),
}));
vi.mock("../server/db", () => ({
  pool: {},
  db: {
    insert: (table: unknown) => {
      state.inserts(table);
      return {
        values: (value: any) => ({
          onConflictDoUpdate: (options: any) => {
            state.updates(options);
            return { returning: async () => {
              const key = `${value.notificationId}:${value.userId}`;
              const previous = state.entries.get(key);
              const row = previous
                ? { ...previous, dismissed: options.set.dismissed === true || previous.dismissed }
                : { ...value, id: state.entries.size + 1 };
              state.entries.set(key, row);
              return [row];
            } };
          },
        }),
      };
    },
  },
}));
import { DatabaseStorage } from "../server/storage";

beforeEach(() => { state.entries.clear(); state.inserts.mockClear(); state.updates.mockClear(); });
describe("notification receipt uniqueness", () => {
  it("atomically deduplicates concurrent reads with the unique recipient key", async () => {
    const storage = new DatabaseStorage();
    const [a, b] = await Promise.all([storage.markNotificationRead(3, "u"), storage.markNotificationRead(3, "u")]);
    expect(a.id).toBe(b.id);
    expect(state.entries.size).toBe(1);
    expect(state.inserts).toHaveBeenCalledWith(notificationReads);
    expect(state.updates).toHaveBeenCalledTimes(2);
    for (const [{ target }] of state.updates.mock.calls)
      expect(target).toEqual([notificationReads.notificationId, notificationReads.userId]);
  });
  it("never undismisses a receipt when a late read retry races dismissal", async () => {
    const storage = new DatabaseStorage();
    await storage.dismissNotification(3, "u");
    expect((await storage.markNotificationRead(3, "u")).dismissed).toBe(true);
    expect((await storage.dismissNotification(3, "u")).dismissed).toBe(true);
    expect(state.entries.size).toBe(1);
  });
});