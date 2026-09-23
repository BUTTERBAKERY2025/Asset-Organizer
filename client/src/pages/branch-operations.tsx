import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  AlertTriangle, BadgeAlert, BriefcaseBusiness, CalendarDays, ChevronLeft,
  ClipboardCheck, FileText, Gauge, PackageCheck, RefreshCw, Settings2, ShieldAlert,
  ShoppingBasket, Store, UsersRound, WalletCards, Wrench,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";

type BranchOperationsCard = {
  id: "maintenance" | "waste" | "purchasing" | "kitchen" | "closing" | "targets" | "sales" | "employees" | "documents" | "advances";
  title: string;
  group: "operations" | "sales" | "people";
  href: string;
  state: "ready" | "error";
  metrics: Array<{ label: string; value: number; unit?: string }>;
  alerts: Array<{ label: string; count: number; href: string }>;
};

type BranchOperationsSummary = {
  branchId: string;
  generatedAt: string;
  businessDate: string;
  cards: BranchOperationsCard[];
};

const GROUP_META = {
  operations: { label: "تشغيل الفرع", accent: "var(--ops-mint)", icon: Gauge },
  sales: { label: "المبيعات والإقفال", accent: "var(--ops-gold)", icon: WalletCards },
  people: { label: "الفريق والملفات", accent: "var(--ops-sky)", icon: UsersRound },
} as const;

const CARD_META: Record<BranchOperationsCard["id"], { icon: typeof Wrench; tint: string }> = {
  maintenance: { icon: Wrench, tint: "#d97656" },
  waste: { icon: PackageCheck, tint: "#a05b74" },
  purchasing: { icon: ShoppingBasket, tint: "#497d76" },
  kitchen: { icon: ClipboardCheck, tint: "#5b77a5" },
  closing: { icon: BriefcaseBusiness, tint: "#96633f" },
  targets: { icon: Gauge, tint: "#8c5d9a" },
  sales: { icon: WalletCards, tint: "#367d94" },
  employees: { icon: UsersRound, tint: "#56754c" },
  documents: { icon: FileText, tint: "#856a4d" },
  advances: { icon: BadgeAlert, tint: "#a44c59" },
};

function toUrl(href: string, branchId: string) {
  const url = new URL(href, window.location.origin);
  url.searchParams.set("branchId", branchId);
  return `${url.pathname}${url.search}${url.hash}`;
}

function formatServerDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
        timeZone: "Asia/Riyadh",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(parsed);
}

