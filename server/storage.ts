import memoize from "memoizee";

// Helper function to get Saudi Arabia time (UTC+3)
function getSaudiArabiaTime(): { date: string; time: string; timeShort: string } {
  const now = new Date();
  // Format date and time components directly in Saudi Arabia timezone
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const date = formatter.format(now); // Returns YYYY-MM-DD format
  const timeParts = timeFormatter.format(now).split(':');
  const hours = timeParts[0];
  const minutes = timeParts[1];
  const seconds = timeParts[2];
  
  return {
    date,
    time: `${hours}:${minutes}:${seconds}`,
    timeShort: `${hours}:${minutes}`
  };
}
import { 
  type Branch, 
  type InsertBranch,
  type InventoryItem,
  type InsertInventoryItem,
  type AuditLog,
  type InsertAuditLog,
  type SystemAuditLog,
  type InsertSystemAuditLog,
  type Backup,
  type InsertBackup,
  type SavedFilter,
  type InsertSavedFilter,
  type User,
  type UpsertUser,
  type InsertUser,
  type Department,
  type InsertDepartment,
  type Role,
  type InsertRole,
  type Permission,
  type InsertPermission,
  type RolePermission,
  type InsertRolePermission,
  type UserAssignment,
  type InsertUserAssignment,
  type UserPermissionOverride,
  type InsertUserPermissionOverride,
  type UserBranchAccess,
  type InsertUserBranchAccess,
  type ConstructionCategory,
  type InsertConstructionCategory,
  type Contractor,
  type InsertContractor,
  type ConstructionProject,
  type InsertConstructionProject,
  type ProjectWorkItem,
  type InsertProjectWorkItem,
  type ProjectBudgetAllocation,
  type InsertProjectBudgetAllocation,
  type ConstructionContract,
  type InsertConstructionContract,
  type ContractItem,
  type InsertContractItem,
  type PaymentRequest,
  type InsertPaymentRequest,
  type ContractPayment,
  type InsertContractPayment,
  type ProjectExpense,
  type InsertProjectExpense,
  type ProjectDailyLog,
  type InsertProjectDailyLog,
  type ProjectDailyLogPhoto,
  type InsertProjectDailyLogPhoto,
  type UserPermission,
  type InsertUserPermission,
  type PermissionAuditLog,
  type InsertPermissionAuditLog,
  type AssetTransfer,
  type InsertAssetTransfer,
  type AssetTransferEvent,
  type InsertAssetTransferEvent,
  type ExternalIntegration,
  type InsertExternalIntegration,
  type NotificationTemplate,
  type InsertNotificationTemplate,
  type NotificationQueueItem,
  type InsertNotificationQueueItem,
  type DataImportJob,
  type InsertDataImportJob,
  type AccountingExport,
  type InsertAccountingExport,
  type Product,
  type InsertProduct,
  type Shift,
  type InsertShift,
  type ShiftEmployee,
  type InsertShiftEmployee,
  type ProductionOrder,
  type InsertProductionOrder,
  type QualityCheck,
  type InsertQualityCheck,
  type DailyOperationsSummary,
  type InsertDailyOperationsSummary,
  type CashierSalesJournal,
  type InsertCashierSalesJournal,
  type CashierPaymentBreakdown,
  type InsertCashierPaymentBreakdown,
  type CashierSignature,
  type InsertCashierSignature,
  type TargetWeightProfile,
  type InsertTargetWeightProfile,
  type BranchMonthlyTarget,
  type InsertBranchMonthlyTarget,
  type TargetDailyAllocation,
  type InsertTargetDailyAllocation,
  type TargetShiftAllocation,
  type InsertTargetShiftAllocation,
  type IncentiveTier,
  type InsertIncentiveTier,
  type IncentiveAward,
  type InsertIncentiveAward,
  type SeasonHoliday,
  type InsertSeasonHoliday,
  type CommissionRate,
  type BranchDailySales,
  type InsertBranchDailySales,
  type CashierShiftPerformance,
  type InsertCashierShiftPerformance,
  type InsertCommissionRate,
  type CommissionCalculation,
  type InsertCommissionCalculation,
  type DisplayBarReceipt,
  type InsertDisplayBarReceipt,
  type DisplayBarDailySummary,
  type InsertDisplayBarDailySummary,
  type WasteReport,
  type InsertWasteReport,
  type WasteItem,
  type InsertWasteItem,
  type AdvancedProductionOrder,
  type InsertAdvancedProductionOrder,
  type ProductionOrderItem,
  type InsertProductionOrderItem,
  type ProductionOrderSchedule,
  type InsertProductionOrderSchedule,
  type ProductionAiPlan,
  type InsertProductionAiPlan,
  type SalesDataUpload,
  type InsertSalesDataUpload,
  type ProductSalesAnalytics,
  type InsertProductSalesAnalytics,
  type DailyProductionBatch,
  type InsertDailyProductionBatch,
  type CashierShiftTarget,
  type InsertCashierShiftTarget,
  type AverageTicketTarget,
  type InsertAverageTicketTarget,
  type PerformanceAlert,
  type InsertPerformanceAlert,
  type ShiftPerformanceTracking,
  type InsertShiftPerformanceTracking,
  type MarketingCampaign,
  type InsertMarketingCampaign,
  type CampaignBudgetAllocation,
  type InsertCampaignBudgetAllocation,
  type CampaignGoal,
  type InsertCampaignGoal,
  type CampaignExpense,
  type InsertCampaignExpense,
  type MarketingCalendarEvent,
  type InsertMarketingCalendarEvent,
  type MarketingInfluencer,
  type InsertMarketingInfluencer,
  type InfluencerCampaignLink,
  type InsertInfluencerCampaignLink,
  type InfluencerContact,
  type InsertInfluencerContact,
  type InfluencerPayment,
  type InsertInfluencerPayment,
  type InfluencerContract,
  type InsertInfluencerContract,
  type MarketingTask,
  type InsertMarketingTask,
  type MarketingTaskActivity,
  type InsertMarketingTaskActivity,
  type MarketingPerformanceReport,
  type InsertMarketingPerformanceReport,
  type MarketingAsset,
  type InsertMarketingAsset,
  type MarketingTeamMember,
  type InsertMarketingTeamMember,
  type MarketingAlert,
  type InsertMarketingAlert,
  branches,
  inventoryItems,
  auditLogs,
  systemAuditLogs,
  backups,
  savedFilters,
  users,
  constructionCategories,
  contractors,
  constructionProjects,
  projectWorkItems,
  projectBudgetAllocations,
  constructionContracts,
  contractItems,
  paymentRequests,
  contractPayments,
  projectExpenses,
  projectDailyLogs,
  projectDailyLogPhotos,
  userPermissions,
  permissionAuditLogs,
  assetTransfers,
  assetTransferEvents,
  externalIntegrations,
  notificationTemplates,
  notificationQueue,
  dataImportJobs,
  accountingExports,
  products,
  shifts,
  shiftEmployees,
  productionOrders,
  qualityChecks,
  dailyOperationsSummary,
  cashierSalesJournals,
  cashierPaymentBreakdowns,
  cashierSignatures,
  journalAttachments,
  type JournalAttachment,
  type InsertJournalAttachment,
  JOB_ROLE_PERMISSION_TEMPLATES,
  targetWeightProfiles,
  branchMonthlyTargets,
  targetDailyAllocations,
  targetShiftAllocations,
  incentiveTiers,
  incentiveAwards,
  seasonsHolidays,
  commissionRates,
  commissionCalculations,
  branchDailySales,
  cashierShiftPerformance,
  displayBarReceipts,
  displayBarDailySummary,
  wasteReports,
  wasteItems,
  advancedProductionOrders,
  productionOrderItems,
  productionOrderSchedules,
  productionAiPlans,
  salesDataUploads,
  productSalesAnalytics,
  dailyProductionBatches,
  departments,
  roles,
  permissions,
  rolePermissions,
  userAssignments,
  userPermissionOverrides,
  userBranchAccess,
  cashierShiftTargets,
  averageTicketTargets,
  performanceAlerts,
  shiftPerformanceTracking,
  marketingCampaigns,
  campaignBudgetAllocations,
  campaignGoals,
  campaignExpenses,
  marketingCalendarEvents,
  marketingInfluencers,
  influencerCampaignLinks,
  influencerContacts,
  influencerPayments,
  influencerContracts,
  marketingTasks,
  marketingTaskActivities,
  marketingPerformanceReports,
  marketingAssets,
  marketingTeamMembers,
  marketingAlerts,
  scheduleTemplates,
  schedulePeriods,
  employeeSchedules,
  attendanceRecords,
  timeEntries,
  attendanceSummary,
  type ScheduleTemplate,
  type InsertScheduleTemplate,
  type SchedulePeriod,
  type InsertSchedulePeriod,
  type EmployeeSchedule,
  type InsertEmployeeSchedule,
  type AttendanceRecord,
  type InsertAttendanceRecord,
  type TimeEntry,
  type InsertTimeEntry,
  type AttendanceSummary,
  type InsertAttendanceSummary,
  timesheetReports,
  timesheetReportEntries,
  type TimesheetReport,
  type InsertTimesheetReport,
  type TimesheetReportEntry,
  type InsertTimesheetReportEntry,
  branchEmployees,
  type BranchEmployee,
  type InsertBranchEmployee,
  branchShiftProfiles,
  type BranchShiftProfile,
  type InsertBranchShiftProfile,
  orgJobRoles,
  type OrgJobRole,
  type InsertOrgJobRole,
  employeeSettings,
  type EmployeeSetting,
  type InsertEmployeeSetting,
  employeeTransferRequests,
  transferApprovalSteps,
  transferHistory,
  type EmployeeTransferRequest,
  type InsertEmployeeTransferRequest,
  type TransferApprovalStep,
  type InsertTransferApprovalStep,
  financialPeriods,
  financialSales,
  financialCOGS,
  financialOperatingExpenses,
  financialFixedCosts,
  financialMetrics,
  type FinancialPeriod,
  type InsertFinancialPeriod,
  type FinancialSales,
  type InsertFinancialSales,
  type FinancialCOGS,
  type InsertFinancialCOGS,
  type FinancialOperatingExpense,
  type InsertFinancialOperatingExpense,
  type FinancialFixedCost,
  type InsertFinancialFixedCost,
  type FinancialMetrics,
  type InsertFinancialMetrics,
  userSecuritySettings,
  userSessions,
  securityViolationAlerts,
  permissionCheckLogs,
  roleTemplates,
  type UserSecuritySettings,
  type InsertUserSecuritySettings,
  type UserSession,
  type InsertUserSession,
  type SecurityViolationAlert,
  type InsertSecurityViolationAlert,
  type PermissionCheckLog,
  type InsertPermissionCheckLog,
  type RoleTemplate,
  type InsertRoleTemplate,
  socialAccounts,
  type SocialAccount,
  type InsertSocialAccount,
  socialPosts,
  type SocialPost,
  type InsertSocialPost,
  socialContentTemplates,
  type SocialContentTemplate,
  type InsertSocialContentTemplate,
  socialPostMetrics,
  type SocialPostMetric,
  type InsertSocialPostMetric,
  finishedGoodsInventory,
  type FinishedGoodsInventory,
  type InsertFinishedGoodsInventory,
  finishedGoodsTransfers,
  type FinishedGoodsTransfer,
  type InsertFinishedGoodsTransfer,
  productionInventoryLogs,
  type ProductionInventoryLog,
  type InsertProductionInventoryLog,
  warehouseItems,
  type WarehouseItem,
  type InsertWarehouseItem,
  branchStock,
  type BranchStock,
  type InsertBranchStock,
  materialTransfers,
  type MaterialTransfer,
  type InsertMaterialTransfer,
  materialTransferItems,
  type MaterialTransferItem,
  type InsertMaterialTransferItem,
  warehouseMovementLogs,
  type WarehouseMovementLog,
  type InsertWarehouseMovementLog,
  purchasingRequests,
  type PurchasingRequest,
  type InsertPurchasingRequest,
  purchasingRequestItems,
  type PurchasingRequestItem,
  type InsertPurchasingRequestItem,
  warehouseNotifications,
  type WarehouseNotification,
  type InsertWarehouseNotification,
  execMeetings,
  type ExecMeeting,
  type InsertExecMeeting,
  execMeetingAttendees,
  type ExecMeetingAttendee,
  type InsertExecMeetingAttendee,
  execTasks,
  type ExecTask,
  type InsertExecTask,
  execCorrespondence,
  type ExecCorrespondence,
  type InsertExecCorrespondence,
  execTaskComments,
  type ExecTaskComment,
  type InsertExecTaskComment,
  execNotifications,
  type ExecNotification,
  type InsertExecNotification,
  documentCategories,
  type DocumentCategory,
  type InsertDocumentCategory,
  documentFolders,
  type DocumentFolder,
  type InsertDocumentFolder,
  documents,
  type Document,
  type InsertDocument,
  documentVersions,
  type DocumentVersion,
  type InsertDocumentVersion,
  documentShares,
  type DocumentShare,
  type InsertDocumentShare,
  documentAccessLogs,
  visitors,
  type Visitor,
  type InsertVisitor,
  visitorLogs,
  type VisitorLog,
  type InsertVisitorLog,
  travelRequests,
  type TravelRequest,
  type InsertTravelRequest,
  travelExpenses,
  type TravelExpense,
  type InsertTravelExpense,
  notifications,
  type Notification,
  type InsertNotification,
  pnlBranchSettings,
  type PnlBranchSettings,
  type InsertPnlBranchSettings,
  pnlMonthlyInputs,
  type PnlMonthlyInputs,
  type InsertPnlMonthlyInputs,
  pointSettings,
  type PointSettings,
  type InsertPointSettings,
  cashierDailyChallenges,
  type CashierDailyChallenge,
  type InsertCashierDailyChallenge,
  productCommissions,
  type ProductCommission,
  type InsertProductCommission,
  branchAchievementBonus,
  type BranchAchievementBonus,
  type InsertBranchAchievementBonus,
  cashierPointsLedger,
  type CashierPointsLedger,
  type InsertCashierPointsLedger,
  cashierProductSales,
  type CashierProductSales,
  type InsertCashierProductSales,
  cashierIncentiveStatements,
  type CashierIncentiveStatement,
  type InsertCashierIncentiveStatement,
  biometricCredentials,
  type BiometricCredential,
  type InsertBiometricCredential,
  accountingJournalEntries,
  type AccountingJournalEntry,
  type InsertAccountingJournalEntry,
  journalEntryLines,
  type JournalEntryLine,
  type InsertJournalEntryLine,
  accountingReconciliations,
  type AccountingReconciliation,
  type InsertAccountingReconciliation,
  chartOfAccounts,
  type ChartOfAccount,
  type InsertChartOfAccount,
  systemNotifications,
  type SystemNotification,
  type InsertSystemNotification,
  notificationReads,
  type NotificationRead,
  branchProducts,
  type BranchProduct,
  type InsertBranchProduct,
  posInvoiceSettings,
  type PosInvoiceSettings,
  type InsertPosInvoiceSettings,
  posSales,
  type PosSale,
  type InsertPosSale,
  posSaleItems,
  type PosSaleItem,
  type InsertPosSaleItem,
  posHeldOrders,
  type PosHeldOrder,
  type InsertPosHeldOrder,
} from "@shared/schema";

type TransferHistory = typeof transferHistory.$inferSelect;
import { db, pool } from "./db";
import { eq, and, gte, lte, desc, or, inArray, sql, isNull, isNotNull, ilike } from "drizzle-orm";
import bcrypt from "bcrypt";

export type PermissionSource = 'direct' | 'role' | 'override_grant' | 'override_deny';

export interface PermissionWithSource {
  module: string;
  action: string;
  source: PermissionSource;
  roleName?: string;
  isActive: boolean;
  permissionId?: number;
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  getUsersByIds(ids: string[]): Promise<User[]>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;
  verifyPassword(username: string, password: string): Promise<User | null>;
  
  // Branches
  getAllBranches(): Promise<Branch[]>;
  getBranch(id: string): Promise<Branch | undefined>;
  createBranch(branch: InsertBranch): Promise<Branch>;
  
  // Inventory Items
  getAllInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItemsByBranch(branchId: string): Promise<InventoryItem[]>;
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem, userId?: string): Promise<InventoryItem>;
  updateInventoryItem(id: string, item: Partial<InsertInventoryItem>, userId?: string): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: string, userId?: string): Promise<boolean>;
  getItemsNeedingInspection(): Promise<InventoryItem[]>;
  
  // Audit Logs
  getAuditLogsForItem(itemId: string): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  
  // Saved Filters
  getAllSavedFilters(): Promise<SavedFilter[]>;
  getSavedFilter(id: number): Promise<SavedFilter | undefined>;
  createSavedFilter(filter: InsertSavedFilter): Promise<SavedFilter>;
  deleteSavedFilter(id: number): Promise<boolean>;

  // Construction Categories
  getAllConstructionCategories(): Promise<ConstructionCategory[]>;
  
  // Contractors
  getAllContractors(): Promise<Contractor[]>;
  getContractor(id: number): Promise<Contractor | undefined>;
  createContractor(contractor: InsertContractor): Promise<Contractor>;
  updateContractor(id: number, contractor: Partial<InsertContractor>): Promise<Contractor | undefined>;
  deleteContractor(id: number): Promise<boolean>;
  
  // Construction Projects
  getAllConstructionProjects(): Promise<ConstructionProject[]>;
  getConstructionProjectsByBranch(branchId: string): Promise<ConstructionProject[]>;
  getConstructionProject(id: number): Promise<ConstructionProject | undefined>;
  createConstructionProject(project: InsertConstructionProject): Promise<ConstructionProject>;
  updateConstructionProject(id: number, project: Partial<InsertConstructionProject>): Promise<ConstructionProject | undefined>;
  deleteConstructionProject(id: number): Promise<boolean>;
  
  // Project Work Items
  getAllWorkItems(): Promise<ProjectWorkItem[]>;
  getWorkItemsByProject(projectId: number): Promise<ProjectWorkItem[]>;
  getWorkItem(id: number): Promise<ProjectWorkItem | undefined>;
  createWorkItem(item: InsertProjectWorkItem): Promise<ProjectWorkItem>;
  updateWorkItem(id: number, item: Partial<InsertProjectWorkItem>): Promise<ProjectWorkItem | undefined>;
  deleteWorkItem(id: number): Promise<boolean>;
  
  // Project Budget Allocations
  getBudgetAllocationsByProject(projectId: number): Promise<ProjectBudgetAllocation[]>;
  getBudgetAllocation(id: number): Promise<ProjectBudgetAllocation | undefined>;
  createBudgetAllocation(allocation: InsertProjectBudgetAllocation): Promise<ProjectBudgetAllocation>;
  updateBudgetAllocation(id: number, allocation: Partial<InsertProjectBudgetAllocation>): Promise<ProjectBudgetAllocation | undefined>;
  deleteBudgetAllocation(id: number): Promise<boolean>;
  upsertBudgetAllocation(allocation: InsertProjectBudgetAllocation): Promise<ProjectBudgetAllocation>;
  getHistoricalCategoryAverages(): Promise<{ categoryId: number; categoryName: string; avgCost: number; projectCount: number; totalCost: number }[]>;
  
  // Construction Contracts
  getAllContracts(): Promise<ConstructionContract[]>;
  getContractsByProject(projectId: number): Promise<ConstructionContract[]>;
  getContract(id: number): Promise<ConstructionContract | undefined>;
  createContract(contract: InsertConstructionContract): Promise<ConstructionContract>;
  updateContract(id: number, contract: Partial<InsertConstructionContract>): Promise<ConstructionContract | undefined>;
  deleteContract(id: number): Promise<boolean>;
  
  // Contract Items
  getContractItems(contractId: number): Promise<ContractItem[]>;
  getContractItem(id: number): Promise<ContractItem | undefined>;
  createContractItem(item: InsertContractItem): Promise<ContractItem>;
  updateContractItem(id: number, item: Partial<InsertContractItem>): Promise<ContractItem | undefined>;
  deleteContractItem(id: number): Promise<boolean>;
  
  // Payment Requests
  getAllPaymentRequests(): Promise<PaymentRequest[]>;
  getPaymentRequestsByProject(projectId: number): Promise<PaymentRequest[]>;
  getPaymentRequestsByStatus(status: string): Promise<PaymentRequest[]>;
  getPaymentRequest(id: number): Promise<PaymentRequest | undefined>;
  createPaymentRequest(request: InsertPaymentRequest): Promise<PaymentRequest>;
  updatePaymentRequest(id: number, request: Partial<InsertPaymentRequest>): Promise<PaymentRequest | undefined>;
  deletePaymentRequest(id: number): Promise<boolean>;
  approvePaymentRequest(id: number, approvedBy: string): Promise<PaymentRequest | undefined>;
  rejectPaymentRequest(id: number, reason: string): Promise<PaymentRequest | undefined>;
  markPaymentRequestAsPaid(id: number): Promise<PaymentRequest | undefined>;
  
  // Contract Payments
  getContractPayments(contractId: number): Promise<ContractPayment[]>;
  createContractPayment(payment: InsertContractPayment): Promise<ContractPayment>;

  // Project Expenses
  getAllProjectExpenses(branchIds?: string[] | null): Promise<ProjectExpense[]>;
  getProjectExpensesByProject(projectId: number): Promise<ProjectExpense[]>;
  getProjectExpensesByContractor(contractorId: number, branchIds?: string[] | null): Promise<ProjectExpense[]>;
  getProjectExpense(id: number): Promise<ProjectExpense | undefined>;
  createProjectExpense(expense: InsertProjectExpense): Promise<ProjectExpense>;
  updateProjectExpense(id: number, expense: Partial<InsertProjectExpense>): Promise<ProjectExpense | undefined>;
  deleteProjectExpense(id: number): Promise<boolean>;

  // Contractor Statements (aggregated)
  getContractorStatement(contractorId: number, opts?: { from?: string; to?: string; projectId?: number; branchIds?: string[] | null }): Promise<{
    contractor: Contractor | undefined;
    totals: {
      contractsTotal: number;
      contractPaymentsTotal: number;
      paymentRequestsPaidTotal: number;
      paymentRequestsPendingTotal: number;
      directExpensesTotal: number;
      totalPaid: number;
      balance: number;
    };
    contracts: ConstructionContract[];
    transactions: Array<{
      id: string;
      date: string;
      type: string; // contract_payment | payment_request | expense
      projectId: number | null;
      projectTitle?: string | null;
      contractId?: number | null;
      contractTitle?: string | null;
      description: string;
      amount: number;
      status?: string;
      reference?: string | null;
    }>;
  }>;
  getContractorsStatementsSummary(branchIds?: string[] | null): Promise<Array<{
    contractor: Contractor;
    contractsCount: number;
    contractsTotal: number;
    totalPaid: number;
    balance: number;
  }>>;

  // Project Daily Logs
  getDailyLogsByProject(projectId: number, opts?: { from?: string; to?: string }): Promise<ProjectDailyLog[]>;
  getAllDailyLogs(opts?: { from?: string; to?: string; branchIds?: string[] | null; contractorId?: number }): Promise<ProjectDailyLog[]>;
  getDailyLog(id: number): Promise<ProjectDailyLog | undefined>;
  createDailyLog(log: InsertProjectDailyLog): Promise<ProjectDailyLog>;
  updateDailyLog(id: number, log: Partial<InsertProjectDailyLog>): Promise<ProjectDailyLog | undefined>;
  deleteDailyLog(id: number): Promise<boolean>;

  // Daily Log Photos
  getDailyLogPhotos(dailyLogId: number): Promise<ProjectDailyLogPhoto[]>;
  getDailyLogPhoto(id: number): Promise<ProjectDailyLogPhoto | undefined>;
  createDailyLogPhoto(photo: InsertProjectDailyLogPhoto): Promise<ProjectDailyLogPhoto>;
  deleteDailyLogPhoto(id: number): Promise<boolean>;

  // User Permissions
  getUserPermissions(userId: string): Promise<UserPermission[]>;
  getUserPermissionsWithSources(userId: string): Promise<PermissionWithSource[]>;
  getInheritedPermissions(userId: string): Promise<{ module: string; action: string; permissionId: number }[]>;
  setUserPermission(permission: InsertUserPermission): Promise<UserPermission>;
  deleteUserPermissions(userId: string): Promise<boolean>;
  hasPermission(userId: string, module: string, action: string): Promise<boolean>;
  setPermissionOverride(userId: string, permissionId: number, allow: boolean, changedByUserId: string, reason?: string): Promise<void>;
  removePermissionOverride(userId: string, permissionId: number): Promise<void>;
  removeDenyOverride(userId: string, permissionId: number): Promise<void>;
  removeAllPermissionOverrides(userId: string): Promise<void>;
  
  // Permission Audit Logs
  createPermissionAuditLog(log: InsertPermissionAuditLog): Promise<PermissionAuditLog>;
  getPermissionAuditLogs(targetUserId?: string): Promise<PermissionAuditLog[]>;
  
  // Transactional permission update
  updateUserPermissionsWithAudit(
    userId: string,
    permissionsList: { module: string; actions: string[] }[],
    changedByUserId: string,
    templateApplied: string | null,
    inheritedOverrides?: { permissionId: number; deny: boolean }[]
  ): Promise<UserPermission[]>;
  
  // Apply job role permissions to user
  applyJobRolePermissions(
    userId: string,
    jobTitle: string,
    changedByUserId: string
  ): Promise<UserPermission[]>;
  
  // Asset Transfers
  getAllAssetTransfers(): Promise<AssetTransfer[]>;
  getAssetTransfer(id: number): Promise<AssetTransfer | undefined>;
  getAssetTransfersByItem(itemId: string): Promise<AssetTransfer[]>;
  createAssetTransfer(transfer: InsertAssetTransfer, userId: string): Promise<AssetTransfer>;
  approveAssetTransfer(id: number, userId: string): Promise<AssetTransfer | undefined>;
  confirmAssetTransfer(id: number, userId: string, receiverName: string, signature?: string): Promise<AssetTransfer | undefined>;
  cancelAssetTransfer(id: number, userId: string, reason?: string): Promise<AssetTransfer | undefined>;
  getAssetTransferEvents(transferId: number): Promise<AssetTransferEvent[]>;
  
  // System Audit Logs
  getAllSystemAuditLogs(limit?: number): Promise<SystemAuditLog[]>;
  getSystemAuditLogsByModule(module: string): Promise<SystemAuditLog[]>;
  getSystemAuditLogsByUser(userId: string): Promise<SystemAuditLog[]>;
  createSystemAuditLog(log: InsertSystemAuditLog): Promise<SystemAuditLog>;
  searchSystemAuditLogs(query: string): Promise<SystemAuditLog[]>;
  
  // Backups
  getAllBackups(): Promise<Backup[]>;
  getBackup(id: number): Promise<Backup | undefined>;
  createBackup(backup: InsertBackup): Promise<Backup>;
  updateBackup(id: number, backup: Partial<InsertBackup>): Promise<Backup | undefined>;
  deleteBackup(id: number): Promise<boolean>;
  
  // Global Search
  // Biometric Credentials
  getBiometricCredentials(employeeId: string): Promise<BiometricCredential[]>;
  getBiometricCredentialsByBranch(branchId: string): Promise<BiometricCredential[]>;
  getBiometricCredentialByCredentialId(credentialId: string): Promise<BiometricCredential | undefined>;
  createBiometricCredential(credential: InsertBiometricCredential): Promise<BiometricCredential>;
  deleteBiometricCredential(id: number): Promise<boolean>;
  updateBiometricCredentialCounter(id: number, counter: number): Promise<void>;

  globalSearch(query: string): Promise<{
    inventory: InventoryItem[];
    projects: ConstructionProject[];
    contractors: Contractor[];
    transfers: AssetTransfer[];
    users: User[];
    employees: BranchEmployee[];
    products: Product[];
    warehouseItems: WarehouseItem[];
    branches: Branch[];
    campaigns: MarketingCampaign[];
  }>;
  
  // Operations Module - Products
  getAllProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  
  // Operations Module - Shifts
  getAllShifts(): Promise<Shift[]>;
  getShiftsByBranch(branchId: string): Promise<Shift[]>;
  getShiftsByDate(date: string): Promise<Shift[]>;
  getShift(id: number): Promise<Shift | undefined>;
  createShift(shift: InsertShift): Promise<Shift>;
  updateShift(id: number, shift: Partial<InsertShift>): Promise<Shift | undefined>;
  deleteShift(id: number): Promise<boolean>;
  
  // Operations Module - Shift Employees
  getShiftEmployees(shiftId: number): Promise<ShiftEmployee[]>;
  createShiftEmployee(employee: InsertShiftEmployee): Promise<ShiftEmployee>;
  updateShiftEmployee(id: number, employee: Partial<InsertShiftEmployee>): Promise<ShiftEmployee | undefined>;
  deleteShiftEmployee(id: number): Promise<boolean>;
  
  // Operations Module - Production Orders
  getAllProductionOrders(): Promise<ProductionOrder[]>;
  getProductionOrdersByBranch(branchId: string): Promise<ProductionOrder[]>;
  getProductionOrdersByDate(date: string): Promise<ProductionOrder[]>;
  getProductionOrder(id: number): Promise<ProductionOrder | undefined>;
  createProductionOrder(order: InsertProductionOrder): Promise<ProductionOrder>;
  updateProductionOrder(id: number, order: Partial<InsertProductionOrder>): Promise<ProductionOrder | undefined>;
  deleteProductionOrder(id: number): Promise<boolean>;
  
  // Operations Module - Quality Checks
  getAllQualityChecks(): Promise<QualityCheck[]>;
  getQualityChecksByBranch(branchId: string): Promise<QualityCheck[]>;
  getQualityChecksByDate(date: string): Promise<QualityCheck[]>;
  getQualityCheck(id: number): Promise<QualityCheck | undefined>;
  createQualityCheck(check: InsertQualityCheck): Promise<QualityCheck>;
  
  // Operations Module - Daily Summary
  getDailyOperationsSummary(branchId: string, date: string): Promise<DailyOperationsSummary | undefined>;
  createOrUpdateDailyOperationsSummary(summary: InsertDailyOperationsSummary): Promise<DailyOperationsSummary>;
  
  // Targets & Incentives - Weight Profiles
  getAllTargetWeightProfiles(): Promise<TargetWeightProfile[]>;
  getTargetWeightProfile(id: number): Promise<TargetWeightProfile | undefined>;
  getDefaultTargetWeightProfile(): Promise<TargetWeightProfile | undefined>;
  createTargetWeightProfile(profile: InsertTargetWeightProfile): Promise<TargetWeightProfile>;
  updateTargetWeightProfile(id: number, profile: Partial<InsertTargetWeightProfile>): Promise<TargetWeightProfile | undefined>;
  deleteTargetWeightProfile(id: number): Promise<boolean>;
  
  // Targets & Incentives - Monthly Targets
  getAllBranchMonthlyTargets(): Promise<BranchMonthlyTarget[]>;
  getBranchMonthlyTargetsByBranch(branchId: string): Promise<BranchMonthlyTarget[]>;
  getBranchMonthlyTarget(id: number): Promise<BranchMonthlyTarget | undefined>;
  getBranchMonthlyTargetByMonth(branchId: string, yearMonth: string): Promise<BranchMonthlyTarget | undefined>;
  createBranchMonthlyTarget(target: InsertBranchMonthlyTarget): Promise<BranchMonthlyTarget>;
  updateBranchMonthlyTarget(id: number, target: Partial<InsertBranchMonthlyTarget>): Promise<BranchMonthlyTarget | undefined>;
  deleteBranchMonthlyTarget(id: number): Promise<boolean>;
  
  // Targets & Incentives - Daily Allocations
  getTargetDailyAllocationsByMonth(monthlyTargetId: number): Promise<TargetDailyAllocation[]>;
  getTargetDailyAllocation(id: number): Promise<TargetDailyAllocation | undefined>;
  createTargetDailyAllocation(allocation: InsertTargetDailyAllocation): Promise<TargetDailyAllocation>;
  updateTargetDailyAllocation(id: number, allocation: Partial<InsertTargetDailyAllocation>): Promise<TargetDailyAllocation | undefined>;
  deleteTargetDailyAllocation(id: number): Promise<boolean>;
  bulkCreateTargetDailyAllocations(allocations: InsertTargetDailyAllocation[]): Promise<TargetDailyAllocation[]>;
  
  // Targets & Incentives - Shift Allocations
  getTargetShiftAllocationsByDaily(dailyAllocationId: number): Promise<TargetShiftAllocation[]>;
  createTargetShiftAllocation(allocation: InsertTargetShiftAllocation): Promise<TargetShiftAllocation>;
  deleteTargetShiftAllocationsByDaily(dailyAllocationId: number): Promise<boolean>;
  
  // Targets & Incentives - Incentive Tiers
  getAllIncentiveTiers(): Promise<IncentiveTier[]>;
  getActiveIncentiveTiers(): Promise<IncentiveTier[]>;
  getIncentiveTier(id: number): Promise<IncentiveTier | undefined>;
  createIncentiveTier(tier: InsertIncentiveTier): Promise<IncentiveTier>;
  updateIncentiveTier(id: number, tier: Partial<InsertIncentiveTier>): Promise<IncentiveTier | undefined>;
  deleteIncentiveTier(id: number): Promise<boolean>;
  
  // Targets & Incentives - Incentive Awards
  getAllIncentiveAwards(): Promise<IncentiveAward[]>;
  getIncentiveAwardsByBranch(branchId: string): Promise<IncentiveAward[]>;
  getIncentiveAwardsByCashier(cashierId: string): Promise<IncentiveAward[]>;
  getIncentiveAward(id: number): Promise<IncentiveAward | undefined>;
  createIncentiveAward(award: InsertIncentiveAward): Promise<IncentiveAward>;
  updateIncentiveAward(id: number, award: Partial<InsertIncentiveAward>): Promise<IncentiveAward | undefined>;
  approveIncentiveAward(id: number, approvedBy: string): Promise<IncentiveAward | undefined>;
  markIncentiveAwardAsPaid(id: number): Promise<IncentiveAward | undefined>;

  // Smart Points System - نظام النقاط الذكي
  getPointSettings(): Promise<PointSettings | undefined>;
  upsertPointSettings(settings: InsertPointSettings): Promise<PointSettings>;
  
  // Daily Challenges - التحديات اليومية
  getAllDailyChallenges(): Promise<CashierDailyChallenge[]>;
  getActiveDailyChallenges(branchId?: string, targetDate?: string): Promise<CashierDailyChallenge[]>;
  getDailyChallenge(id: number): Promise<CashierDailyChallenge | undefined>;
  createDailyChallenge(challenge: InsertCashierDailyChallenge): Promise<CashierDailyChallenge>;
  updateDailyChallenge(id: number, challenge: Partial<InsertCashierDailyChallenge>): Promise<CashierDailyChallenge | undefined>;
  deleteDailyChallenge(id: number): Promise<boolean>;
  
  // Product Commissions - عمولة الأصناف
  getAllProductCommissions(): Promise<ProductCommission[]>;
  getActiveProductCommissions(branchId?: string): Promise<ProductCommission[]>;
  getProductCommission(id: number): Promise<ProductCommission | undefined>;
  createProductCommission(commission: InsertProductCommission): Promise<ProductCommission>;
  updateProductCommission(id: number, commission: Partial<InsertProductCommission>): Promise<ProductCommission | undefined>;
  deleteProductCommission(id: number): Promise<boolean>;
  
  // Branch Achievement Bonus - عمولة إنجاز الفرع
  getAllBranchBonuses(): Promise<BranchAchievementBonus[]>;
  getBranchBonus(id: number): Promise<BranchAchievementBonus | undefined>;
  getBranchBonusByBranchMonth(branchId: string, yearMonth: string): Promise<BranchAchievementBonus | undefined>;
  createBranchBonus(bonus: InsertBranchAchievementBonus): Promise<BranchAchievementBonus>;
  updateBranchBonus(id: number, bonus: Partial<InsertBranchAchievementBonus>): Promise<BranchAchievementBonus | undefined>;
  deleteBranchBonus(id: number): Promise<boolean>;
  
  // Cashier Points Ledger - رصيد النقاط
  getCashierPointsLedger(cashierId: string, dateFrom?: string, dateTo?: string): Promise<CashierPointsLedger[]>;
  getBranchPointsLedger(branchId: string, dateFrom?: string, dateTo?: string): Promise<CashierPointsLedger[]>;
  createPointsEntry(entry: InsertCashierPointsLedger): Promise<CashierPointsLedger>;
  updatePointsEntryStatus(id: number, status: string, approvedBy?: string): Promise<CashierPointsLedger | undefined>;
  getCashierPointsSummary(cashierId: string, yearMonth?: string): Promise<{ totalPoints: number; totalAmount: number; pendingPoints: number; pendingAmount: number; approvedPoints: number; approvedAmount: number }>;
  
  getTopCashiersByPoints(yearMonth: string, limit?: number): Promise<Array<{ cashierId: string; cashierName: string; branchId: string; branchName: string; totalPoints: number; totalAmount: number; challengeCount: number }>>;

  calculateJournalIncentives(journalId: number): Promise<{ challengePoints: CashierPointsLedger[]; totalPoints: number; totalAmount: number; diagnostics: Array<{challengeName: string; challengeType: string; targetValue: number; actualValue: number; met: boolean; reason?: string}> }>;

  // Cashier Product Sales - مبيعات الأصناف
  getCashierProductSales(cashierId: string, date?: string): Promise<CashierProductSales[]>;
  createCashierProductSale(sale: InsertCashierProductSales): Promise<CashierProductSales>;
  updateCashierProductSale(id: number, sale: Partial<InsertCashierProductSales>): Promise<CashierProductSales | undefined>;

  // Cashier Incentive Statements - كشوفات حوافز الكاشير
  createIncentiveStatement(data: InsertCashierIncentiveStatement): Promise<CashierIncentiveStatement>;
  getIncentiveStatements(branchId?: string, cashierId?: string, status?: string): Promise<CashierIncentiveStatement[]>;
  getIncentiveStatement(id: number): Promise<CashierIncentiveStatement | undefined>;
  updateIncentiveStatementStatus(id: number, status: string, userId: string, rejectionReason?: string): Promise<CashierIncentiveStatement | undefined>;
  
  // Targets Performance Calculation
  calculateBranchPerformance(branchId: string, yearMonth: string): Promise<{
    targetAmount: number;
    achievedAmount: number;
    achievementPercent: number;
    dailyPerformance: { date: string; target: number; achieved: number; percent: number }[];
  }>;
  
  getLeaderboard(yearMonth: string): Promise<{
    branches: { branchId: string; branchName: string; target: number; achieved: number; percent: number; rank: number }[];
    cashiers: { cashierId: string; cashierName: string; branchId: string; target: number; achieved: number; percent: number; rank: number }[];
  }>;
  
  // Display Bar Receipts
  getDisplayBarReceipts(branchId?: string, date?: string): Promise<DisplayBarReceipt[]>;
  createDisplayBarReceipt(data: InsertDisplayBarReceipt): Promise<DisplayBarReceipt>;
  syncMissingDisplayBarReceipts(branchId?: string, date?: string, allowedBranchIds?: string[]): Promise<{ synced: number; skipped: number; errors: string[] }>;
  
  // Display Bar Daily Summary
  getDisplayBarDailySummary(branchId?: string, date?: string): Promise<DisplayBarDailySummary[]>;
  getDisplayBarDailySummaryById(id: number): Promise<DisplayBarDailySummary | undefined>;
  upsertDisplayBarDailySummary(data: InsertDisplayBarDailySummary): Promise<DisplayBarDailySummary>;
  updateDisplayBarDailySummary(id: number, data: Partial<InsertDisplayBarDailySummary>): Promise<DisplayBarDailySummary | undefined>;
  
  // Waste Reports
  getWasteReports(branchId?: string, dateFrom?: string, dateTo?: string): Promise<WasteReport[]>;
  getWasteReport(id: number): Promise<WasteReport | undefined>;
  createWasteReport(data: InsertWasteReport): Promise<WasteReport>;
  updateWasteReport(id: number, data: Partial<InsertWasteReport>): Promise<WasteReport | undefined>;
  deleteWasteReport(id: number): Promise<boolean>;
  
  // Waste Items
  getWasteItems(wasteReportId: number): Promise<WasteItem[]>;
  getWasteItemById(id: number): Promise<WasteItem | undefined>;
  createWasteItem(data: InsertWasteItem): Promise<WasteItem>;
  updateWasteItem(id: number, data: Partial<InsertWasteItem>): Promise<WasteItem | undefined>;
  deleteWasteItem(id: number): Promise<boolean>;
  deleteWasteItemsByReportId(wasteReportId: number): Promise<number>;
  batchReplaceWasteItems(wasteReportId: number, items: InsertWasteItem[]): Promise<WasteItem[]>;

  // Advanced Production Orders
  getAllAdvancedProductionOrders(): Promise<AdvancedProductionOrder[]>;
  getAdvancedProductionOrder(id: number): Promise<AdvancedProductionOrder | undefined>;
  getAdvancedProductionOrdersByBranch(branchId: string): Promise<AdvancedProductionOrder[]>;
  createAdvancedProductionOrder(order: InsertAdvancedProductionOrder): Promise<AdvancedProductionOrder>;
  updateAdvancedProductionOrder(id: number, order: Partial<InsertAdvancedProductionOrder>): Promise<AdvancedProductionOrder | undefined>;
  deleteAdvancedProductionOrder(id: number): Promise<boolean>;
  getAdvancedProductionOrderWithItems(id: number): Promise<{ order: AdvancedProductionOrder; items: ProductionOrderItem[] } | undefined>;
  createAdvancedProductionOrderWithItems(order: InsertAdvancedProductionOrder, items: Omit<InsertProductionOrderItem, 'orderId'>[]): Promise<{ order: AdvancedProductionOrder; items: ProductionOrderItem[] }>;

  // Production Order Items
  getProductionOrderItems(orderId: number): Promise<ProductionOrderItem[]>;
  getProductionOrderItemById(id: number): Promise<ProductionOrderItem | undefined>;
  getProductionTargetsByDate(branchId: string, date: string): Promise<{ totalTarget: number; totalProduced: number }>;
  createProductionOrderItem(item: InsertProductionOrderItem): Promise<ProductionOrderItem>;
  bulkCreateProductionOrderItems(items: InsertProductionOrderItem[]): Promise<ProductionOrderItem[]>;
  updateProductionOrderItem(id: number, item: Partial<InsertProductionOrderItem>): Promise<ProductionOrderItem | undefined>;
  deleteProductionOrderItem(id: number): Promise<boolean>;

  // Production Order Schedules
  getProductionOrderSchedules(orderId: number): Promise<ProductionOrderSchedule[]>;
  createProductionOrderSchedule(schedule: InsertProductionOrderSchedule): Promise<ProductionOrderSchedule>;
  bulkCreateProductionOrderSchedules(schedules: InsertProductionOrderSchedule[]): Promise<ProductionOrderSchedule[]>;

  // AI Plans
  getAllProductionAiPlans(): Promise<ProductionAiPlan[]>;
  getProductionAiPlan(id: number): Promise<ProductionAiPlan | undefined>;
  createProductionAiPlan(plan: InsertProductionAiPlan): Promise<ProductionAiPlan>;
  updateProductionAiPlan(id: number, plan: Partial<InsertProductionAiPlan>): Promise<ProductionAiPlan | undefined>;
  deleteProductionAiPlan(id: number): Promise<boolean>;

  // Sales Data Uploads
  getAllSalesDataUploads(): Promise<SalesDataUpload[]>;
  getSalesDataUpload(id: number): Promise<SalesDataUpload | undefined>;
  createSalesDataUpload(upload: InsertSalesDataUpload): Promise<SalesDataUpload>;
  updateSalesDataUpload(id: number, upload: Partial<InsertSalesDataUpload>): Promise<SalesDataUpload | undefined>;

  // Product Sales Analytics
  getProductSalesAnalytics(uploadId: number): Promise<ProductSalesAnalytics[]>;
  bulkCreateProductSalesAnalytics(analytics: InsertProductSalesAnalytics[]): Promise<ProductSalesAnalytics[]>;

  // Production Order Stats
  getAdvancedProductionOrderStats(branchId?: string): Promise<{
    total: number;
    draft: number;
    pending: number;
    approved: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    daily: number;
    weekly: number;
    longTerm: number;
    totalEstimatedCost: number;
  }>;

  // Daily Production Batches
  getAllDailyProductionBatches(filters?: { branchId?: string; date?: string; destination?: string; status?: string; chefId?: string; category?: string; productionOrderId?: number }): Promise<DailyProductionBatch[]>;
  getDailyProductionBatch(id: number): Promise<DailyProductionBatch | undefined>;
  createDailyProductionBatch(batch: InsertDailyProductionBatch): Promise<DailyProductionBatch>;
  createDailyProductionBatchWithTransfer(batch: InsertDailyProductionBatch, userId?: string, userName?: string): Promise<{ batch: DailyProductionBatch; transferred: boolean }>;
  updateDailyProductionBatch(id: number, batch: Partial<InsertDailyProductionBatch>): Promise<DailyProductionBatch | undefined>;
  updateDailyProductionBatchWithTransfer(id: number, batch: Partial<InsertDailyProductionBatch>, userId?: string, userName?: string): Promise<{ batch: DailyProductionBatch | undefined; transferred: boolean }>;
  deleteDailyProductionBatch(id: number): Promise<boolean>;
  getDailyProductionStats(branchId: string, date: string): Promise<{
    totalBatches: number;
    totalQuantity: number;
    byDestination: Record<string, number>;
    byCategory: Record<string, number>;
    byHour: Record<string, number>;
  }>;
  getUnfinishedBatches(branchId?: string): Promise<DailyProductionBatch[]>;
  finishBatch(id: number): Promise<DailyProductionBatch | undefined>;
  carryOverBatch(sourceBatchId: number, newDate: Date, additionalQuantity?: number): Promise<DailyProductionBatch | undefined>;

  // Cashier Shift Targets - أهداف الكاشير للشفت
  getAllCashierShiftTargets(filters?: { branchId?: string; date?: string; shiftType?: string }): Promise<CashierShiftTarget[]>;
  getCashierShiftTarget(id: number): Promise<CashierShiftTarget | undefined>;
  getCashierShiftTargetsByBranch(branchId: string, date: string): Promise<CashierShiftTarget[]>;
  getCashierShiftTargetsByCashier(cashierId: string, startDate?: string, endDate?: string): Promise<CashierShiftTarget[]>;
  createCashierShiftTarget(target: InsertCashierShiftTarget): Promise<CashierShiftTarget>;
  updateCashierShiftTarget(id: number, target: Partial<InsertCashierShiftTarget>): Promise<CashierShiftTarget | undefined>;
  deleteCashierShiftTarget(id: number): Promise<boolean>;
  bulkCreateCashierShiftTargets(targets: InsertCashierShiftTarget[]): Promise<CashierShiftTarget[]>;

  // Average Ticket Targets - أهداف متوسط الفاتورة
  getAllAverageTicketTargets(filters?: { branchId?: string; isActive?: boolean }): Promise<AverageTicketTarget[]>;
  getAverageTicketTarget(id: number): Promise<AverageTicketTarget | undefined>;
  getActiveAverageTicketTargets(branchId?: string, cashierId?: string): Promise<AverageTicketTarget[]>;
  createAverageTicketTarget(target: InsertAverageTicketTarget): Promise<AverageTicketTarget>;
  updateAverageTicketTarget(id: number, target: Partial<InsertAverageTicketTarget>): Promise<AverageTicketTarget | undefined>;
  deleteAverageTicketTarget(id: number): Promise<boolean>;

  // Performance Alerts - تنبيهات الأداء
  getAllPerformanceAlerts(filters?: { branchId?: string; date?: string; isRead?: boolean }): Promise<PerformanceAlert[]>;
  getPerformanceAlert(id: number): Promise<PerformanceAlert | undefined>;
  getUnreadAlerts(branchId: string): Promise<PerformanceAlert[]>;
  createPerformanceAlert(alert: InsertPerformanceAlert): Promise<PerformanceAlert>;
  markAlertAsRead(id: number): Promise<PerformanceAlert | undefined>;
  acknowledgeAlert(id: number, acknowledgedBy: string): Promise<PerformanceAlert | undefined>;
  bulkMarkAlertsAsRead(ids: number[]): Promise<boolean>;

  // Shift Performance Tracking - تتبع أداء الشفت
  getAllShiftPerformanceTracking(filters?: { branchId?: string; date?: string }): Promise<ShiftPerformanceTracking[]>;
  getShiftPerformanceTracking(id: number): Promise<ShiftPerformanceTracking | undefined>;
  getActiveShiftPerformance(branchId: string, date: string, shiftType: string): Promise<ShiftPerformanceTracking | undefined>;
  createShiftPerformanceTracking(tracking: InsertShiftPerformanceTracking): Promise<ShiftPerformanceTracking>;
  updateShiftPerformanceTracking(id: number, tracking: Partial<InsertShiftPerformanceTracking>): Promise<ShiftPerformanceTracking | undefined>;
  upsertShiftPerformanceTracking(tracking: InsertShiftPerformanceTracking): Promise<ShiftPerformanceTracking>;

  // ==========================================
  // Marketing Module - إدارة التسويق
  // ==========================================

  // Marketing Campaigns - الحملات التسويقية
  getAllMarketingCampaigns(filters?: { status?: string; season?: string; objective?: string }): Promise<MarketingCampaign[]>;
  getMarketingCampaign(id: number): Promise<MarketingCampaign | undefined>;
  createMarketingCampaign(campaign: InsertMarketingCampaign): Promise<MarketingCampaign>;
  updateMarketingCampaign(id: number, campaign: Partial<InsertMarketingCampaign>): Promise<MarketingCampaign | undefined>;
  deleteMarketingCampaign(id: number): Promise<boolean>;

  // Campaign Budget Allocations - توزيع الميزانية
  getCampaignBudgetAllocations(campaignId: number): Promise<CampaignBudgetAllocation[]>;
  getCampaignBudgetAllocation(id: number): Promise<CampaignBudgetAllocation | undefined>;
  createCampaignBudgetAllocation(allocation: InsertCampaignBudgetAllocation): Promise<CampaignBudgetAllocation>;
  updateCampaignBudgetAllocation(id: number, allocation: Partial<InsertCampaignBudgetAllocation>): Promise<CampaignBudgetAllocation | undefined>;
  deleteCampaignBudgetAllocation(id: number): Promise<boolean>;

  // Campaign Goals - أهداف الحملة
  getCampaignGoals(campaignId: number): Promise<CampaignGoal[]>;
  getCampaignGoal(id: number): Promise<CampaignGoal | undefined>;
  createCampaignGoal(goal: InsertCampaignGoal): Promise<CampaignGoal>;
  updateCampaignGoal(id: number, goal: Partial<InsertCampaignGoal>): Promise<CampaignGoal | undefined>;
  deleteCampaignGoal(id: number): Promise<boolean>;

  // Campaign Expenses - مصروفات الحملات
  getCampaignExpenses(campaignId: number): Promise<CampaignExpense[]>;
  getAllCampaignExpenses(filters?: { campaignId?: number; category?: string; status?: string; startDate?: string; endDate?: string }): Promise<CampaignExpense[]>;
  getCampaignExpense(id: number): Promise<CampaignExpense | undefined>;
  createCampaignExpense(expense: InsertCampaignExpense): Promise<CampaignExpense>;
  updateCampaignExpense(id: number, expense: Partial<InsertCampaignExpense>): Promise<CampaignExpense | undefined>;
  deleteCampaignExpense(id: number): Promise<boolean>;
  getCampaignTotalExpenses(campaignId: number): Promise<number>;
  getExpensesByCategory(campaignId: number): Promise<{ category: string; total: number }[]>;
  getExpensesByInfluencerId(influencerId: number): Promise<CampaignExpense[]>;
  getTotalExpensesByInfluencerId(influencerId: number): Promise<number>;

  // Marketing Calendar Events - تقويم التسويق
  getAllMarketingCalendarEvents(filters?: { campaignId?: number; startDate?: string; endDate?: string }): Promise<MarketingCalendarEvent[]>;
  getMarketingCalendarEvent(id: number): Promise<MarketingCalendarEvent | undefined>;
  createMarketingCalendarEvent(event: InsertMarketingCalendarEvent): Promise<MarketingCalendarEvent>;
  updateMarketingCalendarEvent(id: number, event: Partial<InsertMarketingCalendarEvent>): Promise<MarketingCalendarEvent | undefined>;
  deleteMarketingCalendarEvent(id: number): Promise<boolean>;

  // Marketing Influencers - المؤثرين
  getAllMarketingInfluencers(filters?: { specialty?: string; isActive?: boolean }): Promise<MarketingInfluencer[]>;
  getMarketingInfluencer(id: number): Promise<MarketingInfluencer | undefined>;
  createMarketingInfluencer(influencer: InsertMarketingInfluencer): Promise<MarketingInfluencer>;
  updateMarketingInfluencer(id: number, influencer: Partial<InsertMarketingInfluencer>): Promise<MarketingInfluencer | undefined>;
  deleteMarketingInfluencer(id: number): Promise<boolean>;

  // Influencer Campaign Links - ربط المؤثرين بالحملات
  getInfluencerCampaignLinks(filters?: { influencerId?: number; campaignId?: number }): Promise<InfluencerCampaignLink[]>;
  getInfluencerCampaignLink(id: number): Promise<InfluencerCampaignLink | undefined>;
  createInfluencerCampaignLink(link: InsertInfluencerCampaignLink): Promise<InfluencerCampaignLink>;
  updateInfluencerCampaignLink(id: number, link: Partial<InsertInfluencerCampaignLink>): Promise<InfluencerCampaignLink | undefined>;
  deleteInfluencerCampaignLink(id: number): Promise<boolean>;

  // Influencer Contacts - سجل التواصل
  getInfluencerContacts(influencerId: number): Promise<InfluencerContact[]>;
  getInfluencerContact(id: number): Promise<InfluencerContact | undefined>;
  createInfluencerContact(contact: InsertInfluencerContact): Promise<InfluencerContact>;
  deleteInfluencerContact(id: number): Promise<boolean>;

  // Influencer Payments - كشف حساب المؤثرين
  getInfluencerPayments(influencerId: number): Promise<InfluencerPayment[]>;
  getAllInfluencerPayments(filters?: { influencerId?: number; campaignId?: number; status?: string; startDate?: string; endDate?: string }): Promise<InfluencerPayment[]>;
  getInfluencerPayment(id: number): Promise<InfluencerPayment | undefined>;
  createInfluencerPayment(payment: InsertInfluencerPayment): Promise<InfluencerPayment>;
  updateInfluencerPayment(id: number, payment: Partial<InsertInfluencerPayment>): Promise<InfluencerPayment | undefined>;
  deleteInfluencerPayment(id: number): Promise<boolean>;
  getInfluencerTotalPayments(influencerId: number): Promise<number>;

  // Marketing Tasks - المهام
  getAllMarketingTasks(filters?: { campaignId?: number; assignedTo?: string; status?: string }): Promise<MarketingTask[]>;
  getMarketingTask(id: number): Promise<MarketingTask | undefined>;
  createMarketingTask(task: InsertMarketingTask): Promise<MarketingTask>;
  updateMarketingTask(id: number, task: Partial<InsertMarketingTask>): Promise<MarketingTask | undefined>;
  deleteMarketingTask(id: number): Promise<boolean>;

  // Marketing Task Activities - نشاط المهام
  getMarketingTaskActivities(taskId: number): Promise<MarketingTaskActivity[]>;
  createMarketingTaskActivity(activity: InsertMarketingTaskActivity): Promise<MarketingTaskActivity>;

  // Marketing Performance Reports - تقارير الأداء
  getAllMarketingPerformanceReports(filters?: { reportType?: string; campaignId?: number }): Promise<MarketingPerformanceReport[]>;
  getMarketingPerformanceReport(id: number): Promise<MarketingPerformanceReport | undefined>;
  createMarketingPerformanceReport(report: InsertMarketingPerformanceReport): Promise<MarketingPerformanceReport>;
  deleteMarketingPerformanceReport(id: number): Promise<boolean>;

  // Marketing Assets - الأصول التسويقية
  getAllMarketingAssets(filters?: { campaignId?: number; assetType?: string }): Promise<MarketingAsset[]>;
  getMarketingAsset(id: number): Promise<MarketingAsset | undefined>;
  createMarketingAsset(asset: InsertMarketingAsset): Promise<MarketingAsset>;
  updateMarketingAsset(id: number, asset: Partial<InsertMarketingAsset>): Promise<MarketingAsset | undefined>;
  deleteMarketingAsset(id: number): Promise<boolean>;

  // Marketing Team Members - فريق التسويق
  getAllMarketingTeamMembers(filters?: { isActive?: boolean }): Promise<MarketingTeamMember[]>;
  getMarketingTeamMember(id: number): Promise<MarketingTeamMember | undefined>;
  getMarketingTeamMemberByUserId(userId: string): Promise<MarketingTeamMember | undefined>;
  createMarketingTeamMember(member: InsertMarketingTeamMember): Promise<MarketingTeamMember>;
  updateMarketingTeamMember(id: number, member: Partial<InsertMarketingTeamMember>): Promise<MarketingTeamMember | undefined>;
  deleteMarketingTeamMember(id: number): Promise<boolean>;

  // Marketing Alerts - تنبيهات التسويق
  getAllMarketingAlerts(filters?: { targetUserId?: string; isRead?: boolean }): Promise<MarketingAlert[]>;
  getMarketingAlert(id: number): Promise<MarketingAlert | undefined>;
  createMarketingAlert(alert: InsertMarketingAlert): Promise<MarketingAlert>;
  markMarketingAlertAsRead(id: number): Promise<MarketingAlert | undefined>;
  acknowledgeMarketingAlert(id: number, acknowledgedBy: string): Promise<MarketingAlert | undefined>;
  deleteMarketingAlert(id: number): Promise<boolean>;

  // Timesheet Reports - تقارير التايم شيت
  getTimesheetReports(filters?: { employeeId?: string; branchId?: string; status?: string }): Promise<TimesheetReport[]>;
  getTimesheetReport(id: number): Promise<TimesheetReport | undefined>;
  getTimesheetReportByEmployeeAndDates(employeeId: string, startDate: string, endDate: string): Promise<TimesheetReport | undefined>;
  createTimesheetReport(report: InsertTimesheetReport): Promise<TimesheetReport>;
  updateTimesheetReport(id: number, report: Partial<InsertTimesheetReport>): Promise<TimesheetReport | undefined>;
  deleteTimesheetReport(id: number): Promise<boolean>;
  signTimesheetReport(id: number, signatureType: 'employee' | 'manager', signature: string, signerId: string, acknowledgment?: string): Promise<TimesheetReport | undefined>;

  // Timesheet Report Entries - سجلات التقرير اليومية
  getTimesheetReportEntries(reportId: number): Promise<TimesheetReportEntry[]>;
  createTimesheetReportEntry(entry: InsertTimesheetReportEntry): Promise<TimesheetReportEntry>;
  createBulkTimesheetReportEntries(entries: InsertTimesheetReportEntry[]): Promise<TimesheetReportEntry[]>;
  updateTimesheetReportEntry(id: number, entry: Partial<InsertTimesheetReportEntry>): Promise<TimesheetReportEntry | undefined>;

  // Branch Employees - موظفي الفروع
  getAllBranchEmployees(): Promise<BranchEmployee[]>;
  getBranchEmployeesByBranch(branchId: string): Promise<BranchEmployee[]>;
  getBranchEmployee(id: number): Promise<BranchEmployee | undefined>;
  getBranchEmployeeByLinkedUserId(userId: string): Promise<BranchEmployee | undefined>;
  createBranchEmployee(employee: InsertBranchEmployee): Promise<BranchEmployee>;
  updateBranchEmployee(id: number, employee: Partial<InsertBranchEmployee>): Promise<BranchEmployee | undefined>;
  deleteBranchEmployee(id: number): Promise<boolean>;
  linkBranchEmployeeToUser(branchEmployeeId: number, userId: string): Promise<BranchEmployee | undefined>;
  getBranchEmployeeStats(branchId?: string): Promise<{
    totalEmployees: number;
    totalSalaries: number;
    byNationality: { nationality: string; count: number }[];
    byJobTitle: { jobTitle: string; count: number }[];
    byStatus: { status: string; count: number }[];
  }>;

  // Branch Employee Integration - ربط موظفي الفروع بالحضور والدوام
  getAttendanceByBranchEmployeeId(branchEmployeeId: number): Promise<AttendanceRecord[]>;
  getTimesheetsByBranchEmployeeId(branchEmployeeId: number): Promise<TimesheetReport[]>;
  getSchedulesByBranchEmployeeId(branchEmployeeId: number): Promise<EmployeeSchedule[]>;

  // Org Job Roles - الهيكل الوظيفي
  getAllOrgJobRoles(): Promise<OrgJobRole[]>;
  getOrgJobRole(id: number): Promise<OrgJobRole | undefined>;
  createOrgJobRole(role: InsertOrgJobRole): Promise<OrgJobRole>;
  updateOrgJobRole(id: number, role: Partial<InsertOrgJobRole>): Promise<OrgJobRole | undefined>;
  deleteOrgJobRole(id: number): Promise<boolean>;

  // Employee Settings - إعدادات بيانات الموظفين
  getAllEmployeeSettings(): Promise<EmployeeSetting[]>;
  getEmployeeSettingsByCategory(category: string): Promise<EmployeeSetting[]>;
  getEmployeeSetting(id: number): Promise<EmployeeSetting | undefined>;
  createEmployeeSetting(setting: InsertEmployeeSetting): Promise<EmployeeSetting>;
  updateEmployeeSetting(id: number, setting: Partial<InsertEmployeeSetting>): Promise<EmployeeSetting | undefined>;
  deleteEmployeeSetting(id: number): Promise<boolean>;

  // Employee Transfer Requests - طلبات نقل الموظفين
  getAllTransferRequests(filters?: { status?: string; branchId?: string; employeeId?: number }): Promise<EmployeeTransferRequest[]>;
  getTransferRequest(id: number): Promise<EmployeeTransferRequest | undefined>;
  createTransferRequest(request: InsertEmployeeTransferRequest): Promise<EmployeeTransferRequest>;
  updateTransferRequest(id: number, request: Partial<InsertEmployeeTransferRequest>): Promise<EmployeeTransferRequest | undefined>;
  deleteTransferRequest(id: number): Promise<boolean>;
  getTransfersByEmployee(employeeId: number): Promise<EmployeeTransferRequest[]>;
  getPendingTransfersForBranch(branchId: string): Promise<EmployeeTransferRequest[]>;
  
  // Transfer Approval Steps - خطوات الموافقة
  getTransferApprovalSteps(transferId: number): Promise<TransferApprovalStep[]>;
  createTransferApprovalStep(step: InsertTransferApprovalStep): Promise<TransferApprovalStep>;
  updateTransferApprovalStep(id: number, step: Partial<InsertTransferApprovalStep>): Promise<TransferApprovalStep | undefined>;
  
  // Transfer History - سجل النقل
  getTransferHistory(transferId: number): Promise<TransferHistory[]>;
  createTransferHistoryEntry(entry: { transferId: number; eventType: string; performedBy?: string; details?: any }): Promise<TransferHistory>;

  // ==========================================
  // Social Media Module - إدارة وسائل التواصل الاجتماعي
  // ==========================================

  // Social Accounts
  getAllSocialAccounts(): Promise<SocialAccount[]>;
  getSocialAccount(id: number): Promise<SocialAccount | undefined>;
  getSocialAccountByPlatform(platform: string): Promise<SocialAccount | undefined>;
  createSocialAccount(account: InsertSocialAccount): Promise<SocialAccount>;
  updateSocialAccount(id: number, account: Partial<InsertSocialAccount>): Promise<SocialAccount | undefined>;
  deleteSocialAccount(id: number): Promise<boolean>;

  // Social Posts
  getAllSocialPosts(): Promise<SocialPost[]>;
  getSocialPost(id: number): Promise<SocialPost | undefined>;
  getSocialPostsByStatus(status: string): Promise<SocialPost[]>;
  createSocialPost(post: InsertSocialPost): Promise<SocialPost>;
  updateSocialPost(id: number, post: Partial<InsertSocialPost>): Promise<SocialPost | undefined>;
  deleteSocialPost(id: number): Promise<boolean>;

  // Social Templates
  getAllSocialTemplates(): Promise<SocialContentTemplate[]>;
  getSocialTemplate(id: number): Promise<SocialContentTemplate | undefined>;
  createSocialTemplate(template: InsertSocialContentTemplate): Promise<SocialContentTemplate>;
  updateSocialTemplate(id: number, template: Partial<InsertSocialContentTemplate>): Promise<SocialContentTemplate | undefined>;
  deleteSocialTemplate(id: number): Promise<boolean>;
  incrementTemplateUsage(id: number): Promise<void>;

  // Influencer Contracts - عقود المؤثرين
  getAllInfluencerContracts(filters?: { status?: string; influencerId?: number; branchId?: string; paymentStatus?: string }): Promise<InfluencerContract[]>;
  getInfluencerContract(id: number): Promise<InfluencerContract | undefined>;
  getInfluencerContractByNumber(contractNumber: string): Promise<InfluencerContract | undefined>;
  createInfluencerContract(contract: InsertInfluencerContract): Promise<InfluencerContract>;
  updateInfluencerContract(id: number, contract: Partial<InsertInfluencerContract>): Promise<InfluencerContract | undefined>;
  deleteInfluencerContract(id: number): Promise<boolean>;
  generateContractNumber(): Promise<string>;

  // ==========================================
  // Finished Goods Inventory - مخزون الإنتاج النهائي
  // ==========================================
  
  // Finished Goods Inventory
  getFinishedGoodsInventory(filters?: { branchId?: string; productId?: number; productionDate?: string; startDate?: string; endDate?: string; category?: string }): Promise<FinishedGoodsInventory[]>;
  getFinishedGoodsInventoryItem(id: number): Promise<FinishedGoodsInventory | undefined>;
  addToFinishedGoodsInventory(item: InsertFinishedGoodsInventory): Promise<FinishedGoodsInventory>;
  updateFinishedGoodsInventory(id: number, item: Partial<InsertFinishedGoodsInventory>): Promise<FinishedGoodsInventory | undefined>;
  decrementFinishedGoodsInventory(id: number, quantity: number): Promise<FinishedGoodsInventory | undefined>;
  addProductionToFinishedGoods(batchId: number, userId?: string, userName?: string): Promise<FinishedGoodsInventory>;
  
  // Finished Goods Transfers
  getFinishedGoodsTransfers(filters?: { sourceBranchId?: string; destinationType?: string; destinationBranchId?: string; transferDate?: string; startDate?: string; endDate?: string; status?: string }): Promise<FinishedGoodsTransfer[]>;
  getFinishedGoodsTransfer(id: number): Promise<FinishedGoodsTransfer | undefined>;
  createFinishedGoodsTransfer(transfer: InsertFinishedGoodsTransfer): Promise<FinishedGoodsTransfer>;
  transferFinishedGoods(inventoryId: number, quantity: number, destinationType: string, destinationBranchId?: string, notes?: string, userId?: string, userName?: string): Promise<FinishedGoodsTransfer>;
  
  // Production Inventory Logs
  getProductionInventoryLogs(filters?: { branchId?: string; productId?: number; movementType?: string }): Promise<ProductionInventoryLog[]>;
  createProductionInventoryLog(log: InsertProductionInventoryLog): Promise<ProductionInventoryLog>;
  
  // ==========================================
  // Enhanced P&L System - نظام الأرباح والخسائر المحسن
  // ==========================================
  
  // P&L Branch Settings (Fixed rent per branch)
  getPnlBranchSettings(branchId: string): Promise<PnlBranchSettings | undefined>;
  upsertPnlBranchSettings(settings: InsertPnlBranchSettings): Promise<PnlBranchSettings>;
  
  // P&L Monthly Inputs (Variable monthly costs)
  getPnlMonthlyInputs(branchId: string, year: number, month: number): Promise<PnlMonthlyInputs | undefined>;
  upsertPnlMonthlyInputs(inputs: InsertPnlMonthlyInputs): Promise<PnlMonthlyInputs>;

  // System Notifications
  getAllSystemNotifications(): Promise<SystemNotification[]>;
  getSystemNotification(id: number): Promise<SystemNotification | undefined>;
  createSystemNotification(notification: InsertSystemNotification): Promise<SystemNotification>;
  updateSystemNotification(id: number, notification: Partial<InsertSystemNotification>): Promise<SystemNotification | undefined>;
  deleteSystemNotification(id: number): Promise<boolean>;
  getActiveNotificationsForUser(userId: string, branchId: string): Promise<SystemNotification[]>;
  markNotificationRead(notificationId: number, userId: string): Promise<NotificationRead>;
  dismissNotification(notificationId: number, userId: string): Promise<NotificationRead>;
  getNotificationReadsByUser(userId: string): Promise<NotificationRead[]>;
  getNotificationReadStats(): Promise<{ notificationId: number; readCount: number; dismissedCount: number; readers: { userId: string; username: string; readAt: Date; dismissed: boolean }[] }[]>;

  // Event POS - Branch Products
  getBranchProducts(branchId: string): Promise<BranchProduct[]>;
  getBranchProductById(id: number): Promise<BranchProduct | undefined>;
  addBranchProduct(data: InsertBranchProduct): Promise<BranchProduct>;
  removeBranchProduct(id: number): Promise<boolean>;
  updateBranchProduct(id: number, data: Partial<InsertBranchProduct>): Promise<BranchProduct | undefined>;

  // Event POS - Invoice Settings
  getPosInvoiceSettings(branchId: string): Promise<PosInvoiceSettings | undefined>;
  upsertPosInvoiceSettings(data: InsertPosInvoiceSettings): Promise<PosInvoiceSettings>;
  incrementInvoiceNumber(branchId: string): Promise<number>;

  // Event POS - Sales
  createPosSale(sale: InsertPosSale, items: InsertPosSaleItem[]): Promise<PosSale>;
  getPosSales(branchId: string, dateFrom?: string, dateTo?: string): Promise<PosSale[]>;
  getPosSaleById(id: number): Promise<PosSale | undefined>;
  getPosSaleItems(saleId: number): Promise<PosSaleItem[]>;
  getPosSalesSummary(branchId: string, date: string): Promise<{ totalSales: number; totalTransactions: number; cashTotal: number; networkTotal: number }>;

  // Event POS - Void/Refund
  voidPosSale(saleId: number, reason: string, voidedBy: string): Promise<PosSale | undefined>;
  refundPosSale(saleId: number, reason: string, refundedBy: string): Promise<PosSale | undefined>;

  // Event POS - Held Orders
  createHeldOrder(data: InsertPosHeldOrder): Promise<PosHeldOrder>;
  getHeldOrders(branchId: string): Promise<PosHeldOrder[]>;
  deleteHeldOrder(id: number): Promise<boolean>;

  getPosSalesReport(branchId: string, startDate: string, endDate: string): Promise<{
    totalSales: number;
    totalTransactions: number;
    cashTotal: number;
    networkTotal: number;
    splitTotal: number;
    voidedCount: number;
    voidedAmount: number;
    refundedCount: number;
    refundedAmount: number;
    discountTotal: number;
    vatTotal: number;
    dailySales: { date: string; sales: number; transactions: number }[];
    paymentBreakdown: { method: string; amount: number; count: number }[];
  }>;
  getPosProductSalesDetails(branchId: string, startDate: string, endDate: string): Promise<{
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    vatAmount: number;
    saleDate: string;
    paymentMethod: string;
    invoiceNumber: string;
  }[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const hashedPassword = userData.password 
      ? await bcrypt.hash(userData.password, 10) 
      : null;
    
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        password: hashedPassword,
      })
      .returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const updateData: any = { ...userData, updatedAt: new Date() };
    
    if (userData.password) {
      updateData.password = await bcrypt.hash(userData.password, 10);
    }
    
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUsersByBranch(branchId?: string, branchIds?: string[]): Promise<Pick<User, 'id' | 'username' | 'firstName' | 'lastName'>[]> {
    const conditions = [];
    if (branchId) {
      conditions.push(eq(users.branchId, branchId));
    } else if (branchIds && branchIds.length > 0) {
      conditions.push(inArray(users.branchId, branchIds));
    }
    return await db.select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
    }).from(users).where(conditions.length > 0 ? and(...conditions) : undefined);
  }

  async getUsersByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return await db.select().from(users).where(inArray(users.id, ids));
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async verifyPassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user || !user.password) return null;
    
    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : null;
  }

  // Branches
  // Branches
  private getCachedBranches = memoize(async () => {
    return await db.select().from(branches);
  }, { promise: true, maxAge: 60000 });

  async getAllBranches(): Promise<Branch[]> {
    return await this.getCachedBranches();
  }

  async getBranch(id: string): Promise<Branch | undefined> {
    const [branch] = await db.select().from(branches).where(eq(branches.id, id));
    return branch || undefined;
  }

  async createBranch(insertBranch: InsertBranch): Promise<Branch> {
    const [branch] = await db.insert(branches).values(insertBranch).returning();
    return branch;
  }

  // Inventory Items
  async getAllInventoryItems(): Promise<InventoryItem[]> {
    return await db.select().from(inventoryItems);
  }

  async getInventoryItemsByBranch(branchId: string): Promise<InventoryItem[]> {
    return await db.select().from(inventoryItems).where(eq(inventoryItems.branchId, branchId));
  }

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    return item || undefined;
  }

  async createInventoryItem(item: InsertInventoryItem, userId?: string): Promise<InventoryItem> {
    const [newItem] = await db.insert(inventoryItems).values(item).returning();
    
    await this.createAuditLog({
      itemId: newItem.id,
      action: 'create',
      fieldName: null,
      oldValue: null,
      newValue: JSON.stringify(item),
      changedBy: userId || 'system'
    });
    
    // Get user name for audit log
    let userName = null;
    if (userId) {
      const user = await this.getUser(userId);
      if (user) {
        userName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.username;
      }
    }
    
    await this.createSystemAuditLog({
      module: 'inventory',
      entityId: newItem.id,
      entityName: newItem.name,
      action: 'create',
      details: `إضافة صنف جديد: ${newItem.name}`,
      userId: userId || null,
      userName: userName,
    });
    
    return newItem;
  }

  async updateInventoryItem(id: string, item: Partial<InsertInventoryItem>, userId?: string): Promise<InventoryItem | undefined> {
    const existingItem = await this.getInventoryItem(id);
    
    const [updatedItem] = await db
      .update(inventoryItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(inventoryItems.id, id))
      .returning();
    
    const changedFields: string[] = [];
    if (updatedItem && existingItem) {
      for (const [key, newValue] of Object.entries(item)) {
        const oldValue = existingItem[key as keyof InventoryItem];
        if (String(oldValue) !== String(newValue)) {
          changedFields.push(key);
          await this.createAuditLog({
            itemId: id,
            action: 'update',
            fieldName: key,
            oldValue: oldValue != null ? String(oldValue) : null,
            newValue: newValue != null ? String(newValue) : null,
            changedBy: userId || 'system'
          });
        }
      }
      
      // Add system audit log for update if there were changes
      if (changedFields.length > 0) {
        let userName = null;
        if (userId) {
          const user = await this.getUser(userId);
          if (user) {
            userName = user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}` 
              : user.username;
          }
        }
        
        await this.createSystemAuditLog({
          module: 'inventory',
          entityId: id,
          entityName: existingItem.name,
          action: 'update',
          details: `تعديل: ${changedFields.join(', ')}`,
          userId: userId || null,
          userName: userName,
        });
      }
    }
    
    return updatedItem || undefined;
  }

  async deleteInventoryItem(id: string, userId?: string): Promise<boolean> {
    const existingItem = await this.getInventoryItem(id);
    
    if (existingItem) {
      await this.createAuditLog({
        itemId: id,
        action: 'delete',
        fieldName: null,
        oldValue: JSON.stringify(existingItem),
        newValue: null,
        changedBy: userId || 'system'
      });
      
      // Get user name for audit log
      let userName = null;
      if (userId) {
        const user = await this.getUser(userId);
        if (user) {
          userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.username;
        }
      }
      
      await this.createSystemAuditLog({
        module: 'inventory',
        entityId: id,
        entityName: existingItem.name,
        action: 'delete',
        details: `حذف صنف: ${existingItem.name}`,
        userId: userId || null,
        userName: userName,
      });
    }
    
    const result = await db.delete(inventoryItems).where(eq(inventoryItems.id, id)).returning();
    return result.length > 0;
  }

  async getItemsNeedingInspection(): Promise<InventoryItem[]> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    return await db
      .select()
      .from(inventoryItems)
      .where(lte(inventoryItems.nextInspectionDate, today));
  }

  // Audit Logs
  async getAuditLogsForItem(itemId: string): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.itemId, itemId))
      .orderBy(desc(auditLogs.createdAt));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  // Saved Filters
  async getAllSavedFilters(): Promise<SavedFilter[]> {
    return await db.select().from(savedFilters).orderBy(desc(savedFilters.createdAt));
  }

  async getSavedFilter(id: number): Promise<SavedFilter | undefined> {
    const [filter] = await db.select().from(savedFilters).where(eq(savedFilters.id, id));
    return filter || undefined;
  }

  async createSavedFilter(filter: InsertSavedFilter): Promise<SavedFilter> {
    const [newFilter] = await db.insert(savedFilters).values(filter).returning();
    return newFilter;
  }

  async deleteSavedFilter(id: number): Promise<boolean> {
    const result = await db.delete(savedFilters).where(eq(savedFilters.id, id)).returning();
    return result.length > 0;
  }

  // Construction Categories
  async getAllConstructionCategories(): Promise<ConstructionCategory[]> {
    return await db.select().from(constructionCategories);
  }

  // Contractors
  async getAllContractors(): Promise<Contractor[]> {
    return await db.select().from(contractors).orderBy(desc(contractors.createdAt));
  }

  async getContractor(id: number): Promise<Contractor | undefined> {
    const [contractor] = await db.select().from(contractors).where(eq(contractors.id, id));
    return contractor || undefined;
  }

  async createContractor(contractor: InsertContractor): Promise<Contractor> {
    const [newContractor] = await db.insert(contractors).values(contractor).returning();
    return newContractor;
  }

  async updateContractor(id: number, contractor: Partial<InsertContractor>): Promise<Contractor | undefined> {
    const [updated] = await db
      .update(contractors)
      .set({ ...contractor, updatedAt: new Date() })
      .where(eq(contractors.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteContractor(id: number): Promise<boolean> {
    const result = await db.delete(contractors).where(eq(contractors.id, id)).returning();
    return result.length > 0;
  }

  // Construction Projects
  async getAllConstructionProjects(): Promise<ConstructionProject[]> {
    return await db.select().from(constructionProjects).orderBy(desc(constructionProjects.createdAt));
  }

  async getConstructionProjectsByBranch(branchId: string): Promise<ConstructionProject[]> {
    return await db
      .select()
      .from(constructionProjects)
      .where(eq(constructionProjects.branchId, branchId))
      .orderBy(desc(constructionProjects.createdAt));
  }

  async getConstructionProject(id: number): Promise<ConstructionProject | undefined> {
    const [project] = await db.select().from(constructionProjects).where(eq(constructionProjects.id, id));
    return project || undefined;
  }

  async createConstructionProject(project: InsertConstructionProject): Promise<ConstructionProject> {
    const [newProject] = await db.insert(constructionProjects).values(project).returning();
    return newProject;
  }

  async updateConstructionProject(id: number, project: Partial<InsertConstructionProject>): Promise<ConstructionProject | undefined> {
    const [updated] = await db
      .update(constructionProjects)
      .set({ ...project, updatedAt: new Date() })
      .where(eq(constructionProjects.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteConstructionProject(id: number): Promise<boolean> {
    const result = await db.delete(constructionProjects).where(eq(constructionProjects.id, id)).returning();
    return result.length > 0;
  }

  // Project Work Items
  async getAllWorkItems(): Promise<ProjectWorkItem[]> {
    return await db
      .select()
      .from(projectWorkItems)
      .orderBy(desc(projectWorkItems.createdAt));
  }

  async getWorkItemsByProject(projectId: number): Promise<ProjectWorkItem[]> {
    return await db
      .select()
      .from(projectWorkItems)
      .where(eq(projectWorkItems.projectId, projectId))
      .orderBy(desc(projectWorkItems.createdAt));
  }

  async getWorkItem(id: number): Promise<ProjectWorkItem | undefined> {
    const [item] = await db.select().from(projectWorkItems).where(eq(projectWorkItems.id, id));
    return item || undefined;
  }

  async createWorkItem(item: InsertProjectWorkItem): Promise<ProjectWorkItem> {
    const [newItem] = await db.insert(projectWorkItems).values(item).returning();
    return newItem;
  }

  async updateWorkItem(id: number, item: Partial<InsertProjectWorkItem>): Promise<ProjectWorkItem | undefined> {
    const [updated] = await db
      .update(projectWorkItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(projectWorkItems.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteWorkItem(id: number): Promise<boolean> {
    const result = await db.delete(projectWorkItems).where(eq(projectWorkItems.id, id)).returning();
    return result.length > 0;
  }

  // Project Budget Allocations
  async getBudgetAllocationsByProject(projectId: number): Promise<ProjectBudgetAllocation[]> {
    return await db
      .select()
      .from(projectBudgetAllocations)
      .where(eq(projectBudgetAllocations.projectId, projectId));
  }

  async getBudgetAllocation(id: number): Promise<ProjectBudgetAllocation | undefined> {
    const [allocation] = await db.select().from(projectBudgetAllocations).where(eq(projectBudgetAllocations.id, id));
    return allocation || undefined;
  }

  async createBudgetAllocation(allocation: InsertProjectBudgetAllocation): Promise<ProjectBudgetAllocation> {
    const [newAllocation] = await db.insert(projectBudgetAllocations).values(allocation).returning();
    return newAllocation;
  }

  async updateBudgetAllocation(id: number, allocation: Partial<InsertProjectBudgetAllocation>): Promise<ProjectBudgetAllocation | undefined> {
    const [updated] = await db
      .update(projectBudgetAllocations)
      .set({ ...allocation, updatedAt: new Date() })
      .where(eq(projectBudgetAllocations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteBudgetAllocation(id: number): Promise<boolean> {
    const result = await db.delete(projectBudgetAllocations).where(eq(projectBudgetAllocations.id, id)).returning();
    return result.length > 0;
  }

  async upsertBudgetAllocation(allocation: InsertProjectBudgetAllocation): Promise<ProjectBudgetAllocation> {
    const existing = await db
      .select()
      .from(projectBudgetAllocations)
      .where(
        and(
          eq(projectBudgetAllocations.projectId, allocation.projectId),
          allocation.categoryId 
            ? eq(projectBudgetAllocations.categoryId, allocation.categoryId)
            : eq(projectBudgetAllocations.categoryId, 0)
        )
      );
    
    if (existing.length > 0) {
      const [updated] = await db
        .update(projectBudgetAllocations)
        .set({ ...allocation, updatedAt: new Date() })
        .where(eq(projectBudgetAllocations.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [newAllocation] = await db.insert(projectBudgetAllocations).values(allocation).returning();
      return newAllocation;
    }
  }

  async getHistoricalCategoryAverages(): Promise<{ categoryId: number; categoryName: string; avgCost: number; projectCount: number; totalCost: number }[]> {
    const categories = await db.select().from(constructionCategories);
    const workItems = await db.select().from(projectWorkItems);
    
    const categoryStats: Record<number, { totalCost: number; projectIds: Set<number>; itemCount: number }> = {};
    
    for (const item of workItems) {
      if (!item.categoryId) continue;
      
      const cost = item.actualCost !== null && item.actualCost > 0 
        ? item.actualCost 
        : (item.costEstimate !== null && item.costEstimate > 0 ? item.costEstimate : 0);
      
      if (cost <= 0) continue;
      
      if (!categoryStats[item.categoryId]) {
        categoryStats[item.categoryId] = { totalCost: 0, projectIds: new Set(), itemCount: 0 };
      }
      
      categoryStats[item.categoryId].totalCost += cost;
      categoryStats[item.categoryId].projectIds.add(item.projectId);
      categoryStats[item.categoryId].itemCount++;
    }
    
    const result: { categoryId: number; categoryName: string; avgCost: number; projectCount: number; totalCost: number }[] = [];
    
    for (const category of categories) {
      const stats = categoryStats[category.id];
      if (stats && stats.itemCount > 0) {
        result.push({
          categoryId: category.id,
          categoryName: category.name,
          avgCost: stats.totalCost / stats.projectIds.size,
          projectCount: stats.projectIds.size,
          totalCost: stats.totalCost
        });
      } else {
        result.push({
          categoryId: category.id,
          categoryName: category.name,
          avgCost: 0,
          projectCount: 0,
          totalCost: 0
        });
      }
    }
    
    return result;
  }

  // Construction Contracts
  async getAllContracts(): Promise<ConstructionContract[]> {
    return await db.select().from(constructionContracts).orderBy(desc(constructionContracts.createdAt));
  }

  async getContractsByProject(projectId: number): Promise<ConstructionContract[]> {
    return await db
      .select()
      .from(constructionContracts)
      .where(eq(constructionContracts.projectId, projectId))
      .orderBy(desc(constructionContracts.createdAt));
  }

  async getContract(id: number): Promise<ConstructionContract | undefined> {
    const [contract] = await db.select().from(constructionContracts).where(eq(constructionContracts.id, id));
    return contract || undefined;
  }

  async createContract(contract: InsertConstructionContract): Promise<ConstructionContract> {
    const [newContract] = await db.insert(constructionContracts).values(contract).returning();
    return newContract;
  }

  async updateContract(id: number, contract: Partial<InsertConstructionContract>): Promise<ConstructionContract | undefined> {
    const [updated] = await db
      .update(constructionContracts)
      .set({ ...contract, updatedAt: new Date() })
      .where(eq(constructionContracts.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteContract(id: number): Promise<boolean> {
    const result = await db.delete(constructionContracts).where(eq(constructionContracts.id, id)).returning();
    return result.length > 0;
  }

  // Contract Items
  async getContractItems(contractId: number): Promise<ContractItem[]> {
    return await db
      .select()
      .from(contractItems)
      .where(eq(contractItems.contractId, contractId));
  }

  async getContractItem(id: number): Promise<ContractItem | undefined> {
    const [item] = await db.select().from(contractItems).where(eq(contractItems.id, id));
    return item || undefined;
  }

  async createContractItem(item: InsertContractItem): Promise<ContractItem> {
    const [newItem] = await db.insert(contractItems).values(item).returning();
    return newItem;
  }

  async updateContractItem(id: number, item: Partial<InsertContractItem>): Promise<ContractItem | undefined> {
    const [updated] = await db
      .update(contractItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(contractItems.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteContractItem(id: number): Promise<boolean> {
    const result = await db.delete(contractItems).where(eq(contractItems.id, id)).returning();
    return result.length > 0;
  }

  // Payment Requests
  async getAllPaymentRequests(): Promise<PaymentRequest[]> {
    return await db.select().from(paymentRequests).orderBy(desc(paymentRequests.createdAt));
  }

  async getPaymentRequestsByProject(projectId: number): Promise<PaymentRequest[]> {
    return await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.projectId, projectId))
      .orderBy(desc(paymentRequests.createdAt));
  }

  async getPaymentRequestsByStatus(status: string): Promise<PaymentRequest[]> {
    return await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.status, status))
      .orderBy(desc(paymentRequests.createdAt));
  }

  async getPaymentRequest(id: number): Promise<PaymentRequest | undefined> {
    const [request] = await db.select().from(paymentRequests).where(eq(paymentRequests.id, id));
    return request || undefined;
  }

  async createPaymentRequest(request: InsertPaymentRequest): Promise<PaymentRequest> {
    const [newRequest] = await db.insert(paymentRequests).values(request).returning();
    return newRequest;
  }

  async updatePaymentRequest(id: number, request: Partial<InsertPaymentRequest>): Promise<PaymentRequest | undefined> {
    const [updated] = await db
      .update(paymentRequests)
      .set({ ...request, updatedAt: new Date() })
      .where(eq(paymentRequests.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePaymentRequest(id: number): Promise<boolean> {
    const result = await db.delete(paymentRequests).where(eq(paymentRequests.id, id)).returning();
    return result.length > 0;
  }

  async approvePaymentRequest(id: number, approvedBy: string): Promise<PaymentRequest | undefined> {
    const [updated] = await db
      .update(paymentRequests)
      .set({ 
        status: 'approved', 
        approvedBy, 
        approvedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(paymentRequests.id, id))
      .returning();
    return updated || undefined;
  }

  async rejectPaymentRequest(id: number, reason: string): Promise<PaymentRequest | undefined> {
    const [updated] = await db
      .update(paymentRequests)
      .set({ 
        status: 'rejected', 
        rejectionReason: reason,
        updatedAt: new Date() 
      })
      .where(eq(paymentRequests.id, id))
      .returning();
    return updated || undefined;
  }

  async markPaymentRequestAsPaid(id: number): Promise<PaymentRequest | undefined> {
    const [updated] = await db
      .update(paymentRequests)
      .set({ 
        status: 'paid', 
        paidAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(paymentRequests.id, id))
      .returning();
    return updated || undefined;
  }

  // Contract Payments
  async getContractPayments(contractId: number): Promise<ContractPayment[]> {
    return await db
      .select()
      .from(contractPayments)
      .where(eq(contractPayments.contractId, contractId))
      .orderBy(desc(contractPayments.createdAt));
  }

  async createContractPayment(payment: InsertContractPayment): Promise<ContractPayment> {
    const [newPayment] = await db.insert(contractPayments).values(payment).returning();
    
    // Update contract paid amount
    const payments = await this.getContractPayments(payment.contractId);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    await this.updateContract(payment.contractId, { paidAmount: totalPaid });
    
    return newPayment;
  }

  // ========== Project Expenses ==========
  async getAllProjectExpenses(branchIds?: string[] | null): Promise<ProjectExpense[]> {
    if (branchIds === null || branchIds === undefined) {
      return await db.select().from(projectExpenses).orderBy(desc(projectExpenses.expenseDate), desc(projectExpenses.id));
    }
    if (branchIds.length === 0) return [];
    const rows = await db
      .select({ exp: projectExpenses })
      .from(projectExpenses)
      .innerJoin(constructionProjects, eq(projectExpenses.projectId, constructionProjects.id))
      .where(inArray(constructionProjects.branchId, branchIds))
      .orderBy(desc(projectExpenses.expenseDate), desc(projectExpenses.id));
    return rows.map((r) => r.exp);
  }

  async getProjectExpensesByProject(projectId: number): Promise<ProjectExpense[]> {
    return await db
      .select()
      .from(projectExpenses)
      .where(eq(projectExpenses.projectId, projectId))
      .orderBy(desc(projectExpenses.expenseDate), desc(projectExpenses.id));
  }

  async getProjectExpensesByContractor(contractorId: number, branchIds?: string[] | null): Promise<ProjectExpense[]> {
    if (branchIds === null || branchIds === undefined) {
      return await db
        .select()
        .from(projectExpenses)
        .where(eq(projectExpenses.contractorId, contractorId))
        .orderBy(desc(projectExpenses.expenseDate), desc(projectExpenses.id));
    }
    if (branchIds.length === 0) return [];
    const rows = await db
      .select({ exp: projectExpenses })
      .from(projectExpenses)
      .innerJoin(constructionProjects, eq(projectExpenses.projectId, constructionProjects.id))
      .where(and(
        eq(projectExpenses.contractorId, contractorId),
        inArray(constructionProjects.branchId, branchIds),
      ))
      .orderBy(desc(projectExpenses.expenseDate), desc(projectExpenses.id));
    return rows.map((r) => r.exp);
  }

  async getProjectExpense(id: number): Promise<ProjectExpense | undefined> {
    const [exp] = await db.select().from(projectExpenses).where(eq(projectExpenses.id, id));
    return exp || undefined;
  }

  async createProjectExpense(expense: InsertProjectExpense): Promise<ProjectExpense> {
    const [created] = await db.insert(projectExpenses).values(expense).returning();
    return created;
  }

  async updateProjectExpense(id: number, expense: Partial<InsertProjectExpense>): Promise<ProjectExpense | undefined> {
    const [updated] = await db
      .update(projectExpenses)
      .set({ ...expense, updatedAt: new Date() })
      .where(eq(projectExpenses.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProjectExpense(id: number): Promise<boolean> {
    const result = await db.delete(projectExpenses).where(eq(projectExpenses.id, id)).returning();
    return result.length > 0;
  }

  // ========== Contractor Statements (Aggregated) ==========
  async getContractorStatement(contractorId: number, opts?: { from?: string; to?: string; projectId?: number; branchIds?: string[] | null }) {
    const contractor = await this.getContractor(contractorId);

    // Build optional date filter for transactions (string YYYY-MM-DD comparable)
    const fromStr = opts?.from || null;
    const toStr = opts?.to || null;
    const projectFilter = opts?.projectId || null;
    const branchIds = opts?.branchIds === undefined ? null : opts.branchIds;

    // If branchIds is empty array, no access — return empty statement
    if (Array.isArray(branchIds) && branchIds.length === 0) {
      return {
        contractor,
        totals: {
          contractsTotal: 0,
          contractPaymentsTotal: 0,
          paymentRequestsPaidTotal: 0,
          paymentRequestsPendingTotal: 0,
          directExpensesTotal: 0,
          totalPaid: 0,
          balance: 0,
        },
        contracts: [],
        transactions: [],
      };
    }

    // 1) Contracts for contractor (optionally restricted by allowed branches via project)
    let contractsAll: ConstructionContract[];
    if (Array.isArray(branchIds)) {
      const rows = await db
        .select({ c: constructionContracts })
        .from(constructionContracts)
        .innerJoin(constructionProjects, eq(constructionContracts.projectId, constructionProjects.id))
        .where(and(
          eq(constructionContracts.contractorId, contractorId),
          inArray(constructionProjects.branchId, branchIds),
        ));
      contractsAll = rows.map((r) => r.c);
    } else {
      contractsAll = await db
        .select()
        .from(constructionContracts)
        .where(eq(constructionContracts.contractorId, contractorId));
    }
    const contracts = projectFilter
      ? contractsAll.filter((c: ConstructionContract) => c.projectId === projectFilter)
      : contractsAll;
    const contractIds = contracts.map((c: ConstructionContract) => c.id);

    // 2) Contract payments via these contracts
    let cpRows: ContractPayment[] = [];
    if (contractIds.length > 0) {
      cpRows = await db
        .select()
        .from(contractPayments)
        .where(inArray(contractPayments.contractId, contractIds));
    }
    const filteredCpRows = cpRows.filter((p) => {
      if (fromStr && p.paymentDate < fromStr) return false;
      if (toStr && p.paymentDate > toStr) return false;
      return true;
    });
    // Build set of payment_request IDs already linked to a contract payment to avoid double-counting
    const linkedPrIds = new Set<number>();
    cpRows.forEach((p) => {
      if (p.paymentRequestId != null) linkedPrIds.add(p.paymentRequestId);
    });

    // 3) Payment requests directly linked to contractor (or via contract), restricted by allowed branches
    let prDirect: PaymentRequest[];
    if (Array.isArray(branchIds)) {
      const rows = await db
        .select({ p: paymentRequests })
        .from(paymentRequests)
        .innerJoin(constructionProjects, eq(paymentRequests.projectId, constructionProjects.id))
        .where(and(
          eq(paymentRequests.contractorId, contractorId),
          inArray(constructionProjects.branchId, branchIds),
        ));
      prDirect = rows.map((r) => r.p);
    } else {
      prDirect = await db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.contractorId, contractorId));
    }
    let prViaContract: PaymentRequest[] = [];
    if (contractIds.length > 0) {
      // contractIds already restricted to allowed branches above; defense-in-depth:
      // also enforce branch on payment_requests via project join in case a PR's projectId
      // diverges from its contract's project/branch.
      if (Array.isArray(branchIds)) {
        const rows = await db
          .select({ p: paymentRequests })
          .from(paymentRequests)
          .innerJoin(constructionProjects, eq(paymentRequests.projectId, constructionProjects.id))
          .where(and(
            inArray(paymentRequests.contractId, contractIds),
            inArray(constructionProjects.branchId, branchIds),
          ));
        prViaContract = rows.map((r) => r.p);
      } else {
        prViaContract = await db
          .select()
          .from(paymentRequests)
          .where(inArray(paymentRequests.contractId, contractIds));
      }
    }
    // Merge unique
    const prMap = new Map<number, PaymentRequest>();
    [...prDirect, ...prViaContract].forEach((p) => prMap.set(p.id, p));
    let prRows = Array.from(prMap.values());
    if (projectFilter) {
      prRows = prRows.filter((p) => p.projectId === projectFilter);
    }
    prRows = prRows.filter((p) => {
      const d = p.requestDate || (p.createdAt ? p.createdAt.toString().substring(0, 10) : "");
      if (fromStr && d && d < fromStr) return false;
      if (toStr && d && d > toStr) return false;
      return true;
    });

    // 4) Direct project expenses linked to contractor (restricted by allowed branches)
    let expenseRows = await this.getProjectExpensesByContractor(contractorId, branchIds);
    if (projectFilter) {
      expenseRows = expenseRows.filter((e) => e.projectId === projectFilter);
    }
    expenseRows = expenseRows.filter((e) => {
      if (fromStr && e.expenseDate < fromStr) return false;
      if (toStr && e.expenseDate > toStr) return false;
      return true;
    });

    // 5) Project titles map
    const allProjectIds = new Set<number>();
    contracts.forEach((c) => allProjectIds.add(c.projectId));
    prRows.forEach((p) => allProjectIds.add(p.projectId));
    expenseRows.forEach((e) => allProjectIds.add(e.projectId));
    let projectMap = new Map<number, string>();
    if (allProjectIds.size > 0) {
      const projs = await db
        .select()
        .from(constructionProjects)
        .where(inArray(constructionProjects.id, Array.from(allProjectIds)));
      projs.forEach((p) => projectMap.set(p.id, p.title));
    }
    const contractTitleMap = new Map<number, string>();
    contracts.forEach((c) => contractTitleMap.set(c.id, c.title || c.contractNumber || `عقد #${c.id}`));

    // Totals — avoid double counting: paid payment_requests linked to a contract_payment
    // are already represented in contractPaymentsTotal.
    const contractsTotal = contracts.reduce((s, c) => s + (Number(c.totalAmount) || 0), 0);
    const contractPaymentsTotal = filteredCpRows.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const paymentRequestsPaidTotal = prRows
      .filter((p) => p.status === "paid" && !linkedPrIds.has(p.id))
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const paymentRequestsPendingTotal = prRows
      .filter((p) => p.status === "pending" || p.status === "approved")
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const directExpensesTotal = expenseRows.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    // Total paid = contract payments + (paid payment requests not already linked) + direct expenses
    const totalPaid = contractPaymentsTotal + paymentRequestsPaidTotal + directExpensesTotal;
    const balance = contractsTotal - totalPaid;

    // Build unified transactions list
    const transactions: Array<any> = [];
    filteredCpRows.forEach((p) => {
      const contract = contracts.find((c) => c.id === p.contractId);
      transactions.push({
        id: `cp-${p.id}`,
        date: p.paymentDate,
        type: "contract_payment",
        projectId: contract?.projectId || null,
        projectTitle: contract ? projectMap.get(contract.projectId) || null : null,
        contractId: p.contractId,
        contractTitle: contractTitleMap.get(p.contractId) || null,
        description: p.notes || `دفعة عقد - ${contractTitleMap.get(p.contractId) || ""}`,
        amount: Number(p.amount),
        status: "paid",
        reference: p.referenceNumber || null,
      });
    });
    prRows.forEach((p) => {
      const isLinked = linkedPrIds.has(p.id);
      transactions.push({
        id: `pr-${p.id}`,
        date: p.requestDate || (p.createdAt ? p.createdAt.toString().substring(0, 10) : ""),
        type: "payment_request",
        projectId: p.projectId,
        projectTitle: projectMap.get(p.projectId) || null,
        contractId: p.contractId || null,
        contractTitle: p.contractId ? contractTitleMap.get(p.contractId) || null : null,
        description: p.description + (isLinked ? " (مرتبط بدفعة عقد)" : ""),
        amount: Number(p.amount),
        status: p.status,
        reference: p.requestNumber || p.invoiceNumber || null,
        linkedToContractPayment: isLinked,
      });
    });
    expenseRows.forEach((e) => {
      transactions.push({
        id: `ex-${e.id}`,
        date: e.expenseDate,
        type: "expense",
        projectId: e.projectId,
        projectTitle: projectMap.get(e.projectId) || null,
        contractId: null,
        contractTitle: null,
        description: e.description,
        amount: Number(e.amount),
        status: "paid",
        reference: e.referenceNumber || e.invoiceNumber || null,
      });
    });
    transactions.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    return {
      contractor,
      totals: {
        contractsTotal,
        contractPaymentsTotal,
        paymentRequestsPaidTotal,
        paymentRequestsPendingTotal,
        directExpensesTotal,
        totalPaid,
        balance,
      },
      contracts,
      transactions,
    };
  }

  async getContractorsStatementsSummary(branchIds?: string[] | null) {
    const contractors = await this.getAllContractors();
    if (contractors.length === 0) return [];
    // No access
    if (Array.isArray(branchIds) && branchIds.length === 0) return [];

    const useBranchFilter = Array.isArray(branchIds);

    // 1) Aggregate contracts per contractor (count + total), restricted by allowed branches
    const contractsAggQuery = useBranchFilter
      ? db
          .select({
            contractorId: constructionContracts.contractorId,
            cnt: sql<number>`count(*)::int`,
            total: sql<number>`coalesce(sum(${constructionContracts.totalAmount}), 0)::float`,
          })
          .from(constructionContracts)
          .innerJoin(constructionProjects, eq(constructionContracts.projectId, constructionProjects.id))
          .where(inArray(constructionProjects.branchId, branchIds!))
          .groupBy(constructionContracts.contractorId)
      : db
          .select({
            contractorId: constructionContracts.contractorId,
            cnt: sql<number>`count(*)::int`,
            total: sql<number>`coalesce(sum(${constructionContracts.totalAmount}), 0)::float`,
          })
          .from(constructionContracts)
          .groupBy(constructionContracts.contractorId);
    const contractsAgg = await contractsAggQuery;
    const contractsMap = new Map<number, { cnt: number; total: number }>();
    contractsAgg.forEach((r) => {
      if (r.contractorId != null) {
        contractsMap.set(r.contractorId, { cnt: r.cnt, total: Number(r.total) || 0 });
      }
    });

    // 2) Sum contract_payments by contractor (via contracts), restricted by allowed branches
    const cpAggQuery = useBranchFilter
      ? db
          .select({
            contractorId: constructionContracts.contractorId,
            total: sql<number>`coalesce(sum(${contractPayments.amount}), 0)::float`,
          })
          .from(contractPayments)
          .innerJoin(constructionContracts, eq(contractPayments.contractId, constructionContracts.id))
          .innerJoin(constructionProjects, eq(constructionContracts.projectId, constructionProjects.id))
          .where(inArray(constructionProjects.branchId, branchIds!))
          .groupBy(constructionContracts.contractorId)
      : db
          .select({
            contractorId: constructionContracts.contractorId,
            total: sql<number>`coalesce(sum(${contractPayments.amount}), 0)::float`,
          })
          .from(contractPayments)
          .innerJoin(constructionContracts, eq(contractPayments.contractId, constructionContracts.id))
          .groupBy(constructionContracts.contractorId);
    const cpAgg = await cpAggQuery;
    const cpMap = new Map<number, number>();
    cpAgg.forEach((r) => {
      if (r.contractorId != null) cpMap.set(r.contractorId, Number(r.total) || 0);
    });

    // 3) Sum paid payment_requests by contractor, EXCLUDING those already linked to a contract_payment
    //    (avoid double counting). Restricted by allowed branches via project.
    //    The NOT IN exclusion is itself branch-scoped so a paid PR isn't dropped from this branch's
    //    aggregate just because some unrelated cross-branch contract_payment references the same PR id.
    const linkedSubquery = useBranchFilter
      ? sql`SELECT cp.payment_request_id FROM contract_payments cp
            INNER JOIN construction_contracts cc ON cc.id = cp.contract_id
            INNER JOIN construction_projects cpr ON cpr.id = cc.project_id
            WHERE cp.payment_request_id IS NOT NULL
              AND cpr.branch_id IN (${sql.join(branchIds!.map((b) => sql`${b}`), sql`, `)})`
      : sql`SELECT payment_request_id FROM contract_payments WHERE payment_request_id IS NOT NULL`;
    const prConds: any[] = [
      eq(paymentRequests.status, "paid"),
      sql`${paymentRequests.id} NOT IN (${linkedSubquery})`,
    ];
    const prAggQuery = useBranchFilter
      ? db
          .select({
            contractorId: paymentRequests.contractorId,
            total: sql<number>`coalesce(sum(${paymentRequests.amount}), 0)::float`,
          })
          .from(paymentRequests)
          .innerJoin(constructionProjects, eq(paymentRequests.projectId, constructionProjects.id))
          .where(and(...prConds, inArray(constructionProjects.branchId, branchIds!)))
          .groupBy(paymentRequests.contractorId)
      : db
          .select({
            contractorId: paymentRequests.contractorId,
            total: sql<number>`coalesce(sum(${paymentRequests.amount}), 0)::float`,
          })
          .from(paymentRequests)
          .where(and(...prConds))
          .groupBy(paymentRequests.contractorId);
    const prAgg = await prAggQuery;
    const prMap = new Map<number, number>();
    prAgg.forEach((r) => {
      if (r.contractorId != null) prMap.set(r.contractorId, Number(r.total) || 0);
    });

    // 4) Sum direct project expenses by contractor, restricted by allowed branches
    const expAggQuery = useBranchFilter
      ? db
          .select({
            contractorId: projectExpenses.contractorId,
            total: sql<number>`coalesce(sum(${projectExpenses.amount}), 0)::float`,
          })
          .from(projectExpenses)
          .innerJoin(constructionProjects, eq(projectExpenses.projectId, constructionProjects.id))
          .where(inArray(constructionProjects.branchId, branchIds!))
          .groupBy(projectExpenses.contractorId)
      : db
          .select({
            contractorId: projectExpenses.contractorId,
            total: sql<number>`coalesce(sum(${projectExpenses.amount}), 0)::float`,
          })
          .from(projectExpenses)
          .groupBy(projectExpenses.contractorId);
    const expAgg = await expAggQuery;
    const expMap = new Map<number, number>();
    expAgg.forEach((r) => {
      if (r.contractorId != null) expMap.set(r.contractorId, Number(r.total) || 0);
    });

    // Only include contractors who have any activity within the allowed scope
    return contractors
      .map((c) => {
        const cInfo = contractsMap.get(c.id) || { cnt: 0, total: 0 };
        const cpPaid = cpMap.get(c.id) || 0;
        const prPaid = prMap.get(c.id) || 0;
        const expPaid = expMap.get(c.id) || 0;
        const totalPaid = cpPaid + prPaid + expPaid;
        const balance = cInfo.total - totalPaid;
        return {
          contractor: c,
          contractsCount: cInfo.cnt,
          contractsTotal: cInfo.total,
          totalPaid,
          balance,
          _hasActivity: cInfo.cnt > 0 || cpPaid > 0 || prPaid > 0 || expPaid > 0,
        };
      })
      .filter((x) => (useBranchFilter ? x._hasActivity : true))
      .map(({ _hasActivity, ...rest }) => rest);
  }

  // ========== Project Daily Logs ==========
  async getDailyLogsByProject(projectId: number, opts?: { from?: string; to?: string }): Promise<ProjectDailyLog[]> {
    const conds: any[] = [eq(projectDailyLogs.projectId, projectId)];
    if (opts?.from) conds.push(gte(projectDailyLogs.logDate, opts.from));
    if (opts?.to) conds.push(lte(projectDailyLogs.logDate, opts.to));
    return await db
      .select()
      .from(projectDailyLogs)
      .where(and(...conds))
      .orderBy(desc(projectDailyLogs.logDate), desc(projectDailyLogs.id));
  }

  async getAllDailyLogs(opts?: { from?: string; to?: string; branchIds?: string[] | null; contractorId?: number }): Promise<ProjectDailyLog[]> {
    const conds: any[] = [];
    if (opts?.from) conds.push(gte(projectDailyLogs.logDate, opts.from));
    if (opts?.to) conds.push(lte(projectDailyLogs.logDate, opts.to));
    if (opts?.contractorId) conds.push(eq(projectDailyLogs.contractorId, opts.contractorId));
    // branchIds: null = admin (no filter); array = restrict to those branches; empty array = no access
    if (Array.isArray(opts?.branchIds)) {
      if (opts!.branchIds!.length === 0) return [];
      // Defense in depth: filter by stored branch_id AND verify project's actual branch matches
      conds.push(inArray(projectDailyLogs.branchId, opts!.branchIds!));
      conds.push(inArray(
        projectDailyLogs.projectId,
        db.select({ id: constructionProjects.id })
          .from(constructionProjects)
          .where(inArray(constructionProjects.branchId, opts!.branchIds!))
      ));
    }
    let q: any = db.select().from(projectDailyLogs);
    if (conds.length > 0) q = q.where(and(...conds));
    return await q.orderBy(desc(projectDailyLogs.logDate), desc(projectDailyLogs.id));
  }

  async getDailyLog(id: number): Promise<ProjectDailyLog | undefined> {
    const [log] = await db.select().from(projectDailyLogs).where(eq(projectDailyLogs.id, id));
    return log || undefined;
  }

  async createDailyLog(log: InsertProjectDailyLog): Promise<ProjectDailyLog> {
    const [created] = await db.insert(projectDailyLogs).values(log).returning();
    return created;
  }

  async updateDailyLog(id: number, log: Partial<InsertProjectDailyLog>): Promise<ProjectDailyLog | undefined> {
    const [updated] = await db
      .update(projectDailyLogs)
      .set({ ...log, updatedAt: new Date() })
      .where(eq(projectDailyLogs.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDailyLog(id: number): Promise<boolean> {
    const result = await db.delete(projectDailyLogs).where(eq(projectDailyLogs.id, id)).returning();
    return result.length > 0;
  }

  // ========== Daily Log Photos ==========
  async getDailyLogPhotos(dailyLogId: number): Promise<ProjectDailyLogPhoto[]> {
    return await db
      .select()
      .from(projectDailyLogPhotos)
      .where(eq(projectDailyLogPhotos.dailyLogId, dailyLogId))
      .orderBy(projectDailyLogPhotos.id);
  }

  async getDailyLogPhoto(id: number): Promise<ProjectDailyLogPhoto | undefined> {
    const [photo] = await db.select().from(projectDailyLogPhotos).where(eq(projectDailyLogPhotos.id, id));
    return photo || undefined;
  }

  async createDailyLogPhoto(photo: InsertProjectDailyLogPhoto): Promise<ProjectDailyLogPhoto> {
    const [created] = await db.insert(projectDailyLogPhotos).values(photo).returning();
    return created;
  }

  async deleteDailyLogPhoto(id: number): Promise<boolean> {
    const result = await db.delete(projectDailyLogPhotos).where(eq(projectDailyLogPhotos.id, id)).returning();
    return result.length > 0;
  }

  // User Permissions - with caching
  private permissionsCache = new Map<string, { data: UserPermission[], timestamp: number }>();
  private PERMISSIONS_CACHE_TTL = 30000; // 30 seconds cache

  async getUserPermissions(userId: string): Promise<UserPermission[]> {
    const cached = this.permissionsCache.get(userId);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < this.PERMISSIONS_CACHE_TTL) {
      return cached.data;
    }
    
    const permissionState = new Map<string, boolean>();
    
    const directPerms = await db
      .select()
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId));
    
    const hasCustomPermissions = directPerms.some(p => p.actions.length > 0);
    
    if (hasCustomPermissions) {
      for (const perm of directPerms) {
        for (const action of perm.actions) {
          permissionState.set(`${perm.module}:${action}`, true);
        }
      }
    } else {
      const rolePermsFromAssignments = await db
        .select({
          module: permissions.module,
          action: permissions.action,
        })
        .from(userAssignments)
        .innerJoin(rolePermissions, eq(userAssignments.roleId, rolePermissions.roleId))
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(and(
          eq(userAssignments.userId, userId),
          eq(userAssignments.isActive, true)
        ));
      
      for (const rp of rolePermsFromAssignments) {
        permissionState.set(`${rp.module}:${rp.action}`, true);
      }
    }
    
    const overrides = await db
      .select({
        module: permissions.module,
        action: permissions.action,
        allow: userPermissionOverrides.allow,
        expiresAt: userPermissionOverrides.expiresAt,
      })
      .from(userPermissionOverrides)
      .innerJoin(permissions, eq(userPermissionOverrides.permissionId, permissions.id))
      .where(eq(userPermissionOverrides.userId, userId));
    
    for (const override of overrides) {
      if (override.expiresAt && new Date(override.expiresAt).getTime() < now) {
        continue;
      }
      
      const key = `${override.module}:${override.action}`;
      if (override.allow) {
        permissionState.set(key, true);
      } else {
        permissionState.delete(key);
      }
    }
    
    // Convert to module -> actions format
    const moduleActionsMap = new Map<string, Set<string>>();
    Array.from(permissionState.entries()).forEach(([key, granted]) => {
      if (granted) {
        const [module, action] = key.split(':');
        if (!moduleActionsMap.has(module)) {
          moduleActionsMap.set(module, new Set());
        }
        moduleActionsMap.get(module)!.add(action);
      }
    });
    
    // 5. Convert map to UserPermission format with unique IDs
    const mergedPerms: UserPermission[] = [];
    let virtualId = -1; // Use negative IDs to distinguish from real DB IDs
    Array.from(moduleActionsMap.entries()).forEach(([module, actions]) => {
      mergedPerms.push({
        id: virtualId--,
        userId,
        module,
        actions: Array.from(actions),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
    
    this.permissionsCache.set(userId, { data: mergedPerms, timestamp: now });
    return mergedPerms;
  }

  invalidatePermissionsCache(userId?: string) {
    if (userId) {
      this.permissionsCache.delete(userId);
    } else {
      this.permissionsCache.clear();
    }
  }

  async getUserPermissionsWithSources(userId: string): Promise<PermissionWithSource[]> {
    const result: PermissionWithSource[] = [];
    const now = Date.now();
    
    const directPerms = await db
      .select()
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId));
    
    const hasCustomPermissions = directPerms.some(p => p.actions.length > 0);
    
    if (hasCustomPermissions) {
      for (const perm of directPerms) {
        for (const action of perm.actions) {
          result.push({
            module: perm.module,
            action,
            source: 'direct',
            isActive: true,
          });
        }
      }
    } else {
      const rolePermsFromAssignments = await db
        .select({
          module: permissions.module,
          action: permissions.action,
          permissionId: permissions.id,
          roleName: roles.name,
        })
        .from(userAssignments)
        .innerJoin(rolePermissions, eq(userAssignments.roleId, rolePermissions.roleId))
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .innerJoin(roles, eq(userAssignments.roleId, roles.id))
        .where(and(
          eq(userAssignments.userId, userId),
          eq(userAssignments.isActive, true)
        ));
      
      for (const rp of rolePermsFromAssignments) {
        result.push({
          module: rp.module,
          action: rp.action,
          source: 'role',
          roleName: rp.roleName,
          isActive: true,
          permissionId: rp.permissionId,
        });
      }
    }
    
    const overrides = await db
      .select({
        module: permissions.module,
        action: permissions.action,
        permissionId: permissions.id,
        allow: userPermissionOverrides.allow,
        expiresAt: userPermissionOverrides.expiresAt,
      })
      .from(userPermissionOverrides)
      .innerJoin(permissions, eq(userPermissionOverrides.permissionId, permissions.id))
      .where(eq(userPermissionOverrides.userId, userId));
    
    for (const override of overrides) {
      if (override.expiresAt && new Date(override.expiresAt).getTime() < now) {
        continue;
      }
      
      const existingIdx = result.findIndex(r => r.module === override.module && r.action === override.action);
      if (existingIdx >= 0) {
        result[existingIdx].source = override.allow ? 'override_grant' : 'override_deny';
        result[existingIdx].isActive = override.allow;
        result[existingIdx].permissionId = override.permissionId;
      } else if (override.allow) {
        result.push({
          module: override.module,
          action: override.action,
          source: 'override_grant',
          isActive: true,
          permissionId: override.permissionId,
        });
      }
    }
    
    return result;
  }

  async setPermissionOverride(userId: string, permissionId: number, allow: boolean, changedByUserId: string, reason?: string): Promise<void> {
    this.invalidatePermissionsCache(userId);
    
    const [existing] = await db
      .select()
      .from(userPermissionOverrides)
      .where(and(
        eq(userPermissionOverrides.userId, userId),
        eq(userPermissionOverrides.permissionId, permissionId)
      ));
    
    if (existing) {
      await db
        .update(userPermissionOverrides)
        .set({ allow, reason: reason || null, grantedBy: changedByUserId })
        .where(eq(userPermissionOverrides.id, existing.id));
    } else {
      await db.insert(userPermissionOverrides).values({
        userId,
        permissionId,
        allow,
        reason: reason || null,
        grantedBy: changedByUserId,
      });
    }
    
    const [perm] = await db.select().from(permissions).where(eq(permissions.id, permissionId));
    if (perm) {
      await this.createPermissionAuditLog({
        targetUserId: userId,
        changedByUserId,
        action: allow ? 'grant' : 'revoke',
        module: perm.module,
        oldActions: [],
        newActions: allow ? [perm.action] : [],
        templateApplied: reason || `Override ${allow ? 'granted' : 'denied'} via management UI`,
      });
    }
  }

  async removePermissionOverride(userId: string, permissionId: number): Promise<void> {
    this.invalidatePermissionsCache(userId);
    
    await db
      .delete(userPermissionOverrides)
      .where(and(
        eq(userPermissionOverrides.userId, userId),
        eq(userPermissionOverrides.permissionId, permissionId)
      ));
  }

  async removeDenyOverride(userId: string, permissionId: number): Promise<void> {
    this.invalidatePermissionsCache(userId);
    
    await db
      .delete(userPermissionOverrides)
      .where(and(
        eq(userPermissionOverrides.userId, userId),
        eq(userPermissionOverrides.permissionId, permissionId),
        eq(userPermissionOverrides.allow, false)
      ));
  }

  async removeAllPermissionOverrides(userId: string): Promise<void> {
    this.invalidatePermissionsCache(userId);
    
    await db
      .delete(userPermissionOverrides)
      .where(eq(userPermissionOverrides.userId, userId));
  }

  async getInheritedPermissions(userId: string): Promise<{ module: string; action: string; permissionId: number }[]> {
    const rolePerms = await db
      .select({
        module: permissions.module,
        action: permissions.action,
        permissionId: permissions.id,
      })
      .from(userAssignments)
      .innerJoin(rolePermissions, eq(userAssignments.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(
        eq(userAssignments.userId, userId),
        eq(userAssignments.isActive, true)
      ));
    
    return rolePerms;
  }

  async setUserPermission(permission: InsertUserPermission): Promise<UserPermission> {
    // Invalidate cache immediately for security
    this.invalidatePermissionsCache(permission.userId);
    
    // Check if permission for this user+module exists
    const [existing] = await db
      .select()
      .from(userPermissions)
      .where(
        and(
          eq(userPermissions.userId, permission.userId),
          eq(userPermissions.module, permission.module)
        )
      );

    if (existing) {
      // Update existing permission
      const [updated] = await db
        .update(userPermissions)
        .set({ actions: permission.actions, updatedAt: new Date() })
        .where(eq(userPermissions.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new permission
      const [created] = await db
        .insert(userPermissions)
        .values(permission)
        .returning();
      return created;
    }
  }

  async deleteUserPermissions(userId: string): Promise<boolean> {
    // Invalidate cache immediately for security
    this.invalidatePermissionsCache(userId);
    
    const result = await db
      .delete(userPermissions)
      .where(eq(userPermissions.userId, userId))
      .returning();
    return result.length >= 0;
  }

  async hasPermission(userId: string, module: string, action: string): Promise<boolean> {
    // First check if user is admin (admins have all permissions)
    const user = await this.getUser(userId);
    if (user?.role === "admin") return true;

    // Check specific permission
    const [permission] = await db
      .select()
      .from(userPermissions)
      .where(
        and(
          eq(userPermissions.userId, userId),
          eq(userPermissions.module, module)
        )
      );

    if (!permission) return false;
    return permission.actions.includes(action);
  }

  // Permission Audit Logs
  async createPermissionAuditLog(log: InsertPermissionAuditLog): Promise<PermissionAuditLog> {
    const [created] = await db
      .insert(permissionAuditLogs)
      .values(log)
      .returning();
    return created;
  }

  async getPermissionAuditLogs(targetUserId?: string): Promise<PermissionAuditLog[]> {
    if (targetUserId) {
      return db
        .select()
        .from(permissionAuditLogs)
        .where(eq(permissionAuditLogs.targetUserId, targetUserId))
        .orderBy(desc(permissionAuditLogs.createdAt));
    }
    return db
      .select()
      .from(permissionAuditLogs)
      .orderBy(desc(permissionAuditLogs.createdAt));
  }

  async updateUserPermissionsWithAudit(
    userId: string,
    permissionsList: { module: string; actions: string[] }[],
    changedByUserId: string,
    templateApplied: string | null,
    inheritedOverrides?: { permissionId: number; deny: boolean }[]
  ): Promise<UserPermission[]> {
    // Invalidate cache immediately for security
    this.invalidatePermissionsCache(userId);
    
    return await db.transaction(async (tx) => {
      // Get current inherited permission IDs for cleanup (always run cleanup)
      const currentInheritedIds = new Set((inheritedOverrides || []).map(o => o.permissionId));
      
      // Clean up stale deny overrides (for permissions no longer inherited)
      const existingDenyOverrides = await tx
        .select({
          id: userPermissionOverrides.id,
          permissionId: userPermissionOverrides.permissionId,
        })
        .from(userPermissionOverrides)
        .where(and(
          eq(userPermissionOverrides.userId, userId),
          eq(userPermissionOverrides.allow, false)
        ));
      
      for (const staleOverride of existingDenyOverrides) {
        if (!currentInheritedIds.has(staleOverride.permissionId)) {
          // This deny override is for a permission no longer inherited - remove it with audit
          const [perm] = await tx.select().from(permissions).where(eq(permissions.id, staleOverride.permissionId));
          
          await tx
            .delete(userPermissionOverrides)
            .where(eq(userPermissionOverrides.id, staleOverride.id));
          
          // Audit log for stale override cleanup (using 'modify' action to indicate cleanup)
          if (perm) {
            await tx.insert(permissionAuditLogs).values({
              targetUserId: userId,
              changedByUserId,
              action: 'modify',
              module: perm.module,
              oldActions: ['override_deny'],
              newActions: [],
              templateApplied: 'تنظيف تجاوز قديم - الصلاحية لم تعد موروثة',
            });
          }
        }
      }
      
      // Handle inherited permission overrides atomically with audit logging
      if (inheritedOverrides && inheritedOverrides.length > 0) {
        for (const override of inheritedOverrides) {
          // Get permission details for audit logging
          const [perm] = await tx.select().from(permissions).where(eq(permissions.id, override.permissionId));
          
          if (override.deny) {
            // Create deny override for inherited permission
            const [existing] = await tx
              .select()
              .from(userPermissionOverrides)
              .where(and(
                eq(userPermissionOverrides.userId, userId),
                eq(userPermissionOverrides.permissionId, override.permissionId)
              ));
            
            if (existing) {
              if (existing.allow !== false) {
                await tx
                  .update(userPermissionOverrides)
                  .set({ allow: false, reason: "إلغاء صلاحية موروثة", grantedBy: changedByUserId })
                  .where(eq(userPermissionOverrides.id, existing.id));
                
                // Audit log for override change
                if (perm) {
                  await tx.insert(permissionAuditLogs).values({
                    targetUserId: userId,
                    changedByUserId,
                    action: 'revoke',
                    module: perm.module,
                    oldActions: [perm.action],
                    newActions: [],
                    templateApplied: 'تجاوز صلاحية موروثة',
                  });
                }
              }
            } else {
              await tx.insert(userPermissionOverrides).values({
                userId,
                permissionId: override.permissionId,
                allow: false,
                reason: "إلغاء صلاحية موروثة",
                grantedBy: changedByUserId,
              });
              
              // Audit log for new deny override
              if (perm) {
                await tx.insert(permissionAuditLogs).values({
                  targetUserId: userId,
                  changedByUserId,
                  action: 'revoke',
                  module: perm.module,
                  oldActions: [perm.action],
                  newActions: [],
                  templateApplied: 'تجاوز صلاحية موروثة',
                });
              }
            }
          } else {
            // Remove deny override only (preserve grants)
            const [removed] = await tx
              .delete(userPermissionOverrides)
              .where(and(
                eq(userPermissionOverrides.userId, userId),
                eq(userPermissionOverrides.permissionId, override.permissionId),
                eq(userPermissionOverrides.allow, false)
              ))
              .returning();
            
            // Audit log for removed deny override
            if (removed && perm) {
              await tx.insert(permissionAuditLogs).values({
                targetUserId: userId,
                changedByUserId,
                action: 'grant',
                module: perm.module,
                oldActions: [],
                newActions: [perm.action],
                templateApplied: 'إعادة تفعيل صلاحية موروثة',
              });
            }
          }
        }
      }
      
      // Get old permissions for audit logging
      const oldPermissions = await tx
        .select()
        .from(userPermissions)
        .where(eq(userPermissions.userId, userId));
      const oldPermissionsMap = new Map(oldPermissions.map(p => [p.module, p.actions]));

      // Delete existing permissions
      await tx
        .delete(userPermissions)
        .where(eq(userPermissions.userId, userId));

      // Add new permissions
      const savedPermissions: UserPermission[] = [];
      for (const perm of permissionsList) {
        if (!perm.module || !Array.isArray(perm.actions) || perm.actions.length === 0) {
          continue;
        }

        const [created] = await tx
          .insert(userPermissions)
          .values({
            userId,
            module: perm.module,
            actions: perm.actions,
          })
          .returning();
        savedPermissions.push(created);

        // Log permission change for this module
        const oldActions = oldPermissionsMap.get(perm.module) || [];
        if (JSON.stringify([...oldActions].sort()) !== JSON.stringify([...perm.actions].sort())) {
          await tx.insert(permissionAuditLogs).values({
            targetUserId: userId,
            changedByUserId,
            action: templateApplied ? 'apply_template' : (oldActions.length === 0 ? 'grant' : 'modify'),
            module: perm.module,
            oldActions: oldActions,
            newActions: perm.actions,
            templateApplied: templateApplied || null,
          });
        }
      }

      // Log revoked permissions (modules that were removed entirely)
      for (const oldPerm of oldPermissions) {
        const stillExists = savedPermissions.some(p => p.module === oldPerm.module);
        if (!stillExists) {
          await tx.insert(permissionAuditLogs).values({
            targetUserId: userId,
            changedByUserId,
            action: 'revoke',
            module: oldPerm.module,
            oldActions: oldPerm.actions,
            newActions: [],
            templateApplied: templateApplied || null,
          });
        }
      }

      return savedPermissions;
    });
  }

  async applyJobRolePermissions(
    userId: string,
    jobTitle: string,
    changedByUserId: string
  ): Promise<UserPermission[]> {
    // Validate actor ID for audit trail
    if (!changedByUserId) {
      throw new Error("Actor ID is required for permission changes");
    }
    
    // Get job role permission template
    const template = JOB_ROLE_PERMISSION_TEMPLATES[jobTitle as keyof typeof JOB_ROLE_PERMISSION_TEMPLATES];
    
    if (!template) {
      console.warn(`No permission template found for job title: ${jobTitle}, applying minimal access`);
      // If no template exists, apply minimal dashboard access
      return this.updateUserPermissionsWithAudit(
        userId,
        [{ module: "dashboard", actions: ["view"] }],
        changedByUserId,
        `job_role:${jobTitle}:fallback`
      );
    }

    // Convert template to the format expected by updateUserPermissionsWithAudit
    const permissions = template.map(perm => ({
      module: perm.module,
      actions: [...perm.actions] as string[],
    }));

    return this.updateUserPermissionsWithAudit(
      userId,
      permissions,
      changedByUserId,
      `job_role:${jobTitle}`
    );
  }

  // Asset Transfers
  async getAllAssetTransfers(): Promise<AssetTransfer[]> {
    return db.select().from(assetTransfers).orderBy(desc(assetTransfers.createdAt));
  }

  async getAssetTransfer(id: number): Promise<AssetTransfer | undefined> {
    const [transfer] = await db.select().from(assetTransfers).where(eq(assetTransfers.id, id));
    return transfer || undefined;
  }

  async getAssetTransfersByItem(itemId: string): Promise<AssetTransfer[]> {
    return db.select().from(assetTransfers)
      .where(eq(assetTransfers.itemId, itemId))
      .orderBy(desc(assetTransfers.createdAt));
  }

  async createAssetTransfer(transfer: InsertAssetTransfer, userId: string): Promise<AssetTransfer> {
    const transferNumber = `TRF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    const [created] = await db.insert(assetTransfers).values({
      ...transfer,
      transferNumber,
      requestedBy: userId,
      status: 'pending',
    }).returning();

    await db.insert(assetTransferEvents).values({
      transferId: created.id,
      eventType: 'created',
      actorId: userId,
      note: 'تم إنشاء طلب التحويل',
    });

    // Get user name for audit log
    let userName = null;
    const user = await this.getUser(userId);
    if (user) {
      userName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.username;
    }

    await this.createSystemAuditLog({
      module: 'transfers',
      entityId: String(created.id),
      entityName: created.transferNumber,
      action: 'create',
      details: `طلب تحويل جديد: ${created.transferNumber}`,
      userId: userId,
      userName: userName,
    });

    return created;
  }

  async approveAssetTransfer(id: number, userId: string): Promise<AssetTransfer | undefined> {
    const [updated] = await db.update(assetTransfers)
      .set({ 
        status: 'approved', 
        approvedBy: userId, 
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(assetTransfers.id, id))
      .returning();

    if (updated) {
      await db.insert(assetTransferEvents).values({
        transferId: id,
        eventType: 'approved',
        actorId: userId,
        note: 'تمت الموافقة على التحويل',
      });

      // Get user name for audit log
      let userName = null;
      const user = await this.getUser(userId);
      if (user) {
        userName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.username;
      }

      await this.createSystemAuditLog({
        module: 'transfers',
        entityId: String(id),
        entityName: updated.transferNumber,
        action: 'approve',
        details: 'تمت الموافقة على التحويل',
        userId: userId,
        userName: userName,
      });
    }

    return updated || undefined;
  }

  async confirmAssetTransfer(id: number, userId: string, receiverName: string, signature?: string): Promise<AssetTransfer | undefined> {
    return await db.transaction(async (tx) => {
      const [transfer] = await tx.select().from(assetTransfers).where(eq(assetTransfers.id, id));
      if (!transfer) return undefined;

      // Update the transfer status
      const [updated] = await tx.update(assetTransfers)
        .set({ 
          status: 'completed', 
          receivedBy: userId,
          receivedAt: new Date(),
          receiverName,
          receiverSignature: signature || null,
          updatedAt: new Date()
        })
        .where(eq(assetTransfers.id, id))
        .returning();

      // Update the item's branch
      await tx.update(inventoryItems)
        .set({ 
          branchId: transfer.toBranchId,
          updatedAt: new Date()
        })
        .where(eq(inventoryItems.id, transfer.itemId));

      // Add audit log for the branch change
      await tx.insert(auditLogs).values({
        itemId: transfer.itemId,
        action: 'transfer',
        fieldName: 'branchId',
        oldValue: transfer.fromBranchId,
        newValue: transfer.toBranchId,
        changedBy: userId,
      });

      // Add transfer event
      await tx.insert(assetTransferEvents).values({
        transferId: id,
        eventType: 'received',
        actorId: userId,
        note: `تم تأكيد استلام الأصل بواسطة ${receiverName}`,
      });

      return updated;
    });
  }

  async cancelAssetTransfer(id: number, userId: string, reason?: string): Promise<AssetTransfer | undefined> {
    const [updated] = await db.update(assetTransfers)
      .set({ 
        status: 'cancelled',
        notes: reason || undefined,
        updatedAt: new Date()
      })
      .where(eq(assetTransfers.id, id))
      .returning();

    if (updated) {
      await db.insert(assetTransferEvents).values({
        transferId: id,
        eventType: 'cancelled',
        actorId: userId,
        note: reason || 'تم إلغاء التحويل',
      });
    }

    return updated || undefined;
  }

  async getAssetTransferEvents(transferId: number): Promise<AssetTransferEvent[]> {
    return db.select().from(assetTransferEvents)
      .where(eq(assetTransferEvents.transferId, transferId))
      .orderBy(desc(assetTransferEvents.createdAt));
  }

  // System Audit Logs
  async getAllSystemAuditLogs(limit: number = 500): Promise<SystemAuditLog[]> {
    return db.select().from(systemAuditLogs)
      .orderBy(desc(systemAuditLogs.createdAt))
      .limit(limit);
  }

  async getSystemAuditLogsByModule(module: string): Promise<SystemAuditLog[]> {
    return db.select().from(systemAuditLogs)
      .where(eq(systemAuditLogs.module, module))
      .orderBy(desc(systemAuditLogs.createdAt));
  }

  async getSystemAuditLogsByUser(userId: string): Promise<SystemAuditLog[]> {
    return db.select().from(systemAuditLogs)
      .where(eq(systemAuditLogs.userId, userId))
      .orderBy(desc(systemAuditLogs.createdAt));
  }

  async createSystemAuditLog(log: InsertSystemAuditLog): Promise<SystemAuditLog> {
    // Remove optional fields that may not exist in database yet
    const { targetId, description, ...safeLog } = log as any;
    try {
      const [created] = await db.insert(systemAuditLogs).values(safeLog).returning();
      return created;
    } catch (error: any) {
      // If column doesn't exist, try inserting without problematic fields
      if (error?.code === '42703') {
        const [created] = await db.insert(systemAuditLogs).values({
          module: log.module,
          entityId: log.entityId,
          entityName: log.entityName,
          action: log.action,
          details: log.details,
          userId: log.userId,
          userName: log.userName,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
        }).returning();
        return created;
      }
      throw error;
    }
  }

  async searchSystemAuditLogs(query: string): Promise<SystemAuditLog[]> {
    const allLogs = await db.select().from(systemAuditLogs)
      .orderBy(desc(systemAuditLogs.createdAt))
      .limit(1000);
    
    const lowerQuery = query.toLowerCase();
    return allLogs.filter(log => 
      log.entityName?.toLowerCase().includes(lowerQuery) ||
      log.details?.toLowerCase().includes(lowerQuery) ||
      log.userName?.toLowerCase().includes(lowerQuery) ||
      log.action.toLowerCase().includes(lowerQuery) ||
      log.module.toLowerCase().includes(lowerQuery)
    );
  }

  // Backups
  async getAllBackups(): Promise<Backup[]> {
    return db.select().from(backups).orderBy(desc(backups.createdAt));
  }

  async getBackup(id: number): Promise<Backup | undefined> {
    const [backup] = await db.select().from(backups).where(eq(backups.id, id));
    return backup || undefined;
  }

  async createBackup(backup: InsertBackup): Promise<Backup> {
    const [created] = await db.insert(backups).values(backup).returning();
    return created;
  }

  async updateBackup(id: number, backupData: Partial<InsertBackup>): Promise<Backup | undefined> {
    const [updated] = await db.update(backups)
      .set(backupData)
      .where(eq(backups.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteBackup(id: number): Promise<boolean> {
    const result = await db.delete(backups).where(eq(backups.id, id)).returning();
    return result.length > 0;
  }

  // Global Search
  async globalSearch(query: string): Promise<{
    inventory: InventoryItem[];
    projects: ConstructionProject[];
    contractors: Contractor[];
    transfers: AssetTransfer[];
    users: User[];
    employees: BranchEmployee[];
    products: Product[];
    warehouseItems: WarehouseItem[];
    branches: Branch[];
    campaigns: MarketingCampaign[];
  }> {
    const sanitizedQuery = query.replace(/[%_\\]/g, '\\$&');
    const pattern = `%${sanitizedQuery}%`;

    const [
      inventory,
      projects,
      contractorResults,
      transfers,
      userResults,
      employeeResults,
      productResults,
      warehouseItemResults,
      branchResults,
      campaignResults,
    ] = await Promise.all([
      db.select().from(inventoryItems)
        .where(or(
          ilike(inventoryItems.name, pattern),
          ilike(inventoryItems.id, pattern),
          ilike(inventoryItems.category, pattern),
          ilike(inventoryItems.serialNumber, pattern),
          ilike(inventoryItems.notes, pattern)
        ))
        .limit(10),

      db.select().from(constructionProjects)
        .where(or(
          ilike(constructionProjects.title, pattern),
          ilike(constructionProjects.description, pattern)
        ))
        .limit(10),

      db.select().from(contractors)
        .where(or(
          ilike(contractors.name, pattern),
          ilike(contractors.email, pattern),
          ilike(contractors.phone, pattern),
          ilike(contractors.specialization, pattern)
        ))
        .limit(10),

      db.select().from(assetTransfers)
        .where(or(
          ilike(assetTransfers.transferNumber, pattern),
          ilike(assetTransfers.notes, pattern)
        ))
        .limit(10),

      db.select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        role: users.role,
        profileImageUrl: users.profileImageUrl,
        isActive: users.isActive,
        jobTitle: users.jobTitle,
        branchId: users.branchId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      }).from(users)
        .where(or(
          ilike(users.username, pattern),
          ilike(users.firstName, pattern),
          ilike(users.lastName, pattern),
          ilike(users.email, pattern)
        ))
        .limit(10),

      db.select().from(branchEmployees)
        .where(or(
          ilike(branchEmployees.employeeName, pattern),
          ilike(branchEmployees.employeeNumber, pattern),
          ilike(branchEmployees.phoneNumber, pattern),
          ilike(branchEmployees.jobTitle, pattern)
        ))
        .limit(10),

      db.select().from(products)
        .where(or(
          ilike(products.name, pattern),
          ilike(products.sku, pattern),
          ilike(products.category, pattern)
        ))
        .limit(10),

      db.select().from(warehouseItems)
        .where(or(
          ilike(warehouseItems.name, pattern),
          ilike(warehouseItems.sku, pattern),
          ilike(warehouseItems.category, pattern),
          ilike(warehouseItems.notes, pattern)
        ))
        .limit(10),

      db.select().from(branches)
        .where(ilike(branches.name, pattern))
        .limit(10),

      db.select().from(marketingCampaigns)
        .where(or(
          ilike(marketingCampaigns.name, pattern),
          ilike(marketingCampaigns.description, pattern)
        ))
        .limit(10),
    ]);

    return {
      inventory,
      projects,
      contractors: contractorResults,
      transfers,
      users: userResults as User[],
      employees: employeeResults,
      products: productResults,
      warehouseItems: warehouseItemResults,
      branches: branchResults,
      campaigns: campaignResults,
    };
  }

  // External Integrations
  async getAllExternalIntegrations(): Promise<ExternalIntegration[]> {
    return db.select().from(externalIntegrations).orderBy(desc(externalIntegrations.createdAt));
  }

  async getExternalIntegration(id: number): Promise<ExternalIntegration | undefined> {
    const [integration] = await db.select().from(externalIntegrations).where(eq(externalIntegrations.id, id));
    return integration || undefined;
  }

  async getExternalIntegrationByType(type: string): Promise<ExternalIntegration | undefined> {
    const [integration] = await db.select().from(externalIntegrations).where(eq(externalIntegrations.type, type));
    return integration || undefined;
  }

  async upsertExternalIntegration(type: string, data: Partial<InsertExternalIntegration>): Promise<ExternalIntegration> {
    const existing = await this.getExternalIntegrationByType(type);
    if (existing) {
      const [updated] = await db.update(externalIntegrations)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(externalIntegrations.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(externalIntegrations)
        .values({ name: data.name || type, type, ...data })
        .returning();
      return created;
    }
  }

  async createExternalIntegration(integration: InsertExternalIntegration): Promise<ExternalIntegration> {
    const [created] = await db.insert(externalIntegrations).values(integration).returning();
    return created;
  }

  async updateExternalIntegration(id: number, data: Partial<InsertExternalIntegration>): Promise<ExternalIntegration | undefined> {
    const [updated] = await db.update(externalIntegrations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(externalIntegrations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteExternalIntegration(id: number): Promise<boolean> {
    const result = await db.delete(externalIntegrations).where(eq(externalIntegrations.id, id)).returning();
    return result.length > 0;
  }

  // Notification Templates
  async getAllNotificationTemplates(): Promise<NotificationTemplate[]> {
    return db.select().from(notificationTemplates).orderBy(desc(notificationTemplates.createdAt));
  }

  async createNotificationTemplate(template: InsertNotificationTemplate): Promise<NotificationTemplate> {
    const [created] = await db.insert(notificationTemplates).values(template).returning();
    return created;
  }

  async updateNotificationTemplate(id: number, data: Partial<InsertNotificationTemplate>): Promise<NotificationTemplate | undefined> {
    const [updated] = await db.update(notificationTemplates)
      .set(data)
      .where(eq(notificationTemplates.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteNotificationTemplate(id: number): Promise<boolean> {
    const result = await db.delete(notificationTemplates).where(eq(notificationTemplates.id, id)).returning();
    return result.length > 0;
  }

  // Notification Queue
  async getAllNotifications(): Promise<NotificationQueueItem[]> {
    return db.select().from(notificationQueue).orderBy(desc(notificationQueue.createdAt));
  }

  async getPendingNotifications(): Promise<NotificationQueueItem[]> {
    return db.select().from(notificationQueue)
      .where(eq(notificationQueue.status, 'pending'))
      .orderBy(notificationQueue.createdAt);
  }

  async createNotification(notification: InsertNotificationQueueItem): Promise<NotificationQueueItem> {
    const [created] = await db.insert(notificationQueue).values(notification).returning();
    return created;
  }

  async updateNotificationStatus(id: number, status: string, errorMessage?: string): Promise<NotificationQueueItem | undefined> {
    const [updated] = await db.update(notificationQueue)
      .set({ 
        status, 
        errorMessage: errorMessage || null,
        sentAt: status === 'sent' ? new Date() : null
      })
      .where(eq(notificationQueue.id, id))
      .returning();
    return updated || undefined;
  }

  // Data Import Jobs
  async getAllDataImportJobs(): Promise<DataImportJob[]> {
    return db.select().from(dataImportJobs).orderBy(desc(dataImportJobs.createdAt));
  }

  async getDataImportJob(id: number): Promise<DataImportJob | undefined> {
    const [job] = await db.select().from(dataImportJobs).where(eq(dataImportJobs.id, id));
    return job || undefined;
  }

  async createDataImportJob(job: InsertDataImportJob): Promise<DataImportJob> {
    const [created] = await db.insert(dataImportJobs).values({
      ...job,
      startedAt: new Date()
    }).returning();
    return created;
  }

  async updateDataImportJob(id: number, data: Partial<DataImportJob>): Promise<DataImportJob | undefined> {
    const [updated] = await db.update(dataImportJobs)
      .set(data)
      .where(eq(dataImportJobs.id, id))
      .returning();
    return updated || undefined;
  }

  // Accounting Exports
  async getAllAccountingExports(): Promise<AccountingExport[]> {
    return db.select().from(accountingExports).orderBy(desc(accountingExports.createdAt));
  }

  async getAccountingExport(id: number): Promise<AccountingExport | undefined> {
    const [exp] = await db.select().from(accountingExports).where(eq(accountingExports.id, id));
    return exp || undefined;
  }

  async createAccountingExport(exportData: InsertAccountingExport): Promise<AccountingExport> {
    const [created] = await db.insert(accountingExports).values(exportData).returning();
    return created;
  }

  async updateAccountingExport(id: number, data: Partial<AccountingExport>): Promise<AccountingExport | undefined> {
    const [updated] = await db.update(accountingExports)
      .set(data)
      .where(eq(accountingExports.id, id))
      .returning();
    return updated || undefined;
  }

  // Generate accounting export data
  async generateInventoryValuation(branchId?: string): Promise<any> {
    let items: InventoryItem[];
    if (branchId) {
      items = await this.getInventoryItemsByBranch(branchId);
    } else {
      items = await this.getAllInventoryItems();
    }
    
    const VAT_RATE = 0.15;
    const totalValue = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
    const vatAmount = totalValue * VAT_RATE;
    
    return {
      generatedAt: new Date().toISOString(),
      branchId: branchId || 'all',
      itemCount: items.length,
      totalValue,
      vatAmount,
      totalWithVat: totalValue + vatAmount,
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.price,
        totalValue: (item.price || 0) * item.quantity,
        status: item.status
      }))
    };
  }

  async generateAssetMovementsReport(dateFrom?: string, dateTo?: string): Promise<any> {
    const transfers = await this.getAllAssetTransfers();
    
    let filtered = transfers;
    if (dateFrom) {
      filtered = filtered.filter(t => t.createdAt >= new Date(dateFrom));
    }
    if (dateTo) {
      filtered = filtered.filter(t => t.createdAt <= new Date(dateTo));
    }
    
    return {
      generatedAt: new Date().toISOString(),
      dateFrom,
      dateTo,
      totalTransfers: filtered.length,
      completed: filtered.filter(t => t.status === 'completed').length,
      pending: filtered.filter(t => t.status === 'pending').length,
      transfers: filtered.map(t => ({
        transferNumber: t.transferNumber,
        itemId: t.itemId,
        fromBranch: t.fromBranchId,
        toBranch: t.toBranchId,
        status: t.status,
        requestedAt: t.requestedAt,
        completedAt: t.receivedAt
      }))
    };
  }

  async generateProjectCostsReport(projectId?: number): Promise<any> {
    let projects: ConstructionProject[];
    if (projectId) {
      const project = await this.getConstructionProject(projectId);
      projects = project ? [project] : [];
    } else {
      projects = await this.getAllConstructionProjects();
    }
    
    const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
    const totalSpent = projects.reduce((sum, p) => sum + (p.actualCost || 0), 0);
    
    return {
      generatedAt: new Date().toISOString(),
      projectId: projectId || 'all',
      projectCount: projects.length,
      totalBudget,
      totalSpent,
      remainingBudget: totalBudget - totalSpent,
      utilizationPercentage: totalBudget > 0 ? (totalSpent / totalBudget * 100).toFixed(2) : 0,
      projects: projects.map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
        budget: p.budget,
        spent: p.actualCost,
        progress: p.progressPercent
      }))
    };
  }

  // ============================================
  // Operations Module Implementation
  // ============================================

  // Products
  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(desc(products.createdAt));
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values(product).returning();
    return created;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db
      .update(products)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id)).returning();
    return result.length > 0;
  }

  // Shifts
  async getAllShifts(): Promise<Shift[]> {
    return await db.select().from(shifts).orderBy(desc(shifts.date), desc(shifts.createdAt));
  }

  async getShiftsByBranch(branchId: string): Promise<Shift[]> {
    return await db.select().from(shifts).where(eq(shifts.branchId, branchId)).orderBy(desc(shifts.date));
  }

  async getShiftsByDate(date: string): Promise<Shift[]> {
    return await db.select().from(shifts).where(eq(shifts.date, date)).orderBy(desc(shifts.createdAt));
  }

  async getShift(id: number): Promise<Shift | undefined> {
    const [shift] = await db.select().from(shifts).where(eq(shifts.id, id));
    return shift || undefined;
  }

  async createShift(shift: InsertShift): Promise<Shift> {
    const [created] = await db.insert(shifts).values(shift).returning();
    return created;
  }

  async updateShift(id: number, shift: Partial<InsertShift>): Promise<Shift | undefined> {
    const [updated] = await db
      .update(shifts)
      .set({ ...shift, updatedAt: new Date() })
      .where(eq(shifts.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteShift(id: number): Promise<boolean> {
    const result = await db.delete(shifts).where(eq(shifts.id, id)).returning();
    return result.length > 0;
  }

  // Shift Employees
  async getShiftEmployees(shiftId: number): Promise<ShiftEmployee[]> {
    return await db.select().from(shiftEmployees).where(eq(shiftEmployees.shiftId, shiftId));
  }

  async createShiftEmployee(employee: InsertShiftEmployee): Promise<ShiftEmployee> {
    const [created] = await db.insert(shiftEmployees).values(employee).returning();
    return created;
  }

  async updateShiftEmployee(id: number, employee: Partial<InsertShiftEmployee>): Promise<ShiftEmployee | undefined> {
    const [updated] = await db
      .update(shiftEmployees)
      .set(employee)
      .where(eq(shiftEmployees.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteShiftEmployee(id: number): Promise<boolean> {
    const result = await db.delete(shiftEmployees).where(eq(shiftEmployees.id, id)).returning();
    return result.length > 0;
  }

  // Production Orders
  async getAllProductionOrders(): Promise<ProductionOrder[]> {
    return await db.select().from(productionOrders).orderBy(desc(productionOrders.createdAt));
  }

  async getProductionOrdersByBranch(branchId: string): Promise<ProductionOrder[]> {
    return await db.select().from(productionOrders).where(eq(productionOrders.branchId, branchId)).orderBy(desc(productionOrders.createdAt));
  }

  async getProductionOrdersByDate(date: string): Promise<ProductionOrder[]> {
    return await db.select().from(productionOrders).where(eq(productionOrders.scheduledDate, date)).orderBy(desc(productionOrders.createdAt));
  }

  async getProductionOrder(id: number): Promise<ProductionOrder | undefined> {
    const [order] = await db.select().from(productionOrders).where(eq(productionOrders.id, id));
    return order || undefined;
  }

  async createProductionOrder(order: InsertProductionOrder): Promise<ProductionOrder> {
    const orderNumber = `PRD-${Date.now()}`;
    const [created] = await db.insert(productionOrders).values({ ...order, orderNumber }).returning();
    return created;
  }

  async updateProductionOrder(id: number, order: Partial<InsertProductionOrder>): Promise<ProductionOrder | undefined> {
    const [updated] = await db
      .update(productionOrders)
      .set({ ...order, updatedAt: new Date() })
      .where(eq(productionOrders.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProductionOrder(id: number): Promise<boolean> {
    const result = await db.delete(productionOrders).where(eq(productionOrders.id, id)).returning();
    return result.length > 0;
  }

  // Quality Checks
  async getAllQualityChecks(): Promise<QualityCheck[]> {
    return await db.select().from(qualityChecks).orderBy(desc(qualityChecks.createdAt));
  }

  async getQualityChecksByBranch(branchId: string): Promise<QualityCheck[]> {
    return await db.select().from(qualityChecks).where(eq(qualityChecks.branchId, branchId)).orderBy(desc(qualityChecks.createdAt));
  }

  async getQualityChecksByDate(date: string): Promise<QualityCheck[]> {
    return await db.select().from(qualityChecks).where(eq(qualityChecks.checkDate, date)).orderBy(desc(qualityChecks.createdAt));
  }

  async getQualityCheck(id: number): Promise<QualityCheck | undefined> {
    const [check] = await db.select().from(qualityChecks).where(eq(qualityChecks.id, id));
    return check || undefined;
  }

  async createQualityCheck(check: InsertQualityCheck): Promise<QualityCheck> {
    const [created] = await db.insert(qualityChecks).values(check).returning();
    return created;
  }

  // Daily Operations Summary
  async getDailyOperationsSummary(branchId: string, date: string): Promise<DailyOperationsSummary | undefined> {
    const [summary] = await db
      .select()
      .from(dailyOperationsSummary)
      .where(and(eq(dailyOperationsSummary.branchId, branchId), eq(dailyOperationsSummary.date, date)));
    return summary || undefined;
  }

  async createOrUpdateDailyOperationsSummary(summary: InsertDailyOperationsSummary): Promise<DailyOperationsSummary> {
    const existing = await this.getDailyOperationsSummary(summary.branchId, summary.date);
    
    if (existing) {
      const [updated] = await db
        .update(dailyOperationsSummary)
        .set({ ...summary, updatedAt: new Date() })
        .where(eq(dailyOperationsSummary.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(dailyOperationsSummary).values(summary).returning();
      return created;
    }
  }

  // ==================== Cashier Sales Journal ====================
  
  async getAllCashierJournals(): Promise<CashierSalesJournal[]> {
    return await db.select().from(cashierSalesJournals).orderBy(desc(cashierSalesJournals.journalDate));
  }

  async getCashierJournalsByBranch(branchId: string): Promise<CashierSalesJournal[]> {
    return await db.select().from(cashierSalesJournals)
      .where(eq(cashierSalesJournals.branchId, branchId))
      .orderBy(desc(cashierSalesJournals.journalDate));
  }

  async getCashierJournalsByDate(date: string): Promise<CashierSalesJournal[]> {
    return await db.select().from(cashierSalesJournals)
      .where(eq(cashierSalesJournals.journalDate, date))
      .orderBy(desc(cashierSalesJournals.createdAt));
  }

  async getCashierJournalsByDateRange(startDate: string, endDate: string): Promise<CashierSalesJournal[]> {
    return await db.select().from(cashierSalesJournals)
      .where(and(
        gte(cashierSalesJournals.journalDate, startDate),
        lte(cashierSalesJournals.journalDate, endDate)
      ))
      .orderBy(desc(cashierSalesJournals.journalDate));
  }

  async getCashierJournalsByCashier(cashierId: string): Promise<CashierSalesJournal[]> {
    return await db.select().from(cashierSalesJournals)
      .where(eq(cashierSalesJournals.cashierId, cashierId))
      .orderBy(desc(cashierSalesJournals.journalDate));
  }

  async getCashierJournalsByStatus(status: string): Promise<CashierSalesJournal[]> {
    return await db.select().from(cashierSalesJournals)
      .where(eq(cashierSalesJournals.status, status))
      .orderBy(desc(cashierSalesJournals.journalDate));
  }

  async getCashierJournalsByDiscrepancyStatus(status: string): Promise<CashierSalesJournal[]> {
    return await db.select().from(cashierSalesJournals)
      .where(eq(cashierSalesJournals.discrepancyStatus, status))
      .orderBy(desc(cashierSalesJournals.journalDate));
  }

  async getCashierSalesJournals(filters: { branchId?: string; startDate?: string; endDate?: string; status?: string }): Promise<CashierSalesJournal[]> {
    const conditions: any[] = [];
    if (filters.branchId) conditions.push(eq(cashierSalesJournals.branchId, filters.branchId));
    if (filters.startDate) conditions.push(gte(cashierSalesJournals.journalDate, filters.startDate));
    if (filters.endDate) conditions.push(lte(cashierSalesJournals.journalDate, filters.endDate));
    if (filters.status) conditions.push(eq(cashierSalesJournals.status, filters.status));
    
    if (conditions.length === 0) {
      return await db.select().from(cashierSalesJournals).orderBy(desc(cashierSalesJournals.journalDate));
    }
    
    return await db.select().from(cashierSalesJournals)
      .where(and(...conditions))
      .orderBy(desc(cashierSalesJournals.journalDate));
  }

  async getCashierJournalsFiltered(filters: { 
    branchId?: string;
    branchIds?: string[];
    startDate?: string; 
    endDate?: string; 
    status?: string;
    cashierId?: string;
    discrepancyStatus?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ journals: CashierSalesJournal[]; totalCount: number }> {
    const conditions: any[] = [];
    if (filters.branchId) {
      conditions.push(eq(cashierSalesJournals.branchId, filters.branchId));
    } else if (filters.branchIds && filters.branchIds.length > 0) {
      conditions.push(inArray(cashierSalesJournals.branchId, filters.branchIds));
    }
    if (filters.startDate) conditions.push(gte(cashierSalesJournals.journalDate, filters.startDate));
    if (filters.endDate) conditions.push(lte(cashierSalesJournals.journalDate, filters.endDate));
    if (filters.status) conditions.push(eq(cashierSalesJournals.status, filters.status));
    if (filters.cashierId) conditions.push(eq(cashierSalesJournals.cashierId, filters.cashierId));
    if (filters.discrepancyStatus) conditions.push(eq(cashierSalesJournals.discrepancyStatus, filters.discrepancyStatus));
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get total count first
    const countResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(cashierSalesJournals)
      .where(whereClause);
    const totalCount = countResult[0]?.count || 0;
    
    // Get paginated results
    let query = db.select().from(cashierSalesJournals)
      .where(whereClause)
      .orderBy(desc(cashierSalesJournals.journalDate));
    
    if (filters.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    if (filters.offset) {
      query = query.offset(filters.offset) as typeof query;
    }
    
    const journals = await query;
    
    return { journals, totalCount };
  }

  async getCashierJournal(id: number): Promise<CashierSalesJournal | undefined> {
    const [journal] = await db.select().from(cashierSalesJournals).where(eq(cashierSalesJournals.id, id));
    return journal || undefined;
  }

  async createCashierJournal(journal: InsertCashierSalesJournal): Promise<CashierSalesJournal> {
    // Calculate discrepancy
    const expectedCash = journal.cashTotal || 0;
    const actualCash = journal.actualCashDrawer || 0;
    const discrepancy = actualCash - expectedCash;
    const discrepancyStatus = discrepancy === 0 ? 'balanced' : (discrepancy < 0 ? 'shortage' : 'surplus');
    
    // Calculate average ticket
    const customerCount = journal.customerCount || 0;
    const totalSales = journal.totalSales || 0;
    const averageTicket = customerCount > 0 ? totalSales / customerCount : 0;

    const [created] = await db.insert(cashierSalesJournals).values({
      ...journal,
      expectedCash,
      discrepancyAmount: Math.abs(discrepancy),
      discrepancyStatus,
      averageTicket,
    }).returning();
    return created;
  }

  async updateCashierJournal(id: number, journal: Partial<InsertCashierSalesJournal>): Promise<CashierSalesJournal | undefined> {
    // Recalculate discrepancy if relevant fields changed
    let updateData: any = { ...journal, updatedAt: new Date() };
    
    if (journal.cashTotal !== undefined || journal.actualCashDrawer !== undefined) {
      const existing = await this.getCashierJournal(id);
      if (existing) {
        const expectedCash = journal.cashTotal ?? existing.cashTotal;
        const actualCash = journal.actualCashDrawer ?? existing.actualCashDrawer;
        const discrepancy = actualCash - expectedCash;
        updateData.expectedCash = expectedCash;
        updateData.discrepancyAmount = Math.abs(discrepancy);
        updateData.discrepancyStatus = discrepancy === 0 ? 'balanced' : (discrepancy < 0 ? 'shortage' : 'surplus');
      }
    }

    // Recalculate average ticket
    if (journal.customerCount !== undefined || journal.totalSales !== undefined) {
      const existing = await this.getCashierJournal(id);
      if (existing) {
        const customerCount = journal.customerCount ?? existing.customerCount ?? 0;
        const totalSales = journal.totalSales ?? existing.totalSales;
        updateData.averageTicket = customerCount > 0 ? totalSales / customerCount : 0;
      }
    }

    const [updated] = await db.update(cashierSalesJournals)
      .set(updateData)
      .where(eq(cashierSalesJournals.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCashierJournal(id: number): Promise<boolean> {
    const result = await db.delete(cashierSalesJournals).where(eq(cashierSalesJournals.id, id));
    return true;
  }

  async submitCashierJournal(id: number): Promise<CashierSalesJournal | undefined> {
    const [updated] = await db.update(cashierSalesJournals)
      .set({ status: 'submitted', submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(cashierSalesJournals.id, id))
      .returning();
    return updated || undefined;
  }

  async postCashierJournal(id: number): Promise<CashierSalesJournal | undefined> {
    const [updated] = await db.update(cashierSalesJournals)
      .set({ status: 'posted', updatedAt: new Date() })
      .where(eq(cashierSalesJournals.id, id))
      .returning();
    return updated || undefined;
  }

  async approveCashierJournal(id: number, approvedBy: string): Promise<CashierSalesJournal | undefined> {
    const [updated] = await db.update(cashierSalesJournals)
      .set({ status: 'approved', approvedBy, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(cashierSalesJournals.id, id))
      .returning();
    return updated || undefined;
  }

  async rejectCashierJournal(id: number, notes?: string): Promise<CashierSalesJournal | undefined> {
    const [updated] = await db.update(cashierSalesJournals)
      .set({ status: 'rejected', notes, updatedAt: new Date() })
      .where(eq(cashierSalesJournals.id, id))
      .returning();
    return updated || undefined;
  }

  // Payment Breakdowns
  async getPaymentBreakdowns(journalId: number): Promise<CashierPaymentBreakdown[]> {
    return await db.select().from(cashierPaymentBreakdowns)
      .where(eq(cashierPaymentBreakdowns.journalId, journalId));
  }

  async getPaymentBreakdownsByJournalIds(journalIds: number[]): Promise<CashierPaymentBreakdown[]> {
    if (journalIds.length === 0) return [];
    return await db.select().from(cashierPaymentBreakdowns)
      .where(inArray(cashierPaymentBreakdowns.journalId, journalIds));
  }

  async createPaymentBreakdown(breakdown: InsertCashierPaymentBreakdown): Promise<CashierPaymentBreakdown> {
    const [created] = await db.insert(cashierPaymentBreakdowns).values(breakdown).returning();
    return created;
  }

  async createPaymentBreakdowns(breakdowns: InsertCashierPaymentBreakdown[]): Promise<CashierPaymentBreakdown[]> {
    if (breakdowns.length === 0) return [];
    const created = await db.insert(cashierPaymentBreakdowns).values(breakdowns).returning();
    return created;
  }

  async deletePaymentBreakdowns(journalId: number): Promise<boolean> {
    await db.delete(cashierPaymentBreakdowns).where(eq(cashierPaymentBreakdowns.journalId, journalId));
    return true;
  }

  // Cashier Signatures
  async getCashierSignatures(journalId: number): Promise<CashierSignature[]> {
    return await db.select().from(cashierSignatures)
      .where(eq(cashierSignatures.journalId, journalId));
  }

  async createCashierSignature(signature: InsertCashierSignature): Promise<CashierSignature> {
    const [created] = await db.insert(cashierSignatures).values(signature).returning();
    return created;
  }

  // Journal Attachments
  async getJournalAttachments(journalId: number): Promise<JournalAttachment[]> {
    return await db.select().from(journalAttachments)
      .where(eq(journalAttachments.journalId, journalId));
  }

  async createJournalAttachment(attachment: InsertJournalAttachment): Promise<JournalAttachment> {
    const [created] = await db.insert(journalAttachments).values(attachment).returning();
    return created;
  }

  async deleteJournalAttachment(id: number): Promise<boolean> {
    await db.delete(journalAttachments).where(eq(journalAttachments.id, id));
    return true;
  }

  async deleteJournalAttachments(journalId: number): Promise<boolean> {
    await db.delete(journalAttachments).where(eq(journalAttachments.journalId, journalId));
    return true;
  }

  async getCashierJournalStats(branchId?: string): Promise<{
    totalJournals: number;
    totalSales: number;
    totalShortages: number;
    totalSurpluses: number;
    shortageAmount: number;
    surplusAmount: number;
    averageTicket: number;
  }> {
    const conditions = branchId ? [eq(cashierSalesJournals.branchId, branchId)] : [];
    const result = await db.select({
      totalJournals: sql<number>`count(*)::int`,
      totalSales: sql<number>`coalesce(sum(total_sales), 0)::numeric`,
      totalShortages: sql<number>`count(*) filter (where discrepancy_status = 'shortage')::int`,
      totalSurpluses: sql<number>`count(*) filter (where discrepancy_status = 'surplus')::int`,
      shortageAmount: sql<number>`coalesce(sum(discrepancy_amount) filter (where discrepancy_status = 'shortage'), 0)::numeric`,
      surplusAmount: sql<number>`coalesce(sum(discrepancy_amount) filter (where discrepancy_status = 'surplus'), 0)::numeric`,
      averageTicket: sql<number>`coalesce(avg(average_ticket) filter (where average_ticket > 0), 0)::numeric`,
    }).from(cashierSalesJournals)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const row = result[0];
    return {
      totalJournals: Number(row?.totalJournals || 0),
      totalSales: Number(row?.totalSales || 0),
      totalShortages: Number(row?.totalShortages || 0),
      totalSurpluses: Number(row?.totalSurpluses || 0),
      shortageAmount: Number(row?.shortageAmount || 0),
      surplusAmount: Number(row?.surplusAmount || 0),
      averageTicket: Number(row?.averageTicket || 0),
    };
  }

  // Comprehensive Operations Reports - OPTIMIZED with SQL aggregation
  async getOperationsReport(filters: {
    branchId?: string;
    branchIds?: string[];
    startDate?: string;
    endDate?: string;
  }): Promise<{
    salesReport: {
      totalSales: number;
      cashSales: number;
      networkSales: number;
      deliverySales: number;
      totalTransactions: number;
      averageTicket: number;
      totalShortages: number;
      shortageAmount: number;
      totalSurpluses: number;
      surplusAmount: number;
      journalsByStatus: { status: string; count: number }[];
      paymentMethodBreakdown: { method: string; amount: number; count: number }[];
      dailySales: { date: string; sales: number; transactions: number }[];
    };
    productionReport: {
      totalOrders: number;
      pendingOrders: number;
      inProgressOrders: number;
      completedOrders: number;
      cancelledOrders: number;
      totalQuantityProduced: number;
      qualityPassRate: number;
      qualityChecks: { status: string; count: number }[];
      ordersByProduct: { productName: string; quantity: number; orderCount: number }[];
      dailyProduction: { date: string; quantity: number; orders: number }[];
      actualProduction: {
        totalBatches: number;
        finishedBatches: number;
        inProgressBatches: number;
        totalQuantity: number;
        byDestination: { destination: string; count: number; quantity: number }[];
        byCategory: { category: string; count: number; quantity: number }[];
        byProduct: { productName: string; quantity: number; batchCount: number }[];
        dailyActual: { date: string; quantity: number; batches: number }[];
        byChef: { chefName: string; batchCount: number; totalQuantity: number }[];
      };
    };
    shiftsReport: {
      totalShifts: number;
      shiftsWithEmployees: number;
      totalEmployeeAssignments: number;
      shiftsByType: { type: string; count: number }[];
      employeesByRole: { role: string; count: number }[];
    };
    branchComparison: {
      branchId: string;
      branchName: string;
      totalSales: number;
      totalOrders: number;
      qualityPassRate: number;
      averageTicket: number;
    }[];
  }> {
    const { branchId, branchIds, startDate, endDate } = filters;
    
    // Build WHERE conditions for SQL queries
    const journalConditions: any[] = [];
    if (branchId) {
      journalConditions.push(eq(cashierSalesJournals.branchId, branchId));
    } else if (branchIds && branchIds.length > 0) {
      journalConditions.push(inArray(cashierSalesJournals.branchId, branchIds));
    }
    if (startDate) journalConditions.push(gte(cashierSalesJournals.journalDate, startDate));
    if (endDate) journalConditions.push(lte(cashierSalesJournals.journalDate, endDate));

    // OPTIMIZED: Fetch journals with SQL WHERE instead of fetching all
    const allJournals = await db.select()
      .from(cashierSalesJournals)
      .where(journalConditions.length > 0 ? and(...journalConditions) : undefined)
      .orderBy(desc(cashierSalesJournals.journalDate));

    // Also fetch Event POS sales for the same filters
    const posConditions: any[] = [];
    if (branchId) {
      posConditions.push(eq(posSales.branchId, branchId));
    } else if (branchIds && branchIds.length > 0) {
      posConditions.push(inArray(posSales.branchId, branchIds));
    }
    if (startDate) posConditions.push(gte(posSales.saleDate, startDate));
    if (endDate) posConditions.push(lte(posSales.saleDate, endDate));

    const allPosSales = await db.select()
      .from(posSales)
      .where(posConditions.length > 0 ? and(...posConditions) : undefined);

    const completedPosSales = allPosSales.filter(s => s.status === 'completed');

    // POS sales aggregation
    const posTotalSales = completedPosSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const posCashSales = completedPosSales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const posNetworkSales = completedPosSales.filter(s => s.paymentMethod === 'network').reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const posTotalTransactions = completedPosSales.length;

    // Sales Report calculations - combine journal data + POS data
    const totalSales = allJournals.reduce((sum, j) => sum + j.totalSales, 0) + posTotalSales;
    const cashSales = allJournals.reduce((sum, j) => sum + j.cashTotal, 0) + posCashSales;
    const networkSales = allJournals.reduce((sum, j) => sum + (j.networkTotal || 0), 0) + posNetworkSales;
    const deliverySales = allJournals.reduce((sum, j) => sum + (j.deliveryTotal || 0), 0);
    const totalTransactions = allJournals.reduce((sum, j) => sum + (j.transactionCount || 0), 0) + posTotalTransactions;
    const avgTickets = allJournals.filter(j => j.averageTicket && j.averageTicket > 0);
    const averageTicket = avgTickets.length > 0 
      ? avgTickets.reduce((sum, j) => sum + (j.averageTicket || 0), 0) / avgTickets.length 
      : totalTransactions > 0 ? totalSales / totalTransactions : 0;
    
    const shortageJournals = allJournals.filter(j => j.discrepancyStatus === 'shortage');
    const surplusJournals = allJournals.filter(j => j.discrepancyStatus === 'surplus');
    const totalShortages = shortageJournals.length;
    const shortageAmount = shortageJournals.reduce((sum, j) => sum + Math.abs(j.discrepancyAmount), 0);
    const totalSurpluses = surplusJournals.length;
    const surplusAmount = surplusJournals.reduce((sum, j) => sum + j.discrepancyAmount, 0);

    // Journals by status
    const statusCounts: Record<string, number> = {};
    allJournals.forEach(j => {
      statusCounts[j.status] = (statusCounts[j.status] || 0) + 1;
    });
    if (completedPosSales.length > 0) {
      statusCounts['completed'] = (statusCounts['completed'] || 0) + completedPosSales.length;
    }
    const journalsByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    // OPTIMIZED: Payment method breakdown with single JOIN query instead of N+1
    const journalIds = allJournals.map(j => j.id);
    let paymentMethodBreakdown: { method: string; amount: number; count: number }[] = [];
    if (journalIds.length > 0) {
      const paymentAggregates = await db.select({
        paymentMethod: cashierPaymentBreakdowns.paymentMethod,
        totalAmount: sql<number>`COALESCE(SUM(${cashierPaymentBreakdowns.amount}), 0)`,
        totalCount: sql<number>`COALESCE(SUM(${cashierPaymentBreakdowns.transactionCount}), 0)`,
      })
        .from(cashierPaymentBreakdowns)
        .where(inArray(cashierPaymentBreakdowns.journalId, journalIds))
        .groupBy(cashierPaymentBreakdowns.paymentMethod);
      
      paymentMethodBreakdown = paymentAggregates
        .map(p => ({ method: p.paymentMethod, amount: Number(p.totalAmount), count: Number(p.totalCount) }))
        .sort((a, b) => b.amount - a.amount);
    }

    // Add POS payment methods to breakdown
    if (posCashSales > 0) {
      const existingCash = paymentMethodBreakdown.find(p => p.method === 'cash');
      if (existingCash) {
        existingCash.amount += posCashSales;
        existingCash.count += completedPosSales.filter(s => s.paymentMethod === 'cash').length;
      } else {
        paymentMethodBreakdown.push({ method: 'cash', amount: posCashSales, count: completedPosSales.filter(s => s.paymentMethod === 'cash').length });
      }
    }
    if (posNetworkSales > 0) {
      const existingNetwork = paymentMethodBreakdown.find(p => p.method === 'mada');
      if (existingNetwork) {
        existingNetwork.amount += posNetworkSales;
        existingNetwork.count += completedPosSales.filter(s => s.paymentMethod === 'network').length;
      } else {
        paymentMethodBreakdown.push({ method: 'mada', amount: posNetworkSales, count: completedPosSales.filter(s => s.paymentMethod === 'network').length });
      }
    }
    paymentMethodBreakdown.sort((a, b) => b.amount - a.amount);

    // Daily sales - combine journal data + POS data
    const dailySalesMap: Record<string, { sales: number; transactions: number }> = {};
    allJournals.forEach(j => {
      if (!dailySalesMap[j.journalDate]) {
        dailySalesMap[j.journalDate] = { sales: 0, transactions: 0 };
      }
      dailySalesMap[j.journalDate].sales += j.totalSales;
      dailySalesMap[j.journalDate].transactions += j.transactionCount || 0;
    });
    completedPosSales.forEach(s => {
      if (!dailySalesMap[s.saleDate]) {
        dailySalesMap[s.saleDate] = { sales: 0, transactions: 0 };
      }
      dailySalesMap[s.saleDate].sales += s.totalAmount || 0;
      dailySalesMap[s.saleDate].transactions += 1;
    });
    const dailySales = Object.entries(dailySalesMap)
      .map(([date, data]) => ({ date, sales: data.sales, transactions: data.transactions }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // OPTIMIZED: Production Report with SQL WHERE
    const orderConditions: any[] = [];
    if (branchId) {
      orderConditions.push(eq(productionOrders.branchId, branchId));
    } else if (branchIds && branchIds.length > 0) {
      orderConditions.push(inArray(productionOrders.branchId, branchIds));
    }
    if (startDate) orderConditions.push(gte(productionOrders.scheduledDate, startDate));
    if (endDate) orderConditions.push(lte(productionOrders.scheduledDate, endDate));

    const allOrders = await db.select()
      .from(productionOrders)
      .where(orderConditions.length > 0 ? and(...orderConditions) : undefined);

    const totalOrders = allOrders.length;
    const pendingOrders = allOrders.filter(o => o.status === 'pending').length;
    const inProgressOrders = allOrders.filter(o => o.status === 'in_progress').length;
    const completedOrders = allOrders.filter(o => o.status === 'completed').length;
    const cancelledOrders = allOrders.filter(o => o.status === 'cancelled').length;
    const totalQuantityProduced = allOrders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + (o.producedQuantity || 0), 0);

    // OPTIMIZED: Quality checks with SQL WHERE using order IDs
    const orderIds = allOrders.map(o => o.id);
    let qualityPassRate = 100;
    let qualityChecksResult: { status: string; count: number }[] = [];
    
    if (orderIds.length > 0) {
      const relevantChecks = await db.select()
        .from(qualityChecks)
        .where(inArray(qualityChecks.productionOrderId, orderIds));
      
      const passedChecks = relevantChecks.filter(qc => qc.result === 'passed').length;
      qualityPassRate = relevantChecks.length > 0 
        ? (passedChecks / relevantChecks.length) * 100 
        : 100;
      
      const qualityStatusCounts: Record<string, number> = {};
      relevantChecks.forEach(qc => {
        qualityStatusCounts[qc.result] = (qualityStatusCounts[qc.result] || 0) + 1;
      });
      qualityChecksResult = Object.entries(qualityStatusCounts).map(([status, count]) => ({ status, count }));
    }

    // OPTIMIZED: Orders by product with JOIN
    const products = await this.getAllProducts();
    const productOrderMap: Record<number, { productName: string; quantity: number; orderCount: number }> = {};
    for (const order of allOrders) {
      const product = products.find(p => p.id === order.productId);
      if (!productOrderMap[order.productId]) {
        productOrderMap[order.productId] = {
          productName: product?.name || `منتج ${order.productId}`,
          quantity: 0,
          orderCount: 0
        };
      }
      productOrderMap[order.productId].quantity += (order.producedQuantity || 0);
      productOrderMap[order.productId].orderCount += 1;
    }
    const ordersByProduct = Object.values(productOrderMap).sort((a, b) => b.quantity - a.quantity);

    // Daily production
    const dailyProductionMap: Record<string, { quantity: number; orders: number }> = {};
    allOrders.forEach(o => {
      const orderDate = o.scheduledDate || '';
      if (orderDate && !dailyProductionMap[orderDate]) {
        dailyProductionMap[orderDate] = { quantity: 0, orders: 0 };
      }
      if (orderDate) {
        dailyProductionMap[orderDate].quantity += (o.producedQuantity || 0);
        dailyProductionMap[orderDate].orders += 1;
      }
    });
    const dailyProduction = Object.entries(dailyProductionMap)
      .map(([date, data]) => ({ date, quantity: data.quantity, orders: data.orders }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Actual Production (daily_production_batches) - real production data
    const batchConditions: any[] = [];
    if (branchId) {
      batchConditions.push(eq(dailyProductionBatches.branchId, branchId));
    } else if (branchIds && branchIds.length > 0) {
      batchConditions.push(inArray(dailyProductionBatches.branchId, branchIds));
    }
    if (startDate) batchConditions.push(gte(dailyProductionBatches.productionDate, startDate));
    if (endDate) batchConditions.push(lte(dailyProductionBatches.productionDate, endDate));

    const allBatches = await db.select()
      .from(dailyProductionBatches)
      .where(batchConditions.length > 0 ? and(...batchConditions) : undefined);

    const finishedBatches = allBatches.filter(b => b.status === 'finished');
    const inProgressBatches = allBatches.filter(b => b.status === 'in_progress');
    const totalActualQuantity = finishedBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);

    const destMap: Record<string, { count: number; quantity: number }> = {};
    allBatches.forEach(b => {
      const dest = b.destination || 'other';
      if (!destMap[dest]) destMap[dest] = { count: 0, quantity: 0 };
      destMap[dest].count++;
      destMap[dest].quantity += b.quantity || 0;
    });
    const byDestination = Object.entries(destMap).map(([destination, d]) => ({ destination, ...d }));

    const catMap: Record<string, { count: number; quantity: number }> = {};
    allBatches.forEach(b => {
      const cat = b.productCategory || 'أخرى';
      if (!catMap[cat]) catMap[cat] = { count: 0, quantity: 0 };
      catMap[cat].count++;
      catMap[cat].quantity += b.quantity || 0;
    });
    const byCategory = Object.entries(catMap).map(([category, d]) => ({ category, ...d })).sort((a, b) => b.quantity - a.quantity);

    const prodMap: Record<string, { quantity: number; batchCount: number }> = {};
    allBatches.forEach(b => {
      const name = b.productName || 'غير معروف';
      if (!prodMap[name]) prodMap[name] = { quantity: 0, batchCount: 0 };
      prodMap[name].quantity += b.quantity || 0;
      prodMap[name].batchCount++;
    });
    const byProduct = Object.entries(prodMap).map(([productName, d]) => ({ productName, ...d })).sort((a, b) => b.quantity - a.quantity);

    const dailyActualMap: Record<string, { quantity: number; batches: number }> = {};
    allBatches.forEach(b => {
      const d = b.productionDate || '';
      if (!d) return;
      if (!dailyActualMap[d]) dailyActualMap[d] = { quantity: 0, batches: 0 };
      dailyActualMap[d].quantity += b.quantity || 0;
      dailyActualMap[d].batches++;
    });
    const dailyActual = Object.entries(dailyActualMap).map(([date, d]) => ({ date, ...d })).sort((a, b) => a.date.localeCompare(b.date));

    const chefMap: Record<string, { batchCount: number; totalQuantity: number }> = {};
    allBatches.forEach(b => {
      const name = b.chefName || b.recorderName || 'غير معروف';
      if (!chefMap[name]) chefMap[name] = { batchCount: 0, totalQuantity: 0 };
      chefMap[name].batchCount++;
      chefMap[name].totalQuantity += b.quantity || 0;
    });
    const byChef = Object.entries(chefMap).map(([chefName, d]) => ({ chefName, ...d })).sort((a, b) => b.totalQuantity - a.totalQuantity);

    const actualProduction = {
      totalBatches: allBatches.length,
      finishedBatches: finishedBatches.length,
      inProgressBatches: inProgressBatches.length,
      totalQuantity: totalActualQuantity,
      byDestination,
      byCategory,
      byProduct,
      dailyActual,
      byChef,
    };

    // Shifts Report - using employee_schedules table (main schedule data)
    const scheduleConditions: any[] = [];
    if (branchId) {
      scheduleConditions.push(eq(employeeSchedules.branchId, branchId));
    } else if (branchIds && branchIds.length > 0) {
      scheduleConditions.push(inArray(employeeSchedules.branchId, branchIds));
    }
    if (startDate) scheduleConditions.push(gte(employeeSchedules.scheduleDate, startDate));
    if (endDate) scheduleConditions.push(lte(employeeSchedules.scheduleDate, endDate));

    const allSchedules = await db.select()
      .from(employeeSchedules)
      .where(scheduleConditions.length > 0 ? and(...scheduleConditions) : undefined);

    const workSchedules = allSchedules.filter(s => !s.isOff);
    const uniqueShiftDays = new Set(workSchedules.map(s => `${s.branchId}_${s.scheduleDate}_${s.shiftType}`));
    const totalShifts = uniqueShiftDays.size;
    
    const shiftsWithEmployeesMap = new Map<string, Set<string>>();
    workSchedules.forEach(s => {
      const key = `${s.branchId}_${s.scheduleDate}_${s.shiftType}`;
      if (!shiftsWithEmployeesMap.has(key)) shiftsWithEmployeesMap.set(key, new Set());
      shiftsWithEmployeesMap.get(key)!.add(s.employeeId);
    });
    const shiftsWithEmployees = Array.from(shiftsWithEmployeesMap.values()).filter(empSet => empSet.size > 0).length;
    const totalEmployeeAssignments = workSchedules.length;
    
    const shiftTypeCounts: Record<string, number> = {};
    workSchedules.forEach(s => {
      const type = s.shiftType === 'morning' ? 'صباحي' : s.shiftType === 'evening' ? 'مسائي' : s.shiftType === 'night' ? 'ليلي' : (s.shiftType || 'غير محدد');
      shiftTypeCounts[type] = (shiftTypeCounts[type] || 0) + 1;
    });
    const shiftsByType = Object.entries(shiftTypeCounts).map(([type, count]) => ({ type, count }));

    const roleCounts: Record<string, number> = {};
    workSchedules.forEach(s => {
      const empName = s.employeeName || 'غير محدد';
      roleCounts[empName] = (roleCounts[empName] || 0) + 1;
    });
    const employeesByRole = Object.entries(roleCounts)
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Branch Comparison - SECURITY: Only include authorized branches
    const allBranches = await this.getAllBranches();
    let branchesToCompare;
    if (branchId) {
      branchesToCompare = allBranches.filter(b => b.id === branchId);
    } else if (branchIds && branchIds.length > 0) {
      branchesToCompare = allBranches.filter(b => branchIds.includes(b.id));
    } else {
      branchesToCompare = allBranches;
    }
    
    // Pre-group data by branch for efficient comparison
    const journalsByBranch = new Map<string, typeof allJournals>();
    const ordersByBranch = new Map<string, typeof allOrders>();
    
    allJournals.forEach(j => {
      if (!journalsByBranch.has(j.branchId)) journalsByBranch.set(j.branchId, []);
      journalsByBranch.get(j.branchId)!.push(j);
    });
    allOrders.forEach(o => {
      if (!ordersByBranch.has(o.branchId)) ordersByBranch.set(o.branchId, []);
      ordersByBranch.get(o.branchId)!.push(o);
    });

    const posSalesByBranch = new Map<string, typeof completedPosSales>();
    completedPosSales.forEach(s => {
      if (!posSalesByBranch.has(s.branchId)) posSalesByBranch.set(s.branchId, []);
      posSalesByBranch.get(s.branchId)!.push(s);
    });

    const branchComparison = branchesToCompare.map(branch => {
      const branchJournals = journalsByBranch.get(branch.id) || [];
      const branchOrders = ordersByBranch.get(branch.id) || [];
      const branchPosSales = posSalesByBranch.get(branch.id) || [];
      const journalSales = branchJournals.reduce((sum, j) => sum + j.totalSales, 0);
      const posSalesTotal = branchPosSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      const branchSales = journalSales + posSalesTotal;
      const journalTransactions = branchJournals.reduce((sum, j) => sum + (j.transactionCount || 0), 0);
      const branchTransactions = journalTransactions + branchPosSales.length;

      return {
        branchId: branch.id,
        branchName: branch.name,
        totalSales: branchSales,
        totalOrders: branchOrders.length,
        qualityPassRate: 100,
        averageTicket: branchTransactions > 0 ? branchSales / branchTransactions : 0,
      };
    });

    return {
      salesReport: {
        totalSales,
        cashSales,
        networkSales,
        deliverySales,
        totalTransactions,
        averageTicket,
        totalShortages,
        shortageAmount,
        totalSurpluses,
        surplusAmount,
        journalsByStatus,
        paymentMethodBreakdown,
        dailySales,
      },
      productionReport: {
        totalOrders,
        pendingOrders,
        inProgressOrders,
        completedOrders,
        cancelledOrders,
        totalQuantityProduced,
        qualityPassRate,
        qualityChecks: qualityChecksResult,
        ordersByProduct,
        dailyProduction,
        actualProduction,
      },
      shiftsReport: {
        totalShifts,
        shiftsWithEmployees,
        totalEmployeeAssignments,
        shiftsByType,
        employeesByRole,
      },
      branchComparison,
    };
  }

  // ==========================================
  // Targets & Incentives - Weight Profiles
  // ==========================================
  
  async getAllTargetWeightProfiles(): Promise<TargetWeightProfile[]> {
    return db.select().from(targetWeightProfiles).orderBy(desc(targetWeightProfiles.createdAt));
  }

  async getTargetWeightProfile(id: number): Promise<TargetWeightProfile | undefined> {
    const [profile] = await db.select().from(targetWeightProfiles).where(eq(targetWeightProfiles.id, id));
    return profile || undefined;
  }

  async getDefaultTargetWeightProfile(): Promise<TargetWeightProfile | undefined> {
    const [profile] = await db.select().from(targetWeightProfiles).where(eq(targetWeightProfiles.isDefault, true));
    return profile || undefined;
  }

  async createTargetWeightProfile(profile: InsertTargetWeightProfile): Promise<TargetWeightProfile> {
    const [created] = await db.insert(targetWeightProfiles).values(profile).returning();
    return created;
  }

  async updateTargetWeightProfile(id: number, profile: Partial<InsertTargetWeightProfile>): Promise<TargetWeightProfile | undefined> {
    const [updated] = await db.update(targetWeightProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(targetWeightProfiles.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTargetWeightProfile(id: number): Promise<boolean> {
    const result = await db.delete(targetWeightProfiles).where(eq(targetWeightProfiles.id, id));
    return true;
  }

  // ==========================================
  // Targets & Incentives - Monthly Targets
  // ==========================================
  
  async getAllBranchMonthlyTargets(): Promise<BranchMonthlyTarget[]> {
    return db.select().from(branchMonthlyTargets).orderBy(desc(branchMonthlyTargets.yearMonth));
  }

  async getBranchMonthlyTargetsByBranch(branchId: string): Promise<BranchMonthlyTarget[]> {
    return db.select().from(branchMonthlyTargets)
      .where(eq(branchMonthlyTargets.branchId, branchId))
      .orderBy(desc(branchMonthlyTargets.yearMonth));
  }

  async getBranchMonthlyTarget(id: number): Promise<BranchMonthlyTarget | undefined> {
    const [target] = await db.select().from(branchMonthlyTargets).where(eq(branchMonthlyTargets.id, id));
    return target || undefined;
  }

  async getBranchMonthlyTargetByMonth(branchId: string, yearMonth: string): Promise<BranchMonthlyTarget | undefined> {
    const [target] = await db.select().from(branchMonthlyTargets)
      .where(and(eq(branchMonthlyTargets.branchId, branchId), eq(branchMonthlyTargets.yearMonth, yearMonth)));
    return target || undefined;
  }

  async createBranchMonthlyTarget(target: InsertBranchMonthlyTarget): Promise<BranchMonthlyTarget> {
    const [created] = await db.insert(branchMonthlyTargets).values(target).returning();
    return created;
  }

  async updateBranchMonthlyTarget(id: number, target: Partial<InsertBranchMonthlyTarget>): Promise<BranchMonthlyTarget | undefined> {
    const [updated] = await db.update(branchMonthlyTargets)
      .set({ ...target, updatedAt: new Date() })
      .where(eq(branchMonthlyTargets.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteBranchMonthlyTarget(id: number): Promise<boolean> {
    await db.delete(branchMonthlyTargets).where(eq(branchMonthlyTargets.id, id));
    return true;
  }

  // ==========================================
  // Targets & Incentives - Daily Allocations
  // ==========================================
  
  async getTargetDailyAllocationsByMonth(monthlyTargetId: number): Promise<TargetDailyAllocation[]> {
    return db.select().from(targetDailyAllocations)
      .where(eq(targetDailyAllocations.monthlyTargetId, monthlyTargetId))
      .orderBy(targetDailyAllocations.targetDate);
  }

  async getTargetDailyAllocation(id: number): Promise<TargetDailyAllocation | undefined> {
    const [allocation] = await db.select().from(targetDailyAllocations).where(eq(targetDailyAllocations.id, id));
    return allocation || undefined;
  }

  async createTargetDailyAllocation(allocation: InsertTargetDailyAllocation): Promise<TargetDailyAllocation> {
    const [created] = await db.insert(targetDailyAllocations).values(allocation).returning();
    return created;
  }

  async updateTargetDailyAllocation(id: number, allocation: Partial<InsertTargetDailyAllocation>): Promise<TargetDailyAllocation | undefined> {
    const [updated] = await db.update(targetDailyAllocations)
      .set({ ...allocation, updatedAt: new Date() })
      .where(eq(targetDailyAllocations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTargetDailyAllocation(id: number): Promise<boolean> {
    await db.delete(targetDailyAllocations).where(eq(targetDailyAllocations.id, id));
    return true;
  }

  async bulkCreateTargetDailyAllocations(allocations: InsertTargetDailyAllocation[]): Promise<TargetDailyAllocation[]> {
    if (allocations.length === 0) return [];
    return db.insert(targetDailyAllocations).values(allocations).returning();
  }

  // ==========================================
  // Targets & Incentives - Shift Allocations
  // ==========================================
  
  async getTargetShiftAllocationsByDaily(dailyAllocationId: number): Promise<TargetShiftAllocation[]> {
    return db.select().from(targetShiftAllocations)
      .where(eq(targetShiftAllocations.dailyAllocationId, dailyAllocationId));
  }

  async createTargetShiftAllocation(allocation: InsertTargetShiftAllocation): Promise<TargetShiftAllocation> {
    const [created] = await db.insert(targetShiftAllocations).values(allocation).returning();
    return created;
  }

  async deleteTargetShiftAllocationsByDaily(dailyAllocationId: number): Promise<boolean> {
    await db.delete(targetShiftAllocations).where(eq(targetShiftAllocations.dailyAllocationId, dailyAllocationId));
    return true;
  }

  // ==========================================
  // Targets & Incentives - Incentive Tiers
  // ==========================================
  
  async getAllIncentiveTiers(): Promise<IncentiveTier[]> {
    return db.select().from(incentiveTiers).orderBy(incentiveTiers.sortOrder);
  }

  async getActiveIncentiveTiers(): Promise<IncentiveTier[]> {
    return db.select().from(incentiveTiers)
      .where(eq(incentiveTiers.isActive, true))
      .orderBy(incentiveTiers.sortOrder);
  }

  async getIncentiveTier(id: number): Promise<IncentiveTier | undefined> {
    const [tier] = await db.select().from(incentiveTiers).where(eq(incentiveTiers.id, id));
    return tier || undefined;
  }

  async createIncentiveTier(tier: InsertIncentiveTier): Promise<IncentiveTier> {
    const [created] = await db.insert(incentiveTiers).values(tier).returning();
    return created;
  }

  async updateIncentiveTier(id: number, tier: Partial<InsertIncentiveTier>): Promise<IncentiveTier | undefined> {
    const [updated] = await db.update(incentiveTiers)
      .set({ ...tier, updatedAt: new Date() })
      .where(eq(incentiveTiers.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteIncentiveTier(id: number): Promise<boolean> {
    await db.delete(incentiveTiers).where(eq(incentiveTiers.id, id));
    return true;
  }

  // ==========================================
  // Targets & Incentives - Incentive Awards
  // ==========================================
  
  async getAllIncentiveAwards(): Promise<IncentiveAward[]> {
    return db.select().from(incentiveAwards).orderBy(desc(incentiveAwards.createdAt));
  }

  async getIncentiveAwardsByBranch(branchId: string): Promise<IncentiveAward[]> {
    return db.select().from(incentiveAwards)
      .where(eq(incentiveAwards.branchId, branchId))
      .orderBy(desc(incentiveAwards.createdAt));
  }

  async getIncentiveAwardsByCashier(cashierId: string): Promise<IncentiveAward[]> {
    return db.select().from(incentiveAwards)
      .where(eq(incentiveAwards.cashierId, cashierId))
      .orderBy(desc(incentiveAwards.createdAt));
  }

  async getIncentiveAward(id: number): Promise<IncentiveAward | undefined> {
    const [award] = await db.select().from(incentiveAwards).where(eq(incentiveAwards.id, id));
    return award || undefined;
  }

  async createIncentiveAward(award: InsertIncentiveAward): Promise<IncentiveAward> {
    const [created] = await db.insert(incentiveAwards).values(award).returning();
    return created;
  }

  async updateIncentiveAward(id: number, award: Partial<InsertIncentiveAward>): Promise<IncentiveAward | undefined> {
    const [updated] = await db.update(incentiveAwards)
      .set({ ...award, updatedAt: new Date() })
      .where(eq(incentiveAwards.id, id))
      .returning();
    return updated || undefined;
  }

  async approveIncentiveAward(id: number, approvedBy: string): Promise<IncentiveAward | undefined> {
    const [updated] = await db.update(incentiveAwards)
      .set({ status: 'approved', approvedBy, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(incentiveAwards.id, id))
      .returning();
    return updated || undefined;
  }

  async markIncentiveAwardAsPaid(id: number): Promise<IncentiveAward | undefined> {
    const [updated] = await db.update(incentiveAwards)
      .set({ status: 'paid', paidAt: new Date(), updatedAt: new Date() })
      .where(eq(incentiveAwards.id, id))
      .returning();
    return updated || undefined;
  }

  // ==========================================
  // Targets Performance Calculation
  // ==========================================
  
  async calculateBranchPerformance(branchId: string, yearMonth: string): Promise<{
    targetAmount: number;
    achievedAmount: number;
    achievementPercent: number;
    dailyPerformance: { date: string; target: number; achieved: number; percent: number }[];
  }> {
    const target = await this.getBranchMonthlyTargetByMonth(branchId, yearMonth);
    if (!target) {
      return { targetAmount: 0, achievedAmount: 0, achievementPercent: 0, dailyPerformance: [] };
    }

    const dailyAllocations = await this.getTargetDailyAllocationsByMonth(target.id);
    const journals = await this.getCashierJournalsByBranch(branchId);
    
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-31`;
    const monthJournals = journals.filter((j: CashierSalesJournal) => 
      j.journalDate >= startDate && j.journalDate <= endDate && (j.status === 'approved' || j.status === 'posted')
    );

    const dailySalesMap: Record<string, number> = {};
    monthJournals.forEach((j: CashierSalesJournal) => {
      dailySalesMap[j.journalDate] = (dailySalesMap[j.journalDate] || 0) + j.totalSales;
    });

    const dailyPerformance = dailyAllocations.map(alloc => {
      const achieved = dailySalesMap[alloc.targetDate] || 0;
      const percent = alloc.dailyTarget > 0 ? (achieved / alloc.dailyTarget) * 100 : 0;
      return {
        date: alloc.targetDate,
        target: alloc.dailyTarget,
        achieved,
        percent
      };
    });

    const achievedAmount = monthJournals.reduce((sum: number, j: CashierSalesJournal) => sum + j.totalSales, 0);
    const achievementPercent = target.targetAmount > 0 ? (achievedAmount / target.targetAmount) * 100 : 0;

    return {
      targetAmount: target.targetAmount,
      achievedAmount,
      achievementPercent,
      dailyPerformance
    };
  }

  async getLeaderboard(yearMonth: string): Promise<{
    branches: { branchId: string; branchName: string; target: number; achieved: number; percent: number; rank: number }[];
    cashiers: { cashierId: string; cashierName: string; branchId: string; target: number; achieved: number; percent: number; rank: number }[];
  }> {
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-31`;
    
    const [allBranches, allTargets, branchSalesResult, cashierSalesResult] = await Promise.all([
      this.getAllBranches(),
      this.getAllBranchMonthlyTargets(),
      db.select({
        branchId: cashierSalesJournals.branchId,
        totalSales: sql<number>`coalesce(sum(total_sales), 0)::numeric`,
      }).from(cashierSalesJournals)
        .where(and(
          gte(cashierSalesJournals.journalDate, startDate),
          lte(cashierSalesJournals.journalDate, endDate),
          or(
            eq(cashierSalesJournals.status, 'approved'),
            eq(cashierSalesJournals.status, 'posted')
          )
        ))
        .groupBy(cashierSalesJournals.branchId),
      db.select({
        cashierId: cashierSalesJournals.cashierId,
        cashierName: cashierSalesJournals.cashierName,
        branchId: cashierSalesJournals.branchId,
        totalSales: sql<number>`coalesce(sum(total_sales), 0)::numeric`,
      }).from(cashierSalesJournals)
        .where(and(
          gte(cashierSalesJournals.journalDate, startDate),
          lte(cashierSalesJournals.journalDate, endDate),
          or(
            eq(cashierSalesJournals.status, 'approved'),
            eq(cashierSalesJournals.status, 'posted')
          )
        ))
        .groupBy(cashierSalesJournals.cashierId, cashierSalesJournals.cashierName, cashierSalesJournals.branchId),
    ]);

    const monthTargets = allTargets.filter(t => t.yearMonth === yearMonth);
    const branchSalesMap: Record<string, number> = {};
    for (const row of branchSalesResult) {
      branchSalesMap[row.branchId] = Number(row.totalSales);
    }

    const branchPerformance = allBranches.map(branch => {
      const branchTarget = monthTargets.find(t => t.branchId === branch.id);
      const achieved = branchSalesMap[branch.id] || 0;
      const target = branchTarget?.targetAmount || 0;
      const percent = target > 0 ? (achieved / target) * 100 : 0;
      return { branchId: branch.id, branchName: branch.name, target, achieved, percent, rank: 0 };
    });

    branchPerformance.sort((a, b) => b.percent - a.percent);
    branchPerformance.forEach((b, i) => b.rank = i + 1);

    const cashierPerformance = cashierSalesResult.map(row => {
      const branchTarget = monthTargets.find(t => t.branchId === row.branchId);
      const target = branchTarget?.targetAmount ? branchTarget.targetAmount / 30 : 0;
      const achieved = Number(row.totalSales);
      const percent = target > 0 ? (achieved / target) * 100 : 0;
      return {
        cashierId: row.cashierId,
        cashierName: row.cashierName,
        branchId: row.branchId,
        target,
        achieved,
        percent,
        rank: 0
      };
    });

    cashierPerformance.sort((a, b) => b.achieved - a.achieved);
    cashierPerformance.forEach((c, i) => c.rank = i + 1);

    return {
      branches: branchPerformance,
      cashiers: cashierPerformance.slice(0, 20)
    };
  }

  // ==========================================
  // Seasons & Holidays Management
  // ==========================================

  async getAllSeasonsHolidays(): Promise<SeasonHoliday[]> {
    return await db.select().from(seasonsHolidays).orderBy(seasonsHolidays.startDate);
  }

  async getActiveSeasonsHolidays(): Promise<SeasonHoliday[]> {
    return await db.select().from(seasonsHolidays)
      .where(eq(seasonsHolidays.isActive, true))
      .orderBy(seasonsHolidays.startDate);
  }

  async createSeasonHoliday(data: InsertSeasonHoliday): Promise<SeasonHoliday> {
    const [inserted] = await db.insert(seasonsHolidays).values(data).returning();
    return inserted;
  }

  async updateSeasonHoliday(id: number, data: Partial<InsertSeasonHoliday>): Promise<SeasonHoliday | undefined> {
    const [updated] = await db.update(seasonsHolidays)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(seasonsHolidays.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSeasonHoliday(id: number): Promise<void> {
    await db.delete(seasonsHolidays).where(eq(seasonsHolidays.id, id));
  }

  async getSeasonsHolidaysForDateRange(startDate: string, endDate: string): Promise<SeasonHoliday[]> {
    return await db.select().from(seasonsHolidays)
      .where(
        and(
          eq(seasonsHolidays.isActive, true),
          lte(seasonsHolidays.startDate, endDate),
          gte(seasonsHolidays.endDate, startDate)
        )
      );
  }

  // ==========================================
  // Commission Rates Management
  // ==========================================

  async getAllCommissionRates(): Promise<CommissionRate[]> {
    return await db.select().from(commissionRates).orderBy(commissionRates.name);
  }

  async getActiveCommissionRates(): Promise<CommissionRate[]> {
    return await db.select().from(commissionRates)
      .where(eq(commissionRates.isActive, true))
      .orderBy(commissionRates.minSalesAmount);
  }

  async createCommissionRate(data: InsertCommissionRate): Promise<CommissionRate> {
    const [inserted] = await db.insert(commissionRates).values(data).returning();
    return inserted;
  }

  async updateCommissionRate(id: number, data: Partial<InsertCommissionRate>): Promise<CommissionRate | undefined> {
    const [updated] = await db.update(commissionRates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(commissionRates.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCommissionRate(id: number): Promise<void> {
    await db.delete(commissionRates).where(eq(commissionRates.id, id));
  }

  // ==========================================
  // Commission Calculations
  // ==========================================

  async getAllCommissionCalculations(): Promise<CommissionCalculation[]> {
    return await db.select().from(commissionCalculations).orderBy(desc(commissionCalculations.createdAt));
  }

  async getCommissionCalculationsByBranch(branchId: string): Promise<CommissionCalculation[]> {
    return await db.select().from(commissionCalculations)
      .where(eq(commissionCalculations.branchId, branchId))
      .orderBy(desc(commissionCalculations.createdAt));
  }

  async getCommissionCalculationsByCashier(cashierId: string): Promise<CommissionCalculation[]> {
    return await db.select().from(commissionCalculations)
      .where(eq(commissionCalculations.cashierId, cashierId))
      .orderBy(desc(commissionCalculations.createdAt));
  }

  async createCommissionCalculation(data: InsertCommissionCalculation): Promise<CommissionCalculation> {
    const [inserted] = await db.insert(commissionCalculations).values(data).returning();
    return inserted;
  }

  async updateCommissionCalculation(id: number, data: Partial<InsertCommissionCalculation>): Promise<CommissionCalculation | undefined> {
    const [updated] = await db.update(commissionCalculations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(commissionCalculations.id, id))
      .returning();
    return updated || undefined;
  }

  async approveCommissionCalculation(id: number, approvedBy: string): Promise<CommissionCalculation | undefined> {
    const [updated] = await db.update(commissionCalculations)
      .set({ status: 'approved', approvedBy, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(commissionCalculations.id, id))
      .returning();
    return updated || undefined;
  }

  async markCommissionAsPaid(id: number): Promise<CommissionCalculation | undefined> {
    const [updated] = await db.update(commissionCalculations)
      .set({ status: 'paid', paidAt: new Date(), updatedAt: new Date() })
      .where(eq(commissionCalculations.id, id))
      .returning();
    return updated || undefined;
  }

  // Calculate commission for a cashier for a period
  async calculateCashierCommission(cashierId: string, periodStart: string, periodEnd: string): Promise<{
    cashierId: string;
    totalSales: number;
    targetAmount: number;
    achievementPercent: number;
    applicableRate: CommissionRate | null;
    calculatedCommission: number;
    journalIds: number[];
  }> {
    const journals = await db.select().from(cashierSalesJournals)
      .where(
        and(
          eq(cashierSalesJournals.cashierId, cashierId),
          gte(cashierSalesJournals.journalDate, periodStart),
          lte(cashierSalesJournals.journalDate, periodEnd),
          inArray(cashierSalesJournals.status, ['posted', 'approved'])
        )
      );

    const totalSales = journals.reduce((sum, j) => sum + j.totalSales, 0);
    const journalIds = journals.map(j => j.id);

    // Get applicable commission rate
    const rates = await this.getActiveCommissionRates();
    const applicableRate = rates.find(r => {
      const minOk = totalSales >= (r.minSalesAmount || 0);
      const maxOk = !r.maxSalesAmount || totalSales <= r.maxSalesAmount;
      return minOk && maxOk;
    }) || null;

    let calculatedCommission = 0;
    if (applicableRate) {
      if (applicableRate.commissionType === 'fixed' && applicableRate.fixedAmount) {
        calculatedCommission = applicableRate.fixedAmount;
      } else if (applicableRate.commissionType === 'percentage' && applicableRate.percentageRate) {
        calculatedCommission = (totalSales * applicableRate.percentageRate) / 100;
      } else if (applicableRate.commissionType === 'tiered') {
        if (applicableRate.fixedAmount) calculatedCommission += applicableRate.fixedAmount;
        if (applicableRate.percentageRate) calculatedCommission += (totalSales * applicableRate.percentageRate) / 100;
      }
    }

    // Get target for achievement calculation
    const branchId = journals[0]?.branchId;
    let targetAmount = 0;
    let achievementPercent = 0;
    if (branchId) {
      const yearMonth = periodStart.substring(0, 7);
      const target = await this.getBranchMonthlyTargetByMonth(branchId, yearMonth);
      if (target) {
        targetAmount = target.targetAmount;
        achievementPercent = targetAmount > 0 ? (totalSales / targetAmount) * 100 : 0;
      }
    }

    return {
      cashierId,
      totalSales,
      targetAmount,
      achievementPercent,
      applicableRate,
      calculatedCommission,
      journalIds
    };
  }

  // Get daily sales progress for a branch with target comparison
  async getBranchDailySalesProgress(branchId: string, yearMonth: string): Promise<{
    branchId: string;
    branchName: string;
    yearMonth: string;
    targetAmount: number;
    achievedAmount: number;
    achievementPercent: number;
    remainingAmount: number;
    dailyTargetAverage: number;
    dailyProgress: {
      date: string;
      dayName: string;
      targetAmount: number;
      achievedAmount: number;
      achievementPercent: number;
      cumulativeTarget: number;
      cumulativeAchieved: number;
      cumulativePercent: number;
      variance: number;
      journalCount: number;
      journalIds: number[];
    }[];
  } | null> {
    const branch = await this.getBranch(branchId);
    if (!branch) return null;

    const branchTarget = await this.getBranchMonthlyTargetByMonth(branchId, yearMonth);
    if (!branchTarget) return null;

    const [year, month] = yearMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyTargetAverage = branchTarget.targetAmount / daysInMonth;

    // Get daily allocations if exists
    const allocations = await this.getTargetDailyAllocationsByMonth(branchTarget.id);
    
    // Get all journals for the month
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`;
    
    const journals = await db.select().from(cashierSalesJournals)
      .where(
        and(
          eq(cashierSalesJournals.branchId, branchId),
          gte(cashierSalesJournals.journalDate, startDate),
          lte(cashierSalesJournals.journalDate, endDate),
          inArray(cashierSalesJournals.status, ['posted', 'approved'])
        )
      );

    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dailyProgress: {
      date: string;
      dayName: string;
      targetAmount: number;
      achievedAmount: number;
      achievementPercent: number;
      cumulativeTarget: number;
      cumulativeAchieved: number;
      cumulativePercent: number;
      variance: number;
      journalCount: number;
      journalIds: number[];
    }[] = [];

    let cumulativeTarget = 0;
    let cumulativeAchieved = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${yearMonth}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      const dayName = dayNames[dayOfWeek];
      
      // Get target for this day from allocations or use average
      const allocation = allocations.find((a: { targetDate: string }) => a.targetDate === dateStr);
      const dayTarget = allocation ? allocation.dailyTarget : dailyTargetAverage;
      
      // Get sales for this day
      const dayJournals = journals.filter(j => j.journalDate === dateStr);
      const dayAchieved = dayJournals.reduce((sum, j) => sum + j.totalSales, 0);
      const journalIds = dayJournals.map(j => j.id);
      
      cumulativeTarget += dayTarget;
      cumulativeAchieved += dayAchieved;
      
      dailyProgress.push({
        date: dateStr,
        dayName,
        targetAmount: dayTarget,
        achievedAmount: dayAchieved,
        achievementPercent: dayTarget > 0 ? (dayAchieved / dayTarget) * 100 : 0,
        cumulativeTarget,
        cumulativeAchieved,
        cumulativePercent: cumulativeTarget > 0 ? (cumulativeAchieved / cumulativeTarget) * 100 : 0,
        variance: dayAchieved - dayTarget,
        journalCount: dayJournals.length,
        journalIds
      });
    }

    const totalAchieved = journals.reduce((sum, j) => sum + j.totalSales, 0);
    const achievementPercent = branchTarget.targetAmount > 0 
      ? (totalAchieved / branchTarget.targetAmount) * 100 
      : 0;

    return {
      branchId,
      branchName: branch.name,
      yearMonth,
      targetAmount: branchTarget.targetAmount,
      achievedAmount: totalAchieved,
      achievementPercent,
      remainingAmount: Math.max(0, branchTarget.targetAmount - totalAchieved),
      dailyTargetAverage,
      dailyProgress
    };
  }

  // Get all branches sales progress summary
  async getAllBranchesSalesProgress(yearMonth: string): Promise<{
    branchId: string;
    branchName: string;
    targetAmount: number;
    achievedAmount: number;
    achievementPercent: number;
    remainingAmount: number;
    daysWithSales: number;
    averageDailySales: number;
    projectedTotal: number;
    projectedPercent: number;
    trend: 'up' | 'down' | 'stable';
  }[]> {
    const branches = await this.getAllBranches();
    const [year, month] = yearMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const currentDay = today.getMonth() + 1 === month && today.getFullYear() === year 
      ? today.getDate() 
      : (today > new Date(year, month - 1, 1) ? daysInMonth : 0);

    const results: {
      branchId: string;
      branchName: string;
      targetAmount: number;
      achievedAmount: number;
      achievementPercent: number;
      remainingAmount: number;
      daysWithSales: number;
      averageDailySales: number;
      projectedTotal: number;
      projectedPercent: number;
      trend: 'up' | 'down' | 'stable';
    }[] = [];

    for (const branch of branches) {
      const progress = await this.getBranchDailySalesProgress(branch.id, yearMonth);
      if (!progress) continue;

      const daysWithSales = progress.dailyProgress.filter(d => d.achievedAmount > 0).length;
      const averageDailySales = daysWithSales > 0 ? progress.achievedAmount / daysWithSales : 0;
      const projectedTotal = averageDailySales * daysInMonth;
      const projectedPercent = progress.targetAmount > 0 
        ? (projectedTotal / progress.targetAmount) * 100 
        : 0;

      // Calculate trend: compare recent days vs earlier days to determine current direction
      // Uses achievement % (sales/target) per day for fair comparison across different target amounts
      const saudiToday = getSaudiArabiaTime().date;
      const monthEndDate = `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`;
      const cutoffDate = saudiToday < monthEndDate ? saudiToday : monthEndDate;
      const completedDaysWithSales = progress.dailyProgress
        .filter(d => d.date <= cutoffDate && d.achievedAmount > 0);
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (completedDaysWithSales.length >= 4) {
        const dayPercents = completedDaysWithSales.map(d =>
          d.targetAmount > 0 ? (d.achievedAmount / d.targetAmount) * 100 : 0
        );
        const recentCount = Math.max(2, Math.floor(dayPercents.length / 3));
        const recentDays = dayPercents.slice(-recentCount);
        const earlierDays = dayPercents.slice(0, -recentCount);
        const recentAvg = recentDays.reduce((s, p) => s + p, 0) / recentDays.length;
        const earlierAvg = earlierDays.reduce((s, p) => s + p, 0) / earlierDays.length;
        const diff = recentAvg - earlierAvg;
        if (diff > 5) trend = 'up';
        else if (diff < -5) trend = 'down';
      } else if (completedDaysWithSales.length >= 2) {
        const firstPct = completedDaysWithSales[0].targetAmount > 0
          ? (completedDaysWithSales[0].achievedAmount / completedDaysWithSales[0].targetAmount) * 100 : 0;
        const lastPct = completedDaysWithSales[completedDaysWithSales.length - 1].targetAmount > 0
          ? (completedDaysWithSales[completedDaysWithSales.length - 1].achievedAmount / completedDaysWithSales[completedDaysWithSales.length - 1].targetAmount) * 100 : 0;
        const change = lastPct - firstPct;
        if (change > 10) trend = 'up';
        else if (change < -10) trend = 'down';
      }

      results.push({
        branchId: branch.id,
        branchName: branch.name,
        targetAmount: progress.targetAmount,
        achievedAmount: progress.achievedAmount,
        achievementPercent: progress.achievementPercent,
        remainingAmount: progress.remainingAmount,
        daysWithSales,
        averageDailySales,
        projectedTotal,
        projectedPercent,
        trend
      });
    }

    return results.sort((a, b) => b.achievementPercent - a.achievementPercent);
  }

  // Get performance alerts for targets not being met
  async getTargetAlerts(yearMonth: string): Promise<{
    branchId: string;
    branchName: string;
    targetAmount: number;
    achievedAmount: number;
    achievementPercent: number;
    daysRemaining: number;
    projectedAchievement: number;
    alertLevel: 'critical' | 'warning' | 'on_track' | 'exceeding';
    message: string;
  }[]> {
    const allBranches = await this.getAllBranches();
    const allTargets = await this.getAllBranchMonthlyTargets();
    const monthTargets = allTargets.filter(t => t.yearMonth === yearMonth);
    
    const [year, month] = yearMonth.split('-').map(Number);
    const today = new Date();
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    
    let daysPassed: number;
    let daysRemaining: number;
    
    if (today < monthStart) {
      // Future month - no days passed yet
      daysPassed = 0;
      daysRemaining = daysInMonth;
    } else if (today > monthEnd) {
      // Past month - all days passed
      daysPassed = daysInMonth;
      daysRemaining = 0;
    } else {
      // Current month
      daysPassed = today.getDate();
      daysRemaining = daysInMonth - daysPassed;
    }

    const alerts: {
      branchId: string;
      branchName: string;
      targetAmount: number;
      achievedAmount: number;
      achievementPercent: number;
      daysRemaining: number;
      projectedAchievement: number;
      alertLevel: 'critical' | 'warning' | 'on_track' | 'exceeding';
      message: string;
    }[] = [];

    for (const branch of allBranches) {
      const branchTarget = monthTargets.find(t => t.branchId === branch.id);
      if (!branchTarget) continue;

      const performance = await this.calculateBranchPerformance(branch.id, yearMonth);
      const dailyAverage = daysPassed > 0 ? performance.achievedAmount / daysPassed : 0;
      const projectedTotal = dailyAverage * daysInMonth;
      const projectedAchievement = branchTarget.targetAmount > 0 
        ? (projectedTotal / branchTarget.targetAmount) * 100 
        : 0;

      let alertLevel: 'critical' | 'warning' | 'on_track' | 'exceeding';
      let message: string;

      if (performance.achievementPercent >= 100) {
        alertLevel = 'exceeding';
        message = `تم تحقيق الهدف! نسبة التحقيق ${performance.achievementPercent.toFixed(1)}%`;
      } else if (projectedAchievement >= 90) {
        alertLevel = 'on_track';
        message = `على المسار الصحيح. التوقع: ${projectedAchievement.toFixed(1)}%`;
      } else if (projectedAchievement >= 70) {
        alertLevel = 'warning';
        message = `تحذير: التوقع ${projectedAchievement.toFixed(1)}% - يحتاج تحسين`;
      } else {
        alertLevel = 'critical';
        message = `تنبيه خطير: التوقع ${projectedAchievement.toFixed(1)}% - يتطلب تدخل عاجل`;
      }

      alerts.push({
        branchId: branch.id,
        branchName: branch.name,
        targetAmount: branchTarget.targetAmount,
        achievedAmount: performance.achievedAmount,
        achievementPercent: performance.achievementPercent,
        daysRemaining,
        projectedAchievement,
        alertLevel,
        message
      });
    }

    return alerts.sort((a, b) => a.achievementPercent - b.achievementPercent);
  }

  // ==========================================
  // Sales Analytics Methods
  // ==========================================

  // Get targets vs actuals analysis for a date range
  async getTargetsVsActuals(branchId: string | null, fromDate: string, toDate: string, status?: string, discrepancyType?: string): Promise<{
    date: string;
    branchId: string;
    branchName: string;
    targetAmount: number;
    actualSales: number;
    variance: number;
    achievementPercent: number;
    shiftBreakdown: { morning: number; evening: number; night: number };
    status: 'exceeding' | 'on_track' | 'warning' | 'critical';
  }[]> {
    const branches = await this.getAllBranches();
    const targetBranches = branchId ? branches.filter(b => b.id === branchId) : branches;
    const results: any[] = [];

    // Build status filter
    const statusFilter = status ? [status] : ['posted', 'approved'];
    
    for (const branch of targetBranches) {
      // Build where conditions
      const whereConditions: any[] = [
        eq(cashierSalesJournals.branchId, branch.id),
        gte(cashierSalesJournals.journalDate, fromDate),
        lte(cashierSalesJournals.journalDate, toDate),
        inArray(cashierSalesJournals.status, statusFilter)
      ];

      // Add discrepancy filter
      if (discrepancyType === 'shortage') {
        whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'shortage'));
      } else if (discrepancyType === 'surplus') {
        whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'surplus'));
      } else if (discrepancyType === 'balanced') {
        whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'balanced'));
      }

      // Get journals for the date range
      const journals = await db.select()
        .from(cashierSalesJournals)
        .where(and(...whereConditions));

      // Group by date
      const salesMap = new Map<string, {
        totalSales: number;
        morning: number;
        evening: number;
        night: number;
      }>();

      for (const j of journals) {
        const existing = salesMap.get(j.journalDate) || { totalSales: 0, morning: 0, evening: 0, night: 0 };
        existing.totalSales += j.totalSales || 0;
        if (j.shiftType === 'morning') existing.morning += j.totalSales || 0;
        else if (j.shiftType === 'evening') existing.evening += j.totalSales || 0;
        else if (j.shiftType === 'night') existing.night += j.totalSales || 0;
        salesMap.set(j.journalDate, existing);
      }

      // Get target allocations for date range
      const yearMonth = fromDate.substring(0, 7);
      const target = await db.select()
        .from(branchMonthlyTargets)
        .where(
          and(
            eq(branchMonthlyTargets.branchId, branch.id),
            eq(branchMonthlyTargets.yearMonth, yearMonth)
          )
        );

      const allocations = target.length > 0 
        ? await db.select().from(targetDailyAllocations)
            .where(
              and(
                eq(targetDailyAllocations.monthlyTargetId, target[0].id),
                gte(targetDailyAllocations.targetDate, fromDate),
                lte(targetDailyAllocations.targetDate, toDate)
              )
            )
        : [];

      // Build a set of all dates (from both allocations and sales)
      const allDates = new Set<string>();
      allocations.forEach(a => allDates.add(a.targetDate));
      Array.from(salesMap.keys()).forEach(date => allDates.add(date));

      // Build results for each date (including days with targets but no sales)
      Array.from(allDates).forEach(date => {
        const sales = salesMap.get(date) || { totalSales: 0, morning: 0, evening: 0, night: 0 };
        const allocation = allocations.find(a => a.targetDate === date);
        const targetAmount = allocation?.dailyTarget || 0;
        const variance = sales.totalSales - targetAmount;
        const achievementPercent = targetAmount > 0 ? (sales.totalSales / targetAmount) * 100 : (sales.totalSales > 0 ? 100 : 0);
        let status: 'exceeding' | 'on_track' | 'warning' | 'critical';
        
        if (achievementPercent >= 100) status = 'exceeding';
        else if (achievementPercent >= 80) status = 'on_track';
        else if (achievementPercent >= 60) status = 'warning';
        else status = 'critical';

        results.push({
          date,
          branchId: branch.id,
          branchName: branch.name,
          targetAmount,
          actualSales: sales.totalSales,
          variance,
          achievementPercent,
          shiftBreakdown: { morning: sales.morning, evening: sales.evening, night: sales.night },
          status
        });
      });
    }

    return results.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Get shift performance analysis
  async getShiftAnalytics(branchId: string | null, fromDate: string, toDate: string, status?: string, discrepancyType?: string): Promise<{
    shiftType: string;
    shiftLabel: string;
    totalSales: number;
    averageSales: number;
    transactionsCount: number;
    averageTicket: number;
    journalCount: number;
    percentage: number;
  }[]> {
    const statusFilter = status ? [status] : ['posted', 'approved'];
    const whereConditions: any[] = [
      gte(cashierSalesJournals.journalDate, fromDate),
      lte(cashierSalesJournals.journalDate, toDate),
      inArray(cashierSalesJournals.status, statusFilter)
    ];
    
    if (branchId) {
      whereConditions.push(eq(cashierSalesJournals.branchId, branchId));
    }

    if (discrepancyType === 'shortage') {
      whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'shortage'));
    } else if (discrepancyType === 'surplus') {
      whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'surplus'));
    } else if (discrepancyType === 'balanced') {
      whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'balanced'));
    }

    const journals = await db.select()
      .from(cashierSalesJournals)
      .where(and(...whereConditions));

    const shiftStats = new Map<string, {
      totalSales: number;
      transactionsCount: number;
      journalCount: number;
      totalTickets: number;
    }>();

    const shiftLabels: Record<string, string> = {
      morning: 'صباحي',
      evening: 'مسائي',
      night: 'ليلي'
    };

    for (const j of journals) {
      const shift = j.shiftType || 'unknown';
      const existing = shiftStats.get(shift) || { totalSales: 0, transactionsCount: 0, journalCount: 0, totalTickets: 0 };
      existing.totalSales += j.totalSales || 0;
      existing.transactionsCount += j.transactionCount || 0;
      existing.journalCount += 1;
      existing.totalTickets += j.averageTicket || 0;
      shiftStats.set(shift, existing);
    }

    const grandTotal = Array.from(shiftStats.values()).reduce((sum, s) => sum + s.totalSales, 0);

    return Array.from(shiftStats.entries()).map(([shiftType, stats]) => ({
      shiftType,
      shiftLabel: shiftLabels[shiftType] || shiftType,
      totalSales: stats.totalSales,
      averageSales: stats.journalCount > 0 ? stats.totalSales / stats.journalCount : 0,
      transactionsCount: stats.transactionsCount,
      averageTicket: stats.journalCount > 0 ? stats.totalTickets / stats.journalCount : 0,
      journalCount: stats.journalCount,
      percentage: grandTotal > 0 ? (stats.totalSales / grandTotal) * 100 : 0
    })).sort((a, b) => b.totalSales - a.totalSales);
  }

  // Get cashier leaderboard
  async getCashierLeaderboard(branchId: string | null, fromDate: string, toDate: string, status?: string, discrepancyType?: string): Promise<{
    cashierId: string;
    cashierName: string;
    branchId: string;
    branchName: string;
    totalSales: number;
    journalCount: number;
    transactionsCount: number;
    averageTicket: number;
    averageDailySales: number;
    rank: number;
    contribution: number;
    shiftDistribution: { morning: number; evening: number; night: number };
  }[]> {
    const statusFilter = status ? [status] : ['posted', 'approved'];
    const whereConditions: any[] = [
      gte(cashierSalesJournals.journalDate, fromDate),
      lte(cashierSalesJournals.journalDate, toDate),
      inArray(cashierSalesJournals.status, statusFilter)
    ];
    
    if (branchId) {
      whereConditions.push(eq(cashierSalesJournals.branchId, branchId));
    }

    if (discrepancyType === 'shortage') {
      whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'shortage'));
    } else if (discrepancyType === 'surplus') {
      whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'surplus'));
    } else if (discrepancyType === 'balanced') {
      whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'balanced'));
    }

    const journals = await db.select()
      .from(cashierSalesJournals)
      .where(and(...whereConditions));

    const branches = await this.getAllBranches();
    const branchMap = new Map(branches.map(b => [b.id, b.name]));

    const cashierStats = new Map<string, {
      cashierName: string;
      branchId: string;
      totalSales: number;
      journalCount: number;
      transactionsCount: number;
      totalTickets: number;
      morning: number;
      evening: number;
      night: number;
      uniqueDates: Set<string>;
    }>();

    for (const j of journals) {
      const key = j.cashierId;
      const existing = cashierStats.get(key) || {
        cashierName: j.cashierName,
        branchId: j.branchId,
        totalSales: 0,
        journalCount: 0,
        transactionsCount: 0,
        totalTickets: 0,
        morning: 0,
        evening: 0,
        night: 0,
        uniqueDates: new Set<string>()
      };
      
      existing.totalSales += j.totalSales || 0;
      existing.journalCount += 1;
      existing.transactionsCount += j.transactionCount || 0;
      existing.totalTickets += j.averageTicket || 0;
      existing.uniqueDates.add(j.journalDate);
      
      if (j.shiftType === 'morning') existing.morning += j.totalSales || 0;
      else if (j.shiftType === 'evening') existing.evening += j.totalSales || 0;
      else if (j.shiftType === 'night') existing.night += j.totalSales || 0;
      
      cashierStats.set(key, existing);
    }

    const grandTotal = Array.from(cashierStats.values()).reduce((sum, s) => sum + s.totalSales, 0);

    const results = Array.from(cashierStats.entries()).map(([cashierId, stats]) => ({
      cashierId,
      cashierName: stats.cashierName,
      branchId: stats.branchId,
      branchName: branchMap.get(stats.branchId) || stats.branchId,
      totalSales: stats.totalSales,
      journalCount: stats.journalCount,
      transactionsCount: stats.transactionsCount,
      averageTicket: stats.journalCount > 0 ? stats.totalTickets / stats.journalCount : 0,
      averageDailySales: stats.uniqueDates.size > 0 ? stats.totalSales / stats.uniqueDates.size : 0,
      rank: 0,
      contribution: grandTotal > 0 ? (stats.totalSales / grandTotal) * 100 : 0,
      shiftDistribution: { morning: stats.morning, evening: stats.evening, night: stats.night }
    })).sort((a, b) => b.totalSales - a.totalSales);

    // Assign ranks
    results.forEach((r, idx) => { r.rank = idx + 1; });

    return results;
  }

  // Get average ticket analysis
  async getAverageTicketAnalysis(branchId: string | null, groupBy: 'shift' | 'cashier' | 'date', fromDate: string, toDate: string, status?: string, discrepancyType?: string): Promise<{
    group: string;
    groupLabel: string;
    averageTicket: number;
    transactionsCount: number;
    totalSales: number;
    journalCount: number;
  }[]> {
    const statusFilter = status ? [status] : ['posted', 'approved'];
    const whereConditions: any[] = [
      gte(cashierSalesJournals.journalDate, fromDate),
      lte(cashierSalesJournals.journalDate, toDate),
      inArray(cashierSalesJournals.status, statusFilter)
    ];
    
    if (branchId) {
      whereConditions.push(eq(cashierSalesJournals.branchId, branchId));
    }

    if (discrepancyType === 'shortage') {
      whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'shortage'));
    } else if (discrepancyType === 'surplus') {
      whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'surplus'));
    } else if (discrepancyType === 'balanced') {
      whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'balanced'));
    }

    const journals = await db.select()
      .from(cashierSalesJournals)
      .where(and(...whereConditions));

    const shiftLabels: Record<string, string> = {
      morning: 'صباحي',
      evening: 'مسائي',
      night: 'ليلي'
    };

    const stats = new Map<string, {
      groupLabel: string;
      totalSales: number;
      transactionsCount: number;
      journalCount: number;
    }>();

    for (const j of journals) {
      let groupKey: string;
      let groupLabel: string;
      
      if (groupBy === 'shift') {
        groupKey = j.shiftType || 'unknown';
        groupLabel = shiftLabels[groupKey] || groupKey;
      } else if (groupBy === 'cashier') {
        groupKey = j.cashierId;
        groupLabel = j.cashierName;
      } else {
        groupKey = j.journalDate;
        groupLabel = j.journalDate;
      }

      const existing = stats.get(groupKey) || { groupLabel, totalSales: 0, transactionsCount: 0, journalCount: 0 };
      existing.totalSales += j.totalSales || 0;
      existing.transactionsCount += j.transactionCount || 0;
      existing.journalCount += 1;
      stats.set(groupKey, existing);
    }

    return Array.from(stats.entries()).map(([group, s]) => ({
      group,
      groupLabel: s.groupLabel,
      averageTicket: s.transactionsCount > 0 ? s.totalSales / s.transactionsCount : 0,
      transactionsCount: s.transactionsCount,
      totalSales: s.totalSales,
      journalCount: s.journalCount
    })).sort((a, b) => b.averageTicket - a.averageTicket);
  }

  // Compute and store daily branch sales summary
  async computeBranchDailySales(branchId: string, salesDate: string): Promise<BranchDailySales> {
    // Get all posted/approved journals for this branch/date
    const journals = await db.select()
      .from(cashierSalesJournals)
      .where(
        and(
          eq(cashierSalesJournals.branchId, branchId),
          eq(cashierSalesJournals.journalDate, salesDate),
          inArray(cashierSalesJournals.status, ['posted', 'approved'])
        )
      );

    // Calculate aggregates
    let totalSales = 0;
    let transactionsCount = 0;
    let morningShiftSales = 0;
    let eveningShiftSales = 0;
    let nightShiftSales = 0;
    const cashierIds = new Set<string>();
    const journalIds: number[] = [];

    for (const j of journals) {
      totalSales += j.totalSales || 0;
      transactionsCount += j.transactionCount || 0;
      cashierIds.add(j.cashierId);
      journalIds.push(j.id);
      
      if (j.shiftType === 'morning') morningShiftSales += j.totalSales || 0;
      else if (j.shiftType === 'evening') eveningShiftSales += j.totalSales || 0;
      else if (j.shiftType === 'night') nightShiftSales += j.totalSales || 0;
    }

    const averageTicket = transactionsCount > 0 ? totalSales / transactionsCount : 0;

    // Get target for this date
    const yearMonth = salesDate.substring(0, 7);
    const targets = await db.select()
      .from(branchMonthlyTargets)
      .where(
        and(
          eq(branchMonthlyTargets.branchId, branchId),
          eq(branchMonthlyTargets.yearMonth, yearMonth)
        )
      );

    let targetAmount = 0;
    if (targets.length > 0) {
      const allocations = await db.select()
        .from(targetDailyAllocations)
        .where(
          and(
            eq(targetDailyAllocations.monthlyTargetId, targets[0].id),
            eq(targetDailyAllocations.targetDate, salesDate)
          )
        );
      if (allocations.length > 0) {
        targetAmount = allocations[0].dailyTarget;
      }
    }

    const achievementAmount = totalSales - targetAmount;
    const achievementPercent = targetAmount > 0 ? (totalSales / targetAmount) * 100 : 0;

    // Check if record exists
    const existing = await db.select()
      .from(branchDailySales)
      .where(
        and(
          eq(branchDailySales.branchId, branchId),
          eq(branchDailySales.salesDate, salesDate)
        )
      );

    const data = {
      branchId,
      salesDate,
      totalSales,
      transactionsCount,
      averageTicket,
      cashierCount: cashierIds.size,
      targetAmount,
      achievementAmount,
      achievementPercent,
      morningShiftSales,
      eveningShiftSales,
      nightShiftSales,
      journalIds
    };

    if (existing.length > 0) {
      const [updated] = await db.update(branchDailySales)
        .set({ ...data, computedAt: new Date(), updatedAt: new Date() })
        .where(eq(branchDailySales.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(branchDailySales)
        .values(data)
        .returning();
      return created;
    }
  }

  // Display Bar Receipts
  async getDisplayBarReceipts(branchId?: string, date?: string): Promise<DisplayBarReceipt[]> {
    const conditions = [];
    if (branchId) {
      conditions.push(eq(displayBarReceipts.branchId, branchId));
    }
    if (date) {
      conditions.push(eq(displayBarReceipts.receiptDate, date));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(displayBarReceipts).where(and(...conditions)).orderBy(desc(displayBarReceipts.createdAt));
    }
    return await db.select().from(displayBarReceipts).orderBy(desc(displayBarReceipts.createdAt));
  }

  async createDisplayBarReceipt(data: InsertDisplayBarReceipt): Promise<DisplayBarReceipt> {
    const [receipt] = await db.insert(displayBarReceipts).values(data).returning();
    return receipt;
  }

  async syncMissingDisplayBarReceipts(branchId?: string, date?: string, allowedBranchIds?: string[]): Promise<{ synced: number; skipped: number; errors: string[] }> {
    const saudiTime = getSaudiArabiaTime();
    
    const conditions = [
      eq(dailyProductionBatches.destination, 'display_bar'),
      eq(dailyProductionBatches.status, 'finished'),
      isNotNull(dailyProductionBatches.productId),
    ];
    
    if (date) {
      conditions.push(eq(dailyProductionBatches.productionDate, date));
    }
    
    if (branchId) {
      conditions.push(eq(dailyProductionBatches.branchId, branchId));
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      conditions.push(inArray(dailyProductionBatches.branchId, allowedBranchIds));
    }
    
    const batches = await db.select().from(dailyProductionBatches).where(and(...conditions));
    
    const existingRefs = batches.length > 0 
      ? await db.select({ productionBatch: displayBarReceipts.productionBatch })
          .from(displayBarReceipts)
          .where(inArray(displayBarReceipts.productionBatch, batches.map(b => `PROD-${b.id}`)))
      : [];
    const existingRefSet = new Set(existingRefs.map(r => r.productionBatch));
    
    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];
    
    for (const batch of batches) {
      const batchRef = `PROD-${batch.id}`;
      
      if (existingRefSet.has(batchRef)) {
        skipped++;
        continue;
      }
      
      try {
        const receiptDate = batch.productionDate || saudiTime.date;
        await db.insert(displayBarReceipts).values({
          branchId: batch.branchId,
          productId: batch.productId!,
          receiptDate,
          receiptTime: saudiTime.timeShort,
          quantity: batch.quantity,
          productionBatch: batchRef,
          notes: `مزامنة تلقائية - استلام من الإنتاج اليومي - ${batch.productName}`,
        });
        synced++;
        console.log(`[Sync] Created missing receipt for ${batchRef}`);
      } catch (err: any) {
        if (err.code === '23505') {
          skipped++;
        } else {
          errors.push(`Batch ${batch.id}: ${err.message}`);
          console.error(`[Sync] Error for batch ${batch.id}:`, err);
        }
      }
    }
    
    console.log(`[Sync] Complete: synced=${synced}, skipped=${skipped}, errors=${errors.length}`);
    return { synced, skipped, errors };
  }

  // Display Bar Daily Summary
  async getDisplayBarDailySummary(branchId?: string, date?: string): Promise<DisplayBarDailySummary[]> {
    const conditions = [];
    if (branchId) {
      conditions.push(eq(displayBarDailySummary.branchId, branchId));
    }
    if (date) {
      conditions.push(eq(displayBarDailySummary.summaryDate, date));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(displayBarDailySummary).where(and(...conditions)).orderBy(desc(displayBarDailySummary.summaryDate));
    }
    return await db.select().from(displayBarDailySummary).orderBy(desc(displayBarDailySummary.summaryDate));
  }

  async getDisplayBarDailySummaryById(id: number): Promise<DisplayBarDailySummary | undefined> {
    const [summary] = await db.select().from(displayBarDailySummary).where(eq(displayBarDailySummary.id, id));
    return summary || undefined;
  }

  async updateDisplayBarDailySummary(id: number, data: Partial<InsertDisplayBarDailySummary>): Promise<DisplayBarDailySummary | undefined> {
    const [summary] = await db.update(displayBarDailySummary)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(displayBarDailySummary.id, id))
      .returning();
    return summary || undefined;
  }

  async upsertDisplayBarDailySummary(data: InsertDisplayBarDailySummary): Promise<DisplayBarDailySummary> {
    const existing = await db.select().from(displayBarDailySummary).where(
      and(
        eq(displayBarDailySummary.branchId, data.branchId),
        eq(displayBarDailySummary.productId, data.productId),
        eq(displayBarDailySummary.summaryDate, data.summaryDate)
      )
    );
    if (existing.length > 0) {
      const [updated] = await db.update(displayBarDailySummary)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(displayBarDailySummary.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(displayBarDailySummary).values(data).returning();
    return created;
  }

  // Waste Reports
  async getWasteReports(branchId?: string, dateFrom?: string, dateTo?: string): Promise<WasteReport[]> {
    const conditions = [];
    if (branchId) {
      conditions.push(eq(wasteReports.branchId, branchId));
    }
    if (dateFrom) {
      conditions.push(gte(wasteReports.reportDate, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(wasteReports.reportDate, dateTo));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(wasteReports).where(and(...conditions)).orderBy(desc(wasteReports.reportDate));
    }
    return await db.select().from(wasteReports).orderBy(desc(wasteReports.reportDate));
  }

  async getWasteReport(id: number): Promise<WasteReport | undefined> {
    const [report] = await db.select().from(wasteReports).where(eq(wasteReports.id, id));
    return report || undefined;
  }

  async createWasteReport(data: InsertWasteReport): Promise<WasteReport> {
    const [report] = await db.insert(wasteReports).values(data).returning();
    return report;
  }

  async updateWasteReport(id: number, data: Partial<InsertWasteReport>): Promise<WasteReport | undefined> {
    const [report] = await db.update(wasteReports)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(wasteReports.id, id))
      .returning();
    return report || undefined;
  }

  async deleteWasteReport(id: number): Promise<boolean> {
    const result = await db.delete(wasteReports).where(eq(wasteReports.id, id)).returning();
    return result.length > 0;
  }

  // Waste Items
  async getWasteItems(wasteReportId: number): Promise<WasteItem[]> {
    return await db.select().from(wasteItems).where(eq(wasteItems.wasteReportId, wasteReportId));
  }

  async getWasteItemById(id: number): Promise<WasteItem | undefined> {
    const [item] = await db.select().from(wasteItems).where(eq(wasteItems.id, id));
    return item || undefined;
  }

  async createWasteItem(data: InsertWasteItem): Promise<WasteItem> {
    const [item] = await db.insert(wasteItems).values(data).returning();
    return item;
  }

  async updateWasteItem(id: number, data: Partial<InsertWasteItem>): Promise<WasteItem | undefined> {
    const [item] = await db.update(wasteItems)
      .set(data)
      .where(eq(wasteItems.id, id))
      .returning();
    return item || undefined;
  }

  async deleteWasteItem(id: number): Promise<boolean> {
    const result = await db.delete(wasteItems).where(eq(wasteItems.id, id)).returning();
    return result.length > 0;
  }

  async deleteWasteItemsByReportId(wasteReportId: number): Promise<number> {
    const result = await db.delete(wasteItems).where(eq(wasteItems.wasteReportId, wasteReportId)).returning();
    return result.length;
  }

  async batchReplaceWasteItems(wasteReportId: number, items: InsertWasteItem[]): Promise<WasteItem[]> {
    return await db.transaction(async (tx) => {
      await tx.delete(wasteItems).where(eq(wasteItems.wasteReportId, wasteReportId));
      if (items.length === 0) return [];
      const created = await tx.insert(wasteItems).values(items).returning();
      const totalItems = created.reduce((sum, i) => sum + i.quantity, 0);
      const totalValue = created.reduce((sum, i) => sum + (i.totalValue || 0), 0);
      await tx.update(wasteReports)
        .set({ totalItems, totalValue })
        .where(eq(wasteReports.id, wasteReportId));
      return created;
    });
  }

  // Advanced Production Orders
  async getAllAdvancedProductionOrders(): Promise<AdvancedProductionOrder[]> {
    return await db.select().from(advancedProductionOrders).orderBy(desc(advancedProductionOrders.createdAt));
  }

  async getAdvancedProductionOrder(id: number): Promise<AdvancedProductionOrder | undefined> {
    const [order] = await db.select().from(advancedProductionOrders).where(eq(advancedProductionOrders.id, id));
    return order || undefined;
  }

  async getAdvancedProductionOrdersByBranch(branchId: string): Promise<AdvancedProductionOrder[]> {
    return await db.select().from(advancedProductionOrders)
      .where(or(
        eq(advancedProductionOrders.sourceBranchId, branchId),
        eq(advancedProductionOrders.targetBranchId, branchId)
      ))
      .orderBy(desc(advancedProductionOrders.createdAt));
  }

  async createAdvancedProductionOrder(order: InsertAdvancedProductionOrder): Promise<AdvancedProductionOrder> {
    const [newOrder] = await db.insert(advancedProductionOrders).values(order).returning();
    return newOrder;
  }

  async updateAdvancedProductionOrder(id: number, order: Partial<InsertAdvancedProductionOrder>): Promise<AdvancedProductionOrder | undefined> {
    const [updated] = await db.update(advancedProductionOrders)
      .set({ ...order, updatedAt: new Date() })
      .where(eq(advancedProductionOrders.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteAdvancedProductionOrder(id: number): Promise<boolean> {
    const result = await db.delete(advancedProductionOrders).where(eq(advancedProductionOrders.id, id)).returning();
    return result.length > 0;
  }

  async getAdvancedProductionOrderWithItems(id: number): Promise<{ order: AdvancedProductionOrder; items: ProductionOrderItem[] } | undefined> {
    const order = await this.getAdvancedProductionOrder(id);
    if (!order) return undefined;
    const items = await this.getProductionOrderItems(id);
    return { order, items };
  }

  async createAdvancedProductionOrderWithItems(
    order: InsertAdvancedProductionOrder, 
    items: Omit<InsertProductionOrderItem, 'orderId'>[]
  ): Promise<{ order: AdvancedProductionOrder; items: ProductionOrderItem[] }> {
    return await db.transaction(async (tx) => {
      // Create the order
      const [newOrder] = await tx.insert(advancedProductionOrders).values(order).returning();
      
      if (!newOrder) {
        throw new Error("فشل في إنشاء أمر الإنتاج");
      }
      
      // Create the items with the order ID
      const itemsWithOrderId = items.map(item => ({
        ...item,
        orderId: newOrder.id
      }));
      
      let createdItems: ProductionOrderItem[] = [];
      if (itemsWithOrderId.length > 0) {
        createdItems = await tx.insert(productionOrderItems).values(itemsWithOrderId).returning();
      }
      
      if (itemsWithOrderId.length > 0 && createdItems.length === 0) {
        throw new Error("فشل في إنشاء عناصر أمر الإنتاج");
      }
      
      return { order: newOrder, items: createdItems };
    });
  }

  // Production Order Items
  async getProductionOrderItems(orderId: number): Promise<ProductionOrderItem[]> {
    return await db.select().from(productionOrderItems)
      .where(eq(productionOrderItems.orderId, orderId))
      .orderBy(productionOrderItems.priority);
  }

  async getProductionOrderItemById(id: number): Promise<ProductionOrderItem | undefined> {
    const [item] = await db.select().from(productionOrderItems)
      .where(eq(productionOrderItems.id, id));
    return item || undefined;
  }

  async getProductionTargetsByDate(branchId: string, date: string): Promise<{ totalTarget: number; totalProduced: number }> {
    // Build conditions array, only adding branch filter if not "all"
    const statusFilter = or(
      eq(advancedProductionOrders.status, 'pending'),
      eq(advancedProductionOrders.status, 'approved'),
      eq(advancedProductionOrders.status, 'in_progress')
    );
    
    const dateFilter = or(
      eq(productionOrderItems.scheduledDate, date),
      and(
        lte(advancedProductionOrders.startDate, date),
        gte(advancedProductionOrders.endDate, date)
      )
    );
    
    // Build where clause based on whether we need branch filtering
    let whereClause;
    if (branchId !== "all") {
      const branchFilter = or(
        eq(advancedProductionOrders.sourceBranchId, branchId),
        eq(advancedProductionOrders.targetBranchId, branchId)
      );
      whereClause = and(branchFilter, statusFilter, dateFilter);
    } else {
      whereClause = and(statusFilter, dateFilter);
    }
    
    const items = await db.select({
      targetQuantity: productionOrderItems.targetQuantity,
      producedQuantity: productionOrderItems.producedQuantity,
    })
      .from(productionOrderItems)
      .innerJoin(advancedProductionOrders, eq(productionOrderItems.orderId, advancedProductionOrders.id))
      .where(whereClause);
    
    // Sum in JS to avoid SQL complexity
    let totalTarget = 0;
    let totalProduced = 0;
    for (const item of items) {
      totalTarget += item.targetQuantity || 0;
      totalProduced += item.producedQuantity || 0;
    }
    
    return { totalTarget, totalProduced };
  }

  async createProductionOrderItem(item: InsertProductionOrderItem): Promise<ProductionOrderItem> {
    const [newItem] = await db.insert(productionOrderItems).values(item).returning();
    return newItem;
  }

  async bulkCreateProductionOrderItems(items: InsertProductionOrderItem[]): Promise<ProductionOrderItem[]> {
    if (items.length === 0) return [];
    return await db.insert(productionOrderItems).values(items).returning();
  }

  async updateProductionOrderItem(id: number, item: Partial<InsertProductionOrderItem>): Promise<ProductionOrderItem | undefined> {
    const [updated] = await db.update(productionOrderItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(productionOrderItems.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProductionOrderItem(id: number): Promise<boolean> {
    const result = await db.delete(productionOrderItems).where(eq(productionOrderItems.id, id)).returning();
    return result.length > 0;
  }

  // Production Order Schedules
  async getProductionOrderSchedules(orderId: number): Promise<ProductionOrderSchedule[]> {
    return await db.select().from(productionOrderSchedules)
      .where(eq(productionOrderSchedules.orderId, orderId))
      .orderBy(productionOrderSchedules.scheduledDate);
  }

  async createProductionOrderSchedule(schedule: InsertProductionOrderSchedule): Promise<ProductionOrderSchedule> {
    const [newSchedule] = await db.insert(productionOrderSchedules).values(schedule).returning();
    return newSchedule;
  }

  async bulkCreateProductionOrderSchedules(schedules: InsertProductionOrderSchedule[]): Promise<ProductionOrderSchedule[]> {
    if (schedules.length === 0) return [];
    return await db.insert(productionOrderSchedules).values(schedules).returning();
  }

  // AI Plans
  async getAllProductionAiPlans(): Promise<ProductionAiPlan[]> {
    return await db.select().from(productionAiPlans).orderBy(desc(productionAiPlans.createdAt));
  }

  async getProductionAiPlan(id: number): Promise<ProductionAiPlan | undefined> {
    const [plan] = await db.select().from(productionAiPlans).where(eq(productionAiPlans.id, id));
    return plan || undefined;
  }

  async createProductionAiPlan(plan: InsertProductionAiPlan): Promise<ProductionAiPlan> {
    const [newPlan] = await db.insert(productionAiPlans).values(plan).returning();
    return newPlan;
  }

  async updateProductionAiPlan(id: number, plan: Partial<InsertProductionAiPlan>): Promise<ProductionAiPlan | undefined> {
    const [updated] = await db.update(productionAiPlans)
      .set(plan)
      .where(eq(productionAiPlans.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProductionAiPlan(id: number): Promise<boolean> {
    const result = await db.delete(productionAiPlans).where(eq(productionAiPlans.id, id)).returning();
    return result.length > 0;
  }

  // Sales Data Uploads
  async getAllSalesDataUploads(): Promise<SalesDataUpload[]> {
    return await db.select().from(salesDataUploads).orderBy(desc(salesDataUploads.createdAt));
  }

  async getSalesDataUpload(id: number): Promise<SalesDataUpload | undefined> {
    const [upload] = await db.select().from(salesDataUploads).where(eq(salesDataUploads.id, id));
    return upload || undefined;
  }

  async createSalesDataUpload(upload: InsertSalesDataUpload): Promise<SalesDataUpload> {
    const [newUpload] = await db.insert(salesDataUploads).values(upload).returning();
    return newUpload;
  }

  async updateSalesDataUpload(id: number, upload: Partial<InsertSalesDataUpload>): Promise<SalesDataUpload | undefined> {
    const [updated] = await db.update(salesDataUploads)
      .set(upload)
      .where(eq(salesDataUploads.id, id))
      .returning();
    return updated || undefined;
  }

  // Product Sales Analytics
  async getProductSalesAnalytics(uploadId: number): Promise<ProductSalesAnalytics[]> {
    return await db.select().from(productSalesAnalytics)
      .where(eq(productSalesAnalytics.uploadId, uploadId));
  }

  async bulkCreateProductSalesAnalytics(analytics: InsertProductSalesAnalytics[]): Promise<ProductSalesAnalytics[]> {
    if (analytics.length === 0) return [];
    return await db.insert(productSalesAnalytics).values(analytics).returning();
  }

  // Production Order Stats
  async getAdvancedProductionOrderStats(branchId?: string): Promise<{
    total: number;
    draft: number;
    pending: number;
    approved: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    daily: number;
    weekly: number;
    longTerm: number;
    totalEstimatedCost: number;
  }> {
    const whereCondition = branchId ? or(
      eq(advancedProductionOrders.sourceBranchId, branchId),
      eq(advancedProductionOrders.targetBranchId, branchId)
    ) : undefined;

    const stats = await db.select({
      status: advancedProductionOrders.status,
      orderType: advancedProductionOrders.orderType,
      count: sql<number>`count(*)::int`,
      estimatedCost: sql<string>`sum(CASE WHEN ${advancedProductionOrders.status} NOT IN ('cancelled', 'completed') THEN COALESCE(${advancedProductionOrders.estimatedCost}, 0) ELSE 0 END)::numeric`,
    }).from(advancedProductionOrders)
      .where(whereCondition)
      .groupBy(advancedProductionOrders.status, advancedProductionOrders.orderType);

    const statusCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    let total = 0;
    let totalEstimatedCost = 0;

    for (const row of stats) {
      statusCounts[row.status] = (statusCounts[row.status] || 0) + row.count;
      typeCounts[row.orderType] = (typeCounts[row.orderType] || 0) + row.count;
      total += row.count;
      totalEstimatedCost += parseFloat(row.estimatedCost || '0');
    }

    return {
      total,
      draft: statusCounts['draft'] || 0,
      pending: statusCounts['pending'] || 0,
      approved: statusCounts['approved'] || 0,
      inProgress: statusCounts['in_progress'] || 0,
      completed: statusCounts['completed'] || 0,
      cancelled: statusCounts['cancelled'] || 0,
      daily: typeCounts['daily'] || 0,
      weekly: typeCounts['weekly'] || 0,
      longTerm: typeCounts['long_term'] || 0,
      totalEstimatedCost,
    };
  }

  // Daily Production Batches
  async getAllDailyProductionBatches(filters?: { branchId?: string; date?: string; destination?: string; status?: string; chefId?: string; category?: string; productionOrderId?: number }): Promise<DailyProductionBatch[]> {
    let query = db.select().from(dailyProductionBatches);
    
    const conditions = [];
    if (filters?.branchId) {
      conditions.push(eq(dailyProductionBatches.branchId, filters.branchId));
    }
    if (filters?.date) {
      // Filter by productionDate (user's local date) for reliable timezone-independent filtering
      conditions.push(eq(dailyProductionBatches.productionDate, filters.date));
    }
    if (filters?.destination) {
      conditions.push(eq(dailyProductionBatches.destination, filters.destination));
    }
    if (filters?.status) {
      conditions.push(eq(dailyProductionBatches.status, filters.status));
    }
    if (filters?.chefId) {
      conditions.push(eq(dailyProductionBatches.chefId, filters.chefId));
    }
    if (filters?.category) {
      conditions.push(eq(dailyProductionBatches.productCategory, filters.category));
    }
    if (filters?.productionOrderId) {
      conditions.push(eq(dailyProductionBatches.productionOrderId, filters.productionOrderId));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(dailyProductionBatches).where(and(...conditions)).orderBy(desc(dailyProductionBatches.producedAt));
    }
    return await db.select().from(dailyProductionBatches).orderBy(desc(dailyProductionBatches.producedAt));
  }

  // Get unfinished batches that can be carried over to next day
  async getUnfinishedBatches(branchId?: string): Promise<DailyProductionBatch[]> {
    const conditions = [eq(dailyProductionBatches.status, 'in_progress')];
    if (branchId) {
      conditions.push(eq(dailyProductionBatches.branchId, branchId));
    }
    return await db.select().from(dailyProductionBatches)
      .where(and(...conditions))
      .orderBy(desc(dailyProductionBatches.producedAt));
  }

  // Mark batch as finished
  async finishBatch(id: number): Promise<DailyProductionBatch | undefined> {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(dailyProductionBatches).where(eq(dailyProductionBatches.id, id));
      if (!existing || existing.status === 'finished') {
        if (existing) return existing;
        return undefined;
      }

      const [updated] = await tx.update(dailyProductionBatches)
        .set({ status: 'finished', finishedAt: new Date() })
        .where(eq(dailyProductionBatches.id, id))
        .returning();
      if (!updated) return undefined;

      const productionDate = updated.productionDate || new Date().toISOString().split('T')[0];
      const productNameNormalized = (updated.productName || '').trim().toLowerCase();
      
      try {
        const upsertResult = await tx.execute(sql`
          INSERT INTO finished_goods_inventory (branch_id, product_id, product_name, product_name_normalized, product_category, quantity, unit, production_date, last_batch_id, created_at, updated_at)
          VALUES (${updated.branchId}, ${updated.productId}, ${updated.productName}, ${productNameNormalized}, ${updated.productCategory}, ${updated.quantity}, ${updated.unit || 'قطعة'}, ${productionDate}, ${updated.id}, NOW(), NOW())
          ON CONFLICT (branch_id, product_name_normalized, production_date)
          DO UPDATE SET 
            quantity = finished_goods_inventory.quantity + EXCLUDED.quantity,
            last_batch_id = EXCLUDED.last_batch_id,
            product_id = COALESCE(EXCLUDED.product_id, finished_goods_inventory.product_id),
            updated_at = NOW()
          RETURNING id, quantity
        `) as { rows: any[] };
        
        const row = upsertResult.rows[0];
        if (row) {
          const balanceAfter = row.quantity;
          const balanceBefore = balanceAfter - updated.quantity;
          await tx.insert(productionInventoryLogs).values({
            branchId: updated.branchId,
            productId: updated.productId,
            productName: updated.productName,
            movementType: 'production_in',
            quantity: updated.quantity,
            balanceBefore,
            balanceAfter,
            referenceType: 'batch',
            referenceId: updated.id,
            notes: `ترحيل من إكمال دفعة الإنتاج #${updated.id}`,
          });
        }
      } catch (invErr) {
        console.error("Error transferring finished batch to inventory:", invErr);
      }

      if (updated.destination === 'display_bar' && updated.productId) {
        const batchRef = `PROD-${updated.id}`;
        console.log(`[Auto-Receipt Finish] Creating receipt for batch ${batchRef}, product: ${updated.productName}`);
        const existingReceipt = await tx.select({ id: displayBarReceipts.id })
          .from(displayBarReceipts)
          .where(eq(displayBarReceipts.productionBatch, batchRef))
          .limit(1);
        if (existingReceipt.length === 0) {
          const saudiTime = getSaudiArabiaTime();
          const receiptDate = updated.productionDate || saudiTime.date;
          await tx.insert(displayBarReceipts).values({
            branchId: updated.branchId,
            productId: updated.productId,
            receiptDate,
            receiptTime: saudiTime.timeShort,
            quantity: updated.quantity,
            productionBatch: batchRef,
            notes: `استلام تلقائي من إكمال دفعة الإنتاج - ${updated.productName}`,
          });
          console.log(`[Auto-Receipt Finish] Successfully created receipt for ${batchRef}`);
        } else {
          console.log(`[Auto-Receipt Finish] Receipt already exists for ${batchRef}, skipping`);
        }
      } else {
        console.log(`[Auto-Receipt Finish] Skipping: destination=${updated.destination}, productId=${updated.productId}`);
      }

      return updated;
    });
  }

  // Carry over batch to next day
  async carryOverBatch(sourceBatchId: number, newDate: Date, additionalQuantity?: number): Promise<DailyProductionBatch | undefined> {
    const sourceBatch = await this.getDailyProductionBatch(sourceBatchId);
    if (!sourceBatch) return undefined;
    
    const [newBatch] = await db.insert(dailyProductionBatches).values({
      branchId: sourceBatch.branchId,
      productId: sourceBatch.productId,
      productName: sourceBatch.productName,
      productCategory: sourceBatch.productCategory,
      quantity: additionalQuantity || sourceBatch.quantity,
      unit: sourceBatch.unit,
      destination: sourceBatch.destination,
      shiftId: sourceBatch.shiftId,
      producedAt: newDate,
      recordedBy: sourceBatch.recordedBy,
      recorderName: sourceBatch.recorderName,
      notes: `ترحيل من دفعة #${sourceBatchId}`,
      status: 'in_progress',
      chefId: sourceBatch.chefId,
      chefName: sourceBatch.chefName,
      sourceBatchId: sourceBatchId,
    }).returning();
    return newBatch;
  }

  async getDailyProductionBatch(id: number): Promise<DailyProductionBatch | undefined> {
    const [batch] = await db.select().from(dailyProductionBatches).where(eq(dailyProductionBatches.id, id));
    return batch || undefined;
  }

  async createDailyProductionBatch(batch: InsertDailyProductionBatch): Promise<DailyProductionBatch> {
    const [newBatch] = await db.insert(dailyProductionBatches).values(batch).returning();
    return newBatch;
  }

  async createDailyProductionBatchWithTransfer(batch: InsertDailyProductionBatch, userId?: string, userName?: string): Promise<{ batch: DailyProductionBatch; transferred: boolean }> {
    return await db.transaction(async (tx) => {
      const [newBatch] = await tx.insert(dailyProductionBatches).values(batch).returning();
      
      let transferred = false;
      if (newBatch && batch.status === "finished") {
        const productionDate = newBatch.productionDate || new Date().toISOString().split('T')[0];
        const productNameNormalized = (newBatch.productName || '').trim().toLowerCase();
        
        const upsertResult = await tx.execute(sql`
          INSERT INTO finished_goods_inventory (branch_id, product_id, product_name, product_name_normalized, product_category, quantity, unit, production_date, last_batch_id, created_at, updated_at)
          VALUES (${newBatch.branchId}, ${newBatch.productId}, ${newBatch.productName}, ${productNameNormalized}, ${newBatch.productCategory}, ${newBatch.quantity}, ${newBatch.unit || 'قطعة'}, ${productionDate}, ${newBatch.id}, NOW(), NOW())
          ON CONFLICT (branch_id, product_name_normalized, production_date)
          DO UPDATE SET 
            quantity = finished_goods_inventory.quantity + EXCLUDED.quantity,
            last_batch_id = EXCLUDED.last_batch_id,
            product_id = COALESCE(EXCLUDED.product_id, finished_goods_inventory.product_id),
            updated_at = NOW()
          RETURNING id, quantity
        `) as { rows: any[] };
        
        const row = upsertResult.rows[0];
        const balanceAfter = row.quantity;
        const balanceBefore = balanceAfter - newBatch.quantity;
        
        await tx.insert(productionInventoryLogs).values({
          branchId: newBatch.branchId,
          productId: newBatch.productId,
          productName: newBatch.productName,
          movementType: 'production_in',
          quantity: newBatch.quantity,
          balanceBefore,
          balanceAfter,
          referenceType: 'batch',
          referenceId: newBatch.id,
          notes: `ترحيل من دفعة الإنتاج #${newBatch.id}`,
          createdBy: userId,
          createdByName: userName,
        });
        
        transferred = true;

        if (newBatch.destination === 'display_bar' && newBatch.productId) {
          const batchRef = `PROD-${newBatch.id}`;
          console.log(`[Auto-Receipt] Creating receipt for batch ${batchRef}, product: ${newBatch.productName}, branch: ${newBatch.branchId}`);
          const existingReceipt = await tx.select({ id: displayBarReceipts.id })
            .from(displayBarReceipts)
            .where(eq(displayBarReceipts.productionBatch, batchRef))
            .limit(1);
          if (existingReceipt.length === 0) {
            const saudiTime = getSaudiArabiaTime();
            const receiptDate = newBatch.productionDate || saudiTime.date;
            await tx.insert(displayBarReceipts).values({
              branchId: newBatch.branchId,
              productId: newBatch.productId,
              receiptDate,
              receiptTime: saudiTime.timeShort,
              quantity: newBatch.quantity,
              receivedBy: userId || null,
              productionBatch: batchRef,
              notes: `استلام تلقائي من الإنتاج الفعلي اليومي - ${newBatch.productName}`,
            });
            console.log(`[Auto-Receipt] Successfully created receipt for ${batchRef}`);
          } else {
            console.log(`[Auto-Receipt] Receipt already exists for ${batchRef}, skipping`);
          }
        } else {
          console.log(`[Auto-Receipt] Skipping: destination=${newBatch.destination}, productId=${newBatch.productId}`);
        }
      } else {
        console.log(`[Auto-Receipt] Skipping batch ${newBatch?.id}: status=${batch.status}`);
      }
      
      return { batch: newBatch, transferred };
    });
  }

  async updateDailyProductionBatch(id: number, batch: Partial<InsertDailyProductionBatch>): Promise<DailyProductionBatch | undefined> {
    const [updated] = await db.update(dailyProductionBatches)
      .set(batch)
      .where(eq(dailyProductionBatches.id, id))
      .returning();
    return updated || undefined;
  }

  async updateDailyProductionBatchWithTransfer(id: number, batch: Partial<InsertDailyProductionBatch>, userId?: string, userName?: string): Promise<{ batch: DailyProductionBatch | undefined; transferred: boolean }> {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(dailyProductionBatches).where(eq(dailyProductionBatches.id, id));
      if (!existing) {
        return { batch: undefined, transferred: false };
      }
      
      const [updated] = await tx.update(dailyProductionBatches)
        .set(batch)
        .where(eq(dailyProductionBatches.id, id))
        .returning();
      
      if (!updated) {
        return { batch: undefined, transferred: false };
      }
      
      let transferred = false;
      if (batch.status === "finished" && existing.status !== "finished") {
        const productionDate = updated.productionDate || new Date().toISOString().split('T')[0];
        const productNameNormalized = (updated.productName || '').trim().toLowerCase();
        
        const upsertResult = await tx.execute(sql`
          INSERT INTO finished_goods_inventory (branch_id, product_id, product_name, product_name_normalized, product_category, quantity, unit, production_date, last_batch_id, created_at, updated_at)
          VALUES (${updated.branchId}, ${updated.productId}, ${updated.productName}, ${productNameNormalized}, ${updated.productCategory}, ${updated.quantity}, ${updated.unit || 'قطعة'}, ${productionDate}, ${updated.id}, NOW(), NOW())
          ON CONFLICT (branch_id, product_name_normalized, production_date)
          DO UPDATE SET 
            quantity = finished_goods_inventory.quantity + EXCLUDED.quantity,
            last_batch_id = EXCLUDED.last_batch_id,
            product_id = COALESCE(EXCLUDED.product_id, finished_goods_inventory.product_id),
            updated_at = NOW()
          RETURNING id, quantity
        `) as { rows: any[] };
        
        const row = upsertResult.rows[0];
        const balanceAfter = row.quantity;
        const balanceBefore = balanceAfter - updated.quantity;
        
        await tx.insert(productionInventoryLogs).values({
          branchId: updated.branchId,
          productId: updated.productId,
          productName: updated.productName,
          movementType: 'production_in',
          quantity: updated.quantity,
          balanceBefore,
          balanceAfter,
          referenceType: 'batch',
          referenceId: updated.id,
          notes: `ترحيل من دفعة الإنتاج #${updated.id}`,
          createdBy: userId,
          createdByName: userName,
        });
        
        transferred = true;

        if (updated.destination === 'display_bar' && updated.productId) {
          const batchRef = `PROD-${updated.id}`;
          console.log(`[Auto-Receipt Update] Creating receipt for batch ${batchRef}, product: ${updated.productName}`);
          const existingReceipt = await tx.select({ id: displayBarReceipts.id })
            .from(displayBarReceipts)
            .where(eq(displayBarReceipts.productionBatch, batchRef))
            .limit(1);
          if (existingReceipt.length === 0) {
            const saudiTime = getSaudiArabiaTime();
            const receiptDate = updated.productionDate || saudiTime.date;
            await tx.insert(displayBarReceipts).values({
              branchId: updated.branchId,
              productId: updated.productId,
              receiptDate,
              receiptTime: saudiTime.timeShort,
              quantity: updated.quantity,
              receivedBy: userId || null,
              productionBatch: batchRef,
              notes: `استلام تلقائي من الإنتاج الفعلي اليومي - ${updated.productName}`,
            });
            console.log(`[Auto-Receipt Update] Successfully created receipt for ${batchRef}`);
          } else {
            console.log(`[Auto-Receipt Update] Receipt already exists for ${batchRef}, skipping`);
          }
        }
      }
      
      return { batch: updated, transferred };
    });
  }

  async deleteDailyProductionBatch(id: number): Promise<boolean> {
    const result = await db.delete(dailyProductionBatches).where(eq(dailyProductionBatches.id, id));
    return true;
  }

  async getDailyProductionStats(branchId: string, date: string): Promise<{
    totalBatches: number;
    totalQuantity: number;
    byDestination: Record<string, number>;
    byCategory: Record<string, number>;
    byHour: Record<string, number>;
  }> {
    const conditions = [eq(dailyProductionBatches.productionDate, date)];
    if (branchId !== "all") {
      conditions.push(eq(dailyProductionBatches.branchId, branchId));
    }
    const batches = await db.select().from(dailyProductionBatches)
      .where(and(...conditions));

    const byDestination: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byHour: Record<string, number> = {};
    let totalQuantity = 0;

    for (const batch of batches) {
      totalQuantity += batch.quantity;
      
      // By destination
      const dest = batch.destination;
      byDestination[dest] = (byDestination[dest] || 0) + batch.quantity;
      
      // By category
      const cat = batch.productCategory || 'غير محدد';
      byCategory[cat] = (byCategory[cat] || 0) + batch.quantity;
      
      // By hour
      const hour = batch.producedAt.getHours().toString().padStart(2, '0') + ':00';
      byHour[hour] = (byHour[hour] || 0) + batch.quantity;
    }

    return {
      totalBatches: batches.length,
      totalQuantity,
      byDestination,
      byCategory,
      byHour,
    };
  }

  // Unified Command Center - aggregates all KPIs
  async getCommandCenterData(branchId: string, date: string): Promise<{
    production: {
      totalBatches: number;
      totalQuantity: number;
      targetQuantity: number;
      completionRate: number;
      gap: number;
      byDestination: Record<string, number>;
      activeOrders: number;
      completedOrders: number;
    };
    inventory: {
      totalItems: number;
      totalValue: number;
      lowStockCount: number;
      maintenanceNeeded: number;
      goodCondition: number;
      damaged: number;
    };
    cashier: {
      totalSales: number;
      totalJournals: number;
      shortages: number;
      surpluses: number;
      shortageAmount: number;
      surplusAmount: number;
      averageTicket: number;
    };
    waste: {
      totalReports: number;
      totalWastedQuantity: number;
      totalWastedValue: number;
      wasteByReason: Record<string, number>;
    };
    comparison: {
      productionVsYesterday: number;
      salesVsYesterday: number;
    };
  }> {
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const [
      prodStats,
      yesterdayProdStats,
      targetData,
      orderCountResult,
      invAggResult,
      cashierAggResult,
      yesterdayCashierAgg,
      wasteReportsList,
    ] = await Promise.all([
      this.getDailyProductionStats(branchId, date),
      this.getDailyProductionStats(branchId, yesterdayStr),
      this.getProductionTargetsByDate(branchId, date),
      db.select({
        status: advancedProductionOrders.status,
        count: sql<number>`count(*)::int`,
      }).from(advancedProductionOrders)
        .where(branchId !== 'all' ? or(
          eq(advancedProductionOrders.sourceBranchId, branchId),
          eq(advancedProductionOrders.targetBranchId, branchId)
        ) : undefined)
        .groupBy(advancedProductionOrders.status),
      db.select({
        totalItems: sql<number>`count(*)::int`,
        totalValue: sql<number>`coalesce(sum(price * greatest(quantity, 1)), 0)::numeric`,
        lowStockCount: sql<number>`count(*) filter (where quantity < 5)::int`,
        maintenanceNeeded: sql<number>`count(*) filter (where status = 'maintenance')::int`,
        goodCondition: sql<number>`count(*) filter (where status = 'good')::int`,
        damaged: sql<number>`count(*) filter (where status = 'damaged' or status = 'missing')::int`,
      }).from(inventoryItems)
        .where(branchId !== 'all' ? eq(inventoryItems.branchId, branchId) : undefined),
      db.select({
        totalSales: sql<number>`coalesce(sum(total_sales), 0)::numeric`,
        totalJournals: sql<number>`count(*)::int`,
        shortages: sql<number>`count(*) filter (where discrepancy_status = 'shortage')::int`,
        surpluses: sql<number>`count(*) filter (where discrepancy_status = 'surplus')::int`,
        shortageAmount: sql<number>`coalesce(sum(discrepancy_amount) filter (where discrepancy_status = 'shortage'), 0)::numeric`,
        surplusAmount: sql<number>`coalesce(sum(discrepancy_amount) filter (where discrepancy_status = 'surplus'), 0)::numeric`,
        averageTicket: sql<number>`coalesce(avg(average_ticket) filter (where average_ticket > 0), 0)::numeric`,
      }).from(cashierSalesJournals)
        .where(and(
          eq(cashierSalesJournals.journalDate, date),
          branchId !== 'all' ? eq(cashierSalesJournals.branchId, branchId) : undefined
        )),
      db.select({
        totalSales: sql<number>`coalesce(sum(total_sales), 0)::numeric`,
      }).from(cashierSalesJournals)
        .where(and(
          eq(cashierSalesJournals.journalDate, yesterdayStr),
          branchId !== 'all' ? eq(cashierSalesJournals.branchId, branchId) : undefined
        )),
      this.getWasteReports(branchId !== 'all' ? branchId : undefined, date, date),
    ]);

    const totalTarget = targetData.totalTarget;
    const totalProduced = targetData.totalProduced;

    const orderCounts: Record<string, number> = {};
    for (const row of orderCountResult) {
      orderCounts[row.status] = (orderCounts[row.status] || 0) + row.count;
    }
    const activeOrders = (orderCounts['pending'] || 0) + (orderCounts['in_progress'] || 0);
    const completedOrders = orderCounts['completed'] || 0;

    const inv = invAggResult[0] || { totalItems: 0, totalValue: 0, lowStockCount: 0, maintenanceNeeded: 0, goodCondition: 0, damaged: 0 };
    const cashierStats = cashierAggResult[0] || { totalSales: 0, totalJournals: 0, shortages: 0, surpluses: 0, shortageAmount: 0, surplusAmount: 0, averageTicket: 0 };
    const totalSales = Number(cashierStats.totalSales);
    const yesterdaySales = Number(yesterdayCashierAgg[0]?.totalSales || 0);

    let totalWastedQuantity = 0;
    let totalWastedValue = 0;
    const wasteByReason: Record<string, number> = {};

    const reportIds = wasteReportsList.map(r => r.id);
    if (reportIds.length > 0) {
      const allWasteItemsList = await db.select().from(wasteItems).where(inArray(wasteItems.wasteReportId, reportIds));
      for (const item of allWasteItemsList) {
        totalWastedQuantity += item.quantity;
        totalWastedValue += item.totalValue || 0;
        wasteByReason[item.wasteReason] = (wasteByReason[item.wasteReason] || 0) + item.quantity;
      }
    }

    const completionRate = totalTarget > 0 ? (totalProduced / totalTarget) * 100 : 0;
    const productionVsYesterday = yesterdayProdStats.totalQuantity > 0 
      ? ((prodStats.totalQuantity - yesterdayProdStats.totalQuantity) / yesterdayProdStats.totalQuantity) * 100 
      : 0;
    const salesVsYesterday = yesterdaySales > 0 
      ? ((totalSales - yesterdaySales) / yesterdaySales) * 100 
      : 0;

    return {
      production: {
        totalBatches: prodStats.totalBatches,
        totalQuantity: prodStats.totalQuantity,
        targetQuantity: totalTarget,
        completionRate,
        gap: totalTarget - totalProduced,
        byDestination: prodStats.byDestination,
        activeOrders,
        completedOrders,
      },
      inventory: {
        totalItems: Number(inv.totalItems),
        totalValue: Number(inv.totalValue),
        lowStockCount: Number(inv.lowStockCount),
        maintenanceNeeded: Number(inv.maintenanceNeeded),
        goodCondition: Number(inv.goodCondition),
        damaged: Number(inv.damaged),
      },
      cashier: {
        totalSales,
        totalJournals: Number(cashierStats.totalJournals),
        shortages: Number(cashierStats.shortages),
        surpluses: Number(cashierStats.surpluses),
        shortageAmount: Number(cashierStats.shortageAmount),
        surplusAmount: Number(cashierStats.surplusAmount),
        averageTicket: Number(cashierStats.averageTicket),
      },
      waste: {
        totalReports: wasteReportsList.length,
        totalWastedQuantity,
        totalWastedValue,
        wasteByReason,
      },
      comparison: {
        productionVsYesterday,
        salesVsYesterday,
      },
    };
  }

  // ==================== RBAC System Methods ====================
  
  // Departments
  async getAllDepartments(): Promise<Department[]> {
    return await db.select().from(departments).orderBy(departments.name);
  }

  async getDepartment(id: number): Promise<Department | undefined> {
    const [dept] = await db.select().from(departments).where(eq(departments.id, id));
    return dept;
  }

  async createDepartment(dept: InsertDepartment): Promise<Department> {
    const [created] = await db.insert(departments).values(dept).returning();
    return created;
  }

  async updateDepartment(id: number, dept: Partial<InsertDepartment>): Promise<Department | undefined> {
    const [updated] = await db.update(departments).set({ ...dept, updatedAt: new Date() }).where(eq(departments.id, id)).returning();
    return updated;
  }

  // Roles
  async getAllRoles(): Promise<Role[]> {
    return await db.select().from(roles).orderBy(roles.hierarchyLevel);
  }

  async getRole(id: number): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role;
  }

  async getRoleBySlug(slug: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.slug, slug));
    return role;
  }

  async createRole(role: InsertRole): Promise<Role> {
    const [created] = await db.insert(roles).values(role).returning();
    return created;
  }

  async updateRole(id: number, role: Partial<InsertRole>): Promise<Role | undefined> {
    const [updated] = await db.update(roles).set({ ...role, updatedAt: new Date() }).where(eq(roles.id, id)).returning();
    return updated;
  }

  // Permissions
  async getAllPermissions(): Promise<Permission[]> {
    return await db.select().from(permissions).orderBy(permissions.module, permissions.action);
  }

  async getPermission(id: number): Promise<Permission | undefined> {
    const [perm] = await db.select().from(permissions).where(eq(permissions.id, id));
    return perm;
  }

  async getPermissionsByModule(module: string): Promise<Permission[]> {
    return await db.select().from(permissions).where(eq(permissions.module, module));
  }

  async createPermission(perm: InsertPermission): Promise<Permission> {
    const [created] = await db.insert(permissions).values(perm).returning();
    return created;
  }

  // Role Permissions
  async getRolePermissions(roleId: number): Promise<RolePermission[]> {
    return await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  }

  async addRolePermission(rp: InsertRolePermission): Promise<RolePermission> {
    const [created] = await db.insert(rolePermissions).values(rp).returning();
    return created;
  }

  async removeRolePermission(roleId: number, permissionId: number): Promise<boolean> {
    const result = await db.delete(rolePermissions).where(
      and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId))
    );
    return true;
  }

  // User Assignments
  async getUserAssignments(userId: string): Promise<UserAssignment[]> {
    return await db.select().from(userAssignments).where(eq(userAssignments.userId, userId));
  }

  async getUserPrimaryAssignment(userId: string): Promise<UserAssignment | undefined> {
    const [assignment] = await db.select().from(userAssignments).where(
      and(eq(userAssignments.userId, userId), eq(userAssignments.isPrimary, true), eq(userAssignments.isActive, true))
    );
    return assignment;
  }

  async createUserAssignment(assignment: InsertUserAssignment): Promise<UserAssignment> {
    const [created] = await db.insert(userAssignments).values(assignment).returning();
    // Invalidate permissions cache - role assignment affects user permissions
    this.invalidatePermissionsCache(assignment.userId);
    return created;
  }

  async updateUserAssignment(id: number, assignment: Partial<InsertUserAssignment>): Promise<UserAssignment | undefined> {
    // Get the assignment to find userId before update
    const [existing] = await db.select().from(userAssignments).where(eq(userAssignments.id, id));
    const [updated] = await db.update(userAssignments).set({ ...assignment, updatedAt: new Date() }).where(eq(userAssignments.id, id)).returning();
    // Invalidate permissions cache for both old and new user if changed
    if (existing) {
      this.invalidatePermissionsCache(existing.userId);
    }
    if (updated && assignment.userId && assignment.userId !== existing?.userId) {
      this.invalidatePermissionsCache(assignment.userId);
    }
    return updated;
  }

  async deleteUserAssignment(id: number): Promise<boolean> {
    // Get the assignment to find userId before delete
    const [existing] = await db.select().from(userAssignments).where(eq(userAssignments.id, id));
    await db.delete(userAssignments).where(eq(userAssignments.id, id));
    // Invalidate permissions cache - role removal affects user permissions
    if (existing) {
      this.invalidatePermissionsCache(existing.userId);
    }
    return true;
  }

  // User Permission Overrides
  async getUserPermissionOverrides(userId: string): Promise<UserPermissionOverride[]> {
    return await db.select().from(userPermissionOverrides).where(eq(userPermissionOverrides.userId, userId));
  }

  async createUserPermissionOverride(override: InsertUserPermissionOverride): Promise<UserPermissionOverride> {
    const [created] = await db.insert(userPermissionOverrides).values(override).returning();
    return created;
  }

  async deleteUserPermissionOverride(id: number): Promise<boolean> {
    await db.delete(userPermissionOverrides).where(eq(userPermissionOverrides.id, id));
    return true;
  }

  // User Branch Access
  async getUserBranchAccess(userId: string): Promise<UserBranchAccess[]> {
    return await db.select().from(userBranchAccess).where(eq(userBranchAccess.userId, userId));
  }

  async addUserBranchAccess(access: InsertUserBranchAccess): Promise<UserBranchAccess> {
    const [created] = await db.insert(userBranchAccess).values(access).returning();
    return created;
  }

  async removeUserBranchAccess(userId: string, branchId: string): Promise<boolean> {
    await db.delete(userBranchAccess).where(
      and(eq(userBranchAccess.userId, userId), eq(userBranchAccess.branchId, branchId))
    );
    return true;
  }

  async setUserDefaultBranch(userId: string, branchId: string): Promise<void> {
    await db.update(userBranchAccess).set({ isDefault: false }).where(eq(userBranchAccess.userId, userId));
    await db.update(userBranchAccess).set({ isDefault: true }).where(
      and(eq(userBranchAccess.userId, userId), eq(userBranchAccess.branchId, branchId))
    );
  }

  // Get User Effective Permissions (combining role permissions + overrides)
  async getUserEffectivePermissions(userId: string): Promise<{
    permissions: Array<{ module: string; action: string; allowed: boolean }>;
    allowedBranches: string[];
    allowedDepartments: number[];
    primaryRole: Role | null;
  }> {
    const assignments = await this.getUserAssignments(userId);
    const overrides = await this.getUserPermissionOverrides(userId);
    const branchAccess = await this.getUserBranchAccess(userId);
    
    const allPermissions = await this.getAllPermissions();
    const effectivePermissions: Map<string, { module: string; action: string; allowed: boolean }> = new Map();
    
    let primaryRole: Role | null = null;
    
    // Get permissions from all assigned roles
    for (const assignment of assignments) {
      if (!assignment.isActive) continue;
      
      const role = await this.getRole(assignment.roleId);
      if (role && assignment.isPrimary) {
        primaryRole = role;
      }
      
      const rolePerms = await this.getRolePermissions(assignment.roleId);
      for (const rp of rolePerms) {
        const perm = allPermissions.find(p => p.id === rp.permissionId);
        if (perm) {
          const key = `${perm.module}:${perm.action}`;
          effectivePermissions.set(key, { module: perm.module, action: perm.action, allowed: true });
        }
      }
    }
    
    // Apply overrides (grant or revoke specific permissions)
    for (const override of overrides) {
      if (override.expiresAt && new Date(override.expiresAt) < new Date()) continue;
      
      const perm = allPermissions.find(p => p.id === override.permissionId);
      if (perm) {
        const key = `${perm.module}:${perm.action}`;
        effectivePermissions.set(key, { module: perm.module, action: perm.action, allowed: override.allow });
      }
    }
    
    // Determine allowed branches
    let allowedBranches: string[] = [];
    if (branchAccess.length > 0) {
      allowedBranches = branchAccess.map(ba => ba.branchId);
    } else {
      // Check if any assignment has global scope
      const hasGlobalScope = assignments.some(a => a.scopeType === 'global' && a.isActive);
      if (hasGlobalScope) {
        const allBranches = await this.getAllBranches();
        allowedBranches = allBranches.map(b => b.id);
      } else {
        allowedBranches = assignments.filter(a => a.branchId && a.isActive).map(a => a.branchId!);
      }
    }
    
    // Determine allowed departments
    const allowedDepartments: number[] = assignments
      .filter(a => a.departmentId && a.isActive)
      .map(a => a.departmentId!);
    
    return {
      permissions: Array.from(effectivePermissions.values()),
      allowedBranches: Array.from(new Set(allowedBranches)),
      allowedDepartments: Array.from(new Set(allowedDepartments)),
      primaryRole,
    };
  }

  // Check if user has specific permission
  async userHasPermission(userId: string, module: string, action: string, branchId?: string): Promise<boolean> {
    const { permissions, allowedBranches } = await this.getUserEffectivePermissions(userId);
    
    const hasPerm = permissions.some(p => p.module === module && p.action === action && p.allowed);
    if (!hasPerm) return false;
    
    if (branchId && allowedBranches.length > 0) {
      return allowedBranches.includes(branchId);
    }
    
    return true;
  }

  // ==========================================
  // User Security Settings - إعدادات أمان المستخدم
  // ==========================================

  async getUserSecuritySettings(userId: string): Promise<UserSecuritySettings | undefined> {
    const [settings] = await db.select().from(userSecuritySettings).where(eq(userSecuritySettings.userId, userId));
    return settings;
  }

  async createUserSecuritySettings(settings: InsertUserSecuritySettings): Promise<UserSecuritySettings> {
    const [created] = await db.insert(userSecuritySettings).values(settings).returning();
    return created;
  }

  async updateUserSecuritySettings(userId: string, settings: Partial<InsertUserSecuritySettings>): Promise<UserSecuritySettings | undefined> {
    const { trustedDevices, ...rest } = settings;
    const updateData: any = { ...rest, updatedAt: new Date() };
    if (trustedDevices !== undefined) {
      updateData.trustedDevices = trustedDevices;
    }
    const [updated] = await db.update(userSecuritySettings)
      .set(updateData)
      .where(eq(userSecuritySettings.userId, userId))
      .returning();
    return updated;
  }

  async upsertUserSecuritySettings(userId: string, settings: Partial<InsertUserSecuritySettings>): Promise<UserSecuritySettings> {
    const existing = await this.getUserSecuritySettings(userId);
    if (existing) {
      return (await this.updateUserSecuritySettings(userId, settings))!;
    }
    return await this.createUserSecuritySettings({ userId, ...settings } as InsertUserSecuritySettings);
  }

  async recordFailedLogin(userId: string): Promise<void> {
    const settings = await this.getUserSecuritySettings(userId);
    const attempts = (settings?.failedLoginAttempts || 0) + 1;
    const lockUntil = attempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null; // Lock for 30 mins after 5 attempts
    await this.upsertUserSecuritySettings(userId, { failedLoginAttempts: attempts, lockedUntil: lockUntil });
  }

  async recordSuccessfulLogin(userId: string, ip?: string, device?: string): Promise<void> {
    await this.upsertUserSecuritySettings(userId, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ip || null,
      lastLoginDevice: device || null,
    });
  }

  async isUserLocked(userId: string): Promise<boolean> {
    const settings = await this.getUserSecuritySettings(userId);
    if (!settings?.lockedUntil) return false;
    return new Date(settings.lockedUntil) > new Date();
  }

  // ==========================================
  // User Sessions - جلسات المستخدمين
  // ==========================================

  async getUserSessions(userId: string): Promise<UserSession[]> {
    return await db.select().from(userSessions)
      .where(and(eq(userSessions.userId, userId), eq(userSessions.isActive, true)))
      .orderBy(desc(userSessions.lastActivityAt));
  }

  async createUserSession(session: InsertUserSession): Promise<UserSession> {
    const [created] = await db.insert(userSessions).values(session).returning();
    return created;
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    await db.update(userSessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(userSessions.sessionId, sessionId));
  }

  async invalidateSession(sessionId: string): Promise<void> {
    await db.update(userSessions)
      .set({ isActive: false })
      .where(eq(userSessions.sessionId, sessionId));
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    await db.update(userSessions)
      .set({ isActive: false })
      .where(eq(userSessions.userId, userId));
  }

  async invalidateAllUserSessionsExcept(userId: string, exceptSessionId: string): Promise<void> {
    await db.update(userSessions)
      .set({ isActive: false })
      .where(and(eq(userSessions.userId, userId), sql`${userSessions.sessionId} != ${exceptSessionId}`));
  }

  async getActiveSessionCount(userId: string): Promise<number> {
    const sessions = await db.select().from(userSessions)
      .where(and(eq(userSessions.userId, userId), eq(userSessions.isActive, true)));
    return sessions.length;
  }

  async cleanupExpiredSessions(): Promise<number> {
    const result = await db.delete(userSessions)
      .where(lte(userSessions.expiresAt, new Date()))
      .returning();
    return result.length;
  }

  async getAllActiveSessions(): Promise<UserSession[]> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return await db.select().from(userSessions)
      .where(and(
        eq(userSessions.isActive, true),
        gte(userSessions.lastActivityAt, fiveMinutesAgo)
      ))
      .orderBy(desc(userSessions.lastActivityAt));
  }

  // ==========================================
  // Security Violation Alerts - تنبيهات الانتهاكات
  // ==========================================

  async getAllSecurityAlerts(filters?: { userId?: string; violationType?: string; isResolved?: boolean }): Promise<SecurityViolationAlert[]> {
    const conditions = [];
    if (filters?.userId) conditions.push(eq(securityViolationAlerts.userId, filters.userId));
    if (filters?.violationType) conditions.push(eq(securityViolationAlerts.violationType, filters.violationType));
    if (filters?.isResolved !== undefined) conditions.push(eq(securityViolationAlerts.isResolved, filters.isResolved));
    
    if (conditions.length > 0) {
      return await db.select().from(securityViolationAlerts).where(and(...conditions)).orderBy(desc(securityViolationAlerts.createdAt));
    }
    return await db.select().from(securityViolationAlerts).orderBy(desc(securityViolationAlerts.createdAt));
  }

  async createSecurityAlert(alert: InsertSecurityViolationAlert): Promise<SecurityViolationAlert> {
    const [created] = await db.insert(securityViolationAlerts).values(alert).returning();
    return created;
  }

  async resolveSecurityAlert(id: number, resolvedBy: string, notes?: string): Promise<SecurityViolationAlert | undefined> {
    const [updated] = await db.update(securityViolationAlerts)
      .set({ isResolved: true, resolvedBy, resolvedAt: new Date(), resolutionNotes: notes })
      .where(eq(securityViolationAlerts.id, id))
      .returning();
    return updated;
  }

  async getUnresolvedAlertCount(): Promise<number> {
    const alerts = await db.select().from(securityViolationAlerts).where(eq(securityViolationAlerts.isResolved, false));
    return alerts.length;
  }

  // ==========================================
  // Permission Check Logs - سجل فحص الصلاحيات
  // ==========================================

  async logPermissionCheck(log: InsertPermissionCheckLog): Promise<PermissionCheckLog> {
    const [created] = await db.insert(permissionCheckLogs).values(log).returning();
    return created;
  }

  async getPermissionCheckLogs(filters?: { userId?: string; module?: string; allowed?: boolean; limit?: number }): Promise<PermissionCheckLog[]> {
    const conditions = [];
    if (filters?.userId) conditions.push(eq(permissionCheckLogs.userId, filters.userId));
    if (filters?.module) conditions.push(eq(permissionCheckLogs.module, filters.module));
    if (filters?.allowed !== undefined) conditions.push(eq(permissionCheckLogs.allowed, filters.allowed));
    
    let query = db.select().from(permissionCheckLogs);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    const results = await query.orderBy(desc(permissionCheckLogs.createdAt)).limit(filters?.limit || 1000);
    return results;
  }

  async getDeniedPermissionsSummary(userId: string): Promise<{ module: string; action: string; count: number }[]> {
    const logs = await db.select().from(permissionCheckLogs)
      .where(and(eq(permissionCheckLogs.userId, userId), eq(permissionCheckLogs.allowed, false)));
    
    const summary = new Map<string, number>();
    for (const log of logs) {
      const key = `${log.module}:${log.action}`;
      summary.set(key, (summary.get(key) || 0) + 1);
    }
    
    return Array.from(summary.entries()).map(([key, count]) => {
      const [module, action] = key.split(':');
      return { module, action, count };
    }).sort((a, b) => b.count - a.count);
  }

  // ==========================================
  // Role Templates - قوالب الأدوار
  // ==========================================

  async getAllRoleTemplates(): Promise<RoleTemplate[]> {
    return await db.select().from(roleTemplates).orderBy(roleTemplates.name);
  }

  async getRoleTemplate(id: number): Promise<RoleTemplate | undefined> {
    const [template] = await db.select().from(roleTemplates).where(eq(roleTemplates.id, id));
    return template;
  }

  async getRoleTemplateBySlug(slug: string): Promise<RoleTemplate | undefined> {
    const [template] = await db.select().from(roleTemplates).where(eq(roleTemplates.slug, slug));
    return template;
  }

  async createRoleTemplate(template: InsertRoleTemplate): Promise<RoleTemplate> {
    const [created] = await db.insert(roleTemplates).values(template).returning();
    return created;
  }

  async updateRoleTemplate(id: number, template: Partial<InsertRoleTemplate>): Promise<RoleTemplate | undefined> {
    const { permissions, ...rest } = template;
    const updateData: any = { ...rest, updatedAt: new Date() };
    if (permissions !== undefined) {
      updateData.permissions = permissions;
    }
    const [updated] = await db.update(roleTemplates)
      .set(updateData)
      .where(eq(roleTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteRoleTemplate(id: number): Promise<boolean> {
    await db.delete(roleTemplates).where(eq(roleTemplates.id, id));
    return true;
  }

  async applyRoleTemplate(roleId: number, templateId: number): Promise<void> {
    const template = await this.getRoleTemplate(templateId);
    if (!template) throw new Error("Template not found");
    
    // Clear existing role permissions
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    
    // Get all permissions
    const allPermissions = await this.getAllPermissions();
    
    // Apply template permissions
    const templatePerms = template.permissions as Array<{ module: string; actions: string[] }>;
    for (const perm of templatePerms) {
      for (const action of perm.actions) {
        const permission = allPermissions.find(p => p.module === perm.module && p.action === action);
        if (permission) {
          await this.addRolePermission({ roleId, permissionId: permission.id });
        }
      }
    }
  }

  // ==========================================
  // Cashier Shift Targets - أهداف الكاشير للشفت
  // ==========================================
  
  async getAllCashierShiftTargets(filters?: { branchId?: string; date?: string; shiftType?: string }): Promise<CashierShiftTarget[]> {
    const conditions = [];
    if (filters?.branchId) conditions.push(eq(cashierShiftTargets.branchId, filters.branchId));
    if (filters?.shiftType) conditions.push(eq(cashierShiftTargets.shiftType, filters.shiftType));
    
    // For date filter, check if date falls within startDate-endDate range
    // This supports period-based targets (weekly/monthly)
    if (filters?.date) {
      conditions.push(lte(cashierShiftTargets.startDate, filters.date));
      conditions.push(gte(cashierShiftTargets.endDate, filters.date));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(cashierShiftTargets).where(and(...conditions)).orderBy(desc(cashierShiftTargets.startDate));
    }
    return await db.select().from(cashierShiftTargets).orderBy(desc(cashierShiftTargets.startDate));
  }

  async getCashierShiftTarget(id: number): Promise<CashierShiftTarget | undefined> {
    const [target] = await db.select().from(cashierShiftTargets).where(eq(cashierShiftTargets.id, id));
    return target;
  }

  async getCashierShiftTargetsByBranch(branchId: string, date: string): Promise<CashierShiftTarget[]> {
    // Query targets where the date falls within startDate-endDate range
    return await db.select().from(cashierShiftTargets).where(
      and(
        eq(cashierShiftTargets.branchId, branchId), 
        lte(cashierShiftTargets.startDate, date),
        gte(cashierShiftTargets.endDate, date)
      )
    );
  }

  async getCashierShiftTargetsByCashier(cashierId: string, startDate?: string, endDate?: string): Promise<CashierShiftTarget[]> {
    const conditions = [eq(cashierShiftTargets.cashierId, cashierId)];
    if (startDate) conditions.push(gte(cashierShiftTargets.targetDate, startDate));
    if (endDate) conditions.push(lte(cashierShiftTargets.targetDate, endDate));
    return await db.select().from(cashierShiftTargets).where(and(...conditions)).orderBy(desc(cashierShiftTargets.targetDate));
  }

  async createCashierShiftTarget(target: InsertCashierShiftTarget): Promise<CashierShiftTarget> {
    const [created] = await db.insert(cashierShiftTargets).values(target).returning();
    return created;
  }

  async updateCashierShiftTarget(id: number, target: Partial<InsertCashierShiftTarget>): Promise<CashierShiftTarget | undefined> {
    const [updated] = await db.update(cashierShiftTargets).set(target).where(eq(cashierShiftTargets.id, id)).returning();
    return updated;
  }

  async deleteCashierShiftTarget(id: number): Promise<boolean> {
    await db.delete(cashierShiftTargets).where(eq(cashierShiftTargets.id, id));
    return true;
  }

  async bulkCreateCashierShiftTargets(targets: InsertCashierShiftTarget[]): Promise<CashierShiftTarget[]> {
    if (targets.length === 0) return [];
    return await db.insert(cashierShiftTargets).values(targets).returning();
  }

  // ==========================================
  // Average Ticket Targets - أهداف متوسط الفاتورة
  // ==========================================

  async getAllAverageTicketTargets(filters?: { branchId?: string; isActive?: boolean }): Promise<AverageTicketTarget[]> {
    const conditions = [];
    if (filters?.branchId) conditions.push(eq(averageTicketTargets.branchId, filters.branchId));
    if (filters?.isActive !== undefined) conditions.push(eq(averageTicketTargets.isActive, filters.isActive));
    
    if (conditions.length > 0) {
      return await db.select().from(averageTicketTargets).where(and(...conditions));
    }
    return await db.select().from(averageTicketTargets);
  }

  async getAverageTicketTarget(id: number): Promise<AverageTicketTarget | undefined> {
    const [target] = await db.select().from(averageTicketTargets).where(eq(averageTicketTargets.id, id));
    return target;
  }

  async getActiveAverageTicketTargets(branchId?: string, cashierId?: string): Promise<AverageTicketTarget[]> {
    const conditions = [eq(averageTicketTargets.isActive, true)];
    if (branchId) conditions.push(eq(averageTicketTargets.branchId, branchId));
    if (cashierId) conditions.push(eq(averageTicketTargets.cashierId, cashierId));
    return await db.select().from(averageTicketTargets).where(and(...conditions));
  }

  async createAverageTicketTarget(target: InsertAverageTicketTarget): Promise<AverageTicketTarget> {
    const [created] = await db.insert(averageTicketTargets).values(target).returning();
    return created;
  }

  async updateAverageTicketTarget(id: number, target: Partial<InsertAverageTicketTarget>): Promise<AverageTicketTarget | undefined> {
    const [updated] = await db.update(averageTicketTargets).set({ ...target, updatedAt: new Date() }).where(eq(averageTicketTargets.id, id)).returning();
    return updated;
  }

  async deleteAverageTicketTarget(id: number): Promise<boolean> {
    await db.delete(averageTicketTargets).where(eq(averageTicketTargets.id, id));
    return true;
  }

  // ==========================================
  // Performance Alerts - تنبيهات الأداء
  // ==========================================

  async getAllPerformanceAlerts(filters?: { branchId?: string; date?: string; isRead?: boolean }): Promise<PerformanceAlert[]> {
    const conditions = [];
    if (filters?.branchId) conditions.push(eq(performanceAlerts.branchId, filters.branchId));
    if (filters?.isRead !== undefined) conditions.push(eq(performanceAlerts.isRead, filters.isRead));
    
    if (conditions.length > 0) {
      return await db.select().from(performanceAlerts).where(and(...conditions)).orderBy(desc(performanceAlerts.createdAt));
    }
    return await db.select().from(performanceAlerts).orderBy(desc(performanceAlerts.createdAt));
  }

  async getPerformanceAlert(id: number): Promise<PerformanceAlert | undefined> {
    const [alert] = await db.select().from(performanceAlerts).where(eq(performanceAlerts.id, id));
    return alert;
  }

  async getUnreadAlerts(branchId: string): Promise<PerformanceAlert[]> {
    return await db.select().from(performanceAlerts).where(
      and(eq(performanceAlerts.branchId, branchId), eq(performanceAlerts.isRead, false))
    ).orderBy(desc(performanceAlerts.createdAt));
  }

  async createPerformanceAlert(alert: InsertPerformanceAlert): Promise<PerformanceAlert> {
    const [created] = await db.insert(performanceAlerts).values(alert).returning();
    return created;
  }

  async markAlertAsRead(id: number): Promise<PerformanceAlert | undefined> {
    const [updated] = await db.update(performanceAlerts).set({ isRead: true }).where(eq(performanceAlerts.id, id)).returning();
    return updated;
  }

  async acknowledgeAlert(id: number, acknowledgedBy: string): Promise<PerformanceAlert | undefined> {
    // Mark as read since acknowledge columns don't exist in database
    const [updated] = await db.update(performanceAlerts).set({ 
      isRead: true
    }).where(eq(performanceAlerts.id, id)).returning();
    return updated;
  }

  async bulkMarkAlertsAsRead(ids: number[]): Promise<boolean> {
    if (ids.length === 0) return true;
    await db.update(performanceAlerts).set({ isRead: true }).where(inArray(performanceAlerts.id, ids));
    return true;
  }

  // ==========================================
  // Shift Performance Tracking - تتبع أداء الشفت
  // ==========================================

  async getAllShiftPerformanceTracking(filters?: { branchId?: string; date?: string }): Promise<ShiftPerformanceTracking[]> {
    const conditions = [];
    if (filters?.branchId) conditions.push(eq(shiftPerformanceTracking.branchId, filters.branchId));
    if (filters?.date) conditions.push(eq(shiftPerformanceTracking.trackingDate, filters.date));
    
    if (conditions.length > 0) {
      return await db.select().from(shiftPerformanceTracking).where(and(...conditions)).orderBy(desc(shiftPerformanceTracking.trackingDate));
    }
    return await db.select().from(shiftPerformanceTracking).orderBy(desc(shiftPerformanceTracking.trackingDate));
  }

  async getShiftPerformanceTracking(id: number): Promise<ShiftPerformanceTracking | undefined> {
    const [tracking] = await db.select().from(shiftPerformanceTracking).where(eq(shiftPerformanceTracking.id, id));
    return tracking;
  }

  async getActiveShiftPerformance(branchId: string, date: string, shiftType: string): Promise<ShiftPerformanceTracking | undefined> {
    const [tracking] = await db.select().from(shiftPerformanceTracking).where(
      and(
        eq(shiftPerformanceTracking.branchId, branchId),
        eq(shiftPerformanceTracking.trackingDate, date),
        eq(shiftPerformanceTracking.shiftType, shiftType)
      )
    );
    return tracking;
  }

  async createShiftPerformanceTracking(tracking: InsertShiftPerformanceTracking): Promise<ShiftPerformanceTracking> {
    const [created] = await db.insert(shiftPerformanceTracking).values(tracking).returning();
    return created;
  }

  async updateShiftPerformanceTracking(id: number, tracking: Partial<InsertShiftPerformanceTracking>): Promise<ShiftPerformanceTracking | undefined> {
    const [updated] = await db.update(shiftPerformanceTracking).set({ ...tracking, updatedAt: new Date() }).where(eq(shiftPerformanceTracking.id, id)).returning();
    return updated;
  }

  async upsertShiftPerformanceTracking(tracking: InsertShiftPerformanceTracking): Promise<ShiftPerformanceTracking> {
    const existing = await this.getActiveShiftPerformance(tracking.branchId, tracking.trackingDate, tracking.shiftType);
    if (existing) {
      const updated = await this.updateShiftPerformanceTracking(existing.id, tracking);
      return updated!;
    }
    return await this.createShiftPerformanceTracking(tracking);
  }

  // ==========================================
  // Marketing Module - إدارة التسويق
  // ==========================================

  // Marketing Campaigns - الحملات التسويقية
  async getAllMarketingCampaigns(filters?: { status?: string; season?: string; objective?: string }): Promise<MarketingCampaign[]> {
    const conditions = [];
    if (filters?.status) conditions.push(eq(marketingCampaigns.status, filters.status));
    if (filters?.season) conditions.push(eq(marketingCampaigns.season, filters.season));
    if (filters?.objective) conditions.push(eq(marketingCampaigns.objective, filters.objective));
    
    if (conditions.length > 0) {
      return await db.select().from(marketingCampaigns).where(and(...conditions)).orderBy(desc(marketingCampaigns.createdAt));
    }
    return await db.select().from(marketingCampaigns).orderBy(desc(marketingCampaigns.createdAt));
  }

  async getMarketingCampaign(id: number): Promise<MarketingCampaign | undefined> {
    const [campaign] = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.id, id));
    return campaign;
  }

  async createMarketingCampaign(campaign: InsertMarketingCampaign): Promise<MarketingCampaign> {
    const [created] = await db.insert(marketingCampaigns).values(campaign).returning();
    return created;
  }

  async updateMarketingCampaign(id: number, campaign: Partial<InsertMarketingCampaign>): Promise<MarketingCampaign | undefined> {
    const [updated] = await db.update(marketingCampaigns).set({ ...campaign, updatedAt: new Date() }).where(eq(marketingCampaigns.id, id)).returning();
    return updated;
  }

  async deleteMarketingCampaign(id: number): Promise<boolean> {
    await db.delete(marketingCampaigns).where(eq(marketingCampaigns.id, id));
    return true;
  }

  // Campaign Budget Allocations - توزيع الميزانية
  async getCampaignBudgetAllocations(campaignId: number): Promise<CampaignBudgetAllocation[]> {
    return await db.select().from(campaignBudgetAllocations).where(eq(campaignBudgetAllocations.campaignId, campaignId));
  }

  async getCampaignBudgetAllocation(id: number): Promise<CampaignBudgetAllocation | undefined> {
    const [allocation] = await db.select().from(campaignBudgetAllocations).where(eq(campaignBudgetAllocations.id, id));
    return allocation;
  }

  async createCampaignBudgetAllocation(allocation: InsertCampaignBudgetAllocation): Promise<CampaignBudgetAllocation> {
    const [created] = await db.insert(campaignBudgetAllocations).values(allocation).returning();
    return created;
  }

  async updateCampaignBudgetAllocation(id: number, allocation: Partial<InsertCampaignBudgetAllocation>): Promise<CampaignBudgetAllocation | undefined> {
    const [updated] = await db.update(campaignBudgetAllocations).set({ ...allocation, updatedAt: new Date() }).where(eq(campaignBudgetAllocations.id, id)).returning();
    return updated;
  }

  async deleteCampaignBudgetAllocation(id: number): Promise<boolean> {
    await db.delete(campaignBudgetAllocations).where(eq(campaignBudgetAllocations.id, id));
    return true;
  }

  // Campaign Goals - أهداف الحملة
  async getCampaignGoals(campaignId: number): Promise<CampaignGoal[]> {
    return await db.select().from(campaignGoals).where(eq(campaignGoals.campaignId, campaignId));
  }

  async getCampaignGoal(id: number): Promise<CampaignGoal | undefined> {
    const [goal] = await db.select().from(campaignGoals).where(eq(campaignGoals.id, id));
    return goal;
  }

  async createCampaignGoal(goal: InsertCampaignGoal): Promise<CampaignGoal> {
    const [created] = await db.insert(campaignGoals).values(goal).returning();
    return created;
  }

  async updateCampaignGoal(id: number, goal: Partial<InsertCampaignGoal>): Promise<CampaignGoal | undefined> {
    const [updated] = await db.update(campaignGoals).set({ ...goal, updatedAt: new Date() }).where(eq(campaignGoals.id, id)).returning();
    return updated;
  }

  async deleteCampaignGoal(id: number): Promise<boolean> {
    await db.delete(campaignGoals).where(eq(campaignGoals.id, id));
    return true;
  }

  // Campaign Expenses - مصروفات الحملات
  async getCampaignExpenses(campaignId: number): Promise<CampaignExpense[]> {
    return await db.select().from(campaignExpenses)
      .where(eq(campaignExpenses.campaignId, campaignId))
      .orderBy(desc(campaignExpenses.expenseDate));
  }

  async getAllCampaignExpenses(filters?: { campaignId?: number; category?: string; status?: string; startDate?: string; endDate?: string }): Promise<CampaignExpense[]> {
    const conditions = [];
    if (filters?.campaignId) conditions.push(eq(campaignExpenses.campaignId, filters.campaignId));
    if (filters?.category) conditions.push(eq(campaignExpenses.category, filters.category));
    if (filters?.status) conditions.push(eq(campaignExpenses.status, filters.status));
    if (filters?.startDate) conditions.push(gte(campaignExpenses.expenseDate, filters.startDate));
    if (filters?.endDate) conditions.push(lte(campaignExpenses.expenseDate, filters.endDate));
    
    return await db.select().from(campaignExpenses)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(campaignExpenses.expenseDate));
  }

  async getCampaignExpense(id: number): Promise<CampaignExpense | undefined> {
    const [expense] = await db.select().from(campaignExpenses).where(eq(campaignExpenses.id, id));
    return expense;
  }

  async createCampaignExpense(expense: InsertCampaignExpense): Promise<CampaignExpense> {
    const [created] = await db.insert(campaignExpenses).values(expense).returning();
    // Update campaign spent budget
    if (expense.campaignId && (expense.status === 'paid' || expense.status === 'approved')) {
      const campaign = await this.getMarketingCampaign(expense.campaignId);
      if (campaign) {
        await this.updateMarketingCampaign(expense.campaignId, {
          spentBudget: (campaign.spentBudget || 0) + expense.amount
        });
      }
    }
    return created;
  }

  async updateCampaignExpense(id: number, expense: Partial<InsertCampaignExpense>): Promise<CampaignExpense | undefined> {
    const existing = await this.getCampaignExpense(id);
    if (!existing) return undefined;
    
    const [updated] = await db.update(campaignExpenses)
      .set({ ...expense, updatedAt: new Date() })
      .where(eq(campaignExpenses.id, id))
      .returning();
    
    // Update campaign spent budget if status changed to paid/approved
    if (existing.campaignId && expense.status && (expense.status === 'paid' || expense.status === 'approved') && 
        existing.status !== 'paid' && existing.status !== 'approved') {
      const campaign = await this.getMarketingCampaign(existing.campaignId);
      if (campaign) {
        await this.updateMarketingCampaign(existing.campaignId, {
          spentBudget: (campaign.spentBudget || 0) + existing.amount
        });
      }
    }
    
    return updated;
  }

  async deleteCampaignExpense(id: number): Promise<boolean> {
    const expense = await this.getCampaignExpense(id);
    if (expense && expense.campaignId && (expense.status === 'paid' || expense.status === 'approved')) {
      // Reduce campaign spent budget
      const campaign = await this.getMarketingCampaign(expense.campaignId);
      if (campaign) {
        await this.updateMarketingCampaign(expense.campaignId, {
          spentBudget: Math.max(0, (campaign.spentBudget || 0) - expense.amount)
        });
      }
    }
    await db.delete(campaignExpenses).where(eq(campaignExpenses.id, id));
    return true;
  }

  async getCampaignTotalExpenses(campaignId: number): Promise<number> {
    const expenses = await db.select().from(campaignExpenses).where(
      and(
        eq(campaignExpenses.campaignId, campaignId),
        or(eq(campaignExpenses.status, 'paid'), eq(campaignExpenses.status, 'approved'))
      )
    );
    return expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }

  async getExpensesByCategory(campaignId: number): Promise<{ category: string; total: number }[]> {
    const expenses = await db.select().from(campaignExpenses).where(
      eq(campaignExpenses.campaignId, campaignId)
    );
    
    const categoryTotals: Record<string, number> = {};
    for (const expense of expenses) {
      const cat = expense.category;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (expense.amount || 0);
    }
    
    return Object.entries(categoryTotals).map(([category, total]) => ({ category, total }));
  }

  async getExpensesByInfluencerId(influencerId: number): Promise<CampaignExpense[]> {
    return await db.select().from(campaignExpenses)
      .where(eq(campaignExpenses.influencerId, influencerId))
      .orderBy(desc(campaignExpenses.expenseDate));
  }

  async getTotalExpensesByInfluencerId(influencerId: number): Promise<number> {
    const expenses = await db.select().from(campaignExpenses).where(
      and(
        eq(campaignExpenses.influencerId, influencerId),
        or(eq(campaignExpenses.status, 'paid'), eq(campaignExpenses.status, 'approved'))
      )
    );
    return expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }

  // Marketing Calendar Events - تقويم التسويق
  async getAllMarketingCalendarEvents(filters?: { campaignId?: number; startDate?: string; endDate?: string }): Promise<MarketingCalendarEvent[]> {
    const conditions = [];
    if (filters?.campaignId) conditions.push(eq(marketingCalendarEvents.campaignId, filters.campaignId));
    if (filters?.startDate) conditions.push(gte(marketingCalendarEvents.startDate, filters.startDate));
    if (filters?.endDate) conditions.push(lte(marketingCalendarEvents.startDate, filters.endDate));
    
    if (conditions.length > 0) {
      return await db.select().from(marketingCalendarEvents).where(and(...conditions)).orderBy(marketingCalendarEvents.startDate);
    }
    return await db.select().from(marketingCalendarEvents).orderBy(marketingCalendarEvents.startDate);
  }

  async getMarketingCalendarEvent(id: number): Promise<MarketingCalendarEvent | undefined> {
    const [event] = await db.select().from(marketingCalendarEvents).where(eq(marketingCalendarEvents.id, id));
    return event;
  }

  async createMarketingCalendarEvent(event: InsertMarketingCalendarEvent): Promise<MarketingCalendarEvent> {
    const [created] = await db.insert(marketingCalendarEvents).values(event).returning();
    return created;
  }

  async updateMarketingCalendarEvent(id: number, event: Partial<InsertMarketingCalendarEvent>): Promise<MarketingCalendarEvent | undefined> {
    const [updated] = await db.update(marketingCalendarEvents).set({ ...event, updatedAt: new Date() }).where(eq(marketingCalendarEvents.id, id)).returning();
    return updated;
  }

  async deleteMarketingCalendarEvent(id: number): Promise<boolean> {
    await db.delete(marketingCalendarEvents).where(eq(marketingCalendarEvents.id, id));
    return true;
  }

  // Marketing Influencers - المؤثرين
  async getAllMarketingInfluencers(filters?: { specialty?: string; isActive?: boolean }): Promise<MarketingInfluencer[]> {
    const conditions = [];
    if (filters?.specialty) conditions.push(eq(marketingInfluencers.specialty, filters.specialty));
    if (filters?.isActive !== undefined) conditions.push(eq(marketingInfluencers.isActive, filters.isActive));
    
    if (conditions.length > 0) {
      return await db.select().from(marketingInfluencers).where(and(...conditions)).orderBy(desc(marketingInfluencers.createdAt));
    }
    return await db.select().from(marketingInfluencers).orderBy(desc(marketingInfluencers.createdAt));
  }

  async getMarketingInfluencer(id: number): Promise<MarketingInfluencer | undefined> {
    const [influencer] = await db.select().from(marketingInfluencers).where(eq(marketingInfluencers.id, id));
    return influencer;
  }

  async createMarketingInfluencer(influencer: InsertMarketingInfluencer): Promise<MarketingInfluencer> {
    const [created] = await db.insert(marketingInfluencers).values(influencer).returning();
    return created;
  }

  async updateMarketingInfluencer(id: number, influencer: Partial<InsertMarketingInfluencer>): Promise<MarketingInfluencer | undefined> {
    const [updated] = await db.update(marketingInfluencers).set({ ...influencer, updatedAt: new Date() }).where(eq(marketingInfluencers.id, id)).returning();
    return updated;
  }

  async deleteMarketingInfluencer(id: number): Promise<boolean> {
    await db.delete(marketingInfluencers).where(eq(marketingInfluencers.id, id));
    return true;
  }

  // Influencer Campaign Links - ربط المؤثرين بالحملات
  async getInfluencerCampaignLinks(filters?: { influencerId?: number; campaignId?: number }): Promise<InfluencerCampaignLink[]> {
    const conditions = [];
    if (filters?.influencerId) conditions.push(eq(influencerCampaignLinks.influencerId, filters.influencerId));
    if (filters?.campaignId) conditions.push(eq(influencerCampaignLinks.campaignId, filters.campaignId));
    
    if (conditions.length > 0) {
      return await db.select().from(influencerCampaignLinks).where(and(...conditions)).orderBy(desc(influencerCampaignLinks.createdAt));
    }
    return await db.select().from(influencerCampaignLinks).orderBy(desc(influencerCampaignLinks.createdAt));
  }

  async getInfluencerCampaignLink(id: number): Promise<InfluencerCampaignLink | undefined> {
    const [link] = await db.select().from(influencerCampaignLinks).where(eq(influencerCampaignLinks.id, id));
    return link;
  }

  async createInfluencerCampaignLink(link: InsertInfluencerCampaignLink): Promise<InfluencerCampaignLink> {
    const [created] = await db.insert(influencerCampaignLinks).values(link).returning();
    return created;
  }

  async updateInfluencerCampaignLink(id: number, link: Partial<InsertInfluencerCampaignLink>): Promise<InfluencerCampaignLink | undefined> {
    const [updated] = await db.update(influencerCampaignLinks).set({ ...link, updatedAt: new Date() }).where(eq(influencerCampaignLinks.id, id)).returning();
    return updated;
  }

  async deleteInfluencerCampaignLink(id: number): Promise<boolean> {
    await db.delete(influencerCampaignLinks).where(eq(influencerCampaignLinks.id, id));
    return true;
  }

  // Influencer Contacts - سجل التواصل
  async getInfluencerContacts(influencerId: number): Promise<InfluencerContact[]> {
    return await db.select().from(influencerContacts).where(eq(influencerContacts.influencerId, influencerId)).orderBy(desc(influencerContacts.createdAt));
  }

  async getInfluencerContact(id: number): Promise<InfluencerContact | undefined> {
    const [contact] = await db.select().from(influencerContacts).where(eq(influencerContacts.id, id));
    return contact;
  }

  async createInfluencerContact(contact: InsertInfluencerContact): Promise<InfluencerContact> {
    const [created] = await db.insert(influencerContacts).values(contact).returning();
    return created;
  }

  async deleteInfluencerContact(id: number): Promise<boolean> {
    await db.delete(influencerContacts).where(eq(influencerContacts.id, id));
    return true;
  }

  // Influencer Payments - كشف حساب المؤثرين
  async getInfluencerPayments(influencerId: number): Promise<InfluencerPayment[]> {
    return await db.select().from(influencerPayments).where(eq(influencerPayments.influencerId, influencerId)).orderBy(desc(influencerPayments.paymentDate));
  }

  async getAllInfluencerPayments(filters?: { influencerId?: number; campaignId?: number; status?: string; startDate?: string; endDate?: string }): Promise<InfluencerPayment[]> {
    const conditions = [];
    if (filters?.influencerId) conditions.push(eq(influencerPayments.influencerId, filters.influencerId));
    if (filters?.campaignId) conditions.push(eq(influencerPayments.campaignId, filters.campaignId));
    if (filters?.status) conditions.push(eq(influencerPayments.status, filters.status));
    if (filters?.startDate) conditions.push(gte(influencerPayments.paymentDate, filters.startDate));
    if (filters?.endDate) conditions.push(lte(influencerPayments.paymentDate, filters.endDate));
    
    if (conditions.length > 0) {
      return await db.select().from(influencerPayments).where(and(...conditions)).orderBy(desc(influencerPayments.paymentDate));
    }
    return await db.select().from(influencerPayments).orderBy(desc(influencerPayments.paymentDate));
  }

  async getInfluencerPayment(id: number): Promise<InfluencerPayment | undefined> {
    const [payment] = await db.select().from(influencerPayments).where(eq(influencerPayments.id, id));
    return payment;
  }

  async createInfluencerPayment(payment: InsertInfluencerPayment): Promise<InfluencerPayment> {
    const [created] = await db.insert(influencerPayments).values(payment).returning();
    return created;
  }

  async updateInfluencerPayment(id: number, payment: Partial<InsertInfluencerPayment>): Promise<InfluencerPayment | undefined> {
    const [updated] = await db.update(influencerPayments).set({ ...payment, updatedAt: new Date() }).where(eq(influencerPayments.id, id)).returning();
    return updated;
  }

  async deleteInfluencerPayment(id: number): Promise<boolean> {
    await db.delete(influencerPayments).where(eq(influencerPayments.id, id));
    return true;
  }

  async getInfluencerTotalPayments(influencerId: number): Promise<number> {
    const payments = await db.select().from(influencerPayments).where(
      and(
        eq(influencerPayments.influencerId, influencerId),
        eq(influencerPayments.status, 'completed')
      )
    );
    return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }

  // Marketing Tasks - المهام
  async getAllMarketingTasks(filters?: { campaignId?: number; assignedTo?: string; status?: string }): Promise<MarketingTask[]> {
    const conditions = [];
    if (filters?.campaignId) conditions.push(eq(marketingTasks.campaignId, filters.campaignId));
    if (filters?.assignedTo) conditions.push(eq(marketingTasks.assignedTo, filters.assignedTo));
    if (filters?.status) conditions.push(eq(marketingTasks.status, filters.status));
    
    if (conditions.length > 0) {
      return await db.select().from(marketingTasks).where(and(...conditions)).orderBy(desc(marketingTasks.createdAt));
    }
    return await db.select().from(marketingTasks).orderBy(desc(marketingTasks.createdAt));
  }

  async getMarketingTask(id: number): Promise<MarketingTask | undefined> {
    const [task] = await db.select().from(marketingTasks).where(eq(marketingTasks.id, id));
    return task;
  }

  async createMarketingTask(task: InsertMarketingTask): Promise<MarketingTask> {
    const [created] = await db.insert(marketingTasks).values(task).returning();
    return created;
  }

  async updateMarketingTask(id: number, task: Partial<InsertMarketingTask>): Promise<MarketingTask | undefined> {
    const [updated] = await db.update(marketingTasks).set({ ...task, updatedAt: new Date() }).where(eq(marketingTasks.id, id)).returning();
    return updated;
  }

  async deleteMarketingTask(id: number): Promise<boolean> {
    await db.delete(marketingTasks).where(eq(marketingTasks.id, id));
    return true;
  }

  // Marketing Task Activities - نشاط المهام
  async getMarketingTaskActivities(taskId: number): Promise<MarketingTaskActivity[]> {
    return await db.select().from(marketingTaskActivities).where(eq(marketingTaskActivities.taskId, taskId)).orderBy(desc(marketingTaskActivities.createdAt));
  }

  async createMarketingTaskActivity(activity: InsertMarketingTaskActivity): Promise<MarketingTaskActivity> {
    const [created] = await db.insert(marketingTaskActivities).values(activity).returning();
    return created;
  }

  // Marketing Performance Reports - تقارير الأداء
  async getAllMarketingPerformanceReports(filters?: { reportType?: string; campaignId?: number }): Promise<MarketingPerformanceReport[]> {
    const conditions = [];
    if (filters?.reportType) conditions.push(eq(marketingPerformanceReports.reportType, filters.reportType));
    if (filters?.campaignId) conditions.push(eq(marketingPerformanceReports.campaignId, filters.campaignId));
    
    if (conditions.length > 0) {
      return await db.select().from(marketingPerformanceReports).where(and(...conditions)).orderBy(desc(marketingPerformanceReports.createdAt));
    }
    return await db.select().from(marketingPerformanceReports).orderBy(desc(marketingPerformanceReports.createdAt));
  }

  async getMarketingPerformanceReport(id: number): Promise<MarketingPerformanceReport | undefined> {
    const [report] = await db.select().from(marketingPerformanceReports).where(eq(marketingPerformanceReports.id, id));
    return report;
  }

  async createMarketingPerformanceReport(report: InsertMarketingPerformanceReport): Promise<MarketingPerformanceReport> {
    const [created] = await db.insert(marketingPerformanceReports).values(report).returning();
    return created;
  }

  async deleteMarketingPerformanceReport(id: number): Promise<boolean> {
    await db.delete(marketingPerformanceReports).where(eq(marketingPerformanceReports.id, id));
    return true;
  }

  // Marketing Assets - الأصول التسويقية
  async getAllMarketingAssets(filters?: { campaignId?: number; assetType?: string }): Promise<MarketingAsset[]> {
    const conditions = [];
    if (filters?.campaignId) conditions.push(eq(marketingAssets.campaignId, filters.campaignId));
    if (filters?.assetType) conditions.push(eq(marketingAssets.assetType, filters.assetType));
    
    if (conditions.length > 0) {
      return await db.select().from(marketingAssets).where(and(...conditions)).orderBy(desc(marketingAssets.createdAt));
    }
    return await db.select().from(marketingAssets).orderBy(desc(marketingAssets.createdAt));
  }

  async getMarketingAsset(id: number): Promise<MarketingAsset | undefined> {
    const [asset] = await db.select().from(marketingAssets).where(eq(marketingAssets.id, id));
    return asset;
  }

  async createMarketingAsset(asset: InsertMarketingAsset): Promise<MarketingAsset> {
    const [created] = await db.insert(marketingAssets).values(asset).returning();
    return created;
  }

  async updateMarketingAsset(id: number, asset: Partial<InsertMarketingAsset>): Promise<MarketingAsset | undefined> {
    const [updated] = await db.update(marketingAssets).set({ ...asset, updatedAt: new Date() }).where(eq(marketingAssets.id, id)).returning();
    return updated;
  }

  async deleteMarketingAsset(id: number): Promise<boolean> {
    await db.delete(marketingAssets).where(eq(marketingAssets.id, id));
    return true;
  }

  // Marketing Team Members - فريق التسويق
  async getAllMarketingTeamMembers(filters?: { isActive?: boolean }): Promise<MarketingTeamMember[]> {
    if (filters?.isActive !== undefined) {
      return await db.select().from(marketingTeamMembers).where(eq(marketingTeamMembers.isActive, filters.isActive)).orderBy(desc(marketingTeamMembers.createdAt));
    }
    return await db.select().from(marketingTeamMembers).orderBy(desc(marketingTeamMembers.createdAt));
  }

  async getMarketingTeamMember(id: number): Promise<MarketingTeamMember | undefined> {
    const [member] = await db.select().from(marketingTeamMembers).where(eq(marketingTeamMembers.id, id));
    return member;
  }

  async getMarketingTeamMemberByUserId(userId: string): Promise<MarketingTeamMember | undefined> {
    const [member] = await db.select().from(marketingTeamMembers).where(eq(marketingTeamMembers.userId, userId));
    return member;
  }

  async createMarketingTeamMember(member: InsertMarketingTeamMember): Promise<MarketingTeamMember> {
    const [created] = await db.insert(marketingTeamMembers).values(member).returning();
    return created;
  }

  async updateMarketingTeamMember(id: number, member: Partial<InsertMarketingTeamMember>): Promise<MarketingTeamMember | undefined> {
    const [updated] = await db.update(marketingTeamMembers).set({ ...member, updatedAt: new Date() }).where(eq(marketingTeamMembers.id, id)).returning();
    return updated;
  }

  async deleteMarketingTeamMember(id: number): Promise<boolean> {
    await db.delete(marketingTeamMembers).where(eq(marketingTeamMembers.id, id));
    return true;
  }

  // Marketing Alerts - تنبيهات التسويق
  async getAllMarketingAlerts(filters?: { targetUserId?: string; isRead?: boolean }): Promise<MarketingAlert[]> {
    const conditions = [];
    if (filters?.targetUserId) conditions.push(eq(marketingAlerts.targetUserId, filters.targetUserId));
    if (filters?.isRead !== undefined) conditions.push(eq(marketingAlerts.isRead, filters.isRead));
    
    if (conditions.length > 0) {
      return await db.select().from(marketingAlerts).where(and(...conditions)).orderBy(desc(marketingAlerts.createdAt));
    }
    return await db.select().from(marketingAlerts).orderBy(desc(marketingAlerts.createdAt));
  }

  async getMarketingAlert(id: number): Promise<MarketingAlert | undefined> {
    const [alert] = await db.select().from(marketingAlerts).where(eq(marketingAlerts.id, id));
    return alert;
  }

  async createMarketingAlert(alert: InsertMarketingAlert): Promise<MarketingAlert> {
    const [created] = await db.insert(marketingAlerts).values(alert).returning();
    return created;
  }

  async markMarketingAlertAsRead(id: number): Promise<MarketingAlert | undefined> {
    const [updated] = await db.update(marketingAlerts).set({ isRead: true }).where(eq(marketingAlerts.id, id)).returning();
    return updated;
  }

  async acknowledgeMarketingAlert(id: number, acknowledgedBy: string): Promise<MarketingAlert | undefined> {
    const [updated] = await db.update(marketingAlerts).set({ 
      isAcknowledged: true, 
      acknowledgedBy, 
      acknowledgedAt: new Date() 
    }).where(eq(marketingAlerts.id, id)).returning();
    return updated;
  }

  async deleteMarketingAlert(id: number): Promise<boolean> {
    await db.delete(marketingAlerts).where(eq(marketingAlerts.id, id));
    return true;
  }

  // ==========================================
  // نظام إدارة الورديات والحضور - Shift Management & Attendance
  // ==========================================

  // Branch Shift Profiles - إعدادات أوقات الورديات حسب الفرع
  async getBranchShiftProfiles(branchId: string): Promise<BranchShiftProfile[]> {
    return await db.select().from(branchShiftProfiles)
      .where(and(eq(branchShiftProfiles.branchId, branchId), eq(branchShiftProfiles.isActive, true)))
      .orderBy(branchShiftProfiles.sortOrder);
  }

  async getBranchShiftProfile(id: number): Promise<BranchShiftProfile | undefined> {
    const [profile] = await db.select().from(branchShiftProfiles).where(eq(branchShiftProfiles.id, id));
    return profile;
  }

  async getBranchShiftProfileByCode(branchId: string, shiftCode: string): Promise<BranchShiftProfile | undefined> {
    const [profile] = await db.select().from(branchShiftProfiles)
      .where(and(
        eq(branchShiftProfiles.branchId, branchId),
        eq(branchShiftProfiles.shiftCode, shiftCode),
        eq(branchShiftProfiles.isActive, true)
      ));
    return profile;
  }

  async createBranchShiftProfile(profile: InsertBranchShiftProfile): Promise<BranchShiftProfile> {
    const [created] = await db.insert(branchShiftProfiles).values(profile).returning();
    return created;
  }

  async updateBranchShiftProfile(id: number, profile: Partial<InsertBranchShiftProfile>): Promise<BranchShiftProfile | undefined> {
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...cleanData } = profile as any;
    const [updated] = await db.update(branchShiftProfiles)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(branchShiftProfiles.id, id))
      .returning();
    return updated;
  }

  async deleteBranchShiftProfile(id: number): Promise<boolean> {
    await db.update(branchShiftProfiles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(branchShiftProfiles.id, id));
    return true;
  }

  async upsertBranchShiftProfiles(branchId: string, profiles: InsertBranchShiftProfile[]): Promise<BranchShiftProfile[]> {
    const results: BranchShiftProfile[] = [];
    for (const profile of profiles) {
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...cleanProfile } = profile as any;
      const existing = await this.getBranchShiftProfileByCode(branchId, cleanProfile.shiftCode);
      if (existing) {
        const updated = await this.updateBranchShiftProfile(existing.id, cleanProfile);
        if (updated) results.push(updated);
      } else {
        const created = await this.createBranchShiftProfile({ ...cleanProfile, branchId });
        results.push(created);
      }
    }
    return results;
  }

  // Schedule Templates - قوالب الجداول
  async getAllScheduleTemplates(branchId?: string): Promise<ScheduleTemplate[]> {
    if (branchId) {
      return await db.select().from(scheduleTemplates)
        .where(and(eq(scheduleTemplates.branchId, branchId), eq(scheduleTemplates.isActive, true)))
        .orderBy(desc(scheduleTemplates.createdAt));
    }
    return await db.select().from(scheduleTemplates)
      .where(eq(scheduleTemplates.isActive, true))
      .orderBy(desc(scheduleTemplates.createdAt));
  }

  async getScheduleTemplate(id: number): Promise<ScheduleTemplate | undefined> {
    const [template] = await db.select().from(scheduleTemplates).where(eq(scheduleTemplates.id, id));
    return template;
  }

  async createScheduleTemplate(template: InsertScheduleTemplate): Promise<ScheduleTemplate> {
    const [created] = await db.insert(scheduleTemplates).values(template).returning();
    return created;
  }

  async updateScheduleTemplate(id: number, template: Partial<InsertScheduleTemplate>): Promise<ScheduleTemplate | undefined> {
    const [updated] = await db.update(scheduleTemplates).set({ ...template, updatedAt: new Date() }).where(eq(scheduleTemplates.id, id)).returning();
    return updated;
  }

  async deleteScheduleTemplate(id: number): Promise<boolean> {
    await db.update(scheduleTemplates).set({ isActive: false, updatedAt: new Date() }).where(eq(scheduleTemplates.id, id));
    return true;
  }

  // Schedule Periods - فترات الجدول
  async getAllSchedulePeriods(branchId?: string): Promise<SchedulePeriod[]> {
    if (branchId) {
      return await db.select().from(schedulePeriods)
        .where(eq(schedulePeriods.branchId, branchId))
        .orderBy(desc(schedulePeriods.startDate));
    }
    return await db.select().from(schedulePeriods).orderBy(desc(schedulePeriods.startDate));
  }

  async getSchedulePeriod(id: number): Promise<SchedulePeriod | undefined> {
    const [period] = await db.select().from(schedulePeriods).where(eq(schedulePeriods.id, id));
    return period;
  }

  async createSchedulePeriod(period: InsertSchedulePeriod): Promise<SchedulePeriod> {
    const [created] = await db.insert(schedulePeriods).values(period).returning();
    return created;
  }

  async updateSchedulePeriod(id: number, period: Partial<InsertSchedulePeriod>): Promise<SchedulePeriod | undefined> {
    const [updated] = await db.update(schedulePeriods).set({ ...period, updatedAt: new Date() }).where(eq(schedulePeriods.id, id)).returning();
    return updated;
  }

  async publishSchedulePeriod(id: number, publishedBy: string): Promise<SchedulePeriod | undefined> {
    const [updated] = await db.update(schedulePeriods).set({ 
      status: 'published', 
      publishedBy, 
      publishedAt: new Date(),
      updatedAt: new Date() 
    }).where(eq(schedulePeriods.id, id)).returning();
    return updated;
  }

  async deleteSchedulePeriod(id: number): Promise<boolean> {
    await db.delete(schedulePeriods).where(eq(schedulePeriods.id, id));
    return true;
  }

  // Employee Schedules - جداول الموظفين
  async getEmployeeSchedulesByPeriod(periodId: number): Promise<EmployeeSchedule[]> {
    return await db.select().from(employeeSchedules)
      .where(eq(employeeSchedules.periodId, periodId))
      .orderBy(employeeSchedules.scheduleDate, employeeSchedules.employeeName);
  }

  async getEmployeeSchedulesByEmployee(employeeId: string, startDate?: string, endDate?: string): Promise<EmployeeSchedule[]> {
    const conditions = [eq(employeeSchedules.employeeId, employeeId)];
    if (startDate) conditions.push(gte(employeeSchedules.scheduleDate, startDate));
    if (endDate) conditions.push(lte(employeeSchedules.scheduleDate, endDate));
    return await db.select().from(employeeSchedules).where(and(...conditions)).orderBy(employeeSchedules.scheduleDate);
  }

  async getEmployeeSchedulesByDate(date: string, branchId?: string): Promise<EmployeeSchedule[]> {
    if (branchId) {
      const periods = await db.select().from(schedulePeriods).where(eq(schedulePeriods.branchId, branchId));
      const periodIds = periods.map(p => p.id);
      if (periodIds.length === 0) return [];
      return await db.select().from(employeeSchedules)
        .where(and(eq(employeeSchedules.scheduleDate, date), inArray(employeeSchedules.periodId, periodIds)));
    }
    return await db.select().from(employeeSchedules).where(eq(employeeSchedules.scheduleDate, date));
  }

  async getEmployeeSchedulesByBranchAndDateRange(branchId: string, startDate: string, endDate: string): Promise<EmployeeSchedule[]> {
    const branchSchedules = await db.select().from(employeeSchedules)
      .where(and(
        eq(employeeSchedules.branchId, branchId),
        gte(employeeSchedules.scheduleDate, startDate),
        lte(employeeSchedules.scheduleDate, endDate)
      ))
      .orderBy(employeeSchedules.employeeId, employeeSchedules.scheduleDate);
    
    const allBranchEmps = await db.select().from(branchEmployees)
      .where(eq(branchEmployees.branchId, branchId));
    const activeBranchEmpIds = new Set(
      allBranchEmps.filter(e => e.status === "active").map(e => e.id)
    );
    // Map from linkedUserId → branchEmployee for terminated-employee detection
    const linkedUserToEmp = new Map<string, typeof allBranchEmps[0]>();
    for (const emp of allBranchEmps) {
      if (emp.linkedUserId) linkedUserToEmp.set(emp.linkedUserId, emp);
    }
    
    const branchUsers = await db.select().from(users).where(eq(users.branchId, branchId));
    const activeUserIds = new Set(branchUsers.map(u => u.id));
    
    const filteredSchedules = branchSchedules.filter(schedule => {
      if (schedule.branchEmployeeId) {
        return activeBranchEmpIds.has(schedule.branchEmployeeId);
      }
      if (schedule.employeeId.startsWith("branch_emp_")) {
        const empId = parseInt(schedule.employeeId.replace("branch_emp_", ""), 10);
        return !isNaN(empId) && activeBranchEmpIds.has(empId);
      }
      // For user-UUID schedules, reject if the user is linked to a terminated branch employee
      const linkedEmp = linkedUserToEmp.get(schedule.employeeId);
      if (linkedEmp && linkedEmp.status !== 'active') return false;
      return activeUserIds.has(schedule.employeeId);
    });
    
    let allSchedules = [...filteredSchedules];
    
    if (activeUserIds.size > 0) {
      const userSchedules = await db.select().from(employeeSchedules)
        .where(and(
          inArray(employeeSchedules.employeeId, Array.from(activeUserIds)),
          gte(employeeSchedules.scheduleDate, startDate),
          lte(employeeSchedules.scheduleDate, endDate)
        ))
        .orderBy(employeeSchedules.employeeId, employeeSchedules.scheduleDate);
      
      for (const schedule of userSchedules) {
        if (!allSchedules.some(s => s.id === schedule.id)) {
          if (!schedule.branchId || schedule.branchId === branchId) {
            // Skip if the user is linked to a terminated branch employee
            const linkedEmp = linkedUserToEmp.get(schedule.employeeId);
            if (linkedEmp && linkedEmp.status !== 'active') continue;
            allSchedules.push(schedule);
          }
        }
      }
    }

    // Build a map from employeeId/branch_emp_* → branchEmployee numeric ID for cross-key deduplication
    const empIdToNumericId = new Map<string, number>();
    for (const emp of allBranchEmps) {
      empIdToNumericId.set(`branch_emp_${emp.id}`, emp.id);
      if (emp.linkedUserId) empIdToNumericId.set(emp.linkedUserId, emp.id);
    }

    // Unified deduplication: normalize all records to a common key so that
    // records with branchEmployeeId=123 and records with employeeId="branch_emp_123"
    // are recognized as the same employee and only the highest-ID record survives.
    const deduped = new Map<string, EmployeeSchedule>();
    for (const schedule of allSchedules) {
      let normalizedKey: string;
      if (schedule.branchEmployeeId) {
        normalizedKey = `be_${schedule.branchEmployeeId}_${schedule.scheduleDate}`;
      } else if (schedule.employeeId.startsWith('branch_emp_')) {
        const numId = parseInt(schedule.employeeId.replace('branch_emp_', ''), 10);
        normalizedKey = !isNaN(numId)
          ? `be_${numId}_${schedule.scheduleDate}`
          : `ei_${schedule.employeeId}_${schedule.scheduleDate}`;
      } else {
        const numericId = empIdToNumericId.get(schedule.employeeId);
        normalizedKey = numericId !== undefined
          ? `be_${numericId}_${schedule.scheduleDate}`
          : `ei_${schedule.employeeId}_${schedule.scheduleDate}`;
      }
      const existing = deduped.get(normalizedKey);
      if (!existing || schedule.id > existing.id) {
        deduped.set(normalizedKey, schedule);
      }
    }
    const dedupedSchedules = Array.from(deduped.values());
    
    if (dedupedSchedules.length < allSchedules.length) {
      console.log(`[SCHEDULES READ] Deduped ${allSchedules.length} → ${dedupedSchedules.length} for branch ${branchId} (${startDate} to ${endDate})`);
    }
    
    return dedupedSchedules;
  }

  async createEmployeeSchedule(schedule: InsertEmployeeSchedule): Promise<EmployeeSchedule> {
    if (!schedule.branchEmployeeId && schedule.employeeId?.startsWith('branch_emp_')) {
      const parsed = parseInt(schedule.employeeId.replace('branch_emp_', ''), 10);
      if (!isNaN(parsed)) {
        schedule = { ...schedule, branchEmployeeId: parsed };
      }
    }

    const baseConditions = [
      eq(employeeSchedules.scheduleDate, schedule.scheduleDate),
      schedule.branchId ? eq(employeeSchedules.branchId, schedule.branchId) : isNull(employeeSchedules.branchId),
    ];
    
    let existing: EmployeeSchedule[] = [];
    if (schedule.branchEmployeeId) {
      existing = await db.select().from(employeeSchedules)
        .where(and(...baseConditions, eq(employeeSchedules.branchEmployeeId, schedule.branchEmployeeId)))
        .orderBy(desc(employeeSchedules.id))
        .limit(1);
    }
    if (existing.length === 0) {
      existing = await db.select().from(employeeSchedules)
        .where(and(...baseConditions, eq(employeeSchedules.employeeId, schedule.employeeId)))
        .orderBy(desc(employeeSchedules.id))
        .limit(1);
    }
    
    if (existing.length > 0) {
      const [updated] = await db.update(employeeSchedules)
        .set({ ...schedule, updatedAt: new Date() })
        .where(eq(employeeSchedules.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(employeeSchedules).values(schedule).returning();
    return created;
  }

  async createBulkEmployeeSchedules(schedules: InsertEmployeeSchedule[]): Promise<{ results: EmployeeSchedule[]; errors: string[] }> {
    if (schedules.length === 0) return { results: [], errors: [] };
    
    const results: EmployeeSchedule[] = [];
    const errors: string[] = [];
    
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    const validShiftTypes = ['morning', 'evening', 'night'];
    
    const enrichedSchedules = schedules.map(s => {
      const enriched = { ...s };
      if (!enriched.branchEmployeeId && enriched.employeeId?.startsWith('branch_emp_')) {
        const parsed = parseInt(enriched.employeeId.replace('branch_emp_', ''), 10);
        if (!isNaN(parsed)) {
          enriched.branchEmployeeId = parsed;
        }
      }
      if (enriched.startTime && !timeRegex.test(enriched.startTime)) {
        console.warn(`[BULK SCHEDULE] Invalid startTime "${enriched.startTime}" for ${enriched.employeeName}, defaulting to 08:00`);
        enriched.startTime = "08:00";
      }
      if (enriched.endTime && !timeRegex.test(enriched.endTime)) {
        console.warn(`[BULK SCHEDULE] Invalid endTime "${enriched.endTime}" for ${enriched.employeeName}, defaulting to 16:00`);
        enriched.endTime = "16:00";
      }
      if (enriched.shiftType && !validShiftTypes.includes(enriched.shiftType)) {
        console.warn(`[BULK SCHEDULE] Non-standard shiftType "${enriched.shiftType}" for ${enriched.employeeName}, normalizing from time`);
        if (enriched.startTime) {
          const hour = parseInt(enriched.startTime.split(":")[0], 10);
          enriched.shiftType = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 20 ? 'evening' : 'night';
        } else {
          enriched.shiftType = 'morning';
        }
      }
      return enriched;
    });

    const inputSeen = new Set<string>();
    const deduplicatedSchedules = enrichedSchedules.filter(s => {
      const primaryKey = s.branchEmployeeId 
        ? `be_${s.branchEmployeeId}_${s.scheduleDate}_${s.branchId}`
        : `ei_${s.employeeId}_${s.scheduleDate}_${s.branchId}`;
      if (inputSeen.has(primaryKey)) return false;
      inputSeen.add(primaryKey);
      if (s.branchEmployeeId && s.employeeId) {
        const altKey = `ei_${s.employeeId}_${s.scheduleDate}_${s.branchId}`;
        inputSeen.add(altKey);
      }
      return true;
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const withBranchEmpId = deduplicatedSchedules.filter(s => s.branchEmployeeId != null);
      const withoutBranchEmpId = deduplicatedSchedules.filter(s => s.branchEmployeeId == null);

      // CRITICAL FIX: Before upserting records with branchEmployeeId, delete any old
      // "legacy" records for the same employees that have branch_employee_id IS NULL.
      // These old records were created before branchEmployeeId was tracked and cause
      // the schedule to appear to revert on reload.
      if (withBranchEmpId.length > 0) {
        const oldEmpIds: string[] = [];
        const branchIds = new Set<string>();
        const scheduleDates = new Set<string>();
        for (const s of withBranchEmpId) {
          if (s.branchId) branchIds.add(s.branchId);
          scheduleDates.add(s.scheduleDate);
          // Possible old-style employee_id values for this employee
          oldEmpIds.push(`branch_emp_${s.branchEmployeeId}`);
          if (s.employeeId && !s.employeeId.startsWith('branch_emp_')) {
            oldEmpIds.push(s.employeeId);
          }
        }
        if (oldEmpIds.length > 0 && branchIds.size > 0 && scheduleDates.size > 0) {
          const branchIdList = Array.from(branchIds);
          const dateList = Array.from(scheduleDates);
          const cleanupSql = `
            DELETE FROM employee_schedules
            WHERE branch_employee_id IS NULL
              AND employee_id = ANY($1::text[])
              AND branch_id = ANY($2::text[])
              AND schedule_date = ANY($3::text[])
          `;
          const deleted = await client.query(cleanupSql, [oldEmpIds, branchIdList, dateList]);
          if (deleted.rowCount && deleted.rowCount > 0) {
            console.log(`[BULK SCHEDULE] Cleaned up ${deleted.rowCount} legacy records before upsert`);
          }
        }
      }

      if (withBranchEmpId.length > 0) {
        const { values, placeholders } = this.buildScheduleParams(withBranchEmpId);
        const sql = `
          INSERT INTO employee_schedules (employee_id, employee_name, branch_id, branch_employee_id, schedule_date, day_of_week, shift_type, start_time, end_time, is_off, break_duration, notes, status, created_at, updated_at)
          VALUES ${placeholders}
          ON CONFLICT (branch_employee_id, schedule_date, branch_id) WHERE branch_employee_id IS NOT NULL AND branch_id IS NOT NULL
          DO UPDATE SET
            employee_name = EXCLUDED.employee_name, employee_id = EXCLUDED.employee_id,
            shift_type = EXCLUDED.shift_type, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time,
            is_off = EXCLUDED.is_off, break_duration = EXCLUDED.break_duration, notes = EXCLUDED.notes,
            day_of_week = EXCLUDED.day_of_week, updated_at = NOW()
          RETURNING *
        `;
        console.log(`[BULK SCHEDULE] UPSERT ${withBranchEmpId.length} records (branchEmployeeId path)`);
        const result = await client.query(sql, values);
        if (result.rows) {
          for (const row of result.rows) results.push(this.mapScheduleRow(row));
        }
      }

      if (withoutBranchEmpId.length > 0) {
        const alreadySaved = new Set(results.map(r => `${r.employeeId}_${r.scheduleDate}_${r.branchId}`));
        const remaining = withoutBranchEmpId.filter(s => !alreadySaved.has(`${s.employeeId}_${s.scheduleDate}_${s.branchId}`));
        if (remaining.length > 0) {
          const { values, placeholders } = this.buildScheduleParams(remaining);
          const sql = `
            INSERT INTO employee_schedules (employee_id, employee_name, branch_id, branch_employee_id, schedule_date, day_of_week, shift_type, start_time, end_time, is_off, break_duration, notes, status, created_at, updated_at)
            VALUES ${placeholders}
            ON CONFLICT (employee_id, schedule_date, branch_id) WHERE branch_employee_id IS NULL AND branch_id IS NOT NULL
            DO UPDATE SET
              employee_name = EXCLUDED.employee_name,
              shift_type = EXCLUDED.shift_type, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time,
              is_off = EXCLUDED.is_off, break_duration = EXCLUDED.break_duration, notes = EXCLUDED.notes,
              day_of_week = EXCLUDED.day_of_week, updated_at = NOW()
            RETURNING *
          `;
          console.log(`[BULK SCHEDULE] UPSERT ${remaining.length} records (employeeId fallback path)`);
          const result2 = await client.query(sql, values);
          if (result2.rows) {
            for (const row of result2.rows) results.push(this.mapScheduleRow(row));
          }
        }
      }

      await client.query('COMMIT');
      console.log(`[BULK SCHEDULE] UPSERT complete: ${results.length} records saved in transaction`);
    } catch (batchError: any) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`[BULK SCHEDULE] UPSERT failed, rolling back:`, batchError?.message);
      
      if (batchError?.code === '42704' || batchError?.message?.includes('does not exist')) {
        console.log(`[BULK SCHEDULE] Constraint/index not found, falling back to individual saves`);
        for (const s of deduplicatedSchedules) {
          try {
            const saved = await this.createEmployeeSchedule(s);
            if (saved) results.push(saved);
          } catch (e: any) {
            errors.push(`${s.employeeName}: ${e?.message || 'خطأ'}`);
          }
        }
      } else {
        errors.push(`خطأ في حفظ الجداول: ${batchError?.message || 'unknown'}`);
      }
    } finally {
      client.release();
    }
    
    return { results, errors };
  }

  private buildScheduleParams(schedules: InsertEmployeeSchedule[]): { values: any[]; placeholders: string } {
    const values: any[] = [];
    const rows: string[] = [];
    let i = 1;
    for (const s of schedules) {
      rows.push(`($${i}, $${i+1}, $${i+2}, $${i+3}, $${i+4}, $${i+5}, $${i+6}, $${i+7}, $${i+8}, $${i+9}, $${i+10}, $${i+11}, 'scheduled', NOW(), NOW())`);
      values.push(
        s.employeeId || null, s.employeeName || null, s.branchId || null, s.branchEmployeeId || null,
        s.scheduleDate, s.dayOfWeek || 'sat', s.shiftType || null, s.startTime || null,
        s.endTime || null, s.isOff ?? false, s.breakDuration ?? 60, s.notes || null
      );
      i += 12;
    }
    return { values, placeholders: rows.join(', ') };
  }

  private mapScheduleRow(row: any): EmployeeSchedule {
    return {
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      branchId: row.branch_id,
      branchEmployeeId: row.branch_employee_id,
      scheduleDate: row.schedule_date,
      dayOfWeek: row.day_of_week,
      shiftType: row.shift_type,
      startTime: row.start_time,
      endTime: row.end_time,
      isOff: row.is_off,
      breakDuration: row.break_duration,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getEmployeeScheduleById(id: number): Promise<EmployeeSchedule | undefined> {
    const [schedule] = await db.select().from(employeeSchedules).where(eq(employeeSchedules.id, id));
    return schedule;
  }

  async updateEmployeeSchedule(id: number, schedule: Partial<InsertEmployeeSchedule>): Promise<EmployeeSchedule | undefined> {
    const [updated] = await db.update(employeeSchedules).set({ ...schedule, updatedAt: new Date() }).where(eq(employeeSchedules.id, id)).returning();
    return updated;
  }

  async deleteEmployeeSchedule(id: number): Promise<boolean> {
    await db.delete(employeeSchedules).where(eq(employeeSchedules.id, id));
    return true;
  }

  async deleteEmployeeSchedulesByPeriod(periodId: number): Promise<boolean> {
    await db.delete(employeeSchedules).where(eq(employeeSchedules.periodId, periodId));
    return true;
  }

  // Attendance Records - سجلات الحضور
  async getAllAttendanceRecords(filters?: { branchId?: string; employeeId?: string; startDate?: string; endDate?: string; status?: string }): Promise<AttendanceRecord[]> {
    try {
      const conditions = [];
      if (filters?.branchId) conditions.push(eq(attendanceRecords.branchId, filters.branchId));
      if (filters?.employeeId) conditions.push(eq(attendanceRecords.employeeId, filters.employeeId));
      if (filters?.startDate) conditions.push(gte(attendanceRecords.attendanceDate, filters.startDate));
      if (filters?.endDate) conditions.push(lte(attendanceRecords.attendanceDate, filters.endDate));
      if (filters?.status) conditions.push(eq(attendanceRecords.status, filters.status));
      
      if (conditions.length > 0) {
        return await db.select().from(attendanceRecords).where(and(...conditions)).orderBy(desc(attendanceRecords.attendanceDate));
      }
      return await db.select().from(attendanceRecords).orderBy(desc(attendanceRecords.attendanceDate));
    } catch (error: any) {
      if (error?.code === '42703') {
        const whereClauses = [];
        const params: any[] = [];
        let paramIndex = 1;
        if (filters?.branchId) { whereClauses.push(`branch_id = $${paramIndex++}`); params.push(filters.branchId); }
        if (filters?.employeeId) { whereClauses.push(`employee_id = $${paramIndex++}`); params.push(filters.employeeId); }
        if (filters?.startDate) { whereClauses.push(`attendance_date >= $${paramIndex++}`); params.push(filters.startDate); }
        if (filters?.endDate) { whereClauses.push(`attendance_date <= $${paramIndex++}`); params.push(filters.endDate); }
        if (filters?.status) { whereClauses.push(`status = $${paramIndex++}`); params.push(filters.status); }
        const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const result = await pool.query(`SELECT id, employee_id, employee_name, branch_id, branch_employee_id, schedule_id, attendance_date, scheduled_start_time, scheduled_end_time, actual_check_in, actual_check_out, check_in_signature, check_out_signature, status, late_minutes, early_leave_minutes, overtime_minutes, working_hours, device_info, location_info, notes, approved_by, approved_at, created_at, updated_at FROM attendance_records ${whereStr} ORDER BY attendance_date DESC`, params);
        return result.rows.map((r: any) => ({
          ...r,
          employeeId: r.employee_id, employeeName: r.employee_name, branchId: r.branch_id,
          branchEmployeeId: r.branch_employee_id, scheduleId: r.schedule_id, attendanceDate: r.attendance_date,
          scheduledStartTime: r.scheduled_start_time, scheduledEndTime: r.scheduled_end_time,
          actualCheckIn: r.actual_check_in, actualCheckOut: r.actual_check_out,
          checkInSignature: r.check_in_signature, checkOutSignature: r.check_out_signature,
          lateMinutes: r.late_minutes, earlyLeaveMinutes: r.early_leave_minutes,
          overtimeMinutes: r.overtime_minutes, workingHours: r.working_hours,
          biometricVerified: false, biometricCheckIn: false, biometricCheckOut: false,
          deviceInfo: r.device_info, locationInfo: r.location_info,
          approvedBy: r.approved_by, approvedAt: r.approved_at,
          createdAt: r.created_at, updatedAt: r.updated_at,
        }));
      }
      throw error;
    }
  }

  async getAttendanceRecord(id: number): Promise<AttendanceRecord | undefined> {
    try {
      const [record] = await db.select().from(attendanceRecords).where(eq(attendanceRecords.id, id));
      return record;
    } catch (error: any) {
      if (error?.code === '42703') {
        const result = await pool.query(`SELECT * FROM attendance_records WHERE id = $1 LIMIT 1`, [id]);
        if (result.rows.length === 0) return undefined;
        const r = result.rows[0];
        return this.mapRawAttendanceRecord(r);
      }
      throw error;
    }
  }

  async getAttendanceByEmployeeAndDate(employeeId: string, date: string): Promise<AttendanceRecord | undefined> {
    try {
      const [record] = await db.select().from(attendanceRecords)
        .where(and(eq(attendanceRecords.employeeId, employeeId), eq(attendanceRecords.attendanceDate, date)));
      return record;
    } catch (error: any) {
      if (error?.code === '42703') {
        const result = await pool.query(`SELECT * FROM attendance_records WHERE employee_id = $1 AND attendance_date = $2 LIMIT 1`, [employeeId, date]);
        if (result.rows.length === 0) return undefined;
        return this.mapRawAttendanceRecord(result.rows[0]);
      }
      throw error;
    }
  }

  private mapRawAttendanceRecord(r: any): AttendanceRecord {
    return {
      id: r.id, employeeId: r.employee_id, employeeName: r.employee_name, branchId: r.branch_id,
      branchEmployeeId: r.branch_employee_id, scheduleId: r.schedule_id, attendanceDate: r.attendance_date,
      scheduledStartTime: r.scheduled_start_time, scheduledEndTime: r.scheduled_end_time,
      actualCheckIn: r.actual_check_in, actualCheckOut: r.actual_check_out,
      checkInSignature: r.check_in_signature, checkOutSignature: r.check_out_signature,
      status: r.status, lateMinutes: r.late_minutes, earlyLeaveMinutes: r.early_leave_minutes,
      overtimeMinutes: r.overtime_minutes, workingHours: r.working_hours,
      biometricVerified: r.biometric_verified ?? false, biometricCheckIn: r.biometric_check_in ?? false,
      biometricCheckOut: r.biometric_check_out ?? false,
      deviceInfo: r.device_info, locationInfo: r.location_info, notes: r.notes,
      approvedBy: r.approved_by, approvedAt: r.approved_at,
      createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }

  async createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord> {
    try {
      const [created] = await db.insert(attendanceRecords).values(record).returning();
      return created;
    } catch (error: any) {
      if (error?.code === '42703') {
        const { biometricVerified, biometricCheckIn, biometricCheckOut, ...safeRecord } = record as any;
        const [created] = await db.insert(attendanceRecords).values(safeRecord).returning();
        return { ...created, biometricVerified: false, biometricCheckIn: false, biometricCheckOut: false };
      }
      throw error;
    }
  }

  async updateAttendanceRecord(id: number, record: Partial<InsertAttendanceRecord>): Promise<AttendanceRecord | undefined> {
    try {
      const [updated] = await db.update(attendanceRecords).set({ ...record, updatedAt: new Date() }).where(eq(attendanceRecords.id, id)).returning();
      return updated;
    } catch (error: any) {
      if (error?.code === '42703') {
        const { biometricVerified, biometricCheckIn, biometricCheckOut, ...safeRecord } = record as any;
        const [updated] = await db.update(attendanceRecords).set({ ...safeRecord, updatedAt: new Date() }).where(eq(attendanceRecords.id, id)).returning();
        return updated ? { ...updated, biometricVerified: false, biometricCheckIn: false, biometricCheckOut: false } : undefined;
      }
      throw error;
    }
  }

  async checkIn(employeeId: string, branchId: string, signature?: string, deviceInfo?: string): Promise<AttendanceRecord> {
    const saudiTime = getSaudiArabiaTime();
    const today = saudiTime.date;
    const now = saudiTime.time;
    
    const employee = await this.getUser(employeeId);
    if (!employee) {
      throw new Error("الموظف غير موجود");
    }
    
    if (employee.branchId && employee.branchId !== branchId && employee.role !== "admin") {
      throw new Error("لا يمكن التسجيل في فرع مختلف عن فرع الموظف");
    }
    
    const employeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.username || 'Unknown';
    
    let existing = await this.getAttendanceByEmployeeAndDate(employeeId, today);
    
    if (existing && !existing.actualCheckOut) {
      throw new Error("يوجد سجل حضور مفتوح بالفعل لهذا اليوم");
    }
    
    if (existing && existing.actualCheckOut) {
      throw new Error("لقد سجلت حضورك وانصرافك بالفعل اليوم - لا يمكن تسجيل الحضور مرة أخرى");
    }
    
    try {
      const [created] = await db.insert(attendanceRecords).values({
        employeeId,
        employeeName,
        branchId,
        attendanceDate: today,
        actualCheckIn: now,
        checkInSignature: signature,
        deviceInfo,
        status: 'present'
      }).returning();
      return created;
    } catch (error: any) {
      if (error?.code === '42703') {
        const result = await pool.query(`INSERT INTO attendance_records (employee_id, employee_name, branch_id, attendance_date, actual_check_in, check_in_signature, device_info, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, 'present', NOW(), NOW()) RETURNING *`, [employeeId, employeeName, branchId, today, now, signature, deviceInfo]);
        return this.mapRawAttendanceRecord(result.rows[0]);
      }
      throw error;
    }
  }

  async checkOut(employeeId: string, signature?: string): Promise<AttendanceRecord | undefined> {
    const saudiTime = getSaudiArabiaTime();
    const today = saudiTime.date;
    const now = saudiTime.time;
    
    const existing = await this.getAttendanceByEmployeeAndDate(employeeId, today);
    if (!existing) return undefined;
    if (existing.actualCheckOut) return undefined;
    
    const checkInTime = existing.actualCheckIn ? new Date(`1970-01-01T${existing.actualCheckIn}`) : null;
    const checkOutTime = new Date(`1970-01-01T${now}`);
    let workingHours = 0;
    if (checkInTime) {
      workingHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
    }
    
    try {
      const [updated] = await db.update(attendanceRecords).set({
        actualCheckOut: now,
        checkOutSignature: signature,
        workingHours: Math.round(workingHours * 100) / 100,
        updatedAt: new Date()
      }).where(and(eq(attendanceRecords.id, existing.id), eq(attendanceRecords.employeeId, employeeId))).returning();
      return updated;
    } catch (error: any) {
      if (error?.code === '42703') {
        await pool.query(`UPDATE attendance_records SET actual_check_out = $1, check_out_signature = $2, working_hours = $3, updated_at = NOW() WHERE id = $4 AND employee_id = $5`, [now, signature, Math.round(workingHours * 100) / 100, existing.id, employeeId]);
        const record = await this.getAttendanceRecord(existing.id);
        return record;
      }
      throw error;
    }
  }

  async getScheduledEmployeesForAttendance(branchId: string, shiftType: string, date: string): Promise<any[]> {
    console.log(`[ATTENDANCE-DEBUG] Query params: branchId=${branchId}, shiftType=${shiftType}, date=${date}`);

    // Fetch all schedules for today (both isOff=true and isOff=false) to detect conflicts
    const allTodaySchedules = await db.select({
      id: employeeSchedules.id,
      employeeId: employeeSchedules.employeeId,
      employeeName: employeeSchedules.employeeName,
      branchEmployeeId: employeeSchedules.branchEmployeeId,
      startTime: employeeSchedules.startTime,
      endTime: employeeSchedules.endTime,
      shiftType: employeeSchedules.shiftType,
      scheduleDate: employeeSchedules.scheduleDate,
      isOff: employeeSchedules.isOff,
    })
    .from(employeeSchedules)
    .where(and(
      eq(employeeSchedules.branchId, branchId),
      eq(employeeSchedules.scheduleDate, date),
      eq(employeeSchedules.status, 'scheduled')
    ));

    // Build a set of employees on leave today (isOff=true), keyed by employeeId and branchEmployeeId
    // Use highest ID to resolve conflicts (most recent record wins)
    const leaveByEmployee = new Map<string, number>(); // key -> highest ID with isOff=true
    const workByEmployee = new Map<string, number>();  // key -> highest ID with isOff=false
    for (const s of allTodaySchedules) {
      const keys: string[] = [s.employeeId];
      if (s.branchEmployeeId) {
        keys.push(`be_${s.branchEmployeeId}`);
        keys.push(`branch_emp_${s.branchEmployeeId}`);
      }
      for (const key of keys) {
        if (s.isOff) {
          if (!leaveByEmployee.has(key) || s.id > leaveByEmployee.get(key)!) leaveByEmployee.set(key, s.id);
        } else {
          if (!workByEmployee.has(key) || s.id > workByEmployee.get(key)!) workByEmployee.set(key, s.id);
        }
      }
    }
    // An employee is on leave if their most recent record for today is isOff=true
    const onLeaveToday = new Set<string>();
    for (const [key, leaveId] of leaveByEmployee.entries()) {
      const workId = workByEmployee.get(key);
      if (!workId || leaveId > workId) {
        onLeaveToday.add(key);
      }
    }

    const schedules = allTodaySchedules.filter(s =>
      !s.isOff &&
      !onLeaveToday.has(s.employeeId) &&
      !(s.branchEmployeeId && onLeaveToday.has(`be_${s.branchEmployeeId}`))
    );

    console.log(`[ATTENDANCE-DEBUG] Main query returned ${schedules.length} schedules for date=${date}`);
    if (schedules.length > 0) {
      console.log(`[ATTENDANCE-DEBUG] Sample schedules:`, schedules.slice(0, 3).map(s => ({
        employeeId: s.employeeId, shiftType: s.shiftType, startTime: s.startTime, endTime: s.endTime
      })));
    }

    const inferShiftFromTime = (startTime: string): string => {
      const hour = parseInt(startTime.split(":")[0], 10);
      if (hour >= 5 && hour < 12) return "morning";
      if (hour >= 12 && hour < 20) return "evening";
      return "night";
    };

    const STANDARD_SHIFTS = ["morning", "evening", "night"];
    
    const filteredSchedules = schedules.filter(s => {
      const storedType = s.shiftType;
      if (storedType && STANDARD_SHIFTS.includes(storedType)) {
        const match = storedType === shiftType;
        if (!match) {
          console.log(`[ATTENDANCE-DEBUG] Employee ${s.employeeId} storedShiftType=${storedType}, requested=${shiftType} -> SKIPPED`);
        }
        return match;
      }
      if (s.startTime) {
        const inferred = inferShiftFromTime(s.startTime);
        const match = inferred === shiftType;
        if (!match) {
          console.log(`[ATTENDANCE-DEBUG] Employee ${s.employeeId} shiftType=${storedType || 'none'}, startTime=${s.startTime} -> inferred=${inferred}, requested=${shiftType} -> SKIPPED`);
        }
        return match;
      }
      return false;
    });

    console.log(`[ATTENDANCE-DEBUG] After filter: ${filteredSchedules.length} employees match shiftType=${shiftType}`);

    // BATCH: Get all attendance records for this branch+date in ONE query
    const allEmployeeIds = filteredSchedules.map(s => s.employeeId);
    const allAttendance = allEmployeeIds.length > 0
      ? await db.select().from(attendanceRecords)
          .where(and(
            eq(attendanceRecords.attendanceDate, date),
            inArray(attendanceRecords.employeeId, allEmployeeIds)
          ))
      : [];
    const attendanceMap = new Map<string, any>();
    for (const rec of allAttendance) {
      attendanceMap.set(rec.employeeId, rec);
    }

    // BATCH: Collect all branch employee IDs that need lookup
    const branchEmpIdsToLookup = new Set<number>();
    for (const s of filteredSchedules) {
      if (s.employeeId.startsWith('branch_emp_')) {
        const id = parseInt(s.employeeId.replace('branch_emp_', ''), 10);
        if (!isNaN(id)) branchEmpIdsToLookup.add(id);
      }
      if (s.branchEmployeeId) branchEmpIdsToLookup.add(s.branchEmployeeId);
    }
    const branchEmpLookup = new Map<number, any>();
    if (branchEmpIdsToLookup.size > 0) {
      const lookupIds = Array.from(branchEmpIdsToLookup);
      const emps = await db.select().from(branchEmployees)
        .where(inArray(branchEmployees.id, lookupIds));
      for (const emp of emps) {
        branchEmpLookup.set(emp.id, emp);
      }
    }

    const nameIsUnresolved = (name: string | null | undefined) => !name || name === 'Unknown' || name === 'غير معروف';

    // BATCH: Lookup users table for non-branch_emp employees with unresolved names
    const userIdsToLookup = filteredSchedules
      .filter(s => !s.employeeId.startsWith('branch_emp_') && nameIsUnresolved(s.employeeName))
      .map(s => s.employeeId);
    const userLookup = new Map<string, any>();
    if (userIdsToLookup.length > 0) {
      const foundUsers = await db.select().from(users).where(inArray(users.id, userIdsToLookup));
      for (const u of foundUsers) {
        userLookup.set(u.id, u);
      }
    }

    const employeesWithAttendance = filteredSchedules.map(schedule => {
      const attendance = attendanceMap.get(schedule.employeeId) || null;
      let resolvedName = schedule.employeeName;
      let resolvedNameEn = '';

      if (schedule.employeeId.startsWith('branch_emp_')) {
        const branchEmpId = parseInt(schedule.employeeId.replace('branch_emp_', ''), 10);
        if (!isNaN(branchEmpId)) {
          const branchEmp = branchEmpLookup.get(branchEmpId);
          if (branchEmp?.employeeName) {
            resolvedName = branchEmp.employeeName;
            resolvedNameEn = branchEmp.employeeNameEn || '';
          }
        }
      }

      if (nameIsUnresolved(resolvedName) && schedule.branchEmployeeId) {
        const branchEmp = branchEmpLookup.get(schedule.branchEmployeeId);
        if (branchEmp?.employeeName) {
          resolvedName = branchEmp.employeeName;
          resolvedNameEn = branchEmp.employeeNameEn || '';
        }
      }

      // Fallback: resolve from users table for non-branch_emp employees
      if (nameIsUnresolved(resolvedName) && !schedule.employeeId.startsWith('branch_emp_')) {
        const user = userLookup.get(schedule.employeeId);
        if (user) {
          resolvedName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'غير معروف';
        }
      }

      const finalName = resolvedName || 'غير معروف';
      const _isDeleted = nameIsUnresolved(finalName);

      let _isTransferred = false;
      if (schedule.employeeId.startsWith('branch_emp_')) {
        const branchEmpId = parseInt(schedule.employeeId.replace('branch_emp_', ''), 10);
        if (!isNaN(branchEmpId)) {
          const currentBranchEmp = branchEmpLookup.get(branchEmpId);
          if (currentBranchEmp && (currentBranchEmp.branchId !== branchId || currentBranchEmp.status !== 'active')) {
            _isTransferred = true;
          }
        }
      }
      // Also check branchEmployeeId for employees stored with user-UUID format (linkedUserId)
      if (!_isTransferred && schedule.branchEmployeeId) {
        const branchEmp = branchEmpLookup.get(schedule.branchEmployeeId);
        if (branchEmp && (branchEmp.branchId !== branchId || branchEmp.status !== 'active')) {
          _isTransferred = true;
        }
      }

      return {
        ...schedule,
        employeeName: finalName,
        employeeNameEn: resolvedNameEn || '',
        attendance,
        _isDeleted,
        _isTransferred,
      };
    });

    const seenEmployeeIds = new Set<string>();
    const uniqueEmployees = employeesWithAttendance.filter(emp => {
      if (emp._isDeleted) return false;
      if (emp._isTransferred) return false;
      if (seenEmployeeIds.has(emp.employeeId)) return false;
      seenEmployeeIds.add(emp.employeeId);
      return true;
    }).map(({ _isDeleted, _isTransferred, ...rest }: any) => rest);

    if (uniqueEmployees.length === 0) {
      console.log(`[ATTENDANCE-DEBUG] No employees found for today. Trying fallback...`);
      
      const todayOffEmployees = new Set<string>();
      const todayOffBranchEmpIds = new Set<number>();
      const offSchedules = await db.select({
        employeeId: employeeSchedules.employeeId,
        branchEmployeeId: employeeSchedules.branchEmployeeId,
      }).from(employeeSchedules).where(and(
        eq(employeeSchedules.branchId, branchId),
        eq(employeeSchedules.scheduleDate, date),
        eq(employeeSchedules.isOff, true)
      ));
      for (const os of offSchedules) {
        todayOffEmployees.add(os.employeeId);
        if (os.branchEmployeeId) todayOffBranchEmpIds.add(os.branchEmployeeId);
      }
      if (todayOffEmployees.size > 0) {
        console.log(`[ATTENDANCE-DEBUG] Found ${todayOffEmployees.size} employees marked as OFF today - will exclude from fallback`);
      }

      let recentSchedules = await db.select({
        employeeId: employeeSchedules.employeeId,
        employeeName: employeeSchedules.employeeName,
        branchEmployeeId: employeeSchedules.branchEmployeeId,
        startTime: employeeSchedules.startTime,
        endTime: employeeSchedules.endTime,
        shiftType: employeeSchedules.shiftType,
      })
      .from(employeeSchedules)
      .where(and(
        eq(employeeSchedules.branchId, branchId),
        eq(employeeSchedules.isOff, false),
        eq(employeeSchedules.status, 'scheduled'),
        eq(employeeSchedules.shiftType, shiftType),
        lte(employeeSchedules.scheduleDate, date)
      ))
      .orderBy(desc(employeeSchedules.scheduleDate))
      .limit(100);

      console.log(`[ATTENDANCE-DEBUG] Fallback1 exact shiftType query: ${recentSchedules.length} results`);
      // If no results with exact shiftType, try without shiftType filter and infer from startTime
      if (recentSchedules.length === 0) {
        recentSchedules = await db.select({
          employeeId: employeeSchedules.employeeId,
          employeeName: employeeSchedules.employeeName,
          branchEmployeeId: employeeSchedules.branchEmployeeId,
          startTime: employeeSchedules.startTime,
          endTime: employeeSchedules.endTime,
          shiftType: employeeSchedules.shiftType,
        })
        .from(employeeSchedules)
        .where(and(
          eq(employeeSchedules.branchId, branchId),
          eq(employeeSchedules.isOff, false),
          eq(employeeSchedules.status, 'scheduled'),
          lte(employeeSchedules.scheduleDate, date)
        ))
        .orderBy(desc(employeeSchedules.scheduleDate))
        .limit(100);
      }

      // Deterministic: actual startTime takes priority over shiftType label
      const inferShift = (startTime: string): string => {
        const hour = parseInt(startTime.split(":")[0], 10);
        if (hour >= 5 && hour < 12) return "morning";
        if (hour >= 12 && hour < 20) return "evening";
        return "night";
      };
      if (recentSchedules.length > 0) {
        console.log(`[ATTENDANCE-DEBUG] Fallback1 without shiftType filter: ${recentSchedules.length} results, samples:`, recentSchedules.slice(0, 3).map(s => ({
          employeeId: s.employeeId, shiftType: s.shiftType, startTime: s.startTime
        })));
      }

      const recentFiltered = recentSchedules.filter(s => {
        if (s.startTime) return inferShift(s.startTime) === shiftType;
        return s.shiftType === shiftType;
      });

      console.log(`[ATTENDANCE-DEBUG] Fallback1 after time-based filter: ${recentFiltered.length} employees`);

      // Deduplicate by employeeId (take first = most recent)
      const seenRecent = new Set<string>();
      const deduped = recentFiltered.filter(s => {
        if (seenRecent.has(s.employeeId)) return false;
        seenRecent.add(s.employeeId);
        return true;
      });

      if (deduped.length > 0) {
        // Batch resolve names from branch_employees
        const recentBranchEmpIds = new Set<number>();
        for (const s of deduped) {
          if (s.employeeId.startsWith('branch_emp_')) {
            const id = parseInt(s.employeeId.replace('branch_emp_', ''), 10);
            if (!isNaN(id)) recentBranchEmpIds.add(id);
          }
          if (s.branchEmployeeId) recentBranchEmpIds.add(s.branchEmployeeId);
        }
        const recentBranchEmpLookup = new Map<number, any>();
        if (recentBranchEmpIds.size > 0) {
          const emps = await db.select().from(branchEmployees)
            .where(inArray(branchEmployees.id, Array.from(recentBranchEmpIds)));
          for (const emp of emps) recentBranchEmpLookup.set(emp.id, emp);
        }

        // Batch attendance
        const recentIds = deduped.map(s => s.employeeId);
        const recentAtt = recentIds.length > 0
          ? await db.select().from(attendanceRecords)
              .where(and(eq(attendanceRecords.attendanceDate, date), inArray(attendanceRecords.employeeId, recentIds)))
          : [];
        const recentAttMap = new Map<string, any>();
        for (const r of recentAtt) recentAttMap.set(r.employeeId, r);

        const validEmployees = deduped.filter(s => {
          if (todayOffEmployees.has(s.employeeId)) return false;
          if (s.branchEmployeeId && todayOffBranchEmpIds.has(s.branchEmployeeId)) return false;
          if (s.employeeId.startsWith('branch_emp_')) {
            const id = parseInt(s.employeeId.replace('branch_emp_', ''), 10);
            if (todayOffBranchEmpIds.has(id)) return false;
            const emp = recentBranchEmpLookup.get(id);
            if (emp && (emp.branchId !== branchId || emp.status !== 'active')) return false;
          }
          // Also filter employees stored with user-UUID format that have a linked branchEmployeeId
          if (s.branchEmployeeId) {
            const emp = recentBranchEmpLookup.get(s.branchEmployeeId);
            if (emp && (emp.branchId !== branchId || emp.status !== 'active')) return false;
          }
          return true;
        });

        return validEmployees.map((s, idx) => {
          let name = s.employeeName;
          let nameEn = '';
          if (s.employeeId.startsWith('branch_emp_')) {
            const id = parseInt(s.employeeId.replace('branch_emp_', ''), 10);
            const emp = recentBranchEmpLookup.get(id);
            if (emp?.employeeName) { name = emp.employeeName; nameEn = emp.employeeNameEn || ''; }
          }
          if (nameIsUnresolved(name) && s.branchEmployeeId) {
            const emp = recentBranchEmpLookup.get(s.branchEmployeeId);
            if (emp?.employeeName) { name = emp.employeeName; nameEn = emp.employeeNameEn || ''; }
          }
          return {
            id: idx + 1,
            employeeId: s.employeeId,
            employeeName: name || 'غير معروف',
            employeeNameEn: nameEn,
            startTime: s.startTime,
            endTime: s.endTime,
            shiftType,
            scheduleDate: date,
            attendance: recentAttMap.get(s.employeeId) || null,
          };
        }).filter(e => !nameIsUnresolved(e.employeeName));
      }

      console.log(`[ATTENDANCE-DEBUG] Fallback1 deduped: ${deduped.length} unique employees`);
      // Fallback 2: Show all active branch employees with default shift times
      console.log(`[ATTENDANCE-DEBUG] Entering Fallback2 - showing all active branch employees`);
      const branchEmps = await this.getBranchEmployeesByBranch(branchId);
      const activeEmployees = branchEmps.filter(emp => emp.status === 'active');

      const shiftTimes: Record<string, { start: string; end: string }> = {
        morning: { start: "06:00", end: "14:00" },
        evening: { start: "14:00", end: "22:00" },
        night: { start: "22:00", end: "06:00" }
      };
      const defaultTimes = shiftTimes[shiftType] || shiftTimes.morning;

      const fallbackIds = activeEmployees.map(emp => `branch_emp_${emp.id}`);
      const fallbackAttendance = fallbackIds.length > 0
        ? await db.select().from(attendanceRecords)
            .where(and(
              eq(attendanceRecords.attendanceDate, date),
              inArray(attendanceRecords.employeeId, fallbackIds)
            ))
        : [];
      const fallbackAttMap = new Map<string, any>();
      for (const rec of fallbackAttendance) {
        fallbackAttMap.set(rec.employeeId, rec);
      }

      return activeEmployees
        .filter(emp => !todayOffBranchEmpIds.has(emp.id) && !todayOffEmployees.has(`branch_emp_${emp.id}`))
        .map(emp => {
          const employeeId = `branch_emp_${emp.id}`;
          return {
            id: emp.id,
            employeeId,
            employeeName: emp.employeeName,
            employeeNameEn: emp.employeeNameEn || '',
            startTime: defaultTimes.start,
            endTime: defaultTimes.end,
            shiftType,
            scheduleDate: date,
            attendance: fallbackAttMap.get(employeeId) || null
          };
        });
    }

    return uniqueEmployees;
  }

  async checkInEmployee(employeeId: string, branchId: string, signature?: string, scheduleId?: number, scheduledStartTime?: string, scheduledEndTime?: string, employeeNameParam?: string, attendanceDate?: string): Promise<AttendanceRecord> {
    const saudiTime = getSaudiArabiaTime();
    const today = attendanceDate || saudiTime.date;
    const now = saudiTime.timeShort;
    
    if (employeeId.startsWith('branch_emp_')) {
      const branchEmpId = parseInt(employeeId.replace('branch_emp_', ''), 10);
      if (!isNaN(branchEmpId)) {
        const [currentEmp] = await db.select({ branchId: branchEmployees.branchId, status: branchEmployees.status })
          .from(branchEmployees)
          .where(eq(branchEmployees.id, branchEmpId))
          .limit(1);
        if (currentEmp && currentEmp.branchId !== branchId) {
          throw new Error("هذا الموظف لا ينتمي لهذا الفرع - ربما تم نقله لفرع آخر");
        }
        if (currentEmp && currentEmp.status !== 'active') {
          throw new Error("هذا الموظف غير نشط حالياً");
        }
      }
    }
    
    let employeeName = employeeNameParam || 'Unknown';
    
    if (!employeeId.startsWith('branch_emp_')) {
      try {
        const employee = await this.getUser(employeeId);
        if (employee) {
          employeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.username || employeeName;
          if (employee.branchId && employee.branchId !== branchId && employee.role !== 'admin') {
            throw new Error("هذا الموظف لا ينتمي لهذا الفرع");
          }
        }
      } catch (e: any) {
        if (e?.message?.includes('لا ينتمي')) throw e;
        console.log('User lookup failed for:', employeeId);
      }
    }
    
    // If still unknown and we have scheduleId, try to get from schedule
    if (employeeName === 'Unknown' && scheduleId) {
      try {
        const schedule = await db.select().from(employeeSchedules).where(eq(employeeSchedules.id, scheduleId)).limit(1);
        if (schedule.length > 0 && schedule[0].employeeName) {
          employeeName = schedule[0].employeeName;
        }
      } catch (e) {
        console.log('Schedule lookup failed for:', scheduleId);
      }
    }
    
    let existing = await this.getAttendanceByEmployeeAndDate(employeeId, today);
    
    if (existing && existing.actualCheckIn && !existing.actualCheckOut) {
      throw new Error("تم تسجيل حضور هذا الموظف مسبقاً - لم يسجل انصرافه بعد");
    }
    
    if (existing && existing.actualCheckIn && existing.actualCheckOut) {
      throw new Error("تم تسجيل حضور وانصراف هذا الموظف بالفعل اليوم");
    }
    
    let lateMinutes = 0;
    if (scheduledStartTime) {
      const scheduled = new Date(`1970-01-01T${scheduledStartTime}`);
      const actual = new Date(`1970-01-01T${now}`);
      if (actual > scheduled) {
        lateMinutes = Math.round((actual.getTime() - scheduled.getTime()) / (1000 * 60));
      }
    }
    
    const status = lateMinutes > 0 ? 'late' : 'present';
    
    // Validate scheduleId exists if provided
    if (scheduleId) {
      try {
        const [schedule] = await db.select({ id: employeeSchedules.id }).from(employeeSchedules).where(eq(employeeSchedules.id, scheduleId)).limit(1);
        if (!schedule) {
          console.warn("[checkInEmployee] Invalid scheduleId:", scheduleId, "- setting to null");
          scheduleId = undefined;
        }
      } catch (e) {
        console.warn("[checkInEmployee] Schedule validation failed, setting to null");
        scheduleId = undefined;
      }
    }
    
    let branchEmployeeId: number | undefined = undefined;
    if (employeeId.startsWith('branch_emp_')) {
      const parsedId = parseInt(employeeId.replace('branch_emp_', ''), 10);
      if (!isNaN(parsedId)) branchEmployeeId = parsedId;
    }
    
    try {
      const insertValues: any = {
        employeeId,
        employeeName,
        branchId,
        scheduleId: scheduleId || null,
        attendanceDate: today,
        actualCheckIn: now,
        checkInSignature: signature || null,
        scheduledStartTime: scheduledStartTime || null,
        scheduledEndTime: scheduledEndTime || null,
        lateMinutes: lateMinutes || 0,
        status
      };
      if (branchEmployeeId !== undefined) {
        insertValues.branchEmployeeId = branchEmployeeId;
      }
      console.log("[checkInEmployee] Inserting record for:", employeeId, "branch:", branchId, "date:", today, "time:", now);
      const [created] = await db.insert(attendanceRecords).values(insertValues).returning();
      return created;
    } catch (error: any) {
      if (error?.code === '42703') {
        const result = await pool.query(`INSERT INTO attendance_records (employee_id, employee_name, branch_id, branch_employee_id, schedule_id, attendance_date, actual_check_in, check_in_signature, scheduled_start_time, scheduled_end_time, late_minutes, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()) RETURNING *`, [employeeId, employeeName, branchId, branchEmployeeId || null, scheduleId, today, now, signature, scheduledStartTime, scheduledEndTime, lateMinutes, status]);
        return this.mapRawAttendanceRecord(result.rows[0]);
      }
      throw error;
    }
  }

  async checkOutEmployee(employeeId: string, signature?: string, scheduleId?: number, attendanceDate?: string): Promise<AttendanceRecord | undefined> {
    const saudiTime = getSaudiArabiaTime();
    const today = attendanceDate || saudiTime.date;
    const now = saudiTime.timeShort;
    
    const existing = await this.getAttendanceByEmployeeAndDate(employeeId, today);
    if (!existing) return undefined;
    if (existing.actualCheckOut) return undefined;
    
    const checkInTime = existing.actualCheckIn ? new Date(`1970-01-01T${existing.actualCheckIn}`) : null;
    const checkOutTime = new Date(`1970-01-01T${now}`);
    let workingHours = 0;
    if (checkInTime) {
      workingHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
    }
    
    // Calculate early leave minutes if scheduled end time is provided
    let earlyLeaveMinutes = 0;
    if (existing.scheduledEndTime) {
      const scheduled = new Date(`1970-01-01T${existing.scheduledEndTime}`);
      if (checkOutTime < scheduled) {
        earlyLeaveMinutes = Math.round((scheduled.getTime() - checkOutTime.getTime()) / (1000 * 60));
      }
    }
    
    try {
      const [updated] = await db.update(attendanceRecords).set({
        actualCheckOut: now,
        checkOutSignature: signature,
        workingHours: Math.round(workingHours * 100) / 100,
        earlyLeaveMinutes,
        updatedAt: new Date()
      }).where(and(eq(attendanceRecords.id, existing.id), eq(attendanceRecords.employeeId, employeeId))).returning();
      return updated;
    } catch (error: any) {
      if (error?.code === '42703') {
        await pool.query(`UPDATE attendance_records SET actual_check_out = $1, check_out_signature = $2, working_hours = $3, early_leave_minutes = $4, updated_at = NOW() WHERE id = $5 AND employee_id = $6`, [now, signature, Math.round(workingHours * 100) / 100, earlyLeaveMinutes, existing.id, employeeId]);
        return await this.getAttendanceRecord(existing.id);
      }
      throw error;
    }
  }

  async approveAttendance(id: number, approvedBy: string): Promise<AttendanceRecord | undefined> {
    try {
      const [updated] = await db.update(attendanceRecords).set({
        approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date()
      }).where(eq(attendanceRecords.id, id)).returning();
      return updated;
    } catch (error: any) {
      if (error?.code === '42703') {
        await pool.query(`UPDATE attendance_records SET approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2`, [approvedBy, id]);
        return await this.getAttendanceRecord(id);
      }
      throw error;
    }
  }

  // Time Entries - التوقيعات
  async getTimeEntriesByAttendance(attendanceId: number): Promise<TimeEntry[]> {
    return await db.select().from(timeEntries)
      .where(eq(timeEntries.attendanceId, attendanceId))
      .orderBy(timeEntries.entryTime);
  }

  async createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry> {
    const [created] = await db.insert(timeEntries).values(entry).returning();
    return created;
  }

  // Attendance Summary - ملخص الحضور
  async getAttendanceSummary(employeeId: string, month: string): Promise<AttendanceSummary | undefined> {
    const [summary] = await db.select().from(attendanceSummary)
      .where(and(eq(attendanceSummary.employeeId, employeeId), eq(attendanceSummary.periodMonth, month)));
    return summary;
  }

  async getAllAttendanceSummaries(filters?: { branchId?: string; month?: string }): Promise<AttendanceSummary[]> {
    const conditions = [];
    if (filters?.branchId) conditions.push(eq(attendanceSummary.branchId, filters.branchId));
    if (filters?.month) conditions.push(eq(attendanceSummary.periodMonth, filters.month));
    
    if (conditions.length > 0) {
      return await db.select().from(attendanceSummary).where(and(...conditions)).orderBy(desc(attendanceSummary.periodMonth));
    }
    return await db.select().from(attendanceSummary).orderBy(desc(attendanceSummary.periodMonth));
  }

  async createOrUpdateAttendanceSummary(summary: InsertAttendanceSummary): Promise<AttendanceSummary> {
    const existing = await this.getAttendanceSummary(summary.employeeId, summary.periodMonth);
    if (existing) {
      const [updated] = await db.update(attendanceSummary).set({ ...summary, updatedAt: new Date() }).where(eq(attendanceSummary.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(attendanceSummary).values(summary).returning();
    return created;
  }

  async calculateAndUpdateMonthlySummary(employeeId: string, month: string): Promise<AttendanceSummary> {
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;
    
    const records = await this.getAllAttendanceRecords({ employeeId, startDate, endDate });
    const employee = await this.getUser(employeeId);
    const employeeName = employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.username || 'Unknown' : 'Unknown';
    const branchId = employee?.branchId || '';
    
    const totalScheduledDays = records.length;
    const totalPresentDays = records.filter(r => r.status === 'present').length;
    const totalAbsentDays = records.filter(r => r.status === 'absent').length;
    const totalLateDays = records.filter(r => r.status === 'late').length;
    const totalEarlyLeaveDays = records.filter(r => r.status === 'early_leave').length;
    const totalLeaveDays = records.filter(r => r.status === 'on_leave').length;
    const totalWorkingHours = records.reduce((sum, r) => sum + (r.workingHours || 0), 0);
    const totalOvertimeHours = records.reduce((sum, r) => sum + ((r.overtimeMinutes || 0) / 60), 0);
    const totalLateMinutes = records.reduce((sum, r) => sum + (r.lateMinutes || 0), 0);
    const totalEarlyLeaveMinutes = records.reduce((sum, r) => sum + (r.earlyLeaveMinutes || 0), 0);
    const attendanceRate = totalScheduledDays > 0 ? (totalPresentDays / totalScheduledDays) * 100 : 0;
    const punctualityRate = totalPresentDays > 0 ? ((totalPresentDays - totalLateDays) / totalPresentDays) * 100 : 0;
    
    return await this.createOrUpdateAttendanceSummary({
      employeeId,
      employeeName,
      branchId,
      periodMonth: month,
      totalScheduledDays,
      totalPresentDays,
      totalAbsentDays,
      totalLateDays,
      totalEarlyLeaveDays,
      totalLeaveDays,
      totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
      totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
      totalLateMinutes,
      totalEarlyLeaveMinutes,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
      punctualityRate: Math.round(punctualityRate * 100) / 100
    });
  }

  // Timesheet Reports - تقارير التايم شيت
  async getTimesheetReports(filters?: { employeeId?: string; branchId?: string; status?: string }): Promise<TimesheetReport[]> {
    const conditions = [];
    if (filters?.employeeId) conditions.push(eq(timesheetReports.employeeId, filters.employeeId));
    if (filters?.branchId) conditions.push(eq(timesheetReports.branchId, filters.branchId));
    if (filters?.status) conditions.push(eq(timesheetReports.status, filters.status));
    
    if (conditions.length > 0) {
      return await db.select().from(timesheetReports).where(and(...conditions)).orderBy(desc(timesheetReports.createdAt));
    }
    return await db.select().from(timesheetReports).orderBy(desc(timesheetReports.createdAt));
  }

  async getTimesheetReport(id: number): Promise<TimesheetReport | undefined> {
    const [report] = await db.select().from(timesheetReports).where(eq(timesheetReports.id, id));
    return report;
  }

  async getTimesheetReportByEmployeeAndDates(employeeId: string, startDate: string, endDate: string): Promise<TimesheetReport | undefined> {
    const [report] = await db.select().from(timesheetReports)
      .where(and(
        eq(timesheetReports.employeeId, employeeId),
        eq(timesheetReports.startDate, startDate),
        eq(timesheetReports.endDate, endDate)
      ));
    return report;
  }

  async createTimesheetReport(report: InsertTimesheetReport): Promise<TimesheetReport> {
    const [created] = await db.insert(timesheetReports).values(report).returning();
    return created;
  }

  async updateTimesheetReport(id: number, report: Partial<InsertTimesheetReport>): Promise<TimesheetReport | undefined> {
    const [updated] = await db.update(timesheetReports)
      .set({ ...report, updatedAt: new Date() })
      .where(eq(timesheetReports.id, id))
      .returning();
    return updated;
  }

  async deleteTimesheetReport(id: number): Promise<boolean> {
    const result = await db.delete(timesheetReports).where(eq(timesheetReports.id, id)).returning();
    return result.length > 0;
  }

  async signTimesheetReport(id: number, signatureType: 'employee' | 'manager', signature: string, signerId: string, acknowledgment?: string): Promise<TimesheetReport | undefined> {
    const report = await this.getTimesheetReport(id);
    if (!report) return undefined;

    const updates: Partial<InsertTimesheetReport> = {};
    
    if (signatureType === 'employee') {
      updates.employeeSignature = signature;
      updates.employeeSignedAt = new Date();
      updates.employeeAcknowledgment = acknowledgment || 'أقر بصحة بيانات الحضور والانصراف المذكورة أعلاه';
      if (report.status === 'pending' || report.status === 'pending_employee_signature') {
        updates.status = 'pending_manager_signature';
      }
    } else if (signatureType === 'manager') {
      updates.managerSignature = signature;
      updates.managerId = signerId;
      updates.managerSignedAt = new Date();
      updates.managerAcknowledgment = acknowledgment || 'أصادق على صحة بيانات حضور وانصراف الموظف';
      if (report.employeeSignature) {
        updates.status = 'finalized';
      } else {
        updates.status = 'pending_employee_signature';
      }
    }

    return await this.updateTimesheetReport(id, updates);
  }

  // Timesheet Report Entries - سجلات التقرير اليومية
  async getTimesheetReportEntries(reportId: number): Promise<TimesheetReportEntry[]> {
    return await db.select().from(timesheetReportEntries)
      .where(eq(timesheetReportEntries.reportId, reportId))
      .orderBy(timesheetReportEntries.date);
  }

  async createTimesheetReportEntry(entry: InsertTimesheetReportEntry): Promise<TimesheetReportEntry> {
    const [created] = await db.insert(timesheetReportEntries).values(entry).returning();
    return created;
  }

  async createBulkTimesheetReportEntries(entries: InsertTimesheetReportEntry[]): Promise<TimesheetReportEntry[]> {
    if (entries.length === 0) return [];
    const created = await db.insert(timesheetReportEntries).values(entries).returning();
    return created;
  }

  async updateTimesheetReportEntry(id: number, entry: Partial<InsertTimesheetReportEntry>): Promise<TimesheetReportEntry | undefined> {
    const [updated] = await db.update(timesheetReportEntries)
      .set(entry)
      .where(eq(timesheetReportEntries.id, id))
      .returning();
    return updated;
  }

  // Branch Employees - موظفي الفروع
  async getAllBranchEmployees(): Promise<BranchEmployee[]> {
    return await db.select().from(branchEmployees).orderBy(branchEmployees.employeeName);
  }

  async getBranchEmployeesByBranch(branchId: string): Promise<BranchEmployee[]> {
    return await db.select().from(branchEmployees)
      .where(eq(branchEmployees.branchId, branchId))
      .orderBy(branchEmployees.employeeName);
  }

  async getBranchEmployee(id: number): Promise<BranchEmployee | undefined> {
    const [employee] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, id));
    return employee || undefined;
  }

  async createBranchEmployee(employee: InsertBranchEmployee): Promise<BranchEmployee> {
    const grossSalary = (employee.salary || 0) + 
      (employee.housingAllowance || 0) + 
      (employee.transportAllowance || 0) + 
      (employee.foodAllowance || 0) + 
      (employee.otherAllowances || 0);
    // خصم التأمينات الاجتماعية للموظفين السعوديين فقط
    const socialInsurance = employee.nationality === "سعودي" ? (employee.socialInsuranceDeduction || 0) : 0;
    const totalSalary = grossSalary - socialInsurance;
    
    // Generate employee number if not provided
    let employeeNumber = employee.employeeNumber;
    if (!employeeNumber) {
      // Get branch prefix (MED for medina, etc.)
      const branchPrefixes: Record<string, string> = {
        'medina': 'MED',
        'jeddah': 'JED',
        'riyadh': 'RYD',
        'makkah': 'MAK',
        'dammam': 'DAM',
      };
      const prefix = branchPrefixes[employee.branchId] || employee.branchId.substring(0, 3).toUpperCase();
      
      // Find the highest existing employee number for this branch
      const existingEmployees = await this.getBranchEmployeesByBranch(employee.branchId);
      let maxNumber = 0;
      for (const emp of existingEmployees) {
        if (emp.employeeNumber) {
          const match = emp.employeeNumber.match(/(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) maxNumber = num;
          }
        }
      }
      employeeNumber = `${prefix}-${String(maxNumber + 1).padStart(5, '0')}`;
    }
    
    const [created] = await db.insert(branchEmployees).values({
      ...employee,
      employeeNumber,
      totalSalary,
    }).returning();
    return created;
  }

  async updateBranchEmployee(id: number, employee: Partial<InsertBranchEmployee>): Promise<BranchEmployee | undefined> {
    const current = await this.getBranchEmployee(id);
    if (!current) return undefined;

    const salary = employee.salary ?? current.salary;
    const housingAllowance = employee.housingAllowance ?? current.housingAllowance ?? 0;
    const transportAllowance = employee.transportAllowance ?? current.transportAllowance ?? 0;
    const foodAllowance = employee.foodAllowance ?? current.foodAllowance ?? 0;
    const otherAllowances = employee.otherAllowances ?? current.otherAllowances ?? 0;
    const nationality = employee.nationality ?? current.nationality;
    const socialInsuranceDeduction = employee.socialInsuranceDeduction ?? current.socialInsuranceDeduction ?? 0;
    const socialInsurance = nationality === "سعودي" ? socialInsuranceDeduction : 0;
    const grossSalary = salary + housingAllowance + transportAllowance + foodAllowance + otherAllowances;
    const totalSalary = grossSalary - socialInsurance;

    const oldBranchId = current.branchId;
    const newBranchId = employee.branchId;
    const isBranchTransfer = newBranchId && newBranchId !== oldBranchId;

    if (isBranchTransfer) {
      const result = await db.transaction(async (tx) => {
        const [updated] = await tx.update(branchEmployees)
          .set({ ...employee, totalSalary, updatedAt: new Date() })
          .where(eq(branchEmployees.id, id))
          .returning();

        const saudiTime = getSaudiArabiaTime();
        const today = saudiTime.date;
        const movedSchedules = await tx.update(employeeSchedules)
          .set({ branchId: newBranchId })
          .where(and(
            or(
              eq(employeeSchedules.employeeId, `branch_emp_${id}`),
              eq(employeeSchedules.branchEmployeeId, id)
            ),
            gte(employeeSchedules.scheduleDate, today)
          ))
          .returning({ id: employeeSchedules.id });
        console.log(`[BranchTransfer] Employee ${id}: moved ${movedSchedules.length} future schedules from ${oldBranchId} to ${newBranchId}`);

        return updated;
      });
      return result;
    }

    const [updated] = await db.update(branchEmployees)
      .set({ ...employee, totalSalary, updatedAt: new Date() })
      .where(eq(branchEmployees.id, id))
      .returning();
    return updated;
  }

  async syncEmployeeSchedulesOnBranchTransfer(employeeId: number, oldBranchId: string, newBranchId: string): Promise<void> {
    try {
      const saudiTime = getSaudiArabiaTime();
      const today = saudiTime.date;
      const result = await db.update(employeeSchedules)
        .set({ branchId: newBranchId })
        .where(and(
          or(
            eq(employeeSchedules.employeeId, `branch_emp_${employeeId}`),
            eq(employeeSchedules.branchEmployeeId, employeeId)
          ),
          gte(employeeSchedules.scheduleDate, today)
        ))
        .returning({ id: employeeSchedules.id });
      console.log(`[BranchTransfer] Employee ${employeeId}: moved ${result.length} future schedules from ${oldBranchId} to ${newBranchId}`);
    } catch (error) {
      console.error(`[BranchTransfer] Failed to sync schedules for employee ${employeeId}:`, error);
    }
  }

  async deleteBranchEmployee(id: number): Promise<boolean> {
    const result = await db.delete(branchEmployees).where(eq(branchEmployees.id, id)).returning();
    return result.length > 0;
  }

  async getBranchEmployeeStats(branchId?: string): Promise<{
    totalEmployees: number;
    totalSalaries: number;
    byNationality: { nationality: string; count: number }[];
    byJobTitle: { jobTitle: string; count: number }[];
    byStatus: { status: string; count: number }[];
  }> {
    let employees: BranchEmployee[];
    if (branchId) {
      employees = await this.getBranchEmployeesByBranch(branchId);
    } else {
      employees = await this.getAllBranchEmployees();
    }

    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.status === 'active');
    const totalSalaries = activeEmployees.reduce((sum, emp) => sum + (emp.totalSalary || emp.salary || 0), 0);

    const nationalityMap = new Map<string, number>();
    const jobTitleMap = new Map<string, number>();
    const statusMap = new Map<string, number>();

    employees.forEach(emp => {
      nationalityMap.set(emp.nationality, (nationalityMap.get(emp.nationality) || 0) + 1);
      jobTitleMap.set(emp.jobTitle, (jobTitleMap.get(emp.jobTitle) || 0) + 1);
      statusMap.set(emp.status, (statusMap.get(emp.status) || 0) + 1);
    });

    return {
      totalEmployees,
      totalSalaries,
      byNationality: Array.from(nationalityMap.entries()).map(([nationality, count]) => ({ nationality, count })),
      byJobTitle: Array.from(jobTitleMap.entries()).map(([jobTitle, count]) => ({ jobTitle, count })),
      byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
    };
  }

  async getBranchEmployeeByLinkedUserId(userId: string): Promise<BranchEmployee | undefined> {
    const [employee] = await db.select().from(branchEmployees)
      .where(eq(branchEmployees.linkedUserId, userId));
    return employee || undefined;
  }

  async linkBranchEmployeeToUser(branchEmployeeId: number, userId: string): Promise<BranchEmployee | undefined> {
    const [updated] = await db.update(branchEmployees)
      .set({ linkedUserId: userId, updatedAt: new Date() })
      .where(eq(branchEmployees.id, branchEmployeeId))
      .returning();
    return updated;
  }

  // Branch Employee Integration - ربط موظفي الفروع بالحضور والدوام
  async getAttendanceByBranchEmployeeId(branchEmployeeId: number): Promise<AttendanceRecord[]> {
    try {
      return await db.select().from(attendanceRecords)
        .where(eq(attendanceRecords.branchEmployeeId, branchEmployeeId))
        .orderBy(attendanceRecords.attendanceDate);
    } catch (error: any) {
      if (error?.code === '42703') {
        const result = await pool.query(`SELECT * FROM attendance_records WHERE branch_employee_id = $1 ORDER BY attendance_date`, [branchEmployeeId]);
        return result.rows.map((r: any) => this.mapRawAttendanceRecord(r));
      }
      throw error;
    }
  }

  async getTimesheetsByBranchEmployeeId(branchEmployeeId: number): Promise<TimesheetReport[]> {
    return await db.select().from(timesheetReports)
      .where(eq(timesheetReports.branchEmployeeId, branchEmployeeId))
      .orderBy(timesheetReports.startDate);
  }

  async getSchedulesByBranchEmployeeId(branchEmployeeId: number): Promise<EmployeeSchedule[]> {
    return await db.select().from(employeeSchedules)
      .where(eq(employeeSchedules.branchEmployeeId, branchEmployeeId))
      .orderBy(employeeSchedules.scheduleDate);
  }

  // Org Job Roles - الهيكل الوظيفي
  async getAllOrgJobRoles(): Promise<OrgJobRole[]> {
    return await db.select().from(orgJobRoles)
      .where(eq(orgJobRoles.isActive, true))
      .orderBy(orgJobRoles.level, orgJobRoles.orderIndex);
  }

  async getOrgJobRole(id: number): Promise<OrgJobRole | undefined> {
    const [role] = await db.select().from(orgJobRoles).where(eq(orgJobRoles.id, id));
    return role || undefined;
  }

  async createOrgJobRole(role: InsertOrgJobRole): Promise<OrgJobRole> {
    const [created] = await db.insert(orgJobRoles).values({
      ...role,
      responsibilitiesAr: role.responsibilitiesAr || [],
      responsibilitiesEn: role.responsibilitiesEn || [],
      qualificationsAr: role.qualificationsAr || [],
      qualificationsEn: role.qualificationsEn || [],
    }).returning();
    return created;
  }

  async updateOrgJobRole(id: number, role: Partial<InsertOrgJobRole>): Promise<OrgJobRole | undefined> {
    const updateData: any = { ...role, updatedAt: new Date() };
    const [updated] = await db.update(orgJobRoles)
      .set(updateData)
      .where(eq(orgJobRoles.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteOrgJobRole(id: number): Promise<boolean> {
    const [deleted] = await db.update(orgJobRoles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(orgJobRoles.id, id))
      .returning();
    return !!deleted;
  }

  // Employee Settings - إعدادات بيانات الموظفين
  async getAllEmployeeSettings(): Promise<EmployeeSetting[]> {
    return await db.select().from(employeeSettings)
      .where(eq(employeeSettings.isActive, true))
      .orderBy(employeeSettings.category, employeeSettings.orderIndex);
  }

  async getEmployeeSettingsByCategory(category: string): Promise<EmployeeSetting[]> {
    return await db.select().from(employeeSettings)
      .where(and(
        eq(employeeSettings.category, category),
        eq(employeeSettings.isActive, true)
      ))
      .orderBy(employeeSettings.orderIndex);
  }

  async getEmployeeSetting(id: number): Promise<EmployeeSetting | undefined> {
    const [setting] = await db.select().from(employeeSettings).where(eq(employeeSettings.id, id));
    return setting || undefined;
  }

  async createEmployeeSetting(setting: InsertEmployeeSetting): Promise<EmployeeSetting> {
    const [created] = await db.insert(employeeSettings).values(setting).returning();
    return created;
  }

  async updateEmployeeSetting(id: number, setting: Partial<InsertEmployeeSetting>): Promise<EmployeeSetting | undefined> {
    const updateData: any = { ...setting, updatedAt: new Date() };
    const [updated] = await db.update(employeeSettings)
      .set(updateData)
      .where(eq(employeeSettings.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteEmployeeSetting(id: number): Promise<boolean> {
    const [deleted] = await db.update(employeeSettings)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(employeeSettings.id, id))
      .returning();
    return !!deleted;
  }

  // Employee Transfer Requests - طلبات نقل الموظفين
  async getAllTransferRequests(filters?: { status?: string; branchId?: string; employeeId?: number }): Promise<EmployeeTransferRequest[]> {
    let query = db.select().from(employeeTransferRequests);
    
    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(employeeTransferRequests.status, filters.status));
    if (filters?.branchId) {
      conditions.push(or(
        eq(employeeTransferRequests.sourceBranchId, filters.branchId),
        eq(employeeTransferRequests.destinationBranchId, filters.branchId)
      ));
    }
    if (filters?.employeeId) conditions.push(eq(employeeTransferRequests.employeeId, filters.employeeId));
    
    if (conditions.length > 0) {
      return await db.select().from(employeeTransferRequests)
        .where(and(...conditions))
        .orderBy(desc(employeeTransferRequests.requestedAt));
    }
    
    return await db.select().from(employeeTransferRequests)
      .orderBy(desc(employeeTransferRequests.requestedAt));
  }

  async getTransferRequest(id: number): Promise<EmployeeTransferRequest | undefined> {
    const [request] = await db.select().from(employeeTransferRequests)
      .where(eq(employeeTransferRequests.id, id));
    return request || undefined;
  }

  async createTransferRequest(request: InsertEmployeeTransferRequest): Promise<EmployeeTransferRequest> {
    const [created] = await db.insert(employeeTransferRequests)
      .values(request)
      .returning();
    return created;
  }

  async updateTransferRequest(id: number, request: Partial<InsertEmployeeTransferRequest>): Promise<EmployeeTransferRequest | undefined> {
    const updateData: any = { ...request, updatedAt: new Date() };
    const [updated] = await db.update(employeeTransferRequests)
      .set(updateData)
      .where(eq(employeeTransferRequests.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTransferRequest(id: number): Promise<boolean> {
    const [deleted] = await db.delete(employeeTransferRequests)
      .where(eq(employeeTransferRequests.id, id))
      .returning();
    return !!deleted;
  }

  async getTransfersByEmployee(employeeId: number): Promise<EmployeeTransferRequest[]> {
    return await db.select().from(employeeTransferRequests)
      .where(eq(employeeTransferRequests.employeeId, employeeId))
      .orderBy(desc(employeeTransferRequests.requestedAt));
  }

  async getPendingTransfersForBranch(branchId: string): Promise<EmployeeTransferRequest[]> {
    return await db.select().from(employeeTransferRequests)
      .where(and(
        or(
          eq(employeeTransferRequests.sourceBranchId, branchId),
          eq(employeeTransferRequests.destinationBranchId, branchId)
        ),
        or(
          eq(employeeTransferRequests.status, "pending"),
          eq(employeeTransferRequests.status, "source_approved"),
          eq(employeeTransferRequests.status, "dest_approved")
        )
      ))
      .orderBy(desc(employeeTransferRequests.requestedAt));
  }

  // Transfer Approval Steps - خطوات الموافقة
  async getTransferApprovalSteps(transferId: number): Promise<TransferApprovalStep[]> {
    return await db.select().from(transferApprovalSteps)
      .where(eq(transferApprovalSteps.transferId, transferId))
      .orderBy(transferApprovalSteps.stepOrder);
  }

  async createTransferApprovalStep(step: InsertTransferApprovalStep): Promise<TransferApprovalStep> {
    const [created] = await db.insert(transferApprovalSteps)
      .values(step)
      .returning();
    return created;
  }

  async updateTransferApprovalStep(id: number, step: Partial<InsertTransferApprovalStep>): Promise<TransferApprovalStep | undefined> {
    const [updated] = await db.update(transferApprovalSteps)
      .set({ ...step, actionTakenAt: new Date() })
      .where(eq(transferApprovalSteps.id, id))
      .returning();
    return updated || undefined;
  }

  // Transfer History - سجل النقل
  async getTransferHistory(transferId: number): Promise<TransferHistory[]> {
    return await db.select().from(transferHistory)
      .where(eq(transferHistory.transferId, transferId))
      .orderBy(desc(transferHistory.eventTimestamp));
  }

  async createTransferHistoryEntry(entry: { transferId: number; eventType: string; performedBy?: string; details?: any }): Promise<TransferHistory> {
    const [created] = await db.insert(transferHistory)
      .values(entry)
      .returning();
    return created;
  }

  // ==================== P&L (Profit & Loss) Dashboard Methods ====================

  // Financial Periods
  async getAllFinancialPeriods(filters?: { branchId?: string; year?: number; month?: number }): Promise<FinancialPeriod[]> {
    const conditions: any[] = [];
    if (filters?.branchId) conditions.push(eq(financialPeriods.branchId, filters.branchId));
    if (filters?.year) conditions.push(eq(financialPeriods.year, filters.year));
    if (filters?.month) conditions.push(eq(financialPeriods.month, filters.month));

    if (conditions.length > 0) {
      return await db.select().from(financialPeriods)
        .where(and(...conditions))
        .orderBy(desc(financialPeriods.year), desc(financialPeriods.month));
    }
    return await db.select().from(financialPeriods)
      .orderBy(desc(financialPeriods.year), desc(financialPeriods.month));
  }

  async getFinancialPeriod(id: number): Promise<FinancialPeriod | undefined> {
    const [period] = await db.select().from(financialPeriods)
      .where(eq(financialPeriods.id, id));
    return period || undefined;
  }

  async getFinancialPeriodByBranchAndDate(branchId: string, year: number, month: number): Promise<FinancialPeriod | undefined> {
    const [period] = await db.select().from(financialPeriods)
      .where(and(
        eq(financialPeriods.branchId, branchId),
        eq(financialPeriods.year, year),
        eq(financialPeriods.month, month)
      ));
    return period || undefined;
  }

  async createFinancialPeriod(period: InsertFinancialPeriod): Promise<FinancialPeriod> {
    const [created] = await db.insert(financialPeriods)
      .values(period)
      .returning();
    return created;
  }

  async updateFinancialPeriod(id: number, period: Partial<InsertFinancialPeriod>): Promise<FinancialPeriod | undefined> {
    const [updated] = await db.update(financialPeriods)
      .set({ ...period, updatedAt: new Date() })
      .where(eq(financialPeriods.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteFinancialPeriod(id: number): Promise<boolean> {
    const [deleted] = await db.delete(financialPeriods)
      .where(eq(financialPeriods.id, id))
      .returning();
    return !!deleted;
  }

  // Financial Sales
  async getFinancialSalesByPeriod(periodId: number): Promise<FinancialSales[]> {
    return await db.select().from(financialSales)
      .where(eq(financialSales.periodId, periodId));
  }

  async createFinancialSales(sales: InsertFinancialSales): Promise<FinancialSales> {
    const [created] = await db.insert(financialSales)
      .values(sales)
      .returning();
    return created;
  }

  async bulkCreateFinancialSales(salesList: InsertFinancialSales[]): Promise<FinancialSales[]> {
    if (salesList.length === 0) return [];
    return await db.insert(financialSales)
      .values(salesList)
      .returning();
  }

  async deleteFinancialSalesByPeriod(periodId: number): Promise<boolean> {
    await db.delete(financialSales)
      .where(eq(financialSales.periodId, periodId));
    return true;
  }

  // Financial COGS
  async getFinancialCOGSByPeriod(periodId: number): Promise<FinancialCOGS[]> {
    return await db.select().from(financialCOGS)
      .where(eq(financialCOGS.periodId, periodId));
  }

  async createFinancialCOGS(cogs: InsertFinancialCOGS): Promise<FinancialCOGS> {
    const [created] = await db.insert(financialCOGS)
      .values(cogs)
      .returning();
    return created;
  }

  async bulkCreateFinancialCOGS(cogsList: InsertFinancialCOGS[]): Promise<FinancialCOGS[]> {
    if (cogsList.length === 0) return [];
    return await db.insert(financialCOGS)
      .values(cogsList)
      .returning();
  }

  async deleteFinancialCOGSByPeriod(periodId: number): Promise<boolean> {
    await db.delete(financialCOGS)
      .where(eq(financialCOGS.periodId, periodId));
    return true;
  }

  // Financial Operating Expenses
  async getFinancialOperatingExpensesByPeriod(periodId: number): Promise<FinancialOperatingExpense[]> {
    return await db.select().from(financialOperatingExpenses)
      .where(eq(financialOperatingExpenses.periodId, periodId));
  }

  async createFinancialOperatingExpense(expense: InsertFinancialOperatingExpense): Promise<FinancialOperatingExpense> {
    const [created] = await db.insert(financialOperatingExpenses)
      .values(expense)
      .returning();
    return created;
  }

  async bulkCreateFinancialOperatingExpenses(expensesList: InsertFinancialOperatingExpense[]): Promise<FinancialOperatingExpense[]> {
    if (expensesList.length === 0) return [];
    return await db.insert(financialOperatingExpenses)
      .values(expensesList)
      .returning();
  }

  async deleteFinancialOperatingExpensesByPeriod(periodId: number): Promise<boolean> {
    await db.delete(financialOperatingExpenses)
      .where(eq(financialOperatingExpenses.periodId, periodId));
    return true;
  }

  // Financial Fixed Costs
  async getFinancialFixedCostsByPeriod(periodId: number): Promise<FinancialFixedCost[]> {
    return await db.select().from(financialFixedCosts)
      .where(eq(financialFixedCosts.periodId, periodId));
  }

  async createFinancialFixedCost(cost: InsertFinancialFixedCost): Promise<FinancialFixedCost> {
    const [created] = await db.insert(financialFixedCosts)
      .values(cost)
      .returning();
    return created;
  }

  async bulkCreateFinancialFixedCosts(costsList: InsertFinancialFixedCost[]): Promise<FinancialFixedCost[]> {
    if (costsList.length === 0) return [];
    return await db.insert(financialFixedCosts)
      .values(costsList)
      .returning();
  }

  async deleteFinancialFixedCostsByPeriod(periodId: number): Promise<boolean> {
    await db.delete(financialFixedCosts)
      .where(eq(financialFixedCosts.periodId, periodId));
    return true;
  }

  // Financial Metrics
  async getFinancialMetricsByPeriod(periodId: number): Promise<FinancialMetrics | undefined> {
    const [metrics] = await db.select().from(financialMetrics)
      .where(eq(financialMetrics.periodId, periodId));
    return metrics || undefined;
  }

  async createFinancialMetrics(metrics: InsertFinancialMetrics): Promise<FinancialMetrics> {
    const [created] = await db.insert(financialMetrics)
      .values(metrics)
      .returning();
    return created;
  }

  async updateFinancialMetrics(periodId: number, metrics: Partial<InsertFinancialMetrics>): Promise<FinancialMetrics | undefined> {
    const [updated] = await db.update(financialMetrics)
      .set({ ...metrics, calculatedAt: new Date() })
      .where(eq(financialMetrics.periodId, periodId))
      .returning();
    return updated || undefined;
  }

  async upsertFinancialMetrics(periodId: number, metrics: InsertFinancialMetrics): Promise<FinancialMetrics> {
    const existing = await this.getFinancialMetricsByPeriod(periodId);
    if (existing) {
      const updated = await this.updateFinancialMetrics(periodId, metrics);
      return updated!;
    }
    return await this.createFinancialMetrics({ ...metrics, periodId });
  }

  // Get complete P&L data for a period
  async getCompletePnLData(periodId: number): Promise<{
    period: FinancialPeriod | undefined;
    sales: FinancialSales[];
    cogs: FinancialCOGS[];
    operatingExpenses: FinancialOperatingExpense[];
    fixedCosts: FinancialFixedCost[];
    metrics: FinancialMetrics | undefined;
  }> {
    const [period, sales, cogs, operatingExpenses, fixedCosts, metrics] = await Promise.all([
      this.getFinancialPeriod(periodId),
      this.getFinancialSalesByPeriod(periodId),
      this.getFinancialCOGSByPeriod(periodId),
      this.getFinancialOperatingExpensesByPeriod(periodId),
      this.getFinancialFixedCostsByPeriod(periodId),
      this.getFinancialMetricsByPeriod(periodId),
    ]);
    return { period, sales, cogs, operatingExpenses, fixedCosts, metrics };
  }

  // Get branch ranking by metric
  async getBranchRanking(year: number, month: number, metric: 'profit' | 'revenue' | 'margin'): Promise<Array<{
    branchId: string;
    periodId: number;
    value: number;
  }>> {
    const periods = await db.select().from(financialPeriods)
      .where(and(
        eq(financialPeriods.year, year),
        eq(financialPeriods.month, month)
      ));

    const rankings: Array<{ branchId: string; periodId: number; value: number }> = [];

    for (const period of periods) {
      const metrics = await this.getFinancialMetricsByPeriod(period.id);
      if (metrics) {
        let value = 0;
        switch (metric) {
          case 'profit':
            value = metrics.netProfit || 0;
            break;
          case 'revenue':
            value = metrics.totalRevenue || 0;
            break;
          case 'margin':
            value = metrics.netMarginPct || 0;
            break;
        }
        rankings.push({ branchId: period.branchId, periodId: period.id, value });
      }
    }

    return rankings.sort((a, b) => b.value - a.value);
  }

  // ==========================================
  // Social Media Module - إدارة وسائل التواصل الاجتماعي
  // ==========================================

  // Social Accounts
  async getAllSocialAccounts(): Promise<SocialAccount[]> {
    return await db.select().from(socialAccounts);
  }

  async getSocialAccount(id: number): Promise<SocialAccount | undefined> {
    const [account] = await db.select().from(socialAccounts)
      .where(eq(socialAccounts.id, id));
    return account || undefined;
  }

  async getSocialAccountByPlatform(platform: string): Promise<SocialAccount | undefined> {
    const [account] = await db.select().from(socialAccounts)
      .where(eq(socialAccounts.platform, platform));
    return account || undefined;
  }

  async createSocialAccount(account: InsertSocialAccount): Promise<SocialAccount> {
    const [created] = await db.insert(socialAccounts)
      .values(account)
      .returning();
    return created;
  }

  async updateSocialAccount(id: number, account: Partial<InsertSocialAccount>): Promise<SocialAccount | undefined> {
    const [updated] = await db.update(socialAccounts)
      .set({ ...account, updatedAt: new Date() })
      .where(eq(socialAccounts.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSocialAccount(id: number): Promise<boolean> {
    const result = await db.delete(socialAccounts)
      .where(eq(socialAccounts.id, id))
      .returning();
    return result.length > 0;
  }

  // Social Posts
  async getAllSocialPosts(): Promise<SocialPost[]> {
    return await db.select().from(socialPosts)
      .orderBy(desc(socialPosts.createdAt));
  }

  async getSocialPost(id: number): Promise<SocialPost | undefined> {
    const [post] = await db.select().from(socialPosts)
      .where(eq(socialPosts.id, id));
    return post || undefined;
  }

  async getSocialPostsByStatus(status: string): Promise<SocialPost[]> {
    return await db.select().from(socialPosts)
      .where(eq(socialPosts.status, status))
      .orderBy(desc(socialPosts.createdAt));
  }

  async createSocialPost(post: InsertSocialPost): Promise<SocialPost> {
    const [created] = await db.insert(socialPosts)
      .values(post)
      .returning();
    return created;
  }

  async updateSocialPost(id: number, post: Partial<InsertSocialPost>): Promise<SocialPost | undefined> {
    const [updated] = await db.update(socialPosts)
      .set({ ...post, updatedAt: new Date() })
      .where(eq(socialPosts.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSocialPost(id: number): Promise<boolean> {
    const result = await db.delete(socialPosts)
      .where(eq(socialPosts.id, id))
      .returning();
    return result.length > 0;
  }

  // Social Templates
  async getAllSocialTemplates(): Promise<SocialContentTemplate[]> {
    return await db.select().from(socialContentTemplates)
      .orderBy(desc(socialContentTemplates.usageCount));
  }

  async getSocialTemplate(id: number): Promise<SocialContentTemplate | undefined> {
    const [template] = await db.select().from(socialContentTemplates)
      .where(eq(socialContentTemplates.id, id));
    return template || undefined;
  }

  async createSocialTemplate(template: InsertSocialContentTemplate): Promise<SocialContentTemplate> {
    const [created] = await db.insert(socialContentTemplates)
      .values(template)
      .returning();
    return created;
  }

  async updateSocialTemplate(id: number, template: Partial<InsertSocialContentTemplate>): Promise<SocialContentTemplate | undefined> {
    const [updated] = await db.update(socialContentTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(socialContentTemplates.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSocialTemplate(id: number): Promise<boolean> {
    const result = await db.delete(socialContentTemplates)
      .where(eq(socialContentTemplates.id, id))
      .returning();
    return result.length > 0;
  }

  async incrementTemplateUsage(id: number): Promise<void> {
    await db.update(socialContentTemplates)
      .set({ 
        usageCount: sql`${socialContentTemplates.usageCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(socialContentTemplates.id, id));
  }

  // Influencer Contracts - عقود المؤثرين
  async getAllInfluencerContracts(filters?: { status?: string; influencerId?: number; branchId?: string; paymentStatus?: string }): Promise<InfluencerContract[]> {
    const conditions = [];
    if (filters?.status) conditions.push(eq(influencerContracts.status, filters.status));
    if (filters?.influencerId) conditions.push(eq(influencerContracts.influencerId, filters.influencerId));
    if (filters?.branchId) conditions.push(eq(influencerContracts.branchId, filters.branchId));
    if (filters?.paymentStatus) conditions.push(eq(influencerContracts.paymentStatus, filters.paymentStatus));
    
    if (conditions.length > 0) {
      return await db.select().from(influencerContracts).where(and(...conditions)).orderBy(desc(influencerContracts.createdAt));
    }
    return await db.select().from(influencerContracts).orderBy(desc(influencerContracts.createdAt));
  }

  async getInfluencerContract(id: number): Promise<InfluencerContract | undefined> {
    const [contract] = await db.select().from(influencerContracts).where(eq(influencerContracts.id, id));
    return contract || undefined;
  }

  async getInfluencerContractByNumber(contractNumber: string): Promise<InfluencerContract | undefined> {
    const [contract] = await db.select().from(influencerContracts).where(eq(influencerContracts.contractNumber, contractNumber));
    return contract || undefined;
  }

  async createInfluencerContract(contract: InsertInfluencerContract): Promise<InfluencerContract> {
    const [created] = await db.insert(influencerContracts).values(contract).returning();
    return created;
  }

  async updateInfluencerContract(id: number, contract: Partial<InsertInfluencerContract>): Promise<InfluencerContract | undefined> {
    const [updated] = await db.update(influencerContracts).set({ ...contract, updatedAt: new Date() }).where(eq(influencerContracts.id, id)).returning();
    return updated || undefined;
  }

  async deleteInfluencerContract(id: number): Promise<boolean> {
    const result = await db.delete(influencerContracts).where(eq(influencerContracts.id, id)).returning();
    return result.length > 0;
  }

  async generateContractNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(influencerContracts);
    const nextNum = (result?.count || 0) + 1;
    return `BTR-INF-${year}-${String(nextNum).padStart(4, '0')}`;
  }

  // ==========================================
  // Finished Goods Inventory - مخزون الإنتاج النهائي
  // ==========================================

  async getFinishedGoodsInventory(filters?: { branchId?: string; productId?: number; productionDate?: string; startDate?: string; endDate?: string; category?: string }): Promise<FinishedGoodsInventory[]> {
    const conditions = [];
    if (filters?.branchId) conditions.push(eq(finishedGoodsInventory.branchId, filters.branchId));
    if (filters?.productId) conditions.push(eq(finishedGoodsInventory.productId, filters.productId));
    if (filters?.productionDate) conditions.push(eq(finishedGoodsInventory.productionDate, filters.productionDate));
    if (filters?.startDate) conditions.push(sql`${finishedGoodsInventory.productionDate} >= ${filters.startDate}`);
    if (filters?.endDate) conditions.push(sql`${finishedGoodsInventory.productionDate} <= ${filters.endDate}`);
    if (filters?.category) conditions.push(eq(finishedGoodsInventory.productCategory, filters.category));
    
    if (conditions.length > 0) {
      return await db.select().from(finishedGoodsInventory).where(and(...conditions)).orderBy(desc(finishedGoodsInventory.updatedAt));
    }
    return await db.select().from(finishedGoodsInventory).orderBy(desc(finishedGoodsInventory.updatedAt));
  }

  async getFinishedGoodsInventoryItem(id: number): Promise<FinishedGoodsInventory | undefined> {
    const [item] = await db.select().from(finishedGoodsInventory).where(eq(finishedGoodsInventory.id, id));
    return item || undefined;
  }

  async addToFinishedGoodsInventory(item: InsertFinishedGoodsInventory): Promise<FinishedGoodsInventory> {
    // Ensure productNameNormalized is set for consistent matching
    const itemWithNormalized = {
      ...item,
      productNameNormalized: item.productNameNormalized || item.productName.trim().toLowerCase()
    };
    
    // Use normalized product name for matching
    const conditions = [
      eq(finishedGoodsInventory.branchId, itemWithNormalized.branchId),
      eq(finishedGoodsInventory.productNameNormalized, itemWithNormalized.productNameNormalized),
      eq(finishedGoodsInventory.productionDate, itemWithNormalized.productionDate)
    ];
    
    const existing = await db.select().from(finishedGoodsInventory).where(and(...conditions));
    
    if (existing.length > 0) {
      // Update existing entry
      const [updated] = await db.update(finishedGoodsInventory)
        .set({ 
          quantity: sql`${finishedGoodsInventory.quantity} + ${itemWithNormalized.quantity}`,
          lastBatchId: itemWithNormalized.lastBatchId,
          productId: itemWithNormalized.productId || existing[0].productId,
          updatedAt: new Date()
        })
        .where(eq(finishedGoodsInventory.id, existing[0].id))
        .returning();
      return updated;
    }
    
    // Create new entry
    const [created] = await db.insert(finishedGoodsInventory).values(itemWithNormalized).returning();
    return created;
  }

  async updateFinishedGoodsInventory(id: number, item: Partial<InsertFinishedGoodsInventory>): Promise<FinishedGoodsInventory | undefined> {
    const [updated] = await db.update(finishedGoodsInventory)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(finishedGoodsInventory.id, id))
      .returning();
    return updated || undefined;
  }

  async decrementFinishedGoodsInventory(id: number, quantity: number): Promise<FinishedGoodsInventory | undefined> {
    const [updated] = await db.update(finishedGoodsInventory)
      .set({ 
        quantity: sql`GREATEST(${finishedGoodsInventory.quantity} - ${quantity}, 0)`,
        updatedAt: new Date()
      })
      .where(eq(finishedGoodsInventory.id, id))
      .returning();
    return updated || undefined;
  }

  async addProductionToFinishedGoods(batchId: number, userId?: string, userName?: string): Promise<FinishedGoodsInventory> {
    return await db.transaction(async (tx) => {
      // Get the production batch
      const [batch] = await tx.select().from(dailyProductionBatches).where(eq(dailyProductionBatches.id, batchId));
      if (!batch) {
        throw new Error(`دفعة الإنتاج ${batchId} غير موجودة`);
      }
      
      const productionDate = batch.productionDate || new Date().toISOString().split('T')[0];
      
      // Normalize product name for consistent matching - trim and lowercase
      const productNameNormalized = (batch.productName || '').trim().toLowerCase();
      
      // Use UPSERT with standard unique index for atomic inventory addition
      // Index: finished_goods_unique_idx on (branch_id, product_name_normalized, production_date)
      // RETURNING provides the final quantity after the operation
      const upsertResult = await tx.execute(sql`
        INSERT INTO finished_goods_inventory (branch_id, product_id, product_name, product_name_normalized, product_category, quantity, unit, production_date, last_batch_id, created_at, updated_at)
        VALUES (${batch.branchId}, ${batch.productId}, ${batch.productName}, ${productNameNormalized}, ${batch.productCategory}, ${batch.quantity}, ${batch.unit || 'قطعة'}, ${productionDate}, ${batchId}, NOW(), NOW())
        ON CONFLICT (branch_id, product_name_normalized, production_date)
        DO UPDATE SET 
          quantity = finished_goods_inventory.quantity + EXCLUDED.quantity,
          last_batch_id = EXCLUDED.last_batch_id,
          product_id = COALESCE(EXCLUDED.product_id, finished_goods_inventory.product_id),
          updated_at = NOW()
        RETURNING id, branch_id, product_id, product_name, product_name_normalized, product_category, quantity, unit, production_date, last_batch_id, created_at, updated_at
      `) as { rows: any[] };
      
      // Use RETURNING row directly - this is the final state after atomic upsert
      const row = upsertResult.rows[0];
      const finalQuantity = row.quantity;
      
      // Balance calculation from RETURNING data (quantity after operation - added quantity = balance before)
      const balanceAfter = finalQuantity;
      const balanceBefore = finalQuantity - batch.quantity;
      
      // Map result to expected type
      const inventoryItem: FinishedGoodsInventory = {
        id: row.id,
        branchId: row.branch_id,
        productId: row.product_id,
        productName: row.product_name,
        productNameNormalized: row.product_name_normalized,
        productCategory: row.product_category,
        quantity: row.quantity,
        unit: row.unit,
        productionDate: row.production_date,
        lastBatchId: row.last_batch_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      
      // Log the movement within same transaction
      await tx.insert(productionInventoryLogs).values({
        branchId: batch.branchId,
        productId: batch.productId,
        productName: batch.productName,
        movementType: 'production_in',
        quantity: batch.quantity,
        balanceBefore,
        balanceAfter,
        referenceType: 'batch',
        referenceId: batchId,
        notes: `ترحيل من دفعة الإنتاج #${batchId}`,
        createdBy: userId,
        createdByName: userName,
      });
      
      return inventoryItem;
    });
  }

  // Finished Goods Transfers
  async getFinishedGoodsTransfers(filters?: { sourceBranchId?: string; destinationType?: string; destinationBranchId?: string; transferDate?: string; startDate?: string; endDate?: string; status?: string }): Promise<FinishedGoodsTransfer[]> {
    const conditions = [];
    if (filters?.sourceBranchId) conditions.push(eq(finishedGoodsTransfers.sourceBranchId, filters.sourceBranchId));
    if (filters?.destinationType) conditions.push(eq(finishedGoodsTransfers.destinationType, filters.destinationType));
    if (filters?.destinationBranchId) conditions.push(eq(finishedGoodsTransfers.destinationBranchId, filters.destinationBranchId));
    if (filters?.transferDate) conditions.push(eq(finishedGoodsTransfers.transferDate, filters.transferDate));
    if (filters?.startDate) conditions.push(sql`${finishedGoodsTransfers.transferDate} >= ${filters.startDate}`);
    if (filters?.endDate) conditions.push(sql`${finishedGoodsTransfers.transferDate} <= ${filters.endDate}`);
    if (filters?.status) conditions.push(eq(finishedGoodsTransfers.status, filters.status));
    
    if (conditions.length > 0) {
      return await db.select().from(finishedGoodsTransfers).where(and(...conditions)).orderBy(desc(finishedGoodsTransfers.createdAt));
    }
    return await db.select().from(finishedGoodsTransfers).orderBy(desc(finishedGoodsTransfers.createdAt));
  }

  async getFinishedGoodsTransfer(id: number): Promise<FinishedGoodsTransfer | undefined> {
    const [transfer] = await db.select().from(finishedGoodsTransfers).where(eq(finishedGoodsTransfers.id, id));
    return transfer || undefined;
  }

  async createFinishedGoodsTransfer(transfer: InsertFinishedGoodsTransfer): Promise<FinishedGoodsTransfer> {
    const [created] = await db.insert(finishedGoodsTransfers).values(transfer).returning();
    return created;
  }

  async transferFinishedGoods(inventoryId: number, quantity: number, destinationType: string, destinationBranchId?: string, notes?: string, userId?: string, userName?: string): Promise<FinishedGoodsTransfer> {
    // Valid destination types
    const validDestinationTypes = ['branch', 'display_bar', 'بار_العرض', 'kitchen_trolley', 'freezer', 'refrigerator'];
    if (!validDestinationTypes.includes(destinationType)) {
      throw new Error(`نوع الوجهة غير صالح`);
    }
    
    // Validate branch ID for branch transfers
    if (destinationType === 'branch' && !destinationBranchId) {
      throw new Error(`يجب تحديد الفرع المستهدف عند التحويل لفرع آخر`);
    }
    
    return await db.transaction(async (tx) => {
      // Use conditional update with quantity check to prevent overselling under concurrency
      // This atomically checks quantity >= requested and decrements, returns updated row
      const updateResult = await tx.update(finishedGoodsInventory)
        .set({ 
          quantity: sql`${finishedGoodsInventory.quantity} - ${quantity}`,
          updatedAt: new Date()
        })
        .where(and(
          eq(finishedGoodsInventory.id, inventoryId),
          sql`${finishedGoodsInventory.quantity} >= ${quantity}`
        ))
        .returning();
      
      if (updateResult.length === 0) {
        // Either item doesn't exist or insufficient quantity - check which
        const [existingItem] = await tx.select().from(finishedGoodsInventory)
          .where(eq(finishedGoodsInventory.id, inventoryId));
        
        if (!existingItem) {
          throw new Error(`عنصر المخزون ${inventoryId} غير موجود`);
        }
        throw new Error(`الكمية غير كافية. المتاح: ${existingItem.quantity}, المطلوب: ${quantity}`);
      }
      
      const updatedInventory = updateResult[0];
      const transferDate = new Date().toISOString().split('T')[0];
      const balanceAfter = updatedInventory.quantity;
      const balanceBefore = balanceAfter + quantity;
      
      // Create transfer record within transaction
      const [transfer] = await tx.insert(finishedGoodsTransfers).values({
        inventoryId,
        sourceBranchId: updatedInventory.branchId,
        destinationType,
        destinationBranchId: destinationBranchId || null,
        productId: updatedInventory.productId,
        productName: updatedInventory.productName,
        productCategory: updatedInventory.productCategory,
        quantity,
        unit: updatedInventory.unit,
        transferDate,
        notes,
        status: 'completed',
        createdBy: userId,
        createdByName: userName,
      }).returning();
      
      // Map destination type to Arabic for log
      const destTypeMap: Record<string, string> = {
        'branch': 'فرع',
        'display_bar': 'بار العرض',
        'بار_العرض': 'بار العرض',
        'kitchen_trolley': 'عربة المطبخ',
        'freezer': 'الفريزر',
        'refrigerator': 'الثلاجة',
      };
      const destTypeArabic = destTypeMap[destinationType] || destinationType;
      
      // Log the movement within same transaction
      await tx.insert(productionInventoryLogs).values({
        branchId: updatedInventory.branchId,
        productId: updatedInventory.productId,
        productName: updatedInventory.productName,
        movementType: 'transfer_out',
        quantity: -quantity,
        balanceBefore,
        balanceAfter,
        referenceType: 'transfer',
        referenceId: transfer.id,
        notes: `تحويل إلى ${destTypeArabic}${destinationBranchId ? ` - ${destinationBranchId}` : ''}`,
        createdBy: userId,
        createdByName: userName,
      });
      
      return transfer;
    });
  }

  // Production Inventory Logs
  async getProductionInventoryLogs(filters?: { branchId?: string; productId?: number; movementType?: string }): Promise<ProductionInventoryLog[]> {
    const conditions = [];
    if (filters?.branchId) conditions.push(eq(productionInventoryLogs.branchId, filters.branchId));
    if (filters?.productId) conditions.push(eq(productionInventoryLogs.productId, filters.productId));
    if (filters?.movementType) conditions.push(eq(productionInventoryLogs.movementType, filters.movementType));
    
    if (conditions.length > 0) {
      return await db.select().from(productionInventoryLogs).where(and(...conditions)).orderBy(desc(productionInventoryLogs.createdAt));
    }
    return await db.select().from(productionInventoryLogs).orderBy(desc(productionInventoryLogs.createdAt));
  }

  async createProductionInventoryLog(log: InsertProductionInventoryLog): Promise<ProductionInventoryLog> {
    const [created] = await db.insert(productionInventoryLogs).values(log).returning();
    return created;
  }

  // ==================== Warehouse Management ====================

  // Warehouse Items
  async getWarehouseItems(filters?: { category?: string; isActive?: boolean }): Promise<WarehouseItem[]> {
    const conditions = [];
    if (filters?.category) conditions.push(eq(warehouseItems.category, filters.category));
    if (filters?.isActive !== undefined) conditions.push(eq(warehouseItems.isActive, filters.isActive));
    
    if (conditions.length > 0) {
      return await db.select().from(warehouseItems).where(and(...conditions)).orderBy(warehouseItems.name);
    }
    return await db.select().from(warehouseItems).orderBy(warehouseItems.name);
  }

  async getWarehouseItem(id: number): Promise<WarehouseItem | undefined> {
    const [item] = await db.select().from(warehouseItems).where(eq(warehouseItems.id, id));
    return item || undefined;
  }

  async createWarehouseItem(item: InsertWarehouseItem): Promise<WarehouseItem> {
    const [created] = await db.insert(warehouseItems).values(item).returning();
    return created;
  }

  async updateWarehouseItem(id: number, updates: Partial<InsertWarehouseItem>): Promise<WarehouseItem | undefined> {
    const [updated] = await db.update(warehouseItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(warehouseItems.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteWarehouseItem(id: number): Promise<boolean> {
    const result = await db.delete(warehouseItems).where(eq(warehouseItems.id, id));
    return true;
  }

  // Branch Stock
  async getBranchStock(branchId: string): Promise<(BranchStock & { item: WarehouseItem })[]> {
    const result = await db.select()
      .from(branchStock)
      .leftJoin(warehouseItems, eq(branchStock.itemId, warehouseItems.id))
      .where(eq(branchStock.branchId, branchId));
    
    return result.map(r => ({
      ...r.branch_stock,
      item: r.warehouse_items!
    }));
  }

  async updateBranchStock(branchId: string, itemId: number, quantity: number, dailyConsumption?: number, userId?: string): Promise<BranchStock> {
    const existing = await db.select().from(branchStock)
      .where(and(eq(branchStock.branchId, branchId), eq(branchStock.itemId, itemId)));
    
    if (existing.length > 0) {
      const [updated] = await db.update(branchStock)
        .set({ 
          currentQuantity: quantity, 
          dailyConsumption: dailyConsumption ?? existing[0].dailyConsumption,
          lastUpdated: new Date(),
          updatedBy: userId 
        })
        .where(and(eq(branchStock.branchId, branchId), eq(branchStock.itemId, itemId)))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(branchStock)
        .values({ branchId, itemId, currentQuantity: quantity, dailyConsumption, updatedBy: userId })
        .returning();
      return created;
    }
  }

  // Material Transfers
  async getMaterialTransfers(filters?: { sourceBranchId?: string; destinationBranchId?: string; branchId?: string; status?: string; startDate?: string; endDate?: string }): Promise<MaterialTransfer[]> {
    const conditions = [];
    
    // branchId filter: match as either source OR destination (for branch-scoped access)
    if (filters?.branchId) {
      conditions.push(
        or(
          eq(materialTransfers.sourceBranchId, filters.branchId),
          eq(materialTransfers.destinationBranchId, filters.branchId)
        )
      );
    } else {
      // Regular source/destination filters
      if (filters?.sourceBranchId) conditions.push(eq(materialTransfers.sourceBranchId, filters.sourceBranchId));
      if (filters?.destinationBranchId) conditions.push(eq(materialTransfers.destinationBranchId, filters.destinationBranchId));
    }
    
    if (filters?.status) conditions.push(eq(materialTransfers.status, filters.status));
    if (filters?.startDate) conditions.push(gte(materialTransfers.transferDate, filters.startDate));
    if (filters?.endDate) conditions.push(lte(materialTransfers.transferDate, filters.endDate));
    
    if (conditions.length > 0) {
      return await db.select().from(materialTransfers).where(and(...conditions)).orderBy(desc(materialTransfers.createdAt));
    }
    return await db.select().from(materialTransfers).orderBy(desc(materialTransfers.createdAt));
  }

  async getMaterialTransfer(id: number): Promise<MaterialTransfer | undefined> {
    const [transfer] = await db.select().from(materialTransfers).where(eq(materialTransfers.id, id));
    return transfer || undefined;
  }

  async getMaterialTransferWithItems(id: number): Promise<{ transfer: MaterialTransfer; items: MaterialTransferItem[] } | undefined> {
    const [transfer] = await db.select().from(materialTransfers).where(eq(materialTransfers.id, id));
    if (!transfer) return undefined;
    
    const items = await db.select().from(materialTransferItems).where(eq(materialTransferItems.transferId, id));
    
    return { transfer, items };
  }

  async createMaterialTransfer(transfer: InsertMaterialTransfer, items: InsertMaterialTransferItem[]): Promise<MaterialTransfer> {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(materialTransfers).values(transfer).returning();
      
      if (items.length > 0) {
        await tx.insert(materialTransferItems).values(
          items.map(item => ({ ...item, transferId: created.id }))
        );
      }
      
      return created;
    });
  }

  async updateMaterialTransferStatus(id: number, status: string, additionalData?: Partial<InsertMaterialTransfer>): Promise<MaterialTransfer | undefined> {
    const [updated] = await db.update(materialTransfers)
      .set({ 
        status,
        ...additionalData,
        updatedAt: new Date() 
      })
      .where(eq(materialTransfers.id, id))
      .returning();
    return updated || undefined;
  }

  async deliverMaterialTransferWithStockUpdate(
    id: number, 
    additionalData: { arrivalTime: Date; receivedBy?: string; receivedByName?: string; receiverSignature?: string },
    userId?: string
  ): Promise<MaterialTransfer | undefined> {
    return await db.transaction(async (tx) => {
      const [transfer] = await tx.select().from(materialTransfers).where(eq(materialTransfers.id, id));
      if (!transfer) throw new Error("التحويل غير موجود");
      
      const items = await tx.select().from(materialTransferItems).where(eq(materialTransferItems.transferId, id));
      if (!items || items.length === 0) throw new Error("لا توجد عناصر في التحويل");
      
      const [updated] = await tx.update(materialTransfers)
        .set({ 
          status: 'delivered',
          ...additionalData,
          updatedAt: new Date() 
        })
        .where(eq(materialTransfers.id, id))
        .returning();
      
      for (const item of items) {
        const existingStock = await tx.select().from(branchStock)
          .where(and(eq(branchStock.branchId, transfer.destinationBranchId), eq(branchStock.itemId, item.itemId)));
        
        if (existingStock.length > 0) {
          await tx.update(branchStock)
            .set({ 
              currentQuantity: (existingStock[0].currentQuantity || 0) + item.quantity,
              lastUpdated: new Date(),
              updatedBy: userId
            })
            .where(and(eq(branchStock.branchId, transfer.destinationBranchId), eq(branchStock.itemId, item.itemId)));
        } else {
          await tx.insert(branchStock).values({
            branchId: transfer.destinationBranchId,
            itemId: item.itemId,
            currentQuantity: item.quantity,
            updatedBy: userId
          });
        }
        
        await tx.insert(warehouseMovementLogs).values({
          itemId: item.itemId,
          branchId: transfer.destinationBranchId,
          movementType: 'transfer_in',
          quantity: item.quantity,
          referenceType: 'transfer',
          referenceId: transfer.id,
          notes: `استلام من تحويل ${transfer.transferNumber}`,
          createdBy: userId
        });
      }
      
      return updated;
    });
  }

  async confirmMaterialTransferDelivery(
    id: number,
    receivedItems: Array<{ itemId: number; receivedQuantity: number; discrepancyNotes?: string }>,
    deliveryData: { receivedBy?: string; receivedByName?: string; receiverSignature?: string; deliveryNotes?: string },
    userId?: string
  ): Promise<MaterialTransfer | undefined> {
    return await db.transaction(async (tx) => {
      const [transfer] = await tx.select().from(materialTransfers).where(eq(materialTransfers.id, id));
      if (!transfer) throw new Error("التحويل غير موجود");
      
      const items = await tx.select().from(materialTransferItems).where(eq(materialTransferItems.transferId, id));
      if (!items || items.length === 0) throw new Error("لا توجد عناصر في التحويل");
      
      let hasDiscrepancy = false;
      
      // Update each item with received quantity and calculate discrepancy
      for (const item of items) {
        const receivedItem = receivedItems.find(ri => ri.itemId === item.itemId);
        const receivedQty = receivedItem?.receivedQuantity ?? item.quantity;
        const discrepancy = receivedQty - item.quantity;
        
        if (discrepancy !== 0) hasDiscrepancy = true;
        
        await tx.update(materialTransferItems)
          .set({
            receivedQuantity: receivedQty,
            discrepancy: discrepancy,
            discrepancyNotes: receivedItem?.discrepancyNotes || null
          })
          .where(eq(materialTransferItems.id, item.id));
        
        // Update destination branch stock with RECEIVED quantity (not sent quantity)
        const existingStock = await tx.select().from(branchStock)
          .where(and(eq(branchStock.branchId, transfer.destinationBranchId), eq(branchStock.itemId, item.itemId)));
        
        if (existingStock.length > 0) {
          await tx.update(branchStock)
            .set({ 
              currentQuantity: (existingStock[0].currentQuantity || 0) + receivedQty,
              lastUpdated: new Date(),
              updatedBy: userId
            })
            .where(and(eq(branchStock.branchId, transfer.destinationBranchId), eq(branchStock.itemId, item.itemId)));
        } else {
          await tx.insert(branchStock).values({
            branchId: transfer.destinationBranchId,
            itemId: item.itemId,
            currentQuantity: receivedQty,
            updatedBy: userId
          });
        }
        
        // Deduct from source branch stock (if branch-to-branch transfer)
        if (transfer.sourceBranchId) {
          const sourceStock = await tx.select().from(branchStock)
            .where(and(eq(branchStock.branchId, transfer.sourceBranchId), eq(branchStock.itemId, item.itemId)));
          
          if (sourceStock.length > 0) {
            await tx.update(branchStock)
              .set({ 
                currentQuantity: Math.max(0, (sourceStock[0].currentQuantity || 0) - item.quantity),
                lastUpdated: new Date(),
                updatedBy: userId
              })
              .where(and(eq(branchStock.branchId, transfer.sourceBranchId), eq(branchStock.itemId, item.itemId)));
          }
        }
        
        // Log the movement
        await tx.insert(warehouseMovementLogs).values({
          itemId: item.itemId,
          branchId: transfer.destinationBranchId,
          movementType: 'transfer_in',
          quantity: receivedQty,
          referenceType: 'transfer',
          referenceId: transfer.id,
          notes: `استلام ${receivedQty} من تحويل ${transfer.transferNumber}${discrepancy !== 0 ? ` (فرق: ${discrepancy})` : ''}`,
          createdBy: userId
        });
        
        // Log outgoing from source if branch-to-branch
        if (transfer.sourceBranchId) {
          await tx.insert(warehouseMovementLogs).values({
            itemId: item.itemId,
            branchId: transfer.sourceBranchId,
            movementType: 'transfer_out',
            quantity: item.quantity,
            referenceType: 'transfer',
            referenceId: transfer.id,
            notes: `إرسال ${item.quantity} في تحويل ${transfer.transferNumber}`,
            createdBy: userId
          });
        }
      }
      
      // Update transfer header
      const [updated] = await tx.update(materialTransfers)
        .set({ 
          status: 'delivered',
          arrivalTime: new Date(),
          deliveryDate: new Date().toISOString().split('T')[0],
          hasDiscrepancy,
          receivedBy: deliveryData.receivedBy,
          receivedByName: deliveryData.receivedByName,
          receiverSignature: deliveryData.receiverSignature,
          deliveryNotes: deliveryData.deliveryNotes,
          updatedAt: new Date() 
        })
        .where(eq(materialTransfers.id, id))
        .returning();
      
      return updated;
    });
  }

  async generateMaterialTransferNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = `MT-${year}${month}`;
    
    const existing = await db.select()
      .from(materialTransfers)
      .where(sql`${materialTransfers.transferNumber} LIKE ${prefix + '%'}`)
      .orderBy(desc(materialTransfers.transferNumber));
    
    let nextNum = 1;
    if (existing.length > 0) {
      const lastNum = existing[0].transferNumber.split('-').pop();
      nextNum = parseInt(lastNum || '0') + 1;
    }
    
    return `${prefix}-${String(nextNum).padStart(4, '0')}`;
  }

  // Modify Transfer Quantities - تعديل كميات طلب التحويل (قبل الإرسال فقط)
  async modifyTransferQuantities(
    transferId: number,
    modifications: Array<{
      itemId: number;
      newQuantity: number;
      modificationNotes?: string;
    }>,
    modifiedBy: string,
    modifiedByName: string
  ): Promise<MaterialTransfer> {
    return await db.transaction(async (tx) => {
      // Get the transfer and verify it's in a modifiable state
      const [transfer] = await tx.select().from(materialTransfers).where(eq(materialTransfers.id, transferId));
      
      if (!transfer) {
        throw new Error("طلب التحويل غير موجود");
      }
      
      // Only allow modifications before dispatch (pending or approved status)
      if (!['pending', 'approved'].includes(transfer.status)) {
        throw new Error("لا يمكن تعديل الكميات بعد إرسال الشحنة");
      }
      
      // Get current items
      const items = await tx.select().from(materialTransferItems).where(eq(materialTransferItems.transferId, transferId));
      
      let hasModifications = false;
      
      // Update each modified item
      for (const mod of modifications) {
        const item = items.find(i => i.itemId === mod.itemId);
        if (!item) continue;
        
        // Store original quantity if not already stored
        const originalQty = item.originalQuantity || item.quantity;
        
        // Only update if quantity changed
        if (mod.newQuantity !== item.quantity) {
          hasModifications = true;
          
          await tx.update(materialTransferItems)
            .set({
              originalQuantity: originalQty,
              quantity: mod.newQuantity,
              isModified: true,
              modifiedBy,
              modifiedByName,
              modifiedAt: new Date(),
              modificationNotes: mod.modificationNotes || 'تعديل الكمية حسب المتوفر'
            })
            .where(eq(materialTransferItems.id, item.id));
        }
      }
      
      // Update transfer header if any modifications were made
      if (hasModifications) {
        await tx.update(materialTransfers)
          .set({
            hasQuantityModifications: true,
            updatedAt: new Date()
          })
          .where(eq(materialTransfers.id, transferId));
      }
      
      // Return updated transfer
      const [updated] = await tx.select().from(materialTransfers).where(eq(materialTransfers.id, transferId));
      return updated;
    });
  }

  // Warehouse Movement Logs
  async getWarehouseMovementLogs(filters?: { itemId?: number; branchId?: string; movementType?: string }): Promise<WarehouseMovementLog[]> {
    const conditions = [];
    if (filters?.itemId) conditions.push(eq(warehouseMovementLogs.itemId, filters.itemId));
    if (filters?.branchId) conditions.push(eq(warehouseMovementLogs.branchId, filters.branchId));
    if (filters?.movementType) conditions.push(eq(warehouseMovementLogs.movementType, filters.movementType));
    
    if (conditions.length > 0) {
      return await db.select().from(warehouseMovementLogs).where(and(...conditions)).orderBy(desc(warehouseMovementLogs.createdAt));
    }
    return await db.select().from(warehouseMovementLogs).orderBy(desc(warehouseMovementLogs.createdAt));
  }

  async createWarehouseMovementLog(log: InsertWarehouseMovementLog): Promise<WarehouseMovementLog> {
    const [created] = await db.insert(warehouseMovementLogs).values(log).returning();
    return created;
  }

  // Monthly Movement Report - تقرير الحركة الشهري
  async getMonthlyMovementReport(branchId: string | undefined, month: number, year: number): Promise<{
    byBranch: Array<{
      branchId: string;
      branchName: string;
      totalIncoming: number;
      totalOutgoing: number;
      netMovement: number;
      transferCount: number;
    }>;
    byItem: Array<{
      itemId: number;
      itemName: string;
      category: string;
      unit: string;
      totalIncoming: number;
      totalOutgoing: number;
      netMovement: number;
    }>;
    transfers: Array<{
      id: number;
      transferNumber: string;
      sourceBranchName: string | null;
      destinationBranchName: string;
      status: string;
      deliveryDate: string | null;
      hasDiscrepancy: boolean | null;
      itemCount: number;
      totalQuantity: number;
    }>;
    summary: {
      totalTransfers: number;
      deliveredTransfers: number;
      totalItemsReceived: number;
      transfersWithDiscrepancy: number;
    };
  }> {
    // Build date range for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12 
      ? `${year + 1}-01-01` 
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    // Get delivered transfers for the month
    const transfersQuery = branchId
      ? db.select().from(materialTransfers)
          .where(and(
            eq(materialTransfers.status, 'delivered'),
            or(
              eq(materialTransfers.destinationBranchId, branchId),
              eq(materialTransfers.sourceBranchId, branchId)
            ),
            sql`${materialTransfers.deliveryDate} >= ${startDate}`,
            sql`${materialTransfers.deliveryDate} < ${endDate}`
          ))
      : db.select().from(materialTransfers)
          .where(and(
            eq(materialTransfers.status, 'delivered'),
            sql`${materialTransfers.deliveryDate} >= ${startDate}`,
            sql`${materialTransfers.deliveryDate} < ${endDate}`
          ));

    const deliveredTransfers = await transfersQuery;

    // Get all branches for name lookup
    const allBranches = await db.select().from(branches);
    const branchMap = new Map(allBranches.map(b => [b.id, b.name]));

    // Get all items for name lookup
    const allItems = await db.select().from(warehouseItems);
    const itemMap = new Map(allItems.map(i => [i.id, { name: i.name, category: i.category, unit: i.unit }]));

    // Get transfer items for all delivered transfers
    const transferIds = deliveredTransfers.map(t => t.id);
    const allTransferItems = transferIds.length > 0
      ? await db.select().from(materialTransferItems)
          .where(sql`${materialTransferItems.transferId} IN (${sql.join(transferIds.map(id => sql`${id}`), sql`,`)})`)
      : [];

    // Calculate by branch
    const branchStats: Map<string, { incoming: number; outgoing: number; count: number }> = new Map();
    
    for (const transfer of deliveredTransfers) {
      const destBranch = transfer.destinationBranchId;
      const srcBranch = transfer.sourceBranchId;
      
      const items = allTransferItems.filter(item => item.transferId === transfer.id);
      const totalQty = items.reduce((sum, item) => sum + (item.receivedQuantity || item.quantity), 0);
      
      // Incoming to destination
      if (!branchStats.has(destBranch)) {
        branchStats.set(destBranch, { incoming: 0, outgoing: 0, count: 0 });
      }
      const destStats = branchStats.get(destBranch)!;
      destStats.incoming += totalQty;
      destStats.count++;
      
      // Outgoing from source (if branch-to-branch)
      if (srcBranch && srcBranch !== 'main_warehouse') {
        if (!branchStats.has(srcBranch)) {
          branchStats.set(srcBranch, { incoming: 0, outgoing: 0, count: 0 });
        }
        const srcStats = branchStats.get(srcBranch)!;
        srcStats.outgoing += items.reduce((sum, item) => sum + item.quantity, 0);
      }
    }

    const byBranch = Array.from(branchStats.entries()).map(([bId, stats]) => ({
      branchId: bId,
      branchName: branchMap.get(bId) || bId,
      totalIncoming: stats.incoming,
      totalOutgoing: stats.outgoing,
      netMovement: stats.incoming - stats.outgoing,
      transferCount: stats.count
    }));

    // Calculate by item - track both incoming and outgoing for branch-to-branch transfers
    const itemStats: Map<number, { incoming: number; outgoing: number }> = new Map();
    
    for (const transfer of deliveredTransfers) {
      const items = allTransferItems.filter(item => item.transferId === transfer.id);
      const srcBranch = transfer.sourceBranchId;
      
      for (const item of items) {
        if (!itemStats.has(item.itemId)) {
          itemStats.set(item.itemId, { incoming: 0, outgoing: 0 });
        }
        const stats = itemStats.get(item.itemId)!;
        
        // Incoming: received quantities at destination
        stats.incoming += item.receivedQuantity || item.quantity;
        
        // Outgoing: sent quantities from source (only for branch-to-branch transfers)
        if (srcBranch && srcBranch !== 'main_warehouse') {
          stats.outgoing += item.quantity;
        }
      }
    }

    const byItem = Array.from(itemStats.entries()).map(([itemId, stats]) => {
      const itemInfo = itemMap.get(itemId);
      return {
        itemId,
        itemName: itemInfo?.name || `صنف ${itemId}`,
        category: itemInfo?.category || '',
        unit: itemInfo?.unit || '',
        totalIncoming: stats.incoming,
        totalOutgoing: stats.outgoing,
        netMovement: stats.incoming - stats.outgoing
      };
    });

    // Build transfers list
    const transfers = deliveredTransfers.map(t => {
      const items = allTransferItems.filter(item => item.transferId === t.id);
      return {
        id: t.id,
        transferNumber: t.transferNumber,
        sourceBranchName: t.sourceBranchId ? branchMap.get(t.sourceBranchId) || 'المستودع الرئيسي' : 'المستودع الرئيسي',
        destinationBranchName: branchMap.get(t.destinationBranchId) || t.destinationBranchId,
        status: t.status,
        deliveryDate: t.deliveryDate,
        hasDiscrepancy: t.hasDiscrepancy,
        itemCount: items.length,
        totalQuantity: items.reduce((sum, item) => sum + (item.receivedQuantity || item.quantity), 0)
      };
    });

    // Summary
    const summary = {
      totalTransfers: deliveredTransfers.length,
      deliveredTransfers: deliveredTransfers.length,
      totalItemsReceived: allTransferItems.reduce((sum, item) => sum + (item.receivedQuantity || item.quantity), 0),
      transfersWithDiscrepancy: deliveredTransfers.filter(t => t.hasDiscrepancy).length
    };

    return { byBranch, byItem, transfers, summary };
  }

  // Item Account Statement - كشف حساب حسب الصنف
  async getItemAccountStatement(
    itemId: number,
    branchId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    item: { id: number; name: string; category: string; unit: string };
    movements: Array<{
      date: string;
      type: string;
      branchName: string;
      transferNumber: string | null;
      quantityIn: number;
      quantityOut: number;
      balance: number;
      notes: string | null;
    }>;
    summary: {
      totalIn: number;
      totalOut: number;
      netChange: number;
      openingBalance: number;
      closingBalance: number;
    };
  }> {
    // Get item info
    const [item] = await db.select().from(warehouseItems).where(eq(warehouseItems.id, itemId));
    if (!item) throw new Error('الصنف غير موجود');

    const allBranches = await db.select().from(branches);
    const branchMap = new Map(allBranches.map(b => [b.id, b.name]));

    // Build conditions for transfers
    const conditions: any[] = [eq(materialTransfers.status, 'delivered')];
    if (startDate) conditions.push(sql`${materialTransfers.deliveryDate} >= ${startDate}`);
    if (endDate) conditions.push(sql`${materialTransfers.deliveryDate} <= ${endDate}`);

    const deliveredTransfers = await db.select().from(materialTransfers).where(and(...conditions));
    
    // Get all transfer items for this item
    const transferIds = deliveredTransfers.map(t => t.id);
    const transferItems = transferIds.length > 0
      ? await db.select().from(materialTransferItems)
          .where(and(
            eq(materialTransferItems.itemId, itemId),
            sql`${materialTransferItems.transferId} IN (${sql.join(transferIds.map(id => sql`${id}`), sql`,`)})`
          ))
      : [];

    // Build movements list
    const movements: Array<{
      date: string;
      type: string;
      branchName: string;
      transferNumber: string | null;
      quantityIn: number;
      quantityOut: number;
      balance: number;
      notes: string | null;
    }> = [];

    let runningBalance = 0;
    let totalIn = 0;
    let totalOut = 0;

    for (const transfer of deliveredTransfers.sort((a, b) => 
      new Date(a.deliveryDate || '').getTime() - new Date(b.deliveryDate || '').getTime()
    )) {
      const items = transferItems.filter(ti => ti.transferId === transfer.id);
      if (items.length === 0) continue;

      for (const ti of items) {
        const qty = ti.receivedQuantity || ti.quantity;
        const isIncoming = !branchId || transfer.destinationBranchId === branchId;
        const isOutgoing = branchId && transfer.sourceBranchId === branchId;

        if (isIncoming) {
          totalIn += qty;
          runningBalance += qty;
          movements.push({
            date: transfer.deliveryDate || '',
            type: 'وارد',
            branchName: branchMap.get(transfer.destinationBranchId) || transfer.destinationBranchId,
            transferNumber: transfer.transferNumber,
            quantityIn: qty,
            quantityOut: 0,
            balance: runningBalance,
            notes: ti.modificationNotes || null
          });
        }

        if (isOutgoing) {
          totalOut += ti.quantity;
          runningBalance -= ti.quantity;
          movements.push({
            date: transfer.deliveryDate || '',
            type: 'صادر',
            branchName: branchMap.get(transfer.sourceBranchId!) || transfer.sourceBranchId!,
            transferNumber: transfer.transferNumber,
            quantityIn: 0,
            quantityOut: ti.quantity,
            balance: runningBalance,
            notes: ti.modificationNotes || null
          });
        }
      }
    }

    return {
      item: { id: item.id, name: item.name, category: item.category, unit: item.unit },
      movements,
      summary: {
        totalIn,
        totalOut,
        netChange: totalIn - totalOut,
        openingBalance: 0,
        closingBalance: runningBalance
      }
    };
  }

  // Top Requested Products by Branch - أكثر المنتجات طلباً حسب الفرع
  async getTopRequestedProducts(
    branchId?: string,
    startDate?: string,
    endDate?: string,
    limit: number = 10
  ): Promise<Array<{
    itemId: number;
    itemName: string;
    category: string;
    unit: string;
    branchId: string;
    branchName: string;
    requestCount: number;
    totalQuantityRequested: number;
  }>> {
    const allBranches = await db.select().from(branches);
    const branchMap = new Map(allBranches.map(b => [b.id, b.name]));
    
    const allItems = await db.select().from(warehouseItems);
    const itemMap = new Map(allItems.map(i => [i.id, { name: i.name, category: i.category, unit: i.unit }]));

    // Build conditions
    const conditions: any[] = [];
    if (branchId) conditions.push(eq(materialTransfers.destinationBranchId, branchId));
    if (startDate) conditions.push(sql`${materialTransfers.createdAt} >= ${startDate}`);
    if (endDate) conditions.push(sql`${materialTransfers.createdAt} <= ${endDate}`);

    const transfers = conditions.length > 0
      ? await db.select().from(materialTransfers).where(and(...conditions))
      : await db.select().from(materialTransfers);

    const transferIds = transfers.map(t => t.id);
    const allTransferItems = transferIds.length > 0
      ? await db.select().from(materialTransferItems)
          .where(sql`${materialTransferItems.transferId} IN (${sql.join(transferIds.map(id => sql`${id}`), sql`,`)})`)
      : [];

    // Aggregate by item and branch
    const stats: Map<string, { itemId: number; branchId: string; count: number; totalQty: number }> = new Map();
    
    for (const transfer of transfers) {
      const items = allTransferItems.filter(ti => ti.transferId === transfer.id);
      for (const item of items) {
        const key = `${item.itemId}-${transfer.destinationBranchId}`;
        if (!stats.has(key)) {
          stats.set(key, { itemId: item.itemId, branchId: transfer.destinationBranchId, count: 0, totalQty: 0 });
        }
        const stat = stats.get(key)!;
        stat.count++;
        stat.totalQty += item.quantity;
      }
    }

    return Array.from(stats.values())
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, limit)
      .map(s => ({
        itemId: s.itemId,
        itemName: itemMap.get(s.itemId)?.name || `صنف ${s.itemId}`,
        category: itemMap.get(s.itemId)?.category || '',
        unit: itemMap.get(s.itemId)?.unit || '',
        branchId: s.branchId,
        branchName: branchMap.get(s.branchId) || s.branchId,
        requestCount: s.count,
        totalQuantityRequested: s.totalQty
      }));
  }

  // Top Received vs Requested Comparison - مقارنة الأعلى استلاماً وطلباً
  async getTopReceivedVsRequested(
    month?: number,
    year?: number,
    branchId?: string
  ): Promise<{
    topReceived: Array<{
      itemId: number;
      itemName: string;
      totalReceived: number;
      unit: string;
    }>;
    topRequested: Array<{
      itemId: number;
      itemName: string;
      totalRequested: number;
      unit: string;
    }>;
    byBranch: Array<{
      branchId: string;
      branchName: string;
      totalReceived: number;
      totalRequested: number;
      efficiency: number;
    }>;
  }> {
    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();
    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const endDate = targetMonth === 12 
      ? `${targetYear + 1}-01-01` 
      : `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`;

    const allBranches = await db.select().from(branches);
    const branchMap = new Map(allBranches.map(b => [b.id, b.name]));
    
    const allItems = await db.select().from(warehouseItems);
    const itemMap = new Map(allItems.map(i => [i.id, { name: i.name, unit: i.unit }]));

    // Get delivered transfers
    const conditions: any[] = [
      eq(materialTransfers.status, 'delivered'),
      sql`${materialTransfers.deliveryDate} >= ${startDate}`,
      sql`${materialTransfers.deliveryDate} < ${endDate}`
    ];
    if (branchId) conditions.push(eq(materialTransfers.destinationBranchId, branchId));

    const deliveredTransfers = await db.select().from(materialTransfers).where(and(...conditions));
    
    // Get all transfers (for requested)
    const requestConditions: any[] = [
      sql`${materialTransfers.createdAt} >= ${startDate}`,
      sql`${materialTransfers.createdAt} < ${endDate}`
    ];
    if (branchId) requestConditions.push(eq(materialTransfers.destinationBranchId, branchId));
    
    const allRequests = await db.select().from(materialTransfers).where(and(...requestConditions));

    const transferIds = Array.from(new Set([...deliveredTransfers.map(t => t.id), ...allRequests.map(t => t.id)]));
    const allTransferItems = transferIds.length > 0
      ? await db.select().from(materialTransferItems)
          .where(sql`${materialTransferItems.transferId} IN (${sql.join(transferIds.map(id => sql`${id}`), sql`,`)})`)
      : [];

    // Calculate received
    const receivedStats: Map<number, number> = new Map();
    for (const transfer of deliveredTransfers) {
      const items = allTransferItems.filter(ti => ti.transferId === transfer.id);
      for (const item of items) {
        const current = receivedStats.get(item.itemId) || 0;
        receivedStats.set(item.itemId, current + (item.receivedQuantity || item.quantity));
      }
    }

    // Calculate requested
    const requestedStats: Map<number, number> = new Map();
    for (const transfer of allRequests) {
      const items = allTransferItems.filter(ti => ti.transferId === transfer.id);
      for (const item of items) {
        const current = requestedStats.get(item.itemId) || 0;
        requestedStats.set(item.itemId, current + item.quantity);
      }
    }

    // Calculate by branch
    const branchStats: Map<string, { received: number; requested: number }> = new Map();
    for (const transfer of allRequests) {
      if (!branchStats.has(transfer.destinationBranchId)) {
        branchStats.set(transfer.destinationBranchId, { received: 0, requested: 0 });
      }
      const items = allTransferItems.filter(ti => ti.transferId === transfer.id);
      const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
      branchStats.get(transfer.destinationBranchId)!.requested += totalQty;
    }
    for (const transfer of deliveredTransfers) {
      if (!branchStats.has(transfer.destinationBranchId)) {
        branchStats.set(transfer.destinationBranchId, { received: 0, requested: 0 });
      }
      const items = allTransferItems.filter(ti => ti.transferId === transfer.id);
      const totalQty = items.reduce((sum, item) => sum + (item.receivedQuantity || item.quantity), 0);
      branchStats.get(transfer.destinationBranchId)!.received += totalQty;
    }

    return {
      topReceived: Array.from(receivedStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([itemId, total]) => ({
          itemId,
          itemName: itemMap.get(itemId)?.name || `صنف ${itemId}`,
          totalReceived: total,
          unit: itemMap.get(itemId)?.unit || ''
        })),
      topRequested: Array.from(requestedStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([itemId, total]) => ({
          itemId,
          itemName: itemMap.get(itemId)?.name || `صنف ${itemId}`,
          totalRequested: total,
          unit: itemMap.get(itemId)?.unit || ''
        })),
      byBranch: Array.from(branchStats.entries()).map(([bId, stats]) => ({
        branchId: bId,
        branchName: branchMap.get(bId) || bId,
        totalReceived: stats.received,
        totalRequested: stats.requested,
        efficiency: stats.requested > 0 ? Math.round((stats.received / stats.requested) * 100) : 0
      }))
    };
  }

  // Branch Performance Analysis - تحليل أداء الفروع
  async getBranchPerformanceReport(
    startDate?: string,
    endDate?: string
  ): Promise<Array<{
    branchId: string;
    branchName: string;
    totalReceived: number;
    totalSent: number;
    netMovement: number;
    transfersReceived: number;
    transfersSent: number;
    discrepancyCount: number;
    discrepancyRate: number;
    avgDeliveryDays: number;
    topReceivedItem: string | null;
    topSentItem: string | null;
  }>> {
    const allBranches = await db.select().from(branches);
    const branchMap = new Map(allBranches.map(b => [b.id, b.name]));
    
    const allItems = await db.select().from(warehouseItems);
    const itemMap = new Map(allItems.map(i => [i.id, i.name]));

    // Build conditions
    const conditions: any[] = [eq(materialTransfers.status, 'delivered')];
    if (startDate) conditions.push(sql`${materialTransfers.deliveryDate} >= ${startDate}`);
    if (endDate) conditions.push(sql`${materialTransfers.deliveryDate} <= ${endDate}`);

    const deliveredTransfers = await db.select().from(materialTransfers).where(and(...conditions));
    
    const transferIds = deliveredTransfers.map(t => t.id);
    const allTransferItems = transferIds.length > 0
      ? await db.select().from(materialTransferItems)
          .where(sql`${materialTransferItems.transferId} IN (${sql.join(transferIds.map(id => sql`${id}`), sql`,`)})`)
      : [];

    // Calculate stats per branch
    const branchStats: Map<string, {
      received: number;
      sent: number;
      transfersReceived: number;
      transfersSent: number;
      discrepancies: number;
      deliveryDays: number[];
      itemsReceived: Map<number, number>;
      itemsSent: Map<number, number>;
    }> = new Map();

    for (const transfer of deliveredTransfers) {
      const destBranch = transfer.destinationBranchId;
      const srcBranch = transfer.sourceBranchId;
      const items = allTransferItems.filter(ti => ti.transferId === transfer.id);
      
      // Calculate delivery days
      let deliveryDays = 0;
      if (transfer.deliveryDate && transfer.createdAt) {
        const created = new Date(transfer.createdAt);
        const delivered = new Date(transfer.deliveryDate);
        deliveryDays = Math.ceil((delivered.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Destination stats
      if (!branchStats.has(destBranch)) {
        branchStats.set(destBranch, {
          received: 0, sent: 0, transfersReceived: 0, transfersSent: 0,
          discrepancies: 0, deliveryDays: [], itemsReceived: new Map(), itemsSent: new Map()
        });
      }
      const destStats = branchStats.get(destBranch)!;
      destStats.transfersReceived++;
      destStats.deliveryDays.push(deliveryDays);
      if (transfer.hasDiscrepancy) destStats.discrepancies++;
      
      for (const item of items) {
        const qty = item.receivedQuantity || item.quantity;
        destStats.received += qty;
        const current = destStats.itemsReceived.get(item.itemId) || 0;
        destStats.itemsReceived.set(item.itemId, current + qty);
      }

      // Source stats (for branch-to-branch)
      if (srcBranch && srcBranch !== 'main_warehouse') {
        if (!branchStats.has(srcBranch)) {
          branchStats.set(srcBranch, {
            received: 0, sent: 0, transfersReceived: 0, transfersSent: 0,
            discrepancies: 0, deliveryDays: [], itemsReceived: new Map(), itemsSent: new Map()
          });
        }
        const srcStats = branchStats.get(srcBranch)!;
        srcStats.transfersSent++;
        
        for (const item of items) {
          srcStats.sent += item.quantity;
          const current = srcStats.itemsSent.get(item.itemId) || 0;
          srcStats.itemsSent.set(item.itemId, current + item.quantity);
        }
      }
    }

    return Array.from(branchStats.entries()).map(([bId, stats]) => {
      // Find top received item
      let topReceivedItem: string | null = null;
      let maxReceived = 0;
      stats.itemsReceived.forEach((qty, itemId) => {
        if (qty > maxReceived) {
          maxReceived = qty;
          topReceivedItem = itemMap.get(itemId) || null;
        }
      });

      // Find top sent item
      let topSentItem: string | null = null;
      let maxSent = 0;
      stats.itemsSent.forEach((qty, itemId) => {
        if (qty > maxSent) {
          maxSent = qty;
          topSentItem = itemMap.get(itemId) || null;
        }
      });

      const avgDeliveryDays = stats.deliveryDays.length > 0
        ? Math.round(stats.deliveryDays.reduce((a, b) => a + b, 0) / stats.deliveryDays.length)
        : 0;

      return {
        branchId: bId,
        branchName: branchMap.get(bId) || bId,
        totalReceived: stats.received,
        totalSent: stats.sent,
        netMovement: stats.received - stats.sent,
        transfersReceived: stats.transfersReceived,
        transfersSent: stats.transfersSent,
        discrepancyCount: stats.discrepancies,
        discrepancyRate: stats.transfersReceived > 0 
          ? Math.round((stats.discrepancies / stats.transfersReceived) * 100) 
          : 0,
        avgDeliveryDays,
        topReceivedItem,
        topSentItem
      };
    }).sort((a, b) => b.totalReceived - a.totalReceived);
  }

  // Warehouse Dashboard Stats
  async getWarehouseDashboardStats(branchId?: string): Promise<{
    pendingRequests: number;
    approvedRequests: number;
    inTransitTransfers: number;
    lowStockItems: number;
  }> {
    const pendingResult = await db.select({ count: sql<number>`count(*)` })
      .from(materialTransfers)
      .where(branchId 
        ? and(eq(materialTransfers.status, 'pending'), eq(materialTransfers.destinationBranchId, branchId))
        : eq(materialTransfers.status, 'pending')
      );
    
    const approvedResult = await db.select({ count: sql<number>`count(*)` })
      .from(materialTransfers)
      .where(branchId 
        ? and(eq(materialTransfers.status, 'approved'), eq(materialTransfers.destinationBranchId, branchId))
        : eq(materialTransfers.status, 'approved')
      );
    
    const inTransitResult = await db.select({ count: sql<number>`count(*)` })
      .from(materialTransfers)
      .where(branchId 
        ? and(eq(materialTransfers.status, 'in_transit'), eq(materialTransfers.destinationBranchId, branchId))
        : eq(materialTransfers.status, 'in_transit')
      );
    
    const lowStockResult = await db.select({ count: sql<number>`count(*)` })
      .from(warehouseItems)
      .where(and(
        eq(warehouseItems.isActive, true),
        sql`${warehouseItems.currentStock} <= ${warehouseItems.reorderPoint}`
      ));
    
    return {
      pendingRequests: Number(pendingResult[0]?.count || 0),
      approvedRequests: Number(approvedResult[0]?.count || 0),
      inTransitTransfers: Number(inTransitResult[0]?.count || 0),
      lowStockItems: Number(lowStockResult[0]?.count || 0),
    };
  }

  // Purchasing Requests
  async getPurchasingRequests(filters?: { branchId?: string; status?: string }): Promise<PurchasingRequest[]> {
    const conditions = [];
    if (filters?.branchId) conditions.push(eq(purchasingRequests.branchId, filters.branchId));
    if (filters?.status) conditions.push(eq(purchasingRequests.status, filters.status));
    
    if (conditions.length > 0) {
      return await db.select().from(purchasingRequests).where(and(...conditions)).orderBy(desc(purchasingRequests.createdAt));
    }
    return await db.select().from(purchasingRequests).orderBy(desc(purchasingRequests.createdAt));
  }

  async getPurchasingRequest(id: number): Promise<PurchasingRequest | undefined> {
    const [request] = await db.select().from(purchasingRequests).where(eq(purchasingRequests.id, id));
    return request || undefined;
  }

  async getPurchasingRequestWithItems(id: number): Promise<{ request: PurchasingRequest; items: PurchasingRequestItem[] } | undefined> {
    const [request] = await db.select().from(purchasingRequests).where(eq(purchasingRequests.id, id));
    if (!request) return undefined;
    
    const items = await db.select().from(purchasingRequestItems).where(eq(purchasingRequestItems.purchasingRequestId, id));
    return { request, items };
  }

  async createPurchasingRequest(request: InsertPurchasingRequest, items: Omit<InsertPurchasingRequestItem, 'purchasingRequestId'>[]): Promise<PurchasingRequest> {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(purchasingRequests).values(request).returning();
      
      if (items.length > 0) {
        await tx.insert(purchasingRequestItems).values(
          items.map(item => ({ ...item, purchasingRequestId: created.id }))
        );
      }
      
      return created;
    });
  }

  async updatePurchasingRequestStatus(id: number, status: string, additionalData?: Partial<InsertPurchasingRequest>): Promise<PurchasingRequest | undefined> {
    const [updated] = await db.update(purchasingRequests)
      .set({ 
        status,
        ...additionalData,
        updatedAt: new Date() 
      })
      .where(eq(purchasingRequests.id, id))
      .returning();
    return updated || undefined;
  }

  async generatePurchasingRequestNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = `PR-${year}${month}`;
    
    const existing = await db.select()
      .from(purchasingRequests)
      .where(sql`${purchasingRequests.requestNumber} LIKE ${prefix + '%'}`)
      .orderBy(desc(purchasingRequests.requestNumber));
    
    let nextNum = 1;
    if (existing.length > 0) {
      const lastNum = existing[0].requestNumber.split('-').pop();
      nextNum = parseInt(lastNum || '0') + 1;
    }
    
    return `${prefix}-${String(nextNum).padStart(4, '0')}`;
  }

  // ==================== Warehouse Notifications ====================
  
  async getWarehouseNotifications(filters?: { 
    branchId?: string; 
    userId?: string; 
    isRead?: boolean;
    limit?: number;
  }): Promise<WarehouseNotification[]> {
    let query = db.select().from(warehouseNotifications);
    const conditions = [];
    
    if (filters?.branchId) {
      conditions.push(
        or(
          eq(warehouseNotifications.branchId, filters.branchId),
          eq(warehouseNotifications.targetBranchId, filters.branchId)
        )
      );
    }
    if (filters?.userId) {
      conditions.push(
        or(
          eq(warehouseNotifications.userId, filters.userId),
          isNull(warehouseNotifications.userId)
        )
      );
    }
    if (filters?.isRead !== undefined) {
      conditions.push(eq(warehouseNotifications.isRead, filters.isRead));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    const result = await query.orderBy(desc(warehouseNotifications.createdAt)).limit(filters?.limit || 50);
    return result;
  }

  async getUnreadNotificationCount(branchId?: string, userId?: string): Promise<number> {
    const conditions = [eq(warehouseNotifications.isRead, false)];
    
    if (branchId) {
      conditions.push(
        or(
          eq(warehouseNotifications.branchId, branchId),
          eq(warehouseNotifications.targetBranchId, branchId)
        ) as any
      );
    }
    if (userId) {
      conditions.push(
        or(
          eq(warehouseNotifications.userId, userId),
          isNull(warehouseNotifications.userId)
        ) as any
      );
    }
    
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(warehouseNotifications)
      .where(and(...conditions));
    
    return Number(result[0]?.count || 0);
  }

  async createWarehouseNotification(data: InsertWarehouseNotification): Promise<WarehouseNotification> {
    const [notification] = await db.insert(warehouseNotifications).values(data).returning();
    return notification;
  }

  async markNotificationAsRead(id: number, userId?: string): Promise<WarehouseNotification | undefined> {
    const [updated] = await db.update(warehouseNotifications)
      .set({ 
        isRead: true, 
        readAt: new Date(),
        readBy: userId
      })
      .where(eq(warehouseNotifications.id, id))
      .returning();
    return updated || undefined;
  }

  async markAllNotificationsAsRead(branchId?: string, userId?: string): Promise<void> {
    const conditions = [eq(warehouseNotifications.isRead, false)];
    
    if (branchId) {
      conditions.push(
        or(
          eq(warehouseNotifications.branchId, branchId),
          eq(warehouseNotifications.targetBranchId, branchId)
        ) as any
      );
    }
    if (userId) {
      conditions.push(
        or(
          eq(warehouseNotifications.userId, userId),
          isNull(warehouseNotifications.userId)
        ) as any
      );
    }
    
    await db.update(warehouseNotifications)
      .set({ isRead: true, readAt: new Date(), readBy: userId })
      .where(and(...conditions));
  }

  async deleteWarehouseNotification(id: number): Promise<void> {
    await db.delete(warehouseNotifications).where(eq(warehouseNotifications.id, id));
  }

  // ==========================================
  // Executive Secretariat - السكرتارية التنفيذية
  // ==========================================

  // Executive Meetings - الاجتماعات
  async getExecMeetings(filters?: {
    branchId?: string;
    status?: string;
    organizerId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<ExecMeeting[]> {
    let query = db.select().from(execMeetings);
    const conditions: any[] = [];

    if (filters?.branchId) {
      conditions.push(eq(execMeetings.branchId, filters.branchId));
    }
    if (filters?.status) {
      conditions.push(eq(execMeetings.status, filters.status));
    }
    if (filters?.organizerId) {
      conditions.push(eq(execMeetings.organizerId, filters.organizerId));
    }
    if (filters?.startDate) {
      conditions.push(gte(execMeetings.startAt, new Date(filters.startDate)));
    }
    if (filters?.endDate) {
      conditions.push(lte(execMeetings.startAt, new Date(filters.endDate)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    return await query.orderBy(desc(execMeetings.startAt)).limit(filters?.limit || 100);
  }

  async getExecMeeting(id: number): Promise<ExecMeeting | undefined> {
    const [meeting] = await db.select().from(execMeetings).where(eq(execMeetings.id, id));
    return meeting || undefined;
  }

  async createExecMeeting(data: InsertExecMeeting): Promise<ExecMeeting> {
    const [meeting] = await db.insert(execMeetings).values(data).returning();
    this.invalidateExecDashboardCache(); // Invalidate dashboard cache
    return meeting;
  }

  async updateExecMeeting(id: number, data: Partial<InsertExecMeeting>): Promise<ExecMeeting | undefined> {
    const [updated] = await db.update(execMeetings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(execMeetings.id, id))
      .returning();
    this.invalidateExecDashboardCache(); // Invalidate dashboard cache
    return updated || undefined;
  }

  async deleteExecMeeting(id: number): Promise<boolean> {
    const result = await db.delete(execMeetings).where(eq(execMeetings.id, id));
    this.invalidateExecDashboardCache(); // Invalidate dashboard cache
    return true;
  }

  // Meeting Attendees - حضور الاجتماعات
  async getExecMeetingAttendees(meetingId: number): Promise<ExecMeetingAttendee[]> {
    return await db.select().from(execMeetingAttendees)
      .where(eq(execMeetingAttendees.meetingId, meetingId));
  }

  async addExecMeetingAttendee(data: InsertExecMeetingAttendee): Promise<ExecMeetingAttendee> {
    const [attendee] = await db.insert(execMeetingAttendees).values(data).returning();
    return attendee;
  }

  async updateExecMeetingAttendee(id: number, data: Partial<InsertExecMeetingAttendee>): Promise<ExecMeetingAttendee | undefined> {
    const [updated] = await db.update(execMeetingAttendees)
      .set(data)
      .where(eq(execMeetingAttendees.id, id))
      .returning();
    return updated || undefined;
  }

  async removeExecMeetingAttendee(id: number): Promise<boolean> {
    await db.delete(execMeetingAttendees).where(eq(execMeetingAttendees.id, id));
    return true;
  }

  // Executive Tasks - المهام التنفيذية
  async getExecTasks(filters?: {
    branchId?: string;
    status?: string;
    priority?: string;
    assignedTo?: string;
    createdBy?: string;
    relatedType?: string;
    relatedId?: number;
    dueDateFrom?: string;
    dueDateTo?: string;
    limit?: number;
  }): Promise<ExecTask[]> {
    let query = db.select().from(execTasks);
    const conditions: any[] = [];

    if (filters?.branchId) {
      conditions.push(eq(execTasks.branchId, filters.branchId));
    }
    if (filters?.status) {
      conditions.push(eq(execTasks.status, filters.status));
    }
    if (filters?.priority) {
      conditions.push(eq(execTasks.priority, filters.priority));
    }
    if (filters?.assignedTo) {
      conditions.push(eq(execTasks.assignedTo, filters.assignedTo));
    }
    if (filters?.createdBy) {
      conditions.push(eq(execTasks.createdBy, filters.createdBy));
    }
    if (filters?.relatedType) {
      conditions.push(eq(execTasks.relatedType, filters.relatedType));
    }
    if (filters?.relatedId) {
      conditions.push(eq(execTasks.relatedId, filters.relatedId));
    }
    if (filters?.dueDateFrom) {
      conditions.push(gte(execTasks.dueDate, new Date(filters.dueDateFrom)));
    }
    if (filters?.dueDateTo) {
      conditions.push(lte(execTasks.dueDate, new Date(filters.dueDateTo)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    return await query.orderBy(desc(execTasks.createdAt)).limit(filters?.limit || 100);
  }

  async getExecTask(id: number): Promise<ExecTask | undefined> {
    const [task] = await db.select().from(execTasks).where(eq(execTasks.id, id));
    return task || undefined;
  }

  async createExecTask(data: InsertExecTask): Promise<ExecTask> {
    const [task] = await db.insert(execTasks).values(data).returning();
    this.invalidateExecDashboardCache(); // Invalidate dashboard cache
    return task;
  }

  async updateExecTask(id: number, data: Partial<InsertExecTask>): Promise<ExecTask | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    
    // If status is being set to 'completed', set completedAt
    if (data.status === 'completed' && !data.completedAt) {
      updateData.completedAt = new Date();
    }
    this.invalidateExecDashboardCache(); // Invalidate dashboard cache
    
    const [updated] = await db.update(execTasks)
      .set(updateData)
      .where(eq(execTasks.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteExecTask(id: number): Promise<boolean> {
    await db.delete(execTasks).where(eq(execTasks.id, id));
    this.invalidateExecDashboardCache(); // Invalidate dashboard cache
    return true;
  }

  // Task Comments - تعليقات المهام
  async getExecTaskComments(taskId: number): Promise<ExecTaskComment[]> {
    return await db.select().from(execTaskComments)
      .where(eq(execTaskComments.taskId, taskId))
      .orderBy(desc(execTaskComments.createdAt));
  }

  async addExecTaskComment(data: InsertExecTaskComment): Promise<ExecTaskComment> {
    const [comment] = await db.insert(execTaskComments).values(data).returning();
    return comment;
  }

  async deleteExecTaskComment(id: number): Promise<boolean> {
    await db.delete(execTaskComments).where(eq(execTaskComments.id, id));
    return true;
  }

  // Executive Correspondence - المراسلات
  async getExecCorrespondence(filters?: {
    branchId?: string;
    type?: string;
    status?: string;
    category?: string;
    ownerId?: string;
    assignedTo?: string;
    isConfidential?: boolean;
    startDate?: string;
    endDate?: string;
    search?: string;
    limit?: number;
  }): Promise<ExecCorrespondence[]> {
    let query = db.select().from(execCorrespondence);
    const conditions: any[] = [];

    if (filters?.branchId) {
      conditions.push(eq(execCorrespondence.branchId, filters.branchId));
    }
    if (filters?.type) {
      conditions.push(eq(execCorrespondence.type, filters.type));
    }
    if (filters?.status) {
      conditions.push(eq(execCorrespondence.status, filters.status));
    }
    if (filters?.category) {
      conditions.push(eq(execCorrespondence.category, filters.category));
    }
    if (filters?.ownerId) {
      conditions.push(eq(execCorrespondence.ownerId, filters.ownerId));
    }
    if (filters?.assignedTo) {
      conditions.push(eq(execCorrespondence.assignedTo, filters.assignedTo));
    }
    if (filters?.isConfidential !== undefined) {
      conditions.push(eq(execCorrespondence.isConfidential, filters.isConfidential));
    }
    if (filters?.startDate) {
      conditions.push(gte(execCorrespondence.createdAt, new Date(filters.startDate)));
    }
    if (filters?.endDate) {
      conditions.push(lte(execCorrespondence.createdAt, new Date(filters.endDate)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    return await query.orderBy(desc(execCorrespondence.createdAt)).limit(filters?.limit || 100);
  }

  async getExecCorrespondenceById(id: number): Promise<ExecCorrespondence | undefined> {
    const [corr] = await db.select().from(execCorrespondence).where(eq(execCorrespondence.id, id));
    return corr || undefined;
  }

  async getExecCorrespondenceByRef(refNumber: string): Promise<ExecCorrespondence | undefined> {
    const [corr] = await db.select().from(execCorrespondence).where(eq(execCorrespondence.refNumber, refNumber));
    return corr || undefined;
  }

  async createExecCorrespondence(data: InsertExecCorrespondence): Promise<ExecCorrespondence> {
    const [corr] = await db.insert(execCorrespondence).values(data).returning();
    this.invalidateExecDashboardCache(); // Invalidate dashboard cache
    return corr;
  }

  async updateExecCorrespondence(id: number, data: Partial<InsertExecCorrespondence>): Promise<ExecCorrespondence | undefined> {
    const [updated] = await db.update(execCorrespondence)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(execCorrespondence.id, id))
      .returning();
    this.invalidateExecDashboardCache(); // Invalidate dashboard cache
    return updated || undefined;
  }

  async deleteExecCorrespondence(id: number): Promise<boolean> {
    await db.delete(execCorrespondence).where(eq(execCorrespondence.id, id));
    this.invalidateExecDashboardCache(); // Invalidate dashboard cache
    return true;
  }

  async generateCorrespondenceRefNumber(type: string, branchId?: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = type === 'incoming' ? 'IN' : 'OUT';
    
    // Count existing correspondence for this month
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(execCorrespondence)
      .where(sql`ref_number LIKE ${`BTR-${prefix}-${year}${month}%`}`);
    
    const sequence = String((countResult?.count || 0) + 1).padStart(4, '0');
    return `BTR-${prefix}-${year}${month}-${sequence}`;
  }

  // Executive Notifications - تنبيهات السكرتارية
  async getExecNotifications(filters?: {
    userId?: string;
    branchId?: string;
    type?: string;
    isRead?: boolean;
    limit?: number;
  }): Promise<ExecNotification[]> {
    let query = db.select().from(execNotifications);
    const conditions: any[] = [];

    if (filters?.userId) {
      conditions.push(eq(execNotifications.userId, filters.userId));
    }
    if (filters?.branchId) {
      conditions.push(eq(execNotifications.branchId, filters.branchId));
    }
    if (filters?.type) {
      conditions.push(eq(execNotifications.type, filters.type));
    }
    if (filters?.isRead !== undefined) {
      conditions.push(eq(execNotifications.isRead, filters.isRead));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    return await query.orderBy(desc(execNotifications.createdAt)).limit(filters?.limit || 50);
  }

  async createExecNotification(data: InsertExecNotification): Promise<ExecNotification> {
    const [notification] = await db.insert(execNotifications).values(data).returning();
    return notification;
  }

  async markExecNotificationAsRead(id: number): Promise<ExecNotification | undefined> {
    const [updated] = await db.update(execNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(execNotifications.id, id))
      .returning();
    return updated || undefined;
  }

  async getExecUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(execNotifications)
      .where(and(
        eq(execNotifications.userId, userId),
        eq(execNotifications.isRead, false)
      ));
    return Number(result?.count || 0);
  }

  // Executive Dashboard Stats Cache
  private execDashboardCache = new Map<string, { data: any, timestamp: number }>();
  private EXEC_DASHBOARD_CACHE_TTL = 30000; // 30 seconds

  invalidateExecDashboardCache() {
    this.execDashboardCache.clear();
  }

  // Executive Dashboard Stats - إحصائيات لوحة التحكم (Optimized with parallel queries)
  async getExecDashboardStats(branchId?: string): Promise<{
    meetingsThisWeek: number;
    pendingTasks: number;
    overdueTasks: number;
    unreadCorrespondence: number;
    upcomingMeetings: ExecMeeting[];
    urgentTasks: ExecTask[];
    recentCorrespondence: ExecCorrespondence[];
  }> {
    const cacheKey = branchId || 'all';
    const now = Date.now();
    const cached = this.execDashboardCache.get(cacheKey);
    
    if (cached && (now - cached.timestamp) < this.EXEC_DASHBOARD_CACHE_TTL) {
      return cached.data;
    }

    const currentDate = new Date();
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const branchCondition = branchId ? eq(execMeetings.branchId, branchId) : sql`true`;
    const taskBranchCondition = branchId ? eq(execTasks.branchId, branchId) : sql`true`;
    const corrBranchCondition = branchId ? eq(execCorrespondence.branchId, branchId) : sql`true`;

    // Execute all queries in parallel for better performance
    const [
      meetingsCountResult,
      pendingCountResult,
      overdueCountResult,
      unreadCountResult,
      upcomingMeetings,
      urgentTasks,
      recentCorrespondence
    ] = await Promise.all([
      // Meetings this week
      db.select({ count: sql<number>`count(*)` })
        .from(execMeetings)
        .where(and(
          branchCondition,
          gte(execMeetings.startAt, startOfWeek),
          lte(execMeetings.startAt, endOfWeek)
        )),
      // Pending tasks
      db.select({ count: sql<number>`count(*)` })
        .from(execTasks)
        .where(and(
          taskBranchCondition,
          eq(execTasks.status, 'pending')
        )),
      // Overdue tasks
      db.select({ count: sql<number>`count(*)` })
        .from(execTasks)
        .where(and(
          taskBranchCondition,
          sql`status NOT IN ('completed', 'cancelled')`,
          lte(execTasks.dueDate, currentDate)
        )),
      // Unread correspondence
      db.select({ count: sql<number>`count(*)` })
        .from(execCorrespondence)
        .where(and(
          corrBranchCondition,
          eq(execCorrespondence.status, 'received')
        )),
      // Upcoming meetings (next 7 days)
      db.select().from(execMeetings)
        .where(and(
          branchCondition,
          gte(execMeetings.startAt, currentDate),
          lte(execMeetings.startAt, endOfWeek),
          eq(execMeetings.status, 'scheduled')
        ))
        .orderBy(execMeetings.startAt)
        .limit(5),
      // Urgent tasks
      db.select().from(execTasks)
        .where(and(
          taskBranchCondition,
          eq(execTasks.priority, 'urgent'),
          sql`status NOT IN ('completed', 'cancelled')`
        ))
        .orderBy(execTasks.dueDate)
        .limit(5),
      // Recent correspondence
      db.select().from(execCorrespondence)
        .where(corrBranchCondition)
        .orderBy(desc(execCorrespondence.createdAt))
        .limit(5)
    ]);

    const result = {
      meetingsThisWeek: Number(meetingsCountResult[0]?.count || 0),
      pendingTasks: Number(pendingCountResult[0]?.count || 0),
      overdueTasks: Number(overdueCountResult[0]?.count || 0),
      unreadCorrespondence: Number(unreadCountResult[0]?.count || 0),
      upcomingMeetings,
      urgentTasks,
      recentCorrespondence,
    };

    this.execDashboardCache.set(cacheKey, { data: result, timestamp: now });
    return result;
  }

  // ========== Document Management - إدارة الوثائق ==========

  // Document Categories
  async getDocumentCategories(filters?: { branchId?: string; isActive?: boolean }): Promise<DocumentCategory[]> {
    const conditions: any[] = [];
    if (filters?.branchId) conditions.push(eq(documentCategories.branchId, filters.branchId));
    if (filters?.isActive !== undefined) conditions.push(eq(documentCategories.isActive, filters.isActive));

    return db.select().from(documentCategories)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(documentCategories.sortOrder, documentCategories.name);
  }

  async getDocumentCategory(id: number): Promise<DocumentCategory | undefined> {
    const [category] = await db.select().from(documentCategories).where(eq(documentCategories.id, id));
    return category;
  }

  async createDocumentCategory(data: InsertDocumentCategory): Promise<DocumentCategory> {
    const [category] = await db.insert(documentCategories).values(data).returning();
    return category;
  }

  async updateDocumentCategory(id: number, data: Partial<InsertDocumentCategory>): Promise<DocumentCategory | undefined> {
    const [category] = await db.update(documentCategories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documentCategories.id, id))
      .returning();
    return category;
  }

  async deleteDocumentCategory(id: number): Promise<void> {
    await db.delete(documentCategories).where(eq(documentCategories.id, id));
  }

  // Document Folders
  async getDocumentFolders(filters?: { branchId?: string; parentId?: number | null; categoryId?: number }): Promise<DocumentFolder[]> {
    const conditions: any[] = [];
    if (filters?.branchId) conditions.push(eq(documentFolders.branchId, filters.branchId));
    if (filters?.parentId !== undefined) {
      if (filters.parentId === null) {
        conditions.push(isNull(documentFolders.parentId));
      } else {
        conditions.push(eq(documentFolders.parentId, filters.parentId));
      }
    }
    if (filters?.categoryId) conditions.push(eq(documentFolders.categoryId, filters.categoryId));

    return db.select().from(documentFolders)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(documentFolders.sortOrder, documentFolders.name);
  }

  async getDocumentFolder(id: number): Promise<DocumentFolder | undefined> {
    const [folder] = await db.select().from(documentFolders).where(eq(documentFolders.id, id));
    return folder;
  }

  async createDocumentFolder(data: InsertDocumentFolder): Promise<DocumentFolder> {
    let path = "/";
    if (data.parentId) {
      const parent = await this.getDocumentFolder(data.parentId);
      if (parent) {
        path = `${parent.path}${parent.id}/`;
      }
    }
    const [folder] = await db.insert(documentFolders).values({ ...data, path }).returning();
    return folder;
  }

  async updateDocumentFolder(id: number, data: Partial<InsertDocumentFolder>): Promise<DocumentFolder | undefined> {
    const [folder] = await db.update(documentFolders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documentFolders.id, id))
      .returning();
    return folder;
  }

  async deleteDocumentFolder(id: number): Promise<void> {
    await db.delete(documentFolders).where(eq(documentFolders.id, id));
  }

  // Documents
  async getDocuments(filters?: {
    branchId?: string;
    folderId?: number | null;
    categoryId?: number;
    status?: string;
    accessLevel?: string;
    fileType?: string;
    ownerId?: string;
    relatedType?: string;
    relatedId?: number;
    searchTerm?: string;
    isTemplate?: boolean;
    limit?: number;
  }): Promise<Document[]> {
    const conditions: any[] = [];
    if (filters?.branchId) conditions.push(eq(documents.branchId, filters.branchId));
    if (filters?.folderId !== undefined) {
      if (filters.folderId === null) {
        conditions.push(isNull(documents.folderId));
      } else {
        conditions.push(eq(documents.folderId, filters.folderId));
      }
    }
    if (filters?.categoryId) conditions.push(eq(documents.categoryId, filters.categoryId));
    if (filters?.status) conditions.push(eq(documents.status, filters.status));
    if (filters?.accessLevel) conditions.push(eq(documents.accessLevel, filters.accessLevel));
    if (filters?.fileType) conditions.push(eq(documents.fileType, filters.fileType));
    if (filters?.ownerId) conditions.push(eq(documents.ownerId, filters.ownerId));
    if (filters?.relatedType) conditions.push(eq(documents.relatedType, filters.relatedType));
    if (filters?.relatedId) conditions.push(eq(documents.relatedId, filters.relatedId));
    if (filters?.isTemplate !== undefined) conditions.push(eq(documents.isTemplate, filters.isTemplate));
    if (filters?.searchTerm) {
      conditions.push(or(
        ilike(documents.title, `%${filters.searchTerm}%`),
        ilike(documents.fileName, `%${filters.searchTerm}%`),
        ilike(documents.documentNumber, `%${filters.searchTerm}%`)
      ));
    }

    let query = db.select().from(documents)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(documents.createdAt));

    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }

    return query;
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async createDocument(data: InsertDocument): Promise<Document> {
    const [doc] = await db.insert(documents).values(data).returning();
    return doc;
  }

  async updateDocument(id: number, data: Partial<InsertDocument>): Promise<Document | undefined> {
    const [doc] = await db.update(documents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return doc;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.update(documents)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(eq(documents.id, id));
  }

  async archiveDocument(id: number, userId: string): Promise<Document | undefined> {
    const [doc] = await db.update(documents)
      .set({ 
        status: 'archived', 
        archivedAt: new Date(),
        archivedBy: userId,
        updatedAt: new Date() 
      })
      .where(eq(documents.id, id))
      .returning();
    return doc;
  }

  async restoreDocument(id: number): Promise<Document | undefined> {
    const [doc] = await db.update(documents)
      .set({ 
        status: 'active', 
        archivedAt: null,
        archivedBy: null,
        updatedAt: new Date() 
      })
      .where(eq(documents.id, id))
      .returning();
    return doc;
  }

  async incrementDocumentViewCount(id: number, userId?: string): Promise<void> {
    await db.update(documents)
      .set({ 
        viewCount: sql`${documents.viewCount} + 1`,
        lastAccessedAt: new Date(),
        lastAccessedBy: userId || null
      })
      .where(eq(documents.id, id));
  }

  async incrementDocumentDownloadCount(id: number, userId?: string): Promise<void> {
    await db.update(documents)
      .set({ 
        downloadCount: sql`${documents.downloadCount} + 1`,
        lastAccessedAt: new Date(),
        lastAccessedBy: userId || null
      })
      .where(eq(documents.id, id));
  }

  // Document Versions
  async getDocumentVersions(documentId: number): Promise<DocumentVersion[]> {
    return db.select().from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(desc(documentVersions.versionNumber));
  }

  async getDocumentVersion(id: number): Promise<DocumentVersion | undefined> {
    const [version] = await db.select().from(documentVersions).where(eq(documentVersions.id, id));
    return version;
  }

  async createDocumentVersion(data: InsertDocumentVersion): Promise<DocumentVersion> {
    const [version] = await db.insert(documentVersions).values(data).returning();
    await db.update(documents)
      .set({ currentVersion: data.versionNumber, updatedAt: new Date() })
      .where(eq(documents.id, data.documentId));
    return version;
  }

  // Document Shares
  async getDocumentShares(filters?: { documentId?: number; folderId?: number; sharedWithUserId?: string }): Promise<DocumentShare[]> {
    const conditions: any[] = [];
    if (filters?.documentId) conditions.push(eq(documentShares.documentId, filters.documentId));
    if (filters?.folderId) conditions.push(eq(documentShares.folderId, filters.folderId));
    if (filters?.sharedWithUserId) conditions.push(eq(documentShares.sharedWithUserId, filters.sharedWithUserId));

    return db.select().from(documentShares)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(documentShares.createdAt));
  }

  async createDocumentShare(data: InsertDocumentShare): Promise<DocumentShare> {
    const [share] = await db.insert(documentShares).values(data).returning();
    return share;
  }

  async updateDocumentShare(id: number, data: Partial<InsertDocumentShare>): Promise<DocumentShare | undefined> {
    const [share] = await db.update(documentShares)
      .set(data)
      .where(eq(documentShares.id, id))
      .returning();
    return share;
  }

  async deleteDocumentShare(id: number): Promise<void> {
    await db.delete(documentShares).where(eq(documentShares.id, id));
  }

  async getDocumentShareByLink(shareLink: string): Promise<DocumentShare | undefined> {
    const [share] = await db.select().from(documentShares)
      .where(and(
        eq(documentShares.shareLink, shareLink),
        eq(documentShares.isActive, true)
      ));
    return share;
  }

  async incrementShareAccessCount(shareId: number): Promise<void> {
    await db.update(documentShares)
      .set({ accessCount: sql`${documentShares.accessCount} + 1` })
      .where(eq(documentShares.id, shareId));
  }

  // Document Access Logs
  async logDocumentAccess(data: { documentId: number; userId?: string; userName?: string; action: string; actionDetails?: string; ipAddress?: string; userAgent?: string; versionNumber?: number }): Promise<void> {
    await db.insert(documentAccessLogs).values(data);
  }

  async getDocumentAccessLogs(documentId: number, limit = 50): Promise<any[]> {
    return db.select().from(documentAccessLogs)
      .where(eq(documentAccessLogs.documentId, documentId))
      .orderBy(desc(documentAccessLogs.accessedAt))
      .limit(limit);
  }

  // Document Stats
  async getDocumentStats(branchId?: string): Promise<{
    totalDocuments: number;
    activeDocuments: number;
    archivedDocuments: number;
    totalFolders: number;
    totalCategories: number;
    recentDocuments: Document[];
  }> {
    const branchCondition = branchId ? eq(documents.branchId, branchId) : undefined;
    const folderBranchCondition = branchId ? eq(documentFolders.branchId, branchId) : undefined;
    const categoryBranchCondition = branchId ? eq(documentCategories.branchId, branchId) : undefined;

    const [totalCount] = await db.select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(and(branchCondition, sql`${documents.status} != 'deleted'`));

    const [activeCount] = await db.select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(and(branchCondition, eq(documents.status, 'active')));

    const [archivedCount] = await db.select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(and(branchCondition, eq(documents.status, 'archived')));

    const [folderCount] = await db.select({ count: sql<number>`count(*)` })
      .from(documentFolders)
      .where(folderBranchCondition);

    const [categoryCount] = await db.select({ count: sql<number>`count(*)` })
      .from(documentCategories)
      .where(categoryBranchCondition);

    const recentDocuments = await db.select().from(documents)
      .where(and(branchCondition, eq(documents.status, 'active')))
      .orderBy(desc(documents.createdAt))
      .limit(5);

    return {
      totalDocuments: Number(totalCount?.count || 0),
      activeDocuments: Number(activeCount?.count || 0),
      archivedDocuments: Number(archivedCount?.count || 0),
      totalFolders: Number(folderCount?.count || 0),
      totalCategories: Number(categoryCount?.count || 0),
      recentDocuments,
    };
  }

  // =====================================================
  // سجل الزوار - Visitor Management
  // =====================================================

  // Visitors Cache
  private visitorsCache = new Map<string, { data: Visitor[], timestamp: number }>();
  private VISITORS_CACHE_TTL = 20000; // 20 seconds

  // Visitors CRUD (Optimized with caching and limit)
  async getVisitors(branchId?: string, limit: number = 100): Promise<Visitor[]> {
    const cacheKey = `${branchId || 'all'}-${limit}`;
    const now = Date.now();
    const cached = this.visitorsCache.get(cacheKey);
    
    if (cached && (now - cached.timestamp) < this.VISITORS_CACHE_TTL) {
      return cached.data;
    }

    let result: Visitor[];
    if (branchId) {
      result = await db.select().from(visitors)
        .where(eq(visitors.branchId, branchId))
        .orderBy(desc(visitors.createdAt))
        .limit(limit);
    } else {
      result = await db.select().from(visitors)
        .orderBy(desc(visitors.createdAt))
        .limit(limit);
    }

    this.visitorsCache.set(cacheKey, { data: result, timestamp: now });
    return result;
  }

  invalidateVisitorsCache() {
    this.visitorsCache.clear();
  }

  async getVisitor(id: number): Promise<Visitor | undefined> {
    const [visitor] = await db.select().from(visitors).where(eq(visitors.id, id));
    return visitor;
  }

  async getVisitorByNationalId(nationalId: string): Promise<Visitor | undefined> {
    const [visitor] = await db.select().from(visitors).where(eq(visitors.nationalId, nationalId));
    return visitor;
  }

  async createVisitor(data: InsertVisitor): Promise<Visitor> {
    const [visitor] = await db.insert(visitors).values(data).returning();
    this.invalidateVisitorsCache(); // Invalidate cache after creation
    return visitor;
  }

  async updateVisitor(id: number, data: Partial<InsertVisitor>): Promise<Visitor | undefined> {
    const [visitor] = await db.update(visitors)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(visitors.id, id))
      .returning();
    this.invalidateVisitorsCache(); // Invalidate cache after update
    return visitor;
  }

  async deleteVisitor(id: number): Promise<boolean> {
    const result = await db.delete(visitors).where(eq(visitors.id, id));
    this.invalidateVisitorsCache(); // Invalidate cache after deletion
    return true;
  }

  async searchVisitors(query: string, branchId?: string): Promise<Visitor[]> {
    const conditions = [];
    if (branchId) {
      conditions.push(eq(visitors.branchId, branchId));
    }
    conditions.push(
      or(
        ilike(visitors.fullName, `%${query}%`),
        ilike(visitors.phone, `%${query}%`),
        ilike(visitors.nationalId, `%${query}%`),
        ilike(visitors.company, `%${query}%`)
      )
    );
    return db.select().from(visitors)
      .where(and(...conditions))
      .orderBy(desc(visitors.createdAt))
      .limit(50);
  }

  async getBlacklistedVisitors(branchId?: string): Promise<Visitor[]> {
    const conditions = [eq(visitors.isBlacklisted, true)];
    if (branchId) {
      conditions.push(eq(visitors.branchId, branchId));
    }
    return db.select().from(visitors)
      .where(and(...conditions))
      .orderBy(desc(visitors.createdAt));
  }

  // Visitor Logs CRUD
  async getVisitorLogs(branchId?: string, startDate?: Date, endDate?: Date): Promise<VisitorLog[]> {
    const conditions = [];
    if (branchId) {
      conditions.push(eq(visitorLogs.branchId, branchId));
    }
    if (startDate) {
      conditions.push(gte(visitorLogs.visitDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(visitorLogs.visitDate, endDate));
    }
    if (conditions.length > 0) {
      return db.select().from(visitorLogs)
        .where(and(...conditions))
        .orderBy(desc(visitorLogs.visitDate));
    }
    return db.select().from(visitorLogs).orderBy(desc(visitorLogs.visitDate));
  }

  async getVisitorLog(id: number): Promise<VisitorLog | undefined> {
    const [log] = await db.select().from(visitorLogs).where(eq(visitorLogs.id, id));
    return log;
  }

  async getActiveVisitorLogs(branchId?: string): Promise<VisitorLog[]> {
    const conditions = [eq(visitorLogs.status, 'checked_in')];
    if (branchId) {
      conditions.push(eq(visitorLogs.branchId, branchId));
    }
    return db.select().from(visitorLogs)
      .where(and(...conditions))
      .orderBy(desc(visitorLogs.checkInTime));
  }

  async createVisitorLog(data: InsertVisitorLog): Promise<VisitorLog> {
    // Generate visit number
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(visitorLogs)
      .where(ilike(visitorLogs.visitNumber, `VIS-${yearMonth}-%`));
    const nextNum = (Number(countResult?.count || 0) + 1).toString().padStart(4, '0');
    const visitNumber = `VIS-${yearMonth}-${nextNum}`;

    const [log] = await db.insert(visitorLogs).values({
      ...data,
      visitNumber,
      checkInTime: data.checkInTime || new Date(),
    }).returning();

    // Update visitor's visit count and last visit
    if (data.visitorId) {
      await db.update(visitors)
        .set({
          visitCount: sql`${visitors.visitCount} + 1`,
          lastVisitAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(visitors.id, data.visitorId));
    }

    return log;
  }

  async updateVisitorLog(id: number, data: Partial<InsertVisitorLog>): Promise<VisitorLog | undefined> {
    const [log] = await db.update(visitorLogs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(visitorLogs.id, id))
      .returning();
    return log;
  }

  async checkOutVisitor(id: number, checkedOutBy: string, checkedOutByName: string): Promise<VisitorLog | undefined> {
    const log = await this.getVisitorLog(id);
    if (!log) return undefined;

    const checkOutTime = new Date();
    const actualDuration = log.checkInTime
      ? Math.round((checkOutTime.getTime() - new Date(log.checkInTime).getTime()) / 60000)
      : null;

    const [updated] = await db.update(visitorLogs)
      .set({
        status: 'checked_out',
        checkOutTime,
        actualDuration,
        badgeReturned: true,
        checkedOutBy,
        checkedOutByName,
        updatedAt: new Date(),
      })
      .where(eq(visitorLogs.id, id))
      .returning();
    return updated;
  }

  async getVisitorLogsByVisitor(visitorId: number): Promise<VisitorLog[]> {
    return db.select().from(visitorLogs)
      .where(eq(visitorLogs.visitorId, visitorId))
      .orderBy(desc(visitorLogs.visitDate));
  }

  async getVisitorStats(branchId?: string): Promise<{
    todayVisitors: number;
    activeVisitors: number;
    totalVisitors: number;
    blacklistedCount: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const branchCondition = branchId ? eq(visitorLogs.branchId, branchId) : undefined;
    const visitorBranchCondition = branchId ? eq(visitors.branchId, branchId) : undefined;

    const [todayCount] = await db.select({ count: sql<number>`count(*)` })
      .from(visitorLogs)
      .where(and(branchCondition, gte(visitorLogs.visitDate, today)));

    const [activeCount] = await db.select({ count: sql<number>`count(*)` })
      .from(visitorLogs)
      .where(and(branchCondition, eq(visitorLogs.status, 'checked_in')));

    const [totalCount] = await db.select({ count: sql<number>`count(*)` })
      .from(visitors)
      .where(visitorBranchCondition);

    const [blacklistedCount] = await db.select({ count: sql<number>`count(*)` })
      .from(visitors)
      .where(and(visitorBranchCondition, eq(visitors.isBlacklisted, true)));

    return {
      todayVisitors: Number(todayCount?.count || 0),
      activeVisitors: Number(activeCount?.count || 0),
      totalVisitors: Number(totalCount?.count || 0),
      blacklistedCount: Number(blacklistedCount?.count || 0),
    };
  }

  // =====================================================
  // إدارة السفر والحجوزات - Travel Management
  // =====================================================

  // Travel Requests CRUD
  async getTravelRequests(branchId?: string, status?: string): Promise<TravelRequest[]> {
    const conditions = [];
    if (branchId) {
      conditions.push(eq(travelRequests.branchId, branchId));
    }
    if (status) {
      conditions.push(eq(travelRequests.status, status));
    }
    if (conditions.length > 0) {
      return db.select().from(travelRequests)
        .where(and(...conditions))
        .orderBy(desc(travelRequests.createdAt));
    }
    return db.select().from(travelRequests).orderBy(desc(travelRequests.createdAt));
  }

  async getTravelRequest(id: number): Promise<TravelRequest | undefined> {
    const [request] = await db.select().from(travelRequests).where(eq(travelRequests.id, id));
    return request;
  }

  async getTravelRequestsByRequester(requesterId: string): Promise<TravelRequest[]> {
    return db.select().from(travelRequests)
      .where(eq(travelRequests.requesterId, requesterId))
      .orderBy(desc(travelRequests.createdAt));
  }

  async createTravelRequest(data: InsertTravelRequest): Promise<TravelRequest> {
    // Generate request number
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(travelRequests)
      .where(ilike(travelRequests.requestNumber, `TR-${yearMonth}-%`));
    const nextNum = (Number(countResult?.count || 0) + 1).toString().padStart(4, '0');
    const requestNumber = `TR-${yearMonth}-${nextNum}`;

    // Calculate trip duration
    const departureDate = new Date(data.departureDate);
    const returnDate = new Date(data.returnDate);
    const tripDuration = Math.ceil((returnDate.getTime() - departureDate.getTime()) / (1000 * 60 * 60 * 24));

    const [request] = await db.insert(travelRequests).values({
      ...data,
      requestNumber,
      tripDuration,
    }).returning();
    return request;
  }

  async updateTravelRequest(id: number, data: Partial<InsertTravelRequest>): Promise<TravelRequest | undefined> {
    // Recalculate trip duration if dates changed
    let tripDuration = undefined;
    if (data.departureDate && data.returnDate) {
      const departureDate = new Date(data.departureDate);
      const returnDate = new Date(data.returnDate);
      tripDuration = Math.ceil((returnDate.getTime() - departureDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    const [request] = await db.update(travelRequests)
      .set({ ...data, tripDuration, updatedAt: new Date() })
      .where(eq(travelRequests.id, id))
      .returning();
    return request;
  }

  async deleteTravelRequest(id: number): Promise<boolean> {
    await db.delete(travelRequests).where(eq(travelRequests.id, id));
    return true;
  }

  async approveTravelRequest(
    id: number,
    approvalType: 'manager' | 'finance',
    approvedBy: string,
    approved: boolean,
    notes?: string
  ): Promise<TravelRequest | undefined> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (approvalType === 'manager') {
      updateData.managerApproval = approved ? 'approved' : 'rejected';
      updateData.managerApprovalDate = new Date();
      updateData.managerApprovalBy = approvedBy;
      updateData.managerApprovalNotes = notes;
    } else {
      updateData.financeApproval = approved ? 'approved' : 'rejected';
      updateData.financeApprovalDate = new Date();
      updateData.financeApprovalBy = approvedBy;
      updateData.financeApprovalNotes = notes;
    }

    // Update overall status if both approvals are done
    const request = await this.getTravelRequest(id);
    if (request) {
      if (approvalType === 'manager' && approved && request.financeApproval === 'approved') {
        updateData.status = 'approved';
      } else if (approvalType === 'finance' && approved && request.managerApproval === 'approved') {
        updateData.status = 'approved';
      } else if (!approved) {
        updateData.status = 'rejected';
      }
    }

    const [updated] = await db.update(travelRequests)
      .set(updateData)
      .where(eq(travelRequests.id, id))
      .returning();
    return updated;
  }

  async submitTravelRequest(id: number): Promise<TravelRequest | undefined> {
    const [request] = await db.update(travelRequests)
      .set({ status: 'pending', updatedAt: new Date() })
      .where(eq(travelRequests.id, id))
      .returning();
    return request;
  }

  async completeTravelRequest(id: number, tripReport?: string): Promise<TravelRequest | undefined> {
    const [request] = await db.update(travelRequests)
      .set({
        status: 'completed',
        tripReport,
        tripReportDate: tripReport ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(travelRequests.id, id))
      .returning();
    return request;
  }

  // Travel Expenses CRUD
  async getTravelExpenses(travelRequestId: number): Promise<TravelExpense[]> {
    return db.select().from(travelExpenses)
      .where(eq(travelExpenses.travelRequestId, travelRequestId))
      .orderBy(desc(travelExpenses.expenseDate));
  }

  async getTravelExpense(id: number): Promise<TravelExpense | undefined> {
    const [expense] = await db.select().from(travelExpenses).where(eq(travelExpenses.id, id));
    return expense;
  }

  async createTravelExpense(data: InsertTravelExpense): Promise<TravelExpense> {
    const [expense] = await db.insert(travelExpenses).values(data).returning();
    
    // Update total actual cost in travel request
    await this.updateTravelRequestActualCosts(data.travelRequestId);
    
    return expense;
  }

  async updateTravelExpense(id: number, data: Partial<InsertTravelExpense>): Promise<TravelExpense | undefined> {
    const [expense] = await db.update(travelExpenses)
      .set(data)
      .where(eq(travelExpenses.id, id))
      .returning();
    
    if (expense) {
      await this.updateTravelRequestActualCosts(expense.travelRequestId);
    }
    
    return expense;
  }

  async deleteTravelExpense(id: number): Promise<boolean> {
    const expense = await this.getTravelExpense(id);
    await db.delete(travelExpenses).where(eq(travelExpenses.id, id));
    if (expense) {
      await this.updateTravelRequestActualCosts(expense.travelRequestId);
    }
    return true;
  }

  async approveTravelExpense(id: number, approvedBy: string, approved: boolean, reason?: string): Promise<TravelExpense | undefined> {
    const [expense] = await db.update(travelExpenses)
      .set({
        status: approved ? 'approved' : 'rejected',
        approvedBy,
        approvedAt: new Date(),
        rejectionReason: approved ? null : reason,
      })
      .where(eq(travelExpenses.id, id))
      .returning();
    return expense;
  }

  private async updateTravelRequestActualCosts(travelRequestId: number): Promise<void> {
    const expenses = await this.getTravelExpenses(travelRequestId);
    
    const costsByType: Record<string, number> = {
      flight: 0,
      hotel: 0,
      transport: 0,
      meals: 0,
      other: 0,
    };

    for (const expense of expenses) {
      if (expense.status === 'approved') {
        const type = expense.expenseType;
        if (type in costsByType) {
          costsByType[type] += Number(expense.amount);
        } else {
          costsByType.other += Number(expense.amount);
        }
      }
    }

    const totalActualCost = Object.values(costsByType).reduce((a, b) => a + b, 0);

    await db.update(travelRequests)
      .set({
        actualFlightCost: costsByType.flight.toString(),
        actualHotelCost: costsByType.hotel.toString(),
        actualTransportCost: costsByType.transport.toString(),
        actualMealsCost: costsByType.meals.toString(),
        actualOtherCost: costsByType.other.toString(),
        totalActualCost: totalActualCost.toString(),
        updatedAt: new Date(),
      })
      .where(eq(travelRequests.id, travelRequestId));
  }

  async getTravelStats(branchId?: string): Promise<{
    pendingRequests: number;
    approvedRequests: number;
    completedTrips: number;
    totalBudget: number;
    totalSpent: number;
  }> {
    const branchCondition = branchId ? eq(travelRequests.branchId, branchId) : undefined;

    const [pendingCount] = await db.select({ count: sql<number>`count(*)` })
      .from(travelRequests)
      .where(and(branchCondition, eq(travelRequests.status, 'pending')));

    const [approvedCount] = await db.select({ count: sql<number>`count(*)` })
      .from(travelRequests)
      .where(and(branchCondition, eq(travelRequests.status, 'approved')));

    const [completedCount] = await db.select({ count: sql<number>`count(*)` })
      .from(travelRequests)
      .where(and(branchCondition, eq(travelRequests.status, 'completed')));

    const [budgetSum] = await db.select({ 
      total: sql<number>`COALESCE(SUM(${travelRequests.totalEstimatedCost}::numeric), 0)` 
    })
      .from(travelRequests)
      .where(branchCondition);

    const [spentSum] = await db.select({ 
      total: sql<number>`COALESCE(SUM(${travelRequests.totalActualCost}::numeric), 0)` 
    })
      .from(travelRequests)
      .where(branchCondition);

    return {
      pendingRequests: Number(pendingCount?.count || 0),
      approvedRequests: Number(approvedCount?.count || 0),
      completedTrips: Number(completedCount?.count || 0),
      totalBudget: Number(budgetSum?.total || 0),
      totalSpent: Number(spentSum?.total || 0),
    };
  }

  // =====================================================
  // التنبيهات الموحدة - System Notifications (with caching)
  // =====================================================

  private notificationsCache = new Map<string, { data: Notification[], timestamp: number }>();
  private NOTIFICATIONS_CACHE_TTL = 15000; // 15 seconds cache

  async getSystemNotifications(userId?: string, branchId?: string): Promise<Notification[]> {
    try {
      const cacheKey = `${userId || 'all'}-${branchId || 'all'}`;
      const cached = this.notificationsCache.get(cacheKey);
      const now = Date.now();
      if (cached && (now - cached.timestamp) < this.NOTIFICATIONS_CACHE_TTL) {
        return cached.data;
      }

      const conditions = [];
      if (userId) {
        conditions.push(or(eq(notifications.userId, userId), isNull(notifications.userId)));
      }
      if (branchId) {
        conditions.push(or(eq(notifications.branchId, branchId), isNull(notifications.branchId)));
      }
      conditions.push(eq(notifications.isDismissed, false));

      const result = await db.select()
        .from(notifications)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(notifications.createdAt))
        .limit(50);
      
      this.notificationsCache.set(cacheKey, { data: result, timestamp: now });
      return result;
    } catch (error: any) {
      if (error?.code === '42P01') return [];
      throw error;
    }
  }

  invalidateNotificationsCache() {
    this.notificationsCache.clear();
  }

  async getUnreadSystemNotifications(userId: string): Promise<Notification[]> {
    try {
      return db.select()
        .from(notifications)
        .where(and(
          or(eq(notifications.userId, userId), isNull(notifications.userId)),
          eq(notifications.isRead, false),
          eq(notifications.isDismissed, false)
        ))
        .orderBy(desc(notifications.createdAt));
    } catch (error: any) {
      if (error?.code === '42P01') return [];
      throw error;
    }
  }

  async getSystemNotificationById(id: number): Promise<Notification | undefined> {
    try {
      const [notification] = await db.select()
        .from(notifications)
        .where(eq(notifications.id, id));
      return notification;
    } catch (error: any) {
      if (error?.code === '42P01') return undefined;
      throw error;
    }
  }

  async createSystemNotification(data: InsertNotification): Promise<Notification> {
    this.invalidateNotificationsCache();
    const [notification] = await db.insert(notifications)
      .values(data)
      .returning();
    return notification;
  }

  async markSystemNotificationAsRead(id: number): Promise<Notification | undefined> {
    this.invalidateNotificationsCache();
    try {
      const [notification] = await db.update(notifications)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(eq(notifications.id, id))
        .returning();
      return notification;
    } catch (error: any) {
      if (error?.code === '42P01') return undefined;
      throw error;
    }
  }

  async markAllSystemNotificationsAsRead(userId: string): Promise<boolean> {
    try {
      await db.update(notifications)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(and(
          or(eq(notifications.userId, userId), isNull(notifications.userId)),
          eq(notifications.isRead, false)
        ));
      return true;
    } catch (error: any) {
      if (error?.code === '42P01') return true;
      throw error;
    }
  }

  async dismissSystemNotification(id: number): Promise<boolean> {
    this.invalidateNotificationsCache();
    try {
      await db.update(notifications)
        .set({
          isDismissed: true,
          dismissedAt: new Date(),
        })
        .where(eq(notifications.id, id));
      return true;
    } catch (error: any) {
      if (error?.code === '42P01') return true;
      throw error;
    }
  }

  async deleteSystemNotification(id: number): Promise<boolean> {
    try {
      await db.delete(notifications)
        .where(eq(notifications.id, id));
      return true;
    } catch (error: any) {
      if (error?.code === '42P01') return true;
      throw error;
    }
  }

  async getSystemNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    urgent: number;
  }> {
    try {
      const userCondition = or(eq(notifications.userId, userId), isNull(notifications.userId));
      const notDismissed = eq(notifications.isDismissed, false);

      const [totalCount] = await db.select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(and(userCondition, notDismissed));

      const [unreadCount] = await db.select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(and(userCondition, notDismissed, eq(notifications.isRead, false)));

      const [urgentCount] = await db.select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(and(userCondition, notDismissed, eq(notifications.priority, 'urgent')));

      return {
        total: Number(totalCount?.count || 0),
        unread: Number(unreadCount?.count || 0),
        urgent: Number(urgentCount?.count || 0),
      };
    } catch (error: any) {
      if (error?.code === '42P01') return { total: 0, unread: 0, urgent: 0 };
      throw error;
    }
  }

  // ==========================================
  // Enhanced P&L System - نظام الأرباح والخسائر المحسن
  // ==========================================

  async getPnlBranchSettings(branchId: string): Promise<PnlBranchSettings | undefined> {
    try {
      const [settings] = await db.select().from(pnlBranchSettings)
        .where(eq(pnlBranchSettings.branchId, branchId));
      return settings || undefined;
    } catch (error: any) {
      if (error?.code === '42P01') return undefined;
      throw error;
    }
  }

  async upsertPnlBranchSettings(settings: InsertPnlBranchSettings): Promise<PnlBranchSettings> {
    const existing = await this.getPnlBranchSettings(settings.branchId);
    if (existing) {
      const [updated] = await db.update(pnlBranchSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(pnlBranchSettings.branchId, settings.branchId))
        .returning();
      return updated;
    } else {
      const [inserted] = await db.insert(pnlBranchSettings)
        .values(settings)
        .returning();
      return inserted;
    }
  }

  async getPnlMonthlyInputs(branchId: string, year: number, month: number): Promise<PnlMonthlyInputs | undefined> {
    try {
      const [inputs] = await db.select().from(pnlMonthlyInputs)
        .where(and(
          eq(pnlMonthlyInputs.branchId, branchId),
          eq(pnlMonthlyInputs.year, year),
          eq(pnlMonthlyInputs.month, month)
        ));
      return inputs || undefined;
    } catch (error: any) {
      if (error?.code === '42P01') return undefined;
      throw error;
    }
  }

  async upsertPnlMonthlyInputs(inputs: InsertPnlMonthlyInputs): Promise<PnlMonthlyInputs> {
    const existing = await this.getPnlMonthlyInputs(inputs.branchId, inputs.year, inputs.month);
    if (existing) {
      const [updated] = await db.update(pnlMonthlyInputs)
        .set({ ...inputs, updatedAt: new Date() })
        .where(and(
          eq(pnlMonthlyInputs.branchId, inputs.branchId),
          eq(pnlMonthlyInputs.year, inputs.year),
          eq(pnlMonthlyInputs.month, inputs.month)
        ))
        .returning();
      return updated;
    } else {
      const [inserted] = await db.insert(pnlMonthlyInputs)
        .values(inputs)
        .returning();
      return inserted;
    }
  }

  // ==========================================
  // Smart Points System Implementation
  // ==========================================

  async getPointSettings(): Promise<PointSettings | undefined> {
    try {
      const [settings] = await db.select().from(pointSettings).where(eq(pointSettings.isActive, true)).limit(1);
      return settings || undefined;
    } catch (error: any) {
      if (error?.code === '42P01') return undefined;
      throw error;
    }
  }

  async upsertPointSettings(settings: InsertPointSettings): Promise<PointSettings> {
    await db.update(pointSettings).set({ isActive: false }).where(eq(pointSettings.isActive, true));
    const [created] = await db.insert(pointSettings).values({ ...settings, isActive: true }).returning();
    return created;
  }

  async getAllDailyChallenges(): Promise<CashierDailyChallenge[]> {
    try {
      return await db.select().from(cashierDailyChallenges).orderBy(desc(cashierDailyChallenges.createdAt));
    } catch (error: any) {
      if (error?.code === '42P01') return [];
      throw error;
    }
  }

  async getActiveDailyChallenges(branchId?: string, targetDate?: string): Promise<CashierDailyChallenge[]> {
    try {
      const dateToCheck = targetDate || new Date().toISOString().split('T')[0];
      const conditions = [
        eq(cashierDailyChallenges.isActive, true),
        lte(cashierDailyChallenges.validFrom, dateToCheck),
      ];
      if (branchId) {
        conditions.push(or(eq(cashierDailyChallenges.branchId, branchId), isNull(cashierDailyChallenges.branchId))!);
      }
      return await db.select().from(cashierDailyChallenges).where(and(...conditions));
    } catch (error: any) {
      if (error?.code === '42P01') return [];
      throw error;
    }
  }

  async getDailyChallenge(id: number): Promise<CashierDailyChallenge | undefined> {
    const [challenge] = await db.select().from(cashierDailyChallenges).where(eq(cashierDailyChallenges.id, id));
    return challenge || undefined;
  }

  async createDailyChallenge(challenge: InsertCashierDailyChallenge): Promise<CashierDailyChallenge> {
    const [created] = await db.insert(cashierDailyChallenges).values(challenge).returning();
    return created;
  }

  async updateDailyChallenge(id: number, challenge: Partial<InsertCashierDailyChallenge>): Promise<CashierDailyChallenge | undefined> {
    const [updated] = await db.update(cashierDailyChallenges)
      .set({ ...challenge, updatedAt: new Date() })
      .where(eq(cashierDailyChallenges.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDailyChallenge(id: number): Promise<boolean> {
    const result = await db.delete(cashierDailyChallenges).where(eq(cashierDailyChallenges.id, id));
    return true;
  }

  async getAllProductCommissions(): Promise<ProductCommission[]> {
    try {
      return await db.select().from(productCommissions).orderBy(desc(productCommissions.createdAt));
    } catch (error: any) {
      if (error?.code === '42P01') return [];
      throw error;
    }
  }

  async getActiveProductCommissions(branchId?: string): Promise<ProductCommission[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const conditions = [
        eq(productCommissions.isActive, true),
        lte(productCommissions.validFrom, today),
      ];
      if (branchId) {
        conditions.push(or(eq(productCommissions.branchId, branchId), isNull(productCommissions.branchId))!);
      }
      return await db.select().from(productCommissions).where(and(...conditions));
    } catch (error: any) {
      if (error?.code === '42P01') return [];
      throw error;
    }
  }

  async getProductCommission(id: number): Promise<ProductCommission | undefined> {
    const [commission] = await db.select().from(productCommissions).where(eq(productCommissions.id, id));
    return commission || undefined;
  }

  async createProductCommission(commission: InsertProductCommission): Promise<ProductCommission> {
    const [created] = await db.insert(productCommissions).values(commission).returning();
    return created;
  }

  async updateProductCommission(id: number, commission: Partial<InsertProductCommission>): Promise<ProductCommission | undefined> {
    const [updated] = await db.update(productCommissions)
      .set({ ...commission, updatedAt: new Date() })
      .where(eq(productCommissions.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProductCommission(id: number): Promise<boolean> {
    const result = await db.delete(productCommissions).where(eq(productCommissions.id, id));
    return true;
  }

  async getAllBranchBonuses(): Promise<BranchAchievementBonus[]> {
    try {
      return await db.select().from(branchAchievementBonus).orderBy(desc(branchAchievementBonus.createdAt));
    } catch (error: any) {
      if (error?.code === '42P01') return [];
      throw error;
    }
  }

  async getBranchBonus(id: number): Promise<BranchAchievementBonus | undefined> {
    const [bonus] = await db.select().from(branchAchievementBonus).where(eq(branchAchievementBonus.id, id));
    return bonus || undefined;
  }

  async getBranchBonusByBranchMonth(branchId: string, yearMonth: string): Promise<BranchAchievementBonus | undefined> {
    const [bonus] = await db.select().from(branchAchievementBonus)
      .where(and(eq(branchAchievementBonus.branchId, branchId), eq(branchAchievementBonus.yearMonth, yearMonth)));
    return bonus || undefined;
  }

  async createBranchBonus(bonus: InsertBranchAchievementBonus): Promise<BranchAchievementBonus> {
    const [created] = await db.insert(branchAchievementBonus).values(bonus).returning();
    return created;
  }

  async updateBranchBonus(id: number, bonus: Partial<InsertBranchAchievementBonus>): Promise<BranchAchievementBonus | undefined> {
    const [updated] = await db.update(branchAchievementBonus)
      .set({ ...bonus, updatedAt: new Date() })
      .where(eq(branchAchievementBonus.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteBranchBonus(id: number): Promise<boolean> {
    const result = await db.delete(branchAchievementBonus).where(eq(branchAchievementBonus.id, id));
    return true;
  }

  async getCashierPointsLedger(cashierId: string, dateFrom?: string, dateTo?: string): Promise<CashierPointsLedger[]> {
    try {
      const conditions = [eq(cashierPointsLedger.cashierId, cashierId)];
      if (dateFrom) conditions.push(gte(cashierPointsLedger.transactionDate, dateFrom));
      if (dateTo) conditions.push(lte(cashierPointsLedger.transactionDate, dateTo));
      return await db.select().from(cashierPointsLedger).where(and(...conditions)).orderBy(desc(cashierPointsLedger.createdAt));
    } catch (error: any) {
      if (error?.code === '42P01') return [];
      throw error;
    }
  }

  async getBranchPointsLedger(branchId: string, dateFrom?: string, dateTo?: string): Promise<CashierPointsLedger[]> {
    try {
      const conditions = [eq(cashierPointsLedger.branchId, branchId)];
      if (dateFrom) conditions.push(gte(cashierPointsLedger.transactionDate, dateFrom));
      if (dateTo) conditions.push(lte(cashierPointsLedger.transactionDate, dateTo));
      return await db.select().from(cashierPointsLedger).where(and(...conditions)).orderBy(desc(cashierPointsLedger.createdAt));
    } catch (error: any) {
      if (error?.code === '42P01') return [];
      throw error;
    }
  }

  async createPointsEntry(entry: InsertCashierPointsLedger): Promise<CashierPointsLedger> {
    const [created] = await db.insert(cashierPointsLedger).values(entry).returning();
    return created;
  }

  async updatePointsEntryStatus(id: number, status: string, approvedBy?: string): Promise<CashierPointsLedger | undefined> {
    const updateData: any = { status };
    if (approvedBy) {
      updateData.approvedBy = approvedBy;
      updateData.approvedAt = new Date();
    }
    const [updated] = await db.update(cashierPointsLedger).set(updateData).where(eq(cashierPointsLedger.id, id)).returning();
    return updated || undefined;
  }

  async getCashierPointsSummary(cashierId: string, yearMonth?: string): Promise<{ totalPoints: number; totalAmount: number; pendingPoints: number; pendingAmount: number; approvedPoints: number; approvedAmount: number }> {
    try {
      const conditions = [eq(cashierPointsLedger.cashierId, cashierId)];
      if (yearMonth) {
        const [year, month] = yearMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-31`;
        conditions.push(gte(cashierPointsLedger.transactionDate, startDate));
        conditions.push(lte(cashierPointsLedger.transactionDate, endDate));
      }
      
      const entries = await db.select().from(cashierPointsLedger).where(and(...conditions));
      
      const result = {
        totalPoints: 0,
        totalAmount: 0,
        pendingPoints: 0,
        pendingAmount: 0,
        approvedPoints: 0,
        approvedAmount: 0,
      };
      
      for (const entry of entries) {
        if (entry.status !== 'cancelled') {
          result.totalPoints += entry.pointsEarned;
          result.totalAmount += entry.amountEarned;
        }
        if (entry.status === 'earned') {
          result.pendingPoints += entry.pointsEarned;
          result.pendingAmount += entry.amountEarned;
        }
        if (entry.status === 'approved' || entry.status === 'paid') {
          result.approvedPoints += entry.pointsEarned;
          result.approvedAmount += entry.amountEarned;
        }
      }
      
      return result;
    } catch (error: any) {
      if (error?.code === '42P01') return { totalPoints: 0, totalAmount: 0, pendingPoints: 0, pendingAmount: 0, approvedPoints: 0, approvedAmount: 0 };
      throw error;
    }
  }

  async getTopCashiersByPoints(yearMonth: string, limit: number = 10): Promise<Array<{ cashierId: string; cashierName: string; branchId: string; branchName: string; totalPoints: number; totalAmount: number; challengeCount: number }>> {
    try {
      const [year, month] = yearMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-31`;
      
      const entries = await db.select().from(cashierPointsLedger).where(
        and(
          gte(cashierPointsLedger.transactionDate, startDate),
          lte(cashierPointsLedger.transactionDate, endDate),
        )
      );
      
      const cashierMap = new Map<string, { totalPoints: number; totalAmount: number; challengeCount: number; branchId: string }>();
      for (const entry of entries) {
        if (entry.status === 'cancelled') continue;
        const existing = cashierMap.get(entry.cashierId) || { totalPoints: 0, totalAmount: 0, challengeCount: 0, branchId: entry.branchId };
        existing.totalPoints += entry.pointsEarned;
        existing.totalAmount += entry.amountEarned;
        existing.challengeCount += 1;
        existing.branchId = entry.branchId;
        cashierMap.set(entry.cashierId, existing);
      }
      
      const allUsers = await this.getAllUsers();
      const allBranches = await this.getAllBranches();
      const userMap = new Map(allUsers.map((u: any) => [u.id, u]));
      const branchMap = new Map(allBranches.map((b: any) => [b.id, b]));
      
      const results = Array.from(cashierMap.entries()).map(([cashierId, data]) => {
        const user = userMap.get(cashierId) as any;
        const branch = branchMap.get(data.branchId) as any;
        return {
          cashierId,
          cashierName: user ? (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username) : cashierId,
          branchId: data.branchId,
          branchName: branch ? branch.name : data.branchId,
          totalPoints: data.totalPoints,
          totalAmount: data.totalAmount,
          challengeCount: data.challengeCount,
        };
      });
      
      results.sort((a, b) => b.totalPoints - a.totalPoints);
      return results.slice(0, limit);
    } catch (error: any) {
      if (error?.code === '42P01') return [];
      throw error;
    }
  }

  async getCashierProductSales(cashierId: string, date?: string): Promise<CashierProductSales[]> {
    try {
      const conditions = [eq(cashierProductSales.cashierId, cashierId)];
      if (date) conditions.push(eq(cashierProductSales.salesDate, date));
      return await db.select().from(cashierProductSales).where(and(...conditions)).orderBy(desc(cashierProductSales.createdAt));
    } catch (error: any) {
      if (error?.code === '42P01') return [];
      throw error;
    }
  }

  async createCashierProductSale(sale: InsertCashierProductSales): Promise<CashierProductSales> {
    const [created] = await db.insert(cashierProductSales).values(sale).returning();
    return created;
  }

  async updateCashierProductSale(id: number, sale: Partial<InsertCashierProductSales>): Promise<CashierProductSales | undefined> {
    const [updated] = await db.update(cashierProductSales)
      .set({ ...sale, updatedAt: new Date() })
      .where(eq(cashierProductSales.id, id))
      .returning();
    return updated || undefined;
  }

  async calculateJournalIncentives(journalId: number): Promise<{ challengePoints: CashierPointsLedger[]; totalPoints: number; totalAmount: number; diagnostics: Array<{challengeName: string; challengeType: string; targetValue: number; actualValue: number; met: boolean; reason?: string}> }> {
    const [journal] = await db.select().from(cashierSalesJournals).where(eq(cashierSalesJournals.id, journalId));
    if (!journal) throw new Error("اليومية غير موجودة");

    const settings = await this.getPointSettings();
    if (!settings) {
      return { challengePoints: [], totalPoints: 0, totalAmount: 0, diagnostics: [] };
    }

    const challengeTypes = ['challenge_avg_ticket', 'challenge_customer_count', 'challenge_shift_sales'];
    const existingChallengeEntries = await db.select().from(cashierPointsLedger).where(
      and(
        eq(cashierPointsLedger.cashierId, journal.cashierId),
        eq(cashierPointsLedger.transactionDate, journal.journalDate),
        eq(cashierPointsLedger.branchId, journal.branchId),
        inArray(cashierPointsLedger.pointsType, challengeTypes),
      )
    );

    if (existingChallengeEntries.length > 0) {
      for (const entry of existingChallengeEntries) {
        await db.delete(cashierPointsLedger).where(eq(cashierPointsLedger.id, entry.id));
      }
    }

    const activeChallenges = await this.getActiveDailyChallenges(journal.branchId, journal.journalDate);
    const pointValue = Number(settings.pointValue) || 0.5;
    const seasonalMultiplier = Number(settings.seasonalMultiplier) || 1;
    const maxDailyPoints = settings.maxDailyPoints ? Number(settings.maxDailyPoints) : null;
    const pendingEntries: Array<{ challengeType: string; challengeId: number; challengeName: string; pointsEarned: number; targetValue: number; actualValue: number }> = [];
    const diagnostics: Array<{challengeName: string; challengeType: string; targetValue: number; actualValue: number; met: boolean; reason?: string}> = [];
    let totalPointsEarned = 0;

    for (const challenge of activeChallenges) {
      if (challenge.shiftType && challenge.shiftType !== journal.shiftType) {
        diagnostics.push({ challengeName: challenge.name, challengeType: challenge.challengeType, targetValue: Number(challenge.targetValue), actualValue: 0, met: false, reason: `نوع الشفت غير مطابق: التحدي=${challenge.shiftType}, اليومية=${journal.shiftType}` });
        continue;
      }
      if (challenge.validTo && challenge.validTo < journal.journalDate) {
        diagnostics.push({ challengeName: challenge.name, challengeType: challenge.challengeType, targetValue: Number(challenge.targetValue), actualValue: 0, met: false, reason: `التحدي انتهت صلاحيته: ${challenge.validTo} < ${journal.journalDate}` });
        continue;
      }
      if (challenge.cashierId && challenge.cashierId !== journal.cashierId) {
        diagnostics.push({ challengeName: challenge.name, challengeType: challenge.challengeType, targetValue: Number(challenge.targetValue), actualValue: 0, met: false, reason: `التحدي مخصص لكاشير آخر` });
        continue;
      }

      let actualValue = 0;
      let targetValue = Number(challenge.targetValue);
      let pointsEarned = 0;

      switch (challenge.challengeType) {
        case 'avg_ticket': {
          actualValue = Number(journal.averageTicket) || 0;
          if (actualValue === 0 && Number(journal.totalSales) > 0) {
            const txCount = Number(journal.transactionCount) || 0;
            const custCount = Number(journal.customerCount) || 0;
            const divisor = txCount > 0 ? txCount : (custCount > 0 ? custCount : 0);
            if (divisor > 0) {
              actualValue = Math.round((Number(journal.totalSales) / divisor) * 100) / 100;
            }
          }
          break;
        }
        case 'customer_count':
          actualValue = Number(journal.customerCount) || 0;
          break;
        case 'shift_sales':
          actualValue = Number(journal.totalSales) || 0;
          break;
        default:
          continue;
      }

      if (actualValue >= targetValue) {
        pointsEarned = Number(challenge.basePoints) || 0;
        const excess = actualValue - targetValue;
        const bonusPerUnit = Number(challenge.bonusPointsPerUnit) || 0;
        if (excess > 0 && bonusPerUnit > 0) {
          pointsEarned += Math.floor(excess * bonusPerUnit);
        }
      }

      if (pointsEarned > 0) {
        pointsEarned = Math.round(pointsEarned * seasonalMultiplier);
        totalPointsEarned += pointsEarned;
        pendingEntries.push({ challengeType: challenge.challengeType, challengeId: challenge.id, challengeName: challenge.name, pointsEarned, targetValue, actualValue });
        diagnostics.push({ challengeName: challenge.name, challengeType: challenge.challengeType, targetValue, actualValue, met: true });
      } else {
        diagnostics.push({ challengeName: challenge.name, challengeType: challenge.challengeType, targetValue, actualValue, met: false, reason: `القيمة الفعلية (${actualValue}) أقل من الهدف (${targetValue})` });
      }
    }

    if (maxDailyPoints && totalPointsEarned > maxDailyPoints) {
      const ratio = maxDailyPoints / totalPointsEarned;
      for (const pe of pendingEntries) {
        pe.pointsEarned = Math.floor(pe.pointsEarned * ratio);
      }
      totalPointsEarned = maxDailyPoints;
    }

    const createdEntries: CashierPointsLedger[] = [];
    for (const pe of pendingEntries) {
      const amountEarned = Number((pe.pointsEarned * pointValue).toFixed(2));
      const entry = await this.createPointsEntry({
        cashierId: journal.cashierId,
        branchId: journal.branchId,
        transactionDate: journal.journalDate,
        shiftType: journal.shiftType || undefined,
        pointsType: `challenge_${pe.challengeType}`,
        sourceId: pe.challengeId,
        sourceName: pe.challengeName,
        pointsEarned: pe.pointsEarned,
        pointValue,
        amountEarned,
        status: 'earned',
        notes: `تحدي: ${pe.challengeName} | الهدف: ${pe.targetValue} | الفعلي: ${pe.actualValue}`,
      });
      createdEntries.push(entry);
    }

    const totalAmount = Number((totalPointsEarned * pointValue).toFixed(2));
    return { challengePoints: createdEntries, totalPoints: totalPointsEarned, totalAmount, diagnostics };
  }

  async createIncentiveStatement(data: InsertCashierIncentiveStatement): Promise<CashierIncentiveStatement> {
    const [created] = await db.insert(cashierIncentiveStatements).values(data).returning();
    return created;
  }

  async getIncentiveStatements(branchId?: string, cashierId?: string, status?: string): Promise<CashierIncentiveStatement[]> {
    try {
      const conditions = [];
      if (branchId) conditions.push(eq(cashierIncentiveStatements.branchId, branchId));
      if (cashierId) conditions.push(eq(cashierIncentiveStatements.cashierId, cashierId));
      if (status) conditions.push(eq(cashierIncentiveStatements.status, status));
      if (conditions.length > 0) {
        return await db.select().from(cashierIncentiveStatements).where(and(...conditions)).orderBy(desc(cashierIncentiveStatements.createdAt));
      }
      return await db.select().from(cashierIncentiveStatements).orderBy(desc(cashierIncentiveStatements.createdAt));
    } catch (error: any) {
      if (error?.code === '42P01') return [];
      throw error;
    }
  }

  async getIncentiveStatement(id: number): Promise<CashierIncentiveStatement | undefined> {
    const [stmt] = await db.select().from(cashierIncentiveStatements).where(eq(cashierIncentiveStatements.id, id));
    return stmt || undefined;
  }

  async updateIncentiveStatementStatus(id: number, status: string, userId: string, rejectionReason?: string): Promise<CashierIncentiveStatement | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (status === 'approved') {
      updateData.approvedBy = userId;
      updateData.approvedAt = new Date();
    } else if (status === 'rejected') {
      updateData.rejectedBy = userId;
      updateData.rejectedAt = new Date();
      if (rejectionReason) updateData.rejectionReason = rejectionReason;
    } else if (status === 'paid') {
      updateData.paidBy = userId;
      updateData.paidAt = new Date();
    }
    const [updated] = await db.update(cashierIncentiveStatements).set(updateData).where(eq(cashierIncentiveStatements.id, id)).returning();
    return updated || undefined;
  }

  private mapRawBiometricCredential(row: any): BiometricCredential {
    return {
      id: row.id,
      employeeId: row.employee_id || '',
      employeeName: row.employee_name || '',
      branchId: row.branch_id || '',
      credentialId: row.credential_id || '',
      publicKey: row.public_key || '',
      counter: row.counter || 0,
      deviceInfo: row.device_info || null,
      registeredBy: row.registered_by || null,
      isActive: row.is_active !== undefined ? row.is_active : true,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      deviceType: row.device_type || null,
      deviceModel: row.device_model || null,
      registrationMethod: row.registration_method || 'webauthn',
      registeredByName: row.registered_by_name || null,
      deactivatedAt: row.deactivated_at ? new Date(row.deactivated_at) : null,
      deactivatedBy: row.deactivated_by || null,
      deactivationReason: row.deactivation_reason || null,
      usageCount: row.usage_count || null,
      verificationPin: null,
    };
  }

  // Biometric Credentials
  async getBiometricCredentials(employeeId: string): Promise<BiometricCredential[]> {
    try {
      const rows = await db.select({
        id: biometricCredentials.id,
        employeeId: biometricCredentials.employeeId,
        employeeName: biometricCredentials.employeeName,
        branchId: biometricCredentials.branchId,
        credentialId: biometricCredentials.credentialId,
        publicKey: biometricCredentials.publicKey,
        counter: biometricCredentials.counter,
        deviceInfo: biometricCredentials.deviceInfo,
        registeredBy: biometricCredentials.registeredBy,
        isActive: biometricCredentials.isActive,
        lastUsedAt: biometricCredentials.lastUsedAt,
        createdAt: biometricCredentials.createdAt,
        deviceType: biometricCredentials.deviceType,
        deviceModel: biometricCredentials.deviceModel,
        registrationMethod: biometricCredentials.registrationMethod,
        registeredByName: biometricCredentials.registeredByName,
        deactivatedAt: biometricCredentials.deactivatedAt,
        deactivatedBy: biometricCredentials.deactivatedBy,
        deactivationReason: biometricCredentials.deactivationReason,
        usageCount: biometricCredentials.usageCount,
      }).from(biometricCredentials)
        .where(and(eq(biometricCredentials.employeeId, employeeId), eq(biometricCredentials.isActive, true)));
      return rows.map(r => ({ ...r, verificationPin: null })) as BiometricCredential[];
    } catch (error: any) {
      if (error?.code === '42P01') return [];
      if (error?.code === '42703') {
        try {
          const result = await pool.query(`SELECT * FROM biometric_credentials WHERE employee_id = $1 AND (is_active = true OR is_active IS NULL)`, [employeeId]);
          return result.rows.map((r: any) => this.mapRawBiometricCredential(r));
        } catch (e: any) {
          if (e?.code === '42P01') return [];
          if (e?.code === '42703') {
            const result = await pool.query(`SELECT id, employee_id, credential_id, public_key, counter, created_at FROM biometric_credentials WHERE employee_id = $1`, [employeeId]);
            return result.rows.map((r: any) => this.mapRawBiometricCredential(r));
          }
          throw e;
        }
      }
      throw error;
    }
  }

  async getBiometricCredentialsByBranch(branchId: string): Promise<BiometricCredential[]> {
    try {
      const rows = await db.select({
      id: biometricCredentials.id,
      employeeId: biometricCredentials.employeeId,
      employeeName: biometricCredentials.employeeName,
      branchId: biometricCredentials.branchId,
      credentialId: biometricCredentials.credentialId,
      publicKey: biometricCredentials.publicKey,
      counter: biometricCredentials.counter,
      deviceInfo: biometricCredentials.deviceInfo,
      registeredBy: biometricCredentials.registeredBy,
      isActive: biometricCredentials.isActive,
      lastUsedAt: biometricCredentials.lastUsedAt,
      createdAt: biometricCredentials.createdAt,
      deviceType: biometricCredentials.deviceType,
      deviceModel: biometricCredentials.deviceModel,
      registrationMethod: biometricCredentials.registrationMethod,
      registeredByName: biometricCredentials.registeredByName,
      deactivatedAt: biometricCredentials.deactivatedAt,
      deactivatedBy: biometricCredentials.deactivatedBy,
      deactivationReason: biometricCredentials.deactivationReason,
      usageCount: biometricCredentials.usageCount,
    }).from(biometricCredentials)
        .where(and(eq(biometricCredentials.branchId, branchId), eq(biometricCredentials.isActive, true)));
      return rows.map(r => ({ ...r, verificationPin: null })) as BiometricCredential[];
    } catch (error: any) {
      if (error?.code === '42P01') return [];
      if (error?.code === '42703') {
        try {
          const result = await pool.query(`SELECT * FROM biometric_credentials WHERE branch_id = $1 AND (is_active = true OR is_active IS NULL)`, [branchId]);
          return result.rows.map((r: any) => this.mapRawBiometricCredential(r));
        } catch (e: any) {
          if (e?.code === '42P01') return [];
          if (e?.code === '42703') {
            const result = await pool.query(`SELECT id, employee_id, credential_id, public_key, counter, created_at FROM biometric_credentials WHERE employee_id IS NOT NULL`, []);
            return result.rows.map((r: any) => this.mapRawBiometricCredential(r));
          }
          throw e;
        }
      }
      throw error;
    }
  }

  async getBiometricCredentialByCredentialId(credentialId: string): Promise<BiometricCredential | undefined> {
    try {
      const [row] = await db.select({
      id: biometricCredentials.id,
      employeeId: biometricCredentials.employeeId,
      employeeName: biometricCredentials.employeeName,
      branchId: biometricCredentials.branchId,
      credentialId: biometricCredentials.credentialId,
      publicKey: biometricCredentials.publicKey,
      counter: biometricCredentials.counter,
      deviceInfo: biometricCredentials.deviceInfo,
      registeredBy: biometricCredentials.registeredBy,
      isActive: biometricCredentials.isActive,
      lastUsedAt: biometricCredentials.lastUsedAt,
      createdAt: biometricCredentials.createdAt,
      deviceType: biometricCredentials.deviceType,
      deviceModel: biometricCredentials.deviceModel,
      registrationMethod: biometricCredentials.registrationMethod,
      registeredByName: biometricCredentials.registeredByName,
      deactivatedAt: biometricCredentials.deactivatedAt,
      deactivatedBy: biometricCredentials.deactivatedBy,
      deactivationReason: biometricCredentials.deactivationReason,
      usageCount: biometricCredentials.usageCount,
    }).from(biometricCredentials)
        .where(and(eq(biometricCredentials.credentialId, credentialId), eq(biometricCredentials.isActive, true)));
      if (row) return { ...row, verificationPin: null } as BiometricCredential;
      const altId = credentialId.includes('+') || credentialId.includes('/')
        ? credentialId.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
        : credentialId.replace(/-/g, '+').replace(/_/g, '/');
      const [altRow] = await db.select({
      id: biometricCredentials.id,
      employeeId: biometricCredentials.employeeId,
      employeeName: biometricCredentials.employeeName,
      branchId: biometricCredentials.branchId,
      credentialId: biometricCredentials.credentialId,
      publicKey: biometricCredentials.publicKey,
      counter: biometricCredentials.counter,
      deviceInfo: biometricCredentials.deviceInfo,
      registeredBy: biometricCredentials.registeredBy,
      isActive: biometricCredentials.isActive,
      lastUsedAt: biometricCredentials.lastUsedAt,
      createdAt: biometricCredentials.createdAt,
      deviceType: biometricCredentials.deviceType,
      deviceModel: biometricCredentials.deviceModel,
      registrationMethod: biometricCredentials.registrationMethod,
      registeredByName: biometricCredentials.registeredByName,
      deactivatedAt: biometricCredentials.deactivatedAt,
      deactivatedBy: biometricCredentials.deactivatedBy,
      deactivationReason: biometricCredentials.deactivationReason,
      usageCount: biometricCredentials.usageCount,
    }).from(biometricCredentials)
        .where(and(eq(biometricCredentials.credentialId, altId), eq(biometricCredentials.isActive, true)));
      return altRow ? { ...altRow, verificationPin: null } as BiometricCredential : undefined;
    } catch (error: any) {
      if (error?.code === '42P01') return undefined;
      if (error?.code === '42703') {
        try {
          const result = await pool.query(`SELECT * FROM biometric_credentials WHERE credential_id = $1 AND (is_active = true OR is_active IS NULL) LIMIT 1`, [credentialId]);
          return result.rows.length > 0 ? this.mapRawBiometricCredential(result.rows[0]) : undefined;
        } catch (e: any) {
          if (e?.code === '42P01') return undefined;
          if (e?.code === '42703') {
            const result = await pool.query(`SELECT id, employee_id, credential_id, public_key, counter, created_at FROM biometric_credentials WHERE credential_id = $1 LIMIT 1`, [credentialId]);
            return result.rows.length > 0 ? this.mapRawBiometricCredential(result.rows[0]) : undefined;
          }
          throw e;
        }
      }
      throw error;
    }
  }

  async createBiometricCredential(credential: InsertBiometricCredential): Promise<BiometricCredential> {
    try {
      const result = await pool.query(
        `INSERT INTO biometric_credentials (employee_id, employee_name, branch_id, credential_id, public_key, counter, registration_method, device_type, device_model, device_info, registered_by, registered_by_name, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()) RETURNING *`,
        [
          credential.employeeId, credential.employeeName || '', credential.branchId || '',
          credential.credentialId, credential.publicKey, credential.counter || 0,
          credential.registrationMethod || 'webauthn', credential.deviceType || null,
          credential.deviceModel || null, credential.deviceInfo || null,
          credential.registeredBy || null, credential.registeredByName || null,
          credential.isActive !== undefined ? credential.isActive : true
        ]
      );
      return this.mapRawBiometricCredential(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '42P01') throw new Error("جدول البصمات غير موجود في قاعدة البيانات. يرجى تنفيذ أوامر SQL أولاً");
      throw error;
    }
  }

  async deleteBiometricCredential(id: number): Promise<boolean> {
    try {
      const result = await pool.query(`UPDATE biometric_credentials SET is_active = false WHERE id = $1 RETURNING id`, [id]);
      return (result.rowCount || 0) > 0;
    } catch (error: any) {
      if (error?.code === '42P01') return false;
      throw error;
    }
  }

  async updateBiometricCredentialCounter(id: number, counter: number): Promise<void> {
    try {
      await pool.query(`UPDATE biometric_credentials SET counter = $1, last_used_at = NOW(), usage_count = COALESCE(usage_count, 0) + 1 WHERE id = $2`, [counter, id]);
    } catch (error: any) {
      if (error?.code === '42P01') return;
    }
  }

  // ============================================
  // Accounting Integration - التكامل المحاسبي
  // ============================================

  async getAllJournalEntries(filters?: { branchId?: string; entryType?: string; status?: string; dateFrom?: string; dateTo?: string; reconciliationStatus?: string }): Promise<AccountingJournalEntry[]> {
    let query = db.select().from(accountingJournalEntries);
    const conditions: any[] = [];
    if (filters?.branchId) conditions.push(eq(accountingJournalEntries.branchId, filters.branchId));
    if (filters?.entryType) conditions.push(eq(accountingJournalEntries.entryType, filters.entryType));
    if (filters?.status) conditions.push(eq(accountingJournalEntries.status, filters.status));
    if (filters?.reconciliationStatus) conditions.push(eq(accountingJournalEntries.reconciliationStatus, filters.reconciliationStatus));
    if (filters?.dateFrom) conditions.push(gte(accountingJournalEntries.entryDate, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lte(accountingJournalEntries.entryDate, filters.dateTo));
    if (conditions.length > 0) {
      return db.select().from(accountingJournalEntries).where(and(...conditions)).orderBy(desc(accountingJournalEntries.entryDate));
    }
    return db.select().from(accountingJournalEntries).orderBy(desc(accountingJournalEntries.entryDate));
  }

  async getJournalEntry(id: number): Promise<AccountingJournalEntry | undefined> {
    const [entry] = await db.select().from(accountingJournalEntries).where(eq(accountingJournalEntries.id, id));
    return entry || undefined;
  }

  async getJournalEntryLines(journalEntryId: number): Promise<JournalEntryLine[]> {
    return db.select().from(journalEntryLines).where(eq(journalEntryLines.journalEntryId, journalEntryId)).orderBy(journalEntryLines.lineNumber);
  }

  async createJournalEntry(entry: InsertAccountingJournalEntry, lines: InsertJournalEntryLine[]): Promise<AccountingJournalEntry> {
    const [created] = await db.insert(accountingJournalEntries).values(entry).returning();
    if (lines.length > 0) {
      const linesWithId = lines.map(l => ({ ...l, journalEntryId: created.id }));
      await db.insert(journalEntryLines).values(linesWithId);
    }
    return created;
  }

  async updateJournalEntry(id: number, data: Partial<AccountingJournalEntry>): Promise<AccountingJournalEntry | undefined> {
    const [updated] = await db.update(accountingJournalEntries).set(data).where(eq(accountingJournalEntries.id, id)).returning();
    return updated || undefined;
  }

  async generateNextEntryNumber(): Promise<string> {
    const result = await pool.query(`SELECT COUNT(*) as count FROM accounting_journal_entries`);
    const count = parseInt(result.rows[0].count) + 1;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `JE-${year}${month}-${String(count).padStart(5, '0')}`;
  }

  async generateSalesJournalEntries(dateFrom: string, dateTo: string, branchId?: string): Promise<AccountingJournalEntry[]> {
    let conditions: any[] = [
      gte(cashierSalesJournals.journalDate, dateFrom),
      lte(cashierSalesJournals.journalDate, dateTo),
    ];
    if (branchId) conditions.push(eq(cashierSalesJournals.branchId, branchId));

    const journals = await db.select().from(cashierSalesJournals).where(and(...conditions));
    const entries: AccountingJournalEntry[] = [];

    for (const journal of journals) {
      const entryNumber = await this.generateNextEntryNumber();
      const totalSales = parseFloat(String(journal.totalSales || 0));
      const vatAmount = totalSales * 0.15;
      const totalWithVat = totalSales + vatAmount;
      const cashAmount = parseFloat(String(journal.cashTotal || 0));
      const cardAmount = parseFloat(String(journal.networkTotal || 0));

      const lines: InsertJournalEntryLine[] = [];
      let lineNum = 1;

      if (cashAmount > 0) {
        lines.push({ journalEntryId: 0, lineNumber: lineNum++, accountCode: '1101', accountName: 'الصندوق', description: `مبيعات نقدية - ${journal.journalDate}`, debitAmount: String(cashAmount), creditAmount: '0', costCenter: journal.branchId || undefined });
      }
      if (cardAmount > 0) {
        lines.push({ journalEntryId: 0, lineNumber: lineNum++, accountCode: '1103', accountName: 'نقاط البيع (مدى/فيزا)', description: `مبيعات إلكترونية - ${journal.journalDate}`, debitAmount: String(cardAmount), creditAmount: '0', costCenter: journal.branchId || undefined });
      }
      lines.push({ journalEntryId: 0, lineNumber: lineNum++, accountCode: '4100', accountName: 'إيرادات المبيعات', description: `إيرادات مبيعات - ${journal.journalDate}`, debitAmount: '0', creditAmount: String(totalSales), costCenter: journal.branchId || undefined });
      if (vatAmount > 0) {
        lines.push({ journalEntryId: 0, lineNumber: lineNum++, accountCode: '2100', accountName: 'ضريبة القيمة المضافة المستحقة', description: `ض.ق.م على المبيعات - ${journal.journalDate}`, debitAmount: '0', creditAmount: String(vatAmount.toFixed(2)), costCenter: journal.branchId || undefined });
      }

      const entry = await this.createJournalEntry({
        entryNumber,
        entryDate: journal.journalDate,
        entryType: 'sales',
        description: `قيد مبيعات يومية - ${journal.branchId || 'عام'} - ${journal.journalDate}`,
        branchId: journal.branchId || null,
        referenceType: 'cashier_journal',
        referenceId: String(journal.id),
        totalDebit: String(totalWithVat.toFixed(2)),
        totalCredit: String(totalWithVat.toFixed(2)),
        vatAmount: String(vatAmount.toFixed(2)),
        status: 'draft',
        reconciliationStatus: 'pending',
      }, lines);

      entries.push(entry);
    }
    return entries;
  }

  async generateWasteJournalEntries(dateFrom: string, dateTo: string, branchId?: string): Promise<AccountingJournalEntry[]> {
    let conditions: any[] = [
      gte(wasteReports.reportDate, dateFrom),
      lte(wasteReports.reportDate, dateTo),
      eq(wasteReports.status, 'approved'),
    ];
    if (branchId) conditions.push(eq(wasteReports.branchId, branchId));

    const reports = await db.select().from(wasteReports).where(and(...conditions));
    const entries: AccountingJournalEntry[] = [];

    for (const report of reports) {
      const items = await db.select().from(wasteItems).where(eq(wasteItems.wasteReportId, report.id));
      const totalWasteValue = items.reduce((sum, item) => sum + parseFloat(String(item.totalValue || 0)), 0);
      if (totalWasteValue <= 0) continue;

      const entryNumber = await this.generateNextEntryNumber();
      const lines: InsertJournalEntryLine[] = [
        { journalEntryId: 0, lineNumber: 1, accountCode: '5400', accountName: 'الهالك والتالف', description: `هالك - ${report.reportDate}`, debitAmount: String(totalWasteValue.toFixed(2)), creditAmount: '0', costCenter: report.branchId || undefined },
        { journalEntryId: 0, lineNumber: 2, accountCode: '1203', accountName: 'مخزون العرض (Display Bar)', description: `تخفيض مخزون العرض - ${report.reportDate}`, debitAmount: '0', creditAmount: String(totalWasteValue.toFixed(2)), costCenter: report.branchId || undefined },
      ];

      const entry = await this.createJournalEntry({
        entryNumber,
        entryDate: report.reportDate,
        entryType: 'waste',
        description: `قيد هالك - ${report.branchId || 'عام'} - ${report.reportDate}`,
        branchId: report.branchId || null,
        referenceType: 'waste_report',
        referenceId: String(report.id),
        totalDebit: String(totalWasteValue.toFixed(2)),
        totalCredit: String(totalWasteValue.toFixed(2)),
        status: 'draft',
        reconciliationStatus: 'pending',
      }, lines);

      entries.push(entry);
    }
    return entries;
  }

  // Reconciliation methods
  async getAllReconciliations(filters?: { branchId?: string; status?: string }): Promise<AccountingReconciliation[]> {
    const conditions: any[] = [];
    if (filters?.branchId) conditions.push(eq(accountingReconciliations.branchId, filters.branchId));
    if (filters?.status) conditions.push(eq(accountingReconciliations.status, filters.status));
    if (conditions.length > 0) {
      return db.select().from(accountingReconciliations).where(and(...conditions)).orderBy(desc(accountingReconciliations.createdAt));
    }
    return db.select().from(accountingReconciliations).orderBy(desc(accountingReconciliations.createdAt));
  }

  async getReconciliation(id: number): Promise<AccountingReconciliation | undefined> {
    const [rec] = await db.select().from(accountingReconciliations).where(eq(accountingReconciliations.id, id));
    return rec || undefined;
  }

  async createReconciliation(data: InsertAccountingReconciliation): Promise<AccountingReconciliation> {
    const [created] = await db.insert(accountingReconciliations).values(data).returning();
    return created;
  }

  async updateReconciliation(id: number, data: Partial<AccountingReconciliation>): Promise<AccountingReconciliation | undefined> {
    const [updated] = await db.update(accountingReconciliations).set(data).where(eq(accountingReconciliations.id, id)).returning();
    return updated || undefined;
  }

  async generateReconciliation(periodFrom: string, periodTo: string, branchId?: string, userId?: string): Promise<AccountingReconciliation> {
    let salesConditions: any[] = [
      gte(cashierSalesJournals.journalDate, periodFrom),
      lte(cashierSalesJournals.journalDate, periodTo),
    ];
    if (branchId) salesConditions.push(eq(cashierSalesJournals.branchId, branchId));

    const journals = await db.select().from(cashierSalesJournals).where(and(...salesConditions));
    const totalSystemSales = journals.reduce((sum, j) => sum + parseFloat(String(j.totalSales || 0)), 0);
    const totalActualDeposits = journals.reduce((sum, j) => sum + parseFloat(String(j.cashTotal || 0)) + parseFloat(String(j.networkTotal || 0)), 0);
    const totalVariance = totalActualDeposits - totalSystemSales;
    const vatCollected = totalSystemSales * 0.15;

    let wasteConditions: any[] = [
      gte(wasteReports.reportDate, periodFrom),
      lte(wasteReports.reportDate, periodTo),
      eq(wasteReports.status, 'approved'),
    ];
    if (branchId) wasteConditions.push(eq(wasteReports.branchId, branchId));
    const wasteReps = await db.select().from(wasteReports).where(and(...wasteConditions));
    let totalWasteValue = 0;
    for (const wr of wasteReps) {
      const items = await db.select().from(wasteItems).where(eq(wasteItems.wasteReportId, wr.id));
      totalWasteValue += items.reduce((sum, item) => sum + parseFloat(String(item.totalValue || 0)), 0);
    }

    let entryConditions: any[] = [
      gte(accountingJournalEntries.entryDate, periodFrom),
      lte(accountingJournalEntries.entryDate, periodTo),
    ];
    if (branchId) entryConditions.push(eq(accountingJournalEntries.branchId, branchId));
    const entries = await db.select().from(accountingJournalEntries).where(and(...entryConditions));
    const matchedCount = entries.filter(e => e.reconciliationStatus === 'matched').length;
    const discrepancyCount = entries.filter(e => e.reconciliationStatus === 'discrepancy').length;

    const { date: today } = getSaudiArabiaTime();

    return this.createReconciliation({
      reconciliationDate: today,
      periodFrom,
      periodTo,
      branchId: branchId || null,
      totalSystemSales: String(totalSystemSales.toFixed(2)),
      totalActualDeposits: String(totalActualDeposits.toFixed(2)),
      totalVariance: String(totalVariance.toFixed(2)),
      totalWasteValue: String(totalWasteValue.toFixed(2)),
      vatCollected: String(vatCollected.toFixed(2)),
      netVat: String(vatCollected.toFixed(2)),
      entriesCount: entries.length,
      matchedCount,
      discrepancyCount,
      status: 'draft',
      preparedBy: userId || null,
    });
  }

  // Chart of Accounts
  async getAllChartOfAccounts(): Promise<ChartOfAccount[]> {
    return db.select().from(chartOfAccounts).orderBy(chartOfAccounts.accountCode);
  }

  async createChartOfAccount(data: InsertChartOfAccount): Promise<ChartOfAccount> {
    const [created] = await db.insert(chartOfAccounts).values(data).returning();
    return created;
  }

  async updateChartOfAccount(id: number, data: Partial<ChartOfAccount>): Promise<ChartOfAccount | undefined> {
    const [updated] = await db.update(chartOfAccounts).set(data).where(eq(chartOfAccounts.id, id)).returning();
    return updated || undefined;
  }

  async getJournalEntrySummary(dateFrom: string, dateTo: string, branchId?: string): Promise<any> {
    let conditions: any[] = [
      gte(accountingJournalEntries.entryDate, dateFrom),
      lte(accountingJournalEntries.entryDate, dateTo),
    ];
    if (branchId) conditions.push(eq(accountingJournalEntries.branchId, branchId));
    const entries = await db.select().from(accountingJournalEntries).where(and(...conditions));

    const byType: Record<string, { count: number; totalDebit: number; totalCredit: number }> = {};
    for (const e of entries) {
      if (!byType[e.entryType]) byType[e.entryType] = { count: 0, totalDebit: 0, totalCredit: 0 };
      byType[e.entryType].count++;
      byType[e.entryType].totalDebit += parseFloat(String(e.totalDebit || 0));
      byType[e.entryType].totalCredit += parseFloat(String(e.totalCredit || 0));
    }

    return {
      totalEntries: entries.length,
      totalDebit: entries.reduce((s, e) => s + parseFloat(String(e.totalDebit || 0)), 0),
      totalCredit: entries.reduce((s, e) => s + parseFloat(String(e.totalCredit || 0)), 0),
      byType,
      byStatus: {
        draft: entries.filter(e => e.status === 'draft').length,
        posted: entries.filter(e => e.status === 'posted').length,
        reconciled: entries.filter(e => e.status === 'reconciled').length,
      },
      byReconciliation: {
        pending: entries.filter(e => e.reconciliationStatus === 'pending').length,
        matched: entries.filter(e => e.reconciliationStatus === 'matched').length,
        discrepancy: entries.filter(e => e.reconciliationStatus === 'discrepancy').length,
        resolved: entries.filter(e => e.reconciliationStatus === 'resolved').length,
      },
    };
  }

  // System Notifications
  async getAllSystemNotifications(): Promise<SystemNotification[]> {
    return await db.select().from(systemNotifications).orderBy(desc(systemNotifications.createdAt));
  }

  async getSystemNotification(id: number): Promise<SystemNotification | undefined> {
    const [notification] = await db.select().from(systemNotifications).where(eq(systemNotifications.id, id));
    return notification || undefined;
  }

  async createSystemNotification(notification: InsertSystemNotification): Promise<SystemNotification> {
    const [created] = await db.insert(systemNotifications).values(notification).returning();
    return created;
  }

  async updateSystemNotification(id: number, notification: Partial<InsertSystemNotification>): Promise<SystemNotification | undefined> {
    const [updated] = await db.update(systemNotifications)
      .set({ ...notification, updatedAt: new Date() })
      .where(eq(systemNotifications.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSystemNotification(id: number): Promise<boolean> {
    const result = await db.delete(systemNotifications).where(eq(systemNotifications.id, id)).returning();
    return result.length > 0;
  }

  async getActiveNotificationsForUser(userId: string, branchId: string): Promise<SystemNotification[]> {
    const now = new Date();
    const allActive = await db.select().from(systemNotifications)
      .where(and(
        eq(systemNotifications.isActive, true),
        or(isNull(systemNotifications.startDate), lte(systemNotifications.startDate, now)),
        or(isNull(systemNotifications.endDate), gte(systemNotifications.endDate, now)),
      ))
      .orderBy(desc(systemNotifications.priority), desc(systemNotifications.createdAt));

    const reads = await db.select().from(notificationReads)
      .where(eq(notificationReads.userId, userId));
    const dismissedIds = new Set(reads.filter(r => r.dismissed).map(r => r.notificationId));
    const readOnceIds = new Set(reads.map(r => r.notificationId));

    return allActive.filter(n => {
      if (dismissedIds.has(n.id)) return false;
      if (n.showOnce && readOnceIds.has(n.id)) return false;
      if (!n.targetAllBranches && n.targetBranchIds && !n.targetBranchIds.includes(branchId)) return false;
      if (n.displayTimeStart || n.displayTimeEnd) {
        const nowTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        if (n.displayTimeStart && nowTime < n.displayTimeStart) return false;
        if (n.displayTimeEnd && nowTime > n.displayTimeEnd) return false;
      }
      return true;
    });
  }

  async markNotificationRead(notificationId: number, userId: string): Promise<NotificationRead> {
    const [existing] = await db.select().from(notificationReads)
      .where(and(eq(notificationReads.notificationId, notificationId), eq(notificationReads.userId, userId)));
    if (existing) return existing;
    const [created] = await db.insert(notificationReads)
      .values({ notificationId, userId, dismissed: false })
      .returning();
    return created;
  }

  async dismissNotification(notificationId: number, userId: string): Promise<NotificationRead> {
    const [existing] = await db.select().from(notificationReads)
      .where(and(eq(notificationReads.notificationId, notificationId), eq(notificationReads.userId, userId)));
    if (existing) {
      const [updated] = await db.update(notificationReads)
        .set({ dismissed: true })
        .where(eq(notificationReads.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(notificationReads)
      .values({ notificationId, userId, dismissed: true })
      .returning();
    return created;
  }

  async getNotificationReadsByUser(userId: string): Promise<NotificationRead[]> {
    return await db.select().from(notificationReads).where(eq(notificationReads.userId, userId));
  }

  async getNotificationReadStats(): Promise<{ notificationId: number; readCount: number; dismissedCount: number; readers: { userId: string; username: string; readAt: Date; dismissed: boolean }[] }[]> {
    const allReads = await db.select().from(notificationReads);
    const allNotifications = await db.select({ id: systemNotifications.id }).from(systemNotifications);
    const userIds = [...new Set(allReads.map(r => r.userId))];
    const userMap = new Map<string, string>();
    if (userIds.length > 0) {
      const userRows = await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, userIds));
      userRows.forEach(u => userMap.set(u.id, u.username));
    }
    const statsMap = new Map<number, { readCount: number; dismissedCount: number; readers: { userId: string; username: string; readAt: Date; dismissed: boolean }[] }>();
    allNotifications.forEach(n => statsMap.set(n.id, { readCount: 0, dismissedCount: 0, readers: [] }));
    allReads.forEach(r => {
      let entry = statsMap.get(r.notificationId);
      if (!entry) {
        entry = { readCount: 0, dismissedCount: 0, readers: [] };
        statsMap.set(r.notificationId, entry);
      }
      entry.readCount++;
      if (r.dismissed) entry.dismissedCount++;
      entry.readers.push({
        userId: r.userId,
        username: userMap.get(r.userId) || r.userId,
        readAt: r.readAt!,
        dismissed: r.dismissed || false,
      });
    });
    return Array.from(statsMap.entries()).map(([notificationId, data]) => ({ notificationId, ...data }));
  }

  // Event POS - Branch Products
  async getBranchProducts(branchId: string): Promise<any[]> {
    const results = await db
      .select({
        id: branchProducts.id,
        branchId: branchProducts.branchId,
        productId: branchProducts.productId,
        isActive: branchProducts.isActive,
        priceOverride: branchProducts.priceOverride,
        sortOrder: branchProducts.sortOrder,
        createdAt: branchProducts.createdAt,
        productName: products.name,
        productCategory: products.category,
        productPrice: products.basePrice,
        productUnit: products.unit,
        productVatRate: products.vatRate,
      })
      .from(branchProducts)
      .leftJoin(products, eq(branchProducts.productId, products.id))
      .where(eq(branchProducts.branchId, branchId))
      .orderBy(branchProducts.sortOrder);
    return results.map(r => ({
      id: r.id,
      branchId: r.branchId,
      productId: r.productId,
      isActive: r.isActive,
      priceOverride: r.priceOverride,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
      product: {
        id: r.productId,
        name: r.productName,
        category: r.productCategory,
        basePrice: r.productPrice,
        unit: r.productUnit,
        vatRate: r.productVatRate ?? 0.15,
      },
    }));
  }

  async addBranchProduct(data: InsertBranchProduct): Promise<BranchProduct> {
    const [result] = await db.insert(branchProducts).values(data).returning();
    return result;
  }

  async getBranchProductById(id: number): Promise<BranchProduct | undefined> {
    const [result] = await db.select().from(branchProducts).where(eq(branchProducts.id, id));
    return result || undefined;
  }

  async removeBranchProduct(id: number): Promise<boolean> {
    const result = await db.delete(branchProducts).where(eq(branchProducts.id, id));
    return true;
  }

  async updateBranchProduct(id: number, data: Partial<InsertBranchProduct>): Promise<BranchProduct | undefined> {
    const [result] = await db.update(branchProducts).set(data).where(eq(branchProducts.id, id)).returning();
    return result || undefined;
  }

  // Event POS - Invoice Settings
  async getPosInvoiceSettings(branchId: string): Promise<PosInvoiceSettings | undefined> {
    const [result] = await db.select().from(posInvoiceSettings).where(eq(posInvoiceSettings.branchId, branchId));
    return result || undefined;
  }

  async upsertPosInvoiceSettings(data: InsertPosInvoiceSettings): Promise<PosInvoiceSettings> {
    const existing = await this.getPosInvoiceSettings(data.branchId);
    if (existing) {
      const [result] = await db
        .update(posInvoiceSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(posInvoiceSettings.branchId, data.branchId))
        .returning();
      return result;
    } else {
      const [result] = await db.insert(posInvoiceSettings).values(data).returning();
      return result;
    }
  }

  async incrementInvoiceNumber(branchId: string): Promise<number> {
    const [result] = await db
      .update(posInvoiceSettings)
      .set({ nextInvoiceNumber: sql`${posInvoiceSettings.nextInvoiceNumber} + 1` })
      .where(eq(posInvoiceSettings.branchId, branchId))
      .returning({ nextInvoiceNumber: posInvoiceSettings.nextInvoiceNumber });
    if (result) {
      return result.nextInvoiceNumber - 1;
    }
    const [newSettings] = await db
      .insert(posInvoiceSettings)
      .values({ branchId, businessName: '', vatNumber: '', nextInvoiceNumber: 2 })
      .returning({ nextInvoiceNumber: posInvoiceSettings.nextInvoiceNumber });
    return 1;
  }

  // Event POS - Sales
  async createPosSale(sale: InsertPosSale, items: InsertPosSaleItem[]): Promise<PosSale> {
    return await db.transaction(async (tx) => {
      const [newSale] = await tx.insert(posSales).values(sale).returning();
      if (items && items.length > 0) {
        const saleItems = items.map(item => ({ ...item, saleId: newSale.id }));
        await tx.insert(posSaleItems).values(saleItems);
      }
      return newSale;
    });
  }

  async getPosSales(branchId: string, dateFrom?: string, dateTo?: string): Promise<PosSale[]> {
    const conditions = [eq(posSales.branchId, branchId)];
    if (dateFrom) conditions.push(gte(posSales.saleDate, dateFrom));
    if (dateTo) conditions.push(lte(posSales.saleDate, dateTo));
    return await db.select().from(posSales).where(and(...conditions)).orderBy(desc(posSales.createdAt));
  }

  async getPosSaleById(id: number): Promise<PosSale | undefined> {
    const [result] = await db.select().from(posSales).where(eq(posSales.id, id));
    return result || undefined;
  }

  async getPosSaleItems(saleId: number): Promise<PosSaleItem[]> {
    return await db.select().from(posSaleItems).where(eq(posSaleItems.saleId, saleId));
  }

  async getPosSalesSummary(branchId: string, date: string): Promise<{ totalSales: number; totalTransactions: number; cashTotal: number; networkTotal: number }> {
    const [result] = await db.execute(sql`
      SELECT 
        COALESCE(SUM(total_amount), 0) as "totalSales",
        COUNT(*) as "totalTransactions",
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as "cashTotal",
        COALESCE(SUM(CASE WHEN payment_method != 'cash' THEN total_amount ELSE 0 END), 0) as "networkTotal"
      FROM pos_sales 
      WHERE branch_id = ${branchId} AND sale_date = ${date} AND status = 'completed'
    `);
    return {
      totalSales: Number(result.totalSales) || 0,
      totalTransactions: Number(result.totalTransactions) || 0,
      cashTotal: Number(result.cashTotal) || 0,
      networkTotal: Number(result.networkTotal) || 0,
    };
  }

  async voidPosSale(saleId: number, reason: string, voidedBy: string): Promise<PosSale | undefined> {
    const [sale] = await db.select().from(posSales).where(eq(posSales.id, saleId));
    if (!sale || sale.status !== 'completed') return undefined;
    const [updated] = await db.update(posSales).set({
      status: 'voided',
      voidReason: reason,
      voidedBy,
      voidedAt: new Date(),
    }).where(eq(posSales.id, saleId)).returning();
    return updated || undefined;
  }

  async refundPosSale(saleId: number, reason: string, refundedBy: string): Promise<PosSale | undefined> {
    const [sale] = await db.select().from(posSales).where(eq(posSales.id, saleId));
    if (!sale || sale.status !== 'completed') return undefined;
    const [updated] = await db.update(posSales).set({
      status: 'refunded',
      refundReason: reason,
      refundedBy,
      refundedAt: new Date(),
    }).where(eq(posSales.id, saleId)).returning();
    return updated || undefined;
  }

  async createHeldOrder(data: InsertPosHeldOrder): Promise<PosHeldOrder> {
    const [order] = await db.insert(posHeldOrders).values(data).returning();
    return order;
  }

  async getHeldOrders(branchId: string): Promise<PosHeldOrder[]> {
    return await db.select().from(posHeldOrders)
      .where(eq(posHeldOrders.branchId, branchId))
      .orderBy(desc(posHeldOrders.createdAt));
  }

  async deleteHeldOrder(id: number): Promise<boolean> {
    const result = await db.delete(posHeldOrders).where(eq(posHeldOrders.id, id)).returning();
    return result.length > 0;
  }

  async getPosSalesReport(branchId: string, startDate: string, endDate: string): Promise<any> {
    const summaryResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) as "totalSales",
        COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as "totalTransactions",
        COALESCE(SUM(CASE WHEN status = 'completed' AND payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as "cashTotal",
        COALESCE(SUM(CASE WHEN status = 'completed' AND payment_method = 'network' THEN total_amount ELSE 0 END), 0) as "networkTotal",
        COALESCE(SUM(CASE WHEN status = 'completed' AND payment_method = 'split' THEN total_amount ELSE 0 END), 0) as "splitTotal",
        COALESCE(SUM(CASE WHEN status = 'voided' THEN 1 ELSE 0 END), 0) as "voidedCount",
        COALESCE(SUM(CASE WHEN status = 'voided' THEN total_amount ELSE 0 END), 0) as "voidedAmount",
        COALESCE(SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END), 0) as "refundedCount",
        COALESCE(SUM(CASE WHEN status = 'refunded' THEN total_amount ELSE 0 END), 0) as "refundedAmount",
        COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(discount_amount, 0) ELSE 0 END), 0) as "discountTotal",
        COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(vat_amount, 0) ELSE 0 END), 0) as "vatTotal"
      FROM pos_sales 
      WHERE branch_id = ${branchId} AND sale_date >= ${startDate} AND sale_date <= ${endDate}
    `);
    const summary: any = (summaryResult as any).rows?.[0] || summaryResult[0] || {};

    const dailyResult = await db.execute(sql`
      SELECT sale_date as "date", 
        COALESCE(SUM(total_amount), 0) as "sales",
        COUNT(*) as "transactions"
      FROM pos_sales 
      WHERE branch_id = ${branchId} AND sale_date >= ${startDate} AND sale_date <= ${endDate} AND status = 'completed'
      GROUP BY sale_date ORDER BY sale_date
    `);
    const dailySalesRows: any[] = (dailyResult as any).rows || dailyResult || [];

    const paymentResult = await db.execute(sql`
      SELECT payment_method as "method",
        COALESCE(SUM(total_amount), 0) as "amount",
        COUNT(*) as "count"
      FROM pos_sales 
      WHERE branch_id = ${branchId} AND sale_date >= ${startDate} AND sale_date <= ${endDate} AND status = 'completed'
      GROUP BY payment_method
    `);
    const paymentRows: any[] = (paymentResult as any).rows || paymentResult || [];

    const productSalesResult = await db.execute(sql`
      SELECT 
        psi.product_id as "productId",
        psi.product_name as "productName",
        SUM(psi.quantity) as "totalQuantity",
        SUM(psi.total_price) as "totalRevenue",
        SUM(psi.vat_amount) as "totalVat",
        COUNT(DISTINCT psi.sale_id) as "invoiceCount",
        ROUND(AVG(psi.unit_price)::numeric, 2) as "avgPrice"
      FROM pos_sale_items psi
      INNER JOIN pos_sales ps ON psi.sale_id = ps.id
      WHERE ps.branch_id = ${branchId} AND ps.sale_date >= ${startDate} AND ps.sale_date <= ${endDate} AND ps.status = 'completed'
      GROUP BY psi.product_id, psi.product_name
      ORDER BY SUM(psi.total_price) DESC
    `);
    const productSalesRows: any[] = (productSalesResult as any).rows || productSalesResult || [];

    return {
      totalSales: Number(summary.totalSales) || 0,
      totalTransactions: Number(summary.totalTransactions) || 0,
      cashTotal: Number(summary.cashTotal) || 0,
      networkTotal: Number(summary.networkTotal) || 0,
      splitTotal: Number(summary.splitTotal) || 0,
      voidedCount: Number(summary.voidedCount) || 0,
      voidedAmount: Number(summary.voidedAmount) || 0,
      refundedCount: Number(summary.refundedCount) || 0,
      refundedAmount: Number(summary.refundedAmount) || 0,
      discountTotal: Number(summary.discountTotal) || 0,
      vatTotal: Number(summary.vatTotal) || 0,
      dailySales: Array.isArray(dailySalesRows) ? dailySalesRows.map((r: any) => ({ date: r.date, sales: Number(r.sales) || 0, transactions: Number(r.transactions) || 0 })) : [],
      paymentBreakdown: Array.isArray(paymentRows) ? paymentRows.map((r: any) => ({ method: r.method, amount: Number(r.amount) || 0, count: Number(r.count) || 0 })) : [],
      productSales: Array.isArray(productSalesRows) ? productSalesRows.map((r: any) => ({
        productId: Number(r.productId) || 0,
        productName: r.productName || '',
        totalQuantity: Number(r.totalQuantity) || 0,
        totalRevenue: Number(r.totalRevenue) || 0,
        totalVat: Number(r.totalVat) || 0,
        invoiceCount: Number(r.invoiceCount) || 0,
        avgPrice: Number(r.avgPrice) || 0,
      })) : [],
    };
  }

  async getPosProductSalesDetails(branchId: string, startDate: string, endDate: string): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT 
        psi.product_name as "productName",
        psi.quantity as "quantity",
        psi.unit_price as "unitPrice",
        psi.total_price as "totalPrice",
        psi.vat_amount as "vatAmount",
        ps.sale_date as "saleDate",
        ps.payment_method as "paymentMethod",
        ps.invoice_number as "invoiceNumber"
      FROM pos_sale_items psi
      INNER JOIN pos_sales ps ON psi.sale_id = ps.id
      WHERE ps.branch_id = ${branchId} 
        AND ps.sale_date >= ${startDate} 
        AND ps.sale_date <= ${endDate} 
        AND ps.status = 'completed'
      ORDER BY ps.sale_date DESC, psi.product_name
    `);
    const rows: any[] = (result as any).rows || result || [];
    return rows.map((r: any) => ({
      productName: r.productName || '',
      quantity: Number(r.quantity) || 0,
      unitPrice: Number(r.unitPrice) || 0,
      totalPrice: Number(r.totalPrice) || 0,
      vatAmount: Number(r.vatAmount) || 0,
      saleDate: r.saleDate || '',
      paymentMethod: r.paymentMethod || '',
      invoiceNumber: r.invoiceNumber || '',
    }));
  }
}

export const storage = new DatabaseStorage();
