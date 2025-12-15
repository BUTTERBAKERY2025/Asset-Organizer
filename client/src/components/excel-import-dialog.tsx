import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import type { Branch } from "@shared/schema";

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportRow {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  price?: number;
  status?: string;
  serialNumber?: string;
  notes?: string;
  isValid: boolean;
  errors: string[];
}

const TEMPLATE_COLUMNS = [
  { key: "name", label: "اسم الصنف", required: true },
  { key: "quantity", label: "الكمية", required: true },
  { key: "unit", label: "الوحدة", required: true },
  { key: "category", label: "التصنيف", required: true },
  { key: "price", label: "السعر", required: false },
  { key: "status", label: "الحالة", required: false },
  { key: "serialNumber", label: "الرقم التسلسلي", required: false },
  { key: "notes", label: "ملاحظات", required: false },
];

const VALID_STATUSES = ["good", "maintenance", "damaged", "missing"];
const VALID_CATEGORIES = [
  "معدات المخبز",
  "أدوات العرض",
  "معدات التبريد",
  "أثاث",
  "إلكترونيات",
  "مستلزمات التغليف",
  "أدوات التنظيف",
  "أخرى"
];

export function ExcelImportDialog({ open, onOpenChange }: ExcelImportDialogProps) {
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const importMutation = useMutation({
    mutationFn: async (data: { branchId: string; items: ImportRow[] }) => {
      const response = await fetch("/api/inventory/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "فشل في استيراد البيانات");
      }
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "تم الاستيراد بنجاح",
        description: `تم إضافة ${result.imported} صنف جديد`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ في الاستيراد",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setImportData([]);
    setSelectedBranch("");
    setFileName("");
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const templateData = [
      TEMPLATE_COLUMNS.reduce((acc, col) => {
        acc[col.label] = col.required ? `(مطلوب) مثال: ${getExampleValue(col.key)}` : `مثال: ${getExampleValue(col.key)}`;
        return acc;
      }, {} as Record<string, string>),
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "نموذج الاستيراد");
    
    const colWidths = TEMPLATE_COLUMNS.map(() => ({ wch: 20 }));
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, "نموذج_استيراد_الأصناف.xlsx");
    
    toast({
      title: "تم تحميل النموذج",
      description: "قم بتعبئة البيانات وإعادة رفع الملف",
    });
  };

  const getExampleValue = (key: string): string => {
    switch (key) {
      case "name": return "فرن كهربائي";
      case "quantity": return "2";
      case "unit": return "قطعة";
      case "category": return "معدات المخبز";
      case "price": return "5000";
      case "status": return "good";
      case "serialNumber": return "SN-12345";
      case "notes": return "ملاحظة اختيارية";
      default: return "";
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const processedData: ImportRow[] = jsonData.map((row: any) => {
          const errors: string[] = [];
          
          const name = row["اسم الصنف"] || row["name"] || "";
          const quantityRaw = row["الكمية"] || row["quantity"];
          const unit = row["الوحدة"] || row["unit"] || "";
          const category = row["التصنيف"] || row["category"] || "";
          const priceRaw = row["السعر"] || row["price"];
          const status = row["الحالة"] || row["status"] || "good";
          const serialNumber = row["الرقم التسلسلي"] || row["serialNumber"] || "";
          const notes = row["ملاحظات"] || row["notes"] || "";

          if (!name || name.includes("مطلوب")) errors.push("اسم الصنف مطلوب");
          
          const quantity = parseInt(quantityRaw);
          if (isNaN(quantity) || quantity < 0) errors.push("الكمية غير صحيحة");
          
          if (!unit || unit.includes("مطلوب")) errors.push("الوحدة مطلوبة");
          if (!category || category.includes("مطلوب")) errors.push("التصنيف مطلوب");
          
          const price = priceRaw ? parseFloat(priceRaw) : undefined;
          if (priceRaw && isNaN(price!)) errors.push("السعر غير صحيح");

          const normalizedStatus = status?.toLowerCase().trim();
          if (status && !VALID_STATUSES.includes(normalizedStatus) && normalizedStatus !== "") {
            errors.push("الحالة غير صحيحة (good, maintenance, damaged, missing)");
          }

          return {
            name: String(name).trim(),
            quantity: isNaN(quantity) ? 0 : quantity,
            unit: String(unit).trim(),
            category: String(category).trim(),
            price: price,
            status: VALID_STATUSES.includes(normalizedStatus) ? normalizedStatus : "good",
            serialNumber: String(serialNumber).trim(),
            notes: String(notes).trim(),
            isValid: errors.length === 0,
            errors,
          };
        });

        setImportData(processedData);
      } catch {
        toast({
          title: "خطأ في قراءة الملف",
          description: "تأكد من أن الملف بصيغة Excel صحيحة",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = () => {
    if (!selectedBranch) {
      toast({
        title: "اختر الفرع",
        description: "يجب اختيار الفرع قبل الاستيراد",
        variant: "destructive",
      });
      return;
    }

    const validItems = importData.filter(item => item.isValid);
    if (validItems.length === 0) {
      toast({
        title: "لا توجد بيانات صالحة",
        description: "تأكد من صحة البيانات في الملف",
        variant: "destructive",
      });
      return;
    }

    importMutation.mutate({ branchId: selectedBranch, items: validItems });
  };

  const validCount = importData.filter(item => item.isValid).length;
  const invalidCount = importData.filter(item => !item.isValid).length;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "good": return "جيد";
      case "maintenance": return "يحتاج صيانة";
      case "damaged": return "تالف";
      case "missing": return "مفقود";
      default: return status;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            استيراد البيانات من Excel
          </DialogTitle>
          <DialogDescription>
            قم بتحميل نموذج Excel وتعبئته بالبيانات، ثم ارفعه لاستيراد الأصناف
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label>الفرع</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الفرع" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 ml-2" />
              تحميل النموذج
            </Button>

            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 ml-2" />
              )}
              رفع ملف Excel
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {fileName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="w-4 h-4" />
              الملف: {fileName}
            </div>
          )}

          {importData.length > 0 && (
            <>
              <div className="flex gap-4">
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="w-3 h-3 ml-1" />
                  صالح: {validCount}
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="w-3 h-3 ml-1" />
                    خطأ: {invalidCount}
                  </Badge>
                )}
              </div>

              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>اسم الصنف</TableHead>
                      <TableHead>الكمية</TableHead>
                      <TableHead>الوحدة</TableHead>
                      <TableHead>التصنيف</TableHead>
                      <TableHead>السعر</TableHead>
                      <TableHead>حالة الصنف</TableHead>
                      <TableHead>الأخطاء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importData.map((row, index) => (
                      <TableRow key={index} className={!row.isValid ? "bg-red-50" : ""}>
                        <TableCell className="font-mono">{index + 1}</TableCell>
                        <TableCell>
                          {row.isValid ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </TableCell>
                        <TableCell>{row.name || "-"}</TableCell>
                        <TableCell className="font-mono">{row.quantity}</TableCell>
                        <TableCell>{row.unit || "-"}</TableCell>
                        <TableCell>{row.category || "-"}</TableCell>
                        <TableCell className="font-mono">
                          {row.price ? row.price.toLocaleString("en-US") : "-"}
                        </TableCell>
                        <TableCell>{getStatusLabel(row.status || "good")}</TableCell>
                        <TableCell>
                          {row.errors.length > 0 && (
                            <div className="flex items-center gap-1 text-red-500 text-xs">
                              <AlertTriangle className="w-3 h-3" />
                              {row.errors.join(", ")}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            إلغاء
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={validCount === 0 || !selectedBranch || importMutation.isPending}
          >
            {importMutation.isPending ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 ml-2" />
            )}
            استيراد {validCount} صنف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
