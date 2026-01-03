import { Layout } from "../components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Megaphone, Users, Target, Calendar, TrendingUp, FileBarChart, Clock, DollarSign,
  ChevronLeft
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface MarketingCampaign {
  id: string;
  status: string;
  budget?: number;
}

interface Influencer {
  id: string;
  isActive: boolean;
}

interface MarketingTask {
  id: string;
  status: string;
}

export default function MarketingDashboardPage() {
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<MarketingCampaign[]>({
    queryKey: ["/api/marketing/campaigns", { status: "active" }],
    queryFn: async () => {
      const res = await fetch("/api/marketing/campaigns?status=active");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: influencers = [], isLoading: influencersLoading } = useQuery<Influencer[]>({
    queryKey: ["/api/marketing/influencers", { isActive: true }],
    queryFn: async () => {
      const res = await fetch("/api/marketing/influencers?isActive=true");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<MarketingTask[]>({
    queryKey: ["/api/marketing/tasks", { status: "pending" }],
    queryFn: async () => {
      const res = await fetch("/api/marketing/tasks?status=pending");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const isLoading = campaignsLoading || influencersLoading || tasksLoading;

  const totalBudget = campaigns.reduce((sum, c) => sum + (c.budget || 0), 0);
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(amount);

  const statsCards = [
    {
      title: "الحملات النشطة",
      value: campaigns.length,
      icon: Megaphone,
      color: "bg-amber-50/50 border-amber-100",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      valueColor: "text-amber-700",
    },
    {
      title: "المؤثرين",
      value: influencers.length,
      icon: Users,
      color: "bg-blue-50/50 border-blue-100",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      valueColor: "text-blue-700",
    },
    {
      title: "الميزانية الشهرية",
      value: formatCurrency(totalBudget),
      icon: DollarSign,
      color: "bg-green-50/50 border-green-100",
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      valueColor: "text-green-700",
    },
    {
      title: "المهام المعلقة",
      value: tasks.length,
      icon: Clock,
      color: tasks.length > 0 ? "bg-orange-50/50 border-orange-100" : "bg-emerald-50/50 border-emerald-100",
      iconBg: tasks.length > 0 ? "bg-orange-100" : "bg-emerald-100",
      iconColor: tasks.length > 0 ? "text-orange-600" : "text-emerald-600",
      valueColor: tasks.length > 0 ? "text-orange-700" : "text-emerald-700",
    },
  ];

  const quickAccessCards = [
    {
      title: "الحملات التسويقية",
      description: "إدارة ومتابعة جميع الحملات التسويقية",
      href: "/marketing-campaigns",
      icon: Megaphone,
      color: "bg-amber-500",
    },
    {
      title: "المؤثرين والبلوجرز",
      description: "إدارة علاقات المؤثرين والتعاونات",
      href: "/marketing-influencers",
      icon: Users,
      color: "bg-blue-500",
    },
    {
      title: "تقويم التسويق",
      description: "جدولة الحملات والفعاليات التسويقية",
      href: "/marketing-calendar",
      icon: Calendar,
      color: "bg-purple-500",
    },
    {
      title: "مهام التسويق",
      description: "متابعة المهام والأنشطة التسويقية",
      href: "/marketing-tasks",
      icon: Target,
      color: "bg-orange-500",
    },
    {
      title: "تقارير الأداء",
      description: "تحليلات وتقارير أداء الحملات",
      href: "/marketing-reports",
      icon: FileBarChart,
      color: "bg-green-500",
    },
    {
      title: "فريق التسويق",
      description: "إدارة فريق التسويق والمهام",
      href: "/marketing-team",
      icon: TrendingUp,
      color: "bg-indigo-500",
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statsCards.map((stat, index) => (
            <Card 
              key={index} 
              className={stat.color}
              data-testid={`stat-card-${index}`}
            >
              <CardContent className="p-4">
                {isLoading ? (
                  <Skeleton className="h-14" />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${stat.iconBg} flex items-center justify-center`}>
                      <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                    </div>
                    <div>
                      <div className={`text-xl font-bold ${stat.valueColor}`} data-testid={`stat-value-${index}`}>
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

        <div>
          <h2 className="text-lg font-semibold mb-4">الوصول السريع</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickAccessCards.map((card, index) => (
              <Link key={index} href={card.href}>
                <Card 
                  className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/30 h-full"
                  data-testid={`quick-access-${card.href.replace('/marketing/', '')}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.color} transition-transform group-hover:scale-110`}>
                        <card.icon className="w-6 h-6 text-white" />
                      </div>
                      <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <CardTitle className="text-base mt-3">{card.title}</CardTitle>
                    <CardDescription className="text-sm">{card.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
