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