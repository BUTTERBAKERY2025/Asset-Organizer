import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Factory, ListChecks, Workflow } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { OperationsBoard } from "@/components/central-kitchen/operations-board";
import { LegacyProductionDashboard } from "@/components/central-kitchen/legacy-production-dashboard";
import { RecipeBook, RECIPE_PERMISSION_MODULE } from "@/components/central-kitchen/recipe-book";
import { DailyWorkplan } from "@/components/central-kitchen/daily-workplan";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBranches } from "@/hooks/useBranches";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

type Kitchen = { id: string; name: string };
export type ProductionDashboardTab = "workplan" | "operations" | "recipes" | "legacy";

export function getProductionDashboardTab(search: string, canViewRecipes: boolean): ProductionDashboardTab {
  const requestedTab = new URLSearchParams(search).get("tab");
  if (requestedTab === "recipes" && !canViewRecipes) return "operations";
  return requestedTab === "workplan" || requestedTab === "recipes" || requestedTab === "legacy"
    ? requestedTab
    : "operations";
}

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
  return <Layout><main dir="rtl" className="page-container space-y-5 pb-10">
    <PageHeader icon={Factory} tone="production" title="إنتاج المطبخ المركزي" description="دورة الطلب المعتمد → الإنتاج → المخزون → الإرسال" actions={<div className="flex flex-wrap gap-2"><a href="/production-reports?tab=operations" target="_blank" rel="noopener noreferrer" className="inline-flex"><Button variant="outline"><Workflow className="ml-2 h-4 w-4" />تقرير التشغيل المترابط</Button></a><Link href="/central-kitchen-orders" className="inline-flex"><Button><ListChecks className="ml-2 h-4 w-4" />طلبات الفروع</Button></Link></div>} />
     <Tabs value={tab} onValueChange={changeTab} className="space-y-5"><TabsList className="h-auto flex-wrap rounded-xl bg-muted p-1"><TabsTrigger value="workplan" className="rounded-lg">خطة العمل اليومية</TabsTrigger><TabsTrigger value="operations" className="rounded-lg">التشغيل الحي</TabsTrigger>{canViewRecipes && <TabsTrigger value="recipes" className="rounded-lg">دفتر الوصفات</TabsTrigger>}<TabsTrigger value="legacy" className="rounded-lg">التقارير والأدوات السابقة <span className="mr-1 text-[10px] text-muted-foreground">(مصادر تاريخية)</span></TabsTrigger></TabsList>
      <TabsContent value="workplan"><DailyWorkplan kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={setKitchenId} /></TabsContent>
      <TabsContent value="operations"><OperationsBoard kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={setKitchenId} /></TabsContent>
       {canViewRecipes && <TabsContent value="recipes"><RecipeBook kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={setKitchenId} /></TabsContent>}
      <TabsContent value="legacy"><LegacyProductionDashboard /></TabsContent>
    </Tabs>
  </main></Layout>;
}