import { Link, useLocation } from "wouter";
import { ArrowRight, Home } from "lucide-react";
import { useBranches } from "@/hooks/useBranches";
import { useAuth } from "@/hooks/useAuth";
import { useBranchNavigation } from "@/hooks/use-branch-navigation";
import { branchOperationDestination } from "@/lib/branch-operation-navigation";
import { branchDeskReturnUrl } from "@/lib/branch-operation-return-state";
import { Button } from "@/components/ui/button";

export function BranchOperationsNavigation() {
  const [path] = useLocation();
  const fromCenter = new URLSearchParams(window.location.search).get("from") === "operations-center";
  const sourcePath = /^\/cashier-journals\/[1-9]\d*$/.test(path) ? "/cashier-journals"
    : /^\/branch-daily-closures\/[1-9]\d*$/.test(path) ? "/branch-daily-closing" : path;
  const destination = branchOperationDestination(sourcePath) || (fromCenter ? ({
    "/hr/leaves": { section: "الموظفون", label: "طلبات الإجازات" },
    "/driver-deliveries": { section: "التوريد", label: "مهمة التوصيل" },
    "/reverse-logistics": { section: "التوريد", label: "حركة المرتجعات" },
    "/quality-control": { section: "الجودة", label: "فحص الجودة" },
  } as Record<string, { section: string; label: string }>)[path] : undefined);
  return destination ? <NavigationContext path={path} destination={destination} /> : null;
}

function NavigationContext({ path, destination }: {
  path: string;
  destination: { section: string; label: string };
}) {
  const { branches, isLoading, userBranchId } = useBranches();
  const { activeBranchId } = useAuth();
  const navigation = useBranchNavigation(branches, isLoading, userBranchId);
  const branchId = navigation.hasBranchParam ? navigation.branchId
    : branches.find((branch) => branch.id === activeBranchId)?.id ?? userBranchId ?? null;
  const branch = branches.find((item) => item.id === branchId);
  const params = new URLSearchParams(window.location.search);
  const fromCenter = params.get("from") === "operations-center";
  const centerIds = (params.get("centerBranchIds") || "").split(",").filter(id => branches.some(b => b.id === id));
  const centerHref = `/operations-center${centerIds.length ? `?${new URLSearchParams({ branchIds: centerIds.join(",") })}` : ""}`;

  return <nav dir="rtl" aria-label="مسار العمل" className="mx-3 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 sm:mx-6" data-testid="branch-operations-navigation">
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Link href="/" className="inline-flex min-h-10 items-center gap-1 text-primary"><Home className="h-4 w-4" aria-hidden="true" />الرئيسية</Link>
      <span aria-hidden="true">/</span><span>{destination.section}</span>
      <span aria-hidden="true">/</span><span aria-current="page" className="font-bold text-foreground">{destination.label}</span>
    </div>
    {isLoading ? <Button variant="outline" size="sm" className="min-h-11" disabled>جار تحديد الفرع…</Button> : <Button asChild variant="outline" size="sm" className="min-h-11">
       <Link href={fromCenter ? centerHref : branchDeskReturnUrl(branchId, path, window.location.search)} aria-label={fromCenter ? "العودة إلى مركز إدارة التشغيل" : `العودة إلى لوحة الفرع${branch ? ` · ${branch.name}` : ""}`} data-testid="return-to-branch-operations">
         <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />{fromCenter ? "مركز إدارة التشغيل" : `لوحة الفرع${branch ? ` · ${branch.name}` : ""}`}
      </Link>
    </Button>}
  </nav>;
}