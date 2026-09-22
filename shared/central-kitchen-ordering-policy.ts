export const CENTRAL_KITCHEN_ORDERING_TIME_ZONE = "Asia/Riyadh";
export const CENTRAL_KITCHEN_DEFAULT_NEEDED_TIME = "07:00";
export const CENTRAL_KITCHEN_REQUEST_DEADLINE = "17:00";
export const CENTRAL_KITCHEN_REVIEW_TIME = "19:00";

export type CentralKitchenOrderingSchedule = {
  isLate: boolean;
  cutoffAt: string;
  reviewAt: string;
  deliveryAt: string;
};

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}

function parseCalendarDate(value: string): { year: number; month: number; day: number } | null {
  const match = CALENDAR_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? { year, month, day }
    : null;
}

function riyadhInstant(
  date: { year: number; month: number; day: number },
  time: string,
  dayOffset = 0,
): Date | null {
  const match = CLOCK_TIME.exec(time);
  if (!match) return null;
  return new Date(Date.UTC(
    date.year,
    date.month - 1,
    date.day + dayOffset,
    Number(match[1]) - 3,
    Number(match[2]),
  ));
}

function riyadhDate(now: Date): string {
  return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function shiftCalendarDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getOrderingPolicy(now = new Date()) {
  return {
    serverNow: now.toISOString(),
    defaultNeededDate: shiftCalendarDate(riyadhDate(now), 1),
    defaultNeededTime: CENTRAL_KITCHEN_DEFAULT_NEEDED_TIME,
    requestDeadline: CENTRAL_KITCHEN_REQUEST_DEADLINE,
    reviewTime: CENTRAL_KITCHEN_REVIEW_TIME,
    timeZone: CENTRAL_KITCHEN_ORDERING_TIME_ZONE,
  };
}

export function getOrderSchedule(
  order: {
    neededDate: string | null | undefined;
    neededTime?: string | null;
    createdAt: Date | string | null | undefined;
  },
  _now = new Date(),
): CentralKitchenOrderingSchedule | null {
  if (!order.neededDate) return null;
  const neededDate = parseCalendarDate(order.neededDate);
  const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt || "");
  if (!neededDate || !isValidDate(createdAt)) return null;

  const cutoffAt = riyadhInstant(neededDate, CENTRAL_KITCHEN_REQUEST_DEADLINE, -1);
  const reviewAt = riyadhInstant(neededDate, CENTRAL_KITCHEN_REVIEW_TIME, -1);
  const deliveryAt = riyadhInstant(
    neededDate,
    order.neededTime ?? CENTRAL_KITCHEN_DEFAULT_NEEDED_TIME,
  );
  if (!cutoffAt || !reviewAt || !deliveryAt) return null;

  return {
    isLate: createdAt.getTime() > cutoffAt.getTime(),
    cutoffAt: cutoffAt.toISOString(),
    reviewAt: reviewAt.toISOString(),
    deliveryAt: deliveryAt.toISOString(),
  };
}