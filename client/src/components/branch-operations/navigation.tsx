import { Link, useLocation } from "wouter";
import { ArrowRight, Home } from "lucide-react";
import { useBranches } from "@/hooks/useBranches";
import { useAuth } from "@/hooks/useAuth";
import { useBranchNavigation } from "@/hooks/use-branch-navigation";
import { branchBoardUrl, branchOperationDestination } from "@/lib/branch-operation-navigation";
import { Button } from "@/components/ui/button";

export function BranchOperationsNavigation() {
  const [path] = useLocation();
  const destination = branchOperationDestination(path);
  return destination ? <NavigationContext path={path} destination={destination} /> : null;
}

function NavigationContext({ path, destination }: {
  path: string;
  destination: NonNullable<ReturnType<typeof branchOperationDestination>>;
}) {
  const { branches, isLoading, userBranchId } = useBranches();
  const { activeBranchId } = useAuth();
  const navigation = useBranchNavigation(branches, isLoading, userBranchId);
  const branchId = navigation.hasBranchParam ? navigation.branchId
    : branches.find((branch) => branch.id === activeBranchId)?.id ?? userBranchId ?? null;
  const branch = branches.find((item) => item.id === branchId);

  return <nav dir="rtl" aria-label="مسار العمل" className="mx-3 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 sm:mx-6" data-testid="branch-operations-navigation">
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Link href="/" className="inline-flex min-h-10 items-center gap-1 text-primary"><Home className="h-4 w-4" aria-hidden="true" />الرئيسية</Link>
      <span aria-hidden="true">/</span><span>{destination.section}</span>
      <span aria-hidden="true">/</span><span aria-current="page" className="font-bold text-foreground">{destination.label}</span>
    </div>
    {isLoading ? <Button variant="outline" size="sm" className="min-h-11" disabled>جار تحديد الفرع…</Button> : <Button asChild variant="outline" size="sm" className="min-h-11">
      <Link href={branchBoardUrl(branchId, path)} aria-label={`العودة إلى لوحة الفرع${branch ? ` · ${branch.name}` : ""}`} data-testid="return-to-branch-operations">
        <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />لوحة الفرع{branch ? ` · ${branch.name}` : ""}
      </Link>
    </Button>}
  </nav>;
}