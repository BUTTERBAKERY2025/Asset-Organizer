import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("../client/src/lib/queryClient", () => ({ apiRequest: vi.fn() }));
import {
  DailyOrderingNotice, LateSubmissionBadge, OrderScheduleNotice,
} from "../client/src/components/central-kitchen/ordering-schedule";
import { getOrderSchedule } from "../shared/central-kitchen-ordering-policy";

const late = getOrderSchedule({
  neededDate: "2026-09-23", createdAt: "2026-09-22T14:01:00Z", neededTime: "07:00",
});
const onTime = getOrderSchedule({
  neededDate: "2026-09-23", createdAt: "2026-09-22T13:59:00Z", neededTime: "07:00",
});
describe("daily kitchen ordering UI", () => {
  it("displays the agreed Saudi timetable and explains manual operation", () => {
    const html = renderToStaticMarkup(React.createElement(DailyOrderingNotice));
    for (const text of ["5 مساءً", "7 مساءً", "7 صباحاً", "بتوقيت السعودية", "الطلب المتأخر مسموح", "يدوياً"]) {
      expect(html).toContain(text);
    }
  });
  it("warns before submitting late without claiming the order is blocked", () => {
    const html = renderToStaticMarkup(React.createElement(OrderScheduleNotice, { schedule: late, preview: true }));
    expect(html).toContain("يمكنك إرساله");
    expect(html).toContain('role="status"');
    expect(html).toContain("التنبيه مبدئي بحسب توقيت الخادم");
  });
  it("explains the original-submission/current-needed-date rule on saved orders", () => {
    const html = renderToStaticMarkup(React.createElement(OrderScheduleNotice, { schedule: late }));
    expect(html).toContain("وقت الإرسال الأصلي");
    expect(html).toContain("لا يعني اعتماداً تلقائياً");
  });
  it("does not flag an on-time order as late", () => {
    const html = renderToStaticMarkup(React.createElement(OrderScheduleNotice, { schedule: onTime, preview: true }));
    expect(html).not.toContain("تجاوزت موعد");
    expect(renderToStaticMarkup(React.createElement(LateSubmissionBadge, { schedule: onTime }))).toBe("");
  });
  it("uses a submission-specific badge, distinct from an overdue delivery", () => {
    expect(renderToStaticMarkup(React.createElement(LateSubmissionBadge, { schedule: late }))).toContain("أُرسل بعد الموعد");
  });
  it("does not invent a schedule for legacy orders with missing dates", () => {
    expect(renderToStaticMarkup(React.createElement(OrderScheduleNotice, { schedule: null }))).toBe("");
  });
});