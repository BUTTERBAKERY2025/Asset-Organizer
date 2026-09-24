import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { SettingsBreadcrumb } from "@/components/settings-breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle, CheckCircle2, ClipboardCheck, DatabaseBackup, FileCheck2,
  FileWarning, Loader2, PackageSearch, RefreshCw, RotateCcw, ShieldAlert, Trash2,
} from "lucide-react";
import {
  buildCatalogueImportApprovals,
  aliasDerivedUsageSections,
  canManuallyAdoptCode,
  createCatalogueApplyIdempotencyKey,
  reviewRowKey,
  selectableCurrentRecords,
  unresolvedCatalogueRows,
  type CatalogueImportAction,
  type CatalogueCurrentRecord,
  type CatalogueReviewDecision,
  type CatalogueReviewRow,
} from "@/lib/catalogue-import";

type SourceTotals = {
  products?: { rows?: number; unique?: number; duplicateRows?: number; conflictingRows?: number };
  warehouse?: { rows?: number; unique?: number; duplicateRows?: number; conflictingRows?: number };
  categories?: { rows?: number; entries?: number; unmatched?: number };
};

type CatalogueReviewResponse = {
  targetId: string | null;
  sourceChecksum: string;
  snapshotChecksum: string;
  currentCatalogues?: Partial<Record<"products" | "warehouse", CatalogueCurrentRecord[]>>;
  reconciliation: {
    sourceTotals: SourceTotals;
    productRows: CatalogueReviewRow[];
    warehouseRows: CatalogueReviewRow[];
    legacyRows: CatalogueReviewRow[];
  };
};

type Operation = {
  namespace: string;
  action: string;
  sourceCode?: string;
  currentId?: number;
  name?: string;
  unit?: string;
  category?: string;
  price?: number;
  availabilityDisposition?: "active_priced" | "inactive_pending_price";
  usageSections?: string[];
  reason?: string;
  deleted?: boolean;
  deferred?: boolean;
  before?: Record<string, unknown>;
};

type RollbackPlan = {
  reversibleMetadataOperations?: number;
  irreversibleHardDeletes?: number;
  notes?: string[];
};

type StagedPlan = {
  id: string;
  status: "staged" | "applied";
  targetId: string;
  sourceChecksum: string;
  snapshotChecksum: string;
  planChecksum: string;
  reviewRequiredCount: number;
  operations: Operation[];
  rollbackPlan: RollbackPlan;
  appliedSummary?: ApplySummary;
};

type ApplySummary = {
  appliedAt?: string;
  backupId?: number;
  actorId?: string;
  counts?: Record<string, number>;
  operations?: Operation[];
  rollbackPlan?: RollbackPlan;
};

type ApplyResponse = StagedPlan & { replayed: boolean; summary?: ApplySummary };
type Backup = { id: number; name: string; status: string; createdAt?: string };

const REVIEW_URL = "/api/admin/catalogue-import/review";
const STAGE_URL = "/api/admin/catalogue-import/stage";
const LEGACY_ACTIONS: Array<{ value: CatalogueImportAction; label: string }> = [
  { value: "defer", label: "إبقاء دون تغيير (تأجيل)" },
  { value: "deactivate", label: "تعطيل السجل" },
  { value: "hard_delete", label: "طلب حذف نهائي بعد إثبات عدم الاستخدام" },
];

async function apiError(response: Response): Promise<never> {
  let message = response.statusText || "فشل الطلب";
  try {
    const body = await response.json() as { error?: string };
    message = body.error || message;
  } catch {
    // The HTTP status remains useful if a proxy returned a non-JSON error.
  }
  throw new Error(`${response.status}: ${message}`);
}

async function getReview(): Promise<CatalogueReviewResponse> {
  const response = await fetch(REVIEW_URL, { credentials: "include", cache: "no-store" });
  if (!response.ok) return apiError(response);
  return response.json();
}

function checksum(value: string | null | undefined): string {
  if (!value) return "غير متاح";
  return `${value.slice(0, 16)}…${value.slice(-12)}`;
}

function stableCatalogueApplyKey(planId: string): string {
  const storageKey = `catalogue-import-apply-key:${planId}`;
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing && /^[A-Za-z0-9._:-]{16,128}$/.test(existing)) return existing;
    const created = createCatalogueApplyIdempotencyKey(planId);
    sessionStorage.setItem(storageKey, created);
    return created;
  } catch {
    return createCatalogueApplyIdempotencyKey(planId);
  }
}

