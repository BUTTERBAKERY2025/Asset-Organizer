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
- **iPad / Tablet Field Usability**: Numeric keypads for currency, optimized touch targets, wider dialogs, parallel photo uploads, searchable comboboxes, inline status quick-edit, slow-connection banner, and auto-save for daily work logs.

### Technical Implementations
- **Frontend**: React with TypeScript, Wouter for routing, TanStack React Query for state, shadcn/ui for components, Tailwind CSS v4, React Hook Form with Zod.
- **Backend**: Node.js with Express, TypeScript, ESM modules, esbuild, RESTful JSON API (`/api/*`).
- **Database**: PostgreSQL managed with Drizzle ORM, schema defined in `shared/schema.ts`.

### Feature Specifications
- **Core Modules**: Branch-based inventory and operations, asset status tracking, 15% Saudi VAT calculation, construction project management, operations and production management, cashier sales journal.
- **Advanced Features**: Unified command center, comprehensive role-based access control (RBAC) with multi-branch support, P&L dashboard, marketing influencer management, employee integration (attendance, schedules, timesheets), influencer contract management (with PDF export), finished goods inventory with atomic transfers, warehouse and materials management, document management with version control, executive secretariat system, social responsibility module, weekly schedule lock system, advanced attendance reports, smart incentives and points system, display bar and daily waste system, system notifications and broadcast messages.
- **Detailed Employee Attendance PDF**: Includes a dedicated "أيام الإجازة خلال الفترة" section listing all off-days for the selected employee within the date range.
- **Monthly Salary Closing**: Schedule-aware hybrid calculation using `employee_schedules` as the source of truth for expected work days and off days, with fallbacks to `attendance_records` and visual alerts for missing schedules. The dialog uses its own dedicated bundle query keyed on `salaryClosingBranch` + `salaryClosingMonth` (separate from the page-level filters), so changing the closing month/branch always refetches the correct schedules and attendance.
- **Accounting Software Integration**: Automatic journal entries, financial reconciliation, hierarchical Saudi Chart of Accounts, export to Qoyod, Zoho Books, and CSV.
- **Event POS**: Module for seasonal events with ZATCA-compliant invoicing, product catalog management, multiple payment methods, and print-ready receipts.
- **Organizational Structure**: Interactive org chart displaying company hierarchy.
- **Contractor Account Statements**: Unified page for contractor KPIs, detailed statements, and payment request linking.
- **Project Daily Work Logs**: iPad-friendly 4-tab form tailored for commercial fit-out work, linking activities to contractor, contract, and contract items, with automatic quantity increments and inline expense recording.
- **Construction Smart Dashboard**: Aggregates project details, calculated financial-weighted progress, budget by category with status thresholds, today's project snapshot, and contracts summary.

### Performance Optimization
- **Caching**: Server-side in-memory cache, tiered caching, client persistent cache, report-specific TTLs.
- **Database Optimization**: Database indexes, N+1 query elimination, SQL aggregation, filtered queries.
- **API Optimization**: Batch API, consolidated reports bundle, gzip compression, prefetch on hover.
- **Frontend Performance**: AuthGate instant render, deduplicated init fetch, mobile-aware preloading.

### Data Integrity
- **Employee Schedule Deduplication**: UNIQUE indexes and startup migration for data consistency.
- **Transactional Bulk Save**: Atomic operations for employee schedules.
- **Upsert Pattern**: Handles existing records for single and bulk schedule saves.

### System Design Choices
- **Shared Schema**: Centralized database schema definition.
- **Modular Design**: Distinct modules for various business functions.
- **Scalability**: Designed for multi-branch operations and large datasets.
- **Branch-Level Security**: Strict data isolation via backend and frontend controls.

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
- **Unified Supabase Storage**: For all file uploads.

### External System Integrations
- **Accounting Integration**: API endpoints for financial report exports.
- **SMS/WhatsApp Notifications**: Notification queue system (ready for Twilio).
- **Data Import**: Excel import functionality via API.