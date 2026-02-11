const HIJRI_MONTHS = [
  "محرم", "صفر", "ربيع الأول", "ربيع الثاني",
  "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
  "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
];

const HIJRI_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function gregorianToJulianDay(year: number, month: number, day: number): number {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

function julianDayToHijri(jd: number): { year: number; month: number; day: number } {
  const jd1 = Math.floor(jd) + 0.5;
  const year = Math.floor((30 * (jd1 - 1948439.5) + 10646) / 10631);
  const month = Math.min(12, Math.ceil((jd1 - (29 + getHijriJD(year, 1, 1))) / 29.5) + 1);
  const day = Math.floor(jd1 - getHijriJD(year, month, 1)) + 1;
  return { year, month, day };
}

function getHijriJD(year: number, month: number, day: number): number {
  return Math.floor((11 * year + 3) / 30) + 354 * year + 30 * month - Math.floor((month - 1) / 2) + day + 1948440 - 385;
}

export function toHijri(date: Date): { year: number; month: number; day: number; monthName: string; dayName: string } {
  const jd = gregorianToJulianDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const hijri = julianDayToHijri(jd);
  const dayOfWeek = date.getDay();
  return {
    year: hijri.year,
    month: hijri.month,
    day: hijri.day,
    monthName: HIJRI_MONTHS[hijri.month - 1] || "",
    dayName: HIJRI_DAYS[dayOfWeek] || "",
  };
}

export function formatHijriDate(date: Date, format: "full" | "short" | "numeric" = "full"): string {
  const h = toHijri(date);
  if (format === "numeric") {
    return `${h.day.toString().padStart(2, '0')}/${h.month.toString().padStart(2, '0')}/${h.year}`;
  }
  if (format === "short") {
    return `${h.day} ${h.monthName} ${h.year}هـ`;
  }
  return `${h.dayName} ${h.day} ${h.monthName} ${h.year}هـ`;
}

export function formatHijriGregorian(date: Date): string {
  const hijri = formatHijriDate(date, "numeric");
  const gregorian = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  return `${hijri}هـ الموافق ${gregorian}م`;
}
