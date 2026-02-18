import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface InfluencerExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportRow {
  name: string;
  nameAr: string;
  email: string;
  phone: string;
  accountUrl: string;
  specialty: string;
  platforms: string;
  followerCount: number;
  engagementRate: number;
  pricePerPost: number;
  pricePerStory: number;
  pricePerVideo: number;
  city: string;
  region: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  notes: string;
  isValid: boolean;
  errors: string[];
}

const TEMPLATE_COLUMNS = [
  { key: "name", label: "الاسم (إنجليزي)", required: true },
  { key: "nameAr", label: "الاسم (عربي)", required: false },
  { key: "email", label: "البريد الإلكتروني", required: false },
  { key: "phone", label: "رقم الهاتف", required: false },
  { key: "accountUrl", label: "رابط الحساب", required: false },
  { key: "specialty", label: "التخصص", required: false },
  { key: "platforms", label: "المنصات (مفصولة بفاصلة)", required: false },
  { key: "followerCount", label: "عدد المتابعين", required: false },
  { key: "engagementRate", label: "معدل التفاعل %", required: false },
  { key: "pricePerPost", label: "سعر البوست", required: false },
  { key: "pricePerStory", label: "سعر الستوري", required: false },
  { key: "pricePerVideo", label: "سعر الفيديو", required: false },
  { key: "city", label: "المدينة", required: false },
  { key: "region", label: "المنطقة", required: false },
  { key: "bankName", label: "اسم البنك", required: false },
  { key: "bankAccountNumber", label: "رقم الحساب البنكي", required: false },
  { key: "bankAccountHolder", label: "اسم صاحب الحساب", required: false },
  { key: "notes", label: "ملاحظات", required: false },
];

const SPECIALTY_MAP: Record<string, string> = {
  'food': 'food',
  'طعام': 'food',
  'lifestyle': 'lifestyle',
  'لايف ستايل': 'lifestyle',
  'fashion': 'fashion',
  'موضة': 'fashion',
  'beauty': 'beauty',
  'جمال': 'beauty',
  'travel': 'travel',
  'سفر': 'travel',
  'tech': 'tech',
  'تقنية': 'tech',
  'fitness': 'fitness',
  'لياقة': 'fitness',
  'family': 'family',
  'عائلة': 'family',
  'entertainment': 'entertainment',
  'ترفيه': 'entertainment',
  'business': 'business',
  'أعمال': 'business',
};

const PLATFORM_MAP: Record<string, string> = {
  'instagram': 'instagram',
  'انستقرام': 'instagram',
  'tiktok': 'tiktok',
  'تيك توك': 'tiktok',
  'twitter': 'twitter',
  'تويتر': 'twitter',
  'x': 'twitter',
  'youtube': 'youtube',
  'يوتيوب': 'youtube',
  'snapchat': 'snapchat',
  'سناب شات': 'snapchat',
  'سناب': 'snapchat',
  'facebook': 'facebook',
  'فيسبوك': 'facebook',
};

