import React, { useState } from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Users, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  MessageSquare, 
  Send, 
  FileText, 
  UserX, 
  CalendarRange,
  Building2,
  FileWarning,
  DollarSign,
  Briefcase,
  AlertTriangle,
  Award,
  Network,
  LogOut,
  Fingerprint,
  Map,
  Bell
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

// Data definitions
const branchData = [
  { name: 'الرياض', value: 59 },
  { name: 'المدينة المنورة', value: 41 },
  { name: 'أبها الحزام', value: 36 },
  { name: 'أبها المطار', value: 34 },
  { name: 'محايل عسير', value: 22 },
  { name: 'الرياض - السفارات', value: 19 },
];

const titleData = [
  { name: 'عامل نظافة', value: 67 },
  { name: 'باريستا', value: 36 },
  { name: 'كاشير', value: 34 },
  { name: 'شيف بيتزا', value: 14 },
  { name: 'خباز', value: 13 },
  { name: 'سندوتشات-فطور', value: 12 },
];

const nationalityData = [
  { name: 'بنغلاديشي', value: 107 },
  { name: 'سعودي', value: 52 },
  { name: 'مصري', value: 38 },
  { name: 'فلبيني', value: 10 },
  { name: 'تونسي', value: 9 },
  { name: 'نيبالي', value: 9 },
];

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#6366f1'];

