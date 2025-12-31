-- ==========================================
-- جدول المنتجات - Products Table
-- ==========================================

-- أولاً: إنشاء جدول المنتجات
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT DEFAULT 'قطعة',
    base_price REAL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    description TEXT,
    notes TEXT,
    sku TEXT,
    price_excl_vat REAL,
    vat_amount REAL,
    vat_rate REAL DEFAULT 0.15,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ثانياً: إدراج بيانات المنتجات (204 منتج)
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (1, E'Eggs Benedict Croissant – Smoked Salmon', E'سلطات ووجبات', E'طبق', 36.9, TRUE, 'sk-1156', 32.09, 4.81, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (2, E'Eggs Benedict Croissant , Roast Beef', E'سلطات ووجبات', E'طبق', 36.9, TRUE, 'sk-1155', 32.09, 4.81, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (3, E'V 60 بن يمنى بارد', E'مشروبات', E'كوب', 26.5, TRUE, 'sk-1154', 23.04, 3.46, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (4, E'V 60 بن يمنى حار', E'مشروبات', E'كوب', 26.5, TRUE, 'sk-1153', 23.04, 3.46, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (5, E'Ice man 2026', E'حلويات', E'قطعة', 23, TRUE, 'sk-1152', 20, 3, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (6, E'Bruschetta Egg Cheddar - بروسكيتا بيض مع شيدر', E'سلطات ووجبات', E'طبق', 25, TRUE, 'sk-1151', 21.74, 3.26, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (7, E'Scarv lrg', E'هدايا وإكسسوارات', E'قطعة', 42, TRUE, 'sk-1150', 36.52, 5.48, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (8, E'Scarv orange', E'هدايا وإكسسوارات', E'قطعة', 37, TRUE, 'sk-1149', 32.17, 4.83, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (9, E'Scarv سكارف small', E'هدايا وإكسسوارات', E'قطعة', 33.99, TRUE, 'sk-1148', 29.56, 4.43, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (10, E'شتوية الرياض - winter EVENT RYD', E'أخرى', E'تذكرة/حجز', 51.75, TRUE, 'sk-1147', 45, 6.75, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (11, E'هوت شوكلت فرنسا كلاسيك', E'مشروبات', E'كوب', 33.35, TRUE, 'sk-1146', 29, 4.35, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (12, E'حجز ايفنت الشتاء ابها', E'أخرى', E'تذكرة/حجز', 33.35, TRUE, 'sk-1145', 29, 4.35, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (13, E'Winter tea شاي الشتاء', E'حلويات', E'كوب', 11.38, TRUE, 'sk-1144', 9.9, 1.48, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (14, E'Tiramisu كب تراميسيو', E'حلويات', E'قطعة', 24.15, TRUE, 'sk-1143', 21, 3.15, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (15, E'Pudding chocolate بودنج بيكان', E'حلويات', E'كوب', 18.4, TRUE, 'sk-1142', 16, 2.4, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (16, E'Brawinse crunchy بودنج كرنشي', E'حلويات', E'قطعة', 18.4, TRUE, 'sk-1141', 16, 2.4, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (17, E'Beet root Salad M', E'سلطات ووجبات', E'طبق', 16, TRUE, 'sk-1140', 13.91, 2.09, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (18, E'pizza mix cheese - بيتزا ميكس أجبان', E'بيتزا', E'طبق', 37, TRUE, 'sk-1139', 32.17, 4.83, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (19, E'pizza puratta flat - بيتزا بورتا فلات', E'بيتزا', E'طبق', 37, TRUE, 'sk-1138', 32.17, 4.83, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (20, E'pizza truffle flat - بيتزا ترافل فلات', E'بيتزا', E'طبق', 37, TRUE, 'sk-1137', 32.17, 4.83, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (21, E'pizza roculla flat - بيتزا روكولا فلات', E'بيتزا', E'طبق', 37, TRUE, 'sk-1136', 32.17, 4.83, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (22, E'Pizza Margrita Flat - بيتزا مارجريتا فلات', E'بيتزا', E'طبق', 37, TRUE, 'sk-1135', 32.17, 4.83, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (23, E'Pizza Ruch Flat - بيتزا رانش فلات', E'بيتزا', E'طبق', 37, TRUE, 'sk-1134', 32.17, 4.83, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (24, E'دانيش دقة - Danish Douqqa', E'مخبوزات', E'قطعة', 21.56, TRUE, 'sk-1133', 18.75, 2.81, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (25, E'Matilda Croissant Nutella', E'مخبوزات', E'قطعة', 54, TRUE, 'sk-1132', 46.96, 7.04, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (26, E'تارت بيكان - pecan tart', E'حلويات', E'قطعة', 16, TRUE, 'sk-1095', 13.91, 2.09, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (27, E'سلطة شمندر - Beetroot Salade', E'سلطات ووجبات', E'طبق', 34.99, TRUE, 'sk-1094', 30.43, 4.56, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (28, E'ساندويتش سالمون مدخن - Smoked Salmon Sandwiche', E'سلطات ووجبات', E'طبق', 30, TRUE, 'sk-1093', 26.09, 3.91, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (29, E'شباطا دجاج مكسيكى - Cibatta Mexican', E'سلطات ووجبات', E'طبق', 24, TRUE, 'sk-1092', 20.87, 3.13, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (30, E'سبايسى براون تونة - Spicy Brown Tunna', E'سلطات ووجبات', E'كوب', 26, TRUE, 'sk-1091', 22.61, 3.39, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (31, E'ساندويتش تونة ايطالى - Italian Brown Tunna', E'سلطات ووجبات', E'طبق', 26, TRUE, 'sk-1090', 22.61, 3.39, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (32, E'دانش تيراميسو - Tiramisue Danish', E'مخبوزات', E'قطعة', 27, TRUE, 'sk-1089', 23.48, 3.52, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (33, E'دانش ماش بوتيتو - Danish Mash Potato', E'مخبوزات', E'قطعة', 26, TRUE, 'sk-1088', 22.61, 3.39, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (34, E'دانش بار لبنة و زعتر - Danish Bar Labna And Thyme', E'مخبوزات', E'قطعة', 26, TRUE, 'sk-1087', 22.61, 3.39, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (35, E'كرواسون جبنة و تركى - Cheese Ana turkey croissant', E'مخبوزات', E'قطعة', 21, TRUE, 'sk-1086', 18.26, 2.74, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (36, E'روستد بيف مع جبنة و زيتون - Roasted beef cheese,olive', E'مخبوزات', E'قطعة', 21, TRUE, 'sk-1085', 18.26, 2.74, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (37, E'فوكاشيا تركى - Turkey Focaccia', E'سلطات ووجبات', E'طبق', 23.9, TRUE, 'sk-1081', 20.78, 3.12, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (38, E'شاى أخضر - green tea', E'مشروبات', E'كوب', 7, TRUE, 'sk-1080', 6.09, 0.91, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (39, E'شاى - tea', E'مشروبات', E'كوب', 7, TRUE, 'sk-1079', 6.09, 0.91, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (40, E'راسبيرى كرواسون - Raspberry croissant', E'مخبوزات', E'قطعة', 22, TRUE, 'sk-1078', 19.13, 2.87, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (41, E'چاك قهوة عربى', E'مشروبات', E'كوب', 45, TRUE, 'sk-1070', 39.13, 5.87, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (42, E'دلة قهوة عربى', E'مشروبات', E'كوب', 29, TRUE, 'sk-1069', 25.22, 3.78, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (43, E'كوب قهوة عربى 12oz', E'مشروبات', E'كوب', 11.99, TRUE, 'sk-1068', 10.43, 1.56, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (44, E'كوب قهوة عربى 9oz', E'مشروبات', E'كوب', 7, TRUE, 'sk-1067', 6.09, 0.91, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (45, E'شيمنى كريم تشيز + chimney cream cheese', E'حلويات', E'قطعة', 29, TRUE, 'sk-1066', 25.22, 3.78, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (46, E'عرض الكرنشى تشوكلت - Crunchy Chocolate Offer', E'أخرى', E'باكيت', 29, TRUE, 'sk-1052', 25.22, 3.78, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (47, E'Ice tiramisu- أيس تيراميسو', E'مشروبات', E'كوب', 25, TRUE, 'sk-1049', 21.74, 3.26, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (48, E'بوكس مينى ساندوتش شباتا', E'أخرى', E'باكيت', 24.9, TRUE, 'sk-1047', 21.65, 3.25, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (49, E'بوكس مينى كرواسون حالى 4pcs', E'أخرى', E'باكيت', 23.9, TRUE, 'sk-1046', 20.78, 3.12, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (50, E'بوكس مينى دانش 3 PCs', E'أخرى', E'باكيت', 24.9, TRUE, 'sk-1043', 21.65, 3.25, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (51, E'دانش سباي براون تونه - Danish Spicy Browne Tuna', E'مخبوزات', E'قطعة', 26, TRUE, 'sk-1042', 22.61, 3.39, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (52, E'دانش زعتر جبنة - Danish Thyme', E'مخبوزات', E'قطعة', 17.9, TRUE, 'sk-1041', 15.57, 2.33, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (53, E'دانش عسل مكسرات - Danish Honey Nuts', E'مخبوزات', E'قطعة', 20, TRUE, 'sk-1040', 17.39, 2.61, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (54, E'دانش سيناموان كريم - Danish Cinamon Roll', E'مخبوزات', E'قطعة', 27, TRUE, 'sk-1039', 23.48, 3.52, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (55, E'دانش كرميل آبل - Danish Carmel Apple', E'مخبوزات', E'قطعة', 27, TRUE, 'sk-1038', 23.48, 3.52, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (56, E'دانش راسبيرى - Danish Raspberry', E'مخبوزات', E'قطعة', 27, TRUE, 'sk-1037', 23.48, 3.52, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (57, E'دانش بستاشيو - Danish Pistachio', E'مخبوزات', E'قطعة', 27, TRUE, 'sk-1036', 23.48, 3.52, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (58, E'دانش لوتس - Danish Lotus', E'مخبوزات', E'قطعة', 27, TRUE, 'sk-1035', 23.48, 3.52, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (59, E'دانش نوتيلا - Danish Nutella', E'مخبوزات', E'قطعة', 27, TRUE, 'sk-1034', 23.48, 3.52, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (60, E'بوكس مينى كرواسون مالح 4pcs', E'أخرى', E'باكيت', 23.9, TRUE, 'sk-1033', 20.78, 3.12, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (61, E'بوكس مينى دانش حالى 3 PCs', E'أخرى', E'باكيت', 24.9, TRUE, 'sk-1032', 21.65, 3.25, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (62, E'عرض الدانش الحالى - Sweet Danish Offer', E'أخرى', E'باكيت', 29, TRUE, 'sk-1031', 25.22, 3.78, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (63, E'عرض الكرواسون المالح - Savory Croissant Offer', E'أخرى', E'باكيت', 29, TRUE, 'sk-1030', 25.22, 3.78, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (64, E'عرض الكرواسون الحالى - Sweet Croissant Offer', E'أخرى', E'باكيت', 29, TRUE, 'sk-1029', 25.22, 3.78, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (65, E'كرواسون سالمون مدخن - Smoked Salmon Croissant', E'مخبوزات', E'قطعة', 27, TRUE, 'sk-1026', 23.48, 3.52, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (66, E'كرواسون نوتيلا - Croissant Nutella', E'مخبوزات', E'قطعة', 20, TRUE, 'sk-1025', 17.39, 2.61, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (67, E'لاتيه بارد - Ice Latte', E'مشروبات', E'كوب', 24.99, TRUE, 'sk-1024', 21.73, 3.26, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (68, E'لاتيه حار - Latte Hot', E'مشروبات', E'كوب', 21, TRUE, 'sk-1023', 18.26, 2.74, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (69, E'اسبريسو دوبل - Espresso Double', E'مشروبات', E'كوب', 15, TRUE, 'sk-1022', 13.04, 1.96, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (70, E'اسبريسو سنجل - Espresso Single', E'مشروبات', E'كوب', 11, TRUE, 'sk-1021', 9.57, 1.43, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (71, E'سويتش - Spanish Latte', E'مشروبات', E'كوب', 25, TRUE, 'sk-1020', 21.74, 3.26, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (72, E'فلات وايت - Flat White', E'مشروبات', E'كوب', 23, TRUE, 'sk-1019', 20, 3, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (73, E'كابتشينو بارد - Ice cappuccino', E'مشروبات', E'كوب', 24.99, TRUE, 'sk-1018', 21.73, 3.26, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (74, E'كابتشينو حار - Cappuccino Hot', E'مشروبات', E'كوب', 21, TRUE, 'sk-1017', 18.26, 2.74, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (75, E'أمريكانو بارد - Americano Ice', E'مشروبات', E'كوب', 19.99, TRUE, 'sk-1016', 17.38, 2.61, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (76, E'أمريكانو حار - Americano Hot', E'مشروبات', E'كوب', 16, TRUE, 'sk-1015', 13.91, 2.09, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (77, E'موكا بارد - Ice Mocha', E'مشروبات', E'كوب', 28.99, TRUE, 'sk-1014', 25.21, 3.78, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (78, E'موكا حار - Hot Mocha', E'مشروبات', E'كوب', 26, TRUE, 'sk-1013', 22.61, 3.39, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (79, E'V60 12 oz', E'مشروبات', E'كوب', 21, TRUE, 'sk-1012', 18.26, 2.74, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (80, E'V60 9 oz', E'مشروبات', E'كوب', 17, TRUE, 'sk-1011', 14.78, 2.22, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (81, E'كورتادو - Cortado', E'مشروبات', E'كوب', 18, TRUE, 'sk-1010', 15.65, 2.35, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (82, E'ماكياتو - Macchiato', E'مشروبات', E'كوب', 16, TRUE, 'sk-1009', 13.91, 2.09, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (83, E'سبانش لاتيه بارد - Spanish Latte Ice', E'مشروبات', E'كوب', 27.99, TRUE, 'sk-1008', 24.34, 3.65, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (84, E'سبانش لاتيه حار - Spanish Latte Hot', E'مشروبات', E'كوب', 25, TRUE, 'sk-1007', 21.74, 3.26, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (85, E'بستاشيو لاتيه بارد - Pistachio Latte Ice', E'مشروبات', E'كوب', 28.99, TRUE, 'sk-1006', 25.21, 3.78, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (86, E'بستاشيو لاتيه حار - Pistachio Latte Hot', E'مشروبات', E'كوب', 26, TRUE, 'sk-1005', 22.61, 3.39, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (87, E'كراميل ماكياتو بارد - Caramel Macchiato Ice', E'مشروبات', E'كوب', 28.99, TRUE, 'sk-1004', 25.21, 3.78, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (88, E'كراميل ماكياتو حار - Caramel Macchiato Hot', E'مشروبات', E'كوب', 26, TRUE, 'sk-1003', 22.61, 3.39, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (89, E'آيس شيكن اسبريسو - Ice Shaken Espresso', E'مشروبات', E'كوب', 25.99, TRUE, 'sk-1002', 22.6, 3.39, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (90, E'عصير برتقال - Orange Juice', E'مشروبات', E'كوب', 20.99, TRUE, 'sk-1001', 18.25, 2.74, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (91, E'ماء - Water', E'مشروبات', E'زجاجة', 3, TRUE, 'sk-1000', 2.61, 0.39, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (92, E'صودا - Soda', E'مشروبات', E'زجاجة', 5, TRUE, 'sk-999', 4.35, 0.65, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (93, E'ريد بول - Red Bull', E'مشروبات', E'علبة', 15, TRUE, 'sk-998', 13.04, 1.96, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (94, E'ماتشا لاتيه بارد - Matcha Latte Ice', E'مشروبات', E'كوب', 26.99, TRUE, 'sk-997', 23.47, 3.52, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (95, E'ماتشا لاتيه حار - Matcha Latte Hot', E'مشروبات', E'كوب', 24, TRUE, 'sk-996', 20.87, 3.13, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (96, E'شاى تشاى لاتيه بارد - Chai Latte Ice', E'مشروبات', E'كوب', 21.99, TRUE, 'sk-995', 19.12, 2.87, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (97, E'شاى تشاى لاتيه حار - Chai Latte Hot', E'مشروبات', E'كوب', 19, TRUE, 'sk-994', 16.52, 2.48, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (98, E'هوت شوكلت - Hot Chocolate', E'مشروبات', E'كوب', 21, TRUE, 'sk-993', 18.26, 2.74, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (99, E'Lotus Latte بارد - Lotus Latte Ice', E'مشروبات', E'كوب', 28.99, TRUE, 'sk-992', 25.21, 3.78, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (100, E'Lotus Latte حار - Lotus Latte Hot', E'مشروبات', E'كوب', 26, TRUE, 'sk-991', 22.61, 3.39, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (101, E'كرواسون باتر - Croissant Butter', E'مخبوزات', E'قطعة', 14, TRUE, 'sk-990', 12.17, 1.83, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (102, E'كرواسون شوكلت - Croissant Chocolate', E'مخبوزات', E'قطعة', 17, TRUE, 'sk-989', 14.78, 2.22, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (103, E'كرواسون زعتر - Croissant Thyme', E'مخبوزات', E'قطعة', 17, TRUE, 'sk-988', 14.78, 2.22, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (104, E'كرواسون جبنة - Croissant Cheese', E'مخبوزات', E'قطعة', 17, TRUE, 'sk-987', 14.78, 2.22, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (105, E'كرواسون لوتس - Croissant Lotus', E'مخبوزات', E'قطعة', 20, TRUE, 'sk-986', 17.39, 2.61, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (106, E'كرواسون بستاشيو - Croissant Pistachio', E'مخبوزات', E'قطعة', 20, TRUE, 'sk-985', 17.39, 2.61, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (107, E'كرواسون سيناموان - Croissant Cinnamon', E'مخبوزات', E'قطعة', 18, TRUE, 'sk-984', 15.65, 2.35, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (108, E'كب كيك شوكلت - Cupcake Chocolate', E'حلويات', E'قطعة', 15, TRUE, 'sk-983', 13.04, 1.96, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (109, E'كب كيك ريد فلفت - Cupcake Red Velvet', E'حلويات', E'قطعة', 15, TRUE, 'sk-982', 13.04, 1.96, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (110, E'كب كيك فانيلا - Cupcake Vanilla', E'حلويات', E'قطعة', 15, TRUE, 'sk-981', 13.04, 1.96, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (111, E'تشيز كيك - Cheesecake', E'حلويات', E'قطعة', 25, TRUE, 'sk-980', 21.74, 3.26, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (112, E'تشيز كيك لوتس - Cheesecake Lotus', E'حلويات', E'قطعة', 27, TRUE, 'sk-979', 23.48, 3.52, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (113, E'براونى - Brownie', E'حلويات', E'قطعة', 16, TRUE, 'sk-978', 13.91, 2.09, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (114, E'كوكيز شوكلت تشيب - Cookie Chocolate Chip', E'حلويات', E'قطعة', 12, TRUE, 'sk-977', 10.43, 1.57, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (115, E'كوكيز لوتس - Cookie Lotus', E'حلويات', E'قطعة', 14, TRUE, 'sk-976', 12.17, 1.83, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (116, E'مافن شوكلت - Muffin Chocolate', E'حلويات', E'قطعة', 14, TRUE, 'sk-975', 12.17, 1.83, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (117, E'مافن بلوبيرى - Muffin Blueberry', E'حلويات', E'قطعة', 14, TRUE, 'sk-974', 12.17, 1.83, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (118, E'كيك كرنشى تشوكلت - Crunchy Chocolate Cake', E'حلويات', E'قطعة', 22, TRUE, 'sk-973', 19.13, 2.87, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (119, E'تارت فواكه - Fruit Tart', E'حلويات', E'قطعة', 20, TRUE, 'sk-972', 17.39, 2.61, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (120, E'تارت ليمون - Lemon Tart', E'حلويات', E'قطعة', 18, TRUE, 'sk-971', 15.65, 2.35, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (121, E'اكلير شوكلت - Eclair Chocolate', E'حلويات', E'قطعة', 17, TRUE, 'sk-970', 14.78, 2.22, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (122, E'بوكس كوكيز 6 قطع - Cookie Box 6pcs', E'أخرى', E'باكيت', 65, TRUE, 'sk-969', 56.52, 8.48, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (123, E'بوكس كوكيز 12 قطعة - Cookie Box 12pcs', E'أخرى', E'باكيت', 120, TRUE, 'sk-968', 104.35, 15.65, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (124, E'سلطة سيزر دجاج - Chicken Caesar Salad', E'سلطات ووجبات', E'طبق', 32, TRUE, 'sk-967', 27.83, 4.17, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (125, E'سلطة يونانية - Greek Salad', E'سلطات ووجبات', E'طبق', 28, TRUE, 'sk-966', 24.35, 3.65, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (126, E'سلطة كينوا - Quinoa Salad', E'سلطات ووجبات', E'طبق', 30, TRUE, 'sk-965', 26.09, 3.91, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (127, E'ساندويتش دجاج كلوب - Chicken Club Sandwich', E'سلطات ووجبات', E'طبق', 30, TRUE, 'sk-964', 26.09, 3.91, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (128, E'ساندويتش بيف - Beef Sandwich', E'سلطات ووجبات', E'طبق', 32, TRUE, 'sk-963', 27.83, 4.17, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (129, E'ساندويتش هالومي - Halloumi Sandwich', E'سلطات ووجبات', E'طبق', 26, TRUE, 'sk-962', 22.61, 3.39, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (130, E'فوكاشيا بيستو دجاج - Pesto Chicken Focaccia', E'سلطات ووجبات', E'طبق', 27, TRUE, 'sk-961', 23.48, 3.52, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (131, E'بانيني جبنة - Cheese Panini', E'سلطات ووجبات', E'طبق', 22, TRUE, 'sk-960', 19.13, 2.87, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (132, E'راب دجاج - Chicken Wrap', E'سلطات ووجبات', E'طبق', 25, TRUE, 'sk-959', 21.74, 3.26, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (133, E'راب فلافل - Falafel Wrap', E'سلطات ووجبات', E'طبق', 22, TRUE, 'sk-958', 19.13, 2.87, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (134, E'بطاطس مقلية - French Fries', E'سلطات ووجبات', E'طبق', 15, TRUE, 'sk-957', 13.04, 1.96, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (135, E'ويدجز بطاطس - Potato Wedges', E'سلطات ووجبات', E'طبق', 17, TRUE, 'sk-956', 14.78, 2.22, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (136, E'هامبرغر كلاسيك - Classic Burger', E'سلطات ووجبات', E'طبق', 35, TRUE, 'sk-955', 30.43, 4.57, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (137, E'هامبرغر مع بيض - Egg Burger', E'سلطات ووجبات', E'طبق', 38, TRUE, 'sk-954', 33.04, 4.96, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (138, E'باستا بيستو - Pesto Pasta', E'سلطات ووجبات', E'طبق', 28, TRUE, 'sk-953', 24.35, 3.65, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (139, E'باستا الفريدو - Alfredo Pasta', E'سلطات ووجبات', E'طبق', 30, TRUE, 'sk-952', 26.09, 3.91, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (140, E'باستا بولونيز - Bolognese Pasta', E'سلطات ووجبات', E'طبق', 32, TRUE, 'sk-951', 27.83, 4.17, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (141, E'بيتزا مارجريتا - Margherita Pizza', E'بيتزا', E'طبق', 35, TRUE, 'sk-950', 30.43, 4.57, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (142, E'بيتزا بيبروني - Pepperoni Pizza', E'بيتزا', E'طبق', 40, TRUE, 'sk-949', 34.78, 5.22, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (143, E'بيتزا خضار - Vegetable Pizza', E'بيتزا', E'طبق', 35, TRUE, 'sk-948', 30.43, 4.57, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (144, E'بيتزا دجاج باربكيو - BBQ Chicken Pizza', E'بيتزا', E'طبق', 42, TRUE, 'sk-947', 36.52, 5.48, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (145, E'كوفى كيك - Coffee Cake', E'حلويات', E'قطعة', 18, TRUE, 'sk-946', 15.65, 2.35, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (146, E'كارروت كيك - Carrot Cake', E'حلويات', E'قطعة', 20, TRUE, 'sk-945', 17.39, 2.61, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (147, E'ريد فيلفت كيك - Red Velvet Cake', E'حلويات', E'قطعة', 22, TRUE, 'sk-944', 19.13, 2.87, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (148, E'شوكلت كيك - Chocolate Cake', E'حلويات', E'قطعة', 22, TRUE, 'sk-943', 19.13, 2.87, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (149, E'فانيلا كيك - Vanilla Cake', E'حلويات', E'قطعة', 20, TRUE, 'sk-942', 17.39, 2.61, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (150, E'تيراميسو - Tiramisu', E'حلويات', E'قطعة', 25, TRUE, 'sk-941', 21.74, 3.26, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (151, E'بانا كوتا - Panna Cotta', E'حلويات', E'قطعة', 18, TRUE, 'sk-940', 15.65, 2.35, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (152, E'كريم بروليه - Creme Brulee', E'حلويات', E'قطعة', 20, TRUE, 'sk-939', 17.39, 2.61, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (153, E'موس شوكلت - Chocolate Mousse', E'حلويات', E'قطعة', 18, TRUE, 'sk-938', 15.65, 2.35, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (154, E'سموذى مانجو - Mango Smoothie', E'مشروبات', E'كوب', 25, TRUE, 'sk-937', 21.74, 3.26, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (155, E'سموذى فراولة - Strawberry Smoothie', E'مشروبات', E'كوب', 25, TRUE, 'sk-936', 21.74, 3.26, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (156, E'سموذى بيرى - Berry Smoothie', E'مشروبات', E'كوب', 27, TRUE, 'sk-935', 23.48, 3.52, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (157, E'سموذى موز - Banana Smoothie', E'مشروبات', E'كوب', 23, TRUE, 'sk-934', 20, 3, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (158, E'ميلك شيك فانيلا - Vanilla Milkshake', E'مشروبات', E'كوب', 25, TRUE, 'sk-933', 21.74, 3.26, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (159, E'ميلك شيك شوكلت - Chocolate Milkshake', E'مشروبات', E'كوب', 27, TRUE, 'sk-932', 23.48, 3.52, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (160, E'ميلك شيك لوتس - Lotus Milkshake', E'مشروبات', E'كوب', 29, TRUE, 'sk-931', 25.22, 3.78, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (161, E'كولد برو - Cold Brew', E'مشروبات', E'كوب', 22, TRUE, 'sk-930', 19.13, 2.87, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (162, E'نيترو كولد برو - Nitro Cold Brew', E'مشروبات', E'كوب', 27, TRUE, 'sk-929', 23.48, 3.52, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (163, E'افوغاتو - Affogato', E'مشروبات', E'كوب', 22, TRUE, 'sk-928', 19.13, 2.87, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (164, E'ايرش كوفى - Irish Coffee', E'مشروبات', E'كوب', 28, TRUE, 'sk-927', 24.35, 3.65, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (165, E'اسبريسو تونيك - Espresso Tonic', E'مشروبات', E'كوب', 25, TRUE, 'sk-926', 21.74, 3.26, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (166, E'كوكتيل موهيتو - Mojito Mocktail', E'مشروبات', E'كوب', 22, TRUE, 'sk-925', 19.13, 2.87, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (167, E'كوكتيل باشن فروت - Passion Fruit Mocktail', E'مشروبات', E'كوب', 24, TRUE, 'sk-924', 20.87, 3.13, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (168, E'ليموناده - Lemonade', E'مشروبات', E'كوب', 18, TRUE, 'sk-923', 15.65, 2.35, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (169, E'ليموناده نعناع - Mint Lemonade', E'مشروبات', E'كوب', 20, TRUE, 'sk-922', 17.39, 2.61, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (170, E'ليموناده فراولة - Strawberry Lemonade', E'مشروبات', E'كوب', 22, TRUE, 'sk-921', 19.13, 2.87, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (171, E'آيس تى خوخ - Peach Iced Tea', E'مشروبات', E'كوب', 18, TRUE, 'sk-920', 15.65, 2.35, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (172, E'آيس تى ليمون - Lemon Iced Tea', E'مشروبات', E'كوب', 18, TRUE, 'sk-919', 15.65, 2.35, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (173, E'آيس تى باشن - Passion Iced Tea', E'مشروبات', E'كوب', 20, TRUE, 'sk-918', 17.39, 2.61, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (174, E'حليب طازج - Fresh Milk', E'مشروبات', E'كوب', 10, TRUE, 'sk-917', 8.7, 1.3, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (175, E'حليب شوكلت - Chocolate Milk', E'مشروبات', E'كوب', 14, TRUE, 'sk-916', 12.17, 1.83, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (176, E'حليب فراولة - Strawberry Milk', E'مشروبات', E'كوب', 14, TRUE, 'sk-915', 12.17, 1.83, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (177, E'حليب موز - Banana Milk', E'مشروبات', E'كوب', 14, TRUE, 'sk-914', 12.17, 1.83, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (178, E'بان كيك كلاسيك - Classic Pancake', E'سلطات ووجبات', E'طبق', 25, TRUE, 'sk-913', 21.74, 3.26, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (179, E'بان كيك نوتيلا - Nutella Pancake', E'سلطات ووجبات', E'طبق', 30, TRUE, 'sk-912', 26.09, 3.91, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (180, E'بان كيك فواكه - Fruit Pancake', E'سلطات ووجبات', E'طبق', 32, TRUE, 'sk-911', 27.83, 4.17, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (181, E'وافل كلاسيك - Classic Waffle', E'سلطات ووجبات', E'طبق', 25, TRUE, 'sk-910', 21.74, 3.26, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (182, E'وافل نوتيلا - Nutella Waffle', E'سلطات ووجبات', E'طبق', 30, TRUE, 'sk-909', 26.09, 3.91, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (183, E'وافل فواكه - Fruit Waffle', E'سلطات ووجبات', E'طبق', 32, TRUE, 'sk-908', 27.83, 4.17, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (184, E'كريب نوتيلا - Nutella Crepe', E'سلطات ووجبات', E'طبق', 28, TRUE, 'sk-907', 24.35, 3.65, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (185, E'كريب جبنة - Cheese Crepe', E'سلطات ووجبات', E'طبق', 25, TRUE, 'sk-906', 21.74, 3.26, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (186, E'شكشوكة - Shakshuka', E'سلطات ووجبات', E'طبق', 25, TRUE, 'sk-1125', 21.74, 3.26, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (187, E'Menemen', E'سلطات ووجبات', E'طبق', 23, TRUE, 'sk-1124', 20, 3, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (188, E'Turkish egg', E'سلطات ووجبات', E'طبق', 23, TRUE, 'sk-1123', 20, 3, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (189, E'Avocado croissant', E'سلطات ووجبات', E'طبق', 27, TRUE, 'sk-1122', 23.48, 3.52, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (190, E'Bruschetta egg', E'سلطات ووجبات', E'طبق', 25, TRUE, 'sk-1121', 21.74, 3.26, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (191, E'French toast', E'سلطات ووجبات', E'طبق', 27, TRUE, 'sk-1120', 23.48, 3.52, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (192, E'Employee pizza', E'بيتزا', E'طبق', 19, TRUE, 'sk-1119', 16.52, 2.48, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (193, E'Pudding dates', E'حلويات', E'قطعة', 13, TRUE, 'sk-1118', 11.3, 1.7, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (194, E'Pizza cone mix cheese', E'بيتزا', E'قطعة', 23, TRUE, 'sk-1117', 20, 3, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (195, E'Pizza cone turkey', E'بيتزا', E'قطعة', 26.45, TRUE, 'sk-1116', 23, 3.45, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (196, E'مدريد تشيز كيك تشوكلت - Madrid Cheescake Chocolate', E'حلويات', E'كوب', 36.9, TRUE, 'sk-1115', 32.09, 4.81, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (197, E'مدريد تشيز كيك فانيلا - Madrid cheesecake vanilla', E'حلويات', E'قطعة', 37, TRUE, 'sk-1114', 32.17, 4.83, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (198, E'Cake 100', E'حلويات', E'قطعة', 100, TRUE, 'sk-1113', 86.96, 13.04, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (199, E'فاندون - Fondont', E'حلويات', E'قطعة', 15, TRUE, 'sk-1112', 13.04, 1.96, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (200, E'Avocado scramble cups', E'سلطات ووجبات', E'طبق', 17, TRUE, 'sk-1109', 14.78, 2.22, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (201, E'Box Danish savory', E'سلطات ووجبات', E'باكيت', 19, TRUE, 'sk-1108', 16.52, 2.48, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (202, E'Baked Halomey', E'سلطات ووجبات', E'طبق', 27, TRUE, 'sk-1107', 23.48, 3.52, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (203, E'Choclate Matilda', E'حلويات', E'قطعة', 23, TRUE, 'sk-1106', 20, 3, 0.15);
INSERT INTO products (id, name, category, unit, base_price, is_active, sku, price_excl_vat, vat_amount, vat_rate) VALUES (204, E'Roll coffee - رول كوفى', E'حلويات', E'قطعة', 23, TRUE, 'sk-1105', 20, 3, 0.15);

-- ثالثاً: تحديث sequence لـ id بعد إدراج البيانات
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));
