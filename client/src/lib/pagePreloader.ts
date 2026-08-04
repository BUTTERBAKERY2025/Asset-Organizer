const pageImports: Record<string, () => Promise<any>> = {
  "platform-home": () => import("@/pages/platform-home"),
  "floor-plan": () => import("@/pages/floor-plan"),
  "hr-hub": () => import("@/pages/hr-hub"),
  "my-portal": () => import("@/pages/my-portal"),
  "hr/employee-documents": () => import("@/pages/hr/employee-documents"),
  "hr/leaves": () => import("@/pages/hr/leaves"),
  "hr/warnings": () => import("@/pages/hr/warnings"),
  "hr/advances": () => import("@/pages/hr/advances"),
  "hr/cashier-deficits": () => import("@/pages/hr/cashier-deficits"),
  "hr/eos": () => import("@/pages/hr/eos"),
  "hr/evaluations": () => import("@/pages/hr/evaluations"),
  "dashboard": () => import("@/pages/dashboard"),
  "inventory": () => import("@/pages/inventory"),
  "manage": () => import("@/pages/manage"),
  "branches": () => import("@/pages/branches"),
  "maintenance": () => import("@/pages/maintenance"),
  "inspections": () => import("@/pages/inspections"),
  "users": () => import("@/pages/users"),
  "user-permissions": () => import("@/pages/user-permissions"),
  "construction-projects": () => import("@/pages/construction-projects"),
  "field-hub": () => import("@/pages/field-hub"),
  "field-checklist-templates": () => import("@/pages/field-checklist-templates"),
  "field-checklist-detail": () => import("@/pages/field-checklist-detail"),
  "construction-project-detail": () => import("@/pages/construction-project-detail"),
  "contractors": () => import("@/pages/contractors"),
  "reports": () => import("@/pages/reports"),
  "construction-dashboard": () => import("@/pages/construction-dashboard"),
  "construction-reports": () => import("@/pages/construction-reports"),
  "contracts": () => import("@/pages/contracts"),
  "contract-detail": () => import("@/pages/contract-detail"),
  "payment-requests": () => import("@/pages/payment-requests"),
  "contractor-statements": () => import("@/pages/contractor-statements"),
  "contractor-statement-detail": () => import("@/pages/contractor-statement-detail"),
  "contractor-oversight": () => import("@/pages/contractor-oversight"),
  "contract-templates": () => import("@/pages/contract-templates"),
  "notifications-center": () => import("@/pages/notifications-center"),
  "daily-logs-list": () => import("@/pages/daily-logs-list"),
  "daily-work-log": () => import("@/pages/daily-work-log"),
  "daily-log-print": () => import("@/pages/daily-log-print"),
  "budget-planning": () => import("@/pages/budget-planning"),
  "asset-transfers": () => import("@/pages/asset-transfers"),
  "audit-logs": () => import("@/pages/audit-logs"),
  "backups": () => import("@/pages/backups"),
  "integrations": () => import("@/pages/integrations"),
  "operations-dashboard": () => import("@/pages/operations-dashboard"),
  "branch-shifts": () => import("@/pages/operations/branch-shifts"),
  "shift-reports": () => import("@/pages/operations/shift-reports"),
  "operations-reports-dashboard": () => import("@/pages/operations-reports-dashboard"),
  "products": () => import("@/pages/products"),
  "production": () => import("@/pages/production"),
  "quality-control": () => import("@/pages/quality-control"),
  "cashier-journals": () => import("@/pages/cashier-journals"),
  "cashier-journal-form": () => import("@/pages/cashier-journal-form"),
  "branch-daily-closing": () => import("@/pages/branch-daily-closing"),
  "branch-daily-closures": () => import("@/pages/branch-daily-closures"),
  "branch-daily-closure-detail": () => import("@/pages/branch-daily-closure-detail"),
  "operations-employees": () => import("@/pages/operations-employees"),
  "targets-planning": () => import("@/pages/targets-planning"),
  "targets-dashboard": () => import("@/pages/targets-dashboard"),
  "incentives-management": () => import("@/pages/incentives-management"),
  "sales-analytics": () => import("@/pages/sales-analytics"),
  "display-bar-waste": () => import("@/pages/display-bar-waste"),
  "advanced-production-orders": () => import("@/pages/advanced-production-orders"),
  "advanced-production-order-form": () => import("@/pages/advanced-production-order-form"),
  "advanced-production-order-details": () => import("@/pages/advanced-production-order-details"),
  "sales-data-uploads": () => import("@/pages/sales-data-uploads"),
  "event-pos": () => import("@/pages/event-pos"),
  "event-pos-settings": () => import("@/pages/event-pos-settings"),
  "event-reports": () => import("@/pages/event-reports"),
  "production-dashboard": () => import("@/pages/production-dashboard"),
  "daily-production": () => import("@/pages/daily-production"),
  "production-reports": () => import("@/pages/production-reports"),
  "rbac-management": () => import("@/pages/rbac-management"),
  "cashier-shift-performance": () => import("@/pages/cashier-shift-performance"),
  "marketing-campaigns": () => import("@/pages/marketing-campaigns"),
  "marketing-influencers": () => import("@/pages/marketing-influencers"),
  "influencer-contracts": () => import("@/pages/influencer-contracts"),
  "marketing-dashboard": () => import("@/pages/marketing-dashboard"),
  "marketing-calendar": () => import("@/pages/marketing-calendar"),
  "marketing-tasks": () => import("@/pages/marketing-tasks"),
  "marketing-reports": () => import("@/pages/marketing-reports"),
  "marketing-team": () => import("@/pages/marketing-team"),
  "marketing-goals": () => import("@/pages/marketing-goals"),
  "marketing-assets": () => import("@/pages/marketing-assets"),
  "marketing-alerts": () => import("@/pages/marketing-alerts"),
  "marketing-expenses": () => import("@/pages/marketing-expenses"),
  "loyalty-campaigns": () => import("@/pages/loyalty-campaigns"),
  "loyalty-card": () => import("@/pages/loyalty-card"),
  "campaign-join": () => import("@/pages/campaign-join"),
  "terminated-employees": () => import("@/pages/terminated-employees"),
  "marketing-social": () => import("@/pages/marketing-social"),
  "marketing-opening-campaigns": () => import("@/pages/marketing-opening-campaigns"),
  "marketing-media-team": () => import("@/pages/marketing-media-team"),
  "opening-public": () => import("@/pages/opening-public"),
  "social-responsibility": () => import("@/pages/marketing/social-responsibility"),
  "settings-dashboard": () => import("@/pages/settings-dashboard"),
  "biometric-settings": () => import("@/pages/biometric-settings"),
  "portal-settings": () => import("@/pages/portal-settings"),
  "approval-settings": () => import("@/pages/approval-settings"),
  "notifications-management": () => import("@/pages/notifications-management"),
  "shift-management": () => import("@/pages/shift-management"),
  "attendance-check": () => import("@/pages/attendance-check"),
  "employee-attendance-report": () => import("@/pages/employee-attendance-report"),
  "timesheet": () => import("@/pages/timesheet"),
  "attendance-dashboard": () => import("@/pages/attendance-dashboard"),
  "branch-employees": () => import("@/pages/branch-employees"),
  "organizational-structure": () => import("@/pages/organizational-structure"),
  "employee-reports-dashboard": () => import("@/pages/employee-reports-dashboard"),
  "salary-closing": () => import("@/pages/salary-closing"),
  "pnl-dashboard": () => import("@/pages/pnl-dashboard"),
  "pnl-rent-history": () => import("@/pages/pnl-rent-history"),
  "pnl-recurring-expenses": () => import("@/pages/pnl-recurring-expenses"),
  "security-management": () => import("@/pages/security-management"),
  "production-comparisons": () => import("@/pages/production-comparisons"),
  "production-comparison-reports": () => import("@/pages/production-comparison-reports"),
  "product-category-management": () => import("@/pages/product-category-management"),
  "finished-goods-inventory": () => import("@/pages/finished-goods-inventory"),
  "warehouse-dashboard": () => import("@/pages/warehouse-dashboard"),
  "transfer-requests": () => import("@/pages/transfer-requests"),
  "warehouse-inventory": () => import("@/pages/warehouse-inventory"),
  "warehouse-movement-logs": () => import("@/pages/warehouse-movement-logs"),
  "branch-stock": () => import("@/pages/branch-stock"),
  "warehouse-reports": () => import("@/pages/warehouse-reports"),
  "purchasing-requests": () => import("@/pages/purchasing-requests"),
  "executive-dashboard": () => import("@/pages/executive-dashboard"),
  "executive-meetings": () => import("@/pages/executive-meetings"),
  "executive-tasks": () => import("@/pages/executive-tasks"),
  "executive-correspondence": () => import("@/pages/executive-correspondence"),
  "executive-org-structure": () => import("@/pages/executive-org-structure"),
  "documents": () => import("@/pages/documents"),
  "shared-document": () => import("@/pages/shared-document"),
  "discount-card": () => import("@/pages/discount-card"),
  "rsvp-page": () => import("@/pages/rsvp-page"),
  "revote": () => import("@/pages/revote"),
  "governance": () => import("@/pages/governance"),
  "governance-board-members": () => import("@/pages/governance/board-members"),
  "governance-shareholders": () => import("@/pages/governance/shareholders"),
  "governance-investor-portal": () => import("@/pages/governance/investor-portal"),
  "shareholder-portal": () => import("@/pages/shareholder-portal"),
  "governance-meetings": () => import("@/pages/governance/meetings"),
  "governance-assembly-minutes": () => import("@/pages/governance/assembly-minutes"),
  "governance-resolutions": () => import("@/pages/governance/resolutions"),
  "governance-compliance": () => import("@/pages/governance/compliance"),
  "governance-financial-statements": () => import("@/pages/governance/financial-statements"),
  "governance-share-transfers": () => import("@/pages/governance/share-transfers"),
  "governance-disclosures": () => import("@/pages/governance/disclosures"),
  "governance-dividends": () => import("@/pages/governance/dividends"),
  "governance-capital": () => import("@/pages/governance/capital"),
  "governance-voting": () => import("@/pages/governance/voting"),
  "governance-general-assembly": () => import("@/pages/governance/general-assembly"),
  "governance-assembly-resolutions": () => import("@/pages/governance/assembly-resolutions"),
  "governance-signed-resolutions": () => import("@/pages/governance/signed-resolutions"),
  "governance-insiders": () => import("@/pages/governance/insiders"),
  "governance-blackout-periods": () => import("@/pages/governance/blackout-periods"),
  "governance-audit-committee": () => import("@/pages/governance/audit-committee"),
  "governance-prospectus": () => import("@/pages/governance/prospectus"),
  "governance-investor-relations": () => import("@/pages/governance/investor-relations"),
  "governance-material-disclosures": () => import("@/pages/governance/material-disclosures"),
  "governance-internal-audit": () => import("@/pages/governance/internal-audit"),
  "security": () => import("@/pages/security"),
  "visitors": () => import("@/pages/visitors"),
  "travel-requests": () => import("@/pages/travel-requests"),
  "executive-reports": () => import("@/pages/executive-reports"),
  "executive-calendar": () => import("@/pages/executive-calendar"),
  "company-templates": () => import("@/pages/company-templates"),
  "job-offers": () => import("@/pages/job-offers"),
  "job-offer-public": () => import("@/pages/job-offer-public"),
  "welcome": () => import("@/pages/welcome"),
  "onboarding": () => import("@/pages/onboarding"),
  "onboarding-public": () => import("@/pages/onboarding-public"),
  "warning-public": () => import("@/pages/warning-public"),
  "employment-applications": () => import("@/pages/employment-applications"),
  "employment-application-public": () => import("@/pages/employment-application-public"),
  "vacancy-public": () => import("@/pages/vacancy-public"),
  "public-greeting": () => import("@/pages/public-greeting"),
  "invitation": () => import("@/pages/invitation"),
};

