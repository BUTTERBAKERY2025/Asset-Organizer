# نظام إدارة المشروعات والأصول والصيانة - باتر

## Overview
This project is a comprehensive management system for Butter Bakery, designed to streamline project, asset, and maintenance operations across multiple branches in Saudi Arabia. It includes multi-location inventory, asset status tracking, construction project oversight, maintenance scheduling, and detailed reporting. Key features also encompass Saudi VAT calculations, production management, and cashier sales journals, all within an Arabic RTL interface. The system aims to enhance operational efficiency and provide a unified view of the business.

## User Preferences
Preferred communication style: Simple, everyday language.

**Important Deployment Preferences:**
- Always notify the user when any update requires database schema changes (new tables, columns, migrations)
- Deployment workflow: Manual deploy on Render (not auto-deploy)
- Database updates require manual SQL execution in Supabase SQL Editor before code deployment

**Required Migrations:**
- `migrations/001_finished_goods_unique_index.sql` - Functional unique index for Finished Goods Inventory system (required for atomic UPSERT operations)
- `migrations/003_marketing_tables_complete.sql` - جداول عقود ومدفوعات المؤثرين (influencer_contracts, influencer_payments)
- `migrations/004_performance_indexes.sql` - فهارس الأداء للجداول الكبيرة (production, inventory, cashier, warehouse)
- `migrations/006_documents_tables.sql` - جداول إدارة الوثائق والأرشفة (documents, document_categories, document_folders, document_versions, document_shares, document_access_logs)

## System Architecture
The system uses a modern web architecture with a React-based frontend and a Node.js/Express backend.

### UI/UX Decisions
- **Arabic-First Design**: Default RTL layout with Arabic fonts (Cairo) and interface text.
- **Theming**: Custom "Butter Gold" theme using Tailwind CSS, inspired by bakery aesthetics.
- **Reporting**: Integrated charting (Recharts) and export functionalities (XLSX, react-to-print).

### Technical Implementations
- **Frontend**: React with TypeScript, Wouter for routing, TanStack React Query for state, shadcn/ui for components, Tailwind CSS v4 for styling, React Hook Form with Zod for forms.
- **Backend**: Node.js with Express, TypeScript, ESM modules, esbuild for bundling, RESTful JSON API (`/api/*`).
- **Database**: PostgreSQL managed with Drizzle ORM, schema defined in `shared/schema.ts` for type safety across stack.