function balance(value: unknown): string {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function statusBadge(row: CatalogueReviewRow) {
  if (row.status === "exact_match") return <Badge className="bg-emerald-600">مطابقة كود دقيقة</Badge>;
  if (row.status === "add_candidate") return <Badge className="bg-blue-600">إضافة بعد اعتماد</Badge>;
  if (row.status === "legacy_review") return <Badge variant="destructive">سجل قديم للمراجعة</Badge>;
  return <Badge className="bg-amber-500">مراجعة يدوية</Badge>;
}

function sourceSummary(title: string, data: { rows?: number; unique?: number; duplicateRows?: number; conflictingRows?: number; entries?: number; unmatched?: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="mt-1 text-xl font-bold tabular-nums">{(data.unique ?? data.entries ?? 0).toLocaleString("en")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {data.rows ?? 0} صف · {data.duplicateRows ?? 0} مكرر
          {data.conflictingRows ? ` · ${data.conflictingRows} متعارض` : ""}
          {data.unmatched !== undefined ? ` · ${data.unmatched} بلا تطابق قسم` : ""}
        </p>
      </CardContent>
    </Card>
  );
}

export default function CatalogueImportPage() {
  const { toast } = useToast();
  const [decisions, setDecisions] = useState<Record<string, CatalogueReviewDecision>>({});
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [stagedPlan, setStagedPlan] = useState<StagedPlan | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [backupId, setBackupId] = useState("");
  const [targetAcknowledged, setTargetAcknowledged] = useState(false);
  const [backupAcknowledged, setBackupAcknowledged] = useState(false);
  const [applyText, setApplyText] = useState("");
  const [applyKey, setApplyKey] = useState("");
  const [applyResult, setApplyResult] = useState<ApplyResponse | null>(null);
  const [savedPlanId, setSavedPlanId] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);

  const reviewQuery = useQuery({
    queryKey: [REVIEW_URL],
    queryFn: getReview,
    staleTime: 0,
  });
  const backupsQuery = useQuery<Backup[]>({
    queryKey: ["/api/backups"],
    queryFn: async () => {
      const response = await fetch("/api/backups", { credentials: "include" });
      if (!response.ok) return apiError(response);
      return response.json();
    },
    enabled: applyOpen,
  });

  const review = reviewQuery.data;
  const reconciliation = review?.reconciliation;
  const reviewRows = useMemo(
    () => [...(reconciliation?.productRows ?? []), ...(reconciliation?.warehouseRows ?? []), ...(reconciliation?.legacyRows ?? [])],
    [reconciliation],
  );
  const unresolved = useMemo(() => unresolvedCatalogueRows(reviewRows, decisions), [reviewRows, decisions]);
  const approvals = useMemo(() => buildCatalogueImportApprovals(reviewRows, decisions), [reviewRows, decisions]);

  const updateDecision = (row: CatalogueReviewRow, patch: Partial<CatalogueReviewDecision>) => {
    const key = reviewRowKey(row);
    setDecisions((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { action: "defer" }), ...patch },
    }));
  };

  const stageMutation = useMutation({
    mutationFn: async () => {
      if (!review?.targetId) throw new Error("لم يتم تأكيد هدف الاستيراد المستقل في بيئة النشر.");
      const response = await fetch(STAGE_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: review.targetId,
          sourceChecksum: review.sourceChecksum,
          snapshotChecksum: review.snapshotChecksum,
          reviewAcknowledgement: "CATALOGUE_REVIEWED",
          approvals,
        }),
      });
      if (!response.ok) return apiError(response);
      return response.json() as Promise<StagedPlan>;
    },
    onSuccess: (plan) => {
      setStagedPlan(plan);
      setSavedPlanId(plan.id);
      setApplyKey("");
      setApplyResult(null);
      setLastError(null);
      toast({ title: "تم تجهيز الخطة", description: `رقم الخطة: ${plan.id}` });
    },
    onError: (error: Error) => {
      setLastError(error.message);
      toast({ title: "لم تُجهّز الخطة", description: error.message, variant: "destructive" });
    },
  });

  const loadPlanMutation = useMutation({
    mutationFn: async () => {
      const planId = savedPlanId.trim();
      if (!planId) throw new Error("أدخل رقم خطة محفوظة لتحميلها.");
      const response = await fetch(`/api/admin/catalogue-import/plans/${encodeURIComponent(planId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) return apiError(response);
      return response.json() as Promise<StagedPlan>;
    },
    onSuccess: (plan) => {
      setStagedPlan(plan);
      setSavedPlanId(plan.id);
      setApplyKey("");
      setApplyResult(null);
      setLastError(null);
      toast({ title: "تم تحميل الخطة المحفوظة", description: `رقم الخطة: ${plan.id}` });
    },
    onError: (error: Error) => {
      setLastError(error.message);
      toast({ title: "تعذر تحميل الخطة", description: error.message, variant: "destructive" });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!stagedPlan) throw new Error("جهّز خطة المراجعة أولاً.");
      if (!backupId) throw new Error("اختر نسخة احتياطية مكتملة أُنشئت بعد تجهيز الخطة.");
      const key = applyKey || stableCatalogueApplyKey(stagedPlan.id);
      if (!applyKey) setApplyKey(key);
      const response = await fetch(`/api/admin/catalogue-import/plans/${stagedPlan.id}/apply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({
          targetId: stagedPlan.targetId,
          backupId: Number(backupId),
          applyConfirmation: applyText,
        }),
      });
      if (!response.ok) return apiError(response);
      return response.json() as Promise<ApplyResponse>;
    },
    onSuccess: (result) => {
      setApplyResult(result);
      setStagedPlan(result);
      setApplyOpen(false);
      setLastError(null);
      toast({
        title: result.replayed ? "تمت إعادة نتيجة التطبيق المحفوظة" : "تم تطبيق الخطة بنجاح",
        description: result.replayed ? "لم تُنفذ عملية ثانية." : "حُفظ ملخص التدقيق وخطة التراجع.",
      });
    },
    onError: (error: Error) => {
      setLastError(error.message);
      toast({ title: "رُفض تطبيق الخطة بأمان", description: error.message, variant: "destructive" });
    },
  });

  const openApply = () => {
    if (!stagedPlan) return;
    setApplyText("");
    setBackupId("");
    setTargetAcknowledged(false);
    setBackupAcknowledged(false);
    setApplyKey((current) => current || stableCatalogueApplyKey(stagedPlan.id));
    setApplyOpen(true);
  };

  if (reviewQuery.isLoading) {
    return <Layout><div className="page-container flex min-h-[50vh] items-center justify-center" dir="rtl"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Layout>;
  }

  if (reviewQuery.isError || !review) {
    const message = reviewQuery.error instanceof Error ? reviewQuery.error.message : "تعذر تحميل مراجعة الكتالوج";
    return (
      <Layout>
        <div className="page-container space-y-4" dir="rtl">
          <SettingsBreadcrumb currentPage="اعتماد كتالوج الأصناف" currentIcon={PackageSearch} />
          <Card className="border-destructive/40"><CardContent className="flex gap-3 p-5 text-destructive"><ShieldAlert className="h-5 w-5 shrink-0" /><div><p className="font-semibold">لا يمكن بدء الاستيراد</p><p className="mt-1 text-sm">{message}</p><Button className="mt-3" variant="outline" onClick={() => reviewQuery.refetch()}><RefreshCw className="ml-2 h-4 w-4" />إعادة المحاولة</Button></div></CardContent></Card>
        </div>
      </Layout>
    );
  }

  const productRows = reconciliation?.productRows ?? [];
  const warehouseRows = reconciliation?.warehouseRows ?? [];
  const legacyRows = reconciliation?.legacyRows ?? [];
  const readyToStage = !!review.targetId && reviewAcknowledged && unresolved.length === 0 && !stagedPlan;
  const completedBackups = (backupsQuery.data ?? []).filter((backup) => backup.status === "completed");
  const applied = applyResult?.summary ?? applyResult?.appliedSummary ?? stagedPlan?.appliedSummary;

  return (
    <Layout>
      <div className="page-container space-y-4" dir="rtl">
        <SettingsBreadcrumb currentPage="اعتماد كتالوج الأصناف" currentIcon={PackageSearch} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold"><PackageSearch className="h-6 w-6 text-primary" />مراجعة واعتماد كتالوج الأصناف</h1>
            <p className="mt-1 text-sm text-muted-foreground">مراجعة إدارية مرحلية فقط؛ لا تُنشأ هوية داخلية من كود المصدر ولا تُخمن الأسعار أو الوحدات.</p>
          </div>
          <Button variant="outline" onClick={() => { setStagedPlan(null); setApplyResult(null); setDecisions({}); setReviewAcknowledged(false); setLastError(null); reviewQuery.refetch(); }} disabled={reviewQuery.isFetching}>
            <RefreshCw className={`ml-2 h-4 w-4 ${reviewQuery.isFetching ? "animate-spin" : ""}`} />تحديث المراجعة
          </Button>
        </div>

        <Card className={review.targetId ? "border-emerald-200 bg-emerald-50/40" : "border-destructive/40 bg-destructive/5"}>
          <CardContent className="flex gap-3 p-4">
            {review.targetId ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />}
            <div className="min-w-0"><p className="font-semibold">{review.targetId ? "الهدف المستقل مُعدّ للتأكيد" : "هدف الاستيراد غير مؤكد"}</p><p className="mt-1 break-all font-mono text-xs">{review.targetId ?? "لا توجد قيمة CATALOGUE_IMPORT_TARGET_ID؛ لا يمكن تجهيز أو تطبيق الخطة."}</p></div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {sourceSummary("المنتجات المصدرية", reconciliation?.sourceTotals.products ?? {})}
          {sourceSummary("أصناف المستودع المصدرية", reconciliation?.sourceTotals.warehouse ?? {})}
          {sourceSummary("أقسام الاستخدام (إضافية)", reconciliation?.sourceTotals.categories ?? {})}
        </div>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileCheck2 className="h-5 w-5 text-primary" />بصمات المراجعة</CardTitle><CardDescription>تُعاد مطابقة هذه البصمات عند التطبيق؛ أي تعديل للمصدر أو لقطة الكتالوج يرفض الخطة.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">بصمة ملفات المصدر SHA-256</p><code className="mt-1 block break-all text-xs" data-testid="text-source-checksum">{checksum(review.sourceChecksum)}</code></div>
            <div className="rounded-md border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">بصمة لقطة الهدف SHA-256</p><code className="mt-1 block break-all text-xs" data-testid="text-snapshot-checksum">{checksum(review.snapshotChecksum)}</code></div>
          </CardContent>
        </Card>

        <Tabs defaultValue="review">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
            <TabsTrigger value="review" data-testid="tab-catalogue-review">المراجعة اليدوية <Badge variant="secondary" className="mr-1">{productRows.filter(r => r.status !== "exact_match").length + warehouseRows.filter(r => r.status !== "exact_match").length}</Badge></TabsTrigger>
            <TabsTrigger value="exact">مطابقات دقيقة <Badge variant="secondary" className="mr-1">{productRows.filter(r => r.status === "exact_match").length + warehouseRows.filter(r => r.status === "exact_match").length}</Badge></TabsTrigger>
            <TabsTrigger value="legacy">تنظيف السجلات <Badge variant="secondary" className="mr-1">{legacyRows.length}</Badge></TabsTrigger>
            <TabsTrigger value="plan">الخطة والتدقيق</TabsTrigger>
          </TabsList>

          <TabsContent value="review" className="mt-4 space-y-3">
            <Card className="border-amber-200 bg-amber-50/40"><CardContent className="flex gap-3 p-4 text-sm"><FileWarning className="h-5 w-5 shrink-0 text-amber-700" /><div><strong>لا توجد اقتراحات تلقائية.</strong> اختر المعرّف الداخلي يدوياً من السجلات التي أعادتها المراجعة، ثم أقرّ الهوية واكتب سبباً. لا يشكّل كود المصدر أو الاسم أو الاسم البديل معرّفاً داخلياً.</div></CardContent></Card>
            {[...productRows, ...warehouseRows].filter((row) => row.status !== "exact_match").map((row) => (
              <SourceReviewCard key={reviewRowKey(row)} row={row} decision={decisions[reviewRowKey(row)]} currentCatalogues={review.currentCatalogues} legacyRows={legacyRows} onChange={(patch) => updateDecision(row, patch)} />
            ))}
            {[...productRows, ...warehouseRows].every((row) => row.status === "exact_match") && <Empty text="جميع صفوف المصدر تطابق كود العمل والاسم والوحدة بدقة." />}
          </TabsContent>

          <TabsContent value="exact" className="mt-4">
            <Card><CardHeader><CardTitle className="text-base">مطابقات الكود الدقيقة</CardTitle><CardDescription>ستبقى المعرّفات الداخلية، الأسعار، الأرصدة والسجل التاريخي كما هي. تُضاف أقسام الاستخدام المطابقة بالاسم الأساسي فقط.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/50 text-xs"><tr><th className="p-2 text-right">النطاق</th><th className="p-2 text-right">كود العمل</th><th className="p-2 text-right">المصدر</th><th className="p-2 text-right">المعرف الداخلي</th><th className="p-2 text-right">الوحدة</th><th className="p-2 text-right">أقسام الاستخدام</th></tr></thead><tbody>{[...productRows, ...warehouseRows].filter((row) => row.status === "exact_match").map((row) => <tr className="border-b" key={reviewRowKey(row)}><td className="p-2">{row.namespace === "products" ? "منتج" : "مستودع"}</td><td className="p-2 font-mono">{row.sourceCode}</td><td className="p-2 font-medium">{row.sourceName}</td><td className="p-2 font-mono">{row.currentId ?? "—"}</td><td className="p-2">{row.sourceUnit}</td><td className="p-2">{canonicalSections(row).join("، ") || "—"}</td></tr>)}</tbody></table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="legacy" className="mt-4 space-y-3">
            <Card className="border-rose-200 bg-rose-50/40"><CardContent className="flex gap-3 p-4 text-sm"><Trash2 className="h-5 w-5 shrink-0 text-rose-700" /><div><strong>الحذف ليس وعداً.</strong> حتى مع اختيار الحذف، يقفل الخادم السجل ويعيد فحص مراجع FK وغير FK، الأرصدة والعمليات المفتوحة؛ يفشل التطبيق بأمان ولا يستخدم cascade أو حذفاً شاملاً. السجل المستخدم لا يُعطّل إلا باختيار صريح ومراجع.</div></CardContent></Card>
            {legacyRows.map((row) => <LegacyReviewCard key={reviewRowKey(row)} row={row} decision={decisions[reviewRowKey(row)]} onChange={(patch) => updateDecision(row, patch)} />)}
            {!legacyRows.length && <Empty text="لا توجد سجلات قديمة في هذه اللقطة." />}
          </TabsContent>

          <TabsContent value="plan" className="mt-4 space-y-4">
            {lastError && <Card className="border-destructive/40"><CardContent className="flex gap-3 p-4 text-sm text-destructive"><AlertTriangle className="h-5 w-5 shrink-0" /><div><strong>رسالة الرفض الآمنة</strong><p className="mt-1">{lastError}</p></div></CardContent></Card>}
            <Card><CardHeader className="pb-3"><CardTitle className="text-base">استعادة خطة كتالوج محفوظة</CardTitle><CardDescription>تُحمّل هذه العملية الخطة ونتيجة التدقيق المحفوظتين فقط من <code>GET /api/admin/catalogue-import/plans/:planId</code>؛ لا تحفظ مراجعة المصدر أو بيانات أصناف إضافية في المتصفح.</CardDescription></CardHeader><CardContent className="flex flex-col gap-2 sm:flex-row"><Input value={savedPlanId} onChange={(event) => setSavedPlanId(event.target.value)} placeholder="رقم الخطة UUID" className="font-mono text-xs" data-testid="input-load-catalogue-plan" /><Button variant="outline" onClick={() => loadPlanMutation.mutate()} disabled={loadPlanMutation.isPending || !savedPlanId.trim()} data-testid="button-load-catalogue-plan">{loadPlanMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}تحميل الخطة</Button></CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="h-5 w-5 text-primary" />بوابات تجهيز الخطة</CardTitle><CardDescription>لا تُرسل أي موافقة قبل استيفاء كل الصفوف. التخطيط لا يغيّر قاعدة البيانات التشغيلية.</CardDescription></CardHeader><CardContent className="space-y-3"><Gate checked={!!review.targetId} label="تأكيد هدف الاستيراد المستقل" detail={review.targetId ?? "غير متاح"} /><Gate checked={unresolved.length === 0} label="اعتماد أو تأجيل كل صف غير دقيق وسجل قديم" detail={unresolved.length ? `متبقي ${unresolved.length} صف للمراجعة الصريحة.` : "كل الصفوف مغطاة بموافقة صريحة."} /><Gate checked={approvals.length > 0 || reviewRows.every(r => r.status === "exact_match")} label="لا توجد هوية أو سعر مقترحان تلقائياً" detail={`${approvals.length} موافقة يدوية سيتم إرسالها؛ المطابقات الدقيقة يتولاها الخادم كإبقاء فقط.`} /><label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm"><Checkbox checked={reviewAcknowledged} onCheckedChange={(checked) => setReviewAcknowledged(checked === true)} data-testid="checkbox-catalogue-review-acknowledgement" /><span>أقرّ بأنني راجعت الهدف والبصمات وكل المطابقات والقرارات أعلاه، وأفهم أن تجهيز الخطة يرسل <code>CATALOGUE_REVIEWED</code> فقط ولا يطبق أي تغيير.</span></label><Separator /><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">التجهيز يتطلب إقرار المراجع الصريح قبل حفظ الخطة.</p><Button onClick={() => stageMutation.mutate()} disabled={!readyToStage || stageMutation.isPending} data-testid="button-stage-catalogue-plan">{stageMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}تجهيز الخطة للمراجعة النهائية</Button></div></CardContent></Card>
            {stagedPlan && <PlanCard plan={stagedPlan} onApply={openApply} />}
            {applied && <AuditResult summary={applied} replayed={!!applyResult?.replayed} />}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="max-w-xl" dir="rtl">
          <DialogHeader><DialogTitle className="flex gap-2 text-amber-700"><ShieldAlert className="h-5 w-5" />تأكيد تطبيق خطة الكتالوج</DialogTitle><DialogDescription>هذا هو الإجراء الوحيد الذي يطلب كتابة بيانات الكتالوج. لا يمكن تكرار العملية بمفتاح مختلف.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm"><p>الخطة: <code className="break-all">{stagedPlan?.id}</code></p><p className="mt-1">الهدف: <code>{stagedPlan?.targetId}</code></p><p className="mt-2 font-semibold">أنشئ نسخة جديدة بعد تجهيز هذه الخطة — لا تقبل النسخ الأقدم.</p><p className="mt-1">من صفحة النسخ الاحتياطية، أنشئ النسخة عبر <code>POST /api/backups</code> مع تضمين جدولي <code>products</code> و<code>warehouse_items</code>، ثم انتظر حتى تصبح الحالة <code>completed</code>. ينشئ الخادم عندها بيان التغطية (manifest) المطلوب؛ النسخ اليدوية أو الناقصة تُرفض.</p></div>
            <label className="flex cursor-pointer items-start gap-2 text-sm"><Checkbox checked={targetAcknowledged} onCheckedChange={(checked) => setTargetAcknowledged(checked === true)} data-testid="checkbox-catalogue-target-acknowledgement" /><span>أؤكد أن هدف الاستيراد أعلاه هو البيئة المستقلة المعتمدة لهذه الخطة.</span></label>
            <div className="space-y-2"><Label htmlFor="catalogue-backup">النسخة الاحتياطية المكتملة</Label><Select value={backupId} onValueChange={setBackupId}><SelectTrigger id="catalogue-backup" data-testid="select-catalogue-backup"><SelectValue placeholder={backupsQuery.isLoading ? "جارٍ تحميل النسخ..." : "اختر نسخة احتياطية"} /></SelectTrigger><SelectContent>{completedBackups.map((backup) => <SelectItem key={backup.id} value={String(backup.id)}>{backup.name} (#{backup.id})</SelectItem>)}{!backupsQuery.isLoading && !completedBackups.length && <SelectItem value="none" disabled>لا توجد نسخة مكتملة</SelectItem>}</SelectContent></Select></div>
            <label className="flex cursor-pointer items-start gap-2 text-sm"><Checkbox checked={backupAcknowledged} onCheckedChange={(checked) => setBackupAcknowledged(checked === true)} data-testid="checkbox-catalogue-backup-acknowledgement" /><span>أؤكد أن النسخة المختارة مكتملة وأُنشئت بعد تجهيز هذه الخطة.</span></label>
            <div className="space-y-2"><Label htmlFor="catalogue-apply-confirm">اكتب التأكيد كاملاً</Label><Input id="catalogue-apply-confirm" value={applyText} onChange={(event) => setApplyText(event.target.value)} placeholder={`APPLY_CATALOGUE_${stagedPlan?.id ?? ""}`} className="font-mono text-xs" data-testid="input-catalogue-apply-confirm" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setApplyOpen(false)}>إلغاء</Button><Button variant="destructive" disabled={applyMutation.isPending || !targetAcknowledged || !backupAcknowledged || !backupId || applyText !== `APPLY_CATALOGUE_${stagedPlan?.id ?? ""}`} onClick={() => applyMutation.mutate()} data-testid="button-apply-catalogue-plan">{applyMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}تطبيق الخطة بعد التحقق</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function SourceReviewCard({ row, decision, currentCatalogues, legacyRows, onChange }: {
  row: CatalogueReviewRow;
  decision?: CatalogueReviewDecision;
  currentCatalogues?: Partial<Record<"products" | "warehouse", CatalogueCurrentRecord[]>>;
  legacyRows: CatalogueReviewRow[];
  onChange: (patch: Partial<CatalogueReviewDecision>) => void;
}) {
  const recodeAllowed = canManuallyAdoptCode(row);
  const categories = canonicalSections(row);
  const aliasSections = aliasDerivedUsageSections(row);
  const selectableRecords = selectableCurrentRecords(row, currentCatalogues, legacyRows);
  const allowedActions: Array<{ value: CatalogueImportAction; label: string }> = [
    ...(recodeAllowed ? [{ value: "adopt_code" as const, label: "ربط بسجل حالي يختاره المراجع" }] : []),
    ...(row.status === "add_candidate" ? [{ value: "add" as const, label: "إضافة سجل جديد مشفّر" }] : []),
  ];
  const action = decision?.action && allowedActions.some((option) => option.value === decision.action)
    ? decision.action
    : undefined;
  return <Card data-testid={`catalogue-review-${reviewRowKey(row)}`}><CardHeader className="gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="flex flex-wrap items-center gap-2 text-base">{row.sourceName ?? "بدون اسم"} {statusBadge(row)}</CardTitle><CardDescription className="mt-1">المصدر <code>{row.namespace}</code> · كود العمل <code>{row.sourceCode ?? "—"}</code> · وحدة المصدر {row.sourceUnit ?? "—"}</CardDescription></div></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 rounded-md bg-muted/40 p-3 text-sm md:grid-cols-4"><Info label="السجل الحالي في الصف" value={row.currentRecord?.name ?? "لا يوجد"} /><Info label="كود/معرّف صف المراجعة" value={`${row.currentRecord?.sku ?? "—"} / ${row.currentRecord?.id ?? row.currentId ?? "—"}`} /><Info label="الأقسام المطابقة بالاسم الأساسي" value={categories.join("، ") || "لا توجد"} /><Info label="أقسام من اسم بديل" value={aliasSections.join("، ") || "لا توجد"} /></div>{row.issues?.map((issue) => <p key={issue.code} className="text-xs text-amber-700">• {issue.message}</p>)}{row.aliases?.length ? <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">أسماء بديلة في المصدر (دليل فقط وليست اقتراح هوية): {row.aliases.join("، ")}</p> : null}
    <div className="max-w-xl space-y-2"><Label>قرار صف المصدر</Label><Select value={action} onValueChange={(value) => onChange({ action: value as CatalogueImportAction })}><SelectTrigger data-testid={`select-source-action-${String(row.sourceCode)}`}><SelectValue placeholder="اختر قراراً صريحاً" /></SelectTrigger><SelectContent>{allowedActions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
    {action === "adopt_code" && <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3"><p className="text-sm font-medium">ربط يدوي ثنائي اللغة/مختلف الاسم</p><div className="max-w-xl space-y-2"><Label>المعرّف الداخلي الحالي الذي اخترته بنفسك</Label><Select value={decision?.currentId ? String(decision.currentId) : undefined} onValueChange={(value) => onChange({ action: "adopt_code", currentId: Number(value) })}><SelectTrigger data-testid={`select-current-id-${String(row.sourceCode)}`}><SelectValue placeholder="لا يوجد اختيار مسبق — اختر سجلاً داخلياً" /></SelectTrigger><SelectContent>{selectableRecords.map((record) => <SelectItem key={String(record.id)} value={String(record.id)}>#{record.id} · {record.sku ?? "بدون كود"} · {record.name ?? "بدون اسم"} · {record.unit ?? "بدون وحدة"}</SelectItem>)}{!selectableRecords.length && <SelectItem value="none" disabled>لم تُرجع المراجعة سجلات حالية قابلة للاختيار</SelectItem>}</SelectContent></Select></div><div className="space-y-2"><Label>مبرر تأكيد الهوية</Label><Textarea value={decision?.reason ?? ""} onChange={(event) => onChange({ action: "adopt_code", reason: event.target.value })} placeholder="اشرح التحقق اليدوي من الهوية ووحدة القياس..." data-testid={`input-identity-reason-${String(row.sourceCode)}`} /></div><label className="flex cursor-pointer items-start gap-2 text-sm"><Checkbox checked={!!decision?.identityConfirmed} onCheckedChange={(checked) => onChange({ action: "adopt_code", identityConfirmed: checked === true })} data-testid={`checkbox-identity-confirmed-${String(row.sourceCode)}`} /><span>أؤكد يدوياً أن السجل الداخلي المختار هو هذا الصنف المصدر، وأن وحدة القياس متساوية. سيُرسل الإقرار <code>MANUAL_IDENTITY_CONFIRMED</code>؛ يعيد الخادم التحقق ولا ينقل الأسعار أو الأرصدة أو التاريخ.</span></label><label className="flex cursor-pointer items-start gap-2 text-sm"><Checkbox checked={!!decision?.adoptSourceName} onCheckedChange={(checked) => onChange({ action: "adopt_code", adoptSourceName: checked === true })} /><span>استبدل اسم السجل الحالي باسم المصدر أيضاً (اختياري). اتركه غير محدد للحفاظ على الاسم الحالي.</span></label><AliasSectionChoices row={row} sections={aliasSections} selected={decision?.approvedAliasSections ?? []} onChange={(approvedAliasSections) => onChange({ action: "adopt_code", approvedAliasSections })} /></div>}
    {action === "add" && <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50/40 p-3"><p className="text-sm font-medium">إضافة صنف مشفّر غير ملتبس</p><div className="max-w-sm space-y-2"><Label>الفئة الأساسية التي يحددها المراجع</Label><Input value={decision?.category ?? ""} onChange={(event) => onChange({ action: "add", category: event.target.value })} placeholder="مثال: raw أو pastry" data-testid={`input-category-${String(row.sourceCode)}`} /></div><div className="max-w-xl space-y-2"><Label>حالة الإتاحة والسعر — اختيار صريح مطلوب</Label><Select value={decision?.availabilityDisposition} onValueChange={(value) => onChange({ action: "add", availabilityDisposition: value as "active_priced" | "inactive_pending_price", ...(value === "inactive_pending_price" ? { price: undefined } : {}) })}><SelectTrigger data-testid={`select-add-availability-${String(row.sourceCode)}`}><SelectValue placeholder="اختر إضافة نشطة بسعر أو غير متاحة بانتظار السعر" /></SelectTrigger><SelectContent><SelectItem value="active_priced">نشط ومتاح للبيع بسعر موجب محدد</SelectItem><SelectItem value="inactive_pending_price">غير نشط/غير متاح إلى حين اعتماد السعر</SelectItem></SelectContent></Select></div>{decision?.availabilityDisposition === "active_priced" && <div className="max-w-sm space-y-2"><Label>السعر الموجب المعتمد</Label><Input type="number" min="0.01" step="0.01" inputMode="decimal" value={decision.price ?? ""} onChange={(event) => { const price = Number(event.target.value); onChange({ action: "add", price: event.target.value === "" || !Number.isFinite(price) ? undefined : price }); }} placeholder="0.00" data-testid={`input-add-price-${String(row.sourceCode)}`} /><p className="text-xs text-muted-foreground">يُرسل هذا السعر فقط مع اختيار «نشط ومتاح للبيع». لا يُرسل أي سعر مع الخيار غير النشط.</p></div>}{decision?.availabilityDisposition === "inactive_pending_price" && <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">سيُنشأ الصنف غير نشط وبدون سعر. لا يصبح متاحاً إلا بعد مسار مستقل لمراجعة السعر والتفعيل.</p>}<AliasSectionChoices row={row} sections={aliasSections} selected={decision?.approvedAliasSections ?? []} onChange={(approvedAliasSections) => onChange({ action: "add", approvedAliasSections })} /></div>}
  </CardContent></Card>;
}

function AliasSectionChoices({ row, sections, selected, onChange }: {
  row: CatalogueReviewRow;
  sections: string[];
  selected: string[];
  onChange: (sections: string[]) => void;
}) {
  if (!sections.length) return null;
  return <div className="space-y-2 rounded-md border border-dashed border-amber-300 bg-amber-50/50 p-3"><p className="text-sm font-medium">أقسام استخدام مستخرجة من اسم بديل</p><p className="text-xs text-muted-foreground">هذه الأقسام ليست اقتراحاً تلقائياً ولا تستبدل الفئة الأساسية. حدّد فقط ما راجعته وتريد إضافته كعضوية استخدام إضافية.</p><div className="space-y-2">{sections.map((section) => <label key={section} className="flex cursor-pointer items-start gap-2 text-sm"><Checkbox checked={selected.includes(section)} onCheckedChange={(checked) => onChange(checked === true ? Array.from(new Set([...selected, section])) : selected.filter((value) => value !== section))} data-testid={`checkbox-alias-section-${String(row.sourceCode)}-${section}`} /><span>{section}</span></label>)}</div></div>;
}

function LegacyReviewCard({ row, decision, onChange }: { row: CatalogueReviewRow; decision?: CatalogueReviewDecision; onChange: (patch: Partial<CatalogueReviewDecision>) => void }) {
  const action = decision?.action && LEGACY_ACTIONS.some((item) => item.value === decision.action) ? decision.action : "defer";
  return <Card data-testid={`catalogue-legacy-${row.currentId}`}><CardHeader className="pb-3"><CardTitle className="flex flex-wrap items-center gap-2 text-base">{row.currentRecord?.name ?? "سجل قديم"} {statusBadge(row)}</CardTitle><CardDescription>النطاق: {row.namespace === "products" ? "منتجات" : "مستودع"} · المعرف الداخلي: <code>{row.currentId ?? "—"}</code> · كود العمل الحالي: <code>{row.currentRecord?.sku ?? "—"}</code> · الرصيد: {balance(row.currentBalance)}</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><Label>قرار المراجع</Label><Select value={action} onValueChange={(value) => onChange({ action: value as CatalogueImportAction })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LEGACY_ACTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>مبرر المراجعة</Label><Textarea value={decision?.reason ?? ""} onChange={(event) => onChange({ action, reason: event.target.value })} placeholder="اشرح فحص التاريخ والمراجع والأرصدة..." data-testid={`input-legacy-reason-${row.currentId}`} /></div><label className="col-span-full flex cursor-pointer items-start gap-2 rounded-md bg-muted/40 p-3 text-sm"><Checkbox checked={!!decision?.legacyReviewed} onCheckedChange={(checked) => onChange({ action, legacyReviewed: checked === true })} /><span>أقرّ أنني راجعت المراجع وقيد الاستخدام والتاريخ والأرصدة. للحذف النهائي سيعاد الفحص أثناء القفل والتطبيق، وأي شك أو مرجع يرفض الحذف بأمان.</span></label></CardContent></Card>;
}

function canonicalSections(row: CatalogueReviewRow): string[] {
  return Array.from(new Set((row.categories ?? []).filter((category) => category.matchedBy !== "source_alias").map((category) => category.category).filter(Boolean)));
}

function Gate({ checked, label, detail }: { checked: boolean; label: string; detail: string }) {
  return <div className="flex items-start gap-3"><span className={`mt-0.5 rounded-full p-0.5 ${checked ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{checked ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}</span><div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{detail}</p></div></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 break-words text-sm font-medium">{value}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{text}</CardContent></Card>;
}

function PlanCard({ plan, onApply }: { plan: StagedPlan; onApply: () => void }) {
  return <Card className="border-primary/30"><CardHeader className="sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="flex gap-2 text-base"><FileCheck2 className="h-5 w-5 text-primary" />خطة مجمّدة للتطبيق</CardTitle><CardDescription className="mt-1">رقم الخطة قابل للتحديد والنسخ ثم إعادة تحميله لاحقاً.</CardDescription></div><Badge className={plan.status === "applied" ? "bg-emerald-600" : "bg-primary"}>{plan.status === "applied" ? "مطبقة" : "مجهزة"}</Badge></CardHeader><CardContent className="space-y-3"><div className="max-w-2xl space-y-1"><Label>رقم الخطة المحفوظة</Label><Input readOnly value={plan.id} className="font-mono text-xs" onFocus={(event) => event.currentTarget.select()} data-testid="input-catalogue-plan-id" /></div><div className="grid gap-2 text-sm sm:grid-cols-3"><Info label="بصمة الخطة" value={checksum(plan.planChecksum)} /><Info label="العمليات" value={String(plan.operations.length)} /><Info label="صفوف غير مكتملة" value={String(plan.reviewRequiredCount)} /></div><div className="rounded-md bg-muted/40 p-3 text-xs"><strong>خطة التراجع:</strong> {plan.rollbackPlan.reversibleMetadataOperations ?? 0} تغيير بيانات وصفية قابل للمراجعة، و{plan.rollbackPlan.irreversibleHardDeletes ?? 0} حذف نهائي غير قابل للتراجع تلقائياً.</div><div className="flex justify-end">{plan.status === "staged" && <Button onClick={onApply} disabled={plan.reviewRequiredCount > 0} data-testid="button-open-catalogue-apply"><DatabaseBackup className="ml-2 h-4 w-4" />اختيار نسخة احتياطية وتأكيد التطبيق</Button>}</div></CardContent></Card>;
}

function AuditResult({ summary, replayed }: { summary: ApplySummary; replayed: boolean }) {
  const rollback = summary.rollbackPlan;
  const operationMetadata = (summary.operations ?? []).map((operation) => {
    const { before, ...after } = operation;
    return { namespace: operation.namespace, action: operation.action, currentId: operation.currentId ?? null, before: before ?? null, after };
  });
  const downloadAudit = () => {
    const payload = {
      appliedAt: summary.appliedAt ?? null,
      backupId: summary.backupId ?? null,
      actorId: summary.actorId ?? null,
      counts: summary.counts ?? {},
      operations: operationMetadata,
      rollbackPlan: rollback ?? {},
    };
    const objectUrl = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `catalogue-import-audit-${summary.appliedAt ?? "result"}.json`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };
  return <Card className="border-emerald-200 bg-emerald-50/30"><CardHeader><CardTitle className="flex gap-2 text-base text-emerald-800"><RotateCcw className="h-5 w-5" />نتيجة التدقيق وخطة التراجع {replayed && <Badge variant="outline">نتيجة معاد تشغيلها</Badge>}</CardTitle><CardDescription>تعرض العملية المحفوظة ولقطات البيانات الوصفية قبل/بعد؛ لا تعكس هذه الشاشة تاريخ المبيعات أو المخزون.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 text-sm sm:grid-cols-3"><Info label="وقت التطبيق" value={summary.appliedAt ? new Date(summary.appliedAt).toLocaleString("ar-SA") : "—"} /><Info label="النسخة الاحتياطية" value={summary.backupId ? `#${summary.backupId}` : "—"} /><Info label="المنفذ" value={summary.actorId ?? "—"} /></div><div className="flex flex-wrap gap-2">{Object.entries(summary.counts ?? {}).map(([action, count]) => <Badge variant="secondary" key={action}>{action}: {count}</Badge>)}</div><div className="rounded-md border border-emerald-200 bg-white/70 p-3 text-sm"><p className="font-medium">نتيجة التراجع</p><p className="mt-1 text-muted-foreground">قابل للمراجعة: {rollback?.reversibleMetadataOperations ?? 0} · حذف نهائي غير قابل للتراجع تلقائياً: {rollback?.irreversibleHardDeletes ?? 0}</p>{rollback?.notes?.map((note) => <p className="mt-1 text-xs text-muted-foreground" key={note}>• {note}</p>)}</div><div className="flex flex-col gap-3 rounded-md border bg-white/70 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">تفاصيل البيانات الوصفية قبل/بعد</p><p className="text-xs text-muted-foreground">«بعد» هو ناتج العملية المحفوظ، و«قبل» لقطة الخادم للسجل المتأثر عند وجودها.</p></div><Button variant="outline" size="sm" onClick={downloadAudit} disabled={!operationMetadata.length} data-testid="button-download-catalogue-audit">تنزيل سجل التدقيق JSON</Button></div>{operationMetadata.map((operation, index) => <details key={`${operation.namespace}-${operation.action}-${operation.currentId ?? index}`} className="rounded border p-2 text-xs"><summary className="cursor-pointer font-medium">{operation.namespace} · {operation.action} · #{operation.currentId ?? "جديد"}</summary><pre className="mt-2 overflow-x-auto whitespace-pre-wrap" dir="ltr">{JSON.stringify(operation, null, 2)}</pre></details>)}</div></CardContent></Card>;
}