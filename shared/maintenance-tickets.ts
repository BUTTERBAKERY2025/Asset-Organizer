import { z } from "zod";

export const maintenanceTicketPriorities = ["low", "normal", "high", "urgent"] as const;
export const maintenanceTicketStatuses = ["open", "assigned", "in_progress", "closed"] as const;
export const maintenanceTicketActions = ["assign", "start", "close", "reopen"] as const;
const fields = {
  description: z.string().trim().min(1).max(10_000),
  assetId: z.string().trim().min(1).nullable().optional(),
  priority: z.enum(maintenanceTicketPriorities).default("normal"),
  assigneeUserId: z.string().trim().min(1).nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
};
export const maintenanceTicketCreateSchema = z.object({
  branchId: z.string().trim().min(1), ...fields,
}).strict();
export const maintenanceTicketPatchSchema = z.object(fields).partial().extend({
  version: z.number().int().positive(),
}).strict().refine(value => Object.keys(value).some(key => key !== "version"), "يجب إرسال تعديل");
export const maintenanceTicketTransitionSchema = z.object({
  version: z.number().int().positive(),
  action: z.enum(maintenanceTicketActions),
  assigneeUserId: z.string().trim().min(1).optional(),
  reason: z.string().trim().max(10_000).default(""),
}).strict().superRefine((value, ctx) => {
  if (value.action === "reopen" && !value.reason)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "سبب إعادة الفتح مطلوب" });
  if (value.action === "assign" && !value.assigneeUserId)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["assigneeUserId"], message: "المسؤول مطلوب" });
});
export const maintenanceTicketListQuerySchema = z.object({
  branchId: z.string().trim().min(1),
  page: z.coerce.number().int().positive().default(1),
  status: z.enum([...maintenanceTicketStatuses, "active"]).optional(),
  priority: z.enum(maintenanceTicketPriorities).optional(),
  assignee: z.string().trim().min(1).optional(),
  overdue: z.enum(["true", "false"]).optional(),
});
export function getMaintenanceTicketTransition(
  status: typeof maintenanceTicketStatuses[number], action: typeof maintenanceTicketActions[number],
): typeof maintenanceTicketStatuses[number] | null {
  const transitions = {
    assign: { from: ["open", "assigned"], to: "assigned" },
    start: { from: ["assigned"], to: "in_progress" },
    close: { from: ["in_progress"], to: "closed" },
    reopen: { from: ["closed"], to: "open" },
  } as const;
  const transition = transitions[action];
  return (transition.from as readonly string[]).includes(status) ? transition.to : null;
}
export function maintenanceTicketActionPermission(action: typeof maintenanceTicketActions[number]) {
  return action === "close" || action === "reopen" ? "approve" : "edit";
}
export type MaintenanceTicketCreateInput = z.infer<typeof maintenanceTicketCreateSchema>;
export type MaintenanceTicketPatchInput = z.infer<typeof maintenanceTicketPatchSchema>;
export type MaintenanceTicketTransitionInput = z.infer<typeof maintenanceTicketTransitionSchema>;
export const maintenanceTicketsApi = {
  list: "/api/maintenance-tickets",
  summary: "/api/maintenance-tickets/summary",
  options: "/api/maintenance-tickets/options",
  detail: (id: number | string) => `/api/maintenance-tickets/${id}`,
  transition: (id: number | string) => `/api/maintenance-tickets/${id}/transition`,
  attachments: (id: number | string) => `/api/maintenance-tickets/${id}/attachments`,
  attachment: (id: number | string, attachmentId: number | string) => `/api/maintenance-tickets/${id}/attachments/${attachmentId}`,
} as const;