export function CommandCenter() {
  const [whatsappMessage, setWhatsappMessage] = useState('');

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground font-sans" style={{ fontFamily: 'Cairo, sans-serif' }}>
      {/* 1. Hero Alert Strip */}
      <div className="bg-rose-500/10 border-b border-rose-500/20 text-rose-900 dark:text-rose-400 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
            <span className="font-semibold text-sm">تنبيهات عاجلة:</span>
            <span className="text-sm">يوجد 14 وثيقة منتهية/قاربت، و 7 طلبات إجازة معلّقة تتطلب الاعتماد.</span>
          </div>
          <div className="flex gap-2">
            <button className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-1.5 rounded-full text-xs font-medium transition-colors">
              مراجعة الوثائق
            </button>
            <button className="bg-white dark:bg-rose-950 text-rose-700 dark:text-rose-300 px-4 py-1.5 rounded-full text-xs font-medium transition-colors border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-900">
              اعتماد الإجازات
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">مركز القيادة التنفيذي</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">نظرة شاملة ومباشرة لعمليات الموارد البشرية</p>
          </div>
          <div className="text-sm font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            تحديث مباشر
          </div>
        </div>

        {/* 2. Big Headline KPIs Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                <Users className="w-6 h-6" />
              </div>
              <span className="flex items-center gap-1 text-sm font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-md">
                <TrendingUp className="w-3 h-3" />
                +2%
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">الموظفون النشطون</p>
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white">180</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Wallet className="w-6 h-6" />
              </div>
              <span className="flex items-center gap-1 text-sm font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-md">
                <TrendingUp className="w-3 h-3" />
                منتظم
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">فاتورة الرواتب الشهرية</p>
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white">612,450 <span className="text-base font-normal text-slate-500">ر.س</span></h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                <Clock className="w-6 h-6" />
              </div>
              <span className="flex items-center gap-1 text-sm font-medium text-rose-600 bg-rose-50 dark:bg-rose-900/30 px-2 py-1 rounded-md">
                <TrendingDown className="w-3 h-3" />
                -4%
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">حضور اليوم (76%)</p>
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white">138 <span className="text-base font-normal text-slate-500">/ 180</span></h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400">
                <Briefcase className="w-6 h-6" />
              </div>
              <span className="flex items-center gap-1 text-sm font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-md">
                عاجل
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">طلبات توظيف معلّقة</p>
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white">5</h3>
            </div>
          </div>
        </div>

        {/* 3. Two-Column Work Zone */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Alerts & Urgent Tasks (Right in RTL, Left visually) */}
          <div className="lg:col-span-8 flex flex-col space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-indigo-500" />
              تنبيهات ومهام ذكية
            </h2>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex-1">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                
                <div className="p-5 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg shrink-0 mt-0.5">
                    <UserX className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm">انخفاض نسبة الموظفين النشطين</h4>
                      <span className="text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 rounded-full">حرج</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">النسبة أقل من 85% (يوجد 96 موظف غير نشط). يجب مراجعة حالات الإيقاف.</p>
                    <button className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline">عرض قائمة الموقوفين &larr;</button>
                  </div>
                </div>

                <div className="p-5 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg shrink-0 mt-0.5">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm">طلبات توظيف بانتظار المراجعة</h4>
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">تحذير</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">يوجد 5 طلبات توظيف معلقة منذ أكثر من أسبوع.</p>
                    <button className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline">مراجعة الطلبات &larr;</button>
                  </div>
                </div>

                <div className="p-5 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg shrink-0 mt-0.5">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm">انخفاض ملحوظ في الحضور اليوم</h4>
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">معلومة</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">نسبة الحضور 51% (حاضر 50، غائب 0، متأخر 48).</p>
                    <button className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline">عرض تقرير الحضور &larr;</button>
                  </div>
                </div>

                <div className="p-5 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0 mt-0.5">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm">عروض عمل بانتظار الرد</h4>
                      <span className="text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">متابعة</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">يوجد 1 عرض عمل بانتظار رد المرشحين.</p>
                    <button className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline">متابعة العروض &larr;</button>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Quick Actions (Left in RTL, Right visually) */}
          <div className="lg:col-span-4 flex flex-col space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              إجراءات سريعة
            </h2>
            
            <div className="flex flex-col gap-4 h-full">
              {/* WhatsApp Widget */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white">إرسال واتساب جماعي</h3>
                </div>
                
                <div className="space-y-3">
                  <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option>المستلمون: جميع مدراء الفروع</option>
                    <option>المستلمون: جميع الموظفين النشطين</option>
                    <option>المستلمون: الموظفون المتأخرون اليوم</option>
                  </select>
                  <textarea 
                    rows={3} 
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    placeholder="اكتب رسالتك هنا..."
                    value={whatsappMessage}
                    onChange={(e) => setWhatsappMessage(e.target.value)}
                  />
                  <button className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                    <Send className="w-4 h-4" />
                    إرسال الرسالة
                  </button>
                </div>
              </div>

              {/* Salary Closing Widget */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white">إغلاق الراتب الشهري</h3>
                  </div>
                  <span className="text-xs font-bold text-slate-500">أغسطس 2023</span>
                </div>

                <div className="space-y-4">
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden flex">
                    <div className="bg-slate-300 h-full" style={{ width: '15%' }} title="لم يبدأ"></div>
                    <div className="bg-amber-400 h-full" style={{ width: '25%' }} title="مفتوح"></div>
                    <div className="bg-blue-500 h-full" style={{ width: '40%' }} title="مغلق"></div>
                    <div className="bg-emerald-500 h-full" style={{ width: '20%' }} title="مقفل"></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                      <span className="text-slate-600 dark:text-slate-400">لم يبدأ: 15%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                      <span className="text-slate-600 dark:text-slate-400">مفتوح: 25%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-slate-600 dark:text-slate-400">مغلق: 40%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      <span className="text-slate-600 dark:text-slate-400">مقفل: 20%</span>
                    </div>
                  </div>

                  <button className="w-full bg-slate-900 dark:bg-slate-50 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-lg px-4 py-2 text-sm font-semibold transition-colors mt-2">
                    إدارة إغلاق الرواتب
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <hr className="border-slate-200 dark:border-slate-800" />

        {/* 4. Analytics Section */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">التحليلات والتوزيعات</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Chart 1: Branches */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm h-80 flex flex-col">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-4 text-center">التوزيع حسب الفرع</h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={branchData} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                      {branchData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-4">
                {branchData.slice(0,4).map((entry, index) => (
                  <div key={index} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="truncate">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 2: Job Titles */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm h-80 flex flex-col">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-4 text-center">التوزيع حسب المسمى الوظيفي</h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={titleData} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                      {titleData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-4">
                {titleData.slice(0,4).map((entry, index) => (
                  <div key={index} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="truncate">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 3: Nationalities */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm h-80 flex flex-col">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-4 text-center">التوزيع حسب الجنسية</h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={nationalityData} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                      {nationalityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-4">
                {nationalityData.slice(0,4).map((entry, index) => (
                  <div key={index} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="truncate">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 5. Compact Secondary KPIs Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white px-1">مؤشرات إضافية</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'غير نشطون/موقوفون', value: '22', icon: UserX, color: 'text-rose-500' },
              { label: 'مباشرة عمل قيد التنفيذ', value: '3', icon: Briefcase, color: 'text-blue-500' },
              { label: 'عروض عمل بانتظار رد', value: '1', icon: FileText, color: 'text-emerald-500' },
              { label: 'وثائق منتهية/قاربت', value: '14', icon: FileWarning, color: 'text-amber-500' },
              { label: 'طلبات إجازات معلّقة', value: '7', icon: CalendarRange, color: 'text-amber-500' },
              { label: 'إنذارات سارية', value: '3', icon: AlertTriangle, color: 'text-rose-500' },
              { label: 'سلف مسجّلة', value: '12', icon: DollarSign, color: 'text-indigo-500' },
              { label: 'حسابات نهاية الخدمة', value: '4', icon: Wallet, color: 'text-slate-500' },
              { label: 'فروع نشطة', value: '6', icon: Building2, color: 'text-emerald-500' },
              { label: 'متوسط الراتب', value: '2,218 ر.س', icon: TrendingUp, color: 'text-blue-500' },
            ].map((kpi, idx) => (
              <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 flex flex-col justify-center items-center text-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <kpi.icon className={`w-5 h-5 mb-2 ${kpi.color}`} />
                <span className="text-xl font-bold text-slate-900 dark:text-white mb-1">{kpi.value}</span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{kpi.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Navigation Grid */}
        <div className="pt-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white px-1 mb-4">الوصول السريع</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: 'موظفو الفروع', icon: Users },
              { label: 'الحضور والورديات', icon: Clock },
              { label: 'تقارير الرواتب', icon: Wallet },
              { label: 'طلبات التوظيف', icon: Briefcase },
              { label: 'إدارة الحوافز', icon: Award },
              { label: 'الهيكل التنظيمي', icon: Network },
              { label: 'موظفو التشغيل', icon: Users },
              { label: 'المستقيلون', icon: LogOut },
              { label: 'إعدادات البصمة', icon: Fingerprint },
              { label: 'وثائق الموظفين', icon: FileText },
              { label: 'مركز الإشعارات', icon: Bell },
              { label: 'مخطط أرضية الفرع', icon: Map },
            ].map((item, idx) => (
              <button key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md hover:-translate-y-0.5 transition-all rounded-xl p-4 flex flex-col items-center justify-center gap-3 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">
                <item.icon className="w-6 h-6" />
                <span className="text-xs font-bold">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
