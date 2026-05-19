import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import {
  Briefcase,
  Plus,
  Search,
  Send,
  Copy,
  XCircle,
  CalendarPlus,
  Eye,
  Loader2,
  CheckCircle2,
  Clock,
  FileText,
  Phone,
  Mail,
  MessageCircle,
  Printer,
  Pencil,
  Trash2,
} from "lucide-react";
import type { JobOffer } from "@shared/schema";
import { useReactToPrint } from "react-to-print";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-slate-200 text-slate-700" },
  sent: { label: "مرسل", color: "bg-blue-100 text-blue-700" },
  viewed: { label: "تم العرض", color: "bg-indigo-100 text-indigo-700" },
  accepted: { label: "مقبول", color: "bg-green-100 text-green-700" },
  declined: { label: "مرفوض", color: "bg-red-100 text-red-700" },
  expired: { label: "منتهي", color: "bg-amber-100 text-amber-700" },
  cancelled: { label: "ملغي", color: "bg-slate-300 text-slate-800" },
};

interface OfferForm {
  candidateName: string;
  candidateNameEn: string;
  nationality: string;
  idNumber: string;
  idPlace: string;
  idExpiry: string;
  phone: string;
  email: string;
  qualification: string;
  position: string;
  positionEn: string;
  department: string;
  branchName: string;
  startDate: string;
  contractDurationMonths: number;
  probationDays: number;
  workingHours: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  annualLeaveDays: number;
  hasMedicalInsurance: boolean;
  hasTravelTickets: boolean;
  benefitsNotes: string;
  termsNotes: string;
  validityDays: number;
}

const emptyForm: OfferForm = {
  candidateName: "",
  candidateNameEn: "",
  nationality: "",
  idNumber: "",
  idPlace: "",
  idExpiry: "",
  phone: "",
  email: "",
  qualification: "",
  position: "",
  positionEn: "",
  department: "",
  branchName: "",
  startDate: "",
  contractDurationMonths: 12,
  probationDays: 180,
  workingHours: "8 ساعات / 6 أيام في الأسبوع",
  basicSalary: 0,
  housingAllowance: 0,
  transportAllowance: 0,
  otherAllowances: 0,
  annualLeaveDays: 21,
  hasMedicalInsurance: true,
  hasTravelTickets: false,
  benefitsNotes: "",
  termsNotes: "",
  validityDays: 2,
};

