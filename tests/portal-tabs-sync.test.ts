/**
 * اختبار تطابق تبويبات بوابة الموظف (المهمة #32)
 *
 * في client/src/pages/my-portal.tsx توجد ثلاث قوائم يجب أن تبقى متطابقة:
 *  1. enabledTabs — تغذي شريط التنقل السفلي للجوال وقائمة "المزيد"
 *  2. TabsTrigger داخل TabsList — الشريط العلوي
 *  3. TabsContent — محتوى كل تبويب
 *
 * أي تبويب يُضاف في مكان واحد فقط سيختفي من الجوال (أو يفتح صفحة فارغة)
 * بصمت — هذا الاختبار يفحص الكود المصدري ويفشل فوراً عند أي اختلاف في
 * القيم أو في شرط الظهور.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const src = readFileSync(
  path.resolve(__dirname, "../client/src/pages/my-portal.tsx"),
  "utf8",
);

/** تبويبات enabledTabs مع شرط الظهور لكل واحد */
function parseEnabledTabs(): Map<string, string> {
  const block = src.match(/const enabledTabs = \[([\s\S]*?)\]\.filter/);
  expect(block, "لم يتم العثور على مصفوفة enabledTabs").toBeTruthy();
  const map = new Map<string, string>();
  for (const m of block![1].matchAll(/\{\s*value:\s*"([a-zA-Z]+)"\s*,[^}]*?show:\s*([^,}]+)/g)) {
    map.set(m[1], m[2].trim());
  }
  return map;
}

/** تبويبات الشريط العلوي مع شرط الظهور (الحارس {cond && (...)}) */
function parseTopTabs(): Map<string, string> {
  const listBlock = src.match(/<TabsList[\s\S]*?<\/TabsList>/);
  expect(listBlock, "لم يتم العثور على TabsList").toBeTruthy();
  const map = new Map<string, string>();
  for (const m of listBlock![0].matchAll(
    /(?:\{\s*([A-Za-z0-9_]+)\s*&&\s*\(\s*)?<TabsTrigger value="([a-zA-Z]+)"/g,
  )) {
    map.set(m[2], (m[1] ?? "true").trim());
  }
  return map;
}

function parseTabsContents(): Set<string> {
  const set = new Set<string>();
  for (const m of src.matchAll(/<TabsContent value="([a-zA-Z]+)"/g)) set.add(m[1]);
  return set;
}

describe("تطابق تبويبات البوابة بين الشريط العلوي والسفلي", () => {
  const enabled = parseEnabledTabs();
  const top = parseTopTabs();
  const contents = parseTabsContents();

  it("وجدنا القوائم الثلاث وفيها تبويبات", () => {
    expect(enabled.size).toBeGreaterThanOrEqual(5);
    expect(top.size).toBeGreaterThanOrEqual(5);
    expect(contents.size).toBeGreaterThanOrEqual(5);
  });

  it("كل تبويب في الشريط العلوي موجود في enabledTabs (وإلا اختفى من الجوال)", () => {
    const missing = [...top.keys()].filter((v) => !enabled.has(v));
    expect(missing, `تبويبات موجودة في الشريط العلوي وغائبة عن شريط الجوال: ${missing.join(", ")}`).toEqual([]);
  });

  it("كل تبويب في enabledTabs موجود في الشريط العلوي (وإلا اختفى من الحاسوب)", () => {
    const missing = [...enabled.keys()].filter((v) => !top.has(v));
    expect(missing, `تبويبات في شريط الجوال وغائبة عن الشريط العلوي: ${missing.join(", ")}`).toEqual([]);
  });

  it("شرط الظهور متطابق لكل تبويب بين القائمتين", () => {
    const mismatches: string[] = [];
    for (const [value, showTop] of top) {
      const showEnabled = enabled.get(value);
      if (showEnabled !== undefined && showEnabled !== showTop) {
        mismatches.push(`${value}: العلوي=(${showTop}) والجوال=(${showEnabled})`);
      }
    }
    expect(mismatches, `شروط ظهور مختلفة:\n${mismatches.join("\n")}`).toEqual([]);
  });

  it("كل تبويب له محتوى TabsContent (وإلا فتح صفحة فارغة)", () => {
    const missing = [...enabled.keys()].filter((v) => !contents.has(v));
    expect(missing, `تبويبات بلا محتوى: ${missing.join(", ")}`).toEqual([]);
  });
});
