import { z } from "zod";
import { MODULE_ACTIONS, MODULE_LABELS, SYSTEM_MODULES } from "./schema";

/** Catalog is vocabulary, not authority to grant or apply any draft. */
export const JOB_TEMPLATE_MODULES = SYSTEM_MODULES.map(id => ({
  id, label: MODULE_LABELS[id], actions: [...MODULE_ACTIONS],
}));

export const templateContentSchema = z.object({
  key: z.string().trim().min(1).max(80).regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000),
  scopeType: z.enum(["branch", "branches", "self", "assigned_tasks"]),
  assignmentAuthority: z.enum(["admin", "delegated_operations"]),
  permissions: z.array(z.object({
    module: z.enum(SYSTEM_MODULES),
    actions: z.array(z.enum(MODULE_ACTIONS)).max(MODULE_ACTIONS.length)
      .refine(actions => new Set(actions).size === actions.length, "Duplicate actions"),
  }).strict()).max(SYSTEM_MODULES.length)
    .refine(permissions => new Set(permissions.map(p => p.module)).size === permissions.length, "Duplicate modules"),
  reviewNotes: z.string().trim().max(8000),
}).strict();

export const createTemplateDraftSchema = z.object({ content: templateContentSchema }).strict();
export const appendTemplateVersionSchema = z.object({
  expectedLatestVersion: z.number().int().positive().max(2147483646),
  content: templateContentSchema,
  changeReason: z.string().trim().min(1).max(2000),
}).strict();

export const approveTemplateVersionSchema = z.object({
  version: z.number().int().positive().max(2147483647),
  expectedLatestVersion: z.number().int().positive().max(2147483647),
  reason: z.string().trim().min(1).max(2000),
  reviewed: z.literal(true),
  acknowledgeEmptyPermissions: z.literal(true).optional(),
}).strict();
export type ApproveTemplateVersionInput = z.infer<typeof approveTemplateVersionSchema>;
export interface TemplateApproval {
  version: number;
  reason: string;
  approvedAt: string;
  approvedBy: string;
}

export type TemplateContent = z.infer<typeof templateContentSchema>;
export interface TemplateVersion {
  version: number;
  content: TemplateContent;
  changeReason: string;
  createdAt: string;
  createdBy: string;
  status: "draft";
}
export interface TemplateDetail { id: number; versions: TemplateVersion[]; approvals: TemplateApproval[] }
export interface TemplateSummary {
  id: number;
  key: string;
  name: string;
  latestVersion: number;
  scopeType: TemplateContent["scopeType"];
  permissionCount: number;
  status: "draft";
  latestVersionApproved?: boolean;
}

const managerReview = "صلاحيات الإدارة غير محسومة وتحتاج مراجعة واعتمادًا منفصلًا. القائمة الفارغة ليست تحديدًا لصلاحيات الدور الفعلية ولا تمنح أي سلطة.";
const employeeReview = "اقتراح غير معتمد؛ ضوابط الإجراء والفرع والملكية والإسناد تبقى مطلوبة. لا يغيّر الحسابات أو صلاحيات البوابة الذاتية.";
export const JOB_TEMPLATE_PROPOSALS: TemplateContent[] = [
  { key: "operations_manager", name: "مدير تشغيل", description: "الإشراف التشغيلي وإدارة الموظفين المفوضين؛ تفاصيل الوحدات قيد المراجعة.", scopeType: "branches", assignmentAuthority: "admin", permissions: [], reviewNotes: managerReview },
  { key: "area_manager", name: "مدير منطقة", description: "إشراف على مجموعة فروع يحددها المسؤول صراحة؛ لا نسخ تلقائي لدور مدير التشغيل.", scopeType: "branches", assignmentAuthority: "admin", permissions: [], reviewNotes: managerReview },
  { key: "branch_manager", name: "مدير فرع", description: "طلبات ومتابعة واستلام فرعه وفق قواعد المستلم؛ تفاصيل صلاحيات الإدارة قيد المراجعة.", scopeType: "branch", assignmentAuthority: "admin", permissions: [], reviewNotes: managerReview },
  { key: "team_leader", name: "تيم ليدر", description: "متابعة مخزون الفرع وإنشاء ومتابعة طلبات التوريد والمطبخ.", scopeType: "branch", assignmentAuthority: "delegated_operations", permissions: [
    { module: "branch_stock", actions: ["view"] },
    { module: "branch_supply", actions: ["view", "create", "edit"] },
    { module: "central_kitchen_orders", actions: ["view", "create", "edit"] },
  ], reviewNotes: `${employeeReview} الحضور والجدولة إضافة منفصلة. edit قد يشمل الاستلام وفق مسار المورد؛ لا فصل ضمني بين الطلب والاستلام.` },
  { key: "cashier", name: "كاشير", description: "عرض وإنشاء يوميات الكاشير فقط.", scopeType: "branch", assignmentAuthority: "delegated_operations", permissions: [{ module: "cashier_journal", actions: ["view", "create"] }], reviewNotes: `${employeeReview} التعديل إضافة منفصلة؛ لا نقطة بيع أو استرجاع أو إغلاق مالي مفترض.` },
  { key: "barista", name: "باريستا", description: "بوابة الموظف الذاتية فقط دون صلاحيات إدارة الفرع.", scopeType: "self", assignmentAuthority: "delegated_operations", permissions: [], reviewNotes: `${employeeReview} مهام الجودة والمخزون والطلبات تحتاج تكليفًا فعليًا منفصلًا.` },
  { key: "chef", name: "شيف", description: "عرض وتسجيل فحوص الجودة.", scopeType: "branch", assignmentAuthority: "delegated_operations", permissions: [{ module: "quality_control", actions: ["view", "create"] }], reviewNotes: `${employeeReview} الإنتاج والوصفات ليست ضمن الأساس؛ المخزون والطلبات إضافات منفصلة.` },
  { key: "worker", name: "عامل", description: "بوابة الموظف الذاتية فقط.", scopeType: "self", assignmentAuthority: "delegated_operations", permissions: [], reviewNotes: `${employeeReview} لا صلاحيات مالية أو مخزون أو بيانات زملاء افتراضية.` },
  { key: "driver", name: "سائق", description: "عرض وتحديث مهام التوصيل المسندة إليه فقط.", scopeType: "assigned_tasks", assignmentAuthority: "delegated_operations", permissions: [{ module: "delivery_tasks", actions: ["view", "edit"] }], reviewNotes: `${employeeReview} لا اعتماد استلام مخزون أو إغلاق نيابة عن المستلم أو إدارة كل المهام؛ لا تغيير للمنح التلقائية الحالية.` },
];