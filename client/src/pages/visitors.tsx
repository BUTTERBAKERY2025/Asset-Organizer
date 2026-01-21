import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { 
  Users, UserPlus, Search, Clock, LogIn, LogOut, 
  AlertTriangle, Building, Phone, Mail, IdCard,
  Shield, Printer, CalendarDays
} from "lucide-react";

interface Visitor {
  id: number;
  branchId?: string;
  fullName: string;
  nationalId?: string;
  phone?: string;
  email?: string;
  company?: string;
  nationality?: string;
  idType?: string;
  photoUrl?: string;
  notes?: string;
  isBlacklisted?: boolean;
  blacklistReason?: string;
  visitCount?: number;
  lastVisitAt?: string;
  createdAt: string;
}

interface VisitorLog {
  id: number;
  branchId?: string;
  visitorId?: number;
  visitNumber?: string;
  visitDate: string;
  visitPurpose: string;
  visitType?: string;
  hostId?: string;
  hostName?: string;
  hostDepartment?: string;
  checkInTime?: string;
  checkOutTime?: string;
  expectedDuration?: number;
  actualDuration?: number;
  status?: string;
  badgeNumber?: string;
  badgeIssued?: boolean;
  badgeReturned?: boolean;
  vehiclePlate?: string;
  itemsCarried?: string;
  notes?: string;
  registeredByName?: string;
}

interface VisitorStats {
  todayVisitors: number;
  activeVisitors: number;
  totalVisitors: number;
  blacklistedCount: number;
}

const visitTypeLabels: Record<string, string> = {
  business: "عمل",
  personal: "شخصي",
  delivery: "توصيل",
  interview: "مقابلة",
  meeting: "اجتماع",
  other: "أخرى",
};

const statusLabels: Record<string, string> = {
  pending: "في الانتظار",
  checked_in: "داخل المبنى",
  checked_out: "غادر",
  cancelled: "ملغي",
  no_show: "لم يحضر",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500",
  checked_in: "bg-green-500",
  checked_out: "bg-gray-500",
  cancelled: "bg-red-500",
  no_show: "bg-orange-500",
};

