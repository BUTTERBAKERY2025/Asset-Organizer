import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Factory, ListChecks } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { OperationsBoard } from "@/components/central-kitchen/operations-board";
import { LegacyProductionDashboard } from "@/components/central-kitchen/legacy-production-dashboard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBranches } from "@/hooks/useBranches";

type Kitchen = { id: string; name: string };
export default function ProductionDashboardPage() {
  const { branches, userBranchId } = useBranches();
  const kitchensQuery = useQuery<Kitchen[]>({ queryKey: ["/api/central-kitchen-orders/kitchens"], staleTime: 30_000 });
  const kitchens = useMemo(() => {
    const all = new Map<string, Kitchen>();
    kitchensQuery.data?.forEach(k => all.set(k.id, k));
    branches.filter(b => b.isCentralKitchen).forEach(b => all.set(b.id, { id: b.id, name: b.name }));
    return [...all.values()];
  }, [branches, kitchensQuery.data]);
  const [kitchenId, setKitchenId] = useState("");
  useEffect(() => { if (!kitchenId && kitchens.length) setKitchenId(kitchens.find(k => k.id === userBranchId)?.id || kitchens[0].id); }, [kitchens, kitchenId, userBranchId]);
  return <Layout><main dir="rtl" className="page-container space-y-5 pb-10">
    <PageHeader icon={Factory} tone="production" title="إنتاج المطبخ المركزي" description="دورة الطلب المعتمد → الإنتاج → المخزون → الإرسال" actions={<Link href="/central-kitchen-orders" className="inline-flex"><Button><ListChecks className="ml-2 h-4 w-4" />طلبات الفروع</Button></Link>} />
    <Tabs defaultValue="operations" className="space-y-5"><TabsList className="h-auto rounded-xl bg-muted p-1"><TabsTrigger value="operations" className="rounded-lg">التشغيل الحي</TabsTrigger><TabsTrigger value="legacy" className="rounded-lg">التقارير والأدوات السابقة</TabsTrigger></TabsList>
      <TabsContent value="operations"><OperationsBoard kitchens={kitchens} kitchenId={kitchenId} onKitchenChange={setKitchenId} /></TabsContent>
      <TabsContent value="legacy"><LegacyProductionDashboard /></TabsContent>
    </Tabs>
  </main></Layout>;
}