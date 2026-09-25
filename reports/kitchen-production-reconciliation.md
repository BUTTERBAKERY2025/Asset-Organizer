# مصالحة منتجات المطبخ النهائية مع الإنتاج (قراءة فقط)

المصدر: server/catalogue-source/kitchen-finished-products.json (102 صفاً، PDF بأربع صفحات). قاعدة المقارنة: Supabase المشروع irgeqdrdaejhedlcbvzz وجدول public.products فقط؛ قراءة 196 سجلاً للحقول id/name/name_en/sku/category/unit/product_type/is_active/base_price. لم تتم أي كتابة لقاعدة البيانات أو warehouse_items أو تغيير الأسعار/الأرصدة/الهويات.

## خلاصة القرار

- مطابقة الكود التجاري مباشرة: **0 / 102**. أكواد PDF ليست مفاتيح id، وأكواد النظام الحالية F-BK/F-... أو فارغة. لا تستبدل الهوية بناءً على الكود وحده.
- 76 صفاً له مرشح واحد بالأدلة المحددة أدناه؛ 2 صفّان بمرشحين؛ 24 صفاً بلا مرشح موثوق. **هذه مرشحات مراجعة وليست ربطاً معتمداً**، خاصة مع اختلاف وحدات البيع.
- الوحدة المصدرية: حبة 58، قطعة 24، كوب 4، علبة 3، بوكس 13. في النظام الجاري المرشحون غالباً قطعة؛ 61 من الصفوف التي لها مرشح واحد على الأقل بها اختلاف في الوحدة، و78 صف مصدر ليست قطعتها حرفياً قطعة. لا تُحوّل حبة/علبة/كوب/بوكس إلى قطعة دون قرار تجاري موثق.
- السجلات الحالية 196 جميعها product_type=finish، وكلها ظاهرة is_active=true في اللقطة؛ لا حذف أو إيقاف آلي. 116 سجل إنتاج حالي ليس ضمن المرشحين، منها فئات الباريستا/البيتزا وغيرها؛ احفظها للاستخدام التاريخي وافحص المبيعات/المخزون/العمليات المفتوحة والمراجع غير المباشرة قبل اقتراح إيقاف أي سجل. لا يكفي غياب FK.
- المرجع لا يحتوي أسعاراً. احتفظ بأسعار السجلات عند التحقق من الهوية؛ المنتجات الجديدة التي لا سعر لها لا تُنشط للبيع بسعر افتراضي صفر. warehouse_items خارج النطاق تماماً.
- ملف القرارات المفصل: server/catalogue-source/kitchen-reconciliation-candidates.json، حقل apply=false في كل صف.

## المرشحون صفاً بصف

الدليل: exact_cashier_english = تطابق الاسم الإنجليزي المنظّم حرفياً؛ exact_normalized_arabic_name = تطابق الاسم العربي بعد Unicode والمسافات؛ human_review_proposal = قرينة يدوية محددة بالاسم/العدد من البيانات المقروءة، **ليست ربطاً تلقائياً**.

