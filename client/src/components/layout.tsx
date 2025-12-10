import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import logo from "@assets/logo_-5_1765206843638.png";
import { LayoutDashboard, FileText, Settings, LogOut, ClipboardEdit, Building2, AlertTriangle, CalendarCheck, LogIn, Users, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { NotificationsDropdown } from "@/components/notifications-dropdown";

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير",
  employee: "موظف",
  viewer: "مشاهد",
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isLoading, isAuthenticated, isAdmin } = useAuth();

  const navItems = [
    { href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
    { href: "/inventory", label: "جرد الأصول", icon: FileText },
    { href: "/manage", label: "إدارة الأصول", icon: ClipboardEdit, requiresAuth: true },
    { href: "/branches", label: "إدارة الفروع", icon: Building2, requiresAuth: true },
    { href: "/inspections", label: "الفحص الدوري", icon: CalendarCheck },
    { href: "/maintenance", label: "تقرير الصيانة", icon: AlertTriangle },
    ...(isAdmin ? [{ href: "/users", label: "إدارة المستخدمين", icon: Users }] : []),
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-l border-border hidden md:flex flex-col sticky top-0 h-screen">
        <div className="p-6 flex flex-col items-center border-b border-border/50">
          <div className="w-full px-4 mb-3 flex items-center justify-between">
            <img src={logo} alt="Butter Bakery" className="w-full h-auto object-contain" />
          </div>
          <div className="flex items-center gap-2 mt-2">
            {isAuthenticated && <NotificationsDropdown />}
            <p className="text-xs text-muted-foreground">نظام إدارة الأصول</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md transition-colors cursor-pointer",
                  location === item.href
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                data-testid={`nav-link-${item.href.replace('/', '')}`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border/50">
          {isLoading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : isAuthenticated && user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-2">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.profileImageUrl || undefined} style={{ objectFit: 'cover' }} />
                  <AvatarFallback>{user.firstName?.[0] || user.email?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.firstName || user.email?.split('@')[0]}</p>
                  <Badge variant="secondary" className="text-xs">{ROLE_LABELS[user.role] || user.role}</Badge>
                </div>
              </div>
              <a 
                href="/api/logout"
                className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-destructive cursor-pointer transition-colors rounded-md hover:bg-destructive/10"
                data-testid="button-logout"
              >
                <LogOut className="w-5 h-5" />
                <span>تسجيل الخروج</span>
              </a>
            </div>
          ) : (
            <a 
              href="/api/login"
              className="flex items-center gap-3 px-4 py-3 text-primary hover:text-primary/80 cursor-pointer transition-colors rounded-md hover:bg-primary/10"
              data-testid="button-login"
            >
              <LogIn className="w-5 h-5" />
              <span>تسجيل الدخول</span>
            </a>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-16 border-b border-border bg-card flex items-center px-4 justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Butter Bakery" className="h-10 w-auto object-contain" />
          </div>
          {isAuthenticated && <NotificationsDropdown />}
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
