import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { GitBranch, Plus, Trash2, ArrowUp, ArrowDown, Save, Loader2, Info } from "lucide-react";

interface Branch {
  id: string;
  name: string;
}

interface OrgJobRole {
  id: number;
  titleAr: string;
  titleEn: string;
  isActive: boolean | null;
}

interface WorkflowStep {
  jobTitle: string;
  stepName?: string;
  isRequired: boolean;
}

interface ApprovalWorkflow {
  id: number;
  branchId: string | null;
  requestType: string;
  name: string;
  isActive: boolean;
  steps: (WorkflowStep & { id?: number; stepOrder?: number })[];
}

const DEFAULT_BRANCH = "__default__";

export default function ApprovalSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState<string>(DEFAULT_BRANCH);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);

  const branchId = selectedBranch === DEFAULT_BRANCH ? null : selectedBranch;

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: jobRoles = [] } = useQuery<OrgJobRole[]>({
    queryKey: ["/api/org-job-roles"],
  });

  const activeRoles = useMemo(
    () => jobRoles.filter((r) => r.isActive !== false),
    [jobRoles],
  );

  const workflowQueryKey = ["/api/approval-workflows", { branchId, requestType: "leave" }];
  const { data: workflow, isLoading } = useQuery<ApprovalWorkflow | null>({
    queryKey: workflowQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ requestType: "leave" });
      if (branchId) params.set("branchId", branchId);
      const res = await fetch(`/api/approval-workflows?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("فشل تحميل السلسلة");
      return res.json();
    },
  });

  useEffect(() => {
    if (workflow) {
      setName(workflow.name || "");
      setIsActive(workflow.isActive ?? true);
      setSteps(
        (workflow.steps || []).map((s) => ({
          jobTitle: s.jobTitle,
          stepName: s.stepName || "",
          isRequired: s.isRequired ?? true,
        })),
      );
    } else {
      setName(branchId ? "سلسلة موافقات الفرع" : "سلسلة الموافقات الافتراضية");
      setIsActive(true);
      setSteps([]);
    }
  }, [workflow, branchId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", "/api/approval-workflows", {
        branchId,
        requestType: "leave",
        name,
        isActive,
        steps,
      });
    },
    onSuccess: () => {
      toast({ title: "تم الحفظ", description: "تم حفظ سلسلة الموافقات بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/approval-workflows"] });
    },
    onError: (e: any) => {
      toast({ title: "خطأ", description: e?.message || "تعذّر الحفظ", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!workflow?.id) return;
      return apiRequest("DELETE", `/api/approval-workflows/${workflow.id}`);
    },
    onSuccess: () => {
      toast({ title: "تم الحذف", description: "تم حذف سلسلة الموافقات" });
      queryClient.invalidateQueries({ queryKey: ["/api/approval-workflows"] });
    },
    onError: (e: any) => {
      toast({ title: "خطأ", description: e?.message || "تعذّر الحذف", variant: "destructive" });
    },
  });

  const addStep = () => {
    if (steps.length >= 3) {
      toast({ title: "الحد الأقصى", description: "لا يمكن إضافة أكثر من 3 مستويات", variant: "destructive" });
      return;
    }
    setSteps((prev) => [...prev, { jobTitle: "", stepName: "", isRequired: true }]);
  };

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const updateStep = (idx: number, patch: Partial<WorkflowStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const canSave = name.trim().length > 0 && steps.length > 0 && steps.every((s) => s.jobTitle.trim().length > 0);

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <PageHeader
          title="نظام الموافقات والاعتمادات"
          description="حدّد تسلسل اعتماد طلبات الإجازة لكل فرع حسب المسمى الوظيفي (حتى 3 مستويات)"
          icon={GitBranch}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">اختيار النطاق</CardTitle>
            <CardDescription>
              اختر فرعاً محدداً، أو "السلسلة الافتراضية" لتطبيقها على الفروع التي لا تملك سلسلة خاصة.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:max-w-sm">
              <Label>الفرع</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger data-testid="select-branch">
                  <SelectValue placeholder="اختر الفرع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_BRANCH} data-testid="option-branch-default">
                    السلسلة الافتراضية (كل الفروع)
                  </SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id} data-testid={`option-branch-${b.id}`}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:max-w-sm">
              <Label>اسم السلسلة</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: اعتماد إجازات الفرع"
                data-testid="input-workflow-name"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-active" />
              <Label>السلسلة مفعّلة</Label>
              {workflow ? (
                <Badge variant="secondary" data-testid="badge-exists">محفوظة مسبقاً</Badge>
              ) : (
                <Badge variant="outline" data-testid="badge-new">جديدة</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">مستويات الاعتماد</CardTitle>
              <CardDescription>يتم الاعتماد بالترتيب من الأعلى للأسفل. الحد الأقصى 3 مستويات.</CardDescription>
            </div>
            <Button onClick={addStep} size="sm" variant="outline" disabled={steps.length >= 3} data-testid="button-add-step">
              <Plus className="ml-1 h-4 w-4" /> إضافة مستوى
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : steps.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground" data-testid="empty-steps">
                <Info className="h-6 w-6" />
                <p>لا توجد مستويات بعد. أضف مستوى واحداً على الأقل.</p>
              </div>
            ) : (
              steps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-end"
                  data-testid={`step-row-${idx}`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {idx + 1}
                  </div>
                  <div className="grid flex-1 gap-2">
                    <Label className="text-xs">المسمى الوظيفي للمُعتمد</Label>
                    <Select value={step.jobTitle} onValueChange={(v) => updateStep(idx, { jobTitle: v })}>
                      <SelectTrigger data-testid={`select-jobtitle-${idx}`}>
                        <SelectValue placeholder="اختر المسمى الوظيفي" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeRoles.map((r) => (
                          <SelectItem key={r.id} value={r.titleAr} data-testid={`option-role-${r.id}-${idx}`}>
                            {r.titleAr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid flex-1 gap-2">
                    <Label className="text-xs">اسم المرحلة (اختياري)</Label>
                    <Input
                      value={step.stepName || ""}
                      onChange={(e) => updateStep(idx, { stepName: e.target.value })}
                      placeholder="مثال: اعتماد مدير الفرع"
                      data-testid={`input-stepname-${idx}`}
                    />
                  </div>
                  <div className="flex items-center gap-2 pb-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => moveStep(idx, -1)}
                      disabled={idx === 0}
                      data-testid={`button-up-${idx}`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => moveStep(idx, 1)}
                      disabled={idx === steps.length - 1}
                      data-testid={`button-down-${idx}`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => removeStep(idx)}
                      data-testid={`button-remove-${idx}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending}
            data-testid="button-save-workflow"
          >
            {saveMutation.isPending ? (
              <Loader2 className="ml-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="ml-1 h-4 w-4" />
            )}
            حفظ السلسلة
          </Button>
          {workflow?.id && (
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-workflow"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="ml-1 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="ml-1 h-4 w-4" />
              )}
              حذف السلسلة
            </Button>
          )}
        </div>
      </div>
    </Layout>
  );
}
