import { useEffect, useRef, useState } from "react";
import type { EmployeeJobTemplatesResponse } from "@shared/employee-account-delegation";
import type { ApprovedEmployeeTemplate, EmployeeAssignmentSnapshot } from "@/lib/employee-template-assignment";
import { employeeTemplateError } from "@/lib/employee-template-assignment";
import { EMPLOYEE_ACCOUNTS_ENDPOINT, requestEmployeeAccount } from "@/lib/employee-account-delegation";

/** Fresh, employee-bound review data. No global cache or credentials. */
export function useEmployeeTemplateAssignment(employeeId: number) {
  const [data, setData] = useState<{ templates: ApprovedEmployeeTemplate[]; excludedTemplates: NonNullable<EmployeeJobTemplatesResponse["excludedTemplates"]>; snapshot: EmployeeAssignmentSnapshot } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const reload = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const token = ++generation.current;
    setLoading(true);
    setData(null);
    setError("");
    try {
      const [catalog, snapshot] = await Promise.all([
        requestEmployeeAccount<EmployeeJobTemplatesResponse>(`${EMPLOYEE_ACCOUNTS_ENDPOINT}/job-templates?employeeId=${employeeId}`, { signal: controller.signal }),
        requestEmployeeAccount<EmployeeAssignmentSnapshot>(`${EMPLOYEE_ACCOUNTS_ENDPOINT}/${employeeId}/template-assignment`, { signal: controller.signal }),
      ]);
      if (generation.current !== token) return;
      if (snapshot.employeeId !== employeeId || typeof snapshot.branchId !== "string" || !snapshot.branchId
        || typeof snapshot.expectedAssignmentRevision !== "string" || !snapshot.expectedAssignmentRevision) {
        setError("هوية الموظف أو الفرع أو دليل مراجعة الإسناد غير مكتمل في استجابة المعاينة. أعد التحميل؛ لم نعرض بيانات أو إسنادًا بديلًا.");
        return;
      }
      if (!Array.isArray(snapshot.additions)) {
        setError("استجابة المعاينة لا تتضمن سجل الإضافات المستقلة المطلوب. حدّث الخدمة وأعد تحميل المعاينة؛ لم نعرض قائمة فارغة بديلة.");
        return;
      }
      const permissionsValid = (value: unknown): boolean => Array.isArray(value) && value.every(row =>
        !!row && typeof row.module === "string" && !!row.module && Array.isArray(row.actions)
        && row.actions.every((action: unknown) => typeof action === "string" && !!action));
      if (!Array.isArray(catalog.templates) || !catalog.templates.every(template =>
        !!template && Number.isInteger(template.templateId) && template.templateId > 0
        && Number.isInteger(template.version) && template.version > 0
        && typeof template.name === "string" && !!template.name.trim()
        && typeof template.key === "string" && !!template.key
        && ["branch", "self", "assigned_tasks"].includes(template.scopeType)
        && typeof template.approvedAt === "string" && Number.isFinite(Date.parse(template.approvedAt))
        && permissionsValid(template.permissions))
        || (catalog.excludedTemplates !== undefined && (!Array.isArray(catalog.excludedTemplates)
          || !catalog.excludedTemplates.every(template => !!template
            && Number.isInteger(template.templateId) && template.templateId > 0
            && Number.isInteger(template.version) && template.version > 0
            && typeof template.name === "string" && !!template.name.trim()
            && typeof template.reason === "string" && !!template.reason.trim()
            && typeof template.code === "string" && !!template.code.trim())))
        || !permissionsValid(snapshot.currentPermissions)
        || (snapshot.assignment !== null && (!snapshot.assignment
          || !Number.isInteger(snapshot.assignment.templateId) || snapshot.assignment.templateId <= 0
          || !Number.isInteger(snapshot.assignment.version) || snapshot.assignment.version <= 0
          || typeof snapshot.assignment.branchId !== "string" || !snapshot.assignment.branchId
          || typeof snapshot.assignment.revision !== "string" || !snapshot.assignment.revision
          || typeof snapshot.assignment.assignedAt !== "string" || !Number.isFinite(Date.parse(snapshot.assignment.assignedAt))
          || typeof snapshot.assignment.assignedBy !== "string" || typeof snapshot.assignment.reason !== "string"))) {
        setError("بيانات كتالوج القوالب أو أسباب الاستبعاد أو سجل الإسناد غير مكتملة. حدّث الخدمة وأعد تحميل المعاينة؛ لم نستبدل البيانات الناقصة بقائمة فارغة أو قالب افتراضي.");
        return;
      }
      setData({ templates: catalog.templates, excludedTemplates: catalog.excludedTemplates ?? [], snapshot });
    } catch (cause) {
      if (generation.current === token) setError(employeeTemplateError(cause));
    } finally {
      if (generation.current === token) setLoading(false);
    }
  };
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  useEffect(() => {
    void reloadRef.current();
    return () => { generation.current++; request.current?.abort(); };
  }, [employeeId]);
  return { data, loading, error, reload };
}