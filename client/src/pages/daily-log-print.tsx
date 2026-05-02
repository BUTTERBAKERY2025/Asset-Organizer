import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, ArrowRight, FileDown, MessageCircle } from "lucide-react";
import type {
  ProjectDailyLog, ProjectDailyLogPhoto, ConstructionProject, Contractor,
  DailyLogActivity, ProjectExpense,
} from "@shared/schema";

interface DailyLogDetail extends ProjectDailyLog {
  photos?: ProjectDailyLogPhoto[];
  activities?: DailyLogActivity[];
  expenses?: ProjectExpense[];
}

const PHOTO_TYPE_LABELS: Record<string, string> = {
  before: "قبل العمل",
  during: "أثناء العمل",
  after: "بعد العمل",
};

const ROLE_LABELS: Record<string, string> = {
  engineer: "مهندس",
  site_supervisor: "مشرف موقع",
  project_manager: "مدير مشروع",
  consultant: "استشاري",
  owner_rep: "ممثل المالك",
};

const TRADE_LABELS: Record<string, string> = {
  paint: "دهانات",
  tiling: "سيراميك وأرضيات",
  hvac: "تكييف",
  plumbing: "سباكة",
  electrical: "كهرباء وإضاءة",
  gypsum: "جبس وديكورات",
  kitchen_steel: "مطبخ ستيل تجاري",
  glass: "زجاج وواجهات",
  mdf: "MDF ونجارة ديكور",
  signage: "لافتات وعلامات",
  other: "أخرى",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي",
  bank_transfer: "تحويل بنكي",
  check: "شيك",
};

