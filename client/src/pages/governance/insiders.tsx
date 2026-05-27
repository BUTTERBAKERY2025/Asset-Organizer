import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import {
  UserCheck, Plus, Search, Edit, Trash2, Loader2, Phone, Mail, ShieldCheck, ShieldAlert,
} from "lucide-react";
import type { InsiderRegister } from "@shared/schema";

const positions = [
  { value: "board_member", label: "عضو مجلس إدارة", color: "bg-violet-100 text-violet-800" },
  { value: "senior_executive", label: "تنفيذي كبير", color: "bg-blue-100 text-blue-800" },
  { value: "auditor", label: "مراجع حسابات", color: "bg-emerald-100 text-emerald-800" },
  { value: "consultant", label: "مستشار", color: "bg-amber-100 text-amber-800" },
  { value: "relative_of_insider", label: "قريب لمطلع", color: "bg-pink-100 text-pink-800" },
  { value: "other", label: "أخرى", color: "bg-gray-100 text-gray-800" },
];

const statuses = [
  { value: "active", label: "نشط", color: "bg-green-100 text-green-800" },
  { value: "inactive", label: "غير نشط", color: "bg-gray-100 text-gray-800" },
  { value: "suspended", label: "موقوف", color: "bg-red-100 text-red-800" },
];

