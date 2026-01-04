import { Layout } from "../components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Megaphone, Users, Target, Calendar, TrendingUp, FileBarChart, Clock, DollarSign,
  ChevronLeft, CheckCircle2, AlertCircle, BarChart3, Award, FolderOpen, Bell
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface MarketingCampaign {
  id: number;
  status: string;
  totalBudget?: number;
  spentBudget?: number;
}

interface Influencer {
  id: number;
  isActive: boolean;
  followerCount?: number;
}

interface MarketingTask {
  id: number;
  status: string;
  priority?: string;
}

interface TeamMember {
  id: number;
  isActive: boolean;
}

interface CalendarEvent {
  id: number;
  startDate: string;
}

export default function MarketingDashboardPage() {
  // Fetch all campaigns
  const { data: allCampaigns = [], isLoading: campaignsLoading } = useQuery<MarketingCampaign[]>({
    queryKey: ["/api/marketing/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/campaigns");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch all influencers
  const { data: allInfluencers = [], isLoading: influencersLoading } = useQuery<Influencer[]>({
    queryKey: ["/api/marketing/influencers"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/influencers");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch all tasks
  const { data: allTasks = [], isLoading: tasksLoading } = useQuery<MarketingTask[]>({
    queryKey: ["/api/marketing/tasks"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/tasks");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch team members
  const { data: teamMembers = [], isLoading: teamLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/marketing/team"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/team");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch calendar events
  const { data: calendarEvents = [], isLoading: calendarLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/marketing/calendar-events"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/calendar-events");
      if (!res.ok) return [];
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
  const totalFollowers = allInfluencers.reduce((sum, i) => sum + (i.followerCount || 0), 0);

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

  const statsCards = [
    {
      title: "إجمالي الحملات",
      value: formatNumber(allCampaigns.length),
      subValue: `${formatNumber(activeCampaigns.length)} نشطة`,
      icon: Megaphone,
      color: "bg-amber-50/50 border-amber-100",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      valueColor: "text-amber-700",
    },
    {
      title: "المؤثرين",
      value: formatNumber(allInfluencers.length),
      subValue: `${formatNumber(activeInfluencers.length)} نشط`,
      icon: Users,
      color: "bg-blue-50/50 border-blue-100",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      valueColor: "text-blue-700",
    },
    {
      title: "الميزانية الإجمالية",
      value: formatCurrency(totalBudget),
      subValue: `${formatCurrency(spentBudget)} مصروف`,
      icon: DollarSign,
      color: "bg-green-50/50 border-green-100",
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      valueColor: "text-green-700",
    },
    {
      title: "المهام",
      value: formatNumber(allTasks.length),
      subValue: `${formatNumber(pendingTasks.length)} قيد التنفيذ`,
      icon: Clock,
      color: pendingTasks.length > 0 ? "bg-orange-50/50 border-orange-100" : "bg-emerald-50/50 border-emerald-100",
      iconBg: pendingTasks.length > 0 ? "bg-orange-100" : "bg-emerald-100",
      iconColor: pendingTasks.length > 0 ? "text-orange-600" : "text-emerald-600",
      valueColor: pendingTasks.length > 0 ? "text-orange-700" : "text-emerald-700",
    },
  ];

  const secondaryStats = [
    {
      title: "فريق التسويق",
      value: formatNumber(teamMembers.length),
      subValue: `${formatNumber(activeTeamMembers.length)} نشط`,
      icon: TrendingUp,
      color: "bg-indigo-50/50 border-indigo-100",
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      valueColor: "text-indigo-700",
    },
    {
      title: "الفعاليات",
      value: formatNumber(calendarEvents.length),
      subValue: "حدث مجدول",
      icon: Calendar,
      color: "bg-purple-50/50 border-purple-100",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      valueColor: "text-purple-700",
    },
    {
      title: "الوصول المتوقع",
      value: formatNumber(totalFollowers),
      subValue: "متابع",
      icon: BarChart3,
      color: "bg-pink-50/50 border-pink-100",
      iconBg: "bg-pink-100",
      iconColor: "text-pink-600",
      valueColor: "text-pink-700",
    },
    {
      title: "الحملات المكتملة",
      value: formatNumber(completedCampaigns.length),
      subValue: `من ${formatNumber(allCampaigns.length)}`,
      icon: CheckCircle2,
      color: "bg-teal-50/50 border-teal-100",
      iconBg: "bg-teal-100",
      iconColor: "text-teal-600",
      valueColor: "text-teal-700",
    },
  ];

  const quickAccessCards = [
    {
      title: "الحملات التسويقية",
      description: "إدارة ومتابعة جميع الحملات التسويقية",
      href: "/marketing-campaigns",
      icon: Megaphone,
      color: "bg-amber-500",
      count: allCampaigns.length,
    },
    {
      title: "المؤثرين والبلوجرز",
      description: "إدارة علاقات المؤثرين والتعاونات",
      href: "/marketing-influencers",
      icon: Users,
      color: "bg-blue-500",
      count: allInfluencers.length,
    },
    {
      title: "تقويم التسويق",
      description: "جدولة الحملات والفعاليات التسويقية",
      href: "/marketing-calendar",
      icon: Calendar,
      color: "bg-purple-500",
      count: calendarEvents.length,
    },
    {
      title: "مهام التسويق",
      description: "متابعة المهام والأنشطة التسويقية",
      href: "/marketing-tasks",
      icon: Target,
      color: "bg-orange-500",
      count: allTasks.length,
    },
    {
      title: "تقارير الأداء",
      description: "تحليلات وتقارير أداء الحملات",
      href: "/marketing-reports",
      icon: FileBarChart,
      color: "bg-green-500",
      count: null,
    },
    {
      title: "فريق التسويق",
      description: "إدارة فريق التسويق والمهام",
      href: "/marketing-team",
      icon: TrendingUp,
      color: "bg-indigo-500",
      count: teamMembers.length,
    },
    {
      title: "أهداف الحملات",
      description: "تتبع وإدارة أهداف الحملات",
      href: "/marketing-goals",
      icon: Award,
      color: "bg-rose-500",
      count: null,
    },
    {
      title: "الأصول التسويقية",
      description: "إدارة الصور والفيديوهات والملفات",
      href: "/marketing-assets",
      icon: FolderOpen,
      color: "bg-cyan-500",
      count: null,
    },
    {
      title: "التنبيهات",
      description: "إشعارات وتنبيهات التسويق",
      href: "/marketing-alerts",
      icon: Bell,
      color: "bg-red-500",
      count: null,
    },
  ];

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">
            لوحة تحكم التسويق
          </h1>
          <p className="text-sm text-muted-foreground">
            نظرة شاملة على جميع أنشطة وحملات التسويق
          </p>
        </div>

        {/* Primary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statsCards.map((stat, index) => (
            <Card 
              key={index} 
              className={stat.color}
              data-testid={`stat-card-${index}`}
            >
              <CardContent className="p-4">
                {isLoading ? (
                  <Skeleton className="h-16" />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg ${stat.iconBg} flex items-center justify-center`}>
                      <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
                    </div>
                    <div>
                      <div className={`text-2xl font-bold ${stat.valueColor}`} data-testid={`stat-value-${index}`}>
                        {stat.value}
                      </div>
                      <div className="text-xs text-muted-foreground">{stat.title}</div>
                      <div className="text-xs text-muted-foreground/80">{stat.subValue}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {secondaryStats.map((stat, index) => (
            <Card 
              key={index} 
              className={stat.color}
              data-testid={`secondary-stat-card-${index}`}
            >
              <CardContent className="p-3">
                {isLoading ? (
                  <Skeleton className="h-12" />
                ) : (
                  <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 rounded-lg ${stat.iconBg} flex items-center justify-center`}>
                      <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                    </div>
                    <div>
                      <div className={`text-lg font-bold ${stat.valueColor}`}>
                        {stat.value}
                      </div>
                      <div className="text-xs text-muted-foreground">{stat.title}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Access */}
        <div>
          <h2 className="text-lg font-semibold mb-3">الوصول السريع</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {quickAccessCards.map((card, index) => (
              <Link key={index} href={card.href}>
                <Card 
                  className="group hover:shadow-md transition-all duration-200 cursor-pointer border hover:border-primary/30 h-full"
                  data-testid={`quick-access-${card.href.replace('/marketing-', '')}`}
                >
                  <CardContent className="p-3">
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color} transition-transform group-hover:scale-105`}>
                        <card.icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-tight">{card.title}</p>
                        {card.count !== null && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            {formatNumber(card.count)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
