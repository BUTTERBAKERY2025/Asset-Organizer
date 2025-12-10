import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { QrCode, History, Package, AlertCircle, CheckCircle2 } from "lucide-react";
import type { InventoryItem, AuditLog } from "@shared/schema";

interface AssetDetailsDialogProps {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchName?: string;
}

export function AssetDetailsDialog({ item, open, onOpenChange, branchName }: AssetDetailsDialogProps) {
  const { data: auditLogs = [], isLoading: logsLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/inventory", item?.id, "audit-logs"],
    queryFn: async () => {
      if (!item) return [];
      const res = await fetch(`/api/inventory/${item.id}/audit-logs`);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
    enabled: !!item && open,
  });

  if (!item) return null;

  const qrData = JSON.stringify({
    id: item.id,
    name: item.name,
    branch: item.branchId,
    category: item.category,
    serial: item.serialNumber || "N/A",
  });

  const getStatusBadge = (status?: string | null) => {
    switch (status) {
      case "good":
        return <Badge className="bg-green-100 text-green-700">جيد</Badge>;
      case "maintenance":
        return <Badge className="bg-orange-100 text-orange-700">صيانة</Badge>;
      case "damaged":
        return <Badge className="bg-red-100 text-red-700">تالف</Badge>;
      case "missing":
        return <Badge className="bg-gray-100 text-gray-700">مفقود</Badge>;
      default:
        return <Badge variant="outline">غير محدد</Badge>;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "create":
        return "إنشاء";
      case "update":
        return "تعديل";
      case "delete":
        return "حذف";
      default:
        return action;
    }
  };

  const getFieldLabel = (fieldName: string | null) => {
    if (!fieldName) return "";
    const labels: Record<string, string> = {
      name: "الاسم",
      quantity: "الكمية",
      price: "السعر",
      status: "الحالة",
      category: "الفئة",
      unit: "الوحدة",
      notes: "ملاحظات",
      lastCheck: "آخر فحص",
      serialNumber: "الرقم التسلسلي",
      branchId: "الفرع",
      nextInspectionDate: "موعد الفحص القادم",
      inspectionIntervalDays: "فترة الفحص",
      imageUrl: "صورة الأصل",
    };
    return labels[fieldName] || fieldName;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {item.name}
          </DialogTitle>
          <DialogDescription>
            {branchName && <span>{branchName} - </span>}
            {item.category}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1">
              <Package className="w-4 h-4 ml-2" />
              التفاصيل
            </TabsTrigger>
            <TabsTrigger value="qrcode" className="flex-1">
              <QrCode className="w-4 h-4 ml-2" />
              رمز QR
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              <History className="w-4 h-4 ml-2" />
              سجل التغييرات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">الكمية</label>
                <p className="font-medium">{item.quantity} {item.unit}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">الحالة</label>
                <div className="mt-1">{getStatusBadge(item.status)}</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">السعر</label>
                <p className="font-medium font-mono">
                  {item.price ? `${item.price.toLocaleString('en-US')} ريال` : "-"}
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">آخر فحص</label>
                <p className="font-medium">{item.lastCheck || "-"}</p>
              </div>
              {item.serialNumber && (
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground">الرقم التسلسلي</label>
                  <p className="font-medium font-mono">{item.serialNumber}</p>
                </div>
              )}
              {item.notes && (
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground">ملاحظات</label>
                  <p className="font-medium">{item.notes}</p>
                </div>
              )}
              {item.nextInspectionDate && (
                <div>
                  <label className="text-sm text-muted-foreground">موعد الفحص القادم</label>
                  <p className="font-medium">
                    {new Date(item.nextInspectionDate).toLocaleDateString('en-GB')}
                  </p>
                </div>
              )}
              {item.inspectionIntervalDays && (
                <div>
                  <label className="text-sm text-muted-foreground">فترة الفحص</label>
                  <p className="font-medium">كل {item.inspectionIntervalDays} يوم</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="qrcode" className="mt-4">
            <div className="flex flex-col items-center justify-center p-6">
              <Card className="p-6 bg-white">
                <QRCodeSVG
                  value={qrData}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </Card>
              <p className="mt-4 text-sm text-muted-foreground text-center">
                امسح رمز QR للوصول السريع لمعلومات الأصل
              </p>
              <p className="mt-2 text-xs text-muted-foreground font-mono">
                {item.id}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <ScrollArea className="h-[300px]">
              {logsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  جاري التحميل...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  لا يوجد سجل تغييرات لهذا الأصل
                </div>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {log.action === "create" ? (
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          </div>
                        ) : log.action === "update" ? (
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <History className="w-4 h-4 text-blue-600" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{getActionLabel(log.action)}</Badge>
                          {log.fieldName && (
                            <span className="text-sm font-medium">
                              {getFieldLabel(log.fieldName)}
                            </span>
                          )}
                        </div>
                        {log.fieldName && log.action === "update" && (
                          <p className="text-sm text-muted-foreground mt-1">
                            من "{log.oldValue || "-"}" إلى "{log.newValue || "-"}"
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(log.createdAt).toLocaleString('en-GB')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
