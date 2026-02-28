import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User, Branch } from "@shared/schema";
import { clearPersistentCache, setCurrentUser } from "@/lib/persistentCache";

type UserWithoutPassword = Omit<User, 'password'>;

interface UserBranchAccess {
  id: number;
  userId: string;
  branchId: string;
  accessLevel: string;
  isDefault: boolean;
}

interface AuthUser extends UserWithoutPassword {
  activeBranchId?: string | null;
  activeBranch?: Branch | null;
  allowedBranches?: UserBranchAccess[];
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
      });
      if (res.status === 401 || res.status === 403) {
        queryClient.setQueryData(["/api/auth/me"], null);
        return null;
      }
      if (!res.ok) return null;
      return res.json();
    },
    retry: 1,
    retryDelay: 500,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string; rememberMe?: boolean }) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل تسجيل الدخول");
      }
      return res.json();
    },
    onSuccess: (userData) => {
      queryClient.clear();
      clearPersistentCache();
      setCurrentUser(userData?.id?.toString() || null);
      queryClient.setQueryData(["/api/auth/me"], userData);
      queryClient.invalidateQueries();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      if (!res.ok) {
        throw new Error("فشل تسجيل الخروج");
      }
      return res.json();
    },
    onSuccess: () => {
      clearPersistentCache();
      setCurrentUser(null);
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
    },
  });

  const switchBranchMutation = useMutation({
    mutationFn: async (branchId: string) => {
      const res = await fetch("/api/auth/active-branch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل تغيير الفرع");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    isEmployee: user?.role === "employee" || user?.role === "admin",
    isViewer: !!user,
    isAttendanceClerk: user?.role === "attendance_clerk",
    activeBranchId: user?.activeBranchId || null,
    activeBranch: user?.activeBranch || null,
    allowedBranches: user?.allowedBranches || [],
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    switchBranch: switchBranchMutation.mutateAsync,
    loginError: loginMutation.error?.message,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    isSwitchingBranch: switchBranchMutation.isPending,
  };
}
