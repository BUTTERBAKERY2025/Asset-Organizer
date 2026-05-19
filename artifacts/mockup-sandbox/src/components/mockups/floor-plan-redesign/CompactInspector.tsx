import React, { useState } from 'react';
import { 
  Crown, Shield, Calculator, Utensils, ChefHat, Coffee, 
  Cake, Handshake, ClipboardList, Sparkles, 
  ZoomIn, ZoomOut, Maximize, Grid, Magnet, Lock, 
  Undo, Redo, Hand, Search, Save, Printer, History, 
  LayoutTemplate, Wand2, MessageCircle, Plus, X, ChevronLeft, MoreHorizontal, UserPlus, SlidersHorizontal, MousePointer2,
  FileDown, LayoutGrid, AlertCircle, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import './_group.css';

// Mock Data
const ROLES = {
  manager: { id: 'manager', label: 'مدير الفرع', color: '#7c3aed', icon: Crown, shape: 'hexagon' },
  supervisor: { id: 'supervisor', label: 'مشرف', color: '#0ea5e9', icon: Shield, shape: 'hexagon' },
  cashier: { id: 'cashier', label: 'كاشير', color: '#059669', icon: Calculator, shape: 'circle' },
  waiter: { id: 'waiter', label: 'ويتر', color: '#d97706', icon: Utensils, shape: 'circle' },
  chef: { id: 'chef', label: 'شيف', color: '#dc2626', icon: ChefHat, shape: 'square' },
  barista: { id: 'barista', label: 'باريستا', color: '#92400e', icon: Coffee, shape: 'circle' },
  pastry: { id: 'pastry', label: 'حلواني', color: '#ec4899', icon: Cake, shape: 'square' },
  host: { id: 'host', label: 'مضيف', color: '#0891b2', icon: Handshake, shape: 'circle' },
  prep: { id: 'prep', label: 'محضر طلبات', color: '#16a34a', icon: ClipboardList, shape: 'circle' },
  cleaner: { id: 'cleaner', label: 'عامل نظافة', color: '#64748b', icon: Sparkles, shape: 'circle' },
};

const EMPLOYEES = [
  { id: '1', name: 'محمد العتيبي', roleId: 'manager' },
  { id: '2', name: 'أحمد القحطاني', roleId: 'supervisor' },
  { id: '3', name: 'خالد الشهري', roleId: 'cashier' },
  { id: '4', name: 'فهد الحربي', roleId: 'waiter' },
  { id: '5', name: 'سعد المالكي', roleId: 'waiter' },
  { id: '6', name: 'نوف الزهراني', roleId: 'barista' },
  { id: '7', name: 'ريم الدوسري', roleId: 'barista' },
  { id: '8', name: 'لمى السبيعي', roleId: 'pastry' },
  { id: '9', name: 'عبدالله الغامدي', roleId: 'chef' },
  { id: '10', name: 'ماجد البلوي', roleId: 'prep' },
  { id: '11', name: 'ياسر الشمري', roleId: 'cleaner' },
];

const ZONES = [
  { id: 'z1', name: 'بار القهوة', x: 100, y: 150, w: 280, h: 220, employeeIds: ['6', '7'] },
  { id: 'z2', name: 'الكاشير', x: 420, y: 150, w: 200, h: 120, employeeIds: ['3'] },
  { id: 'z3', name: 'صالة الطعام', x: 100, y: 400, w: 520, h: 280, employeeIds: ['4', '5'] },
  { id: 'z4', name: 'المطبخ', x: 680, y: 150, w: 300, h: 320, employeeIds: ['9', '10'] },
  { id: 'z5', name: 'بار البيكري', x: 680, y: 500, w: 300, h: 180, employeeIds: ['8'] },
  { id: 'z6', name: 'الاستقبال', x: 420, y: 300, w: 200, h: 80, employeeIds: ['2'] },
];

export function CompactInspector() {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const selectedZone = ZONES.find((z) => z.id === selectedZoneId);
  const totalAssigned = ZONES.reduce((sum, z) => sum + z.employeeIds.length, 0);
  const missingByRole = [
    { role: 'باريستا', count: 2, color: '#92400e' },
    { role: 'كاشير', count: 1, color: '#059669' },
    { role: 'ويتر', count: 1, color: '#d97706' },
    { role: 'شيف', count: 1, color: '#dc2626' },
  ];

  return (
    <div className="butter-inspector-root relative w-full overflow-hidden flex flex-col" style={{ height: '860px' }} dir="rtl">
      
      {/* Top App Bar */}
      <header className="absolute top-4 left-4 right-4 z-20 butter-glass rounded-2xl h-16 flex items-center justify-between px-4">
        {/* Right side tools */}
        <div className="flex items-center gap-1.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-amber-600 hover:text-amber-700 hover:bg-amber-50"><Save className="w-5 h-5" /></Button></TooltipTrigger>
              <TooltipContent>حفظ</TooltipContent>
            </Tooltip>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Tooltip>
              <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-slate-600"><LayoutTemplate className="w-5 h-5" /></Button></TooltipTrigger>
              <TooltipContent>القوالب</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-purple-600 hover:text-purple-700 hover:bg-purple-50"><Wand2 className="w-5 h-5" /></Button></TooltipTrigger>
              <TooltipContent>ترتيب ذكي AI</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-green-600 hover:text-green-700 hover:bg-green-50"><MessageCircle className="w-5 h-5" /></Button></TooltipTrigger>
              <TooltipContent>بث واتساب</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-3 text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-semibold" onClick={() => window.print()}>
                  <FileDown className="w-4 h-4" />
                  <span className="text-xs">تصدير PDF</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>تصدير الخطة بصيغة PDF</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-slate-600"><Printer className="w-5 h-5" /></Button></TooltipTrigger>
              <TooltipContent>طباعة</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-slate-600"><History className="w-5 h-5" /></Button></TooltipTrigger>
              <TooltipContent>السجل</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Center: Shift Switcher */}
        <Tabs defaultValue="morning" className="w-[300px]" dir="rtl">
          <TabsList className="grid w-full grid-cols-3 h-10 bg-slate-100/50 p-1">
            <TabsTrigger value="morning" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-amber-600">صباحي</TabsTrigger>
            <TabsTrigger value="evening" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">مسائي</TabsTrigger>
            <TabsTrigger value="night" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">ليلي</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Left side tools */}
        <div className="flex items-center gap-1.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 bg-slate-100 text-slate-800"><MousePointer2 className="w-4 h-4" /></Button></TooltipTrigger>
              <TooltipContent>تحديد</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500"><Hand className="w-4 h-4" /></Button></TooltipTrigger>
              <TooltipContent>تحريك</TooltipContent>
            </Tooltip>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Tooltip>
              <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500"><ZoomOut className="w-4 h-4" /></Button></TooltipTrigger>
              <TooltipContent>تصغير</TooltipContent>
            </Tooltip>
            <div className="text-xs font-medium text-slate-500 w-10 text-center">100%</div>
            <Tooltip>
              <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500"><ZoomIn className="w-4 h-4" /></Button></TooltipTrigger>
              <TooltipContent>تكبير</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500"><Maximize className="w-4 h-4" /></Button></TooltipTrigger>
              <TooltipContent>ملاءمة</TooltipContent>
            </Tooltip>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Tooltip>
              <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500"><Grid className="w-4 h-4" /></Button></TooltipTrigger>
              <TooltipContent>الشبكة</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      {/* Coverage Stats Badge (Top Left, below header) */}
      <div className="absolute top-24 left-4 z-10 butter-glass rounded-xl px-4 py-3 flex items-center gap-4">
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 font-medium">التغطية</span>
          <span className="text-sm font-bold text-slate-800">23/28 موظفين</span>
        </div>
        <Separator orientation="vertical" className="h-8" />
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 font-medium">نواقص</span>
          <span className="text-sm font-bold text-red-600">5 أدوار</span>
        </div>
      </div>

      {/* Canvas Area — leave room on the right for the always-visible inspector */}
      <main className="flex-1 h-full relative butter-canvas-pattern pt-24 pr-[336px]" onClick={() => setSelectedZoneId(null)}>
        {ZONES.map((zone) => (
          <div
            key={zone.id}
            onClick={(e) => { e.stopPropagation(); setSelectedZoneId(zone.id); }}
            className={`absolute canvas-zone bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3 cursor-pointer shadow-sm ${selectedZoneId === zone.id ? 'selected' : ''}`}
            style={{
              left: `${zone.x}px`,
              top: `${zone.y}px`,
              width: `${zone.w}px`,
              height: `${zone.h}px`,
            }}
          >
            <div className="flex justify-between items-start">
              <span className="font-bold text-slate-700">{zone.name}</span>
              <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-none">{zone.employeeIds.length} موظفين</Badge>
            </div>
            
            <div className="flex-1 flex flex-wrap gap-2 content-start">
              {zone.employeeIds.map((empId) => {
                const emp = EMPLOYEES.find(e => e.id === empId);
                if (!emp) return null;
                const role = ROLES[emp.roleId as keyof typeof ROLES];
                const Icon = role.icon;
                
                return (
                  <div key={emp.id} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-full pl-3 pr-1 py-1 shadow-sm">
                    <div 
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-white`}
                      style={{ backgroundColor: role.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{emp.name}</span>
                  </div>
                );
              })}
              
              <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer">
                <Plus className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </main>

      {/* Always-visible Inspector Panel — overview when nothing selected, zone details when a zone is clicked */}
      <aside
        className="absolute top-24 right-4 bottom-6 w-80 butter-glass rounded-2xl border border-slate-200/60 shadow-xl flex flex-col z-20"
      >
        {selectedZone ? (
          <>
            <div className="p-5 border-b border-slate-100/50 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <button onClick={() => setSelectedZoneId(null)} className="hover:text-amber-600 transition-colors">نظرة عامة</button>
                  <ChevronLeft className="w-3 h-3 rotate-180" />
                  <span>منطقة</span>
                </div>
                <h3 className="font-bold text-lg text-slate-800">{selectedZone.name}</h3>
                <p className="text-sm text-slate-500 mt-1">تفاصيل المنطقة والتغطية</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => setSelectedZoneId(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1 p-5" dir="rtl">
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-bold text-slate-700">الموظفين المعينين</h4>
                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">{selectedZone.employeeIds.length}</Badge>
                  </div>

                  <div className="space-y-2">
                    {selectedZone.employeeIds.map((empId) => {
                      const emp = EMPLOYEES.find(e => e.id === empId);
                      if (!emp) return null;
                      const role = ROLES[emp.roleId as keyof typeof ROLES];
                      const Icon = role.icon;

                      return (
                        <div key={emp.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50/80 transition-colors border border-transparent hover:border-slate-100 group">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm`}
                            style={{ backgroundColor: role.color }}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{emp.name}</p>
                            <p className="text-xs text-slate-500 truncate">{role.label}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  <Button variant="outline" className="w-full mt-3 bg-white/50 border-dashed text-slate-500 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50/50">
                    <UserPlus className="w-4 h-4 ml-2" />
                    تعيين موظف
                  </Button>
                </div>

                <Separator className="bg-slate-100/50" />

                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-3">إعدادات المنطقة</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                          <SlidersHorizontal className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">السعة القصوى</span>
                      </div>
                      <span className="text-sm font-bold text-slate-800">4 موظفين</span>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </>
        ) : (
          <>
            <div className="p-5 border-b border-slate-100/50">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                  <LayoutGrid className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-lg text-slate-800">نظرة عامة</h3>
              </div>
              <p className="text-sm text-slate-500">الوردية الصباحية · فرع الرياض</p>
            </div>

            <ScrollArea className="flex-1 p-5" dir="rtl">
              <div className="space-y-6">
                {/* Coverage progress */}
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <h4 className="text-sm font-bold text-slate-700">تغطية الوردية</h4>
                    <span className="text-2xl font-extrabold text-amber-600 tabular-nums">82%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-l from-amber-400 to-amber-500" style={{ width: '82%' }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 mt-2">
                    <span>{totalAssigned} موظف معيّن</span>
                    <span>من أصل 28</span>
                  </div>
                </div>

                <Separator className="bg-slate-100/50" />

                {/* Missing roles */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    <h4 className="text-sm font-bold text-slate-700">أدوار ناقصة</h4>
                    <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50 mr-auto">5</Badge>
                  </div>
                  <div className="space-y-2">
                    {missingByRole.map((m) => (
                      <div key={m.role} className="flex items-center gap-3 p-2.5 rounded-xl bg-rose-50/40 border border-rose-100/60">
                        <div className="w-8 h-8 rounded-full shrink-0" style={{ backgroundColor: m.color, opacity: 0.18 }} />
                        <span className="text-sm font-medium text-slate-700 flex-1">{m.role}</span>
                        <span className="text-sm font-bold text-rose-600 tabular-nums">×{m.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-slate-100/50" />

                {/* Zones list */}
                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-3">المناطق ({ZONES.length})</h4>
                  <div className="space-y-1.5">
                    {ZONES.map((z) => (
                      <button
                        key={z.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedZoneId(z.id); }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-amber-50/60 border border-transparent hover:border-amber-100 transition-colors text-right group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-amber-100 flex items-center justify-center text-slate-500 group-hover:text-amber-600 shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-700 flex-1 truncate">{z.name}</span>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none text-xs">
                          {z.employeeIds.length}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator className="bg-slate-100/50" />

                {/* Export */}
                <div className="space-y-2">
                  <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20" onClick={() => window.print()}>
                    <FileDown className="w-4 h-4 ml-2" />
                    تصدير الخطة (PDF)
                  </Button>
                  <Button variant="outline" className="w-full">
                    <MessageCircle className="w-4 h-4 ml-2" />
                    إرسال للموظفين (واتساب)
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </aside>

      {/* Floating Action Button (Bottom Left) */}
      <div className="absolute bottom-6 left-6 z-20">
        <Button size="icon" className="h-14 w-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 transition-transform hover:scale-105">
          <Plus className="w-6 h-6" />
        </Button>
      </div>

    </div>
  );
}
