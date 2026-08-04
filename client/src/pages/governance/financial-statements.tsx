import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Plus, Upload, Trash2, Copy, MessageCircle, RefreshCw,
  Download, Eye, CheckCircle, Clock, XCircle, ArrowRight, Stamp, ChevronDown, ChevronUp,
} from "lucide-react";
import { buildApprovedPdf, downloadPdf, positionLabel, quickStampPdf, getPdfPageCount, type QuickStampPosition } from "@/lib/financial-doc-stamp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Cycle {
  id: number;
  title: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  notes?: string;
  docsTotal: number;
  docsCompleted: number;
}

interface Signer {
  id: number;
  signerName: string;
  signerPosition: string;
  signOrder: number;
  signToken: string;
  status: string;
  signatureData: string | null;
  signedAt: string | null;
  declineReason?: string | null;
}

interface Doc {
  id: number;
  title: string;
  category?: string | null;
  fileName: string;
  fileSize?: number;
  status: string;
  createdAt: string;
  signers: Signer[];
}

const POSITIONS = [
  { value: "cfo", label: "المدير المالي (CFO)" },
  { value: "ceo", label: "الرئيس التنفيذي (CEO)" },
  { value: "chairman", label: "رئيس مجلس الإدارة" },
  { value: "vice_chairman", label: "نائب رئيس مجلس الإدارة" },
  { value: "board_member", label: "عضو مجلس الإدارة" },
  { value: "auditor", label: "المراجع الداخلي" },
  { value: "general_manager", label: "المدير العام" },
  { value: "hr_manager", label: "مدير الموارد البشرية" },
  { value: "procurement_manager", label: "مدير المشتريات" },
  { value: "accounts_supervisor", label: "مشرف الحسابات" },
  { value: "operations_manager", label: "مدير التشغيل" },
  { value: "marketing_manager", label: "مدير التسويق" },
  { value: "it_manager", label: "مدير تقنية المعلومات" },
  { value: "branch_manager", label: "مدير فرع" },
  { value: "__custom", label: "منصب آخر (اكتبه بنفسك)..." },
];

const CATEGORIES = ["قائمة المركز المالي", "قائمة الدخل", "قائمة التدفقات النقدية", "قائمة التغيرات في حقوق الملكية", "الإيضاحات المتممة", "تقرير المراجع", "أخرى"];

