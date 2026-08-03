/**
 * اختبارات حراسة الجدولة الشهرية للمركز الرئيسي (main_warehouse)
 *
 * تحمي 3 ثوابت حرجة على السيرفر (POST /api/employee-schedules/bulk في server/routes.ts):
 *  1. الجمعة إجازة إجبارية: أي صف لفرع المركز الرئيسي بتاريخ جمعة يُجبر على isOff=true
 *  2. حارس الإجازات المعتمدة: الصفوف المتقاطعة مع إجازة معتمدة تُحذف قبل الحفظ
 *  3. استثناء حد الراحة الشهري (4 أيام) للمركز الرئيسي فقط — باقي الفروع يبقى الحد سارياً
 *
 * وتحمي ثوابت الواجهة (client/src/components/hq-monthly-schedule.tsx):
 *  4. الجمعة غير قابلة للتعديل في الواجهة
 *  5. الحفظ يبني شهراً كاملاً لكل موظف نشط (لا حفظ جزئياً يترك أياماً بلا جدول)
 *  6. أيام الإجازات المعتمدة تُتخطى في التوليد والحفظ
 *  7. صفحة الجدولة تعرض الوضع الشهري للمركز الرئيسي فقط
 *
 * اختبارات تحليل مصدر (source-parsing) بنمط tests/portal-tabs-sync.test.ts —
 * تفشل عند أي كسر متعمد للمنطق (mutation-tested).
 * التشغيل: npm run test:hq-schedule
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const routesSrc = readFileSync(resolve(__dirname, "../server/routes.ts"), "utf8");
const hqSrc = readFileSync(resolve(__dirname, "../client/src/components/hq-monthly-schedule.tsx"), "utf8");
const pageSrc = readFileSync(resolve(__dirname, "../client/src/pages/shift-management.tsx"), "utf8");

/** يستخرج نص دالة/كتلة تبدأ من موضع معين حتى إغلاق القوس المطابق */
function extractBlock(src: string, startIdx: number): string {
  const open = src.indexOf("{", startIdx);
  if (open < 0) throw new Error("لم يُعثر على بداية الكتلة");
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(startIdx, i + 1);
    }
  }
  throw new Error("كتلة غير مغلقة");
}

/** كتلة مسار الحفظ الجماعي bulk */
function bulkRouteBlock(): string {
  const idx = routesSrc.indexOf('app.post("/api/employee-schedules/bulk"');
  expect(idx, "مسار /api/employee-schedules/bulk موجود").toBeGreaterThan(-1);
  return extractBlock(routesSrc, idx);
}

/** كتلة دالة حد الراحة الشهري */
function capFnBlock(): string {
  const idx = routesSrc.indexOf("async function validateMonthlyWeeklyRestCap");
  expect(idx, "دالة validateMonthlyWeeklyRestCap موجودة").toBeGreaterThan(-1);
  // جسم الدالة يبدأ بعد نوع الإرجاع (وليس عند قوس نوع الوسائط)
  const bodyStart = routesSrc.indexOf("Promise<string[]>", idx);
  expect(bodyStart, "توقيع الدالة كما هو متوقع").toBeGreaterThan(-1);
  return extractBlock(routesSrc, bodyStart);
}

describe("1) السيرفر: الجمعة إجازة إجبارية للمركز الرئيسي في bulk", () => {
  const bulk = bulkRouteBlock();

  it("يوجد شرط يجبر صفوف الجمعة للمركز الرئيسي على isOff", () => {
    // الشرط الثلاثي: الفرع main_warehouse + اليوم fri + ليس isOff
    const cond = bulk.match(
      /if\s*\(\s*s\.branchId\s*===\s*"main_warehouse"\s*&&\s*s\.dayOfWeek\s*===\s*"fri"\s*&&\s*!s\.isOff\s*\)/
    );
    expect(cond, 'شرط (branchId==="main_warehouse" && dayOfWeek==="fri" && !isOff)').toBeTruthy();
    // جسم الشرط يفرض الإجازة ويمسح أوقات الدوام
    const body = extractBlock(bulk, bulk.indexOf(cond![0]) + cond![0].length - 1);
    expect(body).toMatch(/s\.isOff\s*=\s*true/);
    expect(body).toMatch(/s\.startTime\s*=\s*null/);
    expect(body).toMatch(/s\.endTime\s*=\s*null/);
    expect(body).toMatch(/s\.shiftType\s*=\s*null/);
  });

  it("الإجبار يحدث قبل فحص حد الراحة وقبل الحفظ الفعلي", () => {
    const coerceIdx = bulk.indexOf('s.dayOfWeek === "fri"');
    const capIdx = bulk.indexOf("validateMonthlyWeeklyRestCap(");
    const saveIdx = bulk.indexOf("createBulkEmployeeSchedules(");
    expect(coerceIdx).toBeGreaterThan(-1);
    expect(capIdx, "bulk ما زال يستدعي فحص حد الراحة").toBeGreaterThan(-1);
    expect(saveIdx, "bulk يحفظ عبر createBulkEmployeeSchedules").toBeGreaterThan(-1);
    expect(coerceIdx).toBeLessThan(capIdx);
    expect(coerceIdx).toBeLessThan(saveIdx);
  });
});

