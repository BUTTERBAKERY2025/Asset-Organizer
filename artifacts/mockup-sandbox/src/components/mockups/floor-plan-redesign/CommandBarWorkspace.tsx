import React, { useState } from 'react';
import { 
  Search, Wand2, Grid, MousePointer2, ZoomIn, ZoomOut, Maximize, 
  Lock, Undo2, Redo2, History, Save, Printer, MessageCircle, 
  Crown, Shield, Calculator, Utensils, ChefHat, Coffee, Cake, 
  Handshake, ClipboardList, Sparkles, ChevronDown, Map, Users,
  Layers, AlertCircle, CheckCircle2, ChevronRight, PanelLeftClose, PanelRightClose
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import './_group.css';

export function CommandBarWorkspace() {
  const [activeShift, setActiveShift] = useState('morning');
  const [activeLeftTab, setActiveLeftTab] = useState('roles');

  const roles = [
    { name: 'مدير الفرع', icon: Crown, color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200' },
    { name: 'مشرف', icon: Shield, color: 'text-sky-600', bg: 'bg-sky-100', border: 'border-sky-200' },
    { name: 'كاشير', icon: Calculator, color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200' },
    { name: 'ويتر', icon: Utensils, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' },
    { name: 'شيف', icon: ChefHat, color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-200' },
    { name: 'باريستا', icon: Coffee, color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-200' },
    { name: 'حلواني', icon: Cake, color: 'text-pink-600', bg: 'bg-pink-100', border: 'border-pink-200' },
    { name: 'مضيف', icon: Handshake, color: 'text-cyan-600', bg: 'bg-cyan-100', border: 'border-cyan-200' },
    { name: 'محضر طلبات', icon: ClipboardList, color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' },
    { name: 'عامل نظافة', icon: Sparkles, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
  ];

  const employees = [
    { name: 'محمد العتيبي', role: 'مدير الفرع' },
    { name: 'أحمد القحطاني', role: 'كاشير' },
    { name: 'خالد الشهري', role: 'باريستا' },
    { name: 'فهد الحربي', role: 'شيف' },
    { name: 'سعد المالكي', role: 'ويتر' },
    { name: 'نوف الزهراني', role: 'حلواني' },
    { name: 'ريم الدوسري', role: 'مضيف' },
    { name: 'لمى السبيعي', role: 'محضر طلبات' },
    { name: 'عبدالله الغامدي', role: 'عامل نظافة' },
    { name: 'ماجد البلوي', role: 'مشرف' },
  ];

  const zones = [
    { id: 'z1', name: 'بار القهوة', type: 'Coffee Bar', x: 80, y: 120, w: 220, h: 160 },
    { id: 'z2', name: 'الكاشير', type: 'Cashier', x: 320, y: 120, w: 140, h: 100 },
    { id: 'z3', name: 'صالة الطعام', type: 'Dining Hall', x: 80, y: 300, w: 380, h: 220 },
    { id: 'z4', name: 'المطبخ', type: 'Kitchen', x: 480, y: 120, w: 220, h: 180 },
    { id: 'z5', name: 'بار البيكري', type: 'Bakery Bar', x: 480, y: 320, w: 220, h: 120 },
    { id: 'z6', name: 'الاستقبال', type: 'Reception', x: 320, y: 240, w: 140, h: 60 },
  ];

  const assignments = [
    { zoneId: 'z1', employees: ['خالد الشهري'] },
    { zoneId: 'z2', employees: ['أحمد القحطاني'] },
    { zoneId: 'z3', employees: ['سعد المالكي', 'ريم الدوسري'] },
    { zoneId: 'z4', employees: ['فهد الحربي', 'لمى السبيعي'] },
    { zoneId: 'z5', employees: ['نوف الزهراني'] },
    { zoneId: 'z6', employees: ['ماجد البلوي'] },
  ];

  const renderRoleBadge = (roleName: string, textName: string) => {
    const role = roles.find(r => r.name === roleName);
    if (!role) return null;
    const Icon = role.icon;
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border shadow-sm ${role.bg} ${role.color} ${role.border} cursor-grab active:cursor-grabbing hover:brightness-95 transition-all`}>
        <Icon className="w-3.5 h-3.5" />
        <span>{textName}</span>
      </div>
    );
  };

  return (
    <div dir="rtl" className="flex flex-col h-[860px] bg-[#fdfdfc] text-slate-900 font-['Cairo'] overflow-hidden border rounded-xl shadow-2xl">
      {/* Top Command Bar */}
      <div className="h-12 border-b bg-white flex items-center justify-between px-3 shrink-0 z-10">
        <div className="flex items-center gap-4 w-1/3">
          <div className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-1.5 rounded-md transition-colors">
            <div className="w-6 h-6 rounded bg-[#E4B136] text-white flex items-center justify-center font-bold text-sm">
              B
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold leading-none">زبدة بيكري</span>
              <span className="text-[10px] text-slate-500 leading-none mt-0.5">فرع التحلية</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </div>
          
          <Separator orientation="vertical" className="h-5" />
          
          <Tabs value={activeShift} onValueChange={setActiveShift} className="h-8">
            <TabsList className="h-8 bg-slate-100/80 p-0.5 border">
              <TabsTrigger value="morning" className="text-xs h-7 px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-sm">صباحي</TabsTrigger>
              <TabsTrigger value="evening" className="text-xs h-7 px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-sm">مسائي</TabsTrigger>
              <TabsTrigger value="night" className="text-xs h-7 px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-sm">ليلي</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="w-1/3 flex justify-center">
          <div className="relative w-full max-w-sm group">
            <Search className="w-4 h-4 absolute right-2.5 top-1.5 text-slate-400 group-hover:text-[#E4B136] transition-colors" />
            <Input 
              placeholder="ابحث أو نفذ أمر..." 
              className="h-7 text-xs bg-slate-50 border-slate-200 focus-visible:ring-[#E4B136] pr-8 pl-12 rounded-md shadow-inner shadow-slate-100 transition-all hover:bg-white focus:bg-white"
            />
            <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
              <kbd className="text-[9px] font-sans bg-white border border-slate-200 rounded px-1 text-slate-400 font-medium">⌘</kbd>
              <kbd className="text-[9px] font-sans bg-white border border-slate-200 rounded px-1 text-slate-400 font-medium">K</kbd>
            </div>
          </div>
        </div>

        <div className="w-1/3 flex items-center justify-end gap-1.5">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-amber-600 hover:bg-amber-50">
                  <Wand2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs font-['Cairo']">ترتيب تلقائي بالذكاء الاصطناعي</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500">
                  <History className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs font-['Cairo']">سجل التغييرات</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button variant="default" size="sm" className="h-7 text-xs bg-[#E4B136] hover:bg-[#c99a2d] text-white shadow-sm gap-1.5 px-3">
            <Save className="w-3.5 h-3.5" />
            حفظ التغييرات
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Rail: Library */}
        <div className="w-64 border-l bg-white flex flex-col shrink-0 z-10 shadow-[2px_0_12px_rgba(0,0,0,0.02)]">
          <Tabs value={activeLeftTab} onValueChange={setActiveLeftTab} className="flex-1 flex flex-col">
            <div className="flex items-center px-1 pt-1 border-b">
              <TabsList className="h-9 w-full bg-transparent p-0 justify-start gap-4 rounded-none">
                <TabsTrigger 
                  value="roles" 
                  className="text-xs font-medium h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-[#E4B136] data-[state=active]:text-[#E4B136] data-[state=active]:bg-transparent px-1 data-[state=active]:shadow-none"
                >
                  <Users className="w-3.5 h-3.5 ml-1.5" />
                  الموظفين
                </TabsTrigger>
                <TabsTrigger 
                  value="zones" 
                  className="text-xs font-medium h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-[#E4B136] data-[state=active]:text-[#E4B136] data-[state=active]:bg-transparent px-1 data-[state=active]:shadow-none"
                >
                  <Map className="w-3.5 h-3.5 ml-1.5" />
                  المناطق
                </TabsTrigger>
                <TabsTrigger 
                  value="templates" 
                  className="text-xs font-medium h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-[#E4B136] data-[state=active]:text-[#E4B136] data-[state=active]:bg-transparent px-1 data-[state=active]:shadow-none"
                >
                  <Layers className="w-3.5 h-3.5 ml-1.5" />
                  النماذج
                </TabsTrigger>
              </TabsList>
            </div>
            
            <div className="p-3 border-b bg-slate-50/50">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute right-2 top-2 text-slate-400" />
                <Input placeholder="تصفية..." className="h-7.5 text-xs pr-7 bg-white border-slate-200" />
              </div>
            </div>

            <TabsContent value="roles" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-3 space-y-4">
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">حسب الدور</h4>
                    <div className="flex flex-wrap gap-2">
                      {roles.map(r => (
                        <TooltipProvider key={r.name}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`p-1.5 rounded-md border shadow-sm cursor-grab hover:scale-105 transition-transform ${r.bg} ${r.color} ${r.border}`}>
                                <r.icon className="w-4 h-4" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs font-['Cairo']">{r.name}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">الموظفين المتاحين</h4>
                    <div className="space-y-1.5">
                      {employees.map(emp => {
                        const r = roles.find(role => role.name === emp.role);
                        const Icon = r?.icon || Users;
                        return (
                          <div key={emp.name} className="flex items-center justify-between p-2 rounded-md border border-transparent hover:border-slate-200 hover:bg-slate-50 cursor-grab group transition-colors">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${r?.bg} ${r?.color}`}>
                                <Icon className="w-3 h-3" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">{emp.name}</span>
                                <span className="text-[10px] text-slate-400">{emp.role}</span>
                              </div>
                            </div>
                            <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <ChevronRight className="w-3 h-3 text-slate-400" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="zones" className="flex-1 m-0 p-3">
              <div className="text-xs text-slate-500 text-center mt-10">قائمة المناطق (محاكاة)</div>
            </TabsContent>
            <TabsContent value="templates" className="flex-1 m-0 p-3">
              <div className="text-xs text-slate-500 text-center mt-10">نماذج جاهزة (محاكاة)</div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Center: Canvas Area */}
        <div className="flex-1 flex flex-col relative bg-[#f8f9fa] overflow-hidden">
          {/* Floating Actions on Canvas */}
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-1.5">
            <div className="bg-white rounded-md shadow-sm border p-1 flex flex-col gap-0.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-slate-600 hover:text-[#E4B136] hover:bg-amber-50">
                      <ZoomIn className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs font-['Cairo']">تكبير (⌘+)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="text-[9px] font-medium text-center text-slate-400 py-1 border-y my-0.5 cursor-pointer hover:text-slate-600">
                100%
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-slate-600 hover:text-[#E4B136] hover:bg-amber-50">
                      <ZoomOut className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs font-['Cairo']">تصغير (⌘-)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className="bg-white rounded-md shadow-sm border p-1 flex flex-col gap-0.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-slate-600 hover:text-[#E4B136] hover:bg-amber-50">
                      <Maximize className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs font-['Cairo']">احتواء في الشاشة (⇧1)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="absolute top-4 left-4 z-10">
            <div className="bg-white/90 backdrop-blur-sm rounded-md shadow-sm border p-1 flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-[#E4B136] bg-amber-50">
                <MousePointer2 className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-slate-400 hover:text-slate-700">
                <Handshake className="w-3.5 h-3.5" />
              </Button>
              <Separator orientation="vertical" className="h-4 mx-1" />
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-slate-400 hover:text-slate-700">
                <Undo2 className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-slate-400 hover:text-slate-700" disabled>
                <Redo2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Actual Canvas */}
          <div className="flex-1 relative overflow-auto butter-canvas-pattern cursor-crosshair">
            <div className="absolute inset-0 min-w-[800px] min-h-[600px] origin-top-left" style={{ transform: 'scale(1)' }}>
              
              {zones.map(zone => {
                const zoneAssigns = assignments.find(a => a.zoneId === zone.id);
                return (
                  <div 
                    key={zone.id}
                    className="absolute bg-white border-2 border-slate-200/80 rounded-lg shadow-sm flex flex-col overflow-hidden group hover:border-[#E4B136]/50 transition-colors"
                    style={{ 
                      left: zone.x, 
                      top: zone.y, 
                      width: zone.w, 
                      height: zone.h 
                    }}
                  >
                    <div className="bg-slate-50 px-2 py-1.5 border-b flex justify-between items-center group-hover:bg-[#E4B136]/5 transition-colors">
                      <span className="text-[10px] font-bold text-slate-600">{zone.name}</span>
                      <span className="text-[8px] text-slate-400 font-sans">{zone.type}</span>
                    </div>
                    <div className="flex-1 p-2 flex flex-wrap content-start gap-1.5 bg-slate-50/20">
                      {zoneAssigns?.employees.map(empName => {
                        const emp = employees.find(e => e.name === empName);
                        if (!emp) return null;
                        return renderRoleBadge(emp.role, emp.name);
                      })}
                      
                      {(!zoneAssigns || zoneAssigns.employees.length === 0) && (
                        <div className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] text-slate-400 border border-dashed border-slate-300 rounded px-2 py-1 bg-white/50">
                            اسحب الموظف هنا
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

            </div>
          </div>

          {/* Bottom Status Bar */}
          <div className="h-8 border-t bg-white flex items-center justify-between px-3 shrink-0 text-[10px] text-slate-500 font-medium">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 cursor-pointer hover:text-slate-800">
                <Grid className="w-3 h-3" />
                <span>الشبكة مفعلة</span>
              </div>
              <Separator orientation="vertical" className="h-3" />
              <div className="flex items-center gap-1.5 cursor-pointer hover:text-slate-800">
                <Lock className="w-3 h-3" />
                <span>اللوحة مفتوحة</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">آخر حفظ قبل دقيقتين</span>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
            </div>
          </div>
        </div>

        {/* Right Rail: Status & Coverage */}
        <div className="w-60 border-r bg-white flex flex-col shrink-0 z-10 shadow-[-2px_0_12px_rgba(0,0,0,0.02)]">
          <div className="h-12 border-b flex items-center px-4 font-bold text-xs">
            حالة التغطية (الوردية الصباحية)
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              
              {/* Coverage Meter */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs items-end">
                  <span className="text-slate-600 font-medium">تغطية الموظفين</span>
                  <span className="font-bold text-emerald-600">82%</span>
                </div>
                <Progress value={82} className="h-2 bg-slate-100" />
                <p className="text-[10px] text-slate-400">23 من أصل 28 موظف معينين</p>
              </div>

              <Separator />

              {/* Critical Alerts */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">نواقص حرجة</h4>
                
                <div className="bg-red-50 border border-red-100 rounded-md p-2.5 flex gap-2.5 items-start">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-red-700">باريستا (2) ناقص</span>
                    <span className="text-[10px] text-red-600/80">منطقة بار القهوة تحتاج تغطية إضافية للذروة الصباحية</span>
                  </div>
                </div>
                
                <div className="bg-amber-50 border border-amber-100 rounded-md p-2.5 flex gap-2.5 items-start">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-amber-700">كاشير (1) ناقص</span>
                    <span className="text-[10px] text-amber-600/80">منطقة الكاشير الرئيسية</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Ready Zones */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">مناطق مكتملة</h4>
                
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs text-slate-600">المطبخ (4/4)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs text-slate-600">الاستقبال (1/1)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs text-slate-600">صالة الطعام (3/3)</span>
                </div>
              </div>

              <Separator />

              {/* Minimap Placeholder */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">خريطة مصغرة</h4>
                  <PanelRightClose className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
                </div>
                <div className="aspect-video bg-slate-50 border rounded-md relative overflow-hidden">
                  <div className="absolute inset-2 border-2 border-slate-200/50 rounded flex items-center justify-center">
                    <Map className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              </div>

            </div>
          </ScrollArea>
          
          <div className="p-3 border-t bg-slate-50">
            <Button variant="outline" className="w-full text-xs h-8 bg-white" gap-2>
              <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
              إرسال الجدول (WhatsApp)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
