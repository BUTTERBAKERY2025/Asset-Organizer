-- ============================================
-- نظام إدارة المخازن والتحويلات - Butter Bakery
-- ملف SQL كامل للتنفيذ في Supabase
-- ============================================

-- ============================================
-- الجزء الأول: إنشاء الجداول
-- ============================================

-- 1. جدول أصناف المستودع (warehouse_items)
CREATE TABLE IF NOT EXISTS warehouse_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'كجم',
  sku TEXT,
  barcode TEXT,
  min_stock_level INTEGER DEFAULT 0,
  max_stock_level INTEGER,
  reorder_point INTEGER,
  current_stock INTEGER DEFAULT 0,
  unit_price TEXT,
  supplier_id INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_warehouse_items_category ON warehouse_items(category);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_sku ON warehouse_items(sku);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_active ON warehouse_items(is_active);

-- 2. جدول مخزون الفروع (branch_stock)
CREATE TABLE IF NOT EXISTS branch_stock (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  item_id INTEGER NOT NULL REFERENCES warehouse_items(id),
  current_quantity INTEGER DEFAULT 0,
  daily_consumption INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_by VARCHAR REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_branch_stock_branch ON branch_stock(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_stock_item ON branch_stock(item_id);
CREATE UNIQUE INDEX IF NOT EXISTS branch_stock_unique ON branch_stock(branch_id, item_id);

-- 3. جدول تحويلات المواد (material_transfers)
CREATE TABLE IF NOT EXISTS material_transfers (
  id SERIAL PRIMARY KEY,
  transfer_number TEXT NOT NULL,
  request_id INTEGER,
  source_type TEXT NOT NULL DEFAULT 'warehouse',
  source_branch_id VARCHAR REFERENCES branches(id),
  destination_branch_id VARCHAR NOT NULL REFERENCES branches(id),
  transfer_date TEXT NOT NULL,
  delivery_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by VARCHAR REFERENCES users(id),
  approved_by_name TEXT,
  approved_at TIMESTAMP,
  rejected_by VARCHAR REFERENCES users(id),
  rejected_by_name TEXT,
  rejected_at TIMESTAMP,
  rejection_reason TEXT,
  driver_name TEXT,
  vehicle_number TEXT,
  departure_time TIMESTAMP,
  arrival_time TIMESTAMP,
  received_by VARCHAR REFERENCES users(id),
  received_by_name TEXT,
  receiver_signature TEXT,
  delivery_notes TEXT,
  has_discrepancy BOOLEAN DEFAULT FALSE,
  has_quantity_modifications BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_by_name TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_material_transfers_source ON material_transfers(source_branch_id);
CREATE INDEX IF NOT EXISTS idx_material_transfers_dest ON material_transfers(destination_branch_id);
CREATE INDEX IF NOT EXISTS idx_material_transfers_status ON material_transfers(status);
CREATE INDEX IF NOT EXISTS idx_material_transfers_date ON material_transfers(transfer_date);
CREATE INDEX IF NOT EXISTS idx_material_transfers_request ON material_transfers(request_id);
CREATE UNIQUE INDEX IF NOT EXISTS material_transfers_number_unique ON material_transfers(transfer_number);

-- 4. جدول بنود التحويل (material_transfer_items)
CREATE TABLE IF NOT EXISTS material_transfer_items (
  id SERIAL PRIMARY KEY,
  transfer_id INTEGER NOT NULL REFERENCES material_transfers(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES warehouse_items(id),
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  original_quantity INTEGER,
  available_quantity INTEGER,
  received_quantity INTEGER,
  discrepancy INTEGER,
  discrepancy_notes TEXT,
  is_modified BOOLEAN DEFAULT FALSE,
  modified_by TEXT,
  modified_by_name TEXT,
  modified_at TIMESTAMP,
  modification_notes TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_material_transfer_items_transfer ON material_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_material_transfer_items_item ON material_transfer_items(item_id);

-- 5. جدول سجل حركة المستودع (warehouse_movement_logs)
CREATE TABLE IF NOT EXISTS warehouse_movement_logs (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES warehouse_items(id),
  branch_id VARCHAR REFERENCES branches(id),
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  balance_before INTEGER DEFAULT 0,
  balance_after INTEGER DEFAULT 0,
  reference_type TEXT,
  reference_id INTEGER,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_by_name TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_warehouse_logs_item ON warehouse_movement_logs(item_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_logs_branch ON warehouse_movement_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_logs_type ON warehouse_movement_logs(movement_type);
CREATE INDEX IF NOT EXISTS idx_warehouse_logs_date ON warehouse_movement_logs(created_at);

-- 6. جدول طلبات المشتريات (purchasing_requests)
CREATE TABLE IF NOT EXISTS purchasing_requests (
  id SERIAL PRIMARY KEY,
  request_number TEXT NOT NULL,
  source_material_request_id INTEGER,
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT DEFAULT 'normal',
  total_estimated_cost NUMERIC(12, 2) DEFAULT 0,
  approved_budget NUMERIC(12, 2),
  vendor_id INTEGER,
  vendor_name TEXT,
  expected_delivery_date TEXT,
  actual_delivery_date TEXT,
  notes TEXT,
  requested_by VARCHAR REFERENCES users(id),
  requested_by_name TEXT,
  approved_by VARCHAR REFERENCES users(id),
  approved_by_name TEXT,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchasing_requests_branch ON purchasing_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchasing_requests_status ON purchasing_requests(status);
CREATE UNIQUE INDEX IF NOT EXISTS purchasing_requests_number_unique ON purchasing_requests(request_number);

-- 7. جدول بنود طلبات المشتريات (purchasing_request_items)
CREATE TABLE IF NOT EXISTS purchasing_request_items (
  id SERIAL PRIMARY KEY,
  purchasing_request_id INTEGER NOT NULL REFERENCES purchasing_requests(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES warehouse_items(id),
  item_name TEXT NOT NULL,
  category TEXT,
  unit TEXT,
  requested_quantity INTEGER NOT NULL DEFAULT 0,
  approved_quantity INTEGER DEFAULT 0,
  ordered_quantity INTEGER DEFAULT 0,
  received_quantity INTEGER DEFAULT 0,
  unit_price NUMERIC(10, 2),
  total_price NUMERIC(12, 2),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_purchasing_request_items_request ON purchasing_request_items(purchasing_request_id);

-- ============================================
-- الجزء الثاني: إدراج بيانات الأصناف
-- ============================================

-- المستهلكات (consumables)
INSERT INTO warehouse_items (id, name, name_en, category, unit, sku, min_stock_level, current_stock, is_active) VALUES
(231, 'اسفننج لتنطيف', 'Dish sponge', 'consumables', 'قطعة', '130044', 10, 0, true),
(218, 'بودرة تنظيف مكينة قهوة', 'Coffee machine Detergent', 'consumables', 'كجم', '130006', 10, 0, true),
(265, 'رول شبكه', 'ATM roll', 'consumables', 'قطعة', '150002', 10, 0, true),
(264, 'رول كاشير', 'cashier roll', 'consumables', 'قطعة', '150001', 10, 0, true),
(238, 'سائل مطهر يد', 'sp23', 'consumables', 'لتر', '130068', 10, 0, true),
(219, 'سائل منظف ماكينة قهوة', 'Coffee machine liquid', 'consumables', 'لتر', '130007', 10, 0, true),
(215, 'صابون اوانى', 'Soap utensils', 'consumables', 'لتر', '130001', 10, 0, true),
(216, 'صابون يد', 'Hand wash', 'consumables', 'لتر', '130003', 10, 0, true),
(220, 'غطاء رأس', 'Hair net', 'consumables', 'قطعة', '130012', 10, 0, true),
(239, 'غطاء يد', 'Hand cover', 'consumables', 'قطعة', '130070', 10, 0, true),
(223, 'قفازات', 'Gloves', 'consumables', 'قطعة', '130016', 10, 0, true),
(233, 'كمامات', 'Mask', 'consumables', 'قطعة', '130050', 10, 0, true),
(222, 'كيس بلدية', 'Garbage bag galoon 70', 'consumables', 'كجم', '130014', 10, 0, true),
(234, 'ماكسي', 'Maxi roll', 'consumables', 'قطعة', '130051', 10, 0, true),
(227, 'معطر جو', 'Air Freshener', 'consumables', 'قطعة', '130026', 10, 0, true),
(237, 'معقم لمسح الارضيات', 'sh30', 'consumables', 'لتر', '130064', 10, 0, true),
(232, 'مكنسة ناعمة', 'Broom rydan', 'consumables', 'قطعة', '130045', 10, 0, true),
(221, 'مناديل اوتوكت', 'Autocut tissue', 'consumables', 'قطعة', '130013', 10, 0, true),
(228, 'مناديل باكت', 'session tissue', 'consumables', 'قطعة', '130027', 10, 0, true),
(226, 'مناديل عملاء', 'Butter bakery tissue', 'consumables', 'قطعة', '130021', 10, 0, true),
(224, 'مناديل مبلله', 'Butter bakery wipes', 'consumables', 'قطعة', '130017', 10, 0, true),
(217, 'منظف افران', 'Oven cleaner', 'consumables', 'لتر', '130004', 10, 0, true),
(225, 'منظف افران (sk 2)', 'Forni cleaner', 'consumables', 'لتر', '130020', 10, 0, true),
(230, 'منظف افران فاين', 'Fine spray oven cleaner', 'consumables', 'لتر', '130039', 10, 0, true),
(229, 'منظف زجاج', 'Glass cleaner 750 ml', 'consumables', 'قطعة', '130036', 10, 0, true),
(235, 'منظف فرن اونكس', 'Unox clean', 'consumables', 'لتر', '130059', 10, 0, true),
(236, 'منظف ماكينة صحون sd12', NULL, 'consumables', 'لتر', '130060', 10, 0, true),
(266, 'مياه فواره', NULL, 'consumables', 'قطعة', '150007', 10, 0, true)
ON CONFLICT (id) DO NOTHING;

-- مواد التغليف (packaging)
INSERT INTO warehouse_items (id, name, name_en, category, unit, sku, min_stock_level, current_stock, is_active) VALUES
(177, '8 oz paper cups', 'اكواب ٨ اونص ورقي', 'packaging', 'قطعة', '110189', 10, 0, true),
(190, 'أكياس ورقي برتقالي 37*9', 'Orange paper bags', 'packaging', 'قطعة', '110206', 10, 0, true),
(189, 'اكواب 12 اونص ورقي برتقالي', '12 oz orange paper cups', 'packaging', 'قطعة', '110205', 10, 0, true),
(213, 'اكواب 12 ورقي الشتوية', '12 winter paper cups', 'packaging', 'قطعة', '110251', 10, 0, true),
(130, 'اكواب 4 اونص', '4  Oz paper cup BB', 'packaging', 'قطعة', '110001', 10, 0, true),
(149, 'اكواب 7 اونص', 'Paper cup 7 Oz', 'packaging', 'قطعة', '110031', 10, 0, true),
(212, 'اكواب 9 الشتوية', 'Winter Cups 9', 'packaging', 'قطعة', '110250', 10, 0, true),
(131, 'اكواب 9 اونص', '9 Oz Paper cup BB', 'packaging', 'قطعة', '110002', 10, 0, true),
(188, 'اكواب 9 اونص ورقي برتقالي', '9 oz orange paper cups', 'packaging', 'قطعة', '110204', 10, 0, true),
(187, 'اكواب 9 اونص ورقي بيج', '9 oz paper cups beige', 'packaging', 'قطعة', '110203', 10, 0, true),
(138, 'اكواب بلاستيك 12 اونص', '12 Oz plastic cup BB', 'packaging', 'قطعة', '110012', 10, 0, true),
(132, 'اكواب بلاستيك 14 اونص', '14 Oz paper cup BB', 'packaging', 'قطعة', '110004', 10, 0, true),
(165, 'اكياس تغليف مقاس 12', 'Platic bag size 12', 'packaging', 'قطعة', '110062', 10, 0, true),
(164, 'اكياس تغليف مقاس 8', 'Platic bag size 8', 'packaging', 'قطعة', '110061', 10, 0, true),
(174, 'اكياس كروسو', 'Crosco bags 12X25X7', 'packaging', 'قطعة', '110175', 10, 0, true),
(151, 'اكياس لاصق', 'Adhesive bag 12 X 8', 'packaging', 'قطعة', '110033', 10, 0, true),
(175, 'اكياس لاصق', 'Adhesive bag 9 X19', 'packaging', 'قطعة', '110176', 10, 0, true),
(194, 'بوكس العيد مقوي', 'Eid box booster', 'packaging', 'قطعة', '110216', 10, 0, true),
(210, 'بوكس اليوم الوطني', 'National Day Box', 'packaging', 'قطعة', '110245', 10, 0, true),
(198, 'بوكس بغطاء شفاف كبير', 'Large transparent lid box', 'packaging', 'قطعة', '110224', 10, 0, true),
(185, 'بوكس صغير كيك اكلير', 'Small box of eclair cake', 'packaging', 'قطعة', '110200', 10, 0, true),
(267, 'بوكس قهوة', 'Coffee box', 'packaging', 'قطعة', '1100220', 10, 0, true),
(183, 'بوكس كبير مختلط برتقالي', 'Large mixed orange box 30*12', 'packaging', 'قطعة', '110196', 10, 0, true),
(163, 'بوكس كيكة حليب', '24 Oz paper bowl', 'packaging', 'قطعة', '110059', 10, 0, true),
(197, 'بوكس مستطيل ابيض', 'White rectangular box', 'packaging', 'قطعة', '110223', 10, 0, true),
(199, 'بوكس مستطيل بيد', 'Rectangular box with hand', 'packaging', 'قطعة', '110225', 10, 0, true),
(196, 'بوكس مستطيل صغير برتقالي', 'Small orange rectangular box', 'packaging', 'قطعة', '110222', 10, 0, true),
(195, 'بوكس مستطيل كبير برتقالي', 'Large orange rectangular box', 'packaging', 'قطعة', '110221', 10, 0, true),
(184, 'بوكس وسط برتقالي 24*11', 'Orange medium box', 'packaging', 'قطعة', '110197', 10, 0, true),
(146, 'حامل 2 كوب', 'Cup holder  2 holes', 'packaging', 'قطعة', '110024', 10, 0, true),
(147, 'حامل 4 كوب', 'Cup holder  4 holes', 'packaging', 'قطعة', '110025', 10, 0, true),
(148, 'حامل ايس كريم', 'Ice cream holder', 'packaging', 'قطعة', '110030', 10, 0, true),
(145, 'رول تغليف', 'Wrapping roll', 'packaging', 'قطعة', '110022', 10, 0, true),
(169, 'ريبون فاكيوم', 'Transparent cylinder 5 cm', 'packaging', 'قطعة', '110073', 10, 0, true),
(170, 'ستيكر برتقالى دائرى', 'Orange round sticker', 'packaging', 'قطعة', '110075', 10, 0, true),
(152, 'سكين', 'Plastic knife', 'packaging', 'قطعة', '110035', 10, 0, true),
(141, 'شنط كرتون', 'Cardboard bag', 'packaging', 'قطعة', '110018', 10, 0, true),
(139, 'شنط كرتون', 'Cartoon bag', 'packaging', 'قطعة', '110014', 10, 0, true),
(182, 'طبق تقديم صغير (151*150*40)', 'Small serving plate', 'packaging', 'قطعة', '110195', 10, 0, true),
(144, 'ظرف ورقى دونات', 'Paper envelope 13 X 14X 5', 'packaging', 'قطعة', '110021', 10, 0, true),
(156, 'علب بلاستيك شفاف', 'Transparent plastic box', 'packaging', 'قطعة', '110047', 10, 0, true),
(140, 'علب بيتزا', 'Pizza Box', 'packaging', 'قطعة', '110016', 10, 0, true),
(158, 'علب بيجل', 'Begel box 13 X13', 'packaging', 'قطعة', '110050', 10, 0, true),
(143, 'علب درج 160*160', 'Drawer cake box 160 X 160', 'packaging', 'قطعة', '110020', 10, 0, true),
(179, 'علب درج صغير برتقالي(120*75)', 'Orange mini drawer boxes', 'packaging', 'قطعة', '110191', 10, 0, true),
(135, 'علب درج صغيره', 'Drawer bag small', 'packaging', 'قطعة', '110009', 10, 0, true),
(134, 'علب درج كبيرة', 'Drawer bag big', 'packaging', 'قطعة', '110008', 10, 0, true),
(3, 'علب كرتون صغيرة', NULL, 'packaging', 'قطعة', NULL, 100, 500, true),
(142, 'علب كيك 30*30', 'Cake box 30 X 30', 'packaging', 'قطعة', '110019', 10, 0, true),
(159, 'علب كيك بغطاء شفاف', 'Cake box with transparent lid', 'packaging', 'قطعة', '110051', 10, 0, true),
(180, 'علب كيك صغيرة (200*110*70)', 'Orange mini cake boxes', 'packaging', 'قطعة', '110192', 10, 0, true),
(181, 'علب كيك مستطيلة بستري برتقالي (270*205*60)', 'Rectangular cake boxes with orange pastry', 'packaging', 'قطعة', '110193', 10, 0, true),
(167, 'علب كيكة موز', 'Banana cake box', 'packaging', 'قطعة', '110064', 10, 0, true),
(211, 'علبة تشيز مدريد', 'A box of Madrid cheese', 'packaging', 'قطعة', '110249', 10, 0, true),
(150, 'علبة كيك 100×80 دونات', 'Cake box 100X80', 'packaging', 'قطعة', '110032', 10, 0, true),
(192, 'غطاء اكواب 12و9 اونص بلاستيك', '12 and 9 oz plastic cup lids', 'packaging', 'قطعة', '110211', 10, 0, true),
(137, 'غطاء كوب 12 اونص', 'Lid 12 Oz cup', 'packaging', 'قطعة', '110011', 10, 0, true),
(136, 'غطاء كوب 9اونص', 'lid 9 Oz cup', 'packaging', 'قطعة', '110010', 10, 0, true),
(171, 'فلتر v60', 'filter V60', 'packaging', 'قطعة', '110078', 10, 0, true),
(178, 'فلتر كوفى داى مقاس 13', 'Coffee day filter size 13', 'packaging', 'قطعة', '110190', 10, 0, true),
(166, 'قارورة زجاج', 'Glass bottle size 350', 'packaging', 'قطعة', '110063', 10, 0, true),
(176, 'قواعد كيك بلاستيك', 'Plastic cake stands', 'packaging', 'قطعة', '110187', 10, 0, true),
(203, 'قواعد كيك دائرية', '16cm round cake bases', 'packaging', 'قطعة', '110234', 10, 0, true),
(201, 'قواعد كيك دائرية', '18cm round cake bases', 'packaging', 'قطعة', '110230', 10, 0, true),
(200, 'قواعد كيك دائرية', '10cm round cake bases', 'packaging', 'قطعة', '110228', 10, 0, true),
(204, 'قواعد كيك دائرية', '32cm round cake bases', 'packaging', 'قطعة', '110235', 10, 0, true),
(202, 'قواعد كيك دائرية', '14cm round cake bases', 'packaging', 'قطعة', '110231', 10, 0, true),
(208, 'قواعد كيك مربعة', '30cm square cake bases', 'packaging', 'قطعة', '110239', 10, 0, true),
(207, 'قواعد كيك مربعة', '22cm square cake bases', 'packaging', 'قطعة', '110238', 10, 0, true),
(206, 'قواعد كيك مربعة', '20cm square cake bases', 'packaging', 'قطعة', '110237', 10, 0, true),
(205, 'قواعد كيك مربعة', '18cm square cake bases', 'packaging', 'قطعة', '110236', 10, 0, true),
(186, 'كاب هولدر 2 فتحة', '2 slot cap holder', 'packaging', 'قطعة', '110201', 10, 0, true),
(173, 'كاسة ايس كريم', 'Ice cream cup', 'packaging', 'قطعة', '110106', 10, 0, true),
(160, 'كوب 9 صيف عسير', '9 Oz paper cup Aseer', 'packaging', 'قطعة', '110053', 10, 0, true),
(209, 'كوب زجاج 300مل ساده', NULL, 'packaging', 'قطعة', '110240', 10, 0, true),
(161, 'كيس بريوش', 'Brioche bag', 'packaging', 'قطعة', '110054', 10, 0, true),
(155, 'كيس خبز طويل', 'Long bread bag 6X12X6.5', 'packaging', 'قطعة', '110040', 10, 0, true),
(168, 'كيس كروسون', 'Croissant bag 25×7', 'packaging', 'قطعة', '110067', 10, 0, true),
(133, 'كيس كروسون', 'Croissant bag', 'packaging', 'قطعة', '110006', 10, 0, true),
(193, 'كيس ورق مخبوزات كرواسون', 'croissant bakery paper bag', 'packaging', 'قطعة', '110212', 10, 0, true),
(191, 'ماسكة اكواب', 'Cup holder', 'packaging', 'قطعة', '110207', 10, 0, true),
(153, 'مصاص', 'Straw', 'packaging', 'قطعة', '110036', 10, 0, true),
(154, 'ملاعق ايس كريم', 'Ice cream spoon', 'packaging', 'قطعة', '110037', 10, 0, true),
(172, 'ورق المونيوم', 'Aluminum foil', 'packaging', 'قطعة', '110102', 10, 0, true),
(162, 'ورق بار', 'Bar paper', 'packaging', 'قطعة', '110057', 10, 0, true),
(214, 'ورق زبدة بني', 'Brown parchment paper', 'packaging', 'قطعة', '110252', 10, 0, true),
(157, 'ورق زبدة شيمنى', 'Printed butter paper', 'packaging', 'قطعة', '110048', 10, 0, true)
ON CONFLICT (id) DO NOTHING;

-- مواد الإنتاج الأولية (primary_production)
INSERT INTO warehouse_items (id, name, name_en, category, unit, sku, min_stock_level, current_stock, is_active) VALUES
(244, 'افوكادو', 'Avacado', 'primary_production', 'كجم', '140007', 10, 0, true),
(243, 'برتقال', 'Orange', 'primary_production', 'كجم', '140006', 10, 0, true),
(252, 'بصل احمر', 'Red onion', 'primary_production', 'كجم', '140024', 10, 0, true),
(259, 'بطاطس', 'Potato', 'primary_production', 'كجم', '140086', 10, 0, true),
(260, 'جبنة مسكربون', 'Mascarpone cheese', 'primary_production', 'كجم', '140118', 10, 0, true),
(262, 'جرجير بيبى روكولا', 'Baby arugula', 'primary_production', 'كجم', '140158', 10, 0, true),
(249, 'جزر', 'Carrot', 'primary_production', 'كجم', '140014', 10, 0, true),
(240, 'حليب طويل الاجل', 'Milk long life', 'primary_production', 'لتر', '140001', 10, 0, true),
(241, 'حليب فرش', 'Full cream milk', 'primary_production', 'لتر', '140002', 10, 0, true),
(253, 'ريحان', 'Basil', 'primary_production', 'كجم', '140026', 10, 0, true),
(251, 'زعتر فرش', 'Kenya thyme', 'primary_production', 'كجم', '140023', 10, 0, true),
(242, 'صدور دجاج', 'Chicken breast', 'primary_production', 'كجم', '140003', 10, 0, true),
(257, 'طماطم', 'Hybrid tomato', 'primary_production', 'كجم', '140060', 10, 0, true),
(246, 'طماطم شيري', 'Cherry tomatoes', 'primary_production', 'كجم', '140010', 10, 0, true),
(254, 'فراولة', 'Strawberry', 'primary_production', 'كجم', '140031', 10, 0, true),
(250, 'فلفل رومى اخضر', 'Green bell papper', 'primary_production', 'كجم', '140015', 10, 0, true),
(248, 'فلفل رومى اصفر', 'Yellow bell papper', 'primary_production', 'كجم', '140013', 10, 0, true),
(247, 'فلفل رومي احمر', 'Red bell papper', 'primary_production', 'كجم', '140012', 10, 0, true),
(258, 'كرنب ابيض', 'White cabbage', 'primary_production', 'كجم', '140063', 10, 0, true),
(261, 'كيل فريش', 'Kale Fresh', 'primary_production', 'كجم', '140154', 10, 0, true),
(245, 'كيوي', 'Kiwi', 'primary_production', 'كجم', '140009', 10, 0, true),
(255, 'ليمون', 'Lemon', 'primary_production', 'كجم', '140033', 10, 0, true),
(263, 'ملفوف', NULL, 'primary_production', 'كجم', '140159', 10, 0, true),
(256, 'هوت دوج', 'Hotdog', 'primary_production', 'كجم', '140048', 10, 0, true)
ON CONFLICT (id) DO NOTHING;

-- المواد الخام (raw_materials)
INSERT INTO warehouse_items (id, name, name_en, category, unit, sku, min_stock_level, current_stock, is_active) VALUES
(22, 'Amricana', 'Smoked turkey', 'raw_materials', 'كجم', '100028', 10, 0, true),
(119, 'BUN  BRAZIL', 'بن برازيلي', 'raw_materials', 'كجم', '100480', 10, 0, true),
(111, 'Dawn chocolate', 'داون شوكولاتة', 'raw_materials', 'كجم', '100405', 10, 0, true),
(117, 'Ethiopian Ben', 'بن اثيوبى', 'raw_materials', 'كجم', '100474', 10, 0, true),
(114, 'SUNDRIED TOMATOS', 'طماطم مجففة', 'raw_materials', 'كجم', '100443', 10, 0, true),
(113, 'ellevir cream', 'كريمة الفير', 'raw_materials', 'لتر', '100435', 10, 0, true),
(116, 'rost beef', 'روست بيف', 'raw_materials', 'كجم', '100473', 10, 0, true),
(93, 'أصابع موتزريلا', 'Mozzarella stick', 'raw_materials', 'كجم', '100249', 10, 0, true),
(35, 'اصابع شوكولاتة', 'Chocolate stick 44 %', 'raw_materials', 'كجم', '100060', 10, 0, true),
(46, 'ايس كريم فانيليا', 'Vanilla ice cream powder', 'raw_materials', 'كجم', '100098', 10, 0, true),
(83, 'ايس كريم مانجو', 'Mango ice cream', 'raw_materials', 'كجم', '100179', 10, 0, true),
(60, 'بابريكا', 'Parika', 'raw_materials', 'كجم', '100124', 10, 0, true),
(23, 'ببرونى', 'Beef pepporni', 'raw_materials', 'كجم', '100029', 10, 0, true),
(81, 'بخاخ زبدة', 'Butter spray', 'raw_materials', 'لتر', '100177', 10, 0, true),
(34, 'بدرة بصل', 'Onion powder', 'raw_materials', 'كجم', '100056', 10, 0, true),
(33, 'بدرة ثوم', 'Garlic powder', 'raw_materials', 'كجم', '100055', 10, 0, true),
(105, 'بذر كتان', 'Flax seeds', 'raw_materials', 'كجم', '100375', 10, 0, true),
(106, 'بذور حب دوار الشمس', 'Sunflower seeds', 'raw_materials', 'كجم', '100384', 10, 0, true),
(104, 'بسكويت دايجيستف', 'Digestive biscuit 400 grm', 'raw_materials', 'كجم', '100373', 10, 0, true),
(107, 'بسكويت ليدى فينجر', 'Ladyfinger biscuit', 'raw_materials', 'كجم', '100392', 10, 0, true),
(69, 'بن سلفادور', 'Ben salvador', 'raw_materials', 'كجم', '100147', 10, 0, true),
(53, 'بن كولومبى', 'Ben columbian', 'raw_materials', 'كجم', '100110', 10, 0, true),
(27, 'بندق', 'White peeled hazelnut', 'raw_materials', 'كجم', '100037', 10, 0, true),
(67, 'بهارات الكاجون', 'Cajun spices', 'raw_materials', 'كجم', '100142', 10, 0, true),
(45, 'بوريه باشن فروت', 'Passion  puree', 'raw_materials', 'كجم', '100095', 10, 0, true),
(44, 'بوريه توت احمر', 'Red berry puree', 'raw_materials', 'كجم', '100093', 10, 0, true),
(85, 'بوريه موز', 'Banana Puree', 'raw_materials', 'كجم', '100183', 10, 0, true),
(24, 'بيض', 'Egg', 'raw_materials', 'قطعة', '100030', 10, 0, true),
(25, 'بيكنج صودا', 'Baking soda', 'raw_materials', 'كجم', '100034', 10, 0, true),
(80, 'تونة', 'Tuna', 'raw_materials', 'كجم', '100176', 10, 0, true),
(8, 'جبنة برميزان', 'Parmesan cheese', 'raw_materials', 'كجم', '100006', 10, 0, true),
(21, 'جبنة بوراتا', 'Cheese burrata', 'raw_materials', 'كجم', '100025', 10, 0, true),
(11, 'جبنة حلوم', 'Cheese Halloumi', 'raw_materials', 'كجم', '100010', 10, 0, true),
(12, 'جبنة شيدر', 'Cheese cheddar', 'raw_materials', 'كجم', '100011', 10, 0, true),
(17, 'جبنة فيتا', 'Feta cheese', 'raw_materials', 'كجم', '100019', 10, 0, true),
(4, 'جبنة فيلادلفيا', 'Philadelphia cheese', 'raw_materials', 'كجم', '100001', 10, 0, true),
(100, 'جبنة مدخن سادة', 'Plain smoked cheese', 'raw_materials', 'كجم', '100350', 10, 0, true),
(13, 'جبنة موتزريلا بلوك', 'Cheese Mozzarella', 'raw_materials', 'كجم', '100012', 10, 0, true),
(20, 'جبنة ميرا', 'Cheese mira', 'raw_materials', 'كجم', '100023', 10, 0, true),
(30, 'جوز البيكان', 'Pecan nuts', 'raw_materials', 'كجم', '100045', 10, 0, true),
(57, 'جيلاتين  بودر', 'Gelatin powder', 'raw_materials', 'كجم', '100118', 10, 0, true),
(82, 'جيلي بارد', 'Cold jelly', 'raw_materials', 'كجم', '100178', 10, 0, true),
(55, 'حشوة البلوبيرى', 'Blue berry filling', 'raw_materials', 'كجم', '100115', 10, 0, true),
(59, 'حشوة التوت  الاحمر', 'Red berry filling', 'raw_materials', 'كجم', '100123', 10, 0, true),
(42, 'حشوة بستاشيو', 'Pistachio Filling', 'raw_materials', 'كجم', '100087', 10, 0, true),
(19, 'حليب بودرة', 'Milk powder', 'raw_materials', 'كجم', '100022', 10, 0, true),
(115, 'حليب جوز هند', 'coconut milk', 'raw_materials', 'لتر', '100453', 10, 0, true),
(6, 'حليب مكثف', 'Condensed milk', 'raw_materials', 'كجم', '100004', 10, 0, true),
(96, 'خل', 'White vinegar', 'raw_materials', 'كجم', '100278', 10, 0, true),
(76, 'خل بالسميك', 'Thick vinegar', 'raw_materials', 'لتر', '100167', 10, 0, true),
(112, 'خل تفاح', 'Apple vinegar', 'raw_materials', 'لتر', '100426', 10, 0, true),
(32, 'خميرة  بودر', 'Yeast', 'raw_materials', 'كجم', '100052', 10, 0, true),
(110, 'دبس تمر', 'Dates Molasses', 'raw_materials', 'كجم', '100402', 10, 0, true),
(98, 'دبس رمان', 'Pomegranate molasses', 'raw_materials', 'كجم', '100300', 10, 0, true),
(1, 'دقيق أبيض', NULL, 'raw_materials', 'كيلو', NULL, 10, 100, true),
(127, 'ذره حب فرشلى', NULL, 'raw_materials', 'كجم', '100518', 10, 0, true),
(65, 'ريد فلفيت', 'Red velvet', 'raw_materials', 'كجم', '100137', 10, 0, true),
(94, 'زبدة', 'Butter', 'raw_materials', 'كجم', '100253', 10, 0, true),
(5, 'زبدة انكور بلوك', 'Butter Anchor', 'raw_materials', 'كجم', '100002', 10, 0, true),
(126, 'زبدة توزيعات', 'Butter distributions', 'raw_materials', 'قطعة', '100512', 10, 0, true),
(28, 'زيت', 'Oil', 'raw_materials', 'لتر', '100038', 10, 0, true),
(29, 'زيت الزيتون', 'Olive oil', 'raw_materials', 'لتر', '100042', 10, 0, true),
(84, 'زيتون كلاماتا', 'Kalamata olive', 'raw_materials', 'كجم', '100180', 10, 0, true),
(102, 'سالمون مدخنن', 'smoked salmon', 'raw_materials', 'كجم', '100358', 10, 0, true),
(2, 'سكر', NULL, 'raw_materials', 'كيلو', NULL, 5, 50, true),
(78, 'سكر بني', 'Brown sugar', 'raw_materials', 'كجم', '100169', 10, 0, true),
(61, 'سكر بودرة', 'Sugar Icing Bake mate', 'raw_materials', 'كجم', '100125', 10, 0, true),
(74, 'سكر ظرف بتر بيكرى', 'Butter bakery envelope sugar', 'raw_materials', 'قطعة', '100163', 10, 0, true),
(52, 'سكر ناعم', 'Sugar', 'raw_materials', 'كجم', '100108', 10, 0, true),
(109, 'سماق', 'Sumac', 'raw_materials', 'كجم', '100401', 10, 0, true),
(18, 'سموزى فراولة', 'Smoothie strawberry', 'raw_materials', 'لتر', '100021', 10, 0, true),
(64, 'سموزي باشن فروت', 'Passion Fruit Smoothie', 'raw_materials', 'كجم', '100135', 10, 0, true),
(47, 'سموزي بلوبيرى', 'Smoothie blue berry', 'raw_materials', 'كجم', '100100', 10, 0, true),
(63, 'سموزي خوخ', 'Smoothie peach', 'raw_materials', 'كجم', '100129', 10, 0, true),
(72, 'سموزي ميكس بيرى', 'Mix berry smoothie', 'raw_materials', 'كجم', '100152', 10, 0, true),
(86, 'سويت كورن', 'sweet corn', 'raw_materials', 'كجم', '100187', 10, 0, true),
(108, 'سيرب البندق', 'Hazelnut syrup', 'raw_materials', 'كجم', '100399', 10, 0, true),
(70, 'سيرب الليمون', 'lemon syrup', 'raw_materials', 'لتر', '100148', 10, 0, true),
(15, 'سيرب خوخ', 'syrup peach', 'raw_materials', 'لتر', '100016', 10, 0, true),
(16, 'سيرب رمان', 'syrup pomegranate', 'raw_materials', 'لتر', '100017', 10, 0, true),
(77, 'سيرب فانيليا', 'Vanilla syrup', 'raw_materials', 'لتر', '100168', 10, 0, true),
(14, 'سيرب فراولة', 'syrup strawberry', 'raw_materials', 'لتر', '100015', 10, 0, true),
(49, 'سيرب كراميل', 'syrup caramel', 'raw_materials', 'لتر', '100103', 10, 0, true),
(71, 'سيرب نعناع', 'Mint syrup', 'raw_materials', 'لتر', '100151', 10, 0, true),
(90, 'شاى احمر ديلما', 'Delma red tea', 'raw_materials', 'قطعة', '100210', 10, 0, true),
(87, 'شاى اخضر', 'Green tea', 'raw_materials', 'قطعة', '100192', 10, 0, true),
(62, 'شوكولاتة بارى اسود 55%', 'chocolate black 55%', 'raw_materials', 'كجم', '100128', 10, 0, true),
(38, 'شوكولاتة بلوك حليب', 'Milk chocolate block', 'raw_materials', 'كجم', '100072', 10, 0, true),
(37, 'شوكولاتة بيضاء حبوب', 'chocolate beans white', 'raw_materials', 'كجم', '100070', 10, 0, true),
(36, 'صلصة الكمأة السوداء', 'Truffle sauce', 'raw_materials', 'كجم', '100065', 10, 0, true),
(121, 'صلصة الهولندا', 'Hollandaise sauce', 'raw_materials', 'كجم', '100492', 10, 0, true),
(120, 'صلصة سيراتشا', 'Sriracha sauce', 'raw_materials', 'كجم', '100485', 10, 0, true),
(91, 'صوص رانش', 'ranch sauce', 'raw_materials', 'لتر', '100221', 10, 0, true),
(75, 'صوص لوفيريا ابيض', 'Loveria white sauce', 'raw_materials', 'كجم', '100165', 10, 0, true),
(88, 'طحين t45', 'Flour T45', 'raw_materials', 'كجم', '100197', 10, 0, true),
(68, 'طحين كابوتو احمر', 'Caputo red flour', 'raw_materials', 'كجم', '100146', 10, 0, true),
(97, 'طماطم مقشرة', 'Peeled tomotos', 'raw_materials', 'كجم', '100289', 10, 0, true),
(73, 'عسل', 'honey', 'raw_materials', 'كجم', '100158', 10, 0, true),
(124, 'عسل توزيعات', 'Honey distributions', 'raw_materials', 'قطعة', '100509', 10, 0, true),
(101, 'فLTR كوفي داي', 'Butter bakery coffee day filter', 'raw_materials', 'قطعة', '100357', 10, 0, true),
(129, 'فانيليا فرنسية', 'French vanilla', 'raw_materials', 'كجم', '100561', 10, 0, true),
(26, 'فستق', 'Peeled Pistachio', 'raw_materials', 'كجم', '100036', 10, 0, true),
(31, 'قرفة مطحونة', 'Cinnamon powder', 'raw_materials', 'كجم', '100050', 10, 0, true),
(118, 'قرون فانيليا', 'Bourbon vanilla', 'raw_materials', 'كجم', '100476', 10, 0, true),
(128, 'قشدة بيانكيرو', 'Bianquero cream', 'raw_materials', 'كجم', '100547', 10, 0, true),
(79, 'قهوة فيجار ايطالى', 'Italian coffee fugar', 'raw_materials', 'كجم', '100170', 10, 0, true),
(48, 'كركديه', 'Roselle', 'raw_materials', 'كجم', '100101', 10, 0, true),
(103, 'كريمة الطبخ', 'Coocking cream', 'raw_materials', 'كجم', '100361', 10, 0, true),
(10, 'كريمة براتوس', 'Whipping cream Puratos', 'raw_materials', 'لتر', '100008', 10, 0, true),
(95, 'كمون بودر', 'Cumin Powder', 'raw_materials', 'كجم', '100259', 10, 0, true),
(58, 'كينوا حمراء', 'Red Quinoa', 'raw_materials', 'كجم', '100120', 10, 0, true),
(7, 'لبنة', 'strained yougart', 'raw_materials', 'كجم', '100005', 10, 0, true),
(43, 'لوز بودرة', 'Almond powder', 'raw_materials', 'كجم', '100088', 10, 0, true),
(40, 'لوز حب', 'Almond seeds', 'raw_materials', 'كجم', '100081', 10, 0, true),
(122, 'لون احمر غذائي', 'Red food colour', 'raw_materials', 'كجم', '100500', 10, 0, true),
(66, 'لون اسود', 'Black color', 'raw_materials', 'لتر', '100140', 10, 0, true),
(54, 'ماتشا', 'Matcha powder', 'raw_materials', 'كجم', '100113', 10, 0, true),
(89, 'مايونيز', 'Mayonnaise', 'raw_materials', 'كجم', '100200', 10, 0, true),
(50, 'محسن خبز (k2)', 'Improver K2', 'raw_materials', 'كجم', '100104', 10, 0, true),
(92, 'مخلل خيار شرائح', 'Cucumber pickle', 'raw_materials', 'كجم', '100229', 10, 0, true),
(125, 'مربي توت توزيعات', 'Berry Breeder Distributions', 'raw_materials', 'قطعة', '100510', 10, 0, true),
(39, 'ملمع براتوس', 'Puratos glaze', 'raw_materials', 'لتر', '100076', 10, 0, true),
(99, 'مياة 200مل', 'Water 200 Ml', 'raw_materials', 'قطعة', '100345', 10, 0, true),
(9, 'مياه', 'Water berain', 'raw_materials', 'قطعة', '100007', 10, 0, true),
(41, 'نسكافيه', 'Nescafe', 'raw_materials', 'كجم', '100085', 10, 0, true),
(51, 'نشا اراسكو', 'Corn strach', 'raw_materials', 'كجم', '100106', 10, 0, true),
(56, 'نوتيلا', 'Nutella', 'raw_materials', 'كجم', '100117', 10, 0, true),
(123, 'نوتيلا توزيعات', 'Nutella distributions', 'raw_materials', 'قطعة', '100508', 10, 0, true)
ON CONFLICT (id) DO NOTHING;

-- تحديث تسلسل ID
SELECT setval('warehouse_items_id_seq', (SELECT COALESCE(MAX(id), 1) FROM warehouse_items));

-- ============================================
-- انتهى الملف
-- ============================================
