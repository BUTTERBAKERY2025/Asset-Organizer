export const RIYADH_TIME_ZONE = "Asia/Riyadh";

/** HH:mm in Saudi Arabia, independent of the server/process timezone. */
export function riyadhTimeShort(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: RIYADH_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  if (!hour || !minute) throw new Error("Unable to format Asia/Riyadh time");
  return `${hour}:${minute}`;
}

const DAILY_TIME_PATTERN = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Inclusive daily window in Saudi time; an end before the start crosses midnight. */
export function isWithinRiyadhDailyWindow(
  start: string | null | undefined,
  end: string | null | undefined,
  now = new Date(),
): boolean {
  // Missing bounds are open ends; present but malformed bounds must not expose a notification.
  if ((start != null && !DAILY_TIME_PATTERN.test(start)) ||
      (end != null && !DAILY_TIME_PATTERN.test(end))) return false;
  const time = riyadhTimeShort(now);
  if (start == null) return end == null || time <= end;
  if (end == null) return time >= start;
  return start <= end
    ? time >= start && time <= end
    : time >= start || time <= end;
}