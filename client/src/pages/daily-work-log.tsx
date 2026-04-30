import { useEffect, useState, useRef, useCallback } from "react";
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
  ArrowRight, Loader2, Save, Upload, X, Camera, Eye, Plus, Trash2,
  CheckCircle2, MapPin, Clock, Users, HardHat, AlertTriangle, FileText,
  Sun, Cloud, CloudRain, Wind, Thermometer, Image as ImageIcon, ListTodo,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { ConstructionProject, Contractor, ProjectDailyLog, ProjectDailyLogPhoto } from "@shared/schema";

interface WorkItem {
  type: string;
  description: string;
  quantity?: number;
  unit?: string;
}

interface WorkerRole {
  role: string;
  count: number;
}

const formSchema = z.object({
  projectId: z.coerce.number().min(1, "المشروع مطلوب"),
  contractorId: z.coerce.number().optional().nullable(),
  logDate: z.string().min(1, "التاريخ مطلوب"),
  supervisorName: z.string().min(1, "اسم المشرف مطلوب"),
  supervisorRole: z.string().optional().nullable(),
  workLocation: z.string().optional().nullable(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  workDescription: z.string().min(1, "وصف الأعمال مطلوب"),
  progressToday: z.coerce.number().min(0).max(100).optional().nullable(),
  workersCount: z.coerce.number().min(0).optional().nullable(),
  equipmentUsed: z.string().optional().nullable(),
  weather: z.string().optional().nullable(),
  temperature: z.string().optional().nullable(),
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

const WEATHER_OPTIONS = [
  { value: "sunny", label: "مشمس", icon: Sun },
  { value: "cloudy", label: "غائم", icon: Cloud },
  { value: "rainy", label: "ممطر", icon: CloudRain },
  { value: "hot", label: "حار جداً", icon: Thermometer },
  { value: "windy", label: "رياح شديدة", icon: Wind },
  { value: "dusty", label: "أتربة", icon: Wind },
];

const PHOTO_TYPES = [
  { value: "before", label: "قبل العمل", color: "bg-blue-100 text-blue-700" },
  { value: "during", label: "أثناء العمل", color: "bg-amber-100 text-amber-700" },
  { value: "after", label: "بعد العمل", color: "bg-green-100 text-green-700" },
];

const COMMON_WORK_TYPES = [
  "أعمال خرسانية", "أعمال حدادة", "أعمال نجارة", "أعمال بناء",
  "أعمال كهرباء", "أعمال سباكة", "أعمال تشطيبات", "أعمال دهانات",
  "أعمال أرضيات", "أعمال عزل", "أعمال تكييف", "أعمال حفر وردم",
];

const COMMON_UNITS = ["م²", "م³", "م.ط", "عدد", "طن", "كجم", "لتر", "ساعة"];

const COMMON_LOCATIONS = [
  "الطابق الأرضي", "الطابق الأول", "الطابق الثاني", "الطابق الثالث",
  "السقف", "القبو", "الواجهة", "المدخل الرئيسي", "محيط المبنى", "الفناء الخارجي",
];

const WORKER_ROLES = [
  "مهندس", "مشرف", "نجار", "حداد", "بنّاء", "عامل بناء",
  "كهربائي", "سباك", "دهان", "ميكانيكي", "سائق", "مساعد عام",
];

interface DailyLogWithPhotos extends ProjectDailyLog {
  photos?: ProjectDailyLogPhoto[];
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

export default function DailyWorkLogPage() {
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("basics");
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [workers, setWorkers] = useState<WorkerRole[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [defaultPhotoType, setDefaultPhotoType] = useState<string>("during");

  const isEdit = !!params.id;
  const logId = params.id ? parseInt(params.id, 10) : null;

  const { data: existingLog } = useQuery<DailyLogWithPhotos>({
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
      supervisorName: user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "" : "",
      supervisorRole: "",
      workLocation: "",
      startTime: "",
      endTime: "",
      workDescription: "",
      progressToday: 0,
      workersCount: 0,
      equipmentUsed: "",
      weather: "",
      temperature: "",
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
        workDescription: existingLog.workDescription,
        progressToday: existingLog.progressToday ?? 0,
        workersCount: existingLog.workersCount ?? 0,
        equipmentUsed: existingLog.equipmentUsed ?? "",
        weather: existingLog.weather ?? "",
        temperature: (existingLog as any).temperature ?? "",
        safetyIncidents: (existingLog as any).safetyIncidents ?? "",
        issues: existingLog.issues ?? "",
        nextDayPlan: (existingLog as any).nextDayPlan ?? "",
        notes: existingLog.notes ?? "",
      });
      const wi = (existingLog as any).workItems;
      if (Array.isArray(wi)) setWorkItems(wi);
      const wb = (existingLog as any).workerBreakdown;
      if (Array.isArray(wb)) setWorkers(wb);
    }
  }, [existingLog, isEdit, form]);

  // Auto-sum workers count when breakdown changes
  useEffect(() => {
    if (workers.length > 0) {
      const total = workers.reduce((s, w) => s + (Number(w.count) || 0), 0);
      form.setValue("workersCount", total);
    }
  }, [workers, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: FormData & { status?: string }) => {
      const payload = {
        ...data,
        contractorId: data.contractorId || null,
        workItems: workItems.length > 0 ? workItems : null,
        workerBreakdown: workers.length > 0 ? workers : null,
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
      const wasSubmit = (variables as any)?.status === "submitted";
      toast({
        title: wasSubmit
          ? "تم اعتماد اليومية بنجاح"
          : isEdit ? "تم تحديث اليومية" : "تم حفظ المسودة",
      });
      if (!isEdit && created?.id) {
        setLocation(`/construction/daily-logs/${created.id}/edit`);
      }
    },
    onError: () => {
      toast({ title: "فشل في حفظ اليومية", variant: "destructive" });
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

  // Multi-file selection (gallery / camera)
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
    for (const photo of pendingPhotos) {
      updatePendingPhoto(photo.id, { uploading: true, error: false });
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
    }
    // Remove successful uploads
    setPendingPhotos((prev) => prev.filter((p) => p.error));
    toast({
      title: failCount === 0
        ? `تم رفع ${successCount} صورة بنجاح`
        : `${successCount} نجحت، ${failCount} فشلت`,
      variant: failCount === 0 ? "default" : "destructive",
    });
  };

  // Work items helpers
  const addWorkItem = () => {
    setWorkItems((prev) => [...prev, { type: "", description: "", quantity: undefined, unit: "" }]);
  };
  const updateWorkItem = (idx: number, updates: Partial<WorkItem>) => {
    setWorkItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...updates } : it)));
  };
  const removeWorkItem = (idx: number) => {
    setWorkItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Worker breakdown helpers
  const addWorker = () => {
    setWorkers((prev) => [...prev, { role: "", count: 1 }]);
  };
  const updateWorker = (idx: number, updates: Partial<WorkerRole>) => {
    setWorkers((prev) => prev.map((w, i) => (i === idx ? { ...w, ...updates } : w)));
  };
  const removeWorker = (idx: number) => {
    setWorkers((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSaveDraft = () => {
    form.handleSubmit((data) => saveMutation.mutate({ ...data, status: "draft" }))();
  };

  const onSubmitFinal = () => {
    form.handleSubmit((data) => saveMutation.mutate({ ...data, status: "submitted" }))();
  };

  const photosCount = (existingLog?.photos?.length || 0) + pendingPhotos.length;
  const isSubmitted = (existingLog as any)?.status === "submitted";

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
                  : "تسجيل ديناميكي للأعمال المنفذة في الموقع"}
              </p>
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-auto grid grid-cols-2 sm:grid-cols-4 gap-1 p-1">
            <TabsTrigger value="basics" className="h-12 flex-col sm:flex-row gap-1 text-xs sm:text-sm" data-testid="tab-basics">
              <FileText className="h-4 w-4" />
              <span>البيانات الأساسية</span>
            </TabsTrigger>
            <TabsTrigger value="work" className="h-12 flex-col sm:flex-row gap-1 text-xs sm:text-sm" data-testid="tab-work">
              <ListTodo className="h-4 w-4" />
              <span>الأعمال المنفذة</span>
              {workItems.length > 0 && (
                <Badge variant="secondary" className="ml-1">{workItems.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="workforce" className="h-12 flex-col sm:flex-row gap-1 text-xs sm:text-sm" data-testid="tab-workforce">
              <Users className="h-4 w-4" />
              <span>العمالة والمعدات</span>
              {workers.length > 0 && (
                <Badge variant="secondary" className="ml-1">{workers.length}</Badge>
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

          {/* TAB 1: Basics */}
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
                    <Select
                      value={form.watch("projectId")?.toString() || ""}
                      onValueChange={(v) => form.setValue("projectId", parseInt(v, 10))}
                    >
                      <SelectTrigger className="h-12 text-base" data-testid="select-project">
                        <SelectValue placeholder="اختر المشروع" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id.toString()} className="text-base py-3">
                            {p.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      onValueChange={(v) => form.setValue("supervisorRole", v)}
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
                  <Label className="text-base mb-2 block">المقاول المنفذ</Label>
                  <Select
                    value={form.watch("contractorId")?.toString() || "none"}
                    onValueChange={(v) =>
                      form.setValue("contractorId", v === "none" ? null : parseInt(v, 10))
                    }
                  >
                    <SelectTrigger className="h-12 text-base" data-testid="select-contractor">
                      <SelectValue placeholder="اختر المقاول" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-base py-3">بدون مقاول محدد</SelectItem>
                      {contractors.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()} className="text-base py-3">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div>
                  <Label className="text-base mb-2 flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> موقع التنفيذ في الموقع
                  </Label>
                  <Input
                    className="h-12 text-base"
                    {...form.register("workLocation")}
                    placeholder="مثال: الطابق الأول - الجناح الشرقي"
                    list="locations-list"
                    data-testid="input-work-location"
                  />
                  <datalist id="locations-list">
                    {COMMON_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc} />
                    ))}
                  </datalist>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {COMMON_LOCATIONS.slice(0, 6).map((loc) => (
                      <Button
                        key={loc}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => form.setValue("workLocation", loc)}
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
                  <Label className="text-base mb-2 block">حالة الطقس</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {WEATHER_OPTIONS.map((w) => {
                      const Icon = w.icon;
                      const active = form.watch("weather") === w.value;
                      return (
                        <Button
                          key={w.value}
                          type="button"
                          variant={active ? "default" : "outline"}
                          className="h-16 flex-col gap-1"
                          onClick={() => form.setValue("weather", active ? "" : w.value)}
                          data-testid={`chip-weather-${w.value}`}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-xs">{w.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-base mb-2 block">درجة الحرارة (اختياري)</Label>
                  <Input
                    className="h-12 text-base"
                    {...form.register("temperature")}
                    placeholder="مثال: 32°م"
                    data-testid="input-temperature"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button className="h-12 text-base" onClick={() => setActiveTab("work")} data-testid="button-next-work">
                التالي: الأعمال ←
              </Button>
            </div>
          </TabsContent>

          {/* TAB 2: Work executed + items */}
          <TabsContent value="work" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ListTodo className="h-5 w-5" /> الأعمال المنفذة اليوم
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-base mb-2 block">الوصف العام للأعمال *</Label>
                  <Textarea
                    className="text-base min-h-24"
                    {...form.register("workDescription")}
                    rows={4}
                    placeholder="ملخص عام للأعمال المنفذة في هذا اليوم..."
                    data-testid="textarea-work-description"
                  />
                  {form.formState.errors.workDescription && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.workDescription.message}
                    </p>
                  )}
                </div>

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-base">بنود الأعمال التفصيلية</Label>
                    <Button type="button" variant="outline" size="sm" className="h-9" onClick={addWorkItem} data-testid="button-add-work-item">
                      <Plus className="h-4 w-4 ml-1" /> إضافة بند
                    </Button>
                  </div>
                  {workItems.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed rounded-lg text-muted-foreground">
                      <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">أضف بنود أعمال تفصيلية مع الكميات (اختياري)</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {workItems.map((item, idx) => (
                        <div key={idx} className="border rounded-lg p-3 space-y-2 bg-muted/20" data-testid={`work-item-${idx}`}>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-sm">بند {idx + 1}</Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => removeWorkItem(idx)}
                              data-testid={`button-remove-item-${idx}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">نوع العمل</Label>
                              <Input
                                className="h-11"
                                value={item.type}
                                onChange={(e) => updateWorkItem(idx, { type: e.target.value })}
                                placeholder="مثال: أعمال خرسانية"
                                list="work-types-list"
                                data-testid={`input-item-type-${idx}`}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">الوصف التفصيلي</Label>
                              <Input
                                className="h-11"
                                value={item.description}
                                onChange={(e) => updateWorkItem(idx, { description: e.target.value })}
                                placeholder="مثال: صب أعمدة الطابق الأول"
                                data-testid={`input-item-desc-${idx}`}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">الكمية</Label>
                              <Input
                                type="number"
                                step="0.01"
                                className="h-11"
                                value={item.quantity ?? ""}
                                onChange={(e) => updateWorkItem(idx, { quantity: e.target.value ? parseFloat(e.target.value) : undefined })}
                                data-testid={`input-item-qty-${idx}`}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">الوحدة</Label>
                              <Input
                                className="h-11"
                                value={item.unit ?? ""}
                                onChange={(e) => updateWorkItem(idx, { unit: e.target.value })}
                                placeholder="م²"
                                list="units-list"
                                data-testid={`input-item-unit-${idx}`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <datalist id="work-types-list">
                    {COMMON_WORK_TYPES.map((t) => <option key={t} value={t} />)}
                  </datalist>
                  <datalist id="units-list">
                    {COMMON_UNITS.map((u) => <option key={u} value={u} />)}
                  </datalist>
                  {workItems.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t">
                      <span className="text-xs text-muted-foreground self-center ml-2">إضافة سريعة:</span>
                      {COMMON_WORK_TYPES.slice(0, 6).map((t) => (
                        <Button
                          key={t}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setWorkItems((prev) => [...prev, { type: t, description: "", quantity: undefined, unit: "" }])}
                          data-testid={`chip-quick-add-${t}`}
                        >
                          + {t}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <Label className="text-base mb-2 block">نسبة الإنجاز اليومي %</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="h-12 text-base"
                      {...form.register("progressToday")}
                      data-testid="input-progress-today"
                    />
                    <span className="text-2xl">%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between gap-2">
              <Button variant="outline" className="h-12" onClick={() => setActiveTab("basics")}>
                → السابق
              </Button>
              <Button className="h-12" onClick={() => setActiveTab("workforce")} data-testid="button-next-workforce">
                التالي: العمالة ←
              </Button>
            </div>
          </TabsContent>

          {/* TAB 3: Workforce + Equipment */}
          <TabsContent value="workforce" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" /> توزيع العمالة بالتخصص
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    إجمالي العمالة: <span className="font-bold text-base text-foreground">{form.watch("workersCount") || 0}</span>
                  </p>
                  <Button type="button" variant="outline" size="sm" className="h-9" onClick={addWorker} data-testid="button-add-worker">
                    <Plus className="h-4 w-4 ml-1" /> إضافة تخصص
                  </Button>
                </div>

                {workers.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed rounded-lg text-muted-foreground">
                    <HardHat className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">أضف توزيع العمالة بالتخصصات (اختياري)</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {workers.map((w, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center" data-testid={`worker-row-${idx}`}>
                        <Input
                          className="h-11"
                          value={w.role}
                          onChange={(e) => updateWorker(idx, { role: e.target.value })}
                          placeholder="التخصص (نجار، حداد، إلخ)"
                          list="worker-roles-list"
                          data-testid={`input-worker-role-${idx}`}
                        />
                        <Input
                          type="number"
                          min={0}
                          className="h-11 w-24 text-center"
                          value={w.count}
                          onChange={(e) => updateWorker(idx, { count: parseInt(e.target.value) || 0 })}
                          data-testid={`input-worker-count-${idx}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 text-destructive"
                          onClick={() => removeWorker(idx)}
                          data-testid={`button-remove-worker-${idx}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <datalist id="worker-roles-list">
                  {WORKER_ROLES.map((r) => <option key={r} value={r} />)}
                </datalist>

                {workers.length === 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    <span className="text-xs text-muted-foreground self-center ml-2">إضافة سريعة:</span>
                    {WORKER_ROLES.slice(0, 8).map((r) => (
                      <Button
                        key={r}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setWorkers((prev) => [...prev, { role: r, count: 1 }])}
                        data-testid={`chip-quick-worker-${r}`}
                      >
                        + {r}
                      </Button>
                    ))}
                  </div>
                )}

                <div>
                  <Label className="text-base mb-2 block">إجمالي العمالة (يحسب تلقائياً)</Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-12 text-base"
                    {...form.register("workersCount")}
                    data-testid="input-workers-count"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">المعدات والآليات المستخدمة</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="text-base"
                  {...form.register("equipmentUsed")}
                  rows={3}
                  placeholder="مثال: خلاطة خرسانة 1، رافعة برج، مولد كهرباء، ضاغط هواء..."
                  data-testid="textarea-equipment"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" /> السلامة والمعوقات
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

            <div className="flex justify-between gap-2">
              <Button variant="outline" className="h-12" onClick={() => setActiveTab("work")}>
                → السابق
              </Button>
              <Button className="h-12" onClick={() => setActiveTab("photos")} data-testid="button-next-photos">
                التالي: الصور ←
              </Button>
            </div>
          </TabsContent>

          {/* TAB 4: Photos */}
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

                {/* Photo type quick selector */}
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

                {/* Capture buttons */}
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

                {/* Pending photos with per-photo metadata + bulk upload */}
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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

                {/* Already uploaded photos */}
                {existingLog?.photos && existingLog.photos.length > 0 ? (
                  <div>
                    <h3 className="font-semibold mb-2">الصور المرفوعة ({existingLog.photos.length})</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
              <Button variant="outline" className="h-12" onClick={() => setActiveTab("workforce")}>
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
