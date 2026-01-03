import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Plus, ChevronRight, ChevronLeft, Megaphone, Users, Gift, Star } from "lucide-react";
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
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    eventType: "campaign_launch",
    startDate: "",
    endDate: "",
    allDay: true,
    notes: "",
  });

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/marketing/calendar"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/calendar");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/marketing/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل في إنشاء الحدث");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/calendar"] });
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
    return events.filter(e => e.startDate.startsWith(dateStr));
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
    setSelectedDate(dateStr);
    setFormData(prev => ({ ...prev, startDate: dateStr }));
    setIsAddDialogOpen(true);
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

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">تقويم التسويق</h1>
            <p className="text-sm text-muted-foreground">جدولة الحملات والفعاليات التسويقية</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-event">
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
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="أدخل عنوان الحدث"
                    data-testid="input-event-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>نوع الحدث</Label>
                  <Select value={formData.eventType} onValueChange={(v) => setFormData({ ...formData, eventType: v })}>
                    <SelectTrigger data-testid="select-event-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>تاريخ النهاية</Label>
                    <Input
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
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={createEventMutation.isPending} data-testid="button-submit-event">
                    {createEventMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToNextMonth} data-testid="button-next-month">
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={goToPrevMonth} data-testid="button-prev-month">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToToday} data-testid="button-today">
                  اليوم
                </Button>
              </div>
              <CardTitle className="text-xl">
                {MONTHS_AR[currentDate.getMonth()]} {currentDate.getFullYear()}
              </CardTitle>
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
                          {dayEvents.slice(0, 3).map((event) => {
                            const typeInfo = getEventTypeInfo(event.eventType);
                            return (
                              <div
                                key={event.id}
                                className={`text-xs p-1 rounded truncate text-white ${typeInfo.color}`}
                                title={event.title}
                              >
                                {event.title}
                              </div>
                            );
                          })}
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {EVENT_TYPES.slice(0, 4).map((type) => (
            <div key={type.value} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${type.color}`} />
              <span className="text-sm">{type.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
