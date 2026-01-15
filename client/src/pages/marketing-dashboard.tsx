import { Layout } from "../components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Megaphone, Users, Target, Calendar, TrendingUp, FileBarChart, Clock, DollarSign,
  ChevronLeft, CheckCircle2, AlertCircle, BarChart3, Award, FolderOpen, Bell,
  ArrowUpRight, ListTodo, UserCheck, Activity, Percent, Star
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

interface MarketingCampaign {
  id: number;
  name: string;
  nameAr?: string;
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
  platforms?: string[];
  specialty?: string;
  rating?: number;
}

interface MarketingTask {
  id: number;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string;
  assignedTo?: string;
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
}

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#ec4899'];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-700' },
  planned: { label: 'مخططة', color: 'bg-blue-100 text-blue-700' },
  active: { label: 'نشطة', color: 'bg-green-100 text-green-700' },
  paused: { label: 'متوقفة', color: 'bg-amber-100 text-amber-700' },
  completed: { label: 'مكتملة', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'ملغية', color: 'bg-red-100 text-red-700' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'منخفضة', color: 'text-gray-500' },
  medium: { label: 'متوسطة', color: 'text-blue-500' },
  high: { label: 'عالية', color: 'text-orange-500' },
  urgent: { label: 'عاجل', color: 'text-red-500' },
};

