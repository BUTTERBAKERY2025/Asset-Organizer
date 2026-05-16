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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { 
  Plane, Plus, Clock, CheckCircle, XCircle, 
  DollarSign, Calendar, MapPin, Building, User,
  FileText, Send, Eye
} from "lucide-react";

interface TravelRequest {
  id: number;
  branchId?: string;
  requestNumber?: string;
  requesterId?: string;
  requesterName?: string;
  requesterDepartment?: string;
  tripTitle: string;
  tripPurpose: string;
  tripType?: string;
  departureCity: string;
  destinationCity: string;
  destinationCountry?: string;
  departureDate: string;
  returnDate: string;
  tripDuration?: number;
  needsFlight?: boolean;
  needsHotel?: boolean;
  needsTransportation?: boolean;
  needsVisa?: boolean;
  estimatedFlightCost?: string;
  estimatedHotelCost?: string;
  estimatedTransportCost?: string;
  estimatedMealsCost?: string;
  estimatedOtherCost?: string;
  totalEstimatedCost?: string;
  currency?: string;
  status?: string;
  managerApproval?: string;
  financeApproval?: string;
  totalActualCost?: string;
  notes?: string;
  createdAt: string;
}

interface TravelStats {
  pendingRequests: number;
  approvedRequests: number;
  completedTrips: number;
  totalBudget: number;
  totalSpent: number;
}

const tripTypeLabels: Record<string, string> = {
  business: "عمل",
  training: "تدريب",
  conference: "مؤتمر",
  client_visit: "زيارة عميل",
  other: "أخرى",
};

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  pending: "في الانتظار",
  approved: "معتمد",
  rejected: "مرفوض",
  cancelled: "ملغي",
  completed: "مكتمل",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  pending: "bg-yellow-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
  cancelled: "bg-gray-400",
  completed: "bg-blue-500",
};

const approvalLabels: Record<string, string> = {
  pending: "في الانتظار",
  approved: "معتمد",
  rejected: "مرفوض",
};

