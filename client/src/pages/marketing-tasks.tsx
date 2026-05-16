import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dashboard/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, CheckCircle2, Clock, AlertCircle, Circle, 
  Calendar, User, Filter, MoreVertical, ArrowRight,
  LayoutGrid, List, GripVertical, Trash2, Edit, ListChecks
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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

interface TeamMember {
  id: number;
  name: string;
  isActive: boolean;
}

const TASK_STATUSES = [
  { value: "pending", label: "معلقة", icon: Circle, color: "bg-gray-100 text-gray-700", borderColor: "border-gray-300" },
  { value: "in_progress", label: "قيد التنفيذ", icon: Clock, color: "bg-blue-100 text-blue-700", borderColor: "border-blue-300" },
  { value: "review", label: "قيد المراجعة", icon: AlertCircle, color: "bg-yellow-100 text-yellow-700", borderColor: "border-yellow-300" },
  { value: "completed", label: "مكتملة", icon: CheckCircle2, color: "bg-green-100 text-green-700", borderColor: "border-green-300" },
];

const TASK_PRIORITIES = [
  { value: "low", label: "منخفضة", color: "bg-gray-100 text-gray-600" },
  { value: "medium", label: "متوسطة", color: "bg-blue-100 text-blue-600" },
  { value: "high", label: "عالية", color: "bg-orange-100 text-orange-600" },
  { value: "urgent", label: "عاجلة", color: "bg-red-100 text-red-600" },
];

type ViewMode = "kanban" | "list";

