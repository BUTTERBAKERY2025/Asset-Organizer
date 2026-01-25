import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Building2, Heart, Ticket, Plus, Pencil, Trash2, Search, 
  Users, Calendar, DollarSign, Target, TrendingUp, Award,
  Handshake, Gift, Megaphone, RefreshCw
} from "lucide-react";
import type { BeneficiaryOrganization, SocialInitiative, CommunityDiscount } from "@shared/schema";

interface SocialResponsibilityStats {
  organizations: { total: number; active: number };
  initiatives: { total: number; active: number };
  discounts: { total: number; active: number };
  totalDiscountUsage: number;
}

const organizationTypes = [
  { value: "government", label: "جهة حكومية", icon: Building2 },
  { value: "charity", label: "جمعية خيرية", icon: Heart },
  { value: "ngo", label: "منظمة غير ربحية", icon: Users },
  { value: "club", label: "نادي/مؤسسة", icon: Award },
  { value: "educational", label: "مؤسسة تعليمية", icon: Target },
  { value: "healthcare", label: "قطاع صحي", icon: Heart },
  { value: "other", label: "أخرى", icon: Building2 },
];

const partnershipTypes = [
  { value: "discount", label: "خصم" },
  { value: "donation", label: "تبرع" },
  { value: "sponsorship", label: "رعاية" },
  { value: "collaboration", label: "تعاون" },
];

const initiativeTypes = [
  { value: "campaign", label: "حملة توعوية" },
  { value: "event", label: "فعالية" },
  { value: "donation", label: "تبرع" },
  { value: "sponsorship", label: "رعاية" },
  { value: "awareness", label: "توعية" },
  { value: "volunteering", label: "تطوع" },
];

const categories = [
  { value: "social", label: "اجتماعي" },
  { value: "environmental", label: "بيئي" },
  { value: "health", label: "صحي" },
  { value: "education", label: "تعليمي" },
  { value: "sports", label: "رياضي" },
  { value: "cultural", label: "ثقافي" },
];

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  suspended: "bg-red-100 text-red-800",
  planned: "bg-blue-100 text-blue-800",
  completed: "bg-purple-100 text-purple-800",
  cancelled: "bg-red-100 text-red-800",
  expired: "bg-orange-100 text-orange-800",
};