| PDF | كود PDF | اسم PDF | وحدة PDF | مرشح (id / SKU / اسم / وحدة / الدليل) | حالة |
|---|---|---|---|---|---|
| 1/1 | 330394 | بان سويس راسبيري | حبة | 520 / F-BK-0024 / رازبيرى بان سويس / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 1/2 | 330393 | بان سويس شوكو براوني | حبة | 524 / F-BK-0017 / شوكو براونى سويس / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 1/3 | sk-0954 | خبز براون | حبة | 511 / F-BK-0001 / خبز 🥖 براون bag / قطعة / human_review_proposal [فرق وحدة] | manual_identity_review_required — كاشير المصدر يحتوي رمز 🥖، والسجل الحالي اسم خبز براون bag؛ تحقق من وحدة البيع. |
| 1/4 | 330068 | خبز بريوش | حبة | 510 / F-BK-0007 / خبز بريوش / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 1/5 | 330091 | خبز ساوردو | حبة | 523 / F-BK-0014 / ساوردو / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 1/6 | sk-0915 | خبز سميط تركي (3 حبات) | حبة | 506 / F-BK-0003 / خبز السميط التركي / قطعة / human_review_proposal [فرق وحدة] | manual_identity_review_required |
| 1/7 | sk-0912 | خبز شباتا إيطالي (3 حبات) | حبة | 507 / F-BK-0006 / خبز الشيباتا الإيطالي / قطعة / human_review_proposal [فرق وحدة] | manual_identity_review_required |
| 1/8 | sk-0913 | خبز فوكاتشيا | حبة | 508 / F-BK-0002 / خبز الفوكاتشيا / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 1/9 | sk-0916 | خبز كرواسون (3 حبات) | حبة | 509 / F-BK-0008 / خبز الكرواسون برد / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 1/10 | 330026 | دانش بن حلومي | حبة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 1/11 | 330303 | دانش بيستو | حبة | 514 / F-BK-0028 / دانش بيستو / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 1/12 | sk-1089 | دانش تيراميسو | حبة | 515 / F-BK-0019 / دانش تيراميسو / قطعة / exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 1/13 | sk-0903 | دانش تين | حبة | 512 / F-BK-0021 / دانش التين / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 1/14 | sk-0950 | دانش جبنة شمر وطماطم مجففة | حبة | 516 / F-BK-0025 / دانش شمر تشيز + الطماطم المجففة / قطعة / human_review_proposal [فرق وحدة] | manual_identity_review_required |
| 1/15 | sk-1133 | دانش دقة | حبة | 519 / F-BK-0015 / دانيش دقة / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 1/16 | sk-1181 | دانش فستق | حبة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 1/17 | 330035 | دانش كريمة فرنسية | حبة | 518 / F-BK-0034 / دانش كريمة فرنسية / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 1/18 | sk-1182 | دانش موز | حبة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 1/19 | sk-1183 | سلة دانش فواكه | حبة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 1/20 | sk-0868 | فلكي بان سويس | حبة | 525 / F-BK-0012 / فلكي بان سويس / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 1/21 | 330287 | كاسترد كوكونت رول | حبة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 1/22 | 330039 | كرواسون بيكان فرنسي | حبة | 527 / F-BK-0029 / كرواسون بيكان فرنسى / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 1/23 | sk-0902 | كرواسون جبنة | حبة | 528 / F-BK-0027 / كرواسون جبنة / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 1/24 | sk-1086 | كرواسون جبنة وتركي | حبة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 1/25 | sk-1085 | كرواسون روستد بيف بالجبنة والزيتون | حبة | 521 / F-BK-0010 / روستد بيف مع جبنة و زيتون / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 1/26 | sk-0833 | كرواسون رول بيكان | حبة | 522 / F-BK-0018 / رول كروسون بيكان / قطعة / human_review_proposal [فرق وحدة] | manual_identity_review_required |
| 1/27 | 330031 | كرواسون زعتر | حبة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 1/28 | 330015 | كرواسون سادة | حبة | 529 / F-BK-0026 / كرواسون سادة / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 1/29 | 330036 | كرواسون شوكولاتة | حبة | 530 / F-BK-0032 / كرواسون شوكولاته / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 1/30 | 330037 | كرواسون فستق | حبة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 1/31 | sk-0878 | كرواسون كوكيز | حبة | 531 / F-BK-0022 / كوكيز كرواسون / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 1/32 | 330029 | كرواسون لوز | حبة | 526 / F-BK-0031 / كرواسون اللوز / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 1/33 | 330081 | لندن تشيز بن | حبة | 532 / F-BK-0033 / لندن تشيز بن / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 1/34 | 330043 | لندن دونات بيكان | حبة | 533 / F-BK-0020 / لندن دونت بيكان / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 1/35 | 330045 | لندن دونات زعتر | حبة | 534 / F-BK-0023 / لندن دونت زعتر / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 1/36 | sk-1132 | ماتيلدا كرواسون نوتيلا | حبة | 536 / F-BK-0030 / ماتيلدا كرواسون نوتيلا / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 1/37 | sk-0860 | ماريتوزو | حبة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 1/38 | sk-1171 | مافن | حبة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 1/39 | sk-1157 | ميني ماتيلدا كرواسون | حبة | 537 / F-BK-0016 / ميني ماتيلدا كروسون / قطعة / human_review_proposal [فرق وحدة] | manual_identity_review_required |
| 1/40 | 330288 | نوتيلا رول | حبة | 538 / F-BK-0005 / نوتيلا رول / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 2/1 | sk-1141 | بودنج كرنشي | كوب | 482 / F-PS-0010 / بودنج كرنشي / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 2/2 | 330187 | بي بي كيك | قطعة | 484 / F-PS-0003 / بى بى كيك / قطعة / exact_cashier_english+exact_normalized_arabic_name | manual_identity_review_required |
| 2/3 | 330290 | تارت ليمون | قطعة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 2/4 | 330062 | تارت ميكس بيري | قطعة | 486 / F-PS-0011 / تارت مكس بيرى / قطعة / exact_cashier_english | manual_identity_review_required |
| 2/5 | 330342 | تشيز كيك كريم بروليه | قطعة | 492 / F-PS-0002 / كريم بروليه تشيز كيك / قطعة / exact_cashier_english | manual_identity_review_required |
| 2/6 | 330094 | تيراميسو | قطعة | 487 / F-PS-0014 / تيرامسيو / قطعة / exact_cashier_english | manual_identity_review_required |
| 2/7 | sk-1184 | جاكاراندا كيك | قطعة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 2/8 | 330336 | روشيه | قطعة | 488 / F-PS-0009 / روشيه / قطعة / exact_cashier_english+exact_normalized_arabic_name | manual_identity_review_required |
| 2/9 | sk-1198 | سمر كيك | قطعة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 2/10 | sk-1039 | كراميليتو | قطعة | 490 / F-PS-0008 / كرامليتو / قطعة / exact_cashier_english | manual_identity_review_required |
| 2/11 | sk-1041 | كرنشي شوكولاتة | قطعة | 491 / F-PS-0019 / كرنشى تشوكلت / قطعة / exact_cashier_english | manual_identity_review_required |
| 2/12 | 330388 | كوكيز شوكولاتة | قطعة | 493 / F-PS-0017 / كوكيز شوكولاته / قطعة / exact_cashier_english | manual_identity_review_required |
| 2/13 | 330010 | كيك برتقال سلايس | قطعة | 495 / F-PS-0020 / كيك برتقال سلايس / قطعة / exact_cashier_english+exact_normalized_arabic_name | manual_identity_review_required |
| 2/14 | 330112 | كيك برتقال فرنسي | قطعة | 496 / F-PS-0022 / كيك برتقال فرنسى / قطعة / exact_cashier_english+exact_normalized_arabic_name | manual_identity_review_required |
| 2/15 | 330183 | كيك ليمون سلايس | قطعة | 499 / F-PS-0024 / كيك ليمون سلايس / قطعة / exact_cashier_english+exact_normalized_arabic_name ؛ 500 / F-PS-0001 / كيك ليمون سلايس / قطعة / exact_cashier_english+exact_normalized_arabic_name | ambiguous_multiple_candidates — هناك سجلان مطابقان بالاسم واسم الكاشير (499 و500) ولا يمكن اختيار هوية واحدة بدون تحقق تاريخ الاستخدام. |
| 2/16 | 330111 | كيك ليمون فرنسي | قطعة | 501 / F-PS-0023 / كيك ليمون فرنسى / قطعة / exact_cashier_english+exact_normalized_arabic_name | manual_identity_review_required |
| 2/17 | 330095 | كيكة العسل ميجا | قطعة | 494 / F-PS-0006 / كيك العسل ميجا / قطعة / exact_cashier_english | manual_identity_review_required |
| 2/18 | 330291 | كيكة ريد فيلفت | قطعة | 497 / F-PS-0018 / كيك ريد فالفت / قطعة / exact_cashier_english | manual_identity_review_required |
| 2/19 | 330069 | كيكة سان سباستيان | قطعة | 498 / F-PS-0005 / كيك سان سابستيان / قطعة / exact_cashier_english | manual_identity_review_required |
| 2/20 | sk-1188 | كيكة شوكولاتة بريميوم | قطعة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 2/21 | sk-1201 | كيكة شوكولاتة طبقات | قطعة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 2/22 | sk-1106 | ماتيلدا شوكولاتة | قطعة | 502 / F-PS-0004 / ماتيلدا شوكولاته / قطعة / exact_cashier_english | manual_identity_review_required |
| 2/23 | sk-1227 | مانجو دوم | قطعة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 2/24 | sk-1114 | مدريد تشيز كيك بيكان | قطعة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 2/25 | sk-1115 | مدريد تشيز كيك شوكولاتة | قطعة | 503 / F-PS-0016 / مدريد تشيز كيك تشوكلت / قطعة / exact_cashier_english | manual_identity_review_required |
| 3/1 | sk-1109 | أفوكادو سكرامبل كب | كوب | 404 / F-BF-0036 / مكعبات كرواسون أفوكادو مع البيض الاسكرمبل / قطعة / human_review_proposal [فرق وحدة] | manual_identity_review_required — اسم الإنتاج مكعبات كرواسون أفوكادو مع البيض الاسكرمبل، واسمها الإنجليزي cubs بدل cups؛ تحقق من هوية المنتج مقابل كرواسون أفوكادو مستقل. |
| 3/2 | sk-1127 | بريوش بريزاولا | حبة | 378 / F-BF-0028 / بريوش بيرزاولا / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 3/3 | sk-1126 | بريوش تركي مدخن | حبة | 379 / F-BF-0009 / بريوش تركى مدخن / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 3/4 | sk-1125 | بريوش تونة | حبة | 380 / F-BF-0006 / بريوش تونة / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 3/5 | sk-1128 | بريوش حلومي | حبة | 381 / F-BF-0017 / بريوش حلومى / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 3/6 | 330392 | جرانولا | كوب | 388 / F-BF-0013 / جرانولا / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 3/7 | sk-1228 | جرانولا بتر بيكري | كوب | لا مرشح موثوق | no_evidenced_existing_candidate |
| 3/8 | sk26 | ساندويتش براون تونة | حبة | 392 / F-BF-0002 / ساندوتش براون تونة / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 3/9 | sk-0921 | ساندويتش بيبروني | حبة | 463 / F-PZ-0013 / ساندويتش بيبروني / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 3/10 | sk-1196 | ساندويتش تركي | حبة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 3/11 | 340168 | ساندويتش حلومي | حبة | 389 / F-BF-0001 / حلومي ساندويتش بتربيكري / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 3/12 | sk-0923 | ساندويتش ديك رومي | حبة | 464 / F-PZ-0004 / ساندويتش ديك رومي / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 3/13 | 340169 | سلطة حلومي باربكيو | علبة | 394 / F-BF-0025 / سلطة باربكيو الحلومي / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 3/14 | sk-1021 | سلطة دجاج | علبة | 395 / F-BF-0023 / سلطة دجاج / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 3/15 | sk-1140 | سلطة شمندر (وسط) | علبة | 396 / F-BF-0034 / سلطة شمندر / قطعة / human_review_proposal [فرق وحدة] | manual_identity_review_required |
| 3/16 | 340172 | شباتا تركي مدخن | حبة | 397 / F-BF-0004 / شباطا التركي المدخن / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 3/17 | 340174 | شباتا دجاج | حبة | 398 / F-BF-0015 / شباطا الدجاج / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 3/18 | sk-1081 | فوكاشيا تركي | حبة | 400 / F-BF-0020 / فوكاشيا تركى / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 3/19 | sk-1122 | كرواسون أفوكادو | حبة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 3/20 | sk-0875 | كرواسون السيجنتشر | حبة | 401 / F-BF-0008 / كرواسون السجنتشر / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 3/21 | 340053 | كرواسون تونة | حبة | 403 / F-BF-0018 / كرواسون تونه / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 3/22 | sk-1218 | كلوب ساندويتش | حبة | لا مرشح موثوق | no_evidenced_existing_candidate |
| 3/23 | sk-1129 | ميني تريبل دانش مالح | بوكس | 406 / F-BF-0033 / ميني دانِش ثلاثي بحشوات مالحة / قطعة / human_review_proposal [فرق وحدة] | manual_identity_review_required |
| 3/24 | sk-1130 | ميني تريبل كرواسون مالح | بوكس | 407 / F-BF-0035 / ميني كرواسون مالح (3 قطع) / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 3/25 | sk-0926 | فوكاشيا لبنة | حبة | 468 / F-PZ-0009 / فوكاشيا بلبنة / قطعة / exact_cashier_english [فرق وحدة] | manual_identity_review_required |
| 3/26 | sk-0927 | فوكاشيا لبنة وزعتر | حبة | 469 / F-PZ-0008 / فوكاشيا لبنة وزعتر / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 4/1 | sk-1108 | بوكس دانش مالح | بوكس | 382 / F-BF-0030 / بوكس دانش مالح / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 4/2 | sk-1162 | بوكس ميني بن (12 حبة) | بوكس | 547 /  / بوكس ميني بن كبير  / باكيت / human_review_proposal [فرق وحدة] | manual_identity_review_required — السجل 547 ميني بن كبير ولا يذكر 12 حبة: ليس تطابقاً مؤكداً. |
| 4/3 | sk-1161 | بوكس ميني دانش (12 حبة) | بوكس | 471 / F-GT-0003 / بوكس مينى داش / قطعة / human_review_proposal [فرق وحدة] | manual_identity_review_required — السجل 471 بوكس ميني دانش دون عدد؛ السجل 472 ثلاث قطع ويخص sk-1043. |
| 4/4 | sk-1043 | بوكس ميني دانش (3 حبات) | بوكس | 472 / F-GT-0005 / بوكس مينى دانش 3 PCs / قطعة / human_review_proposal [فرق وحدة] | manual_identity_review_required |
| 4/5 | sk-1047 | بوكس ميني ساندويتش شباتا | بوكس | لا مرشح موثوق | no_evidenced_existing_candidate |
| 4/6 | sk-1213 | بوكس ميني شباتا | بوكس | لا مرشح موثوق | no_evidenced_existing_candidate |
| 4/7 | sk-1234 | بوكس ميني عسل ودانش (96) | بوكس | لا مرشح موثوق | no_evidenced_existing_candidate |
| 4/8 | sk-1011 | بوكس ميني كرواسون | بوكس | 473 / F-GT-0010 / بوكس مينى كرواسون / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |
| 4/9 | sk-1160 | بوكس ميني كرواسون (12 حبة) | بوكس | 551 /  / ميني كروسون بوكس ( 12 حبة ) / قطعة / human_review_proposal [فرق وحدة] | manual_identity_review_required — السجل 551 يذكر 12 قطعة ولكنه سجل إضافي بلا SKU. |
| 4/10 | sk-1046 | بوكس ميني كرواسون حلو (4 حبات) | بوكس | 474 / F-GT-0001 / بوكس مينى كرواسون حالى 4pcs / قطعة / human_review_proposal [فرق وحدة] ؛ 550 /  / بوكس ميني كروسون (4حبة) / قطعة / human_review_proposal [فرق وحدة] | ambiguous_multiple_candidates — السجل 474 مكتوب savoury بينما المصدر حلو؛ 550 أربع حبات دون تحديد حلو. لا تربط. |
| 4/11 | sk-1026 | بوكس ميني كيكة عسل | بوكس | 476 / F-GT-0007 / بوكس مينى كيكة عسل / قطعة / exact_cashier_english+exact_normalized_arabic_name [فرق وحدة] | manual_identity_review_required |

