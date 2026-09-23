import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  RefreshCw,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { useBranchNavigation } from "@/hooks/use-branch-navigation";
import { branchBoardUrl, branchOperationUrl } from "@/lib/branch-operation-navigation";
import {
  AlertTriangle, BoardSkeleton, BusinessDate, EmptyState, NeedsActionStrip,
  OperationCardView, SectionHeader, Settings2, ShieldAlert, Store, groupCards, type OperationCard,
} from "@/components/branch-operations/presentation";

type BranchOperationsSummary = {
  branchId: string;
  generatedAt: string;
  businessDate: string;
  cards: OperationCard[];
};

export default function BranchOperationsPage() {
  const [, navigate] = useLocation();
  const client = useQueryClient();
  const { activeBranch, activeBranchId, switchBranch, isSwitchingBranch } = useAuth();
  const { branches, isLoading: branchesLoading } = useBranches();
  const navigation = useBranchNavigation(branches, branchesLoading);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [requestedBranchId, setRequestedBranchId] = useState<string | null>(null);
  const selectedBranchId = requestedBranchId ?? (navigation.hasBranchParam
    ? navigation.branchId : branches.find((branch) => branch.id === (activeBranchId ?? activeBranch?.id))?.id ?? branches[0]?.id ?? null);
  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId);
  // useBranches is server-filtered; this selector intentionally never exposes an all-branches option.
  const allowedBranches = useMemo(() => branches, [branches]);

  const board = useQuery<BranchOperationsSummary>({
    queryKey: ["/api/branch-operations/summary", selectedBranchId],
    enabled: Boolean(selectedBranchId) && !branchesLoading && !isSwitchingBranch,
    staleTime: 0,
    placeholderData: undefined,
    retry: false,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/branch-operations/summary?branchId=${encodeURIComponent(selectedBranchId!)}`, { credentials: "include", signal });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
  });

  const validBoard = board.data?.branchId === selectedBranchId ? board.data : undefined;
  const isForbidden = board.error instanceof Error && board.error.message === "403";

  useEffect(() => {
    if (!validBoard || isSwitchingBranch) return;
    const target = window.location.hash.slice(1);
    if (!validBoard.cards.some((card) => target === `branch-operation-card-${card.id}`)) return;
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(target);
      element?.scrollIntoView({ block: "center", behavior: "instant" });
      element?.querySelector("button")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [validBoard?.branchId, Boolean(validBoard), isSwitchingBranch]);

  const changeBranch = async (branchId: string) => {
    if (branchId === selectedBranchId) return;
    setSwitchError(null);
    setRequestedBranchId(branchId);
    await client.cancelQueries({ queryKey: ["/api/branch-operations/summary"] });
    client.removeQueries({ queryKey: ["/api/branch-operations/summary"] });
    try {
      const result = await switchBranch(branchId);
      client.setQueryData(["/api/auth/me"], (current: any) => current ? ({
        ...current,
        activeBranchId: result.activeBranchId,
        activeBranch: result.activeBranch,
      }) : current);
      navigate(branchBoardUrl(branchId), { replace: true });
    } catch {
      setSwitchError("تعذر تغيير الفرع. لم يتم فتح أي شاشة أخرى.");
    } finally {
      setRequestedBranchId(null);
    }
  };

  const go = (href: string) => {
    if (!selectedBranchId || isSwitchingBranch) return;
    try {
      navigate(branchOperationUrl(href, selectedBranchId));
    } catch {
      setSwitchError("تعذر فتح هذا المسار من لوحة الفرع. حدّث اللوحة وحاول مجددًا.");
    }
  };

  return (
    <Layout>
      <main className="branch-ops-shell page-container pb-10" dir="rtl" data-testid="branch-operations-page">
        <section className="pt-5 sm:pt-8">
          <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-3">
              <img src="/butter-logo.png" alt="Butter Bakery" className="mt-1 h-11 w-11 rounded-2xl bg-primary object-contain p-1.5 shadow-sm" />
              <div>
                <p className="text-xs font-bold tracking-[.16em] text-primary">BUTTER BAKERY · BRANCH DESK</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">لوحة الفرع التشغيلية</h1>
                <p className="mt-1 text-sm text-muted-foreground">نقطة البداية اليومية للفريق — ابدأ بالمبيعات والأهداف، ثم الطلبيات، ثم بقية المتابعات.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => board.refetch()} disabled={!selectedBranchId || board.isFetching} data-testid="button-refresh-branch-operations">
                <RefreshCw className={`ml-2 h-4 w-4 ${board.isFetching ? "animate-spin" : ""}`} />تحديث
              </Button>
              <span className="hidden text-xs text-muted-foreground sm:block">
                {validBoard ? `آخر تحديث: ${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", numberingSystem: "latn" }).format(new Date(validBoard.generatedAt))}` : ""}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-sm"><Store className="h-6 w-6" aria-hidden="true" /></div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">الفرع الحالي</p>
                <p className="font-extrabold text-foreground">{selectedBranch?.name ?? "اختر فرعًا للبدء"}</p>
              </div>
            </div>
            <Select value={selectedBranchId ?? undefined} onValueChange={changeBranch} disabled={branchesLoading || isSwitchingBranch || allowedBranches.length === 0}>
              <SelectTrigger className="min-h-11 w-full sm:w-[245px]" data-testid="select-branch-operations"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
              <SelectContent>{allowedBranches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {switchError && <p className="mt-2 text-sm font-semibold text-destructive" role="alert">{switchError}</p>}
        </section>

        {!selectedBranchId && !branchesLoading && (
          <EmptyState title="لا يوجد فرع محدد" text="تحتاج إلى فرع مسموح حتى تظهر أدوات يوم العمل." icon={Store} />
        )}
        {selectedBranchId && allowedBranches.length === 0 && !branchesLoading && (
          <EmptyState title="لا توجد فروع متاحة" text="لا توجد فروع مسموح بها في جلسة المستخدم الحالية." icon={ShieldAlert} />
        )}
        {selectedBranchId && (board.isLoading || isSwitchingBranch) && <BoardSkeleton />}
        {selectedBranchId && !board.isLoading && isForbidden && (
          <EmptyState title="لا تملك صلاحية عرض لوحة هذا الفرع" text="تأكد من الفرع المحدد أو تواصل مع مسؤول الصلاحيات." icon={ShieldAlert} />
        )}
        {selectedBranchId && !board.isLoading && board.isError && !isForbidden && (
          <EmptyState title="تعذر تحميل لوحة الفرع" text="لم نعرض أي بيانات قديمة. حاول التحديث مرة أخرى." icon={AlertTriangle} action={() => board.refetch()} />
        )}
        {validBoard && !isSwitchingBranch && !board.isLoading && !board.isError && (
          <>
            <BusinessDate value={validBoard.businessDate} />
            <NeedsActionStrip branchId={validBoard.branchId} cards={validBoard.cards} onOpen={go} />
            {validBoard.cards.length === 0 ? <EmptyState title="لا توجد وحدات متاحة" text="لا توجد صفحات تشغيلية مسموح بها لهذا الحساب في الفرع المحدد." icon={Settings2} /> : (
              <div className="mt-6 space-y-8">
                {groupCards(validBoard.cards).map(({ section, cards }) => (
                  <section key={section.id} aria-labelledby={`branch-ops-${section.id}`} data-testid={`branch-operations-section-${section.id}`}>
                    <SectionHeader section={section} count={cards.length} />
                    <div className="branch-ops-grid">
                      {cards.map((card) => <OperationCardView key={card.id} card={card} section={section} onOpen={go} onRefresh={() => board.refetch()} />)}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </Layout>
  );
}