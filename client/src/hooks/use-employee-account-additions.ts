import { useEffect, useRef, useState } from "react";
import type { EmployeeAccountAdditionsResponse } from "@/lib/employee-account-additions";
import { employeeAdditionError } from "@/lib/employee-account-additions";
import { requestEmployeeAccount } from "@/lib/employee-account-delegation";

export const employeeAdditionsEndpoint = (employeeId: number) => `/api/admin/employee-account-additions/${employeeId}`;

export function useEmployeeAccountAdditions(employeeId: number) {
  const [data, setData] = useState<EmployeeAccountAdditionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const reload = async () => {
    const token = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setData(null);
    setError("");
    setLoading(true);
    try {
      const result = await requestEmployeeAccount<EmployeeAccountAdditionsResponse>(employeeAdditionsEndpoint(employeeId), { signal: controller.signal });
      if (generation.current !== token) return;
      if (result.employeeId !== employeeId) throw new Error("Employee additions ownership mismatch");
      setData(result);
    } catch (cause) {
      if (generation.current === token) setError(employeeAdditionError(cause));
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
  return { data, loading, error, reload, setData };
}