import { useState, useMemo, useRef, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import { CompanyHeader } from "@/components/company-header";
import { EmployeeFileDialog } from "@/components/employee-full-file";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useBranches } from "@/hooks/useBranches";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  UserPlus, ArrowRight, Send, CheckCircle2, Loader2, MapPin, Camera, Eye, Copy,
  ClipboardCheck, Users, Briefcase, Phone, FileText, MessageCircle, XCircle, AlertTriangle,
  Printer, Download, Pencil,
} from "lucide-react";
import type { JobOffer, OnboardingNotification, Branch } from "@shared/schema";

// نفس الـ schema المستخدم في صفحة موظفي الفرع لضمان توحيد البيانات
const employeeFormSchema = z.object({
  branchId: z.string().min(1, "الفرع مطلوب"),
  employeeName: z.string().min(1, "اسم الموظف مطلوب"),
  employeeNameEn: z.string().optional(),
  jobTitle: z.string().min(1, "الوظيفة مطلوبة"),
  department: z.string().optional(),
  nationality: z.string().min(1, "الجنسية مطلوبة"),
  salary: z.coerce.number().min(0, "الراتب يجب أن يكون رقم موجب"),
  housingAllowance: z.coerce.number().min(0).optional(),
  transportAllowance: z.coerce.number().min(0).optional(),
  foodAllowance: z.coerce.number().min(0).optional(),
  otherAllowances: z.coerce.number().min(0).optional(),
  socialInsuranceDeduction: z.coerce.number().min(0).optional(),
  hireDate: z.string().optional(),
  healthCertificate: z.string().optional(),
  healthCertificateExpiry: z.string().optional(),
  iqamaNumber: z.string().optional(),
  iqamaExpiry: z.string().optional(),
  passportNumber: z.string().optional(),
  passportExpiry: z.string().optional(),
  phoneNumber: z.string().optional(),
  emergencyContact: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  status: z.string().default("active"),
  contractType: z.string().optional(),
  workPermitNumber: z.string().optional(),
  notes: z.string().optional(),
  // حساب الدخول الاختياري
  createLogin: z.boolean().default(false),
  username: z.string().optional(),
  password: z.string().optional(),
  role: z.string().optional(),
});
type EmployeeFormData = z.infer<typeof employeeFormSchema>;

const STATUS_OPTIONS_AR = [
  { value: "active", label: "نشط" },
  { value: "inactive", label: "غير نشط" },
  { value: "on_leave", label: "في إجازة" },
  { value: "terminated", label: "منتهي" },
];
const HEALTH_CERT_OPTIONS_AR = [
  { value: "none", label: "لا يوجد" },
  { value: "valid", label: "ساري" },
  { value: "expired", label: "منتهي" },
  { value: "pending", label: "قيد التجديد" },
];

function fmtSAR(v: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v) + " ريال";
}

interface Row { offer: JobOffer; notification: OnboardingNotification | null; }

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "بانتظار الإشعار", color: "bg-slate-200 text-slate-700" },
  sent: { label: "تم الإرسال", color: "bg-blue-100 text-blue-700" },
  signed: { label: "وقّع الموظف", color: "bg-indigo-100 text-indigo-700" },
  confirmed: { label: "تم التأكيد", color: "bg-amber-100 text-amber-700" },
  converted: { label: "تم تحويله لموظف", color: "bg-green-100 text-green-700" },
  cancelled: { label: "ملغي", color: "bg-red-100 text-red-700" },
};

const rowStatus = (r: Row): string => r.notification?.status || "pending";

// تطبيع رقم الجوال السعودي إلى صيغة دولية لـ wa.me ثم التحقق من صحته.
// يدعم: 05x, 5x, 9665x, +9665x, 96605x, 00966... — ويعيد "" لأي رقم غير صالح.
const normalizeSaudiPhone = (raw: string): string => {
  let digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  let normalized = "";
  if (digits.startsWith("9660")) normalized = "966" + digits.slice(4);
  else if (digits.startsWith("966")) normalized = digits;
  else if (digits.startsWith("0")) normalized = "966" + digits.slice(1);
  else if (digits.length === 9 && digits.startsWith("5")) normalized = "966" + digits;
  else normalized = digits;
  // جوال سعودي صالح فقط: 966 + 5 + 8 أرقام
  return /^9665\d{8}$/.test(normalized) ? normalized : "";
};

