import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  FileText,
  Download,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Building,
  User,
  Calendar,
  DollarSign,
  FileSignature,
  AlertCircle,
  ArrowRight,
  FileText as ContractIcon,
} from "lucide-react";
import { Link } from "wouter";
import type { InfluencerContract, MarketingInfluencer, Branch } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

interface ContractFormData {
  influencerId: number | null;
  influencerName: string;
  influencerEmail: string;
  influencerPhone: string;
  nationalId: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  iban: string;
  branchId: string;
  branchName: string;
  campaignName: string;
  campaignDescription: string;
  coverageLocation: string;
  coverageDate: string;
  contractAmount: number;
  paymentTerms: string;
  deliverables: string[];
  contentRequirements: string;
  exclusivityClause: boolean;
  contractStartDate: string;
  contractEndDate: string;
  notes: string;
}

const defaultFormData: ContractFormData = {
  influencerId: null,
  influencerName: "",
  influencerEmail: "",
  influencerPhone: "",
  nationalId: "",
  bankName: "",
  bankAccountNumber: "",
  bankAccountHolder: "",
  iban: "",
  branchId: "",
  branchName: "",
  campaignName: "",
  campaignDescription: "",
  coverageLocation: "",
  coverageDate: "",
  contractAmount: 0,
  paymentTerms: "",
  deliverables: [],
  contentRequirements: "",
  exclusivityClause: false,
  contractStartDate: "",
  contractEndDate: "",
  notes: "",
};

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  pending_signature: "بانتظار التوقيع",
  signed: "موقّع",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "بانتظار الموافقة",
  approved: "معتمد",
  paid: "مدفوع",
  rejected: "مرفوض",
};