### Feature Specifications
- **Branch-Based Organization**: Inventory and operations are structured by branch locations.
- **Status Tracking**: Assets and production items have statuses (e.g., good, maintenance, damaged, missing, pending, completed).
- **Financials**: Built-in 15% Saudi VAT calculation.
- **Construction Project Management**: Module for tracking projects, work items, contractors, and project statuses.
- **Operations and Production Module**: Manages products, shift scheduling, production orders, quality control, and daily summaries.
- **Cashier Sales Journal Module**: Facilitates daily sales recording, payment breakdowns, cash reconciliation, and electronic signatures with comprehensive net variance calculation.
- **Pagination System**: Comprehensive pagination implemented across data-heavy pages.
- **Sales Analytics**: Advanced filters, CSV/Excel export, seasonal factors, and auto-refresh for sales reports.
- **Unified Command Center**: A dashboard aggregating KPIs from production, inventory, cashier, and waste modules.
- **RBAC System (Role-Based Access Control)**: Comprehensive permission system with departments, hierarchical roles, granular permissions (200+), user assignments with branch/department scope, and permission overrides. This includes enhanced security features like 2FA, IP whitelisting, session management, password policies, and audit trails.
- **P&L Dashboard Enhancements**: Includes advanced financial KPIs such as EBITDA, contribution margin, labor productivity, and operating profit.
- **Marketing Influencers Enhancement**: Management of influencer data including social media metrics and bank details.
- **Branch Employee Integration**: Features for linking employees to user accounts, tracking attendance, schedules, and timesheets.
- **Influencer Contracts Management**: Contract generation with PDF export, auto-generated contract numbers (BTR-INF-YYYY-####), deliverables tracking, exclusivity clauses, dual signatures, and financial approval workflow.
- **Finished Goods Inventory (مخزون الإنتاج النهائي)**: Automatic transfer of completed production batches to finished goods inventory with full audit trail. Supports transfers to branches or sales display bar (بار العرض). Features atomic transactions for data integrity, balance tracking, and movement logs. Tables: `finished_goods_inventory`, `finished_goods_transfers`, `production_inventory_logs`.
  - **Design Decision**: Products are identified by normalized name (lowercase, trimmed) rather than strict SKU. This allows aggregation of production by product name and supports manual entries without product IDs. The unique constraint is (branch_id, product_name_normalized, production_date).
  - **Atomic Operations**: Batch creation/update with finished goods transfer happens in a single database transaction, ensuring consistency.
- **Warehouse & Materials Management (المخازن والتحويلات)**: Comprehensive system for managing material requests and transfers between branches and main warehouse.
  - **Material Categories**: Raw materials (مواد خام), Consumables (مستهلكات), Packaging (مواد تغليف), Primary Production (مواد إنتاج أولية).
  - **Request Workflow**: draft → pending → approved/rejected/forwarded_to_purchasing → fulfilled.
  - **Transfer Tracking**: pending → in_transit → delivered, with driver name, vehicle number, departure/arrival times.
  - **Electronic Signatures**: Receipt confirmation with digital signatures.
  - **Stock Level Monitoring**: Low stock alerts and reorder point tracking.
  - **Tables**: `warehouse_items`, `branch_stock`, `material_requests`, `material_request_items`, `material_transfers`, `material_transfer_items`, `warehouse_movement_logs`.
  - **Request Numbers**: Auto-generated format MR-YYYYMM-XXXX.
  - **Transfer Numbers**: Auto-generated format MT-YYYYMM-XXXX.
- **Document Management & Archiving (إدارة الوثائق والأرشفة)**: Comprehensive document management system for storing, organizing, and sharing company documents.
  - **File Upload**: Drag-and-drop and click-to-select upload with XHR progress tracking. Supports PDF, Word, Excel, PowerPoint, images, text, CSV, and archives (15+ types). Maximum file size 50MB.
  - **Document Organization**: Folder hierarchy with path calculation, category classification (7 default categories: Contracts, Policies, Reports, Correspondence, Financial, HR, Others), tags, and access levels (public/internal/confidential/restricted).
  - **Version Control**: Automatic version tracking with change notes and previous version history.
  - **Document Preview**: In-dialog preview for PDF (iframe) and images (jpg/png/gif/webp), fallback download for unsupported types.
  - **Share Links**: Public share links with crypto-random tokens (32 hex chars), access control (expiry date, max access count, password protection), and access logging.
  - **Access Logging**: Complete audit trail of document views, downloads, and share link access with timestamps and user information.
  - **Security**: MD5 checksum calculation for file integrity, file type validation on upload, server-side access control enforcement.
  - **Tables**: `documents`, `document_categories`, `document_folders`, `document_versions`, `document_shares`, `document_access_logs`.
  - **Migration**: `migrations/006_documents_tables.sql` - Complete schema with indexes, foreign keys, and default categories.

### Performance Optimization
- **Tiered Caching Strategy**: Five-tier cache system based on data volatility:
  - STATIC (1 hour): Branches - rarely changing reference data
  - LONG (30 minutes): Users, products, warehouse items - slowly changing catalog data
  - MEDIUM (5 minutes): Permissions, marketing campaigns, inventory - moderately changing data
  - SHORT (2 minutes): Material requests, transfers - frequently changing operational data
  - DYNAMIC (30 seconds): Dashboard stats, production data - real-time data
- **Server-side Caching**: Memoized data fetchers for frequently accessed data:
  - Branches cached for 1 minute
  - Users cached for 30 seconds
  - Per-user permissions cached for 30 seconds
- **Prefetch on Hover**: Navigation links prefetch API data on mouse hover to reduce perceived load time
- **Smart Prefetch Guards**: 
  - Prefetching checks query state to avoid redundant requests for in-flight or fresh data
  - Large dataset endpoints (audit logs, inventory, production) excluded from hover prefetch
- **Database Indexes**: Composite indexes for common query patterns (see `migrations/004_performance_indexes.sql`):
  - Branch + Date indexes for production and cashier queries
  - Status indexes for filtering workflows
  - Category indexes for inventory and warehouse items

### System Design Choices
- **Shared Schema**: `shared/` directory for database schema ensures type consistency between frontend and backend.
- **Modular Design**: Distinct modules for construction, operations, and cashier functions.
- **Scalability**: Designed to handle multi-branch operations and large datasets with pagination.
- **Branch-Level Security**: Strict branch-level data isolation for non-admin users enforced via backend filters and frontend component logic.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.
- **Drizzle Kit**: Used for database migrations.

### Third-Party Libraries
- **@tanstack/react-query**: Server state management.
- **xlsx**: Excel import/export.
- **react-to-print**: Printing functionality.
- **recharts**: Data visualization.
- **zod**: Schema validation.
- **drizzle-orm**: Type-safe ORM.

### Fonts
- **Google Fonts**: Cairo (Arabic) and Plus Jakarta Sans (Latin).

### External System Integrations
- **Accounting Integration**: API endpoints for exporting inventory valuation, asset movements, and project cost reports in JSON format.
- **SMS/WhatsApp Notifications**: Notification queue system ready for Twilio integration.
- **Data Import**: Excel import functionality via API endpoint (`/api/import-jobs`).