export function InfluencerExcelImportDialog({ open, onOpenChange }: InfluencerExcelImportDialogProps) {
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (items: ImportRow[]) => {
      const response = await fetch("/api/marketing/influencers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
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
        description: `تم إضافة ${result.imported} مؤثر جديد`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/influencers"] });
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
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onOpenChange(false);
  };

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const headers = TEMPLATE_COLUMNS.map(col => col.label);
    const exampleRow = TEMPLATE_COLUMNS.map(col => getExampleValue(col.key));
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    
    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 5, 15) }));
    ws["!cols"] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, "المؤثرين");
    XLSX.writeFile(wb, "نموذج_استيراد_المؤثرين.xlsx");
  };

  const getExampleValue = (key: string): string => {
    switch (key) {
      case "name": return "Ahmed Blogger";
      case "nameAr": return "أحمد بلوجر";
      case "email": return "ahmed@email.com";
      case "phone": return "0501234567";
      case "accountUrl": return "https://instagram.com/ahmed";
      case "specialty": return "food";
      case "platforms": return "instagram, tiktok";
      case "followerCount": return "50000";
      case "engagementRate": return "3.5";
      case "pricePerPost": return "2000";
      case "pricePerStory": return "500";
      case "pricePerVideo": return "5000";
      case "city": return "الرياض";
      case "region": return "الرياض";
      case "bankName": return "الراجحي";
      case "bankAccountNumber": return "SA1234567890";
      case "bankAccountHolder": return "أحمد محمد";
      case "notes": return "مؤثر متميز في مجال الطعام";
      default: return "";
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import("xlsx");
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const processedData: ImportRow[] = jsonData.map((row: any) => {
          const errors: string[] = [];
          
          const name = row["الاسم (إنجليزي)"] || row["name"] || row["Name"] || row["الاسم"] || "";
          const nameAr = row["الاسم (عربي)"] || row["nameAr"] || row["الاسم العربي"] || "";
          const email = row["البريد الإلكتروني"] || row["email"] || row["Email"] || "";
          const phone = row["رقم الهاتف"] || row["phone"] || row["Phone"] || row["الجوال"] || "";
          const accountUrl = row["رابط الحساب"] || row["accountUrl"] || row["Account URL"] || row["الرابط"] || "";
          const specialtyRaw = row["التخصص"] || row["specialty"] || row["Specialty"] || "";
          const platformsRaw = row["المنصات (مفصولة بفاصلة)"] || row["المنصات"] || row["platforms"] || row["Platforms"] || "";
          const followerCountRaw = row["عدد المتابعين"] || row["followerCount"] || row["Followers"] || 0;
          const engagementRateRaw = row["معدل التفاعل %"] || row["engagementRate"] || row["Engagement"] || 0;
          const pricePerPostRaw = row["سعر البوست"] || row["pricePerPost"] || row["Post Price"] || 0;
          const pricePerStoryRaw = row["سعر الستوري"] || row["pricePerStory"] || row["Story Price"] || 0;
          const pricePerVideoRaw = row["سعر الفيديو"] || row["pricePerVideo"] || row["Video Price"] || 0;
          const city = row["المدينة"] || row["city"] || row["City"] || "";
          const region = row["المنطقة"] || row["region"] || row["Region"] || "";
          const bankName = row["اسم البنك"] || row["bankName"] || row["Bank"] || "";
          const bankAccountNumber = row["رقم الحساب البنكي"] || row["bankAccountNumber"] || row["Account Number"] || "";
          const bankAccountHolder = row["اسم صاحب الحساب"] || row["bankAccountHolder"] || row["Account Holder"] || "";
          const notes = row["ملاحظات"] || row["notes"] || row["Notes"] || "";

          if (!name) errors.push("الاسم مطلوب");

          const specialty = SPECIALTY_MAP[String(specialtyRaw).toLowerCase().trim()] || String(specialtyRaw).trim();
          
          const platformsArray = String(platformsRaw).split(/[,،]/).map(p => {
            const trimmed = p.trim().toLowerCase();
            return PLATFORM_MAP[trimmed] || trimmed;
          }).filter(p => p);
          const platforms = platformsArray.join(",");

          const followerCount = parseInt(String(followerCountRaw).replace(/[,،\s]/g, '')) || 0;
          const engagementRate = parseFloat(String(engagementRateRaw).replace('%', '')) || 0;
          const pricePerPost = parseFloat(String(pricePerPostRaw).replace(/[,،\s]/g, '')) || 0;
          const pricePerStory = parseFloat(String(pricePerStoryRaw).replace(/[,،\s]/g, '')) || 0;
          const pricePerVideo = parseFloat(String(pricePerVideoRaw).replace(/[,،\s]/g, '')) || 0;

          return {
            name: String(name).trim(),
            nameAr: String(nameAr).trim(),
            email: String(email).trim(),
            phone: String(phone).trim(),
            accountUrl: String(accountUrl).trim(),
            specialty,
            platforms,
            followerCount,
            engagementRate,
            pricePerPost,
            pricePerStory,
            pricePerVideo,
            city: String(city).trim(),
            region: String(region).trim(),
            bankName: String(bankName).trim(),
            bankAccountNumber: String(bankAccountNumber).trim(),
            bankAccountHolder: String(bankAccountHolder).trim(),
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
    const validItems = importData.filter(item => item.isValid);
    if (validItems.length === 0) {
      toast({
        title: "لا توجد بيانات صالحة",
        description: "تأكد من صحة البيانات في الملف",
        variant: "destructive",
      });
      return;
    }

    importMutation.mutate(validItems);
  };

  const validCount = importData.filter(item => item.isValid).length;
  const invalidCount = importData.filter(item => !item.isValid).length;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-4xl max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            استيراد المؤثرين من Excel
          </DialogTitle>
          <DialogDescription>
            قم بتحميل نموذج Excel وتعبئته بالبيانات، ثم ارفعه لاستيراد المؤثرين
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-4 items-end">
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
            
            {fileName && (
              <span className="text-sm text-muted-foreground">{fileName}</span>
            )}
          </div>

          {importData.length > 0 && (
            <>
              <div className="flex gap-4 items-center">
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="w-3 h-3" />
                  صالح: {validCount}
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="w-3 h-3" />
                    غير صالح: {invalidCount}
                  </Badge>
                )}
              </div>

              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>الاسم</TableHead>
                      <TableHead>البريد</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>المتابعين</TableHead>
                      <TableHead>المنصات</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importData.map((row, index) => (
                      <TableRow key={index} className={!row.isValid ? "bg-red-50" : ""}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{row.name || row.nameAr}</TableCell>
                        <TableCell>{row.email || "-"}</TableCell>
                        <TableCell>{row.phone || "-"}</TableCell>
                        <TableCell>{row.followerCount.toLocaleString()}</TableCell>
                        <TableCell>{row.platforms || "-"}</TableCell>
                        <TableCell>
                          {row.isValid ? (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle className="w-3 h-3 ml-1" />
                              صالح
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="w-3 h-3 ml-1" />
                              {row.errors.join(", ")}
                            </Badge>
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
            disabled={validCount === 0 || importMutation.isPending}
          >
            {importMutation.isPending ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 ml-2" />
            )}
            استيراد {validCount} مؤثر
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
