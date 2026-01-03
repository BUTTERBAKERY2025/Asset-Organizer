import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, TrendingDown, BarChart3, PieChart, 
  Users, Megaphone, DollarSign, Target, Eye, 
  Heart, MessageCircle, Share2, Download
} from "lucide-react";

interface CampaignStats {
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
  totalBudget: number;
  spentBudget: number;
}

interface InfluencerStats {
  totalInfluencers: number;
  activeInfluencers: number;
  totalReach: number;
  avgEngagement: number;
}

export default function MarketingReportsPage() {
  const [period, setPeriod] = useState("month");

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ["/api/marketing/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/campaigns");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: influencers = [], isLoading: influencersLoading } = useQuery({
    queryKey: ["/api/marketing/influencers"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/influencers");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const isLoading = campaignsLoading || influencersLoading;

  const campaignStats: CampaignStats = {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter((c: any) => c.status === "active").length,
    completedCampaigns: campaigns.filter((c: any) => c.status === "completed").length,
    totalBudget: campaigns.reduce((sum: number, c: any) => sum + (c.budget || 0), 0),
    spentBudget: campaigns.reduce((sum: number, c: any) => sum + (c.spentAmount || 0), 0),
  };

  const influencerStats: InfluencerStats = {
    totalInfluencers: influencers.length,
    activeInfluencers: influencers.filter((i: any) => i.isActive).length,
    totalReach: influencers.reduce((sum: number, i: any) => sum + (i.followersCount || 0), 0),
    avgEngagement: influencers.length > 0 
      ? influencers.reduce((sum: number, i: any) => sum + (i.engagementRate || 0), 0) / influencers.length 
      : 0,
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(amount);

  const formatNumber = (num: number) =>
    new Intl.NumberFormat("ar-SA").format(num);

  const budgetUtilization = campaignStats.totalBudget > 0 
    ? Math.round((campaignStats.spentBudget / campaignStats.totalBudget) * 100) 
    : 0;

  const kpiCards = [
    {
      title: "إجمالي الحملات",
      value: campaignStats.totalCampaigns,
      icon: Megaphone,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      change: "+12%",
      changeType: "up",
    },
    {
      title: "الحملات النشطة",
      value: campaignStats.activeCampaigns,
      icon: Target,
      color: "text-green-600",
      bgColor: "bg-green-50",
      change: "+5%",
      changeType: "up",
    },
    {
      title: "إجمالي الميزانية",
      value: formatCurrency(campaignStats.totalBudget),
      icon: DollarSign,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      change: "+20%",
      changeType: "up",
    },
    {
      title: "المؤثرين النشطين",
      value: influencerStats.activeInfluencers,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      change: "+8%",
      changeType: "up",
    },
  ];

  const engagementMetrics = [
    { label: "الوصول الإجمالي", value: formatNumber(influencerStats.totalReach), icon: Eye },
    { label: "معدل التفاعل", value: `${influencerStats.avgEngagement.toFixed(1)}%`, icon: Heart },
    { label: "التعليقات", value: formatNumber(Math.floor(influencerStats.totalReach * 0.02)), icon: MessageCircle },
    { label: "المشاركات", value: formatNumber(Math.floor(influencerStats.totalReach * 0.005)), icon: Share2 },
  ];

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">تقارير أداء التسويق</h1>
            <p className="text-sm text-muted-foreground">تحليلات وتقارير أداء الحملات والمؤثرين</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32" data-testid="select-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">أسبوع</SelectItem>
                <SelectItem value="month">شهر</SelectItem>
                <SelectItem value="quarter">ربع سنة</SelectItem>
                <SelectItem value="year">سنة</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" data-testid="button-export">
              <Download className="w-4 h-4 ml-2" />
              تصدير
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpiCards.map((kpi, index) => (
              <Card key={index} data-testid={`kpi-card-${index}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                      <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                    </div>
                    <Badge 
                      variant="outline" 
                      className={kpi.changeType === "up" ? "text-green-600" : "text-red-600"}
                    >
                      {kpi.changeType === "up" ? <TrendingUp className="w-3 h-3 ml-1" /> : <TrendingDown className="w-3 h-3 ml-1" />}
                      {kpi.change}
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-bold">{kpi.value}</p>
                    <p className="text-sm text-muted-foreground">{kpi.title}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="campaigns" data-testid="tab-campaigns">الحملات</TabsTrigger>
            <TabsTrigger value="influencers" data-testid="tab-influencers">المؤثرين</TabsTrigger>
            <TabsTrigger value="budget" data-testid="tab-budget">الميزانية</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    مقاييس التفاعل
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {engagementMetrics.map((metric, index) => (
                      <div key={index} className="text-center p-4 bg-muted/50 rounded-lg">
                        <metric.icon className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-xl font-bold">{metric.value}</p>
                        <p className="text-xs text-muted-foreground">{metric.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    استخدام الميزانية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>الميزانية المستخدمة</span>
                      <span className="font-bold">{budgetUtilization}%</span>
                    </div>
                    <div className="h-4 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${budgetUtilization}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-lg font-bold text-green-700">{formatCurrency(campaignStats.spentBudget)}</p>
                        <p className="text-xs text-green-600">المصروف</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-lg font-bold text-blue-700">{formatCurrency(campaignStats.totalBudget - campaignStats.spentBudget)}</p>
                        <p className="text-xs text-blue-600">المتبقي</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle>أداء الحملات</CardTitle>
                <CardDescription>تحليل تفصيلي لأداء كل حملة</CardDescription>
              </CardHeader>
              <CardContent>
                {campaigns.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">لا توجد حملات لعرضها</p>
                ) : (
                  <div className="space-y-4">
                    {campaigns.slice(0, 5).map((campaign: any, index: number) => (
                      <div key={campaign.id || index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h4 className="font-medium">{campaign.name}</h4>
                          <p className="text-sm text-muted-foreground">{campaign.objective}</p>
                        </div>
                        <div className="text-left">
                          <p className="font-bold">{formatCurrency(campaign.budget || 0)}</p>
                          <Badge variant={campaign.status === "active" ? "default" : "secondary"}>
                            {campaign.status === "active" ? "نشطة" : campaign.status === "completed" ? "مكتملة" : "مسودة"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="influencers">
            <Card>
              <CardHeader>
                <CardTitle>أداء المؤثرين</CardTitle>
                <CardDescription>تحليل تفصيلي لأداء كل مؤثر</CardDescription>
              </CardHeader>
              <CardContent>
                {influencers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">لا يوجد مؤثرين لعرضهم</p>
                ) : (
                  <div className="space-y-4">
                    {influencers.slice(0, 5).map((influencer: any, index: number) => (
                      <div key={influencer.id || index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <Users className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-medium">{influencer.name}</h4>
                            <p className="text-sm text-muted-foreground">{influencer.platform}</p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="font-bold">{formatNumber(influencer.followersCount || 0)} متابع</p>
                          <p className="text-sm text-muted-foreground">{influencer.engagementRate || 0}% تفاعل</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="budget">
            <Card>
              <CardHeader>
                <CardTitle>تقرير الميزانية</CardTitle>
                <CardDescription>تفاصيل الإنفاق والميزانية المخصصة</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-6 bg-blue-50 rounded-lg text-center">
                    <DollarSign className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                    <p className="text-2xl font-bold text-blue-700">{formatCurrency(campaignStats.totalBudget)}</p>
                    <p className="text-sm text-blue-600">إجمالي الميزانية</p>
                  </div>
                  <div className="p-6 bg-green-50 rounded-lg text-center">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-600" />
                    <p className="text-2xl font-bold text-green-700">{formatCurrency(campaignStats.spentBudget)}</p>
                    <p className="text-sm text-green-600">المصروف</p>
                  </div>
                  <div className="p-6 bg-amber-50 rounded-lg text-center">
                    <Target className="w-8 h-8 mx-auto mb-2 text-amber-600" />
                    <p className="text-2xl font-bold text-amber-700">{formatCurrency(campaignStats.totalBudget - campaignStats.spentBudget)}</p>
                    <p className="text-sm text-amber-600">المتبقي</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
