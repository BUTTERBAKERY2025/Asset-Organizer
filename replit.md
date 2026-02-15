# نظام إدارة المشروعات والأصول والصيانة - باتر

## Overview
This project is a comprehensive management system for Butter Bakery, designed to streamline project, asset, and maintenance operations across multiple branches in Saudi Arabia. It includes multi-location inventory, asset status tracking, construction project oversight, maintenance scheduling, and detailed reporting. Key features also encompass Saudi VAT calculations, production management, and cashier sales journals, all within an Arabic RTL interface. The system aims to enhance operational efficiency and provide a unified view of the business, offering a competitive edge through optimized operations and enhanced customer satisfaction.

## User Preferences
Preferred communication style: Simple, everyday language.

**Important Deployment Preferences:**
- Always notify the user when any update requires database schema changes (new tables, columns, migrations)
- Deployment workflow: Manual deploy on Render (not auto-deploy)
- Database updates require manual SQL execution in Supabase SQL Editor before code deployment

## System Architecture
The system uses a modern web architecture with a React-based frontend and a Node.js/Express backend.

### UI/UX Decisions
- **Arabic-First Design**: Default RTL layout with Arabic fonts (Cairo) and interface text.
- **Theming**: Custom "Butter Gold" theme using Tailwind CSS.
- **Reporting**: Integrated charting (Recharts) and export functionalities (XLSX, react-to-print).

### Technical Implementations
- **Frontend**: React with TypeScript, Wouter for routing, TanStack React Query for state, shadcn/ui for components, Tailwind CSS v4, React Hook Form with Zod.
- **Backend**: Node.js with Express, TypeScript, ESM modules, esbuild, RESTful JSON API (`/api/*`).
- **Database**: PostgreSQL managed with Drizzle ORM, schema defined in `shared/schema.ts`.

### Feature Specifications
- **Branch-Based Organization**: Inventory and operations structured by branch.
- **Status Tracking**: Comprehensive status management for assets and production items.
- **Financials**: Built-in 15% Saudi VAT calculation.
- **Construction Project Management**: Module for tracking projects, work items, and contractors.
- **Operations and Production Module**: Manages products, shifts, production orders, and quality control.
- **Cashier Sales Journal Module**: Facilitates daily sales recording, payment breakdowns, and reconciliation.
- **Pagination System**: Implemented across data-heavy pages.
- **Sales Analytics**: Advanced filters, export options, and auto-refresh for sales reports.
- **Unified Command Center**: Dashboard aggregating KPIs from various modules.
- **RBAC System**: Comprehensive role-based access control with granular permissions, 2FA, IP whitelisting, and audit trails.
- **P&L Dashboard Enhancements**: Includes advanced financial KPIs.
- **Marketing Influencers Enhancement**: Management of influencer data.
- **Branch Employee Integration**: Features for linking employees to user accounts, tracking attendance, schedules, and timesheets.
- **Influencer Contracts Management**: Contract generation with PDF export, tracking, and approval workflow.
- **Finished Goods Inventory**: Automatic transfer of production batches with audit trail and atomic transactions.
- **Warehouse & Materials Management**: System for material requests and transfers between branches and warehouse.
- **Document Management & Archiving**: System for storing, organizing, and sharing company documents with version control and access logging.
- **Executive Secretariat System**: CEO command center with modules for meetings, tasks, correspondence, and unified reports.
- **Social Responsibility Module**: Management system for social initiatives and community engagement.
- **Weekly Schedule Lock System**: Protection mechanism for weekly shift schedules with audit trails.
- **Advanced Attendance Reports**: Comprehensive reporting tab in shift management with 5 detailed reports, export, and secure branch data isolation.
- **Smart Incentives & Points System**: Comprehensive cashier incentive management with point settings, daily challenges, product commissions, branch bonuses, cashier wallet, awards history, and incentive statements, with granular RBAC permissions and security hardening.
- **Display Bar & Daily Waste System**: Manages display bar operations with production receipts, daily waste tracking, and approval workflows.
- **System Notifications & Broadcast Messages**: Interactive notification system for targeted messages with various types, display styles, targeting, scheduling, and read/dismiss tracking.
- **Accounting Software Integration**: Comprehensive system for automatic journal entries from sales and waste, financial reconciliation, a hierarchical Saudi Chart of Accounts, and export capabilities to Qoyod, Zoho Books, and general CSV.

### Performance Optimization
- **API Response Cache**: Server-side in-memory cache for all GET /api/* responses with per-user+branch isolation and auto-invalidation.
- **Tiered Caching Strategy**: Five-tier cache system based on data volatility.
- **Server-side Caching**: Memoized data fetchers and auth cache.
- **Batch API**: POST /api/batch for combining multiple GET requests.
- **Gzip Compression**: All responses >1KB are compressed.
- **Prefetch on Hover**: Navigation links prefetch API data.
- **Database Indexes**: Composite indexes for common query patterns.
- **N+1 Query Elimination**: Batch queries replace per-item loops.
- **Slow Request Logging**: Logs requests >500ms.

### System Design Choices
- **Shared Schema**: `shared/` directory for database schema.
- **Modular Design**: Distinct modules for construction, operations, and cashier functions.
- **Scalability**: Designed for multi-branch operations and large datasets.
- **Branch-Level Security**: Strict data isolation enforced via backend filters and frontend logic.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.
- **Drizzle Kit**: For database migrations.

### Third-Party Libraries
- **@tanstack/react-query**: Server state management.
- **xlsx**: Excel import/export.
- **react-to-print**: Printing functionality.
- **recharts**: Data visualization.
- **zod**: Schema validation.
- **drizzle-orm**: Type-safe ORM.

### Fonts
- **Google Fonts**: Cairo (Arabic) and Plus Jakarta Sans (Latin).

### File Storage
- **Unified Supabase Storage**: All file uploads are handled by Supabase Storage via `POST /api/uploads?folder=<folder>`.
- **Download Flow**: Authenticated `GET /api/uploads/file/<path>` or `GET /api/documents/file/<filename>` serves files.

### External System Integrations
- **Accounting Integration**: API endpoints for exporting financial reports.
- **SMS/WhatsApp Notifications**: Notification queue system ready for Twilio integration.
- **Data Import**: Excel import functionality via API endpoint (`/api/import-jobs`).