export default function MarketingTasksPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MarketingTask | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [draggedTask, setDraggedTask] = useState<MarketingTask | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "pending",
    priority: "medium",
    assignedTo: "none",
    dueDate: "",
  });

  const { data: tasks = [], isLoading } = useQuery<MarketingTask[]>({
    queryKey: ["/api/marketing/tasks"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/tasks");
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/marketing/team"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/team");
      if (!res.ok) throw new Error(`${res.status}: request failed`);
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

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => {
      const res = await fetch(`/api/marketing/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل في تحديث المهمة");
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/marketing/tasks"] });
      const previousTasks = queryClient.getQueryData<MarketingTask[]>(["/api/marketing/tasks"]);
      queryClient.setQueryData<MarketingTask[]>(["/api/marketing/tasks"], (old) =>
        old?.map((task) => (task.id === id ? { ...task, ...data } : task)) || []
      );
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["/api/marketing/tasks"], context.previousTasks);
      }
      toast({ title: "فشل في تحديث المهمة", variant: "destructive" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/tasks"] });
      setIsEditDialogOpen(false);
      setEditingTask(null);
      resetForm();
      toast({ title: "تم تحديث المهمة" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/marketing/tasks/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("فشل في حذف المهمة");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/tasks"] });
      toast({ title: "تم حذف المهمة" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      status: "pending",
      priority: "medium",
      assignedTo: "none",
      dueDate: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast({ title: "يرجى إدخال عنوان المهمة", variant: "destructive" });
      return;
    }
    const submitData = {
      ...formData,
      assignedTo: formData.assignedTo === "none" ? "" : formData.assignedTo,
    };
    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, data: submitData });
    } else {
      createTaskMutation.mutate(submitData);
    }
  };

  const openEditDialog = (task: MarketingTask) => {
    setFormData({
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      assignedTo: task.assignedTo || "none",
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : "",
    });
    setEditingTask(task);
    setIsEditDialogOpen(true);
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

  const filteredTasks = statusFilter === "all" ? tasks : tasks.filter(t => t.status === statusFilter);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-GB");
  };

  const isOverdue = (dueDate: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const handleDragStart = (task: MarketingTask) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (status: string) => {
    if (draggedTask && draggedTask.status !== status) {
      updateTaskMutation.mutate({ id: draggedTask.id, data: { status } });
    }
    setDraggedTask(null);
  };

  const TaskCard = ({ task, compact = false }: { task: MarketingTask; compact?: boolean }) => {
    const statusInfo = getStatusInfo(task.status);
    const priorityInfo = getPriorityInfo(task.priority);
    const StatusIcon = statusInfo.icon;
    const overdue = task.status !== "completed" && isOverdue(task.dueDate || "");

    return (
      <div
        draggable
        onDragStart={() => handleDragStart(task)}
        className={`p-3 bg-white border rounded-lg shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
          overdue ? "border-red-300 bg-red-50/50" : "border-gray-200"
        }`}
        data-testid={`task-card-${task.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <Checkbox
                checked={task.status === "completed"}
                onCheckedChange={(checked) => {
                  updateTaskMutation.mutate({
                    id: task.id,
                    data: { status: checked ? "completed" : "pending" },
                  });
                }}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <h4 className={`font-medium text-sm truncate ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                  {task.title}
                </h4>
                {!compact && task.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                )}
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEditDialog(task)}>
                <Edit className="w-4 h-4 ml-2" />
                تعديل
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {TASK_STATUSES.filter(s => s.value !== task.status).map((status) => (
                <DropdownMenuItem
                  key={status.value}
                  onClick={() => updateTaskMutation.mutate({ id: task.id, data: { status: status.value } })}
                >
                  نقل إلى: {status.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => deleteTaskMutation.mutate(task.id)}
              >
                <Trash2 className="w-4 h-4 ml-2" />
                حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <Badge className={`${priorityInfo.color} text-[10px] sm:text-xs px-1.5 py-0`}>
            {priorityInfo.label}
          </Badge>
          {task.dueDate && (
            <Badge variant="outline" className={`text-[10px] sm:text-xs px-1.5 py-0 ${overdue ? "border-red-400 text-red-600" : ""}`}>
              <Calendar className="w-3 h-3 ml-0.5" />
              {formatDate(task.dueDate)}
            </Badge>
          )}
          {task.assignedTo && (
            <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0">
              <User className="w-3 h-3 ml-0.5" />
              {task.assignedTo}
            </Badge>
          )}
        </div>
      </div>
    );
  };

  const KanbanColumn = ({ status }: { status: typeof TASK_STATUSES[0] }) => {
    const columnTasks = tasksByStatus[status.value as keyof typeof tasksByStatus] || [];
    const StatusIcon = status.icon;

    return (
      <div
        className={`flex flex-col min-w-[280px] max-w-[320px] flex-1 rounded-lg border-2 ${
          draggedTask ? "border-dashed" : ""
        } ${status.borderColor} bg-gray-50/50`}
        onDragOver={handleDragOver}
        onDrop={() => handleDrop(status.value)}
      >
        <div className={`p-3 ${status.color} rounded-t-lg border-b ${status.borderColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusIcon className="w-4 h-4" />
              <span className="font-medium text-sm">{status.label}</span>
            </div>
            <Badge variant="secondary" className="bg-white/60">
              {columnTasks.length}
            </Badge>
          </div>
        </div>
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-2 min-h-[200px]">
            {columnTasks.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                لا توجد مهام
              </div>
            ) : (
              columnTasks.map((task) => (
                <TaskCard key={task.id} task={task} compact />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const TaskForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>عنوان المهمة *</Label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="أدخل عنوان المهمة"
          className="h-11 sm:h-10"
          data-testid="input-task-title"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>الحالة</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
            <SelectTrigger className="h-11 sm:h-10" data-testid="select-task-status">
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
            <SelectTrigger className="h-11 sm:h-10" data-testid="select-task-priority">
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
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>تاريخ الاستحقاق</Label>
          <Input
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            className="h-11 sm:h-10"
            data-testid="input-task-due-date"
          />
        </div>
        <div className="space-y-2">
          <Label>المسؤول</Label>
          <Select value={formData.assignedTo} onValueChange={(v) => setFormData({ ...formData, assignedTo: v })}>
            <SelectTrigger className="h-11 sm:h-10" data-testid="select-task-assignee">
              <SelectValue placeholder="اختر المسؤول" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">بدون تعيين</SelectItem>
              {teamMembers.filter(m => m.isActive).map((member) => (
                <SelectItem key={member.id} value={member.name || `member-${member.id}`}>
                  {member.name || `عضو ${member.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
        <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => {
          setIsAddDialogOpen(false);
          setIsEditDialogOpen(false);
          setEditingTask(null);
          resetForm();
        }}>
          إلغاء
        </Button>
        <Button type="submit" className="h-11 sm:h-9" disabled={createTaskMutation.isPending || updateTaskMutation.isPending} data-testid="button-submit-task">
          {(createTaskMutation.isPending || updateTaskMutation.isPending) ? "جاري الحفظ..." : "حفظ"}
        </Button>
      </div>
    </form>
  );

  return (
    <Layout>
      <div className="p-4 md:p-8 lg:p-10 max-w-[1400px] mx-auto space-y-4" dir="rtl">
        <PageHeader
          icon={ListChecks}
          tone="marketing"
          title="مهام التسويق"
          description="متابعة المهام والأنشطة التسويقية"
          backHref="/marketing"
          actions={
            <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                size="sm"
                className="rounded-none h-9"
                onClick={() => setViewMode("kanban")}
                data-testid="button-view-kanban"
              >
                <LayoutGrid className="w-4 h-4 ml-1" />
                Kanban
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                className="rounded-none h-9"
                onClick={() => setViewMode("list")}
                data-testid="button-view-list"
              >
                <List className="w-4 h-4 ml-1" />
                قائمة
              </Button>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-11 sm:h-9" data-testid="button-add-task">
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة مهمة
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إضافة مهمة جديدة</DialogTitle>
                </DialogHeader>
                <TaskForm />
              </DialogContent>
            </Dialog>
            </div>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {TASK_STATUSES.map((status) => {
            const count = tasksByStatus[status.value as keyof typeof tasksByStatus]?.length || 0;
            const StatusIcon = status.icon;
            return (
              <Card key={status.value} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
                setViewMode("list");
                setStatusFilter(status.value);
              }}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-sm sm:text-base font-medium">{status.label}</span>
                    </div>
                    <Badge variant="secondary" className="text-base sm:text-lg px-2 sm:px-3">
                      {count}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {viewMode === "list" && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">تصفية:</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 h-11 sm:h-10" data-testid="select-status-filter">
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
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="p-6 sm:p-8 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لا توجد مهام</p>
              <Button className="mt-4 h-11 sm:h-9" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 ml-2" />
                إضافة مهمة جديدة
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === "kanban" ? (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {TASK_STATUSES.map((status) => (
                <KanbanColumn key={status.value} status={status} />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}

        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingTask(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل المهمة</DialogTitle>
            </DialogHeader>
            <TaskForm />
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
