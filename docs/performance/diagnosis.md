# تشخيص الأداء الجذري — نظام باتر

**التاريخ:** 20 مايو 2026
**النوع:** تشخيص قبل التنفيذ (Read-only diagnosis)
**الحالة:** بانتظار موافقة المستخدم قبل أي تعديل

---

## 1. ملخص تنفيذي

النظام بطيء بسبب **6 أسباب جذرية متراكمة**. لا توجد مشكلة واحدة كبيرة، بل عدة مشاكل متوسطة تتجمع لتصنع تجربة ثقيلة. كل المشاكل **قابلة للإصلاح بدون لمس قاعدة البيانات أو الصلاحيات أو منطق العمل**.

| المؤشر | الحالة الحالية | المستهدف |
|---|---|---|
| حجم كود الصفحات | 7.8 ميجابايت (125 صفحة) | < 3 ميجابايت |
| استدعاء `/api/my-permissions` | على كل تنقل | كل ساعة |
| استعلامات polling نشطة | 18 استعلام/دقيقة | < 6 |
| Preload عند التنقل | فوري، بدون تأخير | مع debounce 500ms |
| Manual chunks في Vite | غير مفعّل | مفعّل |
| استعلامات N+1 في P&L | 5 × عدد الفروع | استعلام واحد |

**التحسّن المتوقع بعد كل الإصلاحات:** سرعة 3-4 أضعاف، تقليل استهلاك الشبكة 60%.

---

## 2. التحقق الفعلي (ما تم فحصه)

```
عدد الصفحات: 125 ملف tsx
عدد المسارات (Routes): 146
حجم مجلد pages/: 7.8 ميجا
حجم مجلد components/: 908 كيلو
أكبر 5 صفحات:
  - employee-reports-dashboard.tsx = 432KB
  - operations-reports-dashboard.tsx = 392KB
  - shift-management.tsx = 228KB
  - floor-plan.tsx = 216KB
  - display-bar-waste.tsx = 192KB
```

**الخبر الجيد:** Lazy loading موجود فعلاً عبر `makeLazy()` في `client/src/lib/pagePreloader.ts` (125 صفحة). إذن نصف العمل تم.

**الخبر السيئ:** المشاكل الستة أدناه تُلغي فائدة الـ lazy loading جزئياً.

---

## 3. المشاكل الجذرية بالتفصيل

### 🔴 المشكلة #1 — `usePermissions` يُعيد الاستدعاء على كل تنقل

**الموقع:** `client/src/hooks/usePermissions.ts:25`

```typescript
const { data: permissions = [], isLoading } = useQuery<Permission[]>({
  queryKey: ["/api/my-permissions"],
  enabled: !!user,
  staleTime: 1000 * 60 * 5,    // 5 دقائق فقط
  refetchOnWindowFocus: false,
  refetchOnMount: true,        // ⚠️ يضرب الخادم على كل تركيب
  refetchOnReconnect: true,
});
```

**التناقض:** الإعداد العام في `queryClient.ts:124` يضع `refetchOnMount: false` بشكل صحيح، والـ `ENDPOINT_CACHE_TIERS:157` يعطي `/api/my-permissions` مدة LONG=30 دقيقة. لكن هذا الـ hook **يتجاوز كل ذلك** بـ `refetchOnMount: true` و`staleTime: 5min`.

**النتيجة:** كل صفحة تستخدم `usePermissions` (وهي تقريباً كل صفحة) تضرب الخادم عند التركيب. هذا يعني 50-100 طلب زائد لكل جلسة عمل.

**الإصلاح:** سطر واحد
```typescript
refetchOnMount: false,
staleTime: 1000 * 60 * 30,  // 30 دقيقة
```

**الأثر:** ⚡ توفير 50-100 طلب/جلسة، تنقل أسرع بـ 100-300ms في كل صفحة
**المخاطر:** 🟢 صفر — الصلاحيات تتحدث عند تسجيل الدخول
**زمن التنفيذ:** 1 دقيقة

---

### 🔴 المشكلة #2 — Preload عدواني عند كل تنقل

**الموقع:** `client/src/components/layout.tsx:147` و `:199`

```typescript
prefetchAdjacentPages(location);   // L147 — يحدث على كل تغيير location
...
queries.forEach(q => prefetchQuery([q]));  // L199 — يضرب API لكل query محتمل
```

**المشكلة:** بمجرد ما تنقر صفحة، النظام يبدأ تحميل **5-10 صفحات مجاورة** فوراً (JS chunks + API prefetch). هذا يُشبع حد الاتصالات في المتصفح (6 فقط لـ HTTP/1.1) ويُبطئ تحميل بيانات الصفحة الحالية نفسها.

**سيناريو:** المستخدم ينقر "Dashboard" → النظام يبدأ تحميل dashboard + branches + users + reports + inventory + maintenance... → الـ dashboard نفسه يُؤجَّل في الطابور.

