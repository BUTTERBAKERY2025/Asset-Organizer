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
The system uses a modern web architecture with a React-based frontend and a Node.js/Express backend, optimized for an Arabic-first, RTL user experience.

### UI/UX Decisions
- **Arabic-First Design**: Default RTL layout with Arabic fonts (Cairo).
- **Theming**: Custom "Butter Gold" theme using Tailwind CSS.
- **Reporting**: Integrated charting (Recharts) and export functionalities (XLSX, react-to-print).
- **iPad / Tablet Field Usability**: Optimized for field use with numeric keypads, touch targets, parallel photo uploads, searchable comboboxes, inline status quick-edit, slow-connection banner, and auto-save for daily work logs.

### Technical Implementations
- **Frontend**: React with TypeScript, Wouter for routing, TanStack React Query for state, shadcn/ui for components, Tailwind CSS v4, React Hook Form with Zod.
- **Backend**: Node.js with Express, TypeScript, ESM modules, esbuild, RESTful JSON API (`/api/*`).
- **Database**: PostgreSQL managed with Drizzle ORM.

### Feature Specifications
- **Core Modules**: Branch-based inventory and operations, asset status tracking, 15% Saudi VAT calculation, construction project management, operations and production management, cashier sales journal.
- **Advanced Features**: Unified command center, comprehensive role-based access control (RBAC) with multi-branch support, P&L dashboard, marketing influencer management, employee integration, influencer contract management, finished goods inventory with atomic transfers, warehouse and materials management, document management with version control, executive secretariat system, social responsibility module, weekly schedule lock system, advanced attendance reports, smart incentives and points system, display bar and daily waste system, system notifications and broadcast messages.
- **Timesheet Management**: Enhanced reporting, period locking, immutable audit logs, and admin reissue flow.
- **Salary Management**: Manual deductions and advances, monthly closing with multi-source data prioritization, and automatic absence deduction.
- **Accounting Software Integration**: Automatic journal entries, financial reconciliation, hierarchical Saudi Chart of Accounts, export to Qoyod, Zoho Books, and CSV.
- **Event POS**: ZATCA-compliant invoicing, product catalog, multiple payment methods, and print-ready receipts.
- **Organizational Structure**: Interactive org chart.
- **Contractor Account Statements**: Unified page for KPIs, detailed statements, and payment request linking.
- **Project Daily Work Logs**: iPad-friendly form for activity logging, quantity increments, and inline expense recording.
- **Construction Smart Dashboard**: Aggregates project details, financial progress, budget, and contracts summary.
- **Contract Milestones**: Structured, trackable milestones with sequence, title, amount, trigger type, due date, and status.
- **Contract Retention**: Warranty hold management (retention percentage, release date) with audit trails.
- **Enhanced BOQ & Automatic Accounting Integration**: Hierarchical Bill of Quantities with Excel import, and automatic journal entry creation for contract events (variation approval, retention release, liquidated damages).
- **Liquidated Damages & Contract Templates**: Structured tracking of late-delivery penalties and reusable contract templates for various contract types.
- **Contract Variations & Bank Guarantees**: Tracking of additions/deductions/scope changes/time extensions, and management of contractor-provided bank guarantees.
- **Auto Contract Numbering & Official Document (Phase 6)**: Automatic `CON-YYYY-NNNN` numbering on creation, expanded fields for scope of work, terms & conditions, parties, signature data; printable A4 RTL official contract document exportable as PDF via react-to-print.
- **WhatsApp Integration & Automated Monthly Reports (Phase 11)**: Twilio-based WhatsApp/SMS notification queue with retry (max 3 attempts, retry_count + last_attempt_at columns), monthly report scheduler running every 60 seconds, 5 report generators (monthly_sales/pnl/construction/attendance/production), per-branch or all-branches scheduling with day-of-month (1-28) and hour (0-23) configuration, dedicated admin page at `/notifications-center` (3 tabs: Schedules with create/edit/run-now/preview/toggle, Queue with retry, Test WhatsApp). Tables `report_schedules` + `report_runs` with `nextRunAt` auto-computed via `computeNextRun`. Recipients stored as JSONB array `[{phone, name?, channels?:["whatsapp"|"sms"]}]`. All routes protected by `settings` permission module.
- **Field Hub & GPS-tagged Checklists (Phase 8)**: Mobile-first dashboard for site engineers (`/field-hub`) showing today's logs, open/overdue checklists, recent geo-tagged photos, quick-action buttons. Reusable checklist templates by category (safety/quality/handover/commissioning/inspection/opening) and trade (paint/tiling/HVAC/etc.) at `/field-checklists/templates`. Mobile checklist execution page with Pass/Fail/N-A toggle, inline notes, and `GPSPhotoCapture` component (`navigator.geolocation` + `capture="environment"`) attaching latitude/longitude/accuracy to each photo. Server-side completion validation (required items + required photos), atomic recount transaction, IDOR-protected item updates (item must belong to checklist), branch-scoped access via `checkChecklistAccess` (project link → branch link → assignee/creator fallback).

### Performance Optimization
- **Caching**: Server-side in-memory, client-side persistent, and report-specific TTLs.
- **Optimistic Updates**: Instant UI feedback for actions like marking notifications as read.
- **Network Resilience**: Smart auto-retry for transient errors, `AbortController` for timeouts, and error banners for failed background queries.
- **Predicate-based Invalidation**: Reduces re-render waves for high-frequency forms.
- **Unified Loading Skeletons**: Consistent visual language for loading states.
- **Database Optimization**: Indexes, N+1 query elimination, SQL aggregation, filtered queries.
- **API Optimization**: Batch API, consolidated reports, gzip compression, prefetch on hover.
- **Frontend Performance**: Instant AuthGate render, deduplicated initial fetches, mobile-aware preloading.

### Data Integrity
- **Employee Schedule Deduplication**: UNIQUE indexes and startup migrations.
- **Transactional Bulk Save**: Atomic operations for employee schedules.
- **Upsert Pattern**: Handles existing records for single and bulk saves.

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