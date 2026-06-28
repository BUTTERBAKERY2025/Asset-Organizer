import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import {
  Building2, Plus, Search, Eye, Edit, Trash2, Lock, LockOpen,
  ThumbsUp, ThumbsDown, Loader2, Scale, AlertTriangle, FileDown,
  Printer, FileText, ListChecks,
} from "lucide-react";
import type { AssemblyResolution } from "@shared/schema";

const assemblyTypes = [
  { value: "ordinary", label: "جمعية عادية (OGM)", color: "bg-blue-100 text-blue-800" },
  { value: "extraordinary", label: "جمعية غير عادية (EGM)", color: "bg-purple-100 text-purple-800" },
];

const resolutionTypes = [
  { value: "regular", label: "قرار عادي", assembly: "ordinary" },
  { value: "dividend", label: "توزيع أرباح", assembly: "ordinary" },
  { value: "board_election", label: "انتخاب مجلس", assembly: "ordinary" },
  { value: "capital_change", label: "تغيير رأس المال", assembly: "extraordinary" },
  { value: "statute_amendment", label: "تعديل النظام الأساسي", assembly: "extraordinary" },
  { value: "merger", label: "اندماج", assembly: "extraordinary" },
  { value: "dissolution", label: "تصفية / حل", assembly: "extraordinary" },
];

const majorityTypes = [
  { value: "simple", label: "أغلبية بسيطة (>50%)" },
  { value: "two_thirds", label: "أغلبية الثلثين (≥66.67%)" },
  { value: "three_quarters", label: "أغلبية الثلاثة أرباع (≥75%)" },
];

const statuses = [
  { value: "draft", label: "مسودة", color: "bg-gray-100 text-gray-800" },
  { value: "proposed", label: "مقترح", color: "bg-blue-100 text-blue-800" },
  { value: "voting", label: "قيد التصويت", color: "bg-yellow-100 text-yellow-800" },
  { value: "approved", label: "معتمد", color: "bg-green-100 text-green-800" },
  { value: "rejected", label: "مرفوض", color: "bg-red-100 text-red-800" },
  { value: "implemented", label: "منفذ", color: "bg-emerald-100 text-emerald-800" },
];