export default function InsidersPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<InsiderRegister | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: insiders = [], isLoading } = useQuery<InsiderRegister[]>({
    queryKey: ["/api/governance/insiders"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/governance/insiders", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/governance/insiders"] });
      setShowCreate(false);
      toast({ title: "تم إضافة المطلع بنجاح" });
    },
    onError: (e: any) => toast({ title: "فشل الإضافة", description: e?.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/governance/insiders/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/governance/insiders"] });
      setEditing(null);
      toast({ title: "تم التحديث" });
    },
    onError: (e: any) => toast({ title: "فشل التحديث", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/governance/insiders/${id}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/governance/insiders"] });
      setDeleteId(null);
      toast({ title: "تم الحذف" });
    },
    onError: (e: any) => toast({ title: "فشل الحذف", description: e?.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => insiders.filter(i => {
    if (search && !`${i.fullName} ${i.nationalId ?? ""} ${i.email ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeTab !== "all" && i.status !== activeTab) return false;
    return true;
  }), [insiders, search, activeTab]);

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      fullName: fd.get("fullName"),
      nationalId: fd.get("nationalId") || null,
      position: fd.get("position"),
      email: fd.get("email") || null,
      phone: fd.get("phone") || null,
      startDate: fd.get("startDate"),
      reasonAdded: fd.get("reasonAdded") || null,
      acknowledgmentSigned: fd.get("acknowledgmentSigned") === "on",
      notificationMethod: fd.get("notificationMethod") || "email",
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editing.id,
      data: {
        fullName: fd.get("fullName"),
        position: fd.get("position"),
        email: fd.get("email") || null,
        phone: fd.get("phone") || null,
        status: fd.get("status"),
        endDate: fd.get("endDate") || null,
        reasonRemoved: fd.get("reasonRemoved") || null,
        acknowledgmentSigned: fd.get("acknowledgmentSigned") === "on",
      },
    });
  };

  const getPosBadge = (p: string) => {
    const pos = positions.find(x => x.value === p);
    return <Badge className={pos?.color || ""}>{pos?.label || p}</Badge>;
  };
  const getStatusBadge = (s: string) => {
    const st = statuses.find(x => x.value === s);
    return <Badge className={st?.color || ""}>{st?.label || s}</Badge>;
  };

  return (
    <Layout>
      <div className="page-container space-y-4" dir="rtl">
        <PageHeader
          icon={UserCheck}
          tone="executive"
          title="سجل المطلعين"
          description="سجل الأشخاص المطلعين على المعلومات الجوهرية (متطلب CMA للإدراج في نمو)"
          backHref="/governance"
          actions={
            <Button onClick={() => setShowCreate(true)} className="gap-2" data-testid="btn-new-insider">
              <Plus className="h-4 w-4" /> إضافة مطلع
            </Button>
          }
        />

        <Card>
          <CardContent className="p-4 relative">
            <Search className="absolute right-7 top-7 h-4 w-4 text-gray-400" />
            <Input placeholder="ابحث بالاسم / الهوية / البريد…" value={search} onChange={e => setSearch(e.target.value)} className="pr-9" data-testid="input-search" />
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">الكل ({insiders.length})</TabsTrigger>
            {statuses.map(s => (
              <TabsTrigger key={s.value} value={s.value}>
                {s.label} ({insiders.filter(i => i.status === s.value).length})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <Card><CardContent className="py-8 text-center text-gray-500">جاري التحميل…</CardContent></Card>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <UserCheck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>لا يوجد مطلعون مسجلون</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filtered.map(i => (
                  <Card key={i.id} data-testid={`insider-card-${i.id}`}>
                    <CardContent className="p-4 flex justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-[280px]">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-lg">{i.fullName}</h3>
                          {getPosBadge(i.position)}
                          {getStatusBadge(i.status)}
                          {i.acknowledgmentSigned ? (
                            <Badge className="bg-green-50 text-green-700 gap-1"><ShieldCheck className="h-3 w-3" /> وقّع الإقرار</Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-700 gap-1"><ShieldAlert className="h-3 w-3" /> لم يوقّع</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 space-y-0.5">
                          {i.nationalId && <p>الهوية: <span className="font-mono">{i.nationalId}</span></p>}
                          <p>تاريخ البدء: {i.startDate}</p>
                          {i.endDate && <p>تاريخ الانتهاء: {i.endDate}</p>}
                          {i.email && <p className="flex items-center gap-1"><Mail className="h-3 w-3" /> {i.email}</p>}
                          {i.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {i.phone}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2 items-start">
                        <Button variant="outline" size="sm" onClick={() => setEditing(i)} data-testid={`btn-edit-${i.id}`}>
                          <Edit className="h-4 w-4 ml-1" /> تعديل
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="outline" size="sm"
                            className="text-red-600 border-red-200"
                            onClick={() => setDeleteId(i.id)}
                            data-testid={`btn-delete-${i.id}`}
                          >
                            <Trash2 className="h-4 w-4 ml-1" /> حذف
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>إضافة مطلع جديد</DialogTitle>
              <DialogDescription>
                يجب إضافة أي شخص يطّلع على معلومات جوهرية غير معلنة قبل اطّلاعه عليها.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>الاسم الكامل *</Label>
                  <Input name="fullName" required data-testid="input-fullname" />
                </div>
                <div>
                  <Label>رقم الهوية / الإقامة</Label>
                  <Input name="nationalId" data-testid="input-nationalid" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>الصفة *</Label>
                  <Select name="position" required defaultValue="board_member">
                    <SelectTrigger data-testid="select-position"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {positions.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>تاريخ البدء *</Label>
                  <Input name="startDate" type="date" required data-testid="input-startdate" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>البريد الإلكتروني</Label>
                  <Input name="email" type="email" data-testid="input-email" />
                </div>
                <div>
                  <Label>الجوال</Label>
                  <Input name="phone" type="tel" placeholder="+9665XXXXXXXX" data-testid="input-phone" />
                </div>
              </div>
              <div>
                <Label>طريقة الإشعار</Label>
                <Select name="notificationMethod" defaultValue="email">
                  <SelectTrigger data-testid="select-notif"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">بريد إلكتروني</SelectItem>
                    <SelectItem value="sms">رسالة نصية</SelectItem>
                    <SelectItem value="both">كلاهما</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>سبب الإضافة</Label>
                <Textarea name="reasonAdded" rows={2} placeholder="مثال: اطلاع على القوائم المالية قبل النشر" data-testid="input-reason" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="acknowledgmentSigned" data-testid="check-ack" />
                وقّع نموذج التزامات المطلعين
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="btn-submit-create">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إضافة"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit */}
        <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader><DialogTitle>تعديل بيانات المطلع</DialogTitle></DialogHeader>
            {editing && (
              <form onSubmit={handleUpdate} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>الاسم الكامل</Label>
                    <Input name="fullName" defaultValue={editing.fullName} required data-testid="input-edit-fullname" />
                  </div>
                  <div>
                    <Label>الصفة</Label>
                    <Select name="position" defaultValue={editing.position}>
                      <SelectTrigger data-testid="select-edit-position"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {positions.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>البريد</Label>
                    <Input name="email" type="email" defaultValue={editing.email ?? ""} data-testid="input-edit-email" />
                  </div>
                  <div>
                    <Label>الجوال</Label>
                    <Input name="phone" defaultValue={editing.phone ?? ""} data-testid="input-edit-phone" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>الحالة</Label>
                    <Select name="status" defaultValue={editing.status}>
                      <SelectTrigger data-testid="select-edit-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>تاريخ الانتهاء</Label>
                    <Input name="endDate" type="date" defaultValue={editing.endDate ?? ""} data-testid="input-edit-enddate" />
                  </div>
                </div>
                <div>
                  <Label>سبب الإزالة (عند الانتهاء)</Label>
                  <Textarea name="reasonRemoved" rows={2} defaultValue={editing.reasonRemoved ?? ""} data-testid="input-edit-reason-removed" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox name="acknowledgmentSigned" defaultChecked={editing.acknowledgmentSigned} data-testid="check-edit-ack" />
                  وقّع نموذج التزامات المطلعين
                </label>
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

        <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد حذف المطلع</AlertDialogTitle>
              <AlertDialogDescription>الأفضل تغيير الحالة إلى "غير نشط" بدل الحذف، للحفاظ على السجل التاريخي.</AlertDialogDescription>
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
      </div>
    </Layout>
  );
}
