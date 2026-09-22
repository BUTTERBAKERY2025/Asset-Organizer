export type QueueOrder = {
  status: string;
  neededDate?: string;
  neededTime?: string;
  discrepancyStatus?: string;
};

export type OrderQueueStage = "attention" | "requested" | "approved" | "prepared" | "dispatched" | "archive" | "all";

const ACTIVE_STATUSES = ["requested", "pending", "draft", "approved", "prepared", "dispatched", "received", "cancelled"];

export const normalizeQueueStatus = (status: string) =>
  status?.toLowerCase().replaceAll(" ", "_") || "pending";

export const saudiDateValue = (now: Date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

export const neededAtSaudi = (order: QueueOrder) => {
  if (!order.neededDate) return null;
  const time = /^\d{2}:\d{2}$/.test(order.neededTime || "") ? order.neededTime : "23:59";
  const value = new Date(`${order.neededDate}T${time}:00+03:00`);
  return Number.isNaN(value.getTime()) ? null : value;
};

export const isOrderOverdue = (order: QueueOrder, now: Date = new Date()) => {
  const status = normalizeQueueStatus(order.status);
  if (status === "cancelled" || status === "received") return false;
  const neededAt = neededAtSaudi(order);
  return neededAt !== null && neededAt.getTime() < now.getTime();
};

export const queueOrderNeedsAttention = (order: QueueOrder, now: Date = new Date()) => {
  const status = normalizeQueueStatus(order.status);
  if (status === "cancelled") return false;
  if (status === "received") return order.discrepancyStatus === "open";
  return isOrderOverdue(order, now);
};

export const matchesOrderQueueStage = (order: QueueOrder, stage: OrderQueueStage, now: Date = new Date()) => {
  const status = normalizeQueueStatus(order.status);
  if (stage === "attention") return queueOrderNeedsAttention(order, now);
  if (stage === "requested") return ["requested", "pending", "draft"].includes(status);
  if (stage === "archive") {
    return status === "cancelled"
      || (status === "received" && order.discrepancyStatus !== "open")
      || !ACTIVE_STATUSES.includes(status);
  }
  if (stage === "all") return true;
  return status === stage;
};

export const matchesSaudiNeededDate = (
  order: QueueOrder,
  filter: "all" | "today" | "past" | "future",
  now: Date = new Date(),
) => {
  if (filter === "all") return true;
  if (!order.neededDate) return false;
  const today = saudiDateValue(now);
  if (filter === "today") return order.neededDate === today;
  if (filter === "past") return order.neededDate < today;
  return order.neededDate > today;
};