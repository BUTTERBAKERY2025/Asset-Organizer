import { useState, useEffect } from "react";
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
  PartyPopper, Eye, ExternalLink, Sparkles, Settings, Save, FileText,
  Inbox, ChevronLeft, UserCog, CheckCircle2, XCircle, History, LogIn, Vote, FileSearch,
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
function fmtDateTime(d: any): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("ar-SA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return String(d); }
}
const ACTIVITY_LABELS: Record<string, string> = {
  login: "تسجيل دخول",
  otp_verified: "تحقق بخطوتين",
  vote: "تصويت على قرار",
  profile_request: "طلب تحديث بيانات",
  document_view: "اطلاع على وثيقة",
};
function activityLabel(action: string): string {
  return ACTIVITY_LABELS[action] || action;
}
function ActivityIcon({ action, className }: { action: string; className?: string }) {
  const Icon = action === "vote" ? Vote : action === "document_view" ? FileSearch : action === "profile_request" ? UserCog : LogIn;
  return <Icon className={className} />;
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
            <TabsTrigger value="tickets" data-testid="tab-tickets"><Inbox className="w-4 h-4 ml-1" /> صندوق الرسائل</TabsTrigger>
            <TabsTrigger value="profile-requests" data-testid="tab-profile-requests"><UserCog className="w-4 h-4 ml-1" /> طلبات التحديث</TabsTrigger>
            <TabsTrigger value="announcements" data-testid="tab-announcements"><Newspaper className="w-4 h-4 ml-1" /> الأخبار والإعلانات</TabsTrigger>
            <TabsTrigger value="accounts" data-testid="tab-accounts"><KeyRound className="w-4 h-4 ml-1" /> حسابات البوابة</TabsTrigger>
            <TabsTrigger value="invitations" data-testid="tab-invitations"><PartyPopper className="w-4 h-4 ml-1" /> دعوات الافتتاح</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity"><History className="w-4 h-4 ml-1" /> سجل النشاط</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings"><Settings className="w-4 h-4 ml-1" /> إعدادات البوابة</TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="mt-4">
            <DashboardTab dashboard={dashboard} />
          </TabsContent>

          {/* Communication */}
          <TabsContent value="communication" className="mt-4">
            <CommunicationTab accounts={accounts} history={notifHistory} toast={toast} queryClient={queryClient} />
          </TabsContent>

          {/* Tickets / Messages inbox */}
          <TabsContent value="tickets" className="mt-4">
            <TicketsTab toast={toast} queryClient={queryClient} />
          </TabsContent>

          {/* Profile update requests */}
          <TabsContent value="profile-requests" className="mt-4">
            <ProfileRequestsTab toast={toast} queryClient={queryClient} />
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

          {/* Activity log (all shareholders) */}
          <TabsContent value="activity" className="mt-4">
            <ActivityTab accounts={accounts} />
          </TabsContent>

          {/* Portal Settings */}
          <TabsContent value="settings" className="mt-4">
            <SettingsTab toast={toast} queryClient={queryClient} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function SettingsTab({ toast, queryClient }: any) {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/governance/shareholder-portal-settings"] });
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (data) {
      setForm({
        welcomeTitle: data.welcomeTitle || "",
        welcomeMessage: data.welcomeMessage || "",
        showNews: data.showNews ?? true,
        showMeetings: data.showMeetings ?? true,
        showDividends: data.showDividends ?? true,
        showVoting: data.showVoting ?? true,
        showDocuments: data.showDocuments ?? true,
        showFinancials: data.showFinancials ?? true,
        showMessages: data.showMessages ?? true,
        showProfileEdits: data.showProfileEdits ?? true,
        supportEmail: data.supportEmail || "",
        supportPhone: data.supportPhone || "",
        enableWhatsapp: data.enableWhatsapp ?? true,
        requireTwoFactor: data.requireTwoFactor ?? false,
        twoFactorChannel: data.twoFactorChannel || "whatsapp",
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/governance/shareholder-portal-settings", {
      ...form,
      welcomeTitle: form.welcomeTitle.trim() || null,
      welcomeMessage: form.welcomeMessage.trim() || null,
      supportEmail: form.supportEmail.trim() || null,
      supportPhone: form.supportPhone.trim() || null,
    }),
    onSuccess: () => {
      toast({ title: "تم حفظ الإعدادات" });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/shareholder-portal-settings"] });
    },
    onError: (e: any) => toast({ title: "فشل الحفظ", description: e?.message || "", variant: "destructive" }),
  });

  if (isLoading || !form) {
    return <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-600" /></div>;
  }

  const SECTIONS = [
    { key: "showNews", label: "الأخبار والإعلانات", icon: Newspaper },
    { key: "showMeetings", label: "الاجتماعات والمحاضر", icon: CalendarDays },
    { key: "showDividends", label: "توزيعات الأرباح", icon: TrendingUp },
    { key: "showVoting", label: "التصويت على القرارات", icon: ShieldCheck },
    { key: "showDocuments", label: "الوثائق", icon: FileText },
    { key: "showFinancials", label: "البيانات البنكية في الملف", icon: Landmark },
    { key: "showMessages", label: "صندوق الرسائل والاستفسارات", icon: Inbox },
    { key: "showProfileEdits", label: "طلبات تحديث البيانات الذاتية", icon: UserCog },
  ];

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Eye className="w-4 h-4 text-amber-600" /> الأقسام الظاهرة للمساهم</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground mb-1">عند إيقاف أي قسم سيختفي تماماً من بوابة المساهم.</p>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2"><Icon className="w-4 h-4 text-amber-600" /><span className="text-sm">{s.label}</span></div>
                <Switch checked={!!form[s.key]} onCheckedChange={(v) => setForm({ ...form, [s.key]: v })} data-testid={`switch-${s.key}`} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-600" /> الترحيب والتواصل</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>عنوان الترحيب</Label><Input value={form.welcomeTitle} onChange={(e) => setForm({ ...form, welcomeTitle: e.target.value })} placeholder="أهلاً بك في بوابة المساهمين" data-testid="input-welcome-title" /></div>
          <div><Label>رسالة الترحيب</Label><Textarea value={form.welcomeMessage} onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })} rows={3} placeholder="رسالة قصيرة تظهر للمساهم عند الدخول (اختياري)" data-testid="input-welcome-message" /></div>
          <div><Label>بريد الدعم (اختياري)</Label><Input type="email" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} data-testid="input-support-email" /></div>
          <div><Label>جوال الدعم (اختياري)</Label><Input value={form.supportPhone} onChange={(e) => setForm({ ...form, supportPhone: e.target.value })} data-testid="input-support-phone" /></div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-green-600" /><span className="text-sm">تفعيل إشعارات واتساب للمساهمين</span></div>
            <Switch checked={!!form.enableWhatsapp} onCheckedChange={(v) => setForm({ ...form, enableWhatsapp: v })} data-testid="switch-enable-whatsapp" />
          </div>
          <div className="rounded-lg border p-3 space-y-3 bg-amber-50/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-amber-600" /><span className="text-sm font-medium">التحقق بخطوتين عند الدخول (OTP)</span></div>
              <Switch checked={!!form.requireTwoFactor} onCheckedChange={(v) => setForm({ ...form, requireTwoFactor: v })} data-testid="switch-require-2fa" />
            </div>
            <p className="text-xs text-muted-foreground">عند التفعيل، يُطلب من كل مساهم إدخال رمز تحقق يُرسل إلى جواله بعد كلمة المرور.</p>
            {form.requireTwoFactor && (
              <div>
                <Label className="text-xs">قناة إرسال الرمز</Label>
                <Select value={form.twoFactorChannel} onValueChange={(v) => setForm({ ...form, twoFactorChannel: v })}>
                  <SelectTrigger data-testid="select-2fa-channel"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">واتساب</SelectItem>
                    <SelectItem value="sms">رسالة نصية (SMS)</SelectItem>
                    <SelectItem value="both">واتساب ورسالة نصية معاً</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()} data-testid="button-save-settings">
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Save className="w-4 h-4 ml-2" />} حفظ الإعدادات
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityTab({ accounts }: any) {
  const [shFilter, setShFilter] = useState<string>("all");
  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/governance/shareholder-activity", shFilter],
    queryFn: async () => {
      const qs = shFilter && shFilter !== "all" ? `?shareholderId=${shFilter}` : "";
      const res = await fetch(`/api/governance/shareholder-activity${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("فشل في جلب سجل النشاط");
      return res.json();
    },
  });

  const shareholderOptions = (accounts || [])
    .filter((a: any) => a.shareholderId || a.id)
    .map((a: any) => ({ id: a.shareholderId || a.id, name: a.fullName || a.name || `#${a.shareholderId || a.id}` }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4 text-amber-600" /> سجل نشاط المساهمين</CardTitle>
          <div className="w-56">
            <Select value={shFilter} onValueChange={setShFilter}>
              <SelectTrigger data-testid="select-activity-shareholder"><SelectValue placeholder="كل المساهمين" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المساهمين</SelectItem>
                {shareholderOptions.map((o: any) => (
                  <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-600" /></div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm" data-testid="text-no-activity">لا يوجد نشاط مسجّل</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r: any) => (
              <div key={r.id} className="flex items-start gap-3 rounded-lg border p-3" data-testid={`activity-row-${r.id}`}>
                <div className="w-9 h-9 shrink-0 rounded-full bg-amber-100 flex items-center justify-center">
                  <ActivityIcon action={r.action} className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{r.shareholderName || "—"}</span>
                    <Badge variant="secondary" className="text-[11px]">{activityLabel(r.action)}</Badge>
                  </div>
                  {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                  <p className="text-[11px] text-muted-foreground mt-0.5" dir="ltr">{fmtDateTime(r.createdAt)}{r.ipAddress ? ` · ${r.ipAddress}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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

  // رسالة شخصية تتضمن اسم المساهم + الرابط (تُستخدم للنسخ وللإرسال عبر واتساب)
  const messageFor = (r: any) =>
    [
      `مرحباً ${r.fullName} 🌟`,
      `يسعدنا دعوتكم لحضور ${invitation.title}`,
      invitation.branchName ? `📍 ${invitation.branchName}` : "",
      "",
      "اضغط الرابط لمشاهدة دعوتكم الشخصية:",
      linkFor(r.token),
    ]
      .filter(Boolean)
      .join("\n");

  const copyLink = (r: any) => {
    navigator.clipboard
      ?.writeText(messageFor(r))
      .then(() => toast({ title: "تم نسخ الرسالة", description: "تتضمن اسم المساهم والرابط" }))
      .catch(() => {});
  };

  const sendWhatsApp = (r: any) => {
    const wa = toWhatsAppNumber(r.phone);
    if (!wa) { toast({ title: "لا يوجد رقم جوال صحيح", variant: "destructive" }); return; }
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(messageFor(r))}`, "_blank");
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
                <Button size="icon" variant="ghost" onClick={() => copyLink(r)} data-testid={`button-copy-link-${r.id}`}><Copy className="w-4 h-4" /></Button>
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

/* ===================== Tickets / Messages inbox (admin) ===================== */

const TICKET_STATUS_META: Record<string, { label: string; cls: string }> = {
  new: { label: "جديد", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  in_progress: { label: "قيد المعالجة", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  closed: { label: "مغلق", cls: "bg-gray-100 text-gray-600 border-gray-200" },
};

function TicketsTab({ toast, queryClient }: any) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const [reply, setReply] = useState("");

  const listKey = ["/api/governance/shareholder-tickets", statusFilter];
  const { data: tickets = [], isLoading } = useQuery<any[]>({
    queryKey: listKey,
    queryFn: () => {
      const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      return fetch(`/api/governance/shareholder-tickets${qs}`, { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("فشل في جلب التذاكر");
        return r.json();
      });
    },
  });

  const { data: detail } = useQuery<any>({
    queryKey: ["/api/governance/shareholder-tickets", "detail", openId],
    enabled: openId != null,
    queryFn: () => fetch(`/api/governance/shareholder-tickets/${openId}`, { credentials: "include" }).then((r) => {
      if (!r.ok) throw new Error("فشل في جلب التذكرة");
      return r.json();
    }),
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/governance/shareholder-tickets"] });
  };

  const sendReply = useMutation({
    mutationFn: () => apiRequest("POST", `/api/governance/shareholder-tickets/${openId}/messages`, { body: reply }),
    onSuccess: (res: any) => {
      setReply("");
      toast({ title: "تم إرسال الرد", description: res?.whatsappQueued ? "تم إرسال إشعار واتساب للمساهم" : undefined });
      refreshAll();
    },
    onError: (e: any) => toast({ title: "تعذّر الإرسال", description: e?.message || "", variant: "destructive" }),
  });

  const changeStatus = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/governance/shareholder-tickets/${openId}`, { status }),
    onSuccess: () => {
      toast({ title: "تم تحديث الحالة" });
      refreshAll();
    },
    onError: (e: any) => toast({ title: "تعذّر التحديث", description: e?.message || "", variant: "destructive" }),
  });

  // عرض المحادثة
  if (openId != null) {
    const ticket = detail?.ticket;
    const messages: any[] = detail?.messages || [];
    const meta = TICKET_STATUS_META[ticket?.status] || TICKET_STATUS_META.new;
    return (
      <div className="space-y-3 max-w-3xl">
        <button onClick={() => setOpenId(null)} className="flex items-center gap-1 text-sm text-amber-700" data-testid="button-back-tickets">
          <ChevronLeft className="w-4 h-4 rotate-180" /> رجوع للقائمة
        </button>
        <Card>
          <CardContent className="py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate" data-testid="text-ticket-subject">{ticket?.subject || "—"}</div>
              <div className="text-[11px] text-muted-foreground">{ticket?.shareholderName} • {ticket?.shareholderPhone || "—"}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
              <Select value={ticket?.status} onValueChange={(v) => changeStatus.mutate(v)}>
                <SelectTrigger className="h-8 w-[140px]" data-testid="select-ticket-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">جديد</SelectItem>
                  <SelectItem value="in_progress">قيد المعالجة</SelectItem>
                  <SelectItem value="closed">مغلق</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {messages.map((m) => {
            const admin = m.senderType === "admin";
            return (
              <div key={m.id} className={`flex ${admin ? "justify-start" : "justify-end"}`} data-testid={`message-${m.id}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${admin ? "bg-amber-100 text-amber-900" : "bg-white border"}`}>
                  <div className="text-[11px] text-muted-foreground mb-0.5">{admin ? (m.senderName || "الإدارة") : (ticket?.shareholderName || "المساهم")}</div>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                  <div className="text-[10px] text-muted-foreground mt-1">{fmtDate(m.createdAt)}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-end gap-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="اكتب ردك للمساهم..."
            rows={2}
            className="flex-1 resize-none"
            data-testid="input-ticket-reply"
          />
          <Button onClick={() => sendReply.mutate()} disabled={!reply.trim() || sendReply.isPending} className="bg-amber-600 hover:bg-amber-700 shrink-0" data-testid="button-send-reply">
            {sendReply.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    );
  }

  // القائمة
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[180px]" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="new">جديد</SelectItem>
            <SelectItem value="in_progress">قيد المعالجة</SelectItem>
            <SelectItem value="closed">مغلق</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-600" /></div>}
      {!isLoading && tickets.length === 0 && <Empty />}
      <div className="space-y-2">
        {tickets.map((t) => {
          const meta = TICKET_STATUS_META[t.status] || TICKET_STATUS_META.new;
          return (
            <Card
              key={t.id}
              className={`cursor-pointer hover:border-amber-300 transition-colors ${t.unreadByAdmin ? "border-amber-300 bg-amber-50/40" : ""}`}
              onClick={() => setOpenId(t.id)}
              data-testid={`card-ticket-${t.id}`}
            >
              <CardContent className="py-3 flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2">
                  {t.unreadByAdmin && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{t.subject}</div>
                    <div className="text-[11px] text-muted-foreground">{t.shareholderName} • {fmtDate(t.lastMessageAt)}</div>
                  </div>
                </div>
                <Badge variant="outline" className={`${meta.cls} shrink-0`}>{meta.label}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== Profile update requests (admin) ===================== */

const REQ_STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "قيد المراجعة", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "تمت الموافقة", cls: "bg-green-50 text-green-700 border-green-200" },
  rejected: { label: "مرفوض", cls: "bg-red-50 text-red-700 border-red-200" },
};

function ProfileRequestsTab({ toast, queryClient }: any) {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const { data: requests = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/governance/profile-requests", statusFilter],
    queryFn: () => {
      const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      return fetch(`/api/governance/profile-requests${qs}`, { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("فشل في جلب الطلبات");
        return r.json();
      });
    },
  });

  const refreshAll = () => queryClient.invalidateQueries({ queryKey: ["/api/governance/profile-requests"] });

  const review = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "reject" }) =>
      apiRequest("POST", `/api/governance/profile-requests/${id}/${action}`, { reviewNote: reviewNote || undefined }),
    onSuccess: (res: any, vars) => {
      toast({
        title: vars.action === "approve" ? "تمت الموافقة وتحديث البيانات" : "تم رفض الطلب",
        description: res?.whatsappQueued ? "تم إرسال إشعار واتساب للمساهم" : undefined,
      });
      setReviewId(null);
      setReviewNote("");
      refreshAll();
    },
    onError: (e: any) => toast({ title: "تعذّر تنفيذ الإجراء", description: e?.message || "", variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[180px]" data-testid="select-request-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">قيد المراجعة</SelectItem>
            <SelectItem value="approved">تمت الموافقة</SelectItem>
            <SelectItem value="rejected">مرفوض</SelectItem>
            <SelectItem value="all">الكل</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-600" /></div>}
      {!isLoading && requests.length === 0 && <Empty />}

      <div className="space-y-2">
        {requests.map((r) => {
          const meta = REQ_STATUS_META[r.status] || REQ_STATUS_META.pending;
          const changes: any[] = Array.isArray(r.changes) ? r.changes : [];
          const isReviewing = reviewId === r.id;
          return (
            <Card key={r.id} data-testid={`card-profile-request-${r.id}`}>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{r.shareholderName}</div>
                    <div className="text-[11px] text-muted-foreground">{r.shareholderPhone || "—"} • {fmtDate(r.createdAt)}</div>
                  </div>
                  <Badge variant="outline" className={`${meta.cls} shrink-0`}>{meta.label}</Badge>
                </div>

                <div className="space-y-1 bg-muted/40 rounded-lg p-2">
                  {changes.map((c, i) => (
                    <div key={i} className="text-xs flex flex-wrap items-center gap-1">
                      <span className="text-muted-foreground">{c.label}:</span>
                      <span className="line-through text-red-400">{c.oldValue || "—"}</span>
                      <ChevronLeft className="w-3 h-3 text-muted-foreground" />
                      <span className="text-green-600 font-medium">{c.newValue || "—"}</span>
                    </div>
                  ))}
                </div>

                {r.note && <div className="text-xs text-muted-foreground">ملاحظة المساهم: {r.note}</div>}
                {r.reviewNote && <div className="text-xs text-muted-foreground border-t pt-1">ملاحظة الإدارة: {r.reviewNote}</div>}

                {r.status === "pending" && !isReviewing && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => { setReviewId(r.id); setReviewNote(""); }} className="bg-green-600 hover:bg-green-700 h-8" data-testid={`button-review-${r.id}`}>
                      مراجعة الطلب
                    </Button>
                  </div>
                )}

                {isReviewing && (
                  <div className="space-y-2 border-t pt-2">
                    <Textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      rows={2}
                      placeholder="ملاحظة المراجعة (اختياري — تظهر للمساهم)"
                      className="resize-none"
                      data-testid="input-review-note"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: r.id, action: "approve" })} className="bg-green-600 hover:bg-green-700 h-8 flex-1" data-testid={`button-approve-${r.id}`}>
                        <CheckCircle2 className="w-4 h-4 ml-1" /> موافقة وتطبيق
                      </Button>
                      <Button size="sm" disabled={review.isPending} variant="destructive" onClick={() => review.mutate({ id: r.id, action: "reject" })} className="h-8 flex-1" data-testid={`button-reject-${r.id}`}>
                        <XCircle className="w-4 h-4 ml-1" /> رفض
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setReviewId(null)} className="h-8" data-testid={`button-cancel-review-${r.id}`}>
                        إلغاء
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
