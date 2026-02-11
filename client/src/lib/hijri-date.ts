export function toHijri(date: Date): { year: number; month: number; day: number; monthName: string; dayName: string } {
  const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(date);
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1');
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '1447');

  const monthNames = ["محرم", "صفر", "ربيع الأول", "ربيع الثاني", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
  const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

  return {
    year,
    month,
    day,
    monthName: monthNames[month - 1] || "",
    dayName: dayNames[date.getDay()] || "",
  };
}

export function formatHijriDate(date: Date, format: "full" | "short" | "numeric" = "full"): string {
  if (format === "numeric") {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(date);
    const day = (parts.find(p => p.type === 'day')?.value || '1').padStart(2, '0');
    const month = (parts.find(p => p.type === 'month')?.value || '1').padStart(2, '0');
    const year = parts.find(p => p.type === 'year')?.value || '1447';
    return `${day}/${month}/${year}`;
  }
  if (format === "short") {
    const h = toHijri(date);
    return `${h.day} ${h.monthName} ${h.year}هـ`;
  }
  return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export function formatHijriGregorian(date: Date): string {
  const hijri = formatHijriDate(date, "numeric");
  const gregorian = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  return `${hijri}هـ الموافق ${gregorian}م`;
}