const preloadedChunks = new Set<string>();

export function preloadPage(pageKey: string) {
  if (preloadedChunks.has(pageKey)) return;
  const loader = pageImports[pageKey];
  if (loader) {
    preloadedChunks.add(pageKey);
    preloadAndCache(pageKey);
  }
}

const PRIORITY_WAVE_1 = [
  "platform-home", "dashboard", "cashier-journals", "operations-dashboard",
];
const PRIORITY_WAVE_2 = [
  "branch-employees", "sales-analytics", "products",
  "branch-daily-closures", "targets-dashboard",
];

let preloadStarted = false;

function isLowEndDevice(): boolean {
  const nav = navigator as any;
  if (nav.connection) {
    if (nav.connection.saveData) return true;
    const ect = nav.connection.effectiveType;
    if (ect === 'slow-2g' || ect === '2g' || ect === '3g') return true;
  }
  if (nav.deviceMemory && nav.deviceMemory < 4) return true;
  return false;
}

function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (window.innerWidth < 768);
}

export function startAggressivePreload() {
  if (preloadStarted) return;
  preloadStarted = true;

  const lowEnd = isLowEndDevice();
  const mobile = isMobileDevice();
  const idle = (window as any).requestIdleCallback || ((cb: Function) => setTimeout(cb, 500));

  idle(() => {
    // Wave 1: truly first-impression pages — preload immediately
    PRIORITY_WAVE_1.forEach(p => preloadPage(p));

    // Only skip secondary preloading on very slow networks / low-end devices.
    // Modern mobile devices on 4G/5G handle Wave 2 fine — the previous "skip
    // on any mobile" rule was overly conservative and forced an avoidable
    // chunk-fetch delay on every mobile navigation.
    if (lowEnd) return;

    // Wave 2 after a brief delay so it never competes with first-paint work.
    // Reduced from 2500ms → 600ms so popular secondary pages are ready by the
    // time the user finishes scanning the landing screen.
    const wave2Delay = mobile ? 1500 : 600;
    setTimeout(() => {
      idle(() => {
        PRIORITY_WAVE_2.forEach(p => preloadPage(p));
      });
    }, wave2Delay);
  });
}

