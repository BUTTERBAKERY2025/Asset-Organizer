import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { isAuthenticated, invalidateAuthCache } from "./auth";
import { branchTemplateStorageReady } from "./branch-template-storage";
import { templateAssignmentInput, assignmentSnapshotRevision, eligibleTemplatePermissions } from "./employee-template-assignment-policy";
import { branchMayManage, deny, DelegationError } from "./employee-account-delegation-policy";
import { evaluatePermissionDecision } from "./permission-decision";
import { storage } from "./storage";

/** Reuses the existing authoritative actor/policy/lock and error boundaries. */
export function registerBranchTemplateRoutes(app: any, deps: any) {
  const { db, actorState, policy, lockDelegationState, endpoint } = deps;
  async function preview(tx: any, actorId: string, id: number) {
    if (!Number.isSafeInteger(id) || id < 1) throw new DelegationError(400, "INVALID_EMPLOYEE", "الموظف غير صالح");
    if (!await branchTemplateStorageReady(tx))
      throw new DelegationError(503, "BRANCH_TEMPLATE_MIGRATION_REQUIRED", "تخصيص قالب الفرع يحتاج ترحيل 056 قبل الاستخدام؛ لم تتغير صلاحيات الموظف");
    const { actor, grants } = await actorState(tx, actorId);
    const approved = await policy(tx);
    if (!approved.enabled) deny("DELEGATION_DISABLED", "تفويض إسناد القوالب غير مفعّل");
    const rows = await tx.execute(sql`SELECT e.id, e.employee_name, e.branch_id, e.status,
      e.linked_user_id, u.role, u.is_active, u.job_title
      FROM branch_employees e LEFT JOIN users u ON u.id=e.linked_user_id WHERE e.id=${id}`);
    const employee = rows.rows[0];
    if (!employee) throw new DelegationError(404, "EMPLOYEE_NOT_FOUND", "الموظف غير موجود");
    branchMayManage(actor, employee.branch_id, grants);
    if (employee.status !== "active") deny("EMPLOYEE_INACTIVE", "الموظف غير نشط");
    if (!employee.linked_user_id || employee.linked_user_id === actorId || !["employee", "viewer"].includes(employee.role))
      deny("PROTECTED_ACCOUNT", "يجب ربط حساب موظف عادي؛ الحسابات الإدارية وحسابك الشخصي محمية");
    const duplicates = await tx.execute(sql`SELECT count(*)::integer AS count FROM branch_employees WHERE linked_user_id=${employee.linked_user_id}`);
    if (duplicates.rows[0]?.count !== 1) deny("AMBIGUOUS_ACCOUNT_LINK", "الحساب مرتبط بأكثر من موظف؛ يلزم تصحيح الربط");
    const source = await storage.getPermissionDecisionSnapshot(employee.linked_user_id, tx);
    const baseSource = { ...source, tuples: source.tuples.filter(t => !t.source.startsWith("override")) };
    const current = evaluatePermissionDecision(baseSource, { branchId: employee.branch_id }).filter(p => p.allowed);
    const currentPermissions = [...new Set(current.map(p => p.module))].map(module => ({
      module, actions: current.filter(p => p.module === module).map(p => p.action).sort(),
    }));
    const binding = await tx.execute(sql`SELECT template_id AS "templateId", version, revision::text,
      reason FROM branch_employee_template_assignments WHERE user_id=${employee.linked_user_id} AND branch_id=${employee.branch_id}`);
    const catalog = await tx.execute(sql`SELECT v.template_id AS "templateId",v.version,v.content
      FROM job_permission_template_draft_versions v JOIN job_permission_template_approvals a
      ON a.template_id=v.template_id AND a.version=v.version
      WHERE v.version=(SELECT max(x.version) FROM job_permission_template_draft_versions x WHERE x.template_id=v.template_id)`);
    const templates: any[] = [], excludedTemplates: any[] = [];
    for (const row of catalog.rows) {
      try {
        const { content, permissions } = eligibleTemplatePermissions(row.content, approved, employee.job_title, employee.role);
        const supported = new Set(["cashier_journal", "quality_control", "branch_stock"]);
        const unsupported = permissions.filter(p => !supported.has(p.module));
        if (unsupported.length)
          deny("BRANCH_CONTEXT_NOT_SUPPORTED", `هذا القالب يحتوي وحدات لم يكتمل عزلها حسب الفرع: ${unsupported.map(p => p.module).join("، ")}. لا يمكن إسناده بأمان لهذا النطاق بعد.`);
        templates.push({ templateId: row.templateId, version: row.version, name: content.name, permissions });
      } catch (error) {
        if (!(error instanceof DelegationError)) throw error;
        excludedTemplates.push({ name: row.content.name, reason: error.message });
      }
    }
    const expectedAssignmentRevision = assignmentSnapshotRevision({
      employee, source: { ...source, capturedAt: 0 }, binding: binding.rows,
    }, currentPermissions);
    return { employeeId: id, branchId: employee.branch_id, userId: employee.linked_user_id,
      employeeName: employee.employee_name, isActive: employee.is_active,
      independentPermissions: source.tuples.filter(t => t.source.startsWith("override")).map(t => ({
        module: t.module, action: t.action, deny: t.deny, branchId: t.branchId,
        startsAt: t.startDate, expiresAt: t.expiresAt,
      })),
      currentPermissions, templates, excludedTemplates, assignment: binding.rows[0] ?? null,
      expectedAssignmentRevision };
  }
  const base = "/api/operations/employee-accounts/:employeeId/branch-template";
  app.get(base, isAuthenticated, endpoint(async (req: any, res: any) => {
    const data = await db.transaction((tx: any) => preview(tx, req.session.userId, Number(req.params.employeeId)),
      { isolationLevel: "repeatable read", accessMode: "read only" });
    res.set("Cache-Control", "no-store").json(data);
  }, "branch_template_preview"));
  app.post(base, isAuthenticated, endpoint(async (req: any, res: any) => {
    const input = templateAssignmentInput.parse(req.body);
    const data = await db.transaction(async (tx: any) => {
      await lockDelegationState(tx);
      if (!await branchTemplateStorageReady(tx))
        throw new DelegationError(503, "BRANCH_TEMPLATE_MIGRATION_REQUIRED", "يلزم ترحيل 056");
      await tx.execute(sql`LOCK TABLE branch_employee_template_assignments,
        job_permission_template_drafts, job_permission_template_draft_versions,
        job_permission_template_approvals, user_permission_source_modes IN SHARE ROW EXCLUSIVE MODE`);
      const before = await preview(tx, req.session.userId, Number(req.params.employeeId));
      if (input.branchId !== before.branchId) deny("BRANCH_FORBIDDEN", "فرع الموظف تغير؛ حدّث المعاينة");
      if (input.expectedAssignmentRevision !== before.expectedAssignmentRevision)
        throw new DelegationError(409, "ASSIGNMENT_REVISION_CONFLICT", "تغيّرت الصلاحيات أو بيانات الموظف؛ حدّث المعاينة");
      const template = before.templates.find(t => t.templateId === input.templateId && t.version === input.version);
      if (!template) deny("TEMPLATE_NOT_AVAILABLE", "الإصدار غير مؤهل أو لم يعد أحدث إصدار معتمد");
      const revision = randomUUID();
      await tx.execute(sql`INSERT INTO branch_employee_template_assignments
        (user_id,branch_id,employee_id,template_id,version,revision,assigned_by,reason)
        VALUES (${before.userId},${before.branchId},${before.employeeId},${input.templateId},${input.version},
          ${revision}::uuid,${req.session.userId},${input.reason})
        ON CONFLICT (user_id,branch_id) DO UPDATE SET employee_id=EXCLUDED.employee_id,
          template_id=EXCLUDED.template_id,version=EXCLUDED.version,revision=EXCLUDED.revision,
          assigned_by=EXCLUDED.assigned_by,assigned_at=now(),reason=EXCLUDED.reason`);
      await tx.execute(sql`INSERT INTO system_audit_logs
        (module,entity_id,action,user_id,branch_id,target_id,details)
        VALUES ('employee_account_delegation',${String(before.employeeId)},'branch_template_assignment',
          ${req.session.userId},${before.branchId},${before.userId},
          ${JSON.stringify({ before: before.assignment, after: input, revision, outsideBranchUnchanged: true })})`);
      await storage.invalidateAllUserSessions(before.userId, tx);
      return { userId: before.userId, revision };
    });
    invalidateAuthCache(data.userId);
    res.set("Cache-Control", "no-store").json({ success: true, revision: data.revision });
  }, "branch_template_apply"));
}