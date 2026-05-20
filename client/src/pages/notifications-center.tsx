import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

async function api<T = any>(method: string, url: string, data?: any): Promise<T> {
  const res = await apiRequest(method, url, data);
  return res.json();
}
import { MessageCircle, Send, Calendar, Play, RefreshCw, Trash2, Plus, AlertTriangle, FileText } from "lucide-react";

type Schedule = {
  id: number;
  name: string;
  reportType: string;
  branchId: string | null;
  recipients: Array<{ phone: string; name?: string; channels?: string[] }>;
  dayOfMonth: number;
  hour: number;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  notes: string | null;
};

type QueueItem = {
  id: number;
  recipientPhone: string;
  recipientName: string | null;
  channel: string;
  message: string;
  status: string;
  errorMessage: string | null;
  retryCount: number;
  sentAt: string | null;
  createdAt: string;
  relatedModule: string | null;
};

type Branch = { id: string; name: string };

const STATUS_BADGES: Record<string, { variant: any; label: string }> = {
  pending: { variant: "secondary", label: "قيد الانتظار" },
  sent: { variant: "default", label: "تم الإرسال" },
  failed: { variant: "destructive", label: "فشل" },
};

export default function NotificationsCenterPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState("schedules");

  const { data: status } = useQuery<{ twilioConfigured: boolean; reportTypes: Record<string, string> }>({
    queryKey: ["/api/notifications-center/status"],
  });
  const { data: branches = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"] });
  const { data: schedules = [], isLoading: loadingSchedules } = useQuery<Schedule[]>({
    queryKey: ["/api/report-schedules"],
  });
  const { data: queue = [], isLoading: loadingQueue } = useQuery<QueueItem[]>({
    queryKey: ["/api/notification-queue"],
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? false : 15000),
  });

  const reportTypes = status?.reportTypes || {};
  const reportLabel = (t: string) => reportTypes[t] || t;
  const branchName = (id: string | null) => (id ? branches.find(b => b.id === id)?.name || id : "جميع الفروع");

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <MessageCircle className="h-6 w-6" />
            مركز الإشعارات والتقارير الآلية
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            تكامل واتساب عبر Twilio مع جدولة تقارير شهرية لكل فرع
          </p>
        </div>
        {status && (
          <Badge variant={status.twilioConfigured ? "default" : "destructive"} data-testid="status-twilio">
            {status.twilioConfigured ? "Twilio متصل" : "Twilio غير مهيأ"}
          </Badge>
        )}
      </div>

      {status && !status.twilioConfigured && (
        <Alert variant="destructive" data-testid="alert-twilio-missing">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            متغيرات Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) غير مكتملة. الجداول ستُنشئ التقارير ولكن لن تُرسل الرسائل حتى يتم تهيئتها.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="schedules" data-testid="tab-schedules">
            <Calendar className="h-4 w-4 ml-2" />جدولة التقارير ({schedules.length})
          </TabsTrigger>
          <TabsTrigger value="queue" data-testid="tab-queue">
            <Send className="h-4 w-4 ml-2" />قائمة الإرسال ({queue.length})
          </TabsTrigger>
          <TabsTrigger value="test" data-testid="tab-test">
            <MessageCircle className="h-4 w-4 ml-2" />اختبار واتساب
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedules">
          <SchedulesTab
            schedules={schedules}
            loading={loadingSchedules}
            branches={branches}
            reportTypes={reportTypes}
            reportLabel={reportLabel}
            branchName={branchName}
          />
        </TabsContent>

        <TabsContent value="queue">
          <QueueTab queue={queue} loading={loadingQueue} />
        </TabsContent>

        <TabsContent value="test">
          <TestTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SchedulesTab({
  schedules,
  loading,
  branches,
  reportTypes,
  reportLabel,
  branchName,
}: {
  schedules: Schedule[];
  loading: boolean;
  branches: Branch[];
  reportTypes: Record<string, string>;
  reportLabel: (t: string) => string;
  branchName: (id: string | null) => string;
}) {
  const { toast } = useToast();
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [previewBody, setPreviewBody] = useState<string | null>(null);

  const runMut = useMutation({
    mutationFn: async (id: number) => api("POST", `/api/report-schedules/${id}/run-now`),
    onSuccess: () => {
      toast({ title: "تم تشغيل التقرير", description: "تمت إضافة الرسائل لقائمة الإرسال" });
      queryClient.invalidateQueries({ queryKey: ["/api/notification-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/report-schedules"] });
    },
    onError: (e: any) => toast({ title: "فشل التشغيل", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => api("DELETE", `/api/report-schedules/${id}`),
    onSuccess: () => {
      toast({ title: "تم الحذف" });
      queryClient.invalidateQueries({ queryKey: ["/api/report-schedules"] });
    },
    onError: (e: any) => toast({ title: "فشل الحذف", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) =>
      api("PUT", `/api/report-schedules/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/report-schedules"] }),
  });

  const previewMut = useMutation({
    mutationFn: async (s: Schedule) => {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const periodMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
      return api("POST", "/api/reports/preview", { reportType: s.reportType, periodMonth, branchId: s.branchId });
    },
    onSuccess: (data: any) => setPreviewBody(data.body),
    onError: (e: any) => toast({ title: "فشل المعاينة", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>جداول التقارير الشهرية</CardTitle>
        <Button onClick={() => { setEditing(null); setOpenDialog(true); }} data-testid="button-add-schedule">
          <Plus className="h-4 w-4 ml-2" />إضافة جدول جديد
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground p-8">جارِ التحميل...</p>
        ) : schedules.length === 0 ? (
          <p className="text-center text-muted-foreground p-8">لا توجد جداول. أضف جدولاً لبدء إرسال التقارير الشهرية تلقائياً.</p>
        ) : (
          <div className="space-y-3">
            {schedules.map(s => (
              <div key={s.id} className="border rounded-lg p-4 space-y-2" data-testid={`card-schedule-${s.id}`}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-semibold flex items-center gap-2" data-testid={`text-schedule-name-${s.id}`}>
                      {s.name}
                      <Badge variant={s.isActive ? "default" : "secondary"}>{s.isActive ? "نشط" : "موقوف"}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {reportLabel(s.reportType)} • {branchName(s.branchId)} • يوم {s.dayOfMonth} الساعة {String(s.hour).padStart(2, "0")}:00
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      المستلمون: {s.recipients.length} • التشغيل التالي: {s.nextRunAt ? new Date(s.nextRunAt).toLocaleString("ar-SA") : "-"} • آخر تشغيل: {s.lastRunAt ? new Date(s.lastRunAt).toLocaleString("ar-SA") : "لم يُشغّل بعد"}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Switch
                      checked={s.isActive}
                      onCheckedChange={(v) => toggleMut.mutate({ id: s.id, isActive: v })}
                      data-testid={`switch-active-${s.id}`}
                    />
                    <Button size="sm" variant="outline" onClick={() => previewMut.mutate(s)} disabled={previewMut.isPending} data-testid={`button-preview-${s.id}`}>
                      <FileText className="h-4 w-4 ml-1" />معاينة
                    </Button>
                    <Button size="sm" onClick={() => runMut.mutate(s.id)} disabled={runMut.isPending} data-testid={`button-run-${s.id}`}>
                      <Play className="h-4 w-4 ml-1" />تشغيل الآن
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditing(s); setOpenDialog(true); }} data-testid={`button-edit-${s.id}`}>
                      تعديل
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { if (confirm(`حذف الجدول "${s.name}"؟`)) deleteMut.mutate(s.id); }} data-testid={`button-delete-${s.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ScheduleDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        editing={editing}
        branches={branches}
        reportTypes={reportTypes}
      />

      <Dialog open={!!previewBody} onOpenChange={() => setPreviewBody(null)}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader><DialogTitle>معاينة التقرير (آخر شهر)</DialogTitle></DialogHeader>
          <pre className="whitespace-pre-wrap bg-muted p-4 rounded text-sm" data-testid="text-preview-body">{previewBody}</pre>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ScheduleDialog({
  open, onClose, editing, branches, reportTypes,
}: {
  open: boolean;
  onClose: () => void;
  editing: Schedule | null;
  branches: Branch[];
  reportTypes: Record<string, string>;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [reportType, setReportType] = useState("monthly_sales");
  const [branchId, setBranchId] = useState<string>("");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hour, setHour] = useState(8);
  const [recipientsText, setRecipientsText] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    if (editing) {
      setName(editing.name);
      setReportType(editing.reportType);
      setBranchId(editing.branchId || "");
      setDayOfMonth(editing.dayOfMonth);
      setHour(editing.hour);
      setRecipientsText(editing.recipients.map(r => `${r.phone}${r.name ? `, ${r.name}` : ""}`).join("\n"));
      setNotes(editing.notes || "");
    } else {
      setName(""); setReportType("monthly_sales"); setBranchId("");
      setDayOfMonth(1); setHour(8); setRecipientsText(""); setNotes("");
    }
  };

  // Reset when opening or editing changes
  useState(() => { reset(); });

  const saveMut = useMutation({
    mutationFn: async () => {
      const recipients = recipientsText.split("\n").map(line => line.trim()).filter(Boolean).map(line => {
        const [phone, name] = line.split(",").map(s => s.trim());
        return { phone, name: name || undefined, channels: ["whatsapp"] };
      });
      if (recipients.length === 0) throw new Error("يجب إضافة مستلم واحد على الأقل");
      const payload = {
        name, reportType, branchId: branchId || null,
        recipients, dayOfMonth, hour,
        isActive: true, notes: notes || null,
      };
      if (editing) {
        return api("PUT", `/api/report-schedules/${editing.id}`, payload);
      } else {
        return api("POST", "/api/report-schedules", payload);
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "تم التحديث" : "تم الإنشاء" });
      queryClient.invalidateQueries({ queryKey: ["/api/report-schedules"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "فشل الحفظ", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) reset(); else onClose(); }}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "تعديل جدول" : "جدول جديد"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>اسم الجدول</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: مبيعات فرع الرياض الشهرية" data-testid="input-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>نوع التقرير</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger data-testid="select-report-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(reportTypes).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v as string}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الفرع</Label>
              <Select value={branchId || "all"} onValueChange={(v) => setBranchId(v === "all" ? "" : v)}>
                <SelectTrigger data-testid="select-branch"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>يوم الإرسال (1-28)</Label>
              <Input type="number" min={1} max={28} value={dayOfMonth} onChange={(e) => setDayOfMonth(parseInt(e.target.value, 10) || 1)} data-testid="input-day" />
            </div>
            <div>
              <Label>الساعة (0-23)</Label>
              <Input type="number" min={0} max={23} value={hour} onChange={(e) => setHour(parseInt(e.target.value, 10) || 0)} data-testid="input-hour" />
            </div>
          </div>
          <div>
            <Label>المستلمون (سطر لكل مستلم: رقم, اسم)</Label>
            <Textarea
              value={recipientsText}
              onChange={(e) => setRecipientsText(e.target.value)}
              placeholder={"+966500000000, أحمد المدير\n+966511111111, سارة المحاسبة"}
              rows={5}
              data-testid="input-recipients"
            />
            <p className="text-xs text-muted-foreground mt-1">صيغة الرقم: 9665XXXXXXXX أو 05XXXXXXXX (سيتم تنسيقه تلقائياً)</p>
          </div>
          <div>
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} data-testid="input-notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel">إلغاء</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !name} data-testid="button-save">
            {saveMut.isPending ? "جارِ الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QueueTab({ queue, loading }: { queue: QueueItem[]; loading: boolean }) {
  const { toast } = useToast();
  const retryMut = useMutation({
    mutationFn: async (id: number) => api("POST", `/api/notification-queue/${id}/retry`),
    onSuccess: () => {
      toast({ title: "تمت إعادة المحاولة" });
      queryClient.invalidateQueries({ queryKey: ["/api/notification-queue"] });
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle>قائمة الإرسال (آخر 200)</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground p-8">جارِ التحميل...</p>
        ) : queue.length === 0 ? (
          <p className="text-center text-muted-foreground p-8">لا توجد رسائل في القائمة</p>
        ) : (
          <div className="space-y-2">
            {queue.map(item => {
              const badge = STATUS_BADGES[item.status] || { variant: "secondary", label: item.status };
              return (
                <div key={item.id} className="border rounded p-3 text-sm" data-testid={`row-queue-${item.id}`}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                        <Badge variant="outline">{item.channel}</Badge>
                        <span className="font-medium" data-testid={`text-recipient-${item.id}`}>{item.recipientPhone}</span>
                        {item.recipientName && <span className="text-muted-foreground">({item.recipientName})</span>}
                        {item.retryCount > 0 && <Badge variant="outline">محاولات: {item.retryCount}</Badge>}
                      </div>
                      <div className="text-muted-foreground text-xs mt-1 truncate max-w-2xl" title={item.message}>
                        {item.message.slice(0, 120)}{item.message.length > 120 ? "..." : ""}
                      </div>
                      {item.errorMessage && (
                        <div className="text-destructive text-xs mt-1" data-testid={`text-error-${item.id}`}>خطأ: {item.errorMessage}</div>
                      )}
                      <div className="text-muted-foreground text-xs mt-1">
                        {new Date(item.createdAt).toLocaleString("ar-SA")}
                        {item.sentAt && ` • أُرسل: ${new Date(item.sentAt).toLocaleString("ar-SA")}`}
                        {item.relatedModule && ` • ${item.relatedModule}`}
                      </div>
                    </div>
                    {item.status === "failed" && (
                      <Button size="sm" variant="outline" onClick={() => retryMut.mutate(item.id)} data-testid={`button-retry-${item.id}`}>
                        <RefreshCw className="h-3 w-3 ml-1" />إعادة
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TestTab() {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("رسالة اختبار من نظام إدارة باتر");

  const testMut = useMutation({
    mutationFn: async () => api("POST", "/api/notification-queue/test-whatsapp", { phone, message }),
    onSuccess: (r: any) => {
      if (r.success) {
        toast({ title: "تم الإرسال", description: `معرّف الرسالة: ${r.messageId}` });
      } else {
        toast({ title: "فشل الإرسال", description: r.error, variant: "destructive" });
      }
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader><CardTitle>إرسال رسالة اختبارية فورية</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Alert>
          <AlertDescription>
            ملاحظة: في وضع Twilio Sandbox، يجب على المستلم إرسال كلمة الانضمام للرقم 14155238886 أولاً قبل تلقي أي رسالة.
          </AlertDescription>
        </Alert>
        <div>
          <Label>رقم الهاتف</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966500000000" data-testid="input-test-phone" />
        </div>
        <div>
          <Label>الرسالة</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} data-testid="input-test-message" />
        </div>
        <Button onClick={() => testMut.mutate()} disabled={testMut.isPending || !phone || !message} data-testid="button-send-test">
          <Send className="h-4 w-4 ml-2" />{testMut.isPending ? "جارِ الإرسال..." : "إرسال الآن"}
        </Button>
      </CardContent>
    </Card>
  );
}
