import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import logo from "@assets/generated_images/minimalist_geometric_bakery_logo_with_wheat_and_croissant_elements_in_gold_and_cream.png";
import { LayoutDashboard, FileText, Settings, LogOut } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
    { href: "/inventory", label: "جرد الأصول", icon: FileText },
    // { href: "/settings", label: "الإعدادات", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-l border-border hidden md:flex flex-col sticky top-0 h-screen">
        <div className="p-6 flex flex-col items-center border-b border-border/50">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-primary/10 mb-3 border-2 border-primary/20">
            <img src={logo} alt="Butter Bakery" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-bold text-xl text-foreground">Butter Bakery</h1>
          <p className="text-xs text-muted-foreground">نظام إدارة الأصول</p>
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
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-destructive cursor-pointer transition-colors">
            <LogOut className="w-5 h-5" />
            <span>تسجيل الخروج</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-16 border-b border-border bg-card flex items-center px-4 justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="w-8 h-8 rounded-full" />
            <span className="font-bold">Butter Bakery</span>
          </div>
          {/* Mobile menu trigger could go here */}
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