const DELIVERABLE_OPTIONS = [
  { value: "story", label: "ستوري" },
  { value: "post", label: "منشور" },
  { value: "reel", label: "ريلز" },
  { value: "video", label: "فيديو" },
  { value: "live", label: "بث مباشر" },
  { value: "review", label: "مراجعة" },
  { value: "coverage", label: "تغطية كاملة" },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "draft":
      return <Badge variant="secondary"><Clock className="h-3 w-3 ml-1" />مسودة</Badge>;
    case "pending_signature":
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><FileSignature className="h-3 w-3 ml-1" />بانتظار التوقيع</Badge>;
    case "signed":
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 ml-1" />موقّع</Badge>;
    case "completed":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><CheckCircle className="h-3 w-3 ml-1" />مكتمل</Badge>;
    case "cancelled":
      return <Badge variant="destructive"><XCircle className="h-3 w-3 ml-1" />ملغي</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

const getPaymentStatusBadge = (status: string) => {
  switch (status) {
    case "pending":
      return <Badge variant="outline" className="bg-gray-50 text-gray-700"><Clock className="h-3 w-3 ml-1" />بانتظار الموافقة</Badge>;
    case "approved":
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 ml-1" />معتمد</Badge>;
    case "paid":
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200"><DollarSign className="h-3 w-3 ml-1" />مدفوع</Badge>;
    case "rejected":
      return <Badge variant="destructive"><XCircle className="h-3 w-3 ml-1" />مرفوض</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

export default function InfluencerContractsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<InfluencerContract | null>(null);
  const [formData, setFormData] = useState<ContractFormData>(defaultFormData);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");

  const { data: contracts = [], isLoading } = useQuery<InfluencerContract[]>({
    queryKey: ["/api/marketing/influencer-contracts"],
  });

  const { data: influencers = [] } = useQuery<MarketingInfluencer[]>({
    queryKey: ["/api/marketing/influencers"],
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/marketing/branches"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: ContractFormData) => {
      const numberRes = await fetch("/api/marketing/influencer-contracts/generate-number", {
        credentials: "include",
      });
      if (!numberRes.ok) throw new Error("فشل في توليد رقم العقد");
      const { contractNumber } = await numberRes.json();
      
      const response = await fetch("/api/marketing/influencer-contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, contractNumber, status: "draft", paymentStatus: "pending" }),
      });
      if (!response.ok) throw new Error("فشل في إنشاء العقد");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/influencer-contracts"] });
      setIsDialogOpen(false);
      setFormData(defaultFormData);
      toast({ title: "تم إنشاء العقد بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء العقد", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ContractFormData> }) => {
      const response = await fetch(`/api/marketing/influencer-contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("فشل في تحديث العقد");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/influencer-contracts"] });
      setIsDialogOpen(false);
      setSelectedContract(null);
      setFormData(defaultFormData);
      toast({ title: "تم تحديث العقد بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في تحديث العقد", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/marketing/influencer-contracts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("فشل في حذف العقد");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/influencer-contracts"] });
      setIsDeleteDialogOpen(false);
      setSelectedContract(null);
      toast({ title: "تم حذف العقد بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في حذف العقد", variant: "destructive" });
    },
  });

  const handleInfluencerSelect = (influencerId: string) => {
    const influencer = influencers.find(i => i.id === parseInt(influencerId));
    if (influencer) {
      setFormData(prev => ({
        ...prev,
        influencerId: influencer.id,
        influencerName: influencer.name || "",
        influencerEmail: influencer.email || "",
        influencerPhone: influencer.phone || "",
        bankName: influencer.bankName || "",
        bankAccountNumber: influencer.bankAccountNumber || "",
        bankAccountHolder: influencer.bankAccountHolder || "",
      }));
    }
  };

  const handleBranchSelect = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (branch) {
      setFormData(prev => ({
        ...prev,
        branchId: branch.id,
        branchName: branch.name || "",
      }));
    }
  };

  const handleDeliverableToggle = (deliverable: string) => {
    setFormData(prev => ({
      ...prev,
      deliverables: prev.deliverables.includes(deliverable)
        ? prev.deliverables.filter(d => d !== deliverable)
        : [...prev.deliverables, deliverable],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.influencerName.trim()) {
      toast({ title: "يرجى إدخال اسم المؤثر", variant: "destructive" });
      return;
    }
    if (!formData.campaignName.trim()) {
      toast({ title: "يرجى إدخال اسم الحملة", variant: "destructive" });
      return;
    }
    if (!formData.contractAmount || formData.contractAmount <= 0) {
      toast({ title: "يرجى إدخال قيمة العقد", variant: "destructive" });
      return;
    }
    if (!formData.contractStartDate) {
      toast({ title: "يرجى إدخال تاريخ بداية العقد", variant: "destructive" });
      return;
    }
    
    if (selectedContract) {
      updateMutation.mutate({ id: selectedContract.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (contract: InfluencerContract) => {
    setSelectedContract(contract);
    setFormData({
      influencerId: contract.influencerId,
      influencerName: contract.influencerName || "",
      influencerEmail: contract.influencerEmail || "",
      influencerPhone: contract.influencerPhone || "",
      nationalId: contract.nationalId || "",
      bankName: contract.bankName || "",
      bankAccountNumber: contract.bankAccountNumber || "",
      bankAccountHolder: contract.bankAccountHolder || "",
      iban: contract.iban || "",
      branchId: contract.branchId || "",
      branchName: contract.branchName || "",
      campaignName: contract.campaignName || "",
      campaignDescription: contract.campaignDescription || "",
      coverageLocation: contract.coverageLocation || "",
      coverageDate: contract.coverageDate || "",
      contractAmount: contract.contractAmount || 0,
      paymentTerms: contract.paymentTerms || "",
      deliverables: contract.deliverables || [],
      contentRequirements: contract.contentRequirements || "",
      exclusivityClause: contract.exclusivityClause || false,
      contractStartDate: contract.contractStartDate || "",
      contractEndDate: contract.contractEndDate || "",
      notes: contract.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDownloadPdf = async (contractId: number) => {
    try {
      const response = await fetch(`/api/marketing/influencer-contracts/${contractId}/pdf`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("فشل في تحميل العقد");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contract-${contractId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "تم تحميل العقد بنجاح" });
    } catch {
      toast({ title: "فشل في تحميل العقد", variant: "destructive" });
    }
  };

  const handleStatusChange = async (contractId: number, newStatus: string) => {
    try {
      await updateMutation.mutateAsync({ id: contractId, data: { status: newStatus } as any });
    } catch {
      toast({ title: "فشل في تحديث الحالة", variant: "destructive" });
    }
  };

  const handlePaymentStatusChange = async (contractId: number, newStatus: string) => {
    try {
      const updateData: any = { paymentStatus: newStatus };
      if (newStatus === "approved") {
        updateData.financialApprovalDate = new Date().toISOString();
        updateData.financialApprovedBy = user?.id;
      }
      await updateMutation.mutateAsync({ id: contractId, data: updateData });
    } catch {
      toast({ title: "فشل في تحديث حالة الدفع", variant: "destructive" });
    }
  };

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = 
      (contract.contractNumber?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (contract.influencerName?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (contract.campaignName?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
    const matchesPaymentStatus = paymentStatusFilter === "all" || contract.paymentStatus === paymentStatusFilter;
    return matchesSearch && matchesStatus && matchesPaymentStatus;
  });

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-US").format(amount) + " ر.س";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US");
  };

  const stats = {
    total: contracts.length,
    draft: contracts.filter(c => c.status === "draft").length,
    signed: contracts.filter(c => c.status === "signed").length,
    pendingPayment: contracts.filter(c => c.paymentStatus === "pending").length,
    totalAmount: contracts.reduce((sum, c) => sum + (c.contractAmount || 0), 0),
  };

  return (
    <Layout>
      <div className="page-container space-y-3 sm:space-y-4" dir="rtl">
        <PageHeader
          icon={ContractIcon}
          tone="marketing"
          title="عقود المؤثرين"
          description="إدارة عقود التعاون مع المؤثرين والمدونين"
          backHref="/marketing"
          actions={
            <Button size="sm" className="h-9" onClick={() => { setSelectedContract(null); setFormData(defaultFormData); setIsDialogOpen(true); }} data-testid="button-add-contract">
              <Plus className="h-4 w-4 ml-2" />
              عقد جديد
            </Button>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          <Card className="p-2 sm:p-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">إجمالي العقود</p>
                <p className="text-base sm:text-lg font-bold">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-2 sm:p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">مسودة</p>
                <p className="text-base sm:text-lg font-bold">{stats.draft}</p>
              </div>
            </div>
          </Card>
          <Card className="p-2 sm:p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">موقّعة</p>
                <p className="text-base sm:text-lg font-bold">{stats.signed}</p>
              </div>
            </div>
          </Card>
          <Card className="p-2 sm:p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">بانتظار الدفع</p>
                <p className="text-base sm:text-lg font-bold">{stats.pendingPayment}</p>
              </div>
            </div>
          </Card>
          <Card className="p-2 sm:p-3 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">إجمالي القيمة</p>
                <p className="text-base sm:text-lg font-bold truncate">{formatCurrency(stats.totalAmount)}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader className="py-3">
            <div className="flex flex-col gap-3">
              <CardTitle className="text-sm sm:text-base">قائمة العقود</CardTitle>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث..."
                    className="pr-9 w-full sm:w-48 h-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search"
                  />
                </div>
                <div className="flex gap-2 flex-1 sm:flex-none">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="flex-1 sm:w-32 h-10" data-testid="select-status-filter">
                      <Filter className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2 shrink-0" />
                      <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الحالات</SelectItem>
                      {Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                    <SelectTrigger className="flex-1 sm:w-32 h-10" data-testid="select-payment-filter">
                      <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2 shrink-0" />
                      <SelectValue placeholder="حالة الدفع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الحالات</SelectItem>
                      {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredContracts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد عقود
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[700px] table-actions-sticky">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="hidden sm:table-cell">رقم العقد</TableHead>
                      <TableHead>المؤثر</TableHead>
                      <TableHead className="hidden md:table-cell">الحملة</TableHead>
                      <TableHead>القيمة</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead className="hidden lg:table-cell">حالة الدفع</TableHead>
                      <TableHead className="hidden md:table-cell">التاريخ</TableHead>
                      <TableHead className="text-left">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContracts.map((contract) => (
                      <TableRow key={contract.id} data-testid={`row-contract-${contract.id}`}>
                        <TableCell className="font-mono text-xs sm:text-sm hidden sm:table-cell">{contract.contractNumber}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <User className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                            <span className="text-xs sm:text-sm truncate max-w-[80px] sm:max-w-[1400px] mx-auto">{contract.influencerName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs sm:text-sm">{contract.campaignName}</TableCell>
                        <TableCell className="font-medium text-xs sm:text-sm whitespace-nowrap">{formatCurrency(contract.contractAmount)}</TableCell>
                        <TableCell>{getStatusBadge(contract.status || "draft")}</TableCell>
                        <TableCell className="hidden lg:table-cell">{getPaymentStatusBadge(contract.paymentStatus || "pending")}</TableCell>
                        <TableCell className="text-xs sm:text-sm text-muted-foreground hidden md:table-cell">
                          {formatDate(contract.createdAt as any)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5 sm:gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 sm:h-8 sm:w-8"
                              onClick={() => { setSelectedContract(contract); setIsViewDialogOpen(true); }}
                              data-testid={`button-view-${contract.id}`}
                            >
                              <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 sm:h-8 sm:w-8"
                              onClick={() => handleEdit(contract)}
                              data-testid={`button-edit-${contract.id}`}
                            >
                              <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 sm:h-8 sm:w-8 hidden sm:flex"
                              onClick={() => handleDownloadPdf(contract.id)}
                              data-testid={`button-download-${contract.id}`}
                            >
                              <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 sm:h-8 sm:w-8"
                              onClick={() => { setSelectedContract(contract); setIsDeleteDialogOpen(true); }}
                              data-testid={`button-delete-${contract.id}`}
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedContract ? "تعديل العقد" : "إنشاء عقد جديد"}</DialogTitle>
              <DialogDescription>
                {selectedContract ? "تعديل بيانات العقد" : "إضافة عقد تعاون جديد مع مؤثر"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>اختيار مؤثر موجود (اختياري)</Label>
                  <Select onValueChange={handleInfluencerSelect}>
                    <SelectTrigger data-testid="select-influencer">
                      <SelectValue placeholder="اختر من قائمة المؤثرين" />
                    </SelectTrigger>
                    <SelectContent>
                      {influencers.map((inf) => (
                        <SelectItem key={inf.id} value={inf.id.toString()}>
                          {inf.name} {inf.nameAr ? `(${inf.nameAr})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>اسم المؤثر *</Label>
                  <Input
                    required
                    value={formData.influencerName}
                    onChange={(e) => setFormData(prev => ({ ...prev, influencerName: e.target.value }))}
                    data-testid="input-influencer-name"
                  />
                </div>
                <div>
                  <Label>رقم الهاتف</Label>
                  <Input
                    value={formData.influencerPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, influencerPhone: e.target.value }))}
                    data-testid="input-phone"
                  />
                </div>
                <div>
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    value={formData.influencerEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, influencerEmail: e.target.value }))}
                    data-testid="input-email"
                  />
                </div>
                <div>
                  <Label>رقم الهوية</Label>
                  <Input
                    value={formData.nationalId}
                    onChange={(e) => setFormData(prev => ({ ...prev, nationalId: e.target.value }))}
                    data-testid="input-national-id"
                  />
                </div>

                <div className="col-span-2 border-t pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    المعلومات البنكية
                  </h4>
                </div>
                <div>
                  <Label>اسم البنك</Label>
                  <Input
                    value={formData.bankName}
                    onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                    data-testid="input-bank-name"
                  />
                </div>
                <div>
                  <Label>رقم الحساب</Label>
                  <Input
                    value={formData.bankAccountNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, bankAccountNumber: e.target.value }))}
                    data-testid="input-account-number"
                  />
                </div>
                <div>
                  <Label>اسم صاحب الحساب</Label>
                  <Input
                    value={formData.bankAccountHolder}
                    onChange={(e) => setFormData(prev => ({ ...prev, bankAccountHolder: e.target.value }))}
                    data-testid="input-account-holder"
                  />
                </div>
                <div>
                  <Label>رقم الآيبان</Label>
                  <Input
                    value={formData.iban}
                    onChange={(e) => setFormData(prev => ({ ...prev, iban: e.target.value }))}
                    data-testid="input-iban"
                  />
                </div>

                <div className="col-span-2 border-t pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    تفاصيل الحملة
                  </h4>
                </div>
                <div>
                  <Label>اسم الحملة *</Label>
                  <Input
                    required
                    value={formData.campaignName}
                    onChange={(e) => setFormData(prev => ({ ...prev, campaignName: e.target.value }))}
                    data-testid="input-campaign-name"
                  />
                </div>
                <div>
                  <Label>الفرع</Label>
                  <Select value={formData.branchId} onValueChange={handleBranchSelect}>
                    <SelectTrigger data-testid="select-branch">
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>موقع التغطية</Label>
                  <Input
                    value={formData.coverageLocation}
                    onChange={(e) => setFormData(prev => ({ ...prev, coverageLocation: e.target.value }))}
                    data-testid="input-coverage-location"
                  />
                </div>
                <div>
                  <Label>تاريخ التغطية</Label>
                  <Input
                    type="date"
                    value={formData.coverageDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, coverageDate: e.target.value }))}
                    data-testid="input-coverage-date"
                  />
                </div>
                <div className="col-span-2">
                  <Label>وصف الحملة</Label>
                  <Textarea
                    value={formData.campaignDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, campaignDescription: e.target.value }))}
                    data-testid="input-campaign-description"
                  />
                </div>

                <div className="col-span-2 border-t pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    تفاصيل العقد
                  </h4>
                </div>
                <div>
                  <Label>قيمة العقد (ر.س) *</Label>
                  <Input
                    type="number"
                    required
                    value={formData.contractAmount || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, contractAmount: parseFloat(e.target.value) || 0 }))}
                    data-testid="input-contract-amount"
                  />
                </div>
                <div>
                  <Label>شروط الدفع</Label>
                  <Input
                    placeholder="مثال: 50% مقدماً - 50% بعد التسليم"
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                    data-testid="input-payment-terms"
                  />
                </div>
                <div>
                  <Label>تاريخ بداية العقد *</Label>
                  <Input
                    type="date"
                    required
                    value={formData.contractStartDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, contractStartDate: e.target.value }))}
                    data-testid="input-start-date"
                  />
                </div>
                <div>
                  <Label>تاريخ نهاية العقد</Label>
                  <Input
                    type="date"
                    value={formData.contractEndDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, contractEndDate: e.target.value }))}
                    data-testid="input-end-date"
                  />
                </div>

                <div className="col-span-2">
                  <Label>المخرجات المطلوبة</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {DELIVERABLE_OPTIONS.map((option) => (
                      <div key={option.value} className="flex items-center gap-2">
                        <Checkbox
                          id={`deliverable-${option.value}`}
                          checked={formData.deliverables.includes(option.value)}
                          onCheckedChange={() => handleDeliverableToggle(option.value)}
                          data-testid={`checkbox-deliverable-${option.value}`}
                        />
                        <Label htmlFor={`deliverable-${option.value}`} className="cursor-pointer text-sm">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="col-span-2">
                  <Label>متطلبات المحتوى</Label>
                  <Textarea
                    placeholder="وصف تفصيلي للمحتوى المطلوب..."
                    value={formData.contentRequirements}
                    onChange={(e) => setFormData(prev => ({ ...prev, contentRequirements: e.target.value }))}
                    data-testid="input-content-requirements"
                  />
                </div>

                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="exclusivity"
                      checked={formData.exclusivityClause}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, exclusivityClause: !!checked }))}
                      data-testid="checkbox-exclusivity"
                    />
                    <Label htmlFor="exclusivity" className="cursor-pointer">
                      شرط الحصرية (عدم الترويج لمنتجات منافسة خلال فترة العقد)
                    </Label>
                  </div>
                </div>

                <div className="col-span-2">
                  <Label>ملاحظات إضافية</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    data-testid="input-notes"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                  {selectedContract ? "حفظ التغييرات" : "إنشاء العقد"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                تفاصيل العقد
              </DialogTitle>
            </DialogHeader>
            {selectedContract && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <p className="text-sm text-muted-foreground">رقم العقد</p>
                    <p className="font-mono font-bold">{selectedContract.contractNumber}</p>
                  </div>
                  <div className="flex gap-2">
                    {getStatusBadge(selectedContract.status || "draft")}
                    {getPaymentStatusBadge(selectedContract.paymentStatus || "pending")}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">المؤثر</p>
                    <p className="font-medium">{selectedContract.influencerName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">الحملة</p>
                    <p className="font-medium">{selectedContract.campaignName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">قيمة العقد</p>
                    <p className="font-bold text-lg text-emerald-600">{formatCurrency(selectedContract.contractAmount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">الفرع</p>
                    <p className="font-medium">{selectedContract.branchName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">تاريخ التغطية</p>
                    <p>{formatDate(selectedContract.coverageDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">موقع التغطية</p>
                    <p>{selectedContract.coverageLocation || "-"}</p>
                  </div>
                </div>

                {selectedContract.deliverables && selectedContract.deliverables.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">المخرجات المطلوبة</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedContract.deliverables.map((d: string) => (
                        <Badge key={d} variant="secondary">
                          {DELIVERABLE_OPTIONS.find(o => o.value === d)?.label || d}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 space-y-3">
                  <div className="flex gap-2">
                    <Select value={selectedContract.status || "draft"} onValueChange={(v) => handleStatusChange(selectedContract.id, v)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="تغيير الحالة" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedContract.paymentStatus || "pending"} onValueChange={(v) => handlePaymentStatusChange(selectedContract.id, v)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="تغيير حالة الدفع" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => handleDownloadPdf(selectedContract.id)} className="w-full">
                    <Download className="h-4 w-4 ml-2" />
                    تحميل العقد PDF
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>حذف العقد</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف هذا العقد؟ هذا الإجراء لا يمكن التراجع عنه.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedContract && deleteMutation.mutate(selectedContract.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