export default function OnboardingPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [createFor, setCreateFor] = useState<Row | null>(null);
  const [viewRow, setViewRow] = useState<Row | null>(null);
  const [convertRow, setConvertRow] = useState<Row | null>(null);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [fileRow, setFileRow] = useState<Row | null>(null);
  const [shareLink, setShareLink] = useState<{ link: string; phone?: string } | null>(null);

  const { data: rows = [], isLoading } = useQuery<Row[]>({ queryKey: ["/api/hr/onboarding"] });
  const { data: stats } = useQuery<Record<string, number>>({ queryKey: ["/api/hr/onboarding/stats"] });

  const filtered = useMemo(() => {
    let r = rows;
    if (tab === "employee-file") r = r.filter((x) => rowStatus(x) === "converted");
    else if (tab !== "all") r = r.filter((x) => rowStatus(x) === tab);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      r = r.filter(
        (x) =>
          x.offer.candidateName.toLowerCase().includes(s) ||
          x.offer.phone.includes(s) ||
          (x.offer.position || "").toLowerCase().includes(s) ||
          (x.notification?.notificationNumber || "").toLowerCase().includes(s),
      );
    }
    return r;
  }, [rows, tab, search]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/hr/onboarding"] });
    qc.invalidateQueries({ queryKey: ["/api/hr/onboarding/stats"] });
  };

  const sendMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("POST", `/api/hr/onboarding/${id}/send`, {});
      return await r.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.whatsapp?.success ? "تم الإرسال عبر واتساب" : "تم توليد الرابط",
        description: data.whatsapp?.success ? "وصل الإشعار للموظف" : "اضغط نسخ الرابط لإرساله يدوياً",
      });
      setShareLink({ link: data.link, phone: data.phone });
      invalidate();
    },
    onError: (e: any) => toast({ title: "فشل الإرسال", description: e.message, variant: "destructive" }),
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      const r = await apiRequest("POST", `/api/hr/onboarding/${id}/confirm`, { notes });
      return await r.json();
    },
    onSuccess: () => {
      toast({ title: "تم تأكيد المباشرة" });
      invalidate();
    },
    onError: (e: any) => toast({ title: "فشل التأكيد", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const r = await apiRequest("POST", `/api/hr/onboarding/${id}/cancel`, { reason });
      return await r.json();
    },
    onSuccess: () => {
      toast({ title: "تم الإلغاء" });
      invalidate();
    },
    onError: (e: any) => toast({ title: "فشل الإلغاء", description: e.message, variant: "destructive" }),
  });

  const copy = (link: string) => {
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
          icon={UserPlus}
          tone="people"
          title="مباشرة العمل"
          description="إشعارات مباشرة الموظفين الذين قبلوا عرض العمل وتحويلهم لموظفي الفرع"
          actions={
            <Button
              size="sm"
              variant="outline"
              onClick={() => { if (window.history.length > 1) window.history.back(); else setLocation("/"); }}
              className="gap-1"
              data-testid="btn-back"
            >
              <ArrowRight className="w-4 h-4" /> عودة
            </Button>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="الإجمالي" value={stats?.total} color="text-slate-700" icon={FileText} />
          <StatCard label="بانتظار" value={stats?.pending} color="text-slate-600" icon={ClipboardCheck} />
          <StatCard label="تم الإرسال" value={stats?.sent} color="text-blue-600" icon={Send} />
          <StatCard label="وقّع الموظف" value={stats?.signed} color="text-indigo-600" icon={CheckCircle2} />
          <StatCard label="تم التأكيد" value={stats?.confirmed} color="text-amber-600" icon={CheckCircle2} />
          <StatCard label="محوّل لموظف" value={stats?.converted} color="text-green-600" icon={Users} />
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="all">الكل</TabsTrigger>
                  <TabsTrigger value="pending">بانتظار</TabsTrigger>
                  <TabsTrigger value="sent">مُرسل</TabsTrigger>
                  <TabsTrigger value="signed">وقّع</TabsTrigger>
                  <TabsTrigger value="confirmed">مؤكد</TabsTrigger>
                  <TabsTrigger value="converted">محوّل</TabsTrigger>
                  <TabsTrigger value="employee-file" data-testid="tab-employee-file">طباعة ملف موظف</TabsTrigger>
                </TabsList>
              </Tabs>
              <Input
                placeholder="بحث بالاسم/الهاتف/الرقم"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
                data-testid="input-search"
              />
            </div>

            {isLoading ? (
              <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin inline" /></div>
            ) : filtered.length === 0 ? (
              <div className="py-10 text-center text-slate-500">
                لا يوجد موظفون قبلوا عرض العمل بعد. سيظهرون هنا تلقائياً عند القبول.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الموظف</TableHead>
                    <TableHead>الوظيفة</TableHead>
                    <TableHead>الفرع</TableHead>
                    <TableHead>تاريخ المباشرة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإثبات</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const st = rowStatus(r);
                    const info = STATUS[st];
                    const n = r.notification;
                    return (
                      <TableRow key={r.offer.id} data-testid={`row-${r.offer.id}`}>
                        <TableCell>
                          <div className="font-medium">{r.offer.candidateName}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {r.offer.phone}
                          </div>
                          {n && <div className="text-[10px] font-mono text-slate-400 mt-0.5">{n.notificationNumber}</div>}
                        </TableCell>
                        <TableCell>{r.offer.position}</TableCell>
                        <TableCell>{r.offer.branchName || "-"}</TableCell>
                        <TableCell className="text-xs">{n?.actualStartDate || r.offer.startDate}</TableCell>
                        <TableCell><Badge className={info.color}>{info.label}</Badge></TableCell>
                        <TableCell>
                          {n?.selfiePhotoUrl ? (
                            <div className="flex items-center gap-1">
                              <a href={n.selfiePhotoUrl} target="_blank" rel="noreferrer" title="عرض الصورة">
                                <img src={n.selfiePhotoUrl} alt="" className="w-10 h-10 object-cover rounded border" />
                              </a>
                              {n.selfieLat != null && n.selfieLng != null && (
                                <a
                                  href={`https://www.google.com/maps?q=${n.selfieLat},${n.selfieLng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="عرض الموقع"
                                >
                                  <MapPin className={`w-4 h-4 ${n.withinBranchRadius ? "text-green-600" : "text-amber-600"}`} />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => setViewRow(r)} data-testid={`btn-view-${r.offer.id}`} title="تفاصيل">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            {!n && (
                              <Button
                                size="sm"
                                className="bg-amber-600 hover:bg-amber-700 gap-1"
                                onClick={() => setCreateFor(r)}
                                data-testid={`btn-create-${r.offer.id}`}
                              >
                                <ClipboardCheck className="w-3.5 h-3.5" /> إنشاء إشعار
                              </Button>
                            )}
                            {n && ["pending", "sent"].includes(n.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-amber-500 text-amber-700 hover:bg-amber-50 gap-1"
                                onClick={() => setEditRow(r)}
                                data-testid={`btn-edit-${n.id}`}
                                title="تعديل قبل الإرسال"
                              >
                                <Pencil className="w-3.5 h-3.5" /> تعديل
                              </Button>
                            )}
                            {n && ["pending", "sent"].includes(n.status) && (
                              <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 gap-1"
                                onClick={() => sendMutation.mutate(n.id)}
                                disabled={sendMutation.isPending}
                                data-testid={`btn-send-${n.id}`}
                              >
                                <Send className="w-3.5 h-3.5" /> {n.status === "sent" ? "إعادة إرسال" : "إرسال"}
                              </Button>
                            )}
                            {n && n.status === "signed" && (
                              <Button
                                size="sm"
                                className="bg-amber-600 hover:bg-amber-700 gap-1"
                                onClick={() => confirmMutation.mutate({ id: n.id })}
                                disabled={confirmMutation.isPending}
                                data-testid={`btn-confirm-${n.id}`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> تأكيد
                              </Button>
                            )}
                            {n && n.status === "confirmed" && (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 gap-1"
                                onClick={() => setConvertRow(r)}
                                data-testid={`btn-convert-${n.id}`}
                              >
                                <Users className="w-3.5 h-3.5" /> تحويل لموظف
                              </Button>
                            )}
                            {n && n.status === "converted" && (
                              <Button
                                size="sm"
                                className="bg-[#1a3a2f] hover:bg-[#2d5a47] gap-1 text-white"
                                onClick={() => setFileRow(r)}
                                data-testid={`btn-employee-file-${n.id}`}
                                title="تحميل الملف الكامل للموظف"
                              >
                                <Download className="w-3.5 h-3.5" /> الملف الكامل
                              </Button>
                            )}
                            {n && !["converted", "cancelled"].includes(n.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                onClick={() => {
                                  const reason = prompt("سبب الإلغاء؟") || "";
                                  cancelMutation.mutate({ id: n.id, reason });
                                }}
                                title="إلغاء"
                              >
                                <XCircle className="w-3.5 h-3.5" />
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

        {/* Create Notification Dialog */}
        <CreateDialog row={createFor} onClose={() => setCreateFor(null)} onSuccess={invalidate} />

        {/* View Details Dialog */}
        <ViewDialog row={viewRow} onClose={() => setViewRow(null)} />

        {/* Convert to Employee Dialog */}
        <ConvertDialog row={convertRow} onClose={() => setConvertRow(null)} onSuccess={invalidate} />

        {/* Edit Notification Dialog */}
        <EditDialog row={editRow} onClose={() => setEditRow(null)} onSuccess={invalidate} />

        {/* Full Employee File Dialog */}
        <EmployeeFileDialog
          notificationId={fileRow?.notification?.id ?? null}
          candidateName={fileRow?.offer?.candidateName || ""}
          onClose={() => setFileRow(null)}
        />

        {/* Share Link Dialog */}
        <Dialog open={!!shareLink} onOpenChange={(o) => !o && setShareLink(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>رابط إشعار المباشرة جاهز</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="bg-slate-50 border rounded p-3 break-all text-sm" dir="ltr">{shareLink?.link}</div>
              {(() => {
                const waPhone = normalizeSaudiPhone(shareLink?.phone || "");
                return (
                  <>
                    {!waPhone && (
                      <p className="text-xs text-amber-600">
                        لا يوجد رقم جوال صالح لهذا الموظف — سيُفتح واتساب بدون تحديد المستلم. أضف رقم الجوال في بيانات الموظف لفتح المحادثة معه مباشرة.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button onClick={() => shareLink && copy(shareLink.link)} className="flex-1 gap-2">
                        <Copy className="w-4 h-4" /> نسخ الرابط
                      </Button>
                      {shareLink && (
                        <a
                          href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`🥐 *Butter Bakery* — إشعار مباشرة العمل\n\nرابط التوقيع (يفتح داخل الفرع):\n${shareLink.link}`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1"
                          data-testid="link-open-whatsapp"
                        >
                          <Button className="w-full gap-2 bg-green-600 hover:bg-green-700">
                            <MessageCircle className="w-4 h-4" /> فتح واتساب
                          </Button>
                        </a>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

function CreateDialog({ row, onClose, onSuccess }: { row: Row | null; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [actualStartDate, setActualStartDate] = useState("");
  const [workingHours, setWorkingHours] = useState("");
  const [reportingTo, setReportingTo] = useState("");
  const [notes, setNotes] = useState("");
  const [validityDays, setValidityDays] = useState(7);
  const [branchId, setBranchId] = useState<string>("");

  const offerHasBranch = !!row?.offer.branchId;

  const { data: branches = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/branches"],
    enabled: !!row && !offerHasBranch,
  });

  useMemo(() => {
    if (row) {
      setActualStartDate(row.offer.startDate || "");
      setWorkingHours(row.offer.workingHours || "");
      setReportingTo("");
      setNotes("");
      setValidityDays(7);
      setBranchId("");
    }
  }, [row?.offer.id]);

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/hr/onboarding", {
        jobOfferId: row!.offer.id,
        actualStartDate,
        workingHours,
        reportingTo,
        notes,
        validityDays,
        ...(offerHasBranch ? {} : { branchId }),
      });
      return await r.json();
    },
    onSuccess: () => {
      toast({ title: "تم إنشاء الإشعار", description: "اضغط 'إرسال' لإرساله للموظف" });
      onSuccess();
      onClose();
    },
    onError: (e: any) => toast({ title: "فشل الإنشاء", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>إنشاء إشعار مباشرة عمل</DialogTitle></DialogHeader>
        {row && (
          <div className="space-y-3 text-sm">
            <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-1">
              <div><strong>الموظف:</strong> {row.offer.candidateName}</div>
              <div><strong>الوظيفة:</strong> {row.offer.position}</div>
              <div><strong>الفرع:</strong> {row.offer.branchName || <span className="text-red-600">غير محدد — اختر من الأسفل</span>}</div>
            </div>
            {!offerHasBranch && (
              <div className="space-y-1">
                <Label>الفرع *</Label>
                <select
                  className="w-full border rounded h-10 px-2 bg-white"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  data-testid="select-branch"
                >
                  <option value="">-- اختر الفرع --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <Label>تاريخ المباشرة الفعلي *</Label>
              <Input type="date" value={actualStartDate} onChange={(e) => setActualStartDate(e.target.value)} data-testid="input-start-date" />
            </div>
            <div className="space-y-1">
              <Label>ساعات الدوام</Label>
              <Input value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} placeholder="مثال: 8 ساعات / 6 أيام" />
            </div>
            <div className="space-y-1">
              <Label>المسؤول المباشر</Label>
              <Input value={reportingTo} onChange={(e) => setReportingTo(e.target.value)} placeholder="اسم مدير الفرع" />
            </div>
            <div className="space-y-1">
              <Label>ملاحظات</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>صلاحية الرابط (أيام)</Label>
              <Input type="number" min={1} max={30} value={validityDays} onChange={(e) => setValidityDays(Number(e.target.value))} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button
            className="bg-amber-600 hover:bg-amber-700"
            onClick={() => {
              if (!actualStartDate) {
                toast({ title: "تاريخ المباشرة مطلوب", variant: "destructive" });
                return;
              }
              if (!offerHasBranch && !branchId) {
                toast({ title: "اختر الفرع أولاً", variant: "destructive" });
                return;
              }
              mutation.mutate();
            }}
            disabled={mutation.isPending}
            data-testid="btn-create-submit"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "إنشاء الإشعار"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ row, onClose, onSuccess }: { row: Row | null; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const n = row?.notification || null;
  const [actualStartDate, setActualStartDate] = useState("");
  const [workingHours, setWorkingHours] = useState("");
  const [reportingTo, setReportingTo] = useState("");
  const [notes, setNotes] = useState("");
  const [validityDays, setValidityDays] = useState(7);

  useEffect(() => {
    if (n) {
      setActualStartDate(n.actualStartDate || "");
      setWorkingHours(n.workingHours || "");
      setReportingTo(n.reportingTo || "");
      setNotes(n.notes || "");
      setValidityDays(n.validityDays || 7);
    }
  }, [n?.id]);

  const mutation = useMutation({
    mutationFn: async () => {
      const safeValidity = Math.min(30, Math.max(1, Number(validityDays) || 7));
      const r = await apiRequest("PATCH", `/api/hr/onboarding/${n!.id}`, {
        actualStartDate,
        workingHours,
        reportingTo,
        notes,
        validityDays: safeValidity,
      });
      return await r.json();
    },
    onSuccess: () => {
      toast({ title: "تم حفظ التعديلات", description: "يمكنك الآن إرسال الإشعار للموظف" });
      onSuccess();
      onClose();
    },
    onError: (e: any) => toast({ title: "فشل التعديل", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>تعديل إشعار مباشرة العمل</DialogTitle></DialogHeader>
        {n && (
          <div className="space-y-3 text-sm">
            <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-1">
              <div><strong>الموظف:</strong> {n.candidateName}</div>
              <div><strong>الوظيفة:</strong> {n.position}</div>
              <div><strong>الفرع:</strong> {n.branchName || "-"}</div>
              {n.status === "sent" && (
                <div className="text-xs text-blue-700 pt-1">
                  ملاحظة: تم إرسال هذا الإشعار سابقاً — بعد التعديل اضغط «إعادة إرسال» ليصل الموظف النسخة المحدّثة.
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label>تاريخ المباشرة الفعلي *</Label>
              <Input type="date" value={actualStartDate} onChange={(e) => setActualStartDate(e.target.value)} data-testid="input-edit-start-date" />
            </div>
            <div className="space-y-1">
              <Label>ساعات الدوام</Label>
              <Input value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} placeholder="مثال: 8 ساعات / 6 أيام" data-testid="input-edit-working-hours" />
            </div>
            <div className="space-y-1">
              <Label>المسؤول المباشر</Label>
              <Input value={reportingTo} onChange={(e) => setReportingTo(e.target.value)} placeholder="اسم مدير الفرع" data-testid="input-edit-reporting-to" />
            </div>
            <div className="space-y-1">
              <Label>ملاحظات</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} data-testid="input-edit-notes" />
            </div>
            <div className="space-y-1">
              <Label>صلاحية الرابط (أيام)</Label>
              <Input type="number" min={1} max={30} value={validityDays} onChange={(e) => setValidityDays(Number(e.target.value))} data-testid="input-edit-validity-days" />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button
            className="bg-amber-600 hover:bg-amber-700"
            onClick={() => {
              if (!actualStartDate) {
                toast({ title: "تاريخ المباشرة مطلوب", variant: "destructive" });
                return;
              }
              mutation.mutate();
            }}
            disabled={mutation.isPending}
            data-testid="btn-edit-submit"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ التعديلات"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewDialog({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const { data } = useQuery<{ notification: OnboardingNotification; offer: JobOffer }>({
    queryKey: ["/api/hr/onboarding", row?.notification?.id],
    enabled: !!row?.notification?.id,
  });
  const n = data?.notification || row?.notification;
  const o = data?.offer || row?.offer;
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `إشعار-مباشرة-العمل-${row?.offer?.candidateName || ""}`,
  });

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>تفاصيل المباشرة</span>
            {row && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handlePrint()} className="gap-1 bg-amber-600 hover:bg-amber-700 text-white" data-testid="btn-print-onboarding">
                  <Printer className="w-4 h-4" /> طباعة
                </Button>
                <Button size="sm" onClick={() => handlePrint()} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" data-testid="btn-pdf-onboarding" title="من نافذة الطباعة اختر: حفظ كـ PDF">
                  <Download className="w-4 h-4" /> حفظ PDF
                </Button>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>
        {row && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <Info label="الموظف" value={row.offer.candidateName} />
              <Info label="الهاتف" value={row.offer.phone} />
              <Info label="الوظيفة" value={row.offer.position} />
              <Info label="الفرع" value={row.offer.branchName || "-"} />
              <Info label="تاريخ المباشرة" value={n?.actualStartDate || row.offer.startDate} />
              <Info label="ساعات الدوام" value={n?.workingHours || "-"} />
              {n?.reportingTo && <Info label="المسؤول المباشر" value={n.reportingTo} />}
              {n?.notes && <Info label="ملاحظات" value={n.notes} />}
            </div>

            {n?.selfiePhotoUrl && (
              <div className="border-2 border-indigo-200 rounded p-3 bg-indigo-50 space-y-2">
                <p className="font-semibold text-indigo-800 flex items-center gap-2">
                  <Camera className="w-4 h-4" /> صورة الإثبات في الفرع
                </p>
                <a href={n.selfiePhotoUrl} target="_blank" rel="noreferrer">
                  <img src={n.selfiePhotoUrl} alt="" className="w-full max-w-md mx-auto rounded border" />
                </a>
                <div className="flex flex-wrap gap-2 text-xs">
                  {n.selfieLat != null && n.selfieLng != null && (
                    <a
                      href={`https://www.google.com/maps?q=${n.selfieLat},${n.selfieLng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-white border rounded px-2 py-1 inline-flex items-center gap-1 text-blue-600"
                    >
                      <MapPin className="w-3 h-3" /> {n.selfieLat.toFixed(5)}, {n.selfieLng.toFixed(5)}
                    </a>
                  )}
                  {n.distanceFromBranchM != null && (
                    <span className={`border rounded px-2 py-1 ${n.withinBranchRadius ? "bg-green-100 text-green-700 border-green-300" : "bg-amber-100 text-amber-700 border-amber-300"}`}>
                      {n.withinBranchRadius ? "✓ داخل نطاق الفرع" : "⚠ خارج نطاق الفرع"} ({n.distanceFromBranchM}م)
                    </span>
                  )}
                  {n.signedAt && <span className="bg-white border rounded px-2 py-1">وقّع: {new Date(n.signedAt).toLocaleString("ar-SA-u-nu-latn")}</span>}
                </div>
              </div>
            )}

            {n?.employeeSignature && (
              <div className="border-2 border-green-200 rounded p-3 bg-green-50">
                <p className="font-semibold text-green-800 mb-2">توقيع الموظف</p>
                <img src={n.employeeSignature} alt="signature" className="max-h-24 bg-white border rounded" />
              </div>
            )}
          </div>
        )}

        {/* قالب الطباعة المخفي — يظهر فقط أثناء الطباعة/PDF */}
        {row && (
          <div className="hidden">
            <div ref={printRef} className="p-4 bg-white text-sm" dir="rtl" style={{ minHeight: "100vh" }}>
              <CompanyHeader templateTitle="إشعار مباشرة العمل" templateTitleEn="Work Commencement Notice" />

              <div className="border border-slate-300 rounded p-3 mb-3 mt-3">
                <h3 className="font-bold text-[#1a3a2f] mb-2 border-b border-[#1a3a2f] pb-1 text-sm">
                  1. بيانات الموظف / Employee Data
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="font-semibold">الاسم:</span> {row.offer.candidateName}</div>
                  <div><span className="font-semibold">الهاتف:</span> {row.offer.phone || "-"}</div>
                  <div><span className="font-semibold">الوظيفة:</span> {row.offer.position}</div>
                  <div><span className="font-semibold">الفرع:</span> {row.offer.branchName || "-"}</div>
                  <div><span className="font-semibold">الراتب الأساسي:</span> {row.offer.basicSalary || "-"} ر.س</div>
                  <div><span className="font-semibold">الجنسية:</span> {(row.offer as any).nationality || "-"}</div>
                </div>
              </div>

              <div className="border border-slate-300 rounded p-3 mb-3">
                <h3 className="font-bold text-[#1a3a2f] mb-2 border-b border-[#1a3a2f] pb-1 text-sm">
                  2. تفاصيل المباشرة / Onboarding Details
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="font-semibold">تاريخ المباشرة الفعلي:</span> {n?.actualStartDate || row.offer.startDate || "-"}</div>
                  <div><span className="font-semibold">ساعات الدوام:</span> {n?.workingHours || "-"}</div>
                  <div><span className="font-semibold">المسؤول المباشر:</span> {n?.reportingTo || "-"}</div>
                  <div><span className="font-semibold">الحالة:</span> {STATUS[n?.status || "pending"]?.label || "-"}</div>
                  {n?.notes && (
                    <div className="col-span-2"><span className="font-semibold">ملاحظات:</span> {n.notes}</div>
                  )}
                </div>
              </div>

              {n?.selfiePhotoUrl && (
                <div className="border border-slate-300 rounded p-3 mb-3">
                  <h3 className="font-bold text-[#1a3a2f] mb-2 border-b border-[#1a3a2f] pb-1 text-sm">
                    3. إثبات الحضور في الفرع / Branch Attendance Proof
                  </h3>
                  <div className="flex gap-3 items-start">
                    <img src={n.selfiePhotoUrl} alt="selfie" className="w-40 h-40 object-cover border rounded" crossOrigin="anonymous" />
                    <div className="text-xs space-y-1 flex-1">
                      {n.selfieLat != null && n.selfieLng != null && (
                        <div><span className="font-semibold">الإحداثيات:</span> {n.selfieLat.toFixed(5)}, {n.selfieLng.toFixed(5)}</div>
                      )}
                      {n.distanceFromBranchM != null && (
                        <div>
                          <span className="font-semibold">المسافة من الفرع:</span> {n.distanceFromBranchM} متر
                          {n.withinBranchRadius ? " ✓ ضمن النطاق" : " ⚠ خارج النطاق"}
                        </div>
                      )}
                      {n.signedAt && (
                        <div><span className="font-semibold">وقت التوقيع:</span> {new Date(n.signedAt).toLocaleString("ar-SA-u-nu-latn")}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-6">
                <div className="border border-slate-300 rounded p-3 min-h-[120px]">
                  <p className="font-semibold text-xs mb-2 text-center">توقيع الموظف / Employee Signature</p>
                  {n?.employeeSignature ? (
                    <img src={n.employeeSignature} alt="signature" className="max-h-20 mx-auto" crossOrigin="anonymous" />
                  ) : (
                    <div className="h-20" />
                  )}
                  <p className="text-[10px] text-center text-slate-500 mt-2">
                    {n?.signedAt ? new Date(n.signedAt).toLocaleString("ar-SA-u-nu-latn") : ""}
                  </p>
                </div>
                <div className="border border-slate-300 rounded p-3 min-h-[120px]">
                  <p className="font-semibold text-xs mb-2 text-center">توقيع مدير الموارد البشرية</p>
                  <div className="h-20" />
                  <p className="text-[10px] text-center text-slate-500 mt-2">التاريخ: ___ / ___ / ______</p>
                </div>
              </div>

              <div className="mt-6 text-center text-[10px] text-slate-500 border-t pt-2">
                هذه الوثيقة مولّدة إلكترونياً من نظام باتر لإدارة الموارد البشرية
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConvertDialog({ row, onClose, onSuccess }: { row: Row | null; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const { branches } = useBranches();

  // جلب الإعدادات (الوظائف، الجنسيات، الأقسام، البنوك، أنواع العقود) — نفس مصدر صفحة موظفي الفرع
  const { data: settingsData, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["/api/employee-settings"],
    queryFn: async () => {
      const res = await fetch("/api/employee-settings", { credentials: "include" });
      if (!res.ok) throw new Error("فشل جلب الإعدادات");
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
  });
  const settingsByCategory = useMemo(() => {
    const g: Record<string, any[]> = {};
    (settingsData || []).forEach((s: any) => {
      if (!g[s.category]) g[s.category] = [];
      g[s.category].push(s);
    });
    return g;
  }, [settingsData]);

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      branchId: "",
      employeeName: "",
      employeeNameEn: "",
      jobTitle: "",
      department: "",
      nationality: "",
      salary: 0,
      housingAllowance: 0,
      transportAllowance: 0,
      foodAllowance: 0,
      otherAllowances: 0,
      socialInsuranceDeduction: 0,
      status: "active",
      healthCertificate: "none",
      createLogin: false,
      role: "employee",
    },
  });

  // مراقبة الحقول الديناميكية
  const wBranch = useWatch({ control: form.control, name: "branchId" });
  const wStatus = useWatch({ control: form.control, name: "status" });
  const wJob = useWatch({ control: form.control, name: "jobTitle" });
  const wNat = useWatch({ control: form.control, name: "nationality" });
  const wDept = useWatch({ control: form.control, name: "department" });
  const wHealth = useWatch({ control: form.control, name: "healthCertificate" });
  const wBank = useWatch({ control: form.control, name: "bankName" });
  const wContract = useWatch({ control: form.control, name: "contractType" });
  const wSalary = useWatch({ control: form.control, name: "salary" });
  const wHousing = useWatch({ control: form.control, name: "housingAllowance" });
  const wTransport = useWatch({ control: form.control, name: "transportAllowance" });
  const wFood = useWatch({ control: form.control, name: "foodAllowance" });
  const wOther = useWatch({ control: form.control, name: "otherAllowances" });
  const wSocialIns = useWatch({ control: form.control, name: "socialInsuranceDeduction" });
  const wCreateLogin = useWatch({ control: form.control, name: "createLogin" });
  const wRole = useWatch({ control: form.control, name: "role" });

  // الفرع يُقفل فقط إذا كان عرض العمل/الإشعار مرتبطاً بفرع؛ وإلا يمكن اختياره يدوياً
  const offerHasBranch = !!(row?.offer as any)?.branchId;

  // تعبئة تلقائية من بيانات عرض العمل والإشعار عند فتح النافذة
  useEffect(() => {
    if (row) {
      const o = row.offer as any;
      const n = row.notification as any;
      const suggested = row.offer.email?.split("@")[0] || row.offer.phone?.replace(/\D/g, "") || "";
      form.reset({
        branchId: o.branchId || "",
        employeeName: row.offer.candidateName || "",
        employeeNameEn: "",
        jobTitle: row.offer.position || "",
        department: "",
        nationality: o.nationality || "",
        salary: Number(o.basicSalary ?? 0),
        housingAllowance: Number(o.housingAllowance ?? 0),
        transportAllowance: Number(o.transportAllowance ?? 0),
        foodAllowance: 0,
        otherAllowances: Number(o.otherAllowances ?? 0),
        socialInsuranceDeduction: 0,
        hireDate: n?.actualStartDate || row.offer.startDate || "",
        healthCertificate: "none",
        healthCertificateExpiry: "",
        iqamaNumber: o.idNumber || "",
        iqamaExpiry: "",
        passportNumber: "",
        passportExpiry: "",
        phoneNumber: row.offer.phone || "",
        emergencyContact: "",
        bankName: "",
        bankAccountNumber: "",
        status: "active",
        contractType: "",
        workPermitNumber: "",
        notes: "",
        createLogin: false,
        username: suggested,
        password: "",
        role: "employee",
      });
    }
  }, [row?.offer.id, row?.notification?.id]);

  const mutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      // الفرع قابل للتعديل: نستخدم اختيار المستخدم، ونرجع لفرع الإشعار فقط إن تُرك فارغاً
      const payload = { ...data, branchId: data.branchId || (row?.offer as any)?.branchId };
      const r = await apiRequest("POST", `/api/hr/onboarding/${row!.notification!.id}/convert`, payload);
      return await r.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "تم تسجيل الموظف",
        description: data?.message || "تمت إضافته في موظفي الفرع",
      });
      onSuccess();
      onClose();
    },
    onError: (e: any) => toast({ title: "فشل التحويل", description: e.message, variant: "destructive" }),
  });

  const onSubmit = (data: EmployeeFormData) => {
    if (data.createLogin && (!data.username || !data.password)) {
      toast({ title: "اسم المستخدم وكلمة المرور مطلوبان لحساب الدخول", variant: "destructive" });
      return;
    }
    mutation.mutate(data);
  };

  // حساب الإجماليات
  const allowancesSum = Number(wSalary || 0) + Number(wHousing || 0) + Number(wTransport || 0) +
    Number(wFood || 0) + Number(wOther || 0);
  const socialIns = wNat === "سعودي" ? Number(wSocialIns || 0) : 0;
  const netSalary = allowancesSum - socialIns;

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>إضافة موظف جديد (من إشعار مباشرة العمل)</DialogTitle>
          <p className="text-sm text-slate-500">أدخل بيانات الموظف الأساسية والرواتب والمستندات</p>
        </DialogHeader>
        {row && (
          <div className="bg-green-50 border border-green-200 rounded p-2 text-xs mb-2">
            ✓ تم تأكيد مباشرة <strong>{row.offer.candidateName}</strong>
            {offerHasBranch
              ? <> في فرع <strong>{row.offer.branchName}</strong></>
              : <> — <strong className="text-amber-700">الفرع غير محدد، يرجى اختياره أدناه</strong></>}
            {" — "}البيانات معبّأة تلقائياً من عرض العمل.
          </div>
        )}
        <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
          const errorMessages = Object.values(errors).map((e: any) => e?.message).filter(Boolean);
          if (errorMessages.length > 0) {
            toast({ title: "يرجى تعبئة الحقول المطلوبة", description: errorMessages.join("، "), variant: "destructive" });
          }
        })} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="basic">البيانات الأساسية</TabsTrigger>
              <TabsTrigger value="salary">الراتب والبدلات</TabsTrigger>
              <TabsTrigger value="documents">المستندات</TabsTrigger>
              <TabsTrigger value="contact">التواصل والبنك</TabsTrigger>
              <TabsTrigger value="login">حساب الدخول</TabsTrigger>
            </TabsList>

            {/* ============= TAB 1: البيانات الأساسية ============= */}
            <TabsContent value="basic" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الفرع *</Label>
                  <Select
                    value={wBranch}
                    onValueChange={(v) => form.setValue("branchId", v, { shouldValidate: true })}
                  >
                    <SelectTrigger
                      data-testid="select-branch"
                      className={form.formState.errors.branchId ? "border-red-500" : ""}
                    >
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches?.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {offerHasBranch ? (
                    <p className="text-xs text-slate-500">معبّأ تلقائياً من الإشعار — يمكنك تغييره عند الحاجة</p>
                  ) : (
                    <p className="text-xs text-amber-600">عرض العمل غير مرتبط بفرع — اختر الفرع يدوياً</p>
                  )}
                  {form.formState.errors.branchId && (
                    <p className="text-sm text-red-500">{form.formState.errors.branchId.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>الحالة</Label>
                  <Select value={wStatus} onValueChange={(v) => form.setValue("status", v)}>
                    <SelectTrigger data-testid="select-status"><SelectValue placeholder="اختر الحالة" /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS_AR.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اسم الموظف بالعربي *</Label>
                  <Input {...form.register("employeeName")} placeholder="أدخل الاسم بالعربي" data-testid="input-name-ar" />
                  {form.formState.errors.employeeName && <p className="text-sm text-red-500">{form.formState.errors.employeeName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>اسم الموظف بالإنجليزي</Label>
                  <Input {...form.register("employeeNameEn")} placeholder="Enter name in English" dir="ltr" data-testid="input-name-en" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الوظيفة *</Label>
                  <Select value={wJob} onValueChange={(v) => form.setValue("jobTitle", v, { shouldValidate: true })}>
                    <SelectTrigger data-testid="select-job" className={form.formState.errors.jobTitle ? "border-red-500" : ""}>
                      <SelectValue placeholder="اختر الوظيفة" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {isLoadingSettings ? <SelectItem value="" disabled>جاري التحميل...</SelectItem>
                        : (settingsByCategory.job_title?.filter((s: any) => s.isActive) || []).length > 0
                          ? settingsByCategory.job_title?.filter((s: any) => s.isActive).map((job: any) => (
                              <SelectItem key={job.id} value={job.labelAr}>{job.labelAr}</SelectItem>))
                          : <SelectItem value="" disabled>لا توجد وظائف - أضف من الإعدادات</SelectItem>}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.jobTitle && <p className="text-sm text-red-500">{form.formState.errors.jobTitle.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>الجنسية *</Label>
                  <Select value={wNat} onValueChange={(v) => {
                    form.setValue("nationality", v, { shouldValidate: true });
                    if (v !== "سعودي") form.setValue("socialInsuranceDeduction", 0);
                  }}>
                    <SelectTrigger data-testid="select-nationality" className={form.formState.errors.nationality ? "border-red-500" : ""}>
                      <SelectValue placeholder="اختر الجنسية" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {isLoadingSettings ? <SelectItem value="" disabled>جاري التحميل...</SelectItem>
                        : (settingsByCategory.nationality?.filter((s: any) => s.isActive) || []).length > 0
                          ? settingsByCategory.nationality?.filter((s: any) => s.isActive).map((nat: any) => (
                              <SelectItem key={nat.id} value={nat.labelAr}>{nat.labelAr}</SelectItem>))
                          : <SelectItem value="" disabled>لا توجد جنسيات - أضف من الإعدادات</SelectItem>}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.nationality && <p className="text-sm text-red-500">{form.formState.errors.nationality.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>القسم</Label>
                  <Select value={wDept || ""} onValueChange={(v) => form.setValue("department", v)}>
                    <SelectTrigger data-testid="select-department"><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {isLoadingSettings ? <SelectItem value="" disabled>جاري التحميل...</SelectItem>
                        : (settingsByCategory.department?.filter((s: any) => s.isActive) || []).length > 0
                          ? settingsByCategory.department?.filter((s: any) => s.isActive).map((d: any) => (
                              <SelectItem key={d.id} value={d.labelAr}>{d.labelAr}</SelectItem>))
                          : <SelectItem value="" disabled>لا توجد أقسام - أضف من الإعدادات</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>تاريخ التعيين</Label>
                  <Input type="date" {...form.register("hireDate")} data-testid="input-hire-date" />
                </div>
              </div>
            </TabsContent>

            {/* ============= TAB 2: الراتب والبدلات ============= */}
            <TabsContent value="salary" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الراتب الأساسي (ريال) *</Label>
                  <Input type="number" {...form.register("salary")} placeholder="0" data-testid="input-salary" />
                </div>
                <div className="space-y-2">
                  <Label>بدل السكن (ريال)</Label>
                  <Input type="number" {...form.register("housingAllowance")} placeholder="0" data-testid="input-housing" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>بدل المواصلات (ريال)</Label>
                  <Input type="number" {...form.register("transportAllowance")} placeholder="0" data-testid="input-transport" />
                </div>
                <div className="space-y-2">
                  <Label>بدل الطعام (ريال)</Label>
                  <Input type="number" {...form.register("foodAllowance")} placeholder="0" data-testid="input-food" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>بدلات أخرى (ريال)</Label>
                <Input type="number" {...form.register("otherAllowances")} placeholder="0" data-testid="input-other" />
              </div>
              {wNat === "سعودي" && (
                <div className="space-y-2">
                  <Label className="text-red-600">خصم التأمينات الاجتماعية (ريال) - للسعوديين</Label>
                  <Input type="number" {...form.register("socialInsuranceDeduction")} placeholder="0"
                    className="border-red-200 focus:border-red-400" data-testid="input-social-insurance" />
                  <p className="text-xs text-gray-500">يتم خصم هذا المبلغ من إجمالي الراتب</p>
                </div>
              )}
              <Card className="bg-amber-50">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between items-center text-sm text-gray-600">
                    <span>مجموع الراتب والبدلات:</span>
                    <span>{fmtSAR(allowancesSum)}</span>
                  </div>
                  {wNat === "سعودي" && socialIns > 0 && (
                    <div className="flex justify-between items-center text-sm text-red-600">
                      <span>خصم التأمينات الاجتماعية:</span>
                      <span>- {fmtSAR(socialIns)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="font-bold">صافي الراتب:</span>
                    <span className="text-xl font-bold text-amber-700">{fmtSAR(netSalary)}</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ============= TAB 3: المستندات ============= */}
            <TabsContent value="documents" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>حالة الشهادة الصحية</Label>
                  <Select value={wHealth} onValueChange={(v) => form.setValue("healthCertificate", v)}>
                    <SelectTrigger data-testid="select-health-cert"><SelectValue placeholder="اختر الحالة" /></SelectTrigger>
                    <SelectContent>
                      {HEALTH_CERT_OPTIONS_AR.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>تاريخ انتهاء الشهادة الصحية</Label>
                  <Input type="date" {...form.register("healthCertificateExpiry")} data-testid="input-health-expiry" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>رقم الإقامة</Label>
                  <Input {...form.register("iqamaNumber")} placeholder="أدخل رقم الإقامة" dir="ltr" data-testid="input-iqama" />
                </div>
                <div className="space-y-2">
                  <Label>تاريخ انتهاء الإقامة</Label>
                  <Input type="date" {...form.register("iqamaExpiry")} data-testid="input-iqama-expiry" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>رقم الجواز</Label>
                  <Input {...form.register("passportNumber")} placeholder="أدخل رقم الجواز" dir="ltr" data-testid="input-passport" />
                </div>
                <div className="space-y-2">
                  <Label>تاريخ انتهاء الجواز</Label>
                  <Input type="date" {...form.register("passportExpiry")} data-testid="input-passport-expiry" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>رقم رخصة العمل</Label>
                <Input {...form.register("workPermitNumber")} placeholder="أدخل رقم رخصة العمل" dir="ltr" data-testid="input-work-permit" />
              </div>
            </TabsContent>

            {/* ============= TAB 4: التواصل والبنك ============= */}
            <TabsContent value="contact" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>رقم الجوال</Label>
                  <Input {...form.register("phoneNumber")} placeholder="05xxxxxxxx" dir="ltr" data-testid="input-phone" />
                </div>
                <div className="space-y-2">
                  <Label>رقم الطوارئ</Label>
                  <Input {...form.register("emergencyContact")} placeholder="رقم للتواصل في الطوارئ" dir="ltr" data-testid="input-emergency" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اسم البنك</Label>
                  <Select value={wBank || ""} onValueChange={(v) => form.setValue("bankName", v)}>
                    <SelectTrigger data-testid="select-bank"><SelectValue placeholder="اختر البنك" /></SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {isLoadingSettings ? <SelectItem value="" disabled>جاري التحميل...</SelectItem>
                        : (settingsByCategory.bank?.filter((s: any) => s.isActive) || []).length > 0
                          ? settingsByCategory.bank?.filter((s: any) => s.isActive).map((b: any) => (
                              <SelectItem key={b.id} value={b.labelAr}>{b.labelAr}</SelectItem>))
                          : <SelectItem value="" disabled>لا توجد بنوك - أضف من الإعدادات</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>رقم الحساب البنكي (IBAN)</Label>
                  <Input {...form.register("bankAccountNumber")} placeholder="SAxxxxxxxxxxxxxxxxxx" dir="ltr" data-testid="input-iban" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>نوع العقد</Label>
                  <Select value={wContract || ""} onValueChange={(v) => form.setValue("contractType", v)}>
                    <SelectTrigger data-testid="select-contract-type"><SelectValue placeholder="اختر نوع العقد" /></SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {isLoadingSettings ? <SelectItem value="" disabled>جاري التحميل...</SelectItem>
                        : (settingsByCategory.contract_type?.filter((s: any) => s.isActive) || []).length > 0
                          ? settingsByCategory.contract_type?.filter((s: any) => s.isActive).map((ct: any) => (
                              <SelectItem key={ct.id} value={ct.labelAr}>{ct.labelAr}</SelectItem>))
                          : <SelectItem value="" disabled>لا توجد أنواع عقود - أضف من الإعدادات</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Input {...form.register("notes")} placeholder="ملاحظات إضافية" data-testid="input-notes" />
                </div>
              </div>
            </TabsContent>

            {/* ============= TAB 5: حساب الدخول (اختياري) ============= */}
            <TabsContent value="login" className="space-y-4 pt-4">
              <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded">
                <Checkbox
                  id="create-login"
                  checked={!!wCreateLogin}
                  onCheckedChange={(c) => form.setValue("createLogin", c === true)}
                  data-testid="checkbox-create-login"
                />
                <div>
                  <Label htmlFor="create-login" className="font-bold cursor-pointer">إنشاء حساب دخول للنظام</Label>
                  <p className="text-xs text-slate-600 mt-1">
                    اختياري — للموظفين الذين يحتاجون استخدام النظام (كاشير، مدير، إلخ).
                    اتركه فارغاً للعمال الذين لا يحتاجون دخولاً.
                  </p>
                </div>
              </div>
              {wCreateLogin && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>اسم المستخدم *</Label>
                      <Input {...form.register("username")} dir="ltr" data-testid="input-username" />
                    </div>
                    <div className="space-y-2">
                      <Label>كلمة المرور *</Label>
                      <Input type="text" {...form.register("password")} dir="ltr"
                        placeholder="8+ أحرف، كبيرة وصغيرة وأرقام" data-testid="input-password" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>الدور في النظام</Label>
                    <Select value={wRole} onValueChange={(v) => form.setValue("role", v)}>
                      <SelectTrigger data-testid="select-role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">موظف</SelectItem>
                        <SelectItem value="viewer">مشاهد</SelectItem>
                        <SelectItem value="hr_specialist">اختصاصي موارد بشرية</SelectItem>
                        <SelectItem value="attendance_clerk">موظف حضور</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
            <Button type="submit" className="bg-amber-600 hover:bg-amber-700"
              disabled={mutation.isPending} data-testid="btn-convert-submit">
              {mutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              إضافة
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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
