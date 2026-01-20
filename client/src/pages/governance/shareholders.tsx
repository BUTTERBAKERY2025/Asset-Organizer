import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";
import type { Shareholder } from "@shared/schema";

const shareholderTypes = [
  { value: "individual", label: "فرد", icon: User },
  { value: "company", label: "شركة", icon: Building2 },
  { value: "government", label: "جهة حكومية", icon: Landmark },
  { value: "institution", label: "مؤسسة", icon: TrendingUp },
];

const shareClasses = [
  { value: "common", label: "عادية" },
  { value: "preferred", label: "ممتازة" },
  { value: "founders", label: "مؤسسين" },
];

export default function ShareholdersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingShareholder, setEditingShareholder] = useState<Shareholder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shareholders = [], isLoading } = useQuery<Shareholder[]>({
    queryKey: ["/api/governance/shareholders"],
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
      acquisitionDate: acquisitionDateStr ? new Date(acquisitionDateStr) : null,
      bankName: formData.get("bankName") as string,
      iban: formData.get("iban") as string,
    };

    if (editingShareholder) {
      updateMutation.mutate({ id: editingShareholder.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredShareholders = shareholders.filter((s) =>
    s.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalShares = shareholders.reduce((sum, s) => sum + (s.numberOfShares || 0), 0);

  const getTypeIcon = (type: string) => {
    const typeInfo = shareholderTypes.find(t => t.value === type);
    if (typeInfo) {
      const Icon = typeInfo.icon;
      return <Icon className="h-4 w-4" />;
    }
    return <User className="h-4 w-4" />;
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/governance">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-amber-800" data-testid="page-title">
                بيانات المساهمين
              </h1>
              <p className="text-gray-600">إدارة بيانات الملكية وسجل التحويلات</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingShareholder(null);
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-amber-600 hover:bg-amber-700" data-testid="btn-add-shareholder">
                <Plus className="h-4 w-4" />
                إضافة مساهم
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600">إجمالي المساهمين</p>
                  <p className="text-2xl font-bold text-amber-800">{shareholders.length}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">إجمالي الأسهم</p>
                  <p className="text-2xl font-bold text-blue-800">{totalShares.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">أفراد</p>
                  <p className="text-2xl font-bold text-green-800">
                    {shareholders.filter(s => s.shareholderType === 'individual').length}
                  </p>
                </div>
                <User className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600">شركات</p>
                  <p className="text-2xl font-bold text-purple-800">
                    {shareholders.filter(s => s.shareholderType === 'company').length}
                  </p>
                </div>
                <Building2 className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="بحث بالاسم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10 max-w-md"
            data-testid="search-input"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المساهم</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">عدد الأسهم</TableHead>
                  <TableHead className="text-right">نسبة الملكية</TableHead>
                  <TableHead className="text-right">فئة الأسهم</TableHead>
                  <TableHead className="text-right">تاريخ الاستحواذ</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      جاري التحميل...
                    </TableCell>
                  </TableRow>
                ) : filteredShareholders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      لا يوجد مساهمين
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredShareholders.map((shareholder) => (
                    <TableRow key={shareholder.id} data-testid={`shareholder-row-${shareholder.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{shareholder.fullName}</p>
                          <p className="text-sm text-gray-500">{shareholder.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(shareholder.shareholderType)}
                          <span>{shareholderTypes.find(t => t.value === shareholder.shareholderType)?.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {shareholder.numberOfShares?.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Percent className="h-3 w-3 text-gray-400" />
                            <span className="font-medium">{Number(shareholder.sharePercentage).toFixed(2)}%</span>
                          </div>
                          <Progress value={Number(shareholder.sharePercentage)} className="h-1" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {shareClasses.find(c => c.value === shareholder.shareClass)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{shareholder.acquisitionDate}</TableCell>
                      <TableCell>
                        <Badge className={shareholder.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {shareholder.status === 'active' ? 'نشط' : shareholder.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
