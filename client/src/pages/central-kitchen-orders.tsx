import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranches } from "@/hooks/useBranches";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { isKitchenOrderDraftValid, isValidKitchenQuantity, normalizeReportedAvailableQuantity, OrderLineEditor, type KitchenOrderDraftLine } from "@/components/central-kitchen/order-line-editor";
import { LinkedBatches } from "@/components/central-kitchen/linked-batches";
import {
  queueOrderNeedsAttention,
  type OrderQueueStage,
} from "@/components/central-kitchen/order-queue";
import { OrderNotificationsOptIn } from "@/components/central-kitchen/order-notifications-opt-in";
import { useVisualViewportDialog } from "@/components/central-kitchen/use-visual-viewport-dialog";
import { DailyOrderingNotice, LateSubmissionBadge, OrderScheduleNotice, useKitchenOrderingPolicy } from "@/components/central-kitchen/ordering-schedule";
import { getOrderSchedule } from "@shared/central-kitchen-ordering-policy";
import { PreparationEditor, SavedPreparationSummary } from "@/components/central-kitchen/prepare-fulfillment";
import { DemandCommitments } from "@/components/central-kitchen/demand-commitments";
import { OrderActionsMenu, SheetPreviewDialog } from "@/components/central-kitchen/kitchen-order-sharing";
import type { PreparationSheet } from "@/components/central-kitchen/kitchen-order-share-model";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  CentralKitchenCatalogItem,
  parseCentralKitchenCatalogV2,
} from "@shared/central-kitchen-catalog";
import {
  getCentralKitchenNextStep,
  parseCentralKitchenInventoryMode,
  parseCentralKitchenInventoryModeFilter,
} from "@shared/central-kitchen-next-step";
import {
  AlertTriangle, BarChart3, Check, ChevronLeft, EllipsisVertical, Factory, Loader2, PackagePlus, Plus,
  RefreshCw, Search, Settings, ShieldCheck, SlidersHorizontal, Truck, X,
} from "lucide-react";

type Routing = {
  branchId: string;
  responsibleUserId: string | null;
  deputyUserId: string | null;
  receiverUserId: string | null;
  responsibleName: string | null;
  deputyName: string | null;
  receiverName: string | null;
  hasKitchenResponsible: boolean;
};
type RoutingCandidates = {
  kitchenCandidates: Array<{ id: string; name: string }>;
  receiverCandidates: Array<{ id: string; name: string }>;
};
type AllowedActions = {
  approve?: boolean;
  prepare?: boolean;
  dispatch?: boolean;
  receive?: boolean;
  resolveDiscrepancy?: boolean;
};

