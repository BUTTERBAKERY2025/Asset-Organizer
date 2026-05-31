import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  UserCircle, CalendarDays, Wallet, Plus, Clock, CheckCircle2, XCircle, Ban,
  Briefcase, Building2, Hash, AlertTriangle,
} from "lucide-react";
import {
  LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS, ADVANCE_REQUEST_STATUS_LABELS,
} from "@shared/schema";

type Profile = {
  hasEmployee: boolean;
  employee: any | null;
  branch: { id: string; name: string } | null;
};

const STATUS_STYLE: Record<string, { cls: string; icon: any }> = {
  pending: { cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400", icon: Clock },
  approved: { cls: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400", icon: CheckCircle2 },
  rejected: { cls: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
  cancelled: { cls: "bg-muted text-muted-foreground border-border", icon: Ban },
};

function StatusBadge({ status, labels }: { status: string; labels: Record<string, string> }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending;
  const Icon = s.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${s.cls}`} data-testid={`badge-status-${status}`}>
      <Icon className="h-3 w-3" />
      {labels[status] || status}
    </Badge>
  );
}

function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

export default function MyPortalPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);

  const todayMonth = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);

  const [leaveForm, setLeaveForm] = useState({ leaveType: "annual", startDate: today, endDate: today, reason: "" });
  const [advForm, setAdvForm] = useState({ amount: "", requestedMonth: todayMonth, installments: "1", reason: "" });

  const { data: profile, isLoading: profileLoading } = useQuery<Profile>({
    queryKey: ["/api/my/profile"],
    queryFn: async () => (await apiRequest("GET", "/api/my/profile")).json(),
  });

  const hasEmployee = profile?.hasEmployee;

  const { data: leaves = [] } = useQuery<any[]>({
    queryKey: ["/api/my/leaves"],
    queryFn: async () => (await apiRequest("GET", "/api/my/leaves")).json(),
    enabled: !!hasEmployee,
  });

  const { data: advances = [] } = useQuery<any[]>({
    queryKey: ["/api/my/advance-requests"],
    queryFn: async () => (await apiRequest("GET", "/api/my/advance-requests")).json(),
    enabled: !!hasEmployee,
  });

  const submitLeave = useMutation({
    mutationFn: async () => {
      const totalDays = daysBetween(leaveForm.startDate, leaveForm.endDate);
      if (totalDays <= 0) throw new Error("تواريخ غير صحيحة");
      return (await apiRequest("POST", "/api/my/leaves", {
        leaveType: leaveForm.leaveType,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        totalDays,
        reason: leaveForm.reason || undefined,
      })).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/my/leaves"] });
      toast({ title: "تم إرسال طلب الإجازة" });
      setLeaveOpen(false);
      setLeaveForm({ leaveType: "annual", startDate: today, endDate: today, reason: "" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الإرسال", variant: "destructive" }),
  });

  const cancelLeave = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/my/leaves/${id}/cancel`)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/my/leaves"] });
      toast({ title: "تم إلغاء الطلب" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الإلغاء", variant: "destructive" }),
  });

  const submitAdvance = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(advForm.amount);
      if (!amount || amount <= 0) throw new Error("أدخل مبلغاً صحيحاً");
      return (await apiRequest("POST", "/api/my/advance-requests", {
        amount,
        requestedMonth: advForm.requestedMonth,
        installments: parseInt(advForm.installments, 10) || 1,
        reason: advForm.reason || undefined,
      })).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/my/advance-requests"] });
      toast({ title: "تم إرسال طلب السلفة" });
      setAdvOpen(false);
      setAdvForm({ amount: "", requestedMonth: todayMonth, installments: "1", reason: "" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الإرسال", variant: "destructive" }),
  });

  const cancelAdvance = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/my/advance-requests/${id}/cancel`)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/my/advance-requests"] });
      toast({ title: "تم إلغاء الطلب" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الإلغاء", variant: "destructive" }),
  });

  const pendingLeaves = leaves.filter((l) => l.status === "pending").length;
  const pendingAdvances = advances.filter((a) => a.status === "pending").length;

  return (
    <Layout>
      <div className="container mx-auto p-4 space-y-4" dir="rtl" data-testid="page-my-portal">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <UserCircle className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">بوابتي</h1>
            <p className="text-sm text-muted-foreground">قدّم طلباتك وتابع حالتها</p>
          </div>
        </div>

        {profileLoading && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">جاري التحميل...</CardContent></Card>
        )}

        {!profileLoading && !hasEmployee && (
          <Card>
            <CardContent className="p-8 text-center space-y-3" data-testid="state-no-employee">
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
              <h2 className="text-lg font-semibold">حسابك غير مرتبط بملف موظف</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                لاستخدام بوابة الموظف، يجب ربط حسابك بملفك الوظيفي. الرجاء التواصل مع إدارة الموارد البشرية.
              </p>
            </CardContent>
          </Card>
        )}

        {!profileLoading && hasEmployee && (
          <>
            {/* بطاقة الموظف */}
            <Card>
              <CardContent className="p-4 flex flex-wrap items-center gap-x-8 gap-y-3" data-testid="card-employee">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {(profile?.employee?.employeeName || "؟").slice(0, 1)}
                  </div>
                  <div>
                    <div className="font-bold text-lg" data-testid="text-employee-name">{profile?.employee?.employeeName}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" />{profile?.employee?.jobTitle}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {profile?.branch?.name && (
                    <span className="flex items-center gap-1 text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{profile.branch.name}</span>
                  )}
                  {profile?.employee?.employeeNumber && (
                    <span className="flex items-center gap-1 text-muted-foreground"><Hash className="h-3.5 w-3.5" />{profile.employee.employeeNumber}</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="leaves" dir="rtl">
              <TabsList>
                <TabsTrigger value="leaves" data-testid="tab-leaves">
                  <CalendarDays className="h-4 w-4 ms-1" />إجازاتي
                  {pendingLeaves > 0 && <Badge variant="secondary" className="ms-1">{pendingLeaves}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="advances" data-testid="tab-advances">
                  <Wallet className="h-4 w-4 ms-1" />سلفي
                  {pendingAdvances > 0 && <Badge variant="secondary" className="ms-1">{pendingAdvances}</Badge>}
                </TabsTrigger>
              </TabsList>

              {/* الإجازات */}
              <TabsContent value="leaves" className="space-y-3">
                <div className="flex justify-end">
                  <Button onClick={() => setLeaveOpen(true)} data-testid="button-new-leave">
                    <Plus className="h-4 w-4 ms-1" />طلب إجازة جديد
                  </Button>
                </div>
                {leaves.length === 0 && (
                  <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد طلبات إجازة بعد</CardContent></Card>
                )}
                {leaves.map((l) => (
                  <Card key={l.id} data-testid={`row-leave-${l.id}`}>
                    <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-semibold">{LEAVE_TYPE_LABELS[l.leaveType] || l.leaveType}</div>
                        <div className="text-sm text-muted-foreground">
                          من {l.startDate} إلى {l.endDate} · {l.totalDays} يوم
                        </div>
                        {l.reason && <div className="text-xs text-muted-foreground">{l.reason}</div>}
                        {l.reviewerNote && <div className="text-xs text-muted-foreground">ملاحظة المراجع: {l.reviewerNote}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={l.status} labels={LEAVE_STATUS_LABELS} />
                        {l.status === "pending" && (
                          <Button size="sm" variant="ghost" className="text-destructive"
                            onClick={() => { if (confirm("إلغاء هذا الطلب؟")) cancelLeave.mutate(l.id); }}
                            data-testid={`button-cancel-leave-${l.id}`}>
                            إلغاء
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* السلف */}
              <TabsContent value="advances" className="space-y-3">
                <div className="flex justify-end">
                  <Button onClick={() => setAdvOpen(true)} data-testid="button-new-advance">
                    <Plus className="h-4 w-4 ms-1" />طلب سلفة جديد
                  </Button>
                </div>
                {advances.length === 0 && (
                  <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد طلبات سلف بعد</CardContent></Card>
                )}
                {advances.map((a) => (
                  <Card key={a.id} data-testid={`row-advance-${a.id}`}>
                    <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-semibold tabular-nums">{Number(a.amount).toLocaleString("ar-SA-u-nu-latn")} ر.س</div>
                        <div className="text-sm text-muted-foreground">
                          شهر الخصم: {a.requestedMonth}{a.installments > 1 ? ` · ${a.installments} أقساط` : ""}
                        </div>
                        {a.reason && <div className="text-xs text-muted-foreground">{a.reason}</div>}
                        {a.reviewerNote && <div className="text-xs text-muted-foreground">ملاحظة المراجع: {a.reviewerNote}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={a.status} labels={ADVANCE_REQUEST_STATUS_LABELS} />
                        {a.status === "pending" && (
                          <Button size="sm" variant="ghost" className="text-destructive"
                            onClick={() => { if (confirm("إلغاء هذا الطلب؟")) cancelAdvance.mutate(a.id); }}
                            data-testid={`button-cancel-advance-${a.id}`}>
                            إلغاء
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* نموذج طلب إجازة */}
        <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader><DialogTitle>طلب إجازة جديد</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>نوع الإجازة</Label>
                <Select value={leaveForm.leaveType} onValueChange={(v) => setLeaveForm({ ...leaveForm, leaveType: v })}>
                  <SelectTrigger data-testid="select-leave-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>من تاريخ</Label>
                  <Input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} data-testid="input-leave-start" />
                </div>
                <div>
                  <Label>إلى تاريخ</Label>
                  <Input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} data-testid="input-leave-end" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                عدد الأيام: <span className="font-bold text-foreground">{daysBetween(leaveForm.startDate, leaveForm.endDate)}</span>
              </div>
              <div>
                <Label>السبب (اختياري)</Label>
                <Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} data-testid="textarea-leave-reason" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLeaveOpen(false)}>إلغاء</Button>
              <Button onClick={() => submitLeave.mutate()} disabled={submitLeave.isPending} data-testid="button-submit-leave">
                {submitLeave.isPending ? "جاري الإرسال..." : "إرسال الطلب"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* نموذج طلب سلفة */}
        <Dialog open={advOpen} onOpenChange={setAdvOpen}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader><DialogTitle>طلب سلفة جديد</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>المبلغ (ر.س)</Label>
                  <Input type="number" step="0.01" value={advForm.amount} onChange={(e) => setAdvForm({ ...advForm, amount: e.target.value })} data-testid="input-advance-amount" />
                </div>
                <div>
                  <Label>شهر الخصم</Label>
                  <Input type="month" value={advForm.requestedMonth} onChange={(e) => setAdvForm({ ...advForm, requestedMonth: e.target.value })} data-testid="input-advance-month" />
                </div>
              </div>
              <div>
                <Label>عدد الأقساط</Label>
                <Input type="number" min="1" value={advForm.installments} onChange={(e) => setAdvForm({ ...advForm, installments: e.target.value })} data-testid="input-advance-installments" />
              </div>
              <div>
                <Label>السبب (اختياري)</Label>
                <Textarea value={advForm.reason} onChange={(e) => setAdvForm({ ...advForm, reason: e.target.value })} data-testid="textarea-advance-reason" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdvOpen(false)}>إلغاء</Button>
              <Button onClick={() => submitAdvance.mutate()} disabled={submitAdvance.isPending} data-testid="button-submit-advance">
                {submitAdvance.isPending ? "جاري الإرسال..." : "إرسال الطلب"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
