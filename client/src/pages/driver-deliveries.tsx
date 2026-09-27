import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, CircleAlert, ClipboardList, Loader2, Plus, RefreshCw, Truck } from "lucide-react";
import { Layout } from "@/components/layout";
import { AccessDeniedPage } from "@/components/protected-route";
import { useAuth } from "@/hooks/useAuth";
import { canAccessDeliveryWorkspace } from "@shared/delivery-workspace-access";
import { PageHeader } from "@/components/dashboard/page-header";
import { DeliveryCard, DeliveryDetail, DeliveryItemLabel, canOpenDeliverySource, deliveryDate, deliveryDraftChanged, deliveryMatchesContext, deliverySourceLabel, deliverySourcePath, deliveryStatus, deliveryTransportLabel } from "@/components/delivery/delivery-ui";
import { SignatureCapture } from "@/components/delivery/signature-capture";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import type { DeliveryDTO, DeliverySource } from "@shared/delivery";

export type DeliveryStatus = "assigned" | "in_transit" | "awaiting_receipt" | "receipt_approved" | "completed" | "failed" | "cancelled";
export type Delivery = Omit<DeliveryDTO, "driverId" | "driverName" | "vehicleNumber" | "capabilities"> & {
  transportMode?: "internal" | "external";
  driverId: string | null;
  driverName: string | null;
  vehicleNumber: string | null;
  carrier?: "road" | "naqel" | "other" | null;
  carrierName?: string | null;
  waybill?: string | null;
  trackingUrl?: string | null;
  packageCount?: number | null;
  attachments?: Array<{ id: number; kind: "shipment_photo" | "carrier_receipt"; mimeType: string; originalName: string; downloadUrl: string }>;
  exceptionReason?: string | null;
  exceptionResolvedAt?: string | null;
  capabilities: DeliveryDTO["capabilities"] & { canResolveException?: boolean };
};
type Source = DeliverySource;
type Driver = { id: string; name: string; jobTitle: string };
type Report = { deliveries: Delivery[]; summary: Record<DeliveryStatus, number> & { total: number } };
type PortalCapabilities = { canAssign: boolean; canReport: boolean; canExport: boolean };
type Proof = { signatureData: string | null; receiverName: string | null; proofAt: string | null; receiptApprovedBy: string | null; receiptApprovedAt: string | null };

const fetchJson = async <T,>(path: string): Promise<T> => { const response = await fetch(path, { credentials: "include" }); if (!response.ok) throw new Error(`${response.status}: تعذر تحميل البيانات`); return response.json() as Promise<T>; };
const dateValue = (offset = 0) => { const value = new Date(); value.setDate(value.getDate() + offset); return value.toISOString().slice(0, 10); };

export default function DriverDeliveriesPage() {
  const { user } = useAuth();
  if (!canAccessDeliveryWorkspace(user)) {
    return <AccessDeniedPage message="مساحة مهام التوصيل المستقلة متاحة للسائق ومسؤول المستودع والمدير فقط" />;
  }
  return <Layout><DeliveryWorkspace /></Layout>;
}

