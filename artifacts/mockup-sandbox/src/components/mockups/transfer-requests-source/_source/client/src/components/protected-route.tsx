import { sandboxFetch as fetch, previewWindow as window } from "../../../../_stubs/effects.ts";
import { Loader2, ShieldX, Lock } from "lucide-react";
import { Button } from "./ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.tsx";
import { detachPushSubscriptionFromCurrentUser } from "../../../../_stubs/actions.ts";

export function AccessDeniedPage({ message }: { message?: string }) {
  const handleLogout = async () => {
    try {
      await detachPushSubscriptionFromCurrentUser();
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
