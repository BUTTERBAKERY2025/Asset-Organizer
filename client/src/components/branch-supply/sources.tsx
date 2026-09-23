import { Link } from "wouter";
import { ChefHat, Warehouse, ArrowLeft, Plus } from "lucide-react";
import { PlatformAppIcon } from "@/components/platform-app-icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { branchSupplyUrl, type SupplySource } from "@/lib/branch-supply-navigation";

export type BranchSupplySourcesProps = {
  current: SupplySource;
  branchId: string | null;
  canKitchen: boolean;
  canWarehouse: boolean;
  onKitchenRequest?: () => void;
  onWarehouseRequest?: () => void;
};

export function BranchSupplySources({
  current, branchId, canKitchen, canWarehouse, onKitchenRequest, onWarehouseRequest,
}: BranchSupplySourcesProps) {
  const sources = [
    { id: "kitchen" as const, label: "المطبخ المركزي", description: "منتجات ومواد يجهزها المطبخ من مخزونه أو من إنتاجه.", steps: "طلب ← اعتماد ← تجهيز ← إرسال ← استلام", icon: ChefHat, color: "production" as const, allowed: canKitchen, create: onKitchenRequest },
    { id: "warehouse" as const, label: "المستودع الرئيسي", description: "مواد خام وتغليف ومستهلكات تُطلب بتحويل مخزني مستقل إلى الفرع.", steps: "طلب تحويل ← اعتماد ← إرسال ← تأكيد التسليم", icon: Warehouse, color: "inventory" as const, allowed: canWarehouse, create: onWarehouseRequest },
  ];
  if (!sources.some(source => source.allowed)) return null;
  return <section dir="rtl" className="space-y-3" aria-labelledby="branch-supply-heading" data-testid="branch-supply-sources">
    <div>
      <h2 id="branch-supply-heading" className="text-base font-bold text-foreground">جهة التوريد للفرع</h2>
      <p className="mt-1 text-sm text-muted-foreground">اختر الجهة حسب احتياجك. لكل جهة طلب مستقل ومسار متابعة واستلام خاص بها.</p>
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      {sources.filter(source => source.allowed).map(source => <article key={source.id} className={`min-w-0 rounded-2xl border bg-card p-4 shadow-sm ${current === source.id ? "border-primary/40 ring-1 ring-primary/10" : "border-border"}`} data-testid={`supply-source-${source.id}`}>
        <div className="flex items-start gap-3">
          <PlatformAppIcon icon={source.icon} color={source.color} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-foreground">{source.label}</h3>{current === source.id && <Badge variant="secondary">المسار الحالي</Badge>}</div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{source.description}</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-6 text-muted-foreground">{source.steps}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {source.create && <Button type="button" className="min-h-11" onClick={source.create} data-testid={`request-from-${source.id}`}><Plus className="ml-2 h-4 w-4" />طلب من {source.label}</Button>}
          {current !== source.id && <Button asChild variant="outline" className="min-h-11"><Link href={branchSupplyUrl(source.id, branchId)} data-testid={`open-${source.id}-requests`}>فتح طلبات {source.label}<ArrowLeft className="mr-2 h-4 w-4" /></Link></Button>}
          {current === source.id && !source.create && <span className="py-2 text-xs text-muted-foreground">عرض ومتابعة الطلبات حسب صلاحياتك</span>}
        </div>
      </article>)}
    </div>
    <p className="text-xs leading-6 text-muted-foreground">وجود مادة مستودع في طلب المطبخ لا يعني الصرف من المستودع الرئيسي؛ مصدرها مخزون المطبخ. الطلب وحده لا يضيف رصيدًا للفرع، والاستلام المؤكد هو المرجع.</p>
  </section>;
}