import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ListChecks, Workflow, BookOpen, ClipboardList, History, Settings2, CalendarRange, PackageSearch } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { OperationsBoard } from "@/components/central-kitchen/operations-board";
import { LegacyProductionDashboard } from "@/components/central-kitchen/legacy-production-dashboard";
import { RecipeBook, RECIPE_PERMISSION_MODULE } from "@/components/central-kitchen/recipe-book";
import { DailyWorkplan } from "@/components/central-kitchen/daily-workplan";
import { ProductionPlanning } from "@/components/central-kitchen/production-planning";
import { ProductionCycle } from "@/components/central-kitchen/production-cycle";
import { RecipeModeControl } from "@/components/central-kitchen/recipe-mode";
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
  const { branches, userBranchId, isLoading: branchesLoading } = useBranches();
  const kitchensQuery = useQuery<Kitchen[]>({ queryKey: ["/api/central-kitchen-orders/kitchens"], staleTime: 30_000 });
  const kitchens = useMemo(() => {
    const all = new Map<string, Kitchen>();
    if (isAdmin) kitchensQuery.data?.forEach(k => all.set(k.id, k));
    branches.filter(b => b.isCentralKitchen).forEach(b => all.set(b.id, { id: b.id, name: b.name }));
    return Array.from(all.values());
  }, [branches, isAdmin, kitchensQuery.data]);
  const [kitchenId, setKitchenId] = useState(() => new URLSearchParams(search).get("kitchenId") || "");
  const [planningDate, setPlanningDate] = useState(() => {
    const requested = new URLSearchParams(search).get("date");
    return requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  });
  useEffect(() => {
    if (branchesLoading || kitchensQuery.isPending) return;
    if (!kitchens.length) { if (kitchenId) setKitchenId(""); return; }
    if (!kitchenId || !kitchens.some(k => k.id === kitchenId)) setKitchenId(kitchens.find(k => k.id === userBranchId)?.id || kitchens[0].id);
  }, [kitchens, kitchenId, userBranchId, branchesLoading, kitchensQuery.isPending]);
  const [tab, setTab] = useState(() => getProductionDashboardTab(search, canViewRecipes));
  useEffect(() => {
    setTab(getProductionDashboardTab(search, canViewRecipes));
    const params = new URLSearchParams(search);
    const requestedKitchen = params.get("kitchenId");
    const requestedDate = params.get("date");
    if (requestedKitchen && kitchens.some(kitchen => kitchen.id === requestedKitchen)) setKitchenId(requestedKitchen);
    if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) setPlanningDate(requestedDate);
  }, [canViewRecipes, search, kitchens]);
  const changeCycleScope = (nextKitchen: string, nextDate: string, target: "cycle" | "tracking" = "cycle") => {
    setKitchenId(nextKitchen);
    setPlanningDate(nextDate);
    setLocation(`/production-dashboard?${new URLSearchParams({ tab: target, kitchenId: nextKitchen, date: nextDate })}`);
  };
  const changeTab = (value: string) => {
    const nextTab = getProductionDashboardTab(`?tab=${value}`, canViewRecipes);
    setTab(nextTab);
    setLocation(`/production-dashboard?${new URLSearchParams({ tab: nextTab, kitchenId, date: planningDate })}`);
  };
  const navigation = [
    { value: "cycle", label: "التنفيذ", icon: Workflow },
    { value: "tracking", label: "تتبع الطلبات", icon: PackageSearch },
    { value: "unified-planning", label: "التخطيط", icon: CalendarRange },
  ];
  const utilities = [
    { value: "workplan", label: "خطة العمل", icon: ClipboardList },
    { value: "operations", label: "التشغيل الحي", icon: Workflow },
    ...(canViewRecipes ? [{ value: "recipes", label: "الوصفات", icon: BookOpen }] : []),
    { value: "settings-review", label: "الإعدادات وسياسة الوصفات", icon: Settings2 },
    { value: "legacy", label: "السجل والأدوات", icon: History },
  ];
  const utilityTab = utilities.some(item => item.value === tab);
  return <Layout><main dir="rtl" className="page-container production-workspace pb-10">
    <Tabs dir="rtl" value={tab} onValueChange={changeTab}>
      <div className="desk-shell">
        <header className="desk-header">
          <div>
            <div className="desk-eyebrow">BUTTER BAKERY / مساحة عمل الإنتاج</div>
            <h1 className="desk-heading">المطبخ المركزي</h1>
            <p className="desk-subtitle">الاحتياج المعتمد أولاً، وكل مسار آخر عند الحاجة</p>
          </div>
          <div className="desk-actions">
            {hasPermission("production", "view") && <a href="/production-reports?tab=operations" target="_blank" rel="noopener noreferrer"><Workflow className="h-4 w-4" />تقرير التشغيل</a>}
            {hasPermission("central_kitchen_orders", "view") && <Link href="/central-kitchen-orders"><ListChecks className="h-4 w-4" />طلبات الفروع</Link>}
          </div>
        </header>
        <TabsList className="desk-nav" aria-label="أقسام مساحة عمل الإنتاج">
          {navigation.map(({ value, label, icon: Icon }) =>
            <TabsTrigger key={value} value={value} data-active={tab === value || (value === "cycle" && tab === "operations") ? "true" : undefined}>
              <span className="desk-tab-title"><Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{label}</span>
            </TabsTrigger>
          )}
        </TabsList>
        <div className="desk-utilities">
          <label htmlFor="production-utilities">أدوات إضافية</label>
          <select id="production-utilities" aria-label="أدوات إضافية" value={utilityTab ? tab : ""} onChange={event => event.target.value && changeTab(event.target.value)}>
            <option value="">اختر أداة…</option>
            {utilities.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
      </div>
      <div className="desk-content">
      <TabsContent value="cycle">
        {(kitchensQuery.isError || branchesLoading) && <p role="status" className="p-3 text-sm">{kitchensQuery.isError ? "تعذر تحديث قائمة المطابخ؛ المتاح من نطاق الفروع المصرح بها فقط." : "جار تحميل المطابخ المصرح بها…"}</p>}
        <ProductionCycle view="execution" kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={id => changeCycleScope(id, planningDate)} date={planningDate} onDateChange={value => changeCycleScope(kitchenId, value)} />
      </TabsContent>
      <TabsContent value="tracking"><ProductionCycle view="tracking" kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={id => changeCycleScope(id, planningDate, "tracking")} date={planningDate} onDateChange={value => changeCycleScope(kitchenId, value, "tracking")} /></TabsContent>
      <TabsContent value="workplan"><DailyWorkplan kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={setKitchenId} /></TabsContent>
      <TabsContent value="operations"><OperationsBoard kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={setKitchenId} /></TabsContent>
       {canViewRecipes && <TabsContent value="recipes"><RecipeBook kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={setKitchenId} /></TabsContent>}
      <TabsContent value="legacy"><LegacyProductionDashboard /></TabsContent>
       <TabsContent value="settings-review"><div className="space-y-3">{kitchenId && <RecipeModeControl key={kitchenId} kitchenId={kitchenId} />}<ProductionPlanning mode="settings" kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={setKitchenId} date={planningDate} onDateChange={setPlanningDate} /></div></TabsContent>
       <TabsContent value="unified-planning"><ProductionPlanning mode="planning" kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={setKitchenId} date={planningDate} onDateChange={setPlanningDate} /></TabsContent>
      </div>
     </Tabs>
  </main></Layout>;
}