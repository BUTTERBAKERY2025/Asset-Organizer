import { useEffect, useRef, useState } from "react";
import type { ApprovedEmployeeTemplate, EmployeeAssignmentSnapshot } from "@/lib/employee-template-assignment";
import { employeeTemplateError } from "@/lib/employee-template-assignment";
import { EMPLOYEE_ACCOUNTS_ENDPOINT, requestEmployeeAccount } from "@/lib/employee-account-delegation";

/** Fresh, employee-bound review data. No global cache or credentials. */
export function useEmployeeTemplateAssignment(employeeId: number) {
  const [data, setData] = useState<{ templates: ApprovedEmployeeTemplate[]; snapshot: EmployeeAssignmentSnapshot } | null>(null);
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
        requestEmployeeAccount<{ templates: ApprovedEmployeeTemplate[] }>(`${EMPLOYEE_ACCOUNTS_ENDPOINT}/job-templates?employeeId=${employeeId}`, { signal: controller.signal }),
        requestEmployeeAccount<EmployeeAssignmentSnapshot>(`${EMPLOYEE_ACCOUNTS_ENDPOINT}/${employeeId}/template-assignment`, { signal: controller.signal }),
      ]);
      if (generation.current !== token) return;
      if (snapshot.employeeId !== employeeId || typeof snapshot.expectedAssignmentRevision !== "string" || !snapshot.expectedAssignmentRevision)
        throw new Error("Invalid employee assignment snapshot");
      if (!Array.isArray(snapshot.additions)) {
        setError("استجابة المعاينة لا تتضمن سجل الإضافات المستقلة المطلوب. حدّث الخدمة وأعد تحميل المعاينة؛ لم نعرض قائمة فارغة بديلة.");
        return;
      }
      setData({ templates: catalog.templates, snapshot });
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