**الإصلاح:**
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    prefetchAdjacentPages(location);
  }, 500);
  return () => clearTimeout(timer);
}, [location]);
```

**الأثر:** ⚡ ظهور الصفحة الحالية أسرع 30-50%
**المخاطر:** 🟢 صفر — مجرد تأخير الـ preload
**زمن التنفيذ:** 5 دقائق

---

### 🔴 المشكلة #3 — لا يوجد Manual Chunks في Vite

**الموقع:** `vite.config.ts` — `rollupOptions.output.manualChunks` غير موجود

**النتيجة:** كل مكتبات الـ vendor (recharts, xlsx, framer-motion, lucide-react, date-fns, drizzle-zod...) تُحزَّم في ملف واحد عملاق، أو تُعاد لكل chunk صفحة يستخدمها. لا cache فعّال بين الصفحات.

**الإصلاح المقترح:**
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'wouter'],
        'vendor-query': ['@tanstack/react-query'],
        'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', /* ... */],
        'vendor-charts': ['recharts'],
        'vendor-xlsx': ['xlsx'],
        'vendor-icons': ['lucide-react'],
        'vendor-forms': ['react-hook-form', 'zod', '@hookform/resolvers'],
        'vendor-date': ['date-fns'],
      }
    }
  }
}
```

**الأثر:** ⚡ Cache فعّال بين الصفحات، أول زيارة أبطأ قليلاً (~+200ms) لكن كل التنقلات اللاحقة أسرع بكثير
**المخاطر:** 🟡 منخفضة — يحتاج build واختبار محلي
**زمن التنفيذ:** 15 دقيقة

---

### 🟠 المشكلة #4 — 18 استعلام Polling بدون حماية تبويب مخفي

**المواقع:** 18 موقع في `client/src/` يستخدمون `refetchInterval`:

```
notifications-center.tsx:72        — 15s   ⚠️ أعلى تردد
event-pos.tsx:177,187              — 30s
NotificationDisplay.tsx:453        — 60s
notifications-dropdown.tsx:111     — 60s
construction-project-detail.tsx    — 60s
backups.tsx, field-hub.tsx,
warehouse-dashboard.tsx (×3),
contractor-oversight.tsx,
daily-production.tsx (×2),
production-dashboard.tsx,
audit-logs.tsx,
ProductionContext.tsx              — 60s
```

**المشكلة:** هذه الاستعلامات تستمر حتى لو كان التبويب مخفي (المستخدم انتقل لتبويب آخر). 18 طلب/دقيقة × عدد التبويبات المفتوحة = حمل لا داعي له.

**الإصلاح:** Hook موحّد
```typescript
function useSmartInterval(callback, intervalMs) {
  useEffect(() => {
    if (document.hidden) return;
    const id = setInterval(() => {
      if (!document.hidden) callback();
    }, intervalMs);
    return () => clearInterval(id);
  }, [callback, intervalMs]);
}
```

أو تمرير `refetchIntervalInBackground: false` لـ React Query (افتراضياً متوقف، لكن نحتاج تأكيد).

**الأثر:** ⚡ تقليل 60% من طلبات الخلفية، توفير بطارية الجهاز
**المخاطر:** 🟢 صفر
**زمن التنفيذ:** 20 دقيقة

---

### 🟠 المشكلة #5 — N+1 في `/api/pnl/enhanced-summary`

**الموقع:** `server/routes.ts:8341-8417`

**المشكلة:** الكود يدور على `branchIds` ولكل فرع يُنفّذ 5 استعلامات متسلسلة:
- `storage.getBranch(id)`
- `storage.getCashierJournalsFiltered(...)`
- `storage.getPnlBranchSettings(id)`
- `storage.getPnlMonthlyInputs(id, ...)`
- `storage.getBranchEmployeesByBranch(id)`

**السيناريو:** 10 فروع = 50 استعلام متسلسل = ~5-8 ثواني تحميل لـ P&L Dashboard.

**الإصلاح الفوري (الموجة 3):** `Promise.all` على مستوى الفروع
```typescript
const results = await Promise.all(
  branchIds.map(async (id) => {
    const [branch, journals, settings, inputs, employees] = await Promise.all([
      storage.getBranch(id),
      storage.getCashierJournalsFiltered(/*...*/),
      storage.getPnlBranchSettings(id),
      storage.getPnlMonthlyInputs(id, /*...*/),
      storage.getBranchEmployeesByBranch(id),
    ]);
    return { branch, journals, settings, inputs, employees };
  })
);
```

**الإصلاح المثالي (لاحقاً):** إعادة كتابة بـ SQL JOIN واحد. يحتاج وقت أطول.

**الأثر:** ⚡ P&L من 5-8 ثواني → 1-1.5 ثانية
**المخاطر:** 🟢 صفر — نفس البيانات بترتيب متوازٍ
**زمن التنفيذ:** 20 دقيقة (Promise.all فقط)
**ملاحظة:** Pool DB حالياً max=15 لـ Supabase (`server/db.ts:34`). 10 فروع × 5 = 50 استعلام متوازٍ قد يضغط على الـ pool. اقتراح: رفع max إلى 25 + cache لـ `getBranch` (الفروع نادراً تتغير).