export default function AssemblyResolutionsPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AssemblyResolution | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [lockId, setLockId] = useState<number | null>(null);
  const [viewing, setViewing] = useState<AssemblyResolution | null>(null);
  const [manageItemsFor, setManageItemsFor] = useState<AssemblyResolution | null>(null);

  const { data: resolutions = [], isLoading } = useQuery<AssemblyResolution[]>({
    queryKey: ["/api/governance/assembly-resolutions"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/governance/assembly-resolutions", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/governance/assembly-resolutions"] });
      setShowCreate(false);
      toast({ title: "تم إنشاء القرار بنجاح" });
    },
    onError: (e: any) => toast({ title: "فشل إنشاء القرار", description: e?.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/governance/assembly-resolutions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/governance/assembly-resolutions"] });
      setEditing(null);
      toast({ title: "تم تحديث القرار" });
    },
    onError: (e: any) => toast({ title: "فشل تحديث القرار", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/governance/assembly-resolutions/${id}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/governance/assembly-resolutions"] });
      setDeleteId(null);
      toast({ title: "تم حذف القرار" });
    },
    onError: (e: any) => toast({ title: "فشل الحذف", description: e?.message, variant: "destructive" }),
  });

  const lockMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/governance/assembly-resolutions/${id}/lock`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/governance/assembly-resolutions"] });
      setLockId(null);
      toast({ title: "تم قفل القرار نهائياً", description: "أصبح غير قابل للتعديل أو الحذف" });
    },
    onError: (e: any) => toast({ title: "فشل القفل", description: e?.message, variant: "destructive" }),
  });

  const hasSignedDoc = (r: AssemblyResolution) =>
    Array.isArray((r as any).attachments) &&
    (r as any).attachments.some((a: any) => a?.type === "signed_original");

  const downloadSignedDoc = async (r: AssemblyResolution) => {
    try {
      const res = await fetch(`/api/governance/assembly-resolutions/${r.id}/signed-document`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "تعذّر تحميل المستند");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `قرار_موقّع_${r.resolutionNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "فشل تحميل المستند الموقّع", description: e?.message, variant: "destructive" });
    }
  };

  // ===== Official document: print + PDF export for ANY assembly resolution =====
  const escapeHtml = (v: any) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const labelOf = (arr: { value: string; label: string }[], v?: string | null) =>
    arr.find(x => x.value === v)?.label || v || "—";

  type MinutesData = {
    items: { id: number; text: string; sequence: number | null }[];
    votes: { itemId: number | null; voterName: string; vote: string; sharesVoted: string | null }[];
    signatures: { signerName: string | null; signatureData: string | null; signatureType: string | null; status: string | null; signedAt: string | null }[];
  };

  const fetchMinutes = async (id: number): Promise<MinutesData> => {
    const res = await apiRequest("GET", `/api/governance/assembly-resolutions/${id}/minutes`);
    return await res.json();
  };

  const buildResolutionDocContent = (r: AssemblyResolution, minutes?: MinutesData) => {
    const fmt = (n: any) => (n == null || n === "" ? "0" : Number(n).toLocaleString("en-US"));
    const dateAr = (d: any) =>
      d ? new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "long", day: "numeric" }) : "—";
    const statusLabel = escapeHtml(labelOf(statuses, r.status));
    const assemblyLabel = escapeHtml(labelOf(assemblyTypes.map(a => ({ value: a.value, label: a.label })), r.assemblyType));
    const typeLabel = escapeHtml(labelOf(resolutionTypes.map(a => ({ value: a.value, label: a.label })), r.resolutionType));
    const majorityLabel = escapeHtml(labelOf(majorityTypes, r.majorityType));
    const resolutionNumber = escapeHtml(r.resolutionNumber);
    const approved = r.status === "approved" || r.status === "implemented";
    const resultBadge = approved
      ? "✓ تم اعتماد القرار"
      : r.status === "rejected"
      ? "✗ تم رفض القرار"
      : "⏳ " + statusLabel;
    const resultColor = approved ? "#15803d" : r.status === "rejected" ? "#b91c1c" : "#a16207";
    const sharesRow = (Number(r.forShares) || Number(r.againstShares) || Number(r.abstainShares))
      ? `<div class="vote-box">
           <div class="vote-item"><div class="vote-num" style="color:#15803d">${fmt(r.forShares)}</div><div class="vote-lbl">أسهم موافقة</div></div>
           <div class="vote-item"><div class="vote-num" style="color:#b91c1c">${fmt(r.againstShares)}</div><div class="vote-lbl">أسهم معارضة</div></div>
           <div class="vote-item"><div class="vote-num" style="color:#a16207">${fmt(r.abstainShares)}</div><div class="vote-lbl">أسهم ممتنعة</div></div>
         </div>`
      : "";
    const items = minutes?.items ?? [];
    const allVotes = minutes?.votes ?? [];
    const signatures = minutes?.signatures ?? [];
    const hasClauses = items.length > 0;
    const hasPerClauseVotes = allVotes.some(v => v.itemId != null);
    const legacyVotes = allVotes.filter(v => v.itemId == null);
    const voteMeta = (v: string) =>
      v === "for" ? { t: "موافق", c: "#15803d" }
      : v === "against" ? { t: "غير موافق", c: "#b91c1c" }
      : { t: "ممتنع", c: "#a16207" };
    const voterRowsFor = (clauseId: number) => {
      const rows = hasPerClauseVotes ? allVotes.filter(v => v.itemId === clauseId) : legacyVotes;
      if (!rows.length) return `<tr><td colspan="3" class="empty">لا توجد أصوات مسجّلة</td></tr>`;
      return rows.map(v => {
        const m = voteMeta(v.vote);
        return `<tr><td>${escapeHtml(v.voterName)}</td><td style="color:${m.c};font-weight:700">${m.t}</td><td>${fmt(v.sharesVoted)}</td></tr>`;
      }).join("");
    };
    const clausesHtml = hasClauses ? `
      <div class="sec-title"><div class="ic">٢</div><span>التصويت على البنود</span></div>
      ${!hasPerClauseVotes ? `<div class="note">صُوّت على هذا القرار إجمالاً (قبل تفعيل التصويت على البنود)، لذا يظهر موقف كل مساهم على القرار ككل أمام كل بند.</div>` : ""}
      ${items.map((it, i) => `
        <div class="clause">
          <div class="clause-head">البند ${i + 1}: ${escapeHtml(it.text)}</div>
          <table class="vtbl">
            <thead><tr><th>المساهم</th><th>الموقف</th><th>عدد الأسهم</th></tr></thead>
            <tbody>${voterRowsFor(it.id)}</tbody>
          </table>
        </div>`).join("")}
    ` : "";
    const aggregateHtml = hasClauses ? "" : `
      <div class="sec-title"><div class="ic">٢</div><span>نتيجة التصويت</span></div>
      <div class="vote-box">
        <div class="vote-item"><div class="vote-num" style="color:#15803d">${fmt(r.forVotes)}</div><div class="vote-lbl">موافق</div></div>
        <div class="vote-item"><div class="vote-num" style="color:#b91c1c">${fmt(r.againstVotes)}</div><div class="vote-lbl">معارض</div></div>
        <div class="vote-item"><div class="vote-num" style="color:#a16207">${fmt(r.abstainVotes)}</div><div class="vote-lbl">ممتنع</div></div>
      </div>
      ${sharesRow}
      ${r.requiredMajority ? `<div class="req">النسبة المطلوبة للاعتماد: ${Number(r.requiredMajority)}%</div>` : ""}`;
    const signaturesHtml = signatures.length ? `
      <div class="sec-title"><div class="ic">٣</div><span>توقيعات المساهمين</span></div>
      <div class="sig-grid">
        ${signatures.map(s => {
          const signed = s.status === "signed" && !!s.signatureData;
          const isImg = signed && /^data:image/i.test(String(s.signatureData));
          const body = isImg
            ? `<img class="sig-img" src="${escapeHtml(String(s.signatureData))}" alt="توقيع" />`
            : signed
              ? `<div class="sig-text">${escapeHtml(String(s.signatureData))}</div>`
              : `<div class="sig-blank"></div>`;
          return `<div class="sig-cell">
            ${body}
            <div class="sig-name">${escapeHtml(s.signerName || "—")}</div>
            <div class="sig-date">${signed && s.signedAt ? "وُقّع في " + dateAr(s.signedAt) : "بدون توقيع"}</div>
          </div>`;
        }).join("")}
      </div>` : "";
    return `
    <div id="res-doc">
      <style>
        #res-doc { font-family: 'Cairo','Segoe UI',sans-serif; direction: rtl; color:#1a1a1a; background:#fff; width:190mm; margin:0 auto; padding:4mm; box-sizing:border-box; font-size:12px; }
        #res-doc * { box-sizing: border-box; }
        #res-doc .doc-header { display:flex; justify-content:space-between; align-items:center; background:linear-gradient(135deg,#1a3a2f,#2d5a47); color:#fff; padding:16px 20px; border-radius:8px; }
        #res-doc .brand { display:flex; align-items:center; gap:12px; }
        #res-doc .logo { width:54px; height:54px; background:linear-gradient(135deg,#f5a623,#e67e22); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:26px; font-weight:800; color:#1a3a2f; }
        #res-doc .brand h1 { margin:0; font-size:17px; font-weight:700; }
        #res-doc .brand .en { margin:3px 0 0; font-size:10px; color:#f5a623; }
        #res-doc .brand .reg { margin:3px 0 0; font-size:9px; opacity:.85; }
        #res-doc .doc-type { text-align:left; }
        #res-doc .doc-type .badge { background:#f5a623; color:#1a3a2f; font-weight:700; padding:4px 12px; border-radius:6px; font-size:12px; }
        #res-doc .doc-type .num { margin-top:6px; font-size:12px; font-family:monospace; }
        #res-doc .meta { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:16px 0; }
        #res-doc .meta .m { background:#f8f9fa; border-right:3px solid #f5a623; border-radius:0 6px 6px 0; padding:8px 12px; }
        #res-doc .meta .m .l { font-size:9px; color:#666; }
        #res-doc .meta .m .v { font-size:12px; font-weight:700; color:#1a3a2f; margin-top:2px; }
        #res-doc .sec-title { display:flex; align-items:center; gap:8px; margin:16px 0 8px; }
        #res-doc .sec-title .ic { width:22px; height:22px; background:#1a3a2f; color:#fff; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; }
        #res-doc .sec-title span { font-size:14px; font-weight:700; color:#1a3a2f; }
        #res-doc .title-box { background:#fff5eb; border:1px solid #f5a623; border-radius:8px; padding:12px 16px; }
        #res-doc .title-box h2 { margin:0; font-size:16px; color:#1a3a2f; }
        #res-doc .desc { white-space:pre-wrap; line-height:1.7; font-size:12px; padding:10px 4px; }
        #res-doc .vote-box { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:6px; }
        #res-doc .vote-item { background:#fafbfc; border:1px solid #eee; border-radius:8px; padding:12px; text-align:center; }
        #res-doc .vote-num { font-size:20px; font-weight:800; }
        #res-doc .vote-lbl { font-size:10px; color:#666; margin-top:2px; }
        #res-doc .result { margin-top:12px; text-align:center; font-weight:700; font-size:14px; color:${resultColor}; border:2px dashed ${resultColor}; border-radius:8px; padding:8px; }
        #res-doc .req { text-align:center; font-size:11px; color:#666; margin-top:6px; }
        #res-doc .note { background:#fff8e1; border:1px solid #f0d68a; border-radius:6px; padding:8px 12px; font-size:11px; color:#7a5c00; margin:8px 0; line-height:1.6; }
        #res-doc .clause { border:1px solid #e5e7eb; border-radius:8px; padding:10px 12px; margin:10px 0; break-inside:avoid; page-break-inside:avoid; }
        #res-doc .clause-head { font-weight:700; font-size:12.5px; color:#1a3a2f; margin-bottom:8px; line-height:1.6; }
        #res-doc .vtbl { width:100%; border-collapse:collapse; font-size:11px; }
        #res-doc .vtbl th { background:#f1f5f3; color:#1a3a2f; text-align:right; padding:6px 8px; border:1px solid #e5e7eb; font-weight:700; }
        #res-doc .vtbl td { padding:6px 8px; border:1px solid #eee; }
        #res-doc .vtbl td.empty { text-align:center; color:#888; }
        #res-doc .sig-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:8px; }
        #res-doc .sig-cell { border:1px solid #e5e7eb; border-radius:8px; padding:10px; text-align:center; break-inside:avoid; page-break-inside:avoid; }
        #res-doc .sig-img { max-height:60px; max-width:100%; object-fit:contain; }
        #res-doc .sig-text { font-size:18px; color:#1a3a2f; min-height:60px; display:flex; align-items:center; justify-content:center; }
        #res-doc .sig-blank { height:60px; border-bottom:1px dashed #aaa; }
        #res-doc .sig-name { font-weight:700; font-size:11px; color:#1a3a2f; margin-top:6px; }
        #res-doc .sig-date { font-size:9px; color:#777; margin-top:2px; }
        #res-doc .foot { margin-top:20px; padding-top:10px; border-top:2px solid #1a3a2f; display:flex; justify-content:space-between; font-size:9px; color:#666; }
      </style>
      <div class="doc-header">
        <div class="brand">
          <div class="logo">B</div>
          <div>
            <h1>شركة الزبد الأفضل التجارية</h1>
            <div class="en">THE BUTTER BEST TRADING COMPANY</div>
            <div class="reg">شركة مساهمة | سجل تجاري: 7026155296 | المملكة العربية السعودية</div>
          </div>
        </div>
        <div class="doc-type">
          <div class="badge">قرار جمعية عمومية</div>
          <div class="num">رقم: ${resolutionNumber}</div>
        </div>
      </div>
      <div class="meta">
        <div class="m"><div class="l">نوع الجمعية</div><div class="v">${assemblyLabel}</div></div>
        <div class="m"><div class="l">نوع القرار</div><div class="v">${typeLabel}</div></div>
        <div class="m"><div class="l">الأغلبية المطلوبة</div><div class="v">${majorityLabel}</div></div>
        <div class="m"><div class="l">التاريخ</div><div class="v">${dateAr(r.approvedAt || r.proposedAt || r.createdAt)}</div></div>
      </div>
      <div class="sec-title"><div class="ic">١</div><span>نص القرار</span></div>
      <div class="title-box"><h2>${escapeHtml(r.title)}</h2></div>
      <div class="desc">${escapeHtml(r.description)}</div>
      ${aggregateHtml}
      ${clausesHtml}
      <div class="result">${resultBadge}</div>
      ${signaturesHtml}
      <div class="foot">
        <div>شركة الزبد الأفضل التجارية (شركة مساهمة) | سجل تجاري: 7026155296</div>
        <div>تاريخ الطباعة: ${new Date().toLocaleDateString("ar-SA-u-nu-latn")} | وثيقة رسمية</div>
      </div>
    </div>`;
  };

  const printResolution = async (r: AssemblyResolution) => {
    try {
      let minutes: MinutesData | undefined;
      try {
        minutes = await fetchMinutes(r.id);
      } catch {
        toast({ title: "تعذّر تحميل تفاصيل البنود والتوقيعات", description: "سيُطبع المستند بالملخّص فقط. أعد المحاولة لإظهار التفاصيل الكاملة.", variant: "destructive" });
      }
      const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>قرار ${escapeHtml(r.resolutionNumber)}</title>
      <style>@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');@page{size:A4 portrait;margin:12mm}body{margin:0}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style>
      </head><body>${buildResolutionDocContent(r, minutes)}</body></html>`;
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "-9999px";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      };
      const triggerPrint = () => {
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(cleanup, 2000);
        }, 350);
      };

      iframe.onload = triggerPrint;
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (!doc) {
        cleanup();
        throw new Error("تعذّر تجهيز نافذة الطباعة");
      }
      doc.open();
      doc.write(html);
      doc.close();
      // Fallback in case the load event does not fire after document.write
      setTimeout(() => { if (!cleaned) triggerPrint(); }, 800);
    } catch (e: any) {
      toast({ title: "تعذّر طباعة القرار", description: e?.message, variant: "destructive" });
    }
  };

  const exportResolutionPdf = async (r: AssemblyResolution) => {
    let container: HTMLDivElement | null = null;
    try {
      let minutes: MinutesData | undefined;
      try {
        minutes = await fetchMinutes(r.id);
      } catch {
        toast({ title: "تعذّر تحميل تفاصيل البنود والتوقيعات", description: "سيُصدَّر المستند بالملخّص فقط. أعد المحاولة لإظهار التفاصيل الكاملة.", variant: "destructive" });
      }
      const html2pdf = (await import("html2pdf.js")).default;
      container = document.createElement("div");
      container.style.position = "fixed";
      container.style.right = "-9999px";
      container.style.top = "0";
      container.innerHTML = buildResolutionDocContent(r, minutes);
      document.body.appendChild(container);
      await html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename: `قرار_جمعية_${r.resolutionNumber}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(container)
        .save();
    } catch (e: any) {
      toast({ title: "تعذّر تصدير القرار", description: e?.message, variant: "destructive" });
    } finally {
      if (container && container.parentNode) container.parentNode.removeChild(container);
    }
  };

  const filtered = useMemo(() => {
    return resolutions.filter(r => {
      if (search && !`${r.title} ${r.resolutionNumber} ${r.description}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterType !== "all" && r.assemblyType !== filterType) return false;
      if (activeTab !== "all" && r.status !== activeTab) return false;
      return true;
    });
  }, [resolutions, search, filterType, activeTab]);

  const getStatusBadge = (s: string) => {
    const st = statuses.find(x => x.value === s);
    return <Badge className={st?.color || "bg-gray-100"}>{st?.label || s}</Badge>;
  };
  const getAssemblyBadge = (t: string) => {
    const at = assemblyTypes.find(x => x.value === t);
    return <Badge className={at?.color || ""}>{at?.label || t}</Badge>;
  };
  const getMajorityBadge = (m: string) => {
    const mt = majorityTypes.find(x => x.value === m);
    return <Badge variant="outline" className="text-xs">{mt?.label || m}</Badge>;
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      assemblyType: fd.get("assemblyType"),
      resolutionType: fd.get("resolutionType"),
      majorityType: fd.get("majorityType"),
      title: fd.get("title"),
      description: fd.get("description"),
      proposedAt: new Date().toISOString(),
      category: fd.get("category") || null,
      priority: fd.get("priority") || "normal",
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editing.id,
      data: {
        title: fd.get("title"),
        description: fd.get("description"),
        status: fd.get("status"),
        priority: fd.get("priority"),
      },
    });
  };

  return (
    <Layout>
      <div className="page-container space-y-4" dir="rtl">
        <PageHeader
          icon={Building2}
          tone="executive"
          title="قرارات الجمعية العمومية"
          description="قرارات الجمعية العادية وغير العادية — منفصلة عن قرارات مجلس الإدارة"
          backHref="/governance"
          actions={
            <Button onClick={() => setShowCreate(true)} className="gap-2" data-testid="btn-new-assembly-resolution">
              <Plus className="h-4 w-4" /> قرار جديد
            </Button>
          }
        />

        <Card>
          <CardContent className="p-4 flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="ابحث برقم القرار أو العنوان…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-9"
                data-testid="input-search"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[220px]" data-testid="select-filter-assembly-type">
                <SelectValue placeholder="نوع الجمعية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع أنواع الجمعيات</SelectItem>
                {assemblyTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">الكل ({resolutions.length})</TabsTrigger>
            {statuses.map(s => (
              <TabsTrigger key={s.value} value={s.value}>
                {s.label} ({resolutions.filter(r => r.status === s.value).length})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <Card><CardContent className="py-8 text-center text-gray-500">جاري التحميل…</CardContent></Card>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>لا توجد قرارات جمعية</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filtered.map(r => (
                  <Card key={r.id} className="hover:shadow-md transition-shadow" data-testid={`assembly-resolution-card-${r.id}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row gap-4 justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="outline" className="font-mono text-xs">{r.resolutionNumber}</Badge>
                            {getStatusBadge(r.status || "draft")}
                            {getAssemblyBadge(r.assemblyType)}
                            {getMajorityBadge(r.majorityType)}
                            {r.isLocked && (
                              <Badge className="bg-amber-100 text-amber-800 gap-1" data-testid={`badge-locked-${r.id}`}>
                                <Lock className="h-3 w-3" /> مقفل
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-semibold text-lg">{r.title}</h3>
                          <p className="text-sm text-gray-600 line-clamp-2 mt-1">{r.description}</p>
                          {(r.totalVotes ?? 0) > 0 && (
                            <div className="flex items-center gap-3 mt-2 text-sm">
                              <span className="flex items-center gap-1"><ThumbsUp className="h-4 w-4 text-green-600" /> {r.forVotes}</span>
                              <span className="flex items-center gap-1"><ThumbsDown className="h-4 w-4 text-red-600" /> {r.againstVotes}</span>
                              <span className="text-gray-500">من {r.totalVotes}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 items-start">
                          {hasSignedDoc(r) && (
                            <Button
                              variant="outline" size="sm"
                              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-medium"
                              onClick={() => downloadSignedDoc(r)}
                              data-testid={`btn-download-signed-${r.id}`}
                            >
                              <FileDown className="h-4 w-4 ml-1" /> تحميل القرار الموقع سابقاً
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => setViewing(r)} data-testid={`btn-view-${r.id}`}>
                            <Eye className="h-4 w-4 ml-1" /> عرض
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            onClick={() => printResolution(r)}
                            data-testid={`btn-print-${r.id}`}
                          >
                            <Printer className="h-4 w-4 ml-1" /> طباعة
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            className="text-blue-700 border-blue-300 hover:bg-blue-50"
                            onClick={() => exportResolutionPdf(r)}
                            data-testid={`btn-export-${r.id}`}
                          >
                            <FileText className="h-4 w-4 ml-1" /> تصدير PDF
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            onClick={() => setEditing(r)}
                            disabled={r.isLocked}
                            data-testid={`btn-edit-${r.id}`}
                            title={r.isLocked ? "القرار مقفل ولا يمكن تعديله" : ""}
                          >
                            <Edit className="h-4 w-4 ml-1" /> تعديل
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            className="text-amber-800 border-amber-300 hover:bg-amber-50"
                            onClick={() => setManageItemsFor(r)}
                            data-testid={`btn-manage-items-${r.id}`}
                          >
                            <ListChecks className="h-4 w-4 ml-1" /> البنود
                          </Button>
                          {isAdmin && !r.isLocked && (r.status === "approved" || r.status === "implemented") && (
                            <Button
                              variant="outline" size="sm"
                              className="text-amber-700 border-amber-300 hover:bg-amber-50"
                              onClick={() => setLockId(r.id)}
                              data-testid={`btn-lock-${r.id}`}
                            >
                              <Lock className="h-4 w-4 ml-1" /> قفل نهائي
                            </Button>
                          )}
                          {isAdmin && !r.isLocked && (
                            <Button
                              variant="outline" size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => setDeleteId(r.id)}
                              data-testid={`btn-delete-${r.id}`}
                            >
                              <Trash2 className="h-4 w-4 ml-1" /> حذف
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>قرار جمعية جديد</DialogTitle>
              <DialogDescription>
                قرارات الجمعية غير العادية (تعديل النظام، تغيير رأس المال، اندماج، تصفية) تتطلب أغلبية الثلثين على الأقل.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>نوع الجمعية *</Label>
                  <Select name="assemblyType" required defaultValue="ordinary">
                    <SelectTrigger data-testid="select-assembly-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {assemblyTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>نوع القرار *</Label>
                  <Select name="resolutionType" required defaultValue="regular">
                    <SelectTrigger data-testid="select-resolution-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {resolutionTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>الأغلبية المطلوبة *</Label>
                <Select name="majorityType" required defaultValue="simple">
                  <SelectTrigger data-testid="select-majority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {majorityTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  يُضبط تلقائياً للقرارات الاستثنائية (تغيير رأس المال، تعديل النظام، اندماج، تصفية).
                </p>
              </div>
              <div>
                <Label>عنوان القرار *</Label>
                <Input name="title" required data-testid="input-title" />
              </div>
              <div>
                <Label>الوصف التفصيلي *</Label>
                <Textarea name="description" rows={4} required data-testid="input-description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>التصنيف</Label>
                  <Input name="category" placeholder="مالي / استراتيجي / …" data-testid="input-category" />
                </div>
                <div>
                  <Label>الأولوية</Label>
                  <Select name="priority" defaultValue="normal">
                    <SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">منخفضة</SelectItem>
                      <SelectItem value="normal">عادية</SelectItem>
                      <SelectItem value="high">عالية</SelectItem>
                      <SelectItem value="urgent">عاجلة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="btn-submit-create">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إنشاء القرار"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
          <DialogContent className="max-w-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل القرار {editing?.resolutionNumber}</DialogTitle>
            </DialogHeader>
            {editing && (
              <form onSubmit={handleUpdate} className="space-y-3">
                <div>
                  <Label>العنوان</Label>
                  <Input name="title" defaultValue={editing.title} required data-testid="input-edit-title" />
                </div>
                <div>
                  <Label>الوصف</Label>
                  <Textarea name="description" defaultValue={editing.description} rows={4} required data-testid="input-edit-description" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>الحالة</Label>
                    <Select name="status" defaultValue={editing.status || "draft"}>
                      <SelectTrigger data-testid="select-edit-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>الأولوية</Label>
                    <Select name="priority" defaultValue={editing.priority || "normal"}>
                      <SelectTrigger data-testid="select-edit-priority"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">منخفضة</SelectItem>
                        <SelectItem value="normal">عادية</SelectItem>
                        <SelectItem value="high">عالية</SelectItem>
                        <SelectItem value="urgent">عاجلة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>إلغاء</Button>
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="btn-submit-edit">
                    {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* View Dialog */}
        <Dialog open={!!viewing} onOpenChange={o => !o && setViewing(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {viewing?.title}
                {viewing?.isLocked && <Lock className="h-4 w-4 text-amber-600" />}
              </DialogTitle>
              <DialogDescription>{viewing?.resolutionNumber}</DialogDescription>
            </DialogHeader>
            {viewing && (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {getStatusBadge(viewing.status || "draft")}
                  {getAssemblyBadge(viewing.assemblyType)}
                  {getMajorityBadge(viewing.majorityType)}
                </div>
                <div>
                  <Label className="text-gray-500">الوصف</Label>
                  <p className="text-sm whitespace-pre-wrap">{viewing.description}</p>
                </div>
                {hasSignedDoc(viewing) && (
                  <Button
                    variant="outline"
                    className="w-full text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-medium"
                    onClick={() => downloadSignedDoc(viewing)}
                    data-testid={`btn-download-signed-view-${viewing.id}`}
                  >
                    <FileDown className="h-4 w-4 ml-1" /> تحميل القرار الموقع سابقاً (PDF)
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => printResolution(viewing)}
                    data-testid={`btn-print-view-${viewing.id}`}
                  >
                    <Printer className="h-4 w-4 ml-1" /> طباعة القرار
                  </Button>
                  <Button
                    variant="outline"
                    className="text-blue-700 border-blue-300 hover:bg-blue-50"
                    onClick={() => exportResolutionPdf(viewing)}
                    data-testid={`btn-export-view-${viewing.id}`}
                  >
                    <FileText className="h-4 w-4 ml-1" /> تصدير PDF
                  </Button>
                </div>
                {viewing.isLocked && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                    <p className="font-medium text-amber-900 flex items-center gap-1">
                      <Lock className="h-4 w-4" /> قرار مقفل نهائياً
                    </p>
                    <p className="text-amber-700 mt-1">قُفل في: {viewing.lockedAt ? new Date(viewing.lockedAt).toLocaleString("ar") : "—"}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد حذف القرار</AlertDialogTitle>
              <AlertDialogDescription>
                هذا الإجراء لا يمكن التراجع عنه. تأكد أن القرار غير معتمد رسمياً قبل الحذف.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "جاري الحذف…" : "نعم، احذف"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Lock confirmation */}
        <AlertDialog open={!!lockId} onOpenChange={o => !o && setLockId(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-600" /> قفل القرار نهائياً
              </AlertDialogTitle>
              <AlertDialogDescription>
                بعد القفل لن يتمكن أي مستخدم — حتى المدير — من تعديل القرار أو حذفه أو تعديل أصوات التصويت عليه.
                هذا إجراء مطلوب نظاماً للقرارات المعتمدة (الامتثال لهيئة السوق المالية ونظام الشركات).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>تراجع</AlertDialogCancel>
              <AlertDialogAction
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => lockId && lockMutation.mutate(lockId)}
                disabled={lockMutation.isPending}
              >
                {lockMutation.isPending ? "جاري القفل…" : "نعم، اقفل نهائياً"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ManageClausesDialog resolution={manageItemsFor} onClose={() => setManageItemsFor(null)} />
      </div>
    </Layout>
  );
}

type ClauseItem = {
  id: number;
  sequence: number;
  text: string;
  result: string;
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  forShares: string;
  againstShares: string;
  abstainShares: string;
};

function ManageClausesDialog({ resolution, onClose }: { resolution: AssemblyResolution | null; onClose: () => void }) {
  const { toast } = useToast();
  const [newText, setNewText] = useState("");
  const open = !!resolution;
  const resId = resolution?.id;
  const locked = !!resolution?.isLocked;

  const { data: items = [], isLoading } = useQuery<ClauseItem[]>({
    queryKey: ["/api/governance/assembly-resolutions", resId, "items"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/governance/assembly-resolutions/${resId}/items`);
      return res.json();
    },
    enabled: open && resId != null,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/governance/assembly-resolutions", resId, "items"] });
  };

  const addMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", `/api/governance/assembly-resolutions/${resId}/items`, { text });
      return res.json();
    },
    onSuccess: () => { setNewText(""); invalidate(); },
    onError: (e: any) => toast({ title: "تعذّر إضافة البند", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const res = await apiRequest("DELETE", `/api/governance/assembly-resolutions/items/${itemId}`);
      return res.json();
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast({ title: "تعذّر حذف البند", description: e?.message, variant: "destructive" }),
  });

  const resultLabel = (r: string) =>
    r === "approved" ? "معتمد" : r === "rejected" ? "مرفوض" : "بانتظار التصويت";
  const resultClass = (r: string) =>
    r === "approved" ? "bg-green-100 text-green-800" : r === "rejected" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-amber-600" />
            بنود القرار {resolution?.resolutionNumber}
          </DialogTitle>
          <DialogDescription>
            أضف بنود القرار ليصوّت المساهمون على كل بند بشكل منفصل. القرارات بدون بنود تبقى بتصويت واحد على القرار كله.
          </DialogDescription>
        </DialogHeader>

        {locked && (
          <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
            <Lock className="h-4 w-4" /> القرار مقفل — لا يمكن تعديل البنود.
          </div>
        )}

        <div className="space-y-2">
          {isLoading && <div className="text-sm text-muted-foreground py-4 text-center">جارٍ التحميل…</div>}
          {!isLoading && items.length === 0 && (
            <div className="text-sm text-muted-foreground py-4 text-center" data-testid="text-no-clauses">لا توجد بنود بعد.</div>
          )}
          {items.map((it, idx) => {
            const voted = (it.forVotes || 0) + (it.againstVotes || 0) + (it.abstainVotes || 0) > 0;
            return (
              <div key={it.id} className="border rounded-lg p-3 space-y-2" data-testid={`clause-${it.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 text-sm">
                    <span className="font-bold text-amber-700">بند {idx + 1}:</span> {it.text}
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${resultClass(it.result)}`}>{resultLabel(it.result)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>موافق: {it.forVotes || 0} · معارض: {it.againstVotes || 0} · ممتنع: {it.abstainVotes || 0}</span>
                  {!locked && !voted && (
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 text-red-600 hover:bg-red-50"
                      onClick={() => deleteMutation.mutate(it.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`btn-delete-clause-${it.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 ml-1" /> حذف
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!locked && (
          <div className="space-y-2 border-t pt-3">
            <Textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="نص البند الجديد…"
              rows={2}
              data-testid="input-new-clause"
            />
            <Button
              onClick={() => newText.trim() && addMutation.mutate(newText.trim())}
              disabled={!newText.trim() || addMutation.isPending}
              className="gap-2"
              data-testid="btn-add-clause"
            >
              <Plus className="h-4 w-4" /> إضافة بند
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="btn-close-clauses">إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
