import { useMemo, useRef, useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Gift,
  Plus,
  Users,
  QrCode,
  Copy,
  Download,
  Link2,
  Pencil,
  TicketCheck,
  Loader2,
} from "lucide-react";

interface Campaign {
  id: number;
  slug: string;
  name: string;
  description?: string;
  discountType: string;
  discountValue: string;
  maxUsesPerCustomer: number;
  minimumOrder?: string;
  maximumDiscount?: string;
  codePrefix?: string;
  applicableBranches?: string[];
  validFrom?: string;
  validTo?: string;
  status: string;
  terms?: string;
  memberCount: number;
  totalRedemptions: number;
  totalDiscount?: number;
}

interface Branch {
  id: string;
  name: string;
}

interface Member {
  id: number;
  code: string;
  maxUses: number;
  usedCount: number;
  status: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
}

interface Redemption {
  id: number;
  code: string;
  customerName: string;
  customerPhone: string;
  branchId?: string;
  orderAmount?: string;
  discountAmount?: string;
  posSaleId?: number;
  redeemedAt: string;
}

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  discountType: "percentage",
  discountValue: "",
  maxUsesPerCustomer: "1",
  minimumOrder: "",
  maximumDiscount: "",
  codePrefix: "",
  validFrom: "",
  validTo: "",
  terms: "",
  status: "active",
  applicableBranches: [] as string[],
};

function getSiteOrigin() {
  return window.location.origin;
}

