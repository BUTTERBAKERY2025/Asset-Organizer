import React, { useState } from 'react';
import { 
  Users, AlertCircle, Banknote, Calendar as CalendarIcon, FileWarning, 
  Briefcase, CheckCircle2, ChevronDown, Bell, Clock, RefreshCw,
  MessageSquare, UserPlus, Building2, Send, Lightbulb, Map
} from 'lucide-react';
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

// Data
const branchData = [
  { name: 'الرياض', value: 59 },
  { name: 'المدينة المنورة', value: 41 },
  { name: 'أبها الحزام', value: 36 },
  { name: 'أبها المطار', value: 34 },
  { name: 'محايل عسير', value: 22 },
  { name: 'الرياض - السفارات', value: 19 },
];

const jobData = [
  { name: 'عامل نظافة', value: 67 },
  { name: 'باريستا', value: 36 },
  { name: 'كاشير', value: 34 },
  { name: 'شيف بيتزا', value: 14 },
  { name: 'خباز', value: 13 },
  { name: 'سندوتشات', value: 12 },
];

const nationalityData = [
  { name: 'بنغلاديشي', value: 107 },
  { name: 'سعودي', value: 52 },
  { name: 'مصري', value: 38 },
  { name: 'فلبيني', value: 10 },
  { name: 'تونسي', value: 9 },
  { name: 'نيبالي', value: 9 },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

const QuickTile = ({ icon: Icon, title }: { icon: any, title: string }) => (
  <Button variant="outline" className="h-auto flex-col items-center justify-center gap-3 p-6 hover:bg-primary/5 transition-colors border-dashed border-2">
    <Icon className="w-8 h-8 text-primary" strokeWidth={1.5} />
    <span className="font-medium text-sm">{title}</span>
  </Button>
);

const KPI = ({ title, value, subValue, icon: Icon, alert = false }: { title: string, value: string, subValue?: string, icon: any, alert?: boolean }) => (
  <Card className={`${alert ? 'border-destructive/50 bg-destructive/5' : ''}`}>
    <CardContent className="p-6">
      <div className="flex items-center justify-between space-y-0">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className={`p-2 rounded-full ${alert ? 'bg-destructive/10' : 'bg-primary/10'}`}>
          <Icon className={`w-4 h-4 ${alert ? 'text-destructive' : 'text-primary'}`} />
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <h2 className="text-3xl font-bold tracking-tight">{value}</h2>
        {subValue && <span className="text-sm text-muted-foreground">{subValue}</span>}
      </div>
    </CardContent>
  </Card>
);

export function WorkflowTabs() {
  return (
    <div dir="rtl" className="min-h-screen bg-muted/20 text-foreground font-sans">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap');
        .font-sans { font-family: 'Cairo', sans-serif !important; }
      `}} />

      {/* 1. Compact Page Header */}
      <header className="sticky top-0 z-10 bg-background border-b px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">
            BB
          </div>
          <h1 className="text-xl font-bold">مركز الموارد البشرية</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <Select defaultValue="all">
            <SelectTrigger className="w-[180px] bg-muted/50 border-0 h-9">
              <SelectValue placeholder="اختيار الفرع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفروع</SelectItem>
              <SelectItem value="riyadh">الرياض</SelectItem>
              <SelectItem value="medina">المدينة المنورة</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        
        {/* 2. Summary Strip */}
        <div className="bg-background rounded-xl p-4 shadow-sm border flex items-center justify-between gap-6 overflow-x-auto">
          <div className="flex items-center gap-3 px-4 shrink-0">
            <div className="bg-emerald-100 p-2 rounded-full">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">نشطون</p>
              <p className="font-bold text-lg leading-none">180</p>
            </div>
          </div>
          <div className="w-px h-10 bg-border shrink-0"></div>
          <div className="flex items-center gap-3 px-4 shrink-0">
            <div className="bg-blue-100 p-2 rounded-full">
              <Banknote className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">فاتورة الرواتب</p>
              <p className="font-bold text-lg leading-none">612,450 <span className="text-xs font-normal">ر.س</span></p>
            </div>
          </div>
          <div className="w-px h-10 bg-border shrink-0"></div>
          <div className="flex items-center gap-3 px-4 shrink-0">
            <div className="bg-indigo-100 p-2 rounded-full">
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">حضور اليوم</p>
              <p className="font-bold text-lg leading-none">76%</p>
            </div>
          </div>
          <div className="w-px h-10 bg-border shrink-0"></div>
          <div className="flex items-center gap-3 px-4 shrink-0">
            <div className="bg-rose-100 p-2 rounded-full">
              <AlertCircle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">تنبيهات عاجلة</p>
              <p className="font-bold text-lg leading-none text-rose-600">3</p>
            </div>
          </div>
        </div>

        {/* 3. Main Tabs */}
        <Tabs defaultValue="overview" dir="rtl" className="w-full">
          <TabsList className="w-full justify-start h-auto p-1 bg-background border rounded-xl mb-8">
            <TabsTrigger value="overview" className="px-6 py-3 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm text-base">
              نظرة عامة
            </TabsTrigger>
            <TabsTrigger value="employees" className="px-6 py-3 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm text-base">
              الموظفون والفروع
            </TabsTrigger>
            <TabsTrigger value="attendance" className="px-6 py-3 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm text-base">
              الحضور والرواتب
            </TabsTrigger>
            <TabsTrigger value="hiring" className="px-6 py-3 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm text-base">
              التوظيف والمستندات
            </TabsTrigger>
            <TabsTrigger value="actions" className="px-6 py-3 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm text-base">
              الإجراءات السريعة
            </TabsTrigger>
          </TabsList>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 m-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPI title="الموظفون النشطون" value="180" icon={Users} />
                <KPI title="غير نشطون / موقوفون" value="22" icon={UserPlus} alert />
                <KPI title="الفروع النشطة" value="6" icon={Building2} />
                <KPI title="متوسط الراتب" value="2,218" subValue="ر.س" icon={Banknote} />
              </div>

              <Card className="border-indigo-100 bg-indigo-50/30 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500"></div>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-indigo-900">
                    <Lightbulb className="w-5 h-5 text-indigo-600" />
                    المساعد الذكي (رؤى)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-4 items-start p-3 bg-white rounded-lg shadow-sm border border-indigo-100/50">
                      <div className="mt-0.5 p-1.5 bg-rose-100 rounded text-rose-600"><AlertCircle className="w-4 h-4"/></div>
                      <div>
                        <p className="font-medium">نسبة الحضور اليوم 51% (منخفضة)</p>
                        <p className="text-sm text-muted-foreground">حاضر 50, غائب 0, متأخر 48.</p>
                      </div>
                    </div>
                    <div className="flex gap-4 items-start p-3 bg-white rounded-lg shadow-sm border border-indigo-100/50">
                      <div className="mt-0.5 p-1.5 bg-amber-100 rounded text-amber-600"><Briefcase className="w-4 h-4"/></div>
                      <div>
                        <p className="font-medium">5 طلبات توظيف بانتظار المراجعة</p>
                        <p className="text-sm text-muted-foreground">مضى عليها أكثر من أسبوع.</p>
                      </div>
                    </div>
                    <div className="flex gap-4 items-start p-3 bg-white rounded-lg shadow-sm border border-indigo-100/50">
                      <div className="mt-0.5 p-1.5 bg-blue-100 rounded text-blue-600"><UserPlus className="w-4 h-4"/></div>
                      <div>
                        <p className="font-medium">1 عرض عمل بانتظار رد المرشحين</p>
                        <p className="text-sm text-muted-foreground">يُنصح بمتابعة العروض.</p>
                      </div>
                    </div>
                    <div className="flex gap-4 items-start p-3 bg-white rounded-lg shadow-sm border border-indigo-100/50">
                      <div className="mt-0.5 p-1.5 bg-indigo-100 rounded text-indigo-600"><Users className="w-4 h-4"/></div>
                      <div>
                        <p className="font-medium">نسبة الموظفين النشطين أقل من 85%</p>
                        <p className="text-sm text-muted-foreground">يوجد 96 موظف غير نشط أو موقوف.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Employees & Branches Tab */}
            <TabsContent value="employees" className="space-y-6 m-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">التوزيع حسب الفرع</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={branchData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {branchData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">التوزيع حسب المسمى الوظيفي</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={jobData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {jobData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">التوزيع حسب الجنسية</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={nationalityData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {nationalityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPI title="مباشرة عمل قيد التنفيذ" value="3" icon={Briefcase} />
                <KPI title="موظفون غير نشطين" value="22" icon={Users} />
                <KPI title="حسابات نهاية الخدمة" value="4" icon={Banknote} />
              </div>
            </TabsContent>

            {/* Attendance & Payroll Tab */}
            <TabsContent value="attendance" className="space-y-6 m-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <KPI title="حضور اليوم" value="138/180" subValue="76%" icon={Clock} />
                    <KPI title="سلف مسجّلة" value="12" icon={Banknote} />
                    <KPI title="طلبات إجازات معلّقة" value="7" icon={CalendarIcon} />
                    <KPI title="إنذارات سارية" value="3" icon={AlertCircle} alert />
                  </div>
                </div>

                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-lg flex justify-between items-center">
                      إغلاق الراتب الشهري
                      <Badge variant="outline" className="font-normal text-xs">ديسمبر 2023</Badge>
                    </CardTitle>
                    <CardDescription>حالة فروع الشركة لإغلاق مسير الرواتب</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">التقدم العام</span>
                        <span className="font-bold">2/6 فروع مغلقة</span>
                      </div>
                      <Progress value={33} className="h-2 bg-muted" />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50/50 border">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-gray-300"></div>
                          <span className="text-sm">لم يبدأ</span>
                        </div>
                        <span className="font-bold">1</span>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-lg bg-blue-50 border border-blue-100">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                          <span className="text-sm">مفتوح (قيد المراجعة)</span>
                        </div>
                        <span className="font-bold text-blue-700">3</span>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                          <span className="text-sm">مغلق</span>
                        </div>
                        <span className="font-bold text-emerald-700">2</span>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-lg bg-slate-100 border opacity-60">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                          <span className="text-sm">مقفل (نهائي)</span>
                        </div>
                        <span className="font-bold">0</span>
                      </div>
                    </div>
                    
                    <Button className="w-full">إدارة مسير الرواتب</Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Hiring & Docs Tab */}
            <TabsContent value="hiring" className="space-y-6 m-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPI title="طلبات توظيف معلّقة" value="5" icon={UserPlus} />
                <KPI title="عروض عمل بانتظار رد" value="1" icon={MessageSquare} />
                <KPI title="وثائق منتهية/قاربت" value="14" icon={FileWarning} alert />
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>متابعة الوثائق</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center p-12 text-muted-foreground border-2 border-dashed rounded-lg">
                    <p>سيتم عرض جدول الوثائق المنتهية قريباً هنا</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Quick Actions Tab */}
            <TabsContent value="actions" className="space-y-8 m-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                <Card className="lg:col-span-1 border-primary/20 shadow-sm">
                  <CardHeader className="bg-primary/5 pb-4 border-b">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-primary" />
                      إرسال واتساب جماعي
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <Label>المستلمون</Label>
                      <Select defaultValue="all">
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الفئة المستهدفة" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">جميع الموظفين النشطين (180)</SelectItem>
                          <SelectItem value="managers">مدراء الفروع (6)</SelectItem>
                          <SelectItem value="barista">الباريستا (36)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>الرسالة</Label>
                      <Textarea placeholder="اكتب رسالتك هنا..." className="min-h-[120px] resize-none" />
                    </div>
                    <Button className="w-full gap-2">
                      <Send className="w-4 h-4" />
                      إرسال (180 مستلم)
                    </Button>
                  </CardContent>
                </Card>

                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-lg font-bold px-1">بوابات الوصول السريع</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    <QuickTile icon={Users} title="موظفو الفروع" />
                    <QuickTile icon={Clock} title="الحضور والورديات" />
                    <QuickTile icon={Banknote} title="تقارير الرواتب" />
                    <QuickTile icon={UserPlus} title="طلبات التوظيف" />
                    <QuickTile icon={CheckCircle2} title="إدارة الحوافز" />
                    <QuickTile icon={Briefcase} title="الهيكل التنظيمي" />
                    <QuickTile icon={Users} title="موظفو التشغيل" />
                    <QuickTile icon={AlertCircle} title="المستقيلون" />
                    <QuickTile icon={Bell} title="إعدادات البصمة" />
                    <QuickTile icon={FileWarning} title="وثائق الموظفين" />
                    <QuickTile icon={MessageSquare} title="مركز الإشعارات" />
                    <QuickTile icon={Map} title="مخطط أرضية الفرع" />
                  </div>
                </div>

              </div>
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}

// Inline badge component for simple usage without full shadcn definition if missing
function Badge({ children, variant = "default", className = "" }: any) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  const variants: any = {
    default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    outline: "text-foreground"
  };
  return <div className={`${base} ${variants[variant]} ${className}`}>{children}</div>;
}
