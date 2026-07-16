import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SignaturePad } from "@/components/signature-pad";
import { Loader2, FileSignature } from "lucide-react";

function fmt(n: any): string {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PortalSettlementSigner({
  settlement,
  employeeName,
  open,
  onOpenChange,
}: {
  settlement: any | null;
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
  }, [settlement?.id, open]);

  const signMut = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", `/api/my/leave-settlements/${settlement.id}/sign`, {
        signatureData: signature,
        acknowledged: true,
      })).json(),
    onSuccess: () => {
      toast({ title: t("settlementSigner.signSuccess", { defaultValue: "تم توقيع تصفية الإجازة والإقرار بالاستلام" }) });
      qc.invalidateQueries({ queryKey: ["/api/my/leave-settlements"] });
      qc.invalidateQueries({ queryKey: ["/api/my/notifications"] });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: t("settlementSigner.error", { defaultValue: "خطأ" }), description: e?.message, variant: "destructive" }),
  });

  const submit = () => {
    if (!acknowledged) {
      toast({ title: t("settlementSigner.ackRequired", { defaultValue: "يجب الإقرار بالاستلام أولاً" }), variant: "destructive" });
      return;
    }
    if (!signature) {
      toast({ title: t("settlementSigner.signatureRequired", { defaultValue: "التوقيع مطلوب" }), variant: "destructive" });
      return;
    }
    signMut.mutate();
  };

  if (!settlement) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto" dir={i18n.language === "ar" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-emerald-600" />
            {t("settlementSigner.title", { defaultValue: "توقيع تصفية رصيد الإجازة والإقرار بالاستلام" })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm leading-7">
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
            <p className="font-bold text-center">{t("settlementSigner.docHeading", { defaultValue: "إقرار استلام بدل رصيد إجازة سنوية" })}</p>
            <p data-testid="text-settlement-doc-body">
              {t("settlementSigner.docBody", {
                defaultValue:
                  `أقر أنا الموظف ${employeeName || "-"} بموافقتي على تصفية رصيد إجازتي السنوية البالغ ${fmt(settlement.settledDays)} يوماً بواقع ${fmt(settlement.dailyRate)} ريال لليوم الواحد، وباستحقاقي مبلغاً إجمالياً قدره ${fmt(settlement.finalAmount)} ريال سعودي، وبأنني أفوض الإدارة المالية بتحويل المبلغ إلى حسابي البنكي المسجل لدى الشركة. كما أقر بأن هذا التوقيع يُعد إقراراً نهائياً باستلام قيمة التصفية عند تحويلها، وتُخصم الأيام المصفاة من رصيد إجازاتي.`,
              })}
            </p>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b">
                  <td className="p-2 bg-muted/60 font-semibold">{t("settlementSigner.days", { defaultValue: "الأيام المصفاة" })}</td>
                  <td className="p-2 tabular-nums" data-testid="text-settlement-days">{fmt(settlement.settledDays)}</td>
                  <td className="p-2 bg-muted/60 font-semibold">{t("settlementSigner.dailyRate", { defaultValue: "بدل اليوم (ر.س)" })}</td>
                  <td className="p-2 tabular-nums">{fmt(settlement.dailyRate)}</td>
                </tr>
                <tr>
                  <td className="p-2 bg-muted/60 font-semibold">{t("settlementSigner.amount", { defaultValue: "المبلغ الإجمالي (ر.س)" })}</td>
                  <td className="p-2 tabular-nums font-bold text-emerald-700" data-testid="text-settlement-amount">{fmt(settlement.finalAmount)}</td>
                  <td className="p-2 bg-muted/60 font-semibold">{t("settlementSigner.period", { defaultValue: "فترة الإجازة" })}</td>
                  <td className="p-2">{settlement.leaveStart ? `${settlement.leaveStart} → ${settlement.leaveEnd}` : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <label className="flex items-start gap-2 cursor-pointer rounded-lg border p-3 bg-amber-50/50 dark:bg-amber-950/20">
            <Checkbox checked={acknowledged} onCheckedChange={(v) => setAcknowledged(v === true)} data-testid="checkbox-settlement-ack" className="mt-1" />
            <span>
              {t("settlementSigner.ackLabel", {
                defaultValue: "أقر بأنني قرأت وفهمت محتوى هذا المستند، وأوافق على تصفية رصيد إجازتي واستلام المبلغ المذكور أعلاه.",
              })}
            </span>
          </label>

          <div>
            <SignaturePad
              onSignatureChange={setSignature}
              label={t("settlementSigner.signHere", { defaultValue: "توقيع الموظف (ارسم توقيعك هنا)" })}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-settlement-sign-cancel">
              {t("settlementSigner.close", { defaultValue: "إغلاق" })}
            </Button>
            <Button
              onClick={submit}
              disabled={signMut.isPending || !acknowledged || !signature}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-settlement-sign-submit"
            >
              {signMut.isPending ? <Loader2 className="h-4 w-4 animate-spin ms-1" /> : <FileSignature className="h-4 w-4 ms-1" />}
              {t("settlementSigner.submit", { defaultValue: "توقيع وإقرار بالاستلام" })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