export default function LoyaltyCampaignsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const [membersFor, setMembersFor] = useState<Campaign | null>(null);
  const [qrFor, setQrFor] = useState<Campaign | null>(null);
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/loyalty/campaigns"],
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const toggleBranch = (id: string) => {
    setForm((f) => ({
      ...f,
      applicableBranches: f.applicableBranches.includes(id)
        ? f.applicableBranches.filter((b) => b !== id)
        : [...f.applicableBranches, id],
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const isGift = form.discountType === "gift";
      const payload: any = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        discountType: form.discountType,
        discountValue: isGift ? "0" : form.discountValue,
        maxUsesPerCustomer: parseInt(form.maxUsesPerCustomer) || 1,
        minimumOrder: form.minimumOrder ? form.minimumOrder : undefined,
        maximumDiscount: isGift ? undefined : (form.maximumDiscount ? form.maximumDiscount : undefined),
        codePrefix: form.codePrefix.trim() || undefined,
        validFrom: form.validFrom || undefined,
        validTo: form.validTo || undefined,
        terms: form.terms.trim() || undefined,
        status: form.status,
        applicableBranches: form.applicableBranches.length > 0 ? form.applicableBranches : null,
      };
      if (editingId) {
        const res = await apiRequest("PATCH", `/api/loyalty/campaigns/${editingId}`, payload);
        return res.json();
      }
      payload.slug = form.slug.trim().toLowerCase();
      const res = await apiRequest("POST", "/api/loyalty/campaigns", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loyalty/campaigns"] });
      setFormOpen(false);
      toast({ title: editingId ? "تم تحديث الحملة" : "تم إنشاء الحملة" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err?.message, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormOpen(true);
  };

  const openEdit = (c: Campaign) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      slug: c.slug,
      description: c.description || "",
      discountType: c.discountType,
      discountValue: c.discountValue,
      maxUsesPerCustomer: String(c.maxUsesPerCustomer),
      minimumOrder: c.minimumOrder || "",
      maximumDiscount: c.maximumDiscount || "",
      codePrefix: c.codePrefix || "",
      validFrom: c.validFrom || "",
      validTo: c.validTo || "",
      terms: c.terms || "",
      status: c.status,
      applicableBranches: c.applicableBranches || [],
    });
    setFormOpen(true);
  };

  const copyLink = (slug: string) => {
    const url = `${getSiteOrigin()}/join/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "تم نسخ الرابط", description: url });
  };

  const downloadQr = (slug: string) => {
    const canvas = qrCanvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `qr-${slug}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const stats = useMemo(() => {
    const totalMembers = campaigns.reduce((s, c) => s + (c.memberCount || 0), 0);
    const totalRedemptions = campaigns.reduce((s, c) => s + (c.totalRedemptions || 0), 0);
    const totalDiscount = campaigns.reduce((s, c) => s + (Number(c.totalDiscount) || 0), 0);
    const active = campaigns.filter((c) => c.status === "active").length;
    return { totalMembers, totalRedemptions, totalDiscount, active, total: campaigns.length };
  }, [campaigns]);

  return (
    <Layout>
      <div className="page-container space-y-4" dir="rtl">
        <PageHeader
          icon={Gift}
          tone="marketing"
          title="حملات الولاء وبطاقات QR"
          description="أنشئ حملات خصم برمز QR، يسجّل العميل اسمه ورقمه ويحصل على بطاقة خصم شخصية"
          actions={
            <Button onClick={openCreate} className="gap-2" data-testid="button-create-campaign">
              <Plus className="h-4 w-4" /> حملة جديدة
            </Button>
          }
        />

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="p-4">
            <p className="text-sm text-muted-foreground">الحملات</p>
            <p className="text-2xl font-bold" data-testid="stat-total">{stats.total}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-sm text-muted-foreground">حملات نشطة</p>
            <p className="text-2xl font-bold text-emerald-600" data-testid="stat-active">{stats.active}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-sm text-muted-foreground">إجمالي العملاء</p>
            <p className="text-2xl font-bold" data-testid="stat-members">{stats.totalMembers}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-sm text-muted-foreground">مرات الاستخدام</p>
            <p className="text-2xl font-bold" data-testid="stat-redemptions">{stats.totalRedemptions}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-sm text-muted-foreground">إجمالي الخصم الممنوح</p>
            <p className="text-2xl font-bold text-amber-600" data-testid="stat-discount">
              {stats.totalDiscount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ر.س
            </p>
          </CardContent></Card>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : campaigns.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground" data-testid="text-empty">
                لا توجد حملات بعد. أنشئ حملتك الأولى.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الحملة</TableHead>
                    <TableHead className="text-right">الخصم</TableHead>
                    <TableHead className="text-right">حد الاستخدام</TableHead>
                    <TableHead className="text-right">العملاء</TableHead>
                    <TableHead className="text-right">الاستخدامات</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c) => (
                    <TableRow key={c.id} data-testid={`row-campaign-${c.id}`}>
                      <TableCell>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">/{c.slug}</div>
                      </TableCell>
                      <TableCell>
                        {c.discountType === "percentage"
                          ? `${Number(c.discountValue)}%`
                          : c.discountType === "gift"
                          ? "هدية 🎁"
                          : `${Number(c.discountValue).toLocaleString()} ر.س`}
                      </TableCell>
                      <TableCell>{c.maxUsesPerCustomer} لكل عميل</TableCell>
                      <TableCell>{c.memberCount}</TableCell>
                      <TableCell>{c.totalRedemptions}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === "active" ? "default" : "secondary"}>
                          {c.status === "active" ? "نشطة" : c.status === "inactive" ? "متوقفة" : "منتهية"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Button size="sm" variant="ghost" onClick={() => setMembersFor(c)} data-testid={`button-members-${c.id}`}>
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setQrFor(c)} data-testid={`button-qr-${c.id}`}>
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => copyLink(c.slug)} data-testid={`button-link-${c.id}`}>
                            <Link2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(c)} data-testid={`button-edit-${c.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل الحملة" : "حملة جديدة"}</DialogTitle>
            <DialogDescription>
              اضبط تفاصيل الخصم وعدد مرات الاستخدام المسموح لكل عميل
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>اسم الحملة</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-campaign-name" placeholder="مثال: خصم مستشفى القوات المسلحة" />
            </div>
            {!editingId && (
              <div>
                <Label>الرابط (slug)</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} data-testid="input-campaign-slug" placeholder="military-hospital" dir="ltr" />
                <p className="text-xs text-muted-foreground mt-1">حروف إنجليزية صغيرة وأرقام وشرطات فقط — لا يمكن تغييره لاحقاً</p>
              </div>
            )}
            <div>
              <Label>الوصف (اختياري)</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} data-testid="input-campaign-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>نوع الخصم</Label>
                <Select value={form.discountType} onValueChange={(v) => setForm({ ...form, discountType: v })}>
                  <SelectTrigger data-testid="select-discount-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">نسبة مئوية %</SelectItem>
                    <SelectItem value="fixed_amount">مبلغ ثابت ر.س</SelectItem>
                    <SelectItem value="gift">هدية 🎁</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{form.discountType === "gift" ? "وصف الهدية" : "قيمة الخصم"}</Label>
                {form.discountType === "gift" ? (
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="مثال: قهوة مجانية" data-testid="input-gift-description" />
                ) : (
                  <Input type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} data-testid="input-discount-value" />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>عدد مرات الاستخدام لكل عميل</Label>
                <Input type="number" min="1" value={form.maxUsesPerCustomer} onChange={(e) => setForm({ ...form, maxUsesPerCustomer: e.target.value })} data-testid="input-max-uses" />
              </div>
              <div>
                <Label>بادئة الرمز (اختياري)</Label>
                <Input value={form.codePrefix} onChange={(e) => setForm({ ...form, codePrefix: e.target.value })} placeholder="MIL" dir="ltr" data-testid="input-code-prefix" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الحد الأدنى للطلب (اختياري)</Label>
                <Input type="number" value={form.minimumOrder} onChange={(e) => setForm({ ...form, minimumOrder: e.target.value })} data-testid="input-minimum-order" />
              </div>
              <div>
                <Label>أقصى خصم (اختياري)</Label>
                <Input type="number" value={form.maximumDiscount} onChange={(e) => setForm({ ...form, maximumDiscount: e.target.value })} data-testid="input-maximum-discount" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>صالح من (اختياري)</Label>
                <Input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} data-testid="input-valid-from" />
              </div>
              <div>
                <Label>صالح حتى (اختياري)</Label>
                <Input type="date" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} data-testid="input-valid-to" />
              </div>
            </div>
            <div>
              <Label>الفروع المسموح بها (اتركه فارغاً لكل الفروع)</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {branches.map((b) => {
                  const selected = form.applicableBranches.includes(b.id);
                  return (
                    <button
                      type="button"
                      key={b.id}
                      onClick={() => toggleBranch(b.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-transparent hover:bg-muted/70"
                      }`}
                      data-testid={`button-branch-${b.id}`}
                    >
                      {b.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>الشروط (اختياري)</Label>
              <Textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} rows={2} data-testid="input-terms" />
            </div>
            <div>
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">نشطة</SelectItem>
                  <SelectItem value="inactive">متوقفة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.name || (form.discountType === "gift" ? !form.description.trim() : !form.discountValue) || (!editingId && !form.slug)}
              data-testid="button-save-campaign"
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR dialog */}
      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>رمز QR للحملة</DialogTitle>
            <DialogDescription>{qrFor?.name}</DialogDescription>
          </DialogHeader>
          {qrFor && (
            <div className="flex flex-col items-center gap-4">
              <div ref={qrCanvasRef} className="bg-white p-4 rounded-xl border">
                <QRCodeCanvas value={`${getSiteOrigin()}/join/${qrFor.slug}`} size={220} level="H" />
              </div>
              <code className="text-xs text-muted-foreground" dir="ltr">{getSiteOrigin()}/join/{qrFor.slug}</code>
              <div className="flex gap-2 w-full">
                <Button className="flex-1 gap-2" onClick={() => downloadQr(qrFor.slug)} data-testid="button-download-qr">
                  <Download className="h-4 w-4" /> تحميل
                </Button>
                <Button variant="outline" className="flex-1 gap-2" onClick={() => copyLink(qrFor.slug)}>
                  <Copy className="h-4 w-4" /> نسخ الرابط
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Members + Redemptions dialog */}
      <MembersDialog campaign={membersFor} onClose={() => setMembersFor(null)} />
    </Layout>
  );
}

