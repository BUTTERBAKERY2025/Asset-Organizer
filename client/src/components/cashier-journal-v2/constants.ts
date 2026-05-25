import type { PaymentMethod } from "@shared/schema";

export const CARD_NETWORKS: Array<{
  method: PaymentMethod;
  label: string;
  abbr: string;
  bg: string;
  text: string;
}> = [
  { method: "mada", label: "مدى", abbr: "مدى", bg: "#534AB7", text: "#FFFFFF" },
  { method: "visa", label: "فيزا", abbr: "VISA", bg: "#185FA5", text: "#FFFFFF" },
  { method: "mastercard", label: "ماستركارد", abbr: "MC", bg: "#993C1D", text: "#FFFFFF" },
];

export const QUICK_CARDS: Array<{ method: PaymentMethod; label: string }> = [
  { method: "apple_pay", label: "Apple Pay" },
  { method: "stc_pay", label: "STC Pay" },
  { method: "card", label: "بطاقة أخرى" },
];

export const DELIVERY_COMPANIES: Array<{
  method: PaymentMethod;
  label: string;
  latin: string;
  abbr: string;
  bg: string;
  defaultCommission: number;
}> = [
  { method: "jahez", label: "جاهز", latin: "Jahez", abbr: "جاهز", bg: "#185FA5", defaultCommission: 20 },
  { method: "hunger_station", label: "هنقرستيشن", latin: "HungerStation", abbr: "HS", bg: "#BA7517", defaultCommission: 22 },
  { method: "toyou", label: "ToYou", latin: "تويو", abbr: "ToYou", bg: "#D4537E", defaultCommission: 18 },
  { method: "keeta", label: "كيتا", latin: "Keeta", abbr: "كيتا", bg: "#1D9E75", defaultCommission: 19 },
  { method: "marsool", label: "مرسل", latin: "Mursil", abbr: "مرسل", bg: "transparent", defaultCommission: 20 },
];

export const QUICK_DELIVERY: Array<{ method: PaymentMethod; label: string }> = [
  { method: "the_chefs", label: "ذا شيفز" },
  { method: "talabat", label: "طلبات" },
  { method: "delivery_app", label: "تطبيق آخر" },
];

export const CHANNEL_COLORS = {
  cash: "#534AB7",
  cards: "#1D9E75",
  delivery: "#185FA5",
  credit: "#BA7517",
} as const;

export const TOLERANCE_SAR = 10;

export const STEPS = [
  { id: 1, label: "معلومات الوردية" },
  { id: 2, label: "المبيعات والدفع" },
  { id: 3, label: "المراجعة والحفظ" },
] as const;

export const fmt = (n: number, opts: { decimals?: number; suffix?: string } = {}) => {
  const { decimals = 2, suffix = " SAR" } = opts;
  const v = Number.isFinite(n) ? n : 0;
  return `${v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
};

export const fmtInt = (n: number) => {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  return v.toLocaleString("en-US");
};

export const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" });
  } catch { return iso; }
};

export const fmtDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("en-GB", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};
