import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Mail, Plus, ArrowRight, Search, Filter, Edit, Trash2, Inbox, Send, Lock, Calendar, User, FileText, Eye } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Layout } from "@/components/layout";

interface Correspondence {
  id: number;
  refNumber: string;
  type: string;
  subject: string;
  subjectEn?: string;
  content?: string;
  branchId?: string;
  priority: string;
  status: string;
  category?: string;
  senderName?: string;
  senderOrg?: string;
  senderContact?: string;
  recipientName?: string;
  recipientOrg?: string;
  recipientContact?: string;
  ownerId?: string;
  ownerName?: string;
  assignedTo?: string;
  assignedToName?: string;
  isConfidential: boolean;
  receivedAt?: string;
  sentAt?: string;
  dueDate?: string;
  responseRequired: boolean;
  createdAt: string;
}

const priorities = [
  { value: "urgent", label: "عاجل", labelEn: "Urgent" },
  { value: "high", label: "مرتفع", labelEn: "High" },
  { value: "normal", label: "عادي", labelEn: "Normal" },
  { value: "low", label: "منخفض", labelEn: "Low" },
];

const statuses = [
  { value: "received", label: "مستلم", labelEn: "Received" },
  { value: "in_review", label: "قيد المراجعة", labelEn: "In Review" },
  { value: "pending_response", label: "بانتظار الرد", labelEn: "Pending Response" },
  { value: "responded", label: "تم الرد", labelEn: "Responded" },
  { value: "archived", label: "مؤرشف", labelEn: "Archived" },
  { value: "draft", label: "مسودة", labelEn: "Draft" },
  { value: "sent", label: "مرسل", labelEn: "Sent" },
];

const categories = [
  { value: "official", label: "رسمي", labelEn: "Official" },
  { value: "internal", label: "داخلي", labelEn: "Internal" },
  { value: "external", label: "خارجي", labelEn: "External" },
  { value: "complaint", label: "شكوى", labelEn: "Complaint" },
  { value: "request", label: "طلب", labelEn: "Request" },
  { value: "report", label: "تقرير", labelEn: "Report" },
  { value: "notification", label: "إشعار", labelEn: "Notification" },
];