export default function BranchOperationsPage() {
  const [, navigate] = useLocation();
  const client = useQueryClient();
  const { activeBranch, activeBranchId, switchBranch, isSwitchingBranch } = useAuth();
  const { branches, isLoading: branchesLoading } = useBranches();
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [requestedBranchId, setRequestedBranchId] = useState<string | null>(null);
  const selectedBranchId = requestedBranchId ?? activeBranchId ?? activeBranch?.id ?? null;
  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? activeBranch;
  // useBranches is server-filtered; this selector intentionally never exposes an all-branches option.
  const allowedBranches = useMemo(() => branches, [branches]);

  const board = useQuery<BranchOperationsSummary>({
    queryKey: ["/api/branch-operations/summary", selectedBranchId],
    enabled: Boolean(selectedBranchId) && !isSwitchingBranch,
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
    } catch {
      setSwitchError("تعذر تغيير الفرع. لم يتم فتح أي شاشة أخرى.");
    } finally {
      setRequestedBranchId(null);
    }
  };

  const go = (href: string) => {
    if (!selectedBranchId || isSwitchingBranch) return;
    navigate(toUrl(href, selectedBranchId));
  };

  return (
    <Layout>
      <main className="branch-ops-shell page-container pb-10" dir="rtl" data-testid="branch-operations-page">
        <section className="pt-5 sm:pt-8">
          <div className="flex flex-col gap-4 border-b border-[#decdbd] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-3">
              <img src="/butter-logo.png" alt="Butter Bakery" className="mt-1 h-11 w-11 rounded-2xl object-contain bg-[#713b5d] p-1.5 shadow-sm" />
              <div>
                <p className="text-xs font-bold tracking-[.16em] text-[#713b5d]">BUTTER BAKERY · BRANCH DESK</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-[#332c3d] sm:text-3xl">لوحة الفرع التشغيلية</h1>
                <p className="mt-1 text-sm text-[#6d6270]">نقطة البداية اليومية للفريق — اختر ما يحتاج إلى متابعة الآن.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="border-[#d9c4b4] bg-[#fffaf3] text-[#713b5d] hover:bg-[#f3e5d4]" onClick={() => board.refetch()} disabled={!selectedBranchId || board.isFetching} data-testid="button-refresh-branch-operations">
                <RefreshCw className={`ml-2 h-4 w-4 ${board.isFetching ? "animate-spin" : ""}`} />تحديث
              </Button>
              <span className="hidden text-xs text-[#786b72] sm:block">
                {validBoard ? `آخر تحديث: ${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", numberingSystem: "latn" }).format(new Date(validBoard.generatedAt))}` : ""}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#e7d7c7] bg-[#fffdf9] p-3 shadow-[0_8px_24px_rgb(89_58_62/.05)] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f3e5d4] text-[#713b5d]"><Store className="h-5 w-5" /></div>
              <div>
                <p className="text-xs font-semibold text-[#76666b]">الفرع الحالي</p>
                <p className="font-extrabold text-[#332c3d]">{selectedBranch?.name ?? "اختر فرعًا للبدء"}</p>
              </div>
            </div>
            <Select value={selectedBranchId ?? undefined} onValueChange={changeBranch} disabled={branchesLoading || isSwitchingBranch || allowedBranches.length === 0}>
              <SelectTrigger className="min-h-11 w-full border-[#d9c4b4] bg-[#fffaf3] sm:w-[245px]" data-testid="select-branch-operations"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
              <SelectContent>{allowedBranches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {switchError && <p className="mt-2 text-sm font-semibold text-[#b34c48]" role="alert">{switchError}</p>}
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
            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#713b5d] px-3 py-1.5 font-bold text-[#fffaf3]"><CalendarDays className="h-4 w-4" />يوم العمل: {formatServerDate(validBoard.businessDate)}</span>
              <span className="text-[#786b72]">المؤشرات والتنبيهات حسب صلاحياتك في هذا الفرع.</span>
            </div>
            <NeedsActionStrip branchId={validBoard.branchId} cards={validBoard.cards} onOpen={go} />
            {validBoard.cards.length === 0 ? <EmptyState title="لا توجد وحدات متاحة" text="لا توجد صفحات تشغيلية مسموح بها لهذا الحساب في الفرع المحدد." icon={Settings2} /> : (
              <div className="mt-6 space-y-8">
                {(["operations", "sales", "people"] as const).map((group) => {
                  const cards = validBoard.cards.filter((card) => card.group === group);
                  if (!cards.length) return null;
                  const meta = GROUP_META[group];
                  const GroupIcon = meta.icon;
                  return <section key={group} aria-labelledby={`branch-ops-${group}`}>
                    <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: meta.accent }}><GroupIcon className="h-4 w-4" /></span><h2 id={`branch-ops-${group}`} className="font-black text-[#403442]">{meta.label}</h2><span className="h-px flex-1 bg-[#decdbd]" /></div>
                    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                      {cards.map((card) => <OperationCard key={card.id} card={card} onOpen={go} onRefresh={() => board.refetch()} />)}
                    </div>
                  </section>;
                })}
              </div>
            )}
          </>
        )}
      </main>
    </Layout>
  );
}