const ADJACENT_PAGES: Record<string, string[]> = {
  "/": ["dashboard", "cashier-journals", "operations-dashboard"],
  "/dashboard": ["inventory", "manage", "reports"],
  "/cashier-journals": ["cashier-journal-form", "branch-daily-closures", "sales-analytics"],
  "/operations": ["products", "quality-control", "branch-shifts", "operations-reports-dashboard"],
  "/branch-employees": ["shift-management", "attendance-check", "timesheet", "employee-reports-dashboard"],
  "/production-dashboard": ["daily-production", "advanced-production-orders", "production-reports"],
  "/marketing": ["marketing-campaigns", "marketing-influencers", "marketing-calendar"],
  "/warehouse": ["transfer-requests", "warehouse-inventory", "branch-stock"],
  "/executive": ["executive-meetings", "executive-tasks", "executive-correspondence"],
  "/settings": ["security-management", "rbac-management", "users"],
  "/sales-analytics": ["cashier-journals", "targets-dashboard", "pnl-dashboard"],
  "/event-pos": ["event-pos-settings"],
  "/construction-projects": ["contractors", "contracts"],
  "/governance": ["governance-board-members", "governance-shareholders"],
};

export function prefetchAdjacentPages(currentRoute: string) {
  const adjacent = ADJACENT_PAGES[currentRoute];
  if (adjacent) {
    adjacent.forEach(p => preloadPage(p));
  }
}

