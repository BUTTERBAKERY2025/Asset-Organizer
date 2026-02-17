import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";
import type { SystemNotification, Branch } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import {
  Megaphone, Flame, PartyPopper, AlertTriangle, Sparkles, Clock,
  Plus, Edit, Trash2, Eye, EyeOff, Bell, BellOff, Star,
  Monitor, Maximize, LayoutDashboard, PanelRightOpen,
  Volume2, VolumeX, Palette, Target, Calendar, Music,
  FileText, Send, X, CheckCircle, Ban, Timer,
  Users, BarChart3, PlayCircle, XCircle
} from "lucide-react";
import { NotificationContent } from "@/components/NotificationDisplay";

const MESSAGE_TYPES = [
  { value: "announcement", label: "إعلان", icon: Megaphone, color: "bg-blue-100 text-blue-700 border-blue-200", dotColor: "bg-blue-500" },
  { value: "motivational", label: "تحفيزي", icon: Flame, color: "bg-orange-100 text-orange-700 border-orange-200", dotColor: "bg-orange-500" },
  { value: "greeting", label: "تهنئة", icon: PartyPopper, color: "bg-green-100 text-green-700 border-green-200", dotColor: "bg-green-500" },
  { value: "warning", label: "تحذير", icon: AlertTriangle, color: "bg-red-100 text-red-700 border-red-200", dotColor: "bg-red-500" },
  { value: "celebration", label: "احتفال", icon: Sparkles, color: "bg-purple-100 text-purple-700 border-purple-200", dotColor: "bg-purple-500" },
  { value: "reminder", label: "تذكير", icon: Clock, color: "bg-yellow-100 text-yellow-700 border-yellow-200", dotColor: "bg-yellow-500" },
];

const DISPLAY_STYLES = [
  { value: "modal", label: "نافذة منبثقة", icon: Monitor, description: "تظهر في وسط الشاشة" },
  { value: "fullscreen", label: "ملء الشاشة", icon: Maximize, description: "تغطي الشاشة بالكامل" },
  { value: "banner", label: "شريط علوي", icon: LayoutDashboard, description: "شريط في أعلى الصفحة" },
  { value: "slide_in", label: "لوحة جانبية", icon: PanelRightOpen, description: "تنزلق من الجانب" },
];

const ANIMATION_TYPES = [
  { value: "fade", label: "تلاشي" },
  { value: "slide", label: "انزلاق" },
  { value: "bounce", label: "ارتداد" },
  { value: "zoom", label: "تكبير" },
  { value: "flip", label: "انقلاب" },
];

const EFFECT_TYPES = [
  { value: "confetti", label: "قصاصات", emoji: "🎊" },
  { value: "fireworks", label: "ألعاب نارية", emoji: "🎆" },
  { value: "sparkles", label: "بريق", emoji: "✨" },
  { value: "hearts", label: "قلوب", emoji: "❤️" },
  { value: "stars", label: "نجوم", emoji: "⭐" },
];

const SOUND_TYPES = [
  { value: "default", label: "افتراضي" },
  { value: "chime", label: "رنين" },
  { value: "bell", label: "جرس" },
  { value: "fanfare", label: "موسيقى احتفالية" },
  { value: "alert", label: "تنبيه" },
];

const COMMON_EMOJIS = [
  "😀", "😍", "🎉", "🔥", "💪", "⭐", "❤️", "👏", "🎊", "🏆",
  "💎", "🌟", "✅", "🚀", "💯", "🎯", "🌹", "☕", "🍰", "🥐",
  "🍞", "🎂", "🧁", "🍩", "🎈", "🎁", "🏅", "👑", "💐", "🌺",
];

const DEFAULT_FORM: Partial<SystemNotification> = {
  title: "",
  content: "",
  messageType: "announcement",
  displayStyle: "modal",
  priority: 1,
  isActive: true,
  targetAllBranches: true,
  targetBranchIds: null,
  startDate: null,
  endDate: null,
  displayTimeStart: null,
  displayTimeEnd: null,
  soundEnabled: false,
  soundType: "default",
  backgroundColor: "#ffffff",
  textColor: "#1a1a1a",
  accentColor: "#d4a017",
  animationType: "fade",
  effectType: null,
  emoji: null,
  imageUrl: null,
  buttonText: null,
  buttonAction: null,
  showOnce: false,
  autoCloseSeconds: null,
};

