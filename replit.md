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
- **iPad / Tablet Field Usability**: Optimized for field use with numeric keypads, touch targets, parallel photo uploads, searchable comboboxes, inline status quick-edit, slow-connection banner, and auto-save for daily work logs.

### Technical Implementations
- **Frontend**: React with TypeScript, Wouter for routing, TanStack React Query for state, shadcn/ui for components, Tailwind CSS v4, React Hook Form with Zod.
- **Backend**: Node.js with Express, TypeScript, ESM modules, esbuild, RESTful JSON API (`/api/*`).
- **Database**: PostgreSQL managed with Drizzle ORM, schema defined in `shared/schema.ts`.

### Feature Specifications
- **Core Modules**: Branch-based inventory and operations, asset status tracking, 15% Saudi VAT calculation, construction project management, operations and production management, cashier sales journal.
- **Advanced Features**: Unified command center, comprehensive role-based access control (RBAC) with multi-branch support, P&L dashboard, marketing influencer management, employee integration (attendance, schedules, timesheets), influencer contract management (with PDF export), finished goods inventory with atomic transfers, warehouse and materials management, document management with version control, executive secretariat system, social responsibility module, weekly schedule lock system, advanced attendance reports, smart incentives and points system, display bar and daily waste system, system notifications and broadcast messages.
- **Timesheet Management**: Enhanced reporting and dashboard, including single and branch-wide PDF generation with detailed employee data, exceptions, and acknowledgment features. Phase 3 adds period locking on finalization, immutable audit log of every action (created/signed/locked/reissued), admin reissue flow with mandatory reason that creates a new versioned report and supersedes the prior one, and in-app notifications when employees sign (manager notified) and when reports finalize (employee notified). Locked reports refuse re-signing and deletion until reissued. **Schema change**: 7 new columns on `timesheet_reports` (`is_locked`, `locked_at`, `locked_by`, `version`, `superseded_by`, `superseded_at`, `reissue_reason`) + new `timesheet_audit_log` table — must be applied in Supabase SQL Editor before Render deploy.
- **Salary Management**: Manual salary deductions and advances, monthly salary closing with multi-source data prioritization (signed timesheets, schedule + attendance, attendance only), and automatic absence deduction calculation.
- **Accounting Software Integration**: Automatic journal entries, financial reconciliation, hierarchical Saudi Chart of Accounts, export to Qoyod, Zoho Books, and CSV.
- **Event POS**: Module for seasonal events with ZATCA-compliant invoicing, product catalog management, multiple payment methods, and print-ready receipts.
- **Organizational Structure**: Interactive org chart displaying company hierarchy.
- **Contractor Account Statements**: Unified page for contractor KPIs, detailed statements, and payment request linking.
- **Project Daily Work Logs**: iPad-friendly form linking activities to contractor, contract, and contract items, with automatic quantity increments and inline expense recording.
- **Construction Smart Dashboard**: Aggregates project details, financial-weighted progress, budget by category, project snapshot, and contracts summary.
- **Contract Payment Milestones (Phase 1)**: Replaces the legacy free-text `payment_terms` field with structured, trackable milestones on each construction contract. Each milestone has a sequence, title, description, amount (computed as % of contract total OR fixed), trigger type (manual/date/progress/item_completion), due date, and status (pending → due → requested → paid). One-click conversion to a `paymentRequest` (links the two so the same milestone can't generate two requests). Visual timeline UI on the contract detail page (`/contracts/:id`) shows status dots, amounts, percentages, and inline actions. Live preview shows the computed amount as the user types the percentage. **Schema change**: new table `contract_milestones` (15 columns + 3 indexes) — must be applied via `migrations/014_contract_milestones.sql` in Supabase SQL Editor before Render deploy.
- **Contract Retention & Auto Status (Phase 2)**: Adds warranty hold (retention) management to construction contracts. Each contract can define a `retentionPercentage` (e.g., 5% or 10%) and `retentionReleaseDate`. When a payment request linked to a milestone is marked as paid, the system: (1) auto-flips the milestone status to `paid` and sets `paidAmount = milestone.amount − retention`, (2) inserts a `contract_retentions` audit row of type `hold` for the retention amount. The contract detail page shows a dedicated retention card (currently held, total released, release date) with two actions: edit settings, and "إفراج عن الضمان" which inserts a single `release` row equal to currently-held and marks the contract as `retentionReleased=true`. Full audit trail of every hold/release. **Schema change**: 5 new columns on `construction_contracts` (`retention_percentage`, `retention_release_date`, `retention_released`, `retention_released_at`, `retention_released_by`) + new `contract_retentions` table — must be applied via `migrations/015_contract_retention.sql` in Supabase SQL Editor before Render deploy.

### Performance Optimization
- **Caching**: Server-side in-memory, tiered, client persistent, report-specific TTLs. Client-side `refetchOnMount: false` honours staleTime; `refetchOnReconnect: true` keeps data fresh after offline.
- **Optimistic Updates**: System notifications mark-as-read and mark-all-as-read flip cache instantly via `onMutate` + `onError` rollback + `onSettled` reconciliation, so badge counter responds without server round-trip.
- **Network Resilience**: Smart auto-retry (3 attempts with 1s/3s/6s backoff) for transient errors (network failure, timeout, 408/425/429/5xx) — eliminates the "I had to reload to get my data" experience when Supabase Pooler returns 502/503 on cold-start. Permanent errors (400/401/403/404/409/410/422) skip retry. Every fetch wrapped in `AbortController` with a 30s hard timeout so the UI never hangs forever. `<DataErrorBanner />` slides in at bottom-right when any background query has failed and offers a single "إعادة المحاولة" button that re-fetches all failed queries in parallel without a page reload.
- **Predicate-based Invalidation**: High-frequency forms (display-bar waste, social responsibility) use a single predicate-based `invalidateQueries` per mutation instead of 2-3 separate calls — reduces re-render waves.
- **Unified Loading Skeletons**: AuthGate and Suspense fallbacks share the same `skeleton-shimmer` visual language, removing the dark spinner flash on first paint.
- **Database Optimization**: Indexes, N+1 query elimination, SQL aggregation, filtered queries.
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