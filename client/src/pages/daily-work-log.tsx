import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { SearchableSelect, SearchableSelectOption } from "@/components/ui/searchable-select";
import {
  ArrowRight, Loader2, Save, Upload, X, Camera, Eye, Plus, Trash2,
  CheckCircle2, MapPin, Clock, Users, AlertTriangle, FileText,
  Image as ImageIcon, Briefcase, Wallet, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type {
  ConstructionProject, Contractor, ProjectDailyLog, ProjectDailyLogPhoto,
  DailyLogActivity, ProjectExpense, ConstructionContract, ContractItem,
} from "@shared/schema";

// ===== Constants =====
const formSchema = z.object({
  projectId: z.coerce.number().min(1, "المشروع مطلوب"),
  contractorId: z.coerce.number().optional().nullable(),
  logDate: z.string().min(1, "التاريخ مطلوب"),
  supervisorName: z.string().min(1, "اسم المشرف مطلوب"),
  supervisorRole: z.string().optional().nullable(),
  workLocation: z.string().optional().nullable(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  mainTrade: z.string().optional().nullable(),
  workDescription: z.string().min(1, "وصف الأعمال مطلوب"),
  workersCount: z.coerce.number().min(0).optional().nullable(),
  equipmentUsed: z.string().optional().nullable(),
  safetyIncidents: z.string().optional().nullable(),
  issues: z.string().optional().nullable(),
  nextDayPlan: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

const SUPERVISOR_ROLES = [
  { value: "engineer", label: "مهندس" },
  { value: "site_supervisor", label: "مشرف موقع" },
  { value: "project_manager", label: "مدير مشروع" },
  { value: "consultant", label: "استشاري" },
  { value: "owner_rep", label: "ممثل المالك" },
];

const PHOTO_TYPES = [
  { value: "before", label: "قبل العمل", color: "bg-blue-100 text-blue-700" },
  { value: "during", label: "أثناء العمل", color: "bg-amber-100 text-amber-700" },
  { value: "after", label: "بعد العمل", color: "bg-green-100 text-green-700" },
];

// أنواع التشطيبات للأعمال التجارية (كافيهات / مطاعم / محلات) — لا يوجد بناء سكني
const FINISHING_TRADES: Array<{ value: string; label: string }> = [
  { value: "paint", label: "دهانات" },
  { value: "tiling", label: "سيراميك وأرضيات" },
  { value: "hvac", label: "تكييف" },
  { value: "plumbing", label: "سباكة" },
  { value: "electrical", label: "كهرباء وإضاءة" },
  { value: "gypsum", label: "جبس وديكورات" },
  { value: "kitchen_steel", label: "مطبخ ستيل تجاري" },
  { value: "glass", label: "زجاج وواجهات" },
  { value: "mdf", label: "MDF ونجارة ديكور" },
  { value: "signage", label: "لافتات وعلامات" },
  { value: "other", label: "أخرى" },
];
const TRADE_LABEL: Record<string, string> = Object.fromEntries(
  FINISHING_TRADES.map((t) => [t.value, t.label]),
);

const COMMON_UNITS = ["م²", "م.ط", "م³", "عدد", "ساعة", "يوم", "كرتون", "كجم"];

const COMMON_LOCATIONS = [
  "صالة العملاء", "المطبخ", "الكاونتر", "الواجهة الخارجية", "الحمامات",
  "المخزن", "الباحة الخلفية", "السقف",
];

const EXPENSE_TYPES: Array<{ value: string; label: string; categoryHint?: string }> = [
  { value: "materials", label: "مواد ومستلزمات" },
  { value: "labor", label: "أجور يومية" },
  { value: "transport", label: "نقل ومواصلات" },
  { value: "tools", label: "أدوات ومعدات" },
  { value: "food", label: "ضيافة وطعام عمالة" },
  { value: "misc", label: "أخرى" },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "نقدي" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "check", label: "شيك" },
];

// ===== Types =====
interface DailyLogDetail extends ProjectDailyLog {
  photos?: ProjectDailyLogPhoto[];
  activities?: DailyLogActivity[];
  expenses?: ProjectExpense[];
}

interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
  photoType: string;
  uploading?: boolean;
  error?: boolean;
}

// ===== Component =====
export default function DailyWorkLogPage() {
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("basics");
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [defaultPhotoType, setDefaultPhotoType] = useState<string>("during");
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);

  const isEdit = !!params.id;
  const logId = params.id ? parseInt(params.id, 10) : null;

  const { data: existingLog } = useQuery<DailyLogDetail>({
    queryKey: [`/api/construction/daily-logs/${logId}`],
    enabled: !!logId,
  });

  const { data: projects = [] } = useQuery<ConstructionProject[]>({
    queryKey: ["/api/construction/projects"],
  });

  const { data: contractors = [] } = useQuery<Contractor[]>({
    queryKey: ["/api/construction/contractors"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectId: 0,
      contractorId: null,
      logDate: new Date().toISOString().slice(0, 10),
      supervisorName: user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || ""
        : "",
      supervisorRole: "",
      workLocation: "",
      startTime: "",
      endTime: "",
      mainTrade: "",
      workDescription: "",
      workersCount: 0,
      equipmentUsed: "",
      safetyIncidents: "",
      issues: "",
      nextDayPlan: "",
      notes: "",
    },
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (existingLog && isEdit) {
      form.reset({
        projectId: existingLog.projectId,
        contractorId: existingLog.contractorId ?? null,
        logDate: existingLog.logDate,
        supervisorName: existingLog.supervisorName,
        supervisorRole: existingLog.supervisorRole ?? "",
        workLocation: (existingLog as any).workLocation ?? "",
        startTime: (existingLog as any).startTime ?? "",
        endTime: (existingLog as any).endTime ?? "",
        mainTrade: (existingLog as any).mainTrade ?? "",
        workDescription: existingLog.workDescription,
        workersCount: existingLog.workersCount ?? 0,
        equipmentUsed: existingLog.equipmentUsed ?? "",
        safetyIncidents: (existingLog as any).safetyIncidents ?? "",
        issues: existingLog.issues ?? "",
        nextDayPlan: (existingLog as any).nextDayPlan ?? "",
        notes: existingLog.notes ?? "",
      });
    }
  }, [existingLog, isEdit, form]);

  // Refs for auto-save / unsaved-changes logic
  const lastAutoSaveAttemptRef = useRef<number>(0);
  const hasFinalSubmittedRef = useRef<boolean>(false);

  const saveMutation = useMutation({
    mutationFn: async (data: FormData & { status?: string }) => {
      const payload: any = {
        ...data,
        contractorId: data.contractorId || null,
      };
      if (isEdit && logId) {
        const res = await apiRequest("PATCH", `/api/construction/daily-logs/${logId}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/construction/daily-logs", payload);
      return res.json();
    },
    onSuccess: (created, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction/daily-logs"] });
      if (isEdit && logId) {
        queryClient.invalidateQueries({ queryKey: [`/api/construction/daily-logs/${logId}`] });
      }
      const wasSubmit = (variables as any)?.status === "submitted";
      if (wasSubmit) hasFinalSubmittedRef.current = true;
      toast({
        title: wasSubmit
          ? "تم اعتماد اليومية بنجاح"
          : isEdit ? "تم تحديث اليومية" : "تم حفظ المسودة",
      });
      if (!isEdit && created?.id) {
        setLocation(`/construction/daily-logs/${created.id}/edit`);
      }
    },
    onError: (err: any) => {
      let detail = "";
      const raw = err?.message || String(err || "");
      try {
        const idx = raw.indexOf("{");
        if (idx >= 0) {
          const parsed = JSON.parse(raw.slice(idx));
          detail = parsed?.error || parsed?.message || JSON.stringify(parsed.details || parsed);
        } else {
          detail = raw;
        }
      } catch {
        detail = raw;
      }
      toast({
        title: "فشل في حفظ اليومية",
        description: detail.slice(0, 400) || "خطأ غير معروف",
        variant: "destructive",
      });
      console.error("[daily-log save error]", err);
    },
  });

  const photoUploadMutation = useMutation({
    mutationFn: async (vars: { photoUrl: string; caption: string; photoType: string }) => {
      if (!logId) throw new Error("Save the log first");
      const res = await apiRequest("POST", `/api/construction/daily-logs/${logId}/photos`, vars);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/construction/daily-logs/${logId}`] });
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: number) => {
      const res = await apiRequest("DELETE", `/api/construction/daily-logs/photos/${photoId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/construction/daily-logs/${logId}`] });
      toast({ title: "تم حذف الصورة" });
    },
  });

  // ===== Photos =====
  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newPhotos: PendingPhoto[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      caption: "",
      photoType: defaultPhotoType,
    }));
    setPendingPhotos((prev) => [...prev, ...newPhotos]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }, [defaultPhotoType]);

  const updatePendingPhoto = (id: string, updates: Partial<PendingPhoto>) => {
    setPendingPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const removePendingPhoto = (id: string) => {
    setPendingPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const uploadAllPending = async () => {
    if (!logId) {
      toast({ title: "احفظ اليومية أولاً قبل رفع الصور", variant: "destructive" });
      setActiveTab("basics");
      return;
    }
    if (pendingPhotos.length === 0) return;

    let successCount = 0;
    let failCount = 0;
    pendingPhotos.forEach((p) => updatePendingPhoto(p.id, { uploading: true, error: false }));

    const uploadOne = async (photo: typeof pendingPhotos[number]) => {
      try {
        const fd = new FormData();
        fd.append("file", photo.file);
        const res = await fetch("/api/uploads?folder=daily-logs", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        if (!res.ok) throw new Error("upload failed");
        const { downloadUrl } = await res.json();
        await photoUploadMutation.mutateAsync({
          photoUrl: downloadUrl,
          caption: photo.caption,
          photoType: photo.photoType,
        });
        URL.revokeObjectURL(photo.previewUrl);
        successCount++;
      } catch {
        updatePendingPhoto(photo.id, { uploading: false, error: true });
        failCount++;
      }
    };

    const CONCURRENCY = 3;
    const queue = [...pendingPhotos];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (next) await uploadOne(next);
      }
    });
    await Promise.all(workers);
    setPendingPhotos((prev) => prev.filter((p) => p.error));
    toast({
      title: failCount === 0
        ? `تم رفع ${successCount} صورة بنجاح`
        : `${successCount} نجحت، ${failCount} فشلت`,
      variant: failCount === 0 ? "default" : "destructive",
    });
  };

  // ===== Auto-save =====
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);

  const handleValidationErrors = (errors: Record<string, any>) => {
    const requiredFieldTabs: Record<string, string> = {
      projectId: "basics",
      logDate: "basics",
      supervisorName: "basics",
      workDescription: "basics",
    };
    const firstField = Object.keys(errors)[0];
    const firstMsg = errors[firstField]?.message || "تأكد من تعبئة الحقول المطلوبة";
    const targetTab = requiredFieldTabs[firstField] || "basics";
    setActiveTab(targetTab);
    toast({
      title: "بيانات ناقصة",
      description: String(firstMsg),
      variant: "destructive",
    });
  };

  const onSaveDraft = () => {
    form.handleSubmit(
      (data) => saveMutation.mutate({ ...data, status: "draft" }),
      handleValidationErrors,
    )();
  };

  const onSubmitFinal = () => {
    form.handleSubmit(
      (data) => saveMutation.mutate({ ...data, status: "submitted" }),
      handleValidationErrors,
    )();
  };

  const photosCount = (existingLog?.photos?.length || 0) + pendingPhotos.length;
  const activitiesCount = existingLog?.activities?.length || 0;
  const expensesCount = existingLog?.expenses?.length || 0;
  const expensesTotal = (existingLog?.expenses || []).reduce(
    (s, e) => s + Number(e.amount || 0),
    0,
  );
  const isSubmitted =
    hasFinalSubmittedRef.current || (existingLog as any)?.status === "submitted";

  useEffect(() => {
    if (isSubmitted) return;
    const interval = setInterval(() => {
      if (hasFinalSubmittedRef.current) return;
      const now = Date.now();
      if (saveMutation.isPending) return;
      if (!form.formState.isDirty && pendingPhotos.length === 0) return;
      if (now - lastAutoSaveAttemptRef.current < 25_000) return;
      lastAutoSaveAttemptRef.current = now;
      form.handleSubmit(
        (data) => {
          saveMutation.mutate(
            { ...data, status: "draft" },
            {
              onSuccess: () => {
                setLastAutoSave(new Date());
                form.reset(data, { keepValues: true });
              },
            },
          );
        },
        () => {},
      )();
    }, 30_000);
    return () => clearInterval(interval);
  }, [form, saveMutation, isSubmitted, pendingPhotos.length]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasFinalSubmittedRef.current) return;
      if (isSubmitted) return;
      if (!form.formState.isDirty && pendingPhotos.length === 0) return;
      e.preventDefault();
      e.returnValue = "لديك تغييرات غير محفوظة. هل تريد المغادرة فعلاً؟";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [form.formState.isDirty, isSubmitted, pendingPhotos.length]);

  // ===== Picker options =====
  const projectOptions: SearchableSelectOption[] = useMemo(
    () => projects.map((p) => ({ value: String(p.id), label: p.title })),
    [projects],
  );
  const contractorOptions: SearchableSelectOption[] = useMemo(
    () => contractors.map((c) => ({ value: String(c.id), label: c.name })),
    [contractors],
  );

  const watchedProjectId = form.watch("projectId");
  const watchedContractorId = form.watch("contractorId");
  const watchedMainTrade = form.watch("mainTrade");

  const hasLegacyWorkItems =
    Array.isArray((existingLog as any)?.workItems) &&
    (existingLog as any).workItems.length > 0 &&
    activitiesCount === 0;

  // Maps for displaying contractor / contract item names in the activity table
  const contractorMap = useMemo(() => {
    const m = new Map<number, Contractor>();
    contractors.forEach((c) => m.set(c.id, c));
    return m;
  }, [contractors]);

  return (
    <Layout>
      <div className="container mx-auto p-3 sm:p-6 space-y-4 max-w-6xl" dir="rtl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/construction/daily-logs">
              <Button variant="ghost" size="icon" className="h-11 w-11" data-testid="button-back">
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-page-title">
                {isEdit ? "تعديل يومية أعمال" : "إضافة يومية أعمال"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isEdit
                  ? `${isSubmitted ? "معتمدة" : "مسودة"} • ${existingLog?.logDate || ""}`
                  : "تسجيل أنشطة الموقع وربطها بالمقاولين والعقود والمصروفات"}
              </p>
              {lastAutoSave && !isSubmitted && (
                <p className="text-xs text-green-600 mt-0.5" data-testid="text-last-autosave">
                  آخر حفظ تلقائي:{" "}
                  {lastAutoSave.toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isEdit && logId && (
              <Link href={`/construction/daily-logs/${logId}/print`}>
                <Button variant="outline" className="h-11" data-testid="button-print-log">
                  <Eye className="h-4 w-4 ml-1" />
                  معاينة
                </Button>
              </Link>
            )}
            <Button
              variant="outline"
              className="h-11"
              onClick={onSaveDraft}
              disabled={saveMutation.isPending}
              data-testid="button-save-draft"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Save className="h-4 w-4 ml-2" />
              )}
              حفظ مسودة
            </Button>
            <Button
              className="h-11"
              onClick={onSubmitFinal}
              disabled={saveMutation.isPending}
              data-testid="button-submit-final"
            >
              <CheckCircle2 className="h-4 w-4 ml-2" />
              اعتماد اليومية
            </Button>
          </div>
        </div>

        {hasLegacyWorkItems && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 flex items-start gap-2" data-testid="banner-legacy">
            <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">يومية قديمة بصيغة سابقة</p>
              <p className="text-xs mt-1">
                البنود المسجلة بالنظام القديم محفوظة وستظهر في النسخة المطبوعة. يمكنك إضافة أنشطة جديدة بصيغة الربط الذكي من تبويب «الأنشطة».
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-auto grid grid-cols-2 sm:grid-cols-4 gap-1 p-1">
            <TabsTrigger value="basics" className="h-12 flex-col sm:flex-row gap-1 text-xs sm:text-sm" data-testid="tab-basics">
              <FileText className="h-4 w-4" />
              <span>البيانات</span>
            </TabsTrigger>
            <TabsTrigger value="activities" className="h-12 flex-col sm:flex-row gap-1 text-xs sm:text-sm" data-testid="tab-activities">
              <Briefcase className="h-4 w-4" />
              <span>الأنشطة</span>
              {activitiesCount > 0 && (
                <Badge variant="secondary" className="ml-1">{activitiesCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="expenses" className="h-12 flex-col sm:flex-row gap-1 text-xs sm:text-sm" data-testid="tab-expenses">
              <Wallet className="h-4 w-4" />
              <span>المصروفات</span>
              {expensesCount > 0 && (
                <Badge variant="secondary" className="ml-1">{expensesCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="photos" className="h-12 flex-col sm:flex-row gap-1 text-xs sm:text-sm" data-testid="tab-photos">
              <Camera className="h-4 w-4" />
              <span>الصور</span>
              {photosCount > 0 && (
                <Badge variant="secondary" className="ml-1">{photosCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ===== TAB 1: Basics ===== */}
          <TabsContent value="basics" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" /> البيانات الأساسية
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-base mb-2 block">المشروع *</Label>
                    <SearchableSelect
                      value={watchedProjectId ? String(watchedProjectId) : ""}
                      onValueChange={(v) => form.setValue("projectId", parseInt(v, 10), { shouldDirty: true })}
                      options={projectOptions}
                      placeholder="اختر المشروع"
                      searchPlaceholder="ابحث عن مشروع..."
                      triggerClassName="h-12 text-base"
                      dataTestid="select-project"
                    />
                    {form.formState.errors.projectId && (
                      <p className="text-xs text-destructive mt-1">
                        {form.formState.errors.projectId.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base mb-2 block">التاريخ *</Label>
                    <Input
                      type="date"
                      className="h-12 text-base"
                      {...form.register("logDate")}
                      data-testid="input-log-date"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-base mb-2 block">اسم المشرف *</Label>
                    <Input
                      className="h-12 text-base"
                      {...form.register("supervisorName")}
                      placeholder="الاسم الكامل"
                      data-testid="input-supervisor-name"
                    />
                  </div>
                  <div>
                    <Label className="text-base mb-2 block">الصفة</Label>
                    <Select
                      value={form.watch("supervisorRole") || ""}
                      onValueChange={(v) => form.setValue("supervisorRole", v, { shouldDirty: true })}
                    >
                      <SelectTrigger className="h-12 text-base" data-testid="select-supervisor-role">
                        <SelectValue placeholder="اختر الصفة" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPERVISOR_ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value} className="text-base py-3">
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-base mb-2 block">المقاول الافتراضي لليوم (اختياري)</Label>
                  <SearchableSelect
                    value={watchedContractorId ? String(watchedContractorId) : ""}
                    onValueChange={(v) =>
                      form.setValue("contractorId", v ? parseInt(v, 10) : null, { shouldDirty: true })
                    }
                    options={contractorOptions}
                    placeholder="اختر المقاول الرئيسي اليوم"
                    searchPlaceholder="ابحث عن مقاول..."
                    triggerClassName="h-12 text-base"
                    clearable
                    onClear={() => form.setValue("contractorId", null, { shouldDirty: true })}
                    dataTestid="select-default-contractor"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    سيستخدم تلقائياً عند إضافة نشاط جديد، ويمكن تغييره لكل نشاط.
                  </p>
                </div>

                <Separator />

                <div>
                  <Label className="text-base mb-2 block">نوع التشطيب الرئيسي اليوم</Label>
                  <div className="flex flex-wrap gap-2">
                    {FINISHING_TRADES.map((t) => {
                      const active = watchedMainTrade === t.value;
                      return (
                        <Button
                          key={t.value}
                          type="button"
                          variant={active ? "default" : "outline"}
                          className="h-11"
                          onClick={() =>
                            form.setValue("mainTrade", active ? "" : t.value, { shouldDirty: true })
                          }
                          data-testid={`chip-trade-${t.value}`}
                        >
                          {t.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-base mb-2 flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> موقع التنفيذ في الموقع
                  </Label>
                  <Input
                    className="h-12 text-base"
                    {...form.register("workLocation")}
                    placeholder="مثال: صالة العملاء - جانب المدخل"
                    list="locations-list"
                    data-testid="input-work-location"
                  />
                  <datalist id="locations-list">
                    {COMMON_LOCATIONS.map((loc) => <option key={loc} value={loc} />)}
                  </datalist>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {COMMON_LOCATIONS.map((loc) => (
                      <Button
                        key={loc}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => form.setValue("workLocation", loc, { shouldDirty: true })}
                        data-testid={`chip-location-${loc}`}
                      >
                        {loc}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-base mb-2 flex items-center gap-1">
                      <Clock className="h-4 w-4" /> بداية العمل
                    </Label>
                    <Input
                      type="time"
                      className="h-12 text-base"
                      {...form.register("startTime")}
                      data-testid="input-start-time"
                    />
                  </div>
                  <div>
                    <Label className="text-base mb-2 flex items-center gap-1">
                      <Clock className="h-4 w-4" /> نهاية العمل
                    </Label>
                    <Input
                      type="time"
                      className="h-12 text-base"
                      {...form.register("endTime")}
                      data-testid="input-end-time"
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-base mb-2 block">ملخص أعمال اليوم *</Label>
                  <Textarea
                    className="text-base min-h-24"
                    {...form.register("workDescription")}
                    rows={3}
                    placeholder="ملخص عام للأعمال المنفذة في هذا اليوم..."
                    data-testid="textarea-work-description"
                  />
                  {form.formState.errors.workDescription && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.workDescription.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-base mb-2 flex items-center gap-1">
                      <Users className="h-4 w-4" /> عدد العمالة الحاضرة
                    </Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      className="h-12 text-base"
                      {...form.register("workersCount")}
                      data-testid="input-workers-count"
                    />
                  </div>
                  <div>
                    <Label className="text-base mb-2 block">المعدات المستخدمة</Label>
                    <Input
                      className="h-12 text-base"
                      {...form.register("equipmentUsed")}
                      placeholder="مثال: سقالة، كومبريسور دهان، منشار خشب"
                      data-testid="input-equipment"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" /> ملاحظات وحوادث
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-base mb-2 block">حوادث السلامة (إن وجدت)</Label>
                  <Textarea
                    className="text-base"
                    {...form.register("safetyIncidents")}
                    rows={2}
                    placeholder="اتركه فارغاً إذا لم تحدث أي حوادث"
                    data-testid="textarea-safety"
                  />
                </div>
                <div>
                  <Label className="text-base mb-2 block">المشاكل والمعوقات</Label>
                  <Textarea
                    className="text-base"
                    {...form.register("issues")}
                    rows={2}
                    placeholder="أي عقبات واجهت العمل اليوم..."
                    data-testid="textarea-issues"
                  />
                </div>
                <div>
                  <Label className="text-base mb-2 block">خطة عمل اليوم التالي</Label>
                  <Textarea
                    className="text-base"
                    {...form.register("nextDayPlan")}
                    rows={2}
                    placeholder="ما الذي سيُنفذ غداً..."
                    data-testid="textarea-next-day"
                  />
                </div>
                <div>
                  <Label className="text-base mb-2 block">ملاحظات إضافية</Label>
                  <Textarea
                    className="text-base"
                    {...form.register("notes")}
                    rows={2}
                    data-testid="textarea-notes"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button className="h-12" onClick={() => setActiveTab("activities")} data-testid="button-next-activities">
                التالي: الأنشطة ←
              </Button>
            </div>
          </TabsContent>

          {/* ===== TAB 2: Activities ===== */}
          <TabsContent value="activities" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5" /> أنشطة اليوم ({activitiesCount})
                </CardTitle>
                <Button
                  type="button"
                  className="h-11"
                  onClick={() => {
                    if (!isEdit || !logId) {
                      toast({ title: "احفظ المسودة أولاً قبل إضافة الأنشطة", variant: "destructive" });
                      setActiveTab("basics");
                      return;
                    }
                    if (!watchedProjectId) {
                      toast({ title: "اختر المشروع أولاً", variant: "destructive" });
                      setActiveTab("basics");
                      return;
                    }
                    setActivityDialogOpen(true);
                  }}
                  data-testid="button-add-activity"
                >
                  <Plus className="h-4 w-4 ml-1" />
                  إضافة نشاط
                </Button>
              </CardHeader>
              <CardContent>
                {!isEdit ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                    احفظ المسودة من تبويب «البيانات» أولاً ثم ارجع هنا لإضافة الأنشطة.
                  </div>
                ) : activitiesCount === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed rounded-lg text-muted-foreground">
                    <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>لم يتم إضافة أي نشاط بعد</p>
                    <p className="text-xs mt-1">
                      كل نشاط يربط بند عقد بكمية اليوم — ويُحدّث نسبة إنجاز البند تلقائياً.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(existingLog?.activities || []).map((act) => (
                      <ActivityRow
                        key={act.id}
                        activity={act}
                        contractorName={
                          act.contractorId ? contractorMap.get(act.contractorId)?.name : undefined
                        }
                        onDeleted={() =>
                          queryClient.invalidateQueries({
                            queryKey: [`/api/construction/daily-logs/${logId}`],
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="flex justify-between gap-2">
              <Button variant="outline" className="h-12" onClick={() => setActiveTab("basics")}>
                → السابق
              </Button>
              <Button className="h-12" onClick={() => setActiveTab("expenses")} data-testid="button-next-expenses">
                التالي: المصروفات ←
              </Button>
            </div>

            {logId && watchedProjectId ? (
              <ActivityDialog
                open={activityDialogOpen}
                onOpenChange={setActivityDialogOpen}
                dailyLogId={logId}
                projectId={watchedProjectId}
                defaultContractorId={watchedContractorId ?? null}
                defaultTrade={watchedMainTrade || ""}
                contractorOptions={contractorOptions}
                onSaved={() =>
                  queryClient.invalidateQueries({
                    queryKey: [`/api/construction/daily-logs/${logId}`],
                  })
                }
              />
            ) : null}
          </TabsContent>

          {/* ===== TAB 3: Expenses ===== */}
          <TabsContent value="expenses" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wallet className="h-5 w-5" /> مصروفات اليوم ({expensesCount})
                </CardTitle>
                <Button
                  type="button"
                  className="h-11"
                  onClick={() => {
                    if (!isEdit || !logId) {
                      toast({ title: "احفظ المسودة أولاً قبل إضافة المصروفات", variant: "destructive" });
                      setActiveTab("basics");
                      return;
                    }
                    setExpenseDialogOpen(true);
                  }}
                  data-testid="button-add-expense"
                >
                  <Plus className="h-4 w-4 ml-1" />
                  إضافة مصروف
                </Button>
              </CardHeader>
              <CardContent>
                {expensesCount > 0 && (
                  <div className="mb-3 flex justify-between items-center bg-muted/50 rounded-lg p-3">
                    <span className="text-sm text-muted-foreground">إجمالي مصروفات اليوم</span>
                    <span className="text-lg font-bold" data-testid="text-expenses-total">
                      {expensesTotal.toLocaleString("ar-SA-u-nu-latn", { maximumFractionDigits: 2 })} ر.س
                    </span>
                  </div>
                )}
                {!isEdit ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                    احفظ المسودة من تبويب «البيانات» أولاً ثم ارجع هنا لإضافة المصروفات.
                  </div>
                ) : expensesCount === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed rounded-lg text-muted-foreground">
                    <Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>لا توجد مصروفات مسجلة لهذه اليومية</p>
                    <p className="text-xs mt-1">
                      تُرحّل تلقائياً إلى مصروفات المشروع وتظهر في كشف المقاول إذا حُدِّد.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(existingLog?.expenses || []).map((exp) => (
                      <ExpenseRow
                        key={exp.id}
                        expense={exp}
                        contractorName={
                          exp.contractorId ? contractorMap.get(exp.contractorId)?.name : undefined
                        }
                        onDeleted={() =>
                          queryClient.invalidateQueries({
                            queryKey: [`/api/construction/daily-logs/${logId}`],
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="flex justify-between gap-2">
              <Button variant="outline" className="h-12" onClick={() => setActiveTab("activities")}>
                → السابق
              </Button>
              <Button className="h-12" onClick={() => setActiveTab("photos")} data-testid="button-next-photos">
                التالي: الصور ←
              </Button>
            </div>

            {logId ? (
              <ExpenseDialog
                open={expenseDialogOpen}
                onOpenChange={setExpenseDialogOpen}
                dailyLogId={logId}
                defaultContractorId={watchedContractorId ?? null}
                logDate={form.watch("logDate")}
                contractorOptions={contractorOptions}
                onSaved={() =>
                  queryClient.invalidateQueries({
                    queryKey: [`/api/construction/daily-logs/${logId}`],
                  })
                }
              />
            ) : null}
          </TabsContent>

          {/* ===== TAB 4: Photos ===== */}
          <TabsContent value="photos" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Camera className="h-5 w-5" /> صور الموقع ({photosCount})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isEdit && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                    احفظ المسودة أولاً ثم ارفع الصور (اضغط "حفظ مسودة" في الأعلى).
                  </div>
                )}

                <div>
                  <Label className="text-sm mb-2 block">نوع الصور القادمة:</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {PHOTO_TYPES.map((t) => {
                      const active = defaultPhotoType === t.value;
                      return (
                        <Button
                          key={t.value}
                          type="button"
                          variant={active ? "default" : "outline"}
                          className="h-12"
                          onClick={() => setDefaultPhotoType(t.value)}
                          data-testid={`button-default-photo-type-${t.value}`}
                        >
                          {t.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleFilesSelected(e.target.files)}
                    data-testid="input-camera"
                  />
                  <Button
                    type="button"
                    className="h-16 text-base"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={!isEdit}
                    data-testid="button-camera"
                  >
                    <Camera className="h-6 w-6 ml-2" />
                    التقط من الكاميرا
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFilesSelected(e.target.files)}
                    data-testid="input-gallery"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-16 text-base"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!isEdit}
                    data-testid="button-gallery"
                  >
                    <ImageIcon className="h-6 w-6 ml-2" />
                    اختر من المعرض
                  </Button>
                </div>

                {pendingPhotos.length > 0 && (
                  <div className="border-2 border-dashed border-primary/30 rounded-lg p-3 space-y-3 bg-primary/5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">في انتظار الرفع ({pendingPhotos.length})</h3>
                      <Button
                        type="button"
                        size="sm"
                        className="h-9"
                        onClick={uploadAllPending}
                        disabled={pendingPhotos.some((p) => p.uploading)}
                        data-testid="button-upload-all"
                      >
                        {pendingPhotos.some((p) => p.uploading) ? (
                          <Loader2 className="h-4 w-4 animate-spin ml-1" />
                        ) : (
                          <Upload className="h-4 w-4 ml-1" />
                        )}
                        رفع الكل
                      </Button>
                    </div>
                    <div className="kpi-grid">
                      {pendingPhotos.map((p) => (
                        <div key={p.id} className="border rounded-lg overflow-hidden bg-background relative" data-testid={`pending-photo-${p.id}`}>
                          <img src={p.previewUrl} alt="" className="w-full h-32 object-cover" />
                          {p.uploading && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-white" />
                            </div>
                          )}
                          {p.error && (
                            <div className="absolute top-1 right-1">
                              <Badge variant="destructive" className="text-xs">فشل</Badge>
                            </div>
                          )}
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className="absolute top-1 left-1 h-7 w-7"
                            onClick={() => removePendingPhoto(p.id)}
                            data-testid={`button-remove-pending-${p.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <div className="p-2 space-y-1">
                            <Select
                              value={p.photoType}
                              onValueChange={(v) => updatePendingPhoto(p.id, { photoType: v })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PHOTO_TYPES.map((t) => (
                                  <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              className="h-8 text-xs"
                              placeholder="وصف..."
                              value={p.caption}
                              onChange={(e) => updatePendingPhoto(p.id, { caption: e.target.value })}
                              data-testid={`input-pending-caption-${p.id}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {existingLog?.photos && existingLog.photos.length > 0 ? (
                  <div>
                    <h3 className="font-semibold mb-2">الصور المرفوعة ({existingLog.photos.length})</h3>
                    <div className="kpi-grid">
                      {existingLog.photos.map((photo) => {
                        const typeInfo = PHOTO_TYPES.find((t) => t.value === photo.photoType);
                        return (
                          <div
                            key={photo.id}
                            className="relative border rounded-lg overflow-hidden group bg-background"
                            data-testid={`photo-${photo.id}`}
                          >
                            <img
                              src={photo.photoUrl}
                              alt={photo.caption || "صورة"}
                              className="w-full h-40 object-cover"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCBmaWxsPSIjZWVlIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIvPjwvc3ZnPg==";
                              }}
                            />
                            <div className="p-2 bg-background">
                              <Badge className={`text-xs ${typeInfo?.color || ""}`}>
                                {typeInfo?.label || photo.photoType}
                              </Badge>
                              {photo.caption && (
                                <p className="text-xs mt-1 truncate" title={photo.caption}>
                                  {photo.caption}
                                </p>
                              )}
                            </div>
                            <Button
                              size="icon"
                              variant="destructive"
                              className="absolute top-1 left-1 h-9 w-9 shadow-lg"
                              onClick={() => {
                                if (confirm("حذف هذه الصورة؟")) {
                                  deletePhotoMutation.mutate(photo.id);
                                }
                              }}
                              data-testid={`button-delete-photo-${photo.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  pendingPhotos.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                      <Camera className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>لم يتم إضافة صور بعد</p>
                      {isEdit && (
                        <p className="text-xs mt-1">استخدم الكاميرا أو المعرض في الأعلى</p>
                      )}
                    </div>
                  )
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between gap-2">
              <Button variant="outline" className="h-12" onClick={() => setActiveTab("expenses")}>
                → السابق
              </Button>
              <Button className="h-12" onClick={onSubmitFinal} disabled={saveMutation.isPending} data-testid="button-final-submit">
                <CheckCircle2 className="h-4 w-4 ml-2" />
                اعتماد اليومية
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

// ============================================================
// ActivityRow — single activity card with delete
// ============================================================
function ActivityRow({
  activity,
  contractorName,
  onDeleted,
}: {
  activity: DailyLogActivity;
  contractorName?: string;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const onDelete = async () => {
    if (!confirm("حذف هذا النشاط؟ سيتم تعديل نسبة إنجاز البند تلقائياً.")) return;
    setDeleting(true);
    try {
      const res = await apiRequest("DELETE", `/api/construction/daily-logs/activities/${activity.id}`);
      await res.json();
      toast({ title: "تم حذف النشاط" });
      onDeleted();
    } catch {
      toast({ title: "فشل في حذف النشاط", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="border rounded-lg p-3 bg-background" data-testid={`activity-row-${activity.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {activity.tradeType && (
              <Badge variant="secondary" className="text-xs">{TRADE_LABEL[activity.tradeType] || activity.tradeType}</Badge>
            )}
            {contractorName && (
              <Badge variant="outline" className="text-xs">{contractorName}</Badge>
            )}
            {activity.completionStatus === "completed" && (
              <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100">مكتمل</Badge>
            )}
          </div>
          <p className="font-medium" data-testid={`text-activity-desc-${activity.id}`}>
            {activity.description}
          </p>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {activity.quantityToday != null && (
              <span>
                الكمية اليوم: <span className="font-semibold text-foreground">{activity.quantityToday}</span>
                {activity.unit ? ` ${activity.unit}` : ""}
              </span>
            )}
            {activity.totalCost != null && Number(activity.totalCost) > 0 && (
              <span>
                التكلفة: <span className="font-semibold text-foreground">
                  {Number(activity.totalCost).toLocaleString("ar-SA-u-nu-latn")}
                </span> ر.س
              </span>
            )}
          </div>
          {activity.notes && (
            <p className="text-xs text-muted-foreground border-t pt-1 mt-1">{activity.notes}</p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-destructive flex-shrink-0"
          onClick={onDelete}
          disabled={deleting}
          data-testid={`button-delete-activity-${activity.id}`}
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// ActivityDialog — add new activity (contractor → contract → item)
// ============================================================
function ActivityDialog({
  open,
  onOpenChange,
  dailyLogId,
  projectId,
  defaultContractorId,
  defaultTrade,
  contractorOptions,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dailyLogId: number;
  projectId: number;
  defaultContractorId: number | null;
  defaultTrade: string;
  contractorOptions: SearchableSelectOption[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [contractorId, setContractorId] = useState<number | null>(defaultContractorId);
  const [contractId, setContractId] = useState<number | null>(null);
  const [contractItemId, setContractItemId] = useState<number | null>(null);
  const [tradeType, setTradeType] = useState<string>(defaultTrade);
  const [description, setDescription] = useState("");
  const [quantityToday, setQuantityToday] = useState<string>("");
  const [unit, setUnit] = useState("");
  const [unitCost, setUnitCost] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setContractorId(defaultContractorId);
      setContractId(null);
      setContractItemId(null);
      setTradeType(defaultTrade);
      setDescription("");
      setQuantityToday("");
      setUnit("");
      setUnitCost("");
      setNotes("");
    }
  }, [open, defaultContractorId, defaultTrade]);

  // Load contracts for the selected project (filtered to contractor below in UI)
  const { data: projectContracts = [] } = useQuery<ConstructionContract[]>({
    queryKey: [`/api/construction/contracts?projectId=${projectId}`],
    enabled: open && !!projectId,
  });

  // Load contract items when a contract is picked
  const { data: contractItems = [] } = useQuery<ContractItem[]>({
    queryKey: [`/api/construction/contracts/${contractId}/items`],
    enabled: open && !!contractId,
  });

  const filteredContracts = useMemo(() => {
    if (!contractorId) return projectContracts;
    return projectContracts.filter((c) => c.contractorId === contractorId);
  }, [projectContracts, contractorId]);

  const contractOptions: SearchableSelectOption[] = useMemo(
    () => filteredContracts.map((c) => ({
      value: String(c.id),
      label: c.contractNumber || `عقد #${c.id}`,
      sublabel: c.title || undefined,
    })),
    [filteredContracts],
  );

  const itemOptions: SearchableSelectOption[] = useMemo(
    () => contractItems.map((it) => {
      const remaining = Math.max(0, Number(it.quantity || 0) - Number(it.completedQuantity || 0));
      return {
        value: String(it.id),
        label: it.description,
        sublabel: `إجمالي: ${it.quantity} ${it.unit || ""} • منفذ: ${it.completedQuantity || 0}`,
        badge: remaining > 0 ? `متبقي ${remaining}` : "مكتمل",
        badgeVariant: remaining > 0 ? "secondary" : "default",
      };
    }),
    [contractItems],
  );

  // When picking a contract item, auto-fill description / unit / unit cost
  const onPickItem = (idStr: string) => {
    const id = parseInt(idStr, 10);
    setContractItemId(id);
    const item = contractItems.find((it) => it.id === id);
    if (item) {
      if (!description) setDescription(item.description);
      if (!unit) setUnit(item.unit || "");
      if (!unitCost) setUnitCost(String(item.unitPrice || ""));
    }
  };

  const computedTotal = useMemo(() => {
    const q = parseFloat(quantityToday);
    const c = parseFloat(unitCost);
    if (!isFinite(q) || !isFinite(c)) return 0;
    return q * c;
  }, [quantityToday, unitCost]);

  const onSubmit = async () => {
    if (!description.trim()) {
      toast({ title: "وصف النشاط مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        contractorId: contractorId || null,
        contractId: contractId || null,
        contractItemId: contractItemId || null,
        tradeType: tradeType || null,
        description: description.trim(),
        quantityToday: quantityToday ? parseFloat(quantityToday) : 0,
        unit: unit || null,
        unitCost: unitCost ? parseFloat(unitCost) : null,
        totalCost: computedTotal > 0 ? computedTotal : null,
        notes: notes || null,
      };
      const res = await apiRequest("POST", `/api/construction/daily-logs/${dailyLogId}/activities`, payload);
      await res.json();
      toast({ title: "تم إضافة النشاط" });
      onSaved();
      onOpenChange(false);
    } catch {
      toast({ title: "فشل في إضافة النشاط", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إضافة نشاط جديد</DialogTitle>
          <DialogDescription>
            اربط النشاط بمقاول وبند عقد لتحديث نسبة الإنجاز تلقائياً.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-sm mb-1 block">المقاول</Label>
            <SearchableSelect
              value={contractorId ? String(contractorId) : ""}
              onValueChange={(v) => {
                setContractorId(v ? parseInt(v, 10) : null);
                setContractId(null);
                setContractItemId(null);
              }}
              options={contractorOptions}
              placeholder="اختر المقاول"
              searchPlaceholder="ابحث..."
              triggerClassName="h-11"
              clearable
              onClear={() => {
                setContractorId(null);
                setContractId(null);
                setContractItemId(null);
              }}
              dataTestid="dialog-select-contractor"
            />
          </div>

          <div>
            <Label className="text-sm mb-1 block">العقد</Label>
            <SearchableSelect
              value={contractId ? String(contractId) : ""}
              onValueChange={(v) => {
                setContractId(v ? parseInt(v, 10) : null);
                setContractItemId(null);
              }}
              options={contractOptions}
              placeholder={
                filteredContracts.length === 0
                  ? "لا يوجد عقود لهذا المقاول في هذا المشروع"
                  : "اختر العقد"
              }
              searchPlaceholder="ابحث في العقود..."
              triggerClassName="h-11"
              disabled={contractOptions.length === 0}
              clearable
              onClear={() => {
                setContractId(null);
                setContractItemId(null);
              }}
              dataTestid="dialog-select-contract"
            />
          </div>

          <div>
            <Label className="text-sm mb-1 block">بند العقد</Label>
            <SearchableSelect
              value={contractItemId ? String(contractItemId) : ""}
              onValueChange={onPickItem}
              options={itemOptions}
              placeholder={
                contractId
                  ? itemOptions.length === 0
                    ? "لا يوجد بنود لهذا العقد"
                    : "اختر بند العقد"
                  : "اختر العقد أولاً"
              }
              searchPlaceholder="ابحث في البنود..."
              triggerClassName="h-11"
              disabled={!contractId || itemOptions.length === 0}
              clearable
              onClear={() => setContractItemId(null)}
              dataTestid="dialog-select-item"
            />
            <p className="text-xs text-muted-foreground mt-1">
              اختياري — اتركه فارغاً للأنشطة غير المرتبطة بعقد.
            </p>
          </div>

          <div>
            <Label className="text-sm mb-1 block">نوع التشطيب</Label>
            <Select value={tradeType} onValueChange={setTradeType}>
              <SelectTrigger className="h-11" data-testid="dialog-select-trade">
                <SelectValue placeholder="اختر النوع" />
              </SelectTrigger>
              <SelectContent>
                {FINISHING_TRADES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm mb-1 block">وصف النشاط *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="مثال: دهان وجه أول للجدران الجانبية"
              data-testid="dialog-input-description"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-sm mb-1 block">كمية اليوم</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={quantityToday}
                onChange={(e) => setQuantityToday(e.target.value)}
                className="h-11"
                data-testid="dialog-input-qty"
              />
            </div>
            <div>
              <Label className="text-sm mb-1 block">الوحدة</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                list="dialog-units-list"
                className="h-11"
                placeholder="م²"
                data-testid="dialog-input-unit"
              />
              <datalist id="dialog-units-list">
                {COMMON_UNITS.map((u) => <option key={u} value={u} />)}
              </datalist>
            </div>
            <div>
              <Label className="text-sm mb-1 block">سعر الوحدة (ر.س)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="h-11"
                data-testid="dialog-input-unit-cost"
              />
            </div>
          </div>

          {computedTotal > 0 && (
            <div className="bg-muted rounded p-2 text-sm flex justify-between">
              <span className="text-muted-foreground">إجمالي تكلفة النشاط</span>
              <span className="font-bold">{computedTotal.toLocaleString("ar-SA-u-nu-latn")} ر.س</span>
            </div>
          )}

          <div>
            <Label className="text-sm mb-1 block">ملاحظات</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              data-testid="dialog-input-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="dialog-button-cancel">
            إلغاء
          </Button>
          <Button onClick={onSubmit} disabled={saving} data-testid="dialog-button-save">
            {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            حفظ النشاط
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// ExpenseRow — single in-site expense card
// ============================================================
function ExpenseRow({
  expense,
  contractorName,
  onDeleted,
}: {
  expense: ProjectExpense;
  contractorName?: string;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const onDelete = async () => {
    if (!confirm("حذف هذا المصروف؟")) return;
    setDeleting(true);
    try {
      const res = await apiRequest("DELETE", `/api/construction/daily-logs/expenses/${expense.id}`);
      await res.json();
      toast({ title: "تم حذف المصروف" });
      onDeleted();
    } catch {
      toast({ title: "فشل في حذف المصروف", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const paymentLabel = PAYMENT_METHODS.find((p) => p.value === expense.paymentMethod)?.label;

  return (
    <div className="border rounded-lg p-3 bg-background" data-testid={`expense-row-${expense.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {contractorName && (
              <Badge variant="outline" className="text-xs">{contractorName}</Badge>
            )}
            {paymentLabel && (
              <Badge variant="secondary" className="text-xs">{paymentLabel}</Badge>
            )}
          </div>
          <p className="font-medium" data-testid={`text-expense-desc-${expense.id}`}>
            {expense.description}
          </p>
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <span>
              المبلغ: <span className="font-semibold text-foreground">
                {Number(expense.amount).toLocaleString("ar-SA-u-nu-latn")}
              </span> ر.س
            </span>
            {expense.beneficiaryName && (
              <span>المستفيد: {expense.beneficiaryName}</span>
            )}
          </div>
          {expense.notes && (
            <p className="text-xs text-muted-foreground border-t pt-1 mt-1">{expense.notes}</p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-destructive flex-shrink-0"
          onClick={onDelete}
          disabled={deleting}
          data-testid={`button-delete-expense-${expense.id}`}
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// ExpenseDialog — add new in-site expense
// ============================================================
function ExpenseDialog({
  open,
  onOpenChange,
  dailyLogId,
  defaultContractorId,
  logDate,
  contractorOptions,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dailyLogId: number;
  defaultContractorId: number | null;
  logDate?: string;
  contractorOptions: SearchableSelectOption[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [expenseType, setExpenseType] = useState<string>("materials");
  const [contractorId, setContractorId] = useState<number | null>(defaultContractorId);
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setExpenseType("materials");
      setContractorId(defaultContractorId);
      setAmount("");
      setDescription("");
      setBeneficiary("");
      setPaymentMethod("cash");
      setNotes("");
    }
  }, [open, defaultContractorId]);

  const onSubmit = async () => {
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) {
      toast({ title: "أدخل مبلغاً صحيحاً", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "وصف المصروف مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const expenseTypeLabel = EXPENSE_TYPES.find((t) => t.value === expenseType)?.label || expenseType;
      const payload: any = {
        contractorId: contractorId || null,
        amount: amt,
        description: `[${expenseTypeLabel}] ${description.trim()}`,
        beneficiaryName: beneficiary || null,
        paymentMethod,
        notes: notes || null,
        expenseDate: logDate,
      };
      const res = await apiRequest("POST", `/api/construction/daily-logs/${dailyLogId}/expenses`, payload);
      await res.json();
      toast({ title: "تم تسجيل المصروف" });
      onSaved();
      onOpenChange(false);
    } catch {
      toast({ title: "فشل في تسجيل المصروف", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تسجيل مصروف موقع</DialogTitle>
          <DialogDescription>
            يُرحّل المصروف تلقائياً إلى مصروفات المشروع وكشف المقاول إذا حُدِّد.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-sm mb-2 block">نوع المصروف</Label>
            <div className="flex flex-wrap gap-2">
              {EXPENSE_TYPES.map((t) => {
                const active = expenseType === t.value;
                return (
                  <Button
                    key={t.value}
                    type="button"
                    variant={active ? "default" : "outline"}
                    className="h-10"
                    onClick={() => setExpenseType(t.value)}
                    data-testid={`dialog-chip-expense-type-${t.value}`}
                  >
                    {t.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm mb-1 block">المبلغ (ر.س) *</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11"
                data-testid="dialog-input-expense-amount"
              />
            </div>
            <div>
              <Label className="text-sm mb-1 block">طريقة الدفع</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-11" data-testid="dialog-select-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-sm mb-1 block">الوصف *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: 5 جالون دهان أبيض"
              className="h-11"
              data-testid="dialog-input-expense-desc"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-sm mb-1 block">المقاول (اختياري)</Label>
              <SearchableSelect
                value={contractorId ? String(contractorId) : ""}
                onValueChange={(v) => setContractorId(v ? parseInt(v, 10) : null)}
                options={contractorOptions}
                placeholder="بدون مقاول"
                searchPlaceholder="ابحث..."
                triggerClassName="h-11"
                clearable
                onClear={() => setContractorId(null)}
                dataTestid="dialog-select-expense-contractor"
              />
            </div>
            <div>
              <Label className="text-sm mb-1 block">المستفيد / المورد</Label>
              <Input
                value={beneficiary}
                onChange={(e) => setBeneficiary(e.target.value)}
                placeholder="اسم المورد أو الموظف"
                className="h-11"
                data-testid="dialog-input-beneficiary"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm mb-1 block">ملاحظات</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              data-testid="dialog-input-expense-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="dialog-button-expense-cancel">
            إلغاء
          </Button>
          <Button onClick={onSubmit} disabled={saving} data-testid="dialog-button-expense-save">
            {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            حفظ المصروف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
