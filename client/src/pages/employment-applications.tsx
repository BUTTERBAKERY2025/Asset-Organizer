import React, { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { EmploymentApplication, JobVacancy } from "@shared/schema";
import {
  Plus, Send, Eye, Trash2, Briefcase, Users, Search, Copy, ExternalLink,
  CheckCircle, XCircle, Clock, FileText, Star, RefreshCw, Printer,
  ArrowRight,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  invited: "دُعي للتعبئة",
  submitted: "تم التقديم",
  under_review: "قيد المراجعة",
  shortlisted: "ضمن القائمة المختصرة",
  interviewed: "تمت المقابلة",
  accepted: "مقبول",
  rejected: "مرفوض",
  withdrawn: "منسحب",
  expired: "منتهي",
  cancelled: "ملغي",
};

const STATUS_COLORS: Record<string, string> = {
  invited: "bg-blue-100 text-blue-800",
  submitted: "bg-amber-100 text-amber-800",
  under_review: "bg-purple-100 text-purple-800",
  shortlisted: "bg-cyan-100 text-cyan-800",
  interviewed: "bg-indigo-100 text-indigo-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  withdrawn: "bg-gray-100 text-gray-800",
  expired: "bg-orange-100 text-orange-800",
  cancelled: "bg-gray-100 text-gray-800",
};

// فتح المرفق بأمان: data URL → blob URL ليفتح في كل المتصفحات (Chrome/Safari تحجب data: مباشرة)
function openAttachment(url: string | null | undefined) {
  if (!url) return;
  try {
    if (url.startsWith("data:")) {
      const commaIdx = url.indexOf(",");
      if (commaIdx === -1) { window.open(url, "_blank"); return; }
      const meta = url.substring(5, commaIdx);
      const isBase64 = meta.includes(";base64");
      const mime = meta.split(";")[0] || "application/octet-stream";
      const data = url.substring(commaIdx + 1);
      let blob: Blob;
      if (isBase64) {
        const bin = atob(data);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        blob = new Blob([bytes], { type: mime });
      } else {
        blob = new Blob([decodeURIComponent(data)], { type: mime });
      }
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, "_blank");
      if (!win) {
        // المتصفح حجب النافذة → نزّل الملف بدلاً من ذلك
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `attachment.${(mime.split("/")[1] || "bin").split("+")[0]}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch (e) {
    console.error("[openAttachment] error:", e);
    // محاولة احتياطية مباشرة
    try { window.open(url, "_blank"); } catch {}
  }
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className="text-center">
      <CardContent className="pt-4 pb-4">
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        <div className="text-xs text-gray-600 mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

export default function EmploymentApplicationsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState("applications");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showVacancy, setShowVacancy] = useState(false);
  const [viewApp, setViewApp] = useState<EmploymentApplication | null>(null);
  // Tracks whether the full record (with JSONB + attachments + hrNotes/
  // rejectionReason) has been hydrated for the currently opened dialog.
  // Used to gate the Save/Convert actions and to keep the PATCH payload
  // from accidentally overwriting existing notes with empty strings.
  const [viewAppDetailLoaded, setViewAppDetailLoaded] = useState(false);
  // Monotonic request token so a slow response for a previously-opened
  // application can never overwrite the dialog state for a newer one.
  const viewAppRequestId = useRef(0);
  const [shareLink, setShareLink] = useState<{ link: string; phone: string } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: viewApp ? `Application-${viewApp.applicationNumber}` : "Application",
    onBeforePrint: async () => {
      const root = printRef.current;
      if (!root) return;
      const imgs = Array.from(root.querySelectorAll("img"));
      await Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise<void>((res) => {
        img.onload = img.onerror = () => res();
      })));
    },
  });

  const [createForm, setCreateForm] = useState({
    fullNameAr: "", phone: "", whatsapp: "", email: "",
    targetPosition: "", targetBranchId: "", targetBranchName: "",
  });
  const [vacancyForm, setVacancyForm] = useState({
    title: "", titleEn: "", department: "", branchId: "", branchName: "",
    description: "", requirements: "",
  });
  const [reviewForm, setReviewForm] = useState({
    status: "under_review", rating: 0, hrNotes: "", rejectionReason: "",
  });

  const { data: applications = [], isLoading } = useQuery<EmploymentApplication[]>({
    queryKey: ["/api/hr/applications", statusFilter],
    queryFn: async () => {
      const url = statusFilter ? `/api/hr/applications?status=${statusFilter}` : "/api/hr/applications";
      const r = await apiRequest("GET", url);
      return await r.json();
    },
  });
  const { data: stats } = useQuery<Record<string, number>>({
    queryKey: ["/api/hr/applications/stats"],
  });
  const { data: vacancies = [] } = useQuery<JobVacancy[]>({
    queryKey: ["/api/hr/vacancies"],
  });
  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return applications;
    const q = search.toLowerCase();
    return applications.filter(
      (a) =>
        a.fullNameAr?.toLowerCase().includes(q) ||
        a.phone?.toLowerCase().includes(q) ||
        a.applicationNumber?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q)
    );
  }, [applications, search]);

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/hr/applications", createForm);
      return await r.json();
    },
    onSuccess: () => {
      toast({ title: "تم إنشاء الطلب", description: "يمكنك الآن إرسال رابط التعبئة" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/applications/stats"] });
      setShowCreate(false);
      setCreateForm({ fullNameAr: "", phone: "", whatsapp: "", email: "", targetPosition: "", targetBranchId: "", targetBranchName: "" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message || "فشل الإنشاء", variant: "destructive" }),
  });

  const sendMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("POST", `/api/hr/applications/${id}/send`);
      return await r.json();
    },
    onSuccess: (data, id) => {
      const app = applications.find((a) => a.id === id);
      setShareLink({ link: data.link, phone: app?.phone || "" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/applications/stats"] });
      const wa = data.whatsapp;
      if (wa?.success) toast({ title: "تم الإرسال", description: "تم إرسال رسالة واتساب للمتقدم" });
      else toast({ title: "تم توليد الرابط", description: "أرسل الرابط يدوياً للمتقدم" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const reviewMut = useMutation({
    mutationFn: async (payload: { id: number; data: any }) => {
      const r = await apiRequest("PATCH", `/api/hr/applications/${payload.id}/review`, payload.data);
      return await r.json();
    },
    onSuccess: () => {
      toast({ title: "تم تحديث الحالة" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/applications/stats"] });
      setViewApp(null);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/hr/applications/${id}`),
    onSuccess: () => {
      toast({ title: "تم الحذف" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/applications/stats"] });
    },
  });

  const createVacancyMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/hr/vacancies", vacancyForm);
      return await r.json();
    },
    onSuccess: () => {
      toast({ title: "تم إنشاء الوظيفة" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/vacancies"] });
      setShowVacancy(false);
      setVacancyForm({ title: "", titleEn: "", department: "", branchId: "", branchName: "", description: "", requirements: "" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const toggleVacancyMut = useMutation({
    mutationFn: async ({ id, isOpen }: { id: number; isOpen: boolean }) => {
      const r = await apiRequest("PATCH", `/api/hr/vacancies/${id}`, { isOpen });
      return await r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/hr/vacancies"] }),
  });

  const deleteVacancyMut = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/hr/vacancies/${id}`),
    onSuccess: () => {
      toast({ title: "تم الحذف" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/vacancies"] });
    },
  });

  const convertMut = useMutation({
    mutationFn: async ({ id, reconvert }: { id: number; reconvert?: boolean }) => {
      const r = await apiRequest("POST", `/api/hr/applications/${id}/convert-to-offer`, reconvert ? { reconvert: true } : {});
      return await r.json();
    },
    onSuccess: (data) => {
      toast({ title: "تم التحويل", description: `تم إنشاء عرض العمل ${data.offer?.offerNumber}` });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/job-offers"] });
      setViewApp(null);
      setLocation("/hr/job-offers");
    },
    onError: (e: any) => toast({ title: "خطأ في التحويل", description: e.message, variant: "destructive" }),
  });

  const convertToOffer = (app: EmploymentApplication) => {
    if (!confirm("هل تريد إنشاء عرض عمل بناءً على بيانات هذا الطلب؟")) return;
    convertMut.mutate({ id: app.id });
  };

  const reconvertToOffer = (app: EmploymentApplication) => {
    if (!confirm("هذا الطلب محوّل مسبقاً. هل تريد إنشاء عرض عمل جديد آخر من نفس بيانات الطلب؟")) return;
    convertMut.mutate({ id: app.id, reconvert: true });
  };

  const handleViewApp = async (app: EmploymentApplication) => {
    // PERF: list endpoint returns only summary columns. Fetch the full
    // record (with JSONB + attachments) on demand when the dialog opens.
    const myRequestId = ++viewAppRequestId.current;
    setViewApp(app);
    setViewAppDetailLoaded(false);
    setReviewForm({
      status: app.status === "submitted" ? "under_review" : app.status,
      rating: app.rating || 0,
      hrNotes: "",
      rejectionReason: "",
    });
    try {
      const r = await apiRequest("GET", `/api/hr/applications/${app.id}`);
      const detail = await r.json();
      // Race-safety: only apply this response if it belongs to the
      // most-recently-opened application (user may have already clicked
      // a different card before this fetch resolved).
      if (myRequestId !== viewAppRequestId.current) return;
      if (detail && detail.application) {
        setViewApp(detail.application);
        setReviewForm({
          status: detail.application.status === "submitted" ? "under_review" : detail.application.status,
          rating: detail.application.rating || 0,
          hrNotes: detail.application.hrNotes || "",
          rejectionReason: detail.application.rejectionReason || "",
        });
        setViewAppDetailLoaded(true);
      }
    } catch (e: any) {
      if (myRequestId !== viewAppRequestId.current) return;
      toast({ title: "تعذر تحميل التفاصيل الكاملة", description: e?.message || "حاول مرة أخرى لعرض كامل البيانات", variant: "destructive" });
    }
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: "تم النسخ" });
  };

  const publicVacancyLink = (slug: string) => {
    const proto = window.location.protocol;
    const host = window.location.host;
    return `${proto}//${host}/apply/v/${slug}`;
  };

  return (
    <Layout>
      <div className="page-container space-y-6" dir="rtl">
        <PageHeader
          icon={Users}
          tone="people"
          title="طلبات التوظيف"
          description="إدارة الطلبات الموجّهة والمفتوحة من المتقدمين"
          actions={
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => { if (window.history.length > 1) window.history.back(); else setLocation("/"); }}
                data-testid="button-back"
                className="gap-1"
              >
                <ArrowRight className="w-4 h-4" /> عودة
              </Button>
              <Button size="sm" onClick={() => setShowVacancy(true)} variant="outline" data-testid="button-new-vacancy">
                <Briefcase className="w-4 h-4 ml-1" /> وظيفة جديدة
              </Button>
              <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-new-application">
                <Plus className="w-4 h-4 ml-1" /> طلب موجّه
              </Button>
            </div>
          }
        />

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-7 gap-3">
            <StatBox label="الإجمالي" value={stats.total || 0} color="text-[#1a3a2f]" />
            <StatBox label="مدعوون" value={stats.invited || 0} color="text-blue-600" />
            <StatBox label="مقدمون" value={stats.submitted || 0} color="text-amber-600" />
            <StatBox label="قيد المراجعة" value={stats.under_review || 0} color="text-purple-600" />
            <StatBox label="القائمة المختصرة" value={stats.shortlisted || 0} color="text-cyan-600" />
            <StatBox label="مقبولون" value={stats.accepted || 0} color="text-green-600" />
            <StatBox label="مرفوضون" value={stats.rejected || 0} color="text-red-600" />
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="applications" data-testid="tab-applications">الطلبات</TabsTrigger>
            <TabsTrigger value="vacancies" data-testid="tab-vacancies">الوظائف المعلنة</TabsTrigger>
          </TabsList>

          <TabsContent value="applications" className="space-y-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="بحث بالاسم أو الجوال أو الرقم..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pr-9"
                      data-testid="input-search"
                    />
                  </div>
                  <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                      <SelectValue placeholder="كل الحالات" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الحالات</SelectItem>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/hr/applications"] })}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {isLoading ? (
              <div className="text-center py-10 text-gray-500">جاري التحميل...</div>
            ) : filtered.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-gray-500">لا توجد طلبات</CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {filtered.map((app) => (
                  <Card key={app.id} className="hover:shadow-md transition" data-testid={`card-application-${app.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-lg" data-testid={`text-name-${app.id}`}>
                              {app.fullNameAr || "(لم يُعبّأ بعد)"}
                            </span>
                            <Badge className={STATUS_COLORS[app.status] || "bg-gray-100"}>
                              {STATUS_LABELS[app.status] || app.status}
                            </Badge>
                            <Badge variant="outline">{app.source === "open" ? "تقدّم مباشر" : "موجّه"}</Badge>
                          </div>
                          <div className="text-sm text-gray-600 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                            <span>#{app.applicationNumber}</span>
                            <span>{app.phone}</span>
                            {app.targetPosition && <span>الوظيفة: {app.targetPosition}</span>}
                            {app.targetBranchName && <span>الفرع: {app.targetBranchName}</span>}
                            {app.rating ? (
                              <span className="flex items-center gap-1 text-amber-600">
                                <Star className="w-3 h-3 fill-current" /> {app.rating}/5
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => handleViewApp(app)} data-testid={`button-view-${app.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {app.source === "directed" && !["accepted", "rejected", "cancelled"].includes(app.status) && (
                            <Button size="sm" variant="outline" onClick={() => sendMut.mutate(app.id)} disabled={sendMut.isPending} data-testid={`button-send-${app.id}`}>
                              <Send className="w-4 h-4 ml-1" /> إرسال
                            </Button>
                          )}
                          {app.status === "accepted" && !app.convertedToOfferId && (
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => convertToOffer(app)} data-testid={`button-convert-${app.id}`}>
                              <Briefcase className="w-4 h-4 ml-1" /> تحويل لعرض عمل
                            </Button>
                          )}
                          {app.status === "accepted" && app.convertedToOfferId && (
                            <Button size="sm" variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={() => reconvertToOffer(app)} data-testid={`button-reconvert-${app.id}`}>
                              <RefreshCw className="w-4 h-4 ml-1" /> عرض عمل جديد
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="text-red-600" onClick={() => { if (confirm("حذف الطلب؟")) deleteMut.mutate(app.id); }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="vacancies" className="space-y-3">
            {vacancies.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-gray-500">لا توجد وظائف معلنة</CardContent></Card>
            ) : (
              vacancies.map((v) => (
                <Card key={v.id} data-testid={`card-vacancy-${v.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-lg">{v.title}</span>
                          <Badge className={v.isOpen ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                            {v.isOpen ? "مفتوحة" : "مغلقة"}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {v.department && <span>{v.department} • </span>}
                          {v.branchName && <span>{v.branchName}</span>}
                        </div>
                        {v.description && <p className="text-sm mt-2 text-gray-700 line-clamp-2">{v.description}</p>}
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <Input readOnly value={publicVacancyLink(v.slug)} className="font-mono text-xs h-8" dir="ltr" />
                          <Button size="sm" variant="outline" onClick={() => copyLink(publicVacancyLink(v.slug))}>
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => window.open(publicVacancyLink(v.slug), "_blank")}>
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => toggleVacancyMut.mutate({ id: v.id, isOpen: !v.isOpen })}>
                          {v.isOpen ? "إغلاق" : "فتح"}
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600" onClick={() => { if (confirm("حذف الوظيفة؟")) deleteVacancyMut.mutate(v.id); }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* إنشاء طلب موجّه */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-xl" dir="rtl">
            <DialogHeader>
              <DialogTitle>طلب توظيف موجّه</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">أدخل بيانات الاتصال بالمرشح، وسنرسل له رابطاً لتعبئة بياناته.</p>
              <div>
                <Label>الاسم بالعربي *</Label>
                <Input value={createForm.fullNameAr} onChange={(e) => setCreateForm({ ...createForm, fullNameAr: e.target.value })} data-testid="input-create-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>الجوال *</Label>
                  <Input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="05xxxxxxxx" data-testid="input-create-phone" />
                </div>
                <div>
                  <Label>الواتساب</Label>
                  <Input value={createForm.whatsapp} onChange={(e) => setCreateForm({ ...createForm, whatsapp: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>البريد الإلكتروني</Label>
                <Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} dir="ltr" />
              </div>
              <div>
                <Label>الوظيفة المستهدفة</Label>
                <Input value={createForm.targetPosition} onChange={(e) => setCreateForm({ ...createForm, targetPosition: e.target.value })} />
              </div>
              <div>
                <Label>الفرع</Label>
                <Select value={createForm.targetBranchId || "none"} onValueChange={(v) => {
                  if (v === "none") setCreateForm({ ...createForm, targetBranchId: "", targetBranchName: "" });
                  else {
                    const b = branches.find((b: any) => b.id === v);
                    setCreateForm({ ...createForm, targetBranchId: v, targetBranchName: b?.name || "" });
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— بدون —</SelectItem>
                    {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
              <Button onClick={() => createMut.mutate()} disabled={!createForm.fullNameAr || !createForm.phone || createMut.isPending} className="bg-[#e67e22] hover:bg-[#d35400]" data-testid="button-submit-create">
                إنشاء الطلب
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* إنشاء وظيفة معلنة */}
        <Dialog open={showVacancy} onOpenChange={setShowVacancy}>
          <DialogContent className="max-w-2xl" dir="rtl">
            <DialogHeader><DialogTitle>وظيفة معلنة جديدة</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>المسمى الوظيفي *</Label>
                  <Input value={vacancyForm.title} onChange={(e) => setVacancyForm({ ...vacancyForm, title: e.target.value })} data-testid="input-vacancy-title" />
                </div>
                <div>
                  <Label>القسم</Label>
                  <Input value={vacancyForm.department} onChange={(e) => setVacancyForm({ ...vacancyForm, department: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>الفرع</Label>
                <Select value={vacancyForm.branchId || "none"} onValueChange={(v) => {
                  if (v === "none") setVacancyForm({ ...vacancyForm, branchId: "", branchName: "" });
                  else {
                    const b = branches.find((b: any) => b.id === v);
                    setVacancyForm({ ...vacancyForm, branchId: v, branchName: b?.name || "" });
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— بدون —</SelectItem>
                    {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الوصف</Label>
                <Textarea value={vacancyForm.description} onChange={(e) => setVacancyForm({ ...vacancyForm, description: e.target.value })} rows={3} />
              </div>
              <div>
                <Label>المتطلبات</Label>
                <Textarea value={vacancyForm.requirements} onChange={(e) => setVacancyForm({ ...vacancyForm, requirements: e.target.value })} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowVacancy(false)}>إلغاء</Button>
              <Button onClick={() => createVacancyMut.mutate()} disabled={!vacancyForm.title || createVacancyMut.isPending} className="bg-[#e67e22] hover:bg-[#d35400]">
                إنشاء
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* عرض / مراجعة الطلب */}
        <Dialog open={!!viewApp} onOpenChange={(o) => !o && setViewApp(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader><DialogTitle>تفاصيل الطلب #{viewApp?.applicationNumber}</DialogTitle></DialogHeader>
            {viewApp && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">الاسم:</span> {viewApp.fullNameAr}</div>
                  <div><span className="text-gray-500">الاسم بالإنجليزي:</span> {viewApp.fullNameEn || "-"}</div>
                  <div><span className="text-gray-500">الجنسية:</span> {viewApp.nationality || "-"}</div>
                  <div><span className="text-gray-500">رقم الهوية:</span> {viewApp.idNumber || "-"}</div>
                  <div><span className="text-gray-500">الجوال:</span> {viewApp.phone}</div>
                  <div><span className="text-gray-500">البريد:</span> {viewApp.email || "-"}</div>
                  <div><span className="text-gray-500">المدينة:</span> {viewApp.city || "-"}</div>
                  <div><span className="text-gray-500">الراتب المتوقع:</span> {viewApp.expectedSalary || "-"}</div>
                  <div><span className="text-gray-500">الوظيفة:</span> {viewApp.targetPosition || "-"}</div>
                  <div><span className="text-gray-500">الفرع:</span> {viewApp.targetBranchName || "-"}</div>
                </div>

                {Array.isArray(viewApp.education) && viewApp.education.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">المؤهلات</h3>
                    <ul className="text-sm space-y-1">
                      {(viewApp.education as any[]).map((e, i) => (
                        <li key={i} className="border rounded p-2">
                          {e.degree} - {e.field} - {e.institution} ({e.yearFrom}-{e.yearTo})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(viewApp.experience) && viewApp.experience.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">الخبرات</h3>
                    <ul className="text-sm space-y-1">
                      {(viewApp.experience as any[]).map((e, i) => (
                        <li key={i} className="border rounded p-2">
                          {e.position} - {e.company} ({e.from} → {e.current ? "حالياً" : e.to})
                          {e.summary && <div className="text-gray-600 mt-1">{e.summary}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(viewApp.skills) && viewApp.skills.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">المهارات</h3>
                    <div className="flex flex-wrap gap-1">
                      {(viewApp.skills as string[]).map((s, i) => <Badge key={i} variant="secondary">{s}</Badge>)}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold mb-2">المرفقات</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { label: "السيرة الذاتية", url: viewApp.cvUrl, key: "cv", testId: "btn-open-cv" },
                      { label: "الصورة الشخصية", url: viewApp.photoUrl, key: "photo", testId: "btn-open-photo" },
                      { label: "نسخة الهوية / الإقامة", url: viewApp.idCopyUrl, key: "id", testId: "btn-open-id" },
                    ].map((f) => (
                      <div key={f.key} className="border rounded-lg p-3 text-center space-y-2 bg-gray-50/50">
                        <div className="text-xs font-semibold text-gray-700">{f.label}</div>
                        {f.url ? (
                          <>
                            {(f.url.startsWith("data:image") || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(f.url)) ? (
                              <img
                                src={f.url}
                                alt={f.label}
                                className="max-h-32 mx-auto rounded border cursor-pointer object-contain"
                                onClick={() => openAttachment(f.url)}
                                data-testid={`img-${f.key}`}
                              />
                            ) : (
                              <div className="py-3 text-xs text-gray-500 flex items-center justify-center gap-1">
                                <FileText className="w-4 h-4" /> ملف PDF
                              </div>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => openAttachment(f.url)}
                              data-testid={f.testId}
                            >
                              <ExternalLink className="w-3.5 h-3.5 ml-1" /> فتح في نافذة جديدة
                            </Button>
                          </>
                        ) : (
                          <div className="py-4 text-xs text-gray-400">لم يُرفع</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {viewApp.signature && (
                  <div>
                    <h3 className="font-semibold mb-2">التوقيع</h3>
                    <img src={viewApp.signature} alt="signature" className="border rounded max-h-32" />
                  </div>
                )}

                <div className="border-t pt-4 space-y-3">
                  <h3 className="font-semibold">قرار الموارد البشرية</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>الحالة</Label>
                      <Select value={reviewForm.status} onValueChange={(v) => setReviewForm({ ...reviewForm, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="under_review">قيد المراجعة</SelectItem>
                          <SelectItem value="shortlisted">القائمة المختصرة</SelectItem>
                          <SelectItem value="interviewed">تمت المقابلة</SelectItem>
                          <SelectItem value="accepted">مقبول</SelectItem>
                          <SelectItem value="rejected">مرفوض</SelectItem>
                          <SelectItem value="withdrawn">منسحب</SelectItem>
                          <SelectItem value="cancelled">ملغي</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>التقييم (1-5)</Label>
                      <Input type="number" min={0} max={5} value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div>
                    <Label>ملاحظات HR</Label>
                    <Textarea value={reviewForm.hrNotes} onChange={(e) => setReviewForm({ ...reviewForm, hrNotes: e.target.value })} rows={2} />
                  </div>
                  {reviewForm.status === "rejected" && (
                    <div>
                      <Label>سبب الرفض</Label>
                      <Textarea value={reviewForm.rejectionReason} onChange={(e) => setReviewForm({ ...reviewForm, rejectionReason: e.target.value })} rows={2} />
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewApp(null)}>إغلاق</Button>
              <Button variant="outline" onClick={() => handlePrint()} className="border-amber-500 text-amber-700 hover:bg-amber-50" data-testid="button-print-application">
                <Printer className="w-4 h-4 ml-1" /> طباعة / PDF
              </Button>
              {viewApp?.status === "accepted" && !viewApp?.convertedToOfferId && (
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => convertToOffer(viewApp)} data-testid="button-convert-dialog">
                  <Briefcase className="w-4 h-4 ml-1" /> تحويل لعرض عمل
                </Button>
              )}
              {viewApp?.status === "accepted" && viewApp?.convertedToOfferId && (
                <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={() => reconvertToOffer(viewApp)} data-testid="button-reconvert-dialog">
                  <RefreshCw className="w-4 h-4 ml-1" /> إنشاء عرض عمل جديد
                </Button>
              )}
              <Button onClick={() => {
                if (!viewApp) return;
                // Only send hrNotes/rejectionReason when the full record was
                // hydrated — otherwise the empty strings would overwrite the
                // existing values on the server.
                const payload: any = {
                  status: reviewForm.status,
                  rating: reviewForm.rating || undefined,
                };
                if (viewAppDetailLoaded) {
                  payload.hrNotes = reviewForm.hrNotes;
                  payload.rejectionReason = reviewForm.rejectionReason;
                }
                reviewMut.mutate({ id: viewApp.id, data: payload });
              }} disabled={reviewMut.isPending || !viewAppDetailLoaded} className="bg-[#e67e22] hover:bg-[#d35400]" data-testid="button-save-review">
                حفظ القرار
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* رابط المشاركة بعد الإرسال */}
        <Dialog open={!!shareLink} onOpenChange={(o) => !o && setShareLink(null)}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>رابط التعبئة</DialogTitle></DialogHeader>
            {shareLink && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">انسخ الرابط أو افتحه للتجربة:</p>
                <div className="flex gap-2">
                  <Input readOnly value={shareLink.link} dir="ltr" className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={() => copyLink(shareLink.link)}><Copy className="w-4 h-4" /></Button>
                </div>
                {shareLink.phone && (
                  <Button variant="outline" className="w-full" onClick={() => window.open(`https://wa.me/${shareLink.phone.replace(/\D/g, "")}?text=${encodeURIComponent(shareLink.link)}`, "_blank")}>
                    فتح في واتساب
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <div style={{ position: "absolute", left: "-10000px", top: 0, width: 0, height: 0, overflow: "hidden" }}>
          {viewApp && (
            <PrintableApplication
              ref={printRef}
              app={{
                ...viewApp,
                status: reviewForm.status as any,
                rating: reviewForm.rating || viewApp.rating,
                hrNotes: reviewForm.hrNotes || viewApp.hrNotes,
                rejectionReason: reviewForm.rejectionReason || viewApp.rejectionReason,
              }}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}

const PrintableApplication = React.forwardRef<HTMLDivElement, { app: EmploymentApplication }>(
  ({ app }, ref) => {
    const today = new Date().toLocaleDateString("ar-SA-u-nu-latn");
    const submittedDate = app.submittedAt ? new Date(app.submittedAt).toLocaleDateString("ar-SA-u-nu-latn") : "-";
    const Field = ({ label, value }: { label: string; value: any }) => (
      <div style={{ display: "flex", gap: 6, fontSize: 12, padding: "3px 0", borderBottom: "1px dotted #ddd" }}>
        <span style={{ color: "#666", minWidth: 110 }}>{label}:</span>
        <span style={{ fontWeight: 600 }}>{value || "-"}</span>
      </div>
    );
    const SectionTitle = ({ children }: { children: React.ReactNode }) => (
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1a3a2f", borderBottom: "2px solid #e67e22", paddingBottom: 4, marginTop: 14, marginBottom: 8 }}>
        {children}
      </h2>
    );
    return (
      <div ref={ref} dir="rtl" style={{ fontFamily: "Cairo, Tahoma, Arial, sans-serif", padding: 24, color: "#222", background: "#fff", lineHeight: 1.6 }}>
        <style>{`
          @page { size: A4; margin: 12mm; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}</style>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "3px solid #e67e22", paddingBottom: 12, marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a3a2f", margin: 0 }}>طلب توظيف</h1>
            <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>شركة الزبد الأفضل التجارية — Butter Bakery Trading Co.</div>
            <div style={{ fontSize: 10, color: "#888" }}>سجل تجاري: 7026155296</div>
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 11, color: "#666" }}>رقم الطلب</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e67e22" }}>{app.applicationNumber}</div>
            <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>تاريخ الطباعة: {today}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, fontSize: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ background: "#fff3e0", color: "#e67e22", padding: "3px 10px", borderRadius: 4, fontWeight: 600 }}>
            الحالة: {STATUS_LABELS[app.status] || app.status}
          </span>
          <span style={{ background: "#f0f0f0", color: "#444", padding: "3px 10px", borderRadius: 4 }}>
            المصدر: {app.source === "open" ? "تقدّم مباشر" : "موجّه"}
          </span>
          <span style={{ background: "#f0f0f0", color: "#444", padding: "3px 10px", borderRadius: 4 }}>
            تاريخ التقديم: {submittedDate}
          </span>
        </div>

        <SectionTitle>البيانات الشخصية</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Field label="الاسم بالعربي" value={app.fullNameAr} />
          <Field label="Full Name (EN)" value={app.fullNameEn} />
          <Field label="الجنسية" value={app.nationality} />
          <Field label="نوع الهوية" value={app.idType} />
          <Field label="رقم الهوية" value={app.idNumber} />
          <Field label="انتهاء الهوية" value={app.idExpiry} />
          <Field label="تاريخ الميلاد" value={app.dob} />
          <Field label="الجنس" value={app.gender} />
          <Field label="الحالة الاجتماعية" value={app.maritalStatus} />
          <Field label="المدينة" value={app.city} />
          <Field label="العنوان" value={app.address} />
        </div>

        <SectionTitle>بيانات التواصل</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Field label="الجوال" value={app.phone} />
          <Field label="الواتساب" value={app.whatsapp} />
          <Field label="البريد الإلكتروني" value={app.email} />
        </div>

        <SectionTitle>الوظيفة المستهدفة</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Field label="المسمى الوظيفي" value={app.targetPosition} />
          <Field label="الفرع" value={app.targetBranchName} />
          <Field label="الراتب المتوقع" value={app.expectedSalary ? `${app.expectedSalary.toLocaleString("en-US")} ر.س` : "-"} />
          <Field label="تاريخ الجاهزية" value={app.availabilityDate} />
        </div>

        {Array.isArray(app.education) && app.education.length > 0 && (
          <>
            <SectionTitle>المؤهلات العلمية</SectionTitle>
            {(app.education as any[]).map((e, i) => (
              <div key={i} style={{ fontSize: 12, padding: 6, border: "1px solid #eee", borderRadius: 4, marginBottom: 5 }}>
                <strong>{e.degree || "-"}</strong> {e.field && `— ${e.field}`} <br />
                <span style={{ color: "#555" }}>{e.institution || "-"}</span>
                <span style={{ color: "#888", marginRight: 8 }}>({e.yearFrom || "?"} - {e.yearTo || "?"})</span>
                {e.gpa && <span style={{ marginRight: 8 }}>المعدل: {e.gpa}</span>}
              </div>
            ))}
          </>
        )}

        {Array.isArray(app.experience) && app.experience.length > 0 && (
          <>
            <SectionTitle>الخبرات العملية</SectionTitle>
            {(app.experience as any[]).map((e, i) => (
              <div key={i} style={{ fontSize: 12, padding: 6, border: "1px solid #eee", borderRadius: 4, marginBottom: 5 }}>
                <strong>{e.position || "-"}</strong> — {e.company || "-"}<br />
                <span style={{ color: "#888" }}>{e.from || "?"} → {e.current ? "حالياً" : (e.to || "?")}</span>
                {e.summary && <div style={{ color: "#555", marginTop: 3 }}>{e.summary}</div>}
              </div>
            ))}
          </>
        )}

        {Array.isArray(app.skills) && app.skills.length > 0 && (
          <>
            <SectionTitle>المهارات</SectionTitle>
            <div style={{ fontSize: 12 }}>
              {(app.skills as string[]).map((s, i) => (
                <span key={i} style={{ display: "inline-block", background: "#f0f0f0", padding: "3px 8px", borderRadius: 4, margin: "2px" }}>
                  {s}
                </span>
              ))}
            </div>
          </>
        )}

        {Array.isArray(app.languages) && app.languages.length > 0 && (
          <>
            <SectionTitle>اللغات</SectionTitle>
            <div style={{ fontSize: 12 }}>
              {(app.languages as any[]).map((l, i) => (
                <span key={i} style={{ display: "inline-block", background: "#f0f0f0", padding: "3px 10px", borderRadius: 4, margin: "2px" }}>
                  {l.name}: {l.level}
                </span>
              ))}
            </div>
          </>
        )}

        {Array.isArray((app as any).references) && (app as any).references.length > 0 && (
          <>
            <SectionTitle>المعرّفون</SectionTitle>
            {((app as any).references as any[]).map((r, i) => (
              <div key={i} style={{ fontSize: 12, padding: 6, border: "1px solid #eee", borderRadius: 4, marginBottom: 5 }}>
                <strong>{r.name || "-"}</strong> {r.position && `— ${r.position}`} {r.company && `(${r.company})`}<br />
                <span style={{ color: "#666" }}>{r.phone || "-"}</span>
                {r.email && <span style={{ marginRight: 8 }}>{r.email}</span>}
              </div>
            ))}
          </>
        )}

        {(app.hrNotes || app.rejectionReason || app.rating) && (
          <>
            <SectionTitle>ملاحظات الموارد البشرية</SectionTitle>
            {app.rating ? <Field label="التقييم" value={`${app.rating} / 5`} /> : null}
            {app.hrNotes && <Field label="ملاحظات" value={app.hrNotes} />}
            {app.rejectionReason && <Field label="سبب الرفض" value={app.rejectionReason} />}
          </>
        )}

        {(app.photoUrl || app.idCopyUrl || app.cvUrl) && (
          <>
            <SectionTitle>المرفقات</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, pageBreakInside: "avoid" }}>
              {app.photoUrl && (
                <div style={{ textAlign: "center", border: "1px solid #eee", borderRadius: 4, padding: 8 }}>
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>الصورة الشخصية</div>
                  {app.photoUrl.startsWith("data:image") || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(app.photoUrl) ? (
                    <img src={app.photoUrl} alt="photo" style={{ maxHeight: 180, maxWidth: "100%", objectFit: "contain", borderRadius: 4 }} />
                  ) : (
                    <div style={{ fontSize: 11, color: "#888", padding: 20 }}>مرفق PDF (يُعرض إلكترونياً)</div>
                  )}
                </div>
              )}
              {app.idCopyUrl && (
                <div style={{ textAlign: "center", border: "1px solid #eee", borderRadius: 4, padding: 8 }}>
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>نسخة الهوية / الإقامة</div>
                  {app.idCopyUrl.startsWith("data:image") || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(app.idCopyUrl) ? (
                    <img src={app.idCopyUrl} alt="id copy" style={{ maxHeight: 180, maxWidth: "100%", objectFit: "contain", borderRadius: 4 }} />
                  ) : (
                    <div style={{ fontSize: 11, color: "#888", padding: 20 }}>مرفق PDF (يُعرض إلكترونياً)</div>
                  )}
                </div>
              )}
            </div>
            {app.cvUrl && (
              <div style={{ marginTop: 8, fontSize: 11, color: "#666", borderTop: "1px dotted #ccc", paddingTop: 6 }}>
                ✓ السيرة الذاتية مرفقة إلكترونياً مع الطلب (يمكن فتحها من الواجهة)
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>توقيع المتقدم</div>
            {app.signature ? (
              <img src={app.signature} alt="signature" style={{ maxHeight: 80, border: "1px solid #ddd", borderRadius: 4, padding: 4, background: "#fff" }} />
            ) : (
              <div style={{ height: 80, border: "1px dashed #ccc", borderRadius: 4 }} />
            )}
            <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>تاريخ التوقيع: {submittedDate}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>توقيع المسؤول</div>
            <div style={{ height: 80, border: "1px dashed #ccc", borderRadius: 4 }} />
            <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>الاسم/التاريخ: ____________________</div>
          </div>
        </div>

        <div style={{ marginTop: 20, paddingTop: 8, borderTop: "1px solid #ddd", fontSize: 9, color: "#999", textAlign: "center" }}>
          هذا المستند مولّد آلياً من نظام إدارة الموارد البشرية — Butter Bakery Trading Co.
        </div>
      </div>
    );
  }
);
PrintableApplication.displayName = "PrintableApplication";