## حالات الالتباس المهمة

- 330183 (كيك ليمون سلايس): id 499 و500 لهما الاسم والاسم الإنجليزي والوحدة نفسيهما. لا تختَر أحدهما بلا مراجعة الاستعمالات والأرصدة.
- sk-1046 (بوكس كرواسون حلو 4 حبات): id 474 مكتوب بالإنجليزية Savoury (مالح)؛ id 550 عبوة 4 حبات لكن لا يحدد حلو/مالح، وكلاهما يحتاج تدقيقاً.
- sk-1161 صندوق دانش 12 حبة مقابل id 471 بلا عدد؛ sk-1043 صندوق دانش 3 حبات مقابل id 472، لا تخلطهما. sk-1160 صندوق كرواسون 12 حبة مقابل id 551 بلا SKU؛ sk-1011 صندوق كرواسون غير محدد العدد وله id 473.
- sk-1109 أفوكادو سكرامبل كب: id 404 مكتوب cubs واسم عربي يذكر كرواسون؛ قد يكون مختلفاً عن id 372 كرواسون سكرامبل أفوكادو. لا تدمج الأصناف.
- sk26 كود PDF حرفياً بدون شرطة. sk-0954 كاشيره يضم رمز خبز وقد يظهر ترتيب الكلمات مختلفاً بسبب اتجاه الكتابة.
- سلة دانش فواكه sk-1183 ليست تلقائياً دانش فواكه id 517؛ منتج سلة قد يختلف عن قطعة منفردة.