export default function DailyLogPrintPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0", 10);

  const { data: log, isLoading } = useQuery<DailyLogDetail>({
    queryKey: [`/api/construction/daily-logs/${id}`],
    enabled: !!id,
  });

  const { data: projects = [] } = useQuery<ConstructionProject[]>({
    queryKey: ["/api/construction/projects"],
  });

  const { data: contractors = [] } = useQuery<Contractor[]>({
    queryKey: ["/api/construction/contractors"],
  });

  const project = projects.find((p) => p.id === log?.projectId);
  const contractor = contractors.find((c) => c.id === log?.contractorId);

  // Auto-trigger print dialog when ?autoprint=1 is in the URL (used for "تصدير PDF")
  // Use a ref to ensure it only fires once even if dependent queries resolve later.
  const hasAutoPrintedRef = useRef(false);
  const originalTitleRef = useRef<string | null>(null);

  useEffect(() => {
    if (!log || hasAutoPrintedRef.current) return;
    const search = new URLSearchParams(window.location.search);
    if (search.get("autoprint") !== "1") return;
    hasAutoPrintedRef.current = true;

    if (originalTitleRef.current === null) {
      originalTitleRef.current = document.title;
    }
    document.title = `يومية_${project?.title || log.projectId}_${log.logDate}`;

    const restoreTitle = () => {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }
    };
    window.addEventListener("afterprint", restoreTitle, { once: true });

    const t = setTimeout(() => window.print(), 800);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", restoreTitle);
      restoreTitle();
    };
  }, [log, project]);

  const triggerPrintWithTitle = () => {
    if (!log) return;
    const oldTitle = document.title;
    document.title = `يومية_${project?.title || log.projectId}_${log.logDate}`;
    const restore = () => { document.title = oldTitle; };
    window.addEventListener("afterprint", restore, { once: true });
    window.print();
    setTimeout(restore, 2000);
  };

  const handleWhatsAppShare = () => {
    if (!log) return;
    const MAX_DESC = 1000;
    const desc = log.workDescription || "";
    const truncatedDesc = desc.length > MAX_DESC ? desc.slice(0, MAX_DESC) + "…" : desc;
    const lines = [
      `*يومية أعمال موقع*`,
      `📍 المشروع: ${project?.title || `#${log.projectId}`}`,
      `📅 التاريخ: ${log.logDate}`,
      `👤 المشرف: ${log.supervisorName}`,
      log.workersCount ? `👷 عدد العمالة: ${log.workersCount}` : null,
      (log as any).mainTrade
        ? `🔧 التشطيب: ${TRADE_LABELS[(log as any).mainTrade] || (log as any).mainTrade}`
        : null,
      ``,
      `*ملخص الأعمال:*`,
      truncatedDesc,
      ``,
      `🔗 رابط اليومية: ${window.location.origin}/construction/daily-logs/${log.id}/print`,
    ].filter(Boolean).join("\n");
    const url = `https://wa.me/?text=${encodeURIComponent(lines)}`;
    window.open(url, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!log) {
    return (
      <div className="text-center py-12" dir="rtl">
        <p className="text-muted-foreground">اليومية غير موجودة</p>
        <Link href="/construction/daily-logs">
          <Button variant="outline" className="mt-4">
            <ArrowRight className="h-4 w-4 ml-2" />
            العودة
          </Button>
        </Link>
      </div>
    );
  }

  const contractorName = (cid?: number | null) =>
    cid ? contractors.find((c) => c.id === cid)?.name || "-" : "-";

  const activities = log.activities || [];
  const expenses = log.expenses || [];
  const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const activitiesTotal = activities.reduce((s, a) => s + Number(a.totalCost || 0), 0);

  // Legacy data (older logs created before the smart-link restructure)
  const legacyWorkItems = Array.isArray((log as any).workItems) ? (log as any).workItems : [];
  const legacyWorkers = Array.isArray((log as any).workerBreakdown) ? (log as any).workerBreakdown : [];

  return (
    <div className="bg-white min-h-screen" dir="rtl">
      {/* Action bar (hidden on print) */}
      <div className="print:hidden bg-gray-100 border-b p-4 flex items-center justify-between flex-wrap gap-2">
        <Link href="/construction/daily-logs">
          <Button variant="outline" size="sm" data-testid="button-back">
            <ArrowRight className="h-4 w-4 ml-1" />
            رجوع
          </Button>
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleWhatsAppShare}
            data-testid="button-whatsapp-share"
            className="bg-green-600 text-white hover:bg-green-700 border-green-600"
          >
            <MessageCircle className="h-4 w-4 ml-2" />
            مشاركة واتساب
          </Button>
          <Button
            variant="outline"
            onClick={triggerPrintWithTitle}
            data-testid="button-export-pdf"
          >
            <FileDown className="h-4 w-4 ml-2" />
            تصدير PDF
          </Button>
          <Button onClick={() => window.print()} data-testid="button-print">
            <Printer className="h-4 w-4 ml-2" />
            طباعة
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8 print:p-4 text-black">
        {/* Header */}
        <div className="text-center mb-6 pb-4 border-b-2 border-gray-800">
          <h1 className="text-3xl font-bold mb-1">يومية أعمال موقع</h1>
          <p className="text-sm text-gray-600">Daily Site Work Report</p>
        </div>

        {/* Project info table */}
        <table className="w-full text-sm mb-4 border border-gray-300">
          <tbody>
            <tr className="bg-gray-100">
              <td className="border p-2 font-bold w-1/4">المشروع</td>
              <td className="border p-2">{project?.title || `#${log.projectId}`}</td>
              <td className="border p-2 font-bold w-1/4">التاريخ</td>
              <td className="border p-2 font-mono">{log.logDate}</td>
            </tr>
            <tr>
              <td className="border p-2 font-bold">المشرف/المهندس</td>
              <td className="border p-2">{log.supervisorName}</td>
              <td className="border p-2 font-bold">الصفة</td>
              <td className="border p-2">
                {log.supervisorRole ? ROLE_LABELS[log.supervisorRole] || log.supervisorRole : "-"}
              </td>
            </tr>
            <tr className="bg-gray-100">
              <td className="border p-2 font-bold">المقاول الافتراضي</td>
              <td className="border p-2">{contractor?.name || "-"}</td>
              <td className="border p-2 font-bold">نوع التشطيب الرئيسي</td>
              <td className="border p-2">
                {(log as any).mainTrade
                  ? TRADE_LABELS[(log as any).mainTrade] || (log as any).mainTrade
                  : "-"}
              </td>
            </tr>
            <tr>
              <td className="border p-2 font-bold">عدد العمالة</td>
              <td className="border p-2">{log.workersCount || 0}</td>
              <td className="border p-2 font-bold">موقع التنفيذ</td>
              <td className="border p-2">{(log as any).workLocation || "-"}</td>
            </tr>
            <tr className="bg-gray-100">
              <td className="border p-2 font-bold">ساعات العمل</td>
              <td className="border p-2 font-mono" colSpan={3}>
                {(log as any).startTime || "--:--"} ← {(log as any).endTime || "--:--"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Work description */}
        <div className="mb-4">
          <h2 className="text-lg font-bold bg-gray-200 p-2 border border-gray-300">
            ملخص أعمال اليوم
          </h2>
          <div className="border border-t-0 border-gray-300 p-3 whitespace-pre-wrap min-h-[60px]">
            {log.workDescription}
          </div>
        </div>

        {/* Activities table (NEW smart-link structure) */}
        {activities.length > 0 && (
          <div className="mb-4">
            <h2 className="text-lg font-bold bg-gray-200 p-2 border border-gray-300">
              الأنشطة المنفذة ({activities.length})
            </h2>
            <table className="w-full text-sm border border-t-0 border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border p-2 w-8">#</th>
                  <th className="border p-2">المقاول</th>
                  <th className="border p-2">التشطيب</th>
                  <th className="border p-2">الوصف</th>
                  <th className="border p-2 w-20">الكمية</th>
                  <th className="border p-2 w-14">الوحدة</th>
                  <th className="border p-2 w-24">التكلفة (ر.س)</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a, i) => (
                  <tr key={a.id}>
                    <td className="border p-2 text-center">{i + 1}</td>
                    <td className="border p-2">{contractorName(a.contractorId)}</td>
                    <td className="border p-2">
                      {a.tradeType ? TRADE_LABELS[a.tradeType] || a.tradeType : "-"}
                    </td>
                    <td className="border p-2">{a.description}</td>
                    <td className="border p-2 text-center">{a.quantityToday ?? "-"}</td>
                    <td className="border p-2 text-center">{a.unit || "-"}</td>
                    <td className="border p-2 text-end font-mono">
                      {a.totalCost != null && Number(a.totalCost) > 0
                        ? Number(a.totalCost).toLocaleString("ar-SA")
                        : "-"}
                    </td>
                  </tr>
                ))}
                {activitiesTotal > 0 && (
                  <tr className="bg-gray-100 font-bold">
                    <td className="border p-2 text-center" colSpan={6}>
                      إجمالي تكلفة الأنشطة
                    </td>
                    <td className="border p-2 text-end font-mono">
                      {activitiesTotal.toLocaleString("ar-SA")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Expenses table (NEW) */}
        {expenses.length > 0 && (
          <div className="mb-4">
            <h2 className="text-lg font-bold bg-gray-200 p-2 border border-gray-300">
              مصروفات الموقع ({expenses.length})
            </h2>
            <table className="w-full text-sm border border-t-0 border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border p-2 w-8">#</th>
                  <th className="border p-2">الوصف</th>
                  <th className="border p-2">المستفيد</th>
                  <th className="border p-2">المقاول</th>
                  <th className="border p-2 w-24">طريقة الدفع</th>
                  <th className="border p-2 w-28">المبلغ (ر.س)</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e, i) => (
                  <tr key={e.id}>
                    <td className="border p-2 text-center">{i + 1}</td>
                    <td className="border p-2">{e.description}</td>
                    <td className="border p-2">{e.beneficiaryName || "-"}</td>
                    <td className="border p-2">{contractorName(e.contractorId)}</td>
                    <td className="border p-2 text-center">
                      {e.paymentMethod ? PAYMENT_LABELS[e.paymentMethod] || e.paymentMethod : "-"}
                    </td>
                    <td className="border p-2 text-end font-mono">
                      {Number(e.amount).toLocaleString("ar-SA")}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold">
                  <td className="border p-2 text-center" colSpan={5}>
                    إجمالي مصروفات اليوم
                  </td>
                  <td className="border p-2 text-end font-mono">
                    {expensesTotal.toLocaleString("ar-SA")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Legacy work items (only render for old logs that have them) */}
        {legacyWorkItems.length > 0 && (
          <div className="mb-4">
            <h2 className="text-lg font-bold bg-gray-200 p-2 border border-gray-300">
              بنود الأعمال (نظام قديم)
            </h2>
            <table className="w-full text-sm border border-t-0 border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border p-2 w-10">#</th>
                  <th className="border p-2">نوع العمل</th>
                  <th className="border p-2">الوصف</th>
                  <th className="border p-2 w-20">الكمية</th>
                  <th className="border p-2 w-16">الوحدة</th>
                </tr>
              </thead>
              <tbody>
                {legacyWorkItems.map((item: any, i: number) => (
                  <tr key={i}>
                    <td className="border p-2 text-center">{i + 1}</td>
                    <td className="border p-2">{item.type || "-"}</td>
                    <td className="border p-2">{item.description || "-"}</td>
                    <td className="border p-2 text-center">{item.quantity ?? "-"}</td>
                    <td className="border p-2 text-center">{item.unit || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legacy worker breakdown (only render for old logs) */}
        {legacyWorkers.length > 0 && (
          <div className="mb-4">
            <h2 className="text-lg font-bold bg-gray-200 p-2 border border-gray-300">
              توزيع العمالة (نظام قديم)
            </h2>
            <table className="w-full text-sm border border-t-0 border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border p-2">التخصص</th>
                  <th className="border p-2 w-24">العدد</th>
                </tr>
              </thead>
              <tbody>
                {legacyWorkers.map((w: any, i: number) => (
                  <tr key={i}>
                    <td className="border p-2">{w.role || "-"}</td>
                    <td className="border p-2 text-center">{w.count || 0}</td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold">
                  <td className="border p-2">الإجمالي</td>
                  <td className="border p-2 text-center">
                    {legacyWorkers.reduce((s: number, w: any) => s + (Number(w.count) || 0), 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Equipment used */}
        {log.equipmentUsed && (
          <div className="mb-4">
            <h2 className="text-lg font-bold bg-gray-200 p-2 border border-gray-300">
              المعدات المستخدمة
            </h2>
            <div className="border border-t-0 border-gray-300 p-3 whitespace-pre-wrap">
              {log.equipmentUsed}
            </div>
          </div>
        )}

        {/* Safety incidents */}
        {(log as any).safetyIncidents && (
          <div className="mb-4">
            <h2 className="text-lg font-bold bg-amber-100 p-2 border border-amber-300">
              ⚠ حوادث السلامة
            </h2>
            <div className="border border-t-0 border-amber-300 p-3 whitespace-pre-wrap bg-amber-50">
              {(log as any).safetyIncidents}
            </div>
          </div>
        )}

        {/* Issues */}
        {log.issues && (
          <div className="mb-4">
            <h2 className="text-lg font-bold bg-gray-200 p-2 border border-gray-300">
              المشاكل والمعوقات
            </h2>
            <div className="border border-t-0 border-gray-300 p-3 whitespace-pre-wrap">
              {log.issues}
            </div>
          </div>
        )}

        {/* Next day plan */}
        {(log as any).nextDayPlan && (
          <div className="mb-4">
            <h2 className="text-lg font-bold bg-gray-200 p-2 border border-gray-300">
              خطة عمل اليوم التالي
            </h2>
            <div className="border border-t-0 border-gray-300 p-3 whitespace-pre-wrap">
              {(log as any).nextDayPlan}
            </div>
          </div>
        )}

        {/* Notes */}
        {log.notes && (
          <div className="mb-4">
            <h2 className="text-lg font-bold bg-gray-200 p-2 border border-gray-300">ملاحظات</h2>
            <div className="border border-t-0 border-gray-300 p-3 whitespace-pre-wrap">
              {log.notes}
            </div>
          </div>
        )}

        {/* Photos */}
        {log.photos && log.photos.length > 0 && (
          <div className="mb-4">
            <h2 className="text-lg font-bold bg-gray-200 p-2 border border-gray-300">
              الصور المرفقة ({log.photos.length})
            </h2>
            <div className="border border-t-0 border-gray-300 p-3">
              <div className="grid grid-cols-2 gap-3">
                {log.photos.map((photo) => (
                  <div key={photo.id} className="border border-gray-300 p-1 break-inside-avoid">
                    <img
                      src={photo.photoUrl}
                      alt={photo.caption || ""}
                      className="w-full h-48 object-cover"
                      crossOrigin="anonymous"
                    />
                    <div className="text-xs p-1 bg-gray-50">
                      <span className="font-bold">
                        {PHOTO_TYPE_LABELS[photo.photoType || "during"]}:
                      </span>{" "}
                      {photo.caption || "-"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 mt-12 pt-4">
          <div className="text-center">
            <div className="border-t-2 border-gray-700 pt-2 mt-12">
              <p className="font-bold">المشرف الميداني</p>
              <p className="text-sm text-gray-600">{log.supervisorName}</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t-2 border-gray-700 pt-2 mt-12">
              <p className="font-bold">مدير المشروع</p>
              <p className="text-sm text-gray-600">.........................</p>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-gray-500 mt-6 print:fixed print:bottom-2 print:left-0 print:right-0">
          تم إنشاء التقرير في {new Date().toLocaleString("ar-SA")}
        </div>
      </div>
    </div>
  );
}
