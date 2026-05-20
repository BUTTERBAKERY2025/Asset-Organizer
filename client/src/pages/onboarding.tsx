import { useState, useMemo, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { CompanyHeader } from "@/components/company-header";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  UserPlus, ArrowRight, Send, CheckCircle2, Loader2, MapPin, Camera, Eye, Copy,
  ClipboardCheck, Users, Briefcase, Phone, FileText, MessageCircle, XCircle, AlertTriangle,
  Printer, Download,
} from "lucide-react";
import type { JobOffer, OnboardingNotification, Branch } from "@shared/schema";

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

export default function OnboardingPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [createFor, setCreateFor] = useState<Row | null>(null);
  const [viewRow, setViewRow] = useState<Row | null>(null);
  const [convertRow, setConvertRow] = useState<Row | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery<Row[]>({ queryKey: ["/api/hr/onboarding"] });
  const { data: stats } = useQuery<Record<string, number>>({ queryKey: ["/api/hr/onboarding/stats"] });

  const filtered = useMemo(() => {
    let r = rows;
    if (tab !== "all") r = r.filter((x) => rowStatus(x) === tab);
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
      setShareLink(data.link);
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

        {/* Share Link Dialog */}
        <Dialog open={!!shareLink} onOpenChange={(o) => !o && setShareLink(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>رابط إشعار المباشرة جاهز</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="bg-slate-50 border rounded p-3 break-all text-sm" dir="ltr">{shareLink}</div>
              <div className="flex gap-2">
                <Button onClick={() => shareLink && copy(shareLink)} className="flex-1 gap-2">
                  <Copy className="w-4 h-4" /> نسخ الرابط
                </Button>
                {shareLink && (
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`🥐 *Butter Bakery* — إشعار مباشرة العمل\n\nرابط التوقيع (يفتح داخل الفرع):\n${shareLink}`)}`}
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
                  {n.signedAt && <span className="bg-white border rounded px-2 py-1">وقّع: {new Date(n.signedAt).toLocaleString("ar-SA")}</span>}
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
                        <div><span className="font-semibold">وقت التوقيع:</span> {new Date(n.signedAt).toLocaleString("ar-SA")}</div>
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
                    {n?.signedAt ? new Date(n.signedAt).toLocaleString("ar-SA") : ""}
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
  // بيانات HR
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [basicSalary, setBasicSalary] = useState<string>("0");
  const [housingAllowance, setHousingAllowance] = useState<string>("0");
  const [transportAllowance, setTransportAllowance] = useState<string>("0");
  const [otherAllowances, setOtherAllowances] = useState<string>("0");
  const [iqamaNumber, setIqamaNumber] = useState("");
  const [hireDate, setHireDate] = useState("");
  // حساب الدخول (اختياري)
  const [createLogin, setCreateLogin] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("employee");

  useMemo(() => {
    if (row) {
      const o = row.offer as any;
      const parts = row.offer.candidateName.split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
      setJobTitle(row.offer.position || "");
      setEmail(row.offer.email || "");
      setPhone(row.offer.phone || "");
      setNationality(o.nationality || "");
      setBasicSalary(String(o.basicSalary ?? 0));
      setHousingAllowance(String(o.housingAllowance ?? 0));
      setTransportAllowance(String(o.transportAllowance ?? 0));
      setOtherAllowances(String(o.otherAllowances ?? 0));
      setIqamaNumber(o.idNumber || "");
      setHireDate(row.notification?.actualStartDate || row.offer.startDate || "");
      const suggested = row.offer.email?.split("@")[0] || row.offer.phone?.replace(/\D/g, "") || "";
      setUsername(suggested);
      setPassword("");
      setRole("employee");
      setCreateLogin(false);
    }
  }, [row?.offer.id]);

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/hr/onboarding/${row!.notification!.id}/convert`, {
        createLogin,
        username: createLogin ? username : undefined,
        password: createLogin ? password : undefined,
        role: createLogin ? role : undefined,
        firstName,
        lastName,
        jobTitle,
        email,
        phone,
        nationality,
        basicSalary: Number(basicSalary) || 0,
        housingAllowance: Number(housingAllowance) || 0,
        transportAllowance: Number(transportAllowance) || 0,
        otherAllowances: Number(otherAllowances) || 0,
        iqamaNumber,
        hireDate,
      });
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

  // حساب إجمالي الراتب للعرض
  const grossSalary = (Number(basicSalary) || 0) + (Number(housingAllowance) || 0) +
    (Number(transportAllowance) || 0) + (Number(otherAllowances) || 0);

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تسجيل موظف جديد في الموارد البشرية</DialogTitle>
        </DialogHeader>
        {row && (
          <div className="space-y-4 text-sm">
            <div className="bg-green-50 border border-green-200 rounded p-3 text-xs">
              ✓ تم تأكيد مباشرة <strong>{row.offer.candidateName}</strong> في فرع <strong>{row.offer.branchName}</strong>.
              يتم تسجيله كموظف HR كامل (راتب، جنسية، تأمينات) في صفحة موظفي الفرع.
            </div>

            {/* ===== بيانات الموظف الأساسية ===== */}
            <div>
              <h3 className="font-bold text-sm mb-2 text-slate-700 border-b pb-1">بيانات الموظف</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>الاسم الأول</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} data-testid="input-first-name" />
                </div>
                <div className="space-y-1">
                  <Label>اسم العائلة</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} data-testid="input-last-name" />
                </div>
                <div className="space-y-1">
                  <Label>المسمى الوظيفي *</Label>
                  <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} data-testid="input-job-title" />
                </div>
                <div className="space-y-1">
                  <Label>الجنسية *</Label>
                  <Input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="مثال: سعودي / مصري / يمني" data-testid="input-nationality" />
                </div>
                <div className="space-y-1">
                  <Label>الهاتف</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" data-testid="input-phone" />
                </div>
                <div className="space-y-1">
                  <Label>البريد الإلكتروني</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" data-testid="input-email" />
                </div>
                <div className="space-y-1">
                  <Label>رقم الهوية / الإقامة</Label>
                  <Input value={iqamaNumber} onChange={(e) => setIqamaNumber(e.target.value)} dir="ltr" data-testid="input-iqama" />
                </div>
                <div className="space-y-1">
                  <Label>تاريخ التعيين</Label>
                  <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} data-testid="input-hire-date" />
                </div>
              </div>
            </div>

            {/* ===== الراتب والبدلات ===== */}
            <div>
              <h3 className="font-bold text-sm mb-2 text-slate-700 border-b pb-1">الراتب والبدلات (من عرض العمل)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>الراتب الأساسي * (ر.س)</Label>
                  <Input type="number" value={basicSalary} onChange={(e) => setBasicSalary(e.target.value)} dir="ltr" data-testid="input-basic-salary" />
                </div>
                <div className="space-y-1">
                  <Label>بدل السكن (ر.س)</Label>
                  <Input type="number" value={housingAllowance} onChange={(e) => setHousingAllowance(e.target.value)} dir="ltr" data-testid="input-housing" />
                </div>
                <div className="space-y-1">
                  <Label>بدل المواصلات (ر.س)</Label>
                  <Input type="number" value={transportAllowance} onChange={(e) => setTransportAllowance(e.target.value)} dir="ltr" data-testid="input-transport" />
                </div>
                <div className="space-y-1">
                  <Label>بدلات أخرى (ر.س)</Label>
                  <Input type="number" value={otherAllowances} onChange={(e) => setOtherAllowances(e.target.value)} dir="ltr" data-testid="input-other-allowance" />
                </div>
              </div>
              <div className="mt-2 text-xs bg-amber-50 border border-amber-200 rounded p-2">
                <strong>إجمالي الراتب:</strong> {grossSalary.toLocaleString()} ر.س
                {nationality === "سعودي" && " (سيُخصم منه التأمينات للموظف السعودي)"}
              </div>
            </div>

            {/* ===== حساب دخول النظام (اختياري) ===== */}
            <div className="border-2 border-blue-200 rounded-lg p-3 bg-blue-50/50">
              <div className="flex items-start gap-2 mb-2">
                <Checkbox
                  id="create-login"
                  checked={createLogin}
                  onCheckedChange={(c) => setCreateLogin(c === true)}
                  data-testid="checkbox-create-login"
                />
                <div>
                  <Label htmlFor="create-login" className="font-bold cursor-pointer">
                    إنشاء حساب دخول للنظام أيضاً
                  </Label>
                  <p className="text-xs text-slate-600 mt-0.5">
                    اختياري — للموظفين الذين يحتاجون استخدام النظام (كاشير، مدير، إلخ).
                    يمكن تركه فارغاً للعمال الذين لا يحتاجون دخولاً للنظام.
                  </p>
                </div>
              </div>
              {createLogin && (
                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-blue-200">
                  <div className="space-y-1">
                    <Label>اسم المستخدم *</Label>
                    <Input value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" data-testid="input-username" />
                  </div>
                  <div className="space-y-1">
                    <Label>كلمة المرور *</Label>
                    <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" placeholder="8+ أحرف، كبيرة وصغيرة وأرقام" data-testid="input-password" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label>الدور في النظام</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">موظف</SelectItem>
                        <SelectItem value="viewer">مشاهد</SelectItem>
                        <SelectItem value="attendance_clerk">موظف حضور</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() => {
              if (!jobTitle.trim()) {
                toast({ title: "المسمى الوظيفي مطلوب", variant: "destructive" });
                return;
              }
              if (!nationality.trim()) {
                toast({ title: "الجنسية مطلوبة", variant: "destructive" });
                return;
              }
              if (!Number(basicSalary) || Number(basicSalary) <= 0) {
                toast({ title: "الراتب الأساسي مطلوب", variant: "destructive" });
                return;
              }
              if (createLogin && (!username || !password)) {
                toast({ title: "اسم المستخدم وكلمة المرور مطلوبان لحساب الدخول", variant: "destructive" });
                return;
              }
              mutation.mutate();
            }}
            disabled={mutation.isPending}
            data-testid="btn-convert-submit"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "تسجيل الموظف"}
          </Button>
        </DialogFooter>
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
