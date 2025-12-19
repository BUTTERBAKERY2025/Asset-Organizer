# نظام إدارة المشروعات والأصول والصيانة - باتر

## Overview

This is a comprehensive projects, assets, and maintenance management system for Butter Bakery, a bakery business with multiple branches in Saudi Arabia (Medina, Tabuk, Riyadh). The application tracks equipment, supplies, assets, construction projects, and contractors across different branch locations. It provides features for viewing inventory, managing assets, construction project management, tracking maintenance needs, and generating comprehensive reports with support for Arabic RTL layout.

## User Preferences

Preferred communication style: Simple, everyday language.

**Important Deployment Preferences:**
- Always notify the user when any update requires database schema changes (new tables, columns, migrations)
- Deployment workflow: Manual deploy on Render (not auto-deploy)
- Database updates require manual SQL execution in Supabase SQL Editor before code deployment

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS v4 with custom "Butter Gold" theme (warm bakery-inspired colors)
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for data visualization on dashboard
- **Export**: XLSX library for Excel export, react-to-print for printing

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **Build Tool**: esbuild for server bundling, Vite for client
- **API Pattern**: RESTful JSON API under `/api/*` routes

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` defines branches and inventory_items tables
- **Connection**: Uses `DATABASE_URL` environment variable for PostgreSQL connection
- **Static Data**: Initial inventory data defined in `client/src/lib/data.ts` for seeding

### Key Design Decisions

1. **Shared Schema**: Database schema defined in `shared/` directory allows type sharing between frontend and backend, ensuring type safety across the stack.

2. **Arabic-First Design**: The application is built with RTL (right-to-left) layout as default, using Arabic fonts (Cairo) and Arabic interface text.

3. **Branch-Based Organization**: Inventory is organized by branch locations, with each item having a branch association. This supports multi-location inventory tracking.

4. **Status Tracking**: Items have status fields (good, maintenance, damaged, missing) enabling maintenance reporting and asset health monitoring.

5. **Price/VAT Calculations**: Built-in support for Saudi VAT (15%) calculations on inventory valuations.

6. **Construction Project Management**: A dedicated module for tracking building/renovation projects for branches, including:
   - Construction projects with budget, timeline, and progress tracking
   - Work items categorized by type (electrical, plumbing, painting, tiling, carpentry, HVAC, signage, etc.)
   - Contractor management with contact information and ratings
   - Project status workflow (planned, in_progress, on_hold, completed, cancelled)

7. **Operations and Production Module** (Added December 2025): Complete production management system including:
   - Products catalog with pricing, categories, and active status
   - Shift scheduling with morning/evening/night shifts and employee assignments
   - Production orders with status tracking (pending, in_progress, completed, cancelled)
   - Quality control checks with pass/fail status and inspector notes
   - Daily operations summary with aggregate statistics
   - Permission modules: operations, production, shifts, quality_control

8. **Cashier Sales Journal Module** (Added December 2025): Daily sales tracking and cash reconciliation:
   - Cashier journals for daily sales records with branch, shift, and cashier info
   - Payment breakdown by method (cash, card, mada, Apple Pay, STC Pay, delivery apps)
   - Cash drawer reconciliation with automatic discrepancy detection (balanced, shortage, surplus)
   - Electronic signature capture with IP address logging
   - Multi-step workflow: draft → submitted → approved/rejected
   - Statistics dashboard with total sales, shortages, surpluses, average ticket
   - Permission module: cashier_journal (view, create, edit, delete, approve)

## External Dependencies

### Database
- PostgreSQL database (configured via `DATABASE_URL` environment variable)
- Drizzle Kit for database migrations (`drizzle-kit push`)

### Third-Party Libraries
- **@tanstack/react-query**: Server state management and caching
- **xlsx**: Excel file parsing and generation for import/export
- **react-to-print**: Print functionality for inventory reports
- **recharts**: Dashboard charts and visualizations
- **zod**: Schema validation for forms and API inputs
- **drizzle-orm**: Type-safe database queries

### Fonts
- Google Fonts: Cairo (Arabic) and Plus Jakarta Sans (Latin)

### Development Tools
- Vite with HMR for development
- Custom Replit plugins for development experience (cartographer, dev-banner, runtime-error-modal)

## External System Integrations

### Accounting Integration
- API endpoints for generating accounting reports:
  - `/api/accounting-exports/inventory-valuation` - تقييم المخزون مع ضريبة القيمة المضافة
  - `/api/accounting-exports/asset-movements` - تقرير حركة الأصول
  - `/api/accounting-exports/project-costs` - تكاليف المشاريع
- Reports include JSON data suitable for import into accounting systems

### SMS/WhatsApp Notifications
- Notification queue system ready for Twilio integration
- Requires environment variables to be set:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER`
- User dismissed Twilio Replit integration - manual setup required