export default function VisitorsPage() {
  const [activeTab, setActiveTab] = useState("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddVisitorOpen, setIsAddVisitorOpen] = useState(false);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery<VisitorStats>({
    queryKey: ["/api/visitor-stats"],
  });

  const { data: activeLogs, isLoading: activeLoading } = useQuery<VisitorLog[]>({
    queryKey: ["/api/visitor-logs/active"],
    enabled: activeTab === "active",
  });

  const { data: allLogs, isLoading: logsLoading } = useQuery<VisitorLog[]>({
    queryKey: ["/api/visitor-logs"],
    enabled: activeTab === "logs",
  });

  const { data: visitors, isLoading: visitorsLoading } = useQuery<Visitor[]>({
    queryKey: ["/api/visitors"],
    enabled: activeTab === "visitors",
  });

  const { data: blacklist, isLoading: blacklistLoading } = useQuery<Visitor[]>({
    queryKey: ["/api/visitors/blacklist"],
    enabled: activeTab === "blacklist",
  });

  const { data: searchResults } = useQuery<Visitor[]>({
    queryKey: ["/api/visitors/search", searchQuery],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/visitors/search?q=${encodeURIComponent(searchQuery)}`);
      return res.json();
    },
    enabled: searchQuery.length > 2,
  });

  const createVisitorMutation = useMutation({
    mutationFn: (data: Partial<Visitor>) => apiRequest("POST", "/api/visitors", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visitors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/visitor-stats"] });
      setIsAddVisitorOpen(false);
      toast({ title: "تم إنشاء الزائر بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء الزائر", variant: "destructive" });
    },
  });

  const checkInMutation = useMutation({
    mutationFn: (data: Partial<VisitorLog>) => apiRequest("POST", "/api/visitor-logs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visitor-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/visitor-stats"] });
      setIsCheckInOpen(false);
      setSelectedVisitor(null);
      toast({ title: "تم تسجيل دخول الزائر بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في تسجيل الدخول", variant: "destructive" });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/visitor-logs/${id}/checkout`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visitor-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/visitor-stats"] });
      toast({ title: "تم تسجيل خروج الزائر بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في تسجيل الخروج", variant: "destructive" });
    },
  });

  const handleAddVisitor = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createVisitorMutation.mutate({
      fullName: formData.get("fullName") as string,
      nationalId: formData.get("nationalId") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      company: formData.get("company") as string,
      nationality: formData.get("nationality") as string,
      idType: formData.get("idType") as string,
      notes: formData.get("notes") as string,
    });
  };

  const handleCheckIn = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    checkInMutation.mutate({
      visitorId: selectedVisitor?.id,
      visitPurpose: formData.get("visitPurpose") as string,
      visitType: formData.get("visitType") as string,
      hostName: formData.get("hostName") as string,
      hostDepartment: formData.get("hostDepartment") as string,
      badgeNumber: formData.get("badgeNumber") as string,
      vehiclePlate: formData.get("vehiclePlate") as string,
      notes: formData.get("notes") as string,
    });
  };

  const openCheckInDialog = (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    setIsCheckInOpen(true);
  };

  if (statsLoading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-10 space-y-4" dir="rtl">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
    <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-10 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-amber-800" data-testid="page-title">
            سجل الزوار
          </h1>
          <p className="text-gray-600">إدارة تسجيل دخول وخروج الزوار</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddVisitorOpen} onOpenChange={setIsAddVisitorOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="btn-add-visitor">
                <UserPlus className="h-4 w-4" />
                إضافة زائر جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة زائر جديد</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddVisitor} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">الاسم الكامل *</Label>
                  <Input id="fullName" name="fullName" required data-testid="input-fullname" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nationalId">رقم الهوية</Label>
                    <Input id="nationalId" name="nationalId" data-testid="input-nationalid" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="idType">نوع الهوية</Label>
                    <Select name="idType" defaultValue="national_id">
                      <SelectTrigger data-testid="select-idtype">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="national_id">هوية وطنية</SelectItem>
                        <SelectItem value="passport">جواز سفر</SelectItem>
                        <SelectItem value="iqama">إقامة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">رقم الهاتف</Label>
                    <Input id="phone" name="phone" type="tel" data-testid="input-phone" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <Input id="email" name="email" type="email" data-testid="input-email" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">الجهة / الشركة</Label>
                    <Input id="company" name="company" data-testid="input-company" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nationality">الجنسية</Label>
                    <Input id="nationality" name="nationality" data-testid="input-nationality" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">ملاحظات</Label>
                  <Textarea id="notes" name="notes" data-testid="input-notes" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddVisitorOpen(false)}>
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={createVisitorMutation.isPending} data-testid="btn-submit-visitor">
                    {createVisitorMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5" />
              زوار اليوم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold" data-testid="stat-today">
              {stats?.todayVisitors || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              داخل المبنى الآن
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold" data-testid="stat-active">
              {stats?.activeVisitors || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <IdCard className="h-5 w-5" />
              إجمالي الزوار
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold" data-testid="stat-total">
              {stats?.totalVisitors || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              القائمة السوداء
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold" data-testid="stat-blacklisted">
              {stats?.blacklistedCount || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="بحث بالاسم، رقم الهوية، أو رقم الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
            data-testid="input-search"
          />
        </div>
        {searchResults && searchResults.length > 0 && (
          <div className="absolute z-10 mt-32 bg-white border rounded-lg shadow-lg p-2 w-96">
            {searchResults.map((visitor) => (
              <div
                key={visitor.id}
                className="p-2 hover:bg-gray-100 rounded cursor-pointer flex justify-between items-center"
                onClick={() => openCheckInDialog(visitor)}
              >
                <div>
                  <div className="font-medium">{visitor.fullName}</div>
                  <div className="text-sm text-gray-500">{visitor.company}</div>
                </div>
                <Button size="sm" variant="outline" className="gap-1">
                  <LogIn className="h-3 w-3" />
                  تسجيل دخول
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="active" className="gap-2" data-testid="tab-active">
            <Users className="h-4 w-4" />
            الزوار الحاليون ({stats?.activeVisitors || 0})
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2" data-testid="tab-logs">
            <Clock className="h-4 w-4" />
            سجل الزيارات
          </TabsTrigger>
          <TabsTrigger value="visitors" className="gap-2" data-testid="tab-visitors">
            <IdCard className="h-4 w-4" />
            قائمة الزوار
          </TabsTrigger>
          <TabsTrigger value="blacklist" className="gap-2" data-testid="tab-blacklist">
            <AlertTriangle className="h-4 w-4" />
            القائمة السوداء
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>الزوار داخل المبنى حالياً</CardTitle>
            </CardHeader>
            <CardContent>
              {activeLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : activeLogs && activeLogs.length > 0 ? (
                <div className="space-y-4">
                  {activeLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      data-testid={`visitor-log-${log.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                          <Users className="h-6 w-6 text-amber-600" />
                        </div>
                        <div>
                          <div className="font-medium">{log.visitNumber}</div>
                          <div className="text-sm text-gray-500">{log.visitPurpose}</div>
                          <div className="text-xs text-gray-400">
                            المضيف: {log.hostName || "-"} | القسم: {log.hostDepartment || "-"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-left">
                          <div className="text-sm">
                            دخول: {log.checkInTime ? format(new Date(log.checkInTime), "HH:mm", { locale: ar }) : "-"}
                          </div>
                          {log.badgeNumber && (
                            <Badge variant="outline">بطاقة: {log.badgeNumber}</Badge>
                          )}
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-1"
                          onClick={() => checkOutMutation.mutate(log.id)}
                          disabled={checkOutMutation.isPending}
                          data-testid={`btn-checkout-${log.id}`}
                        >
                          <LogOut className="h-4 w-4" />
                          تسجيل خروج
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا يوجد زوار داخل المبنى حالياً</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>سجل جميع الزيارات</CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : allLogs && allLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2">رقم الزيارة</th>
                        <th className="p-2">التاريخ</th>
                        <th className="p-2">الغرض</th>
                        <th className="p-2">المضيف</th>
                        <th className="p-2">الدخول</th>
                        <th className="p-2">الخروج</th>
                        <th className="p-2">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allLogs.map((log) => (
                        <tr key={log.id} className="border-b hover:bg-gray-50" data-testid={`log-row-${log.id}`}>
                          <td className="p-2 font-mono text-sm">{log.visitNumber}</td>
                          <td className="p-2">
                            {format(new Date(log.visitDate), "yyyy/MM/dd", { locale: ar })}
                          </td>
                          <td className="p-2">{log.visitPurpose}</td>
                          <td className="p-2">{log.hostName || "-"}</td>
                          <td className="p-2">
                            {log.checkInTime ? format(new Date(log.checkInTime), "HH:mm") : "-"}
                          </td>
                          <td className="p-2">
                            {log.checkOutTime ? format(new Date(log.checkOutTime), "HH:mm") : "-"}
                          </td>
                          <td className="p-2">
                            <Badge className={statusColors[log.status || "pending"]}>
                              {statusLabels[log.status || "pending"]}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد زيارات مسجلة</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visitors">
          <Card>
            <CardHeader>
              <CardTitle>قائمة الزوار المسجلين</CardTitle>
            </CardHeader>
            <CardContent>
              {visitorsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : visitors && visitors.length > 0 ? (
                <div className="space-y-4">
                  {visitors.map((visitor) => (
                    <div
                      key={visitor.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      data-testid={`visitor-${visitor.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                          <Users className="h-6 w-6 text-amber-600" />
                        </div>
                        <div>
                          <div className="font-medium">{visitor.fullName}</div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            {visitor.company && (
                              <span className="flex items-center gap-1">
                                <Building className="h-3 w-3" />
                                {visitor.company}
                              </span>
                            )}
                            {visitor.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {visitor.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-left text-sm">
                          <div>زيارات: {visitor.visitCount || 0}</div>
                          {visitor.lastVisitAt && (
                            <div className="text-gray-500">
                              آخر زيارة: {format(new Date(visitor.lastVisitAt), "yyyy/MM/dd")}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => openCheckInDialog(visitor)}
                          data-testid={`btn-checkin-${visitor.id}`}
                        >
                          <LogIn className="h-4 w-4" />
                          تسجيل دخول
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <IdCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا يوجد زوار مسجلين</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blacklist">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                القائمة السوداء
              </CardTitle>
            </CardHeader>
            <CardContent>
              {blacklistLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : blacklist && blacklist.length > 0 ? (
                <div className="space-y-4">
                  {blacklist.map((visitor) => (
                    <div
                      key={visitor.id}
                      className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg"
                      data-testid={`blacklisted-${visitor.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                          <AlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                          <div className="font-medium">{visitor.fullName}</div>
                          <div className="text-sm text-red-600">
                            السبب: {visitor.blacklistReason || "غير محدد"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>القائمة السوداء فارغة</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تسجيل دخول زائر</DialogTitle>
          </DialogHeader>
          {selectedVisitor && (
            <div className="mb-4 p-4 bg-amber-50 rounded-lg">
              <div className="font-medium">{selectedVisitor.fullName}</div>
              <div className="text-sm text-gray-500">
                {selectedVisitor.company} | {selectedVisitor.phone}
              </div>
            </div>
          )}
          <form onSubmit={handleCheckIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="visitPurpose">غرض الزيارة *</Label>
              <Input id="visitPurpose" name="visitPurpose" required data-testid="input-purpose" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="visitType">نوع الزيارة</Label>
                <Select name="visitType" defaultValue="business">
                  <SelectTrigger data-testid="select-visittype">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(visitTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="badgeNumber">رقم البطاقة</Label>
                <Input id="badgeNumber" name="badgeNumber" data-testid="input-badge" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hostName">اسم المضيف</Label>
                <Input id="hostName" name="hostName" data-testid="input-hostname" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hostDepartment">القسم</Label>
                <Input id="hostDepartment" name="hostDepartment" data-testid="input-department" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehiclePlate">لوحة السيارة</Label>
              <Input id="vehiclePlate" name="vehiclePlate" data-testid="input-vehicle" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea id="notes" name="notes" data-testid="input-checkin-notes" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCheckInOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={checkInMutation.isPending} data-testid="btn-submit-checkin">
                {checkInMutation.isPending ? "جاري التسجيل..." : "تسجيل الدخول"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </Layout>
  );
}
