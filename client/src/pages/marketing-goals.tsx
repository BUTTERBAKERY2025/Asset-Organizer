import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Plus, Target, TrendingUp, Award, Trash2, Edit } from "lucide-react";
import { Link } from "wouter";

interface Campaign {
  id: number;
  name: string;
  status: string;
}

interface CampaignGoal {
  id: number;
  campaignId: number;
  goalType: string;
  targetValue: number;
  currentValue: number;
  metric: string;
  deadline: string | null;
  status: string;
  createdAt: string;
}

const goalTypeLabels: Record<string, string> = {
  impressions: "مرات الظهور",
  clicks: "النقرات",
  conversions: "التحويلات",
  sales: "المبيعات",
  followers: "المتابعين",
  engagement: "التفاعل",
  reach: "الوصول",
  leads: "العملاء المحتملين",
};

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  exceeded: "تم تجاوزه",
};

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  exceeded: "bg-purple-100 text-purple-800",
};

export default function MarketingGoalsPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    campaignId: 0,
    goalType: "impressions",
    targetValue: 0,
    currentValue: 0,
    metric: "",
    deadline: "",
    status: "pending",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/marketing/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/campaigns");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: goals = [], isLoading } = useQuery<CampaignGoal[]>({
    queryKey: ["/api/marketing/campaigns", selectedCampaignId, "goals"],
    queryFn: async () => {
      if (!selectedCampaignId) {
        const allGoals: CampaignGoal[] = [];
        for (const campaign of campaigns) {
          const res = await fetch(`/api/marketing/campaigns/${campaign.id}/goals`);
          if (res.ok) {
            const campaignGoals = await res.json();
            allGoals.push(...campaignGoals);
          }
        }
        return allGoals;
      }
      const res = await fetch(`/api/marketing/campaigns/${selectedCampaignId}/goals`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: campaigns.length > 0,
  });

  const createGoalMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch(`/api/marketing/campaigns/${data.campaignId}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل في إنشاء الهدف");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/campaigns"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "تم إنشاء الهدف بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء الهدف", variant: "destructive" });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/marketing/goals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل في حذف الهدف");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/campaigns"] });
      toast({ title: "تم حذف الهدف بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في حذف الهدف", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      campaignId: 0,
      goalType: "impressions",
      targetValue: 0,
      currentValue: 0,
      metric: "",
      deadline: "",
      status: "pending",
    });
  };

  const getCampaignName = (campaignId: number) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign?.name || "غير محدد";
  };

  const getProgressPercentage = (goal: CampaignGoal) => {
    if (goal.targetValue === 0) return 0;
    return Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-100 flex items-center justify-center" dir="rtl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-100 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/marketing">
              <Button variant="outline" size="sm" className="gap-2" data-testid="button-back">
                <ArrowRight className="h-4 w-4" />
                العودة للتسويق
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-800" data-testid="text-page-title">أهداف الحملات</h1>
              <p className="text-gray-600">إدارة وتتبع أهداف الحملات التسويقية</p>
            </div>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-pink-500 hover:bg-pink-600 gap-2" data-testid="button-add-goal">
                <Plus className="h-4 w-4" />
                إضافة هدف
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة هدف جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>الحملة</Label>
                  <Select
                    value={formData.campaignId.toString()}
                    onValueChange={(value) => setFormData({ ...formData, campaignId: parseInt(value) })}
                  >
                    <SelectTrigger data-testid="select-campaign">
                      <SelectValue placeholder="اختر الحملة" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id.toString()}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>نوع الهدف</Label>
                  <Select
                    value={formData.goalType}
                    onValueChange={(value) => setFormData({ ...formData, goalType: value })}
                  >
                    <SelectTrigger data-testid="select-goal-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(goalTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>القيمة المستهدفة</Label>
                    <Input
                      type="number"
                      value={formData.targetValue}
                      onChange={(e) => setFormData({ ...formData, targetValue: parseInt(e.target.value) || 0 })}
                      data-testid="input-target-value"
                    />
                  </div>
                  <div>
                    <Label>القيمة الحالية</Label>
                    <Input
                      type="number"
                      value={formData.currentValue}
                      onChange={(e) => setFormData({ ...formData, currentValue: parseInt(e.target.value) || 0 })}
                      data-testid="input-current-value"
                    />
                  </div>
                </div>
                <div>
                  <Label>وحدة القياس</Label>
                  <Input
                    value={formData.metric}
                    onChange={(e) => setFormData({ ...formData, metric: e.target.value })}
                    placeholder="مثال: عدد، نسبة، ريال"
                    data-testid="input-metric"
                  />
                </div>
                <div>
                  <Label>الموعد النهائي</Label>
                  <Input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    data-testid="input-deadline"
                  />
                </div>
                <Button
                  onClick={() => createGoalMutation.mutate(formData)}
                  disabled={!formData.campaignId || createGoalMutation.isPending}
                  className="w-full bg-pink-500 hover:bg-pink-600"
                  data-testid="button-submit-goal"
                >
                  {createGoalMutation.isPending ? "جاري الإنشاء..." : "إنشاء الهدف"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6">
          <Select
            value={selectedCampaignId?.toString() || "all"}
            onValueChange={(value) => setSelectedCampaignId(value === "all" ? null : parseInt(value))}
          >
            <SelectTrigger className="w-64 bg-white" data-testid="select-filter-campaign">
              <SelectValue placeholder="جميع الحملات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحملات</SelectItem>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id.toString()}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((goal) => (
            <Card key={goal.id} className="hover:shadow-lg transition-shadow" data-testid={`card-goal-${goal.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-pink-500" />
                    <CardTitle className="text-lg">{goalTypeLabels[goal.goalType] || goal.goalType}</CardTitle>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[goal.status]}`}>
                    {statusLabels[goal.status]}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{getCampaignName(goal.campaignId)}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>التقدم</span>
                      <span className="font-bold">{getProgressPercentage(goal).toLocaleString('en-US')}%</span>
                    </div>
                    <Progress value={getProgressPercentage(goal)} className="h-2" />
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <div>
                      <span className="text-gray-500">الحالي: </span>
                      <span className="font-bold">{goal.currentValue.toLocaleString('en-US')}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">المستهدف: </span>
                      <span className="font-bold">{goal.targetValue.toLocaleString('en-US')}</span>
                    </div>
                  </div>

                  {goal.deadline && (
                    <div className="text-sm text-gray-500">
                      الموعد النهائي: {new Date(goal.deadline).toLocaleDateString('en-US')}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteGoalMutation.mutate(goal.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      data-testid={`button-delete-goal-${goal.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {goals.length === 0 && (
          <Card className="p-12 text-center">
            <Award className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">لا توجد أهداف</h3>
            <p className="text-gray-500">قم بإضافة أهداف لتتبع أداء الحملات التسويقية</p>
          </Card>
        )}
      </div>
    </div>
  );
}