export default function FinancialStatementsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<number | null>(null);
  const [stampingDocId, setStampingDocId] = useState<number | null>(null);

  // ---- new cycle form
  const [cycleTitle, setCycleTitle] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [cycleNotes, setCycleNotes] = useState("");

  // ---- upload form
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [signersForm, setSignersForm] = useState<Array<{ name: string; position: string; customPosition?: string }>>([
    { name: "", position: "cfo" },
  ]);

  const { data: cycles = [], isLoading } = useQuery<Cycle[]>({
    queryKey: ["/api/governance/financial-cycles"],
  });

  const { data: docs = [] } = useQuery<Doc[]>({
    queryKey: ["/api/governance/financial-cycles", selectedCycle?.id, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/governance/financial-cycles/${selectedCycle!.id}/documents`, { credentials: "include" });
      if (!res.ok) throw new Error("فشل جلب المستندات");
      return res.json();
    },
    enabled: !!selectedCycle,
    refetchInterval: selectedCycle ? 20000 : false,
  });

  const createCycleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/governance/financial-cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: cycleTitle.trim(), periodStart, periodEnd, notes: cycleNotes.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "فشل إنشاء الدورة");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/financial-cycles"] });
      setShowNewCycle(false);
      setCycleTitle(""); setPeriodStart(""); setPeriodEnd(""); setCycleNotes("");
      toast({ title: "تم إنشاء دورة المراجعة" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const closeCycleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/governance/financial-cycles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "فشل التحديث");
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/financial-cycles"] });
      setSelectedCycle((prev) => (prev && prev.id === updated.id ? { ...prev, status: updated.status } : prev));
      toast({ title: updated.status === "closed" ? "تم إغلاق الدورة" : "تمت إعادة فتح الدورة" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!docFile) throw new Error("اختر ملف PDF");
      const validSigners = signersForm.filter((s) => s.name.trim().length >= 2);
      if (validSigners.length === 0) throw new Error("أدخل اسم موقّع واحد على الأقل");
      if (validSigners.some((s) => s.position === "__custom" && !(s.customPosition || "").trim())) {
        throw new Error("اكتب اسم المنصب المخصص للموقّعين الذين اخترت لهم «منصب آخر»");
      }
      const fd = new FormData();
      fd.append("file", docFile);
      fd.append("title", docTitle.trim());
      if (docCategory) fd.append("category", docCategory);
      fd.append("signers", JSON.stringify(validSigners.map((s) => ({
        name: s.name.trim(),
        position: s.position === "__custom" ? (s.customPosition || "").trim() : s.position,
      }))));
      const res = await fetch(`/api/governance/financial-cycles/${selectedCycle!.id}/documents`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "فشل رفع المستند");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/financial-cycles", selectedCycle?.id, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/financial-cycles"] });
      setShowUpload(false);
      setDocTitle(""); setDocCategory(""); setDocFile(null);
      setSignersForm([{ name: "", position: "cfo" }]);
      toast({ title: "تم رفع المستند", description: "أرسل رابط التوقيع للموقّع الأول" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/governance/financial-documents/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "فشل الحذف");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/financial-cycles", selectedCycle?.id, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/financial-cycles"] });
      toast({ title: "تم حذف المستند" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const reopenSignerMutation = useMutation({
    mutationFn: async ({ docId, signerId }: { docId: number; signerId: number }) => {
      const res = await fetch(`/api/governance/financial-documents/${docId}/signers/${signerId}/reopen`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "فشل إعادة الفتح");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/financial-cycles", selectedCycle?.id, "documents"] });
      toast({ title: "تم إنشاء رابط توقيع جديد", description: "أرسل الرابط الجديد للموقّع" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const getSignLink = (token: string) => `${window.location.origin}/sign-financial.html#token=${token}`;

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(getSignLink(token));
    toast({ title: "تم نسخ الرابط" });
  };

  const shareWhatsApp = (signer: Signer, doc: Doc) => {
    const msg = `السلام عليكم ${signer.signerName}،\nمطلوب اعتمادكم وتوقيعكم على: ${doc.title}\n${selectedCycle?.title || ""}\n\nرابط التوقيع:\n${getSignLink(signer.signToken)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const downloadApproved = async (doc: Doc) => {
    setStampingDocId(doc.id);
    try {
      const res = await fetch(`/api/governance/financial-documents/${doc.id}/file`, { credentials: "include" });
      if (!res.ok) throw new Error("تعذر جلب الملف الأصلي");
      const bytes = await res.arrayBuffer();
      const approved = await buildApprovedPdf(bytes, {
        title: doc.title,
        category: doc.category,
        cycleTitle: selectedCycle?.title,
        periodStart: selectedCycle?.periodStart,
        periodEnd: selectedCycle?.periodEnd,
      }, doc.signers);
      const base = doc.fileName.replace(/\.pdf$/i, "");
      downloadPdf(approved, `${base} - نسخة معتمدة ومختومة.pdf`);
      toast({ title: "تم إنشاء النسخة المعتمدة", description: "أُضيفت صفحة الاعتماد بالتوقيعات وختم الإدارة المالية" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message || "فشل إنشاء النسخة المعتمدة", variant: "destructive" });
    } finally {
      setStampingDocId(null);
    }
  };

  const docStatusBadge = (doc: Doc) => {
    if (doc.status === "completed") return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 ml-1" /> معتمد ومكتمل</Badge>;
    if (doc.status === "declined") return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 ml-1" /> يوجد اعتذار</Badge>;
    const signedCount = doc.signers.filter((s) => s.status === "signed").length;
    return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 ml-1" /> التوقيعات {signedCount}/{doc.signers.length}</Badge>;
  };

  const currentTurn = (doc: Doc): Signer | null => {
    const sorted = [...doc.signers].sort((a, b) => a.signOrder - b.signOrder);
    for (const s of sorted) {
      if (s.status === "declined") return null;
      if (s.status !== "signed") return s;
    }
    return null;
  };

  // ================== Cycle list view ==================
  if (!selectedCycle) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6 text-emerald-700" /> القوائم المالية ومراجعتها</h1>
            <p className="text-sm text-gray-500 mt-1">دورات مراجعة القوائم المالية، الاعتمادات والتوقيعات والختم الرسمي</p>
          </div>
          <Button onClick={() => setShowNewCycle(true)} className="bg-emerald-700 hover:bg-emerald-800" data-testid="new-cycle-btn">
            <Plus className="h-4 w-4 ml-1" /> دورة مراجعة جديدة
          </Button>
        </div>

        <Tabs defaultValue="cycles" dir="rtl">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="cycles" data-testid="tab-cycles">دورات المراجعة</TabsTrigger>
            <TabsTrigger value="quick-stamp" data-testid="tab-quick-stamp"><Stamp className="h-4 w-4 ml-1" /> الختم الإلكتروني</TabsTrigger>
          </TabsList>
          <TabsContent value="cycles" className="mt-4 space-y-4">
        {isLoading ? (
          <Card><CardContent className="py-10 text-center text-gray-500">جاري التحميل...</CardContent></Card>
        ) : cycles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="mb-4">لا توجد دورات مراجعة بعد</p>
              <Button onClick={() => setShowNewCycle(true)} variant="outline">
                <Plus className="h-4 w-4 ml-1" /> أنشئ أول دورة — مثل: القوائم النصف سنوية يناير–يونيو 2026
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {cycles.map((c) => (
              <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedCycle(c)} data-testid={`cycle-${c.id}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{c.title}</span>
                      <Badge className={c.status === "active" ? "bg-blue-100 text-blue-800" : "bg-gray-200 text-gray-700"}>
                        {c.status === "active" ? "جارية" : "مغلقة"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">الفترة: {c.periodStart} إلى {c.periodEnd}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-emerald-700">{c.docsCompleted}/{c.docsTotal}</div>
                      <div className="text-xs text-gray-500">مستندات معتمدة</div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 rotate-180" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
          </TabsContent>
          <TabsContent value="quick-stamp" className="mt-4">
            <QuickStampSection />
          </TabsContent>
        </Tabs>

        <Dialog open={showNewCycle} onOpenChange={setShowNewCycle}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>دورة مراجعة جديدة</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>اسم الدورة</Label>
                <Input value={cycleTitle} onChange={(e) => setCycleTitle(e.target.value)} placeholder="القوائم المالية النصف سنوية 2026" data-testid="cycle-title-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>بداية الفترة</Label>
                  <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                </div>
                <div>
                  <Label>نهاية الفترة</Label>
                  <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>ملاحظات (اختياري)</Label>
                <Textarea value={cycleNotes} onChange={(e) => setCycleNotes(e.target.value)} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createCycleMutation.mutate()}
                disabled={createCycleMutation.isPending || cycleTitle.trim().length < 3 || !periodStart || !periodEnd}
                className="bg-emerald-700 hover:bg-emerald-800 w-full"
                data-testid="create-cycle-btn"
              >
                {createCycleMutation.isPending ? "جاري الإنشاء..." : "إنشاء الدورة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ================== Cycle detail view ==================
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setSelectedCycle(null)} className="mb-1 -mr-2">
            <ArrowRight className="h-4 w-4 ml-1" /> كل الدورات
          </Button>
          <h1 className="text-xl font-bold">{selectedCycle.title}</h1>
          <p className="text-sm text-gray-500">الفترة: {selectedCycle.periodStart} إلى {selectedCycle.periodEnd}</p>
        </div>
        <div className="flex gap-2">
          {selectedCycle.status === "active" ? (
            <>
              <Button onClick={() => setShowUpload(true)} className="bg-emerald-700 hover:bg-emerald-800" data-testid="upload-doc-btn">
                <Upload className="h-4 w-4 ml-1" /> رفع مستند PDF
              </Button>
              <Button variant="outline" onClick={() => { if (confirm("إغلاق الدورة؟ لن يمكن إضافة مستندات جديدة")) closeCycleMutation.mutate({ id: selectedCycle.id, status: "closed" }); }}>
                إغلاق الدورة
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => closeCycleMutation.mutate({ id: selectedCycle.id, status: "active" })}>
              إعادة فتح الدورة
            </Button>
          )}
        </div>
      </div>

      {docs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Upload className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>لا توجد مستندات بعد — ارفع أول ملف PDF (قائمة المركز المالي، قائمة الدخل...)</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => {
            const turn = currentTurn(doc);
            const isExpanded = expandedDoc === doc.id;
            return (
              <Card key={doc.id} data-testid={`doc-${doc.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-red-600 shrink-0" />
                      <div>
                        <div className="font-semibold">{doc.title}</div>
                        <div className="text-xs text-gray-500">
                          {doc.category ? doc.category + " • " : ""}{doc.fileName}
                          {doc.fileSize ? ` • ${(doc.fileSize / 1024 / 1024).toFixed(1)}MB` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {docStatusBadge(doc)}
                      <Button size="sm" variant="ghost" onClick={() => window.open(`/api/governance/financial-documents/${doc.id}/file`, "_blank")} title="عرض الملف الأصلي">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {doc.status === "completed" && (
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 gap-1"
                          onClick={() => downloadApproved(doc)}
                          disabled={stampingDocId === doc.id}
                          data-testid={`download-approved-${doc.id}`}
                        >
                          <Stamp className="h-4 w-4" />
                          {stampingDocId === doc.id ? "جاري الختم..." : "تحميل النسخة المختومة"}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { if (confirm("حذف المستند وكل توقيعاته؟")) deleteDocMutation.mutate(doc.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {turn && doc.status !== "completed" && (
                    <div className="mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm flex items-center justify-between flex-wrap gap-2">
                      <span>🖊️ الدور الآن على: <b>{turn.signerName}</b> ({positionLabel(turn.signerPosition)})</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => copyLink(turn.signToken)}>
                          <Copy className="h-3.5 w-3.5 ml-1" /> نسخ الرابط
                        </Button>
                        <Button size="sm" variant="outline" className="text-green-700 border-green-300" onClick={() => shareWhatsApp(turn, doc)}>
                          <MessageCircle className="h-3.5 w-3.5 ml-1" /> واتساب
                        </Button>
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-3 border-t pt-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>الموقّع</TableHead>
                            <TableHead>الصفة</TableHead>
                            <TableHead>الحالة</TableHead>
                            <TableHead>التوقيع</TableHead>
                            <TableHead>الإجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...doc.signers].sort((a, b) => a.signOrder - b.signOrder).map((s) => (
                            <TableRow key={s.id}>
                              <TableCell>{s.signOrder}</TableCell>
                              <TableCell className="font-medium">{s.signerName}</TableCell>
                              <TableCell>{positionLabel(s.signerPosition)}</TableCell>
                              <TableCell>
                                {s.status === "signed" ? (
                                  <Badge className="bg-green-100 text-green-800">وقّع {s.signedAt ? new Date(s.signedAt).toLocaleDateString("ar-SA") : ""}</Badge>
                                ) : s.status === "declined" ? (
                                  <Badge className="bg-red-100 text-red-800" title={s.declineReason || ""}>اعتذر</Badge>
                                ) : (
                                  <Badge className="bg-yellow-100 text-yellow-800">بانتظار التوقيع</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {s.signatureData ? (
                                  <img src={s.signatureData} alt="" className="h-8 mix-blend-multiply" />
                                ) : (
                                  <span className="text-gray-400 text-xs">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1.5">
                                  <Button size="sm" variant="ghost" onClick={() => copyLink(s.signToken)} title="نسخ رابط التوقيع">
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-amber-700 border-amber-300 gap-1"
                                    onClick={() => { if (confirm(`إنشاء رابط توقيع جديد لـ ${s.signerName}؟ سيُلغى توقيعه الحالي إن وجد`)) reopenSignerMutation.mutate({ docId: doc.id, signerId: s.id }); }}
                                    title="إعادة التوقيع (رابط جديد)"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" /> إعادة
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {doc.signers.some((s) => s.status === "declined" && s.declineReason) && (
                        <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded text-sm">
                          {doc.signers.filter((s) => s.status === "declined" && s.declineReason).map((s) => (
                            <p key={s.id}><b>{s.signerName}:</b> {s.declineReason}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>رفع مستند للمراجعة والاعتماد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>عنوان المستند</Label>
              <Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="القوائم المالية النصف سنوية — يناير إلى يونيو 2026" data-testid="doc-title-input" />
            </div>
            <div>
              <Label>نوع المستند</Label>
              <Select value={docCategory} onValueChange={setDocCategory}>
                <SelectTrigger><SelectValue placeholder="اختر النوع (اختياري)" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ملف PDF</Label>
              <Input type="file" accept="application/pdf" onChange={(e) => setDocFile(e.target.files?.[0] || null)} data-testid="doc-file-input" />
              <p className="text-xs text-gray-500 mt-1">الحد الأقصى 25MB — ملفات PDF فقط</p>
            </div>
            <div>
              <Label className="mb-1 block">الموقّعون (بالترتيب — الأول يوقّع أولاً)</Label>
              <div className="space-y-2">
                {signersForm.map((s, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-sm text-gray-400 w-4">{i + 1}</span>
                    <Input
                      className="flex-1"
                      placeholder="اسم الموقّع"
                      value={s.name}
                      onChange={(e) => setSignersForm((prev) => prev.map((p, j) => (j === i ? { ...p, name: e.target.value } : p)))}
                      data-testid={`signer-name-${i}`}
                    />
                    <div className="w-48 space-y-1.5">
                      <Select
                        value={s.position}
                        onValueChange={(v) => setSignersForm((prev) => prev.map((p, j) => (j === i ? { ...p, position: v } : p)))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {POSITIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {s.position === "__custom" && (
                        <Input
                          placeholder="اكتب المنصب — مثل: مدير الجودة"
                          value={s.customPosition || ""}
                          onChange={(e) => setSignersForm((prev) => prev.map((p, j) => (j === i ? { ...p, customPosition: e.target.value } : p)))}
                          data-testid={`signer-custom-position-${i}`}
                        />
                      )}
                    </div>
                    {signersForm.length > 1 && (
                      <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setSignersForm((prev) => prev.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => setSignersForm((prev) => [...prev, { name: "", position: prev.length === 0 ? "cfo" : "ceo" }])}
                disabled={signersForm.length >= 10}
              >
                <Plus className="h-3.5 w-3.5 ml-1" /> إضافة موقّع
              </Button>
              <p className="text-xs text-gray-500 mt-2">التوقيع تسلسلي: لن يستطيع الموقّع الثاني التوقيع قبل الأول</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending || !docFile || docTitle.trim().length < 2 || !signersForm.some((s) => s.name.trim().length >= 2)}
              className="bg-emerald-700 hover:bg-emerald-800 w-full"
              data-testid="submit-upload-btn"
            >
              {uploadMutation.isPending ? "جاري الرفع..." : "رفع وإنشاء روابط التوقيع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ================== الختم الإلكتروني السريع ==================
// رفع PDF → اختيار الصفحة والموضع والحجم → ختم وتحميل (كل شيء داخل المتصفح، لا يُرفع الملف لأي مكان)
function QuickStampSection() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNum, setPageNum] = useState("1"); // 1-based
  const [position, setPosition] = useState<QuickStampPosition>("bottom-center");
  const [size, setSize] = useState("110");
  const [working, setWorking] = useState(false);

  const onFile = async (f: File | null) => {
    setFile(f);
    setBytes(null);
    setPageCount(0);
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "الملف يجب أن يكون PDF", variant: "destructive" });
      setFile(null);
      return;
    }
    try {
      const buf = await f.arrayBuffer();
      const count = await getPdfPageCount(buf);
      setBytes(buf);
      setPageCount(count);
      setPageNum(String(count)); // افتراضياً آخر صفحة
    } catch {
      toast({ title: "تعذّر قراءة الملف — تأكد أنه PDF سليم", variant: "destructive" });
      setFile(null);
    }
  };

  const doStamp = async () => {
    if (!bytes || !file) return;
    setWorking(true);
    try {
      const out = await quickStampPdf(bytes.slice(0), Number(pageNum) - 1, position, Number(size));
      const base = file.name.replace(/\.pdf$/i, "");
      downloadPdf(out, base + " - مختوم.pdf");
      toast({ title: "تم ختم الملف وتحميله ✔" });
    } catch (e) {
      toast({ title: "فشل ختم الملف", description: String(e), variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const POS_OPTIONS: { value: QuickStampPosition; label: string }[] = [
    { value: "bottom-right", label: "أسفل يمين" },
    { value: "bottom-center", label: "أسفل الوسط" },
    { value: "bottom-left", label: "أسفل يسار" },
    { value: "center", label: "منتصف الصفحة" },
    { value: "top-right", label: "أعلى يمين" },
    { value: "top-center", label: "أعلى الوسط" },
    { value: "top-left", label: "أعلى يسار" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Stamp className="h-5 w-5 text-blue-800" /> ختم إلكتروني سريع — ارفع ملف PDF واختمه وحمّله فوراً
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed rounded-lg p-6 text-center bg-gray-50/50">
          <Input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => onFile(e.target.files?.[0] || null)}
            className="max-w-sm mx-auto"
            data-testid="quick-stamp-file"
          />
          {file && pageCount > 0 && (
            <p className="text-sm text-gray-600 mt-2">
              {file.name} • {(file.size / 1024 / 1024).toFixed(1)}MB • عدد الصفحات: {pageCount}
            </p>
          )}
        </div>

        {pageCount > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>الصفحة المطلوب ختمها</Label>
                <Select value={pageNum} onValueChange={setPageNum}>
                  <SelectTrigger data-testid="quick-stamp-page"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: pageCount }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        صفحة {i + 1}{i + 1 === pageCount ? " (الأخيرة)" : i === 0 ? " (الأولى)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>موضع الختم</Label>
                <Select value={position} onValueChange={(v) => setPosition(v as QuickStampPosition)}>
                  <SelectTrigger data-testid="quick-stamp-position"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>حجم الختم</Label>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger data-testid="quick-stamp-size"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="85">صغير</SelectItem>
                    <SelectItem value="110">متوسط</SelectItem>
                    <SelectItem value="145">كبير</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={doStamp}
              disabled={working}
              className="w-full bg-blue-800 hover:bg-blue-900"
              data-testid="quick-stamp-download"
            >
              <Download className="h-4 w-4 ml-1" />
              {working ? "جاري الختم..." : "ختم الملف وتحميله"}
            </Button>
            <p className="text-xs text-gray-500 text-center">
              يتم الختم داخل متصفحك مباشرة — الملف لا يُرفع ولا يُخزَّن في النظام
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
