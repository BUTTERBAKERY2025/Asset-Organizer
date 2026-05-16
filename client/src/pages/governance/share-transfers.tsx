import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeftRight,
  Plus,
  ChevronLeft,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Calendar,
  DollarSign,
  User,
} from "lucide-react";
import type { ShareTransfer, Shareholder } from "@shared/schema";

const transferTypes = [
  { value: "sale", label: "بيع" },
  { value: "gift", label: "هبة" },
  { value: "inheritance", label: "ميراث" },
  { value: "transfer", label: "تحويل" },
];

const transferStatuses = [
  { value: "pending", label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-800" },
  { value: "approved", label: "معتمد", color: "bg-green-100 text-green-800" },
  { value: "rejected", label: "مرفوض", color: "bg-red-100 text-red-800" },
  { value: "completed", label: "مكتمل", color: "bg-blue-100 text-blue-800" },
];

export default function ShareTransfersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: transfers = [], isLoading } = useQuery<ShareTransfer[]>({
    queryKey: ["/api/governance/share-transfers"],
  });

  const { data: shareholders = [] } = useQuery<Shareholder[]>({
    queryKey: ["/api/governance/shareholders"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<ShareTransfer>) => {
      const res = await fetch("/api/governance/share-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create transfer");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/share-transfers"] });
      setIsDialogOpen(false);
      toast({ title: "تم إنشاء طلب التحويل بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء طلب التحويل", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/governance/share-transfers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: status }),
      });
      if (!res.ok) throw new Error("Failed to update transfer");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/share-transfers"] });
      toast({ title: "تم تحديث حالة التحويل" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const numberOfShares = parseInt(formData.get("numberOfShares") as string);
    const pricePerShare = parseFloat(formData.get("pricePerShare") as string);
    const transferDateStr = formData.get("transferDate") as string;
    const data = {
      fromShareholderId: parseInt(formData.get("fromShareholderId") as string),
      toShareholderId: parseInt(formData.get("toShareholderId") as string),
      numberOfShares,
      pricePerShare: pricePerShare.toString(),
      totalValue: (numberOfShares * pricePerShare).toString(),
      transferDate: transferDateStr || new Date().toISOString().split('T')[0],
      transferType: formData.get("transferType") as string,
      notes: formData.get("notes") as string,
    };
    createMutation.mutate(data);
  };

  const filteredTransfers = transfers.filter((t) =>
    t.transferNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getShareholderName = (id: number) => {
    return shareholders.find(s => s.id === id)?.fullName || "غير معروف";
  };

  return (
    <Layout>
      <div className="max-w-none p-3 sm:p-4 md:p-6 space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/governance">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-2 sm:p-3 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl">
              <ArrowLeftRight className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-cyan-800" data-testid="page-title">
                تحويلات الأسهم
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">إدارة عمليات نقل ملكية الأسهم</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-cyan-600 hover:bg-cyan-700" data-testid="btn-add-transfer">
                <Plus className="h-4 w-4" />
                تحويل جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>طلب تحويل أسهم</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fromShareholderId">من المساهم *</Label>
                    <Select name="fromShareholderId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المساهم" />
                      </SelectTrigger>
                      <SelectContent>
                        {shareholders.map((s) => (
                          <SelectItem key={s.id} value={s.id.toString()}>
                            {s.fullName} ({s.numberOfShares?.toLocaleString()} سهم)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toShareholderId">إلى المساهم *</Label>
                    <Select name="toShareholderId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المساهم" />
                      </SelectTrigger>
                      <SelectContent>
                        {shareholders.map((s) => (
                          <SelectItem key={s.id} value={s.id.toString()}>
                            {s.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numberOfShares">عدد الأسهم *</Label>
                    <Input id="numberOfShares" name="numberOfShares" type="number" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pricePerShare">سعر السهم (ر.س) *</Label>
                    <Input id="pricePerShare" name="pricePerShare" type="number" step="0.01" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transferType">نوع التحويل *</Label>
                    <Select name="transferType" defaultValue="sale">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {transferTypes.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transferDate">تاريخ التحويل *</Label>
                    <Input id="transferDate" name="transferDate" type="date" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">ملاحظات</Label>
                  <Textarea id="notes" name="notes" />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                  <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">إنشاء الطلب</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-cyan-600">إجمالي التحويلات</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-cyan-800">{transfers.length}</p>
                </div>
                <ArrowLeftRight className="h-6 w-6 sm:h-8 sm:w-8 text-cyan-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-yellow-600">قيد المراجعة</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-800">
                    {transfers.filter(t => t.approvalStatus === 'pending').length}
                  </p>
                </div>
                <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-green-600">معتمدة</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-800">
                    {transfers.filter(t => t.approvalStatus === 'approved').length}
                  </p>
                </div>
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-blue-600">إجمالي القيمة</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800">
                    {transfers.reduce((sum, t) => sum + (Number(t.totalValue) || 0), 0).toLocaleString()} <span className="text-xs sm:text-sm">ر.س</span>
                  </p>
                </div>
                <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="بحث برقم التحويل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
            data-testid="search-input"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم التحويل</TableHead>
                  <TableHead className="text-right">من</TableHead>
                  <TableHead className="text-right">إلى</TableHead>
                  <TableHead className="text-right">عدد الأسهم</TableHead>
                  <TableHead className="text-right hidden md:table-cell">القيمة الإجمالية</TableHead>
                  <TableHead className="text-right hidden md:table-cell">النوع</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">التاريخ</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      جاري التحميل...
                    </TableCell>
                  </TableRow>
                ) : filteredTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      لا يوجد تحويلات
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransfers.map((transfer) => (
                    <TableRow key={transfer.id} data-testid={`transfer-row-${transfer.id}`}>
                      <TableCell className="font-mono text-xs sm:text-sm">{transfer.transferNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 sm:gap-2">
                          <User className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                          <span className="text-xs sm:text-sm">{getShareholderName(transfer.fromShareholderId)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 sm:gap-2">
                          <User className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                          <span className="text-xs sm:text-sm">{getShareholderName(transfer.toShareholderId)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-xs sm:text-sm">{transfer.numberOfShares?.toLocaleString()}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs sm:text-sm">{Number(transfer.totalValue).toLocaleString()} ر.س</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="text-[10px] sm:text-xs">
                          {transferTypes.find(t => t.value === transfer.transferType)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-xs sm:text-sm">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          {transfer.transferDate ? new Date(transfer.transferDate).toLocaleDateString('en-GB') : '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] sm:text-xs ${transferStatuses.find(s => s.value === transfer.approvalStatus)?.color}`}>
                          {transferStatuses.find(s => s.value === transfer.approvalStatus)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {transfer.approvalStatus === 'pending' && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 sm:h-8 sm:w-8 text-green-600"
                              onClick={() => approveMutation.mutate({ id: transfer.id, status: 'approved' })}
                              data-testid={`approve-${transfer.id}`}
                            >
                              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 sm:h-8 sm:w-8 text-red-600"
                              onClick={() => approveMutation.mutate({ id: transfer.id, status: 'rejected' })}
                              data-testid={`reject-${transfer.id}`}
                            >
                              <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
