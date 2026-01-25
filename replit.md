# نظام إدارة المشروعات والأصول والصيانة - باتر

## Overview
This project is a comprehensive management system for Butter Bakery, designed to streamline project, asset, and maintenance operations across multiple branches in Saudi Arabia. It includes multi-location inventory, asset status tracking, construction project oversight, maintenance scheduling, and detailed reporting. Key features also encompass Saudi VAT calculations, production management, and cashier sales journals, all within an Arabic RTL interface. The system aims to enhance operational efficiency and provide a unified view of the business. The project also focuses on business vision, market potential, and project ambitions to provide a competitive edge in the bakery industry through optimized operations and enhanced customer satisfaction.

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
- **RBAC System (Role-Based Access Control)**: Comprehensive permission system with departments, hierarchical roles, granular permissions, user assignments with branch/department scope, and permission overrides. This includes enhanced security features like 2FA, IP whitelisting, session management, password policies, and audit trails.
- **P&L Dashboard Enhancements**: Includes advanced financial KPIs such as EBITDA, contribution margin, labor productivity, and operating profit.
- **Marketing Influencers Enhancement**: Management of influencer data including social media metrics and bank details.
- **Branch Employee Integration**: Features for linking employees to user accounts, tracking attendance, schedules, and timesheets.
- **Influencer Contracts Management**: Contract generation with PDF export, auto-generated contract numbers, deliverables tracking, exclusivity clauses, dual signatures, and financial approval workflow.
- **Finished Goods Inventory**: Automatic transfer of completed production batches to finished goods inventory with full audit trail, supporting transfers to branches or sales display bar. Features atomic transactions for data integrity, balance tracking, and movement logs. Products are identified by normalized name.
- **Warehouse & Materials Management**: Comprehensive system for managing material requests and transfers between branches and main warehouse, including material categorization, request workflows, transfer tracking, electronic signatures, and stock level monitoring.
- **Document Management & Archiving**: Comprehensive document management system for storing, organizing, and sharing company documents, with file upload, folder hierarchy, category classification, version control, document preview, share links, and access logging.
- **Executive Secretariat System**: Comprehensive CEO command center with integrated modules for meetings, tasks, correspondence, visitors, and travel management, along with unified PDF reports and real-time notification system.
- **Social Responsibility Module**: Comprehensive social responsibility and community engagement management system, including beneficiary organizations, social initiatives, community discounts, and usage analytics.

### Performance Optimization
- **Tiered Caching Strategy**: Five-tier cache system based on data volatility (STATIC, LONG, MEDIUM, SHORT, DYNAMIC).
- **Server-side Caching**: Memoized data fetchers for frequently accessed data (Branches, Users, Permissions).
- **Prefetch on Hover**: Navigation links prefetch API data on mouse hover to reduce perceived load time, with smart prefetch guards.
- **Database Indexes**: Composite indexes for common query patterns to improve performance.

### System Design Choices
- **Shared Schema**: `shared/` directory for database schema ensures type consistency between frontend and backend.
- **Modular Design**: Distinct modules for construction, operations, and cashier functions.
- **Scalability**: Designed to handle multi-branch operations and large datasets with pagination.
- **Branch-Level Security**: Strict branch-level data isolation for non-admin users enforced via backend filters and frontend component logic, with comprehensive security checks across API endpoints.

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
- **Accounting Integration**: API endpoints for exporting inventory valuation, asset movements, and project cost reports.
- **SMS/WhatsApp Notifications**: Notification queue system ready for Twilio integration.
- **Data Import**: Excel import functionality via API endpoint (`/api/import-jobs`).