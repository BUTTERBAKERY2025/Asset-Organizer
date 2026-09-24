import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  RefreshCw,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { MobilePushSettings } from "@/components/push-notification-prompt";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { useBranchNavigation } from "@/hooks/use-branch-navigation";
import { branchBoardUrl, branchOperationUrl, resolveBoardBranch } from "@/lib/branch-operation-navigation";
import { captureBranchDeskReturn, resolveBranchDeskReturnForCurrentSession, restoreBranchDeskScroll } from "@/lib/branch-operation-return-state";
import {
  AlertTriangle, BoardSkeleton, BusinessDate, EmptyState, NeedsActionStrip,
  OperationCardView, DayOverview, DailySalesProgress, QuickActions, SectionHeader, Settings2, ShieldAlert, Store, groupCards, isNavigationOnly, SECTIONS, type OperationCard,
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
  const { user, activeBranch, activeBranchId, switchBranch, isSwitchingBranch } = useAuth();
  const { branches, isLoading: branchesLoading } = useBranches();
  const navigation = useBranchNavigation(branches, branchesLoading);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [requestedBranchId, setRequestedBranchId] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const restoredReturnToken = useRef<string | null>(null);
  const requestedScope = navigation.hasBranchParam ? new URLSearchParams(window.location.search).get("branchId") ?? "" : null;
  const scope = resolveBoardBranch(requestedScope, branches, activeBranchId ?? activeBranch?.id);
  const selectedBranchId = requestedBranchId ?? scope.branchId;
  // useBranches is server-filtered; this selector intentionally never exposes an all-branches option.
  const allowedBranches = useMemo(() => branches, [branches]);

  const board = useQuery<BranchOperationsSummary>({
    queryKey: ["/api/branch-operations/summary", selectedBranchId],
    enabled: Boolean(selectedBranchId) && !branchesLoading && !isSwitchingBranch,
    staleTime: 0,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
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
    let frame = 0;
    const reveal = () => {
      const restored = user?.id && selectedBranchId
        ? resolveBranchDeskReturnForCurrentSession(String(user.id), selectedBranchId, window.location.search, window.history.state)
        : null;
      if (restored) {
        if (restoredReturnToken.current === restored.token) return;
        restoredReturnToken.current = restored.token;
        frame = requestAnimationFrame(() => restoreBranchDeskScroll(restored));
        return;
      }
      const target = window.location.hash.slice(1);
      const card = validBoard.cards.find((item) => target === `branch-operation-card-${item.id}`);
      if (!card) return;
      frame = requestAnimationFrame(() => {
        const element = document.getElementById(target);
        let parent = element?.parentElement;
        while (parent) {
          if (parent instanceof HTMLDetailsElement) parent.open = true;
          parent = parent.parentElement;
        }
        element?.scrollIntoView({ block: "center", behavior: "instant" });
        element?.querySelector<HTMLButtonElement>(".branch-ops-card-main")?.focus({ preventScroll: true });
      });
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", reveal); };
  }, [validBoard, isSwitchingBranch, selectedBranchId, user?.id]);

  useEffect(() => {
    setExpandedCardId(null);
  }, [selectedBranchId]);

  const changeBranch = async (branchId: string) => {
    if (!allowedBranches.some(branch => branch.id === branchId) || isSwitchingBranch) return;
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
    if (!selectedBranchId || !user?.id || isSwitchingBranch) return;
    try {
      const destination = branchOperationUrl(href, selectedBranchId);
      navigate(captureBranchDeskReturn(String(user.id), selectedBranchId, destination));
    } catch {
      setSwitchError("تعذر فتح هذا المسار من لوحة الفرع. حدّث اللوحة وحاول مجددًا.");
    }
  };

  return (
    <Layout>
      <main className="branch-ops-shell page-container pb-10" dir="rtl" data-testid="branch-operations-page">
        <section className="pt-4">
          <div className="branch-ops-head border-b border-border pb-3">
            <div className="min-w-0">
              <div>
                <h1 className="text-xl font-black text-foreground">لوحة الفرع التشغيلية</h1>
                <p className="mt-1 text-xs text-muted-foreground">متابعة يوم العمل في فرعك {validBoard && !board.isError && <span className="mr-2 inline-block"><BusinessDate value={validBoard.businessDate} /></span>}</p>
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Select value={selectedBranchId ?? undefined} onValueChange={changeBranch} disabled={branchesLoading || isSwitchingBranch || allowedBranches.length === 0}>
                <SelectTrigger className="min-h-11 min-w-0 flex-1 sm:w-[220px] sm:flex-none" data-testid="select-branch-operations"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent>{allowedBranches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="min-h-11 shrink-0" onClick={() => board.refetch()} disabled={!selectedBranchId || board.isFetching} data-testid="button-refresh-branch-operations">
                <RefreshCw className={`ml-2 h-4 w-4 ${board.isFetching ? "animate-spin" : ""}`} />تحديث
              </Button>
              <span className="basis-full text-xs text-muted-foreground sm:basis-auto">
                {validBoard && !board.isError ? `آخر تحديث: ${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", numberingSystem: "latn" }).format(new Date(validBoard.generatedAt))}` : ""}
              </span>
            </div>
          </div>
          {switchError && <p className="mt-2 text-sm font-semibold text-destructive" role="alert">{switchError}</p>}
        </section>

        {scope.invalidScope && !branchesLoading && !requestedBranchId && !switchError && (
          <EmptyState title="الفرع المطلوب غير متاح" text="هذا الفرع غير موجود ضمن فروعك المسموح بها. اختر فرعًا من القائمة للمتابعة." icon={ShieldAlert} />
        )}
        {!selectedBranchId && !scope.invalidScope && !branchesLoading && (
          <EmptyState title="لا يوجد فرع محدد" text="تحتاج إلى فرع مسموح حتى تظهر أدوات يوم العمل." icon={Store} />
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
            <div className="branch-ops-daily-deck">
              <DayOverview cards={validBoard.cards} compact />
              <DailySalesProgress cards={validBoard.cards} compact />
              <div className="branch-ops-action-layout">
                <NeedsActionStrip key={validBoard.branchId} branchId={validBoard.branchId} cards={validBoard.cards} onOpen={go} compact />
                <div className="branch-ops-side-stack">
                  <QuickActions key={`quick-${validBoard.branchId}`} cards={validBoard.cards} onOpen={go} compact />
                  <NeedsActionStrip key={`routine-${validBoard.branchId}`} branchId={validBoard.branchId} cards={validBoard.cards} onOpen={go} routine compact />
                </div>
              </div>
            </div>
            {validBoard.cards.length === 0 ? <EmptyState title="لا توجد وحدات متاحة" text="لا توجد صفحات تشغيلية مسموح بها لهذا الحساب في الفرع المحدد." icon={Settings2} /> : (
              <div className="mt-6 space-y-8">
                <h2 className="text-lg font-black">المؤشرات وصفحات العمل</h2>
                {groupCards(validBoard.cards.filter(card => !isNavigationOnly(card))).map(({ section, cards }) => section.id === "people" ? (
                  <details key={`${validBoard.branchId}-${section.id}`} className="rounded-xl border border-border bg-muted/20 p-4" data-testid="branch-operations-section-people">
                    <summary className="min-h-8 cursor-pointer font-bold" id="branch-ops-people">{section.label}</summary>
                    <p className="mb-3 text-xs text-muted-foreground">{section.hint}</p>
                    <div className="branch-ops-grid">{cards.map(card => <OperationCardView key={card.id} card={card} section={section} onOpen={go} onRefresh={() => board.refetch()} expanded={expandedCardId === card.id} onToggle={() => setExpandedCardId(current => current === card.id ? null : card.id)} />)}</div>
                  </details>
                ) : (
                  <section key={section.id} aria-labelledby={`branch-ops-${section.id}`} data-testid={`branch-operations-section-${section.id}`}>
                    <SectionHeader section={section} count={cards.length} />
                    <div className="branch-ops-grid">
                      {cards.map((card) => <OperationCardView key={card.id} card={card} section={section} onOpen={go} onRefresh={() => board.refetch()} expanded={expandedCardId === card.id} onToggle={() => setExpandedCardId(current => current === card.id ? null : card.id)} />)}
                    </div>
                  </section>
                ))}
                {validBoard.cards.some(isNavigationOnly) && <details className="rounded-xl border bg-muted/20 p-4" data-testid="branch-operations-navigation-only">
                  <summary className="min-h-11 cursor-pointer font-bold">روابط تنقل فقط ({validBoard.cards.filter(isNavigationOnly).length})</summary>
                  <p className="mb-3 text-xs text-muted-foreground">هذه الصفحات لا توفر مؤشرات للوحة؛ فتحها لا يعني وجود إجراء مطلوب أو اكتماله.</p>
                  <div className="branch-ops-grid">{validBoard.cards.filter(isNavigationOnly).map(card => <OperationCardView key={card.id} card={card} section={SECTIONS[2]} onOpen={go} onRefresh={() => board.refetch()} expanded={expandedCardId === card.id} onToggle={() => setExpandedCardId(current => current === card.id ? null : card.id)} />)}</div>
                </details>}
              </div>
            )}
            <details className="mt-8 rounded-xl border border-border bg-muted/20 px-3 py-2" data-testid="branch-operations-push-settings">
              <summary className="flex min-h-11 cursor-pointer items-center font-bold text-foreground">إعدادات إشعارات الجوال</summary>
              <MobilePushSettings compact className="mb-1 mt-2 border-0 bg-card shadow-none" />
            </details>
          </>
        )}
      </main>
    </Layout>
  );
}