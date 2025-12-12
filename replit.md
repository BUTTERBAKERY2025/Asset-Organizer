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