const ROUTE_TO_PAGE: Record<string, string> = {
  "/": "platform-home",
  "/dashboard": "dashboard",
  "/inventory": "inventory",
  "/manage": "manage",
  "/branches": "branches",
  "/maintenance": "maintenance",
  "/inspections": "inspections",
  "/users": "users",
  "/construction-projects": "construction-projects",
  "/contractors": "contractors",
  "/reports": "reports",
  "/construction-reports": "construction-reports",
  "/contracts": "contracts",
  "/payment-requests": "payment-requests",
  "/budget-planning": "budget-planning",
  "/asset-transfers": "asset-transfers",
  "/audit-logs": "audit-logs",
  "/backups": "backups",
  "/integrations": "integrations",
  "/operations": "operations-dashboard",
  "/branch-shifts": "branch-shifts",
  "/shift-reports": "shift-reports",
  "/operations-reports": "operations-reports-dashboard",
  "/products": "products",
  "/production": "production",
  "/quality-control": "quality-control",
  "/cashier-journals": "cashier-journals",
  "/branch-daily-closures": "branch-daily-closures",
  "/branch-daily-closing": "branch-daily-closing",
  "/operations-employees": "operations-employees",
  "/targets-planning": "targets-planning",
  "/targets-dashboard": "targets-dashboard",
  "/incentives-management": "incentives-management",
  "/sales-analytics": "sales-analytics",
  "/display-bar-waste": "display-bar-waste",
  "/advanced-production-orders": "advanced-production-orders",
  "/sales-data-uploads": "sales-data-uploads",
  "/event-pos": "event-pos",
  "/event-pos-settings": "event-pos-settings",
  "/event-reports": "event-reports",
  "/production-dashboard": "production-dashboard",
  "/daily-production": "daily-production",
  "/production-reports": "production-reports",
  "/rbac-management": "rbac-management",
  "/cashier-shift-performance": "cashier-shift-performance",
  "/marketing": "marketing-dashboard",
  "/marketing-campaigns": "marketing-campaigns",
  "/marketing-influencers": "marketing-influencers",
  "/influencer-contracts": "influencer-contracts",
  "/marketing-calendar": "marketing-calendar",
  "/marketing-tasks": "marketing-tasks",
  "/marketing-reports": "marketing-reports",
  "/marketing-team": "marketing-team",
  "/marketing-goals": "marketing-goals",
  "/marketing-assets": "marketing-assets",
  "/marketing-alerts": "marketing-alerts",
  "/marketing-expenses": "marketing-expenses",
  "/marketing-social": "marketing-social",
  "/marketing-opening-campaigns": "marketing-opening-campaigns",
  "/marketing-media-team": "marketing-media-team",
  "/social-responsibility": "social-responsibility",
  "/settings": "settings-dashboard",
  "/security-management": "security-management",
  "/notifications-management": "notifications-management",
  "/biometric-settings": "biometric-settings",
  "/approval-settings": "approval-settings",
  "/shift-management": "shift-management",
  "/attendance-check": "attendance-check",
  "/timesheet": "timesheet",
  "/attendance-dashboard": "attendance-dashboard",
  "/branch-employees": "branch-employees",
  "/organizational-structure": "organizational-structure",
  "/employee-reports": "employee-reports-dashboard",
  "/salary-closing": "salary-closing",
  "/pnl-dashboard": "pnl-dashboard",
  "/pnl-rent-history": "pnl-rent-history",
  "/pnl-recurring-expenses": "pnl-recurring-expenses",
  "/production-comparisons": "production-comparisons",
  "/production-comparison-reports": "production-comparison-reports",
  "/product-category-management": "product-category-management",
  "/finished-goods-inventory": "finished-goods-inventory",
  "/warehouse": "warehouse-dashboard",
  "/warehouse-dashboard": "warehouse-dashboard",
  "/transfer-requests": "transfer-requests",
  "/warehouse-inventory": "warehouse-inventory",
  "/warehouse-movement-logs": "warehouse-movement-logs",
  "/branch-stock": "branch-stock",
  "/warehouse-reports": "warehouse-reports",
  "/purchasing-requests": "purchasing-requests",
  "/executive": "executive-dashboard",
  "/executive/meetings": "executive-meetings",
  "/executive/tasks": "executive-tasks",
  "/executive/correspondence": "executive-correspondence",
  "/executive/reports": "executive-reports",
  "/executive/calendar": "executive-calendar",
  "/executive/templates": "company-templates",
  "/hr/job-offers": "job-offers",
  "/hr/onboarding": "onboarding",
  "/hr/evaluations": "hr/evaluations",
  "/hr-cashier-deficits": "hr/cashier-deficits",
  "/executive/org-structure": "executive-org-structure",
  "/documents": "documents",
  "/governance": "governance",
  "/governance/board": "governance-board-members",
  "/governance/shareholders": "governance-shareholders",
  "/governance/investor-portal": "governance-investor-portal",
  "/shareholder-portal": "shareholder-portal",
  "/governance/meetings": "governance-meetings",
  "/governance/assembly-minutes": "governance-assembly-minutes",
  "/governance/resolutions": "governance-resolutions",
  "/governance/compliance": "governance-compliance",
  "/governance/transfers": "governance-share-transfers",
  "/governance/disclosures": "governance-disclosures",
  "/governance/dividends": "governance-dividends",
  "/governance/capital": "governance-capital",
  "/governance/voting": "governance-voting",
  "/governance/general-assembly": "governance-general-assembly",
  "/governance/assembly-resolutions": "governance-assembly-resolutions",
  "/governance/signed-resolutions": "governance-signed-resolutions",
  "/governance/insiders": "governance-insiders",
  "/governance/blackout-periods": "governance-blackout-periods",
  "/governance/audit-committee": "governance-audit-committee",
  "/governance/prospectus": "governance-prospectus",
  "/governance/investor-relations": "governance-investor-relations",
  "/governance/material-disclosures": "governance-material-disclosures",
  "/governance/internal-audit": "governance-internal-audit",
  "/security": "security",
  "/visitors": "visitors",
  "/travel-requests": "travel-requests",
};

