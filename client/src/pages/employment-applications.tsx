import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
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
  CheckCircle, XCircle, Clock, FileText, Star, RefreshCw,
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
  const [shareLink, setShareLink] = useState<{ link: string; phone: string } | null>(null);

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
    mutationFn: async (id: number) => {
      const r = await apiRequest("POST", `/api/hr/applications/${id}/convert-to-offer`, {});
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
    if (app.convertedToOfferId) {
      toast({ title: "تم التحويل مسبقاً", description: "هذا الطلب محوّل بالفعل" });
      setLocation("/hr/job-offers");
      return;
    }
    if (!confirm("هل تريد إنشاء عرض عمل بناءً على بيانات هذا الطلب؟")) return;
    convertMut.mutate(app.id);
  };

  const handleViewApp = (app: EmploymentApplication) => {
    setViewApp(app);
    setReviewForm({
      status: app.status === "submitted" ? "under_review" : app.status,
      rating: app.rating || 0,
      hrNotes: app.hrNotes || "",
      rejectionReason: app.rejectionReason || "",
    });
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
      <div className="p-4 md:p-6 space-y-6" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-[#e67e22]" />
              طلبات التوظيف
            </h1>
            <p className="text-sm text-gray-600 mt-1">إدارة الطلبات الموجّهة والمفتوحة من المتقدمين</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowVacancy(true)} variant="outline" data-testid="button-new-vacancy">
              <Briefcase className="w-4 h-4 ml-1" /> وظيفة جديدة
            </Button>
            <Button onClick={() => setShowCreate(true)} className="bg-[#e67e22] hover:bg-[#d35400]" data-testid="button-new-application">
              <Plus className="w-4 h-4 ml-1" /> طلب موجّه
            </Button>
          </div>
        </div>

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

                <div className="grid grid-cols-3 gap-3">
                  {viewApp.cvUrl && <a href={viewApp.cvUrl} target="_blank" rel="noreferrer" className="border rounded p-3 text-center text-sm hover:bg-gray-50"><FileText className="w-5 h-5 inline ml-1" />السيرة الذاتية</a>}
                  {viewApp.photoUrl && <a href={viewApp.photoUrl} target="_blank" rel="noreferrer" className="border rounded p-3 text-center text-sm hover:bg-gray-50">الصورة الشخصية</a>}
                  {viewApp.idCopyUrl && <a href={viewApp.idCopyUrl} target="_blank" rel="noreferrer" className="border rounded p-3 text-center text-sm hover:bg-gray-50">نسخة الهوية</a>}
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
              {viewApp?.status === "accepted" && !viewApp?.convertedToOfferId && (
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => convertToOffer(viewApp)}>
                  <Briefcase className="w-4 h-4 ml-1" /> تحويل لعرض عمل
                </Button>
              )}
              <Button onClick={() => viewApp && reviewMut.mutate({ id: viewApp.id, data: { ...reviewForm, rating: reviewForm.rating || undefined } })} disabled={reviewMut.isPending} className="bg-[#e67e22] hover:bg-[#d35400]" data-testid="button-save-review">
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
      </div>
    </Layout>
  );
}
