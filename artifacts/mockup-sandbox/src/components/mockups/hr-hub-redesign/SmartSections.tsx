import React, { useState } from 'react';
import { 
  Users, UserCheck, Wallet, FileText, 
  AlertCircle, Clock, Info, CheckCircle2,
  TrendingUp, TrendingDown, Bell, MessageCircle,
  Briefcase, Activity, Calendar, FileWarning, 
  DollarSign, MapPin, Zap, ChevronLeft,
  PieChart as PieChartIcon, LayoutGrid, AlertTriangle, Send, Sparkles, Building2, UserX, FilePlus, AlertOctagon, Landmark, ShieldAlert, BadgeInfo, Search
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

// Data
const branchData = [
  { name: 'الرياض', value: 59 },
  { name: 'المدينة', value: 41 },
  { name: 'أبها الحزام', value: 36 },
  { name: 'أبها المطار', value: 34 },
  { name: 'محايل عسير', value: 22 },
  { name: 'السفارات', value: 19 },
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

const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'];
const COLORS_ALT = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'];
const COLORS_NAT = ['#7c3aed', '#059669', '#ea580c', '#e11d48', '#ca8a04', '#d97706'];

export function SmartSections() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        
        {/* Header */}
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">مركز الموارد البشرية</h1>
          <p className="text-muted-foreground text-lg">مرحباً بك، إليك ملخص أداء القوى العاملة لهذا اليوم.</p>
        </header>

        {/* Section 1: Today's Summary */}
        <section className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">ملخص اليوم</h2>
                <p className="text-sm text-muted-foreground">نظرة عامة على الأرقام الرئيسية الحالية</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-5 rounded-2xl bg-muted/30 border border-muted/50 hover:border-primary/20 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> مستقر
                  </span>
                </div>
                <h3 className="text-3xl font-bold mb-1">180</h3>
                <p className="text-muted-foreground text-sm font-medium">الموظفون النشطون</p>
              </div>

              <div className="p-5 rounded-2xl bg-muted/30 border border-muted/50 hover:border-primary/20 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-amber-600 bg-amber-500/10 px-2 py-1 rounded-md">
                    76% نسبة الحضور
                  </span>
                </div>
                <h3 className="text-3xl font-bold mb-1">138 <span className="text-lg text-muted-foreground font-normal">/ 180</span></h3>
                <p className="text-muted-foreground text-sm font-medium">حضور اليوم</p>
              </div>

              <div className="p-5 rounded-2xl bg-muted/30 border border-muted/50 hover:border-primary/20 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-rose-600 bg-rose-500/10 px-2 py-1 rounded-md">
                    تتطلب إجراء
                  </span>
                </div>
                <h3 className="text-3xl font-bold mb-1">5</h3>
                <p className="text-muted-foreground text-sm font-medium">طلبات توظيف معلّقة</p>
              </div>

              <div className="p-5 rounded-2xl bg-muted/30 border border-muted/50 hover:border-primary/20 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                    تقديري
                  </span>
                </div>
                <h3 className="text-3xl font-bold mb-1" dir="ltr">612,450 <span className="text-sm font-normal text-muted-foreground">SAR</span></h3>
                <p className="text-muted-foreground text-sm font-medium">فاتورة الرواتب الشهرية</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Smart Alerts */}
        <section className="bg-rose-50/30 dark:bg-rose-950/10 rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2.5 bg-rose-500/10 text-rose-600 rounded-xl">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">تنبيهات ذكية</h2>
                <p className="text-sm text-muted-foreground">ملخص ذكي للمهام والمخاطر التي تتطلب انتباهك</p>
              </div>
            </div>

            <div className="space-y-4">
              {[
                { title: '5 طلبات توظيف بانتظار المراجعة', detail: 'متأخرة منذ أسبوع تقريباً، يُنصح بمراجعتها بأسرع وقت.', icon: FileWarning, color: 'bg-amber-500', bg: 'bg-amber-500/5', text: 'text-amber-700' },
                { title: '1 عرض عمل بانتظار رد المرشحين', detail: 'تتطلب متابعة العروض للتأكد من حالة القبول أو الرفض.', icon: Briefcase, color: 'bg-blue-500', bg: 'bg-blue-500/5', text: 'text-blue-700' },
                { title: 'نسبة الموظفين النشطين أقل من 85%', detail: 'يوجد 96 موظف غير نشط مسجل في النظام.', icon: AlertOctagon, color: 'bg-rose-500', bg: 'bg-rose-500/5', text: 'text-rose-700' },
                { title: 'نسبة الحضور اليوم 51%', detail: 'حاضر 50، غائب 0، متأخر 48 (بيانات جزئية لليوم).', icon: Clock, color: 'bg-orange-500', bg: 'bg-orange-500/5', text: 'text-orange-700' },
                { title: 'متوسط الراتب العام', detail: 'يبلغ متوسط الرواتب حالياً 2,218 ر.س.', icon: Landmark, color: 'bg-emerald-500', bg: 'bg-emerald-500/5', text: 'text-emerald-700' },
              ].map((alert, i) => (
                <div key={i} className={`relative overflow-hidden bg-card border rounded-xl p-5 hover:shadow-md transition-shadow flex items-start sm:items-center gap-4 flex-col sm:flex-row`}>
                  <div className={`absolute right-0 top-0 bottom-0 w-1.5 ${alert.color}`}></div>
                  <div className={`p-3 rounded-full shrink-0 ${alert.bg} ${alert.text}`}>
                    <alert.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-base mb-1">{alert.title}</h4>
                    <p className="text-sm text-muted-foreground">{alert.detail}</p>
                  </div>
                  <button className="shrink-0 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-sm font-medium rounded-lg transition-colors">
                    عرض التفاصيل
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Workforce Distribution */}
        <section className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-600 rounded-xl">
                <PieChartIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">توزيع القوى العاملة</h2>
                <p className="text-sm text-muted-foreground">تحليل ديموغرافي ووظيفي لموظفي الشركة</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="bg-muted/20 border rounded-2xl p-6 flex flex-col items-center">
                <h3 className="font-bold mb-6 w-full text-center">التوزيع حسب الفرع</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={branchData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                        {branchData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full space-y-2 mt-4">
                  {branchData.slice(0,3).map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }}></div>
                        <span>{item.name}</span>
                      </div>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-muted/20 border rounded-2xl p-6 flex flex-col items-center">
                <h3 className="font-bold mb-6 w-full text-center">التوزيع حسب المسمى الوظيفي</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={jobData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                        {jobData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS_ALT[index % COLORS_ALT.length]} />)}
                      </Pie>
                      <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full space-y-2 mt-4">
                  {jobData.slice(0,3).map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS_ALT[i] }}></div>
                        <span>{item.name}</span>
                      </div>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-muted/20 border rounded-2xl p-6 flex flex-col items-center">
                <h3 className="font-bold mb-6 w-full text-center">التوزيع حسب الجنسية</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={nationalityData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                        {nationalityData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS_NAT[index % COLORS_NAT.length]} />)}
                      </Pie>
                      <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full space-y-2 mt-4">
                  {nationalityData.slice(0,3).map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS_NAT[i] }}></div>
                        <span>{item.name}</span>
                      </div>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full font-medium text-sm">
                <Users className="w-4 h-4" /> إجمالي الموظفين المسجلين: 276 موظف
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Actions & Tools */}
        <section className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">الإجراءات والأدوات</h2>
                <p className="text-sm text-muted-foreground">أدوات تشغيلية وإدارية سريعة</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Tool 1 */}
              <div className="border rounded-2xl p-6 bg-card flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-lg">إغلاق الراتب الشهري</h3>
                </div>
                
                <div className="flex-1 space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">التقدم العام</span>
                      <span className="font-bold">65%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500 w-[65%]"></div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-center text-sm">
                    <div className="bg-muted/40 p-2 rounded-lg border">
                      <div className="text-muted-foreground mb-1 text-xs">مفتوح</div>
                      <div className="font-bold text-lg">3</div>
                    </div>
                    <div className="bg-muted/40 p-2 rounded-lg border">
                      <div className="text-muted-foreground mb-1 text-xs">مغلق</div>
                      <div className="font-bold text-lg">2</div>
                    </div>
                    <div className="bg-muted/40 p-2 rounded-lg border">
                      <div className="text-muted-foreground mb-1 text-xs">مقفل</div>
                      <div className="font-bold text-lg text-emerald-600">4</div>
                    </div>
                    <div className="bg-muted/40 p-2 rounded-lg border">
                      <div className="text-muted-foreground mb-1 text-xs">لم يبدأ</div>
                      <div className="font-bold text-lg text-rose-600">1</div>
                    </div>
                  </div>
                </div>
                
                <button className="w-full mt-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors">
                  إدارة الرواتب
                </button>
              </div>

              {/* Tool 2 */}
              <div className="border rounded-2xl p-6 bg-card flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-500/10 text-green-600 rounded-lg">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-lg">إرسال واتساب جماعي</h3>
                </div>
                
                <div className="flex-1 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">المستلمون</label>
                    <select className="w-full p-2.5 bg-background border rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                      <option>جميع الموظفين النشطين (180)</option>
                      <option>مدراء الفروع فقط (6)</option>
                      <option>موظفي فرع الرياض (59)</option>
                    </select>
                  </div>
                  
                  <div className="space-y-1.5 flex-1">
                    <label className="text-sm font-medium text-muted-foreground">الرسالة</label>
                    <textarea 
                      className="w-full p-3 bg-background border rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none h-24"
                      placeholder="اكتب رسالتك هنا..."
                      defaultValue="تذكير: يرجى التأكد من تسجيل الانصراف في نظام البصمة..."
                    ></textarea>
                  </div>
                </div>
                
                <button className="w-full mt-6 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" /> إرسال الرسالة
                </button>
              </div>

              {/* Tool 3 */}
              <div className="border rounded-2xl p-6 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-purple-500/10 text-purple-600 rounded-lg">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-lg">المساعد الذكي</h3>
                </div>
                
                <div className="flex-1 space-y-3">
                  <div className="bg-background/80 backdrop-blur-sm p-3.5 border border-purple-100 dark:border-purple-900 rounded-xl text-sm leading-relaxed">
                    <span className="font-bold text-purple-700 dark:text-purple-400">اقتراح:</span> تزايدت نسبة التأخير في فرع الرياض هذا الأسبوع. يُنصح بمراجعة جدول الورديات أو إرسال تنبيه للمدير.
                  </div>
                  <div className="bg-background/80 backdrop-blur-sm p-3.5 border border-purple-100 dark:border-purple-900 rounded-xl text-sm leading-relaxed">
                    <span className="font-bold text-purple-700 dark:text-purple-400">تذكير:</span> 14 وثيقة منتهية أو قاربت على الانتهاء. اضغط لتجديدها لتجنب الغرامات.
                  </div>
                </div>
                
                <button className="w-full mt-6 py-2.5 bg-background border-2 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400 rounded-xl font-medium hover:bg-purple-50 dark:hover:bg-purple-900/50 transition-colors">
                  فتح المساعد الكامل
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Detailed Metrics */}
        <section className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2.5 bg-slate-500/10 text-slate-600 rounded-xl">
                <LayoutGrid className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">مؤشرات تفصيلية</h2>
                <p className="text-sm text-muted-foreground">نظرة أعمق على البيانات التشغيلية والموارد البشرية</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'غير نشطون', value: '22', icon: UserX, color: 'text-rose-600' },
                { label: 'عروض بانتظار رد', value: '1', icon: FilePlus, color: 'text-blue-600' },
                { label: 'مباشرة قيد التنفيذ', value: '3', icon: Clock, color: 'text-amber-600' },
                { label: 'وثائق منتهية/قاربت', value: '14', icon: FileWarning, color: 'text-rose-600' },
                { label: 'طلبات إجازات معلّقة', value: '7', icon: Calendar, color: 'text-orange-600' },
                { label: 'إنذارات سارية', value: '3', icon: AlertTriangle, color: 'text-rose-600' },
                { label: 'سلف مسجّلة', value: '12', icon: DollarSign, color: 'text-indigo-600' },
                { label: 'حسابات نهاية الخدمة', value: '4', icon: Landmark, color: 'text-slate-600' },
                { label: 'الفروع النشطة', value: '6', icon: Building2, color: 'text-emerald-600' },
              ].map((metric, i) => (
                <div key={i} className="bg-muted/20 border border-muted p-4 rounded-xl flex flex-col items-center justify-center text-center hover:bg-muted/40 transition-colors">
                  <metric.icon className={`w-6 h-6 mb-3 opacity-80 ${metric.color}`} />
                  <span className="text-2xl font-bold mb-1">{metric.value}</span>
                  <span className="text-xs text-muted-foreground font-medium">{metric.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 6: Quick Navigation */}
        <section className="bg-card rounded-2xl border shadow-sm overflow-hidden mb-12">
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2.5 bg-cyan-500/10 text-cyan-600 rounded-xl">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">الوصول السريع</h2>
                <p className="text-sm text-muted-foreground">انتقال مباشر للأنظمة الفرعية والصفحات</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                'موظفو الفروع', 'الحضور والورديات', 'تقارير الرواتب', 
                'طلبات التوظيف', 'إدارة الحوافز', 'الهيكل التنظيمي', 
                'موظفو التشغيل', 'المستقيلون', 'إعدادات البصمة', 
                'وثائق الموظفين', 'مركز الإشعارات', 'مخطط أرضية الفرع'
              ].map((nav, i) => (
                <button key={i} className="flex flex-col items-center justify-center text-center p-4 border rounded-xl hover:border-primary hover:bg-primary/5 transition-all group">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <ChevronLeft className="w-5 h-5 opacity-50 rotate-180" />
                  </div>
                  <span className="text-sm font-medium">{nav}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