export function preloadRoute(href: string) {
  const pageKey = ROUTE_TO_PAGE[href];
  if (pageKey) preloadPage(pageKey);
}

const resolvedModules = new Map<string, any>();

function isChunkLoadError(err: any): boolean {
  if (!err) return false;
  const msg = err?.message || '';
  return (
    err?.name === 'ChunkLoadError' ||
    msg.includes('dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Failed to fetch') ||
    msg.includes('error loading dynamically imported')
  );
}

export function preloadAndCache(key: string): Promise<any> {
  const existing = resolvedModules.get(key);
  if (existing) return Promise.resolve(existing);
  const loader = pageImports[key];
  if (!loader) return Promise.reject(new Error(`Unknown page: ${key}`));
  return loader().then(mod => {
    resolvedModules.set(key, mod);
    return mod;
  }).catch(err => {
    if (isChunkLoadError(err)) {
      const reloadCount = parseInt(sessionStorage.getItem('__chunk_reload_count') || '0', 10) || 0;
      const lastReloadAt = parseInt(sessionStorage.getItem('__chunk_reload_at') || '0', 10);
      const effectiveCount = (Date.now() - lastReloadAt > 60_000) ? 0 : reloadCount;
      if (effectiveCount < 1) {
        sessionStorage.setItem('__chunk_reload_count', String(effectiveCount + 1));
        sessionStorage.setItem('__chunk_reload_at', String(Date.now()));
        window.location.reload();
        return new Promise(() => {});
      }
      // Loop guard hit — let the ErrorBoundary render the recovery UI
    }
    throw err;
  });
}

export function makeLazy(key: string) {
  return React.lazy(() => preloadAndCache(key));
}

import React from "react";
