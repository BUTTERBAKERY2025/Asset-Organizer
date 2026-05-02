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
- **Core Modules**: Branch-based inventory and operations, asset status tracking, 15% Saudi VAT calculation, construction project management, operations and production management, cashier sales journal.
- **Advanced Features**: Unified command center, comprehensive role-based access control (RBAC) with multi-branch support, P&L dashboard, marketing influencer management, employee integration (attendance, schedules, timesheets), influencer contract management (with PDF export), finished goods inventory with atomic transfers, warehouse and materials management, document management with version control, executive secretariat system, social responsibility module, weekly schedule lock system, advanced attendance reports.
- **Detailed Employee Attendance PDF**: The "تقرير حضور الموظف التفصيلي" PDF (with signature) includes a dedicated "أيام الإجازة خلال الفترة" section listing all off-days (`isOff=true` in `employee_schedules`) for the selected employee within the date range — date, day name (Arabic), and notes. A 5th amber summary card shows the leave count when > 0.
- **Smart Incentives & Points System**: Comprehensive cashier incentive management.
- **Display Bar & Daily Waste System**: Manages display bar operations and waste tracking.
- **System Notifications & Broadcast Messages**: Interactive notification system.
- **Accounting Software Integration**: Automatic journal entries, financial reconciliation, hierarchical Saudi Chart of Accounts, export to Qoyod, Zoho Books, and CSV.
- **Event POS**: Module for seasonal events with ZATCA-compliant invoicing, product catalog management, multiple payment methods, and print-ready receipts.
- **Organizational Structure**: Interactive org chart displaying company hierarchy.
- **Contractor Account Statements**: Unified page for contractor KPIs, detailed statements, and payment request linking.
- **Project Daily Work Logs (Smart-Link Restructure — May 2026)**: iPad-friendly 4-tab form (البيانات / الأنشطة / المصروفات / الصور) tailored for commercial fit-out work (cafés / restaurants / shops). Each daily activity is linked to **contractor → contract → contract item**, and saving an activity automatically increments `contract_items.completed_quantity` (flips status to `completed` when the cumulative quantity reaches the contract item quantity). Deleting an activity rolls the quantity back. In-site expenses (materials / labor / transport / tools / food / misc) are recorded inline and stored in `project_expenses` with a `daily_log_id` back-reference, so they automatically appear in the project P&L and contractor account statement. Finishing trades catalog: دهانات، سيراميك وأرضيات، تكييف، سباكة، كهرباء، جبس، مطبخ ستيل تجاري، زجاج، MDF، لافتات. Auto-save (30 s) and `beforeunload` guard preserved. Backward-compat banner shown on legacy logs that still use the old `workItems`/`workerBreakdown` JSONB; print page still renders those sections under "نظام قديم" headers. **Schema changes**: new table `daily_log_activities` + columns `project_daily_logs.main_trade` and `project_expenses.daily_log_id` — must run `migrations/013_daily_log_restructure.sql` in Supabase SQL Editor BEFORE deploying to Render.