function MembersDialog({ campaign, onClose }: { campaign: Campaign | null; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const open = !!campaign;

  const { data: members = [], isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: [`/api/loyalty/campaigns/${campaign?.id}/members`],
    enabled: open,
  });
  const { data: redemptions = [], isLoading: redLoading } = useQuery<Redemption[]>({
    queryKey: [`/api/loyalty/campaigns/${campaign?.id}/redemptions`],
    enabled: open,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/loyalty/members/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/loyalty/campaigns/${campaign?.id}/members`] });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err?.message, variant: "destructive" }),
  });

  const exportExcel = async () => {
    const XLSX = (await import("xlsx")).default;
    const rows = members.map((m) => ({
      "الاسم": m.customerName,
      "الجوال": m.customerPhone,
      "الرمز": m.code,
      "المستخدم": m.usedCount,
      "الحد الأقصى": m.maxUses,
      "المتبقي": Math.max(0, m.maxUses - m.usedCount),
      "الحالة": m.status === "active" ? "نشطة" : m.status === "exhausted" ? "مستنفدة" : "موقوفة",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "العملاء");
    XLSX.writeFile(wb, `loyalty-${campaign?.slug}.xlsx`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{campaign?.name}</DialogTitle>
          <DialogDescription>العملاء المسجّلون وسجل الاستخدام</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members" data-testid="tab-members"><Users className="h-4 w-4 ml-1" /> العملاء ({members.length})</TabsTrigger>
            <TabsTrigger value="redemptions" data-testid="tab-redemptions"><TicketCheck className="h-4 w-4 ml-1" /> الاستخدامات ({redemptions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <div className="flex justify-end mb-2">
              <Button size="sm" variant="outline" className="gap-2" onClick={exportExcel} disabled={members.length === 0} data-testid="button-export-excel">
                <Download className="h-4 w-4" /> تصدير Excel
              </Button>
            </div>
            {membersLoading ? (
              <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : members.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">لا يوجد عملاء بعد</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">الجوال</TableHead>
                    <TableHead className="text-right">الرمز</TableHead>
                    <TableHead className="text-right">الاستخدام</TableHead>
                    <TableHead className="text-right">مفعّلة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.id} data-testid={`row-member-${m.id}`}>
                      <TableCell>{m.customerName}</TableCell>
                      <TableCell dir="ltr" className="text-right">{m.customerPhone}</TableCell>
                      <TableCell><code className="text-xs">{m.code}</code></TableCell>
                      <TableCell>
                        {m.usedCount} / {m.maxUses}
                        {m.status === "exhausted" && <Badge variant="secondary" className="mr-1">مستنفدة</Badge>}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={m.status !== "disabled"}
                          onCheckedChange={(checked) =>
                            statusMutation.mutate({ id: m.id, status: checked ? "active" : "disabled" })
                          }
                          data-testid={`switch-member-${m.id}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="redemptions">
            {redLoading ? (
              <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : redemptions.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">لا توجد استخدامات بعد</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-right">الرمز</TableHead>
                    <TableHead className="text-right">الفرع</TableHead>
                    <TableHead className="text-right">قيمة الطلب</TableHead>
                    <TableHead className="text-right">الخصم</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redemptions.map((r) => (
                    <TableRow key={r.id} data-testid={`row-redemption-${r.id}`}>
                      <TableCell>{r.customerName}</TableCell>
                      <TableCell><code className="text-xs">{r.code}</code></TableCell>
                      <TableCell>{r.branchId || "-"}</TableCell>
                      <TableCell>{r.orderAmount ? `${Number(r.orderAmount).toLocaleString()} ر.س` : "-"}</TableCell>
                      <TableCell>{r.discountAmount ? `${Number(r.discountAmount).toLocaleString()} ر.س` : "-"}</TableCell>
                      <TableCell className="text-xs">{new Date(r.redeemedAt).toLocaleString("ar-SA")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
