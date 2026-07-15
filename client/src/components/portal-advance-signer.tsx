import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SignaturePad } from "@/components/signature-pad";
import { Loader2, FileSignature } from "lucide-react";

function addMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// نفس منطق الخادم: أقساط متساوية والقسط الأخير يمتص فرق التقريب
function buildPlan(amount: number, months: number, startMonth: string) {
  const monthly = Math.round((amount / months) * 100) / 100;
  const plan: Array<{ month: string; amount: number }> = [];
  let allocated = 0;
  for (let i = 0; i < months; i++) {
    const isLast = i === months - 1;
    const a = isLast ? Math.round((amount - allocated) * 100) / 100 : monthly;
    allocated = Math.round((allocated + a) * 100) / 100;
    plan.push({ month: addMonth(startMonth, i), amount: a });
  }
  return plan;
}

function fmt(n: any): string {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PortalAdvanceSigner({
  advance,
  employeeName,
  open,
  onOpenChange,
}: {
  advance: any | null;
  employeeName?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t, i18n } = useTranslation("portal");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [signature, setSignature] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    setSignature(null);
    setAcknowledged(false);
  }, [advance?.id, open]);

  const amount = advance?.approvedAmount ?? advance?.amount ?? 0;
  const months = advance?.installmentMonths ?? 1;
  const startMonth = advance?.startMonth ?? advance?.requestedMonth ?? "";
  const monthly = advance?.monthlyInstallment ?? (months ? Math.round((amount / months) * 100) / 100 : amount);
  const plan = useMemo(
    () => (amount > 0 && months > 0 && startMonth ? buildPlan(amount, months, startMonth) : []),
    [amount, months, startMonth],
  );

  const signMut = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", `/api/my/advance-requests/${advance.id}/sign`, {
        signatureData: signature,
        acknowledged: true,
      })).json(),
    onSuccess: () => {
      toast({ title: t("advanceSigner.signSuccess", { defaultValue: "تم توقيع نموذج السلفة بنجاح" }) });
      qc.invalidateQueries({ queryKey: ["/api/my/advance-requests"] });
      qc.invalidateQueries({ queryKey: ["/api/my/notifications"] });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: t("advanceSigner.error", { defaultValue: "خطأ" }), description: e?.message, variant: "destructive" }),
  });

  const submit = () => {
    if (!acknowledged) {
      toast({ title: t("advanceSigner.ackRequired", { defaultValue: "يجب الإقرار بالموافقة أولاً" }), variant: "destructive" });
      return;
    }
    if (!signature) {
      toast({ title: t("advanceSigner.signatureRequired", { defaultValue: "التوقيع مطلوب" }), variant: "destructive" });
      return;
    }
    signMut.mutate();
  };

  if (!advance) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto" dir={i18n.language === "ar" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-emerald-600" />
            {t("advanceSigner.title", { defaultValue: "نموذج الموافقة على السلفة والاستقطاع" })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm leading-7">
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
            <p className="font-bold text-center">{t("advanceSigner.docHeading", { defaultValue: "إقرار وموافقة على سلفة واستقطاع من الراتب" })}</p>
            <p data-testid="text-advance-doc-body">
              {t("advanceSigner.docBody", {
                defaultValue:
                  `أقر أنا الموظف ${employeeName || "-"} بموافقتي على الحصول على سلفة من الشركة بمبلغ ${fmt(amount)} ريال سعودي، وأفوض إدارة الشركة تفويضاً غير قابل للرجوع فيه باستقطاع قيمة هذه السلفة من راتبي الشهري على ${months} قسطاً شهرياً متساوياً بقيمة ${fmt(monthly)} ريال للقسط الواحد، اعتباراً من راتب شهر ${startMonth} وحتى سداد كامل المبلغ. كما أقر بأن هذا النموذج يُعد مستنداً رسمياً ملزماً، وبأنه في حال انتهاء خدمتي لأي سبب قبل سداد كامل السلفة يحق للشركة خصم المتبقي من مستحقاتي النهائية.`,
                name: employeeName || "-",
                amount: fmt(amount),
                months,
                monthly: fmt(monthly),
                startMonth,
              })}
            </p>
          </div>

          {plan.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="p-2 text-start">{t("advanceSigner.installmentNo", { defaultValue: "القسط" })}</th>
                    <th className="p-2 text-start">{t("advanceSigner.month", { defaultValue: "الشهر" })}</th>
                    <th className="p-2 text-start">{t("advanceSigner.amount", { defaultValue: "المبلغ (ر.س)" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.map((p, i) => (
                    <tr key={p.month} className="border-t" data-testid={`row-installment-${i + 1}`}>
                      <td className="p-2">{i + 1}</td>
                      <td className="p-2 font-mono">{p.month}</td>
                      <td className="p-2 tabular-nums">{fmt(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <label className="flex items-start gap-2 cursor-pointer rounded-lg border p-3 bg-amber-50/50 dark:bg-amber-950/20">
            <Checkbox checked={acknowledged} onCheckedChange={(v) => setAcknowledged(v === true)} data-testid="checkbox-advance-ack" className="mt-1" />
            <span>
              {t("advanceSigner.ackLabel", {
                defaultValue: "أقر بأنني قرأت وفهمت محتوى هذا المستند الرسمي، وأوافق على استقطاع أقساط السلفة من راتبي الشهري حسب الجدول أعلاه.",
              })}
            </span>
          </label>

          <div>
            <SignaturePad
              onSignatureChange={setSignature}
              label={t("advanceSigner.signHere", { defaultValue: "توقيع الموظف (ارسم توقيعك هنا)" })}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-advance-sign-cancel">
              {t("advanceSigner.close", { defaultValue: "إغلاق" })}
            </Button>
            <Button
              onClick={submit}
              disabled={signMut.isPending || !acknowledged || !signature}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-advance-sign-submit"
            >
              {signMut.isPending ? <Loader2 className="h-4 w-4 animate-spin ms-1" /> : <FileSignature className="h-4 w-4 ms-1" />}
              {t("advanceSigner.submit", { defaultValue: "توقيع واعتماد الموافقة" })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