## سجلات النظام غير المرشحة

العدد 116. ليست قائمة حذف؛ التوصية حفظ الهوية والسعر والتاريخ حتى يقرر المسؤول إن كان منتجاً خارج هذه القائمة يتوقف مستقبلاً بعد فحص الاستخدام.

| id | SKU | الاسم | الفئة | الوحدة | السعر الحالي |
|---|---|---|---|---|---|
| 372 | F-BF-0003 | أفوكادو سكرمبل كرواسون | إفطار | قطعة | 27 |
| 373 | F-BF-0024 | أميريكان ايج | إفطار | قطعة | 32.21 |
| 374 | F-BF-0022 | أومليت فرنسى | إفطار | قطعة | 36 |
| 375 | F-BF-0011 | اسكرمبل البيض والأفوكادو | إفطار | قطعة | 37.71 |
| 376 | F-BF-0010 | بروسكيتا البيض | إفطار | قطعة | 25.35 |
| 377 | F-BF-0007 | بروسكيتا بيض مع شيدر | إفطار | قطعة | 25 |
| 383 | F-BF-0032 | بيض بروسكيتا | إفطار | قطعة | 27.48 |
| 384 | F-BF-0027 | بيض بنديكت كرواسون مع روستدبيف | إفطار | قطعة | 36.9 |
| 385 | F-BF-0029 | بيض بنديكت كرواسون مع سالمون | إفطار | قطعة | 36.9 |
| 386 | F-BF-0019 | بيض ترافل | إفطار | قطعة | 32.33 |
| 387 | F-BF-0014 | بيض تركى | إفطار | قطعة | 23 |
| 390 | F-BF-0031 | رويال بيندكيت | إفطار | قطعة | 38.13 |
| 391 | F-BF-0021 | ساندوتش البيض اليوناني | إفطار | قطعة | 24.62 |
| 393 | F-BF-0026 | سبايسى براون تونة | إفطار | قطعة | 26 |
| 399 | F-BF-0012 | فرنش توست | إفطار | قطعة | 27 |
| 402 | F-BF-0005 | كرواسون بيض جبنة | إفطار | قطعة | 28.52 |
| 405 | F-BF-0016 | منيمين | إفطار | قطعة | 23 |
| 408 | F-BR-0031 | V 60 بن يمنى بارد | باريستا | قطعة | 26.5 |
| 409 | F-BR-0032 | V 60 بن يمنى حار | باريستا | قطعة | 26.5 |
| 410 | F-BR-0018 | v 60 راسبيرى | باريستا | قطعة | 22 |
| 411 | F-BR-0011 | v60 | باريستا | قطعة | 19.03 |
| 412 | F-BR-0005 | v60 بارد | باريستا | قطعة | 21.03 |
| 413 | F-BR-0019 | اسبريسو | باريستا | قطعة | 11.04 |
| 414 | F-BR-0015 | امريكانو | باريستا | قطعة | 12.05 |
| 415 | F-BR-0023 | ايس تى خوخ | باريستا | قطعة | 21.86 |
| 416 | F-BR-0030 | بريز باشون فروت | باريستا | قطعة | 22.57 |
| 417 | F-BR-0024 | بريز بلو بيرى | باريستا | قطعة | 22.36 |
| 418 | F-BR-0028 | بريز فراولة | باريستا | قطعة | 22.59 |
| 419 | F-BR-0029 | بريز ليمون | باريستا | قطعة | 22.56 |
| 420 | F-BR-0022 | بريز ميكس بيرى | باريستا | قطعة | 22.49 |
| 421 | F-BR-0027 | بوكس قهوة اليوم | باريستا | قطعة | 57.06 |
| 422 | F-BR-0034 | دلة قهوة عربى | باريستا | قطعة | 29 |
| 423 | F-BR-0017 | سبانش لاتيه بارد | باريستا | قطعة | 23.61 |
| 424 | F-BR-0012 | سبانش لاتيه حار | باريستا | قطعة | 18.96 |
| 425 | F-BR-0025 | سبشيال أيس أمريكانو | باريستا | قطعة | 17.91 |
| 426 | F-BR-0006 | شاى | باريستا | قطعة | 7 |
| 427 | F-BR-0021 | شاى أخضر | باريستا | قطعة | 7 |
| 428 | F-BR-0010 | عصير برتقال | باريستا | قطعة | 17.32 |
| 429 | F-BR-0008 | فلات وايت | باريستا | قطعة | 15.9 |
| 430 | F-BR-0001 | قهوة اليوم بارد | باريستا | قطعة | 125.28 |
| 431 | F-BR-0002 | قهوة اليوم حار | باريستا | قطعة | 12.75 |
| 432 | F-BR-0007 | كابتشينو | باريستا | قطعة | 17.94 |
| 433 | F-BR-0016 | كركديه | باريستا | قطعة | 19.75 |
| 434 | F-BR-0035 | كوب قهوة عربى 12oz | باريستا | قطعة | 11.99 |
| 435 | F-BR-0033 | كوب قهوة عربى 9oz | باريستا | قطعة | 7 |
| 436 | F-BR-0020 | كورتادو | باريستا | قطعة | 15.06 |
| 437 | F-BR-0009 | لاتيه | باريستا | قطعة | 16.05 |
| 438 | F-BR-0003 | ماء | باريستا | قطعة | 4.15 |
| 439 | F-BR-0014 | ماتشا | باريستا | قطعة | 22.16 |
| 440 | F-BR-0026 | ماكياتو | باريستا | قطعة | 15.05 |
| 441 | F-BR-0013 | هوت شوكلت فرنسا كلاسيك | باريستا | قطعة | 33.35 |
| 442 | F-BR-0004 | هوت شوكليت | باريستا | قطعة | 18.92 |
| 443 | F-PZ-0022 | أومليت بيتزا | بيتزا | قطعة | 27 |
| 444 | F-PZ-0003 | بتزا بوراتا - بيستو | بيتزا | قطعة | 49.11 |
| 445 | F-PZ-0005 | بتزا بوراتا - عسل | بيتزا | قطعة | 43.44 |
| 446 | F-PZ-0023 | بتزا بوراتا بالسميك | بيتزا | قطعة | 65 |
| 447 | F-PZ-0007 | بتزا ترافل | بيتزا | قطعة | 69.23 |
| 448 | F-PZ-0016 | بتزا كواترو فروماج | بيتزا | قطعة | 63 |
| 449 | F-PZ-0019 | بتزا موظفين | بيتزا | قطعة | 19 |
| 450 | F-PZ-0028 | بيتزا بورتا فلات | بيتزا | قطعة | 37 |
| 451 | F-PZ-0025 | بيتزا بيبروني مانزو | بيتزا | قطعة | 34.01 |
| 452 | F-PZ-0017 | بيتزا ترافل فلات | بيتزا | قطعة | 37 |
| 453 | F-PZ-0011 | بيتزا رانش فلات | بيتزا | قطعة | 37 |
| 454 | F-PZ-0010 | بيتزا روكولا فلات | بيتزا | قطعة | 37 |
| 455 | F-PZ-0026 | بيتزا فلات | بيتزا | قطعة | 28 |
| 456 | F-PZ-0020 | بيتزا كواترو فورماج فلات | بيتزا | قطعة | 27 |
| 457 | F-PZ-0027 | بيتزا كون تركى | بيتزا | قطعة | 26.45 |
| 458 | F-PZ-0021 | بيتزا كون مكس أجبان | بيتزا | قطعة | 23 |
| 459 | F-PZ-0006 | بيتزا مارجريتا فلات | بيتزا | قطعة | 37 |
| 460 | F-PZ-0001 | بيتزا مي - رانش | بيتزا | قطعة | 63.2 |
| 461 | F-PZ-0015 | بيتزا مي، روكولا | بيتزا | قطعة | 54.02 |
| 462 | F-PZ-0018 | بيتزا ميكس أجبان | بيتزا | قطعة | 37 |
| 465 | F-PZ-0012 | ساندويتش لحم بقر | بيتزا | قطعة | 37.28 |
| 466 | F-PZ-0014 | سبشيال هوت تشكن بتزا | بيتزا | قطعة | 63.55 |
| 467 | F-PZ-0024 | فوكاتشا-روستد بيف | بيتزا | قطعة | 34.01 |
| 470 | F-PZ-0002 | مارجريتا بيتزا | بيتزا | قطعة | 55.15 |
| 475 | F-GT-0009 | بوكس مينى كيك ريدفلفت | تجمعات | قطعة | 55.4 |
| 477 | F-GT-0002 | جمعات مينى ريد فلفت و القهوة | تجمعات | قطعة | 99 |
| 478 | F-GT-0004 | جمعات مينى كرواسون و القهوة | تجمعات | قطعة | 98.34 |
| 479 | F-GT-0008 | جمعات مينى كيكة عسل و القهوة | تجمعات | قطعة | 97.58 |
| 480 | F-GT-0006 | عرض الكرنشى تشوكلت | تجمعات | قطعة | 29 |
| 481 | F-PS-0015 | أيس مان 2026 | حلويات | قطعة | 23 |
| 483 | F-PS-0021 | بودينج التمر | حلويات | قطعة | 13 |
| 485 | F-PS-0012 | تارت بيكان | حلويات | قطعة | 16 |
| 489 | F-PS-0013 | شاي الشتاء | حلويات | قطعة | 11.39 |
| 504 | F-PS-0007 | مدريد تشيز كيك فانيلا | حلويات | قطعة | 37.04 |
| 505 | F-BK-0009 | تشوكلت ماري توزو | مخبوزات | قطعة | 28 |
| 513 | F-BK-0011 | دانش بار لبنة و زعتر | مخبوزات | قطعة | 26 |
| 517 | F-BK-0004 | دانش فواكه | مخبوزات | قطعة | 22.75 |
| 535 | F-BK-0013 | ماتيلدا كرواسون بيكان | مخبوزات | قطعة | 54 |
| 539 |  | فرنش توست ايفنت  | إفطار | قطعة | 14 |
| 540 |  | قهوة اليوم ايفنت حار | باريستا | قطعة | 9 |
| 541 |  | قهوة اليوم ايفنت بارد  | باريستا | قطعة | 8.97 |
| 542 |  | كريم بورلية فخار | حلويات | قطعة | 13 |
| 543 |  | بوكس ميني  ايفنت ( 3) | إفطار | قطعة | 13 |
| 544 |  | كرانشي بار ايفنت | حلويات | قطعة | 13 |
| 545 |  | تشورو | حلويات | قطعة | 14 |
| 546 |  | هوت شوكلت  | باريستا | كوب | 14 |
| 548 |  | مياه ايفنت  | باريستا | زجاجة | 2 |
| 549 |  | شاي | باريستا | كوب | 4 |
| 552 |  | مياة معدنية صغيرة  | تجمعات | قطعة | 1 |
| 553 |  |  honey bites box | تجمعات | قطعة | 21 |
| 554 |  | فلات وايت  | باريستا | كوب | 14 |
| 555 |  | لاتية | باريستا | كوب | 16 |
| 556 |  | كابتشينو | باريستا | كوب | 16 |
| 557 |  | اسبريسو | باريستا | كوب | 9 |
| 558 |  | اسبريسو | باريستا | كوب | 9 |
| 559 |  | ميني كوكيز  | حلويات | قطعة | 5 |
| 560 |  | ميني كوكيز توينز | حلويات | قطعة | 9 |
| 561 |  | ايس كريم بن  | باريستا | قطعة | 14 |
| 562 |  | شيمني ايس كريم  | حلويات | قطعة | 17 |
| 563 |  | دانيش ايس كريم بستاشيو  | حلويات | قطعة | 18 |
| 564 |  | شيمني كاسترد | حلويات | قطعة | 17 |
| 565 |  | وافيل  | حلويات | قطعة | 13 |
| 566 |  | مياة | باريستا | قطعة | 5 |
| 567 |  | مياة برين  | باريستا | قطعة | 4.15 |
