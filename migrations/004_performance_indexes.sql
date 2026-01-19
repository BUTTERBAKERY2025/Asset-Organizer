-- Performance Optimization Indexes
-- فهارس لتحسين أداء قاعدة البيانات
-- Applied: January 2026

-- Daily Production: Branch + Date composite index for faster queries
CREATE INDEX IF NOT EXISTS idx_daily_production_branch_date ON daily_production_batches (branch_id, production_date);
CREATE INDEX IF NOT EXISTS idx_daily_production_status ON daily_production_batches (status);
CREATE INDEX IF NOT EXISTS idx_daily_production_created ON daily_production_batches (created_at DESC);

-- Inventory Items: Frequently queried columns
CREATE INDEX IF NOT EXISTS idx_inventory_items_branch_status ON inventory_items (branch_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_branch_category ON inventory_items (branch_id, category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_created ON inventory_items (created_at DESC);

-- Cashier Sales Journals: Date-based queries
CREATE INDEX IF NOT EXISTS idx_cashier_journals_branch_date ON cashier_sales_journals (branch_id, journal_date);
CREATE INDEX IF NOT EXISTS idx_cashier_journals_status ON cashier_sales_journals (status);
CREATE INDEX IF NOT EXISTS idx_cashier_journals_created ON cashier_sales_journals (created_at DESC);

-- Warehouse Items
CREATE INDEX IF NOT EXISTS idx_warehouse_items_active ON warehouse_items (is_active);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_category ON warehouse_items (category);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_active ON products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);

-- Branch Stock
CREATE INDEX IF NOT EXISTS idx_branch_stock_branch_item ON branch_stock (branch_id, item_id);

-- Material Transfers
CREATE INDEX IF NOT EXISTS idx_material_transfers_status ON material_transfers (status);

-- Finished Goods Inventory
CREATE INDEX IF NOT EXISTS idx_finished_goods_branch ON finished_goods_inventory (branch_id);
CREATE INDEX IF NOT EXISTS idx_finished_goods_date ON finished_goods_inventory (production_date DESC);
