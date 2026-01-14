import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Calendar, Plus, ChevronRight, ChevronLeft, Megaphone, Users, Gift, Star, ArrowRight, ListTodo, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  eventType: string;
  startDate: string;
  endDate?: string;
  allDay: boolean;
  campaignId?: number;
  branchId?: string;
  color?: string;
  notes?: string;
}

interface MarketingCampaign {
  id: number;
  name: string;
  nameAr?: string;
  status: string;
  startDate: string;
  endDate: string;
  objective?: string;
}

interface MarketingTask {
  id: number;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  assignedTo?: string;
}

interface UnifiedCalendarEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  type: "event" | "campaign_start" | "campaign_end" | "task";
  color: string;
  source: "calendar" | "campaign" | "task";
  originalData?: any;
}

const EVENT_TYPES = [
  { value: "campaign_launch", label: "إطلاق حملة", color: "bg-amber-500" },
  { value: "campaign_end", label: "نهاية حملة", color: "bg-red-500" },
  { value: "influencer_post", label: "نشر مؤثر", color: "bg-blue-500" },
  { value: "content_deadline", label: "موعد تسليم محتوى", color: "bg-purple-500" },
  { value: "meeting", label: "اجتماع", color: "bg-green-500" },
  { value: "event", label: "فعالية", color: "bg-pink-500" },
  { value: "holiday", label: "مناسبة", color: "bg-orange-500" },
  { value: "other", label: "أخرى", color: "bg-gray-500" },
];

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function MarketingCalendarPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCampaigns, setShowCampaigns] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [selectedDayEvents, setSelectedDayEvents] = useState<UnifiedCalendarEvent[]>([]);
  const [isDayDialogOpen, setIsDayDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    eventType: "campaign_launch",
    startDate: "",
    endDate: "",
    allDay: true,
    notes: "",
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/marketing/calendar-events"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/calendar-events");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<MarketingCampaign[]>({
    queryKey: ["/api/marketing/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/campaigns");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<MarketingTask[]>({
    queryKey: ["/api/marketing/tasks"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/tasks");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const isLoading = eventsLoading || campaignsLoading || tasksLoading;

  const unifiedEvents = useMemo(() => {
    const unified: UnifiedCalendarEvent[] = [];

    if (showEvents) {
      events.forEach(event => {
        if (!event.startDate) return;
        const typeInfo = EVENT_TYPES.find(t => t.value === event.eventType) || EVENT_TYPES[EVENT_TYPES.length - 1];
        unified.push({
          id: `event-${event.id}`,
          title: event.title,
          date: event.startDate,
          endDate: event.endDate || undefined,
          type: "event",
          color: typeInfo.color,
          source: "calendar",
          originalData: event,
        });
      });
    }

    if (showCampaigns) {
      campaigns.forEach(campaign => {
        if (campaign.startDate) {
          unified.push({
            id: `campaign-start-${campaign.id}`,
            title: `بداية: ${campaign.nameAr || campaign.name}`,
            date: campaign.startDate,
            type: "campaign_start",
            color: "bg-green-500",
            source: "campaign",
            originalData: campaign,
          });
        }
        if (campaign.endDate) {
          unified.push({
            id: `campaign-end-${campaign.id}`,
            title: `نهاية: ${campaign.nameAr || campaign.name}`,
            date: campaign.endDate,
            type: "campaign_end",
            color: "bg-red-500",
            source: "campaign",
            originalData: campaign,
          });
        }
      });
    }

    if (showTasks) {
      tasks.filter(t => t.dueDate && t.status !== "completed").forEach(task => {
        const priorityColors: Record<string, string> = {
          urgent: "bg-red-600",
          high: "bg-orange-500",
          medium: "bg-blue-500",
          low: "bg-gray-500",
        };
        unified.push({
          id: `task-${task.id}`,
          title: `مهمة: ${task.title}`,
          date: task.dueDate!,
          type: "task",
          color: priorityColors[task.priority] || "bg-blue-500",
          source: "task",
          originalData: task,
        });
      });
    }

    return unified.filter(e => e.date && !isNaN(new Date(e.date).getTime()));
  }, [events, campaigns, tasks, showEvents, showCampaigns, showTasks]);

  const createEventMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/marketing/calendar-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل في إنشاء الحدث");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/calendar-events"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "تم إنشاء الحدث بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء الحدث", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      eventType: "campaign_launch",
      startDate: "",
      endDate: "",
      allDay: true,
      notes: "",
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    return { daysInMonth, startingDay };
  };

  const { daysInMonth, startingDay } = getDaysInMonth(currentDate);

  const getEventsForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return unifiedEvents.filter(e => e.date && e.date.startsWith(dateStr));
  };

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = getEventsForDate(day);
    if (dayEvents.length > 0) {
      setSelectedDate(dateStr);
      setSelectedDayEvents(dayEvents);
      setIsDayDialogOpen(true);
    } else {
      setSelectedDate(dateStr);
      setFormData(prev => ({ ...prev, startDate: dateStr }));
      setIsAddDialogOpen(true);
    }
  };

  const handleAddEventFromDay = () => {
    setIsDayDialogOpen(false);
    if (selectedDate) {
      setFormData(prev => ({ ...prev, startDate: selectedDate }));
      setIsAddDialogOpen(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.startDate) {
      toast({ title: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    createEventMutation.mutate(formData);
  };

  const getEventTypeInfo = (type: string) => {
    return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[EVENT_TYPES.length - 1];
  };

  const today = new Date();
  const isToday = (day: number) => {
    return today.getFullYear() === currentDate.getFullYear() &&
           today.getMonth() === currentDate.getMonth() &&
           today.getDate() === day;
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "campaign": return <Megaphone className="w-3 h-3" />;
      case "task": return <ListTodo className="w-3 h-3" />;
      default: return <Calendar className="w-3 h-3" />;
    }
  };

  const upcomingEvents = unifiedEvents
    .filter(e => {
      if (!e.date) return false;
      const eventDate = new Date(e.date);
      return !isNaN(eventDate.getTime()) && eventDate >= new Date();
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  const campaignCount = campaigns.filter(c => c.status === "active").length;
  const pendingTasksCount = tasks.filter(t => t.status !== "completed" && t.dueDate).length;
  const thisMonthEvents = unifiedEvents.filter(e => {
    if (!e.date) return false;
    const eventDate = new Date(e.date);
    if (isNaN(eventDate.getTime())) return false;
    return eventDate.getMonth() === currentDate.getMonth() && eventDate.getFullYear() === currentDate.getFullYear();
  }).length;

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/marketing">
              <Button variant="outline" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" data-testid="button-back">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold" data-testid="page-title">تقويم التسويق</h1>
              <p className="text-sm text-muted-foreground">عرض موحد للحملات والمهام والفعاليات</p>
            </div>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 sm:h-9" data-testid="button-add-event">
                <Plus className="w-4 h-4 ml-2" />
                إضافة حدث
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة حدث جديد</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>عنوان الحدث *</Label>
                  <Input
                    className="h-11 sm:h-10"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="أدخل عنوان الحدث"
                    data-testid="input-event-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>نوع الحدث</Label>
                  <Select value={formData.eventType} onValueChange={(v) => setFormData({ ...formData, eventType: v })}>
                    <SelectTrigger className="h-11 sm:h-10" data-testid="select-event-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {EVENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>تاريخ البداية *</Label>
                    <Input
                      className="h-11 sm:h-10"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>تاريخ النهاية</Label>
                    <Input
                      className="h-11 sm:h-10"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      data-testid="input-end-date"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>الوصف</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="وصف الحدث"
                    rows={3}
                    data-testid="input-event-description"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => setIsAddDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button type="submit" className="h-11 sm:h-9" disabled={createEventMutation.isPending} data-testid="button-submit-event">
                    {createEventMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Megaphone className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{campaignCount}</p>
                  <p className="text-sm text-muted-foreground">حملات نشطة</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ListTodo className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingTasksCount}</p>
                  <p className="text-sm text-muted-foreground">مهام قادمة</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{thisMonthEvents}</p>
                  <p className="text-sm text-muted-foreground">أحداث هذا الشهر</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{events.length}</p>
                  <p className="text-sm text-muted-foreground">أحداث مسجلة</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="text-lg sm:text-xl">
                {MONTHS_AR[currentDate.getMonth()]} {currentDate.getFullYear()}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={showCampaigns} onCheckedChange={setShowCampaigns} id="show-campaigns" />
                  <Label htmlFor="show-campaigns" className="text-sm cursor-pointer">الحملات</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={showTasks} onCheckedChange={setShowTasks} id="show-tasks" />
                  <Label htmlFor="show-tasks" className="text-sm cursor-pointer">المهام</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={showEvents} onCheckedChange={setShowEvents} id="show-events" />
                  <Label htmlFor="show-events" className="text-sm cursor-pointer">الأحداث</Label>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Button variant="outline" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" onClick={goToNextMonth} data-testid="button-next-month">
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" onClick={goToPrevMonth} data-testid="button-prev-month">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-11 sm:h-9" onClick={goToToday} data-testid="button-today">
                اليوم
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-7 bg-muted">
                  {DAYS_AR.map((day) => (
                    <div key={day} className="p-2 text-center text-sm font-medium border-b">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: startingDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-24 border-b border-l bg-muted/30" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dayEvents = getEventsForDate(day);
                    return (
                      <div
                        key={day}
                        className={`min-h-24 border-b border-l p-1 cursor-pointer hover:bg-muted/50 transition-colors ${
                          isToday(day) ? "bg-primary/10" : ""
                        }`}
                        onClick={() => handleDayClick(day)}
                        data-testid={`calendar-day-${day}`}
                      >
                        <div className={`text-sm font-medium mb-1 ${isToday(day) ? "text-primary" : ""}`}>
                          {day}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              className={`text-xs p-1 rounded truncate text-white ${event.color} flex items-center gap-1`}
                              title={event.title}
                            >
                              {getSourceIcon(event.source)}
                              <span className="truncate">{event.title}</span>
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              +{dayEvents.length - 3} أخرى
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">الأحداث القادمة</CardTitle>
              <CardDescription>أقرب 5 أحداث قادمة</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">لا توجد أحداث قادمة</p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <div key={event.id} className="flex items-center gap-3 p-2 border rounded-lg">
                      <div className={`w-3 h-3 rounded-full ${event.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(event.date).toLocaleDateString("ar-SA")}
                        </p>
                      </div>
                      {getSourceIcon(event.source)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">دليل الألوان</CardTitle>
              <CardDescription>معنى الألوان في التقويم</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm">بداية حملة</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm">نهاية حملة</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm">مهمة عادية</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="text-sm">مهمة عاجلة</span>
                </div>
                {EVENT_TYPES.slice(0, 4).map((type) => (
                  <div key={type.value} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${type.color}`} />
                    <span className="text-sm">{type.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={isDayDialogOpen} onOpenChange={setIsDayDialogOpen}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>
                أحداث {selectedDate ? new Date(selectedDate).toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long" }) : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {selectedDayEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${event.color}`} />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{event.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {event.source === "campaign" ? "حملة" : event.source === "task" ? "مهمة" : "حدث"}
                    </p>
                  </div>
                  {getSourceIcon(event.source)}
                </div>
              ))}
            </div>
            <Button className="w-full mt-4" onClick={handleAddEventFromDay}>
              <Plus className="w-4 h-4 ml-2" />
              إضافة حدث جديد
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
