import { useState, useRef } from "react";
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
import { TIMESHEET_STATUS_LABELS } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  pending_employee_signature: "bg-amber-100 text-amber-700",
  pending_manager_signature: "bg-blue-100 text-blue-700",
  finalized: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

const ENTRY_STATUS_LABELS: Record<string, string> = {
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
  day_off: "إجازة أسبوعية",
  pending: "—",
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

function statusBadge(status: string) {
  const label = (TIMESHEET_STATUS_LABELS as Record<string, string>)[status] || status;
  const color = STATUS_COLORS[status] || "bg-gray-100 text-gray-700";
  return <Badge className={color} data-testid={`badge-ts-status-${status}`}>{label}</Badge>;
}

export function PortalTimesheet() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<number | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const sigRef = useRef<SignatureCanvas>(null);

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
        acknowledgment: "أقر بصحة بيانات الحضور والانصراف المذكورة في هذا التقرير",
      })).json(),
    onSuccess: () => {
      toast({ title: "تم توقيع التقرير بنجاح", description: "أصبح التقرير بانتظار اعتماد المدير" });
      qc.invalidateQueries({ queryKey: ["/api/my/timesheet-reports"] });
      setOpenId(null);
      setAcknowledged(false);
    },
    onError: (e: any) => {
      toast({ title: "تعذّر التوقيع", description: e?.message || "حدث خطأ", variant: "destructive" });
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
      toast({ title: "تأكيد مطلوب", description: "يرجى تأكيد إقرارك بصحة البيانات أولاً", variant: "destructive" });
      return;
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast({ title: "التوقيع مطلوب", description: "يرجى التوقيع في المربع المخصص", variant: "destructive" });
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
            لا توجد تقارير دوام متاحة لك حتى الآن
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
                  <Badge variant="outline" className="text-[11px]">إصدار {r.version}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">{statusBadge(r.status)}</div>
              {r.status === "rejected" && r.notes && (
                <p className="text-xs text-red-600 flex items-start gap-1" data-testid={`text-ts-reject-${r.id}`}>
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  ملاحظات الرفض: {r.notes}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant={r.status === "rejected" || r.status === "pending_employee_signature" ? "default" : "outline"}
              onClick={() => { setOpenId(r.id); setAcknowledged(false); }}
              data-testid={`button-open-timesheet-${r.id}`}
            >
              {r.status === "pending_employee_signature" || r.status === "rejected" ? "مراجعة وتوقيع" : "عرض التفاصيل"}
            </Button>
          </CardContent>
        </Card>
      ))}

      <Dialog open={openId !== null} onOpenChange={(o) => { if (!o && !signMutation.isPending) { setOpenId(null); setAcknowledged(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-timesheet-detail">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              تقرير الدوام {report ? `(${report.startDate} ← ${report.endDate})` : ""}
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
                {report.isLocked && <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3" /> مقفل</Badge>}
              </div>

              {report.status === "rejected" && report.notes && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-testid="text-reject-notes">
                  <div className="font-semibold flex items-center gap-1 mb-1"><AlertTriangle className="h-4 w-4" /> تم رفض التقرير من الإدارة</div>
                  {report.notes}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <SummaryStat label="أيام مجدولة" value={report.totalScheduledDays} />
                <SummaryStat label="أيام حضور" value={report.totalPresentDays} />
                <SummaryStat label="أيام غياب" value={report.totalAbsentDays} />
                <SummaryStat label="أيام تأخير" value={report.totalLateDays} />
                <SummaryStat label="ساعات فعلية" value={report.totalActualHours} />
                <SummaryStat label="دقائق إضافي" value={report.totalOvertimeMinutes} />
                <SummaryStat label="دقائق تأخير" value={report.totalLateMinutes} />
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-2 text-right">التاريخ</th>
                        <th className="p-2">الحالة</th>
                        <th className="p-2">مجدول</th>
                        <th className="p-2">فعلي</th>
                        <th className="p-2">تأخير</th>
                        <th className="p-2">إضافي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e) => (
                        <tr key={e.id} className="border-t" data-testid={`row-entry-${e.id}`}>
                          <td className="p-2 text-right whitespace-nowrap">{e.date}</td>
                          <td className="p-2 text-center">{e.isOff ? "إجازة أسبوعية" : (ENTRY_STATUS_LABELS[e.status || "pending"] || e.status)}</td>
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
                  وقّعت على هذا التقرير. أصبح الآن بانتظار اعتماد المدير.
                </div>
              )}

              {report.status === "finalized" && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  تم اعتماد التقرير وقفله نهائياً.
                </div>
              )}

              {canSign && (
                <div className="space-y-3 border-t pt-4">
                  <p className="text-sm font-semibold">التوقيع الإلكتروني</p>
                  <div className="rounded-lg border bg-white">
                    <SignatureCanvas
                      ref={sigRef}
                      penColor="#1e293b"
                      canvasProps={{ className: "w-full h-40 rounded-lg", "data-testid": "canvas-signature" } as any}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => sigRef.current?.clear()} data-testid="button-clear-signature">
                    <Eraser className="h-4 w-4" /> مسح التوقيع
                  </Button>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox checked={acknowledged} onCheckedChange={(v) => setAcknowledged(v === true)} data-testid="checkbox-acknowledge" />
                    <span>أقرّ بأن بيانات الحضور والانصراف المذكورة أعلاه صحيحة وأوافق عليها.</span>
                  </label>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setOpenId(null); setAcknowledged(false); }} disabled={signMutation.isPending} data-testid="button-close-timesheet">
              إغلاق
            </Button>
            {canSign && (
              <Button onClick={handleSign} disabled={signMutation.isPending} className="gap-2" data-testid="button-sign-timesheet">
                {signMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
                توقيع واعتماد
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
