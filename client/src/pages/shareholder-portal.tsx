import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  PieChart, Building2, Wallet, CalendarDays, FileText, Bell, Vote, User,
  TrendingUp, MapPin, Clock, CheckCircle2, Newspaper, Megaphone, Store,
  Landmark, LogOut, Loader2, Phone, Mail, CreditCard, Hash,
} from "lucide-react";
import logoUrl from "@assets/logo_-5_1765206843638.png";

function fmtMoney(n: any): string {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtNum(n: any): string {
  return Number(n || 0).toLocaleString("en-US");
}
function fmtDate(d: any): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return String(d);
  }
}

const CATEGORY_META: Record<string, { label: string; icon: any; cls: string }> = {
  news: { label: "خبر", icon: Newspaper, cls: "bg-blue-50 text-blue-700 border-blue-200" },
  announcement: { label: "إعلان", icon: Megaphone, cls: "bg-amber-50 text-amber-700 border-amber-200" },
  opening: { label: "افتتاح فرع", icon: Store, cls: "bg-green-50 text-green-700 border-green-200" },
  event: { label: "فعالية", icon: CalendarDays, cls: "bg-purple-50 text-purple-700 border-purple-200" },
};

const MEETING_TYPE_LABELS: Record<string, string> = {
  board: "مجلس الإدارة",
  ordinary_assembly: "جمعية عمومية عادية",
  extraordinary_assembly: "جمعية عمومية غير عادية",
  committee: "لجنة",
};

