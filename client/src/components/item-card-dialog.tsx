import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Printer, Download, X, Package, Calendar, DollarSign, MapPin, FileText, Hash, Clock, AlertTriangle, CheckCircle2, XCircle, HelpCircle, Wrench } from "lucide-react";
import type { InventoryItem } from "@shared/schema";
import * as XLSX from "xlsx";

interface ItemCardDialogProps {
  item: InventoryItem | null;
  branchName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + " ر.س";
};

const formatDate = (dateStr: string | Date | null | undefined) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatDateShort = (dateStr: string | null | undefined) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const getStatusInfo = (status: string | null | undefined) => {
  switch (status) {
    case "good":
      return { label: "جيد", color: "bg-green-100 text-green-800 border-green-300", icon: CheckCircle2 };
    case "maintenance":
      return { label: "يحتاج صيانة", color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: Wrench };
    case "damaged":
      return { label: "تالف", color: "bg-red-100 text-red-800 border-red-300", icon: XCircle };
    case "missing":
      return { label: "مفقود", color: "bg-gray-100 text-gray-800 border-gray-300", icon: HelpCircle };
    default:
      return { label: "غير محدد", color: "bg-gray-100 text-gray-600 border-gray-300", icon: HelpCircle };
  }
};

export function ItemCardDialog({ item, branchName, open, onOpenChange }: ItemCardDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: item ? `كارت صنف - ${item.name}` : "كارت صنف",
  });

  const handleExport = () => {
    if (!item) return;
    
    const total = (item.price || 0) * item.quantity;
    const vat = total * 0.15;
    const totalWithVat = total + vat;
    
    const data = [
      { الحقل: "الرمز / المعرف", القيمة: item.id },
      { الحقل: "اسم الصنف", القيمة: item.name },
      { الحقل: "الفرع", القيمة: branchName || item.branchId },
      { الحقل: "التصنيف", القيمة: item.category },
      { الحقل: "الكمية", القيمة: item.quantity },
      { الحقل: "الوحدة", القيمة: item.unit },
      { الحقل: "السعر", القيمة: item.price || 0 },
      { الحقل: "الإجمالي", القيمة: total },
      { الحقل: "الضريبة (15%)", القيمة: vat },
      { الحقل: "الإجمالي شامل الضريبة", القيمة: totalWithVat },
      { الحقل: "الحالة", القيمة: getStatusInfo(item.status).label },
      { الحقل: "الرقم التسلسلي", القيمة: item.serialNumber || "-" },
      { الحقل: "آخر فحص", القيمة: item.lastCheck || "-" },
      { الحقل: "موعد الفحص القادم", القيمة: item.nextInspectionDate || "-" },
      { الحقل: "ملاحظات", القيمة: item.notes || "-" },
      { الحقل: "تاريخ الإنشاء", القيمة: formatDate(item.createdAt) },
      { الحقل: "آخر تحديث", القيمة: formatDate(item.updatedAt) },
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "كارت الصنف");
    XLSX.writeFile(wb, `كارت_صنف_${item.name.replace(/\s+/g, "_")}.xlsx`);
  };

  if (!item) return null;

  const statusInfo = getStatusInfo(item.status);
  const StatusIcon = statusInfo.icon;
  const total = (item.price || 0) * item.quantity;
  const vat = total * 0.15;
  const totalWithVat = total + vat;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="sticky top-0 bg-background z-10 border-b px-6 py-4 flex items-center justify-between">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="w-5 h-5 text-primary" />
            كارت الصنف
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handlePrint()} data-testid="button-print-card">
              <Printer className="w-4 h-4 ml-2" />
              طباعة
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export-card">
              <Download className="w-4 h-4 ml-2" />
              تصدير
            </Button>
          </div>
        </div>

        <div ref={printRef} className="p-6 print:p-4">
          <div className="print:block hidden mb-4 text-center border-b pb-4">
            <h1 className="text-2xl font-bold">كارت صنف</h1>
            <p className="text-muted-foreground">نظام إدارة الأصول - باتر</p>
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-shrink-0">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-40 h-40 object-cover rounded-lg border shadow-sm"
                  onError={(e) => {
                    e.currentTarget.src = "";
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="w-40 h-40 bg-muted rounded-lg flex items-center justify-center">
                  <Package className="w-16 h-16 text-muted-foreground/30" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{item.name}</h2>
                <p className="text-muted-foreground">{item.category}</p>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge className={`${statusInfo.color} border px-3 py-1`}>
                  <StatusIcon className="w-4 h-4 ml-1" />
                  {statusInfo.label}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{branchName || item.branchId}</span>
              </div>

              {item.serialNumber && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Hash className="w-4 h-4" />
                  <span className="font-mono text-sm">{item.serialNumber}</span>
                </div>
              )}
            </div>
          </div>

          <Separator className="my-6" />

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Package className="w-4 h-4" />
                الكمية
              </div>
              <p className="text-2xl font-bold font-mono">{item.quantity.toLocaleString('en-US')} <span className="text-sm font-normal text-muted-foreground">{item.unit}</span></p>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <DollarSign className="w-4 h-4" />
                سعر الوحدة
              </div>
              <p className="text-xl font-bold font-mono">{item.price ? formatCurrency(item.price) : "-"}</p>
            </div>

            <div className="bg-primary/10 rounded-lg p-4">
              <div className="flex items-center gap-2 text-primary text-sm mb-1">
                <DollarSign className="w-4 h-4" />
                الإجمالي
              </div>
              <p className="text-xl font-bold font-mono text-primary">{item.price ? formatCurrency(total) : "-"}</p>
            </div>
          </div>

          {item.price && item.price > 0 && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-muted/20 rounded-lg p-3 border">
                <div className="text-muted-foreground text-sm">الضريبة (15%)</div>
                <p className="text-lg font-bold font-mono">{formatCurrency(vat)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <div className="text-green-700 text-sm">الإجمالي شامل الضريبة</div>
                <p className="text-lg font-bold font-mono text-green-700">{formatCurrency(totalWithVat)}</p>
              </div>
            </div>
          )}

          <Separator className="my-6" />

          <div className="space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              معلومات التواريخ والفحص
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">تاريخ الإنشاء</span>
                <p className="font-medium">{formatDate(item.createdAt)}</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">آخر تحديث</span>
                <p className="font-medium">{formatDate(item.updatedAt)}</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">آخر فحص</span>
                <p className="font-medium">{item.lastCheck || "-"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">موعد الفحص القادم</span>
                <p className={`font-medium ${item.nextInspectionDate && new Date(item.nextInspectionDate) < new Date() ? "text-red-600" : ""}`}>
                  {formatDateShort(item.nextInspectionDate)}
                  {item.nextInspectionDate && new Date(item.nextInspectionDate) < new Date() && (
                    <span className="text-xs text-red-600 mr-2">(متأخر)</span>
                  )}
                </p>
              </div>
              {item.inspectionIntervalDays && (
                <div className="space-y-1 col-span-2">
                  <span className="text-sm text-muted-foreground">فترة الفحص الدوري</span>
                  <p className="font-medium">{item.inspectionIntervalDays} يوم</p>
                </div>
              )}
            </div>
          </div>

          {item.notes && (
            <>
              <Separator className="my-6" />
              <div className="space-y-2">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  ملاحظات
                </h3>
                <p className="text-muted-foreground bg-muted/30 rounded-lg p-4">{item.notes}</p>
              </div>
            </>
          )}

          <Separator className="my-6" />

          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>معرف الصنف: <span className="font-mono">{item.id}</span></p>
            <p className="print:block hidden">تم الطباعة بتاريخ: {new Date().toLocaleString("ar-SA")}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
