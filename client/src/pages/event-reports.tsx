import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PartyPopper, TrendingUp, Receipt, Banknote, CreditCard,
  RotateCcw, Percent, Ban, Loader2, MapPin, CalendarDays,
  Clock, Package, Users
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

const EVENT_BRANCH_ID = "EVENT-BB";

function fmt(n: number | null | undefined) {
  return (Number(n) || 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function EventReportsPage() {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  const { data: posEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["/api/pos/events", EVENT_BRANCH_ID],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pos/events?branchId=${EVENT_BRANCH_ID}`);
      return res.json();
    },
  });

  useEffect(() => {
    if (selectedEventId == null && (posEvents as any[]).length > 0) {
      const active = (posEvents as any[]).find((e: any) => e.status === "active");
      setSelectedEventId((active || (posEvents as any[])[0]).id);
    }
  }, [posEvents, selectedEventId]);

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ["/api/pos/events/report", selectedEventId],
    enabled: selectedEventId != null,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pos/events/${selectedEventId}/report`);
      return res.json();
    },
  });

  const event = report?.event;

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-5" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-orange-500 to-amber-400 rounded-2xl flex items-center justify-center shadow-sm">
              <PartyPopper className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-900" data-testid="text-reports-title">تقارير الإيفنتات</h1>
              <p className="text-xs text-gray-400">ملخص المبيعات والورديات لكل إيفنت</p>
            </div>
          </div>
          <select
            value={selectedEventId ?? ""}
            onChange={e => setSelectedEventId(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="text-sm font-bold text-gray-800 bg-white border border-gray-200 rounded-xl px-3 py-2.5 outline-none shadow-sm min-w-[200px]"
            data-testid="select-report-event"
          >
            {(posEvents as any[]).map((ev: any) => (
              <option key={ev.id} value={ev.id}>{ev.name}{ev.status !== "active" ? " (مغلق)" : ""}</option>
            ))}
          </select>
        </div>

        {eventsLoading || (selectedEventId != null && reportLoading) ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
        ) : (posEvents as any[]).length === 0 ? (
          <Card className="rounded-2xl"><CardContent className="py-16 text-center text-gray-400 text-sm">لا توجد إيفنتات بعد — أنشئها من إعدادات نقطة البيع</CardContent></Card>
        ) : !report ? null : (
          <>
            {event && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 bg-white rounded-2xl border border-gray-200 px-4 py-3">
                <span className="font-black text-gray-800 text-sm">{event.name}</span>
                {event.status === "active" ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]">نشط</Badge> : <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 text-[10px]">مغلق</Badge>}
                {event.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{event.location}</span>}
                {(event.startDate || event.endDate) && <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{event.startDate || "؟"} ← {event.endDate || "؟"}</span>}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="rounded-2xl border-gray-200"><CardContent className="p-4">
                <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 mb-1"><TrendingUp className="w-3.5 h-3.5 text-green-500" />صافي المبيعات</div>
                <div className="text-xl font-black text-gray-900" data-testid="text-net-sales">{fmt(report.netSales)} <span className="text-xs text-gray-400">ر.س</span></div>
              </CardContent></Card>
              <Card className="rounded-2xl border-gray-200"><CardContent className="p-4">
                <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 mb-1"><Receipt className="w-3.5 h-3.5 text-orange-500" />عدد الفواتير</div>
                <div className="text-xl font-black text-gray-900" data-testid="text-transactions">{report.totalTransactions}</div>
              </CardContent></Card>
              <Card className="rounded-2xl border-gray-200"><CardContent className="p-4">
                <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 mb-1"><Banknote className="w-3.5 h-3.5 text-green-600" />مبيعات نقدية</div>
                <div className="text-xl font-black text-gray-900">{fmt(report.cashTotal)}</div>
              </CardContent></Card>
              <Card className="rounded-2xl border-gray-200"><CardContent className="p-4">
                <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 mb-1"><CreditCard className="w-3.5 h-3.5 text-blue-500" />مبيعات الشبكة</div>
                <div className="text-xl font-black text-gray-900">{fmt(report.networkTotal)}</div>
              </CardContent></Card>
              <Card className="rounded-2xl border-gray-200"><CardContent className="p-4">
                <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 mb-1"><Percent className="w-3.5 h-3.5 text-purple-500" />الضريبة (15%)</div>
                <div className="text-xl font-black text-gray-900">{fmt(report.vatTotal)}</div>
              </CardContent></Card>
              <Card className="rounded-2xl border-gray-200"><CardContent className="p-4">
                <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 mb-1"><Percent className="w-3.5 h-3.5 text-pink-500" />الخصومات</div>
                <div className="text-xl font-black text-gray-900">{fmt(report.discountTotal)}</div>
              </CardContent></Card>
              <Card className="rounded-2xl border-gray-200"><CardContent className="p-4">
                <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 mb-1"><RotateCcw className="w-3.5 h-3.5 text-amber-500" />الاسترجاعات ({report.refundsCount})</div>
                <div className="text-xl font-black text-red-500">-{fmt(report.refundsTotal)}</div>
              </CardContent></Card>
              <Card className="rounded-2xl border-gray-200"><CardContent className="p-4">
                <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 mb-1"><Ban className="w-3.5 h-3.5 text-rose-500" />فواتير ملغاة</div>
                <div className="text-xl font-black text-gray-900">{report.voidedCount}</div>
              </CardContent></Card>
            </div>

            {report.dailySales?.length > 0 && (
              <Card className="rounded-2xl border-gray-200">
                <CardContent className="p-4">
                  <h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-orange-500" />المبيعات اليومية</h3>
                  <div className="h-56" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.dailySales}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: any) => [`${fmt(Number(v))} ر.س`, "المبيعات"]} />
                        <Bar dataKey="sales" fill="#f97316" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="rounded-2xl border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
                  <Package className="w-4 h-4 text-orange-500" />
                  <h3 className="font-bold text-sm text-gray-700">أعلى الأصناف مبيعاً</h3>
                </div>
                <div className="divide-y divide-gray-50 max-h-[380px] overflow-y-auto">
                  {report.productSales?.length ? report.productSales.map((p: any) => (
                    <div key={p.productId + p.productName} className="px-4 py-2.5 flex items-center justify-between text-sm" data-testid={`row-product-${p.productId}`}>
                      <div>
                        <div className="font-bold text-gray-800">{p.productName}</div>
                        <div className="text-[11px] text-gray-400">الكمية: {p.totalQuantity}{p.refundedQuantity > 0 ? ` — مسترجع: ${p.refundedQuantity}` : ""}</div>
                      </div>
                      <div className="font-black text-gray-900">{fmt(p.totalRevenue)} <span className="text-[10px] text-gray-400">ر.س</span></div>
                    </div>
                  )) : <div className="py-10 text-center text-sm text-gray-400">لا توجد مبيعات بعد</div>}
                </div>
              </Card>

              <Card className="rounded-2xl border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-500" />
                  <h3 className="font-bold text-sm text-gray-700">الورديات والتسويات</h3>
                </div>
                <div className="divide-y divide-gray-50 max-h-[380px] overflow-y-auto">
                  {report.shifts?.length ? report.shifts.map((s: any) => (
                    <div key={s.id} className="px-4 py-3 text-sm" data-testid={`row-shift-${s.id}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-gray-800 flex items-center gap-2">
                          {s.cashierName}
                          {s.status === "open" ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]">مفتوحة</Badge> : <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 text-[10px]">مغلقة</Badge>}
                        </div>
                        {s.status === "closed" && s.cashDiscrepancy != null && (
                          <span className={`text-xs font-black ${Math.abs(s.cashDiscrepancy) < 0.01 ? "text-green-600" : s.cashDiscrepancy > 0 ? "text-blue-600" : "text-red-600"}`}>
                            {Math.abs(s.cashDiscrepancy) < 0.01 ? "مطابق" : `${s.cashDiscrepancy > 0 ? "+" : ""}${fmt(s.cashDiscrepancy)} ر.س`}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.openedAt ? new Date(s.openedAt).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" }) : ""}</span>
                        {s.closedAt && <span>← {new Date(s.closedAt).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}</span>}
                        <span>افتتاحي: {fmt(s.openingCash)}</span>
                        {s.status === "closed" && <span>متوقع: {fmt(s.expectedCash)} / فعلي: {fmt(s.actualCash)}</span>}
                      </div>
                      {s.notes && <div className="text-[11px] text-amber-600 mt-1">ملاحظة: {s.notes}</div>}
                    </div>
                  )) : <div className="py-10 text-center text-sm text-gray-400">لا توجد ورديات بعد</div>}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
