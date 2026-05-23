import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertCircle, Calculator, CheckCircle2, XCircle, Clock, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ConstructionContract } from "@shared/schema";

interface Props {
  contract: ConstructionContract;
  canEdit: boolean;
}

export function ContractLiquidatedDamagesCard({ contract, canEdit }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [waiveOpen, setWaiveOpen] = useState(false);
  const [waiveReason, setWaiveReason] = useState("");
  const [form, setForm] = useState({
    ldEnabled: contract.ldEnabled || false,
    ldDailyRate: contract.ldDailyRate || 0,
    ldMaxPercentage: contract.ldMaxPercentage || 10,
    plannedCompletionDate: contract.plannedCompletionDate || "",
    actualCompletionDate: contract.actualCompletionDate || "",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [`/api/construction/contracts/${contract.id}`] });
  };

  const saveSettings = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("PATCH", `/api/construction/contracts/${contract.id}`, data);
      return await res.json();
    },
    onSuccess: () => { invalidate(); setSettingsOpen(false); toast({ title: "تم حفظ إعدادات الغرامة" }); },
    onError: (e: any) => toast({ title: "فشل الحفظ", description: e?.message, variant: "destructive" }),
  });

  const calc = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/construction/contracts/${contract.id}/ld/calculate`, {});
      return await res.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "تم حساب الغرامة" }); },
    onError: (e: any) => toast({ title: "فشل الحساب", description: e?.message, variant: "destructive" }),
  });

  const apply = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/construction/contracts/${contract.id}/ld/apply`, {});
      return await res.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "تم تطبيق الغرامة" }); },
    onError: (e: any) => toast({ title: "فشل التطبيق", description: e?.message, variant: "destructive" }),
  });

  const waive = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiRequest("POST", `/api/construction/contracts/${contract.id}/ld/waive`, { reason });
      return await res.json();
    },
    onSuccess: () => { invalidate(); setWaiveOpen(false); setWaiveReason(""); toast({ title: "تم التنازل عن الغرامة" }); },
    onError: (e: any) => toast({ title: "فشل التنازل", description: e?.message, variant: "destructive" }),
  });

  const fmt = (n: number) => new Intl.NumberFormat("ar-SA-u-nu-latn", { style: "currency", currency: "SAR" }).format(n || 0);
  const ldEnabled = !!contract.ldEnabled;
  const calculated = contract.ldCalculatedAmount || 0;
  const days = contract.ldCalculatedDays || 0;
  const cap = (contract.totalAmount || 0) * (contract.ldMaxPercentage || 0) / 100;
  const atCap = calculated > 0 && Math.abs(calculated - cap) < 0.01;

  const statusBadge = contract.ldApplied
    ? <Badge className="bg-red-600">مطبّقة</Badge>
    : contract.ldWaived
      ? <Badge variant="outline" className="text-emerald-700 border-emerald-300">متنازل عنها</Badge>
      : ldEnabled
        ? <Badge variant="secondary">مفعّلة</Badge>
        : <Badge variant="outline">غير مفعّلة</Badge>;

  const openSettings = () => {
    setForm({
      ldEnabled: contract.ldEnabled || false,
      ldDailyRate: contract.ldDailyRate || 0,
      ldMaxPercentage: contract.ldMaxPercentage || 10,
      plannedCompletionDate: contract.plannedCompletionDate || "",
      actualCompletionDate: contract.actualCompletionDate || "",
    });
    setSettingsOpen(true);
  };

  return (
    <Card data-testid="card-liquidated-damages" className="border-orange-200">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <AlertCircle className="h-5 w-5" /> غرامة التأخير
            {statusBadge}
          </CardTitle>
          <CardDescription>
            احسب وطبّق غرامة التأخير اليومية حسب شروط العقد، أو تنازل عنها بقرار موثّق
          </CardDescription>
        </div>
        {canEdit && !contract.ldApplied && !contract.ldWaived && (
          <Button size="sm" variant="outline" onClick={openSettings} data-testid="button-ld-settings">
            <Settings2 className="h-4 w-4 ml-1" /> الإعدادات
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!ldEnabled ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            غرامة التأخير غير مفعّلة على هذا العقد. اضغط "الإعدادات" لتفعيلها.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-orange-50 rounded-lg p-3">
                <div className="text-xs text-orange-700 mb-1">المعدّل اليومي</div>
                <div className="text-lg font-bold text-orange-800" data-testid="text-ld-rate">{contract.ldDailyRate || 0}%</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <div className="text-xs text-orange-700 mb-1">السقف الأقصى</div>
                <div className="text-lg font-bold text-orange-800" data-testid="text-ld-max">{contract.ldMaxPercentage || 0}%</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{fmt(cap)}</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3">
                <div className="text-xs text-amber-700 mb-1">أيام التأخير</div>
                <div className="text-lg font-bold text-amber-800" data-testid="text-ld-days">{days} يوم</div>
              </div>
              <div className={`rounded-lg p-3 ${contract.ldApplied ? 'bg-red-50' : 'bg-slate-50'}`}>
                <div className={`text-xs mb-1 ${contract.ldApplied ? 'text-red-700' : 'text-slate-700'}`}>المبلغ المحسوب</div>
                <div className={`text-lg font-bold ${contract.ldApplied ? 'text-red-800' : 'text-slate-800'}`} data-testid="text-ld-amount">{fmt(calculated)}</div>
                {atCap && <div className="text-[11px] text-red-600 mt-0.5">وصل للسقف الأقصى</div>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-muted-foreground">التسليم المخطط:</span>
                <span className="font-medium" data-testid="text-ld-planned">{contract.plannedCompletionDate || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600" />
                <span className="text-muted-foreground">التسليم الفعلي:</span>
                <span className="font-medium" data-testid="text-ld-actual">{contract.actualCompletionDate || "(لم يُحدّد بعد — يُحسب حتى اليوم)"}</span>
              </div>
            </div>

            {contract.ldWaived && contract.ldWaivedReason && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                <div className="font-medium text-emerald-800 mb-1">سبب التنازل:</div>
                <div className="text-emerald-700">{contract.ldWaivedReason}</div>
              </div>
            )}

            {canEdit && !contract.ldApplied && !contract.ldWaived && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button size="sm" onClick={() => calc.mutate()} disabled={calc.isPending} data-testid="button-ld-calculate" className="bg-orange-600 hover:bg-orange-700">
                  <Calculator className="h-4 w-4 ml-1" />
                  {calc.isPending ? "جارِ الحساب..." : "احسب الآن"}
                </Button>
                {calculated > 0 && (
                  <>
                    <Button size="sm" variant="destructive" onClick={() => apply.mutate()} disabled={apply.isPending} data-testid="button-ld-apply">
                      <CheckCircle2 className="h-4 w-4 ml-1" />
                      تطبيق الغرامة
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setWaiveOpen(true)} disabled={waive.isPending} data-testid="button-ld-waive" className="text-emerald-700 border-emerald-300">
                      <XCircle className="h-4 w-4 ml-1" />
                      تنازل عن الغرامة
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>إعدادات غرامة التأخير</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
              <Label htmlFor="ld-enabled" className="cursor-pointer">تفعيل غرامة التأخير</Label>
              <Switch id="ld-enabled" checked={form.ldEnabled} onCheckedChange={(v) => setForm({ ...form, ldEnabled: v })} data-testid="switch-ld-enabled" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>المعدّل اليومي (%)</Label>
                <Input type="number" step="0.01" min="0" value={form.ldDailyRate} onChange={(e) => setForm({ ...form, ldDailyRate: parseFloat(e.target.value) || 0 })} disabled={!form.ldEnabled} data-testid="input-ld-rate" />
              </div>
              <div>
                <Label>السقف الأقصى (%)</Label>
                <Input type="number" step="0.1" min="0" max="100" value={form.ldMaxPercentage} onChange={(e) => setForm({ ...form, ldMaxPercentage: parseFloat(e.target.value) || 0 })} disabled={!form.ldEnabled} data-testid="input-ld-max" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>تاريخ التسليم المخطط</Label>
                <Input type="date" value={form.plannedCompletionDate} onChange={(e) => setForm({ ...form, plannedCompletionDate: e.target.value })} data-testid="input-ld-planned" />
              </div>
              <div>
                <Label>تاريخ التسليم الفعلي</Label>
                <Input type="date" value={form.actualCompletionDate} onChange={(e) => setForm({ ...form, actualCompletionDate: e.target.value })} data-testid="input-ld-actual" />
                <div className="text-[11px] text-muted-foreground mt-1">اتركه فارغاً للحساب حتى اليوم</div>
              </div>
            </div>
            {form.ldEnabled && (contract.totalAmount || 0) > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded p-2 text-xs text-orange-800">
                السقف الأقصى للغرامة = {fmt((contract.totalAmount || 0) * form.ldMaxPercentage / 100)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)} data-testid="button-ld-cancel">إلغاء</Button>
            <Button onClick={() => saveSettings.mutate(form)} disabled={saveSettings.isPending} data-testid="button-ld-save">حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Waive Dialog */}
      <Dialog open={waiveOpen} onOpenChange={setWaiveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>التنازل عن غرامة التأخير</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              سيتم إعفاء المقاول من غرامة قدرها <strong>{fmt(calculated)}</strong>. هذا الإجراء يحتاج لسبب موثّق.
            </div>
            <div>
              <Label>سبب التنازل (مطلوب)</Label>
              <Textarea value={waiveReason} onChange={(e) => setWaiveReason(e.target.value)} rows={3} data-testid="textarea-waive-reason" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWaiveOpen(false)} data-testid="button-waive-cancel">إلغاء</Button>
            <Button onClick={() => waive.mutate(waiveReason)} disabled={waive.isPending || !waiveReason.trim()} data-testid="button-waive-confirm" className="bg-emerald-600 hover:bg-emerald-700">
              تأكيد التنازل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
