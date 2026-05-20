import { useState, useEffect, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { QRCodeSVG } from "qrcode.react";
import { PartyPopper, QrCode, Users, Eye, Plus, Trash2, Pencil, Link as LinkIcon, Copy, Printer, Download, Loader2, X } from "lucide-react";
import * as XLSX from "xlsx";

interface Campaign {
  id: number; slug: string; title: string; branch_name: string; branch_city: string;
  branch_address: string | null; opening_date: string | null; headline: string | null;
  description: string | null; prizes_json: string | null; is_active: boolean;
  max_guests: number | null; created_at: string; guests_count: number;
}
interface Guest {
  id: number; campaignId: number; name: string; phone: string; nationality: string;
  city: string; district: string; ticketNumber: string; prizeWon: string | null; createdAt: string;
}

const DEFAULT_PRIZES = ["وجبة مجانية", "خصم 20%", "كوب قهوة هدية", "حلويات بالمناسبة", "خصم 10%", "بطاقة شكر"];

export default function MarketingOpeningCampaignsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewQR, setViewQR] = useState<Campaign | null>(null);
  const [viewGuests, setViewGuests] = useState<Campaign | null>(null);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/marketing/opening-campaigns"],
  });

  const deleteM = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("DELETE", `/api/marketing/opening-campaigns/${id}`);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "تم الحذف" });
      qc.invalidateQueries({ queryKey: ["/api/marketing/opening-campaigns"] });
    },
    onError: (e: any) => toast({ title: "فشل الحذف", description: e.message, variant: "destructive" }),
  });

  const toggleActiveM = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const r = await apiRequest("PATCH", `/api/marketing/opening-campaigns/${id}`, { isActive });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/marketing/opening-campaigns"] }),
  });

  return (
    <Layout>
      <div className="space-y-6 p-4">
        <PageHeader
          title="حملات افتتاح الفروع"
          subtitle="إنشاء روابط مخصّصة لكل افتتاح فرع — يدخل العميل عبر QR ويسجل بياناته في صفحة احتفالية"
          icon={PartyPopper}
          actions={
            <Button onClick={() => setCreating(true)} className="bg-amber-600 hover:bg-amber-700" data-testid="btn-new-campaign">
              <Plus className="w-4 h-4 ml-2" /> حملة جديدة
            </Button>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard label="عدد الحملات" value={campaigns.length} icon={<PartyPopper className="w-5 h-5 text-amber-600" />} />
          <StatCard label="الحملات النشطة" value={campaigns.filter(c => c.is_active).length} icon={<LinkIcon className="w-5 h-5 text-green-600" />} />
          <StatCard label="إجمالي الضيوف المسجّلين" value={campaigns.reduce((s, c) => s + (c.guests_count || 0), 0)} icon={<Users className="w-5 h-5 text-blue-600" />} />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-amber-600" /></div>
            ) : campaigns.length === 0 ? (
              <div className="text-center p-10 text-slate-500">
                <PartyPopper className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p>لا توجد حملات افتتاح بعد. اضغط "حملة جديدة" لإنشاء أول حملة.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الفرع</TableHead>
                    <TableHead>المدينة</TableHead>
                    <TableHead>تاريخ الافتتاح</TableHead>
                    <TableHead>الرابط</TableHead>
                    <TableHead>الضيوف</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c) => (
                    <TableRow key={c.id} data-testid={`row-campaign-${c.id}`}>
                      <TableCell className="font-bold">{c.branch_name}</TableCell>
                      <TableCell>{c.branch_city}</TableCell>
                      <TableCell>{c.opening_date || "-"}</TableCell>
                      <TableCell className="font-mono text-xs" dir="ltr">/opening/{c.slug}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          {c.guests_count} ضيف
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={c.is_active}
                          onCheckedChange={(v) => toggleActiveM.mutate({ id: c.id, isActive: v })}
                          data-testid={`switch-active-${c.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => setViewQR(c)} data-testid={`btn-qr-${c.id}`}>
                            <QrCode className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setViewGuests(c)} data-testid={`btn-guests-${c.id}`}>
                            <Users className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditing(c)} data-testid={`btn-edit-${c.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50"
                            onClick={() => { if (confirm(`حذف حملة "${c.branch_name}" وكل ضيوفها؟`)) deleteM.mutate(c.id); }}
                            data-testid={`btn-delete-${c.id}`}>
                            <Trash2 className="w-4 h-4" />
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

      <CampaignForm
        open={creating || !!editing}
        campaign={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["/api/marketing/opening-campaigns"] })}
      />
      <QRDialog campaign={viewQR} onClose={() => setViewQR(null)} />
      <GuestsDialog campaign={viewGuests} onClose={() => setViewGuests(null)} />
    </Layout>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 bg-amber-50 rounded-lg">{icon}</div>
        <div>
          <div className="text-xs text-slate-500">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignForm({ open, campaign, onClose, onSuccess }:
  { open: boolean; campaign: Campaign | null; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: "", branchName: "", branchCity: "", branchAddress: "",
    openingDate: "", headline: "", description: "",
    prizes: DEFAULT_PRIZES.join("\n"), maxGuests: "",
  });

  useEffect(() => {
    if (open) {
      if (campaign) {
        setForm({
          title: campaign.title || "",
          branchName: campaign.branch_name || "",
          branchCity: campaign.branch_city || "",
          branchAddress: campaign.branch_address || "",
          openingDate: campaign.opening_date || "",
          headline: campaign.headline || "",
          description: campaign.description || "",
          prizes: campaign.prizes_json ? (JSON.parse(campaign.prizes_json) as string[]).join("\n") : DEFAULT_PRIZES.join("\n"),
          maxGuests: campaign.max_guests ? String(campaign.max_guests) : "",
        });
      } else {
        setForm({
          title: "", branchName: "", branchCity: "", branchAddress: "",
          openingDate: "", headline: "احتفل معنا بافتتاح فرعنا الجديد!",
          description: "سجّل بياناتك لتكون من أوائل ضيوفنا وتحصل على هدية ترحيبية",
          prizes: DEFAULT_PRIZES.join("\n"), maxGuests: "",
        });
      }
    }
  }, [open, campaign?.id]);

  const m = useMutation({
    mutationFn: async () => {
      const prizesArr = form.prizes.split("\n").map(s => s.trim()).filter(Boolean);
      const body = {
        title: form.title.trim() || `افتتاح ${form.branchName}`,
        branchName: form.branchName.trim(),
        branchCity: form.branchCity.trim(),
        branchAddress: form.branchAddress.trim() || undefined,
        openingDate: form.openingDate || undefined,
        headline: form.headline.trim() || undefined,
        description: form.description.trim() || undefined,
        prizesJson: JSON.stringify(prizesArr.length > 0 ? prizesArr : DEFAULT_PRIZES),
        maxGuests: form.maxGuests ? Number(form.maxGuests) : undefined,
        isActive: true,
      };
      if (campaign) {
        const r = await apiRequest("PATCH", `/api/marketing/opening-campaigns/${campaign.id}`, body);
        return r.json();
      } else {
        const r = await apiRequest("POST", "/api/marketing/opening-campaigns", body);
        return r.json();
      }
    },
    onSuccess: () => {
      toast({ title: campaign ? "تم تحديث الحملة" : "تم إنشاء الحملة" });
      onSuccess();
      onClose();
    },
    onError: (e: any) => toast({ title: "فشل الحفظ", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{campaign ? "تعديل حملة" : "حملة افتتاح جديدة"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>اسم الفرع *</Label>
              <Input value={form.branchName} onChange={(e) => setForm({ ...form, branchName: e.target.value })}
                placeholder="مثل: فرع المدينة المنورة" data-testid="input-branch-name" />
            </div>
            <div className="space-y-1">
              <Label>المدينة *</Label>
              <Input value={form.branchCity} onChange={(e) => setForm({ ...form, branchCity: e.target.value })}
                placeholder="مثل: المدينة المنورة" data-testid="input-branch-city" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>تاريخ الافتتاح</Label>
              <Input type="date" value={form.openingDate} onChange={(e) => setForm({ ...form, openingDate: e.target.value })}
                data-testid="input-opening-date" />
            </div>
            <div className="space-y-1">
              <Label>الحد الأقصى للضيوف (اختياري)</Label>
              <Input type="number" value={form.maxGuests} onChange={(e) => setForm({ ...form, maxGuests: e.target.value })}
                placeholder="مثل: 200" data-testid="input-max-guests" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>عنوان الفرع التفصيلي</Label>
            <Input value={form.branchAddress} onChange={(e) => setForm({ ...form, branchAddress: e.target.value })}
              placeholder="الشارع، الحي، رقم المبنى..." data-testid="input-branch-address" />
          </div>
          <div className="space-y-1">
            <Label>عنوان الحملة الجذاب (يظهر للعميل)</Label>
            <Input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })}
              placeholder="احتفل معنا بافتتاح فرعنا الجديد!" data-testid="input-headline" />
          </div>
          <div className="space-y-1">
            <Label>الوصف الترحيبي</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="سجّل بياناتك لتكون من أوائل ضيوفنا..." rows={2} data-testid="input-description" />
          </div>
          <div className="space-y-1">
            <Label>جوائز عجلة الحظ (كل جائزة في سطر)</Label>
            <Textarea value={form.prizes} onChange={(e) => setForm({ ...form, prizes: e.target.value })}
              rows={6} className="font-mono text-sm" data-testid="input-prizes" />
            <p className="text-xs text-slate-500">سيتم اختيار جائزة عشوائية من القائمة لكل ضيف.</p>
          </div>
          <div className="space-y-1">
            <Label>اسم الحملة الداخلي (اختياري — للوحة التحكم فقط)</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="افتراضي: افتتاح [اسم الفرع]" data-testid="input-title" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => {
            if (!form.branchName.trim()) { toast({ title: "اسم الفرع مطلوب", variant: "destructive" }); return; }
            if (!form.branchCity.trim()) { toast({ title: "المدينة مطلوبة", variant: "destructive" }); return; }
            m.mutate();
          }} disabled={m.isPending} className="bg-amber-600 hover:bg-amber-700" data-testid="btn-save-campaign">
            {m.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (campaign ? "تحديث" : "إنشاء الحملة")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QRDialog({ campaign, onClose }: { campaign: Campaign | null; onClose: () => void }) {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: campaign?.title || "QR" });

  if (!campaign) return null;
  const publicUrl = `${window.location.origin}/opening/${campaign.slug}`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>رابط الحملة و QR Code</DialogTitle>
        </DialogHeader>
        <div ref={printRef} className="space-y-4 p-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg text-center">
          <PartyPopper className="w-10 h-10 mx-auto text-amber-600" />
          <h2 className="text-xl font-bold text-amber-900">افتتاح {campaign.branch_name}</h2>
          <p className="text-sm text-slate-600">{campaign.branch_city}</p>
          {campaign.opening_date && <p className="text-sm font-bold text-amber-700">{campaign.opening_date}</p>}
          <div className="bg-white p-4 rounded-lg inline-block shadow">
            <QRCodeSVG value={publicUrl} size={220} level="H" includeMargin />
          </div>
          <p className="text-xs text-slate-700 font-bold">امسح الرمز للتسجيل كضيف افتتاح</p>
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input value={publicUrl} readOnly dir="ltr" className="text-xs font-mono" />
            <Button size="sm" variant="outline" onClick={() => {
              navigator.clipboard.writeText(publicUrl);
              toast({ title: "تم نسخ الرابط" });
            }} data-testid="btn-copy-link">
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => handlePrint()} className="flex-1" variant="outline" data-testid="btn-print-qr">
              <Printer className="w-4 h-4 ml-2" /> طباعة
            </Button>
            <Button onClick={() => window.open(publicUrl, "_blank")} className="flex-1" variant="outline" data-testid="btn-open-link">
              <Eye className="w-4 h-4 ml-2" /> فتح المعاينة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GuestsDialog({ campaign, onClose }: { campaign: Campaign | null; onClose: () => void }) {
  const { data: guests = [], isLoading } = useQuery<Guest[]>({
    queryKey: ["/api/marketing/opening-campaigns", campaign?.id, "guests"],
    queryFn: async () => {
      const r = await fetch(`/api/marketing/opening-campaigns/${campaign!.id}/guests`, { credentials: "include" });
      return r.json();
    },
    enabled: !!campaign,
  });

  if (!campaign) return null;

  const exportExcel = () => {
    const data = guests.map((g, i) => ({
      "#": i + 1,
      "رقم التذكرة": g.ticketNumber,
      "الاسم": g.name,
      "الجوال": g.phone,
      "الجنسية": g.nationality,
      "المدينة": g.city,
      "الحي": g.district,
      "الجائزة": g.prizeWon || "-",
      "تاريخ التسجيل": new Date(g.createdAt).toLocaleString("ar-SA"),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الضيوف");
    XLSX.writeFile(wb, `ضيوف-${campaign.branch_name}.xlsx`);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>ضيوف افتتاح {campaign.branch_name} ({guests.length})</span>
            <Button size="sm" onClick={exportExcel} disabled={guests.length === 0} data-testid="btn-export-excel">
              <Download className="w-4 h-4 ml-2" /> تصدير Excel
            </Button>
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : guests.length === 0 ? (
          <div className="text-center p-10 text-slate-500">لم يسجل أحد بعد</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>التذكرة</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الجوال</TableHead>
                <TableHead>الجنسية</TableHead>
                <TableHead>المدينة</TableHead>
                <TableHead>الحي</TableHead>
                <TableHead>الجائزة</TableHead>
                <TableHead>التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guests.map((g, i) => (
                <TableRow key={g.id} data-testid={`row-guest-${g.id}`}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-mono font-bold text-amber-700">{g.ticketNumber}</TableCell>
                  <TableCell>{g.name}</TableCell>
                  <TableCell dir="ltr">{g.phone}</TableCell>
                  <TableCell>{g.nationality}</TableCell>
                  <TableCell>{g.city}</TableCell>
                  <TableCell>{g.district}</TableCell>
                  <TableCell><Badge className="bg-pink-100 text-pink-700">{g.prizeWon || "-"}</Badge></TableCell>
                  <TableCell className="text-xs">{new Date(g.createdAt).toLocaleString("ar-SA")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
