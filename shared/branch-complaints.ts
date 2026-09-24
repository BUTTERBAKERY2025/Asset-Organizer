import { z } from "zod";

export const branchComplaintCategories = ["service", "product", "cleanliness", "staff", "other"] as const;
export const branchComplaintPriorities = ["low", "normal", "high", "urgent"] as const;
export const branchComplaintStatuses = ["open", "in_progress", "resolved", "closed"] as const;
export const branchComplaintActions = ["start", "resolve", "close", "reopen"] as const;
// firstRespondedAt means "بدء المعالجة": it is set only by the start action.
// Uploading an attachment is not treated as a response.

const optionalOwner = z.string().trim().min(1).nullable().optional();
const optionalDue = z.coerce.date().nullable().optional();

export const branchComplaintCreateSchema = z.object({
  branchId: z.string().trim().min(1),
  subject: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(10_000),
  category: z.enum(branchComplaintCategories),
  priority: z.enum(branchComplaintPriorities).default("normal"),
  responseDue: optionalDue,
  ownerUserId: optionalOwner,
}).strict();

export const branchComplaintPatchSchema = z.object({
  version: z.number().int().positive(),
  subject: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().min(1).max(10_000).optional(),
  category: z.enum(branchComplaintCategories).optional(),
  priority: z.enum(branchComplaintPriorities).optional(),
  responseDue: optionalDue,
  ownerUserId: optionalOwner,
}).strict().refine((value) => Object.keys(value).some((key) => key !== "version"), {
  message: "يجب إرسال حقل واحد قابل للتعديل على الأقل",
});

export const branchComplaintTransitionSchema = z.object({
  version: z.number().int().positive(),
  action: z.enum(branchComplaintActions),
  reason: z.string().trim().max(10_000).default(""),
  resolution: z.string().trim().max(10_000).optional(),
}).strict().superRefine((value, ctx) => {
  if (["close", "reopen"].includes(value.action) && !value.reason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "السبب مطلوب" });
  }
  if (value.action === "resolve" && !value.resolution) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["resolution"], message: "الحل مطلوب" });
  }
});

export const branchComplaintListQuerySchema = z.object({
  branchId: z.string().trim().min(1),
  page: z.coerce.number().int().positive().default(1),
  status: z.enum(branchComplaintStatuses).optional(),
  priority: z.enum(branchComplaintPriorities).optional(),
  owner: z.string().trim().min(1).optional(),
  unresolved: z.enum(["true", "false"]).optional(),
  overdue: z.enum(["true", "false"]).optional(),
});

export type BranchComplaintCreateInput = z.infer<typeof branchComplaintCreateSchema>;
export type BranchComplaintPatchInput = z.infer<typeof branchComplaintPatchSchema>;
export type BranchComplaintTransitionInput = z.infer<typeof branchComplaintTransitionSchema>;

export function getBranchComplaintTransition(
  status: typeof branchComplaintStatuses[number],
  action: typeof branchComplaintActions[number],
): typeof branchComplaintStatuses[number] | null {
  const transitions = {
    start: { from: ["open"], to: "in_progress" },
    resolve: { from: ["in_progress"], to: "resolved" },
    close: { from: ["resolved"], to: "closed" },
    reopen: { from: ["closed", "resolved"], to: "open" },
  } as const;
  const transition = transitions[action];
  return (transition.from as readonly string[]).includes(status) ? transition.to : null;
}

export const branchComplaintsApi = {
  list: "/api/branch-complaints",
  summary: "/api/branch-complaints/summary",
  assignees: "/api/branch-complaints/assignees",
  detail: (id: number | string) => `/api/branch-complaints/${id}`,
  transition: (id: number | string) => `/api/branch-complaints/${id}/transition`,
  attachments: (id: number | string) => `/api/branch-complaints/${id}/attachments`,
  attachment: (id: number | string, attachmentId: number | string) =>
    `/api/branch-complaints/${id}/attachments/${attachmentId}`,
} as const;