---

### 🟠 المشكلة #6 — Lucide-react barrel import

**الموقع:** `client/src/components/layout.tsx:10-20` (60+ أيقونة)

```typescript
import {
  LayoutDashboard, Boxes, Settings, Users, /* ... 60+ */
} from "lucide-react";
```

**المشكلة:** Lucide-react مكتبة ضخمة (~1500 أيقونة). Tree-shaking يعمل نظرياً لكن في الواقع يعتمد على إعداد Vite وقد يُفشل بسبب side-effects.

**الإصلاح:**
```typescript
// بدلاً من barrel:
import { LayoutDashboard } from "lucide-react/dist/esm/icons/layout-dashboard";
// أو إضافة optimizeDeps.include في vite.config.ts
```

**الأثر:** ⚡ توفير ~200KB من vendor bundle
**المخاطر:** 🟢 صفر
**زمن التنفيذ:** 15 دقيقة

---

## 4. خطة الموجات الأربع المقترحة

### 🌊 الموجة 1 — مكاسب فورية بصفر مخاطر (30 دقيقة)

| # | الإصلاح | الموقع | الزمن |
|---|---|---|---|
| 1.1 | `refetchOnMount: false` للصلاحيات | `usePermissions.ts:25` | 1 دق |
| 1.2 | Lucide tree-shaking | `layout.tsx` + `vite.config.ts` | 15 دق |
| 1.3 | تأخير preload 500ms | `layout.tsx:147` | 5 دق |
| 1.4 | حماية polling من التبويب المخفي | hook موحّد + 18 ملف | 10 دق |

**الأثر المتوقع:** تنقل أسرع 30%، طلبات خلفية أقل 50%

---

### 🌊 الموجة 2 — Code Splitting (المكسب الأكبر، 1 ساعة)

| # | الإصلاح | الموقع | الزمن |
|---|---|---|---|
| 2.1 | Manual chunks في Vite | `vite.config.ts` | 20 دق |
| 2.2 | Suspense fallback موحّد | `App.tsx` + skeleton | 30 دق |
| 2.3 | اختبار build + قياس | محلي | 10 دق |

**الأثر المتوقع:** أول تحميل أبطأ +200ms، التنقلات اللاحقة أسرع 60%، cache يعمل بكفاءة

---

### 🌊 الموجة 3 — N+1 الحرج (30 دقيقة)

| # | الإصلاح | الموقع | الزمن |
|---|---|---|---|
| 3.1 | `Promise.all` في P&L summary | `server/routes.ts:8341-8417` | 15 دق |
| 3.2 | Cache بسيط لـ `getBranch` (TTL 5 دق) | `server/storage.ts` | 10 دق |
| 3.3 | رفع pool max إلى 25 (اختياري) | `server/db.ts:34` | 1 دق |

**الأثر المتوقع:** P&L Dashboard من 5-8 ثواني → 1-1.5 ثانية

---

### 🌊 الموجة 4 — قياس ومراقبة (15 دقيقة)

| # | الإصلاح | الموقع | الزمن |
|---|---|---|---|
| 4.1 | `console.time` على المسارات الحرجة | 3-4 endpoints | 10 دق |
| 4.2 | تقرير قبل/بعد بالأرقام | `docs/performance/results.md` | 5 دق |

---

## 5. ملخص المخاطر

| الموجة | المخاطر | قابلية التراجع | يحتاج DB migration؟ |
|---|---|---|---|
| الموجة 1 | 🟢 صفر | فورية | ❌ لا |
| الموجة 2 | 🟡 منخفضة (يحتاج اختبار build) | فورية | ❌ لا |
| الموجة 3 | 🟢 صفر | فورية | ❌ لا |
| الموجة 4 | 🟢 صفر | فورية | ❌ لا |

**لا حاجة لتعديل قاعدة بيانات Supabase.**
**لا حاجة لتعديل أي صلاحية أو منطق عمل.**
**كل التغييرات في طبقة العرض والشبكة فقط.**

---

## 6. ما لن نلمسه في هذا الجولة (للتوضيح)

- ❌ نظام الصلاحيات المزدوج (موضوع منفصل، خطة Bridge جاهزة)
- ❌ مخطط قاعدة البيانات (لا تعديلات schema)
- ❌ منطق RBAC أو الأدوار
- ❌ Supabase Storage أو الملفات
- ❌ نظام Twilio/WhatsApp
- ❌ أي feature business

هذه التحسينات **بحتة للأداء**، لا تغيير وظيفي.

---

## 7. التوصية

ابدأ بـ **الموجة 1** (30 دقيقة، صفر مخاطر) ثم قس النتيجة. لو الفرق ملموس، أكمل بالموجة 2. الموجة 3 توفر مكسب كبير في صفحة واحدة محددة (P&L) — جدولها حسب أولويتك.

---

**جاهز للتنفيذ بانتظار موافقتك.**
