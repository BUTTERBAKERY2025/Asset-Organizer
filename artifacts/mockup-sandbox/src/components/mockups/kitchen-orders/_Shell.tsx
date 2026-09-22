import type { ReactNode } from "react";
import {
  BarChart3, Boxes, Building2, ChevronDown, ClipboardList, Factory,
  LayoutDashboard, Search, Settings, ShoppingCart, Store, Truck, UserRound,
} from "lucide-react";

const nav = [
  { label: "الرئيسية", icon: LayoutDashboard },
  { label: "الموارد البشرية", icon: UserRound },
  { label: "الإنتاج", icon: Factory },
  { label: "العمليات", icon: ClipboardList, active: true },
  { label: "المبيعات", icon: BarChart3 },
  { label: "الأصول والفروع", icon: Building2 },
  { label: "المستودع", icon: Boxes },
  { label: "الإعدادات", icon: Settings },
];

export function MockAppShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background flex" dir="rtl">
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-l border-border/50 bg-gradient-to-b from-card via-card to-card/95 shadow-lg lg:flex">
      <div className="border-b border-border/30 p-4">
        <h1 className="text-base font-bold leading-tight text-primary">منصة بتر بيكري</h1>
        <p className="text-[10px] font-medium text-primary/70">نظام إدارة العمليات المتكامل</p>
        <div className="relative mt-3"><Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" /><div className="h-9 rounded-lg border bg-muted/30 pr-9 pt-2 text-xs text-muted-foreground">بحث سريع...</div></div>
      </div>
      <nav className="flex-1 space-y-1 overflow-hidden p-2">
        {nav.map(item => <div key={item.label} className={item.active ? "rounded-xl border border-primary/20 bg-gradient-to-l from-primary/15 via-primary/8 to-primary/3 text-primary" : "text-muted-foreground"}>
          <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[13px]">
            <div className="flex items-center gap-3"><div className={item.active ? "rounded-lg bg-primary/20 p-2" : "rounded-lg bg-muted/60 p-2"}><item.icon className="h-4 w-4" /></div><span className="font-semibold">{item.label}</span></div>
            <ChevronDown className="h-3.5 w-3.5" />
          </div>
          {item.active && <div className="mr-7 border-r-2 border-primary/10 pb-1 pr-2">
            <div className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium">طلبات المطبخ المركزي</div>
            <div className="px-3 py-2 text-xs text-muted-foreground">الورديات والتقارير</div>
          </div>}
        </div>)}
      </nav>
      <div className="border-t border-border/30 p-3"><div className="flex items-center gap-3 rounded-xl border border-primary/10 bg-gradient-to-l from-primary/10 to-transparent p-2"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">ن</div><div><p className="text-[13px] font-semibold">نورة الحربي</p><p className="text-[10px] text-primary">مدير العمليات</p></div></div></div>
    </aside>
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex min-h-14 items-center justify-between border-b bg-card/95 px-4 lg:hidden"><ShoppingCart className="h-5 w-5 text-primary" /><strong className="text-sm text-primary">منصة بتر بيكري</strong><Store className="h-5 w-5 text-muted-foreground" /></header>
      <div className="h-screen flex-1 overflow-auto lg:h-auto">{children}</div>
    </section>
  </div>;
}
