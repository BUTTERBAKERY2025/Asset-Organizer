import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SignaturePad } from "@/components/signature-pad";
import { WarningDocument, COMPANY_NAME_AR } from "@/components/warning-document";
import { Loader2, CheckCircle2, FileDown, Paperclip } from "lucide-react";

type WarningDetail = {
  warning: {
    id: number; level: string; reason: string; description?: string | null;
    issuedDate: string; deductionAmount?: number | null;
    templateId?: string | null; reasonCategory?: string | null;
    attachments?: Array<{ url: string; name: string; mimeType?: string; size?: number }>;
    signedAt?: string | null; signatureData?: string | null; status: string;
  };
  employee: { id: number; employeeName?: string | null; jobTitle?: string | null; nationalId?: string | null } | null;
  branch: { id: string; name?: string | null; nameAr?: string | null } | null;
  template: { id: string; label: string; body: string } | null;
  reasonCategoryLabel: string | null;
  legalNotice: string;
};

export function PortalWarningSigner({
  warningId,
  open,
  onOpenChange,
}: {
  warningId: number | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t, i18n } = useTranslation("portal");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [signature, setSignature] = useState<string | null>(null);
  const [confirmRead, setConfirmRead] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Reset the signature + acknowledgement whenever the dialog closes or the
  // selected warning changes, so a signature captured for one warning can
  // never be submitted for another.
  useEffect(() => {
    setSignature(null);
    setConfirmRead(false);
  }, [warningId, open]);

  const { data, isLoading, isError, error, refetch } = useQuery<WarningDetail>({
    queryKey: ["/api/my/warnings", warningId],
    queryFn: async () => (await apiRequest("GET", `/api/my/warnings/${warningId}`)).json(),
    enabled: open && !!warningId,
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Warning_${data?.warning.id ?? ""}_${data?.employee?.employeeName ?? ""}`,
  });

  const signMut = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", `/api/my/warnings/${warningId}/sign`, { signatureData: signature })).json(),
    onSuccess: () => {
      toast({ title: t("warningSigner.signSuccessToast"), description: t("warningSigner.signSuccessToastDesc") });
      setConfirmRead(false);
      setSignature(null);
      qc.invalidateQueries({ queryKey: ["/api/my/warnings", warningId] });
      qc.invalidateQueries({ queryKey: ["/api/my/warnings"] });
      qc.invalidateQueries({ queryKey: ["/api/my/overview"] });
    },
    onError: (e: any) => {
      toast({ title: t("warningSigner.error"), description: e?.message || t("warningSigner.saveError"), variant: "destructive" });
    },
  });

  const submitSign = () => {
    if (!signature) {
      toast({ title: t("warningSigner.signatureRequired"), description: t("warningSigner.signatureRequiredDesc"), variant: "destructive" });
      return;
    }
    if (!confirmRead) {
      toast({ title: t("warningSigner.ackRequired"), description: t("warningSigner.ackRequiredDesc"), variant: "destructive" });
      return;
    }
    signMut.mutate();
  };

  const w = data?.warning;
  const isSigned = !!w?.signedAt;
  const branchName = data?.branch?.nameAr || data?.branch?.name || null;
  const templateBody = data?.template?.body || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0" dir={i18n.language === "ar" ? "rtl" : "ltr"}>
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-amber-600" />
            {t("warningSigner.title")}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
          </div>
        ) : isError || !data || !w ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
            <div className="text-sm text-muted-foreground" data-testid="text-warning-error">
              {(error as any)?.message || t("warningSigner.loadError")}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-warning">
              {t("warningSigner.retry")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {/* Official document preview on company letterhead — always Arabic RTL */}
            <Card className="overflow-hidden">
              <CardContent className="p-0 overflow-auto bg-slate-100">
                <div dir="rtl" style={{ transform: "scale(0.92)", transformOrigin: "top center" }} className="origin-top">
                  <WarningDocument
                    ref={printRef}
                    companyName={COMPANY_NAME_AR}
                    branchName={branchName}
                    warning={w}
                    employee={data.employee}
                    templateBody={templateBody}
                    reasonCategoryLabel={data.reasonCategoryLabel}
                    legalNotice={data.legalNotice}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Attachments */}
            {w.attachments && w.attachments.length > 0 && (
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <Paperclip className="h-4 w-4" /> {t("warningSigner.attachments")} ({w.attachments.length})
                  </div>
                  {w.attachments.map((att, i) => (
                    <a
                      key={i}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-amber-700 hover:underline truncate"
                      data-testid={`link-warning-attachment-${i}`}
                    >
                      • {att.name}
                    </a>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Sign or download */}
            {isSigned ? (
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="p-5 text-center space-y-3">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                  <div>
                    <div className="font-bold text-emerald-800">{t("warningSigner.signedSuccess")}</div>
                    <div className="text-xs text-emerald-700 mt-1">
                      {t("warningSigner.signedAtLabel")}{" "}
                      {new Date(w.signedAt!).toLocaleString(i18n.language === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
                        year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <Button onClick={() => handlePrint()} className="gap-2" data-testid="button-download-warning-pdf">
                    <FileDown className="h-4 w-4" /> {t("warningSigner.downloadPdf")}
                  </Button>
                </CardContent>
              </Card>
            ) : w.status !== "active" ? (
              <Card>
                <CardContent className="p-5 text-center text-sm text-muted-foreground">
                  {t("warningSigner.notAvailable")}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="text-base font-semibold">{t("warningSigner.ackTitle")}</div>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmRead}
                      onChange={(e) => setConfirmRead(e.target.checked)}
                      className="mt-1"
                      data-testid="checkbox-confirm-read-warning"
                    />
                    <span>{t("warningSigner.ackText", { name: data.employee?.employeeName || "" })}</span>
                  </label>

                  <div>
                    <div className="text-sm font-medium mb-2">{t("warningSigner.signatureLabel")}</div>
                    <SignaturePad
                      onSignatureChange={setSignature}
                      width={520}
                      height={160}
                      label={t("warningSigner.signaturePadLabel")}
                    />
                  </div>

                  <Button
                    onClick={submitSign}
                    disabled={signMut.isPending || !signature || !confirmRead}
                    className="w-full gap-2"
                    data-testid="button-submit-warning-signature"
                  >
                    {signMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {signMut.isPending ? t("warningSigner.saving") : t("warningSigner.confirmAndSubmit")}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
