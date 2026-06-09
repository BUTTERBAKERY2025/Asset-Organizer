import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Users, PieChart as PieIcon, TrendingUp, UserCheck, Landmark, Megaphone, Bell,
  KeyRound, Plus, Pencil, Trash2, Send, Loader2, MessageSquare, Newspaper, Store,
  CalendarDays, ShieldCheck, Link2, Link2Off, RefreshCw, Check, Copy,
  PartyPopper, Eye, ExternalLink, Sparkles,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

const COLORS = ["#d97706", "#16a34a", "#7c3aed", "#2563eb", "#db2777", "#0891b2", "#ca8a04"];

const CATEGORY_OPTIONS = [
  { value: "news", label: "خبر" },
  { value: "announcement", label: "إعلان" },
  { value: "opening", label: "افتتاح فرع" },
  { value: "event", label: "فعالية" },
];
const TYPE_LABELS: Record<string, string> = { individual: "أفراد", company: "شركات", government: "جهات حكومية", institution: "مؤسسات" };

function fmtNum(n: any): string {
  return Number(n || 0).toLocaleString("en-US");
}
function fmtDate(d: any): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" }); } catch { return String(d); }
}

export default function InvestorPortalPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: dashboard } = useQuery<any>({ queryKey: ["/api/governance/investor-dashboard"] });
  const { data: accounts = [] } = useQuery<any[]>({ queryKey: ["/api/governance/shareholder-portal-accounts"] });
  const { data: announcements = [] } = useQuery<any[]>({ queryKey: ["/api/governance/shareholder-announcements"] });
  const { data: notifHistory = [] } = useQuery<any[]>({ queryKey: ["/api/governance/shareholder-notifications"] });

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto" dir="rtl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center"><Users className="w-6 h-6 text-amber-600" /></div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">لوحة التحكم والتواصل مع المساهمين</h1>
            <p className="text-sm text-muted-foreground">إدارة بوابة المساهمين والتواصل معهم</p>
          </div>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard"><PieIcon className="w-4 h-4 ml-1" /> لوحة التحكم</TabsTrigger>
            <TabsTrigger value="communication" data-testid="tab-communication"><MessageSquare className="w-4 h-4 ml-1" /> التواصل</TabsTrigger>
            <TabsTrigger value="announcements" data-testid="tab-announcements"><Newspaper className="w-4 h-4 ml-1" /> الأخبار والإعلانات</TabsTrigger>
            <TabsTrigger value="accounts" data-testid="tab-accounts"><KeyRound className="w-4 h-4 ml-1" /> حسابات البوابة</TabsTrigger>
            <TabsTrigger value="invitations" data-testid="tab-invitations"><PartyPopper className="w-4 h-4 ml-1" /> دعوات الافتتاح</TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="mt-4">
            <DashboardTab dashboard={dashboard} />
          </TabsContent>

          {/* Communication */}
          <TabsContent value="communication" className="mt-4">
            <CommunicationTab accounts={accounts} history={notifHistory} toast={toast} queryClient={queryClient} />
          </TabsContent>

          {/* Announcements */}
          <TabsContent value="announcements" className="mt-4">
            <AnnouncementsTab announcements={announcements} toast={toast} queryClient={queryClient} />
          </TabsContent>

          {/* Accounts */}
          <TabsContent value="accounts" className="mt-4">
            <AccountsTab accounts={accounts} toast={toast} queryClient={queryClient} />
          </TabsContent>

          {/* Invitations */}
          <TabsContent value="invitations" className="mt-4">
            <InvitationsTab toast={toast} queryClient={queryClient} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function DashboardTab({ dashboard }: any) {
  if (!dashboard) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-600" /></div>;
  const typeData = (dashboard.byType || []).map((t: any) => ({ name: TYPE_LABELS[t.type] || t.type, value: t.count }));
  const topData = (dashboard.topShareholders || []).map((s: any) => ({ name: s.fullName, shares: s.numberOfShares }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="إجمالي المساهمين" value={fmtNum(dashboard.totalShareholders)} accent="amber" testid="kpi-total" />
        <KpiCard icon={TrendingUp} label="إجمالي الأسهم" value={fmtNum(dashboard.totalShares)} accent="green" testid="kpi-shares" />
        <KpiCard icon={UserCheck} label="لديهم حساب بوابة" value={`${fmtNum(dashboard.withAccount)} / ${fmtNum(dashboard.totalShareholders)}`} accent="blue" testid="kpi-accounts" />
        <KpiCard icon={ShieldCheck} label="أعضاء المجلس" value={fmtNum(dashboard.boardMembersCount)} accent="purple" testid="kpi-board" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">توزيع المساهمين حسب النوع</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            {typeData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {typeData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">أكبر المساهمين (بعدد الأسهم)</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            {topData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topData} layout="vertical" margin={{ right: 16, left: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="shares" fill="#d97706" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarDays className="w-4 h-4 text-amber-600" /> الاجتماعات القادمة</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(dashboard.upcomingMeetings || []).length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">لا توجد اجتماعات قادمة</p> :
            dashboard.upcomingMeetings.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between border-b pb-2 text-sm" data-testid={`row-meeting-${m.id}`}>
                <span className="font-medium">{m.title}</span>
                <span className="text-muted-foreground">{fmtDate(m.meetingDate)}</span>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function CommunicationTab({ accounts, history, toast, queryClient }: any) {
  const [target, setTarget] = useState("all");
  const [shareholderId, setShareholderId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sendWhatsapp, setSendWhatsapp] = useState(false);

  const send = useMutation({
    mutationFn: () => apiRequest("POST", "/api/governance/shareholder-notifications", {
      target, shareholderId: target === "one" ? Number(shareholderId) : undefined, title, body, sendWhatsapp,
    }),
    onSuccess: async (res: any) => {
      const data = await res.json().catch(() => ({}));
      toast({ title: "تم الإرسال", description: `أُرسل إلى ${data.sent || 0} مساهم${data.whatsappQueued ? ` • ${data.whatsappQueued} واتساب في الطابور` : ""}` });
      setTitle(""); setBody("");
      queryClient.invalidateQueries({ queryKey: ["/api/governance/shareholder-notifications"] });
    },
    onError: (e: any) => toast({ title: "فشل الإرسال", description: e?.message || "", variant: "destructive" }),
  });

  const canSend = title.trim() && body.trim() && (target === "all" || shareholderId);

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Send className="w-4 h-4 text-amber-600" /> إرسال إشعار للمساهمين</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>المستلمون</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger data-testid="select-target"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المساهمين النشطين</SelectItem>
                <SelectItem value="one">مساهم محدد</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {target === "one" && (
            <div>
              <Label>المساهم</Label>
              <Select value={shareholderId} onValueChange={setShareholderId}>
                <SelectTrigger data-testid="select-shareholder"><SelectValue placeholder="اختر مساهماً" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a: any) => <SelectItem key={a.id} value={String(a.id)}>{a.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div><Label>العنوان</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-notif-title" /></div>
          <div><Label>النص</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} data-testid="input-notif-body" /></div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-green-600" /><span className="text-sm">إرسال عبر واتساب أيضاً</span></div>
            <Switch checked={sendWhatsapp} onCheckedChange={setSendWhatsapp} data-testid="switch-whatsapp" />
          </div>
          <Button className="w-full" disabled={!canSend || send.isPending} onClick={() => send.mutate()} data-testid="button-send-notification">
            {send.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Send className="w-4 h-4 ml-2" />} إرسال
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="w-4 h-4 text-amber-600" /> سجل الإشعارات</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[520px] overflow-y-auto">
          {history.length === 0 ? <Empty /> : history.map((n: any) => (
            <div key={n.id} className="border-b pb-2" data-testid={`row-notif-${n.id}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{n.title}</span>
                <div className="flex items-center gap-1">
                  {n.sentWhatsapp && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">واتساب</Badge>}
                  {n.readAt && <Badge variant="outline" className="text-[10px]">مقروء</Badge>}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">{n.shareholderName} • {fmtDate(n.createdAt)}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AnnouncementsTab({ announcements, toast, queryClient }: any) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ category: "announcement", title: "", body: "", imageUrl: "", eventDate: "", isPublished: true });

  const resetForm = () => setForm({ category: "announcement", title: "", body: "", imageUrl: "", eventDate: "", isPublished: true });

  const openCreate = () => { setEditing(null); resetForm(); setOpen(true); };
  const openEdit = (a: any) => {
    setEditing(a);
    setForm({ category: a.category, title: a.title, body: a.body, imageUrl: a.imageUrl || "", eventDate: a.eventDate || "", isPublished: a.isPublished });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, imageUrl: form.imageUrl || null, eventDate: form.eventDate || null };
      return editing
        ? apiRequest("PATCH", `/api/governance/shareholder-announcements/${editing.id}`, payload)
        : apiRequest("POST", "/api/governance/shareholder-announcements", payload);
    },
    onSuccess: () => {
      toast({ title: editing ? "تم التحديث" : "تم النشر" });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/governance/shareholder-announcements"] });
    },
    onError: (e: any) => toast({ title: "فشل الحفظ", description: e?.message || "", variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/governance/shareholder-announcements/${id}`),
    onSuccess: () => { toast({ title: "تم الحذف" }); queryClient.invalidateQueries({ queryKey: ["/api/governance/shareholder-announcements"] }); },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openCreate} data-testid="button-add-announcement"><Plus className="w-4 h-4 ml-2" /> إضافة خبر / إعلان</Button></DialogTrigger>
          <DialogContent dir="rtl" className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "تعديل" : "إضافة"} خبر / إعلان</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>التصنيف</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>العنوان</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="input-title" /></div>
              <div><Label>النص</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} data-testid="input-body" /></div>
              <div><Label>رابط الصورة (اختياري)</Label><Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} data-testid="input-image" /></div>
              <div><Label>تاريخ الفعالية (اختياري)</Label><Input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} data-testid="input-event-date" /></div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">منشور (مرئي للمساهمين)</span>
                <Switch checked={form.isPublished} onCheckedChange={(v) => setForm({ ...form, isPublished: v })} data-testid="switch-published" />
              </div>
            </div>
            <DialogFooter>
              <Button disabled={!form.title.trim() || !form.body.trim() || save.isPending} onClick={() => save.mutate()} data-testid="button-save-announcement">
                {save.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />} حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {announcements.length === 0 ? <Empty /> : announcements.map((a: any) => (
        <Card key={a.id} data-testid={`row-announcement-${a.id}`}>
          <CardContent className="py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline">{CATEGORY_OPTIONS.find((c) => c.value === a.category)?.label || a.category}</Badge>
                {!a.isPublished && <Badge variant="outline" className="bg-muted text-muted-foreground">غير منشور</Badge>}
              </div>
              <div className="font-medium truncate">{a.title}</div>
              <div className="text-xs text-muted-foreground">{fmtDate(a.createdAt)}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={() => openEdit(a)} data-testid={`button-edit-${a.id}`}><Pencil className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" className="text-red-600" onClick={() => { if (confirm("حذف هذا الإعلان؟")) del.mutate(a.id); }} data-testid={`button-delete-${a.id}`}><Trash2 className="w-4 h-4" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function genPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pw = pick(upper) + pick(lower) + pick(digits);
  for (let i = 0; i < 7; i++) pw += pick(all);
  return pw.split("").sort(() => Math.random() - 0.5).join("");
}
function genUsername(sh: any): string {
  const rand = Math.floor(10 + Math.random() * 89);
  return `sh${sh?.id ?? ""}${rand}`;
}
// تحويل رقم الجوال إلى صيغة واتساب الدولية (السعودية افتراضياً 966)
function toWhatsAppNumber(phone: any): string | null {
  if (!phone) return null;
  let d = String(phone).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("966")) return d;
  if (d.startsWith("0")) return "966" + d.slice(1);
  if (d.startsWith("5") && d.length === 9) return "966" + d;
  return d;
}

function AccountsTab({ accounts, toast, queryClient }: any) {
  const [dialog, setDialog] = useState<{ mode: "create" | "reset"; sh: any } | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState(false);

  const openCreate = (sh: any) => { setUsername(""); setPassword(""); setCreated(false); setDialog({ mode: "create", sh }); };
  const openReset = (sh: any) => { setPassword(""); setCreated(false); setDialog({ mode: "reset", sh }); };

  const generateBoth = () => { if (dialog?.mode === "create") setUsername(genUsername(dialog.sh)); setPassword(genPassword()); };
  const copyAll = () => {
    const txt = dialog?.mode === "create" ? `اسم المستخدم: ${username}\nكلمة المرور: ${password}` : `كلمة المرور: ${password}`;
    navigator.clipboard?.writeText(txt).then(() => toast({ title: "تم النسخ" })).catch(() => {});
  };

  const createAcct = useMutation({
    mutationFn: () => apiRequest("POST", `/api/governance/shareholders/${dialog!.sh.id}/create-account`, { username, password }),
    onSuccess: () => { toast({ title: "تم إنشاء الحساب" }); setCreated(true); queryClient.invalidateQueries({ queryKey: ["/api/governance/shareholder-portal-accounts"] }); queryClient.invalidateQueries({ queryKey: ["/api/governance/investor-dashboard"] }); },
    onError: (e: any) => toast({ title: "فشل", description: e?.message || "", variant: "destructive" }),
  });
  const resetPwd = useMutation({
    mutationFn: () => apiRequest("POST", `/api/governance/shareholders/${dialog!.sh.id}/reset-password`, { password }),
    onSuccess: () => { toast({ title: "تم تغيير كلمة المرور" }); setCreated(true); },
    onError: (e: any) => toast({ title: "فشل", description: e?.message || "", variant: "destructive" }),
  });
  const portalUrl = typeof window !== "undefined" ? `${window.location.origin}/shareholder-portal` : "";
  const sendCredsWhatsApp = () => {
    const wa = toWhatsAppNumber(dialog?.sh?.phone);
    if (!wa) { toast({ title: "لا يوجد رقم جوال صحيح", variant: "destructive" }); return; }
    const lines = [
      `مرحباً ${dialog?.sh?.fullName || ""}،`,
      "تم تجهيز حسابك في بوابة المساهمين بشركة الزبد الأفضل التجارية.",
      "",
      "🔗 رابط الدخول:",
      portalUrl,
      "",
      "👤 بيانات الدخول:",
      `اسم المستخدم: ${username}`,
      `كلمة المرور: ${password}`,
      "",
      "🔒 يُنصح بتغيير كلمة المرور بعد أول تسجيل دخول.",
    ];
    const url = `https://wa.me/${wa}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank");
  };
  const unlink = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/governance/shareholders/${id}/unlink-account`),
    onSuccess: () => { toast({ title: "تم فك الارتباط" }); queryClient.invalidateQueries({ queryKey: ["/api/governance/shareholder-portal-accounts"] }); queryClient.invalidateQueries({ queryKey: ["/api/governance/investor-dashboard"] }); },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">حسابات بوابة المساهمين</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {accounts.length === 0 ? <Empty /> : accounts.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between gap-3 border-b pb-2" data-testid={`row-account-${s.id}`}>
            <div className="min-w-0">
              <div className="font-medium truncate">{s.fullName}</div>
              <div className="text-xs text-muted-foreground">
                {fmtNum(s.numberOfShares)} سهم • {s.sharePercentage}%
                {s.hasAccount && <span className="text-green-600"> • @{s.username}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {s.hasAccount ? (
                <>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><Link2 className="w-3 h-3 ml-1" /> مرتبط</Badge>
                  <Button size="sm" variant="outline" onClick={() => openReset(s)} data-testid={`button-reset-${s.id}`}><KeyRound className="w-3.5 h-3.5 ml-1" /> كلمة المرور</Button>
                  <Button size="icon" variant="ghost" className="text-red-600" onClick={() => { if (confirm("فك ارتباط الحساب؟ (لن يُحذف الحساب)")) unlink.mutate(s.id); }} data-testid={`button-unlink-${s.id}`}><Link2Off className="w-4 h-4" /></Button>
                </>
              ) : (
                <Button size="sm" onClick={() => openCreate(s)} data-testid={`button-create-${s.id}`}><Plus className="w-3.5 h-3.5 ml-1" /> إنشاء حساب</Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>{dialog?.mode === "create" ? "إنشاء حساب" : "تغيير كلمة المرور"} — {dialog?.sh?.fullName}</DialogTitle></DialogHeader>

          {!created ? (
            <>
              <div className="space-y-3">
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={generateBoth} data-testid="button-generate-credentials">
                  <RefreshCw className="w-4 h-4 ml-2" /> توليد {dialog?.mode === "create" ? "اسم المستخدم وكلمة المرور" : "كلمة مرور"} تلقائياً
                </Button>
                {dialog?.mode === "create" && (
                  <div><Label>اسم المستخدم</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} data-testid="input-username" /></div>
                )}
                <div><Label>كلمة المرور</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="input-password" /><p className="text-[11px] text-muted-foreground mt-1">8 أحرف على الأقل، تحتوي حروفاً كبيرة وصغيرة وأرقاماً</p></div>
              </div>
              <DialogFooter>
                <Button
                  disabled={(dialog?.mode === "create" && !username.trim()) || !password.trim() || createAcct.isPending || resetPwd.isPending}
                  onClick={() => (dialog?.mode === "create" ? createAcct.mutate() : resetPwd.mutate())}
                  data-testid="button-confirm-account"
                >
                  {(createAcct.isPending || resetPwd.isPending) && <Loader2 className="w-4 h-4 animate-spin ml-2" />} تأكيد
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-md bg-green-50 text-green-700 border border-green-200 px-3 py-2 text-sm">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{dialog?.mode === "create" ? "تم إنشاء الحساب بنجاح. أرسِل بيانات الدخول للمساهم." : "تم تغيير كلمة المرور. يمكنك إرسالها للمساهم."}</span>
                </div>
                <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1.5">
                  {dialog?.mode === "create" && <div className="flex justify-between gap-2"><span className="text-muted-foreground">اسم المستخدم</span><span className="font-mono font-medium" data-testid="text-created-username">{username}</span></div>}
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">كلمة المرور</span><span className="font-mono font-medium" data-testid="text-created-password">{password}</span></div>
                </div>
                {!dialog?.sh?.phone && <p className="text-[11px] text-amber-600">لا يوجد رقم جوال مسجّل لهذا المساهم، لذا لا يمكن الإرسال عبر واتساب.</p>}
                {dialog?.sh?.phone && <p className="text-[11px] text-muted-foreground">سيفتح واتساب برسالة جاهزة لرقم المساهم — راجِعها ثم اضغط إرسال داخل واتساب.</p>}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={copyAll} data-testid="button-copy-credentials"><Copy className="w-4 h-4 ml-2" /> نسخ</Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={!dialog?.sh?.phone}
                    onClick={sendCredsWhatsApp}
                    data-testid="button-send-credentials-whatsapp"
                  >
                    <MessageSquare className="w-4 h-4 ml-2" /> فتح واتساب
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialog(null)} data-testid="button-close-account-dialog">تم</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const INVITE_THEMES = [
  { value: "gold", label: "ذهبي فاخر", color: "#e6b450" },
  { value: "royal", label: "ملكي بنفسجي", color: "#a98bff" },
  { value: "emerald", label: "زمردي", color: "#34d399" },
  { value: "rose", label: "وردي", color: "#fb7185" },
];

function InvitationsTab({ toast, queryClient }: any) {
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<any>({ title: "", branchName: "", eventDate: "", eventTime: "", location: "", locationUrl: "", message: "", theme: "gold" });
  const [recipientsFor, setRecipientsFor] = useState<any>(null);

  const { data: invitations = [] } = useQuery<any[]>({ queryKey: ["/api/governance/invitations"] });

  const createInv = useMutation({
    mutationFn: () => apiRequest("POST", "/api/governance/invitations", {
      ...form,
      eventDate: form.eventDate ? new Date(form.eventDate).toISOString() : null,
      branchName: form.branchName || null,
      eventTime: form.eventTime || null,
      location: form.location || null,
      locationUrl: form.locationUrl || null,
      message: form.message || null,
    }),
    onSuccess: () => {
      toast({ title: "تم إنشاء الدعوة" });
      setCreateOpen(false);
      setForm({ title: "", branchName: "", eventDate: "", eventTime: "", location: "", locationUrl: "", message: "", theme: "gold" });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/invitations"] });
    },
    onError: (e: any) => toast({ title: "فشل", description: e?.message || "", variant: "destructive" }),
  });

  const deleteInv = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/governance/invitations/${id}`),
    onSuccess: () => { toast({ title: "تم الحذف" }); queryClient.invalidateQueries({ queryKey: ["/api/governance/invitations"] }); },
  });

  const toggleInv = useMutation({
    mutationFn: ({ id, isActive }: any) => apiRequest("PATCH", `/api/governance/invitations/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/governance/invitations"] }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">دعوات افتتاح الفروع</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">أنشئ دعوة فاخرة وولّد رابطاً شخصياً لكل مساهم باسمه.</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="button-new-invitation"><Plus className="w-4 h-4 ml-1" /> دعوة جديدة</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {invitations.length === 0 ? <Empty /> : invitations.map((inv: any) => {
          const themeColor = INVITE_THEMES.find((t) => t.value === inv.theme)?.color || "#e6b450";
          return (
            <div key={inv.id} className="rounded-lg border p-3" data-testid={`row-invitation-${inv.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-2">
                  <span className="mt-1 inline-block w-3 h-3 rounded-full shrink-0" style={{ background: themeColor }} />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{inv.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {inv.branchName && <span>{inv.branchName} • </span>}
                      {fmtDate(inv.eventDate)}
                      {inv.eventTime && <span> • {inv.eventTime}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      <Eye className="w-3 h-3 inline ml-1" />{fmtNum(inv.openedCount)} فتحت من {fmtNum(inv.recipientsCount)} مرسلة
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="outline" className={inv.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500"}>
                    {inv.isActive ? "نشطة" : "موقوفة"}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => setRecipientsFor(inv)} data-testid={`button-recipients-${inv.id}`}>
                  <Send className="w-3.5 h-3.5 ml-1" /> الروابط والإرسال
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleInv.mutate({ id: inv.id, isActive: !inv.isActive })} data-testid={`button-toggle-invitation-${inv.id}`}>
                  {inv.isActive ? "إيقاف" : "تفعيل"}
                </Button>
                <Button size="icon" variant="ghost" className="text-red-600" onClick={() => { if (confirm("حذف الدعوة وكل روابطها؟")) deleteInv.mutate(inv.id); }} data-testid={`button-delete-invitation-${inv.id}`}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl" className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>دعوة افتتاح جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>عنوان الدعوة *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="حفل افتتاح فرع..." data-testid="input-invitation-title" /></div>
            <div><Label>اسم الفرع</Label><Input value={form.branchName} onChange={(e) => setForm({ ...form, branchName: e.target.value })} data-testid="input-invitation-branch" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>التاريخ</Label><Input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} data-testid="input-invitation-date" /></div>
              <div><Label>الوقت</Label><Input value={form.eventTime} onChange={(e) => setForm({ ...form, eventTime: e.target.value })} placeholder="٨:٠٠ مساءً" data-testid="input-invitation-time" /></div>
            </div>
            <div><Label>الموقع</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} data-testid="input-invitation-location" /></div>
            <div><Label>رابط الخريطة</Label><Input value={form.locationUrl} onChange={(e) => setForm({ ...form, locationUrl: e.target.value })} placeholder="https://maps.google.com/..." data-testid="input-invitation-location-url" /></div>
            <div><Label>نص الدعوة</Label><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} placeholder="يشرفنا حضوركم..." data-testid="input-invitation-message" /></div>
            <div>
              <Label>النمط</Label>
              <Select value={form.theme} onValueChange={(v) => setForm({ ...form, theme: v })}>
                <SelectTrigger data-testid="select-invitation-theme"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVITE_THEMES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: t.color }} /> {t.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={!form.title.trim() || createInv.isPending} onClick={() => createInv.mutate()} data-testid="button-save-invitation">
              {createInv.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />} حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recipients dialog */}
      {recipientsFor && (
        <RecipientsDialog invitation={recipientsFor} onClose={() => setRecipientsFor(null)} toast={toast} queryClient={queryClient} />
      )}
    </Card>
  );
}

function RecipientsDialog({ invitation, onClose, toast, queryClient }: any) {
  const { data: recipients = [], isLoading } = useQuery<any[]>({ queryKey: [`/api/governance/invitations/${invitation.id}/recipients`] });
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const generate = useMutation({
    mutationFn: () => apiRequest("POST", `/api/governance/invitations/${invitation.id}/recipients`, {}),
    onSuccess: (res: any) => {
      toast({ title: "تم توليد الروابط", description: res?.created ? `${res.created} رابط جديد` : "كل المساهمين لديهم روابط" });
      queryClient.invalidateQueries({ queryKey: [`/api/governance/invitations/${invitation.id}/recipients`] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/invitations"] });
    },
    onError: (e: any) => toast({ title: "فشل", description: e?.message || "", variant: "destructive" }),
  });

  const linkFor = (token: string) => `${origin}/invite/${token}`;

  const copyLink = (token: string) => {
    navigator.clipboard?.writeText(linkFor(token)).then(() => toast({ title: "تم نسخ الرابط" })).catch(() => {});
  };

  const sendWhatsApp = (r: any) => {
    const wa = toWhatsAppNumber(r.phone);
    if (!wa) { toast({ title: "لا يوجد رقم جوال صحيح", variant: "destructive" }); return; }
    const lines = [
      `مرحباً ${r.fullName} 🌟`,
      `يسعدنا دعوتكم لحضور ${invitation.title}`,
      "",
      "اضغط الرابط لمشاهدة دعوتكم الخاصة:",
      linkFor(r.token),
    ];
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" /> روابط المساهمين — {invitation.title}</DialogTitle></DialogHeader>
        <Button variant="outline" className="w-full" onClick={() => generate.mutate()} disabled={generate.isPending} data-testid="button-generate-recipients">
          {generate.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <RefreshCw className="w-4 h-4 ml-2" />}
          توليد روابط شخصية لكل المساهمين
        </Button>
        <div className="space-y-2 mt-2">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا توجد روابط بعد — اضغط الزر أعلاه للتوليد.</p>
          ) : recipients.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between gap-2 border-b pb-2" data-testid={`row-recipient-${r.id}`}>
              <div className="min-w-0">
                <div className="font-medium truncate">{r.fullName}</div>
                <div className="text-xs text-muted-foreground">
                  {r.openedAt ? <span className="text-green-600">فُتحت • {fmtNum(r.viewCount)} مشاهدة</span> : <span>لم تُفتح بعد</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => window.open(linkFor(r.token), "_blank")} data-testid={`button-preview-${r.id}`}><ExternalLink className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => copyLink(r.token)} data-testid={`button-copy-link-${r.id}`}><Copy className="w-4 h-4" /></Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={!r.phone} onClick={() => sendWhatsApp(r)} data-testid={`button-whatsapp-${r.id}`}>
                  <MessageSquare className="w-4 h-4 ml-1" /> واتساب
                </Button>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} data-testid="button-close-recipients">إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({ icon: Icon, label, value, accent, testid }: any) {
  const accents: Record<string, string> = {
    amber: "text-amber-600 bg-amber-100", green: "text-green-600 bg-green-100",
    blue: "text-blue-600 bg-blue-100", purple: "text-purple-600 bg-purple-100",
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accents[accent]}`}><Icon className="w-5 h-5" /></div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="font-bold text-lg" data-testid={testid}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return <div className="text-center text-muted-foreground py-10 text-sm">لا توجد بيانات</div>;
}
