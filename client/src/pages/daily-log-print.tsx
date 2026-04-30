import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, ArrowRight } from "lucide-react";
import type { ProjectDailyLog, ProjectDailyLogPhoto, ConstructionProject, Contractor } from "@shared/schema";

interface DailyLogWithPhotos extends ProjectDailyLog {
  photos?: ProjectDailyLogPhoto[];
}

const PHOTO_TYPE_LABELS: Record<string, string> = {
  before: "قبل العمل",
  during: "أثناء العمل",
  after: "بعد العمل",
};

const WEATHER_LABELS: Record<string, string> = {
  sunny: "مشمس",
  cloudy: "غائم",
  rainy: "ممطر",
  hot: "حار جداً",
  windy: "رياح شديدة",
  dusty: "أتربة",
};

const ROLE_LABELS: Record<string, string> = {
  engineer: "مهندس",
  site_supervisor: "مشرف موقع",
  project_manager: "مدير مشروع",
  consultant: "استشاري",
  owner_rep: "ممثل المالك",
};

export default function DailyLogPrintPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0", 10);

  const { data: log, isLoading } = useQuery<DailyLogWithPhotos>({
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

  return (
    <div className="bg-white min-h-screen" dir="rtl">
      {/* Action bar (hidden on print) */}
      <div className="print:hidden bg-gray-100 border-b p-4 flex items-center justify-between">
        <Link href="/construction/daily-logs">
          <Button variant="outline" size="sm" data-testid="button-back">
            <ArrowRight className="h-4 w-4 ml-1" />
            رجوع
          </Button>
        </Link>
        <Button onClick={() => window.print()} data-testid="button-print">
          <Printer className="h-4 w-4 ml-2" />
          طباعة / حفظ PDF
        </Button>
      </div>

      <div className="max-w-4xl mx-auto p-8 print:p-4 text-black">
        {/* Header */}
        <div className="text-center mb-6 pb-4 border-b-2 border-gray-800">
          <h1 className="text-3xl font-bold mb-1">يومية أعمال مشروع</h1>
          <p className="text-sm text-gray-600">Daily Work Report</p>
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
              <td className="border p-2 font-bold">المقاول المنفذ</td>
              <td className="border p-2">{contractor?.name || "-"}</td>
              <td className="border p-2 font-bold">الطقس</td>
              <td className="border p-2">
                {log.weather ? WEATHER_LABELS[log.weather] || log.weather : "-"}
              </td>
            </tr>
            <tr>
              <td className="border p-2 font-bold">عدد العمالة</td>
              <td className="border p-2">{log.workersCount || 0}</td>
              <td className="border p-2 font-bold">نسبة الإنجاز اليومي</td>
              <td className="border p-2">{log.progressToday ? `${log.progressToday}%` : "-"}</td>
            </tr>
          </tbody>
        </table>

        {/* Work description */}
        <div className="mb-4">
          <h2 className="text-lg font-bold bg-gray-200 p-2 border border-gray-300">
            الأعمال المنفذة
          </h2>
          <div className="border border-t-0 border-gray-300 p-3 whitespace-pre-wrap min-h-[80px]">
            {log.workDescription}
          </div>
        </div>

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
