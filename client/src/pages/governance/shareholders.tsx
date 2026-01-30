import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  BarChart3,
  Plus,
  ChevronLeft,
  Search,
  Edit,
  User,
  Building2,
  Landmark,
  TrendingUp,
  Percent,
  Eye,
  Vote,
  DollarSign,
  ArrowRightLeft,
  Crown,
  PieChart as PieChartIcon,
  Download,
  Filter,
  History,
  Wallet,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Upload,
  File,
  X,
  Printer,
  CreditCard,
  FileCheck,
  Building,
  Receipt,
  FolderOpen,
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Shareholder, ShareholderDocument } from "@shared/schema";
import { exportToExcel, exportToCSV, printAsPDF, type PrintOptions } from "@/lib/export-utils";

const documentTypes = [
  { value: "national_id", label: "الهوية الوطنية", icon: CreditCard },
  { value: "share_certificate", label: "شهادة الأسهم", icon: FileCheck },
  { value: "commercial_register", label: "السجل التجاري", icon: Building },
  { value: "contract", label: "عقد المساهمة", icon: FileText },
  { value: "bank_statement", label: "كشف حساب بنكي", icon: Receipt },
  { value: "other", label: "أخرى", icon: FolderOpen },
];

const shareholderTypes = [
  { value: "individual", label: "فرد", icon: User, color: "#22c55e" },
  { value: "company", label: "شركة", icon: Building2, color: "#3b82f6" },
  { value: "government", label: "جهة حكومية", icon: Landmark, color: "#8b5cf6" },
  { value: "institution", label: "مؤسسة", icon: TrendingUp, color: "#f59e0b" },
];

const shareClasses = [
  { value: "common", label: "عادية" },
  { value: "preferred", label: "ممتازة" },
  { value: "founders", label: "مؤسسين" },
];

const shareholderCategories = [
  { value: "major", label: "كبار المساهمين", threshold: 5, color: "bg-amber-100 text-amber-800" },
  { value: "strategic", label: "استراتيجيين", threshold: 10, color: "bg-purple-100 text-purple-800" },
  { value: "institutional", label: "مؤسسيين", threshold: 1, color: "bg-blue-100 text-blue-800" },
  { value: "individual", label: "أفراد", threshold: 0, color: "bg-green-100 text-green-800" },
];