type KitchenItem = {
  id?: string | number; productId?: string | number; warehouseItemId?: string | number; productName: string; unit: string; requestedQuantity: number; reportedAvailableQuantity?: number | string | null; notes?: string;
  preparedQuantity?: number | null; substituteQuantity?: number | null; substituteProductName?: string | null;
  preparedFromStock?: number | null; preparedFromProduction?: number | null; productionFulfillmentEvidence?: unknown;
  substituteUnit?: string | null; substituteProductId?: string | number | null; substituteWarehouseItemId?: string | number | null;
  shortageReason?: string | null; preparationNotes?: string | null;
  dispatchedQuantity?: number | null; receivedQuantity?: number | null; damagedQuantity?: number | null;
  missingQuantity?: number | null; receivingNotes?: string | null;
};
type KitchenEvent = { id: string | number; eventType?: string; fromStatus?: string; toStatus: string; actorId?: string; notes?: string; createdAt: string; changeSnapshot?: { before?: { order?: { neededDate?: string }; items?: KitchenItem[] }; requested?: { edit?: { neededDate: string; items: Array<{ itemId: number; requestedQuantity: number; reportedAvailableQuantity?: number }> } } } };
type KitchenOrder = {
  orderingSchedule?: ReturnType<typeof getOrderSchedule>;
  id: string | number; orderNumber: string; requestBranchId: string; centralKitchenId: string; status: string;
  neededDate?: string; neededTime?: string; notes?: string; createdBy?: string; approvedBy?: string; preparedBy?: string;
  dispatchedBy?: string; receivedBy?: string; createdAt: string; approvedAt?: string; preparedAt?: string; dispatchedAt?: string;
  receivedAt?: string; requestBranchName?: string; centralKitchenName?: string; itemCount?: number; items?: KitchenItem[]; events?: KitchenEvent[];
  driverName?: string | null; vehicleNumber?: string | null; discrepancyStatus?: "none" | "open" | "resolved";
  discrepancyResolutionNotes?: string | null;
  shadowInventoryEntries?: ShadowInventoryEntry[];
  inventoryMode?: string | null;
  allocations?: Array<{ id: number; orderItemId: number; component: "original" | "substitute"; unit: string; reservedQuantity: number; dispatchedQuantity: number; releasedQuantity: number; status: string }>;
  linkedBatches?: Array<{ id: number; orderItemId: number; productId: number; quantity: number; productionDate: string | null; status: string | null }>;
  allowedActions?: AllowedActions;
  nextResponsible?: { name: string | null; role: string; unassigned: boolean } | null;
};
type KitchenOrderPage = {
  data: KitchenOrder[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  serverNow: string;
  arrival: { count: number; maxId: number | null };
  counts: Record<OrderStage, number> & { new: number; overdue: number; dueToday: number; openDiscrepancies: number };
};
type ProductOption = CentralKitchenCatalogItem;
type DraftItem = KitchenOrderDraftLine;
type ShadowInventoryEntry = {
  id: number; direction: "projected_kitchen_out" | "projected_branch_in";
  component: "original" | "substitute"; productName: string; unit: string; quantity: number;
  productId?: string | number | null; warehouseItemId?: string | number | null;
};
type PilotMetrics = {
  totalOrders: number; overdueOrders: number; openDiscrepancies: number;
  fulfillmentRate: number | null; discrepancyRate: number | null;
  statusCounts: Record<string, number>;
  averageStageHours: { approval: number | null; preparation: number | null; dispatch: number | null; delivery: number | null };
  shadowLedger: { entryCount: number; byUnit: Array<{ direction: string; unit: string; quantity: number }> };
};

const STATUS: Record<string, { label: string; className: string }> = {
  cancelled: { label: "ملغي", className: "bg-stone-100 text-stone-700 border-stone-200" },
  requested: { label: "بانتظار الاعتماد", className: "bg-amber-50 text-amber-800 border-amber-200" },
  pending: { label: "بانتظار الاعتماد", className: "bg-amber-50 text-amber-800 border-amber-200" },
  approved: { label: "معتمد", className: "bg-sky-50 text-sky-800 border-sky-200" },
  prepared: { label: "تم التجهيز", className: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  dispatched: { label: "في الطريق", className: "bg-orange-50 text-orange-800 border-orange-200" },
  received: { label: "تم الاستلام", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  draft: { label: "مسودة", className: "bg-stone-100 text-stone-700 border-stone-200" },
};
const CENTRAL_KITCHEN_STATUSES = ["requested", "approved", "prepared", "dispatched", "received", "cancelled"] as const;
type CentralKitchenStatusFilter = (typeof CENTRAL_KITCHEN_STATUSES)[number];
const INVENTORY_MODES = ["real", "shadow", "unknown"] as const;
type InventoryModeFilter = (typeof INVENTORY_MODES)[number];
type OrderStage = OrderQueueStage;
const emptyLine = (): DraftItem => ({ productName: "", unit: "قطعة", requestedQuantity: "1", reportedAvailableQuantity: "", notes: "" });
const sourceLabel = (source: "product" | "warehouse") => source === "warehouse" ? "المستودع" : "المنتجات";
const identitySource = (value: { productId?: string | number | null; warehouseItemId?: string | number | null }) =>
  value.warehouseItemId != null ? "warehouse" : "product";
const readableDate = (value?: string) => value ? new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "غير محدد";
const readableTime = (value?: string) => value || "—";
const normalized = (status: string) => status?.toLowerCase().replaceAll(" ", "_") || "pending";
const isCentralKitchenStatus = (value: string | null): value is CentralKitchenStatusFilter =>
  !!value && (CENTRAL_KITCHEN_STATUSES as readonly string[]).includes(value);
const isInventoryMode = (value: string | null): value is InventoryModeFilter =>
  parseCentralKitchenInventoryModeFilter(value) !== "all";
const readFilterFromUrl = <T extends string>(
  key: string,
  values: readonly T[],
): T | "all" => {
  if (typeof window === "undefined") return "all";
  const value = new URLSearchParams(window.location.search).get(key)?.trim().toLowerCase() || null;
  return values.includes(value as T) ? value as T : "all";
};
const writeFilterToUrl = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (value === "all") url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
};
const errorStatus = (error: unknown): number | null => {
  const message = error instanceof Error ? error.message : String(error || "");
  const match = /^(\d{3}):/.exec(message);
  return match ? Number(match[1]) : null;
};
const isOpenDiscrepancy = (order: KitchenOrder) => order.discrepancyStatus === "open";

export default function CentralKitchenOrdersPage() {
  const { branches, userBranchId, canSelectBranch } = useBranches();
  const { canView, canCreate, canEdit, canApprove } = usePermissions();
  const { user, isAdmin } = useAuth();
  const canConfigureRouting = isAdmin || (
    ["operations_manager", "production_development_manager"].includes(user?.role || "") &&
    canView("central_kitchen_orders")
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [branchFilter, setBranchFilter] = useState(userBranchId || "all");
  const initialStatus = readFilterFromUrl("status", CENTRAL_KITCHEN_STATUSES);
  const [stage, setStage] = useState<OrderStage>(() => {
    const urlStage = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("stage");
    if (urlStage && ["attention", "requested", "approved", "prepared", "dispatched", "archive", "all"].includes(urlStage)) return urlStage as OrderStage;
    return initialStatus === "all" ? "attention" : initialStatus === "received" || initialStatus === "cancelled" ? "archive" : initialStatus;
  });
  const [inventoryModeFilter, setInventoryModeFilter] = useState<InventoryModeFilter | "all">(() => readFilterFromUrl("inventoryMode", INVENTORY_MODES));
  const [search, setSearch] = useState("");
  const [kitchenFilter, setKitchenFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [newOrdersNotice, setNewOrdersNotice] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"priority" | "newest" | "oldest_waiting">("priority");
  const [focus, setFocus] = useState<"new" | "overdue" | "dueToday" | "discrepancy" | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [sheetPreview, setSheetPreview] = useState<PreparationSheet | null>(null);
  const [sheetPreviewOpen, setSheetPreviewOpen] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const createDialogStyle = useVisualViewportDialog({ open: createOpen, maxHeight: 820, viewportFraction: 0.94 });
  const [detailId, setDetailId] = useState<string | number | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const detailDialogStyle = useVisualViewportDialog({ open: detailId !== null && detailDialogOpen, maxHeight: 900, viewportFraction: 0.94 });
  const [actionNotes, setActionNotes] = useState("");
  const [pilotDays, setPilotDays] = useState("30");
  const [draft, setDraft] = useState({ sourceBranchId: userBranchId || "", centralKitchenId: "", neededDate: "", neededTime: "07:00", notes: "", items: [emptyLine()] });
  const orderingPolicy = useKitchenOrderingPolicy(createOpen);
  const draftSchedule = orderingPolicy.serverNow ? getOrderSchedule({
    neededDate: draft.neededDate, neededTime: draft.neededTime,
    createdAt: orderingPolicy.serverNow,
  }) : null;
  const openCreate = async () => {
    setDraft(current => ({ ...current, centralKitchenId: "" }));
    setCreateOpen(true);
    const result = await orderingPolicy.query.refetch();
    const policy = result.data;
    if (policy) setDraft(current => ({
      ...current, neededDate: current.neededDate || policy.defaultNeededDate,
      neededTime: current.neededTime || policy.defaultNeededTime,
    }));
  };
  const createAttemptRef = useRef<{ signature: string; key: string } | null>(null);
  const transitionKeysRef = useRef(new Map<string, { signature: string; key: string }>());

  useEffect(() => { if (userBranchId) setBranchFilter(userBranchId); }, [userBranchId]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  useEffect(() => { setPage(1); }, [branchFilter, stage, inventoryModeFilter, search, kitchenFilter, dateFilter, sort, focus]);
  useEffect(() => {
    if (userBranchId) setDraft(current => current.sourceBranchId ? current : { ...current, sourceBranchId: userBranchId });
  }, [userBranchId]);
  useEffect(() => {
    const syncUrlState = () => {
      const params = new URLSearchParams(window.location.search);
      const orderId = params.get("orderId");
      const status = params.get("status")?.trim().toLowerCase() || null;
      const urlStage = params.get("stage")?.trim().toLowerCase() || null;
      const inventoryMode = params.get("inventoryMode")?.trim().toLowerCase() || null;
      setDetailId(orderId);
      setDetailDialogOpen(Boolean(orderId));
      setStage(urlStage && ["attention", "requested", "approved", "prepared", "dispatched", "archive", "all"].includes(urlStage)
        ? urlStage as OrderStage
        : isCentralKitchenStatus(status) ? (status === "received" || status === "cancelled" ? "archive" : status) : "attention");
      setInventoryModeFilter(isInventoryMode(inventoryMode) ? inventoryMode : "all");
      if (!orderId) setActionNotes("");
    };
    syncUrlState();
    window.addEventListener("popstate", syncUrlState);
    return () => window.removeEventListener("popstate", syncUrlState);
  }, []);
  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (branchFilter !== "all") params.set("branchId", branchFilter);
    params.set("page", String(page));
    params.set("pageSize", "25");
    params.set("stage", stage);
    params.set("sort", sort);
    if (search.trim()) params.set("search", search.trim());
    if (kitchenFilter !== "all") params.set("kitchenId", kitchenFilter);
    if (dateFilter !== "all") params.set("needed", dateFilter);
    if (inventoryModeFilter !== "all") params.set("inventoryMode", inventoryModeFilter);
    if (focus) params.set("focus", focus);
    const string = params.toString();
    return `/api/central-kitchen-orders${string ? `?${string}` : ""}`;
  }, [branchFilter, page, stage, sort, search, kitchenFilter, dateFilter, inventoryModeFilter, focus]);
  const ordersQuery = useQuery<KitchenOrderPage>({
    queryKey: [listUrl],
    refetchInterval: 30_000,
    placeholderData: previous => previous,
  });
  const metricsUrl = `/api/central-kitchen-orders/pilot-metrics?days=${pilotDays}${branchFilter !== "all" ? `&branchId=${encodeURIComponent(branchFilter)}` : ""}`;
  const metricsQuery = useQuery<PilotMetrics>({ queryKey: [metricsUrl] });
  const productsQuery = useQuery<ProductOption[]>({
    queryKey: ["/api/central-kitchen-orders/catalog-v2"],
    queryFn: async () => {
      let response: Response;
      try {
        response = await fetch("/api/central-kitchen-orders/catalog-v2", { credentials: "include" });
      } catch {
        throw new Error("تعذر الاتصال بالخادم لتحميل الكتالوج. تحقق من الشبكة ثم أعد المحاولة.");
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error("انتهت الجلسة أو لا تملك صلاحية عرض الكتالوج. سجّل الدخول مجدداً أو راجع الصلاحيات.");
      }
      if (!response.ok) {
        throw new Error("تعذر تحميل الكتالوج من الخادم. تحقق من الاتصال ثم أعد المحاولة.");
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("إصدار كتالوج الأصناف غير متوافق. أعد تحميل الصفحة للحصول على الإصدار الأحدث.");
      }
      return parseCentralKitchenCatalogV2(payload).items;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    placeholderData: () => undefined,
  });
  const kitchensQuery = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/central-kitchen-orders/kitchens"],
    staleTime: 0,
    refetchOnMount: "always",
  });
  const kitchenRoutingQuery = useQuery<Routing>({
    queryKey: [`/api/central-kitchen-orders/routing?branchId=${encodeURIComponent(draft.centralKitchenId)}`],
    enabled: createOpen && !!draft.centralKitchenId,
    retry: false,
  });
  const receiverRoutingQuery = useQuery<Routing>({
    queryKey: [`/api/central-kitchen-orders/routing?branchId=${encodeURIComponent(draft.sourceBranchId)}`],
    enabled: createOpen && !!draft.sourceBranchId,
    retry: false,
  });
  const detailQuery = useQuery<KitchenOrder>({ queryKey: [`/api/central-kitchen-orders/${detailId}`], enabled: detailId !== null });
  const products = productsQuery.data || [];
  useEffect(() => {
    if (createOpen) void productsQuery.refetch();
  }, [createOpen]);
  const centralKitchens = useMemo(() => {
    const merged = new Map<string, { id: string; name: string }>();
    for (const branch of kitchensQuery.data || []) merged.set(branch.id, branch);
    for (const branch of branches) {
      if (branch.isCentralKitchen) merged.set(branch.id, { id: branch.id, name: branch.name });
    }
    return Array.from(merged.values());
  }, [branches, kitchensQuery.data]);
  const routingBranches = useMemo(() => {
    const merged = new Map<string, { id: string; name: string }>();
    for (const branch of branches) merged.set(branch.id, { id: branch.id, name: branch.name });
    for (const kitchen of centralKitchens) merged.set(kitchen.id, kitchen);
    return Array.from(merged.values());
  }, [branches, centralKitchens]);
  const arrivalBaseline = useRef<{ scope: string; count: number; maxId: number | null } | null>(null);
  useEffect(() => {
    if (!ordersQuery.data) return;
    const scope = branchFilter;
    const next = ordersQuery.data.arrival;
    if (!next) return;
    if (arrivalBaseline.current?.scope !== scope) {
      arrivalBaseline.current = { scope, ...next };
      setNewOrdersNotice(0);
      return;
    }
    const previous = arrivalBaseline.current;
    if (next.count > previous.count && next.maxId !== previous.maxId) {
      setNewOrdersNotice(current => current + next.count - previous.count);
    }
    arrivalBaseline.current = { scope, ...next };
  }, [branchFilter, ordersQuery.data]);
  const stageCounts = ordersQuery.data?.counts || { attention: 0, requested: 0, approved: 0, prepared: 0, dispatched: 0, archive: 0, all: 0 };
  const filtered = ordersQuery.data?.data || [];
  const refresh = () => queryClient.invalidateQueries({ predicate: query => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/central-kitchen-orders") });
  const refreshNotifications = () => queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === "/api/active-notifications" || query.queryKey[0] === "/api/system-notifications/my-reads" });

  const createMutation = useMutation({
    mutationFn: async () => {
      const invalid = !isKitchenOrderDraftValid(draft.items);
      if (!draft.sourceBranchId || !draft.centralKitchenId || invalid) throw new Error("أكمل الفروع وبنود الطلب بالكميات الصحيحة.");
      const payload = {
        requestBranchId: draft.sourceBranchId, centralKitchenId: draft.centralKitchenId, neededDate: draft.neededDate || undefined,
        neededTime: draft.neededTime || undefined, notes: draft.notes || undefined,
        items: draft.items.map(item => ({
          ...(item.warehouseItemId !== undefined ? { warehouseItemId: item.warehouseItemId } : item.productId !== undefined ? { productId: item.productId } : {}),
          productName: item.productName.trim(), unit: item.unit.trim(), requestedQuantity: Number(item.requestedQuantity),
          reportedAvailableQuantity: normalizeReportedAvailableQuantity(item.reportedAvailableQuantity),
          notes: item.notes || undefined,
        })),
      };
      const signature = JSON.stringify(payload);
      if (!createAttemptRef.current || createAttemptRef.current.signature !== signature) {
        createAttemptRef.current = { signature, key: crypto.randomUUID() };
      }
      const response = await apiRequest("POST", "/api/central-kitchen-orders", {
        ...payload,
        idempotencyKey: createAttemptRef.current.key,
      });
      return response.json() as Promise<KitchenOrder>;
    },
    onSuccess: (order) => {
      toast({ title: "تم إنشاء طلب المطبخ", description: `تم تسجيل الطلب ${order.orderNumber || ""}${order.orderingSchedule?.isLate ? " — أُرسل بعد الموعد؛ يرجى التنسيق مع المطبخ." : ""}` });
      createAttemptRef.current = null;
        setCreateOpen(false); openFullDetail(order.id); setDraft({ sourceBranchId: userBranchId || "", centralKitchenId: "", neededDate: "", neededTime: "07:00", notes: "", items: [emptyLine()] }); refresh(); refreshNotifications();
    },
    onError: (error) => toast({ title: "تعذر إنشاء الطلب", description: error instanceof Error ? error.message : "تحقق من البيانات وحاول مجدداً.", variant: "destructive" }),
  });
  const workflowMutation = useMutation({
    mutationFn: async ({ id, action, details }: { id: string | number; action: "approve" | "prepare" | "dispatch" | "receive" | "resolve-discrepancy"; details?: Record<string, unknown> }) => {
      const attemptId = `${id}:${action}`;
      const payload = {
        notes: actionNotes || undefined,
        ...details,
      };
      const signature = JSON.stringify(payload);
      const previous = transitionKeysRef.current.get(attemptId);
      const idempotencyKey = previous?.signature === signature ? previous.key : crypto.randomUUID();
      transitionKeysRef.current.set(attemptId, { signature, key: idempotencyKey });
      const response = await apiRequest("POST", `/api/central-kitchen-orders/${id}/${action}`, {
        ...payload,
        idempotencyKey,
      });
      return { order: await response.json(), attemptId };
    },
    onSuccess: ({ attemptId }, { action }) => { transitionKeysRef.current.delete(attemptId); toast({ title: action === "resolve-discrepancy" ? "تمت معالجة الفروقات" : `تم ${action === "approve" ? "اعتماد" : action === "prepare" ? "تجهيز" : action === "dispatch" ? "شحن" : "استلام"} الطلب` }); setActionNotes(""); refresh(); refreshNotifications(); },
    onError: (error) => toast({ title: "لم تكتمل العملية", description: error instanceof Error ? error.message : "يرجى مراجعة حالة الطلب والصلاحيات.", variant: "destructive" }),
  });
  const preparationSheetMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/central-kitchen-orders/preparation-sheet", {
        orderIds: Array.from(selectedOrderIds).map(Number),
      });
      return response.json() as Promise<PreparationSheet>;
    },
    onSuccess: sheet => {
      setSheetPreview(sheet);
      setSheetPreviewOpen(true);
    },
    onError: error => toast({
      title: "تعذر إعداد ورقة التجهيز",
      description: errorStatus(error) === 409
        ? "تغيّرت حالة أحد الطلبات وأصبح نهائياً. امسح التحديد ثم اختر الطلبات النشطة مجدداً."
        : error instanceof Error ? error.message : "راجع الطلبات المحددة والصلاحيات.",
      variant: "destructive",
    }),
  });
  const selectedDetail = detailQuery.data;
  const statusInfo = (status: string) => STATUS[normalized(status)] || { label: status || "قيد المراجعة", className: "bg-muted text-muted-foreground border-border" };
  const branchName = (id: string) => branches.find(branch => branch.id === id)?.name || id;
  const openDetail = (id: string | number) => {
    const value = String(id);
    setDetailId(id);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("orderId") !== value) {
      url.searchParams.set("orderId", value);
      window.history.pushState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  };
  const selectDetail = (id: string | number) => {
    openDetail(id);
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) setDetailDialogOpen(true);
  };
  const openFullDetail = (id: string | number) => {
    openDetail(id);
    setDetailDialogOpen(true);
  };
  const closeDetail = () => {
    setDetailId(null);
    setDetailDialogOpen(false);
    setActionNotes("");
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("orderId")) {
      url.searchParams.delete("orderId");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  };
  const changeStage = (value: OrderStage) => {
    setStage(value);
    setFocus(null);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("status");
    if (value === "attention") url.searchParams.delete("stage");
    else url.searchParams.set("stage", value);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };
  const changeInventoryModeFilter = (value: string) => {
    if (value !== "all" && !isInventoryMode(value)) return;
    setInventoryModeFilter(value as InventoryModeFilter | "all");
    writeFilterToUrl("inventoryMode", value);
  };

  return <Layout>
    <main dir="rtl" className="page-container space-y-4 bg-[#f8f4ee] pb-10 text-[#2f1c3a]">
      <PageHeader icon={Factory} tone="production" title="طلبات المطبخ" description="رتّب ما يحتاج قراراً الآن، ثم افتح التفاصيل عند الحاجة"
        className="kitchen-mobile-header"
        actions={<div className="flex flex-wrap gap-2">
          <a href="/central-kitchen-demand-report"><Button variant="outline" size="sm"><BarChart3 className="ml-2 h-4 w-4" />تقرير الطلب غير الملبّى</Button></a>
          <Button variant="outline" size="sm" onClick={refresh} data-testid="refresh-kitchen-orders"><RefreshCw className="ml-2 h-4 w-4" />تحديث</Button>
          {canCreate("central_kitchen_orders") && <Button size="sm" onClick={() => void openCreate()} data-testid="create-kitchen-order"><Plus className="ml-2 h-4 w-4" />طلب جديد</Button>}
        </div>} />
      <details className="rounded-xl border bg-background px-3 md:hidden"><summary className="cursor-pointer py-3 text-sm font-medium">مواعيد الطلب والتسليم</summary><DailyOrderingNotice /></details>
      <div className="hidden md:block"><DailyOrderingNotice /></div>
      <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs", !online || ordersQuery.isRefetchError ? "border-amber-300 bg-amber-50 text-amber-900" : "kitchen-utility-status border-[#e6ddd6] bg-[#fffdf9] text-muted-foreground")} role="status">
        <span>{!online ? "أنت غير متصل — المعروض آخر بيانات ناجحة." : ordersQuery.isRefetchError ? "فشل التحديث في الخلفية — ما زالت آخر بيانات ناجحة معروضة." : ordersQuery.dataUpdatedAt ? `آخر تحديث ناجح: ${new Date(ordersQuery.dataUpdatedAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}${Date.now() - ordersQuery.dataUpdatedAt > 60_000 ? " · قد تكون البيانات قديمة" : ""}` : "جارٍ تحميل أحدث البيانات…"}</span>
        {(!online || ordersQuery.isRefetchError) && <Button size="sm" variant="outline" disabled={!online || ordersQuery.isFetching} onClick={() => void ordersQuery.refetch()}><RefreshCw className={cn("ml-1 h-3.5 w-3.5", ordersQuery.isFetching && "animate-spin")} />إعادة المحاولة</Button>}
      </div>

      {newOrdersNotice > 0 && <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e9c8a6] bg-[#f7e5d3] px-4 py-3 text-sm text-[#633b33]" aria-live="polite"><span><strong>{newOrdersNotice} طلب جديد.</strong> ظهر بعد آخر تحديث تلقائي أو يدوي دون تغيير الفلاتر أو الطلب المفتوح.</span><button type="button" className="rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setNewOrdersNotice(0)} aria-label="إغلاق تنبيه الطلبات الجديدة"><X className="h-4 w-4" /></button></div>}

      <section className="kitchen-secondary-metrics grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="مؤشرات قائمة الطلبات">
        {([
          ["requested", "جديد", ordersQuery.data?.counts.new || 0],
          ["attention", "متأخر", ordersQuery.data?.counts.overdue || 0],
          ["today", "مطلوب اليوم", ordersQuery.data?.counts.dueToday || 0],
          ["discrepancy", "فروقات مفتوحة", ordersQuery.data?.counts.openDiscrepancies || 0],
        ] as const).map(([target, label, count]) => <button key={target} type="button" className="rounded-xl border border-[#e6ddd6] bg-[#fffdf9] px-3 py-2 text-right shadow-sm hover:border-[#c9aebf]" onClick={() => {
          changeStage("all");
          setFocus(target === "requested" ? "new" : target === "attention" ? "overdue" : target === "today" ? "dueToday" : "discrepancy");
        }}><strong className="text-lg text-[#4f2a63]">{count}</strong><span className="mr-2 text-xs text-muted-foreground">{label}</span></button>)}
        <p className="col-span-2 text-[10px] text-muted-foreground sm:col-span-4">المؤشرات تشمل كامل نتائج الفرع والبحث والفلاتر الثانوية، ولا تتقيد بتبويب المرحلة الحالي.</p>
      </section>

      <nav className="kitchen-stage-rail -mx-1 flex overflow-x-auto border-b border-[#e6ddd6] px-1" aria-label="مراحل الطلبات">
        {([
          ["attention", "يتطلب تدخلاً"], ["requested", "طلبات جديدة"], ["approved", "قيد التجهيز"],
          ["prepared", "جاهز للإرسال"], ["dispatched", "في الطريق"], ["archive", "السجل"], ["all", "الكل"],
        ] as Array<[OrderStage, string]>).map(([key, label]) => <button key={key} type="button" onClick={() => changeStage(key)} aria-current={stage === key ? "page" : undefined} className={cn("flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-3 text-xs text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm", stage === key && "border-[#4f2a63] font-semibold text-[#4f2a63]")}>
          <span>{label}</span><span className={cn("rounded-full bg-[#e9e0db] px-2 py-0.5 text-[10px]", stage === key && "bg-[#ead8e8] text-[#4f2a63]")}>{stageCounts[key]}</span>
        </button>)}
      </nav>

      <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="min-w-0 overflow-hidden border-[#e6ddd6] bg-[#fffdf9] shadow-sm">
        <CardContent className="p-0">
          <div className="kitchen-queue-toolbar flex flex-wrap items-center gap-2 border-b border-[#eee5df] p-3">
            <div className="kitchen-search relative min-w-0 flex-[1_1_260px]"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="بحث في الطلبات" value={search} onChange={event => setSearch(event.target.value)} className="h-10 bg-[#fbf7f3] pr-9" placeholder="رقم الطلب أو الفرع أو المطبخ" /></div>
            <Button variant="outline" className="h-10 border-[#e6d9d1] bg-[#fffaf6]" type="button" onClick={() => setFiltersOpen(open => !open)} aria-expanded={filtersOpen} aria-controls="kitchen-order-filters"><SlidersHorizontal className="ml-2 h-4 w-4" />تصفية</Button>
            <Select value={sort} onValueChange={value => setSort(value as typeof sort)}><SelectTrigger className="h-10 w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="priority">الأولوية</SelectItem><SelectItem value="newest">الأحدث</SelectItem><SelectItem value="oldest_waiting">الأقدم انتظاراً</SelectItem></SelectContent></Select>
            <DropdownMenu><DropdownMenuTrigger asChild><Button data-testid="sheet-actions-trigger" variant="outline" className="h-10" disabled={!selectedOrderIds.size || preparationSheetMutation.isPending}><EllipsisVertical className="ml-1 h-4 w-4" />تجهيز ومشاركة ({selectedOrderIds.size})</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="text-right"><DropdownMenuItem onSelect={() => preparationSheetMutation.mutate()}>معاينة الورقة قبل الطباعة والمشاركة</DropdownMenuItem><DropdownMenuItem onSelect={() => setSelectedOrderIds(new Set())}>مسح التحديد</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
            <span className="text-xs text-muted-foreground">{ordersQuery.data?.total || 0} طلب</span>
          </div>
          <div id="kitchen-order-filters" hidden={!filtersOpen} className="grid gap-2 border-b border-[#eee5df] p-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={branchFilter} onValueChange={setBranchFilter}><SelectTrigger disabled={!canSelectBranch}><SelectValue placeholder="فرع المصدر" /></SelectTrigger><SelectContent>{canSelectBranch && <SelectItem value="all">كل الفروع</SelectItem>}{branches.map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select>
            <Select value={kitchenFilter} onValueChange={setKitchenFilter}><SelectTrigger><SelectValue placeholder="المطبخ" /></SelectTrigger><SelectContent><SelectItem value="all">كل المطابخ</SelectItem>{centralKitchens.map(kitchen => <SelectItem key={kitchen.id} value={kitchen.id}>{kitchen.name}</SelectItem>)}</SelectContent></Select>
            <Select value={dateFilter} onValueChange={setDateFilter}><SelectTrigger><SelectValue placeholder="موعد الحاجة" /></SelectTrigger><SelectContent><SelectItem value="all">كل المواعيد</SelectItem><SelectItem value="today">احتياج اليوم</SelectItem><SelectItem value="past">موعد سابق</SelectItem><SelectItem value="future">موعد لاحق</SelectItem></SelectContent></Select>
            <Select value={inventoryModeFilter} onValueChange={changeInventoryModeFilter}><SelectTrigger><SelectValue placeholder="وضع المخزون" /></SelectTrigger><SelectContent><SelectItem value="all">كل أوضاع المخزون</SelectItem><SelectItem value="real">فعلي</SelectItem><SelectItem value="shadow">ظلّي — تشغيلي</SelectItem><SelectItem value="unknown">غير محدد / طلب قديم</SelectItem></SelectContent></Select>
          </div>

      {ordersQuery.isLoading ? <Card><CardContent className="space-y-3 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton className="h-14 w-full" key={i} />)}</CardContent></Card> :
      ordersQuery.isError ? <Card><CardContent className="py-16 text-center"><p className="font-medium">تعذر تحميل الطلبات</p><p className="mt-1 text-sm text-muted-foreground">تحقق من الاتصال ثم أعد المحاولة.</p><Button className="mt-4" variant="outline" onClick={refresh}>إعادة المحاولة</Button></CardContent></Card> :
       filtered.length === 0 ? <div className="py-16 text-center"><PackagePlus className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><h2 className="font-semibold">لا توجد طلبات ضمن هذا العرض</h2><p className="mt-1 text-sm text-muted-foreground">غيّر المرحلة أو امسح البحث والفلاتر الثانوية.</p><Button variant="link" className="mt-2" onClick={() => { setSearch(""); setKitchenFilter("all"); setDateFilter("all"); setFocus(null); changeInventoryModeFilter("all"); }}>مسح الفلاتر</Button></div> :
      <section className="divide-y divide-[#eee6df] p-1.5" aria-label="قائمة الطلبات">
        {filtered.map(order => <div key={order.id} role="button" tabIndex={0} onClick={() => selectDetail(order.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectDetail(order.id); } }} className={cn("kitchen-order-row grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-transparent p-3 text-right transition-colors hover:bg-[#fcf6f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[auto_minmax(190px,1.3fr)_minmax(130px,.7fr)_minmax(145px,.8fr)_18px]", String(detailId) === String(order.id) && "border-[#e9d8e7] bg-[#f5edf4]", queueOrderNeedsAttention(order) && "border-r-[3px] border-r-[#c56a45]")}>
          <input type="checkbox" aria-label={`اختيار ${order.orderNumber} لورقة التجهيز`} disabled={["cancelled", "received"].includes(normalized(order.status))} checked={selectedOrderIds.has(String(order.id))} onClick={event => event.stopPropagation()} onChange={event => setSelectedOrderIds(current => { const next = new Set(current); if (event.target.checked) next.add(String(order.id)); else next.delete(String(order.id)); return next; })} className="h-4 w-4 accent-[#4f2a63]" />
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="font-mono text-sm text-[#4f2a63]">{order.orderNumber}</strong>{queueOrderNeedsAttention(order) && <span className="inline-flex items-center gap-1 rounded bg-[#f9e4d6] px-1.5 py-0.5 text-[10px] text-[#934829]"><AlertTriangle className="h-3 w-3" />{isOpenDiscrepancy(order) ? "فروقات مفتوحة" : ["requested", "pending", "draft"].includes(normalized(order.status)) ? "طلب جديد" : "متأخر عن موعد الحاجة"}</span>}</div><span className="mt-1 block truncate text-xs text-muted-foreground">{order.requestBranchName || branchName(order.requestBranchId)} <span className="px-1">←</span> {order.centralKitchenName || branchName(order.centralKitchenId)}</span>{order.nextResponsible && <span className={cn("mt-1 block text-[10px]", order.nextResponsible.unassigned ? "font-medium text-amber-700" : "text-muted-foreground")}>{order.nextResponsible.unassigned ? "⚠ غير معيّن: " : "المسؤول التالي: "}{order.nextResponsible.name || order.nextResponsible.role}</span>}</div>
          <div className="text-xs sm:block"><span className="block text-[10px] text-muted-foreground">موعد الحاجة</span><strong className="font-medium">{readableDate(order.neededDate)} · {readableTime(order.neededTime)}</strong></div>
          <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:block"><StatusBadge status={order.status} /><LateSubmissionBadge schedule={order.orderingSchedule} /><NextStepSummary order={order} /></div>
          <ChevronLeft className="kitchen-order-next hidden h-4 w-4 text-muted-foreground sm:block" />
        </div>)}
      </section>}
      {!!ordersQuery.data && ordersQuery.data.totalPages > 1 && <div className="flex items-center justify-between border-t px-3 py-3 text-xs"><Button size="sm" variant="outline" disabled={page <= 1 || ordersQuery.isFetching} onClick={() => setPage(value => value - 1)}>السابق</Button><span>صفحة {ordersQuery.data.page} من {ordersQuery.data.totalPages}</span><Button size="sm" variant="outline" disabled={page >= ordersQuery.data.totalPages || ordersQuery.isFetching} onClick={() => setPage(value => value + 1)}>التالي</Button></div>}
        </CardContent>
      </Card>
      <aside className="sticky top-4 hidden min-h-[520px] rounded-2xl border border-[#e6ddd6] bg-[#fffdf9] p-4 shadow-sm lg:block" aria-label="ملخص الطلب المحدد">
        <OrderSummaryPane
          order={selectedDetail}
          loading={detailId !== null && (detailQuery.isLoading || detailQuery.isFetching)}
          error={detailId !== null && detailQuery.isError}
          queryError={detailQuery.error}
          onRetry={() => detailQuery.refetch()}
          onOpen={() => detailId !== null && openFullDetail(detailId)}
          onClear={closeDetail}
        />
      </aside>
      </section>

      <details className="rounded-xl border border-[#e6ddd6] bg-[#fffdf9]">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><BarChart3 className="h-4 w-4" />التقارير والإعدادات الثانوية</summary>
        <div className="space-y-4 border-t p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">مؤشرات التجربة والتوسع</h2><p className="text-xs text-muted-foreground">قياس دورة الطلب وجودة التوريد قبل تفعيل المخزون الفعلي.</p></div><div className="flex flex-wrap gap-2">{canConfigureRouting && <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} data-testid="routing-settings-trigger"><Settings className="ml-2 h-4 w-4" />مسؤولو الفروع</Button>}<Select value={pilotDays} onValueChange={setPilotDays}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">آخر 7 أيام</SelectItem><SelectItem value="30">آخر 30 يوماً</SelectItem><SelectItem value="90">آخر 90 يوماً</SelectItem></SelectContent></Select></div></div>
          {metricsQuery.isLoading ? <div className="grid gap-3 md:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20" />)}</div> : metricsQuery.data ? <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><MetricTile label="إجمالي الطلبات" value={metricsQuery.data.totalOrders} /><MetricTile label="متأخرة عن الحاجة" value={metricsQuery.data.overdueOrders} tone={metricsQuery.data.overdueOrders ? "danger" : "normal"} /><MetricTile label="فروقات مفتوحة" value={metricsQuery.data.openDiscrepancies} tone={metricsQuery.data.openDiscrepancies ? "warning" : "normal"} /><MetricTile label="متوسط اكتمال البنود" value={metricsQuery.data.fulfillmentRate === null ? "—" : `${metricsQuery.data.fulfillmentRate}%`} /><MetricTile label="طلبات بها فروقات" value={metricsQuery.data.discrepancyRate === null ? "—" : `${metricsQuery.data.discrepancyRate}%`} /></div><div className="grid gap-2 border-t pt-3 text-xs sm:grid-cols-2 lg:grid-cols-4"><StageTime label="الاعتماد" value={metricsQuery.data.averageStageHours.approval} /><StageTime label="التجهيز" value={metricsQuery.data.averageStageHours.preparation} /><StageTime label="الإرسال" value={metricsQuery.data.averageStageHours.dispatch} /><StageTime label="التوصيل" value={metricsQuery.data.averageStageHours.delivery} /></div><div className="text-xs text-muted-foreground">السجل التجريبي: {metricsQuery.data.shadowLedger.entryCount} حركة{metricsQuery.data.shadowLedger.byUnit.length ? ` · ${metricsQuery.data.shadowLedger.byUnit.map(entry => `${entry.direction === "projected_kitchen_out" ? "خصم" : "إضافة"} ${entry.quantity} ${entry.unit}`).join(" · ")}` : ""}</div></> : <p className="text-sm text-muted-foreground">تعذر تحميل مؤشرات التجربة.</p>}
          <OrderNotificationsOptIn />
        </div>
      </details>
    </main>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent dir="rtl" style={{ ...createDialogStyle, display: "flex", flexDirection: "column" }} className="h-[94dvh] max-h-[820px] max-w-4xl gap-0 overflow-hidden p-0 sm:rounded-xl [&>button]:left-2 [&>button]:right-auto [&>button]:top-2 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center"><DialogHeader className="border-b py-4 pl-14 pr-4 text-right"><DialogTitle>طلب جديد للمطبخ المركزي</DialogTitle><DialogDescription>أضف احتياج الفرع بدقة ليظهر لفريق المطبخ فوراً.</DialogDescription></DialogHeader>
      <div className="mb-[76px] min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6"><div className="grid gap-4 py-2 md:grid-cols-2"><FormSelect label="الفرع الطالب" value={draft.sourceBranchId} onChange={value => setDraft(current => ({ ...current, sourceBranchId: value, items: current.items.map(item => ({ ...item, reportedAvailableQuantity: "" })) }))} branches={branches} placeholder="اختر الفرع" /><FormSelect testId="kitchen-select" label="المطبخ المركزي" value={draft.centralKitchenId} onChange={value => setDraft({ ...draft, centralKitchenId: value })} branches={centralKitchens.filter(branch => branch.id !== draft.sourceBranchId)} placeholder={kitchensQuery.isLoading ? "جارٍ تحميل المطابخ..." : centralKitchens.length ? "اختر المطبخ" : kitchensQuery.isError ? "تعذر تحميل المطابخ المركزية" : "لا يوجد مطبخ مركزي مفعّل"} />
        <div><Label htmlFor="needed-date">تاريخ الحاجة</Label><Input id="needed-date" type="date" className="mt-2" value={draft.neededDate} onChange={event => setDraft({ ...draft, neededDate: event.target.value })} /></div><div><Label htmlFor="needed-time">وقت الحاجة</Label><Input id="needed-time" type="time" className="mt-2" value={draft.neededTime} onChange={event => setDraft({ ...draft, neededTime: event.target.value })} /></div>
      </div>
      {!!draft.centralKitchenId && (kitchenRoutingQuery.isLoading ? <p role="status" className="rounded border p-3 text-sm text-muted-foreground">جارٍ تحميل فريق المطبخ المسؤول…</p> : kitchenRoutingQuery.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span>تعذر تحميل إعداد المسؤولين. لا نفترض وجود إعداد تلقائياً.</span><Button type="button" size="sm" variant="outline" onClick={() => void kitchenRoutingQuery.refetch()}>إعادة المحاولة</Button></div> : kitchenRoutingQuery.data?.hasKitchenResponsible ? <div className="rounded border border-sky-200 bg-sky-50 p-3 text-sm"><strong>فريق المطبخ:</strong> {kitchenRoutingQuery.data.responsibleName}{kitchenRoutingQuery.data.deputyName ? ` · النائب: ${kitchenRoutingQuery.data.deputyName}` : ""}</div> : <div data-testid="kitchen-routing-warning" role="status" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">لا يوجد مسؤول مطبخ معيّن لهذا الفرع. يمكنك إرسال الطلب، وسيتم تنبيه فريق العمليات للتدخل.</div>)}
      {!!draft.sourceBranchId && (receiverRoutingQuery.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span>تعذر تحميل مسؤول استلام الفرع. لا نفترض وجود تعيين.</span><Button type="button" size="sm" variant="outline" onClick={() => void receiverRoutingQuery.refetch()}>إعادة المحاولة</Button></div> : receiverRoutingQuery.data?.receiverName ? <p className="rounded border bg-muted/20 p-3 text-sm">مسؤول الاستلام في الفرع: <strong>{receiverRoutingQuery.data.receiverName}</strong></p> : null)}
      {orderingPolicy.query.isError ? <p role="alert" className="rounded border border-amber-300 p-3 text-sm">تعذر تحميل مواعيد الطلب من الخادم. <Button variant="link" onClick={() => void openCreate()}>إعادة المحاولة</Button></p> : !orderingPolicy.query.data ? <p role="status" className="text-sm text-muted-foreground">جارٍ تحميل مواعيد الطلب بتوقيت السعودية…</p> : <OrderScheduleNotice schedule={draftSchedule} preview />}
      <OrderLineEditor items={draft.items} products={products} kitchenId={draft.centralKitchenId} catalogLoading={productsQuery.isLoading} catalogError={productsQuery.isError} onRetryCatalog={() => void productsQuery.refetch()} onChange={items => setDraft(current => ({ ...current, items }))} />
       <div><Label htmlFor="order-notes">ملاحظات عامة</Label><textarea id="order-notes" className="mt-2 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} placeholder="تعليمات خاصة للاستلام أو التجهيز..." /></div>
       {!isKitchenOrderDraftValid(draft.items) && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950" role="status">قبل الإرسال: اختر الصنف، وأدخل كمية الطلب والمتوفر الحالي لكل بند. اكتب 0 صراحةً عند عدم توفر الصنف.</p>}
      </div>
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 border-t bg-background px-4 py-3 sm:px-6"><span className="text-xs text-muted-foreground">{draft.items.length} {draft.items.length === 1 ? "بند" : "بنود"}</span><div className="flex gap-2"><Button variant="outline" className="min-h-11" onClick={() => setCreateOpen(false)}>إلغاء</Button><Button className="min-h-11" disabled={createMutation.isPending || !draft.neededDate || !draft.sourceBranchId || !draft.centralKitchenId || !orderingPolicy.query.data || !isKitchenOrderDraftValid(draft.items)} onClick={() => { const invalid = document.querySelector<HTMLElement>("[aria-invalid='true']"); if (invalid) { invalid.focus(); return; } createMutation.mutate(); }}>{createMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}إرسال الطلب</Button></div></div>
    </DialogContent></Dialog>

    {canConfigureRouting && <RoutingSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} branches={routingBranches} />}
    <SheetPreviewDialog sheet={sheetPreview} open={sheetPreviewOpen} onOpenChange={setSheetPreviewOpen} />

      <Dialog open={detailId !== null && detailDialogOpen} onOpenChange={open => { setDetailDialogOpen(open); if (!open && typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) closeDetail(); }}><DialogContent dir="rtl" style={{ ...detailDialogStyle, display: "flex", flexDirection: "column" }} className="kitchen-detail-dialog h-[94dvh] max-h-[900px] max-w-5xl gap-0 overflow-hidden p-0 sm:rounded-xl [&>button]:left-3 [&>button]:right-auto [&>button]:top-3 [&>button]:z-20 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center">
        {selectedDetail && <DialogHeader className="shrink-0 border-b bg-background py-3 pl-16 pr-4 text-right sm:pr-6"><div className="flex min-w-0 items-center gap-2"><div className="min-w-0 flex-1"><DialogTitle className="truncate font-mono text-lg">{selectedDetail.orderNumber}</DialogTitle><DialogDescription className="truncate">طلب الفرع {selectedDetail.requestBranchName || selectedDetail.requestBranchId} من {selectedDetail.centralKitchenName || selectedDetail.centralKitchenId}</DialogDescription></div><StatusBadge status={selectedDetail.status} /></div></DialogHeader>}
        <div className="kitchen-detail-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-20 sm:px-6">{(detailQuery.isLoading || (detailQuery.isFetching && detailQuery.isPlaceholderData)) ? <div className="space-y-3 py-8" aria-label="جارٍ تحميل تفاصيل الطلب">{Array.from({ length: 5 }).map((_, i) => <Skeleton className="h-14 w-full" key={i} />)}</div> : detailQuery.isError || !selectedDetail ? <DetailQueryError error={detailQuery.error} onRetry={() => detailQuery.refetch()} /> : <div className="space-y-4 pb-20"><OrderDetail showHeader={false} order={selectedDetail} products={products} productsQuery={productsQuery} accessibleBranchIds={branches.map(branch => branch.id)} actionNotes={actionNotes} setActionNotes={setActionNotes} pending={workflowMutation.isPending} canApprove={canApprove("central_kitchen_orders")} canEdit={canEdit("central_kitchen_orders")} canConfigureRouting={canConfigureRouting} onConfigureRouting={() => setSettingsOpen(true)} onAction={(action, details) => workflowMutation.mutate({ id: selectedDetail.id, action, details })} /></div>}</div>
      </DialogContent></Dialog>
  </Layout>;
}

function StatusBadge({ status }: { status: string }) { const info = STATUS[normalized(status)] || { label: status, className: "bg-muted text-muted-foreground border-border" }; return <Badge variant="outline" className={cn("whitespace-nowrap font-medium", info.className)}>{info.label}</Badge>; }
function NextStepSummary({ order }: { order: KitchenOrder }) {
  const step = getCentralKitchenNextStep({
    status: order.status,
    inventoryMode: parseCentralKitchenInventoryMode(order.inventoryMode),
    discrepancyStatus: order.discrepancyStatus,
  });
  const inventoryMode = parseCentralKitchenInventoryMode(order.inventoryMode);
  return <><span className={cn("mt-1 block text-[11px]", step.isComplete ? "text-emerald-700" : order.nextResponsible?.unassigned ? "font-medium text-amber-700" : "text-muted-foreground")}>{step.isComplete ? step.label : `التالي: ${step.label} · ${order.nextResponsible?.name || order.nextResponsible?.role || step.owner}${order.nextResponsible?.unassigned ? " (غير معيّن)" : ""}`}</span>{inventoryMode === "shadow" && <span className="block text-[10px] text-amber-700">ظلّي — تشغيلي فقط، لا حركة مخزون فعلية</span>}{inventoryMode === "unknown" && <span className="block text-[10px] text-muted-foreground">وضع المخزون غير محدد — طلب قديم</span>}</>;
}
const LIFECYCLE_STAGES = [
  { status: "requested", label: "طلب" },
  { status: "approved", label: "اعتماد" },
  { status: "prepared", label: "تجهيز" },
  { status: "dispatched", label: "إرسال" },
  { status: "received", label: "استلام" },
] as const;
function LifecycleProgress({ status }: { status: string }) {
  if (status === "cancelled") return <p className="rounded border p-3 text-muted-foreground">طلب ملغي — محفوظ في السجل ولا يدخل في الطلب النشط.</p>;
  const currentIndex = LIFECYCLE_STAGES.findIndex(stage => stage.status === status);
  if (currentIndex < 0) {
    return <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">حالة الطلب غير معروفة — لا يمكن تحديد تقدّم الدورة.</div>;
  }
  return <section aria-label="تقدم دورة الطلب" className="rounded-lg border bg-background p-3"><div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">تقدم دورة الطلب</h3><span className="text-xs text-muted-foreground">{currentIndex + 1} من {LIFECYCLE_STAGES.length}</span></div><div className="grid grid-cols-5 gap-1">{LIFECYCLE_STAGES.map((stage, index) => <div key={stage.status} className="text-center"><div className={cn("mx-auto h-2 rounded-full", index <= currentIndex ? "bg-primary" : "bg-muted")} /><span className={cn("mt-1 block text-[11px]", index === currentIndex ? "font-semibold text-primary" : "text-muted-foreground")}>{stage.label}</span></div>)}</div></section>;
}
function NextStepGuidance({ step, inventoryMode }: { step: ReturnType<typeof getCentralKitchenNextStep>; inventoryMode?: KitchenOrder["inventoryMode"] }) {
  const mode = parseCentralKitchenInventoryMode(inventoryMode);
  const shadow = mode === "shadow";
  const unknownMode = mode === "unknown";
  return <section className={cn("rounded-lg border px-4 py-3", step.isComplete ? "border-emerald-200 bg-emerald-50/70" : step.stage === "discrepancy_review" ? "border-amber-300 bg-amber-50/70" : "border-sky-200 bg-sky-50/60")}><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">{step.isComplete ? "مسار الطلب مكتمل" : "الخطوة التالية"}</h3><p className="mt-1 text-sm">{step.label}</p></div><Badge variant="outline" className="bg-background">{step.isComplete ? "مكتمل" : `المسؤول: ${step.owner}`}</Badge></div>{shadow && <p className="mt-2 text-xs text-amber-800">الوضع الظلّي تشغيلي فقط ولا يمثل حركة مخزون فعلية.</p>}{unknownMode && <p className="mt-2 text-xs text-muted-foreground">وضع المخزون غير محدد؛ هذا السجل لا يثبت حركة مخزون فعلية.</p>}{step.stage === "discrepancy_review" && <p className="mt-2 text-xs text-amber-900">لا تُعد الفروقات مكتملة تلقائياً؛ راجعها مع الفريق المسؤول.</p>}</section>;
}
function DetailQueryError({ error, onRetry }: { error: unknown; onRetry: () => unknown }) {
  const status = errorStatus(error);
  const unauthenticated = status === 401;
  const forbidden = status === 403;
  const missing = status === 404;
  return <div className="py-12 text-center" role="alert"><p className="font-medium">{unauthenticated ? "انتهت الجلسة أو لم تسجّل الدخول" : forbidden ? "لا تملك صلاحية عرض هذا الطلب" : missing ? "الطلب غير موجود" : "تعذر تحميل تفاصيل الطلب"}</p><p className="mt-1 text-sm text-muted-foreground">{unauthenticated ? "سجّل الدخول مجدداً ثم افتح رابط الطلب." : forbidden ? "الطلب موجود لكن الوصول إليه خارج صلاحياتك أو نطاق فروعك." : missing ? "لم يُعثر على رقم الطلب في الرابط؛ تحقق من الرابط أو تواصل مع المرسل." : "تحقق من الاتصال ثم أعد المحاولة."}</p>{!forbidden && !unauthenticated && <Button variant="outline" className="mt-4" onClick={() => onRetry()}>إعادة المحاولة</Button>}</div>;
}
function OrderSummaryPane({ order, loading, error, queryError, onRetry, onOpen, onClear }: { order?: KitchenOrder; loading: boolean; error: boolean; queryError: unknown; onRetry: () => unknown; onOpen: () => void; onClear: () => void }) {
  if (loading) return <div className="space-y-3 py-8" aria-label="جارٍ تحميل ملخص الطلب">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12" />)}</div>;
  if (error) return <DetailQueryError error={queryError} onRetry={onRetry} />;
  if (!order) return <div className="flex min-h-[480px] flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground"><PackagePlus className="h-7 w-7" /><strong className="text-sm text-[#694d60]">اختر طلباً من القائمة</strong><span className="text-xs leading-6">تظهر البنود ومسار الإجراء هنا دون ازدحام قائمة الانتظار.</span></div>;
  const nextStep = getCentralKitchenNextStep({
    status: order.status,
    inventoryMode: parseCentralKitchenInventoryMode(order.inventoryMode),
    discrepancyStatus: order.discrepancyStatus,
  });
  return <div data-testid="selected-order-summary" className="space-y-4">
    <div className="flex items-start justify-between gap-3 border-b pb-4"><div><span className="text-[10px] font-semibold tracking-wider text-[#9a725e]">تفاصيل الطلب</span><h2 className="mt-1 font-mono text-lg font-bold text-[#4f2a63]">{order.orderNumber}</h2></div><button type="button" className="rounded p-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onClear} aria-label="إغلاق ملخص الطلب"><X className="h-4 w-4" /></button></div>
    <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><span className="block text-[10px] text-muted-foreground">من الفرع</span><strong className="block truncate text-xs">{order.requestBranchName || order.requestBranchId}</strong></div><ChevronLeft className="h-4 w-4 text-muted-foreground" /><div className="min-w-0 flex-1"><span className="block text-[10px] text-muted-foreground">إلى</span><strong className="block truncate text-xs">{order.centralKitchenName || order.centralKitchenId}</strong></div></div>
    <div className="grid gap-3 rounded-xl bg-[#fbf5f0] p-3 text-xs"><div><span className="text-muted-foreground">موعد الحاجة: </span><strong>{readableDate(order.neededDate)} · {readableTime(order.neededTime)}</strong></div><div className="flex flex-wrap items-center gap-2"><span className="text-muted-foreground">الحالة:</span><StatusBadge status={order.status} /><LateSubmissionBadge schedule={order.orderingSchedule} /></div></div>
    {queueOrderNeedsAttention(order) && <div className="flex gap-2 rounded-lg bg-[#f9e7dc] p-3 text-xs leading-5 text-[#833e29]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{isOpenDiscrepancy(order) ? "تم الاستلام مع فروقات مفتوحة؛ لا يعد الطلب مكتملاً." : "تجاوز الطلب موعد الحاجة المحدد ولم يكتمل بعد."}</span></div>}
    <section><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">البنود المطلوبة</h3><span className="text-[10px] text-muted-foreground">{order.items?.length ?? order.itemCount ?? 0} بنود</span></div><div className="divide-y border-y">{(order.items || []).slice(0, 5).map(item => <div key={item.id || item.productName} className="flex justify-between gap-3 py-2 text-xs"><span className="truncate">{item.productName}</span><strong className="shrink-0 font-medium">{item.requestedQuantity} {item.unit}</strong></div>)}{!order.items?.length && <p className="py-4 text-center text-xs text-muted-foreground">افتح التفاصيل لتحميل البنود الكاملة.</p>}{(order.items?.length || 0) > 5 && <p className="py-2 text-[10px] text-muted-foreground">+ {(order.items?.length || 0) - 5} بنود أخرى</p>}</div></section>
    {order.notes && <div className="border-r-2 border-[#c7955a] bg-[#f6f0e5] p-3 text-xs"><span className="block text-[10px] text-muted-foreground">ملاحظة الفرع</span><p className="mt-1 leading-5">{order.notes}</p></div>}
    <div className="border-t pt-3"><p className="mb-2 text-xs text-muted-foreground">{nextStep.isComplete ? nextStep.label : `التالي: ${nextStep.label} · ${order.nextResponsible?.name || order.nextResponsible?.role || nextStep.owner}`}</p><Button className="w-full bg-[#4f2a63] hover:bg-[#3f2250]" onClick={onOpen}>{nextStep.isComplete ? "فتح التفاصيل" : `فتح نموذج ${nextStep.label}`}</Button></div>
  </div>;
}
function MetricTile({ label, value, tone = "normal" }: { label: string; value: string | number; tone?: "normal" | "warning" | "danger" }) { return <div className={cn("rounded-lg border bg-background p-3", tone === "warning" && "border-amber-200 bg-amber-50", tone === "danger" && "border-red-200 bg-red-50")}><span className="text-xs text-muted-foreground">{label}</span><strong className="mt-1 block text-2xl">{value}</strong></div>; }
function StageTime({ label, value }: { label: string; value: number | null }) { return <div className="flex items-center justify-between rounded-md bg-background/70 px-3 py-2"><span>متوسط {label}</span><strong>{value === null ? "—" : `${value} ساعة`}</strong></div>; }
function FormSelect({ label, value, onChange, branches, placeholder, testId }: { label: string; value: string; onChange: (value: string) => void; branches: { id: string; name: string }[]; placeholder: string; testId?: string }) { return <div><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger data-testid={testId} className="mt-2"><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{branches.map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select></div>; }

const CLEAR_ROUTING_VALUE = "__none__";
function RoutingSettingsDialog({ open, onOpenChange, branches }: { open: boolean; onOpenChange: (open: boolean) => void; branches: Array<{ id: string; name: string }> }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [branchId, setBranchId] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState<string | null>(null);
  const [deputyUserId, setDeputyUserId] = useState<string | null>(null);
  const [receiverUserId, setReceiverUserId] = useState<string | null>(null);
  const routingUrl = `/api/central-kitchen-orders/routing?branchId=${encodeURIComponent(branchId)}`;
  const candidatesUrl = `/api/central-kitchen-orders/routing/candidates?branchId=${encodeURIComponent(branchId)}`;
  const routingQuery = useQuery<Routing>({ queryKey: [routingUrl], enabled: open && !!branchId, retry: false });
  const candidatesQuery = useQuery<RoutingCandidates>({ queryKey: [candidatesUrl], enabled: open && !!branchId, retry: false });
  useEffect(() => {
    if (!routingQuery.data || routingQuery.data.branchId !== branchId) return;
    setResponsibleUserId(routingQuery.data.responsibleUserId);
    setDeputyUserId(routingQuery.data.deputyUserId);
    setReceiverUserId(routingQuery.data.receiverUserId);
  }, [branchId, routingQuery.data]);
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!branchId) throw new Error("اختر الفرع أولاً.");
      const response = await apiRequest("PUT", `/api/central-kitchen-orders/routing/${encodeURIComponent(branchId)}`, {
        responsibleUserId,
        deputyUserId,
        receiverUserId,
      });
      return response.json() as Promise<Routing>;
    },
    onSuccess: (routing) => {
      queryClient.setQueryData([routingUrl], routing);
      void queryClient.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/central-kitchen-orders") });
      toast({ title: "تم حفظ مسؤولي الفرع" });
    },
    onError: (error) => toast({ title: "تعذر حفظ الإعداد", description: error instanceof Error ? error.message : "تحقق من الاتصال ثم أعد المحاولة.", variant: "destructive" }),
  });
  const loading = !!branchId && (routingQuery.isLoading || candidatesQuery.isLoading);
  const failed = routingQuery.isError || candidatesQuery.isError;
  const candidates = candidatesQuery.data;
  const updateBranch = (value: string) => {
    setBranchId(value);
    setResponsibleUserId(null);
    setDeputyUserId(null);
    setReceiverUserId(null);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent dir="rtl" className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
      <DialogHeader className="text-right">
        <DialogTitle>مسؤولو المطبخ والاستلام</DialogTitle>
        <DialogDescription>حدد المسؤولين لكل فرع. هذا الإعداد يوجّه الطلبات والتنبيهات فقط ولا يمنح أي صلاحيات للنظام.</DialogDescription>
      </DialogHeader>
      <FormSelect testId="routing-branch-select" label="الفرع" value={branchId} onChange={updateBranch} branches={branches} placeholder="اختر فرعاً أو مطبخاً" />
      {!branchId ? <p className="rounded border bg-muted/20 p-3 text-sm text-muted-foreground">اختر الفرع لعرض الإعداد الحالي والمرشحين المؤهلين.</p> :
       loading ? <p role="status" className="flex items-center gap-2 rounded border p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />جارٍ تحميل الإعداد…</p> :
       failed ? <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p>تعذر تحميل الإعداد أو المرشحين. لم يتم افتراض أي مسؤول.</p><Button className="mt-2" size="sm" variant="outline" onClick={() => { void routingQuery.refetch(); void candidatesQuery.refetch(); }}>إعادة المحاولة</Button></div> :
       <div className="grid gap-4 sm:grid-cols-2">
         <RoutingPersonSelect testId="routing-responsible-select" label="مسؤول المطبخ" value={responsibleUserId} onChange={setResponsibleUserId} candidates={candidates?.kitchenCandidates || []} />
         <RoutingPersonSelect testId="routing-deputy-select" label="نائب مسؤول المطبخ" value={deputyUserId} onChange={setDeputyUserId} candidates={candidates?.kitchenCandidates || []} />
         <div className="sm:col-span-2"><RoutingPersonSelect testId="routing-receiver-select" label="مسؤول استلام الفرع" value={receiverUserId} onChange={setReceiverUserId} candidates={candidates?.receiverCandidates || []} /></div>
       </div>}
      <p className="text-xs text-muted-foreground">تظهر فقط الحسابات المؤهلة التي أعادها الخادم. اختيار شخص هنا لا يمنحه صلاحية عرض أو اعتماد أو استلام الطلبات.</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
        <Button data-testid="routing-save" disabled={!branchId || loading || failed || saveMutation.isPending} onClick={() => saveMutation.mutate()}>{saveMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}حفظ الإعداد</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

function RoutingPersonSelect({ testId, label, value, onChange, candidates }: { testId: string; label: string; value: string | null; onChange: (value: string | null) => void; candidates: Array<{ id: string; name: string }> }) {
  return <div><Label>{label}</Label><Select value={value || CLEAR_ROUTING_VALUE} onValueChange={next => onChange(next === CLEAR_ROUTING_VALUE ? null : next)}><SelectTrigger data-testid={testId} className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={CLEAR_ROUTING_VALUE}>بدون تعيين</SelectItem>{candidates.filter(candidate => candidate.id && candidate.name.trim()).map(candidate => <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>)}</SelectContent></Select></div>;
}
type CatalogQueryLike = { isLoading: boolean; isError: boolean; error?: Error | null; refetch: () => unknown };
function CatalogQueryState({ query, count }: { query: CatalogQueryLike; count: number }) {
  if (query.isLoading) return <div className="m-3 flex items-center gap-2 rounded-md border bg-background p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />جارٍ تحميل كتالوج الأصناف...</div>;
  if (query.isError) return <div className="m-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span>{query.error?.message || "تعذر تحميل كتالوج الأصناف. تحقق من الاتصال ثم أعد المحاولة."} لم يتم استنتاج أي معرّفات أو التحويل تلقائياً.</span><Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}><RefreshCw className="ml-1 h-4 w-4" />إعادة المحاولة</Button></div>;
  if (!count) return <div className="m-3 rounded-md border bg-background p-3 text-sm text-muted-foreground">الكتالوج فارغ حالياً. يمكنك اختيار «إدخال يدوي» بشكل صريح.</div>;
  return null;
}
function DetailRoutingSection({ order, canConfigure, onConfigure }: { order: KitchenOrder; canConfigure: boolean; onConfigure: () => void }) {
  const kitchenUrl = `/api/central-kitchen-orders/routing?branchId=${encodeURIComponent(order.centralKitchenId)}`;
  const requestBranchUrl = `/api/central-kitchen-orders/routing?branchId=${encodeURIComponent(order.requestBranchId)}`;
  const kitchen = useQuery<Routing>({ queryKey: [kitchenUrl], retry: false });
  const requestBranch = useQuery<Routing>({ queryKey: [requestBranchUrl], retry: false });
  if (kitchen.isLoading || requestBranch.isLoading) return <section className="rounded-lg border p-4 text-sm text-muted-foreground">جارٍ تحميل مسؤولي الطلب الحاليين…</section>;
  if (kitchen.isError || requestBranch.isError) return <section role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>تعذر تحميل مسؤولي الطلب. لا نفترض وجود تعيين.</p><Button size="sm" variant="outline" className="mt-2" onClick={() => { void kitchen.refetch(); void requestBranch.refetch(); }}>إعادة المحاولة</Button></section>;
  return <section className="rounded-lg border bg-muted/20 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">مسؤولو هذا الطلب حالياً</h3><p className="text-xs text-muted-foreground">يعرض الإعداد الحالي للفرعين، وليس تعييناً تلقائياً داخل الطلب.</p></div>{canConfigure && <Button size="sm" variant="outline" onClick={onConfigure}><Settings className="ml-1 h-4 w-4" />تدخل العمليات</Button>}</div>
    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3"><div><span className="block text-xs text-muted-foreground">مسؤول المطبخ</span>{kitchen.data?.responsibleName || "غير معيّن"}</div><div><span className="block text-xs text-muted-foreground">النائب</span>{kitchen.data?.deputyName || "غير معيّن"}</div><div><span className="block text-xs text-muted-foreground">مسؤول استلام الفرع</span>{requestBranch.data?.receiverName || "غير معيّن"}</div></div>
    {!kitchen.data?.hasKitchenResponsible && <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">لا يوجد مسؤول مطبخ معيّن؛ الطلب يبقى مسموحاً ويحتاج متابعة العمليات.</p>}
  </section>;
}
function OrderDetail({ showHeader = true, order, products, productsQuery, accessibleBranchIds, actionNotes, setActionNotes, pending, canApprove, canEdit, canConfigureRouting, onConfigureRouting, onAction }: { showHeader?: boolean; order: KitchenOrder; products: ProductOption[]; productsQuery: CatalogQueryLike; accessibleBranchIds: string[]; actionNotes: string; setActionNotes: (value: string) => void; pending: boolean; canApprove: boolean; canEdit: boolean; canConfigureRouting: boolean; onConfigureRouting: () => void; onAction: (action: "approve" | "prepare" | "dispatch" | "receive" | "resolve-discrepancy", details?: Record<string, unknown>) => void }) {
  const [section, setSection] = useState<"overview" | "items" | "decisions" | "history">(() => ["received", "cancelled"].includes(normalized(order.status)) ? "decisions" : "overview");
  useEffect(() => { setSection(["received", "cancelled"].includes(normalized(order.status)) ? "decisions" : "overview"); }, [order.id, order.status]);
  const status = normalized(order.status);
  const discrepancyQuantities = (order.items || []).reduce((totals, item) => ({
    damaged: totals.damaged + Math.max(0, Number(item.damagedQuantity || 0)),
    missing: totals.missing + Math.max(0, Number(item.missingQuantity || 0)),
  }), { damaged: 0, missing: 0 });
  const nextStep = getCentralKitchenNextStep({
    status: order.status,
    inventoryMode: parseCentralKitchenInventoryMode(order.inventoryMode),
    discrepancyStatus: order.discrepancyStatus,
    damagedQuantity: discrepancyQuantities.damaged,
    missingQuantity: discrepancyQuantities.missing,
  });
  const action = status === "requested" || status === "pending" || status === "draft" ? "approve" : status === "approved" ? "prepare" : status === "prepared" ? "dispatch" : status === "dispatched" ? "receive" : null;
  const allowAction = action === "approve"
    ? canApprove && order.allowedActions?.approve === true
      : action === "receive"
      ? order.allowedActions?.receive === true
      : !!action && (order.allowedActions
        ? order.allowedActions[action as keyof AllowedActions] === true
        : canEdit && accessibleBranchIds.includes(order.centralKitchenId));
  const actionConfig = action ? { approve: { label: "اعتماد الطلب", icon: ShieldCheck }, prepare: { label: "تأكيد التجهيز", icon: PackagePlus }, dispatch: { label: "تأكيد الشحن", icon: Truck }, receive: { label: "تأكيد الاستلام", icon: Check } }[action] : null;
   return <>{showHeader ? <DialogHeader><div className="flex items-start justify-between gap-3 pl-8"><div><DialogTitle className="font-mono text-xl">{order.orderNumber}</DialogTitle><DialogDescription className="mt-1">طلب الفرع {order.requestBranchName || order.requestBranchId} من {order.centralKitchenName || order.centralKitchenId}</DialogDescription></div><div className="flex flex-wrap items-center gap-2"><StatusBadge status={order.status} /><OrderActionsMenu order={order} canPrint={["prepared", "dispatched", "received"].includes(status)} onPrint={() => printPreparationNote(order)} /></div></div></DialogHeader> : <div className="flex justify-end"><OrderActionsMenu order={order} canPrint={["prepared", "dispatched", "received"].includes(status)} onPrint={() => printPreparationNote(order)} /></div>}
    <nav className="sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto border-y bg-background px-4 py-2 sm:static sm:mx-0 sm:px-0" aria-label="أقسام تفاصيل الطلب">
      {([["overview", "نظرة عامة"], ["items", `البنود (${order.items?.length || 0})`], ["decisions", actionConfig?.label || "القرارات"], ["history", "السجل"]] as const).map(([key, label]) => <Button key={key} size="sm" className="min-h-11 shrink-0" variant={section === key ? "default" : "outline"} onClick={() => setSection(key)}>{label}</Button>)}
    </nav>
    <div hidden={section !== "overview"} className="space-y-4">
    <div className="grid gap-3 border-y py-4 text-sm md:grid-cols-3"><div><span className="block text-muted-foreground">تاريخ الحاجة</span><span className="mt-1 block font-medium">{readableDate(order.neededDate)}</span></div><div><span className="block text-muted-foreground">وقت الحاجة</span><span className="mt-1 block font-medium">{readableTime(order.neededTime)}</span></div><div><span className="block text-muted-foreground">تاريخ الإنشاء</span><span className="mt-1 block font-medium">{readableDate(order.createdAt)}</span></div></div>
    {order.notes && <div className="rounded-md border-r-4 border-primary bg-muted/30 px-4 py-3 text-sm"><span className="mb-1 block text-xs text-muted-foreground">ملاحظات الطلب</span>{order.notes}</div>}
     <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs"><span className="text-muted-foreground">وضع مخزون الطلب:</span><Badge variant="outline" className={parseCentralKitchenInventoryMode(order.inventoryMode) === "real" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : parseCentralKitchenInventoryMode(order.inventoryMode) === "shadow" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-border bg-muted text-muted-foreground"}>{parseCentralKitchenInventoryMode(order.inventoryMode) === "real" ? "فعلي — حجوزات من مخزون المطبخ" : parseCentralKitchenInventoryMode(order.inventoryMode) === "shadow" ? "ظلّي — تشغيلي فقط، لا حركة مخزون فعلية" : "غير محدد — طلب قديم، لا يثبت حركة مخزون"}</Badge></div>
     <OrderScheduleNotice schedule={order.orderingSchedule} />
     <LifecycleProgress status={status} />
     <DetailRoutingSection order={order} canConfigure={canConfigureRouting} onConfigure={onConfigureRouting} />
     {canEdit && accessibleBranchIds.includes(order.requestBranchId) && <RequestChangeControls key={`${order.id}:${Math.max(0, ...(order.events || []).map(event => Number(event.id)))}`} order={order} />}
      {(order.events || []).filter(event => event.eventType === "edited").map(event => <details key={event.id} className="rounded border p-3 text-sm"><summary>تعديل الطلب · {readableDate(event.createdAt)} · {event.notes}</summary><p>تاريخ الاحتياج: {event.changeSnapshot?.before?.order?.neededDate || "—"} ← {event.changeSnapshot?.requested?.edit?.neededDate}</p>{event.changeSnapshot?.before?.items?.map(item => { const updated = event.changeSnapshot?.requested?.edit?.items.find(value => value.itemId === Number(item.id)); return <p key={item.id}>{item.productName}: توريد {item.requestedQuantity} ← {updated?.requestedQuantity} {item.unit} · المتوفر في الفرع {item.reportedAvailableQuantity == null ? "غير مسجل" : item.reportedAvailableQuantity} ← {updated?.reportedAvailableQuantity ?? "غير مسجل"} {item.unit}</p>; })}</details>)}
     <NextStepGuidance step={nextStep} inventoryMode={order.inventoryMode} />
     <div className="flex justify-end"><a href="/production-reports?tab=operations" className="text-xs font-medium text-primary underline-offset-4 hover:underline">عرض تقرير العمليات المترابط</a></div>
     {order.driverName && <div className="grid gap-3 rounded-md border bg-orange-50/40 p-3 text-sm md:grid-cols-2"><div><span className="text-muted-foreground">السائق: </span>{order.driverName}</div><div><span className="text-muted-foreground">المركبة: </span>{order.vehicleNumber}</div></div>}
    </div>
    <div hidden={section !== "items"} className="space-y-4">
     <OrderItemsTable items={order.items || []} showPreparation={["prepared", "dispatched", "received"].includes(status)} showShipment={["dispatched", "received"].includes(status)} />
    {!!order.allocations?.length && <section className="rounded-lg border bg-emerald-50/30 p-4"><h3 className="font-semibold">الحجوزات والكميات المرحلة</h3><div className="mt-2 space-y-2 text-sm">{order.allocations.map(allocation => <div key={allocation.id} className="flex flex-wrap justify-between gap-2 rounded bg-background px-3 py-2"><span>بند #{allocation.orderItemId} · {allocation.component === "original" ? "الصنف الأصلي" : "بديل"} · {allocation.status}</span><span>محجوز {allocation.reservedQuantity} · مشحون {allocation.dispatchedQuantity} · محرر {allocation.releasedQuantity} {allocation.unit}</span></div>)}</div></section>}
    <LinkedBatches batches={order.linkedBatches || []} orderId={order.id} kitchenAccessible={accessibleBranchIds.includes(order.centralKitchenId)} />
     {!!order.shadowInventoryEntries?.length && <section className="rounded-lg border border-dashed border-violet-300 bg-violet-50/40 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-semibold text-violet-950">سجل المخزون التجريبي</h3><p className="text-xs text-violet-700">للمراجعة فقط — لم تتغير أرصدة المخزون الفعلية.</p></div><Badge variant="outline" className="border-violet-300 text-violet-800">SHADOW</Badge></div><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="text-right">الحركة المتوقعة</TableHead><TableHead className="text-right">الصنف</TableHead><TableHead className="text-right">المصدر</TableHead><TableHead className="text-right">الكمية</TableHead><TableHead className="text-right">النوع</TableHead></TableRow></TableHeader><TableBody>{order.shadowInventoryEntries.map(entry => <TableRow key={entry.id}><TableCell>{entry.direction === "projected_kitchen_out" ? "خصم متوقع من المطبخ" : "إضافة متوقعة للفرع"}</TableCell><TableCell>{entry.productName}</TableCell><TableCell><CatalogSourceBadge source={identitySource(entry)} /></TableCell><TableCell>{entry.quantity} {entry.unit}</TableCell><TableCell>{entry.component === "substitute" ? "بديل" : "أصلي"}</TableCell></TableRow>)}</TableBody></Table></div></section>}
    </div>
    <div hidden={section !== "history"} className="space-y-4">
    <section><h3 className="mb-3 font-semibold">مسار الطلب</h3><div className="space-y-3 border-r-2 border-muted pr-4">{order.events?.length ? order.events.map(event => <div className="relative" key={event.id}><span className="absolute -right-[23px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" /><div className="flex flex-wrap items-center gap-2"><StatusBadge status={event.toStatus} /><span className="text-xs text-muted-foreground">{readableDate(event.createdAt)} · {new Date(event.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span></div>{event.notes && <p className="mt-1 text-sm text-muted-foreground">{event.notes}</p>}</div>) : <p className="text-sm text-muted-foreground">لم تُسجل تحديثات إضافية بعد.</p>}</div></section>
    </div>
    <div hidden={section !== "decisions"} className="space-y-4">
      {["received", "cancelled"].includes(status) && <DemandCommitments orderId={order.id} kitchenId={order.centralKitchenId} items={order.items || []} canConsent={canEdit} />}
     {action === "prepare" && allowAction
       ? <PreparationEditor orderId={order.id} inventoryMode={order.inventoryMode} items={order.items || []} products={products} productsQuery={productsQuery} actionNotes={actionNotes} setActionNotes={setActionNotes} pending={pending} onSubmit={items => onAction("prepare", { items })} />
      : action === "dispatch" && allowAction ? <DispatchEditor items={order.items || []} pending={pending} onSubmit={details => onAction("dispatch", details)} />
      : action === "receive" && allowAction ? <ReceiptEditor items={order.items || []} pending={pending} onSubmit={details => onAction("receive", details)} />
      : actionConfig && allowAction && <div className="rounded-lg border bg-muted/20 p-3"><Label htmlFor="action-note">ملاحظة (اختياري)</Label><Input id="action-note" className="mt-2" value={actionNotes} onChange={event => setActionNotes(event.target.value)} placeholder="أضف ملاحظة للفريق..." /><Button className="mt-3 w-full sm:w-auto" disabled={pending} onClick={() => { if (action) onAction(action); }}>{pending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <actionConfig.icon className="ml-2 h-4 w-4" />}{actionConfig.label}</Button></div>}
     {action && !allowAction && (action === "approve" || action === "receive") && <p className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">يمكنك عرض الطلب، لكن هذا الإجراء غير مسموح لك وفق التوجيه الحالي من الخادم.</p>}
     {!action && status === "received" && nextStep.isComplete && <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><Check className="h-4 w-4" />اكتمل مسار هذا الطلب وتم تأكيد الاستلام.</div>}
     {status === "received" && order.discrepancyStatus === "open" && canEdit && accessibleBranchIds.includes(order.requestBranchId) && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3"><div className="flex items-center gap-2 font-medium text-amber-900"><AlertTriangle className="h-4 w-4" />فروقات استلام مفتوحة</div><Input className="mt-3" value={actionNotes} onChange={event => setActionNotes(event.target.value)} placeholder="اكتب كيف تمت معالجة الناقص أو التالف" /><Button className="mt-3" disabled={pending || !actionNotes.trim()} onClick={() => onAction("resolve-discrepancy", { notes: actionNotes.trim() })}>إغلاق الفروقات بعد المعالجة</Button></div>}
    </div>
  </>;
}

function RequestChangeControls({ order }: { order: KitchenOrder }) {
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(order.neededDate || "");
  const [time, setTime] = useState(order.neededTime || "");
  const [notes, setNotes] = useState(order.notes || "");
  const [quantities, setQuantities] = useState((order.items || []).map(item => String(item.requestedQuantity)));
  const [reportedAvailable, setReportedAvailable] = useState((order.items || []).map(() => ""));
  const validEdit = !!date && !!order.items?.length && order.items.every((item, index) =>
    isValidKitchenQuantity(quantities[index] || "", item.productId != null)
    && isValidKitchenQuantity(reportedAvailable[index] || "", item.productId != null, true));
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const mutation = useMutation({
    mutationFn: async (edit: boolean) => {
      if (edit && !validEdit) throw new Error("أكمل تاريخ الحاجة والكميات المطلوبة والمتوفرة لكل صنف.");
      const payload = {
        expectedEventId: Math.max(0, ...(order.events || []).map(event => Number(event.id))),
        reason: reason.trim(),
        ...(edit ? { edit: { neededDate: date, neededTime: time || null, notes: notes || null,
          items: (order.items || []).map((item, index) => ({ itemId: Number(item.id), requestedQuantity: Number(quantities[index]), reportedAvailableQuantity: Number(reportedAvailable[index]) })) } } : {}),
      };
      const signature = JSON.stringify(payload);
      if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
      const response = await apiRequest("POST", `/api/central-kitchen-orders/${order.id}/request-change`, { ...payload, idempotencyKey: attempt.current.key });
      return response.json();
    },
    onSuccess: () => { void client.invalidateQueries({ predicate: query => String(query.queryKey[0]).includes("central-kitchen") }); },
  });
  if (order.status === "cancelled") return null;
  const committed = !!order.linkedBatches?.length || !!order.allocations?.length || !!order.shadowInventoryEntries?.length;
  if (committed || !["requested", "approved"].includes(order.status)) return <p className="rounded border p-3 text-sm text-muted-foreground">التعديل والإلغاء غير متاحين بعد الإنتاج أو الحجز أو التجهيز أو الإرسال. الدفعات المتعطلة لا تبرر عكس المخزون؛ راجع مسؤول المطبخ.</p>;
  return <section className="space-y-3 rounded-lg border p-4">
    <h3 className="font-semibold">تعديل / إلغاء من الفرع الطالب</h3>
    <p className="text-sm text-muted-foreground">يُحفظ السبب والتاريخ. يتحقق الخادم من عدم وجود إنتاج أو حجز قبل التنفيذ. تغيير الأصناف يتطلب إلغاء الطلب وإنشاء طلب جديد.</p>
    <Label>سبب التعديل أو الإلغاء (إلزامي)<Input value={reason} onChange={event => setReason(event.target.value)} disabled={mutation.isPending} /></Label>
    {editing && <div className="space-y-3">
      <Label>تاريخ الاحتياج<Input type="date" value={date} onChange={event => setDate(event.target.value)} /></Label>
      <Label>وقت الاحتياج<Input type="time" value={time} onChange={event => setTime(event.target.value)} /></Label>
      <Label>ملاحظات الطلب<Input value={notes} onChange={event => setNotes(event.target.value)} /></Label>
       {(order.items || []).map((item, index) => <div key={item.id} className="grid gap-3 rounded-md border bg-muted/10 p-3 md:grid-cols-2"><Label className="block">{item.productName} · {item.unit}<span className="mt-1 block text-xs font-normal text-muted-foreground">الكمية المطلوب توريدها</span><Input type="number" min={item.productId ? 1 : 0.000001} step={item.productId ? 1 : 0.000001} value={quantities[index]} onChange={event => setQuantities(values => values.map((value, i) => i === index ? event.target.value : value))} /></Label><Label className="block">المتوفر حالياً في الفرع <span className="text-destructive">*</span><span className="mt-1 block text-xs font-normal text-muted-foreground">أدخل المتوفر الآن؛ المسجل سابقاً: {item.reportedAvailableQuantity == null ? "غير مسجل" : `${item.reportedAvailableQuantity} ${item.unit}`}</span><Input type="number" min="0" step={item.productId ? 1 : 0.000001} value={reportedAvailable[index]} onChange={event => setReportedAvailable(values => values.map((value, i) => i === index ? event.target.value : value))} aria-invalid={!isValidKitchenQuantity(reportedAvailable[index] || "", item.productId != null, true)} /></Label></div>)}
    </div>}
    {mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error instanceof Error ? mutation.error.message : "تعذر حفظ الطلب"} — أعد تحميل التفاصيل عند تعارض النسخة.</p>}
    <div className="flex gap-2">
      {order.status === "requested" && <Button variant="outline" disabled={mutation.isPending || (editing && (!reason.trim() || !validEdit))} onClick={() => editing ? mutation.mutate(true) : setEditing(true)}>{editing ? "حفظ التعديل" : "تعديل الطلب"}</Button>}
      <Button variant="destructive" disabled={mutation.isPending || !reason.trim()} onClick={() => { if (window.confirm("إلغاء الطلب نهائياً مع حفظ السجل؟")) mutation.mutate(false); }}>إلغاء الطلب</Button>
    </div>
  </section>;
}

const SHORTAGE_LABELS: Record<string, string> = {
  unavailable: "غير متوفر",
  out_of_stock: "نفاد المخزون",
  production_issue: "تعذر الإنتاج",
  quality_issue: "مشكلة جودة",
  other: "سبب آخر",
};

function OrderItemsTable({ items, showPreparation, showShipment }: { items: KitchenItem[]; showPreparation: boolean; showShipment: boolean }) {
  const itemDetails = (item: KitchenItem) => {
    const substitute = Number(item.substituteQuantity || 0);
    const prepared = Number(item.preparedQuantity || 0);
    const shortage = Math.max(0, Number(item.requestedQuantity) - prepared - substitute);
    const notes = item.receivingNotes || item.preparationNotes || (shortage > 0 ? SHORTAGE_LABELS[item.shortageReason || ""] : item.notes) || "—";
    return { substitute, prepared, notes };
  };
  return <section><h3 className="mb-2 font-semibold">بنود الطلب <span className="text-sm font-normal text-muted-foreground">({items.length})</span></h3>
    <div className="space-y-3 md:hidden">{items.map((item, index) => {
      const { substitute, prepared, notes } = itemDetails(item);
      return <article key={item.id ?? `${item.productName}-${index}`} className="rounded-lg border bg-background p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div className="font-medium">{item.productName}</div><CatalogSourceBadge source={identitySource(item)} /></div>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">المطلوب</dt><dd className="mt-0.5 font-medium">{item.requestedQuantity} {item.unit}</dd></div>
          <div><dt className="text-xs text-muted-foreground">المتوفر في الفرع</dt><dd className="mt-0.5 font-medium">{item.reportedAvailableQuantity == null ? "غير مسجل" : `${item.reportedAvailableQuantity} ${item.unit}`}</dd></div>
          {showPreparation && <><div><dt className="text-xs text-muted-foreground">المجهز</dt><dd className="mt-0.5 font-medium">{prepared} {item.unit}<span className="mt-1 block text-xs font-normal text-muted-foreground"><SavedPreparationSummary item={item} /></span></dd></div><div><dt className="text-xs text-muted-foreground">البديل</dt><dd className="mt-0.5">{substitute > 0 ? <><div>{substitute} {item.unit} — {item.substituteProductName}</div><CatalogSourceBadge source={identitySource({ productId: item.substituteProductId, warehouseItemId: item.substituteWarehouseItemId })} /></> : "—"}</dd></div></>}
          {showShipment && <><div><dt className="text-xs text-muted-foreground">المرسل</dt><dd className="mt-0.5 font-medium">{item.dispatchedQuantity ?? "—"} {item.unit}</dd></div><div><dt className="text-xs text-muted-foreground">المستلم</dt><dd className="mt-0.5 font-medium">{item.receivedQuantity ?? "—"} {item.unit}</dd></div><div className="col-span-2"><dt className="text-xs text-muted-foreground">تالف / ناقص</dt><dd className="mt-0.5 font-medium">{Number(item.damagedQuantity || 0)} / {Number(item.missingQuantity || 0)} {item.unit}</dd></div></>}
        </dl>
        <div className="mt-3 border-t pt-2 text-sm"><div className="text-xs text-muted-foreground">ملاحظات</div><p className="mt-1 text-muted-foreground">{notes}</p></div>
      </article>;
    })}</div>
    <div className="hidden overflow-x-auto rounded-md border md:block"><Table><TableHeader className="bg-muted/40"><TableRow><TableHead className="text-right">الصنف</TableHead><TableHead className="text-right">المطلوب</TableHead><TableHead className="text-right">المتوفر في الفرع</TableHead>{showPreparation && <><TableHead className="text-right">المجهز</TableHead><TableHead className="text-right">البديل</TableHead></>}{showShipment && <><TableHead className="text-right">المرسل</TableHead><TableHead className="text-right">المستلم</TableHead><TableHead className="text-right">تالف/ناقص</TableHead></>}<TableHead className="text-right">ملاحظات</TableHead></TableRow></TableHeader><TableBody>{items.map((item, index) => {
    const substitute = Number(item.substituteQuantity || 0);
    const prepared = Number(item.preparedQuantity || 0);
    const shortage = Math.max(0, Number(item.requestedQuantity) - prepared - substitute);
      return <TableRow key={item.id ?? `${item.productName}-${index}`}><TableCell className="font-medium"><div>{item.productName}</div><CatalogSourceBadge source={identitySource(item)} /></TableCell><TableCell>{item.requestedQuantity} {item.unit}</TableCell><TableCell>{item.reportedAvailableQuantity == null ? <span className="text-muted-foreground">غير مسجل</span> : `${item.reportedAvailableQuantity} ${item.unit}`}</TableCell>{showPreparation && <><TableCell><div>{prepared} {item.unit}</div><div className="mt-1 text-xs font-normal text-muted-foreground"><SavedPreparationSummary item={item} /></div></TableCell><TableCell>{substitute > 0 ? <div><span>{substitute} {item.unit} — {item.substituteProductName}</span><CatalogSourceBadge source={identitySource({ productId: item.substituteProductId, warehouseItemId: item.substituteWarehouseItemId })} /></div> : "—"}</TableCell></>}{showShipment && <><TableCell>{item.dispatchedQuantity ?? "—"} {item.unit}</TableCell><TableCell>{item.receivedQuantity ?? "—"} {item.unit}</TableCell><TableCell>{Number(item.damagedQuantity || 0)} / {Number(item.missingQuantity || 0)} {item.unit}</TableCell></>}<TableCell className="text-muted-foreground">{item.receivingNotes || item.preparationNotes || (shortage > 0 ? SHORTAGE_LABELS[item.shortageReason || ""] : item.notes) || "—"}</TableCell></TableRow>;
   })}</TableBody></Table></div></section>;
}

function CatalogSourceBadge({ source }: { source: "product" | "warehouse" }) {
  return <Badge variant="outline" className="mt-1 text-[10px] font-normal">{sourceLabel(source)}</Badge>;
}

function DispatchEditor({ items, pending, onSubmit }: { items: KitchenItem[]; pending: boolean; onSubmit: (details: Record<string, unknown>) => void }) {
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [quantities, setQuantities] = useState(() => items.map(item => String(Number(item.preparedQuantity || 0) + Number(item.substituteQuantity || 0))));
  const invalid = !driverName.trim() || !vehicleNumber.trim() || quantities.some((value, index) => Number(value) < 0 || Number(value) > Number(items[index].preparedQuantity || 0) + Number(items[index].substituteQuantity || 0));
  return <section className="rounded-lg border border-orange-200 bg-orange-50/30 p-3 sm:p-4"><h3 className="font-semibold">بيانات الإرسال</h3><p className="mt-1 text-xs text-muted-foreground">أدخل السائق والمركبة أولاً، ثم أكد كمية كل بند بوحدته.</p><div className="mt-3 grid gap-3 md:grid-cols-2"><div><Label>اسم السائق</Label><Input className="mt-1 min-h-11" value={driverName} onChange={e => setDriverName(e.target.value)} /></div><div><Label>رقم المركبة</Label><Input className="mt-1 min-h-11" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} /></div></div><div className="mt-3 space-y-2">{items.map((item, index) => <div className="rounded-md border bg-background p-3" key={item.id}><Label htmlFor={`dispatch-${item.id}`} className="block text-sm">{item.productName}<span className="mt-1 block text-xs font-normal text-muted-foreground">الجاهز للتسليم: {Number(item.preparedQuantity || 0) + Number(item.substituteQuantity || 0)} {item.unit}</span></Label><Input id={`dispatch-${item.id}`} className="mt-2 min-h-11" aria-label={`الكمية المرسلة ${item.productName}`} type="number" min="0" step="any" value={quantities[index]} onChange={e => setQuantities(current => current.map((value, i) => i === index ? e.target.value : value))} /></div>)}</div><Button className="mt-4 min-h-11 w-full sm:w-auto" disabled={pending || invalid} onClick={() => onSubmit({ driverName: driverName.trim(), vehicleNumber: vehicleNumber.trim(), items: items.map((item, index) => ({ itemId: Number(item.id), dispatchedQuantity: Number(quantities[index]) })) })}><Truck className="ml-2 h-4 w-4" />تأكيد الإرسال</Button></section>;
}

function ReceiptEditor({ items, pending, onSubmit }: { items: KitchenItem[]; pending: boolean; onSubmit: (details: Record<string, unknown>) => void }) {
  const [rows, setRows] = useState(() => items.map(item => ({ received: String(item.dispatchedQuantity || 0), damaged: "0", notes: "" })));
  const update = (index: number, changes: Partial<(typeof rows)[number]>) => setRows(current => current.map((row, i) => i === index ? { ...row, ...changes } : row));
  const invalid = rows.some((row, index) => {
    const sent = Number(items[index].dispatchedQuantity || 0); const received = Number(row.received); const damaged = Number(row.damaged);
    return received < 0 || damaged < 0 || received + damaged > sent || ((received + damaged < sent || damaged > 0) && !row.notes.trim());
  });
  return <section className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3 sm:p-4"><h3 className="font-semibold">تسجيل الاستلام الفعلي</h3><p className="mt-1 text-xs text-muted-foreground">لكل بند: سجّل السليم والتالف. تظهر الملاحظة إلزامية عند وجود ناقص أو تالف.</p><div className="mt-3 space-y-3">{items.map((item, index) => { const sent = Number(item.dispatchedQuantity || 0); const missing = Math.max(0, sent - Number(rows[index].received || 0) - Number(rows[index].damaged || 0)); return <div className="rounded-md border bg-background p-3" key={item.id}><div className="mb-2 font-medium">{item.productName} — أرسل {sent} {item.unit}</div><div className="grid gap-2 md:grid-cols-3"><div><Label>المستلم السليم</Label><Input className="mt-1 min-h-11" type="number" min="0" step="any" value={rows[index].received} onChange={e => update(index, { received: e.target.value })} /></div><div><Label>التالف</Label><Input className="mt-1 min-h-11" type="number" min="0" step="any" value={rows[index].damaged} onChange={e => update(index, { damaged: e.target.value })} /></div><div><Label>الناقص: {missing}</Label><Input className="mt-1 min-h-11" value={rows[index].notes} onChange={e => update(index, { notes: e.target.value })} placeholder={missing > 0 || Number(rows[index].damaged) > 0 ? "الملاحظة مطلوبة" : "ملاحظة اختيارية"} /></div></div></div>; })}</div><Button className="mt-4 min-h-11 w-full sm:w-auto" disabled={pending || invalid} onClick={() => onSubmit({ items: items.map((item, index) => ({ itemId: Number(item.id), receivedQuantity: Number(rows[index].received), damagedQuantity: Number(rows[index].damaged), receivingNotes: rows[index].notes.trim() || undefined })) })}><Check className="ml-2 h-4 w-4" />تأكيد الاستلام</Button></section>;
}

function printPreparationNote(order: KitchenOrder): boolean {
  const escape = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character));
  const rows = (order.items || []).map(item => {
    const prepared = Number(item.preparedQuantity || 0);
    const substitute = Number(item.substituteQuantity || 0);
    const shortage = Math.max(0, Number(item.requestedQuantity) - prepared - substitute);
    const declaredAvailable = item.reportedAvailableQuantity == null ? "غير مسجل" : `${escape(item.reportedAvailableQuantity)} ${escape(item.unit)}`;
    return `<tr><td>${escape(item.productName)}</td><td>${escape(item.requestedQuantity)} ${escape(item.unit)}</td><td>${declaredAvailable}</td><td>${prepared} ${escape(item.unit)}</td><td>${substitute > 0 ? `${substitute} ${escape(item.substituteUnit || item.unit)} — ${escape(item.substituteProductName)}` : "—"}</td><td>${shortage} ${escape(item.unit)}</td><td>${escape(item.preparationNotes || SHORTAGE_LABELS[item.shortageReason || ""] || "")}</td></tr>`;
  }).join("");
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return false;
  printWindow.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>سند تجهيز ${escape(order.orderNumber)}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#172033}h1{font-size:22px;margin:0 0 8px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:22px 0}.box{border:1px solid #d8dee9;border-radius:8px;padding:10px}small{display:block;color:#687386;margin-bottom:4px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d8dee9;padding:9px;text-align:right;font-size:12px}th{background:#f3f5f8}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:80px;margin-top:60px}.line{border-top:1px solid #172033;padding-top:8px;text-align:center}@media print{body{padding:0}}</style></head><body><h1>سند تجهيز طلب المطبخ المركزي</h1><div>${escape(order.orderNumber)}</div><div class="meta"><div class="box"><small>الفرع الطالب</small>${escape(order.requestBranchName || order.requestBranchId)}</div><div class="box"><small>المطبخ المركزي</small>${escape(order.centralKitchenName || order.centralKitchenId)}</div><div class="box"><small>تاريخ الحاجة</small>${escape(order.neededDate)}</div></div><table><thead><tr><th>الصنف</th><th>المطلوب</th><th>المتوفر في الفرع</th><th>الأصلي المجهز</th><th>البديل</th><th>النقص</th><th>ملاحظات</th></tr></thead><tbody>${rows}</tbody></table><div class="signatures"><div class="line">مسؤول التجهيز</div><div class="line">مسؤول الإرسال</div></div><script>window.onload=()=>window.print()<\/script></body></html>`);
  printWindow.document.close();
  return true;
}
