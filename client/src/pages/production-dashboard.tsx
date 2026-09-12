import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Factory, ListChecks, Workflow } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { OperationsBoard } from "@/components/central-kitchen/operations-board";
import { LegacyProductionDashboard } from "@/components/central-kitchen/legacy-production-dashboard";
import { RecipeBook } from "@/components/central-kitchen/recipe-book";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBranches } from "@/hooks/useBranches";
import { useAuth } from "@/hooks/useAuth";

type Kitchen = { id: string; name: string };
export default function ProductionDashboardPage() {
  const [location, setLocation] = useLocation();
  const { isAdmin } = useAuth();
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
  const initialTab = new URLSearchParams(location.split("?")[1] || "").get("tab") === "recipes" ? "recipes" : "operations";
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { if (new URLSearchParams(location.split("?")[1] || "").get("tab") === "recipes") setTab("recipes"); }, [location]);
  const changeTab = (value: string) => { setTab(value); setLocation(value === "recipes" ? "/production-dashboard?tab=recipes" : "/production-dashboard"); };
  return <Layout><main dir="rtl" className="page-container space-y-5 pb-10">
    <PageHeader icon={Factory} tone="production" title="إنتاج المطبخ المركزي" description="دورة الطلب المعتمد → الإنتاج → المخزون → الإرسال" actions={<div className="flex flex-wrap gap-2"><a href="/production-reports?tab=operations" target="_blank" rel="noopener noreferrer" className="inline-flex"><Button variant="outline"><Workflow className="ml-2 h-4 w-4" />تقرير التشغيل المترابط</Button></a><Link href="/central-kitchen-orders" className="inline-flex"><Button><ListChecks className="ml-2 h-4 w-4" />طلبات الفروع</Button></Link></div>} />
    <Tabs value={tab} onValueChange={changeTab} className="space-y-5"><TabsList className="h-auto flex-wrap rounded-xl bg-muted p-1"><TabsTrigger value="operations" className="rounded-lg">التشغيل الحي</TabsTrigger><TabsTrigger value="recipes" className="rounded-lg">دفتر الوصفات</TabsTrigger><TabsTrigger value="legacy" className="rounded-lg">التقارير والأدوات السابقة <span className="mr-1 text-[10px] text-muted-foreground">(مصادر تاريخية)</span></TabsTrigger></TabsList>
      <TabsContent value="operations"><OperationsBoard kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={setKitchenId} /></TabsContent>
      <TabsContent value="recipes"><RecipeBook kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={setKitchenId} /></TabsContent>
      <TabsContent value="legacy"><LegacyProductionDashboard /></TabsContent>
    </Tabs>
  </main></Layout>;
}