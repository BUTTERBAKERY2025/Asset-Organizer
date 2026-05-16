import { Layout } from "../components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Megaphone, Users, Target, Calendar, TrendingUp, FileBarChart, Clock, DollarSign,
  ChevronLeft, CheckCircle2, AlertCircle, BarChart3, Award, FolderOpen, Bell,
  ArrowUpRight, ArrowDownRight, Percent, Eye, Star, UserCheck, Activity, Share2, FileText, Handshake
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
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

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4'];

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
  const activeTeamMembers = teamMembers.filter(m => m.isActive);

  const totalBudget = allCampaigns.reduce((sum, c) => sum + (c.totalBudget || 0), 0);
  const spentBudget = allCampaigns.reduce((sum, c) => sum + (c.spentBudget || 0), 0);
  const totalExpenses = allExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalFollowers = allInfluencers.reduce((sum, i) => sum + (i.followerCount || 0), 0);

  // Advanced KPIs
  const budgetUtilization = totalBudget > 0 ? (spentBudget / totalBudget) * 100 : 0;
  const campaignCompletionRate = allCampaigns.length > 0 ? (completedCampaigns.length / allCampaigns.length) * 100 : 0;
  const taskCompletionRate = allTasks.length > 0 ? (completedTasks.length / allTasks.length) * 100 : 0;
  const avgFollowersPerInfluencer = allInfluencers.length > 0 ? totalFollowers / allInfluencers.length : 0;
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
    { title: "الحملات", href: "/marketing-campaigns", icon: Megaphone, bgColor: "bg-gradient-to-br from-amber-400 to-amber-600", iconBg: "bg-amber-100", iconColor: "text-amber-600", count: allCampaigns.length },
    { title: "المؤثرين", href: "/marketing-influencers", icon: Users, bgColor: "bg-gradient-to-br from-blue-400 to-blue-600", iconBg: "bg-blue-100", iconColor: "text-blue-600", count: allInfluencers.length },
    { title: "عقود المؤثرين", href: "/influencer-contracts", icon: FileText, bgColor: "bg-gradient-to-br from-teal-400 to-teal-600", iconBg: "bg-teal-100", iconColor: "text-teal-600", count: null },
    { title: "المهام", href: "/marketing-tasks", icon: Target, bgColor: "bg-gradient-to-br from-orange-400 to-orange-600", iconBg: "bg-orange-100", iconColor: "text-orange-600", count: allTasks.length },
    { title: "التقويم", href: "/marketing-calendar", icon: Calendar, bgColor: "bg-gradient-to-br from-purple-400 to-purple-600", iconBg: "bg-purple-100", iconColor: "text-purple-600", count: calendarEvents.length },
    { title: "الفريق", href: "/marketing-team", icon: UserCheck, bgColor: "bg-gradient-to-br from-indigo-400 to-indigo-600", iconBg: "bg-indigo-100", iconColor: "text-indigo-600", count: teamMembers.length },
    { title: "المصروفات", href: "/marketing-expenses", icon: DollarSign, bgColor: "bg-gradient-to-br from-emerald-400 to-emerald-600", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", count: allExpenses.length },
    { title: "التقارير", href: "/marketing-reports", icon: FileBarChart, bgColor: "bg-gradient-to-br from-green-400 to-green-600", iconBg: "bg-green-100", iconColor: "text-green-600", count: null },
    { title: "الأهداف", href: "/marketing-goals", icon: Award, bgColor: "bg-gradient-to-br from-rose-400 to-rose-600", iconBg: "bg-rose-100", iconColor: "text-rose-600", count: null },
    { title: "الأصول", href: "/marketing-assets", icon: FolderOpen, bgColor: "bg-gradient-to-br from-cyan-400 to-cyan-600", iconBg: "bg-cyan-100", iconColor: "text-cyan-600", count: null },
    { title: "التنبيهات", href: "/marketing-alerts", icon: Bell, bgColor: "bg-gradient-to-br from-red-400 to-red-600", iconBg: "bg-red-100", iconColor: "text-red-600", count: null },
    { title: "السوشيال ميديا", href: "/marketing-social", icon: Share2, bgColor: "bg-gradient-to-br from-violet-400 to-violet-600", iconBg: "bg-violet-100", iconColor: "text-violet-600", count: null },
    { title: "المسؤولية الاجتماعية", href: "/social-responsibility", icon: Handshake, bgColor: "bg-gradient-to-br from-amber-400 to-amber-600", iconBg: "bg-amber-100", iconColor: "text-amber-600", count: null },
  ];

  return (
    <Layout>
      <div className="p-4 md:p-8 lg:p-10 max-w-screen-2xl mx-auto space-y-4" dir="rtl">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground" data-testid="page-title">
            لوحة تحكم التسويق
          </h1>
          <p className="text-sm text-muted-foreground">
            نظرة شاملة على جميع أنشطة وحملات التسويق
          </p>
        </div>

        {/* Quick Access - Compact at top */}
        <div className="flex flex-wrap gap-2">
          {quickAccessCards.map((card, index) => (
            <Link key={index} href={card.href}>
              <div className={`group flex items-center gap-2 px-3 py-2 rounded-lg ${card.bgColor} hover:shadow-md transition-all cursor-pointer`}>
                <card.icon className="w-4 h-4 text-white" />
                <span className="text-sm font-medium text-white">{card.title}</span>
                {card.count !== null && card.count > 0 && (
                  <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full text-white">{card.count}</span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Primary Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-amber-50/50 border-amber-100">
            <CardContent className="p-3 sm:p-4 md:p-6">
              {isLoading ? <Skeleton className="h-16" /> : (
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <Megaphone className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-amber-700">{formatNumber(allCampaigns.length)}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">إجمالي الحملات</div>
                    <Badge variant="secondary" className="mt-1 text-[10px] sm:text-xs">{activeCampaigns.length} نشطة</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-blue-50/50 border-blue-100">
            <CardContent className="p-3 sm:p-4 md:p-6">
              {isLoading ? <Skeleton className="h-16" /> : (
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-700">{formatNumber(allInfluencers.length)}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">المؤثرين</div>
                    <Badge variant="secondary" className="mt-1 text-[10px] sm:text-xs">{formatCompactNumber(totalFollowers)} متابع</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-green-50/50 border-green-100">
            <CardContent className="p-3 sm:p-4 md:p-6">
              {isLoading ? <Skeleton className="h-16" /> : (
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                    <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-700 truncate">{formatCurrency(totalBudget)}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">الميزانية</div>
                    <Badge variant="secondary" className="mt-1 text-[10px] sm:text-xs">{formatCurrency(spentBudget)} مصروف</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={`${pendingTasks.length > 0 ? 'bg-orange-50/50 border-orange-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
            <CardContent className="p-3 sm:p-4 md:p-6">
              {isLoading ? <Skeleton className="h-16" /> : (
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg ${pendingTasks.length > 0 ? 'bg-orange-100' : 'bg-emerald-100'} flex items-center justify-center shrink-0`}>
                    <Clock className={`w-5 h-5 sm:w-6 sm:h-6 ${pendingTasks.length > 0 ? 'text-orange-600' : 'text-emerald-600'}`} />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-lg sm:text-xl md:text-2xl font-bold ${pendingTasks.length > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
                      {formatNumber(allTasks.length)}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground">المهام</div>
                    <Badge variant="secondary" className="mt-1 text-[10px] sm:text-xs">{pendingTasks.length} قيد التنفيذ</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {kpiCards.map((kpi, index) => (
            <Card key={index} className="relative overflow-hidden">
              <CardContent className="p-3 sm:p-4 md:p-6">
                {isLoading ? <Skeleton className="h-20" /> : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <kpi.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${
                        kpi.trend === 'good' ? 'text-green-500' : 
                        kpi.trend === 'warning' ? 'text-orange-500' : 'text-blue-500'
                      }`} />
                      <Badge variant={kpi.trend === 'good' ? 'default' : kpi.trend === 'warning' ? 'destructive' : 'secondary'} className="text-[10px] sm:text-xs">
                        {kpi.trend === 'good' ? 'جيد' : kpi.trend === 'warning' ? 'تحذير' : 'متوسط'}
                      </Badge>
                    </div>
                    <div className="text-lg sm:text-xl md:text-2xl font-bold">{kpi.value}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">{kpi.title}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground/80 mt-1">{kpi.description}</div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          {/* Influencer Tiers */}
          <Card>
            <CardHeader className="p-3 sm:p-4 md:p-6 pb-2">
              <CardTitle className="text-sm sm:text-base md:text-lg">تصنيف المؤثرين</CardTitle>
              <CardDescription className="text-xs sm:text-sm">توزيع المؤثرين حسب عدد المتابعين</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-48" /> : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      <span className="text-sm">Mega (+1M)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{influencersByTier.mega}</span>
                      <Progress value={(influencersByTier.mega / allInfluencers.length) * 100} className="w-24 h-2" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-sm">Macro (100K-1M)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{influencersByTier.macro}</span>
                      <Progress value={(influencersByTier.macro / allInfluencers.length) * 100} className="w-24 h-2" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm">Micro (10K-100K)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{influencersByTier.micro}</span>
                      <Progress value={(influencersByTier.micro / allInfluencers.length) * 100} className="w-24 h-2" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                      <span className="text-sm">Nano (&lt;10K)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{influencersByTier.nano}</span>
                      <Progress value={(influencersByTier.nano / allInfluencers.length) * 100} className="w-24 h-2" />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Platform Distribution */}
          <Card>
            <CardHeader className="p-3 sm:p-4 md:p-6 pb-2">
              <CardTitle className="text-sm sm:text-base md:text-lg">توزيع المنصات</CardTitle>
              <CardDescription className="text-xs sm:text-sm">المؤثرين حسب المنصة</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-48" /> : platformChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={platformChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {platformChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  لا توجد بيانات
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Campaign Status & Budget */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          {/* Campaign Status */}
          <Card>
            <CardHeader className="p-3 sm:p-4 md:p-6 pb-2">
              <CardTitle className="text-sm sm:text-base md:text-lg">حالة الحملات</CardTitle>
              <CardDescription className="text-xs sm:text-sm">توزيع الحملات حسب الحالة</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-48" /> : campaignStatusChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={campaignStatusChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  لا توجد حملات
                </div>
              )}
            </CardContent>
          </Card>

          {/* Budget Utilization */}
          <Card>
            <CardHeader className="p-3 sm:p-4 md:p-6 pb-2">
              <CardTitle className="text-sm sm:text-base md:text-lg">استخدام الميزانية</CardTitle>
              <CardDescription className="text-xs sm:text-sm">نسبة الصرف من الميزانية المخصصة</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-48" /> : (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <div className="text-4xl font-bold text-amber-600">{budgetUtilization.toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground mt-1">نسبة الاستخدام</div>
                  </div>
                  <Progress value={budgetUtilization} className="h-3" />
                  <div className="flex justify-between text-sm">
                    <div>
                      <div className="text-muted-foreground">المصروف</div>
                      <div className="font-semibold text-red-600">{formatCurrency(spentBudget)}</div>
                    </div>
                    <div className="text-left">
                      <div className="text-muted-foreground">المتبقي</div>
                      <div className="font-semibold text-green-600">{formatCurrency(totalBudget - spentBudget)}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Influencers & Upcoming Events */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          {/* Top Influencers */}
          <Card>
            <CardHeader className="p-3 sm:p-4 md:p-6 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-base md:text-lg">أفضل المؤثرين</CardTitle>
                <Link href="/marketing-influencers">
                  <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                    عرض الكل
                  </Badge>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-48" /> : topInfluencers.length > 0 ? (
                <div className="space-y-3">
                  {topInfluencers.map((influencer, index) => {
                    const tier = getInfluencerTier(influencer.followerCount || 0);
                    return (
                      <div key={influencer.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{influencer.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {PLATFORM_LABELS[influencer.platform || ''] || influencer.platform}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={tier.color + ' text-white text-xs'}>
                            {tier.label}
                          </Badge>
                          <span className="text-sm font-semibold">
                            {formatCompactNumber(influencer.followerCount || 0)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  لا يوجد مؤثرين
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Events & Urgent Tasks */}
          <Card>
            <CardHeader className="p-3 sm:p-4 md:p-6 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-base md:text-lg">المواعيد والمهام العاجلة</CardTitle>
                <Link href="/marketing-calendar">
                  <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                    عرض التقويم
                  </Badge>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-48" /> : (
                <div className="space-y-4">
                  {upcomingEvents.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-2">المواعيد القادمة</div>
                      <div className="space-y-2">
                        {upcomingEvents.map(event => (
                          <div key={event.id} className="flex items-center justify-between p-2 rounded-lg bg-purple-50">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-purple-600" />
                              <span className="text-sm">{event.title}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {formatDate(event.startDate)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {urgentTasks.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-2">المهام العاجلة</div>
                      <div className="space-y-2">
                        {urgentTasks.map(task => (
                          <div key={task.id} className="flex items-center justify-between p-2 rounded-lg bg-red-50">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-red-600" />
                              <span className="text-sm">{task.title}</span>
                            </div>
                            <Badge variant="destructive" className="text-xs">
                              {task.priority === 'urgent' ? 'عاجل' : 'مهم'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {upcomingEvents.length === 0 && urgentTasks.length === 0 && (
                    <div className="h-32 flex items-center justify-center text-muted-foreground">
                      لا توجد مواعيد أو مهام عاجلة
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
