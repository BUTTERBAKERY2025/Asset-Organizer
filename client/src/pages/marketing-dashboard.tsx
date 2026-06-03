import { Layout } from "../components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  Megaphone, Users, Target, Calendar, FileBarChart, Clock, DollarSign,
  ChevronLeft, CheckCircle2, AlertCircle, BarChart3, Award, FolderOpen, Bell,
  ArrowUpRight, ArrowDownRight, Percent, Star, UserCheck, Activity, Share2, FileText, Handshake, Gift
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

interface MarketingCampaign {
  id: number;
  name: string;
  status: string;
  totalBudget?: number;
  spentBudget?: number;
  startDate?: string;
  endDate?: string;
}

interface Influencer {
  id: number;
  name: string;
  isActive: boolean;
  followerCount?: number;
  platform?: string;
  specialty?: string;
  region?: string;
  rating?: number;
}

interface MarketingTask {
  id: number;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string;
}

interface TeamMember {
  id: number;
  name?: string;
  isActive: boolean;
  role?: string;
}

interface CalendarEvent {
  id: number;
  title: string;
  startDate: string;
  eventType?: string;
}

interface CampaignExpense {
  id: number;
  amount: number;
  category: string;
  expenseDate: string;
}

const COLORS = ['#8b5cf6', '#a855f7', '#d946ef', '#6366f1', '#ec4899', '#06b6d4', '#10b981'];

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'انستقرام',
  tiktok: 'تيك توك',
  snapchat: 'سناب شات',
  twitter: 'تويتر',
  youtube: 'يوتيوب',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  planned: 'مخططة',
  active: 'نشطة',
  paused: 'متوقفة',
  completed: 'مكتملة',
  cancelled: 'ملغية',
};