### iPad / Tablet Field Usability (Construction Module)
- **Numeric keypad**: All currency inputs use `inputMode="decimal"` (project budget, work item costs, payment request amount, category budget allocations) so iPad shows the numeric keypad instead of full keyboard.
- **Touch targets**: Min height `h-11` (44px Apple HIG) on critical inputs. Star rating buttons in contractors form expanded to 44×44 hit area with larger 28px stars.
- **Dialog sizing**: Construction project / contractor dialogs widened to `sm:max-w-2xl max-h-[90vh] overflow-y-auto` to reduce scrolling pain on iPad portrait.
- **Parallel photo upload**: Daily work log photos upload with concurrency=3 (instead of sequential), ~3× faster on slow site networks while avoiding socket exhaustion.
- **Searchable comboboxes**: Reusable `SearchableSelect` (Popover + Command) replaces large `<Select>` dropdowns (>15 items) for projects, contractors, and contracts in payment requests and work-item dialogs. RTL keyboard search, optional sublabel/badge/clearable, 44px touch targets.
- **Inline status quick-edit**: Status badges in `construction-projects` (cards) and `payment-requests` (table) act as `DropdownMenu` triggers. One-click status change without opening the edit modal — gated by existing edit/approve permissions.
- **Slow-connection banner**: `SlowConnectionBanner` pings `/api/health` every 25s and shows an amber banner when latency exceeds 2.5s. Complements the existing offline indicator (which only handles full disconnect). New `/api/health` endpoint added to `server/routes.ts` with `Cache-Control: no-store`.
- **Auto-save daily work log**: Drafts auto-save every 30s when the form is dirty (skipped if a save is in flight or a save ran in the last 25s). Header shows `آخر حفظ تلقائي: HH:MM`. `beforeunload` guard warns the user before leaving with unsaved changes. After a successful final submit the detail query is invalidated and `hasFinalSubmittedRef` flips synchronously so the next auto-save tick is a no-op. Backend PATCH `/api/construction/daily-logs/:id` returns 409 if a stale request tries to downgrade `submitted` → `draft` (defense-in-depth against slow-network race).
- **RTL polish**: Replaced LTR `→` with `←` between start/end times in daily-log printable. Contractor-statement-detail description column widened from `max-w-[300px]` to `max-w-[500px]` (full text remains in `title` tooltip).

### Construction Smart Dashboard (Priority Group 1 — May 2026)
New endpoint `GET /api/construction/projects/:id/dashboard` aggregates everything needed for the project detail page in one call:
- **Calculated progress** (`calculatedProgress`): financial-weighted completion from `contract_items` — `Σ(min(completedQty/qty, 1) × totalPrice) / Σ(totalPrice) × 100`. Independent from the manual `progressPercent` field; the UI shows both with a one-click "تطبيق المحسوبة" button (calls existing PATCH `/api/construction/projects/:id`) when they differ.
- **Budget by category** (`budgetByCategory`): for each category, planned (from `project_budget_allocations`) vs actual (sum of `project_expenses.amount` + `project_work_items.actualCost`), with status thresholds: `ok` <80%, `warning` ≥80%, `critical` ≥90%, `over` ≥100%, `unplanned` (spending without allocation). Categories sorted by `spentTotal` desc. Includes `overallBudgetPercentage` for the totals row.
- **Today's snapshot** (`today`): latest daily log (supervisor, mainTrade, workersCount), today's activities count (queries `daily_log_activities` per today's logs — wrapped in try/catch for prod-Supabase logs that may not yet have the table), today's expenses total, today's workers total. Date computed in Asia/Riyadh.
- **Contracts summary** (`contracts`): count, totalAmount, paidAmount, remainingAmount.

Frontend (`construction-project-detail.tsx`) consumes this dashboard with a 60s `refetchInterval`:
1. **بطاقة "وضع المشروع اليوم"** — gradient blue card after the stats grid: 4 mini-cards (activities/workers/expenses/contracts) + latest log row with link to print page.
2. **شريط الميزانية الديناميكي** — replaced the old plain table with per-category cards: status badge, colored bar (emerald/yellow/orange/red/rose), planned/spent/remaining tri-grid, "AlertTriangle + تجاوز X" inline alert when over budget. Total row uses the same color logic on `overallBudgetPercentage`.
3. **بطاقة نسبة التقدم** — shows manual % + an amber "محسوبة: N%" badge when the calculated value differs, plus a "تطبيق المحسوبة" button (canEdit only). The بنود العمل card now shows both work-items completion and contract-items completion.

No DB schema changes. Uses existing storage methods: `getContractsByProject`, `getContractItems`, `getAllConstructionCategories`, `getBudgetAllocationsByProject`, `getWorkItemsByProject`, `getProjectExpensesByProject`, `getDailyLogsByProject`, `getDailyLogActivities`.

### Performance Optimization
- **Caching**: Server-side in-memory cache, tiered caching strategy, client persistent cache, report-specific TTLs.
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