export default function TravelRequestsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TravelRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery<TravelStats>({
    queryKey: ["/api/travel-stats"],
  });

  const { data: allRequests, isLoading: requestsLoading } = useQuery<TravelRequest[]>({
    queryKey: ["/api/travel-requests"],
  });

  const { data: myRequests } = useQuery<TravelRequest[]>({
    queryKey: ["/api/travel-requests/my"],
  });

  const createRequestMutation = useMutation({
    mutationFn: (data: Partial<TravelRequest>) => 
      apiRequest("POST", "/api/travel-requests", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/travel-stats"] });
      setIsCreateOpen(false);
      toast({ title: "تم إنشاء طلب السفر بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء طلب السفر", variant: "destructive" });
    },
  });

  const submitRequestMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest("POST", `/api/travel-requests/${id}/submit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/travel-stats"] });
      toast({ title: "تم تقديم طلب السفر للموافقة" });
    },
    onError: () => {
      toast({ title: "فشل في تقديم الطلب", variant: "destructive" });
    },
  });

  const approveManagerMutation = useMutation({
    mutationFn: ({ id, approved, notes }: { id: number; approved: boolean; notes?: string }) =>
      apiRequest("POST", `/api/travel-requests/${id}/manager-approval`, { approved, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/travel-stats"] });
      setIsDetailOpen(false);
      toast({ title: "تمت معالجة موافقة المدير" });
    },
    onError: () => {
      toast({ title: "فشل في معالجة الموافقة", variant: "destructive" });
    },
  });

  const approveFinanceMutation = useMutation({
    mutationFn: ({ id, approved, notes }: { id: number; approved: boolean; notes?: string }) =>
      apiRequest("POST", `/api/travel-requests/${id}/finance-approval`, { approved, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/travel-stats"] });
      setIsDetailOpen(false);
      toast({ title: "تمت معالجة موافقة المالية" });
    },
    onError: () => {
      toast({ title: "فشل في معالجة الموافقة", variant: "destructive" });
    },
  });

  const handleCreateRequest = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const estimatedFlightCost = formData.get("estimatedFlightCost") as string || "0";
    const estimatedHotelCost = formData.get("estimatedHotelCost") as string || "0";
    const estimatedTransportCost = formData.get("estimatedTransportCost") as string || "0";
    const estimatedMealsCost = formData.get("estimatedMealsCost") as string || "0";
    const estimatedOtherCost = formData.get("estimatedOtherCost") as string || "0";
    
    const totalEstimatedCost = (
      parseFloat(estimatedFlightCost) +
      parseFloat(estimatedHotelCost) +
      parseFloat(estimatedTransportCost) +
      parseFloat(estimatedMealsCost) +
      parseFloat(estimatedOtherCost)
    ).toString();

    createRequestMutation.mutate({
      tripTitle: formData.get("tripTitle") as string,
      tripPurpose: formData.get("tripPurpose") as string,
      tripType: formData.get("tripType") as string,
      departureCity: formData.get("departureCity") as string,
      destinationCity: formData.get("destinationCity") as string,
      destinationCountry: formData.get("destinationCountry") as string,
      departureDate: formData.get("departureDate") as string,
      returnDate: formData.get("returnDate") as string,
      needsFlight: formData.get("needsFlight") === "on",
      needsHotel: formData.get("needsHotel") === "on",
      needsTransportation: formData.get("needsTransportation") === "on",
      needsVisa: formData.get("needsVisa") === "on",
      estimatedFlightCost,
      estimatedHotelCost,
      estimatedTransportCost,
      estimatedMealsCost,
      estimatedOtherCost,
      totalEstimatedCost,
      notes: formData.get("notes") as string,
    });
  };

  const filteredRequests = activeTab === "my" ? myRequests : 
    activeTab === "pending" ? allRequests?.filter(r => r.status === "pending") :
    allRequests;

  if (statsLoading) {
    return (
      <Layout>
        <div className="max-w-screen-2xl mx-auto p-4 md:p-8 lg:p-10 space-y-4" dir="rtl">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
    <div className="max-w-screen-2xl mx-auto p-3 sm:p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-amber-800" data-testid="page-title">
            إدارة السفر والحجوزات
          </h1>
          <p className="text-xs sm:text-sm text-gray-600">إدارة طلبات السفر والميزانيات</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="btn-new-request">
              <Plus className="h-4 w-4" />
              طلب سفر جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>طلب سفر جديد</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="tripTitle">عنوان الرحلة *</Label>
                  <Input id="tripTitle" name="tripTitle" required data-testid="input-title" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="tripPurpose">الغرض من السفر *</Label>
                  <Textarea id="tripPurpose" name="tripPurpose" required data-testid="input-purpose" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tripType">نوع الرحلة</Label>
                  <Select name="tripType" defaultValue="business">
                    <SelectTrigger data-testid="select-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(tripTypeLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-4">تفاصيل الرحلة</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="departureCity">مدينة المغادرة *</Label>
                    <Input id="departureCity" name="departureCity" required data-testid="input-departure" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="destinationCity">مدينة الوصول *</Label>
                    <Input id="destinationCity" name="destinationCity" required data-testid="input-destination" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="destinationCountry">الدولة</Label>
                    <Input id="destinationCountry" name="destinationCountry" data-testid="input-country" />
                  </div>
                  <div></div>
                  <div className="space-y-2">
                    <Label htmlFor="departureDate">تاريخ المغادرة *</Label>
                    <Input id="departureDate" name="departureDate" type="date" required data-testid="input-dep-date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="returnDate">تاريخ العودة *</Label>
                    <Input id="returnDate" name="returnDate" type="date" required data-testid="input-ret-date" />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-4">الاحتياجات</h3>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <Checkbox name="needsFlight" defaultChecked />
                    <span>حجز طيران</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox name="needsHotel" defaultChecked />
                    <span>حجز فندق</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox name="needsTransportation" />
                    <span>مواصلات</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox name="needsVisa" />
                    <span>تأشيرة</span>
                  </label>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-4">الميزانية التقديرية (ريال)</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="estimatedFlightCost">الطيران</Label>
                    <Input id="estimatedFlightCost" name="estimatedFlightCost" type="number" defaultValue="0" data-testid="input-flight-cost" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimatedHotelCost">الفندق</Label>
                    <Input id="estimatedHotelCost" name="estimatedHotelCost" type="number" defaultValue="0" data-testid="input-hotel-cost" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimatedTransportCost">المواصلات</Label>
                    <Input id="estimatedTransportCost" name="estimatedTransportCost" type="number" defaultValue="0" data-testid="input-transport-cost" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimatedMealsCost">الوجبات</Label>
                    <Input id="estimatedMealsCost" name="estimatedMealsCost" type="number" defaultValue="0" data-testid="input-meals-cost" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimatedOtherCost">أخرى</Label>
                    <Input id="estimatedOtherCost" name="estimatedOtherCost" type="number" defaultValue="0" data-testid="input-other-cost" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea id="notes" name="notes" data-testid="input-notes" />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={createRequestMutation.isPending} data-testid="btn-submit">
                  {createRequestMutation.isPending ? "جاري الحفظ..." : "حفظ كمسودة"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
        <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm md:text-lg">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              قيد الانتظار
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl md:text-4xl font-bold" data-testid="stat-pending">
              {stats?.pendingRequests || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm md:text-lg">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              معتمدة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl md:text-4xl font-bold" data-testid="stat-approved">
              {stats?.approvedRequests || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm md:text-lg">
              <Plane className="h-4 w-4 sm:h-5 sm:w-5" />
              مكتملة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl md:text-4xl font-bold" data-testid="stat-completed">
              {stats?.completedTrips || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm md:text-lg">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
              الميزانية
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-sm sm:text-lg md:text-2xl font-bold" data-testid="stat-budget">
              {(stats?.totalBudget || 0).toLocaleString()} ر.س
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white col-span-2 lg:col-span-1">
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm md:text-lg">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
              المصروف
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-sm sm:text-lg md:text-2xl font-bold" data-testid="stat-spent">
              {(stats?.totalSpent || 0).toLocaleString()} ر.س
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 w-full flex-wrap h-auto p-1 overflow-x-auto">
          <TabsTrigger value="all" className="gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm" data-testid="tab-all">
            <Plane className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">جميع الطلبات</span>
            <span className="sm:hidden">الكل</span>
          </TabsTrigger>
          <TabsTrigger value="my" className="gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm" data-testid="tab-my">
            <User className="h-3 w-3 sm:h-4 sm:w-4" />
            طلباتي
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm" data-testid="tab-pending">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">بانتظار الموافقة</span>
            <span className="sm:hidden">انتظار</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle>
                {activeTab === "my" ? "طلبات السفر الخاصة بي" : 
                 activeTab === "pending" ? "طلبات بانتظار الموافقة" : 
                 "جميع طلبات السفر"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : filteredRequests && filteredRequests.length > 0 ? (
                <div className="space-y-4">
                  {filteredRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      data-testid={`request-${request.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                          <Plane className="h-6 w-6 text-amber-600" />
                        </div>
                        <div>
                          <div className="font-medium">{request.tripTitle}</div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {request.departureCity} → {request.destinationCity}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(request.departureDate), "yyyy/MM/dd")}
                            </span>
                            {request.tripDuration && (
                              <span>{request.tripDuration} يوم</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {request.requestNumber} | {request.requesterName}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-left">
                          <div className="font-medium">
                            {parseFloat(request.totalEstimatedCost || "0").toLocaleString()} ر.س
                          </div>
                          <div className="flex gap-2 mt-1">
                            <Badge className={statusColors[request.status || "draft"]}>
                              {statusLabels[request.status || "draft"]}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {request.status === "draft" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => submitRequestMutation.mutate(request.id)}
                              disabled={submitRequestMutation.isPending}
                              data-testid={`btn-submit-${request.id}`}
                            >
                              <Send className="h-4 w-4" />
                              تقديم
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setSelectedRequest(request);
                              setIsDetailOpen(true);
                            }}
                            data-testid={`btn-view-${request.id}`}
                          >
                            <Eye className="h-4 w-4" />
                            عرض
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Plane className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد طلبات سفر</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل طلب السفر</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold">{selectedRequest.tripTitle}</h3>
                  <p className="text-gray-500">{selectedRequest.requestNumber}</p>
                </div>
                <Badge className={statusColors[selectedRequest.status || "draft"]}>
                  {statusLabels[selectedRequest.status || "draft"]}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500">مقدم الطلب</div>
                  <div className="font-medium">{selectedRequest.requesterName}</div>
                  <div className="text-sm">{selectedRequest.requesterDepartment}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500">نوع الرحلة</div>
                  <div className="font-medium">{tripTypeLabels[selectedRequest.tripType || "business"]}</div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-5 w-5 text-amber-600" />
                  <span className="font-medium">تفاصيل الرحلة</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">من</div>
                    <div>{selectedRequest.departureCity}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">إلى</div>
                    <div>{selectedRequest.destinationCity} {selectedRequest.destinationCountry && `(${selectedRequest.destinationCountry})`}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">تاريخ المغادرة</div>
                    <div>{format(new Date(selectedRequest.departureDate), "yyyy/MM/dd", { locale: ar })}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">تاريخ العودة</div>
                    <div>{format(new Date(selectedRequest.returnDate), "yyyy/MM/dd", { locale: ar })}</div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-medium mb-2">الغرض من السفر</div>
                <p>{selectedRequest.tripPurpose}</p>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <span className="font-medium">الميزانية التقديرية</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">الطيران</div>
                    <div>{parseFloat(selectedRequest.estimatedFlightCost || "0").toLocaleString()} ر.س</div>
                  </div>
                  <div>
                    <div className="text-gray-500">الفندق</div>
                    <div>{parseFloat(selectedRequest.estimatedHotelCost || "0").toLocaleString()} ر.س</div>
                  </div>
                  <div>
                    <div className="text-gray-500">المواصلات</div>
                    <div>{parseFloat(selectedRequest.estimatedTransportCost || "0").toLocaleString()} ر.س</div>
                  </div>
                  <div>
                    <div className="text-gray-500">الوجبات</div>
                    <div>{parseFloat(selectedRequest.estimatedMealsCost || "0").toLocaleString()} ر.س</div>
                  </div>
                  <div>
                    <div className="text-gray-500">أخرى</div>
                    <div>{parseFloat(selectedRequest.estimatedOtherCost || "0").toLocaleString()} ر.س</div>
                  </div>
                  <div className="font-bold">
                    <div className="text-gray-500">الإجمالي</div>
                    <div>{parseFloat(selectedRequest.totalEstimatedCost || "0").toLocaleString()} ر.س</div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="font-medium mb-2">حالة الموافقات</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      selectedRequest.managerApproval === "approved" ? "bg-green-500" :
                      selectedRequest.managerApproval === "rejected" ? "bg-red-500" : "bg-yellow-500"
                    }`} />
                    <span>موافقة المدير: {approvalLabels[selectedRequest.managerApproval || "pending"]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      selectedRequest.financeApproval === "approved" ? "bg-green-500" :
                      selectedRequest.financeApproval === "rejected" ? "bg-red-500" : "bg-yellow-500"
                    }`} />
                    <span>موافقة المالية: {approvalLabels[selectedRequest.financeApproval || "pending"]}</span>
                  </div>
                </div>
              </div>

              {selectedRequest.status === "pending" && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  {selectedRequest.managerApproval === "pending" && (
                    <>
                      <Button
                        variant="destructive"
                        onClick={() => approveManagerMutation.mutate({ id: selectedRequest.id, approved: false })}
                        disabled={approveManagerMutation.isPending}
                        data-testid="btn-manager-reject"
                      >
                        <XCircle className="h-4 w-4 ml-1" />
                        رفض (مدير)
                      </Button>
                      <Button
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => approveManagerMutation.mutate({ id: selectedRequest.id, approved: true })}
                        disabled={approveManagerMutation.isPending}
                        data-testid="btn-manager-approve"
                      >
                        <CheckCircle className="h-4 w-4 ml-1" />
                        موافقة (مدير)
                      </Button>
                    </>
                  )}
                  {selectedRequest.managerApproval === "approved" && selectedRequest.financeApproval === "pending" && (
                    <>
                      <Button
                        variant="destructive"
                        onClick={() => approveFinanceMutation.mutate({ id: selectedRequest.id, approved: false })}
                        disabled={approveFinanceMutation.isPending}
                        data-testid="btn-finance-reject"
                      >
                        <XCircle className="h-4 w-4 ml-1" />
                        رفض (مالية)
                      </Button>
                      <Button
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => approveFinanceMutation.mutate({ id: selectedRequest.id, approved: true })}
                        disabled={approveFinanceMutation.isPending}
                        data-testid="btn-finance-approve"
                      >
                        <CheckCircle className="h-4 w-4 ml-1" />
                        موافقة (مالية)
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </Layout>
  );
}
