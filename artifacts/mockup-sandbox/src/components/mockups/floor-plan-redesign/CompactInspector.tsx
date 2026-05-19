import React, { useState } from 'react';
import { 
  Crown, Shield, Calculator, Utensils, ChefHat, Coffee, 
  Cake, Handshake, ClipboardList, Sparkles, 
  ZoomIn, ZoomOut, Maximize, Grid, Magnet, Lock, 
  Undo, Redo, Hand, Search, Save, Printer, History, 
  LayoutTemplate, Wand2, MessageCircle, Plus, X, ChevronLeft, MoreHorizontal, UserPlus, SlidersHorizontal, MousePointer2
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

      {/* Canvas Area */}
      <main className="flex-1 w-full h-full relative butter-canvas-pattern pt-24" onClick={() => setSelectedZoneId(null)}>
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

      {/* Floating Inspector Panel */}
      <div 
        className={`absolute top-24 right-4 bottom-24 w-80 butter-glass rounded-2xl border border-slate-200/60 shadow-xl transition-all duration-300 ease-out transform ${
          selectedZoneId ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0 pointer-events-none'
        } flex flex-col z-20`}
      >
        {selectedZone && (
          <>
            <div className="p-5 border-b border-slate-100/50 flex justify-between items-start">
              <div>
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
        )}
      </div>

      {/* Floating Action Button (Bottom Left) */}
      <div className="absolute bottom-6 left-6 z-20">
        <Button size="icon" className="h-14 w-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 transition-transform hover:scale-105">
          <Plus className="w-6 h-6" />
        </Button>
      </div>

    </div>
  );
}
