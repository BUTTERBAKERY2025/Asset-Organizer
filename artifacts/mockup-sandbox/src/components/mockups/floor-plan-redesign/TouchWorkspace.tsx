import React, { useState } from 'react';
import { 
  Sun, Sunset, Moon, Crown, Shield, Calculator, Utensils, 
  ChefHat, Coffee, Cake, Handshake, ClipboardList, Sparkles,
  Save, Printer, History, LayoutTemplate, Wand2, ZoomIn, 
  ZoomOut, Maximize, Grid, Magnet, Lock, Undo2, Redo2, 
  Hand, Search, Filter, MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import './_group.css';

const ROLES = {
  manager: { label: 'مدير الفرع', color: 'bg-violet-500', icon: Crown, shape: 'rounded-xl' },
  supervisor: { label: 'مشرف', color: 'bg-sky-500', icon: Shield, shape: 'rounded-xl' },
  cashier: { label: 'كاشير', color: 'bg-emerald-500', icon: Calculator, shape: 'rounded-full' },
  waiter: { label: 'ويتر', color: 'bg-amber-500', icon: Utensils, shape: 'rounded-full' },
  chef: { label: 'شيف', color: 'bg-red-500', icon: ChefHat, shape: 'rounded-lg' },
  barista: { label: 'باريستا', color: 'bg-amber-700', icon: Coffee, shape: 'rounded-full' },
  pastry: { label: 'حلواني', color: 'bg-pink-500', icon: Cake, shape: 'rounded-lg' },
  host: { label: 'مضيف', color: 'bg-cyan-500', icon: Handshake, shape: 'rounded-full' },
  prep: { label: 'محضر طلبات', color: 'bg-green-600', icon: ClipboardList, shape: 'rounded-full' },
  cleaner: { label: 'عامل نظافة', color: 'bg-slate-500', icon: Sparkles, shape: 'rounded-full' },
};

const EMPLOYEES = [
  { id: '1', name: 'محمد العتيبي', role: 'manager', assigned: true },
  { id: '2', name: 'أحمد القحطاني', role: 'supervisor', assigned: true },
  { id: '3', name: 'خالد الشهري', role: 'barista', assigned: true },
  { id: '4', name: 'فهد الحربي', role: 'barista', assigned: true },
  { id: '5', name: 'سعد المالكي', role: 'cashier', assigned: true },
  { id: '6', name: 'نوف الزهراني', role: 'waiter', assigned: true },
  { id: '7', name: 'ريم الدوسري', role: 'pastry', assigned: true },
  { id: '8', name: 'لمى السبيعي', role: 'host', assigned: true },
  { id: '9', name: 'عبدالله الغامدي', role: 'chef', assigned: true },
  { id: '10', name: 'ماجد البلوي', role: 'prep', assigned: true },
  { id: '11', name: 'سارة المطيري', role: 'cleaner', assigned: false },
  { id: '12', name: 'علي العنزي', role: 'waiter', assigned: false },
  { id: '13', name: 'منى الشمري', role: 'barista', assigned: false },
  { id: '14', name: 'حسن التميمي', role: 'cashier', assigned: false },
];

const ZONES = [
  { id: 'z1', name: 'بار القهوة', type: 'coffee', w: 300, h: 200, x: 50, y: 150, capacity: 4, assigned: ['3', '4', '13'], color: 'bg-amber-100', border: 'border-amber-200' },
  { id: 'z2', name: 'الكاشير', type: 'cashier', w: 180, h: 100, x: 50, y: 380, capacity: 2, assigned: ['5'], color: 'bg-emerald-50', border: 'border-emerald-200' },
  { id: 'z3', name: 'بار البيكري', type: 'bakery', w: 250, h: 150, x: 380, y: 150, capacity: 2, assigned: ['7'], color: 'bg-pink-50', border: 'border-pink-200' },
  { id: 'z4', name: 'المطبخ', type: 'kitchen', w: 300, h: 250, x: 660, y: 150, capacity: 5, assigned: ['9', '10'], color: 'bg-red-50', border: 'border-red-200' },
  { id: 'z5', name: 'صالة الطعام', type: 'dining', w: 400, h: 300, x: 260, y: 380, capacity: 6, assigned: ['6', '8'], color: 'bg-blue-50', border: 'border-blue-200' },
  { id: 'z6', name: 'الاستقبال', type: 'reception', w: 150, h: 150, x: 810, y: 450, capacity: 1, assigned: ['1'], color: 'bg-violet-50', border: 'border-violet-200' },
];

export function TouchWorkspace() {
  const [activeShift, setActiveShift] = useState('morning');
  const [activeFilter, setActiveFilter] = useState('all');

  return (
    <div dir="rtl" className="relative w-full h-[860px] bg-slate-50 overflow-hidden font-['Cairo'] flex flex-col">
      {/* Background Pattern */}
      <div className="absolute inset-0 butter-canvas-pattern opacity-50 pointer-events-none" />

      {/* Top Header & Shift Switcher */}
      <div className="relative z-10 p-6 flex justify-between items-start pointer-events-none">
        
        {/* Coverage Stats Badge */}
        <div className="flex gap-4 pointer-events-auto">
          <Card className="px-5 py-3 rounded-2xl flex items-center gap-4 bg-white/90 backdrop-blur border-slate-200 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 font-medium">حالة التغطية</span>
              <span className="text-lg font-bold text-slate-900 leading-tight">10 / 20</span>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg border-4 border-emerald-100">
              50%
            </div>
          </Card>
          
          {/* Missing roles warning */}
          <Card className="px-5 py-3 rounded-2xl flex items-center gap-3 bg-amber-50/90 backdrop-blur border-amber-200 shadow-sm">
             <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <Shield className="w-5 h-5" />
             </div>
             <div className="flex flex-col">
                <span className="text-sm font-bold text-amber-900 leading-tight">3 وظائف ناقصة</span>
                <span className="text-xs text-amber-700">الكاشير، بار القهوة</span>
             </div>
          </Card>
        </div>

        {/* Big Chunky Shift Tabs */}
        <div className="bg-white/90 backdrop-blur p-2 rounded-3xl border border-slate-200 shadow-lg flex gap-2 pointer-events-auto">
          {[
            { id: 'morning', label: 'صباحي', icon: Sun, time: '06:00 - 14:00', count: 12 },
            { id: 'evening', label: 'مسائي', icon: Sunset, time: '14:00 - 22:00', count: 15 },
            { id: 'night', label: 'ليلي', icon: Moon, time: '22:00 - 06:00', count: 8 },
          ].map(shift => {
            const isActive = activeShift === shift.id;
            const Icon = shift.icon;
            return (
              <button
                key={shift.id}
                onClick={() => setActiveShift(shift.id)}
                className={cn(
                  "relative flex flex-col items-center justify-center px-8 py-4 rounded-2xl transition-all duration-300 min-w-[140px]",
                  isActive ? "bg-[hsl(42,87%,55%)] text-white shadow-md shadow-amber-500/20 scale-100" : "hover:bg-slate-100 text-slate-500 scale-95"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={cn("w-5 h-5", isActive ? "text-white" : "text-slate-400")} />
                  <span className="font-bold text-lg">{shift.label}</span>
                </div>
                <div className={cn("text-xs flex items-center gap-1.5", isActive ? "text-amber-50" : "text-slate-400")}>
                  <span>{shift.time}</span>
                  <div className="w-1 h-1 rounded-full bg-current opacity-50" />
                  <span>{shift.count} موظفين</span>
                </div>
              </button>
            )
          })}
        </div>

      </div>

      {/* Floating Canvas Tools Dock (Right) */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-3 pointer-events-auto">
        <div className="bg-white/90 backdrop-blur p-3 rounded-[2rem] border border-slate-200 shadow-xl flex flex-col gap-2">
          <TooltipButton icon={Save} label="حفظ" primary />
          <div className="w-full h-px bg-slate-100 my-1" />
          <TooltipButton icon={Wand2} label="التوزيع الذكي (AI)" className="text-violet-600 bg-violet-50 hover:bg-violet-100" />
          <TooltipButton icon={LayoutTemplate} label="قوالب جاهزة" />
          <TooltipButton icon={History} label="السجل" />
          <TooltipButton icon={Printer} label="طباعة" />
        </div>

        <div className="bg-white/90 backdrop-blur p-3 rounded-[2rem] border border-slate-200 shadow-xl flex flex-col gap-2">
          <TooltipButton icon={ZoomIn} label="تكبير" />
          <TooltipButton icon={ZoomOut} label="تصغير" />
          <TooltipButton icon={Maximize} label="ملء الشاشة" />
          <div className="w-full h-px bg-slate-100 my-1" />
          <TooltipButton icon={Hand} label="أداة التحريك" active />
          <TooltipButton icon={Grid} label="الشبكة" />
          <TooltipButton icon={Lock} label="قفل المخطط" />
        </div>
      </div>

      {/* The Canvas (Mocked) */}
      <div className="absolute inset-0 z-0 overflow-hidden" dir="ltr">
        <div className="relative w-full h-full transform scale-95 origin-center">
          {ZONES.map(zone => {
            const ratio = zone.assigned.length / zone.capacity;
            const needsStaff = ratio < 0.5;
            
            return (
              <div 
                key={zone.id}
                className={cn(
                  "absolute rounded-3xl p-4 flex flex-col gap-3 cursor-pointer group",
                  zone.color, zone.border, "border-2 transition-all duration-300",
                  needsStaff ? "needs-staff" : "shadow-sm hover:shadow-md hover:-translate-y-1"
                )}
                style={{
                  width: zone.w,
                  height: zone.h,
                  left: zone.x,
                  top: zone.y,
                }}
              >
                <div className="flex items-center justify-between" dir="rtl">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-lg">{zone.name}</span>
                  </div>
                  <Badge variant="outline" className={cn(
                    "font-bold px-2 py-1 rounded-xl text-sm border-2",
                    needsStaff ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-white/60 text-slate-600 border-white/40"
                  )}>
                    {zone.assigned.length} / {zone.capacity}
                  </Badge>
                </div>
                
                <div className="flex-1 rounded-2xl bg-white/40 border border-white/60 p-3 flex flex-wrap gap-2 content-start overflow-hidden">
                  {zone.assigned.map(empId => {
                    const emp = EMPLOYEES.find(e => e.id === empId);
                    if (!emp) return null;
                    const role = ROLES[emp.role as keyof typeof ROLES];
                    const Icon = role.icon;
                    return (
                      <div key={emp.id} className={cn(
                        "flex items-center gap-2 bg-white px-2 pr-3 py-1.5 shadow-sm border border-slate-100",
                        role.shape
                      )} dir="rtl">
                        <div className={cn("w-6 h-6 flex items-center justify-center text-white", role.color, role.shape)}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700 truncate max-w-[80px]">
                          {emp.name.split(' ')[0]}
                        </span>
                      </div>
                    )
                  })}
                  
                  {/* Empty slots placeholders */}
                  {Array.from({ length: zone.capacity - zone.assigned.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="w-12 h-10 border-2 border-dashed border-white/50 rounded-xl flex items-center justify-center text-white/50">
                      <span className="text-xl">+</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Persistent Employees Dock (Bottom) */}
      <div className="absolute bottom-6 left-6 right-32 z-20 pointer-events-auto">
        <div className="bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-[2.5rem] p-4 flex flex-col gap-4">
          
          {/* Dock Header & Filters */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <span className="w-2 h-6 bg-[hsl(42,87%,55%)] rounded-full"></span>
                فريق العمل
              </h3>
              <Badge variant="secondary" className="rounded-xl px-3 py-1 text-sm font-bold bg-slate-100">
                {EMPLOYEES.length} موظف
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl">
              {['الكل', 'غير معين', 'حسب الدور'].map((filter, i) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-bold transition-colors",
                    activeFilter === filter ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {filter}
                </button>
              ))}
              <div className="w-px h-6 bg-slate-300 mx-1" />
              <button className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-white hover:shadow-sm transition-all">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Draggable Employee Chips Strip */}
          <ScrollArea className="w-full whitespace-nowrap pb-2">
            <div className="flex w-max gap-3 px-2">
              {EMPLOYEES.map(emp => {
                const role = ROLES[emp.role as keyof typeof ROLES];
                const Icon = role.icon;
                return (
                  <button 
                    key={emp.id}
                    className={cn(
                      "flex items-center gap-3 p-2.5 pr-4 border bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 group active:scale-95 active:shadow-none",
                      role.shape,
                      emp.assigned ? "opacity-60 grayscale-[0.3]" : "border-slate-200"
                    )}
                  >
                    <div className={cn("w-12 h-12 flex items-center justify-center text-white shrink-0 shadow-inner", role.color, role.shape)}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col items-start min-w-[100px]">
                      <span className="font-bold text-slate-800 text-base group-hover:text-[hsl(42,87%,55%)] transition-colors">
                        {emp.name}
                      </span>
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-0.5">
                        <span className="font-semibold">{role.label}</span>
                        {emp.assigned && (
                          <>
                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className="text-[10px] text-slate-400">معين</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            <ScrollBar orientation="horizontal" className="h-2 rounded-full" />
          </ScrollArea>
        </div>
      </div>

    </div>
  );
}

function TooltipButton({ icon: Icon, label, active, primary, className }: { icon: any, label: string, active?: boolean, primary?: boolean, className?: string }) {
  return (
    <button className={cn(
      "w-14 h-14 rounded-full flex items-center justify-center transition-all group relative",
      primary 
        ? "bg-[hsl(42,87%,55%)] text-white hover:bg-amber-600 shadow-md shadow-amber-500/20" 
        : active 
          ? "bg-slate-800 text-white" 
          : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
      className
    )}>
      <Icon className="w-6 h-6" />
      {/* Fake Tooltip on Hover */}
      <div className="absolute left-full ml-4 px-3 py-2 bg-slate-800 text-white text-sm font-bold rounded-lg opacity-0 -translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all whitespace-nowrap z-50 flex items-center shadow-lg">
        {label}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
      </div>
    </button>
  )
}
