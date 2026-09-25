# Four-role real-account material-return HTTP journey

## الخلاصة

نجحت رحلة المخزون والتوصيل والفحص والشطب عبر واجهات الخادم الحقيقية بأربع جلسات دخول مستقلة في التطوير. لم ينجح اختبار التشغيل الكامل: واجهة التوصيل بقيت على هيكل التحميل في المتصفح الآلي بعد دخول ناجح، وتنبيها انتظار الاستلام واعتماد الإيصال للمرتجعات فشلا بسبب عدم دعم مصدر المرتجع في محلّل التنبيهات.

لم تُستخدم محاكاة للمصادقة أو بيانات الإنتاج. حُذفت الحسابات والجلسات والبيانات المؤقتة وملف بيانات الدخول بعد حفظ النتائج.

Result: **FAIL overall (notification delivery); PASS core four-role stock/delivery/settlement journey**. This is real HTTP against the running local server, not browser E2E; the authenticated UI remained on its loading skeleton. The underlying UI cause was not established.
Existing `/api/auth/login` username/password was used separately for each fixture role with normal session cookies and matching Origin. No auth bypass/mock/session forgery. All operational writes went through HTTP; SQL used only for preconditions and read-only verification.
Fixture: e2e_rev_44217fad829d81, original transfer 222 / line 208, material 612. Movement: 79, delivery: 60.
Quantity plan: baseline source 12 kg/main 0; request 7; dispatch source 5; receipt 7 quarantine; inspection 5 usable/2 damaged; operations writeoff 2.

## Evidence
- Initial baseline: source 12, reserved 0, main 0 kg
- source POST /api/auth/login -> 200 (expected)
- source GET /api/auth/me -> 200 (expected)
- driver POST /api/auth/login -> 200 (expected)
- driver GET /api/auth/me -> 200 (expected)
- receiver POST /api/auth/login -> 200 (expected)
- receiver GET /api/auth/me -> 200 (expected)
- settlement POST /api/auth/login -> 200 (expected)
- settlement GET /api/auth/me -> 200 (expected)
- source POST /api/reverse-logistics -> 200 (expected)
- source POST /api/reverse-logistics/79/request -> 200 (expected)
- Requested and reserved: source 12, reserved 7, main 0 kg
- source POST /api/reverse-logistics/79/dispatch -> 409 (expected)
- Pre-assignment dispatch rejected: source 12, reserved 7, main 0 kg
- source POST /api/deliveries -> 201 (expected)
- source POST /api/deliveries/60/handover -> 200 (expected)
- receiver POST /api/deliveries/60/acknowledge-handover -> 403 (expected)
- driver POST /api/deliveries/60/acknowledge-handover -> 200 (expected)
- source POST /api/reverse-logistics/79/dispatch -> 200 (expected)
- Dispatched after driver acknowledged: source 5, reserved 0, main 0 kg
- driver POST /api/deliveries/60/start -> 200 (expected)
- receiver POST /api/reverse-logistics/79/receive -> 200 (expected)
- Receiver actual receipt, quarantine before inspection: source 5, reserved 0, main 0 kg
- driver POST /api/deliveries/60/proof -> 200 (expected)
- source POST /api/deliveries/60/approve-receipt -> 403 (expected)
- receiver POST /api/deliveries/60/approve-receipt -> 200 (expected)
- driver POST /api/deliveries/60/complete -> 200 (expected)
- receiver POST /api/reverse-logistics/79/receive -> 200 (expected)
- Repeated receipt has no duplicate credit: source 5, reserved 0, main 0 kg
- receiver POST /api/reverse-logistics/79/inspect -> 200 (expected)
- Inspection releases only usable: source 5, reserved 0, main 5 kg
- receiver POST /api/reverse-logistics/79/writeoff -> 403 (expected)
- settlement POST /api/reverse-logistics/79/writeoff -> 200 (expected)
- settlement POST /api/reverse-logistics/79/writeoff -> 200 (expected)
- Final usable stock after idempotent writeoff: source 5, reserved 0, main 5 kg
- Final DB read-only verification: movement 79 inspected, delivery 60 completed, receiver db2392e0-9af8-4d82-9af3-482376407198; received 7, usable 5, damaged 2, written off 2; receive events 1, writeoff events 1.
- Initial outbox check immediately after HTTP journey found 3 pending rows; it was **not** evidence that notifications worked. No non-fixture target was found.

## Independent notification failure (read-only inspection after scheduler tick)

The already-running scheduler processed only the existing fixture jobs (no manual sweep or global drain was invoked):

| Outbox ID | Event | Attempts | Published | Last error |
|---|---|---:|---|---|
| 175 | assigned | 1 | yes | none |
| 176 | awaiting_receipt | 1 | **no** | `Error: Unsupported delivery source: reverse_movement` |
| 177 | receipt_approved | 1 | **no** | `Error: Unsupported delivery source: reverse_movement` |

`server/delivery-notifications.ts` `sourceFor()` has no `reverse_movement` query; assigned works because its branch avoids source lookup, while awaiting-receipt and approval remain retrying. This is a product bug, **not** a successful end-to-end notification journey. No notification action or fixture stock was modified to inspect this finding. Fixture has no phone/push subscriptions; no real-user notifications were initiated by this test.

Cleanup completed successfully after verification: fixture-linked movements, delivery events, notification jobs, stock, provenance, sessions and four accounts were removed in a local transaction; the temporary credential file was deleted. No production data or existing operational balances were changed. The IDs above are historical test evidence, not retained records.
