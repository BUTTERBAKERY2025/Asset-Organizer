import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageHeader, SectionCard } from "@/components/dashboard";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Printer, Search, UserCheck, Building2, CalendarDays } from "lucide-react";

interface BranchEmployee {
  id: number;
  employeeName?: string;
  name?: string;
  branchId?: string;
  status?: string;
}

interface Agg {
  days: number;
  present: number;
  late: number;
  absent: number;
  earlyLeave: number;
  leave: number;
  workingHours: number;
  overtimeHours: number;
  lateMinutes: number;
}

interface ReportRow {
  id: number;
  attendanceDate: string;
  branchId: string;
  branchName: string;
  status: string;
  actualCheckIn?: string | null;
  actualCheckOut?: string | null;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  workingHours?: number | null;
  lateMinutes?: number | null;
}

interface ReportResponse {
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  rows: ReportRow[];
  byBranch: ({ branchId: string; branchName: string } & Agg)[];
  totals: Agg;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  present: { label: "حاضر", cls: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" },
  late: { label: "متأخر", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  early_leave: { label: "انصراف مبكر", cls: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300" },
  absent: { label: "غائب", cls: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  on_leave: { label: "إجازة", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  no_schedule: { label: "بدون جدول", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
};

function statusInfo(s: string) {
  return STATUS_LABELS[s] || { label: s, cls: "bg-gray-100 text-gray-600" };
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function EmployeeAttendanceReportPage() {
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [activeEmployeeId, setActiveEmployeeId] = useState<string | null>(null);
  const [activeMonth, setActiveMonth] = useState<string | null>(null);

  const { data: employees = [], isLoading: empLoading } = useQuery<BranchEmployee[]>({
    queryKey: ["/api/branch-employees"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated,
    staleTime: 60000,
  });

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...employees].sort((a, b) =>
      (a.employeeName || a.name || "").localeCompare(b.employeeName || b.name || "", "ar"),
    );
    if (!q) return list.slice(0, 100);
    return list
      .filter((e) => (e.employeeName || e.name || "").toLowerCase().includes(q))
      .slice(0, 100);
  }, [employees, search]);

  const reportUrl = activeEmployeeId && activeMonth
    ? `/api/employee-attendance-report?employeeId=${encodeURIComponent(activeEmployeeId)}&month=${activeMonth}`
    : null;

  const { data: report, isLoading: reportLoading } = useQuery<ReportResponse>({
    queryKey: [reportUrl],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!reportUrl,
    staleTime: 15000,
  });

  const selectedEmployee = employees.find((e) => e.id === selectedId);

  function generate() {
    if (!selectedId) return;
    setActiveEmployeeId(`branch_emp_${selectedId}`);
    setActiveMonth(month);
  }

  function handlePrint() {
    if (!report) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const rowsHtml = report.rows
      .map(
        (r) => `
      <tr>
        <td>${r.attendanceDate}</td>
        <td>${r.branchName ?? "--"}</td>
        <td>${statusInfo(r.status).label}</td>
        <td>${r.actualCheckIn ?? "--"}</td>
        <td>${r.actualCheckOut ?? "--"}</td>
        <td>${r.workingHours != null ? Number(r.workingHours).toFixed(1) : "--"}</td>
        <td>${r.lateMinutes ?? 0}</td>
      </tr>`,
      )
      .join("");
    const branchRowsHtml = report.byBranch
      .map(
        (b) => `
      <tr>
        <td>${b.branchName}</td>
        <td>${b.days}</td>
        <td>${b.present}</td>
        <td>${b.late}</td>
        <td>${b.absent}</td>
        <td>${b.leave}</td>
        <td>${b.workingHours.toFixed(1)}</td>
        <td>${b.lateMinutes}</td>
      </tr>`,
      )
      .join("");
    w.document.write(`
      <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
      <title>تقرير حضور - ${report.employeeName}</title>
      <style>
        body { font-family: 'Cairo', Arial, sans-serif; padding: 20px; direction: rtl; }
        .header { text-align:center; margin-bottom:24px; border-bottom:2px solid #D4AF37; padding-bottom:16px; }
        .header h1 { margin:0; } .header h2 { color:#D4AF37; margin:8px 0; }
        .info { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:16px; }
        .info div { background:#f5f5f5; border-radius:6px; padding:8px; font-size:13px; }
        table { width:100%; border-collapse:collapse; margin:14px 0; }
        th,td { border:1px solid #ddd; padding:6px; text-align:center; font-size:12px; }
        th { background:#D4AF37; color:#fff; }
        tr:nth-child(even){ background:#f9f9f9; }
        h3 { margin:18px 0 6px; }
        @media print { body { padding:0; } }
      </style></head><body>
      <div class="header"><h1>BUTTER BAKERY</h1><h2>تقرير حضور الموظف عبر الفروع</h2></div>
      <div class="info">
        <div><b>الموظف:</b> ${report.employeeName || "--"}</div>
        <div><b>من:</b> ${report.startDate}</div>
        <div><b>إلى:</b> ${report.endDate}</div>
      </div>
      <h3>ملخص حسب الفرع</h3>
      <table><thead><tr><th>الفرع</th><th>أيام</th><th>حضور</th><th>تأخير</th><th>غياب</th><th>إجازة</th><th>ساعات</th><th>دقائق تأخير</th></tr></thead>
      <tbody>${branchRowsHtml}
        <tr style="font-weight:bold;background:#fdf6e3;">
          <td>الإجمالي</td><td>${report.totals.days}</td><td>${report.totals.present}</td><td>${report.totals.late}</td>
          <td>${report.totals.absent}</td><td>${report.totals.leave}</td><td>${report.totals.workingHours.toFixed(1)}</td><td>${report.totals.lateMinutes}</td>
        </tr>
      </tbody></table>
      <h3>التفصيل اليومي</h3>
      <table><thead><tr><th>التاريخ</th><th>الفرع</th><th>الحالة</th><th>دخول</th><th>خروج</th><th>ساعات</th><th>دقائق تأخير</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  const totalCards = report
    ? [
        { label: "إجمالي الأيام", value: report.totals.days },
        { label: "حضور", value: report.totals.present },
        { label: "تأخير", value: report.totals.late },
        { label: "غياب", value: report.totals.absent },
        { label: "إجازة", value: report.totals.leave },
        { label: "ساعات العمل", value: report.totals.workingHours.toFixed(1) },
      ]
    : [];

  return (
    <Layout>
      <div className="page-container space-y-5" dir="rtl">
        <PageHeader
          icon={UserCheck}
          tone="people"
          title="تقرير حضور الموظف عبر الفروع"
          description="يجمع حضور الموظف من كل الفروع خلال الشهر — مفيد عند نقل الموظف بين الفروع"
          backHref="/attendance-dashboard"
        />

        {/* Controls */}
        <SectionCard title="اختر الموظف والشهر" data-testid="section-controls">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <label className="text-sm font-medium mb-1.5 block">الموظف</label>
              <div className="relative mb-2">
                <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث باسم الموظف..."
                  className="ps-9"
                  data-testid="input-search-employee"
                />
              </div>
              <div className="border rounded-lg max-h-52 overflow-y-auto divide-y" data-testid="list-employees">
                {empLoading ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin inline" /> جارٍ التحميل...
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">لا يوجد موظفون مطابقون</div>
                ) : (
                  filteredEmployees.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setSelectedId(e.id)}
                      className={`w-full text-start px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center justify-between ${
                        selectedId === e.id ? "bg-primary/10 font-semibold" : ""
                      }`}
                      data-testid={`employee-option-${e.id}`}
                    >
                      <span>{e.employeeName || e.name || `#${e.id}`}</span>
                      {e.status && e.status !== "active" && (
                        <Badge variant="secondary" className="text-[10px]">غير نشط</Badge>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-1.5 block">الشهر</label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                data-testid="input-month"
              />
              <div className="mt-auto pt-4">
                <Button
                  onClick={generate}
                  disabled={!selectedId}
                  className="w-full"
                  data-testid="button-generate"
                >
                  إنشاء التقرير
                </Button>
                {selectedEmployee && (
                  <p className="text-xs text-muted-foreground mt-2 text-center" data-testid="text-selected-employee">
                    المحدد: {selectedEmployee.employeeName || selectedEmployee.name}
                  </p>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        {reportLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {report && !reportLoading && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-bold flex items-center gap-2" data-testid="text-report-title">
                <CalendarDays className="w-5 h-5 text-primary" />
                {report.employeeName || "الموظف"} — {report.startDate} إلى {report.endDate}
              </h2>
              <Button variant="outline" onClick={handlePrint} data-testid="button-print">
                <Printer className="w-4 h-4 ms-2" /> طباعة
              </Button>
            </div>

            {/* Grand totals */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="grid-totals">
              {totalCards.map((c) => (
                <div key={c.label} className="rounded-xl border bg-card p-3 text-center" data-testid={`total-${c.label}`}>
                  <div className="text-2xl font-bold text-primary" dir="ltr">{c.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
                </div>
              ))}
            </div>

            {/* Per-branch summary */}
            <SectionCard title="ملخص حسب الفرع" data-testid="section-by-branch">
              {report.byBranch.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">لا توجد سجلات حضور لهذه الفترة</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground border-b">
                        <th className="text-start p-2">الفرع</th>
                        <th className="p-2">أيام</th>
                        <th className="p-2">حضور</th>
                        <th className="p-2">تأخير</th>
                        <th className="p-2">غياب</th>
                        <th className="p-2">إجازة</th>
                        <th className="p-2">ساعات</th>
                        <th className="p-2">دقائق تأخير</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byBranch.map((b) => (
                        <tr key={b.branchId} className="border-b last:border-0" data-testid={`branch-row-${b.branchId}`}>
                          <td className="p-2 font-medium flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            {b.branchName}
                          </td>
                          <td className="p-2 text-center">{b.days}</td>
                          <td className="p-2 text-center">{b.present}</td>
                          <td className="p-2 text-center">{b.late}</td>
                          <td className="p-2 text-center">{b.absent}</td>
                          <td className="p-2 text-center">{b.leave}</td>
                          <td className="p-2 text-center" dir="ltr">{b.workingHours.toFixed(1)}</td>
                          <td className="p-2 text-center">{b.lateMinutes}</td>
                        </tr>
                      ))}
                      <tr className="font-bold bg-amber-50 dark:bg-amber-950/20">
                        <td className="p-2">الإجمالي</td>
                        <td className="p-2 text-center">{report.totals.days}</td>
                        <td className="p-2 text-center">{report.totals.present}</td>
                        <td className="p-2 text-center">{report.totals.late}</td>
                        <td className="p-2 text-center">{report.totals.absent}</td>
                        <td className="p-2 text-center">{report.totals.leave}</td>
                        <td className="p-2 text-center" dir="ltr">{report.totals.workingHours.toFixed(1)}</td>
                        <td className="p-2 text-center">{report.totals.lateMinutes}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            {/* Daily detail */}
            <SectionCard title="التفصيل اليومي" data-testid="section-daily">
              {report.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">لا توجد سجلات</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground border-b">
                        <th className="text-start p-2">التاريخ</th>
                        <th className="text-start p-2">الفرع</th>
                        <th className="p-2">الحالة</th>
                        <th className="p-2">دخول</th>
                        <th className="p-2">خروج</th>
                        <th className="p-2">ساعات</th>
                        <th className="p-2">دقائق تأخير</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((r) => {
                        const s = statusInfo(r.status);
                        return (
                          <tr key={r.id} className="border-b last:border-0" data-testid={`day-row-${r.attendanceDate}`}>
                            <td className="p-2" dir="ltr">{r.attendanceDate}</td>
                            <td className="p-2">{r.branchName}</td>
                            <td className="p-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
                            </td>
                            <td className="p-2 text-center" dir="ltr">{r.actualCheckIn || "--"}</td>
                            <td className="p-2 text-center" dir="ltr">{r.actualCheckOut || "--"}</td>
                            <td className="p-2 text-center" dir="ltr">{r.workingHours != null ? Number(r.workingHours).toFixed(1) : "--"}</td>
                            <td className="p-2 text-center">{r.lateMinutes ?? 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </>
        )}
      </div>
    </Layout>
  );
}
