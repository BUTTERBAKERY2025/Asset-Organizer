import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "wouter";
import { 
  Calendar as CalendarIcon, 
  ChevronRight, 
  ChevronLeft, 
  ArrowRight,
  Clock,
  MapPin,
  Users,
  CheckSquare,
  Video,
  Phone
} from "lucide-react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  addWeeks,
  subWeeks,
  isToday,
  parseISO
} from "date-fns";
import { ar } from "date-fns/locale";

interface Meeting {
  id: number;
  title: string;
  titleEn?: string;
  description?: string;
  location?: string;
  meetingType: string;
  meetingLink?: string;
  startAt: string;
  endAt?: string;
  status: string;
  organizerId: string;
  organizerName?: string;
}

interface Task {
  id: number;
  title: string;
  titleEn?: string;
  description?: string;
  priority: string;
  status: string;
  dueDate?: string;
  assigneeId?: string;
  assigneeName?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'meeting' | 'task';
  status: string;
  priority?: string;
  meetingType?: string;
  time?: string;
  location?: string;
  original: Meeting | Task;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  normal: "bg-blue-500",
  low: "bg-gray-500",
};

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500",
  in_progress: "bg-yellow-500",
  completed: "bg-green-500",
  cancelled: "bg-gray-400",
  pending: "bg-yellow-500",
  postponed: "bg-purple-500",
};

const meetingTypeIcons: Record<string, React.ReactNode> = {
  in_person: <Users className="h-3 w-3" />,
  virtual: <Video className="h-3 w-3" />,
  hybrid: <Users className="h-3 w-3" />,
  phone: <Phone className="h-3 w-3" />,
};

