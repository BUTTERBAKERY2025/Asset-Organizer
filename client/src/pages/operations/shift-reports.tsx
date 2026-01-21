import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { useReactToPrint } from "react-to-print";
import {
  ChevronLeft,
  FileText,
  Printer,
  Calendar,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  Camera,
  User,
  Filter,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface Branch {
  id: string;
  name: string;
}

interface BranchShift {
  id: number;
  branchId: string;
  shiftType: string;
  shiftDate: string;
  status: string;
  supervisorName?: string;
  openingTime?: string;
  closingTime?: string;
  openingCompleted: boolean;
  closingCompleted: boolean;
  openingCompletedAt?: string;
  closingCompletedAt?: string;
  createdAt: string;
}

interface ChecklistItem {
  id: number;
  title: string;
  titleEn?: string;
  templateId: number;
  requiresPhoto: boolean;
  requiresNote: boolean;
  displayOrder: number;
}

interface ChecklistTemplate {
  id: number;
  name: string;
  type: string;
  items: ChecklistItem[];
}

interface ChecklistResponse {
  id: number;
  shiftId: number;
  itemId: number;
  checklistType: string;
  isCompleted: boolean;
  status: string;
  notes?: string;
  photoUrl?: string;
  completedAt?: string;
}

interface ShiftSignature {
  id: number;
  shiftId: number;
  signatureType: string;
  signerName: string;
  signerRole: string;
  signatureData: string;
  signedAt: string;
}

const shiftTypes = [
  { value: "morning", label: "صباحي" },
  { value: "evening", label: "مسائي" },
  { value: "night", label: "ليلي" },
];


export default function ShiftReportsPage() {
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedShiftType, setSelectedShiftType] = useState<string>("all");
  const [selectedShift, setSelectedShift] = useState<BranchShift | null>(null);
  const [reportType, setReportType] = useState<"opening" | "closing">("opening");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: shifts = [], isLoading: shiftsLoading, isError: shiftsError } = useQuery<BranchShift[]>({
    queryKey: ["/api/branch-shifts/all", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/branch-shifts/dashboard/today?date=${selectedDate}`);
      if (!res.ok) throw new Error("Failed to fetch shifts");
      const data = await res.json();
      return data.shifts || [];
    },
  });

  const { data: checklistTemplates = [], isLoading: itemsLoading } = useQuery<ChecklistTemplate[]>({
    queryKey: ["/api/branch-shifts/all-items"],
  });

  const { data: shiftResponses = [], isLoading: responsesLoading } = useQuery<ChecklistResponse[]>({
    queryKey: ["/api/branch-shifts/responses", selectedShift?.id],
    queryFn: async () => {
      if (!selectedShift) return [];
      const res = await fetch(`/api/branch-shifts/${selectedShift.id}/responses`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedShift,
  });

  const { data: shiftSignatures = [] } = useQuery<ShiftSignature[]>({
    queryKey: ["/api/branch-shifts/signatures", selectedShift?.id],
    queryFn: async () => {
      if (!selectedShift) return [];
      const res = await fetch(`/api/branch-shifts/${selectedShift.id}/signatures`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedShift,
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `تقرير_${reportType === "opening" ? "الفتح" : "الإغلاق"}_${selectedShift?.branchId}_${selectedShift?.shiftDate}`,
  });

  const filteredShifts = shifts.filter((shift) => {
    if (selectedBranch !== "all" && shift.branchId !== selectedBranch) return false;
    if (selectedShiftType !== "all" && shift.shiftType !== selectedShiftType) return false;
    return true;
  });

  const getBranchName = (branchId: string) => {
    const branch = branches.find((b) => b.id === branchId);
    return branch?.name || branchId;
  };

  const getShiftTypeName = (type: string) => {
    return shiftTypes.find((t) => t.value === type)?.label || type;
  };

  const openReport = (shift: BranchShift, type: "opening" | "closing") => {
    setSelectedShift(shift);
    setReportType(type);
  };

  const filteredTemplates = checklistTemplates.filter((t) => t.type === reportType);
  
  const allItems = filteredTemplates.flatMap((t) => t.items);

  const getResponseForItem = (itemId: number) => {
    return shiftResponses.find((r) => r.itemId === itemId && r.checklistType === reportType);
  };

  const completedCount = allItems.filter((item) => {
    const response = getResponseForItem(item.id);
    return response?.isCompleted;
  }).length;

  const completionPercentage = allItems.length > 0 ? Math.round((completedCount / allItems.length) * 100) : 0;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        <Card className="bg-gradient-to-l from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/branch-shifts">
                  <Button variant="outline" size="icon" className="bg-white hover:bg-amber-100" data-testid="btn-back">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                </Link>
                <div className="p-3 bg-amber-600 rounded-xl">
                  <FileText className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-amber-900">تقارير الفتح والإغلاق</h1>
                  <p className="text-amber-700">عرض وطباعة تقارير شفتات الفروع</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-white text-amber-800 border-amber-300 px-4 py-2">
                {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-amber-100">
          <CardHeader className="pb-4 bg-gradient-to-l from-gray-50 to-white">
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Filter className="h-5 w-5" />
              فلترة التقارير
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">التاريخ</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border-2 focus:border-amber-400"
                  data-testid="input-report-date"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">الفرع</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="border-2 focus:border-amber-400" data-testid="select-report-branch">
                    <SelectValue placeholder="جميع الفروع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الفروع</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">نوع الشفت</Label>
                <Select value={selectedShiftType} onValueChange={setSelectedShiftType}>
                  <SelectTrigger className="border-2 focus:border-amber-400" data-testid="select-report-shift-type">
                    <SelectValue placeholder="جميع الشفتات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الشفتات</SelectItem>
                    {shiftTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 bg-gradient-to-l from-gray-50 to-white border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <Building2 className="h-5 w-5 text-amber-600" />
                الشفتات المسجلة
              </CardTitle>
              <Badge variant="secondary" className="px-3">
                {filteredShifts.length} شفت
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {shiftsLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-amber-600" />
                  <p className="text-muted-foreground">جاري تحميل الشفتات...</p>
                </div>
              ) : shiftsError ? (
                <div className="py-12 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                  <p className="text-red-500">حدث خطأ في تحميل الشفتات</p>
                </div>
              ) : filteredShifts.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">لا توجد شفتات في التاريخ المحدد</p>
                  <p className="text-sm mt-2">جرب تغيير التاريخ أو الفلاتر الأخرى</p>
                </div>
              ) : (
                filteredShifts.map((shift) => (
                  <div 
                    key={shift.id} 
                    className="p-4 rounded-xl border-2 hover:border-amber-300 transition-all bg-gradient-to-l from-gray-50 to-white"
                    data-testid={`card-shift-${shift.id}`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${
                          shift.openingCompleted && shift.closingCompleted 
                            ? "bg-green-100" 
                            : shift.openingCompleted 
                              ? "bg-amber-100" 
                              : "bg-gray-100"
                        }`}>
                          <Building2 className={`h-6 w-6 ${
                            shift.openingCompleted && shift.closingCompleted 
                              ? "text-green-600" 
                              : shift.openingCompleted 
                                ? "text-amber-600" 
                                : "text-gray-400"
                          }`} />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-gray-800">{getBranchName(shift.branchId)}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                              <Calendar className="h-3 w-3" />
                              {shift.shiftDate}
                            </span>
                            <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                              <Clock className="h-3 w-3" />
                              {getShiftTypeName(shift.shiftType)}
                            </span>
                            {shift.supervisorName && (
                              <span className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded text-blue-700">
                                <User className="h-3 w-3" />
                                {shift.supervisorName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex gap-2">
                          <Badge 
                            variant={shift.openingCompleted ? "default" : "outline"} 
                            className={shift.openingCompleted ? "bg-green-600" : ""}
                          >
                            {shift.openingCompleted ? (
                              <CheckCircle2 className="h-3 w-3 ml-1" />
                            ) : (
                              <XCircle className="h-3 w-3 ml-1" />
                            )}
                            الفتح
                          </Badge>
                          <Badge 
                            variant={shift.closingCompleted ? "default" : "outline"}
                            className={shift.closingCompleted ? "bg-green-600" : ""}
                          >
                            {shift.closingCompleted ? (
                              <CheckCircle2 className="h-3 w-3 ml-1" />
                            ) : (
                              <XCircle className="h-3 w-3 ml-1" />
                            )}
                            الإغلاق
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant={shift.openingCompleted ? "default" : "outline"}
                            size="sm"
                            onClick={() => openReport(shift, "opening")}
                            disabled={!shift.openingCompleted}
                            className={shift.openingCompleted ? "bg-amber-600 hover:bg-amber-700" : ""}
                            data-testid={`btn-view-opening-${shift.id}`}
                          >
                            <FileText className="h-4 w-4 ml-1" />
                            تقرير الفتح
                          </Button>
                          <Button
                            variant={shift.closingCompleted ? "default" : "outline"}
                            size="sm"
                            onClick={() => openReport(shift, "closing")}
                            disabled={!shift.closingCompleted}
                            className={shift.closingCompleted ? "bg-blue-600 hover:bg-blue-700" : ""}
                            data-testid={`btn-view-closing-${shift.id}`}
                          >
                            <FileText className="h-4 w-4 ml-1" />
                            تقرير الإغلاق
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!selectedShift} onOpenChange={() => setSelectedShift(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>
                  تقرير {reportType === "opening" ? "الفتح" : "الإغلاق"} - {getBranchName(selectedShift?.branchId || "")}
                </span>
                <Button onClick={() => handlePrint()} className="gap-2" data-testid="btn-print-report">
                  <Printer className="h-4 w-4" />
                  طباعة
                </Button>
              </DialogTitle>
            </DialogHeader>

            <div ref={printRef} className="p-4 print:p-8" dir="rtl">
              <div className="text-center mb-6 print:mb-8">
                <h1 className="text-2xl font-bold mb-2">شركة الزبد الأفضل التجارية</h1>
                <h2 className="text-xl font-semibold text-amber-600">مخبز باتر</h2>
                <h3 className="text-lg mt-4">
                  تقرير {reportType === "opening" ? "فتح" : "إغلاق"} الفرع
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg print:bg-white print:border">
                <div>
                  <span className="text-muted-foreground">الفرع:</span>
                  <span className="font-semibold mr-2">{getBranchName(selectedShift?.branchId || "")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">التاريخ:</span>
                  <span className="font-semibold mr-2">{selectedShift?.shiftDate}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">نوع الشفت:</span>
                  <span className="font-semibold mr-2">{getShiftTypeName(selectedShift?.shiftType || "")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">المشرف:</span>
                  <span className="font-semibold mr-2">{selectedShift?.supervisorName || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">وقت الإكمال:</span>
                  <span className="font-semibold mr-2">
                    {reportType === "opening"
                      ? selectedShift?.openingCompletedAt
                        ? new Date(selectedShift.openingCompletedAt).toLocaleString("ar-SA")
                        : "-"
                      : selectedShift?.closingCompletedAt
                        ? new Date(selectedShift.closingCompletedAt).toLocaleString("ar-SA")
                        : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">نسبة الإكمال:</span>
                  <span className="font-semibold mr-2">{completionPercentage}%</span>
                </div>
              </div>

              <Separator className="my-6" />

              {responsesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
                  <span className="mr-2">جاري تحميل البيانات...</span>
                </div>
              ) : filteredTemplates.map((template) => (
                <div key={template.id} className="mb-6">
                  <h4 className="font-semibold text-lg mb-3 text-amber-700">{template.name}</h4>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100 print:bg-gray-200">
                        <th className="border p-2 text-right w-8">#</th>
                        <th className="border p-2 text-right">البند</th>
                        <th className="border p-2 text-center w-20">الحالة</th>
                        <th className="border p-2 text-center w-20">صورة</th>
                        <th className="border p-2 text-right">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {template.items.map((item, idx) => {
                        const response = getResponseForItem(item.id);
                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="border p-2 text-center">{idx + 1}</td>
                            <td className="border p-2">{item.title}</td>
                            <td className="border p-2 text-center">
                              {response?.isCompleted ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                              )}
                            </td>
                            <td className="border p-2 text-center">
                              {response?.photoUrl ? (
                                <img
                                  src={response.photoUrl}
                                  alt="صورة البند"
                                  className="h-16 w-16 object-cover rounded mx-auto cursor-pointer hover:opacity-80 hover:ring-2 hover:ring-amber-400 transition-all"
                                  onClick={() => setPreviewImage(response.photoUrl || null)}
                                />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="border p-2 text-sm">{response?.notes || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}

              {shiftSignatures.length > 0 && (
                <>
                  <Separator className="my-6" />
                  <h4 className="font-semibold text-lg mb-4">التوقيعات</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {shiftSignatures
                      .filter((sig) => sig.signatureType === reportType)
                      .map((sig) => (
                        <div key={sig.id} className="border rounded-lg p-4">
                          <div className="text-sm text-muted-foreground mb-2">
                            {sig.signerRole} - {sig.signerName}
                          </div>
                          <img
                            src={sig.signatureData}
                            alt="توقيع"
                            className="max-h-20 mx-auto"
                          />
                          <div className="text-xs text-center text-muted-foreground mt-2">
                            {new Date(sig.signedAt).toLocaleString("ar-SA")}
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}

              <div className="mt-8 pt-4 border-t text-center text-sm text-muted-foreground print:mt-12">
                <p>تم إنشاء هذا التقرير بواسطة نظام إدارة مخبز باتر</p>
                <p>{new Date().toLocaleString("ar-SA")}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-2">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-amber-600" />
                  معاينة الصورة
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-4 bg-gray-100 rounded-lg">
              {previewImage && (
                <img
                  src={previewImage}
                  alt="معاينة الصورة"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