function NeedsActionStrip({ branchId, cards, onOpen }: { branchId: string; cards: BranchOperationsCard[]; onOpen: (href: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [branchId]);
  const actions = cards.flatMap((card) => card.state === "ready"
    ? card.alerts
        .filter((alert) => alert.count > 0)
        .map((alert, index) => ({ ...alert, cardId: card.id, cardTitle: card.title, index }))
    : []);
  const allReady = cards.every((card) => card.state === "ready");

  return <section className="mt-4 rounded-2xl border border-[#e4cabc] bg-[#fff8f0] p-3" aria-labelledby="branch-ops-needs-action" data-testid="branch-operations-needs-action">
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f7ddd7] text-[#a54640]"><BadgeAlert className="h-4 w-4" /></span>
      <h2 id="branch-ops-needs-action" className="font-black text-[#403442]">يحتاج إجراء</h2>
    </div>
    {actions.length > 0 ? (
      <div className="mt-2.5 flex flex-wrap gap-2">
        {actions.map((action, position) => (
          <button
            key={`${action.cardId}-${action.index}-${action.href}`}
            type="button"
            className={`${!expanded && position >= 4 ? "hidden sm:inline-flex" : "inline-flex"} min-h-11 items-center gap-1.5 rounded-xl border border-[#edcbc3] bg-white px-3 text-xs font-bold text-[#8f3f3d] shadow-sm hover:bg-[#fcece8]`}
            onClick={() => onOpen(action.href)}
            data-testid={`branch-operation-top-action-${action.cardId}-${action.index}`}
          >
            <span className="rounded-md bg-[#f7ddd7] px-1.5 py-0.5 font-black">{action.count.toLocaleString("en-US")}</span>
            <span>{action.cardTitle} · {action.label}</span>
          </button>
        ))}
        {actions.length > 4 && (
          <button type="button" className="min-h-11 px-2 text-xs font-black text-[#713b5d] sm:hidden" onClick={() => setExpanded((value) => !value)} data-testid="button-toggle-branch-actions">
            {expanded ? "عرض أقل" : `عرض المزيد (${actions.length - 4})`}
          </button>
        )}
      </div>
    ) : (
      <p className="mt-2 text-sm text-[#74656d]" data-testid="branch-operations-actions-empty">
        {allReady ? "لا توجد إجراءات معلقة ضمن الوحدات المتاحة." : "تعذر التحقق من بعض الوحدات؛ أعد المحاولة قبل اعتبار يوم العمل مكتملًا."}
      </p>
    )}
  </section>;
}

function OperationCard({ card, onOpen, onRefresh }: { card: BranchOperationsCard; onOpen: (href: string) => void; onRefresh: () => void }) {
  const meta = CARD_META[card.id];
  const Icon = meta.icon;
  const urgent = card.alerts.filter((alert) => alert.count > 0);
  return <article className="branch-ops-tile rounded-2xl border border-[#e4d5c8] bg-[#fffdf9] p-3 text-[#332c3d] sm:p-4" style={{ color: meta.tint }} data-testid={`branch-operation-card-${card.id}`}>
    <div className="flex items-start justify-between gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-current/10"><Icon className="h-5 w-5" /></span>
      {card.state === "error" && <span className="inline-flex items-center gap-1 rounded-full bg-[#f9dfda] px-2 py-1 text-xs font-bold text-[#a53e3e]"><AlertTriangle className="h-3.5 w-3.5" />يحتاج تحديثًا</span>}
    </div>
    <h3 className="mt-3 text-base font-black leading-tight text-[#332c3d] sm:text-lg">{card.title}</h3>
    {card.state === "error" ? <Button variant="ghost" className="mt-3 h-11 px-0 font-bold text-[#a53e3e] hover:bg-transparent hover:text-[#84302f]" onClick={onRefresh}><RefreshCw className="ml-2 h-4 w-4" />إعادة المحاولة</Button> : <>
      {card.metrics.length > 0 && <div className="mt-2.5 flex flex-col gap-1">{card.metrics.map((metric) => <span key={metric.label} className="text-xs leading-5 text-[#655863] sm:text-sm"><b className="font-black text-[#332c3d]">{metric.value.toLocaleString("en-US")}{metric.unit ? ` ${metric.unit}` : ""}</b> {metric.label}</span>)}</div>}
      {urgent.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5">{urgent.map((alert) => <button key={alert.label} type="button" className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-[#f9e1dc] px-2 text-xs font-bold leading-tight text-[#a54640] hover:bg-[#f4d0c8]" onClick={() => onOpen(alert.href)}><span>{alert.count.toLocaleString("en-US")}</span>{alert.label}</button>)}</div>}
      <button type="button" className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-black text-[#713b5d] hover:text-[#49223c]" onClick={() => onOpen(card.href)}>فتح الصفحة <ChevronLeft className="h-4 w-4" /></button>
    </>}
  </article>;
}

function EmptyState({ title, text, icon: Icon, action }: { title: string; text: string; icon: typeof Store; action?: () => void }) {
  return <section className="mt-8 rounded-3xl border border-dashed border-[#d6bdac] bg-[#fffdf9] px-5 py-14 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3e5d4] text-[#713b5d]"><Icon className="h-6 w-6" /></span><h2 className="mt-4 text-lg font-black text-[#332c3d]">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm text-[#74656d]">{text}</p>{action && <Button className="mt-5 bg-[#713b5d] hover:bg-[#593049]" onClick={action}><RefreshCw className="ml-2 h-4 w-4" />تحديث اللوحة</Button>}</section>;
}

function BoardSkeleton() {
  return <div className="mt-7 space-y-7" aria-label="جار تحميل لوحة الفرع"><div className="branch-ops-shimmer h-8 w-44 rounded-lg" /><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="branch-ops-shimmer h-44 rounded-2xl" />)}</div></div>;
}