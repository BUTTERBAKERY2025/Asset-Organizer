import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import type { SystemModule, ModuleAction } from "@shared/schema";

interface Permission {
  module: string;
  actions: string[];
}

export function usePermissions() {
  const { user, isAdmin } = useAuth();
  const isViewer = user?.role === "viewer";
  const isEmployee = user?.role === "employee";

  const { data: permissions = [], isLoading } = useQuery<Permission[]>({
    queryKey: ["/api/my-permissions"],
    queryFn: async () => {
      const res = await fetch("/api/my-permissions");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const hasPermission = (module: SystemModule, action: ModuleAction): boolean => {
    // Admin has full access
    if (isAdmin) return true;
    
    // Viewer can ONLY view - nothing else (regardless of stored permissions)
    if (isViewer) {
      if (action !== "view") return false;
      // Check if viewer has view permission for this module
      const perm = permissions.find(p => p.module === module);
      if (!perm) return false;
      return perm.actions.includes("view");
    }
    
    // Employee uses granular permissions from database
    const perm = permissions.find(p => p.module === module);
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
  };
}
