import { useLocation, Redirect } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
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
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl" data-testid="access-denied">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <ShieldX className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-xl text-destructive">غير مصرح بالوصول</CardTitle>
          <CardDescription className="text-base">
            {message || "ليس لديك صلاحية للوصول لهذه الصفحة"}
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
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingAuth() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background" data-testid="loading-auth">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        <p className="text-muted-foreground">جاري التحقق من المصادقة...</p>
      </div>
    </div>
  );
}

function LoadingPermissions() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background" data-testid="loading-permissions">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        <p className="text-muted-foreground">جاري التحقق من الصلاحيات...</p>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return <LoadingAuth />;
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
  const { user, isLoading: authLoading, isAuthenticated, isAdmin } = useAuth();
  const { canView, isLoading: permissionsLoading } = usePermissions();
  const [location] = useLocation();

  if (authLoading) {
    return <LoadingAuth />;
  }

  if (!isAuthenticated) {
    const returnUrl = encodeURIComponent(location);
    return <Redirect to={`/login?returnUrl=${returnUrl}`} />;
  }

  if (permissionsLoading) {
    return <LoadingPermissions />;
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
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingAuth />;
  }

  if (isAuthenticated) {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}
