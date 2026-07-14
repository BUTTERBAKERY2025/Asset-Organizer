import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import type { SystemModule, ModuleAction } from "@shared/schema";

interface Permission {
  module: string;
  actions: string[];
}

export function usePermissions() {
  const { user, isAdmin, isAttendanceClerk } = useAuth();
  const isViewer = user?.role === "viewer";
  const isEmployee = user?.role === "employee";

  const { data: permissions = [], isLoading } = useQuery<Permission[]>({
    queryKey: ["/api/my-permissions"],
    queryFn: async () => {
      const res = await fetch("/api/my-permissions", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 120,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  });

  const hasPermission = (module: SystemModule, action: ModuleAction): boolean => {
    // Admin has full access
    if (isAdmin) return true;
    
    // Attendance clerk has access ONLY to attendance_check module
    if (isAttendanceClerk) {
      if (module === "attendance_check") {
        return action === "view" || action === "create" || action === "edit";
      }
      return false;
    }
    
    // Viewer can ONLY view - nothing else (regardless of stored permissions)
    if (isViewer) {
      if (action !== "view") return false;
      // Check if viewer has view permission for this module
      let perm = permissions.find(p => p.module === module);
      if (!perm && module === "attendance_check") {
        perm = permissions.find(p => p.module === "attendance");
      }
      if (!perm) return false;
      return perm.actions.includes("view");
    }
    
    // Employee uses granular permissions from database
    let perm = permissions.find(p => p.module === module);
    // Backward compatibility: attendance_check also accepts attendance permission
    if (!perm && module === "attendance_check") {
      perm = permissions.find(p => p.module === "attendance");
    }
    if (!perm) return false;
    return perm.actions.includes(action);
  };

  const canView = (module: SystemModule): boolean => hasPermission(module, "view");
  const canCreate = (module: SystemModule): boolean => hasPermission(module, "create");
  const canEdit = (module: SystemModule): boolean => hasPermission(module, "edit");
  const canDelete = (module: SystemModule): boolean => hasPermission(module, "delete");
  const canApprove = (module: SystemModule): boolean => hasPermission(module, "approve");
  const canExport = (module: SystemModule): boolean => hasPermission(module, "export");

  return {
    permissions,
    isLoading,
    hasPermission,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canApprove,
    canExport,
    isViewer,
    isEmployee,
    isAttendanceClerk,
    isAdmin,
  };
}
