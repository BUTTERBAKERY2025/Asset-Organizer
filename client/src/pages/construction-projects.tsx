import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Loader2, Building2, Calendar, DollarSign, Eye } from "lucide-react";
import { Link } from "wouter";
import type { Branch, ConstructionProject } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

const projectFormSchema = z.object({
  branchId: z.string().min(1, "الفرع مطلوب"),
  title: z.string().min(1, "عنوان المشروع مطلوب"),
  description: z.string().optional().nullable(),
  status: z.string().default("planned"),
  budget: z.coerce.number().optional().nullable(),
  startDate: z.string().optional().nullable(),
  targetCompletionDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type ProjectFormData = z.infer<typeof projectFormSchema>;

const PROJECT_STATUSES = [
  { value: "planned", label: "مخطط", color: "bg-blue-500" },
  { value: "in_progress", label: "قيد التنفيذ", color: "bg-yellow-500" },
  { value: "completed", label: "مكتمل", color: "bg-green-500" },
  { value: "on_hold", label: "متوقف", color: "bg-gray-500" },
];

export default function ConstructionProjectsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ConstructionProject | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isEmployee } = useAuth();
  const canEdit = isAdmin || isEmployee;

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

  const { data: projects = [], isLoading } = useQuery<ConstructionProject[]>({
    queryKey: ["/api/construction/projects"],
    queryFn: async () => {
      const res = await fetch("/api/construction/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      branchId: "",
      title: "",
      description: "",
      status: "planned",
      budget: null,
      startDate: "",
      targetCompletionDate: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const res = await fetch("/api/construction/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create project");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction/projects"] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({ title: "تم إنشاء المشروع بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في إنشاء المشروع", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ProjectFormData & { id: number }) => {
      const { id, ...projectData } = data;
      const res = await fetch(`/api/construction/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectData),
      });
      if (!res.ok) throw new Error("Failed to update project");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction/projects"] });
      setIsEditDialogOpen(false);
      setSelectedProject(null);
      toast({ title: "تم تحديث المشروع بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في تحديث المشروع", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/construction/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete project");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction/projects"] });
      setIsDeleteDialogOpen(false);
      setSelectedProject(null);
      toast({ title: "تم حذف المشروع بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في حذف المشروع", variant: "destructive" });
    },
  });

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBranch = selectedBranch === "all" || project.branchId === selectedBranch;
    const matchesStatus = selectedStatus === "all" || project.status === selectedStatus;
    return matchesSearch && matchesBranch && matchesStatus;
  });

  const getBranchName = (branchId: string) => {
    const branch = branches.find((b) => b.id === branchId);
    return branch?.name || branchId;
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = PROJECT_STATUSES.find((s) => s.value === status);
    return (
      <Badge className={`${statusInfo?.color || "bg-gray-500"} text-white`}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(amount);
  };

  const openEditDialog = (project: ConstructionProject) => {
    setSelectedProject(project);
    form.reset({
      branchId: project.branchId,
      title: project.title,
      description: project.description || "",
      status: project.status,
      budget: project.budget,
      startDate: project.startDate || "",
      targetCompletionDate: project.targetCompletionDate || "",
      notes: project.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const onSubmit = (data: ProjectFormData) => {
    if (selectedProject) {
      updateMutation.mutate({ ...data, id: selectedProject.id });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">المشاريع الإنشائية</h1>
            <p className="text-muted-foreground">إدارة ومتابعة مشاريع البناء والتجديد</p>
          </div>
          {canEdit && (
            <Button onClick={() => { form.reset(); setIsAddDialogOpen(true); }} data-testid="button-add-project">
              <Plus className="w-4 h-4 ml-2" />
              إضافة مشروع
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="البحث في المشاريع..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
              data-testid="input-search-projects"
            />
          </div>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-branch-filter">
              <SelectValue placeholder="جميع الفروع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفروع</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
              <SelectValue placeholder="جميع الحالات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              {PROJECT_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لا توجد مشاريع</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <Card key={project.id} className="hover:shadow-lg transition-shadow" data-testid={`card-project-${project.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{project.title}</CardTitle>
                    {getStatusBadge(project.status)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    {getBranchName(project.branchId)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">التقدم</span>
                      <span className="font-medium">{project.progressPercent || 0}%</span>
                    </div>
                    <Progress value={project.progressPercent || 0} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span>{formatCurrency(project.budget)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>{project.targetCompletionDate || "-"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Link href={`/construction-projects/${project.id}`}>
                      <Button variant="outline" size="sm" data-testid={`button-view-project-${project.id}`}>
                        <Eye className="w-4 h-4 ml-1" />
                        عرض
                      </Button>
                    </Link>
                    {canEdit && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(project)} data-testid={`button-edit-project-${project.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {isAdmin && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => { setSelectedProject(project); setIsDeleteDialogOpen(true); }}
                            data-testid={`button-delete-project-${project.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setIsEditDialogOpen(false);
            setSelectedProject(null);
            form.reset();
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedProject ? "تعديل المشروع" : "إضافة مشروع جديد"}</DialogTitle>
              <DialogDescription>
                {selectedProject ? "قم بتعديل بيانات المشروع" : "أدخل بيانات المشروع الجديد"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>الفرع</Label>
                <Select value={form.watch("branchId")} onValueChange={(v) => form.setValue("branchId", v)}>
                  <SelectTrigger data-testid="select-project-branch">
                    <SelectValue placeholder="اختر الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.branchId && (
                  <p className="text-sm text-destructive">{form.formState.errors.branchId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>عنوان المشروع</Label>
                <Input {...form.register("title")} placeholder="مثال: تجديد واجهة الفرع" data-testid="input-project-title" />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>الوصف</Label>
                <Textarea {...form.register("description")} placeholder="وصف المشروع..." data-testid="input-project-description" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الحالة</Label>
                  <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v)}>
                    <SelectTrigger data-testid="select-project-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الميزانية (ريال)</Label>
                  <Input type="number" {...form.register("budget")} placeholder="0" data-testid="input-project-budget" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>تاريخ البدء</Label>
                  <Input type="date" {...form.register("startDate")} data-testid="input-project-start-date" />
                </div>
                <div className="space-y-2">
                  <Label>تاريخ الانتهاء المتوقع</Label>
                  <Input type="date" {...form.register("targetCompletionDate")} data-testid="input-project-end-date" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <Textarea {...form.register("notes")} placeholder="ملاحظات إضافية..." data-testid="input-project-notes" />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-project">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                  {selectedProject ? "حفظ التغييرات" : "إضافة المشروع"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>حذف المشروع</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف المشروع "{selectedProject?.title}"؟ سيتم حذف جميع بنود العمل المرتبطة به.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedProject && deleteMutation.mutate(selectedProject.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