export function DeliveryWorkspace({ embedded = false, sourceType, sourceId, deliveryId, onChanged }: { embedded?: boolean; sourceType?: Delivery["sourceType"]; sourceId?: number; deliveryId?: number | null; onChanged?: () => void }) {
  const { toast } = useToast(); const client = useQueryClient();
  const { canView } = usePermissions();
  const contextSource = sourceType && sourceId ? `${sourceType}:${sourceId}` : null;
  const hasAuthoritativeId = embedded && deliveryId != null;
  const validDeliveryId = deliveryId != null && Number.isSafeInteger(deliveryId) && deliveryId > 0;
   const [tab, setTab] = useState<"tasks" | "reports">("tasks"); const [status, setStatus] = useState<"active" | "all" | "completed" | "cancelled">("active");
   const [detail, setDetail] = useState<Delivery | null>(null); const [createOpen, setCreateOpen] = useState(false); const [assignOpen, setAssignOpen] = useState(false); const [assignmentMode, setAssignmentMode] = useState<"create" | "reassign">("create");
   const [form, setForm] = useState({ sourceKey: contextSource || (!embedded ? (() => { const p = new URLSearchParams(window.location.search); return p.has("sourceType") && p.has("sourceId") ? `${p.get("sourceType")}:${p.get("sourceId")}` : ""; })() : ""), transportMode: "internal" as "internal" | "external", driverId: "", vehicleNumber: "", scheduledAt: "", carrier: "" as "" | "road" | "naqel" | "other", carrierName: "", waybill: "", packageCount: "1", trackingUrl: "" });
  const [proof, setProof] = useState({ signatureData: null as string | null, hasInk: false, receiverName: "", notes: "" });
  const [editingProof, setEditingProof] = useState(false);
   const [failureReason, setFailureReason] = useState(""); const [failureOpen, setFailureOpen] = useState(false); const [cancelOpen, setCancelOpen] = useState(false); const [cancelReason, setCancelReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dispatchPending, setDispatchPending] = useState(false);
  const dispatchRef = useRef(false);
  const [resolution, setResolution] = useState("");
   const [clock, setClock] = useState(() => Date.now());
   const deepLinkConsumed = useRef(false);
   const sourceLinkConsumed = useRef(false);
  const selectionRef = useRef(0);
  const [range, setRange] = useState({ from: dateValue(-30), to: dateValue(), sourceBranchId: "all", destinationBranchId: "all", status: "all" });
  const pendingRef = useRef<string | null>(null);
   useEffect(() => {
     const timer = window.setInterval(() => setClock(Date.now()), 30_000);
     return () => window.clearInterval(timer);
   }, []);
   useEffect(() => {
     if (embedded || deepLinkConsumed.current) return;
     deepLinkConsumed.current = true;
     const raw = new URLSearchParams(window.location.search).get("deliveryId");
     if (!raw) return;
     const id = Number(raw);
     if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(id)) {
       toast({ title: "رابط مهمة توصيل غير صالح", variant: "destructive" });
       return;
     }
     const request = ++selectionRef.current;
     void fetchJson<Delivery>(`/api/deliveries/${id}`).then(result => {
       if (selectionRef.current === request) setDetail(result);
     }).catch(() => {
       toast({ title: "تعذر فتح المهمة", description: "المهمة غير موجودة أو لا تملك صلاحية الوصول إليها.", variant: "destructive" });
     });
   }, [toast, embedded]);
  const list = useQuery({ queryKey: ["/api/deliveries"], queryFn: () => fetchJson<{ deliveries: Delivery[] }>("/api/deliveries"), enabled: !hasAuthoritativeId });
  const authoritativeDetail = useQuery({
    queryKey: ["/api/deliveries", deliveryId, "workspace", contextSource],
    queryFn: () => fetchJson<Delivery>(`/api/deliveries/${deliveryId}`),
    enabled: hasAuthoritativeId && validDeliveryId,
    retry: false,
  });
  const authoritativeMismatch = hasAuthoritativeId && authoritativeDetail.isSuccess
    && !deliveryMatchesContext(authoritativeDetail.data, sourceType, sourceId, deliveryId);
   const portalCapabilities = useQuery({ queryKey: ["/api/deliveries/capabilities"], queryFn: () => fetchJson<PortalCapabilities>("/api/deliveries/capabilities"), staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true, refetchInterval: 30_000, retry: false });
   const canReport = portalCapabilities.isSuccess && !portalCapabilities.isFetching && portalCapabilities.data.canReport;
   const canAssign = portalCapabilities.isSuccess && !portalCapabilities.isFetching && portalCapabilities.data.canAssign;
  const sources = useQuery({ queryKey: ["/api/deliveries/sources", createOpen || assignOpen], queryFn: () => fetchJson<{ sources: Source[] }>("/api/deliveries/sources"), enabled: createOpen || assignOpen });
  const drivers = useQuery({ queryKey: ["/api/deliveries/drivers", createOpen || assignOpen], queryFn: () => fetchJson<{ drivers: Driver[] }>("/api/deliveries/drivers"), enabled: assignOpen || (createOpen && form.transportMode === "internal") });
  const reportUrl = `/api/deliveries/reports?${new URLSearchParams({ from: range.from, to: range.to, ...(range.sourceBranchId !== "all" ? { sourceBranchId: range.sourceBranchId } : {}), ...(range.destinationBranchId !== "all" ? { destinationBranchId: range.destinationBranchId } : {}), ...(range.status !== "all" ? { status: range.status } : {}) }).toString()}`;
   const reports = useQuery({ queryKey: [reportUrl], queryFn: () => fetchJson<Report>(reportUrl), enabled: !embedded && tab === "reports" && canReport });
   const proofQuery = useQuery({ queryKey: ["/api/deliveries", detail?.id, "proof", detail?.proofAt], queryFn: () => fetchJson<Proof>(`/api/deliveries/${detail!.id}/proof`), enabled: !!detail?.proofPresent, retry: false });
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ["/api/deliveries"] });
    void client.invalidateQueries({ predicate: query => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/central-kitchen-orders") });
    void client.invalidateQueries({ queryKey: ["/api/central-kitchen-order-journey"] });
    if (detail?.sourceType === "material_transfer" || detail?.sourceType === "reverse_movement") {
      void client.invalidateQueries({ queryKey: ["/api/warehouse/branch-stock"] });
      void client.invalidateQueries({ queryKey: ["/api/reverse-logistics/stock"] });
    }
    if (detail?.sourceType === "finished_goods_transfer") void client.invalidateQueries({ queryKey: ["/api/finished-goods-inventory"] });
    onChanged?.();
  };
  const successCopy = (endpoint: string | null) => {
    if (endpoint === "/api/deliveries") return "تم إسناد مهمة التوصيل";
    if (endpoint?.endsWith("/proof")) return "تم إرسال إثبات التسليم، بانتظار اعتماد المستلم المعتمد";
    if (endpoint?.endsWith("/approve-receipt")) return "تم اعتماد إيصال المصدر";
    if (endpoint?.endsWith("/complete")) return "تم إنهاء المهمة";
    if (endpoint?.endsWith("/start")) return "بدأت مهمة التوصيل";
    if (endpoint?.endsWith("/handover")) return "تم توثيق محضر التسليم";
    if (endpoint?.endsWith("/acknowledge-handover")) return "تم إقرار استلام الشحنة";
    if (endpoint?.endsWith("/reassign")) return "تمت إعادة إسناد المهمة";
    if (endpoint?.endsWith("/cancel")) return "تم إلغاء مهمة التوصيل دون إلغاء الشحنة";
    if (endpoint?.endsWith("/resolve-exception")) return "تم توثيق معالجة الاستثناء";
    return "تم تسجيل تعذر التسليم";
  };
   const action = useMutation({ mutationFn: async ({ endpoint, body }: { endpoint: string; body?: unknown }) => (await apiRequest("POST", endpoint, body)).json() as Promise<Delivery>, onSuccess: updated => { const endpoint = pendingRef.current; pendingRef.current = null; setActionError(null); if (endpoint === "/api/deliveries") setCreateOpen(false); if (endpoint?.endsWith("/reassign")) setAssignOpen(false); if (endpoint?.endsWith("/cancel")) setCancelOpen(false); if (endpoint?.endsWith("/fail")) setFailureOpen(false); if (endpoint?.endsWith("/resolve-exception")) setResolution(""); if (endpoint?.endsWith("/proof")) { setEditingProof(false); setProof({ signatureData: null, hasInk: false, receiverName: "", notes: "" }); } ++selectionRef.current; setDetail(updated); if (hasAuthoritativeId && updated.id === deliveryId) client.setQueryData(["/api/deliveries", deliveryId, "workspace", contextSource], updated); invalidate(); toast({ title: successCopy(endpoint) }); }, onError: error => { pendingRef.current = null; const message = error instanceof Error ? error.message : "أعد المحاولة، بيانات النموذج محفوظة."; setActionError(message); toast({ title: "لم يكتمل الإجراء", description: message, variant: "destructive" }); } });
  const submitAction = (endpoint: string, body?: unknown) => { if (pendingRef.current || action.isPending) return; ++selectionRef.current; setActionError(null); pendingRef.current = endpoint; action.mutate({ endpoint, body }); };
   const filtered = useMemo(() => (list.isError ? [] : list.data?.deliveries || []).filter(item => (!contextSource || `${item.sourceType}:${item.sourceId}` === contextSource) && (status === "active" ? !["completed", "failed", "cancelled"].includes(item.status) : status === "completed" || status === "cancelled" ? item.status === status : true)), [list.data, list.isError, status, contextSource]);
  const counts = useMemo(() => { const records = list.data?.deliveries || []; return { pickup: records.filter(x => x.status === "assigned").length, transit: records.filter(x => x.status === "in_transit").length, receipt: records.filter(x => x.status === "awaiting_receipt").length }; }, [list.data]);
  const selectedSource = (sources.data?.sources || []).find(source => `${source.sourceType}:${source.sourceId}` === form.sourceKey);
  const selectedDriver = (drivers.data?.drivers || []).find(driver => driver.id === form.driverId);
  const sendAssignment = () => {
    if (assignmentMode === "create" && form.transportMode === "external") {
      if (!selectedSource || !form.carrier || (form.carrier === "other" && !form.carrierName.trim()) || !form.waybill.trim() || !/^[1-9]\d*$/.test(form.packageCount) || (form.trackingUrl.trim() && !/^https:\/\/\S+$/i.test(form.trackingUrl.trim()))) {
        toast({ title: "أكمل الناقل ورقم البوليصة وعدد الطرود ورابط تتبع HTTPS صالح إن وجد", variant: "destructive" }); return;
      }
      submitAction("/api/deliveries", { sourceType: selectedSource.sourceType, sourceId: selectedSource.sourceId, transportMode: "external", carrier: form.carrier, ...(form.carrier === "other" ? { carrierName: form.carrierName.trim() } : {}), waybill: form.waybill.trim(), packageCount: Number(form.packageCount), ...(form.trackingUrl.trim() ? { trackingUrl: form.trackingUrl.trim() } : {}), ...(form.scheduledAt ? { scheduledAt: new Date(form.scheduledAt).toISOString() } : {}) }); return;
    }
    if (!form.driverId || !form.vehicleNumber.trim() || (assignmentMode === "create" && !selectedSource)) { toast({ title: "أكمل المصدر والسائق ورقم المركبة", variant: "destructive" }); return; }
    if (assignmentMode === "reassign" && detail) submitAction(`/api/deliveries/${detail.id}/reassign`, { driverId: form.driverId, vehicleNumber: form.vehicleNumber.trim() });
    else if (selectedSource) submitAction("/api/deliveries", { sourceType: selectedSource.sourceType, sourceId: selectedSource.sourceId, driverId: form.driverId, vehicleNumber: form.vehicleNumber.trim(), ...(form.scheduledAt ? { scheduledAt: new Date(form.scheduledAt).toISOString() } : {}) });
  };
  const exportCsv = () => { const records = reports.data?.deliveries || []; const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`; const rows = [["المصدر", "النوع", "السائق أو شركة الشحن والبوليصة", "المركبة", "المستلم", "الحالة", "موعد التسليم"], ...records.map(d => [d.sourceLabel, d.sourceType, deliveryTransportLabel(d), d.vehicleNumber, d.receiverName || "", deliveryStatus(d.status).label, deliveryDate(d.completedAt || d.scheduledAt)])]; const blob = new Blob(["\uFEFF" + rows.map(row => row.map(escape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `delivery-report-${range.from}-${range.to}.csv`; link.click(); URL.revokeObjectURL(url); };
   const clearTaskDrafts = () => { setEditingProof(false); setProof({ signatureData: null, hasInk: false, receiverName: "", notes: "" }); setFailureOpen(false); setFailureReason(""); setCancelOpen(false); setCancelReason(""); setAssignOpen(false); setActionError(null); setUploadError(null); setResolution(""); };
  const uploadEvidence = async (delivery: Delivery, kind: "shipment_photo" | "carrier_receipt", file?: File) => {
    if (!file || uploading || action.isPending) return;
    setUploadError(null);
    if (file.size > 10 * 1024 * 1024 || !(kind === "carrier_receipt" && file.type === "application/pdf" || ["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setUploadError("اختر صورة JPEG/PNG/WebP أو PDF للإيصال فقط، بحد أقصى 10 ميغابايت."); return;
    }
    setUploading(kind);
    try {
      const data = new FormData(); data.append("kind", kind); data.append("file", file);
      const response = await fetch(`/api/deliveries/${delivery.id}/attachments`, { method: "POST", credentials: "include", body: data });
      if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
      const updated = await fetchJson<Delivery>(`/api/deliveries/${delivery.id}`);
      setDetail(current => current?.id === delivery.id ? updated : current);
      invalidate();
      toast({ title: "تم حفظ المرفق في المهمة" });
    } catch (error) { setUploadError(error instanceof Error ? error.message : "تعذر رفع المرفق"); }
    finally { setUploading(null); }
  };
  const dispatchExternalMaterial = async (delivery: Delivery) => {
    if (dispatchRef.current || pendingRef.current || delivery.transportMode !== "external" || delivery.sourceType !== "material_transfer") return;
    dispatchRef.current = true;
    setDispatchPending(true);
    setActionError(null);
    const request = ++selectionRef.current;
    let dispatchAttempted = false;
    try {
      // Re-read the authoritative source before the stock-writing request. Never retry an
      // ambiguous PUT: a subsequent click observes the source status first instead.
      let fresh = await fetchJson<Delivery>(`/api/deliveries/${delivery.id}`);
      if (fresh.sourceType !== "material_transfer" || fresh.sourceId !== delivery.sourceId || fresh.transportMode !== "external")
        throw new Error("لم تعد المهمة مطابقة للتحويل. حدّث التفاصيل قبل الإرسال.");
      if (fresh.status !== "assigned" || !fresh.handoverRecordedAt)
        throw new Error("وثّق محضر الناقل أولاً أو حدّث المهمة إن شُحنت بالفعل.");
      if (fresh.sourceStatus === "approved") {
        dispatchAttempted = true;
        await apiRequest("PUT", `/api/warehouse/material-transfers/${fresh.sourceId}/status`, { status: "in_transit" });
        void client.invalidateQueries({ queryKey: ["/api/warehouse/material-transfers"] });
        fresh = await fetchJson<Delivery>(`/api/deliveries/${delivery.id}`);
      }
      if (fresh.sourceStatus !== "in_transit")
        throw new Error("لم يُؤكد إرسال التحويل من المصدر. حدّث المهمة قبل المحاولة مرة أخرى.");
      const updated = await (await apiRequest("POST", `/api/deliveries/${delivery.id}/start`)).json() as Delivery;
      if (selectionRef.current === request) setDetail(current => current?.id === delivery.id ? updated : current);
      invalidate();
      toast({ title: "تم إرسال الشحنة وبدأت متابعة الناقل" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر إكمال إرسال الشحنة.";
      // A timed-out dispatch may have committed. Refresh before offering another attempt;
      // the next click will only call /start when the source is already in transit.
      try {
        const latest = await fetchJson<Delivery>(`/api/deliveries/${delivery.id}`);
        if (selectionRef.current === request) setDetail(current => current?.id === delivery.id ? latest : current);
        void client.invalidateQueries({ queryKey: ["/api/warehouse/material-transfers"] });
        invalidate();
        if (latest.status === "awaiting_receipt" || latest.status === "receipt_approved" || latest.status === "completed") {
          setActionError(null);
          toast({ title: "الشحنة أُرسلت وبدأت متابعتها بالفعل" });
        } else {
          const dispatched = latest.sourceStatus === "in_transit";
          setActionError(`${message}${dispatched ? " الإرسال مسجل في المصدر؛ أعد المحاولة لبدء المتابعة فقط، ولا ترسل التحويل مرة ثانية." : dispatchAttempted ? " تحقق من حالة المصدر قبل المحاولة مجدداً." : ""}`);
        }
      } catch {
        setActionError(`${message} تعذر التحقق من حالة المصدر؛ حدّث المهمة قبل إعادة المحاولة ولا تكرر الإرسال دون تحقق.`);
      }
    } finally {
      dispatchRef.current = false;
      setDispatchPending(false);
    }
  };
   const openDetail = async (item: Delivery) => { if (pendingRef.current) return; const request = ++selectionRef.current; if (deliveryDraftChanged(detail, item)) clearTaskDrafts(); setDetail(item); try { const updated = await fetchJson<Delivery>(`/api/deliveries/${item.id}`); if (selectionRef.current === request) { if (deliveryDraftChanged(item, updated)) clearTaskDrafts(); setDetail(updated); } } catch { if (selectionRef.current === request) { setDetail(null); clearTaskDrafts(); toast({ title: "تعذر تحديث تفاصيل المهمة أو تم سحب صلاحية الوصول", variant: "destructive" }); } } };
   useEffect(() => {
     if (!detail) return;
     // A reassignment or a new proof invalidates drafts from the previous actor/receipt.
     clearTaskDrafts();
   }, [detail?.id, detail?.driverId, detail?.proofAt]);
  useEffect(() => {
    if (hasAuthoritativeId || !list.isError) return;
    ++selectionRef.current;
    setDetail(null);
  }, [hasAuthoritativeId, list.isError]);
  useEffect(() => {
    if (!contextSource) return;
    ++selectionRef.current;
    setDetail(null);
    setForm(value => ({ ...value, sourceKey: contextSource }));
    setCreateOpen(false);
  }, [contextSource, deliveryId]);
  useEffect(() => {
    if (!hasAuthoritativeId || !validDeliveryId || !authoritativeDetail.isSuccess) return;
    const found = authoritativeDetail.data;
    if (!deliveryMatchesContext(found, sourceType, sourceId, deliveryId)) {
      ++selectionRef.current;
      setDetail(null);
      return;
    }
    if (detail?.id !== found.id || detail.updatedAt !== found.updatedAt || detail.sourceStatus !== found.sourceStatus || detail.status !== found.status) {
      setProof({ signatureData: null, hasInk: false, receiverName: "", notes: "" });
      setEditingProof(false);
      setDetail(found);
    }
  }, [hasAuthoritativeId, validDeliveryId, authoritativeDetail.data, authoritativeDetail.isSuccess, deliveryId, contextSource]);
  useEffect(() => {
    if (!hasAuthoritativeId || !authoritativeDetail.isError) return;
    ++selectionRef.current;
    setDetail(null);
  }, [hasAuthoritativeId, authoritativeDetail.isError]);
  useEffect(() => {
    if (!embedded || hasAuthoritativeId || !contextSource || !list.isSuccess) return;
    const match = list.data.deliveries.find(item => `${item.sourceType}:${item.sourceId}` === contextSource);
    if (match && detail?.id !== match.id) void openDetail(match);
    if (!match && detail && `${detail.sourceType}:${detail.sourceId}` === contextSource) setDetail(null);
  }, [embedded, hasAuthoritativeId, contextSource, list.data, list.isSuccess]);
  useEffect(() => {
    if (embedded || sourceLinkConsumed.current || !list.isSuccess) return;
    sourceLinkConsumed.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.has("deliveryId") || !params.has("sourceType") || !params.has("sourceId")) return;
    const source = `${params.get("sourceType")}:${params.get("sourceId")}`;
    const match = list.data.deliveries.find(item => `${item.sourceType}:${item.sourceId}` === source);
    if (match) void openDetail(match);
  }, [embedded, list.data, list.isSuccess]);
   useEffect(() => {
      if (!detail || !["assigned", "in_transit", "awaiting_receipt", "receipt_approved"].includes(detail.status)) return;
     const id = detail.id;
     const refresh = () => {
       if (document.hidden) return;
       const request = selectionRef.current;
       void fetchJson<Delivery>(`/api/deliveries/${id}`).then(updated =>
         setDetail(current => current?.id === id && selectionRef.current === request && !pendingRef.current ? updated : current)).catch(() => {
           if (selectionRef.current !== request) return;
           toast({ title: "تعذر تحديث المهمة", description: "قد تكون المهمة غير متاحة أو سُحبت صلاحيتك.", variant: "destructive" });
           setDetail(current => current?.id === id ? null : current);
           void client.removeQueries({ queryKey: ["/api/deliveries", id, "proof"] });
         });
     };
     const focusRefresh = () => {
       void client.invalidateQueries({ queryKey: ["/api/deliveries"], exact: true });
       refresh();
     };
     document.addEventListener("visibilitychange", refresh);
     window.addEventListener("focus", focusRefresh);
     const timer = window.setInterval(refresh, 30_000);
     return () => { document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", focusRefresh); window.clearInterval(timer); };
   }, [detail?.id, detail?.status, toast, client]);
  return <main className={embedded ? "space-y-4" : "mx-auto min-h-[100dvh] max-w-6xl space-y-5 px-4 pb-10 pt-5 md:px-7"} dir="rtl">
    {!embedded && <PageHeader title="بوابة التوصيل" description="التوصيل الداخلي والشحن الخارجي من المصدر نفسه، ثم الاستلام والاعتماد." />}
    {embedded && <h2 className="text-lg font-bold">توصيل الطلب</h2>}
     <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">{!embedded && <Tabs value={tab === "reports" && canReport ? "reports" : "tasks"} onValueChange={value => setTab(value as "tasks" | "reports")}><TabsList className="h-12"><TabsTrigger value="tasks" className="min-h-10 gap-2"><Truck className="h-4 w-4" />المهام</TabsTrigger>{canReport && <TabsTrigger value="reports" className="min-h-10 gap-2"><BarChart3 className="h-4 w-4" />التقارير</TabsTrigger>}</TabsList></Tabs>}{canAssign && (!embedded || (!hasAuthoritativeId && list.isSuccess && !list.data.deliveries.some(item => `${item.sourceType}:${item.sourceId}` === contextSource))) && <Button className="min-h-12 gap-2" disabled={action.isPending} onClick={() => { setAssignmentMode("create"); setForm(value => ({ ...value, sourceKey: contextSource || value.sourceKey })); setCreateOpen(true); }}><Plus className="h-5 w-5" />إسناد توصيل</Button>}</div>
      {tab !== "reports" || !canReport ? <>{!embedded && <section className="grid grid-cols-3 gap-2 md:gap-4">{[["pickup", "بانتظار البدء", counts.pickup], ["transit", "في الطريق", counts.transit], ["receipt", "بانتظار الإيصال", counts.receipt]].map(([key, label, count]) => <Card key={String(key)} className="border-primary/15"><CardContent className="p-3 md:p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold text-primary">{count}</p></CardContent></Card>)}</section>}{!embedded && <div className="flex flex-wrap items-center justify-between gap-3"><Tabs value={status} onValueChange={value => setStatus(value as typeof status)}><TabsList><TabsTrigger value="active">النشطة</TabsTrigger><TabsTrigger value="all">الكل</TabsTrigger><TabsTrigger value="completed">المكتملة</TabsTrigger><TabsTrigger value="cancelled">الملغاة</TabsTrigger></TabsList></Tabs><Button variant="ghost" className="min-h-11 gap-2" onClick={() => list.refetch()}><RefreshCw className="h-4 w-4" />تحديث</Button></div>}
       {hasAuthoritativeId ? (!validDeliveryId ? <State icon={<CircleAlert />} title="معرّف مهمة التوصيل غير صالح" /> : authoritativeDetail.isError ? <State icon={<CircleAlert />} title="تعذر فتح مهمة التوصيل أو سُحبت صلاحية الوصول" action={() => authoritativeDetail.refetch()} /> : authoritativeMismatch ? <State icon={<CircleAlert />} title="مهمة التوصيل لا تتبع هذا الطلب" /> : !authoritativeDetail.isSuccess || !detail || detail.id !== deliveryId ? <Skeleton className="h-40 w-full" /> : null) : list.isLoading ? <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full" />)}</div> : list.isError ? <State icon={<CircleAlert />} title="تعذر تحميل مهام التوصيل" action={() => list.refetch()} /> : embedded && detail ? null : filtered.length === 0 ? <State icon={<ClipboardList />} title={embedded ? "لا توجد مهمة توصيل لهذا الطلب" : "لا توجد مهام ضمن هذا العرض"} text={embedded ? "يمكن إسناد مهمة عندما يصبح المصدر مؤهلاً وتتوفر الصلاحية." : "ستظهر المهام المسندة لك أو ضمن نطاق إدارتك هنا."} /> : <div className="grid gap-3 lg:grid-cols-2">{filtered.map(item => <DeliveryCard key={item.id} delivery={item} now={clock} onOpen={() => void openDetail(item)} />)}</div>}
     </> : <Reports range={range} setRange={setRange} reports={reports.isSuccess && !reports.isFetching ? reports.data : undefined} loading={reports.isLoading || reports.isFetching} error={reports.isError} onRetry={() => void reports.refetch()} canExport={portalCapabilities.data.canExport} knownDeliveries={list.data?.deliveries || []} onExport={exportCsv} />}
     <AssignmentDialog embedded={embedded} open={canAssign && (createOpen || assignOpen)} onOpenChange={open => { if (action.isPending) return; if (!open) { setCreateOpen(false); setAssignOpen(false); } }} mode={assignmentMode} sources={sources.data?.sources || []} drivers={drivers.data?.drivers || []} loading={assignmentMode === "create" ? sources.isLoading || (form.transportMode === "internal" && drivers.isLoading) : drivers.isLoading} error={(assignmentMode === "create" && sources.isError) || ((assignmentMode === "reassign" || form.transportMode === "internal") && drivers.isError)} actionError={actionError} form={form} setForm={setForm} selectedSource={selectedSource} selectedDriver={selectedDriver} onSubmit={sendAssignment} pending={action.isPending} />
      {detail && (!embedded || (!authoritativeMismatch && !authoritativeDetail.isError && (!hasAuthoritativeId || authoritativeDetail.isSuccess && validDeliveryId) && deliveryMatchesContext(detail, sourceType, sourceId, hasAuthoritativeId ? deliveryId : undefined))) && (embedded ? <section className="space-y-4 rounded-xl border bg-card p-4" aria-label="تفاصيل التوصيل">{renderDetail()}</section> : <Dialog open={!!detail} onOpenChange={open => { if (!open && !action.isPending) { ++selectionRef.current; setDetail(null); setProof({ signatureData: null, hasInk: false, receiverName: "", notes: "" }); } }}><DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-3xl" dir="rtl">{renderDetail()}</DialogContent></Dialog>)}
  </main>;

  function renderDetail() {
    if (!detail) return null;
    return <>{embedded ? <header className="space-y-1"><h3 className="flex items-center justify-between gap-2 font-semibold"><span>{detail.sourceLabel}</span><Badge variant="outline" className={deliveryStatus(detail.status).className}>{deliveryStatus(detail.status).label}</Badge></h3><p className="text-sm text-muted-foreground">تفاصيل المهمة من المصدر المعتمد.</p></header> : <DialogHeader><DialogTitle className="flex items-center justify-between gap-2"><span>{detail.sourceLabel}</span><Badge variant="outline" className={deliveryStatus(detail.status).className}>{deliveryStatus(detail.status).label}</Badge></DialogTitle><DialogDescription>تفاصيل المهمة من المصدر المعتمد.</DialogDescription></DialogHeader>}<div className="space-y-4">
       {detail.transportMode === "external" ? <section className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
         <h3 className="font-bold">{detail.status === "completed" ? "اكتملت الشحنة واعتمد استلامها" : detail.status === "cancelled" ? "الشحنة ملغاة" : "الخطوة التالية · شحن خارجي"}</h3>
         {detail.exceptionReason && !detail.exceptionResolvedAt && <div role="alert" className="space-y-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-rose-900"><p>استثناء مفتوح: {detail.exceptionReason}. يمنع إغلاق الشحنة حتى المعالجة.</p>{detail.capabilities.canResolveException && <><Label htmlFor="resolution">كيفية معالجة الاستثناء</Label><Textarea id="resolution" value={resolution} onChange={e => setResolution(e.target.value)} /><Button disabled={!resolution.trim() || action.isPending} onClick={() => submitAction(`/api/deliveries/${detail.id}/resolve-exception`, { resolution: resolution.trim() })}>توثيق المعالجة</Button></>}</div>}
         {detail.exceptionReason && detail.exceptionResolvedAt && <p className="text-emerald-800">تمت معالجة الاستثناء: {detail.exceptionReason}</p>}
         {detail.status === "assigned" && <>
           <p>{detail.sourceType === "material_transfer" ? "ارفع صورة الشحنة وإيصال الناقل ثم وثّق محضر البنود؛ بعد ذلك أرسل التحويل وابدأ متابعة الناقل من هنا بزر واحد." : "١. ارفع صورة الشحنة وإيصال الناقل، ثم وثّق محضر تسليم البنود. ٢. نفّذ إرسال الشحنة من المصدر الأصلي. ٣. ابدأ المتابعة بعد خروج الشحنة."}</p>
           <div className="grid gap-3 sm:grid-cols-2">{(["shipment_photo", "carrier_receipt"] as const).map(kind => <div key={kind} className="space-y-2 rounded-lg border bg-background p-3"><Label htmlFor={`${kind}-${detail.id}`}>{kind === "shipment_photo" ? "صورة الشحنة" : "إيصال الناقل (صورة أو PDF)"}</Label>{canAssign && !detail.handoverRecordedAt && <Input id={`${kind}-${detail.id}`} type="file" accept={kind === "carrier_receipt" ? "image/jpeg,image/png,image/webp,application/pdf" : "image/jpeg,image/png,image/webp"} disabled={!!uploading || action.isPending} onChange={event => { const file = event.target.files?.[0]; void uploadEvidence(detail, kind, file); event.target.value = ""; }} />}{uploading === kind && <p role="status">جارٍ رفع المرفق…</p>}{detail.attachments?.filter(file => file.kind === kind).map(file => <div key={file.id} className="space-y-1"><a href={file.downloadUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">{file.originalName}</a>{file.mimeType.startsWith("image/") && <img className="max-h-32 max-w-full rounded border object-contain" src={file.downloadUrl} alt={kind === "shipment_photo" ? "معاينة صورة الشحنة" : "معاينة إيصال الناقل"} />}</div>)}</div>)}</div>
           {uploadError && <p role="alert" className="text-destructive">تعذر رفع المرفق: {uploadError}</p>}
           {detail.sourceType === "material_transfer" && detail.handoverRecordedAt && (detail.sourceStatus === "approved" || detail.sourceStatus === "in_transit") && canAssign && <Button className="min-h-12 w-full" disabled={dispatchPending || action.isPending} onClick={() => void dispatchExternalMaterial(detail)}>{dispatchPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}{detail.sourceStatus === "in_transit" ? "متابعة الشحنة بعد الإرسال" : "إرسال الشحنة وبدء المتابعة"}</Button>}
           {detail.handoverRecordedAt && detail.sourceType !== "material_transfer" && <p className="rounded-lg border border-sky-200 bg-sky-50 p-3">المحضر موثق. {canOpenDeliverySource(detail.sourceType, canView) ? <a className="font-bold underline" href={deliverySourcePath(detail)} target="_blank" rel="noopener noreferrer">افتح إجراء الإرسال من المصدر الأصلي</a> : "بانتظار مسؤول المصدر لتنفيذ الإرسال."}</p>}
         </>}
         {detail.capabilities.canStart && detail.sourceType !== "material_transfer" && <Button className="min-h-12 w-full" disabled={action.isPending} onClick={() => submitAction(`/api/deliveries/${detail.id}/start`)}>تأكيد خروج الشحنة وبدء متابعة الناقل</Button>}
         {detail.status === "in_transit" && <p>بانتظار الاستلام الفعلي المستقل في الفرع. رقم البوليصة لا يُعد إثبات استلام. {detail.sourceType !== "material_transfer" && canOpenDeliverySource(detail.sourceType, canView) && <a className="font-bold underline" href={deliverySourcePath(detail)}>فتح المصدر لتسجيل الاستلام</a>}</p>}
         {detail.capabilities.canApproveReceipt && <Button className="min-h-12 w-full" disabled={action.isPending} onClick={() => submitAction(`/api/deliveries/${detail.id}/approve-receipt`)}>اعتماد استلام الفرع المسجل في المصدر</Button>}
         {detail.status === "awaiting_receipt" && !detail.capabilities.canApproveReceipt && <p>بانتظار المستلم المخوّل لتسجيل الاستلام في المصدر واعتماد الإيصال.</p>}
         {detail.capabilities.canComplete && <Button className="min-h-12 w-full" disabled={action.isPending || !!(detail.exceptionReason && !detail.exceptionResolvedAt)} onClick={() => submitAction(`/api/deliveries/${detail.id}/complete`)}>إغلاق الشحنة بعد اعتماد الاستلام</Button>}
         {detail.status === "receipt_approved" && !detail.capabilities.canComplete && <p>تم اعتماد الاستلام، بانتظار مسؤول المصدر لإغلاق الشحنة.</p>}
       </section> : <DeliveryActionBar delivery={detail} pending={action.isPending} onAction={submitAction} />}
       {detail.transportMode !== "external" && detail.status === "awaiting_receipt" && detail.proofPresent && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">تم إرسال إثبات التسليم. بانتظار تسجيل الاستلام من المصدر واعتماد الإيصال من المستلم المعتمد. {!embedded && canOpenDeliverySource(detail.sourceType, canView) && <a className="font-semibold underline" href={deliverySourcePath(detail)} target="_blank" rel="noopener noreferrer">فتح استلام المصدر</a>}</div>}
      {detail.capabilities.canSubmitProof && detail.proofPresent && !editingProof && <Button variant="outline" className="min-h-11" disabled={action.isPending} onClick={() => setEditingProof(true)}>تعديل الإثبات</Button>}
       {detail.capabilities.canSubmitProof && (!detail.proofPresent || editingProof) && <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4"><h3 className="font-bold">{detail.proofPresent ? "تعديل إثبات التسليم" : "إثبات التسليم"}</h3><Label htmlFor="receiver">اسم المستلم</Label><Input id="receiver" className="min-h-12" value={proof.receiverName} onChange={e => setProof(p => ({ ...p, receiverName: e.target.value }))} placeholder="اكتب اسم المستلم" /><p className="text-xs text-muted-foreground">إدخال الاسم يوثق التسليم فقط ولا يعني التحقق من هوية المستلم.</p><SignatureCapture key={`${detail.id}:${detail.driverId}:${detail.proofAt || "new"}:${editingProof}`} disabled={action.isPending} onChange={(signatureData, hasInk) => setProof(p => ({ ...p, signatureData, hasInk }))} /><Label htmlFor="notes">ملاحظات (اختياري)</Label><Textarea id="notes" value={proof.notes} onChange={e => setProof(p => ({ ...p, notes: e.target.value }))} /><Button className="min-h-12 w-full" disabled={!proof.hasInk || !proof.receiverName.trim() || action.isPending} onClick={() => submitAction(`/api/deliveries/${detail.id}/proof`, { signatureData: proof.signatureData, receiverName: proof.receiverName.trim(), notes: proof.notes.trim() || undefined })}>{detail.proofPresent ? "حفظ تعديل الإثبات" : "إرسال إثبات التسليم"}</Button></div>}
      {actionError && <div role="alert" className="rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">لم يكتمل الإجراء: {actionError} بيانات النموذج ما زالت محفوظة ويمكنك إعادة المحاولة.</div>}
       <details className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">بنود الشحنة والإثبات وسجل المهمة</summary><div className="mt-4">{detail.proofPresent && proofQuery.isError && <p role="alert" className="mb-3 text-destructive">تعذر تحميل دليل التوقيع. <Button variant="outline" onClick={() => void proofQuery.refetch()}>إعادة المحاولة</Button></p>}<DeliveryDetail delivery={detail} canOpenSource={canOpenDeliverySource(detail.sourceType, canView)} now={clock} proof={proofQuery.isSuccess && proofQuery.data.proofAt === detail.proofAt ? proofQuery.data : undefined} /></div></details>
       {(detail.capabilities.canRecordHandover || detail.capabilities.canAcknowledgeHandover || !!detail.handoverItems || detail.handoverInvalidated) && <details className="rounded-xl border p-3" open={detail.capabilities.canRecordHandover || detail.capabilities.canAcknowledgeHandover ? true : undefined}><summary className="cursor-pointer font-semibold">{detail.transportMode === "external" ? "محضر تسليم الشحنة للناقل" : "محضر تسليم الشحنة للسائق"}</summary><div className="mt-3"><HandoverSection key={`${detail.id}:${detail.handoverRecordedAt || "new"}:${detail.driverId}`} delivery={detail} pending={action.isPending} onAction={submitAction} canOpenSource={canOpenDeliverySource(detail.sourceType, canView)} /></div></details>}
        <div className="flex flex-wrap gap-2">{detail.capabilities.canReassign && detail.transportMode !== "external" && <Button variant="outline" className="min-h-12" disabled={action.isPending} onClick={() => { setActionError(null); setAssignmentMode("reassign"); setForm(value => ({ ...value, sourceKey: "", driverId: "", vehicleNumber: detail.vehicleNumber || "", scheduledAt: "" })); setAssignOpen(true); }}>إعادة إسناد</Button>}{detail.capabilities.canFail && (detail.transportMode === "external" ? <div className="w-full space-y-2 rounded-lg border p-3"><Label htmlFor="carrier-exception">مشكلة في الشحنة أو الناقل</Label><Textarea id="carrier-exception" value={failureReason} onChange={e => setFailureReason(e.target.value)} placeholder="اشرح سبب التعذر" /><Button variant="destructive" disabled={!failureReason.trim() || action.isPending} onClick={() => submitAction(`/api/deliveries/${detail.id}/fail`, { reason: failureReason.trim() })}>تسجيل الاستثناء</Button></div> : <Button variant="destructive" className="min-h-12" disabled={action.isPending} onClick={() => setFailureOpen(true)}>تعذر التسليم</Button>)}{detail.capabilities.canCancel && <Button variant="outline" disabled={action.isPending} onClick={() => setCancelOpen(true)}>إلغاء مهمة التوصيل</Button>}{["assigned", "in_transit", "awaiting_receipt", "receipt_approved"].includes(detail.status) && <Button variant="outline" disabled={action.isPending} onClick={() => void openDetail(detail)}>تحديث حالة المصدر والمهمة</Button>}</div>
       <Dialog open={cancelOpen} onOpenChange={open => { if (!action.isPending) setCancelOpen(open); }}><DialogContent><DialogHeader><DialogTitle>إلغاء مهمة التوصيل فقط</DialogTitle><DialogDescription>الشحنة الأصلية والمخزون لا يتغيران. يمكن إعادة الإسناد قبل الاستلام الفعلي.</DialogDescription></DialogHeader><Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="سبب الإلغاء" /><Button variant="destructive" disabled={cancelReason.trim().length < 3 || action.isPending} onClick={() => submitAction(`/api/deliveries/${detail.id}/cancel`, { reason: cancelReason.trim() })}>تأكيد إلغاء المهمة دون إلغاء الشحنة</Button></DialogContent></Dialog>
       <Dialog open={failureOpen} onOpenChange={open => { if (!action.isPending) setFailureOpen(open); }}><DialogContent><DialogHeader><DialogTitle>تسجيل تعذر التسليم</DialogTitle><DialogDescription>سجّل سببًا واضحًا قبل إرسال الحالة.</DialogDescription></DialogHeader><Textarea value={failureReason} onChange={e => setFailureReason(e.target.value)} placeholder="سبب التعذر" /><Button variant="destructive" className="min-h-12" disabled={!failureReason.trim() || action.isPending} onClick={() => submitAction(`/api/deliveries/${detail.id}/fail`, { reason: failureReason.trim() })}>تأكيد التعذر</Button></DialogContent></Dialog></div></>;
  }
}

export function DeliveryActionBar({ delivery, pending, onAction }: { delivery: Delivery; pending: boolean; onAction: (endpoint: string) => void }) {
  const { canStart, canApproveReceipt, canComplete } = delivery.capabilities;
  if (!canStart && !canApproveReceipt && !canComplete) return null;
  return <div className="flex flex-wrap gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
    {canStart && <Button className="min-h-12" disabled={pending} onClick={() => onAction(`/api/deliveries/${delivery.id}/start`)}>بدء التوصيل</Button>}
    {canApproveReceipt && <Button className="min-h-12" disabled={pending} onClick={() => onAction(`/api/deliveries/${delivery.id}/approve-receipt`)}>اعتماد إيصال المصدر</Button>}
    {canComplete && <Button className="min-h-12" disabled={pending} onClick={() => onAction(`/api/deliveries/${delivery.id}/complete`)}>إنهاء المهمة</Button>}
  </div>;
}

function HandoverSection({ delivery, pending, onAction, canOpenSource }: { delivery: Delivery; pending: boolean; onAction: (endpoint: string, body?: unknown) => void; canOpenSource: boolean }) {
  const external = delivery.transportMode === "external";
  const [quantities, setQuantities] = useState<Record<number, string>>(() => Object.fromEntries(delivery.items.map(item => [item.id, String(item.quantity)])));
  const [confirmed, setConfirmed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const snapshot = delivery.handoverItems;
  const lines = delivery.items.map(item => ({ id: item.id, quantity: Number(quantities[item.id]) }));
  const validLines = lines.length > 0 && lines.some(line => line.quantity > 0) && lines.every((line, index) =>
    quantities[line.id]?.trim() !== "" && Number.isFinite(line.quantity) && line.quantity >= 0
    && line.quantity <= delivery.items[index].quantity
    && (delivery.sourceType === "kitchen" || line.quantity === delivery.items[index].quantity));
  const awaitingDispatch = !["dispatched", "in_transit", "received", "delivered", "inspected"].includes(delivery.sourceStatus);
  if (!delivery.capabilities.canRecordHandover && !delivery.capabilities.canAcknowledgeHandover && !snapshot && !delivery.handoverInvalidated) return null;
  return <section className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{external ? "محضر تسليم الشحنة للناقل" : "محضر تسليم الشحنة للسائق"}</h3>{delivery.handoverRecordedAt && <Badge variant="outline" className={external || delivery.handoverAcknowledgedAt ? "border-emerald-300 text-emerald-800" : "border-amber-300 text-amber-900"}>{external ? "تم توثيق المحضر" : delivery.handoverAcknowledgedAt ? "أقر السائق بالاستلام" : "بانتظار إقرار السائق"}</Badge>}</div>
    {delivery.handoverInvalidated && <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 font-medium text-amber-950">المحضر السابق وإقرار السائق السابق ملغيان بعد إعادة الإسناد. يلزم توثيق محضر جديد وإقرار السائق الحالي قبل بدء المهمة. {awaitingDispatch ? "شحن المصدر ينتظر إقرار السائق." : "المصدر شُحن بالفعل ولا يلزم إعادة صرف المخزون."}</div>}
    {delivery.capabilities.canRecordHandover && <p className="text-muted-foreground">راجع الكميات التي ستُسلّم فعلياً إلى {external ? `${delivery.carrierName || (delivery.carrier === "road" ? "رود للوجيستك" : "ناقل")}، بوليصة ${delivery.waybill}` : `${delivery.driverName} بالمركبة ${delivery.vehicleNumber}`}. {awaitingDispatch ? external ? "هذا المحضر لا يرحّل المخزون؛ الإرسال يتم من المصدر بعد توثيق المحضر." : "هذا المحضر لا يرحّل المخزون؛ الصرف يتم من إجراء المصدر بعد إقرار السائق." : "المصدر شُحن بالفعل؛ توثيق المحضر الجديد لا يعيد صرف المخزون."}</p>}
    {snapshot && <div className="rounded-lg border bg-background p-3"><p className="font-medium">{external ? `النسخة المسجلة للناقل ${delivery.carrierName || (delivery.carrier === "road" ? "رود للوجيستك" : "ناقل")}` : `النسخة المسجلة للسائق ${delivery.driverName} · المركبة ${delivery.vehicleNumber}`}</p><p className="text-xs text-muted-foreground">وثّق مسؤول المصدر المحضر: {deliveryDate(delivery.handoverRecordedAt)}{delivery.handoverAcknowledgedAt ? ` · أقر السائق: ${deliveryDate(delivery.handoverAcknowledgedAt)}` : ""}</p><ul className="mt-2 list-inside list-disc">{snapshot.map(item => <li key={item.id}><DeliveryItemLabel item={item} /> · الكمية المسلمة: {item.quantity} {item.unit || ""}</li>)}</ul></div>}
    {delivery.capabilities.canRecordHandover && <div className="space-y-3"><p className="font-medium">{snapshot && !external ? "تعديل المحضر يلغي إقرار السائق السابق ويتطلب إقراراً جديداً." : "بنود المحضر للمراجعة قبل تسجيله:"}</p>{delivery.items.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2"><Label htmlFor={`handover-${delivery.id}-${item.id}`}><DeliveryItemLabel item={item} /> · الحد المتاح {item.quantity} {item.unit || ""}</Label><Input id={`handover-${delivery.id}-${item.id}`} type="number" min="0" max={item.quantity} step="any" inputMode="decimal" className="w-32" value={quantities[item.id] ?? ""} readOnly={delivery.sourceType !== "kitchen"} onChange={e => setQuantities(value => ({ ...value, [item.id]: e.target.value }))} /></div>)}<label className="flex items-start gap-2"><Checkbox checked={confirmed} onCheckedChange={value => setConfirmed(value === true)} /><span>أؤكد بصفتي مسؤول المصدر مطابقة الأصناف والكميات و{external ? "الناقل والبوليصة" : "السائق والمركبة"} أعلاه مع ما سُلّم فعلياً.</span></label><Button className="min-h-12 w-full" disabled={!validLines || !confirmed || pending || (external && (!delivery.attachments?.some(file => file.kind === "shipment_photo") || !delivery.attachments?.some(file => file.kind === "carrier_receipt")))} onClick={() => onAction(`/api/deliveries/${delivery.id}/handover`, { items: lines })}>توثيق محضر تسليم الشحنة {external ? "للناقل" : "للسائق"}</Button>{external && (!delivery.attachments?.some(file => file.kind === "shipment_photo") || !delivery.attachments?.some(file => file.kind === "carrier_receipt")) && <p className="text-amber-900">صورة الشحنة وإيصال الناقل مطلوبان قبل توثيق المحضر.</p>}</div>}
    {delivery.capabilities.canAcknowledgeHandover && snapshot && <div className="space-y-3 border-t pt-3"><p>راجع النسخة المسجلة أعلاه. هذا إقرار باستلام الشحنة من مسؤول المصدر، وليس توقيع المستلم النهائي أو ترحيلاً للمخزون.</p><label className="flex items-start gap-2"><Checkbox checked={acknowledged} onCheckedChange={value => setAcknowledged(value === true)} /><span>أنا السائق المكلّف، أؤكد استلام الأصناف والكميات الموضحة بالمحضر والمركبة المذكورة.</span></label><Button className="min-h-12 w-full" disabled={!acknowledged || pending} onClick={() => onAction(`/api/deliveries/${delivery.id}/acknowledge-handover`)}>تأكيد استلام الشحنة</Button></div>}
    {snapshot && !external && !delivery.handoverAcknowledgedAt && !delivery.capabilities.canAcknowledgeHandover && <p className="text-amber-900">إقرار السائق المكلّف الحالي مطلوب {awaitingDispatch ? "قبل صرف المصدر" : "قبل بدء المهمة" }.</p>}
     {(external ? !!delivery.handoverRecordedAt : !!delivery.handoverAcknowledgedAt) && awaitingDispatch && <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sky-900">{external ? "اكتمل محضر الناقل." : "اكتمل محضر التسليم والإقرار."} {external && delivery.sourceType === "material_transfer" ? "الخطوة التالية: استخدم زر إرسال الشحنة في أعلى التفاصيل؛ لا حاجة للانتقال إلى نافذة أخرى." : "الخطوة التالية: تنفيذ الصرف/الشحن من المصدر؛ لا تبدأ التوصيل إلا بعد خروج الشحنة فعلياً."} {canOpenSource && delivery.capabilities.canRecordHandover && !(external && delivery.sourceType === "material_transfer") && <a className="font-bold underline underline-offset-4" href={deliverySourcePath(delivery)} target="_blank" rel="noopener noreferrer">فتح إجراء الشحن من المصدر في تبويب جديد</a>}</div>}
  </section>;
}

type AssignmentForm = { sourceKey: string; transportMode: "internal" | "external"; driverId: string; vehicleNumber: string; scheduledAt: string; carrier: "" | "road" | "naqel" | "other"; carrierName: string; waybill: string; packageCount: string; trackingUrl: string };
function AssignmentDialog({ embedded, open, onOpenChange, mode, sources, drivers, loading, error, actionError, form, setForm, selectedSource, selectedDriver, onSubmit, pending }: { embedded: boolean; open: boolean; onOpenChange: (open: boolean) => void; mode: "create" | "reassign"; sources: Source[]; drivers: Driver[]; loading: boolean; error: boolean; actionError: string | null; form: AssignmentForm; setForm: Dispatch<SetStateAction<AssignmentForm>>; selectedSource?: Source; selectedDriver?: Driver; onSubmit: () => void; pending: boolean }) {
  const external = mode === "create" && form.transportMode === "external";
  const content = <>
    <div className="space-y-1"><h3 className="font-bold">{mode === "create" ? "إسناد شحنة" : "إعادة إسناد السائق"}</h3><p className="text-sm text-muted-foreground">{mode === "create" ? "اختر مصدر الشحنة وطريقة النقل؛ تُقرأ البنود والفرع مباشرة من المصدر." : "يلغى المحضر والإقرار السابقان ويلزم محضر وإقرار السائق الجديد. لا تعِد صرف الشحنة."}</p></div>
    {actionError && <p role="alert" className="text-sm text-destructive">لم يكتمل الإجراء: {actionError} بيانات النموذج محفوظة ويمكنك إعادة المحاولة.</p>}
    {mode === "create" && <div className="space-y-2"><Label>طريقة النقل</Label><Select value={form.transportMode} onValueChange={(transportMode: "internal" | "external") => setForm(v => ({ ...v, transportMode }))}><SelectTrigger className="min-h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="internal">سائق داخلي</SelectItem><SelectItem value="external">شركة شحن خارجية</SelectItem></SelectContent></Select></div>}
    {loading ? <div className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : error ? <p role="alert" className="text-sm text-destructive">تعذر تحميل المصادر أو السائقين. أغلق النافذة وأعد المحاولة.</p> : <div className="space-y-4">
      {mode === "create" && <div className="space-y-2"><Label>مصدر الشحنة</Label><Select value={form.sourceKey} onValueChange={sourceKey => setForm(v => ({ ...v, sourceKey }))}><SelectTrigger className="min-h-12"><SelectValue placeholder="اختر المصدر المؤهل" /></SelectTrigger><SelectContent>{sources.map(source => <SelectItem key={`${source.sourceType}:${source.sourceId}`} value={`${source.sourceType}:${source.sourceId}`}>{source.sourceLabel} — {source.destinationBranchName}</SelectItem>)}</SelectContent></Select>{selectedSource && <div className="rounded-lg bg-muted/40 p-3 text-sm"><p>من {selectedSource.sourceBranchName} إلى {selectedSource.destinationBranchName}</p><ul className="mt-1 list-inside list-disc">{selectedSource.items.map(item => <li key={item.id}>{item.name} · {item.quantity} {item.unit || ""}</li>)}</ul></div>}</div>}
      {external ? <>
        <div className="space-y-2"><Label>شركة الشحن</Label><Select value={form.carrier} onValueChange={(carrier: AssignmentForm["carrier"]) => setForm(v => ({ ...v, carrier }))}><SelectTrigger className="min-h-12"><SelectValue placeholder="اختر شركة الشحن" /></SelectTrigger><SelectContent><SelectItem value="road">رود للوجيستك</SelectItem><SelectItem value="naqel">ناقل</SelectItem><SelectItem value="other">شركة أخرى</SelectItem></SelectContent></Select></div>
        {form.carrier === "other" && <div className="space-y-2"><Label htmlFor="carrier-name">اسم الشركة</Label><Input id="carrier-name" value={form.carrierName} onChange={e => setForm(v => ({ ...v, carrierName: e.target.value }))} /></div>}
        <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="waybill">رقم بوليصة الشحن</Label><Input id="waybill" value={form.waybill} onChange={e => setForm(v => ({ ...v, waybill: e.target.value }))} /></div><div className="space-y-2"><Label htmlFor="packages">عدد الطرود</Label><Input id="packages" type="number" min="1" step="1" inputMode="numeric" value={form.packageCount} onChange={e => setForm(v => ({ ...v, packageCount: e.target.value }))} /></div></div>
        <details className="rounded-lg border p-3"><summary className="cursor-pointer">رابط تتبع اختياري</summary><Label htmlFor="tracking-url">رابط HTTPS</Label><Input id="tracking-url" type="url" value={form.trackingUrl} placeholder="https://" onChange={e => setForm(v => ({ ...v, trackingUrl: e.target.value }))} /></details>
      </> : <><div className="space-y-2"><Label>السائق</Label><Select value={form.driverId} onValueChange={driverId => setForm(v => ({ ...v, driverId }))}><SelectTrigger className="min-h-12"><SelectValue placeholder="اختر السائق" /></SelectTrigger><SelectContent>{drivers.map(driver => <SelectItem key={driver.id} value={driver.id}>{driver.name} · {driver.jobTitle}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="vehicle">رقم المركبة</Label><Input id="vehicle" className="min-h-12" value={form.vehicleNumber} onChange={e => setForm(v => ({ ...v, vehicleNumber: e.target.value }))} /></div></>}
      {mode === "create" && <div className="space-y-2"><Label htmlFor="scheduled">موعد التوصيل (اختياري)</Label><Input id="scheduled" className="min-h-12" type="datetime-local" value={form.scheduledAt} onChange={e => setForm(v => ({ ...v, scheduledAt: e.target.value }))} /></div>}
      <Button className="min-h-12 w-full" disabled={pending || (mode === "create" && !selectedSource) || (external ? !form.carrier || !form.waybill.trim() || form.carrier === "other" && !form.carrierName.trim() || !/^[1-9]\d*$/.test(form.packageCount) : !selectedDriver || !form.vehicleNumber.trim())} onClick={onSubmit}>{pending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}{mode === "create" ? external ? "تأكيد شركة الشحن" : "تأكيد الإسناد" : "تأكيد إعادة الإسناد"}</Button>
    </div>}
  </>;
  return embedded ? open ? <section dir="rtl" className="space-y-4 rounded-xl border border-primary/20 bg-card p-4" aria-label="إسناد شحنة"><Button type="button" variant="ghost" className="float-left" onClick={() => onOpenChange(false)}>إغلاق</Button>{content}</section> : null
    : <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl" dir="rtl">{content}</DialogContent></Dialog>;
}

function Reports({ range, setRange, reports, loading, error, onRetry, canExport, knownDeliveries, onExport }: { range: { from: string; to: string; sourceBranchId: string; destinationBranchId: string; status: string }; setRange: Dispatch<SetStateAction<{ from: string; to: string; sourceBranchId: string; destinationBranchId: string; status: string }>>; reports?: Report; loading: boolean; error: boolean; onRetry: () => void; canExport: boolean; knownDeliveries: Delivery[]; onExport: () => void }) {
  const branches = Array.from(new Map<string, string>(knownDeliveries.flatMap(item => [[item.sourceBranchId || "", item.sourceBranchName] as [string, string], [item.destinationBranchId, item.destinationBranchName] as [string, string]])).entries()).filter(([id]) => !!id);
    return <section className="space-y-4"><Card><CardContent className="grid gap-3 p-4 md:grid-cols-5 md:items-end"><div><Label htmlFor="from">من</Label><Input id="from" type="date" className="mt-1 min-h-12" value={range.from} onChange={e => setRange(v => ({ ...v, from: e.target.value }))} /></div><div><Label htmlFor="to">إلى</Label><Input id="to" type="date" className="mt-1 min-h-12" value={range.to} onChange={e => setRange(v => ({ ...v, to: e.target.value }))} /></div><Select value={range.sourceBranchId} onValueChange={sourceBranchId => setRange(v => ({ ...v, sourceBranchId }))}><SelectTrigger className="min-h-12"><SelectValue placeholder="فرع المصدر" /></SelectTrigger><SelectContent><SelectItem value="all">كل المصادر</SelectItem>{branches.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select><Select value={range.destinationBranchId} onValueChange={destinationBranchId => setRange(v => ({ ...v, destinationBranchId }))}><SelectTrigger className="min-h-12"><SelectValue placeholder="فرع الوجهة" /></SelectTrigger><SelectContent><SelectItem value="all">كل الوجهات</SelectItem>{branches.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select><Select value={range.status} onValueChange={status => setRange(v => ({ ...v, status }))}><SelectTrigger className="min-h-12"><SelectValue placeholder="الحالة" /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem>{(["assigned", "in_transit", "awaiting_receipt", "receipt_approved", "completed", "failed", "cancelled"] as DeliveryStatus[]).map(status => <SelectItem value={status} key={status}>{deliveryStatus(status).label}</SelectItem>)}</SelectContent></Select>{canExport && !error && <Button variant="outline" className="min-h-12 md:col-start-5" onClick={onExport} disabled={loading || !reports?.deliveries.length}>تصدير CSV</Button>}</CardContent></Card>{loading ? <Skeleton className="h-72" /> : error ? <State icon={<CircleAlert />} title="تعذر تحميل التقرير" text="يمكن تعديل الفترة أو إعادة المحاولة." action={onRetry} /> : <><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[["الإجمالي", reports?.summary.total || 0], ["مكتملة", reports?.summary.completed || 0], ["بانتظار الإيصال", reports?.summary.awaiting_receipt || 0], ["متعذرة", reports?.summary.failed || 0]].map(([label, number]) => <Card key={String(label)}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold text-primary">{number}</p></CardContent></Card>)}</div>{!reports?.deliveries.length ? <State icon={<ClipboardList />} title="لا توجد عمليات ضمن الفترة المحددة" /> : <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[720px] text-right text-sm"><thead className="bg-muted/60"><tr>{["المصدر", "النوع", "السائق أو الناقل والبوليصة", "المستلم", "الحالة", "التاريخ"].map(cell => <th className="p-3 font-medium text-muted-foreground" key={cell}>{cell}</th>)}</tr></thead><tbody>{reports.deliveries.map(item => <tr className="border-t border-border" key={item.id}><td className="p-3 font-semibold">{item.sourceLabel}</td><td className="p-3">{deliverySourceLabel(item.sourceType)}</td><td className="p-3">{deliveryTransportLabel(item)}</td><td className="p-3">{item.receiverName || "—"} {item.proofPresent && <span className="text-xs text-emerald-700">توقيع مسجل</span>}</td><td className="p-3"><Badge variant="outline" className={deliveryStatus(item.status).className}>{deliveryStatus(item.status).label}</Badge></td><td className="p-3">{deliveryDate(item.completedAt || item.scheduledAt || item.createdAt)}</td></tr>)}</tbody></table></div>}</>}</section>;
}
function State({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: () => void }) { return <Card><CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center"><span className="text-primary">{icon}</span><h2 className="font-bold">{title}</h2>{text && <p className="max-w-sm text-sm text-muted-foreground">{text}</p>}{action && <Button variant="outline" className="min-h-11" onClick={action}>إعادة المحاولة</Button>}</CardContent></Card>; }