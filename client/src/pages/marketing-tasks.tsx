import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, CheckCircle2, Clock, AlertCircle, Circle, 
  Calendar, User, Filter, MoreVertical 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MarketingTask {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignedTo?: string;
  dueDate?: string;
  campaignId?: number;
  createdAt: string;
}

const TASK_STATUSES = [
  { value: "pending", label: "معلقة", icon: Circle, color: "bg-gray-100 text-gray-700" },
  { value: "in_progress", label: "قيد التنفيذ", icon: Clock, color: "bg-blue-100 text-blue-700" },
  { value: "review", label: "قيد المراجعة", icon: AlertCircle, color: "bg-yellow-100 text-yellow-700" },
  { value: "completed", label: "مكتملة", icon: CheckCircle2, color: "bg-green-100 text-green-700" },
];

const TASK_PRIORITIES = [
  { value: "low", label: "منخفضة", color: "bg-gray-100 text-gray-600" },
  { value: "medium", label: "متوسطة", color: "bg-blue-100 text-blue-600" },
  { value: "high", label: "عالية", color: "bg-orange-100 text-orange-600" },
  { value: "urgent", label: "عاجلة", color: "bg-red-100 text-red-600" },
];

export default function MarketingTasksPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "pending",
    priority: "medium",
    assignedTo: "",
    dueDate: "",
  });

  const { data: tasks = [], isLoading } = useQuery<MarketingTask[]>({
    queryKey: ["/api/marketing/tasks", statusFilter],
    queryFn: async () => {
      const url = statusFilter === "all" 
        ? "/api/marketing/tasks" 
        : `/api/marketing/tasks?status=${statusFilter}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/marketing/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل في إنشاء المهمة");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/tasks"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "تم إنشاء المهمة بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء المهمة", variant: "destructive" });
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/marketing/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("فشل في تحديث المهمة");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/tasks"] });
      toast({ title: "تم تحديث المهمة" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      status: "pending",
      priority: "medium",
      assignedTo: "",
      dueDate: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast({ title: "يرجى إدخال عنوان المهمة", variant: "destructive" });
      return;
    }
    createTaskMutation.mutate(formData);
  };

  const getStatusInfo = (status: string) => {
    return TASK_STATUSES.find(s => s.value === status) || TASK_STATUSES[0];
  };

  const getPriorityInfo = (priority: string) => {
    return TASK_PRIORITIES.find(p => p.value === priority) || TASK_PRIORITIES[1];
  };

  const tasksByStatus = {
    pending: tasks.filter(t => t.status === "pending"),
    in_progress: tasks.filter(t => t.status === "in_progress"),
    review: tasks.filter(t => t.status === "review"),
    completed: tasks.filter(t => t.status === "completed"),
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("ar-SA");
  };

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">مهام التسويق</h1>
            <p className="text-sm text-muted-foreground">متابعة المهام والأنشطة التسويقية</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-task">
                <Plus className="w-4 h-4 ml-2" />
                إضافة مهمة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة مهمة جديدة</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>عنوان المهمة *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="أدخل عنوان المهمة"
                    data-testid="input-task-title"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الحالة</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                      <SelectTrigger data-testid="select-task-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>الأولوية</Label>
                    <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                      <SelectTrigger data-testid="select-task-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_PRIORITIES.map((priority) => (
                          <SelectItem key={priority.value} value={priority.value}>
                            {priority.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>تاريخ الاستحقاق</Label>
                  <Input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    data-testid="input-task-due-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>الوصف</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="وصف المهمة"
                    rows={3}
                    data-testid="input-task-description"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={createTaskMutation.isPending} data-testid="button-submit-task">
                    {createTaskMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {TASK_STATUSES.map((status) => {
            const count = tasksByStatus[status.value as keyof typeof tasksByStatus]?.length || 0;
            const StatusIcon = status.icon;
            return (
              <Card key={status.value} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(status.value)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusIcon className="w-5 h-5" />
                      <span className="font-medium">{status.label}</span>
                    </div>
                    <Badge variant="secondary" className="text-lg px-3">
                      {count}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">تصفية:</span>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              {TASK_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لا توجد مهام</p>
              <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 ml-2" />
                إضافة مهمة جديدة
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const statusInfo = getStatusInfo(task.status);
              const priorityInfo = getPriorityInfo(task.priority);
              const StatusIcon = statusInfo.icon;
              return (
                <Card key={task.id} className="hover:shadow-md transition-shadow" data-testid={`task-card-${task.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <Checkbox
                          checked={task.status === "completed"}
                          onCheckedChange={(checked) => {
                            updateTaskStatusMutation.mutate({
                              id: task.id,
                              status: checked ? "completed" : "pending",
                            });
                          }}
                          data-testid={`checkbox-task-${task.id}`}
                        />
                        <div className="flex-1">
                          <h3 className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                            {task.title}
                          </h3>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge className={statusInfo.color}>
                              <StatusIcon className="w-3 h-3 ml-1" />
                              {statusInfo.label}
                            </Badge>
                            <Badge className={priorityInfo.color}>
                              {priorityInfo.label}
                            </Badge>
                            {task.dueDate && (
                              <Badge variant="outline" className="gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(task.dueDate)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-task-menu-${task.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {TASK_STATUSES.map((status) => (
                            <DropdownMenuItem
                              key={status.value}
                              onClick={() => updateTaskStatusMutation.mutate({ id: task.id, status: status.value })}
                            >
                              تغيير إلى: {status.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
