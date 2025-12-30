import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, TrendingUp, TrendingDown, Building2, Users, Trophy, ChevronLeft, Calendar, Award } from "lucide-react";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import type { Branch } from "@shared/schema";

interface BranchPerformance {
  branchId: string;
  branchName: string;
  target: number;
  achieved: number;
  percent: number;
  rank: number;
}

interface CashierPerformance {
  cashierId: string;
  cashierName: string;
  branchId: string;
  target: number;
  achieved: number;
  percent: number;
  rank: number;
}

interface Leaderboard {
  branches: BranchPerformance[];
  cashiers: CashierPerformance[];
}

interface DailyPerformance {
  date: string;
  target: number;
  achieved: number;
  percent: number;
}

interface PerformanceData {
  targetAmount: number;
  achievedAmount: number;
  achievementPercent: number;
  dailyPerformance: DailyPerformance[];
}

export default function TargetsDashboard() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery<Leaderboard>({
    queryKey: ["/api/targets/leaderboard", selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/targets/leaderboard?yearMonth=${selectedMonth}`);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    }
  });

  const { data: branchPerformance, isLoading: performanceLoading } = useQuery<PerformanceData>({
    queryKey: ["/api/targets/performance", selectedBranch, selectedMonth],
    queryFn: async () => {
      if (selectedBranch === "all") return null;
      const res = await fetch(`/api/targets/performance/${selectedBranch}?yearMonth=${selectedMonth}`);
      if (!res.ok) throw new Error("Failed to fetch performance");
      return res.json();
    },
    enabled: selectedBranch !== "all"
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SA', { 
      style: 'currency', 
      currency: 'SAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const getPercentColor = (percent: number) => {
    if (percent >= 100) return "text-green-600";
    if (percent >= 80) return "text-amber-600";
    return "text-red-600";
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return "bg-green-500";
    if (percent >= 80) return "bg-amber-500";
    return "bg-red-500";
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-500 text-white">🥇 الأول</Badge>;
    if (rank === 2) return <Badge className="bg-gray-400 text-white">🥈 الثاني</Badge>;
    if (rank === 3) return <Badge className="bg-amber-700 text-white">🥉 الثالث</Badge>;
    return <Badge variant="outline">{rank}</Badge>;
  };

  const totalTarget = leaderboard?.branches.reduce((sum, b) => sum + b.target, 0) || 0;
  const totalAchieved = leaderboard?.branches.reduce((sum, b) => sum + b.achieved, 0) || 0;
  const overallPercent = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/operations-reports">
              <Button variant="ghost" size="icon">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-amber-900 flex items-center gap-3">
                <TrendingUp className="h-8 w-8" />
                لوحة الأداء والأهداف
              </h1>
              <p className="text-amber-700 mt-1">متابعة تحقيق الأهداف الشهرية ومقارنة أداء الفروع</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>الشهر:</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-40"
                data-testid="input-month-selector"
              />
            </div>
            
            <Link href="/targets-planning">
              <Button variant="outline" data-testid="button-goto-planning">
                <Target className="h-4 w-4 ml-2" />
                تخطيط الأهداف
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                إجمالي الهدف
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">{formatCurrency(totalTarget)}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-emerald-500 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                إجمالي المحقق
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">{formatCurrency(totalAchieved)}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5" />
                نسبة التحقيق
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{overallPercent.toFixed(1)}%</div>
              <Progress value={Math.min(overallPercent, 100)} className="mt-2 bg-white/30" />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                عدد الفروع
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{leaderboard?.branches.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="branches" className="space-y-4">
          <TabsList>
            <TabsTrigger value="branches" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              ترتيب الفروع
            </TabsTrigger>
            <TabsTrigger value="cashiers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              أفضل الكاشيرين
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              تفاصيل الفرع
            </TabsTrigger>
          </TabsList>

          <TabsContent value="branches">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-600" />
                    ترتيب الفروع
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {leaderboardLoading ? (
                    <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                  ) : !leaderboard?.branches.length ? (
                    <div className="text-center py-8 text-gray-500">لا توجد بيانات</div>
                  ) : (
                    <div className="space-y-4">
                      {leaderboard.branches.map((branch) => (
                        <div key={branch.branchId} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg" data-testid={`branch-rank-${branch.branchId}`}>
                          <div className="w-16">{getRankBadge(branch.rank)}</div>
                          <div className="flex-1">
                            <div className="font-medium">{branch.branchName}</div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span>الهدف: {formatCurrency(branch.target)}</span>
                              <span>|</span>
                              <span>المحقق: {formatCurrency(branch.achieved)}</span>
                            </div>
                          </div>
                          <div className={`text-2xl font-bold ${getPercentColor(branch.percent)}`}>
                            {branch.percent.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>مقارنة أداء الفروع</CardTitle>
                </CardHeader>
                <CardContent>
                  {leaderboard?.branches && leaderboard.branches.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={leaderboard.branches}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="branchName" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                        <Bar dataKey="target" fill="#f59e0b" name="الهدف" />
                        <Bar dataKey="achieved" fill="#22c55e" name="المحقق" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-gray-500">لا توجد بيانات</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cashiers">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-amber-600" />
                  أفضل 20 كاشير
                </CardTitle>
              </CardHeader>
              <CardContent>
                {leaderboardLoading ? (
                  <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                ) : !leaderboard?.cashiers.length ? (
                  <div className="text-center py-8 text-gray-500">لا توجد بيانات</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {leaderboard.cashiers.map((cashier) => (
                      <Card key={cashier.cashierId} className={`${cashier.rank <= 3 ? 'border-amber-400 border-2' : ''}`} data-testid={`cashier-rank-${cashier.cashierId}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            {getRankBadge(cashier.rank)}
                            <span className={`text-xl font-bold ${getPercentColor(cashier.percent)}`}>
                              {cashier.achieved > 0 ? formatCurrency(cashier.achieved) : "0"}
                            </span>
                          </div>
                          <div className="font-medium">{cashier.cashierName}</div>
                          <div className="text-sm text-gray-500">
                            {branches.find(b => b.id === cashier.branchId)?.name || cashier.branchId}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-amber-600" />
                  تفاصيل أداء الفرع
                </CardTitle>
                <div className="flex items-center gap-4 mt-4">
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="w-48" data-testid="select-branch">
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">اختر فرع</SelectItem>
                      {branches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {selectedBranch === "all" ? (
                  <div className="text-center py-8 text-gray-500">اختر فرعًا لعرض التفاصيل</div>
                ) : performanceLoading ? (
                  <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                ) : !branchPerformance ? (
                  <div className="text-center py-8 text-gray-500">لا توجد بيانات لهذا الفرع</div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="text-sm text-gray-500">الهدف الشهري</div>
                          <div className="text-2xl font-bold text-amber-600">
                            {formatCurrency(branchPerformance.targetAmount)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="text-sm text-gray-500">المحقق</div>
                          <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(branchPerformance.achievedAmount)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="text-sm text-gray-500">نسبة التحقيق</div>
                          <div className={`text-2xl font-bold ${getPercentColor(branchPerformance.achievementPercent)}`}>
                            {branchPerformance.achievementPercent.toFixed(1)}%
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {branchPerformance.dailyPerformance.length > 0 && (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={branchPerformance.dailyPerformance}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tickFormatter={(v) => new Date(v).getDate().toString()} />
                          <YAxis />
                          <Tooltip 
                            formatter={(value: number) => formatCurrency(value)}
                            labelFormatter={(v) => new Date(v).toLocaleDateString('ar-SA')}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="target" stroke="#f59e0b" name="الهدف" strokeWidth={2} />
                          <Line type="monotone" dataKey="achieved" stroke="#22c55e" name="المحقق" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
