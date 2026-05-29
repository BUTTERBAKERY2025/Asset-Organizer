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
                            onClick={() => setEditing(r)}
                            disabled={r.isLocked}
                            data-testid={`btn-edit-${r.id}`}
                            title={r.isLocked ? "القرار مقفل ولا يمكن تعديله" : ""}
                          >
                            <Edit className="h-4 w-4 ml-1" /> تعديل
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
      </div>
    </Layout>
  );
}