const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function ExecutiveCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week'>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery<Meeting[]>({
    queryKey: ["/api/executive/meetings"],
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/executive/tasks"],
  });

  const isLoading = meetingsLoading || tasksLoading;

  const calendarEvents = useMemo(() => {
    const events: CalendarEvent[] = [];

    meetings.forEach((meeting) => {
      if (meeting.startAt) {
        const meetingDate = parseISO(meeting.startAt);
        events.push({
          id: `meeting-${meeting.id}`,
          title: meeting.title,
          date: meetingDate,
          type: 'meeting',
          status: meeting.status,
          meetingType: meeting.meetingType,
          time: format(meetingDate, 'HH:mm'),
          location: meeting.location,
          original: meeting,
        });
      }
    });

    tasks.forEach((task) => {
      if (task.dueDate) {
        const taskDate = parseISO(task.dueDate);
        events.push({
          id: `task-${task.id}`,
          title: task.title,
          date: taskDate,
          type: 'task',
          status: task.status,
          priority: task.priority,
          original: task,
        });
      }
    });

    return events;
  }, [meetings, tasks]);

  const getEventsForDay = (day: Date) => {
    return calendarEvents.filter((event) => isSameDay(event.date, day));
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const monthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const navigatePrev = () => {
    if (view === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (view === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6" dir="rtl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link href="/executive">
            <Button variant="ghost" size="icon">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-amber-800" data-testid="page-title">
              التقويم التنفيذي
            </h1>
            <p className="text-gray-600">
              عرض الاجتماعات والمهام في تقويم تفاعلي
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as 'month' | 'week')}>
            <TabsList>
              <TabsTrigger value="month">شهري</TabsTrigger>
              <TabsTrigger value="week">أسبوعي</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={navigatePrev}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={navigateNext}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                اليوم
              </Button>
            </div>
            <CardTitle className="text-xl">
              {view === 'month' 
                ? format(currentDate, 'MMMM yyyy', { locale: ar })
                : `${format(weekStart, 'd MMM', { locale: ar })} - ${format(weekEnd, 'd MMM yyyy', { locale: ar })}`
              }
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm">اجتماعات</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span className="text-sm">مهام</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {view === 'month' ? (
            <div className="grid grid-cols-7 gap-1">
              {arabicDays.map((day) => (
                <div key={day} className="p-2 text-center font-semibold text-gray-600 border-b">
                  {day}
                </div>
              ))}
              {monthDays.map((day, index) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isCurrentDay = isToday(day);

                return (
                  <div
                    key={index}
                    className={`min-h-24 p-1 border rounded-lg ${
                      isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                    } ${isCurrentDay ? 'ring-2 ring-amber-500' : ''}`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                    } ${isCurrentDay ? 'text-amber-600' : ''}`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <button
                          key={event.id}
                          onClick={() => handleEventClick(event)}
                          className={`w-full text-right text-xs p-1 rounded truncate text-white ${
                            event.type === 'meeting' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-amber-500 hover:bg-amber-600'
                          }`}
                          data-testid={`event-${event.id}`}
                        >
                          {event.time && <span className="ml-1">{event.time}</span>}
                          {event.title}
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{dayEvents.length - 3} المزيد
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day, index) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentDay = isToday(day);

                return (
                  <div key={index} className="min-h-[400px]">
                    <div className={`p-2 text-center border-b ${isCurrentDay ? 'bg-amber-50' : ''}`}>
                      <div className="text-sm text-gray-600">{arabicDays[index]}</div>
                      <div className={`text-lg font-bold ${isCurrentDay ? 'text-amber-600' : ''}`}>
                        {format(day, 'd')}
                      </div>
                    </div>
                    <div className="p-1 space-y-2">
                      {dayEvents.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => handleEventClick(event)}
                          className={`w-full text-right p-2 rounded-lg text-white ${
                            event.type === 'meeting' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-amber-500 hover:bg-amber-600'
                          }`}
                          data-testid={`event-${event.id}`}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            {event.type === 'meeting' && event.meetingType && meetingTypeIcons[event.meetingType]}
                            {event.time && (
                              <span className="text-xs flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {event.time}
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-medium truncate">{event.title}</div>
                          {event.location && (
                            <div className="text-xs opacity-80 flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvent?.type === 'meeting' ? (
                <CalendarIcon className="h-5 w-5 text-blue-500" />
              ) : (
                <CheckSquare className="h-5 w-5 text-amber-500" />
              )}
              {selectedEvent?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={statusColors[selectedEvent.status] || 'bg-gray-500'}>
                  {selectedEvent.status === 'scheduled' && 'مجدول'}
                  {selectedEvent.status === 'in_progress' && 'قيد التنفيذ'}
                  {selectedEvent.status === 'completed' && 'مكتمل'}
                  {selectedEvent.status === 'cancelled' && 'ملغي'}
                  {selectedEvent.status === 'pending' && 'معلق'}
                  {selectedEvent.status === 'postponed' && 'مؤجل'}
                </Badge>
                {selectedEvent.priority && (
                  <Badge className={priorityColors[selectedEvent.priority] || 'bg-gray-500'}>
                    {selectedEvent.priority === 'urgent' && 'عاجل'}
                    {selectedEvent.priority === 'high' && 'مرتفع'}
                    {selectedEvent.priority === 'normal' && 'عادي'}
                    {selectedEvent.priority === 'low' && 'منخفض'}
                  </Badge>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-gray-500" />
                  <span>{format(selectedEvent.date, 'EEEE, d MMMM yyyy', { locale: ar })}</span>
                </div>
                {selectedEvent.time && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span>{selectedEvent.time}</span>
                  </div>
                )}
                {selectedEvent.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}
                {selectedEvent.meetingType && (
                  <div className="flex items-center gap-2">
                    {meetingTypeIcons[selectedEvent.meetingType]}
                    <span>
                      {selectedEvent.meetingType === 'in_person' && 'حضوري'}
                      {selectedEvent.meetingType === 'virtual' && 'عن بعد'}
                      {selectedEvent.meetingType === 'hybrid' && 'مختلط'}
                      {selectedEvent.meetingType === 'phone' && 'هاتفي'}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                {selectedEvent.type === 'meeting' ? (
                  <Link href="/executive/meetings">
                    <Button className="w-full">
                      عرض تفاصيل الاجتماع
                    </Button>
                  </Link>
                ) : (
                  <Link href="/executive/tasks">
                    <Button className="w-full">
                      عرض تفاصيل المهمة
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
