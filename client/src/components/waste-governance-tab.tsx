import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  ShieldAlert, ShieldCheck, Plus, Trash2, Check, AlertTriangle,
  Settings2, Bell, Power, Pencil,
} from "lucide-react";

interface Branch {
  id: string;
  name: string;
}

interface WasteRiskRule {
  id: number;
  name: string;
  branchId: string | null;
  category: string | null;
  productName: string | null;
  thresholdType: string;
  thresholdValue: number;
  periodDays: number | null;
  severity: string | null;
  isActive: boolean;
}

interface WasteRiskAlert {
  id: number;
  ruleId: number;
  branchId: string;
  alertDate: string;
  productName: string | null;
  category: string | null;
  currentValue: number;
  thresholdValue: number;
  severity: string | null;
  status: string | null;
  resolutionNotes: string | null;
}

const RULE_TYPES: { value: string; label: string; hint: string; unit: string }[] = [
  { value: "daily_waste_percent", label: "نسبة الهدر اليومي للفرع", hint: "ينبّه عند تجاوز نسبة الهدر اليومي للحد", unit: "%" },
  { value: "repeat_days", label: "تكرار هدر الصنف", hint: "ينبّه عند تكرار هدر نفس الصنف خلال عدة أيام", unit: "يوم" },
  { value: "shortage", label: "فجوة العجز غير المبرر", hint: "ينبّه عند وجود عجز (منتَج أكثر من المباع + الهالك)", unit: "وحدة" },
  { value: "approval_gate", label: "بوابة موافقة المدير", hint: "يُلزم بتبرير المدير قبل اعتماد التقرير عند تجاوز النسبة", unit: "%" },
];

