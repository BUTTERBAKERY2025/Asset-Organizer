import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Factory, ListChecks, Workflow, BookOpen, ClipboardList, History, Settings2, CalendarRange } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { OperationsBoard } from "@/components/central-kitchen/operations-board";
import { LegacyProductionDashboard } from "@/components/central-kitchen/legacy-production-dashboard";
import { RecipeBook, RECIPE_PERMISSION_MODULE } from "@/components/central-kitchen/recipe-book";
import { DailyWorkplan } from "@/components/central-kitchen/daily-workplan";
import { ProductionPlanning } from "@/components/central-kitchen/production-planning";
import { getProductionDashboardTab } from "@/components/central-kitchen/production-dashboard-tabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBranches } from "@/hooks/useBranches";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import "@/components/central-kitchen/production-workspace.css";

type Kitchen = { id: string; name: string };
export { getProductionDashboardTab } from "@/components/central-kitchen/production-dashboard-tabs";
export type { ProductionDashboardTab } from "@/components/central-kitchen/production-dashboard-tabs";

export default function ProductionDashboardPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { isAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const canViewRecipes = hasPermission(RECIPE_PERMISSION_MODULE, "view");
  const { branches, userBranchId } = useBranches();
  const kitchensQuery = useQuery<Kitchen[]>({ queryKey: ["/api/central-kitchen-orders/kitchens"], staleTime: 30_000 });
  const kitchens = useMemo(() => {
    const all = new Map<string, Kitchen>();
    if (isAdmin) kitchensQuery.data?.forEach(k => all.set(k.id, k));
    branches.filter(b => b.isCentralKitchen).forEach(b => all.set(b.id, { id: b.id, name: b.name }));
    return [...all.values()];
  }, [branches, isAdmin, kitchensQuery.data]);
  const [kitchenId, setKitchenId] = useState("");
  const [planningDate, setPlanningDate] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  useEffect(() => {
    if (!kitchens.length) { if (kitchenId) setKitchenId(""); return; }
    if (!kitchenId || !kitchens.some(k => k.id === kitchenId)) setKitchenId(kitchens.find(k => k.id === userBranchId)?.id || kitchens[0].id);
  }, [kitchens, kitchenId, userBranchId]);
  const [tab, setTab] = useState(() => getProductionDashboardTab(search, canViewRecipes));
  useEffect(() => {
    setTab(getProductionDashboardTab(search, canViewRecipes));
  }, [canViewRecipes, search]);
  const changeTab = (value: string) => {
    const nextTab = getProductionDashboardTab(`?tab=${value}`, canViewRecipes);
    setTab(nextTab);
    setLocation(nextTab === "operations" ? "/production-dashboard" : `/production-dashboard?tab=${nextTab}`);
  };
  const navigation = [
    { value: "operations", label: "التشغيل الحي", caption: "متابعة الدفعات", icon: Factory },
    { value: "workplan", label: "خطة العمل", caption: "مهام اليوم", icon: ClipboardList },
    { value: "unified-planning", label: "التخطيط", caption: "احتياجات الإنتاج", icon: CalendarRange },
    ...(canViewRecipes ? [{ value: "recipes", label: "الوصفات", caption: "المقادير والتحضير", icon: BookOpen }] : []),
    { value: "settings-review", label: "الإعدادات", caption: "مراجعة الجاهزية", icon: Settings2 },
    { value: "legacy", label: "السجل والأدوات", caption: "بيانات النظام السابق", icon: History },
  ];
  return <Layout><main dir="rtl" className="page-container production-workspace pb-10">
    <Tabs value={tab} onValueChange={changeTab}>
      <div className="desk-shell">
        <header className="desk-header">
          <div>
            <div className="desk-eyebrow">BUTTER BAKERY / مساحة عمل الإنتاج</div>
            <h1 className="desk-heading">المطبخ المركزي</h1>
            <p className="desk-subtitle">من تخطيط الاحتياج إلى تجهيز الطلب وإرساله للفرع</p>
          </div>
          <div className="desk-actions">
            {hasPermission("production", "view") && <a href="/production-reports?tab=operations" target="_blank" rel="noopener noreferrer"><Workflow className="h-4 w-4" />تقرير التشغيل</a>}
            {hasPermission("central_kitchen_orders", "view") && <Link href="/central-kitchen-orders"><ListChecks className="h-4 w-4" />طلبات الفروع</Link>}
          </div>
        </header>
        <TabsList className="desk-nav" aria-label="أقسام مساحة عمل الإنتاج">
          {navigation.map(({ value, label, caption, icon: Icon }) =>
            <TabsTrigger key={value} value={value}>
              <span className="desk-tab-title"><Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{label}</span>
              <span className="desk-tab-caption">{caption}</span>
            </TabsTrigger>
          )}
        </TabsList>
      </div>
      <div className="desk-content">
      <TabsContent value="workplan"><DailyWorkplan kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={setKitchenId} /></TabsContent>
      <TabsContent value="operations"><OperationsBoard kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={setKitchenId} /></TabsContent>
       {canViewRecipes && <TabsContent value="recipes"><RecipeBook kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={setKitchenId} /></TabsContent>}
      <TabsContent value="legacy"><LegacyProductionDashboard /></TabsContent>
       <TabsContent value="settings-review"><ProductionPlanning mode="settings" kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={setKitchenId} date={planningDate} onDateChange={setPlanningDate} /></TabsContent>
       <TabsContent value="unified-planning"><ProductionPlanning mode="planning" kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={setKitchenId} date={planningDate} onDateChange={setPlanningDate} /></TabsContent>
      </div>
     </Tabs>
  </main></Layout>;
}