export default function SocialResponsibilityPage() {
  const [activeTab, setActiveTab] = useState("organizations");
  const [searchTerm, setSearchTerm] = useState("");
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [showInitiativeDialog, setShowInitiativeDialog] = useState(false);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<BeneficiaryOrganization | null>(null);
  const [selectedInitiative, setSelectedInitiative] = useState<SocialInitiative | null>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<CommunityDiscount | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Queries
  const { data: stats } = useQuery<SocialResponsibilityStats>({
    queryKey: ["/api/social-responsibility/stats"],
  });

  const { data: organizations = [], isLoading: loadingOrgs } = useQuery<BeneficiaryOrganization[]>({
    queryKey: ["/api/social-responsibility/organizations"],
  });

  const { data: initiatives = [], isLoading: loadingInitiatives } = useQuery<SocialInitiative[]>({
    queryKey: ["/api/social-responsibility/initiatives"],
  });

  const { data: discounts = [], isLoading: loadingDiscounts } = useQuery<CommunityDiscount[]>({
    queryKey: ["/api/social-responsibility/discounts"],
  });

  // Organization mutations
  const createOrgMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/social-responsibility/organizations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-responsibility/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/social-responsibility/stats"] });
      toast({ title: "تم إضافة الجهة بنجاح" });
      setShowOrgDialog(false);
      setSelectedOrg(null);
    },
    onError: () => toast({ title: "فشل في إضافة الجهة", variant: "destructive" }),
  });

  const updateOrgMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest("PUT", `/api/social-responsibility/organizations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-responsibility/organizations"] });
      toast({ title: "تم تحديث الجهة بنجاح" });
      setShowOrgDialog(false);
      setSelectedOrg(null);
    },
    onError: () => toast({ title: "فشل في تحديث الجهة", variant: "destructive" }),
  });

  const deleteOrgMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/social-responsibility/organizations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-responsibility/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/social-responsibility/stats"] });
      toast({ title: "تم حذف الجهة بنجاح" });
    },
    onError: () => toast({ title: "فشل في حذف الجهة", variant: "destructive" }),
  });

  // Initiative mutations
  const createInitiativeMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/social-responsibility/initiatives", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-responsibility/initiatives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/social-responsibility/stats"] });
      toast({ title: "تم إضافة المبادرة بنجاح" });
      setShowInitiativeDialog(false);
      setSelectedInitiative(null);
    },
    onError: () => toast({ title: "فشل في إضافة المبادرة", variant: "destructive" }),
  });

  const updateInitiativeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest("PUT", `/api/social-responsibility/initiatives/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-responsibility/initiatives"] });
      toast({ title: "تم تحديث المبادرة بنجاح" });
      setShowInitiativeDialog(false);
      setSelectedInitiative(null);
    },
    onError: () => toast({ title: "فشل في تحديث المبادرة", variant: "destructive" }),
  });

  const deleteInitiativeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/social-responsibility/initiatives/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-responsibility/initiatives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/social-responsibility/stats"] });
      toast({ title: "تم حذف المبادرة بنجاح" });
    },
    onError: () => toast({ title: "فشل في حذف المبادرة", variant: "destructive" }),
  });

  // Discount mutations
  const createDiscountMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/social-responsibility/discounts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-responsibility/discounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/social-responsibility/stats"] });
      toast({ title: "تم إضافة الخصم بنجاح" });
      setShowDiscountDialog(false);
      setSelectedDiscount(null);
    },
    onError: () => toast({ title: "فشل في إضافة الخصم", variant: "destructive" }),
  });

  const updateDiscountMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest("PUT", `/api/social-responsibility/discounts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-responsibility/discounts"] });
      toast({ title: "تم تحديث الخصم بنجاح" });
      setShowDiscountDialog(false);
      setSelectedDiscount(null);
    },
    onError: () => toast({ title: "فشل في تحديث الخصم", variant: "destructive" }),
  });

  const deleteDiscountMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/social-responsibility/discounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-responsibility/discounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/social-responsibility/stats"] });
      toast({ title: "تم حذف الخصم بنجاح" });
    },
    onError: () => toast({ title: "فشل في حذف الخصم", variant: "destructive" }),
  });

  // Form handlers
  const handleOrgSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    if (selectedOrg) {
      updateOrgMutation.mutate({ id: selectedOrg.id, data });
    } else {
      createOrgMutation.mutate(data);
    }
  };

  const handleInitiativeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    if (selectedInitiative) {
      updateInitiativeMutation.mutate({ id: selectedInitiative.id, data });
    } else {
      createInitiativeMutation.mutate(data);
    }
  };

  const handleDiscountSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    if (selectedDiscount) {
      updateDiscountMutation.mutate({ id: selectedDiscount.id, data });
    } else {
      createDiscountMutation.mutate(data);
    }
  };

  // Filter data based on search
  const filteredOrgs = organizations.filter(org => 
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredInitiatives = initiatives.filter(init => 
    init.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDiscounts = discounts.filter(disc => 
    disc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    disc.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Handshake className="h-8 w-8 text-amber-600" />
              المشاركات الاجتماعية والمسؤولية المجتمعية
            </h1>
            <p className="text-gray-600 mt-1">إدارة الجهات المستفيدة والمبادرات والخصومات المجتمعية</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">الجهات المستفيدة</p>
                  <p className="text-2xl font-bold text-blue-800" data-testid="stat-organizations-total">{stats?.organizations?.total || 0}</p>
                  <p className="text-xs text-blue-500">{stats?.organizations?.active || 0} نشطة</p>
                </div>
                <Building2 className="h-10 w-10 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">المبادرات</p>
                  <p className="text-2xl font-bold text-green-800" data-testid="stat-initiatives-total">{stats?.initiatives?.total || 0}</p>
                  <p className="text-xs text-green-500">{stats?.initiatives?.active || 0} جارية</p>
                </div>
                <Heart className="h-10 w-10 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600">الخصومات</p>
                  <p className="text-2xl font-bold text-purple-800" data-testid="stat-discounts-total">{stats?.discounts?.total || 0}</p>
                  <p className="text-xs text-purple-500">{stats?.discounts?.active || 0} فعالة</p>
                </div>
                <Ticket className="h-10 w-10 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600">استخدام الخصومات</p>
                  <p className="text-2xl font-bold text-amber-800" data-testid="stat-discount-usage">{stats?.totalDiscountUsage || 0}</p>
                  <p className="text-xs text-amber-500">مرة</p>
                </div>
                <TrendingUp className="h-10 w-10 text-amber-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="بحث..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
              data-testid="input-search"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="organizations" className="gap-2" data-testid="tab-organizations">
              <Building2 className="h-4 w-4" />
              الجهات المستفيدة
            </TabsTrigger>
            <TabsTrigger value="initiatives" className="gap-2" data-testid="tab-initiatives">
              <Heart className="h-4 w-4" />
              المبادرات
            </TabsTrigger>
            <TabsTrigger value="discounts" className="gap-2" data-testid="tab-discounts">
              <Ticket className="h-4 w-4" />
              الخصومات
            </TabsTrigger>
          </TabsList>

          {/* Organizations Tab */}
          <TabsContent value="organizations" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>الجهات المستفيدة</CardTitle>
                  <CardDescription>الهيئات الحكومية والجمعيات الخيرية والمؤسسات المجتمعية</CardDescription>
                </div>
                <Button onClick={() => { setSelectedOrg(null); setShowOrgDialog(true); }} className="gap-2" data-testid="button-add-organization">
                  <Plus className="h-4 w-4" />
                  إضافة جهة
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>اسم الجهة</TableHead>
                        <TableHead>النوع</TableHead>
                        <TableHead>نوع الشراكة</TableHead>
                        <TableHead>نسبة الخصم</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingOrgs ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                          </TableCell>
                        </TableRow>
                      ) : filteredOrgs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            لا توجد جهات مسجلة
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOrgs.map((org) => (
                          <TableRow key={org.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{org.name}</p>
                                {org.contactPerson && <p className="text-sm text-gray-500">{org.contactPerson}</p>}
                              </div>
                            </TableCell>
                            <TableCell>
                              {organizationTypes.find(t => t.value === org.organizationType)?.label || org.organizationType}
                            </TableCell>
                            <TableCell>
                              {partnershipTypes.find(t => t.value === org.partnershipType)?.label || org.partnershipType || "-"}
                            </TableCell>
                            <TableCell>{org.discountPercentage ? `${org.discountPercentage}%` : "-"}</TableCell>
                            <TableCell>
                              <Badge className={statusColors[org.status || "active"]}>
                                {org.status === "active" ? "نشط" : org.status === "inactive" ? "غير نشط" : "موقوف"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => { setSelectedOrg(org); setShowOrgDialog(true); }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500"
                                  onClick={() => deleteOrgMutation.mutate(org.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Initiatives Tab */}
          <TabsContent value="initiatives" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>المبادرات الاجتماعية</CardTitle>
                  <CardDescription>الحملات والفعاليات والأنشطة المجتمعية</CardDescription>
                </div>
                <Button onClick={() => { setSelectedInitiative(null); setShowInitiativeDialog(true); }} className="gap-2" data-testid="button-add-initiative">
                  <Plus className="h-4 w-4" />
                  إضافة مبادرة
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>عنوان المبادرة</TableHead>
                        <TableHead>النوع</TableHead>
                        <TableHead>الفترة</TableHead>
                        <TableHead>الميزانية</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingInitiatives ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                          </TableCell>
                        </TableRow>
                      ) : filteredInitiatives.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            لا توجد مبادرات مسجلة
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredInitiatives.map((init) => (
                          <TableRow key={init.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{init.title}</p>
                                {init.category && (
                                  <Badge variant="outline" className="text-xs">
                                    {categories.find(c => c.value === init.category)?.label}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {initiativeTypes.find(t => t.value === init.initiativeType)?.label || init.initiativeType}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {init.startDate && <p>من: {init.startDate}</p>}
                                {init.endDate && <p>إلى: {init.endDate}</p>}
                              </div>
                            </TableCell>
                            <TableCell>{init.budget ? `${Number(init.budget).toLocaleString()} ر.س` : "-"}</TableCell>
                            <TableCell>
                              <Badge className={statusColors[init.status || "planned"]}>
                                {init.status === "active" ? "جارية" : 
                                 init.status === "completed" ? "منتهية" : 
                                 init.status === "cancelled" ? "ملغية" : "مخططة"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => { setSelectedInitiative(init); setShowInitiativeDialog(true); }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500"
                                  onClick={() => deleteInitiativeMutation.mutate(init.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Discounts Tab */}
          <TabsContent value="discounts" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>الخصومات المجتمعية</CardTitle>
                  <CardDescription>رموز الخصم والعروض الخاصة للجهات المستفيدة</CardDescription>
                </div>
                <Button onClick={() => { setSelectedDiscount(null); setShowDiscountDialog(true); }} className="gap-2" data-testid="button-add-discount">
                  <Plus className="h-4 w-4" />
                  إضافة خصم
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>اسم الخصم</TableHead>
                        <TableHead>الرمز</TableHead>
                        <TableHead>القيمة</TableHead>
                        <TableHead>الصلاحية</TableHead>
                        <TableHead>الاستخدام</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingDiscounts ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                          </TableCell>
                        </TableRow>
                      ) : filteredDiscounts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                            لا توجد خصومات مسجلة
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredDiscounts.map((disc) => (
                          <TableRow key={disc.id}>
                            <TableCell className="font-medium">{disc.name}</TableCell>
                            <TableCell>
                              <code className="bg-gray-100 px-2 py-1 rounded text-sm">{disc.code}</code>
                            </TableCell>
                            <TableCell>
                              {disc.discountType === "percentage" 
                                ? `${disc.discountValue}%` 
                                : `${Number(disc.discountValue).toLocaleString()} ر.س`}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p>من: {disc.validFrom}</p>
                                <p>إلى: {disc.validTo}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {disc.usageCount || 0} / {disc.usageLimit || "∞"}
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[disc.status || "active"]}>
                                {disc.status === "active" ? "فعال" : 
                                 disc.status === "expired" ? "منتهي" : "غير فعال"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => { setSelectedDiscount(disc); setShowDiscountDialog(true); }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500"
                                  onClick={() => deleteDiscountMutation.mutate(disc.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Organization Dialog */}
        <Dialog open={showOrgDialog} onOpenChange={setShowOrgDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedOrg ? "تعديل الجهة" : "إضافة جهة جديدة"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleOrgSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>اسم الجهة *</Label>
                  <Input name="name" defaultValue={selectedOrg?.name} required />
                </div>
                <div>
                  <Label>نوع الجهة *</Label>
                  <Select name="organizationType" defaultValue={selectedOrg?.organizationType || "government"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {organizationTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>نوع الشراكة</Label>
                  <Select name="partnershipType" defaultValue={selectedOrg?.partnershipType || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر نوع الشراكة" />
                    </SelectTrigger>
                    <SelectContent>
                      {partnershipTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>نسبة الخصم %</Label>
                  <Input name="discountPercentage" type="number" step="0.01" min="0" max="100" defaultValue={selectedOrg?.discountPercentage || ""} />
                </div>
                <div>
                  <Label>الحالة</Label>
                  <Select name="status" defaultValue={selectedOrg?.status || "active"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">نشط</SelectItem>
                      <SelectItem value="inactive">غير نشط</SelectItem>
                      <SelectItem value="suspended">موقوف</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>اسم المسؤول</Label>
                  <Input name="contactPerson" defaultValue={selectedOrg?.contactPerson || ""} />
                </div>
                <div>
                  <Label>رقم الهاتف</Label>
                  <Input name="phone" defaultValue={selectedOrg?.phone || ""} />
                </div>
                <div>
                  <Label>البريد الإلكتروني</Label>
                  <Input name="email" type="email" defaultValue={selectedOrg?.email || ""} />
                </div>
                <div>
                  <Label>المدينة</Label>
                  <Input name="city" defaultValue={selectedOrg?.city || ""} />
                </div>
                <div className="col-span-2">
                  <Label>العنوان</Label>
                  <Input name="address" defaultValue={selectedOrg?.address || ""} />
                </div>
                <div className="col-span-2">
                  <Label>ملاحظات</Label>
                  <Textarea name="notes" defaultValue={selectedOrg?.notes || ""} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowOrgDialog(false)}>إلغاء</Button>
                <Button type="submit" disabled={createOrgMutation.isPending || updateOrgMutation.isPending}>
                  {selectedOrg ? "تحديث" : "إضافة"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Initiative Dialog */}
        <Dialog open={showInitiativeDialog} onOpenChange={setShowInitiativeDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedInitiative ? "تعديل المبادرة" : "إضافة مبادرة جديدة"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInitiativeSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>عنوان المبادرة *</Label>
                  <Input name="title" defaultValue={selectedInitiative?.title} required />
                </div>
                <div>
                  <Label>نوع المبادرة *</Label>
                  <Select name="initiativeType" defaultValue={selectedInitiative?.initiativeType || "campaign"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {initiativeTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>التصنيف</Label>
                  <Select name="category" defaultValue={selectedInitiative?.category || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر التصنيف" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>تاريخ البداية</Label>
                  <Input name="startDate" type="date" defaultValue={selectedInitiative?.startDate || ""} />
                </div>
                <div>
                  <Label>تاريخ النهاية</Label>
                  <Input name="endDate" type="date" defaultValue={selectedInitiative?.endDate || ""} />
                </div>
                <div>
                  <Label>الميزانية (ر.س)</Label>
                  <Input name="budget" type="number" step="0.01" defaultValue={selectedInitiative?.budget || ""} />
                </div>
                <div>
                  <Label>الحالة</Label>
                  <Select name="status" defaultValue={selectedInitiative?.status || "planned"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">مخططة</SelectItem>
                      <SelectItem value="active">جارية</SelectItem>
                      <SelectItem value="completed">منتهية</SelectItem>
                      <SelectItem value="cancelled">ملغية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الجهة المستفيدة</Label>
                  <Select name="beneficiaryOrganizationId" defaultValue={selectedInitiative?.beneficiaryOrganizationId?.toString() || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الجهة" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id.toString()}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>وصف المبادرة</Label>
                  <Textarea name="description" defaultValue={selectedInitiative?.description || ""} />
                </div>
                <div className="col-span-2">
                  <Label>الأهداف</Label>
                  <Textarea name="objectives" defaultValue={selectedInitiative?.objectives || ""} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowInitiativeDialog(false)}>إلغاء</Button>
                <Button type="submit" disabled={createInitiativeMutation.isPending || updateInitiativeMutation.isPending}>
                  {selectedInitiative ? "تحديث" : "إضافة"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Discount Dialog */}
        <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedDiscount ? "تعديل الخصم" : "إضافة خصم جديد"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleDiscountSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>اسم الخصم *</Label>
                  <Input name="name" defaultValue={selectedDiscount?.name} required />
                </div>
                <div>
                  <Label>رمز الخصم *</Label>
                  <Input name="code" defaultValue={selectedDiscount?.code} required placeholder="مثال: CHARITY10" />
                </div>
                <div>
                  <Label>نوع الخصم *</Label>
                  <Select name="discountType" defaultValue={selectedDiscount?.discountType || "percentage"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">نسبة مئوية</SelectItem>
                      <SelectItem value="fixed_amount">مبلغ ثابت</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>قيمة الخصم *</Label>
                  <Input name="discountValue" type="number" step="0.01" defaultValue={selectedDiscount?.discountValue || ""} required />
                </div>
                <div>
                  <Label>تاريخ البداية *</Label>
                  <Input name="validFrom" type="date" defaultValue={selectedDiscount?.validFrom || ""} required />
                </div>
                <div>
                  <Label>تاريخ النهاية *</Label>
                  <Input name="validTo" type="date" defaultValue={selectedDiscount?.validTo || ""} required />
                </div>
                <div>
                  <Label>الحد الأدنى للطلب (ر.س)</Label>
                  <Input name="minimumOrder" type="number" step="0.01" defaultValue={selectedDiscount?.minimumOrder || ""} />
                </div>
                <div>
                  <Label>الحد الأقصى للخصم (ر.س)</Label>
                  <Input name="maximumDiscount" type="number" step="0.01" defaultValue={selectedDiscount?.maximumDiscount || ""} />
                </div>
                <div>
                  <Label>عدد مرات الاستخدام</Label>
                  <Input name="usageLimit" type="number" defaultValue={selectedDiscount?.usageLimit || ""} placeholder="اتركه فارغاً لغير محدود" />
                </div>
                <div>
                  <Label>الحالة</Label>
                  <Select name="status" defaultValue={selectedDiscount?.status || "active"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">فعال</SelectItem>
                      <SelectItem value="inactive">غير فعال</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الجهة المستفيدة</Label>
                  <Select name="beneficiaryOrganizationId" defaultValue={selectedDiscount?.beneficiaryOrganizationId?.toString() || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الجهة" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id.toString()}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>وصف الخصم</Label>
                  <Textarea name="description" defaultValue={selectedDiscount?.description || ""} />
                </div>
                <div className="col-span-2">
                  <Label>الشروط والأحكام</Label>
                  <Textarea name="terms" defaultValue={selectedDiscount?.terms || ""} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDiscountDialog(false)}>إلغاء</Button>
                <Button type="submit" disabled={createDiscountMutation.isPending || updateDiscountMutation.isPending}>
                  {selectedDiscount ? "تحديث" : "إضافة"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