export default function MarketingDashboardPage() {
  const { data: allCampaigns = [], isLoading: campaignsLoading } = useQuery<MarketingCampaign[]>({
    queryKey: ["/api/marketing/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/campaigns");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: allInfluencers = [], isLoading: influencersLoading } = useQuery<Influencer[]>({
    queryKey: ["/api/marketing/influencers"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/influencers");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: allTasks = [], isLoading: tasksLoading } = useQuery<MarketingTask[]>({
    queryKey: ["/api/marketing/tasks"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/tasks");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/marketing/team"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/team");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: calendarEvents = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/marketing/calendar-events"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/calendar-events");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: allExpenses = [] } = useQuery<CampaignExpense[]>({
    queryKey: ["/api/marketing/expenses"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/expenses");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const isLoading = campaignsLoading || influencersLoading || tasksLoading;

  // Stats
  const activeCampaigns = allCampaigns.filter(c => c.status === "active");
  const completedCampaigns = allCampaigns.filter(c => c.status === "completed");
  const pendingTasks = allTasks.filter(t => t.status === "pending" || t.status === "in_progress");
  const completedTasks = allTasks.filter(t => t.status === "completed");
  const urgentTasks = allTasks.filter(t => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'completed');
  const activeInfluencers = allInfluencers.filter(i => i.isActive);

  const totalBudget = allCampaigns.reduce((sum, c) => sum + (c.totalBudget || 0), 0);
  const spentBudget = allCampaigns.reduce((sum, c) => sum + (c.spentBudget || 0), 0);
  const totalExpenses = allExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalFollowers = allInfluencers.reduce((sum, i) => sum + (i.followerCount || 0), 0);
  const budgetUtilization = totalBudget > 0 ? (spentBudget / totalBudget) * 100 : 0;
  const taskCompletionRate = allTasks.length > 0 ? (completedTasks.length / allTasks.length) * 100 : 0;

  // Influencer tiers
  const influencersByTier = {
    mega: allInfluencers.filter(i => (i.followerCount || 0) >= 1000000).length,
    macro: allInfluencers.filter(i => (i.followerCount || 0) >= 100000 && (i.followerCount || 0) < 1000000).length,
    micro: allInfluencers.filter(i => (i.followerCount || 0) >= 10000 && (i.followerCount || 0) < 100000).length,
    nano: allInfluencers.filter(i => (i.followerCount || 0) < 10000).length,
  };

  // Campaign status for chart
  const campaignStatusData = Object.entries(
    allCampaigns.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([status, value]) => ({
    name: STATUS_CONFIG[status]?.label || status,
    value,
  }));

  // Recent campaigns
  const recentCampaigns = [...allCampaigns]
    .sort((a, b) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime())
    .slice(0, 4);

  // Top influencers
  const topInfluencers = [...allInfluencers]
    .sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0))
    .slice(0, 4);

  // Upcoming events
  const today = new Date();
  const upcomingEvents = calendarEvents
    .filter(e => e.startDate && new Date(e.startDate) >= today)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 4);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount) + " ر.س";
  };

  const formatNumber = (num: number) => new Intl.NumberFormat("en-US").format(num);

  const formatCompactNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
  };

  // Quick links
  const quickLinks = [
    { title: "الحملات", href: "/marketing-campaigns", icon: Megaphone, color: "text-amber-600 bg-amber-50" },
    { title: "المؤثرين", href: "/marketing-influencers", icon: Users, color: "text-blue-600 bg-blue-50" },
    { title: "المهام", href: "/marketing-tasks", icon: ListTodo, color: "text-orange-600 bg-orange-50" },
    { title: "التقويم", href: "/marketing-calendar", icon: Calendar, color: "text-purple-600 bg-purple-50" },
    { title: "الفريق", href: "/marketing-team", icon: UserCheck, color: "text-indigo-600 bg-indigo-50" },
    { title: "المصروفات", href: "/marketing-expenses", icon: DollarSign, color: "text-emerald-600 bg-emerald-50" },
    { title: "التقارير", href: "/marketing-reports", icon: FileBarChart, color: "text-green-600 bg-green-50" },
    { title: "الأهداف", href: "/marketing-goals", icon: Target, color: "text-rose-600 bg-rose-50" },
    { title: "الأصول", href: "/marketing-assets", icon: FolderOpen, color: "text-cyan-600 bg-cyan-50" },
    { title: "التنبيهات", href: "/marketing-alerts", icon: Bell, color: "text-red-600 bg-red-50" },
  ];

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6" dir="rtl">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">لوحة تحكم التسويق</h1>
          <p className="text-muted-foreground">نظرة شاملة على أنشطة وحملات التسويق</p>
        </div>

        {/* Quick Navigation */}
        <div className="flex flex-wrap gap-2">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <link.icon className="w-4 h-4" />
                {link.title}
              </Button>
            </Link>
          ))}
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">الحملات النشطة</p>
                  <p className="text-3xl font-bold mt-1">{activeCampaigns.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">من أصل {allCampaigns.length} حملة</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-100">
                  <Megaphone className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">المؤثرين</p>
                  <p className="text-3xl font-bold mt-1">{activeInfluencers.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatCompactNumber(totalFollowers)} متابع</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-100">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">الميزانية</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(totalBudget)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Progress value={budgetUtilization} className="h-1.5 w-16" />
                    <span className="text-xs text-muted-foreground">{budgetUtilization.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-green-100">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">المهام</p>
                  <p className="text-3xl font-bold mt-1">{pendingTasks.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {urgentTasks.length > 0 && (
                      <span className="text-red-500">{urgentTasks.length} عاجلة</span>
                    )}
                    {urgentTasks.length === 0 && `${completedTasks.length} مكتملة`}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${urgentTasks.length > 0 ? 'bg-red-100' : 'bg-orange-100'}`}>
                  <ListTodo className={`w-6 h-6 ${urgentTasks.length > 0 ? 'text-red-600' : 'text-orange-600'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content with Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="campaigns">الحملات</TabsTrigger>
            <TabsTrigger value="influencers">المؤثرين</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* KPIs */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">مؤشرات الأداء</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">استخدام الميزانية</span>
                        <span className="text-sm font-medium">{budgetUtilization.toFixed(0)}%</span>
                      </div>
                      <Progress value={budgetUtilization} className="h-2" />
                      <p className="text-xs text-muted-foreground">{formatCurrency(spentBudget)} من {formatCurrency(totalBudget)}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">إنجاز المهام</span>
                        <span className="text-sm font-medium">{taskCompletionRate.toFixed(0)}%</span>
                      </div>
                      <Progress value={taskCompletionRate} className="h-2" />
                      <p className="text-xs text-muted-foreground">{completedTasks.length} من {allTasks.length} مهمة</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">الحملات المكتملة</span>
                        <span className="text-sm font-medium">{completedCampaigns.length}/{allCampaigns.length}</span>
                      </div>
                      <Progress value={allCampaigns.length > 0 ? (completedCampaigns.length / allCampaigns.length) * 100 : 0} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">إجمالي المصروفات</span>
                        <span className="text-sm font-medium">{formatCurrency(totalExpenses)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Activity className="w-3 h-3" />
                        <span>{allExpenses.length} عملية</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Upcoming Events */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">المواعيد القادمة</CardTitle>
                    <Link href="/marketing-calendar">
                      <Button variant="ghost" size="sm" className="h-8 text-xs">
                        عرض الكل
                        <ChevronLeft className="w-3 h-3 mr-1" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {upcomingEvents.length > 0 ? (
                    <div className="space-y-3">
                      {upcomingEvents.map((event) => (
                        <div key={event.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                          <div className="p-2 rounded-lg bg-purple-100">
                            <Calendar className="w-4 h-4 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{event.title}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(event.startDate)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">لا توجد مواعيد قادمة</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Urgent Tasks */}
            {urgentTasks.length > 0 && (
              <Card className="border-red-200 bg-red-50/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <CardTitle className="text-lg text-red-700">مهام عاجلة</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {urgentTasks.slice(0, 6).map((task) => (
                      <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-white border">
                        <div className={`w-2 h-2 rounded-full ${task.priority === 'urgent' ? 'bg-red-500' : 'bg-orange-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          {task.dueDate && (
                            <p className="text-xs text-muted-foreground">{formatDate(task.dueDate)}</p>
                          )}
                        </div>
                        <Badge variant="outline" className={PRIORITY_CONFIG[task.priority || 'medium']?.color}>
                          {PRIORITY_CONFIG[task.priority || 'medium']?.label}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <Link href="/marketing-tasks">
                    <Button variant="outline" size="sm" className="w-full mt-3">
                      عرض كل المهام
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Campaign Status Chart */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">حالة الحملات</CardTitle>
                </CardHeader>
                <CardContent>
                  {campaignStatusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={campaignStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {campaignStatusData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      لا توجد حملات
                    </div>
                  )}
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {campaignStatusData.map((item, index) => (
                      <div key={item.name} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-xs">{item.name}: {item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Campaigns */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">أحدث الحملات</CardTitle>
                    <Link href="/marketing-campaigns">
                      <Button variant="ghost" size="sm" className="h-8 text-xs">
                        عرض الكل
                        <ChevronLeft className="w-3 h-3 mr-1" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentCampaigns.map((campaign) => {
                      const statusConfig = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
                      const progress = campaign.totalBudget ? ((campaign.spentBudget || 0) / campaign.totalBudget) * 100 : 0;
                      return (
                        <div key={campaign.id} className="p-3 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium truncate">{campaign.nameAr || campaign.name}</p>
                            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                          </div>
                          {campaign.totalBudget && campaign.totalBudget > 0 && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>الميزانية</span>
                                <span>{progress.toFixed(0)}%</span>
                              </div>
                              <Progress value={progress} className="h-1.5" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {recentCampaigns.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">لا توجد حملات</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Influencers Tab */}
          <TabsContent value="influencers" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Influencer Tiers */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">تصنيف المؤثرين</CardTitle>
                  <CardDescription>حسب عدد المتابعين</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { tier: 'mega', label: 'Mega (+1M)', color: 'bg-purple-500', count: influencersByTier.mega },
                      { tier: 'macro', label: 'Macro (100K-1M)', color: 'bg-blue-500', count: influencersByTier.macro },
                      { tier: 'micro', label: 'Micro (10K-100K)', color: 'bg-green-500', count: influencersByTier.micro },
                      { tier: 'nano', label: 'Nano (<10K)', color: 'bg-gray-400', count: influencersByTier.nano },
                    ].map((item) => (
                      <div key={item.tier} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${item.color}`} />
                        <span className="text-sm flex-1">{item.label}</span>
                        <span className="font-semibold">{item.count}</span>
                        <Progress 
                          value={allInfluencers.length > 0 ? (item.count / allInfluencers.length) * 100 : 0} 
                          className="w-20 h-2" 
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Influencers */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">أفضل المؤثرين</CardTitle>
                    <Link href="/marketing-influencers">
                      <Button variant="ghost" size="sm" className="h-8 text-xs">
                        عرض الكل
                        <ChevronLeft className="w-3 h-3 mr-1" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topInfluencers.map((influencer, index) => (
                      <div key={influencer.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{influencer.name}</p>
                          <p className="text-xs text-muted-foreground">{formatCompactNumber(influencer.followerCount || 0)} متابع</p>
                        </div>
                        {influencer.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                            <span className="text-sm">{influencer.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {topInfluencers.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">لا يوجد مؤثرين</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
