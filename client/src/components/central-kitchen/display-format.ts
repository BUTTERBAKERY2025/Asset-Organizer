const NUMBER_LOCALE = "en-US";
const SAUDI_LOCALE = "ar-SA-u-ca-gregory-nu-latn";

export const formatKitchenNumber = (
  value: number | string,
  options: Intl.NumberFormatOptions = { maximumFractionDigits: 6 },
) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat(NUMBER_LOCALE, options).format(numeric)
    : String(value);
};

export const formatKitchenSaudiDateTime = (
  input: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  },
) => {
  if (!input) return "—";
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  return new Intl.DateTimeFormat(SAUDI_LOCALE, {
    timeZone: "Asia/Riyadh",
    ...options,
  }).format(date);
};