export default function ShareholdersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingShareholder, setEditingShareholder] = useState<Shareholder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("list");
  const [selectedShareholder, setSelectedShareholder] = useState<Shareholder | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shareholderToDelete, setShareholderToDelete] = useState<Shareholder | null>(null);
  const [detailsTab, setDetailsTab] = useState("info");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shareholders = [], isLoading } = useQuery<Shareholder[]>({
    queryKey: ["/api/governance/shareholders"],
  });

  const { data: shareholderDocs = [] } = useQuery<ShareholderDocument[]>({
    queryKey: ["/api/governance/shareholders", selectedShareholder?.id, "documents"],
    queryFn: async () => {
      if (!selectedShareholder?.id) return [];
      const res = await fetch(`/api/governance/shareholders/${selectedShareholder.id}/documents`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedShareholder?.id && showDetails,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Shareholder>) => {
      const res = await fetch("/api/governance/shareholders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create shareholder");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/shareholders"] });
      setIsDialogOpen(false);
      toast({ title: "تم إضافة المساهم بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إضافة المساهم", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Shareholder> }) => {
      const res = await fetch(`/api/governance/shareholders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update shareholder");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/shareholders"] });
      setIsDialogOpen(false);
      setEditingShareholder(null);
      toast({ title: "تم تحديث بيانات المساهم بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في تحديث بيانات المساهم", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/governance/shareholders/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete shareholder");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/shareholders"] });
      setDeleteDialogOpen(false);
      setShareholderToDelete(null);
      toast({ title: "تم حذف المساهم بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في حذف المساهم", variant: "destructive" });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async ({ shareholderId, docId }: { shareholderId: number; docId: number }) => {
      const res = await fetch(`/api/governance/shareholders/${shareholderId}/documents/${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/shareholders", selectedShareholder?.id, "documents"] });
      toast({ title: "تم حذف الوثيقة بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في حذف الوثيقة", variant: "destructive" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file || !selectedShareholder) return;
    
    setUploadingDoc(true);
    try {
      // Step 1: Get presigned upload URL
      const presignedRes = await fetch('/api/uploads/request-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });
      
      if (!presignedRes.ok) throw new Error('Failed to get upload URL');
      const { uploadURL, objectPath } = await presignedRes.json();
      
      // Step 2: Upload file directly to presigned URL
      const uploadRes = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });
      
      if (!uploadRes.ok) throw new Error('Upload failed');
      
      // Step 3: Save document metadata with protected path
      const fileUrl = `/api/protected-files${objectPath}`;
      
      const docRes = await fetch(`/api/governance/shareholders/${selectedShareholder.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: docType,
          documentName: documentTypes.find(d => d.value === docType)?.label || docType,
          originalFileName: file.name,
          fileUrl: fileUrl,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });
      
      if (!docRes.ok) throw new Error('Failed to save document');
      
      queryClient.invalidateQueries({ queryKey: ["/api/governance/shareholders", selectedShareholder.id, "documents"] });
      toast({ title: "تم رفع الوثيقة بنجاح" });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: "فشل في رفع الوثيقة", variant: "destructive" });
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  const exportShareholderPDF = (shareholder: Shareholder) => {
    const data = [{
      ...shareholder,
      shareholderTypeName: shareholderTypes.find(t => t.value === shareholder.shareholderType)?.label,
      shareClassName: shareClasses.find(c => c.value === shareholder.shareClass)?.label,
      formattedShares: (shareholder.numberOfShares || 0).toLocaleString(),
      formattedPercentage: `${Number(shareholder.sharePercentage || 0).toFixed(2)}%`,
      votingStatus: shareholder.votingRights ? 'نعم' : 'لا',
    }];
    
    const columns = [
      { key: "fullName", header: "الاسم الكامل", width: 25 },
      { key: "nationalId", header: "رقم الهوية/السجل", width: 20 },
      { key: "shareholderTypeName", header: "نوع المساهم", width: 15 },
      { key: "nationality", header: "الجنسية", width: 12 },
      { key: "email", header: "البريد الإلكتروني", width: 25 },
      { key: "phone", header: "رقم الهاتف", width: 15 },
    ];
    
    const headerInfo = [
      { label: "عدد الأسهم", value: (shareholder.numberOfShares || 0).toLocaleString() },
      { label: "نسبة الملكية", value: `${Number(shareholder.sharePercentage || 0).toFixed(2)}%` },
      { label: "فئة الأسهم", value: shareClasses.find(c => c.value === shareholder.shareClass)?.label || '-' },
      { label: "تاريخ الاستحواذ", value: shareholder.acquisitionDate || '-' },
      { label: "حق التصويت", value: shareholder.votingRights ? 'نعم' : 'لا' },
      { label: "البنك", value: shareholder.bankName || '-' },
      { label: "رقم الآيبان", value: shareholder.iban || '-' },
      { label: "العنوان", value: shareholder.address || '-' },
    ];
    
    printAsPDF(
      data,
      columns,
      `ملف المساهم: ${shareholder.fullName}`,
      "بيانات تفصيلية للمساهم",
      headerInfo,
      { landscape: true, companyName: "شركة الزبد الأفضل التجارية", showLogo: true }
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const acquisitionDateStr = formData.get("acquisitionDate") as string;
    const data = {
      shareholderType: formData.get("shareholderType") as string,
      fullName: formData.get("fullName") as string,
      nationalId: formData.get("nationalId") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      address: formData.get("address") as string,
      nationality: formData.get("nationality") as string,
      numberOfShares: parseInt(formData.get("numberOfShares") as string),
      sharePercentage: formData.get("sharePercentage") as string,
      shareClass: formData.get("shareClass") as string,
      acquisitionDate: acquisitionDateStr || undefined,
      bankName: formData.get("bankName") as string,
      iban: formData.get("iban") as string,
    };

    if (editingShareholder) {
      updateMutation.mutate({ id: editingShareholder.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredShareholders = shareholders.filter((s) => {
    const matchesSearch = s.fullName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || s.shareholderType === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalShares = shareholders.reduce((sum, s) => sum + (s.numberOfShares || 0), 0);
  const totalPercentage = shareholders.reduce((sum, s) => sum + Number(s.sharePercentage || 0), 0);
  const majorShareholders = shareholders.filter(s => Number(s.sharePercentage) >= 5);
  const votingShares = shareholders.filter(s => s.votingRights).reduce((sum, s) => sum + (s.numberOfShares || 0), 0);
  const isPercentageValid = Math.abs(totalPercentage - 100) < 0.01;

  const getTypeIcon = (type: string) => {
    const typeInfo = shareholderTypes.find(t => t.value === type);
    if (typeInfo) {
      const Icon = typeInfo.icon;
      return <Icon className="h-4 w-4" />;
    }
    return <User className="h-4 w-4" />;
  };

  const getCategory = (percentage: number, type: string): string => {
    if (type === "institution" || type === "government") return "institutional";
    if (percentage >= 10) return "strategic";
    if (percentage >= 5) return "major";
    return "individual";
  };

  const getCategoryBadge = (percentage: number, type: string) => {
    const cat = getCategory(percentage, type);
    const category = shareholderCategories.find(c => c.value === cat);
    return category ? (
      <Badge className={category.color}>{category.label}</Badge>
    ) : null;
  };

  const ownershipByTypeData = shareholderTypes.map(type => ({
    name: type.label,
    value: shareholders
      .filter(s => s.shareholderType === type.value)
      .reduce((sum, s) => sum + Number(s.sharePercentage || 0), 0),
    color: type.color,
  })).filter(d => d.value > 0);

  const top10Shareholders = [...shareholders]
    .sort((a, b) => Number(b.sharePercentage) - Number(a.sharePercentage))
    .slice(0, 10);

  const concentrationData = [
    { name: "أكبر 5 مساهمين", value: shareholders.sort((a, b) => Number(b.sharePercentage) - Number(a.sharePercentage)).slice(0, 5).reduce((sum, s) => sum + Number(s.sharePercentage), 0) },
    { name: "باقي المساهمين", value: 100 - shareholders.sort((a, b) => Number(b.sharePercentage) - Number(a.sharePercentage)).slice(0, 5).reduce((sum, s) => sum + Number(s.sharePercentage), 0) },
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 lg:p-10 space-y-3 sm:space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/governance">
              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8">
                <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </Link>
            <div className="p-2 sm:p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg sm:rounded-xl">
              <BarChart3 className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-amber-800" data-testid="page-title">
                بيانات المساهمين
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">إدارة الملكية والتصويت والأرباح</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                  <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">تصدير</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  const exportColumns = [
                    { key: "shareholderNumber", header: "رقم المساهم", width: 15 },
                    { key: "fullName", header: "الاسم", width: 30 },
                    { key: "shareholderType", header: "النوع", width: 12 },
                    { key: "totalShares", header: "عدد الأسهم", width: 15 },
                    { key: "sharePercentage", header: "النسبة %", width: 10 },
                    { key: "votingPower", header: "قوة التصويت", width: 12 },
                    { key: "status", header: "الحالة", width: 10 },
                  ];
                  exportToExcel(filteredShareholders, exportColumns, "بيانات_المساهمين", "المساهمين");
                }}>
                  Excel تصدير
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const exportColumns = [
                    { key: "shareholderNumber", header: "رقم المساهم", width: 15 },
                    { key: "fullName", header: "الاسم", width: 30 },
                    { key: "shareholderType", header: "النوع", width: 12 },
                    { key: "totalShares", header: "عدد الأسهم", width: 15 },
                    { key: "sharePercentage", header: "النسبة %", width: 10 },
                    { key: "votingPower", header: "قوة التصويت", width: 12 },
                    { key: "status", header: "الحالة", width: 10 },
                  ];
                  exportToCSV(filteredShareholders, exportColumns, "بيانات_المساهمين");
                }}>
                  CSV تصدير
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const exportData = filteredShareholders.map((s, idx) => ({
                    ...s,
                    rowNumber: idx + 1,
                    shareholderTypeName: shareholderTypes.find(t => t.value === s.shareholderType)?.label || s.shareholderType,
                    shareClassName: shareClasses.find(c => c.value === s.shareClass)?.label || s.shareClass,
                    formattedShares: (s.numberOfShares || 0).toLocaleString(),
                    formattedPercentage: `${Number(s.sharePercentage || 0).toFixed(2)}%`,
                    votingStatus: s.votingRights ? 'نعم' : 'لا',
                    formattedDate: s.acquisitionDate || '-',
                  }));
                  const exportColumns = [
                    { key: "rowNumber", header: "م", width: 5 },
                    { key: "fullName", header: "اسم المساهم", width: 25 },
                    { key: "nationalId", header: "رقم الهوية/السجل", width: 18 },
                    { key: "shareholderTypeName", header: "نوع المساهم", width: 12 },
                    { key: "shareClassName", header: "فئة الأسهم", width: 12 },
                    { key: "formattedShares", header: "عدد الأسهم", width: 15 },
                    { key: "formattedPercentage", header: "نسبة الملكية", width: 12 },
                    { key: "votingStatus", header: "حق التصويت", width: 10 },
                    { key: "formattedDate", header: "تاريخ الاستحواذ", width: 14 },
                    { key: "nationality", header: "الجنسية", width: 10 },
                  ];
                  const headerInfo = [
                    { label: "إجمالي المساهمين", value: shareholders.length.toString() },
                    { label: "إجمالي الأسهم", value: totalShares.toLocaleString() },
                    { label: "إجمالي نسب الملكية", value: `${totalPercentage.toFixed(2)}%` },
                    { label: "حالة التوازن", value: isPercentageValid ? "متوازن ✓" : `غير متوازن (${totalPercentage > 100 ? 'زيادة' : 'نقص'})` },
                  ];
                  printAsPDF(
                    exportData, 
                    exportColumns, 
                    "سجل المساهمين وهيكل الملكية", 
                    `تقرير رسمي صادر بتاريخ ${new Date().toLocaleDateString("ar-SA")}`,
                    headerInfo,
                    { landscape: true, companyName: "شركة الزبد الأفضل التجارية", showLogo: true }
                  );
                }}>
                  طباعة PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setEditingShareholder(null);
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1 sm:gap-2 text-xs sm:text-sm bg-amber-600 hover:bg-amber-700" data-testid="btn-add-shareholder">
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline">إضافة</span> مساهم
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingShareholder ? "تعديل بيانات المساهم" : "إضافة مساهم جديد"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shareholderType">نوع المساهم *</Label>
                      <Select name="shareholderType" defaultValue={editingShareholder?.shareholderType || "individual"}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {shareholderTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">الاسم الكامل *</Label>
                      <Input id="fullName" name="fullName" defaultValue={editingShareholder?.fullName || ""} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nationalId">رقم الهوية / السجل التجاري</Label>
                      <Input id="nationalId" name="nationalId" defaultValue={editingShareholder?.nationalId || ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nationality">الجنسية</Label>
                      <Input id="nationality" name="nationality" defaultValue={editingShareholder?.nationality || "سعودي"} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">البريد الإلكتروني</Label>
                      <Input id="email" name="email" type="email" defaultValue={editingShareholder?.email || ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">رقم الهاتف</Label>
                      <Input id="phone" name="phone" defaultValue={editingShareholder?.phone || ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="numberOfShares">عدد الأسهم *</Label>
                      <Input id="numberOfShares" name="numberOfShares" type="number" defaultValue={editingShareholder?.numberOfShares || ""} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sharePercentage">نسبة الملكية (%) *</Label>
                      <Input id="sharePercentage" name="sharePercentage" type="number" step="0.0001" defaultValue={editingShareholder?.sharePercentage || ""} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shareClass">فئة الأسهم</Label>
                      <Select name="shareClass" defaultValue={editingShareholder?.shareClass || "common"}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {shareClasses.map((cls) => (
                            <SelectItem key={cls.value} value={cls.value}>{cls.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="acquisitionDate">تاريخ الاستحواذ *</Label>
                      <Input id="acquisitionDate" name="acquisitionDate" type="date" defaultValue={editingShareholder?.acquisitionDate || ""} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bankName">اسم البنك</Label>
                      <Input id="bankName" name="bankName" defaultValue={editingShareholder?.bankName || ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="iban">رقم الآيبان</Label>
                      <Input id="iban" name="iban" defaultValue={editingShareholder?.iban || ""} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">العنوان</Label>
                    <Input id="address" name="address" defaultValue={editingShareholder?.address || ""} />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                    <Button type="submit" className="bg-amber-600 hover:bg-amber-700">
                      {editingShareholder ? "تحديث" : "إضافة"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-sm text-amber-600">إجمالي المساهمين</p>
                  <p className="text-lg sm:text-2xl font-bold text-amber-800">{shareholders.length}</p>
                </div>
                <BarChart3 className="h-5 w-5 sm:h-8 sm:w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-sm text-blue-600">إجمالي الأسهم</p>
                  <p className="text-lg sm:text-2xl font-bold text-blue-800">{totalShares.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-5 w-5 sm:h-8 sm:w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-sm text-purple-600">كبار المساهمين (&gt;5%)</p>
                  <p className="text-lg sm:text-2xl font-bold text-purple-800">{majorShareholders.length}</p>
                </div>
                <Crown className="h-5 w-5 sm:h-8 sm:w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-sm text-green-600">أسهم التصويت</p>
                  <p className="text-lg sm:text-2xl font-bold text-green-800">{votingShares.toLocaleString()}</p>
                </div>
                <Vote className="h-5 w-5 sm:h-8 sm:w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200 col-span-2 sm:col-span-1">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-sm text-pink-600">الأرباح المستحقة</p>
                  <p className="text-lg sm:text-2xl font-bold text-pink-800">0</p>
                </div>
                <DollarSign className="h-5 w-5 sm:h-8 sm:w-8 text-pink-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className={`border-2 ${isPercentageValid ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
          <CardContent className="p-2 sm:p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 sm:gap-3">
                {isPercentageValid ? (
                  <CheckCircle2 className="h-5 w-5 sm:h-8 sm:w-8 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 sm:h-8 sm:w-8 text-red-600" />
                )}
                <div>
                  <p className={`text-[10px] sm:text-sm font-medium ${isPercentageValid ? 'text-green-700' : 'text-red-700'}`}>
                    إجمالي نسب الملكية
                  </p>
                  <p className={`text-sm sm:text-xl font-bold ${isPercentageValid ? 'text-green-800' : 'text-red-800'}`}>
                    {totalPercentage.toFixed(2)}%
                  </p>
                </div>
              </div>
              <div className="text-left">
                {isPercentageValid ? (
                  <Badge className="bg-green-600 text-white text-[10px] sm:text-xs">متوازن (100%)</Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px] sm:text-xs">
                    {totalPercentage > 100 ? `زيادة ${(totalPercentage - 100).toFixed(2)}%` : `نقص ${(100 - totalPercentage).toFixed(2)}%`}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-4 h-auto">
            <TabsTrigger value="list" className="gap-1 sm:gap-2 text-[10px] sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3">
              <User className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">القائمة</span>
            </TabsTrigger>
            <TabsTrigger value="analysis" className="gap-1 sm:gap-2 text-[10px] sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3">
              <PieChartIcon className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">التحليل</span>
            </TabsTrigger>
            <TabsTrigger value="dividends" className="gap-1 sm:gap-2 text-[10px] sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3">
              <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">الأرباح</span>
            </TabsTrigger>
            <TabsTrigger value="transfers" className="gap-1 sm:gap-2 text-[10px] sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3">
              <ArrowRightLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">التحويلات</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="بحث بالاسم..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                  data-testid="search-input"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="جميع الأنواع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  {shareholderTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المساهم</TableHead>
                      <TableHead className="text-right hidden md:table-cell">التصنيف</TableHead>
                      <TableHead className="text-right">عدد الأسهم</TableHead>
                      <TableHead className="text-right">نسبة الملكية</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">قوة التصويت</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">الأرباح المستحقة</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          جاري التحميل...
                        </TableCell>
                      </TableRow>
                    ) : filteredShareholders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          لا يوجد مساهمين
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredShareholders.map((shareholder) => {
                        const percentage = Number(shareholder.sharePercentage);
                        return (
                          <TableRow key={shareholder.id} data-testid={`shareholder-row-${shareholder.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${
                                  shareholder.shareholderType === 'individual' ? 'bg-green-100' :
                                  shareholder.shareholderType === 'company' ? 'bg-blue-100' :
                                  shareholder.shareholderType === 'government' ? 'bg-purple-100' : 'bg-amber-100'
                                }`}>
                                  {getTypeIcon(shareholder.shareholderType)}
                                </div>
                                <div>
                                  <p className="font-medium">{shareholder.fullName}</p>
                                  <p className="text-sm text-gray-500">
                                    {shareholderTypes.find(t => t.value === shareholder.shareholderType)?.label}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {getCategoryBadge(percentage, shareholder.shareholderType)}
                            </TableCell>
                            <TableCell className="font-medium text-sm">
                              {shareholder.numberOfShares?.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-lg">{percentage.toFixed(2)}%</span>
                                </div>
                                <Progress value={percentage} className="h-2" />
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {shareholder.votingRights ? (
                                <div className="flex items-center gap-1 text-green-600">
                                  <Vote className="h-4 w-4" />
                                  <span className="font-medium">{percentage.toFixed(2)}%</span>
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-gray-500 text-[10px] sm:text-xs">لا يصوت</Badge>
                              )}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <span className="text-gray-400">0 ر.س</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedShareholder(shareholder);
                                    setShowDetails(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingShareholder(shareholder);
                                    setIsDialogOpen(true);
                                  }}
                                  data-testid={`edit-shareholder-${shareholder.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setShareholderToDelete(shareholder);
                                    setDeleteDialogOpen(true);
                                  }}
                                  data-testid={`delete-shareholder-${shareholder.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5 text-amber-600" />
                    توزيع الملكية حسب النوع
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ownershipByTypeData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={ownershipByTypeData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {ownershipByTypeData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-8">لا يوجد بيانات</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-amber-600" />
                    أكبر 10 مساهمين
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {top10Shareholders.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={top10Shareholders.map(s => ({ 
                          name: s.fullName.slice(0, 15), 
                          percentage: Number(s.sharePercentage) 
                        }))} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" unit="%" />
                          <YAxis dataKey="name" type="category" width={100} fontSize={11} />
                          <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                          <Bar dataKey="percentage" fill="#f59e0b" name="نسبة الملكية" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-8">لا يوجد بيانات</p>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="pb-2 sm:pb-6">
                  <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
                    <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                    تحليل تركز الملكية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                    <div className="bg-amber-50 p-2 sm:p-4 rounded-lg text-center">
                      <p className="text-[10px] sm:text-sm text-amber-600 mb-1">أكبر مساهم</p>
                      <p className="text-lg sm:text-2xl font-bold text-amber-800">
                        {top10Shareholders[0] ? `${Number(top10Shareholders[0].sharePercentage).toFixed(1)}%` : "-"}
                      </p>
                      <p className="text-[10px] sm:text-sm text-gray-600 mt-1 truncate">
                        {top10Shareholders[0]?.fullName || "-"}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-2 sm:p-4 rounded-lg text-center">
                      <p className="text-[10px] sm:text-sm text-blue-600 mb-1">أكبر 5 مساهمين</p>
                      <p className="text-lg sm:text-2xl font-bold text-blue-800">
                        {concentrationData[0]?.value.toFixed(1) || 0}%
                      </p>
                      <p className="text-[10px] sm:text-sm text-gray-600 mt-1">من إجمالي الملكية</p>
                    </div>
                    <div className="bg-green-50 p-2 sm:p-4 rounded-lg text-center">
                      <p className="text-[10px] sm:text-sm text-green-600 mb-1">تنوع الملكية</p>
                      <p className="text-lg sm:text-2xl font-bold text-green-800">
                        {shareholders.length > 0 ? (100 - concentrationData[0]?.value).toFixed(1) : 0}%
                      </p>
                      <p className="text-[10px] sm:text-sm text-gray-600 mt-1">موزعة على باقي المساهمين</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="dividends" className="mt-6">
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <DollarSign className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">توزيعات الأرباح</h3>
                <p>لا يوجد توزيعات أرباح مسجلة حالياً</p>
                <Button variant="outline" className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  إضافة توزيع أرباح
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transfers" className="mt-6">
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <ArrowRightLeft className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">تحويلات الأسهم</h3>
                <p>لا يوجد تحويلات مسجلة حالياً</p>
                <Link href="/governance/transfers">
                  <Button variant="outline" className="mt-4 gap-2">
                    <History className="h-4 w-4" />
                    عرض سجل التحويلات
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showDetails} onOpenChange={(open) => {
          setShowDetails(open);
          if (!open) setDetailsTab("info");
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>تفاصيل المساهم</DialogTitle>
                {selectedShareholder && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => exportShareholderPDF(selectedShareholder)}
                  >
                    <Printer className="h-4 w-4" />
                    تصدير PDF
                  </Button>
                )}
              </div>
            </DialogHeader>
            {selectedShareholder && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-lg">
                  <div className={`p-3 rounded-full ${
                    selectedShareholder.shareholderType === 'individual' ? 'bg-green-100' :
                    selectedShareholder.shareholderType === 'company' ? 'bg-blue-100' :
                    selectedShareholder.shareholderType === 'government' ? 'bg-purple-100' : 'bg-amber-100'
                  }`}>
                    {getTypeIcon(selectedShareholder.shareholderType)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold">{selectedShareholder.fullName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">
                        {shareholderTypes.find(t => t.value === selectedShareholder.shareholderType)?.label}
                      </Badge>
                      {getCategoryBadge(Number(selectedShareholder.sharePercentage), selectedShareholder.shareholderType)}
                    </div>
                  </div>
                </div>

                <Tabs value={detailsTab} onValueChange={setDetailsTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="info" className="gap-2">
                      <User className="h-4 w-4" />
                      البيانات الأساسية
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="gap-2">
                      <FileText className="h-4 w-4" />
                      الوثائق ({shareholderDocs.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="info" className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500">عدد الأسهم</p>
                        <p className="text-xl font-bold">{selectedShareholder.numberOfShares?.toLocaleString()}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500">نسبة الملكية</p>
                        <p className="text-xl font-bold">{Number(selectedShareholder.sharePercentage).toFixed(2)}%</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500">فئة الأسهم</p>
                        <p className="font-medium">{shareClasses.find(c => c.value === selectedShareholder.shareClass)?.label}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500">تاريخ الاستحواذ</p>
                        <p className="font-medium">{selectedShareholder.acquisitionDate || '-'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500">رقم الهوية/السجل</p>
                        <p className="font-medium">{selectedShareholder.nationalId || '-'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500">الجنسية</p>
                        <p className="font-medium">{selectedShareholder.nationality || '-'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500">البريد الإلكتروني</p>
                        <p className="font-medium">{selectedShareholder.email || '-'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500">رقم الهاتف</p>
                        <p className="font-medium">{selectedShareholder.phone || '-'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg col-span-2">
                        <p className="text-sm text-gray-500">العنوان</p>
                        <p className="font-medium">{selectedShareholder.address || '-'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500">البنك</p>
                        <p className="font-medium">{selectedShareholder.bankName || '-'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500">رقم الآيبان</p>
                        <p className="font-medium text-xs">{selectedShareholder.iban || '-'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <Card className="bg-green-50 border-green-200">
                        <CardContent className="p-4 text-center">
                          <Vote className="h-8 w-8 mx-auto text-green-500 mb-2" />
                          <p className="text-sm text-green-600">قوة التصويت</p>
                          <p className="text-xl font-bold text-green-800">
                            {selectedShareholder.votingRights ? `${Number(selectedShareholder.sharePercentage).toFixed(2)}%` : "0%"}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4 text-center">
                          <DollarSign className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                          <p className="text-sm text-blue-600">أرباح مستحقة</p>
                          <p className="text-xl font-bold text-blue-800">0 ر.س</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-purple-50 border-purple-200">
                        <CardContent className="p-4 text-center">
                          <ArrowRightLeft className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                          <p className="text-sm text-purple-600">التحويلات</p>
                          <p className="text-xl font-bold text-purple-800">0</p>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="documents" className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {documentTypes.map((docType) => {
                        const existingDoc = shareholderDocs.find(d => d.documentType === docType.value);
                        const DocIcon = docType.icon;
                        return (
                          <div key={docType.value} className={`p-4 rounded-lg border-2 ${existingDoc ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-dashed border-gray-300'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <DocIcon className={`h-5 w-5 ${existingDoc ? 'text-green-600' : 'text-gray-400'}`} />
                              {existingDoc && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-red-500 hover:text-red-700"
                                  onClick={() => deleteDocMutation.mutate({ shareholderId: selectedShareholder.id, docId: existingDoc.id })}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <p className={`text-sm font-medium mb-2 ${existingDoc ? 'text-green-800' : 'text-gray-600'}`}>
                              {docType.label}
                            </p>
                            {existingDoc ? (
                              <a
                                href={`/api/governance/shareholders/${selectedShareholder.id}/documents/${existingDoc.id}/download`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <Download className="h-3 w-3" />
                                تحميل
                              </a>
                            ) : (
                              <label className="cursor-pointer">
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                  onChange={(e) => handleFileUpload(e, docType.value)}
                                  disabled={uploadingDoc}
                                />
                                <span className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1">
                                  <Upload className="h-3 w-3" />
                                  {uploadingDoc ? "جاري الرفع..." : "رفع"}
                                </span>
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {shareholderDocs.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium text-gray-700 mb-2">جميع الوثائق المرفوعة</h4>
                        <div className="space-y-2">
                          {shareholderDocs.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <File className="h-5 w-5 text-gray-500" />
                                <div>
                                  <p className="font-medium text-sm">{doc.documentName}</p>
                                  <p className="text-xs text-gray-500">{doc.originalFileName}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <a
                                  href={`/api/governance/shareholders/${selectedShareholder.id}/documents/${doc.id}/download`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <Download className="h-4 w-4" />
                                </a>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500"
                                  onClick={() => deleteDocMutation.mutate({ shareholderId: selectedShareholder.id, docId: doc.id })}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetails(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                تأكيد حذف المساهم
              </AlertDialogTitle>
              <AlertDialogDescription className="text-right">
                هل أنت متأكد من حذف المساهم <strong>{shareholderToDelete?.fullName}</strong>؟
                <br />
                نسبة الملكية: <strong>{shareholderToDelete?.sharePercentage}%</strong>
                <br />
                <span className="text-red-500 font-medium">هذا الإجراء لا يمكن التراجع عنه.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => shareholderToDelete && deleteMutation.mutate(shareholderToDelete.id)}
              >
                {deleteMutation.isPending ? "جاري الحذف..." : "حذف المساهم"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