function getNotificationStatus(n: SystemNotification): string {
  if (!n.isActive) return "inactive";
  const now = new Date();
  if (n.startDate && new Date(n.startDate) > now) return "scheduled";
  if (n.endDate && new Date(n.endDate) < now) return "expired";
  return "active";
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active": return <Badge data-testid="badge-status-active" className="bg-green-100 text-green-700 border-green-200">نشط</Badge>;
    case "inactive": return <Badge data-testid="badge-status-inactive" className="bg-gray-100 text-gray-600 border-gray-200">غير نشط</Badge>;
    case "scheduled": return <Badge data-testid="badge-status-scheduled" className="bg-blue-100 text-blue-700 border-blue-200">مجدول</Badge>;
    case "expired": return <Badge data-testid="badge-status-expired" className="bg-red-100 text-red-600 border-red-200">منتهي</Badge>;
    default: return null;
  }
}

function LivePreview({ form }: { form: Record<string, any> }) {
  const msgType = MESSAGE_TYPES.find(t => t.value === form.messageType);
  const MsgIcon = msgType?.icon || Megaphone;
  const effectEmoji = EFFECT_TYPES.find(e => e.value === form.effectType)?.emoji;

  const previewBg = form.backgroundColor || "#ffffff";
  const previewText = form.textColor || "#1a1a1a";
  const previewAccent = form.accentColor || "#d4a017";

  const renderPreviewContent = () => (
    <div className="p-3 rounded-lg border shadow-sm" style={{ backgroundColor: previewBg, color: previewText, borderColor: previewAccent }}>
      {form.emoji && <div className="text-2xl mb-1">{form.emoji}</div>}
      <div className="flex items-center gap-2 mb-2">
        <MsgIcon className="w-4 h-4" style={{ color: previewAccent }} />
        <span className="font-bold text-sm" style={{ color: previewText }}>{form.title || "عنوان الإشعار"}</span>
      </div>
      <p className="text-xs opacity-80 mb-2" style={{ color: previewText }}>{form.content || "محتوى الرسالة سيظهر هنا..."}</p>
      {effectEmoji && <span className="text-lg">{effectEmoji}</span>}
      {form.buttonText && (
        <button className="mt-2 px-3 py-1 rounded text-xs font-medium text-white" style={{ backgroundColor: previewAccent }}>
          {form.buttonText}
        </button>
      )}
      {form.soundEnabled && <Volume2 className="w-3 h-3 mt-1 opacity-50" style={{ color: previewText }} />}
    </div>
  );

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
        <Eye className="w-4 h-4" />
        معاينة مباشرة
      </h4>
      <div className="bg-gray-100 rounded-xl p-4 min-h-[200px] relative flex items-center justify-center border-2 border-dashed border-gray-300" data-testid="preview-panel">
        {form.displayStyle === "modal" && (
          <div className="w-full max-w-[240px]">
            <div className="bg-black/20 absolute inset-0 rounded-xl" />
            <div className="relative z-10">{renderPreviewContent()}</div>
          </div>
        )}
        {form.displayStyle === "fullscreen" && (
          <div className="absolute inset-2 rounded-lg overflow-hidden">
            {renderPreviewContent()}
          </div>
        )}
        {form.displayStyle === "banner" && (
          <div className="absolute top-2 left-2 right-2">
            {renderPreviewContent()}
          </div>
        )}
        {form.displayStyle === "slide_in" && (
          <div className="absolute left-2 top-2 bottom-2 w-[55%]">
            {renderPreviewContent()}
          </div>
        )}
      </div>
      <div className="text-xs text-gray-500 text-center">
        {DISPLAY_STYLES.find(s => s.value === form.displayStyle)?.label || "نافذة منبثقة"}
      </div>
    </div>
  );
}

