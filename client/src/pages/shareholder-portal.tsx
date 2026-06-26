import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PieChart, Building2, Wallet, CalendarDays, FileText, Bell, Vote, User,
  TrendingUp, MapPin, Clock, CheckCircle2, Newspaper, Megaphone, Store,
  Landmark, LogOut, Loader2, Phone, Mail, CreditCard, Hash, Printer,
  ScrollText, ChevronLeft, MessageSquare, Send, Plus, UserCog, Save,
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

const NAV_ITEMS = [
  { key: "overview", label: "ملفي", icon: User },
  { key: "news", label: "الأخبار", icon: Newspaper },
  { key: "meetings", label: "الاجتماعات", icon: CalendarDays },
  { key: "dividends", label: "الأرباح", icon: Wallet },
  { key: "voting", label: "التصويت", icon: Vote },
  { key: "messages", label: "الرسائل", icon: MessageSquare },
  { key: "profile-edits", label: "تحديث بياناتي", icon: UserCog },
];

const SECTION_TITLES: Record<string, string> = {
  overview: "ملفي",
  news: "الأخبار والإعلانات",
  meetings: "الاجتماعات والمحاضر",
  dividends: "توزيعات الأرباح",
  voting: "التصويت على القرارات",
  documents: "وثائقي",
  notifications: "الإشعارات",
  messages: "الرسائل والاستفسارات",
  "profile-edits": "تحديث بياناتي",
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
  const { data: portalSettings } = useQuery<any>({ queryKey: ["/api/shareholder/portal-settings"], enabled: !!hasShareholder });

  const settings = {
    welcomeTitle: portalSettings?.welcomeTitle || "",
    welcomeMessage: portalSettings?.welcomeMessage || "",
    showNews: portalSettings?.showNews ?? true,
    showMeetings: portalSettings?.showMeetings ?? true,
    showDividends: portalSettings?.showDividends ?? true,
    showVoting: portalSettings?.showVoting ?? true,
    showDocuments: portalSettings?.showDocuments ?? true,
    showFinancials: portalSettings?.showFinancials ?? true,
    showMessages: portalSettings?.showMessages ?? true,
    showProfileEdits: portalSettings?.showProfileEdits ?? true,
  };
  const sectionEnabled: Record<string, boolean> = {
    overview: true,
    news: settings.showNews,
    meetings: settings.showMeetings,
    dividends: settings.showDividends,
    voting: settings.showVoting,
    documents: settings.showDocuments,
    messages: settings.showMessages,
    "profile-edits": settings.showProfileEdits,
    notifications: true,
  };
  const navItems = NAV_ITEMS.filter((i) => sectionEnabled[i.key] !== false);

  // إن أُوقف القسم المعروض حالياً، نرجع لـ "ملفي"
  useEffect(() => {
    if (sectionEnabled[tab] === false) setTab("overview");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, settings.showNews, settings.showMeetings, settings.showDividends, settings.showVoting, settings.showDocuments, settings.showMessages, settings.showProfileEdits]);

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
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={logoUrl} alt="logo" className="w-10 h-10 object-contain shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-sm leading-tight truncate" data-testid="text-company-name">{company?.nameAr}</div>
              <div className="text-[11px] text-muted-foreground">بوابة المساهمين</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {settings.showDocuments && (
              <button
                onClick={() => setTab("documents")}
                className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors ${tab === "documents" ? "bg-amber-100 text-amber-700" : "text-muted-foreground hover:bg-muted"}`}
                data-testid="button-header-documents"
                aria-label="وثائقي"
              >
                <FileText className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setTab("notifications")}
              className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors ${tab === "notifications" ? "bg-amber-100 text-amber-700" : "text-muted-foreground hover:bg-muted"}`}
              data-testid="button-header-notifications"
              aria-label="الإشعارات"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center" data-testid="badge-unread-header">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={logout}
              className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
              data-testid="button-logout"
              aria-label="تسجيل الخروج"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-28">
        {/* Greeting */}
        <div className="mb-3">
          <div className="text-[13px] text-muted-foreground">مرحباً 👋</div>
          <div className="text-lg font-bold" data-testid="text-shareholder-name">{shareholder?.fullName}</div>
        </div>

        {(settings.welcomeTitle || settings.welcomeMessage) && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3" data-testid="card-welcome">
            {settings.welcomeTitle && <div className="font-bold text-amber-800 text-sm">{settings.welcomeTitle}</div>}
            {settings.welcomeMessage && <div className="text-sm text-amber-700 whitespace-pre-wrap mt-0.5">{settings.welcomeMessage}</div>}
          </div>
        )}

        {/* Hero share summary */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <StatCard icon={PieChart} label="نسبة الملكية" value={`${fmtNum(shareholder?.sharePercentage)}%`} accent="amber" testid="stat-percentage" />
          <StatCard icon={TrendingUp} label="عدد الأسهم" value={fmtNum(shareholder?.numberOfShares)} accent="green" testid="stat-shares" />
          {settings.showVoting && <StatCard icon={Vote} label="تصويتات مفتوحة" value={fmtNum(openVotes)} accent="purple" testid="stat-open-votes" onClick={() => setTab("voting")} />}
          <StatCard icon={Bell} label="إشعارات جديدة" value={fmtNum(unreadCount)} accent="blue" testid="stat-unread" onClick={() => setTab("notifications")} />
        </div>

        {/* Section title */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-5 rounded-full bg-amber-500" />
          <h2 className="font-bold text-base" data-testid="text-section-title">{SECTION_TITLES[tab]}</h2>
        </div>

        {/* ===== Overview ===== */}
        {tab === "overview" && (
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => printStatement(shareholder, company, dividends, settings.showFinancials, settings.showDividends)}
              data-testid="button-print-statement"
            >
              <Printer className="w-4 h-4 ml-2" /> طباعة كشف الحساب (PDF)
            </Button>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-amber-600" /> بياناتي الشخصية</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <InfoRow icon={User} label="الاسم" value={shareholder?.fullName} testid="info-name" />
                <InfoRow icon={Hash} label="نوع المساهم" value={shareholderTypeLabel(shareholder?.shareholderType)} />
                <InfoRow icon={Hash} label="الهوية / السجل" value={shareholder?.nationalId || shareholder?.commercialRegister} />
                <InfoRow icon={Phone} label="الجوال" value={shareholder?.phone} testid="info-phone" />
                <InfoRow icon={Mail} label="البريد" value={shareholder?.email} />
                <InfoRow icon={MapPin} label="العنوان" value={shareholder?.address} />
              </CardContent>
            </Card>

            {settings.showFinancials && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CreditCard className="w-4 h-4 text-amber-600" /> البيانات البنكية</CardTitle></CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <InfoRow icon={Landmark} label="البنك" value={shareholder?.bankName} />
                  <InfoRow icon={CreditCard} label="رقم الحساب" value={shareholder?.bankAccountNumber} />
                  <InfoRow icon={Hash} label="الآيبان" value={shareholder?.iban} testid="info-iban" />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4 text-amber-600" /> بيانات الشركة</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <InfoRow icon={Building2} label="الاسم" value={company?.nameAr} />
                <InfoRow icon={Landmark} label="الشكل القانوني" value={company?.legalForm} />
                <InfoRow icon={Hash} label="السجل التجاري" value={company?.commercialRegister} />
              </CardContent>
            </Card>

            {/* Quick links */}
            {(settings.showDocuments || settings.showDividends) && (
              <div className="grid grid-cols-2 gap-2.5">
                {settings.showDocuments && <QuickLink icon={FileText} label="وثائقي" count={documents.length} onClick={() => setTab("documents")} testid="quick-documents" />}
                {settings.showDividends && <QuickLink icon={Wallet} label="الأرباح" count={dividends.length} onClick={() => setTab("dividends")} testid="quick-dividends" />}
              </div>
            )}
          </div>
        )}

        {/* ===== News ===== */}
        {tab === "news" && settings.showNews && (
          <div className="space-y-3">
            {announcements.length === 0 && <Empty text="لا توجد أخبار أو إعلانات حالياً" />}
            {announcements.map((a) => {
              const meta = CATEGORY_META[a.category] || CATEGORY_META.announcement;
              const Icon = meta.icon;
              return (
                <Card key={a.id} className="overflow-hidden" data-testid={`card-announcement-${a.id}`}>
                  {a.imageUrl && <img src={a.imageUrl} alt={a.title} className="w-full h-44 object-cover" />}
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
          </div>
        )}

        {/* ===== Meetings ===== */}
        {tab === "meetings" && settings.showMeetings && (
          <div className="space-y-3">
            {meetings.length === 0 && <Empty text="لا توجد اجتماعات مجدولة" />}
            {meetings.map((m) => (
              <Card key={m.id} data-testid={`card-meeting-${m.id}`}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">{MEETING_TYPE_LABELS[m.meetingType] || m.meetingType}</Badge>
                    <Badge variant="outline">{statusLabel(m.status)}</Badge>
                  </div>
                  <div>
                    <h3 className="font-bold">{m.title}</h3>
                    {m.meetingNumber && <div className="text-[11px] text-muted-foreground">رقم الاجتماع: {m.meetingNumber}</div>}
                  </div>
                  {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {fmtDate(m.meetingDate)}</span>
                    {m.startTime && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {m.startTime}{m.endTime ? ` - ${m.endTime}` : ""}</span>}
                    {m.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {m.location}</span>}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {m.virtualMeetingLink && m.status === "scheduled" && (
                      <a href={m.virtualMeetingLink} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline" data-testid={`button-join-${m.id}`}>رابط الحضور عن بُعد</Button>
                      </a>
                    )}
                    <Button size="sm" variant="outline" onClick={() => printMeeting(m, company, shareholder)} data-testid={`button-print-meeting-${m.id}`}>
                      <Printer className="w-3.5 h-3.5 ml-1" /> طباعة الاجتماع
                    </Button>
                    {m.minutes ? (
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => printMinutes(m, company, shareholder)} data-testid={`button-print-minutes-${m.id}`}>
                        <ScrollText className="w-3.5 h-3.5 ml-1" /> طباعة المحضر
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground self-center">المحضر غير متاح بعد</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ===== Dividends ===== */}
        {tab === "dividends" && settings.showDividends && (
          <div className="space-y-3">
            {dividends.length > 0 && (
              <Button
                variant="outline"
                className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={() => printStatement(shareholder, company, dividends, settings.showFinancials, settings.showDividends)}
                data-testid="button-print-statement-dividends"
              >
                <Printer className="w-4 h-4 ml-2" /> طباعة كشف الحساب (PDF)
              </Button>
            )}
            {dividends.length === 0 && <Empty text="لا توجد توزيعات أرباح" />}
            {dividends.map((d) => (
              <Card key={d.id} data-testid={`card-dividend-${d.id}`}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="font-bold">توزيع {d.fiscalYear}</h3>
                    <Badge variant="outline">{statusLabel(d.status)}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <MiniStat label="ربح السهم" value={`${fmtMoney(d.amountPerShare)} ﷼`} />
                    <MiniStat label="أسهمي" value={fmtNum(d.myShares)} />
                    <MiniStat label="نصيبي" value={`${fmtMoney(d.myAmount)} ﷼`} highlight />
                    <MiniStat label="تاريخ الصرف" value={fmtDate(d.paymentDate)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ===== Voting ===== */}
        {tab === "voting" && settings.showVoting && (
          <div className="space-y-3">
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
                    <div className="grid grid-cols-3 gap-2">
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
          </div>
        )}

        {/* ===== Documents ===== */}
        {tab === "documents" && settings.showDocuments && (
          <div className="space-y-3">
            {documents.length === 0 && <Empty text="لا توجد وثائق" />}
            {documents.map((doc) => (
              <Card key={doc.id} data-testid={`card-document-${doc.id}`}>
                <CardContent className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><FileText className="w-5 h-5" /></div>
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
          </div>
        )}

        {/* ===== Notifications ===== */}
        {tab === "notifications" && (
          <div className="space-y-2">
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
          </div>
        )}

        {/* ===== Messages / Tickets ===== */}
        {tab === "messages" && settings.showMessages && (
          <ShareholderMessages />
        )}

        {/* ===== Profile update requests ===== */}
        {tab === "profile-edits" && settings.showProfileEdits && (
          <ShareholderProfileEdits shareholder={shareholder} />
        )}
      </main>

      {/* Bottom navigation (mobile-first) */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t shadow-[0_-2px_10px_rgba(0,0,0,0.04)]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-5xl mx-auto grid" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            const badge = item.key === "voting" ? openVotes : 0;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${active ? "text-amber-600" : "text-muted-foreground"}`}
                data-testid={`nav-${item.key}`}
              >
                <div className={`relative flex items-center justify-center w-9 h-7 rounded-full transition-colors ${active ? "bg-amber-100" : ""}`}>
                  <Icon className="w-[18px] h-[18px]" />
                  {badge > 0 && (
                    <span className="absolute -top-1 -left-1 min-w-[16px] h-4 px-1 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">{badge}</span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/* ===================== Print helpers ===================== */

function esc(s: any): string {
  return String(s ?? "—")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/\n/g, "<br/>");
}

function printDoc(title: string, bodyHtml: string, company: any, shareholder: any) {
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) {
    alert("يرجى السماح بالنوافذ المنبثقة لطباعة المستند");
    return;
  }
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
  <title>${esc(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    *{box-sizing:border-box}
    body{font-family:'Cairo',Tahoma,sans-serif;color:#1f2937;margin:0;padding:32px;line-height:1.7}
    .head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #d97706;padding-bottom:14px;margin-bottom:22px}
    .head h1{font-size:18px;margin:0;color:#92400e}
    .head .co{font-size:13px;color:#6b7280}
    .doc-title{font-size:22px;font-weight:700;margin:0 0 4px}
    .muted{color:#6b7280;font-size:12px}
    table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13px}
    th,td{border:1px solid #e5e7eb;padding:8px 10px;text-align:right}
    th{background:#fef3c7;color:#92400e;font-weight:600}
    .kv{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin:14px 0;font-size:13px}
    .kv div{padding:6px 0;border-bottom:1px dashed #e5e7eb}
    .kv .k{color:#6b7280}
    h2.sec{font-size:15px;color:#92400e;margin:22px 0 8px;border-right:4px solid #d97706;padding-right:8px}
    .content{white-space:pre-wrap;font-size:13px}
    .footer{margin-top:34px;border-top:1px solid #e5e7eb;padding-top:12px;font-size:11px;color:#9ca3af;display:flex;justify-content:space-between}
    @media print{body{padding:0}.noprint{display:none}}
  </style></head>
  <body>
    <div class="head">
      <div>
        <h1>${esc(company?.nameAr || "")}</h1>
        <div class="co">${company?.commercialRegister ? "سجل تجاري: " + esc(company.commercialRegister) : ""}</div>
      </div>
    </div>
    ${bodyHtml}
    <div class="footer">
      <span>المساهم: ${esc(shareholder?.fullName || "")}</span>
      <span>تاريخ الطباعة: ${esc(new Date().toLocaleDateString("ar-SA"))}</span>
    </div>
    <script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>
  </body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function printMeeting(m: any, company: any, shareholder: any) {
  const body = `
    <p class="doc-title">${esc(m.title)}</p>
    <div class="muted">${esc(MEETING_TYPE_LABELS[m.meetingType] || m.meetingType)} • ${m.meetingNumber ? "رقم " + esc(m.meetingNumber) : ""}</div>
    <div class="kv">
      <div><span class="k">التاريخ:</span> ${esc(fmtDate(m.meetingDate))}</div>
      <div><span class="k">الحالة:</span> ${esc(statusLabel(m.status))}</div>
      <div><span class="k">الوقت:</span> ${esc(m.startTime || "—")}${m.endTime ? " - " + esc(m.endTime) : ""}</div>
      <div><span class="k">المكان:</span> ${esc(m.location || "—")}</div>
    </div>
    ${m.description ? `<h2 class="sec">الوصف</h2><div class="content">${esc(m.description)}</div>` : ""}
    ${m.agenda ? `<h2 class="sec">جدول الأعمال</h2><div class="content">${esc(m.agenda)}</div>` : ""}
  `;
  printDoc(`اجتماع - ${m.title}`, body, company, shareholder);
}

function printStatement(shareholder: any, company: any, dividends: any[], showFinancials: boolean, showDividends: boolean) {
  const divRows = showDividends && Array.isArray(dividends) ? dividends : [];
  const totalReceived = divRows.reduce((s, d) => s + (parseFloat(d?.myAmount) || 0), 0);

  const ownership = `
    <h2 class="sec">بيانات الملكية</h2>
    <div class="kv">
      <div><span class="k">الاسم:</span> ${esc(shareholder?.fullName)}</div>
      <div><span class="k">نوع المساهم:</span> ${esc(shareholderTypeLabel(shareholder?.shareholderType))}</div>
      <div><span class="k">الهوية / السجل:</span> ${esc(shareholder?.nationalId || shareholder?.commercialRegister)}</div>
      <div><span class="k">الجنسية:</span> ${esc(shareholder?.nationality)}</div>
      <div><span class="k">عدد الأسهم:</span> ${esc(fmtNum(shareholder?.numberOfShares))}</div>
      <div><span class="k">نسبة الملكية:</span> ${esc(fmtNum(shareholder?.sharePercentage))}%</div>
      <div><span class="k">فئة الأسهم:</span> ${esc(shareClassLabel(shareholder?.shareClass))}</div>
      <div><span class="k">رقم الشهادة:</span> ${esc(shareholder?.certificateNumber)}</div>
      <div><span class="k">تاريخ التملك:</span> ${esc(fmtDate(shareholder?.acquisitionDate))}</div>
      <div><span class="k">الحالة:</span> ${esc(statusLabel(shareholder?.status))}</div>
      <div><span class="k">الجوال:</span> ${esc(shareholder?.phone)}</div>
      <div><span class="k">البريد:</span> ${esc(shareholder?.email)}</div>
    </div>`;

  const bank = showFinancials ? `
    <h2 class="sec">البيانات البنكية</h2>
    <div class="kv">
      <div><span class="k">البنك:</span> ${esc(shareholder?.bankName)}</div>
      <div><span class="k">رقم الحساب:</span> ${esc(shareholder?.bankAccountNumber)}</div>
      <div><span class="k">الآيبان:</span> ${esc(shareholder?.iban)}</div>
    </div>` : "";

  const divTable = divRows.length
    ? `
    <h2 class="sec">توزيعات الأرباح</h2>
    <table>
      <thead><tr>
        <th>البيان</th><th>تاريخ الصرف</th><th>ربح السهم (﷼)</th>
        <th>عدد أسهمي</th><th>نصيبي (﷼)</th><th>الحالة</th>
      </tr></thead>
      <tbody>
        ${divRows.map((d) => `<tr>
          <td>توزيع ${esc(d?.fiscalYear)}</td>
          <td>${esc(fmtDate(d?.paymentDate))}</td>
          <td>${esc(fmtMoney(d?.amountPerShare))}</td>
          <td>${esc(fmtNum(d?.myShares))}</td>
          <td>${esc(fmtMoney(d?.myAmount))}</td>
          <td>${esc(statusLabel(d?.status))}</td>
        </tr>`).join("")}
      </tbody>
      <tfoot><tr>
        <th colspan="4">إجمالي ما تم استحقاقه</th>
        <th>${esc(fmtMoney(totalReceived))}</th><th></th>
      </tr></tfoot>
    </table>`
    : `<h2 class="sec">توزيعات الأرباح</h2><div class="muted">لا توجد توزيعات أرباح مسجّلة.</div>`;

  const body = `
    <p class="doc-title">كشف حساب مساهم</p>
    <div class="muted">${esc(company?.nameAr || "")}</div>
    ${ownership}
    ${bank}
    ${divTable}
  `;
  printDoc("كشف حساب مساهم", body, company, shareholder);
}

function printMinutes(m: any, company: any, shareholder: any) {
  const mn = m.minutes || {};
  const attendance = Array.isArray(mn.attendanceList) ? mn.attendanceList : [];
  const discussion = Array.isArray(mn.discussionPoints) ? mn.discussionPoints : [];
  const decisions = Array.isArray(mn.decisions) ? mn.decisions : [];
  const voting = Array.isArray(mn.votingResults) ? mn.votingResults : [];

  const attHtml = attendance.length
    ? `<h2 class="sec">الحضور</h2><table><thead><tr><th>الاسم</th><th>الصفة</th><th>الحالة</th></tr></thead><tbody>${attendance.map((a: any) => `<tr><td>${esc(a.name)}</td><td>${esc(a.role)}</td><td>${esc(a.status)}</td></tr>`).join("")}</tbody></table>`
    : "";
  const discHtml = discussion.length
    ? `<h2 class="sec">بنود النقاش</h2><table><thead><tr><th>الموضوع</th><th>النقاش</th><th>الخلاصة</th></tr></thead><tbody>${discussion.map((d: any) => `<tr><td>${esc(d.topic)}</td><td>${esc(d.discussion)}</td><td>${esc(d.conclusion)}</td></tr>`).join("")}</tbody></table>`
    : "";
  const decHtml = decisions.length
    ? `<h2 class="sec">القرارات</h2><table><thead><tr><th>#</th><th>القرار</th><th>المسؤول</th><th>الموعد</th></tr></thead><tbody>${decisions.map((d: any) => `<tr><td>${esc(d.number)}</td><td>${esc(d.description)}</td><td>${esc(d.responsible)}</td><td>${esc(d.deadline)}</td></tr>`).join("")}</tbody></table>`
    : "";
  const voteHtml = voting.length
    ? `<h2 class="sec">نتائج التصويت</h2><table><thead><tr><th>البند</th><th>موافق</th><th>معارض</th><th>ممتنع</th><th>النتيجة</th></tr></thead><tbody>${voting.map((v: any) => `<tr><td>${esc(v.item)}</td><td>${esc(v.forVotes)}</td><td>${esc(v.againstVotes)}</td><td>${esc(v.abstain)}</td><td>${esc(v.result)}</td></tr>`).join("")}</tbody></table>`
    : "";

  const body = `
    <p class="doc-title">محضر اجتماع</p>
    <div class="muted">${esc(m.title)} • ${mn.minutesNumber ? "محضر رقم " + esc(mn.minutesNumber) : ""}</div>
    <div class="kv">
      <div><span class="k">نوع الاجتماع:</span> ${esc(MEETING_TYPE_LABELS[m.meetingType] || m.meetingType)}</div>
      <div><span class="k">التاريخ:</span> ${esc(fmtDate(m.meetingDate))}</div>
    </div>
    ${mn.summary ? `<h2 class="sec">الملخص</h2><div class="content">${esc(mn.summary)}</div>` : ""}
    ${mn.content ? `<h2 class="sec">المحضر</h2><div class="content">${esc(mn.content)}</div>` : ""}
    ${attHtml}
    ${discHtml}
    ${decHtml}
    ${voteHtml}
  `;
  printDoc(`محضر - ${m.title}`, body, company, shareholder);
}

/* ===================== UI sub-components ===================== */

function StatCard({ icon: Icon, label, value, accent, testid, onClick }: any) {
  const accents: Record<string, string> = {
    amber: "text-amber-600 bg-amber-100",
    green: "text-green-600 bg-green-100",
    purple: "text-purple-600 bg-purple-100",
    blue: "text-blue-600 bg-blue-100",
  };
  return (
    <Card className={onClick ? "cursor-pointer active:scale-[0.98] transition-transform" : ""} onClick={onClick}>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accents[accent]}`}><Icon className="w-5 h-5" /></div>
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground truncate">{label}</div>
          <div className="font-bold text-lg leading-tight" data-testid={testid}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLink({ icon: Icon, label, count, onClick, testid }: any) {
  return (
    <button onClick={onClick} className="flex items-center justify-between gap-2 rounded-xl border bg-white p-3 text-right active:scale-[0.98] transition-transform" data-testid={testid}>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></div>
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{label}</div>
          <div className="text-[11px] text-muted-foreground">{fmtNum(count)} عنصر</div>
        </div>
      </div>
      <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}

function InfoRow({ icon: Icon, label, value, testid }: any) {
  return (
    <div className="flex items-center gap-2 border-b border-dashed py-2">
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
    active: "نشط", frozen: "مجمّد", transferred: "منقول", paid: "مدفوع",
  }[s] || s || "—";
}

function shareClassLabel(c: string): string {
  return { common: "عادية", preferred: "ممتازة", founders: "تأسيسية" }[c] || c || "عادية";
}
function voteLabel(v: string): string {
  return { for: "موافق", against: "غير موافق", abstain: "امتناع" }[v] || v;
}

/* ===================== Messages / Tickets ===================== */

const TICKET_STATUS_META: Record<string, { label: string; cls: string }> = {
  new: { label: "جديد", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  in_progress: { label: "قيد المعالجة", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  closed: { label: "مغلق", cls: "bg-gray-100 text-gray-600 border-gray-200" },
};

function ShareholderMessages() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");

  const { data: tickets = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/shareholder/tickets"] });
  const { data: detail } = useQuery<any>({
    queryKey: ["/api/shareholder/tickets", openId],
    enabled: openId != null,
    queryFn: () => fetch(`/api/shareholder/tickets/${openId}`, { credentials: "include" }).then((r) => {
      if (!r.ok) throw new Error("فشل في جلب الاستفسار");
      return r.json();
    }),
  });

  const createTicket = useMutation({
    mutationFn: () => apiRequest("POST", "/api/shareholder/tickets", { subject, body }),
    onSuccess: () => {
      toast({ title: "تم إرسال استفسارك" });
      setComposing(false);
      setSubject("");
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["/api/shareholder/tickets"] });
    },
    onError: (e: any) => toast({ title: "تعذّر الإرسال", description: e?.message || "", variant: "destructive" }),
  });

  const sendReply = useMutation({
    mutationFn: () => apiRequest("POST", `/api/shareholder/tickets/${openId}/messages`, { body: reply }),
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["/api/shareholder/tickets", openId] });
      queryClient.invalidateQueries({ queryKey: ["/api/shareholder/tickets"] });
    },
    onError: (e: any) => toast({ title: "تعذّر الإرسال", description: e?.message || "", variant: "destructive" }),
  });

  // عرض المحادثة
  if (openId != null) {
    const ticket = detail?.ticket;
    const messages: any[] = detail?.messages || [];
    const meta = TICKET_STATUS_META[ticket?.status] || TICKET_STATUS_META.new;
    return (
      <div className="space-y-3">
        <button onClick={() => setOpenId(null)} className="flex items-center gap-1 text-sm text-amber-700" data-testid="button-back-tickets">
          <ChevronLeft className="w-4 h-4 rotate-180" /> رجوع للرسائل
        </button>
        <Card>
          <CardContent className="py-3 flex items-center justify-between gap-2">
            <div className="font-semibold text-sm truncate" data-testid="text-ticket-subject">{ticket?.subject || "—"}</div>
            <Badge variant="outline" className={meta.cls} data-testid="badge-ticket-status">{meta.label}</Badge>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {messages.map((m) => {
            const mine = m.senderType === "shareholder";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`} data-testid={`message-${m.id}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-amber-100 text-amber-900" : "bg-white border"}`}>
                  <div className="text-[11px] text-muted-foreground mb-0.5">{mine ? "أنت" : (m.senderName || "الإدارة")}</div>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                  <div className="text-[10px] text-muted-foreground mt-1">{fmtDate(m.createdAt)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {ticket?.status === "closed" ? (
          <div className="text-center text-[12px] text-muted-foreground py-2">تم إغلاق هذا الاستفسار — يمكنك الرد لإعادة فتحه.</div>
        ) : null}
        <div className="flex items-end gap-2 sticky bottom-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="اكتب ردك..."
            rows={2}
            className="flex-1 resize-none bg-white"
            data-testid="input-ticket-reply"
          />
          <Button
            onClick={() => sendReply.mutate()}
            disabled={!reply.trim() || sendReply.isPending}
            className="bg-amber-600 hover:bg-amber-700 shrink-0"
            data-testid="button-send-reply"
          >
            {sendReply.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    );
  }

  // نموذج استفسار جديد
  if (composing) {
    return (
      <div className="space-y-3">
        <button onClick={() => setComposing(false)} className="flex items-center gap-1 text-sm text-amber-700" data-testid="button-cancel-compose">
          <ChevronLeft className="w-4 h-4 rotate-180" /> رجوع
        </button>
        <Card>
          <CardHeader><CardTitle className="text-base">استفسار جديد</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">الموضوع</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="موضوع الاستفسار" maxLength={200} data-testid="input-ticket-subject" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">الرسالة</label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="اكتب استفسارك بالتفصيل..." rows={5} maxLength={4000} className="resize-none" data-testid="input-ticket-body" />
            </div>
            <Button
              onClick={() => createTicket.mutate()}
              disabled={!subject.trim() || !body.trim() || createTicket.isPending}
              className="w-full bg-amber-600 hover:bg-amber-700"
              data-testid="button-submit-ticket"
            >
              {createTicket.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Send className="w-4 h-4 ml-2" />}
              إرسال الاستفسار
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // قائمة التذاكر
  return (
    <div className="space-y-3">
      <Button onClick={() => setComposing(true)} className="w-full bg-amber-600 hover:bg-amber-700" data-testid="button-new-ticket">
        <Plus className="w-4 h-4 ml-2" /> استفسار جديد
      </Button>
      {isLoading && <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-600 mx-auto" /></div>}
      {!isLoading && tickets.length === 0 && <Empty text="لا توجد رسائل بعد — ابدأ باستفسار جديد" />}
      {tickets.map((t) => {
        const meta = TICKET_STATUS_META[t.status] || TICKET_STATUS_META.new;
        return (
          <Card
            key={t.id}
            className={`cursor-pointer active:scale-[0.99] transition-transform ${t.unreadByShareholder ? "border-amber-300 bg-amber-50/40" : ""}`}
            onClick={() => setOpenId(t.id)}
            data-testid={`card-ticket-${t.id}`}
          >
            <CardContent className="py-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                {t.unreadByShareholder && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{t.subject}</div>
                  <div className="text-[11px] text-muted-foreground">{fmtDate(t.lastMessageAt)}</div>
                </div>
              </div>
              <Badge variant="outline" className={`${meta.cls} shrink-0`}>{meta.label}</Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ===================== Profile update requests (shareholder) ===================== */

const REQ_STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "قيد المراجعة", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "تمت الموافقة", cls: "bg-green-50 text-green-700 border-green-200" },
  rejected: { label: "مرفوض", cls: "bg-red-50 text-red-700 border-red-200" },
};

function ShareholderProfileEdits({ shareholder }: { shareholder: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/shareholder/profile-requests"] });
  const editableFields: { field: string; label: string }[] = data?.editableFields || [];
  const requests: any[] = data?.requests || [];
  const hasPending = requests.some((r) => r.status === "pending");

  const startEdit = () => {
    const init: Record<string, string> = {};
    for (const f of editableFields) init[f.field] = shareholder?.[f.field] ?? "";
    setValues(init);
    setNote("");
    setEditing(true);
  };

  const submit = useMutation({
    mutationFn: () => apiRequest("POST", "/api/shareholder/profile-requests", { values, note: note || undefined }),
    onSuccess: () => {
      toast({ title: "تم إرسال طلب التحديث", description: "سيتم إشعارك عند مراجعته من الإدارة" });
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/shareholder/profile-requests"] });
    },
    onError: (e: any) => toast({ title: "تعذّر الإرسال", description: e?.message || "", variant: "destructive" }),
  });

  if (isLoading) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-600" /></div>;

  // نموذج التعديل
  if (editing) {
    return (
      <div className="space-y-3 max-w-2xl">
        <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-sm text-amber-700" data-testid="button-cancel-profile-edit">
          <ChevronLeft className="w-4 h-4 rotate-180" /> رجوع
        </button>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">طلب تحديث البيانات</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {editableFields.map((f) => (
              <div key={f.field} className="space-y-1">
                <label className="text-xs text-muted-foreground">{f.label}</label>
                <Input
                  value={values[f.field] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.field]: e.target.value }))}
                  data-testid={`input-profile-${f.field}`}
                />
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">ملاحظة (اختياري)</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="سبب التعديل..." data-testid="input-profile-note" />
            </div>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending} className="w-full bg-amber-600 hover:bg-amber-700" data-testid="button-submit-profile-request">
              {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Save className="w-4 h-4 ml-1" />}
              إرسال الطلب
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // العرض الرئيسي: البيانات الحالية + الطلبات السابقة
  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm">بياناتي الحالية</CardTitle>
          {!hasPending && (
            <Button size="sm" onClick={startEdit} className="bg-amber-600 hover:bg-amber-700 h-8" data-testid="button-request-profile-edit">
              <UserCog className="w-4 h-4 ml-1" /> طلب تعديل
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {hasPending && (
            <div className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-3 py-2" data-testid="text-pending-notice">
              لديك طلب قيد المراجعة. لا يمكن إرسال طلب جديد حتى يتم البت فيه.
            </div>
          )}
          {editableFields.map((f) => (
            <div key={f.field} className="flex items-center justify-between text-sm border-b last:border-0 py-1.5">
              <span className="text-muted-foreground">{f.label}</span>
              <span className="font-medium" data-testid={`text-current-${f.field}`}>{shareholder?.[f.field] || "—"}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold px-1">طلباتي السابقة</h3>
        {requests.length === 0 && <div className="text-center text-muted-foreground py-6 text-sm">لا توجد طلبات سابقة</div>}
        {requests.map((r) => {
          const meta = REQ_STATUS_META[r.status] || REQ_STATUS_META.pending;
          const changes: any[] = Array.isArray(r.changes) ? r.changes : [];
          return (
            <Card key={r.id} data-testid={`card-profile-request-${r.id}`}>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>
                  <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
                </div>
                <div className="space-y-1">
                  {changes.map((c, i) => (
                    <div key={i} className="text-xs flex flex-wrap items-center gap-1">
                      <span className="text-muted-foreground">{c.label}:</span>
                      <span className="line-through text-red-400">{c.oldValue || "—"}</span>
                      <ChevronLeft className="w-3 h-3 text-muted-foreground" />
                      <span className="text-green-600 font-medium">{c.newValue || "—"}</span>
                    </div>
                  ))}
                </div>
                {r.reviewNote && <div className="text-xs text-muted-foreground border-t pt-1">ملاحظة الإدارة: {r.reviewNote}</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