const SEVERITY_META: Record<string, { label: string; cls: string }> = {
  low: { label: "منخفض", cls: "bg-muted text-muted-foreground border-border" },
  medium: { label: "متوسط", cls: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900" },
  high: { label: "مرتفع", cls: "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300" },
  critical: { label: "حرج", cls: "bg-destructive/10 text-destructive border-destructive/30" },
};

function typeLabel(t: string) {
  return RULE_TYPES.find((r) => r.value === t)?.label || t;
}
function typeUnit(t: string) {
  return RULE_TYPES.find((r) => r.value === t)?.unit || "";
}

const emptyForm = {
  id: 0,
  name: "",
  branchId: "all" as string,
  category: "",
  productName: "",
  thresholdType: "daily_waste_percent",
  thresholdValue: "" as string,
  periodDays: "7" as string,
  severity: "medium",
  isActive: true,
};

interface Props {
  branches: Branch[];
  selectedBranch: string;
  getBranchName: (id: string | null) => string;
  canManage?: boolean;
}

export function WasteGovernanceTab({ branches, selectedBranch, getBranchName, canManage = true }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [resolveTarget, setResolveTarget] = useState<WasteRiskAlert | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const alertsQuery = useQuery<WasteRiskAlert[]>({
    queryKey: ["/api/waste-risk-alerts", selectedBranch, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== "all") params.set("branchId", selectedBranch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await apiRequest("GET", `/api/waste-risk-alerts?${params.toString()}`);
      return res.json();
    },
  });

  const rulesQuery = useQuery<WasteRiskRule[]>({
    queryKey: ["/api/waste-risk-rules", selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== "all") params.set("branchId", selectedBranch);
      const res = await apiRequest("GET", `/api/waste-risk-rules?${params.toString()}`);
      return res.json();
    },
  });

  const alerts = alertsQuery.data || [];
  const rules = rulesQuery.data || [];

  const openCount = alerts.filter((a) => a.status === "open").length;
  const criticalCount = alerts.filter((a) => a.severity === "critical" && a.status === "open").length;
  const highCount = alerts.filter((a) => a.severity === "high" && a.status === "open").length;

  const invalidateAlerts = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/waste-risk-alerts"] });
  };

  const acknowledgeMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("POST", `/api/waste-risk-alerts/${id}/acknowledge`),
    onSuccess: () => {
      invalidateAlerts();
      toast({ title: "تم الإقرار بالتنبيه" });
    },
    onError: () => toast({ title: "تعذّر الإقرار بالتنبيه", variant: "destructive" }),
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) =>
      apiRequest("POST", `/api/waste-risk-alerts/${id}/resolve`, { resolutionNotes: notes }),
    onSuccess: () => {
      invalidateAlerts();
      setResolveTarget(null);
      setResolutionNotes("");
      toast({ title: "تم حل التنبيه" });
    },
    onError: () => toast({ title: "تعذّر حل التنبيه", variant: "destructive" }),
  });

  const saveRuleMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name.trim(),
        branchId: form.branchId === "all" ? null : form.branchId,
        category: form.category.trim() || null,
        productName: form.productName.trim() || null,
        thresholdType: form.thresholdType,
        thresholdValue: parseFloat(form.thresholdValue),
        periodDays: parseInt(form.periodDays || "1", 10) || 1,
        severity: form.severity,
        isActive: form.isActive,
      };
      if (form.id) {
        return apiRequest("PATCH", `/api/waste-risk-rules/${form.id}`, payload);
      }
      return apiRequest("POST", "/api/waste-risk-rules", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waste-risk-rules"] });
      setShowRuleDialog(false);
      setForm({ ...emptyForm });
      toast({ title: "تم حفظ القاعدة" });
    },
    onError: () => toast({ title: "تعذّر حفظ القاعدة", variant: "destructive" }),
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PATCH", `/api/waste-risk-rules/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waste-risk-rules"] });
    },
    onError: () => toast({ title: "تعذّر تحديث القاعدة", variant: "destructive" }),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/waste-risk-rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waste-risk-rules"] });
      toast({ title: "تم حذف القاعدة" });
    },
    onError: () => toast({ title: "تعذّر حذف القاعدة", variant: "destructive" }),
  });

  const openCreate = () => {
    setForm({ ...emptyForm, branchId: selectedBranch && selectedBranch !== "all" ? selectedBranch : "all" });
    setShowRuleDialog(true);
  };

  const openEdit = (rule: WasteRiskRule) => {
    setForm({
      id: rule.id,
      name: rule.name,
      branchId: rule.branchId || "all",
      category: rule.category || "",
      productName: rule.productName || "",
      thresholdType: rule.thresholdType,
      thresholdValue: String(rule.thresholdValue),
      periodDays: String(rule.periodDays ?? 7),
      severity: rule.severity || "medium",
      isActive: rule.isActive,
    });
    setShowRuleDialog(true);
  };

  const canSubmit = form.name.trim().length > 0 && form.thresholdValue !== "" && !isNaN(parseFloat(form.thresholdValue));
  const needsPeriod = form.thresholdType === "repeat_days" || form.thresholdType === "shortage";

  return (
    <div className="space-y-6" data-testid="governance-tab">
      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card data-testid="kpi-open-alerts">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary"><Bell className="w-5 h-5" /></div>
            <div>
              <div className="text-2xl font-bold" data-testid="text-open-count">{openCount}</div>
              <div className="text-xs text-muted-foreground">تنبيهات مفتوحة</div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="kpi-critical-alerts">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10 text-destructive"><ShieldAlert className="w-5 h-5" /></div>
            <div>
              <div className="text-2xl font-bold text-destructive" data-testid="text-critical-count">{criticalCount}</div>
              <div className="text-xs text-muted-foreground">حرجة</div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="kpi-high-alerts">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <div className="text-2xl font-bold text-amber-600" data-testid="text-high-count">{highCount}</div>
              <div className="text-xs text-muted-foreground">مرتفعة</div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="kpi-active-rules">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-600"><ShieldCheck className="w-5 h-5" /></div>
            <div>
              <div className="text-2xl font-bold" data-testid="text-rules-count">{rules.filter((r) => r.isActive).length}</div>
              <div className="text-xs text-muted-foreground">قواعد مفعّلة</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-5 h-5 text-primary" /> التنبيهات
          </CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-alert-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">مفتوحة</SelectItem>
              <SelectItem value="acknowledged">تم الإقرار</SelectItem>
              <SelectItem value="resolved">محلولة</SelectItem>
              <SelectItem value="all">الكل</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {alertsQuery.isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
          ) : alerts.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground" data-testid="empty-alerts">
              <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-green-500" />
              لا توجد تنبيهات {statusFilter === "open" ? "مفتوحة" : ""}
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => {
                const sev = SEVERITY_META[a.severity || "medium"] || SEVERITY_META.medium;
                const rule = rules.find((r) => r.id === a.ruleId);
                return (
                  <div
                    key={a.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card"
                    data-testid={`alert-row-${a.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className={sev.cls} data-testid={`badge-severity-${a.id}`}>{sev.label}</Badge>
                      <div>
                        <div className="font-medium text-sm">
                          {rule ? typeLabel(rule.thresholdType) : "تنبيه"} — {getBranchName(a.branchId)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {a.productName ? `صنف #${a.productName} · ` : ""}
                          القيمة الحالية: <span className="font-semibold text-foreground">{a.currentValue}</span>
                          {" "}/ الحد: {a.thresholdValue} · {a.alertDate}
                        </div>
                        {a.resolutionNotes && (
                          <div className="text-xs text-muted-foreground mt-1">ملاحظة الحل: {a.resolutionNotes}</div>
                        )}
                      </div>
                    </div>
                    {a.status === "open" || a.status === "acknowledged" ? (
                      <div className="flex items-center gap-2 shrink-0">
                        {a.status === "open" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => acknowledgeMutation.mutate(a.id)}
                            disabled={acknowledgeMutation.isPending}
                            data-testid={`button-acknowledge-${a.id}`}
                          >
                            <Check className="w-4 h-4 ml-1" /> إقرار
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => { setResolveTarget(a); setResolutionNotes(""); }}
                          data-testid={`button-resolve-${a.id}`}
                        >
                          <ShieldCheck className="w-4 h-4 ml-1" /> حل
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="outline" className="bg-green-50 dark:bg-green-950/40 text-green-700 border-green-200 shrink-0">محلول</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rules */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="w-5 h-5 text-primary" /> قواعد الحوكمة
          </CardTitle>
          {canManage && (
            <Button size="sm" onClick={openCreate} data-testid="button-add-rule">
              <Plus className="w-4 h-4 ml-1" /> قاعدة جديدة
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {rulesQuery.isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
          ) : rules.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground" data-testid="empty-rules">
              <Settings2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
              لا توجد قواعد بعد. أضف قاعدة لبدء المراقبة.
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((r) => {
                const sev = SEVERITY_META[r.severity || "medium"] || SEVERITY_META.medium;
                return (
                  <div
                    key={r.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card"
                    data-testid={`rule-row-${r.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className={sev.cls}>{sev.label}</Badge>
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          {r.name}
                          {!r.isActive && <span className="text-xs text-muted-foreground">(موقوفة)</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {typeLabel(r.thresholdType)} · الحد: {r.thresholdValue}{typeUnit(r.thresholdType) ? ` ${typeUnit(r.thresholdType)}` : ""}
                          {(r.thresholdType === "repeat_days" || r.thresholdType === "shortage") && r.periodDays ? ` · خلال ${r.periodDays} يوم` : ""}
                          {" · "}{r.branchId ? getBranchName(r.branchId) : "كل الفروع"}
                          {r.category ? ` · فئة: ${r.category}` : ""}
                        </div>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          title={r.isActive ? "إيقاف" : "تفعيل"}
                          onClick={() => toggleRuleMutation.mutate({ id: r.id, isActive: !r.isActive })}
                          data-testid={`button-toggle-rule-${r.id}`}
                        >
                          <Power className={`w-4 h-4 ${r.isActive ? "text-green-600" : "text-muted-foreground"}`} />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)} data-testid={`button-edit-rule-${r.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { if (confirm("حذف هذه القاعدة؟")) deleteRuleMutation.mutate(r.id); }}
                          data-testid={`button-delete-rule-${r.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rule dialog */}
      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent className="max-w-lg" data-testid="dialog-rule">
          <DialogHeader>
            <DialogTitle>{form.id ? "تعديل القاعدة" : "قاعدة حوكمة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اسم القاعدة</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: سقف الهدر اليومي 5%"
                data-testid="input-rule-name"
              />
            </div>
            <div>
              <Label>نوع المراقبة</Label>
              <Select value={form.thresholdType} onValueChange={(v) => setForm({ ...form, thresholdType: v })}>
                <SelectTrigger data-testid="select-rule-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RULE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {RULE_TYPES.find((t) => t.value === form.thresholdType)?.hint}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الحد ({typeUnit(form.thresholdType)})</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.thresholdValue}
                  onChange={(e) => setForm({ ...form, thresholdValue: e.target.value })}
                  data-testid="input-threshold-value"
                />
              </div>
              {needsPeriod && (
                <div>
                  <Label>عدد الأيام</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={form.periodDays}
                    onChange={(e) => setForm({ ...form, periodDays: e.target.value })}
                    data-testid="input-period-days"
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الفرع</Label>
                <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                  <SelectTrigger data-testid="select-rule-branch"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفروع</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>درجة الخطورة</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger data-testid="select-rule-severity"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">منخفض</SelectItem>
                    <SelectItem value="medium">متوسط</SelectItem>
                    <SelectItem value="high">مرتفع</SelectItem>
                    <SelectItem value="critical">حرج</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="cursor-pointer">القاعدة مفعّلة</Label>
                <p className="text-xs text-muted-foreground">عند الإيقاف لن يتم رصد تنبيهات لهذه القاعدة</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                data-testid="switch-rule-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRuleDialog(false)} data-testid="button-cancel-rule">إلغاء</Button>
            <Button
              onClick={() => saveRuleMutation.mutate()}
              disabled={!canSubmit || saveRuleMutation.isPending}
              data-testid="button-save-rule"
            >
              {saveRuleMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve dialog */}
      <Dialog open={!!resolveTarget} onOpenChange={(o) => !o && setResolveTarget(null)}>
        <DialogContent className="max-w-md" data-testid="dialog-resolve">
          <DialogHeader>
            <DialogTitle>حل التنبيه</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">أضف ملاحظة توضح الإجراء المتخذ (اختياري).</p>
            <Textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="مثال: تم تعديل كمية الإنتاج لتقليل الهدر"
              data-testid="input-resolution-notes"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)} data-testid="button-cancel-resolve">إلغاء</Button>
            <Button
              onClick={() => resolveTarget && resolveMutation.mutate({ id: resolveTarget.id, notes: resolutionNotes })}
              disabled={resolveMutation.isPending}
              data-testid="button-confirm-resolve"
            >
              {resolveMutation.isPending ? "جاري الحفظ..." : "تأكيد الحل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