export default function ShareholderPortalPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("overview");

  const { data: meData, isLoading } = useQuery<any>({ queryKey: ["/api/shareholder/me"] });
  const shareholder = meData?.shareholder;
  const company = meData?.company;
  const hasShareholder = meData?.hasShareholder;

  const { data: announcements = [] } = useQuery<any[]>({ queryKey: ["/api/shareholder/announcements"], enabled: !!hasShareholder });
  const { data: meetings = [] } = useQuery<any[]>({ queryKey: ["/api/shareholder/meetings"], enabled: !!hasShareholder });
  const { data: dividends = [] } = useQuery<any[]>({ queryKey: ["/api/shareholder/dividends"], enabled: !!hasShareholder });
  const { data: documents = [] } = useQuery<any[]>({ queryKey: ["/api/shareholder/documents"], enabled: !!hasShareholder });
  const { data: notifications = [] } = useQuery<any[]>({ queryKey: ["/api/shareholder/notifications"], enabled: !!hasShareholder });
  const { data: resolutions = [] } = useQuery<any[]>({ queryKey: ["/api/shareholder/resolutions"], enabled: !!hasShareholder });

  const markRead = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/shareholder/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shareholder/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shareholder/me"] });
    },
  });

  const castVote = useMutation({
    mutationFn: ({ id, vote }: { id: number; vote: string }) =>
      apiRequest("POST", `/api/shareholder/resolutions/${id}/vote`, { vote }),
    onSuccess: () => {
      toast({ title: "تم تسجيل تصويتك بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/shareholder/resolutions"] });
    },
    onError: (e: any) => toast({ title: "تعذّر التصويت", description: e?.message || "", variant: "destructive" }),
  });

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {}
    window.location.href = "/login";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-white" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!hasShareholder) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-white p-6" dir="rtl">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-10 space-y-4">
            <img src={logoUrl} alt="logo" className="w-20 h-20 mx-auto object-contain" />
            <h2 className="text-xl font-bold" data-testid="text-no-shareholder">حسابك غير مرتبط بملف مساهم</h2>
            <p className="text-muted-foreground text-sm">يرجى التواصل مع إدارة الشركة لربط حسابك ببيانات المساهم الخاصة بك.</p>
            <Button variant="outline" onClick={logout} data-testid="button-logout">
              <LogOut className="w-4 h-4 ml-2" /> تسجيل الخروج
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const openVotes = resolutions.filter((r) => r.canVote && !r.myVote).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/60 to-white" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="logo" className="w-11 h-11 object-contain" />
            <div>
              <div className="font-bold text-sm sm:text-base leading-tight" data-testid="text-company-name">{company?.nameAr}</div>
              <div className="text-[11px] text-muted-foreground">بوابة المساهمين</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold" data-testid="text-shareholder-name">{shareholder?.fullName}</div>
              <div className="text-[11px] text-muted-foreground">مساهم</div>
            </div>
            <Button size="sm" variant="ghost" onClick={logout} data-testid="button-logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-24">
        {/* Hero share summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard icon={PieChart} label="نسبة الملكية" value={`${fmtNum(shareholder?.sharePercentage)}%`} accent="amber" testid="stat-percentage" />
          <StatCard icon={TrendingUp} label="عدد الأسهم" value={fmtNum(shareholder?.numberOfShares)} accent="green" testid="stat-shares" />
          <StatCard icon={Vote} label="تصويتات مفتوحة" value={fmtNum(openVotes)} accent="purple" testid="stat-open-votes" />
          <StatCard icon={Bell} label="إشعارات جديدة" value={fmtNum(unreadCount)} accent="blue" testid="stat-unread" />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-amber-50/70 p-1">
            <TabsTrigger value="overview" data-testid="tab-overview"><User className="w-4 h-4 ml-1" /> ملفي</TabsTrigger>
            <TabsTrigger value="news" data-testid="tab-news"><Newspaper className="w-4 h-4 ml-1" /> الأخبار</TabsTrigger>
            <TabsTrigger value="meetings" data-testid="tab-meetings"><CalendarDays className="w-4 h-4 ml-1" /> الاجتماعات</TabsTrigger>
            <TabsTrigger value="dividends" data-testid="tab-dividends"><Wallet className="w-4 h-4 ml-1" /> الأرباح</TabsTrigger>
            <TabsTrigger value="voting" data-testid="tab-voting"><Vote className="w-4 h-4 ml-1" /> التصويت</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents"><FileText className="w-4 h-4 ml-1" /> الوثائق</TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications">
              <Bell className="w-4 h-4 ml-1" /> الإشعارات {unreadCount > 0 && <span className="mr-1 bg-red-500 text-white rounded-full text-[10px] px-1.5">{unreadCount}</span>}
            </TabsTrigger>
          </TabsList>

          {/* Overview / my data */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-amber-600" /> بياناتي الشخصية</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
                <InfoRow icon={User} label="الاسم" value={shareholder?.fullName} testid="info-name" />
                <InfoRow icon={Hash} label="نوع المساهم" value={shareholderTypeLabel(shareholder?.shareholderType)} />
                <InfoRow icon={Hash} label="الهوية / السجل" value={shareholder?.nationalId || shareholder?.commercialRegister} />
                <InfoRow icon={Phone} label="الجوال" value={shareholder?.phone} testid="info-phone" />
                <InfoRow icon={Mail} label="البريد" value={shareholder?.email} />
                <InfoRow icon={MapPin} label="العنوان" value={shareholder?.address} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="w-4 h-4 text-amber-600" /> البيانات البنكية</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
                <InfoRow icon={Landmark} label="البنك" value={shareholder?.bankName} />
                <InfoRow icon={CreditCard} label="رقم الحساب" value={shareholder?.bankAccountNumber} />
                <InfoRow icon={Hash} label="الآيبان" value={shareholder?.iban} testid="info-iban" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4 text-amber-600" /> بيانات الشركة</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
                <InfoRow icon={Building2} label="الاسم" value={company?.nameAr} />
                <InfoRow icon={Landmark} label="الشكل القانوني" value={company?.legalForm} />
                <InfoRow icon={Hash} label="السجل التجاري" value={company?.commercialRegister} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* News & announcements */}
          <TabsContent value="news" className="mt-4 space-y-3">
            {announcements.length === 0 && <Empty text="لا توجد أخبار أو إعلانات حالياً" />}
            {announcements.map((a) => {
              const meta = CATEGORY_META[a.category] || CATEGORY_META.announcement;
              const Icon = meta.icon;
              return (
                <Card key={a.id} data-testid={`card-announcement-${a.id}`}>
                  {a.imageUrl && <img src={a.imageUrl} alt={a.title} className="w-full h-44 object-cover rounded-t-xl" />}
                  <CardContent className="py-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={meta.cls}><Icon className="w-3 h-3 ml-1" /> {meta.label}</Badge>
                      {a.eventDate && <span className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {fmtDate(a.eventDate)}</span>}
                    </div>
                    <h3 className="font-bold">{a.title}</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>
                    <div className="text-[11px] text-muted-foreground">{fmtDate(a.publishedAt)}</div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Meetings */}
          <TabsContent value="meetings" className="mt-4 space-y-3">
            {meetings.length === 0 && <Empty text="لا توجد اجتماعات مجدولة" />}
            {meetings.map((m) => (
              <Card key={m.id} data-testid={`card-meeting-${m.id}`}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">{MEETING_TYPE_LABELS[m.meetingType] || m.meetingType}</Badge>
                    <Badge variant="outline">{statusLabel(m.status)}</Badge>
                  </div>
                  <h3 className="font-bold">{m.title}</h3>
                  {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {fmtDate(m.meetingDate)}</span>
                    {m.startTime && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {m.startTime}</span>}
                    {m.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {m.location}</span>}
                  </div>
                  {m.virtualMeetingLink && m.status === "scheduled" && (
                    <a href={m.virtualMeetingLink} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" data-testid={`button-join-${m.id}`}>رابط الحضور عن بُعد</Button>
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Dividends */}
          <TabsContent value="dividends" className="mt-4 space-y-3">
            {dividends.length === 0 && <Empty text="لا توجد توزيعات أرباح" />}
            {dividends.map((d) => (
              <Card key={d.id} data-testid={`card-dividend-${d.id}`}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="font-bold">توزيع {d.fiscalYear}</h3>
                    <Badge variant="outline">{statusLabel(d.status)}</Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <MiniStat label="ربح السهم" value={`${fmtMoney(d.amountPerShare)} ﷼`} />
                    <MiniStat label="أسهمي" value={fmtNum(d.myShares)} />
                    <MiniStat label="نصيبي" value={`${fmtMoney(d.myAmount)} ﷼`} highlight />
                    <MiniStat label="تاريخ الصرف" value={fmtDate(d.paymentDate)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Voting */}
          <TabsContent value="voting" className="mt-4 space-y-3">
            {resolutions.length === 0 && <Empty text="لا توجد قرارات للتصويت" />}
            {resolutions.map((r) => (
              <Card key={r.id} data-testid={`card-resolution-${r.id}`}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">{r.resolutionNumber}</span>
                    <Badge variant="outline">{statusLabel(r.status)}</Badge>
                  </div>
                  <h3 className="font-bold">{r.title}</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.description}</p>
                  {r.myVote ? (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg p-2">
                      <CheckCircle2 className="w-4 h-4" /> صوّتت: {voteLabel(r.myVote)}
                    </div>
                  ) : r.canVote ? (
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={castVote.isPending} onClick={() => castVote.mutate({ id: r.id, vote: "for" })} data-testid={`button-vote-for-${r.id}`}>موافق</Button>
                      <Button size="sm" variant="destructive" disabled={castVote.isPending} onClick={() => castVote.mutate({ id: r.id, vote: "against" })} data-testid={`button-vote-against-${r.id}`}>غير موافق</Button>
                      <Button size="sm" variant="outline" disabled={castVote.isPending} onClick={() => castVote.mutate({ id: r.id, vote: "abstain" })} data-testid={`button-vote-abstain-${r.id}`}>امتناع</Button>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">التصويت غير متاح حالياً</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents" className="mt-4 space-y-3">
            {documents.length === 0 && <Empty text="لا توجد وثائق" />}
            {documents.map((doc) => (
              <Card key={doc.id} data-testid={`card-document-${doc.id}`}>
                <CardContent className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{doc.documentName}</div>
                      <div className="text-[11px] text-muted-foreground">{fmtDate(doc.createdAt)}</div>
                    </div>
                  </div>
                  <a href={doc.fileUrl} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" data-testid={`button-view-doc-${doc.id}`}>عرض</Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications" className="mt-4 space-y-2">
            {notifications.length === 0 && <Empty text="لا توجد إشعارات" />}
            {notifications.map((n) => (
              <Card key={n.id} className={n.readAt ? "" : "border-amber-300 bg-amber-50/40"} data-testid={`card-notification-${n.id}`}>
                <CardContent className="py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      {!n.readAt && <span className="w-2 h-2 rounded-full bg-amber-500" />} {n.title}
                    </h4>
                    {!n.readAt && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => markRead.mutate(n.id)} data-testid={`button-read-${n.id}`}>تعليم كمقروء</Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.body}</p>
                  <div className="text-[11px] text-muted-foreground">{fmtDate(n.createdAt)}</div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent, testid }: any) {
  const accents: Record<string, string> = {
    amber: "text-amber-600 bg-amber-100",
    green: "text-green-600 bg-green-100",
    purple: "text-purple-600 bg-purple-100",
    blue: "text-blue-600 bg-blue-100",
  };
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accents[accent]}`}><Icon className="w-5 h-5" /></div>
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground truncate">{label}</div>
          <div className="font-bold text-lg leading-tight" data-testid={testid}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ icon: Icon, label, value, testid }: any) {
  return (
    <div className="flex items-center gap-2 border-b border-dashed pb-2">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground min-w-[90px]">{label}:</span>
      <span className="font-medium" data-testid={testid}>{value || "—"}</span>
    </div>
  );
}

function MiniStat({ label, value, highlight }: any) {
  return (
    <div className={`rounded-lg p-2 text-center ${highlight ? "bg-amber-100" : "bg-muted/50"}`}>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`font-bold text-sm ${highlight ? "text-amber-700" : ""}`}>{value}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center text-muted-foreground py-12 text-sm" data-testid="text-empty">{text}</div>;
}

function shareholderTypeLabel(t: string): string {
  return { individual: "فرد", company: "شركة", government: "جهة حكومية", institution: "مؤسسة" }[t] || t || "—";
}
function statusLabel(s: string): string {
  return {
    scheduled: "مجدول", in_progress: "جارٍ", completed: "منتهٍ", cancelled: "ملغى", postponed: "مؤجل",
    announced: "معلن", record_closed: "إغلاق السجل", in_payment: "قيد الصرف",
    draft: "مسودة", voting: "تصويت مفتوح", approved: "معتمد", rejected: "مرفوض", implemented: "منفّذ",
  }[s] || s || "—";
}
function voteLabel(v: string): string {
  return { for: "موافق", against: "غير موافق", abstain: "امتناع" }[v] || v;
}