describe("2) السيرفر: حارس الإجازات المعتمدة في bulk", () => {
  const bulk = bulkRouteBlock();

  it("يستعلم فقط عن الإجازات المعتمدة المتقاطعة زمنياً", () => {
    expect(bulk).toMatch(/eq\(\s*leaveRequests\.status\s*,\s*"approved"\s*\)/);
    expect(bulk).toMatch(/inArray\(\s*leaveRequests\.branchEmployeeId\s*,/);
    // تقاطع المدى: startDate <= maxDate و endDate >= minDate
    expect(bulk).toMatch(/lte\(\s*leaveRequests\.startDate\s*,/);
    expect(bulk).toMatch(/gte\(\s*leaveRequests\.endDate\s*,/);
  });

  it("يحذف الصفوف الواقعة داخل مدى إجازة معتمدة قبل الحفظ", () => {
    // منطق الاستبعاد: نفس الموظف + التاريخ داخل [startDate, endDate]
    const filter = bulk.match(
      /l\.branchEmployeeId\s*===\s*s\.branchEmployeeId\s*&&\s*l\.startDate\s*<=\s*s\.scheduleDate\s*&&\s*s\.scheduleDate\s*<=\s*l\.endDate/
    );
    expect(filter, "شرط استبعاد اليوم المغطى بإجازة معتمدة").toBeTruthy();
    // الاستبعاد يحدث قبل الحفظ الفعلي
    const guardIdx = bulk.indexOf(filter![0]);
    const saveIdx = bulk.indexOf("createBulkEmployeeSchedules(");
    expect(guardIdx).toBeLessThan(saveIdx);
    // والصفوف المستبعدة تُزال فعلاً من مصفوفة الحفظ (وليس مجرد عدّها)
    expect(bulk).toMatch(/validatedSchedules\.length\s*=\s*0/);
    expect(bulk).toMatch(/validatedSchedules\.push\(\s*\.\.\.__kept\s*\)/);
  });
});

describe("3) السيرفر: استثناء حد الراحة للمركز الرئيسي فقط", () => {
  const capFn = capFnBlock();

  it("الاستثناء داخل فلتر الصفوف ومقصور على main_warehouse", () => {
    // الفلتر يجمع فحص صيغة التاريخ + استثناء المركز الرئيسي
    const filter = capFn.match(
      /CANONICAL_DATE\.test\(String\(r\.scheduleDate[^)]*\)\)\s*&&\s*r\.branchId\s*!==\s*"main_warehouse"/
    );
    expect(filter, 'فلتر valid يستثني r.branchId === "main_warehouse" فقط').toBeTruthy();
    // لا يوجد استثناء شامل (مثل return [] مبكر حسب الفرع)
    const beforeFilter = capFn.slice(0, capFn.indexOf("CANONICAL_DATE.test"));
    expect(beforeFilter).not.toMatch(/return\s*\[\s*\]/);
  });

  it("الحد ما زال 4 أيام ويُطبق على باقي الفروع", () => {
    expect(routesSrc).toMatch(/const\s+WEEKLY_REST_MONTHLY_CAP\s*=\s*4\b/);
    expect(capFn).toMatch(/offCount\s*>\s*WEEKLY_REST_MONTHLY_CAP/);
    // bulk يرفض التجاوز بكود الخطأ المخصص
    const bulk = bulkRouteBlock();
    expect(bulk).toMatch(/WEEKLY_REST_CAP_EXCEEDED/);
    // كتلة رفض التجاوز في bulk تعيد 400
    const capCallIdx = bulk.indexOf("validateMonthlyWeeklyRestCap(");
    const after = bulk.slice(capCallIdx, capCallIdx + 600);
    expect(after).toMatch(/status\(\s*400\s*\)/);
  });

  it("استثناء المركز الرئيسي غير موجود في مسارات أخرى بشكل يعطل الحد عامةً", () => {
    // الاستثناء يظهر مرة واحدة فقط داخل دالة الحد (وليس في كل استدعاء)
    const occurrences = routesSrc.match(/r\.branchId\s*!==\s*"main_warehouse"/g) || [];
    expect(occurrences.length).toBe(1);
  });
});

describe("4) الواجهة: الجمعة غير قابلة للتعديل", () => {
  it("HQ_BRANCH_ID هو main_warehouse والجمعة يوم 5", () => {
    expect(hqSrc).toMatch(/export\s+const\s+HQ_BRANCH_ID\s*=\s*"main_warehouse"/);
    expect(hqSrc).toMatch(/const\s+FRIDAY\s*=\s*5\b/);
  });

  it("toggleCell يمنع تعديل الجمعة ويعيد قبل أي تغيير", () => {
    const idx = hqSrc.indexOf("const toggleCell");
    expect(idx).toBeGreaterThan(-1);
    const fn = extractBlock(hqSrc, idx);
    const fridayGuard = fn.match(/getDay\(\)\s*===\s*FRIDAY\s*\)\s*\{[\s\S]*?return;/);
    expect(fridayGuard, "حارس الجمعة داخل toggleCell").toBeTruthy();
    // الحارس قبل تعديل الشبكة
    expect(fn.indexOf("getDay() === FRIDAY")).toBeLessThan(fn.indexOf("setGrid"));
  });
});

describe("5) الواجهة: الحفظ يبني شهراً كاملاً", () => {
  const idx = hqSrc.indexOf("const saveMutation");
  const saveFn = extractBlock(hqSrc, idx);

  it("يمر على كل أيام الشهر (dates) وليس فقط الخلايا الموجودة", () => {
    expect(saveFn).toMatch(/for\s*\(const\s+d\s+of\s+dates\)/);
    // لا يعتمد على Object.entries للشبكة كمصدر وحيد للأيام
    expect(saveFn).not.toMatch(/for\s*\(const\s*\[dateStr,\s*cell\]\s*of\s*Object\.entries/);
  });

  it("الأيام الناقصة تُستكمل بالوردية الموحدة والجمعة تبقى إجازة دائماً", () => {
    expect(saveFn).toMatch(/empGrid\[d\.dateStr\]\s*\|\|\s*\{\s*startTime,\s*endTime,\s*isOff:\s*d\.isFriday\s*\}/);
    expect(saveFn).toMatch(/const\s+isOff\s*=\s*d\.isFriday\s*\?\s*true\s*:\s*cell\.isOff/);
  });

  it("يشمل الموظفين النشطين فقط ويرسل الهوية القانونية branchEmployeeId", () => {
    expect(saveFn).toMatch(/for\s*\(const\s+emp\s+of\s+activeEmployees\)/);
    expect(saveFn).toMatch(/branchEmployeeId:\s*emp\.id/);
    expect(hqSrc).toMatch(/activeEmployees\s*=\s*useMemo\(\(\)\s*=>\s*employees\.filter\(e\s*=>\s*e\.status\s*===\s*"active"\)/);
  });
});

describe("6) الواجهة: الإجازات المعتمدة تُتخطى", () => {
  it("التوليد والحفظ كلاهما يتخطى أيام الإجازات المعتمدة", () => {
    const skips = hqSrc.match(/if\s*\(isApprovedLeave\(emp\.id,\s*d\.dateStr\)\)\s*continue;/g) || [];
    expect(skips.length, "تخطي الإجازة المعتمدة في التوليد وفي الحفظ").toBeGreaterThanOrEqual(2);
  });

  it("toggleCell يمنع لمس يوم مغطى بإجازة معتمدة", () => {
    const fn = extractBlock(hqSrc, hqSrc.indexOf("const toggleCell"));
    expect(fn).toMatch(/isApprovedLeave\([^)]*\)\)\s*\{[\s\S]*?return;/);
  });
});

describe("7) صفحة الجدولة: الوضع الشهري للمركز الرئيسي فقط", () => {
  it("التبديل مشروط بـ HQ_BRANCH_ID والشبكة الأسبوعية تبقى لباقي الفروع", () => {
    expect(pageSrc).toMatch(/selectedBranch\s*===\s*HQ_BRANCH_ID\s*\?\s*\(/);
    expect(pageSrc).toMatch(/<HQMonthlySchedule\s/);
    // الشبكة الأسبوعية ما زالت موجودة (الفرع الآخر من الشرط الثلاثي)
    expect(pageSrc).toMatch(/shiftManagement\.weeklySchedule/);
  });
});