export default function JobOffersPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<OfferForm>(emptyForm);
  const [step, setStep] = useState(1);
  const [editId, setEditId] = useState<number | null>(null);
  const [viewOffer, setViewOffer] = useState<JobOffer | null>(null);
  const [shareLink, setShareLink] = useState<{ link: string; offer: JobOffer } | null>(null);
  const [deleteOffer, setDeleteOffer] = useState<JobOffer | null>(null);

  // Prefill from accepted employment application (Convert to Job Offer)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("prefillJobOffer");
      if (raw) {
        const data = JSON.parse(raw);
        setForm((f) => ({ ...f, ...data }));
        setShowCreate(true);
        setStep(1);
        sessionStorage.removeItem("prefillJobOffer");
      }
    } catch {}
  }, []);

  const { data: offers = [], isLoading } = useQuery<JobOffer[]>({
    queryKey: ["/api/hr/job-offers"],
  });
  const { data: stats } = useQuery<Record<string, number>>({
    queryKey: ["/api/hr/job-offers/stats"],
  });

  const filtered = useMemo(() => {
    let r = offers;
    if (tab !== "all") r = r.filter((o) => o.status === tab);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      r = r.filter(
        (o) =>
          o.candidateName.toLowerCase().includes(s) ||
          o.phone.includes(s) ||
          o.offerNumber.toLowerCase().includes(s) ||
          (o.position || "").toLowerCase().includes(s)
      );
    }
    return r;
  }, [offers, tab, search]);

  const totalSalary =
    Number(form.basicSalary || 0) +
    Number(form.housingAllowance || 0) +
    Number(form.transportAllowance || 0) +
    Number(form.otherAllowances || 0);

  const createMutation = useMutation({
    mutationFn: async (data: OfferForm) => {
      const res = await apiRequest("POST", "/api/hr/job-offers", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "تم الإنشاء", description: "تم حفظ العرض كمسودة" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/job-offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/job-offers/stats"] });
      setShowCreate(false);
      setForm(emptyForm);
      setStep(1);
      setEditId(null);
    },
    onError: (e: any) => {
      toast({ title: "فشل الإنشاء", description: e.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: OfferForm }) => {
      const res = await apiRequest("PATCH", `/api/hr/job-offers/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "تم التحديث", description: "تم حفظ التعديلات على العرض" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/job-offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/job-offers/stats"] });
      setShowCreate(false);
      setForm(emptyForm);
      setStep(1);
      setEditId(null);
    },
    onError: (e: any) => {
      toast({ title: "فشل التحديث", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/hr/job-offers/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "تم الحذف", description: "تم حذف العرض نهائياً" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/job-offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/job-offers/stats"] });
      setDeleteOffer(null);
    },
    onError: (e: any) => {
      toast({ title: "فشل الحذف", description: e.message, variant: "destructive" });
    },
  });

  const openEditDialog = (o: JobOffer) => {
    setForm({
      candidateName: o.candidateName || "",
      candidateNameEn: o.candidateNameEn || "",
      nationality: o.nationality || "",
      idNumber: o.idNumber || "",
      idPlace: o.idPlace || "",
      idExpiry: o.idExpiry || "",
      phone: o.phone || "",
      email: o.email || "",
      qualification: o.qualification || "",
      position: o.position || "",
      positionEn: o.positionEn || "",
      department: o.department || "",
      branchName: o.branchName || "",
      startDate: o.startDate || "",
      contractDurationMonths: o.contractDurationMonths || 12,
      probationDays: o.probationDays || 180,
      workingHours: o.workingHours || "",
      basicSalary: o.basicSalary || 0,
      housingAllowance: o.housingAllowance || 0,
      transportAllowance: o.transportAllowance || 0,
      otherAllowances: o.otherAllowances || 0,
      annualLeaveDays: o.annualLeaveDays || 21,
      hasMedicalInsurance: !!o.hasMedicalInsurance,
      hasTravelTickets: !!o.hasTravelTickets,
      benefitsNotes: o.benefitsNotes || "",
      termsNotes: o.termsNotes || "",
      validityDays: o.validityDays || 2,
    });
    setEditId(o.id);
    setStep(1);
    setShowCreate(true);
  };

  const sendMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/hr/job-offers/${id}/send`, {});
      return await res.json();
    },
    onSuccess: (data, id) => {
      const offer = offers.find((o) => o.id === id);
      toast({
        title: data.whatsapp?.success ? "تم الإرسال عبر واتساب" : "تم توليد الرابط",
        description: data.whatsapp?.success
          ? "تم إرسال العرض للمرشح"
          : "اضغط نسخ الرابط ليتم إرساله يدوياً",
      });
      if (offer) setShareLink({ link: data.link, offer });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/job-offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/job-offers/stats"] });
    },
    onError: (e: any) => toast({ title: "فشل الإرسال", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiRequest("POST", `/api/hr/job-offers/${id}/cancel`, { reason });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "تم الإلغاء" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/job-offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/job-offers/stats"] });
    },
    onError: (e: any) => toast({ title: "فشل الإلغاء", description: e.message, variant: "destructive" }),
  });

  const extendMutation = useMutation({
    mutationFn: async ({ id, days }: { id: number; days: number }) => {
      const res = await apiRequest("POST", `/api/hr/job-offers/${id}/extend`, { days });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "تم تمديد الصلاحية" });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/job-offers"] });
    },
    onError: (e: any) => toast({ title: "فشل التمديد", description: e.message, variant: "destructive" }),
  });

  const handleCreateSubmit = () => {
    if (!form.candidateName || !form.phone || !form.position || !form.startDate) {
      toast({ title: "بيانات ناقصة", description: "الاسم والهاتف والوظيفة وتاريخ المباشرة مطلوبة", variant: "destructive" });
      return;
    }
    if (editId) {
      updateMutation.mutate({ id: editId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: "تم نسخ الرابط" });
  };

  const StatCard = ({ label, value, color, icon: Icon }: any) => (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value || 0}</p>
        </div>
        <Icon className={`w-8 h-8 ${color} opacity-60`} />
      </CardContent>
    </Card>
  );

  return (
    <Layout>
      <div className="page-container space-y-4" dir="rtl">
        <PageHeader
          icon={Briefcase}
          tone="people"
          title="عروض العمل"
          description="إدارة وإرسال عروض العمل للمرشحين"
          actions={
            <Button
              size="sm"
              onClick={() => { setForm(emptyForm); setStep(1); setEditId(null); setShowCreate(true); }}
              className="gap-2"
              data-testid="btn-new-offer"
            >
              <Plus className="w-4 h-4" /> عرض جديد
            </Button>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard label="الإجمالي" value={stats?.total} color="text-slate-700" icon={FileText} />
          <StatCard label="مسودة" value={stats?.draft} color="text-slate-600" icon={FileText} />
          <StatCard label="مرسلة" value={stats?.sent} color="text-blue-600" icon={Send} />
          <StatCard label="مفتوحة" value={stats?.viewed} color="text-indigo-600" icon={Eye} />
          <StatCard label="مقبولة" value={stats?.accepted} color="text-green-600" icon={CheckCircle2} />
          <StatCard label="مرفوضة" value={stats?.declined} color="text-red-600" icon={XCircle} />
          <StatCard label="منتهية" value={stats?.expired} color="text-amber-600" icon={Clock} />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="all">الكل</TabsTrigger>
                  <TabsTrigger value="draft">مسودة</TabsTrigger>
                  <TabsTrigger value="sent">مرسلة</TabsTrigger>
                  <TabsTrigger value="viewed">مفتوحة</TabsTrigger>
                  <TabsTrigger value="accepted">مقبولة</TabsTrigger>
                  <TabsTrigger value="declined">مرفوضة</TabsTrigger>
                  <TabsTrigger value="expired">منتهية</TabsTrigger>
                  <TabsTrigger value="cancelled">ملغاة</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="بحث بالاسم/الهاتف/الرقم"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-9 w-64"
                  data-testid="input-search-offers"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin inline" /></div>
            ) : filtered.length === 0 ? (
              <div className="py-10 text-center text-slate-500">لا توجد عروض</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم العرض</TableHead>
                    <TableHead>المرشح</TableHead>
                    <TableHead>الوظيفة</TableHead>
                    <TableHead>الفرع</TableHead>
                    <TableHead>الراتب</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الانتهاء</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => {
                    const total =
                      o.basicSalary + o.housingAllowance + o.transportAllowance + o.otherAllowances;
                    const statusInfo = STATUS_LABELS[o.status] || { label: o.status, color: "" };
                    return (
                      <TableRow key={o.id} data-testid={`row-offer-${o.id}`}>
                        <TableCell className="font-mono text-xs">{o.offerNumber}</TableCell>
                        <TableCell>
                          <div className="font-medium">{o.candidateName}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" />{o.phone}</div>
                        </TableCell>
                        <TableCell>{o.position}</TableCell>
                        <TableCell>{o.branchName || "-"}</TableCell>
                        <TableCell className="font-semibold text-amber-700">{total.toLocaleString("en-US")} ر.س</TableCell>
                        <TableCell>
                          <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {o.expiresAt ? new Date(o.expiresAt).toLocaleDateString("ar-SA") : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => setViewOffer(o)} data-testid={`btn-view-${o.id}`} title="عرض">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            {o.status === "draft" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-amber-700 border-amber-300 hover:bg-amber-50"
                                onClick={() => openEditDialog(o)}
                                data-testid={`btn-edit-${o.id}`}
                                title="تعديل"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {(o.status === "draft" || o.status === "expired") && (
                              <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700"
                                onClick={() => sendMutation.mutate(o.id)}
                                disabled={sendMutation.isPending}
                                data-testid={`btn-send-${o.id}`}
                              >
                                <Send className="w-3.5 h-3.5 ml-1" /> إرسال
                              </Button>
                            )}
                            {(o.status === "sent" || o.status === "viewed") && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => extendMutation.mutate({ id: o.id, days: 2 })}
                                  data-testid={`btn-extend-${o.id}`}
                                  title="تمديد الصلاحية"
                                >
                                  <CalendarPlus className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => sendMutation.mutate(o.id)}
                                  disabled={sendMutation.isPending}
                                  title="إعادة إرسال"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                            {!["accepted", "cancelled", "declined"].includes(o.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                onClick={() => {
                                  const reason = prompt("سبب الإلغاء؟") || "";
                                  cancelMutation.mutate({ id: o.id, reason });
                                }}
                                data-testid={`btn-cancel-${o.id}`}
                                title="إلغاء"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {isAdmin && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-700 border-red-300 hover:bg-red-50"
                                onClick={() => setDeleteOffer(o)}
                                data-testid={`btn-delete-${o.id}`}
                                title="حذف نهائي (Admin)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create / Edit Wizard */}
        <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setEditId(null); } setShowCreate(o); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editId ? `تعديل العرض — الخطوة ${step} من 4` : `إنشاء عرض عمل جديد — الخطوة ${step} من 4`}
              </DialogTitle>
            </DialogHeader>
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-amber-600" : "bg-slate-200"}`} />
              ))}
            </div>

            {step === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>الاسم بالعربية *</Label>
                  <Input value={form.candidateName} onChange={(e) => setForm({ ...form, candidateName: e.target.value })} data-testid="input-candidate-name" />
                </div>
                <div className="space-y-1">
                  <Label>Name (English)</Label>
                  <Input value={form.candidateNameEn} onChange={(e) => setForm({ ...form, candidateNameEn: e.target.value })} dir="ltr" />
                </div>
                <div className="space-y-1">
                  <Label>الجنسية</Label>
                  <Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>المؤهل العلمي</Label>
                  <Input value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>رقم الهوية/الإقامة</Label>
                  <Input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>مكان الإصدار</Label>
                  <Input value={form.idPlace} onChange={(e) => setForm({ ...form, idPlace: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>تاريخ انتهاء الهوية</Label>
                  <Input type="date" value={form.idExpiry} onChange={(e) => setForm({ ...form, idExpiry: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>الهاتف (واتساب) *</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05xxxxxxxx" data-testid="input-phone" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>المسمى الوظيفي *</Label>
                  <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} data-testid="input-position" />
                </div>
                <div className="space-y-1">
                  <Label>Position (English)</Label>
                  <Input value={form.positionEn} onChange={(e) => setForm({ ...form, positionEn: e.target.value })} dir="ltr" />
                </div>
                <div className="space-y-1">
                  <Label>الإدارة/القسم</Label>
                  <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>الفرع</Label>
                  <Input value={form.branchName} onChange={(e) => setForm({ ...form, branchName: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>تاريخ المباشرة *</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} data-testid="input-start-date" />
                </div>
                <div className="space-y-1">
                  <Label>مدة العقد (أشهر)</Label>
                  <Input type="number" value={form.contractDurationMonths} onChange={(e) => setForm({ ...form, contractDurationMonths: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label>فترة التجربة (أيام)</Label>
                  <Input type="number" value={form.probationDays} onChange={(e) => setForm({ ...form, probationDays: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label>ساعات العمل</Label>
                  <Input value={form.workingHours} onChange={(e) => setForm({ ...form, workingHours: e.target.value })} />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>الراتب الأساسي</Label>
                    <Input type="number" value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: Number(e.target.value) })} data-testid="input-basic-salary" />
                  </div>
                  <div className="space-y-1">
                    <Label>بدل السكن</Label>
                    <Input type="number" value={form.housingAllowance} onChange={(e) => setForm({ ...form, housingAllowance: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label>بدل المواصلات</Label>
                    <Input type="number" value={form.transportAllowance} onChange={(e) => setForm({ ...form, transportAllowance: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label>بدلات أخرى</Label>
                    <Input type="number" value={form.otherAllowances} onChange={(e) => setForm({ ...form, otherAllowances: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-center">
                  <span className="text-sm text-amber-700">إجمالي الراتب الشهري:</span>
                  <span className="text-2xl font-bold text-amber-800 mr-2">{totalSalary.toLocaleString("en-US")} ر.س</span>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>أيام الإجازة السنوية</Label>
                    <Input type="number" value={form.annualLeaveDays} onChange={(e) => setForm({ ...form, annualLeaveDays: Number(e.target.value) })} />
                  </div>
                  <div className="flex items-center justify-between border rounded p-2">
                    <Label>تأمين طبي</Label>
                    <Switch checked={form.hasMedicalInsurance} onCheckedChange={(v) => setForm({ ...form, hasMedicalInsurance: v })} />
                  </div>
                  <div className="flex items-center justify-between border rounded p-2">
                    <Label>تذاكر سفر</Label>
                    <Switch checked={form.hasTravelTickets} onCheckedChange={(v) => setForm({ ...form, hasTravelTickets: v })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>مزايا إضافية (اختياري)</Label>
                  <Textarea value={form.benefitsNotes} onChange={(e) => setForm({ ...form, benefitsNotes: e.target.value })} rows={3} />
                </div>
                <div className="space-y-1">
                  <Label>شروط وملاحظات إضافية (اختياري)</Label>
                  <Textarea value={form.termsNotes} onChange={(e) => setForm({ ...form, termsNotes: e.target.value })} rows={3} />
                </div>
                <div className="space-y-1">
                  <Label>مدة صلاحية الرابط (أيام)</Label>
                  <Input type="number" min={1} max={7} value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: Number(e.target.value) })} />
                  <p className="text-xs text-slate-500">الرابط ينتهي تلقائياً بعد هذه المدة</p>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>السابق</Button>}
              {step < 4 && <Button className="bg-amber-600" onClick={() => setStep(step + 1)} data-testid="btn-next-step">التالي</Button>}
              {step === 4 && (
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleCreateSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="btn-submit-offer"
                >
                  {(createMutation.isPending || updateMutation.isPending)
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : editId ? "حفظ التعديلات" : "حفظ كمسودة"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Share Link Dialog */}
        <Dialog open={!!shareLink} onOpenChange={(o) => !o && setShareLink(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>رابط العرض جاهز</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="bg-slate-50 border rounded p-3 break-all text-sm" dir="ltr">{shareLink?.link}</div>
              <div className="flex gap-2">
                <Button onClick={() => shareLink && copyLink(shareLink.link)} className="flex-1 gap-2">
                  <Copy className="w-4 h-4" /> نسخ الرابط
                </Button>
                {shareLink && (
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`عرض العمل: ${shareLink.link}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1"
                  >
                    <Button className="w-full gap-2 bg-green-600 hover:bg-green-700">
                      <MessageCircle className="w-4 h-4" /> فتح واتساب
                    </Button>
                  </a>
                )}
              </div>
              <p className="text-xs text-slate-500">ينتهي الرابط بعد {shareLink?.offer.validityDays} يوم</p>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Offer Dialog */}
        <Dialog open={!!viewOffer} onOpenChange={(o) => !o && setViewOffer(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تفاصيل العرض {viewOffer?.offerNumber}</DialogTitle>
            </DialogHeader>
            {viewOffer && <OfferDetails offer={viewOffer} />}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation — Admin only */}
        <Dialog open={!!deleteOffer} onOpenChange={(o) => !o && setDeleteOffer(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-700">⚠️ حذف نهائي للعرض</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>سيتم حذف العرض التالي نهائياً ولا يمكن استعادته:</p>
              <div className="bg-red-50 border border-red-200 rounded p-3 space-y-1">
                <div><strong>رقم العرض:</strong> {deleteOffer?.offerNumber}</div>
                <div><strong>المرشح:</strong> {deleteOffer?.candidateName}</div>
                <div><strong>الوظيفة:</strong> {deleteOffer?.position}</div>
              </div>
              <p className="text-xs text-slate-500">هذا الإجراء متاح للمسؤول (Admin) فقط ويتم تسجيله في السجلات.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOffer(null)} data-testid="btn-cancel-delete">
                إلغاء
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={() => deleteOffer && deleteMutation.mutate(deleteOffer.id)}
                disabled={deleteMutation.isPending}
                data-testid="btn-confirm-delete"
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأكيد الحذف"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

function OfferDetails({ offer }: { offer: JobOffer }) {
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: `JobOffer-${offer.offerNumber}` });
  const total = offer.basicSalary + offer.housingAllowance + offer.transportAllowance + offer.otherAllowances;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => handlePrint()} className="gap-2 bg-amber-600">
          <Printer className="w-4 h-4" /> طباعة / PDF
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
        <Info label="المرشح" value={offer.candidateName} />
        <Info label="الهاتف" value={offer.phone} />
        <Info label="الإيميل" value={offer.email || "-"} />
        <Info label="الوظيفة" value={offer.position} />
        <Info label="الفرع" value={offer.branchName || "-"} />
        <Info label="تاريخ المباشرة" value={offer.startDate} />
        <Info label="مدة العقد" value={`${offer.contractDurationMonths} شهر`} />
        <Info label="فترة التجربة" value={`${offer.probationDays} يوم`} />
        <Info label="الراتب الأساسي" value={offer.basicSalary.toLocaleString("en-US")} />
        <Info label="بدل السكن" value={offer.housingAllowance.toLocaleString("en-US")} />
        <Info label="بدل المواصلات" value={offer.transportAllowance.toLocaleString("en-US")} />
        <Info label="بدلات أخرى" value={offer.otherAllowances.toLocaleString("en-US")} />
        <Info label="الإجمالي الشهري" value={`${total.toLocaleString("en-US")} ر.س`} />
        <Info label="الحالة" value={STATUS_LABELS[offer.status]?.label || offer.status} />
        <Info label="الانتهاء" value={offer.expiresAt ? new Date(offer.expiresAt).toLocaleString("ar-SA") : "-"} />
      </div>

      {offer.status === "accepted" && offer.candidateSignature && (
        <div className="border-2 border-green-300 bg-green-50 rounded p-3">
          <p className="text-sm font-semibold text-green-800 mb-2">
            <CheckCircle2 className="w-4 h-4 inline ml-1" />
            مقبول في {offer.respondedAt ? new Date(offer.respondedAt).toLocaleString("ar-SA") : ""}
          </p>
          <img src={offer.candidateSignature} alt="signature" className="max-h-24 bg-white border rounded" />
        </div>
      )}

      {offer.status === "declined" && (
        <div className="border-2 border-red-300 bg-red-50 rounded p-3">
          <p className="text-sm font-semibold text-red-800">
            <XCircle className="w-4 h-4 inline ml-1" />
            مرفوض في {offer.respondedAt ? new Date(offer.respondedAt).toLocaleString("ar-SA") : ""}
          </p>
          {offer.declineReason && <p className="text-sm mt-1">السبب: {offer.declineReason}</p>}
        </div>
      )}

      <div className="hidden">
        <PrintableOffer ref={printRef} offer={offer} total={total} />
      </div>
    </div>
  );
}

const PrintableOffer = React.forwardRef<HTMLDivElement, { offer: JobOffer; total: number }>(
  ({ offer, total }, ref) => {
    const today = new Date().toLocaleDateString("ar-SA");
    const sentDate = offer.sentAt ? new Date(offer.sentAt).toLocaleDateString("ar-SA") : today;
    const respondedDate = offer.respondedAt ? new Date(offer.respondedAt).toLocaleString("ar-SA") : null;
    const fmt = (n: number) => n.toLocaleString("en-US");

    return (
      <div ref={ref} dir="rtl" className="bg-white">
        <style>{`
          @page { size: A4; margin: 14mm 12mm; }
          @media print {
            .print-page { page-break-inside: avoid; }
            .no-break { page-break-inside: avoid; }
          }
          .print-root { font-family: 'Cairo', system-ui, sans-serif; color: #1a1a1a; }
          .gradient-line { background: linear-gradient(90deg, #1a3a2f 0%, #b88a3a 50%, #1a3a2f 100%); }
          .gold-line { background: linear-gradient(90deg, transparent 0%, #b88a3a 30%, #b88a3a 70%, transparent 100%); }
          .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 380px; height: 380px; opacity: 0.05; pointer-events: none; z-index: 0; }
        `}</style>

        <div className="print-root p-6 relative">
          <img src="/company-logo.png" alt="" className="watermark" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />

          {/* Header / دباجة */}
          <div className="relative z-10">
            <div className="gradient-line h-1.5 mb-2 rounded" />
            <div className="flex items-center justify-between gap-4 pb-2">
              <div className="flex-shrink-0">
                <img
                  src="/company-logo.png"
                  alt="Logo"
                  className="h-24 w-auto object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div className="flex-1 text-center">
                <h1 className="text-xl font-bold text-[#1a3a2f] leading-tight">شركة الزبد الأفضل التجارية</h1>
                <h2 className="text-sm font-semibold text-[#1a3a2f] leading-tight">Best Butter Trading Company</h2>
                <p className="text-xs text-slate-600 mt-0.5">سجل تجاري / C.R: 7026155296 — المملكة العربية السعودية</p>
              </div>
              <div className="flex-shrink-0 text-left text-[10px] text-slate-700 border border-[#1a3a2f] rounded p-2 min-w-[120px]">
                <div><span className="font-bold">رقم العرض:</span> {offer.offerNumber}</div>
                <div><span className="font-bold">التاريخ:</span> {sentDate}</div>
              </div>
            </div>
            <div className="gold-line h-0.5 mb-3" />

            <div className="text-center border-2 border-[#1a3a2f] rounded py-1.5 mb-4 bg-amber-50">
              <h2 className="text-lg font-bold text-[#1a3a2f]">عرض عمل رسمي</h2>
              <p className="text-xs font-semibold text-[#1a3a2f]">Official Job Offer</p>
            </div>
          </div>

          {/* Salutation */}
          <div className="relative z-10 mb-3 text-sm leading-relaxed">
            <p>السلام عليكم ورحمة الله وبركاته،</p>
            <p className="mt-1">
              السيد/ة <strong>{offer.candidateName}</strong>
              {offer.candidateNameEn && <span className="text-slate-600"> ({offer.candidateNameEn})</span>} المحترم/ة،
            </p>
            <p className="mt-2">
              يسعدنا في <strong>شركة الزبد الأفضل التجارية</strong> أن نتقدم إليكم بعرض العمل التالي للانضمام إلى فريقنا في وظيفة
              <strong> {offer.position}</strong>{offer.positionEn && <span className="text-slate-600"> / {offer.positionEn}</span>}.
            </p>
          </div>

          {/* Candidate Info */}
          <div className="relative z-10 no-break mb-3">
            <h3 className="text-sm font-bold text-[#1a3a2f] border-b border-[#b88a3a] pb-1 mb-2">١. بيانات المرشح / Candidate Information</h3>
            <table className="w-full border-collapse text-xs">
              <tbody>
                <PrintRow label="الاسم الكامل" labelEn="Full Name" value={offer.candidateName} />
                {offer.candidateNameEn && <PrintRow label="الاسم بالإنجليزية" labelEn="Name (English)" value={offer.candidateNameEn} />}
                <PrintRow label="الجنسية" labelEn="Nationality" value={offer.nationality || "-"} />
                <PrintRow label="رقم الهوية / الإقامة" labelEn="ID / Iqama No." value={offer.idNumber || "-"} />
                {offer.idPlace && <PrintRow label="مكان الإصدار" labelEn="Issue Place" value={offer.idPlace} />}
                {offer.idExpiry && <PrintRow label="تاريخ الانتهاء" labelEn="Expiry Date" value={offer.idExpiry} />}
                <PrintRow label="رقم الهاتف" labelEn="Phone" value={offer.phone} />
                {offer.email && <PrintRow label="البريد الإلكتروني" labelEn="Email" value={offer.email} />}
                {offer.qualification && <PrintRow label="المؤهل العلمي" labelEn="Qualification" value={offer.qualification} />}
              </tbody>
            </table>
          </div>

          {/* Job Info */}
          <div className="relative z-10 no-break mb-3">
            <h3 className="text-sm font-bold text-[#1a3a2f] border-b border-[#b88a3a] pb-1 mb-2">٢. تفاصيل الوظيفة / Position Details</h3>
            <table className="w-full border-collapse text-xs">
              <tbody>
                <PrintRow label="المسمى الوظيفي" labelEn="Position" value={`${offer.position}${offer.positionEn ? " / " + offer.positionEn : ""}`} />
                {offer.department && <PrintRow label="القسم" labelEn="Department" value={offer.department} />}
                {offer.branchName && <PrintRow label="الفرع / موقع العمل" labelEn="Branch / Work Location" value={offer.branchName} />}
                <PrintRow label="تاريخ المباشرة" labelEn="Start Date" value={offer.startDate} />
                <PrintRow label="مدة العقد" labelEn="Contract Duration" value={`${offer.contractDurationMonths} شهر / ${offer.contractDurationMonths} months`} />
                <PrintRow label="فترة التجربة" labelEn="Probation Period" value={`${offer.probationDays} يوم / ${offer.probationDays} days`} />
                {offer.workingHours && <PrintRow label="ساعات العمل" labelEn="Working Hours" value={offer.workingHours} />}
              </tbody>
            </table>
          </div>

          {/* Salary Breakdown */}
          <div className="relative z-10 no-break mb-3">
            <h3 className="text-sm font-bold text-[#1a3a2f] border-b border-[#b88a3a] pb-1 mb-2">٣. الراتب والبدلات / Salary & Allowances</h3>
            <table className="w-full border-collapse text-xs border-2 border-[#1a3a2f]">
              <thead className="bg-[#1a3a2f] text-white">
                <tr>
                  <th className="border border-[#1a3a2f] p-2 text-right">البند / Item</th>
                  <th className="border border-[#1a3a2f] p-2 text-center w-32">المبلغ (ر.س) / Amount (SAR)</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border p-2">الراتب الأساسي / Basic Salary</td><td className="border p-2 text-center font-mono">{fmt(offer.basicSalary)}</td></tr>
                <tr className="bg-slate-50"><td className="border p-2">بدل السكن / Housing Allowance</td><td className="border p-2 text-center font-mono">{fmt(offer.housingAllowance)}</td></tr>
                <tr><td className="border p-2">بدل المواصلات / Transport Allowance</td><td className="border p-2 text-center font-mono">{fmt(offer.transportAllowance)}</td></tr>
                <tr className="bg-slate-50"><td className="border p-2">بدلات أخرى / Other Allowances</td><td className="border p-2 text-center font-mono">{fmt(offer.otherAllowances)}</td></tr>
                <tr className="bg-amber-100 font-bold">
                  <td className="border-2 border-[#1a3a2f] p-2 text-[#1a3a2f]">الإجمالي الشهري / Monthly Total</td>
                  <td className="border-2 border-[#1a3a2f] p-2 text-center text-[#1a3a2f] font-mono text-sm">{fmt(total)} ر.س</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Benefits */}
          <div className="relative z-10 no-break mb-3">
            <h3 className="text-sm font-bold text-[#1a3a2f] border-b border-[#b88a3a] pb-1 mb-2">٤. المزايا الإضافية / Additional Benefits</h3>
            <table className="w-full border-collapse text-xs">
              <tbody>
                <PrintRow label="الإجازة السنوية" labelEn="Annual Leave" value={`${offer.annualLeaveDays} يوم / ${offer.annualLeaveDays} days`} />
                <PrintRow label="التأمين الطبي" labelEn="Medical Insurance" value={offer.hasMedicalInsurance ? "مشمول / Included" : "غير مشمول / Not included"} />
                <PrintRow label="تذاكر السفر" labelEn="Travel Tickets" value={offer.hasTravelTickets ? "مشمول / Included" : "غير مشمول / Not included"} />
                {offer.benefitsNotes && <PrintRow label="ملاحظات إضافية" labelEn="Additional Notes" value={offer.benefitsNotes} />}
              </tbody>
            </table>
          </div>

          {/* Terms */}
          {offer.termsNotes && (
            <div className="relative z-10 no-break mb-3">
              <h3 className="text-sm font-bold text-[#1a3a2f] border-b border-[#b88a3a] pb-1 mb-2">٥. الشروط والأحكام / Terms & Conditions</h3>
              <div className="text-xs whitespace-pre-wrap border border-slate-300 rounded p-2 bg-slate-50">{offer.termsNotes}</div>
            </div>
          )}

          {/* Status & Signatures */}
          <div className="relative z-10 no-break mt-4">
            <h3 className="text-sm font-bold text-[#1a3a2f] border-b border-[#b88a3a] pb-1 mb-2">٦. حالة العرض والتوقيعات / Status & Signatures</h3>

            {offer.status === "accepted" && (
              <div className="border-2 border-green-600 bg-green-50 rounded p-3 mb-2">
                <p className="text-sm font-bold text-green-800">
                  ✓ تم قبول العرض / Offer Accepted
                  {respondedDate && <span className="font-normal text-xs mr-2"> — {respondedDate}</span>}
                </p>
              </div>
            )}
            {offer.status === "declined" && (
              <div className="border-2 border-red-600 bg-red-50 rounded p-3 mb-2">
                <p className="text-sm font-bold text-red-800">
                  ✗ تم رفض العرض / Offer Declined
                  {respondedDate && <span className="font-normal text-xs mr-2"> — {respondedDate}</span>}
                </p>
                {offer.declineReason && <p className="text-xs mt-1 text-red-700">السبب: {offer.declineReason}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="border border-slate-400 rounded p-2 text-center min-h-[120px] flex flex-col justify-between">
                <p className="text-xs font-bold text-[#1a3a2f]">عن الشركة / Company Representative</p>
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-[10px] text-slate-500">إدارة الموارد البشرية</p>
                </div>
                <div className="border-t border-slate-300 pt-1 mt-2">
                  <p className="text-[10px] text-slate-600">التوقيع والختم / Signature & Stamp</p>
                </div>
              </div>

              <div className="border border-slate-400 rounded p-2 text-center min-h-[120px] flex flex-col justify-between">
                <p className="text-xs font-bold text-[#1a3a2f]">المرشح / Candidate</p>
                <div className="flex-1 flex items-center justify-center">
                  {offer.candidateSignature ? (
                    <img src={offer.candidateSignature} alt="signature" className="max-h-16 object-contain" />
                  ) : (
                    <p className="text-[10px] text-slate-400">في انتظار التوقيع</p>
                  )}
                </div>
                <div className="border-t border-slate-300 pt-1 mt-2">
                  <p className="text-[10px] text-slate-600">{offer.candidateName}</p>
                  {offer.acceptedAtSignature && (
                    <p className="text-[9px] text-slate-500">{new Date(offer.acceptedAtSignature).toLocaleString("ar-SA")}</p>
                  )}
                </div>
              </div>
            </div>

            {offer.candidateIp && (
              <p className="text-[9px] text-slate-500 mt-2 text-center">
                توقيع إلكتروني موثّق — IP: {offer.candidateIp}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="relative z-10 mt-6 pt-2 border-t-2 border-[#1a3a2f]">
            <div className="flex justify-between items-center text-[10px] text-slate-700">
              <p className="font-semibold">شركة الزبد الأفضل التجارية</p>
              <p>C.R: 7026155296</p>
              <p className="font-semibold">Best Butter Trading Company</p>
            </div>
            <div className="gradient-line h-1 mt-1 rounded" />
            <p className="text-center text-[9px] text-slate-500 mt-1">
              هذا المستند صادر إلكترونياً ولا يحتاج إلى توقيع يدوي إن كان موقعاً رقمياً —
              This document is electronically generated.
            </p>
          </div>
        </div>
      </div>
    );
  }
);
PrintableOffer.displayName = "PrintableOffer";

function PrintRow({ label, labelEn, value }: { label: string; labelEn: string; value: string }) {
  return (
    <tr>
      <td className="border border-slate-300 p-1.5 bg-slate-50 w-1/3">
        <div className="font-semibold text-[11px]">{label}</div>
        <div className="text-[9px] text-slate-500">{labelEn}</div>
      </td>
      <td className="border border-slate-300 p-1.5">{value}</td>
    </tr>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded p-2 bg-slate-50">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