interface User {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

export default function ExecutiveCorrespondence() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCorr, setSelectedCorr] = useState<Correspondence | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("incoming");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: correspondence = [], isLoading } = useQuery<Correspondence[]>({
    queryKey: ["/api/executive/correspondence"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Correspondence>) => {
      return await apiRequest("POST", "/api/executive/correspondence", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/executive/correspondence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executive/dashboard"] });
      toast({ title: "تم إنشاء المراسلة بنجاح" });
      setIsDialogOpen(false);
      setSelectedCorr(null);
    },
    onError: () => {
      toast({ title: "فشل في إنشاء المراسلة", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Correspondence> }) => {
      return await apiRequest("PUT", `/api/executive/correspondence/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/executive/correspondence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executive/dashboard"] });
      toast({ title: "تم تحديث المراسلة بنجاح" });
      setIsDialogOpen(false);
      setSelectedCorr(null);
    },
    onError: () => {
      toast({ title: "فشل في تحديث المراسلة", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/executive/correspondence/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/executive/correspondence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executive/dashboard"] });
      toast({ title: "تم حذف المراسلة بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في حذف المراسلة", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const assignedTo = formData.get("assignedTo") as string;
    const assignedUser = users.find((u) => u.id === assignedTo);
    
    const data = {
      type: activeTab === "incoming" ? "incoming" : "outgoing",
      subject: formData.get("subject") as string,
      subjectEn: formData.get("subjectEn") as string,
      content: formData.get("content") as string,
      priority: formData.get("priority") as string,
      status: formData.get("status") as string || (activeTab === "incoming" ? "received" : "draft"),
      category: formData.get("category") as string,
      senderName: formData.get("senderName") as string,
      senderOrg: formData.get("senderOrg") as string,
      senderContact: formData.get("senderContact") as string,
      recipientName: formData.get("recipientName") as string,
      recipientOrg: formData.get("recipientOrg") as string,
      recipientContact: formData.get("recipientContact") as string,
      assignedTo: assignedTo || undefined,
      assignedToName: assignedUser ? `${assignedUser.firstName || ""} ${assignedUser.lastName || ""}`.trim() || assignedUser.username : undefined,
      isConfidential: formData.get("isConfidential") === "on",
      responseRequired: formData.get("responseRequired") === "on",
      dueDate: formData.get("dueDate") as string || undefined,
    };

    if (selectedCorr) {
      updateMutation.mutate({ id: selectedCorr.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const incomingCorr = correspondence.filter((c) => c.type === "incoming");
  const outgoingCorr = correspondence.filter((c) => c.type === "outgoing");

  const filteredCorr = (activeTab === "incoming" ? incomingCorr : outgoingCorr).filter((corr) => {
    const matchesSearch =
      corr.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      corr.refNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      corr.senderName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      corr.recipientName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || corr.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getPriorityBadge = (priority: string) => {
    const priorityInfo = priorities.find((p) => p.value === priority);
    const colors: Record<string, string> = {
      urgent: "bg-red-500 text-white",
      high: "bg-orange-500 text-white",
      normal: "bg-blue-500 text-white",
      low: "bg-gray-500 text-white",
    };
    return (
      <Badge className={`${colors[priority] || "bg-gray-500"} text-[10px] sm:text-xs px-1.5 sm:px-2`}>
        {priorityInfo?.label || priority}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = statuses.find((s) => s.value === status);
    const colors: Record<string, string> = {
      received: "bg-yellow-500 text-white",
      in_review: "bg-blue-500 text-white",
      pending_response: "bg-orange-500 text-white",
      responded: "bg-green-500 text-white",
      archived: "bg-gray-500 text-white",
      draft: "bg-gray-400 text-white",
      sent: "bg-green-500 text-white",
    };
    return (
      <Badge className={`${colors[status] || "bg-gray-500"} text-[10px] sm:text-xs px-1.5 sm:px-2`}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-none p-4 md:p-8 lg:p-10 space-y-4" dir="rtl">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-12 w-full" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-none p-3 sm:p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/executive">
            <Button variant="ghost" size="sm" className="gap-1 h-8 text-xs sm:text-sm">
              <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
              العودة
            </Button>
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-amber-800" data-testid="page-title">
              إدارة المراسلات
            </h1>
            <p className="text-[10px] sm:text-xs text-gray-600">
              BUTTER BAKERY - CORRESPONDENCE MANAGEMENT
            </p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1 sm:gap-2 bg-amber-600 hover:bg-amber-700 text-xs sm:text-sm h-8 sm:h-9" onClick={() => setSelectedCorr(null)}>
              <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
              مراسلة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>{selectedCorr ? "تعديل المراسلة" : "مراسلة جديدة"}</DialogTitle>
              <DialogDescription>
                {selectedCorr ? "تعديل بيانات المراسلة" : activeTab === "incoming" ? "تسجيل مراسلة واردة جديدة" : "إنشاء مراسلة صادرة جديدة"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">الموضوع بالعربية *</Label>
                  <Input
                    id="subject"
                    name="subject"
                    defaultValue={selectedCorr?.subject}
                    required
                    data-testid="input-subject"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subjectEn">الموضوع بالإنجليزية</Label>
                  <Input
                    id="subjectEn"
                    name="subjectEn"
                    defaultValue={selectedCorr?.subjectEn || ""}
                    data-testid="input-subject-en"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">المحتوى</Label>
                <Textarea
                  id="content"
                  name="content"
                  defaultValue={selectedCorr?.content || ""}
                  rows={4}
                  data-testid="input-content"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">الأولوية *</Label>
                  <Select name="priority" defaultValue={selectedCorr?.priority || "normal"}>
                    <SelectTrigger data-testid="select-priority">
                      <SelectValue placeholder="اختر الأولوية" />
                    </SelectTrigger>
                    <SelectContent>
                      {priorities.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          {priority.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">الحالة</Label>
                  <Select name="status" defaultValue={selectedCorr?.status || (activeTab === "incoming" ? "received" : "draft")}>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue placeholder="اختر الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">التصنيف</Label>
                  <Select name="category" defaultValue={selectedCorr?.category || "official"}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="اختر التصنيف" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {activeTab === "incoming" ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="senderName">اسم المرسل</Label>
                    <Input
                      id="senderName"
                      name="senderName"
                      defaultValue={selectedCorr?.senderName || ""}
                      data-testid="input-sender-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="senderOrg">جهة المرسل</Label>
                    <Input
                      id="senderOrg"
                      name="senderOrg"
                      defaultValue={selectedCorr?.senderOrg || ""}
                      data-testid="input-sender-org"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="senderContact">بيانات الاتصال</Label>
                    <Input
                      id="senderContact"
                      name="senderContact"
                      defaultValue={selectedCorr?.senderContact || ""}
                      data-testid="input-sender-contact"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="recipientName">اسم المستلم</Label>
                    <Input
                      id="recipientName"
                      name="recipientName"
                      defaultValue={selectedCorr?.recipientName || ""}
                      data-testid="input-recipient-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipientOrg">جهة المستلم</Label>
                    <Input
                      id="recipientOrg"
                      name="recipientOrg"
                      defaultValue={selectedCorr?.recipientOrg || ""}
                      data-testid="input-recipient-org"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipientContact">بيانات الاتصال</Label>
                    <Input
                      id="recipientContact"
                      name="recipientContact"
                      defaultValue={selectedCorr?.recipientContact || ""}
                      data-testid="input-recipient-contact"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assignedTo">المكلف بالمتابعة</Label>
                  <Select name="assignedTo" defaultValue={selectedCorr?.assignedTo || ""}>
                    <SelectTrigger data-testid="select-assigned-to">
                      <SelectValue placeholder="اختر الموظف" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName || user.lastName
                            ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                            : user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">تاريخ الاستحقاق</Label>
                  <Input
                    id="dueDate"
                    name="dueDate"
                    type="date"
                    defaultValue={selectedCorr?.dueDate ? format(new Date(selectedCorr.dueDate), "yyyy-MM-dd") : ""}
                    data-testid="input-due-date"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isConfidential"
                    name="isConfidential"
                    defaultChecked={selectedCorr?.isConfidential}
                    className="h-4 w-4"
                    data-testid="checkbox-confidential"
                  />
                  <Label htmlFor="isConfidential" className="flex items-center gap-1">
                    <Lock className="h-4 w-4" />
                    سري
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="responseRequired"
                    name="responseRequired"
                    defaultChecked={selectedCorr?.responseRequired}
                    className="h-4 w-4"
                    data-testid="checkbox-response-required"
                  />
                  <Label htmlFor="responseRequired">يتطلب رد</Label>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setSelectedCorr(null);
                  }}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? "جاري الحفظ..." : selectedCorr ? "تحديث" : "إنشاء"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-xs sm:max-w-md grid-cols-2">
          <TabsTrigger value="incoming" className="gap-1 sm:gap-2 text-xs sm:text-sm">
            <Inbox className="h-3 w-3 sm:h-4 sm:w-4" />
            وارد ({incomingCorr.length})
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="gap-1 sm:gap-2 text-xs sm:text-sm">
            <Send className="h-3 w-3 sm:h-4 sm:w-4" />
            صادر ({outgoingCorr.length})
          </TabsTrigger>
        </TabsList>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="البحث في المراسلات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 text-sm"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40 text-xs sm:text-sm" data-testid="filter-status">
              <Filter className="h-3 w-3 sm:h-4 sm:w-4 ml-2" />
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="incoming" className="space-y-4">
          {filteredCorr.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Inbox className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-600">لا توجد مراسلات واردة</h3>
                <p className="text-gray-500 mt-2">ابدأ بتسجيل مراسلة واردة جديدة</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredCorr.map((corr) => (
                <Card key={corr.id} className="hover:shadow-md transition-shadow" data-testid={`corr-card-${corr.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-1 rounded bg-gray-100 font-mono">
                            {corr.refNumber}
                          </span>
                          {getPriorityBadge(corr.priority)}
                          {getStatusBadge(corr.status)}
                          {corr.isConfidential && (
                            <Badge variant="outline" className="gap-1 border-red-300 text-red-600">
                              <Lock className="h-3 w-3" />
                              سري
                            </Badge>
                          )}
                          {corr.responseRequired && (
                            <Badge variant="outline" className="gap-1 border-orange-300 text-orange-600">
                              يتطلب رد
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-lg">{corr.subject}</h3>
                        {corr.subjectEn && (
                          <p className="text-sm text-gray-500">{corr.subjectEn}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                          {corr.senderName && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              من: {corr.senderName}
                              {corr.senderOrg && ` - ${corr.senderOrg}`}
                            </div>
                          )}
                          {corr.receivedAt && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(corr.receivedAt), "d MMMM yyyy", { locale: ar })}
                            </div>
                          )}
                        </div>
                        {corr.assignedToName && (
                          <div className="text-sm text-gray-500 mt-1">
                            المكلف: {corr.assignedToName}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedCorr(corr);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (confirm("هل أنت متأكد من حذف هذه المراسلة؟")) {
                              deleteMutation.mutate(corr.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="outgoing" className="space-y-4">
          {filteredCorr.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Send className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-600">لا توجد مراسلات صادرة</h3>
                <p className="text-gray-500 mt-2">ابدأ بإنشاء مراسلة صادرة جديدة</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredCorr.map((corr) => (
                <Card key={corr.id} className="hover:shadow-md transition-shadow" data-testid={`corr-card-${corr.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-1 rounded bg-gray-100 font-mono">
                            {corr.refNumber}
                          </span>
                          {getPriorityBadge(corr.priority)}
                          {getStatusBadge(corr.status)}
                          {corr.isConfidential && (
                            <Badge variant="outline" className="gap-1 border-red-300 text-red-600">
                              <Lock className="h-3 w-3" />
                              سري
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-lg">{corr.subject}</h3>
                        {corr.subjectEn && (
                          <p className="text-sm text-gray-500">{corr.subjectEn}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                          {corr.recipientName && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              إلى: {corr.recipientName}
                              {corr.recipientOrg && ` - ${corr.recipientOrg}`}
                            </div>
                          )}
                          {corr.sentAt && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              أُرسل: {format(new Date(corr.sentAt), "d MMMM yyyy", { locale: ar })}
                            </div>
                          )}
                        </div>
                        {corr.ownerName && (
                          <div className="text-sm text-gray-500 mt-1">
                            المسؤول: {corr.ownerName}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedCorr(corr);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (confirm("هل أنت متأكد من حذف هذه المراسلة؟")) {
                              deleteMutation.mutate(corr.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </Layout>
  );
}
