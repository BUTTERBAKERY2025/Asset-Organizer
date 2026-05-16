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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { CheckSquare, Clock, Plus, ArrowRight, Search, Filter, Edit, Trash2, User, Calendar, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Layout } from "@/components/layout";

interface Task {
  id: number;
  title: string;
  titleEn?: string;
  description?: string;
  branchId?: string;
  priority: string;
  status: string;
  assignedTo?: string;
  assignedToName?: string;
  createdBy: string;
  createdByName?: string;
  dueDate?: string;
  completedAt?: string;
  completionNotes?: string;
  relatedType?: string;
  relatedId?: number;
  createdAt: string;
}

const priorities = [
  { value: "urgent", label: "عاجل", labelEn: "Urgent", color: "bg-red-500" },
  { value: "high", label: "مرتفع", labelEn: "High", color: "bg-orange-500" },
  { value: "normal", label: "عادي", labelEn: "Normal", color: "bg-blue-500" },
  { value: "low", label: "منخفض", labelEn: "Low", color: "bg-gray-500" },
];

const statuses = [
  { value: "pending", label: "معلق", labelEn: "Pending" },
  { value: "in_progress", label: "جاري", labelEn: "In Progress" },
  { value: "completed", label: "مكتمل", labelEn: "Completed" },
  { value: "cancelled", label: "ملغي", labelEn: "Cancelled" },
];