### Data Import
- Excel import already available via inventory management page
- Data import jobs table tracks import operations
- API endpoint: `/api/import-jobs`

### New Database Tables (require SQL migration for production)
```sql
-- Integration/Notification tables
CREATE TABLE external_integrations (...);
CREATE TABLE notification_templates (...);
CREATE TABLE notification_queue (...);
CREATE TABLE data_import_jobs (...);
CREATE TABLE accounting_exports (...);

-- Operations Module tables (December 2025)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price DOUBLE PRECISION,
    unit TEXT DEFAULT 'قطعة',
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE shifts (
    id SERIAL PRIMARY KEY,
    branch_id TEXT NOT NULL REFERENCES branches(id),
    shift_type TEXT NOT NULL, -- morning, evening, night
    shift_date DATE NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE shift_employees (
    id SERIAL PRIMARY KEY,
    shift_id INTEGER NOT NULL REFERENCES shifts(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    role TEXT NOT NULL
);

CREATE TABLE production_orders (
    id SERIAL PRIMARY KEY,
    branch_id TEXT NOT NULL REFERENCES branches(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL, -- pending, in_progress, completed, cancelled
    notes TEXT,
    production_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE quality_checks (
    id SERIAL PRIMARY KEY,
    production_order_id INTEGER NOT NULL REFERENCES production_orders(id),
    checked_by_user_id INTEGER NOT NULL REFERENCES users(id),
    check_date TIMESTAMP DEFAULT NOW() NOT NULL,
    status TEXT NOT NULL, -- passed, failed
    notes TEXT
);

CREATE TABLE daily_operations_summary (
    id SERIAL PRIMARY KEY,
    branch_id TEXT NOT NULL REFERENCES branches(id),
    summary_date DATE NOT NULL,
    total_production INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    completed_orders INTEGER DEFAULT 0,
    quality_pass_rate DOUBLE PRECISION DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Cashier Sales Journal tables (December 2025)
CREATE TABLE cashier_sales_journals (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    shift_id INTEGER REFERENCES shifts(id),
    cashier_id VARCHAR NOT NULL REFERENCES users(id),
    cashier_name TEXT NOT NULL,
    journal_date TEXT NOT NULL,
    shift_type TEXT,
    shift_start_time TEXT,
    shift_end_time TEXT,
    opening_balance REAL DEFAULT 0 NOT NULL,
    total_sales REAL DEFAULT 0 NOT NULL,
    cash_total REAL DEFAULT 0 NOT NULL,
    network_total REAL DEFAULT 0 NOT NULL,
    delivery_total REAL DEFAULT 0 NOT NULL,
    expected_cash REAL DEFAULT 0 NOT NULL,
    actual_cash_drawer REAL DEFAULT 0 NOT NULL,
    discrepancy_amount REAL DEFAULT 0 NOT NULL,
    discrepancy_status TEXT DEFAULT 'balanced' NOT NULL,
    customer_count INTEGER DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    average_ticket REAL DEFAULT 0,
    status TEXT DEFAULT 'draft' NOT NULL,
    submitted_at TIMESTAMP,
    approved_by VARCHAR REFERENCES users(id),
    approved_at TIMESTAMP,
    notes TEXT,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE cashier_payment_breakdowns (
    id SERIAL PRIMARY KEY,
    journal_id INTEGER NOT NULL REFERENCES cashier_sales_journals(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL,
    amount REAL DEFAULT 0 NOT NULL,
    transaction_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE cashier_signatures (
    id SERIAL PRIMARY KEY,
    journal_id INTEGER NOT NULL REFERENCES cashier_sales_journals(id) ON DELETE CASCADE,
    signature_type TEXT NOT NULL,
    signer_name TEXT NOT NULL,
    signer_id VARCHAR REFERENCES users(id),
    signature_data TEXT NOT NULL,
    ip_address TEXT,
    signed_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```