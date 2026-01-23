import { useLocation, Redirect } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuthReady } from "@/contexts/AuthContext";
import { Loader2, ShieldX, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SystemModule } from "@shared/schema";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "admin" | "employee" | "viewer";
}

interface ModuleProtectedRouteProps {
  children: React.ReactNode;
  module: SystemModule;
  requiredRole?: "admin" | "employee" | "viewer";
}

function AccessDeniedPage({ message }: { message?: string }) {
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      window.location.href = '/login';
    } catch (error) {
      window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl" data-testid="access-denied">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <ShieldX className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-xl text-destructive">غير مصرح بالوصول</CardTitle>
          <CardDescription className="text-base">
            {message || "ليس لديك صلاحية الوصول لهذا القسم"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4" />
              <span className="font-medium">لماذا أرى هذه الرسالة؟</span>
            </div>
            <p>
              هذه الصفحة تتطلب صلاحيات محددة غير متاحة لحسابك الحالي. 
              يرجى التواصل مع مدير النظام إذا كنت تعتقد أنه يجب أن يكون لديك حق الوصول.
            </p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={() => window.history.back()}
              data-testid="button-go-back"
            >
              العودة للخلف
            </Button>
            <Button 
              className="flex-1" 
              onClick={() => window.location.href = '/'}
              data-testid="button-go-home"
            >
              الصفحة الرئيسية
            </Button>
          </div>
          <Button 
            variant="destructive" 
            className="w-full" 
            onClick={handleLogout}
            data-testid="button-logout"
          >
            تسجيل الخروج
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function InlineSkeleton() {
  return (
    <div className="min-h-[200px] flex items-center justify-center" data-testid="inline-skeleton">
      <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
    </div>
  );
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isReady } = useAuthReady();
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();

  // Show lightweight skeleton during any transient loading
  if (!isReady) {
    return <InlineSkeleton />;
  }

  if (!isAuthenticated) {
    const returnUrl = encodeURIComponent(location);
    return <Redirect to={`/login?returnUrl=${returnUrl}`} />;
  }

  if (requiredRole) {
    const roleHierarchy: Record<string, number> = {
      admin: 3,
      employee: 2,
      viewer: 1,
    };
    
    const userRoleLevel = roleHierarchy[user?.role || "viewer"] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;
    
    if (userRoleLevel < requiredRoleLevel) {
      return <AccessDeniedPage message="هذه الصفحة متاحة فقط للمديرين" />;
    }
  }

  return <>{children}</>;
}

export function ModuleProtectedRoute({ children, module, requiredRole }: ModuleProtectedRouteProps) {
  const { isReady } = useAuthReady();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const { canView } = usePermissions();
  const [location] = useLocation();

  // Show lightweight skeleton during any transient loading
  if (!isReady) {
    return <InlineSkeleton />;
  }

  if (!isAuthenticated) {
    const returnUrl = encodeURIComponent(location);
    return <Redirect to={`/login?returnUrl=${returnUrl}`} />;
  }

  if (requiredRole) {
    const roleHierarchy: Record<string, number> = {
      admin: 3,
      employee: 2,
      viewer: 1,
    };
    
    const userRoleLevel = roleHierarchy[user?.role || "viewer"] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;
    
    if (userRoleLevel < requiredRoleLevel) {
      return <AccessDeniedPage message="هذه الصفحة متاحة فقط للمديرين" />;
    }
  }

  if (!isAdmin && !canView(module)) {
    return <AccessDeniedPage message={`ليس لديك صلاحية الوصول لهذا القسم`} />;
  }

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isReady } = useAuthReady();
  const { isAuthenticated } = useAuth();

  // Show lightweight skeleton during any transient loading
  if (!isReady) {
    return <InlineSkeleton />;
  }

  if (isAuthenticated) {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}