interface User {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

export default function ExecutiveTasks() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/executive/tasks"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Task>) => {
      return await apiRequest("POST", "/api/executive/tasks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/executive/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executive/dashboard"] });
      toast({ title: "تم إنشاء المهمة بنجاح" });
      setIsDialogOpen(false);
      setSelectedTask(null);
    },
    onError: () => {
      toast({ title: "فشل في إنشاء المهمة", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Task> }) => {
      return await apiRequest("PUT", `/api/executive/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/executive/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executive/dashboard"] });
      toast({ title: "تم تحديث المهمة بنجاح" });
      setIsDialogOpen(false);
      setSelectedTask(null);
    },
    onError: () => {
      toast({ title: "فشل في تحديث المهمة", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/executive/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/executive/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executive/dashboard"] });
      toast({ title: "تم حذف المهمة بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في حذف المهمة", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const assignedTo = formData.get("assignedTo") as string;
    const assignedUser = users.find((u) => u.id === assignedTo);
    
    const data = {
      title: formData.get("title") as string,
      titleEn: formData.get("titleEn") as string,
      description: formData.get("description") as string,
      priority: formData.get("priority") as string,
      status: formData.get("status") as string || "pending",
      assignedTo: assignedTo || undefined,
      assignedToName: assignedUser ? `${assignedUser.firstName || ""} ${assignedUser.lastName || ""}`.trim() || assignedUser.username : undefined,
      dueDate: formData.get("dueDate") as string || undefined,
    };

    if (selectedTask) {
      updateMutation.mutate({ id: selectedTask.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleStatusChange = (taskId: number, newStatus: string) => {
    updateMutation.mutate({ id: taskId, data: { status: newStatus } });
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assignedToName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getPriorityBadge = (priority: string) => {
    const priorityInfo = priorities.find((p) => p.value === priority);
    return (
      <Badge className={`${priorityInfo?.color || "bg-gray-500"} text-white text-[10px] sm:text-xs px-1.5 sm:px-2`}>
        {priorityInfo?.label || priority}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = statuses.find((s) => s.value === status);
    const colors: Record<string, string> = {
      pending: "bg-yellow-500 text-white",
      in_progress: "bg-blue-500 text-white",
      completed: "bg-green-500 text-white",
      cancelled: "bg-gray-500 text-white",
    };
    return (
      <Badge className={`${colors[status] || "bg-gray-500"} text-[10px] sm:text-xs px-1.5 sm:px-2`}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  const isOverdue = (task: Task) => {
    if (!task.dueDate || task.status === "completed" || task.status === "cancelled") return false;
    return new Date(task.dueDate) < new Date();
  };

  const groupedTasks = {
    pending: filteredTasks.filter((t) => t.status === "pending"),
    in_progress: filteredTasks.filter((t) => t.status === "in_progress"),
    completed: filteredTasks.filter((t) => t.status === "completed"),
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 lg:p-10 space-y-4" dir="rtl">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const TaskCard = ({ task }: { task: Task }) => (
    <Card
      className={`hover:shadow-lg transition-shadow ${isOverdue(task) ? "border-red-300 bg-red-50" : ""}`}
      data-testid={`task-card-${task.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          {getPriorityBadge(task.priority)}
          {getStatusBadge(task.status)}
        </div>
        <CardTitle className="text-lg mt-2 flex items-center gap-2">
          {task.title}
          {isOverdue(task) && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
        </CardTitle>
        {task.titleEn && (
          <CardDescription>{task.titleEn}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {task.description && (
          <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
        )}
        {task.dueDate && (
          <div className={`flex items-center gap-2 text-sm ${isOverdue(task) ? "text-red-600 font-semibold" : "text-gray-600"}`}>
            <Calendar className="h-4 w-4" />
            موعد التسليم: {format(new Date(task.dueDate), "d MMMM yyyy", { locale: ar })}
          </div>
        )}
        {task.assignedToName && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="h-4 w-4" />
            {task.assignedToName}
          </div>
        )}
        {task.createdByName && (
          <div className="text-xs text-gray-400">
            أنشئت بواسطة: {task.createdByName}
          </div>
        )}
        <div className="flex items-center gap-2 pt-2 border-t">
          {task.status !== "completed" && task.status !== "cancelled" && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={() => handleStatusChange(task.id, "completed")}
            >
              <CheckCircle className="h-4 w-4" />
              إكمال
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 gap-1"
            onClick={() => {
              setSelectedTask(task);
              setIsDialogOpen(true);
            }}
          >
            <Edit className="h-4 w-4" />
            تعديل
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => {
              if (confirm("هل أنت متأكد من حذف هذه المهمة؟")) {
                deleteMutation.mutate(task.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto p-3 sm:p-4 md:p-6 space-y-4" dir="rtl">
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
                إدارة المهام
              </h1>
              <p className="text-[10px] sm:text-xs text-gray-600">
                BUTTER BAKERY - TASKS MANAGEMENT
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className={`${viewMode === "list" ? "bg-amber-600" : ""} text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3`}
              >
                قائمة
              </Button>
              <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                className={`${viewMode === "kanban" ? "bg-amber-600" : ""} text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3`}
              >
                Kanban
              </Button>
            </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1 sm:gap-2 bg-amber-600 hover:bg-amber-700 text-xs sm:text-sm h-8 sm:h-9" onClick={() => setSelectedTask(null)}>
                <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                مهمة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle>{selectedTask ? "تعديل المهمة" : "مهمة جديدة"}</DialogTitle>
                <DialogDescription>
                  {selectedTask ? "تعديل بيانات المهمة" : "إضافة مهمة جديدة"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">العنوان بالعربية *</Label>
                    <Input
                      id="title"
                      name="title"
                      defaultValue={selectedTask?.title}
                      required
                      data-testid="input-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="titleEn">العنوان بالإنجليزية</Label>
                    <Input
                      id="titleEn"
                      name="titleEn"
                      defaultValue={selectedTask?.titleEn || ""}
                      data-testid="input-title-en"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">الوصف</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={selectedTask?.description || ""}
                    rows={3}
                    data-testid="input-description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">الأولوية *</Label>
                    <Select name="priority" defaultValue={selectedTask?.priority || "normal"}>
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
                    <Select name="status" defaultValue={selectedTask?.status || "pending"}>
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assignedTo">المكلف</Label>
                    <Select name="assignedTo" defaultValue={selectedTask?.assignedTo || ""}>
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
                    <Label htmlFor="dueDate">تاريخ التسليم</Label>
                    <Input
                      id="dueDate"
                      name="dueDate"
                      type="date"
                      defaultValue={selectedTask?.dueDate ? format(new Date(selectedTask.dueDate), "yyyy-MM-dd") : ""}
                      data-testid="input-due-date"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setSelectedTask(null);
                    }}
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    className="bg-amber-600 hover:bg-amber-700"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending ? "جاري الحفظ..." : selectedTask ? "تحديث" : "إنشاء"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="البحث في المهام..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10 text-sm"
            data-testid="input-search"
          />
        </div>
        <div className="flex gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-32 text-xs sm:text-sm" data-testid="filter-status">
            <Filter className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
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
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-32 text-xs sm:text-sm" data-testid="filter-priority">
            <Filter className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
            <SelectValue placeholder="الأولوية" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الأولويات</SelectItem>
            {priorities.map((priority) => (
              <SelectItem key={priority.value} value={priority.value}>
                {priority.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600">لا توجد مهام</h3>
            <p className="text-gray-500 mt-2">ابدأ بإنشاء مهمة جديدة</p>
          </CardContent>
        </Card>
      ) : viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 p-2 sm:p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
              <h3 className="text-sm sm:text-base font-semibold text-yellow-800">معلق ({groupedTasks.pending.length})</h3>
            </div>
            {groupedTasks.pending.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 p-2 sm:p-3 bg-blue-100 rounded-lg">
              <CheckSquare className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              <h3 className="text-sm sm:text-base font-semibold text-blue-800">جاري ({groupedTasks.in_progress.length})</h3>
            </div>
            {groupedTasks.in_progress.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 p-2 sm:p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              <h3 className="text-sm sm:text-base font-semibold text-green-800">مكتمل ({groupedTasks.completed.length})</h3>
            </div>
            {groupedTasks.completed.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
          {filteredTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
      </div>
    </Layout>
  );
}
