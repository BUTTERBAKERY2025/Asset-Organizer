import { useEffect, useRef, useState } from "react";
import type { EmployeeJobTemplatesResponse, EmployeeTemplatePilotResponse } from "@shared/employee-account-delegation";
import { EMPLOYEE_ACCOUNTS_ENDPOINT, requestEmployeeAccount } from "@/lib/employee-account-delegation";
import { employeeTemplatePilotEndpoint, employeeTemplatePilotError } from "@/lib/employee-template-pilot";

/** Explicit comparison reads only. No automatic participant, comparison or pilot write. */
export function useEmployeeTemplatePilot(employeeId: number) {
  const [catalog, setCatalog] = useState<EmployeeJobTemplatesResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [comparison, setComparison] = useState<EmployeeTemplatePilotResponse | null>(null);
  const [comparing, setComparing] = useState(false);
  const [comparisonError, setComparisonError] = useState("");
  const [boundaryDelay, setBoundaryDelay] = useState<number | null>(null);
  const catalogRequest = useRef<AbortController | null>(null);
  const compareRequest = useRef<AbortController | null>(null);
  const catalogGeneration = useRef(0);
  const comparisonGeneration = useRef(0);
  const loadCatalog = async () => {
    const token = ++catalogGeneration.current;
    catalogRequest.current?.abort();
    const controller = new AbortController();
    catalogRequest.current = controller;
    setCatalog(null);
    setCatalogError("");
    setCatalogLoading(true);
    try {
      const result = await requestEmployeeAccount<EmployeeJobTemplatesResponse>(`${EMPLOYEE_ACCOUNTS_ENDPOINT}/job-templates`, { signal: controller.signal });
      if (!Array.isArray(result.templates)) throw new Error("Invalid approved template catalog");
      if (catalogGeneration.current === token) setCatalog(result);
    } catch (cause) {
      if (catalogGeneration.current === token) setCatalogError(employeeTemplatePilotError(cause));
    } finally {
      if (catalogGeneration.current === token) setCatalogLoading(false);
    }
  };
  const clearComparison = () => {
    comparisonGeneration.current++;
    compareRequest.current?.abort();
    setComparison(null);
    setComparing(false);
    setComparisonError("");
    setBoundaryDelay(null);
  };
  const compare = async (templateId: number, version: number) => {
    const token = ++comparisonGeneration.current;
    compareRequest.current?.abort();
    const controller = new AbortController();
    compareRequest.current = controller;
    setComparison(null);
    setComparisonError("");
    setBoundaryDelay(null);
    setComparing(true);
    const started = performance.now();
    try {
      const result = await requestEmployeeAccount<EmployeeTemplatePilotResponse>(
        `${employeeTemplatePilotEndpoint(employeeId)}?templateId=${templateId}&version=${version}`, { signal: controller.signal },
      );
      if (comparisonGeneration.current !== token) return null;
      if (result.employeeId !== employeeId || result.templateId !== templateId || result.version !== version
        || typeof result.expectedComparisonRevision !== "string" || !result.expectedComparisonRevision)
        throw new Error("Pilot comparison identity mismatch");
      if (!Array.isArray(result.extras) || !Array.isArray(result.currentBase) || !Array.isArray(result.blockedReasons)
        || !Array.isArray(result.scope?.limitations) || result.assignment === undefined
        || (result.proposedBase !== null && !Array.isArray(result.proposedBase))
        || [result.before, result.after].some(authority => authority !== null
          && (!authority || !Array.isArray(authority.effectivePermissions) || !Array.isArray(authority.sources)))
        || (result.differences !== null && (!result.differences || !Array.isArray(result.differences.additions)
          || !Array.isArray(result.differences.removals) || !Array.isArray(result.differences.retained)
          || !Array.isArray(result.differences.retainedDenies)))) {
        setComparisonError("استجابة المقارنة لا تتضمن أدلة الصلاحيات أو الإضافات المطلوبة. حدّث الخدمة وأعد المقارنة؛ لم نعرض صلاحيات أو إضافات فارغة بديلة.");
        return null;
      }
      setComparison(result);
      // Only invalidates a preview. It NEVER recalculates temporal permission decisions.
      // Server-relative interval minus the full read latency expires conservatively.
      setBoundaryDelay(result.nextDecisionBoundary === null ? null : Math.max(0,
        new Date(result.nextDecisionBoundary).getTime() - new Date(result.capturedAt).getTime() - (performance.now() - started)));
      return result;
    } catch (cause) {
      if (comparisonGeneration.current === token) setComparisonError(employeeTemplatePilotError(cause));
      return null;
    } finally {
      if (comparisonGeneration.current === token) setComparing(false);
    }
  };
  const loadRef = useRef(loadCatalog);
  loadRef.current = loadCatalog;
  useEffect(() => {
    void loadRef.current();
    return () => {
      catalogGeneration.current++;
      comparisonGeneration.current++;
      catalogRequest.current?.abort();
      compareRequest.current?.abort();
    };
  }, [employeeId]);
  return { catalog, catalogLoading, catalogError, loadCatalog, comparison, comparing, comparisonError, compare, clearComparison, boundaryDelay };
}