export default function MarketingDashboardPage() {
  const { isAdmin } = useAuth();
  // Fetch all campaigns
  const { data: allCampaigns = [], isLoading: campaignsLoading } = useQuery<MarketingCampaign[]>({
    queryKey: ["/api/marketing/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/campaigns");
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
  });

  // Fetch all influencers
  const { data: allInfluencers = [], isLoading: influencersLoading } = useQuery<Influencer[]>({
    queryKey: ["/api/marketing/influencers"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/influencers");
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
  });

  // Fetch all tasks
  const { data: allTasks = [], isLoading: tasksLoading } = useQuery<MarketingTask[]>({
    queryKey: ["/api/marketing/tasks"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/tasks");
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
  });

  // Fetch team members
  const { data: teamMembers = [], isLoading: teamLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/marketing/team"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/team");
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
  });

  // Fetch calendar events
  const { data: calendarEvents = [], isLoading: calendarLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/marketing/calendar-events"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/calendar-events");
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
  });

  // Fetch expenses
  const { data: allExpenses = [] } = useQuery<CampaignExpense[]>({
    queryKey: ["/api/marketing/expenses"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/expenses");
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
  });

  const isLoading = campaignsLoading || influencersLoading || tasksLoading || teamLoading || calendarLoading;

  // Calculate statistics
  const activeCampaigns = allCampaigns.filter(c => c.status === "active");
  const completedCampaigns = allCampaigns.filter(c => c.status === "completed");
  const pendingTasks = allTasks.filter(t => t.status === "pending" || t.status === "in_progress");
  const completedTasks = allTasks.filter(t => t.status === "completed");
  const activeInfluencers = allInfluencers.filter(i => i.isActive);

  const totalBudget = allCampaigns.reduce((sum, c) => sum + (c.totalBudget || 0), 0);
  const spentBudget = allCampaigns.reduce((sum, c) => sum + (c.spentBudget || 0), 0);
  const totalExpenses = allExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalFollowers = allInfluencers.reduce((sum, i) => sum + (i.followerCount || 0), 0);

  // Advanced KPIs
  const budgetUtilization = totalBudget > 0 ? (spentBudget / totalBudget) * 100 : 0;
  const campaignCompletionRate = allCampaigns.length > 0 ? (completedCampaigns.length / allCampaigns.length) * 100 : 0;
  const taskCompletionRate = allTasks.length > 0 ? (completedTasks.length / allTasks.length) * 100 : 0;
  const costPerInfluencer = activeInfluencers.length > 0 ? totalExpenses / activeInfluencers.length : 0;

  // Influencer tier classification
  const getInfluencerTier = (followers: number) => {
    if (followers >= 1000000) return { tier: 'mega', label: 'Mega', color: 'bg-purple-500' };
    if (followers >= 100000) return { tier: 'macro', label: 'Macro', color: 'bg-blue-500' };
    if (followers >= 10000) return { tier: 'micro', label: 'Micro', color: 'bg-green-500' };
    return { tier: 'nano', label: 'Nano', color: 'bg-gray-500' };
  };

  const influencersByTier = {
    mega: allInfluencers.filter(i => (i.followerCount || 0) >= 1000000).length,
    macro: allInfluencers.filter(i => (i.followerCount || 0) >= 100000 && (i.followerCount || 0) < 1000000).length,
    micro: allInfluencers.filter(i => (i.followerCount || 0) >= 10000 && (i.followerCount || 0) < 100000).length,
    nano: allInfluencers.filter(i => (i.followerCount || 0) < 10000).length,
  };

  // Platform distribution
  const platformData = allInfluencers.reduce((acc, i) => {
    const platform = i.platform || 'other';
    acc[platform] = (acc[platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const platformChartData = Object.entries(platformData).map(([name, value]) => ({
    name: PLATFORM_LABELS[name] || name,
    value,
  }));

  // Campaign status distribution
  const campaignStatusData = allCampaigns.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const campaignStatusChartData = Object.entries(campaignStatusData).map(([name, value]) => ({
    name: STATUS_LABELS[name] || name,
    value,
  }));

  // Top influencers by followers
  const topInfluencers = [...allInfluencers]
    .sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0))
    .slice(0, 5);

  // Upcoming events (next 7 days)
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingEvents = calendarEvents
    .filter(e => {
      const eventDate = new Date(e.startDate);
      return eventDate >= today && eventDate <= nextWeek;
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5);

  // Urgent tasks
  const urgentTasks = allTasks
    .filter(t => t.priority === 'urgent' || t.priority === 'high')
    .filter(t => t.status !== 'completed')
    .slice(0, 5);

  // Format currency with English numerals
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { 
      style: "currency", 
      currency: "SAR", 
      maximumFractionDigits: 0 
    }).format(amount).replace("SAR", "").trim() + " ر.س";
  };

  // Format number with English numerals
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  const formatCompactNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const kpiCards = [
    {
      title: "معدل استخدام الميزانية",
      value: `${budgetUtilization.toFixed(1)}%`,
      trend: budgetUtilization > 80 ? 'warning' : budgetUtilization > 50 ? 'normal' : 'good',
      icon: Percent,
      description: `${formatCurrency(spentBudget)} من ${formatCurrency(totalBudget)}`,
    },
    {
      title: "معدل إنجاز الحملات",
      value: `${campaignCompletionRate.toFixed(0)}%`,
      trend: campaignCompletionRate > 50 ? 'good' : 'normal',
      icon: CheckCircle2,
      description: `${completedCampaigns.length} من ${allCampaigns.length} حملة`,
    },
    {
      title: "معدل إنجاز المهام",
      value: `${taskCompletionRate.toFixed(0)}%`,
      trend: taskCompletionRate > 70 ? 'good' : taskCompletionRate > 40 ? 'normal' : 'warning',
      icon: Target,
      description: `${completedTasks.length} من ${allTasks.length} مهمة`,
    },
    {
      title: "متوسط تكلفة المؤثر",
      value: formatCurrency(costPerInfluencer),
      trend: 'normal',
      icon: UserCheck,
      description: `إجمالي المصروفات: ${formatCurrency(totalExpenses)}`,
    },
  ];

  const quickAccessCards = [
    { title: "الحملات", href: "/marketing-campaigns", icon: Megaphone, tint: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100", iconColor: "text-violet-600", count: allCampaigns.length },
    { title: "المؤثرين", href: "/marketing-influencers", icon: Users, tint: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-100", iconColor: "text-fuchsia-600", count: allInfluencers.length },
    { title: "عقود المؤثرين", href: "/influencer-contracts", icon: FileText, tint: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100", iconColor: "text-indigo-600", count: null },
    { title: "المهام", href: "/marketing-tasks", icon: Target, tint: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100", iconColor: "text-amber-600", count: allTasks.length },
    { title: "التقويم", href: "/marketing-calendar", icon: Calendar, tint: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100", iconColor: "text-purple-600", count: calendarEvents.length },
    { title: "الفريق", href: "/marketing-team", icon: UserCheck, tint: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100", iconColor: "text-sky-600", count: teamMembers.length },
    { title: "المصروفات", href: "/marketing-expenses", icon: DollarSign, tint: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100", iconColor: "text-emerald-600", count: allExpenses.length },
    { title: "التقارير", href: "/marketing-reports", icon: FileBarChart, tint: "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100", iconColor: "text-teal-600", count: null },
    { title: "الأهداف", href: "/marketing-goals", icon: Award, tint: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100", iconColor: "text-rose-600", count: null },
    { title: "الأصول", href: "/marketing-assets", icon: FolderOpen, tint: "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100", iconColor: "text-cyan-600", count: null },
    { title: "التنبيهات", href: "/marketing-alerts", icon: Bell, tint: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100", iconColor: "text-red-600", count: null },
    { title: "السوشيال ميديا", href: "/marketing-social", icon: Share2, tint: "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100", iconColor: "text-pink-600", count: null },
    { title: "المسؤولية الاجتماعية", href: "/social-responsibility", icon: Handshake, tint: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100", iconColor: "text-orange-600", count: null },
    ...(isAdmin ? [{ title: "حملات الولاء و QR", href: "/loyalty-campaigns", icon: Gift, tint: "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100", iconColor: "text-yellow-600", count: null }] : []),
  ];

  // Trend semantics: derived from actual data signals, not hard-coded
  const campaignTrend: 'up' | 'down' | 'flat' =
    allCampaigns.length === 0 ? 'flat' : activeCampaigns.length / allCampaigns.length >= 0.3 ? 'up' : 'down';
  const influencerTrend: 'up' | 'down' | 'flat' =
    allInfluencers.length === 0 ? 'flat' : activeInfluencers.length / allInfluencers.length >= 0.6 ? 'up' : 'down';
  const budgetTrend: 'up' | 'down' | 'flat' =
    totalBudget === 0 ? 'flat' : budgetUtilization > 90 ? 'down' : budgetUtilization > 50 ? 'up' : 'flat';
  const taskTrend: 'up' | 'down' | 'flat' =
    allTasks.length === 0 ? 'flat' : taskCompletionRate >= 60 ? 'up' : pendingTasks.length > completedTasks.length ? 'down' : 'flat';

  // Exact Flow palette mapping for Primary Stats Row
  const primaryStats = [
    { label: "إجمالي الحملات", value: formatNumber(allCampaigns.length), sub: `${activeCampaigns.length} نشطة`, icon: Megaphone, color: "violet",  trend: campaignTrend },
    { label: "المؤثرين",      value: formatNumber(allInfluencers.length), sub: `${formatCompactNumber(totalFollowers)} متابع`, icon: Users, color: "fuchsia", trend: influencerTrend },
    { label: "الميزانية",      value: formatCurrency(totalBudget), sub: `${formatCurrency(spentBudget)} مصروف`, icon: DollarSign, color: "emerald", trend: budgetTrend },
    { label: "المهام",         value: formatNumber(allTasks.length), sub: `${pendingTasks.length} قيد التنفيذ`, icon: Clock, color: pendingTasks.length > 0 ? "amber" : "emerald", trend: taskTrend },
  ];

  const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
    violet:  { bg: "bg-violet-100",  text: "text-violet-700",  ring: "ring-violet-200/60" },
    fuchsia: { bg: "bg-fuchsia-100", text: "text-fuchsia-700", ring: "ring-fuchsia-200/60" },
    emerald: { bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-200/60" },
    amber:   { bg: "bg-amber-100",   text: "text-amber-700",   ring: "ring-amber-200/60" },
    indigo:  { bg: "bg-indigo-100",  text: "text-indigo-700",  ring: "ring-indigo-200/60" },
    rose:    { bg: "bg-rose-100",    text: "text-rose-700",    ring: "ring-rose-200/60" },
    sky:     { bg: "bg-sky-100",     text: "text-sky-700",     ring: "ring-sky-200/60" },
  };

  return (
    <Layout>
      <div className="page-container space-y-4" dir="rtl">
        <PageHeader
          icon={Megaphone}
          tone="marketing"
          title="لوحة تحكم التسويق"
          description="نظرة شاملة على جميع أنشطة وحملات التسويق"
        />

        {/* Quick Access - Soft pill bar (Exact Flow style) */}
        <div className="flex flex-wrap gap-2">
          {quickAccessCards.map((card, index) => (
            <Link key={index} href={card.href}>
              <div className={`group flex items-center gap-2 px-3.5 py-2 rounded-full border ${card.tint} transition-all cursor-pointer shadow-sm hover:shadow-md`} data-testid={`quick-${card.href.slice(1)}`}>
                <card.icon className={`w-4 h-4 ${card.iconColor}`} />
                <span className="text-sm font-medium">{card.title}</span>
                {card.count !== null && card.count > 0 && (
                  <span className="text-xs bg-white/70 px-2 py-0.5 rounded-full font-semibold tabular-nums">{formatNumber(card.count)}</span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Primary Stats Row - Exact Flow KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {primaryStats.map((s, i) => {
            const c = colorMap[s.color] || colorMap.violet;
            const TrendIcon = s.trend === 'up' ? ArrowUpRight : s.trend === 'down' ? ArrowDownRight : Activity;
            const trendTint = s.trend === 'up' ? 'text-emerald-600 bg-emerald-50' : s.trend === 'down' ? 'text-rose-600 bg-rose-50' : 'text-slate-500 bg-slate-50';
            return (
              <Card key={i} className={`relative overflow-hidden border ring-1 ${c.ring} hover:shadow-sm transition-shadow`} data-testid={`stat-${i}`}>
                <CardContent className="p-3">
                  {isLoading ? <Skeleton className="h-14" /> : (
                    <>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className={`p-1.5 rounded-lg ${c.bg}`}>
                          <s.icon className={`w-3.5 h-3.5 ${c.text}`} />
                        </div>
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${trendTint}`}>
                          <TrendIcon className="w-2.5 h-2.5" />
                          {s.trend === 'up' ? 'صاعد' : s.trend === 'down' ? 'هابط' : 'ثابت'}
                        </span>
                      </div>
                      <div className={`text-lg sm:text-xl font-bold tabular-nums ${c.text} leading-tight truncate`}>{s.value}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
                      <div className="text-[10px] text-muted-foreground/80 mt-1 truncate">{s.sub}</div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Advanced KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {kpiCards.map((kpi, index) => {
            const toneClass = kpi.trend === 'good' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : kpi.trend === 'warning' ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-slate-600 bg-slate-50 border-slate-200';
            const iconBg = kpi.trend === 'good' ? 'bg-emerald-100 text-emerald-700' : kpi.trend === 'warning' ? 'bg-rose-100 text-rose-700' : 'bg-violet-100 text-violet-700';
            return (
              <Card key={index} className="relative overflow-hidden border hover:shadow-sm transition-shadow" data-testid={`kpi-${index}`}>
                <CardContent className="p-3">
                  {isLoading ? <Skeleton className="h-14" /> : (
                    <>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className={`p-1.5 rounded-lg ${iconBg}`}>
                          <kpi.icon className="w-3.5 h-3.5" />
                        </div>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${toneClass}`}>
                          {kpi.trend === 'good' ? 'جيد' : kpi.trend === 'warning' ? 'تحذير' : 'متوسط'}
                        </span>
                      </div>
                      <div className="text-lg sm:text-xl font-bold tabular-nums leading-tight truncate">{kpi.value}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{kpi.title}</div>
                      <div className="text-[10px] text-muted-foreground/80 mt-1 truncate">{kpi.description}</div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts Row: Tiers + Platforms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Influencer Tiers */}
          <Card className="border-violet-200/60 overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-l from-violet-50/80 to-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="p-1.5 bg-violet-100 rounded-lg">
                      <Star className="w-4 h-4 text-violet-700" />
                    </div>
                    تصنيف المؤثرين
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">توزيع المؤثرين حسب عدد المتابعين</CardDescription>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{formatNumber(allInfluencers.length)} مؤثر</span>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {isLoading ? <Skeleton className="h-48" /> : (() => {
                const tiers = [
                  { key: 'mega',  label: 'Mega (+1M)',      count: influencersByTier.mega,  grad: 'from-violet-500 to-fuchsia-500', dot: 'bg-violet-500' },
                  { key: 'macro', label: 'Macro (100K-1M)', count: influencersByTier.macro, grad: 'from-indigo-500 to-violet-500',  dot: 'bg-indigo-500' },
                  { key: 'micro', label: 'Micro (10K-100K)',count: influencersByTier.micro, grad: 'from-fuchsia-500 to-pink-500',   dot: 'bg-fuchsia-500' },
                  { key: 'nano',  label: 'Nano (<10K)',     count: influencersByTier.nano,  grad: 'from-slate-400 to-slate-500',    dot: 'bg-slate-400' },
                ];
                const total = allInfluencers.length || 1;
                const maxC = Math.max(...tiers.map(t => t.count), 1);
                return (
                  <div className="space-y-3">
                    {tiers.map(t => {
                      const pct = Math.round((t.count / total) * 100);
                      const barPct = (t.count / maxC) * 100;
                      return (
                        <div key={t.key} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${t.dot}`} />
                              <span className="font-medium">{t.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                              <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold tabular-nums min-w-[2rem] text-center">{formatNumber(t.count)}</span>
                            </div>
                          </div>
                          <div
                            className="h-2 bg-violet-50 rounded-full overflow-hidden"
                            role="progressbar"
                            aria-label={`${t.label}: ${t.count} من ${total}`}
                            aria-valuenow={t.count}
                            aria-valuemin={0}
                            aria-valuemax={total}
                          >
                            <div className={`h-full bg-gradient-to-l ${t.grad} rounded-full transition-all duration-500`} style={{ width: `${barPct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Platform Distribution */}
          <Card className="border-fuchsia-200/60 overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-l from-fuchsia-50/80 to-transparent">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-1.5 bg-fuchsia-100 rounded-lg">
                  <Share2 className="w-4 h-4 text-fuchsia-700" />
                </div>
                توزيع المنصات
              </CardTitle>
              <CardDescription className="text-xs mt-1">المؤثرين حسب المنصة</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {isLoading ? <Skeleton className="h-48" /> : platformChartData.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={platformChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                        {platformChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e9d5ff', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {platformChartData.map((p, i) => {
                      const total = platformChartData.reduce((s, x) => s + x.value, 0) || 1;
                      const pct = Math.round((p.value / total) * 100);
                      return (
                        <div key={p.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="truncate">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                            <span className="font-semibold tabular-nums">{p.value}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  لا توجد بيانات
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Campaign Status & Budget */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Campaign Status */}
          <Card className="border-indigo-200/60 overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-l from-indigo-50/80 to-transparent">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 rounded-lg">
                  <BarChart3 className="w-4 h-4 text-indigo-700" />
                </div>
                حالة الحملات
              </CardTitle>
              <CardDescription className="text-xs mt-1">توزيع الحملات حسب الحالة</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {isLoading ? <Skeleton className="h-48" /> : campaignStatusChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={campaignStatusChartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barViolet" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#d946ef" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e9d5ff', fontSize: '12px' }} cursor={{ fill: '#f5f3ff' }} />
                    <Bar dataKey="value" fill="url(#barViolet)" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  لا توجد حملات
                </div>
              )}
            </CardContent>
          </Card>

          {/* Budget Utilization */}
          <Card className="border-emerald-200/60 overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-l from-emerald-50/80 to-transparent">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 rounded-lg">
                  <DollarSign className="w-4 h-4 text-emerald-700" />
                </div>
                استخدام الميزانية
              </CardTitle>
              <CardDescription className="text-xs mt-1">نسبة الصرف من الميزانية المخصصة</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {isLoading ? <Skeleton className="h-48" /> : (() => {
                const tone = budgetUtilization > 90 ? 'rose' : budgetUtilization > 75 ? 'amber' : 'emerald';
                const toneText = tone === 'rose' ? 'text-rose-600' : tone === 'amber' ? 'text-amber-600' : 'text-emerald-600';
                const toneBar = tone === 'rose' ? 'from-rose-400 to-rose-600' : tone === 'amber' ? 'from-amber-400 to-amber-600' : 'from-emerald-400 to-emerald-600';
                const remaining = totalBudget - spentBudget;
                return (
                  <div className="space-y-4">
                    <div className="text-center py-2">
                      <div className={`text-4xl sm:text-5xl font-bold tabular-nums ${toneText}`}>{budgetUtilization.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground mt-1">نسبة الاستخدام من إجمالي الميزانية</div>
                    </div>
                    <div
                      className="h-3 bg-slate-100 rounded-full overflow-hidden"
                      role="progressbar"
                      aria-label={`نسبة استخدام الميزانية ${budgetUtilization.toFixed(1)}%`}
                      aria-valuenow={Math.round(budgetUtilization)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className={`h-full bg-gradient-to-l ${toneBar} rounded-full transition-all duration-700`} style={{ width: `${Math.min(budgetUtilization, 100)}%` }} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-100">
                        <div className="text-xs text-rose-600/80 mb-1">المصروف</div>
                        <div className="font-bold text-rose-700 tabular-nums text-sm truncate">{formatCurrency(spentBudget)}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                        <div className="text-xs text-emerald-600/80 mb-1">المتبقي</div>
                        <div className="font-bold text-emerald-700 tabular-nums text-sm truncate">{formatCurrency(remaining)}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Top Influencers & Upcoming Events */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Top Influencers */}
          <Card className="border-violet-200/60 overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-l from-violet-50/80 to-transparent">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="p-1.5 bg-violet-100 rounded-lg">
                    <Award className="w-4 h-4 text-violet-700" />
                  </div>
                  أفضل المؤثرين
                </CardTitle>
                <Link href="/marketing-influencers">
                  <span className="text-xs font-medium text-violet-700 hover:text-violet-900 cursor-pointer inline-flex items-center gap-1" data-testid="link-view-all-influencers">
                    عرض الكل
                    <ChevronLeft className="w-3 h-3" />
                  </span>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {isLoading ? <Skeleton className="h-48" /> : topInfluencers.length > 0 ? (
                <div className="space-y-2">
                  {topInfluencers.map((influencer, index) => {
                    const tier = getInfluencerTier(influencer.followerCount || 0);
                    const rankGrad = index === 0 ? 'from-amber-400 to-amber-600' : index === 1 ? 'from-slate-300 to-slate-500' : index === 2 ? 'from-orange-400 to-orange-600' : 'from-violet-400 to-violet-600';
                    const tierTint = tier.tier === 'mega' ? 'bg-violet-100 text-violet-700' : tier.tier === 'macro' ? 'bg-indigo-100 text-indigo-700' : tier.tier === 'micro' ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-slate-100 text-slate-600';
                    return (
                      <div key={influencer.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-violet-50/50 transition-colors border border-transparent hover:border-violet-100" data-testid={`top-influencer-${influencer.id}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${rankGrad} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm`}>
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{influencer.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {PLATFORM_LABELS[influencer.platform || ''] || influencer.platform || '—'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${tierTint}`}>
                            {tier.label}
                          </span>
                          <span className="text-sm font-semibold tabular-nums min-w-[3rem] text-left">
                            {formatCompactNumber(influencer.followerCount || 0)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  لا يوجد مؤثرين
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Events & Urgent Tasks */}
          <Card className="border-purple-200/60 overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-l from-purple-50/80 to-transparent">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="p-1.5 bg-purple-100 rounded-lg">
                    <Calendar className="w-4 h-4 text-purple-700" />
                  </div>
                  المواعيد والمهام العاجلة
                </CardTitle>
                <Link href="/marketing-calendar">
                  <span className="text-xs font-medium text-purple-700 hover:text-purple-900 cursor-pointer inline-flex items-center gap-1" data-testid="link-view-calendar">
                    عرض التقويم
                    <ChevronLeft className="w-3 h-3" />
                  </span>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {isLoading ? <Skeleton className="h-48" /> : (
                <div className="space-y-4">
                  {upcomingEvents.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-purple-700/80 uppercase tracking-wide mb-2 flex items-center gap-2">
                        <span className="w-1 h-3 bg-purple-500 rounded-full" />
                        المواعيد القادمة
                      </div>
                      <div className="space-y-1.5">
                        {upcomingEvents.map(event => (
                          <div key={event.id} className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50/60 border border-purple-100 hover:bg-purple-100/50 transition-colors" data-testid={`event-${event.id}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="p-1 rounded-md bg-purple-100">
                                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                              </div>
                              <span className="text-sm truncate">{event.title}</span>
                            </div>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white text-purple-700 border border-purple-200 tabular-nums flex-shrink-0">
                              {formatDate(event.startDate)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {urgentTasks.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-rose-700/80 uppercase tracking-wide mb-2 flex items-center gap-2">
                        <span className="w-1 h-3 bg-rose-500 rounded-full" />
                        المهام العاجلة
                      </div>
                      <div className="space-y-1.5">
                        {urgentTasks.map(task => (
                          <div key={task.id} className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/60 border border-rose-100 hover:bg-rose-100/50 transition-colors" data-testid={`urgent-task-${task.id}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="p-1 rounded-md bg-rose-100">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                              </div>
                              <span className="text-sm truncate">{task.title}</span>
                            </div>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-600 text-white flex-shrink-0">
                              {task.priority === 'urgent' ? 'عاجل' : 'مهم'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {upcomingEvents.length === 0 && urgentTasks.length === 0 && (
                    <div className="h-32 flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      <span className="text-sm">لا توجد مواعيد أو مهام عاجلة</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
