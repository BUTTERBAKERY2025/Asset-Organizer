# نظام إدارة المشروعات والأصول والصيانة - باتر

## Overview
This project is a comprehensive management system designed for Butter Bakery, operating across multiple branches in Saudi Arabia. It aims to streamline the management of projects, assets, and maintenance operations. Key capabilities include inventory tracking, asset management, construction project oversight, maintenance scheduling, and detailed reporting, all presented with an Arabic RTL interface. The system supports multi-location inventory, tracks asset status for maintenance reporting, handles Saudi VAT calculations, and includes modules for production management and cashier sales journals.

## User Preferences
Preferred communication style: Simple, everyday language.

**Important Deployment Preferences:**
- Always notify the user when any update requires database schema changes (new tables, columns, migrations)
- Deployment workflow: Manual deploy on Render (not auto-deploy)
- Database updates require manual SQL execution in Supabase SQL Editor before code deployment

## System Architecture
The system employs a modern web architecture with a React-based frontend and a Node.js/Express backend.

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
- **Construction Project Management**: Module for tracking projects, work items (electrical, plumbing, etc.), contractors, and project statuses.
- **Operations and Production Module**: Manages products, shift scheduling, production orders, quality control, and daily summaries.
- **Cashier Sales Journal Module**: Facilitates daily sales recording, payment breakdowns, cash reconciliation, and electronic signatures.
- **Pagination System**: Comprehensive pagination implemented across data-heavy pages for efficient data handling.
- **Sales Analytics**: Advanced filters, CSV/Excel export, seasonal factors, and auto-refresh for sales reports.
- **Unified Command Center**: A dashboard aggregating KPIs from production, inventory, cashier, and waste modules, with comparison metrics and auto-refresh.

### System Design Choices
- **Shared Schema**: `shared/` directory for database schema ensures type consistency between frontend and backend.
- **Modular Design**: Distinct modules for construction, operations, and cashier functions.
- **Scalability**: Designed to handle multi-branch operations and large datasets with pagination.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, configured via `DATABASE_URL`.
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
- **SMS/WhatsApp Notifications**: Notification queue system ready for Twilio integration (requires manual setup of `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`).
- **Data Import**: Excel import functionality available via an API endpoint (`/api/import-jobs`).