export default function NotificationsManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, any>>({ ...DEFAULT_FORM });
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [previewNotification, setPreviewNotification] = useState<SystemNotification | null>(null);
  const [statsDialogId, setStatsDialogId] = useState<number | null>(null);

  const { data: notifications = [], isLoading } = useQuery<SystemNotification[]>({
    queryKey: ["/api/system-notifications"],
    queryFn: async () => {
      const res = await fetch("/api/system-notifications", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

  type ReadStatsEntry = { notificationId: number; readCount: number; dismissedCount: number; readers: { userId: string; username: string; readAt: string; dismissed: boolean }[] };
  const { data: readStats = [] } = useQuery<ReadStatsEntry[]>({
    queryKey: ["/api/system-notifications/read-stats"],
    queryFn: async () => {
      const res = await fetch("/api/system-notifications/read-stats", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const readStatsMap = useMemo(() => {
    const map = new Map<number, ReadStatsEntry>();
    readStats.forEach(s => map.set(s.notificationId, s));
    return map;
  }, [readStats]);

  const createMutation = useMutation({
    mutationFn: async (data: Partial<SystemNotification>) => {
      const res = await apiRequest("POST", "/api/system-notifications", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-notifications"] });
      toast({ title: "تم الإنشاء", description: "تم إنشاء الإشعار بنجاح" });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SystemNotification> }) => {
      const res = await apiRequest("PATCH", `/api/system-notifications/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-notifications"] });
      toast({ title: "تم التحديث", description: "تم تحديث الإشعار بنجاح" });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/system-notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-notifications"] });
      toast({ title: "تم الحذف", description: "تم حذف الإشعار بنجاح" });
      setDeleteConfirmId(null);
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/system-notifications/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-notifications"] });
      toast({ title: "تم التحديث" });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ ...DEFAULT_FORM });
  };

  const openCreate = () => {
    setForm({ ...DEFAULT_FORM, createdBy: user?.id || null });
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (n: SystemNotification) => {
    setForm({
      ...n,
      startDate: n.startDate ? new Date(n.startDate).toISOString().slice(0, 16) : null,
      endDate: n.endDate ? new Date(n.endDate).toISOString().slice(0, 16) : null,
    });
    setEditingId(n.id);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title || !form.content) {
      toast({ title: "تنبيه", description: "يرجى إدخال العنوان والمحتوى", variant: "destructive" });
      return;
    }
    const payload = { ...form };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const updateForm = (updates: Record<string, any>) => {
    setForm(prev => ({ ...prev, ...updates }));
  };

  const stats = useMemo(() => {
    const total = notifications.length;
    const active = notifications.filter(n => getNotificationStatus(n) === "active").length;
    const scheduled = notifications.filter(n => getNotificationStatus(n) === "scheduled").length;
    const expired = notifications.filter(n => getNotificationStatus(n) === "expired").length;
    return { total, active, scheduled, expired };
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      const status = getNotificationStatus(n);
      if (statusFilter !== "all" && statusFilter !== status) return false;
      if (typeFilter !== "all" && n.messageType !== typeFilter) return false;
      return true;
    });
  }, [notifications, statusFilter, typeFilter]);

  return (
    <Layout>
    <div className="p-3 sm:p-4 md:p-6 lg:p-10 max-w-6xl mx-auto space-y-4" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-3" data-testid="page-title">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#d4a017] to-[#b8860b] text-white">
                <Bell className="w-6 h-6" />
              </div>
              الإشعارات والرسائل العامة
            </h1>
            <p className="text-gray-500 mt-1 text-sm">إدارة الإشعارات والرسائل الموجهة للفروع والموظفين</p>
          </div>
          <Button
            data-testid="button-create-notification"
            onClick={openCreate}
            className="bg-gradient-to-r from-[#d4a017] to-[#b8860b] hover:from-[#b8860b] hover:to-[#9a7209] text-white shadow-lg"
          >
            <Plus className="w-4 h-4 ml-2" />
            إشعار جديد
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-white to-blue-50 border-blue-100 hover:shadow-md transition-shadow" data-testid="stat-total">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-xs text-gray-500 mt-1">إجمالي الإشعارات</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-white to-green-50 border-green-100 hover:shadow-md transition-shadow" data-testid="stat-active">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{stats.active}</div>
              <div className="text-xs text-gray-500 mt-1">نشط</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-white to-indigo-50 border-indigo-100 hover:shadow-md transition-shadow" data-testid="stat-scheduled">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-indigo-600">{stats.scheduled}</div>
              <div className="text-xs text-gray-500 mt-1">مجدول</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-white to-red-50 border-red-100 hover:shadow-md transition-shadow" data-testid="stat-expired">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-red-500">{stats.expired}</div>
              <div className="text-xs text-gray-500 mt-1">منتهي</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter} data-testid="select-status-filter">
              <SelectTrigger className="w-full sm:w-48" data-testid="trigger-status-filter">
                <SelectValue placeholder="حالة الإشعار" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="inactive">غير نشط</SelectItem>
                <SelectItem value="scheduled">مجدول</SelectItem>
                <SelectItem value="expired">منتهي</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter} data-testid="select-type-filter">
              <SelectTrigger className="w-full sm:w-48" data-testid="trigger-type-filter">
                <SelectValue placeholder="نوع الرسالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأنواع</SelectItem>
                {MESSAGE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">
                      <t.icon className="w-3 h-3" />
                      {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <Card className="border-dashed border-2 border-gray-300">
            <CardContent className="p-12 text-center">
              <BellOff className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-500 mb-2">لا توجد إشعارات</h3>
              <p className="text-sm text-gray-400 mb-4">ابدأ بإنشاء إشعار جديد للفروع والموظفين</p>
              <Button data-testid="button-create-empty" onClick={openCreate} variant="outline">
                <Plus className="w-4 h-4 ml-2" />
                إنشاء إشعار
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredNotifications.map(n => {
              const status = getNotificationStatus(n);
              const msgType = MESSAGE_TYPES.find(t => t.value === n.messageType);
              const MsgIcon = msgType?.icon || Megaphone;
              const branchNames = n.targetAllBranches
                ? "جميع الفروع"
                : (n.targetBranchIds || []).map(id => branches.find(b => b.id === id)?.name || id).join("، ");

              return (
                <Card
                  key={n.id}
                  data-testid={`card-notification-${n.id}`}
                  className={`group hover:shadow-lg transition-all duration-300 border-r-4 ${
                    status === "active" ? "border-r-green-500" :
                    status === "scheduled" ? "border-r-blue-500" :
                    status === "expired" ? "border-r-red-400" :
                    "border-r-gray-300"
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                      <div className={`p-3 rounded-xl ${msgType?.color || "bg-gray-100"} shrink-0`}>
                        <MsgIcon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-gray-800 text-lg">{n.title}</h3>
                          {n.emoji && <span className="text-xl">{n.emoji}</span>}
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{n.content}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={msgType?.color}>{msgType?.label || n.messageType}</Badge>
                          {getStatusBadge(status)}
                          <Badge variant="outline" className="bg-gray-50 text-gray-600">
                            <Target className="w-3 h-3 ml-1" />
                            {branchNames}
                          </Badge>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${i < n.priority ? "text-[#d4a017] fill-[#d4a017]" : "text-gray-300"}`}
                              />
                            ))}
                          </div>
                          {n.startDate && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(n.startDate).toLocaleDateString("ar-SA")}
                              {n.endDate && ` - ${new Date(n.endDate).toLocaleDateString("ar-SA")}`}
                            </span>
                          )}
                          {n.soundEnabled && <Volume2 className="w-3 h-3 text-gray-400" />}
                          {n.effectType && <span className="text-sm">{EFFECT_TYPES.find(e => e.value === n.effectType)?.emoji}</span>}
                          {(() => {
                            const nStats = readStatsMap.get(n.id);
                            if (!nStats || nStats.readCount === 0) return null;
                            return (
                              <button
                                data-testid={`button-stats-${n.id}`}
                                onClick={() => setStatsDialogId(n.id)}
                                className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full hover:bg-indigo-100 transition-colors cursor-pointer border border-indigo-200"
                              >
                                <Users className="w-3 h-3" />
                                <span>{nStats.readCount} قراءة</span>
                                {nStats.dismissedCount > 0 && (
                                  <>
                                    <span className="text-indigo-300">|</span>
                                    <XCircle className="w-3 h-3" />
                                    <span>{nStats.dismissedCount} إخفاء</span>
                                  </>
                                )}
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          data-testid={`button-preview-${n.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewNotification(n)}
                          className="text-purple-600 hover:text-purple-700"
                          title="إرسال تجريبي"
                        >
                          <PlayCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          data-testid={`button-toggle-${n.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActiveMutation.mutate({ id: n.id, isActive: !n.isActive })}
                          className={n.isActive ? "text-green-600 hover:text-green-700" : "text-gray-400 hover:text-gray-600"}
                        >
                          {n.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </Button>
                        <Button
                          data-testid={`button-edit-${n.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(n)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          data-testid={`button-delete-${n.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(n.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">هل أنت متأكد من حذف هذا الإشعار؟ لا يمكن التراجع عن هذا الإجراء.</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button data-testid="button-cancel-delete" variant="outline" onClick={() => setDeleteConfirmId(null)}>إلغاء</Button>
            <Button
              data-testid="button-confirm-delete"
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0" dir="rtl">
          <DialogHeader className="p-4 pb-0 border-b">
            <DialogTitle className="text-right text-lg flex items-center gap-2">
              {editingId ? <Edit className="w-5 h-5 text-[#d4a017]" /> : <Plus className="w-5 h-5 text-[#d4a017]" />}
              {editingId ? "تعديل الإشعار" : "إنشاء إشعار جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col md:flex-row h-[calc(90vh-120px)]">
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="content" className="h-full flex flex-col">
                <TabsList className="mx-4 mt-2 grid grid-cols-5 bg-gray-100" data-testid="dialog-tabs">
                  <TabsTrigger value="content" data-testid="tab-content" className="text-xs gap-1">
                    <FileText className="w-3 h-3" />
                    المحتوى
                  </TabsTrigger>
                  <TabsTrigger value="targeting" data-testid="tab-targeting" className="text-xs gap-1">
                    <Target className="w-3 h-3" />
                    الاستهداف
                  </TabsTrigger>
                  <TabsTrigger value="scheduling" data-testid="tab-scheduling" className="text-xs gap-1">
                    <Calendar className="w-3 h-3" />
                    الجدولة
                  </TabsTrigger>
                  <TabsTrigger value="design" data-testid="tab-design" className="text-xs gap-1">
                    <Palette className="w-3 h-3" />
                    التصميم
                  </TabsTrigger>
                  <TabsTrigger value="sound" data-testid="tab-sound" className="text-xs gap-1">
                    <Music className="w-3 h-3" />
                    الصوت
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 px-4 pb-4">
                  <TabsContent value="content" className="mt-4 space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">العنوان</Label>
                      <Input
                        data-testid="input-title"
                        value={form.title || ""}
                        onChange={e => updateForm({ title: e.target.value })}
                        placeholder="عنوان الإشعار..."
                        className="text-right"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">نوع الرسالة</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {MESSAGE_TYPES.map(t => (
                          <button
                            key={t.value}
                            data-testid={`button-type-${t.value}`}
                            onClick={() => updateForm({ messageType: t.value })}
                            className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                              form.messageType === t.value
                                ? "border-[#d4a017] bg-[#d4a017]/10 shadow-sm"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <div className={`p-1.5 rounded-lg ${t.color}`}>
                              <t.icon className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-medium">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">المحتوى</Label>
                      <Textarea
                        data-testid="input-content"
                        value={form.content || ""}
                        onChange={e => updateForm({ content: e.target.value })}
                        placeholder="اكتب محتوى الرسالة هنا..."
                        className="min-h-[100px] text-right"
                        rows={4}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">إيموجي</Label>
                      <div className="flex flex-wrap gap-1 p-2 bg-gray-50 rounded-lg border">
                        {COMMON_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            data-testid={`button-emoji-${emoji}`}
                            onClick={() => updateForm({ emoji: form.emoji === emoji ? null : emoji })}
                            className={`w-8 h-8 text-lg rounded-md hover:bg-gray-200 transition-colors flex items-center justify-center ${
                              form.emoji === emoji ? "bg-[#d4a017]/20 ring-2 ring-[#d4a017]" : ""
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      {form.emoji && (
                        <Button variant="ghost" size="sm" onClick={() => updateForm({ emoji: null })} className="mt-1 text-xs text-gray-500">
                          <X className="w-3 h-3 ml-1" /> إزالة الإيموجي
                        </Button>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">رابط الصورة (اختياري)</Label>
                      <Input
                        data-testid="input-image-url"
                        value={form.imageUrl || ""}
                        onChange={e => updateForm({ imageUrl: e.target.value || null })}
                        placeholder="https://example.com/image.png"
                        dir="ltr"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-medium mb-2 block">نص الزر (اختياري)</Label>
                        <Input
                          data-testid="input-button-text"
                          value={form.buttonText || ""}
                          onChange={e => updateForm({ buttonText: e.target.value || null })}
                          placeholder="مثلاً: اعرف المزيد"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-2 block">رابط الزر (اختياري)</Label>
                        <Input
                          data-testid="input-button-action"
                          value={form.buttonAction || ""}
                          onChange={e => updateForm({ buttonAction: e.target.value || null })}
                          placeholder="https://..."
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="targeting" className="mt-4 space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                      <div>
                        <Label className="text-sm font-medium">إرسال لجميع الفروع</Label>
                        <p className="text-xs text-gray-500 mt-1">سيتم عرض الإشعار في جميع الفروع</p>
                      </div>
                      <Switch
                        data-testid="switch-all-branches"
                        checked={form.targetAllBranches || false}
                        onCheckedChange={checked => updateForm({ targetAllBranches: checked, targetBranchIds: checked ? null : [] })}
                      />
                    </div>
                    {!form.targetAllBranches && (
                      <div>
                        <Label className="text-sm font-medium mb-3 block">اختر الفروع المستهدفة</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {branches.map(branch => {
                            const isSelected = (form.targetBranchIds || []).includes(branch.id);
                            return (
                              <label
                                key={branch.id}
                                data-testid={`checkbox-branch-${branch.id}`}
                                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                  isSelected ? "border-[#d4a017] bg-[#d4a017]/5" : "border-gray-200 hover:border-gray-300"
                                }`}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={checked => {
                                    const ids = form.targetBranchIds || [];
                                    updateForm({
                                      targetBranchIds: checked
                                        ? [...ids, branch.id]
                                        : ids.filter((id: string) => id !== branch.id),
                                    });
                                  }}
                                />
                                <span className="text-sm font-medium">{branch.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="scheduling" className="mt-4 space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
                      <p className="text-sm text-amber-800">
                        اتركي حقول التاريخ فارغة لتفعيل الإشعار فوراً. أو حددي تاريخ بداية ونهاية لجدولته.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          data-testid="checkbox-immediate"
                          checked={!form.startDate && !form.endDate}
                          onChange={e => {
                            if (e.target.checked) {
                              updateForm({ startDate: null, endDate: null });
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-sm font-medium text-gray-700">تفعيل فوري (بدون جدولة)</span>
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium mb-2 block">تاريخ البداية</Label>
                        <Input
                          data-testid="input-start-date"
                          type="datetime-local"
                          value={form.startDate || ""}
                          onChange={e => updateForm({ startDate: e.target.value || null })}
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-2 block">تاريخ النهاية</Label>
                        <Input
                          data-testid="input-end-date"
                          type="datetime-local"
                          value={form.endDate || ""}
                          onChange={e => updateForm({ endDate: e.target.value || null })}
                          dir="ltr"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium mb-2 block">وقت العرض من</Label>
                        <Input
                          data-testid="input-display-time-start"
                          type="time"
                          value={form.displayTimeStart || ""}
                          onChange={e => updateForm({ displayTimeStart: e.target.value || null })}
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-2 block">وقت العرض إلى</Label>
                        <Input
                          data-testid="input-display-time-end"
                          type="time"
                          value={form.displayTimeEnd || ""}
                          onChange={e => updateForm({ displayTimeEnd: e.target.value || null })}
                          dir="ltr"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                      <div>
                        <Label className="text-sm font-medium">عرض مرة واحدة فقط</Label>
                        <p className="text-xs text-gray-500 mt-1">لن يظهر للمستخدم مرة أخرى بعد الإغلاق</p>
                      </div>
                      <Switch
                        data-testid="switch-show-once"
                        checked={form.showOnce || false}
                        onCheckedChange={checked => updateForm({ showOnce: checked })}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">إغلاق تلقائي (ثواني)</Label>
                      <Input
                        data-testid="input-auto-close"
                        type="number"
                        min={0}
                        value={form.autoCloseSeconds ?? ""}
                        onChange={e => updateForm({ autoCloseSeconds: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="اتركه فارغاً للإغلاق اليدوي"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="design" className="mt-4 space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">نمط العرض</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {DISPLAY_STYLES.map(style => (
                          <button
                            key={style.value}
                            data-testid={`button-style-${style.value}`}
                            onClick={() => updateForm({ displayStyle: style.value })}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                              form.displayStyle === style.value
                                ? "border-[#d4a017] bg-[#d4a017]/10 shadow-md"
                                : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                            }`}
                          >
                            <div className={`p-2 rounded-lg ${form.displayStyle === style.value ? "bg-[#d4a017] text-white" : "bg-gray-100 text-gray-600"}`}>
                              <style.icon className="w-6 h-6" />
                            </div>
                            <span className="text-sm font-medium">{style.label}</span>
                            <span className="text-xs text-gray-400">{style.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-sm font-medium mb-2 block">لون الخلفية</Label>
                        <div className="flex items-center gap-2">
                          <input
                            data-testid="input-bg-color"
                            type="color"
                            value={form.backgroundColor || "#ffffff"}
                            onChange={e => updateForm({ backgroundColor: e.target.value })}
                            className="w-10 h-10 rounded-lg border cursor-pointer"
                          />
                          <Input
                            value={form.backgroundColor || "#ffffff"}
                            onChange={e => updateForm({ backgroundColor: e.target.value })}
                            className="text-xs"
                            dir="ltr"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-2 block">لون النص</Label>
                        <div className="flex items-center gap-2">
                          <input
                            data-testid="input-text-color"
                            type="color"
                            value={form.textColor || "#1a1a1a"}
                            onChange={e => updateForm({ textColor: e.target.value })}
                            className="w-10 h-10 rounded-lg border cursor-pointer"
                          />
                          <Input
                            value={form.textColor || "#1a1a1a"}
                            onChange={e => updateForm({ textColor: e.target.value })}
                            className="text-xs"
                            dir="ltr"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-2 block">لون التمييز</Label>
                        <div className="flex items-center gap-2">
                          <input
                            data-testid="input-accent-color"
                            type="color"
                            value={form.accentColor || "#d4a017"}
                            onChange={e => updateForm({ accentColor: e.target.value })}
                            className="w-10 h-10 rounded-lg border cursor-pointer"
                          />
                          <Input
                            value={form.accentColor || "#d4a017"}
                            onChange={e => updateForm({ accentColor: e.target.value })}
                            className="text-xs"
                            dir="ltr"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">نوع الحركة</Label>
                      <div className="flex flex-wrap gap-2">
                        {ANIMATION_TYPES.map(a => (
                          <button
                            key={a.value}
                            data-testid={`button-animation-${a.value}`}
                            onClick={() => updateForm({ animationType: a.value })}
                            className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                              form.animationType === a.value
                                ? "border-[#d4a017] bg-[#d4a017]/10 text-[#d4a017]"
                                : "border-gray-200 hover:border-gray-300 text-gray-600"
                            }`}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">تأثير خاص</Label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          data-testid="button-effect-none"
                          onClick={() => updateForm({ effectType: null })}
                          className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                            !form.effectType
                              ? "border-[#d4a017] bg-[#d4a017]/10 text-[#d4a017]"
                              : "border-gray-200 hover:border-gray-300 text-gray-600"
                          }`}
                        >
                          <Ban className="w-4 h-4 inline ml-1" />
                          بدون
                        </button>
                        {EFFECT_TYPES.map(e => (
                          <button
                            key={e.value}
                            data-testid={`button-effect-${e.value}`}
                            onClick={() => updateForm({ effectType: e.value })}
                            className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                              form.effectType === e.value
                                ? "border-[#d4a017] bg-[#d4a017]/10 text-[#d4a017]"
                                : "border-gray-200 hover:border-gray-300 text-gray-600"
                            }`}
                          >
                            <span className="ml-1">{e.emoji}</span>
                            {e.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">الأولوية: {form.priority || 1}</Label>
                      <Slider
                        data-testid="slider-priority"
                        value={[form.priority || 1]}
                        min={1}
                        max={5}
                        step={1}
                        onValueChange={([v]) => updateForm({ priority: v })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>منخفض</span>
                        <span>متوسط</span>
                        <span>عالي</span>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="sound" className="mt-4 space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-3">
                        {form.soundEnabled ? (
                          <Volume2 className="w-5 h-5 text-[#d4a017]" />
                        ) : (
                          <VolumeX className="w-5 h-5 text-gray-400" />
                        )}
                        <div>
                          <Label className="text-sm font-medium">تفعيل الصوت</Label>
                          <p className="text-xs text-gray-500 mt-1">تشغيل صوت عند ظهور الإشعار</p>
                        </div>
                      </div>
                      <Switch
                        data-testid="switch-sound"
                        checked={form.soundEnabled || false}
                        onCheckedChange={checked => updateForm({ soundEnabled: checked })}
                      />
                    </div>
                    {form.soundEnabled && (
                      <div>
                        <Label className="text-sm font-medium mb-3 block">نوع الصوت</Label>
                        <div className="grid grid-cols-1 gap-2">
                          {SOUND_TYPES.map(s => (
                            <button
                              key={s.value}
                              data-testid={`button-sound-${s.value}`}
                              onClick={() => updateForm({ soundType: s.value })}
                              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-right ${
                                form.soundType === s.value
                                  ? "border-[#d4a017] bg-[#d4a017]/10"
                                  : "border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <Music className={`w-4 h-4 ${form.soundType === s.value ? "text-[#d4a017]" : "text-gray-400"}`} />
                              <span className="text-sm font-medium">{s.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </div>

            <div className="w-full md:w-72 border-t md:border-t-0 md:border-r bg-gray-50 p-4 flex flex-col">
              <LivePreview form={form} />
              <div className="mt-auto pt-4 space-y-2">
                <Button
                  data-testid="button-submit"
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="w-full bg-gradient-to-r from-[#d4a017] to-[#b8860b] hover:from-[#b8860b] hover:to-[#9a7209] text-white"
                >
                  <Send className="w-4 h-4 ml-2" />
                  {createMutation.isPending || updateMutation.isPending
                    ? "جاري الحفظ..."
                    : editingId ? "تحديث الإشعار" : "إنشاء الإشعار"}
                </Button>
                <Button data-testid="button-cancel" variant="outline" onClick={closeDialog} className="w-full">
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={statsDialogId !== null} onOpenChange={() => setStatsDialogId(null)}>
        <DialogContent className="max-w-lg max-h-[80vh]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              إحصائيات القراءة
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const nStats = statsDialogId ? readStatsMap.get(statsDialogId) : null;
            const notif = statsDialogId ? notifications.find(n => n.id === statsDialogId) : null;
            if (!nStats || !notif) return <p className="text-sm text-gray-500 text-center py-8">لا توجد بيانات قراءة</p>;
            return (
              <div className="space-y-4">
                <div className="text-sm font-medium text-gray-700 bg-gray-50 p-3 rounded-lg">{notif.title}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{nStats.readCount}</div>
                    <div className="text-xs text-green-700 mt-1 flex items-center justify-center gap-1">
                      <Eye className="w-3 h-3" />
                      إجمالي القراءات
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-500">{nStats.dismissedCount}</div>
                    <div className="text-xs text-red-600 mt-1 flex items-center justify-center gap-1">
                      <XCircle className="w-3 h-3" />
                      تم الإخفاء
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    تفاصيل القراء ({nStats.readers.length})
                  </h4>
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {nStats.readers.map((reader, idx) => (
                        <div
                          key={idx}
                          data-testid={`reader-row-${idx}`}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d4a017] to-[#b8860b] text-white flex items-center justify-center text-xs font-bold">
                              {reader.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-800">{reader.username}</div>
                              <div className="text-xs text-gray-400">
                                {new Date(reader.readAt).toLocaleDateString("ar-SA")} - {new Date(reader.readAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                          <Badge className={reader.dismissed ? "bg-red-100 text-red-600 border-red-200" : "bg-green-100 text-green-600 border-green-200"}>
                            {reader.dismissed ? "أخفى" : "قرأ"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {previewNotification && (
        <>
          <style>{`
            @keyframes notifFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes notifSlideIn { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes notifBounce { 0% { opacity: 0; transform: scale(0.3); } 50% { opacity: 1; transform: scale(1.05); } 70% { transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
            @keyframes notifZoom { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
            @keyframes notifFlip { from { opacity: 0; transform: perspective(400px) rotateY(90deg); } to { opacity: 1; transform: perspective(400px) rotateY(0deg); } }
            @keyframes notifSlideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
            @keyframes notifSlideFromLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
            @keyframes notifBackdropIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes notifProgress { from { width: 100%; } to { width: 0%; } }
            @keyframes particleFall { 0% { opacity: 0; transform: translateY(-20px) rotate(0deg); } 10% { opacity: 1; } 90% { opacity: 1; } 100% { opacity: 0; transform: translateY(40px) rotate(360deg); } }
          `}</style>
          <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 999999, backgroundColor: "rgba(0,0,0,0.8)", color: "#fff", padding: "8px 20px", borderRadius: "8px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px", pointerEvents: "auto" }} data-testid="preview-banner">
            <PlayCircle className="w-4 h-4" />
            <span>وضع المعاينة التجريبية - هكذا سيظهر الإشعار للمستخدمين</span>
          </div>
          <NotificationContent
            notification={previewNotification as any}
            onDismiss={() => setPreviewNotification(null)}
            isPreview={true}
          />
        </>
      )}
    </div>
    </Layout>
  );
}
