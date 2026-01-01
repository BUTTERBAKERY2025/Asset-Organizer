# حزمة ترحيل ملفات الإنتاج

## قائمة الملفات المتغيرة:

### ملفات جديدة تماماً (يجب إنشاؤها):
1. `client/src/contexts/ProductionContext.tsx` - سياق الإنتاج المشترك
2. `client/src/pages/daily-production.tsx` - صفحة الإنتاج الفعلي اليومي
3. `client/src/pages/production-reports.tsx` - صفحة التقارير الشاملة

### ملفات معدلة (يجب استبدالها):
4. `client/src/App.tsx` - إضافة Routes و ProductionProvider
5. `client/src/components/layout.tsx` - إضافة روابط القائمة الجانبية
6. `client/src/pages/production-dashboard.tsx` - لوحة تحكم الإنتاج المحسنة
7. `client/src/pages/ai-production-planner.tsx` - مخطط الإنتاج الذكي
8. `client/src/pages/advanced-production-orders.tsx` - أوامر الإنتاج
9. `client/src/pages/advanced-production-order-details.tsx` - تفاصيل أمر الإنتاج
10. `client/src/pages/advanced-production-order-form.tsx` - نموذج أمر الإنتاج
11. `client/src/pages/operations-dashboard.tsx` - لوحة العمليات
12. `client/src/pages/sales-data-uploads.tsx` - رفع بيانات المبيعات
13. `server/routes.ts` - مسارات API الخلفية
14. `server/storage.ts` - طبقة التخزين
15. `shared/schema.ts` - مخطط قاعدة البيانات

## التغييرات في قاعدة البيانات (SQL):

يجب تنفيذ هذا الاستعلام في Supabase SQL Editor قبل ترحيل الكود:

```sql
CREATE TABLE IF NOT EXISTS daily_production_batches (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  product_id INTEGER REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_category TEXT,
  quantity INTEGER NOT NULL,
  unit TEXT DEFAULT 'قطعة',
  destination TEXT NOT NULL,
  shift_id INTEGER REFERENCES shifts(id),
  production_order_id INTEGER REFERENCES advanced_production_orders(id),
  produced_at TIMESTAMP DEFAULT NOW() NOT NULL,
  recorded_by VARCHAR REFERENCES users(id),
  recorder_name TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

## خطوات الترحيل:

1. **قاعدة البيانات أولاً**: نفذ استعلام SQL أعلاه في Supabase
2. **نسخ الملفات**: انسخ جميع الملفات إلى المشروع على Render
3. **Deploy**: قم بعمل Deploy على Render

