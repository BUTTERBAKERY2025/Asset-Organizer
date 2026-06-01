import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SignatureCanvas from "react-signature-canvas";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileSignature, Eraser, CalendarRange, CheckCircle2, AlertTriangle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  pending_employee_signature: "bg-amber-100 text-amber-700",
  pending_manager_signature: "bg-blue-100 text-blue-700",
  finalized: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

interface TimesheetReport {
  id: number;
  startDate: string;
  endDate: string;
  status: string;
  isLocked: boolean;
  version: number;
  notes?: string | null;
  employeeSignature?: string | null;
  employeeSignedAt?: string | null;
  totalScheduledDays?: number | null;
  totalPresentDays?: number | null;
  totalAbsentDays?: number | null;
  totalLateDays?: number | null;
  totalActualHours?: number | null;
  totalOvertimeMinutes?: number | null;
  totalLateMinutes?: number | null;
}

interface TimesheetEntry {
  id: number;
  date: string;
  status?: string | null;
  isOff?: boolean | null;
  scheduledHours?: number | null;
  actualHours?: number | null;
  lateMinutes?: number | null;
  overtimeMinutes?: number | null;
}

export function PortalTimesheet() {
  const { t } = useTranslation("portal");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<number | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const sigRef = useRef<SignatureCanvas>(null);

  const statusBadge = (status: string) => {
    const label = t(`timesheet.status.${status}`, { defaultValue: status });
    const color = STATUS_COLORS[status] || "bg-gray-100 text-gray-700";
    return <Badge className={color} data-testid={`badge-ts-status-${status}`}>{label}</Badge>;
  };

  const entryStatusLabel = (status?: string | null) =>
    t(`timesheet.entryStatus.${status || "pending"}`, { defaultValue: status || "" });

  const { data: reports = [], isLoading } = useQuery<TimesheetReport[]>({
    queryKey: ["/api/my/timesheet-reports"],
    queryFn: async () => (await apiRequest("GET", "/api/my/timesheet-reports")).json(),
  });

  const { data: detail, isLoading: detailLoading } = useQuery<{ report: TimesheetReport; entries: TimesheetEntry[] }>({
    queryKey: ["/api/my/timesheet-reports", openId],
    queryFn: async () => (await apiRequest("GET", `/api/my/timesheet-reports/${openId}`)).json(),
    enabled: openId !== null,
  });

  const signMutation = useMutation({
    mutationFn: async (payload: { id: number; signature: string }) =>
      (await apiRequest("POST", `/api/my/timesheet-reports/${payload.id}/sign`, {
        signature: payload.signature,
        acknowledgment: t("timesheet.acknowledge"),
      })).json(),
    onSuccess: () => {
      toast({ title: t("timesheet.signSuccess"), description: t("timesheet.signSuccessDesc") });
      qc.invalidateQueries({ queryKey: ["/api/my/timesheet-reports"] });
      setOpenId(null);
      setAcknowledged(false);
    },
    onError: (e: any) => {
      toast({ title: t("timesheet.signError"), description: e?.message || t("timesheet.genericError"), variant: "destructive" });
    },
  });

  const report = detail?.report;
  const entries = detail?.entries || [];
  const canSign =
    report &&
    !report.isLocked &&
    report.status !== "finalized" &&
    !(report.status === "pending_manager_signature" && report.employeeSignature);

  function handleSign() {
    if (!report) return;
    if (!acknowledged) {
      toast({ title: t("timesheet.confirmRequired"), description: t("timesheet.confirmRequiredDesc"), variant: "destructive" });
      return;
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast({ title: t("timesheet.signatureRequired"), description: t("timesheet.signatureRequiredDesc"), variant: "destructive" });
      return;
    }
    const signature = sigRef.current.getCanvas().toDataURL("image/png");
    signMutation.mutate({ id: report.id, signature });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10" data-testid="loading-timesheet">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground" data-testid="empty-timesheet">
            <CalendarRange className="h-10 w-10 mx-auto mb-2 opacity-40" />
            {t("timesheet.empty")}
          </CardContent>
        </Card>
      )}

      {reports.map((r) => (
        <Card key={r.id} data-testid={`card-timesheet-${r.id}`}>
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <div className="font-semibold flex items-center gap-2 flex-wrap">
                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                <span data-testid={`text-ts-period-${r.id}`}>{r.startDate} ← {r.endDate}</span>
                {r.version > 1 && (
                  <Badge variant="outline" className="text-[11px]">{t("timesheet.version", { n: r.version })}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">{statusBadge(r.status)}</div>
              {r.status === "rejected" && r.notes && (
                <p className="text-xs text-red-600 flex items-start gap-1" data-testid={`text-ts-reject-${r.id}`}>
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {t("timesheet.rejectNotes", { notes: r.notes })}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant={r.status === "rejected" || r.status === "pending_employee_signature" ? "default" : "outline"}
              onClick={() => { setOpenId(r.id); setAcknowledged(false); }}
              data-testid={`button-open-timesheet-${r.id}`}
            >
              {r.status === "pending_employee_signature" || r.status === "rejected" ? t("timesheet.reviewAndSign") : t("timesheet.viewDetails")}
            </Button>
          </CardContent>
        </Card>
      ))}

      <Dialog open={openId !== null} onOpenChange={(o) => { if (!o && !signMutation.isPending) { setOpenId(null); setAcknowledged(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-timesheet-detail">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              {t("timesheet.reportTitle")} {report ? `(${report.startDate} ← ${report.endDate})` : ""}
            </DialogTitle>
          </DialogHeader>

          {detailLoading || !report ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {statusBadge(report.status)}
                {report.isLocked && <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {t("timesheet.locked")}</Badge>}
              </div>

              {report.status === "rejected" && report.notes && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-testid="text-reject-notes">
                  <div className="font-semibold flex items-center gap-1 mb-1"><AlertTriangle className="h-4 w-4" /> {t("timesheet.rejectedTitle")}</div>
                  {report.notes}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <SummaryStat label={t("timesheet.scheduledDays")} value={report.totalScheduledDays} />
                <SummaryStat label={t("timesheet.presentDays")} value={report.totalPresentDays} />
                <SummaryStat label={t("timesheet.absentDays")} value={report.totalAbsentDays} />
                <SummaryStat label={t("timesheet.lateDays")} value={report.totalLateDays} />
                <SummaryStat label={t("timesheet.actualHours")} value={report.totalActualHours} />
                <SummaryStat label={t("timesheet.overtimeMinutes")} value={report.totalOvertimeMinutes} />
                <SummaryStat label={t("timesheet.lateMinutes")} value={report.totalLateMinutes} />
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-2 text-start">{t("timesheet.colDate")}</th>
                        <th className="p-2">{t("timesheet.colStatus")}</th>
                        <th className="p-2">{t("timesheet.colScheduled")}</th>
                        <th className="p-2">{t("timesheet.colActual")}</th>
                        <th className="p-2">{t("timesheet.colLate")}</th>
                        <th className="p-2">{t("timesheet.colOvertime")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e) => (
                        <tr key={e.id} className="border-t" data-testid={`row-entry-${e.id}`}>
                          <td className="p-2 text-start whitespace-nowrap">{e.date}</td>
                          <td className="p-2 text-center">{e.isOff ? t("timesheet.entryStatus.day_off") : entryStatusLabel(e.status)}</td>
                          <td className="p-2 text-center">{Number(e.scheduledHours || 0)}</td>
                          <td className="p-2 text-center">{Number(e.actualHours || 0)}</td>
                          <td className="p-2 text-center">{Number(e.lateMinutes || 0)}</td>
                          <td className="p-2 text-center">{Number(e.overtimeMinutes || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {report.status === "pending_manager_signature" && report.employeeSignature && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 flex items-center gap-2" data-testid="text-awaiting-manager">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("timesheet.awaitingManager")}
                </div>
              )}

              {report.status === "finalized" && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("timesheet.finalized")}
                </div>
              )}

              {canSign && (
                <div className="space-y-3 border-t pt-4">
                  <p className="text-sm font-semibold">{t("timesheet.eSignTitle")}</p>
                  <div className="rounded-lg border bg-white">
                    <SignatureCanvas
                      ref={sigRef}
                      penColor="#1e293b"
                      canvasProps={{ className: "w-full h-40 rounded-lg", "data-testid": "canvas-signature" } as any}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => sigRef.current?.clear()} data-testid="button-clear-signature">
                    <Eraser className="h-4 w-4" /> {t("timesheet.clearSignature")}
                  </Button>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox checked={acknowledged} onCheckedChange={(v) => setAcknowledged(v === true)} data-testid="checkbox-acknowledge" />
                    <span>{t("timesheet.acknowledge")}</span>
                  </label>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setOpenId(null); setAcknowledged(false); }} disabled={signMutation.isPending} data-testid="button-close-timesheet">
              {t("timesheet.close")}
            </Button>
            {canSign && (
              <Button onClick={handleSign} disabled={signMutation.isPending} className="gap-2" data-testid="button-sign-timesheet">
                {signMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
                {t("timesheet.signAndApprove")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2">
      <div className="text-lg font-bold">{Number(value || 0)}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
