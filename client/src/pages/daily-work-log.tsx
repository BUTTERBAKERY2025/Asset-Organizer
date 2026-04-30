import { useEffect, useState, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Loader2, Save, Upload, X, Camera, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { ConstructionProject, Contractor, ProjectDailyLog, ProjectDailyLogPhoto } from "@shared/schema";

const formSchema = z.object({
  projectId: z.coerce.number().min(1, "المشروع مطلوب"),
  contractorId: z.coerce.number().optional().nullable(),
  logDate: z.string().min(1, "التاريخ مطلوب"),
  supervisorName: z.string().min(1, "اسم المشرف مطلوب"),
  supervisorRole: z.string().optional().nullable(),
  workDescription: z.string().min(1, "وصف الأعمال مطلوب"),
  progressToday: z.coerce.number().min(0).max(100).optional().nullable(),
  workersCount: z.coerce.number().min(0).optional().nullable(),
  equipmentUsed: z.string().optional().nullable(),
  weather: z.string().optional().nullable(),
  issues: z.string().optional().nullable(),
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
  { value: "sunny", label: "مشمس" },
  { value: "cloudy", label: "غائم" },
  { value: "rainy", label: "ممطر" },
  { value: "hot", label: "حار جداً" },
  { value: "windy", label: "رياح شديدة" },
  { value: "dusty", label: "أتربة" },
];

const PHOTO_TYPES = [
  { value: "before", label: "قبل العمل" },
  { value: "during", label: "أثناء العمل" },
  { value: "after", label: "بعد العمل" },
];

interface DailyLogWithPhotos extends ProjectDailyLog {
  photos?: ProjectDailyLogPhoto[];
}

export default function DailyWorkLogPage() {
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoType, setPhotoType] = useState<string>("during");
  const [photoCaption, setPhotoCaption] = useState("");
  const [uploading, setUploading] = useState(false);

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
      workDescription: "",
      progressToday: 0,
      workersCount: 0,
      equipmentUsed: "",
      weather: "",
      issues: "",
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
        workDescription: existingLog.workDescription,
        progressToday: existingLog.progressToday ?? 0,
        workersCount: existingLog.workersCount ?? 0,
        equipmentUsed: existingLog.equipmentUsed ?? "",
        weather: existingLog.weather ?? "",
        issues: existingLog.issues ?? "",
        notes: existingLog.notes ?? "",
      });
    }
  }, [existingLog, isEdit, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
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
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction/daily-logs"] });
      toast({ title: isEdit ? "تم تحديث اليومية" : "تم إنشاء اليومية بنجاح" });
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
      setPhotoCaption("");
      toast({ title: "تم إضافة الصورة" });
    },
    onError: () => {
      toast({ title: "فشل في إضافة الصورة", variant: "destructive" });
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !logId) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads?folder=daily-logs", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error("upload failed");
      const { downloadUrl } = await res.json();
      photoUploadMutation.mutate({
        photoUrl: downloadUrl,
        caption: photoCaption,
        photoType,
      });
    } catch (err) {
      toast({ title: "فشل في رفع الصورة", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onSubmit = (data: FormData) => {
    saveMutation.mutate(data);
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6" dir="rtl">
        <div className="flex items-center gap-3">
          <Link href="/construction/daily-logs">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">
              {isEdit ? "تعديل يومية أعمال" : "إضافة يومية أعمال"}
            </h1>
            <p className="text-muted-foreground">
              {isEdit ? "تعديل بيانات اليومية وإدارة الصور" : "تسجيل الأعمال المنفذة اليوم"}
            </p>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>بيانات اليومية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="projectId">المشروع *</Label>
                  <Select
                    value={form.watch("projectId")?.toString() || ""}
                    onValueChange={(v) => form.setValue("projectId", parseInt(v, 10))}
                  >
                    <SelectTrigger id="projectId" data-testid="select-project">
                      <SelectValue placeholder="اختر المشروع" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
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
                  <Label htmlFor="logDate">التاريخ *</Label>
                  <Input
                    id="logDate"
                    type="date"
                    {...form.register("logDate")}
                    data-testid="input-log-date"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supervisorName">اسم المشرف/المهندس *</Label>
                  <Input
                    id="supervisorName"
                    {...form.register("supervisorName")}
                    placeholder="الاسم الكامل"
                    data-testid="input-supervisor-name"
                  />
                </div>
                <div>
                  <Label htmlFor="supervisorRole">الصفة</Label>
                  <Select
                    value={form.watch("supervisorRole") || ""}
                    onValueChange={(v) => form.setValue("supervisorRole", v)}
                  >
                    <SelectTrigger id="supervisorRole" data-testid="select-supervisor-role">
                      <SelectValue placeholder="اختر الصفة" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPERVISOR_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="contractorId">المقاول المنفذ</Label>
                <Select
                  value={form.watch("contractorId")?.toString() || "none"}
                  onValueChange={(v) =>
                    form.setValue("contractorId", v === "none" ? null : parseInt(v, 10))
                  }
                >
                  <SelectTrigger id="contractorId" data-testid="select-contractor">
                    <SelectValue placeholder="اختر المقاول" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون مقاول محدد</SelectItem>
                    {contractors.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="workDescription">الأعمال المنفذة اليوم *</Label>
                <Textarea
                  id="workDescription"
                  {...form.register("workDescription")}
                  rows={4}
                  placeholder="وصف تفصيلي للأعمال المنفذة..."
                  data-testid="textarea-work-description"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="progressToday">نسبة الإنجاز اليومي %</Label>
                  <Input
                    id="progressToday"
                    type="number"
                    min={0}
                    max={100}
                    {...form.register("progressToday")}
                    data-testid="input-progress-today"
                  />
                </div>
                <div>
                  <Label htmlFor="workersCount">عدد العمالة</Label>
                  <Input
                    id="workersCount"
                    type="number"
                    min={0}
                    {...form.register("workersCount")}
                    data-testid="input-workers-count"
                  />
                </div>
                <div>
                  <Label htmlFor="weather">حالة الطقس</Label>
                  <Select
                    value={form.watch("weather") || ""}
                    onValueChange={(v) => form.setValue("weather", v)}
                  >
                    <SelectTrigger id="weather" data-testid="select-weather">
                      <SelectValue placeholder="اختر" />
                    </SelectTrigger>
                    <SelectContent>
                      {WEATHER_OPTIONS.map((w) => (
                        <SelectItem key={w.value} value={w.value}>
                          {w.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="equipmentUsed">المعدات المستخدمة</Label>
                <Textarea
                  id="equipmentUsed"
                  {...form.register("equipmentUsed")}
                  rows={2}
                  placeholder="مثال: خلاطة خرسانة، رافعة، مولد..."
                  data-testid="textarea-equipment"
                />
              </div>

              <div>
                <Label htmlFor="issues">المشاكل والمعوقات</Label>
                <Textarea
                  id="issues"
                  {...form.register("issues")}
                  rows={2}
                  placeholder="أي عقبات واجهت العمل اليوم..."
                  data-testid="textarea-issues"
                />
              </div>

              <div>
                <Label htmlFor="notes">ملاحظات إضافية</Label>
                <Textarea
                  id="notes"
                  {...form.register("notes")}
                  rows={2}
                  data-testid="textarea-notes"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2 mt-4">
            <Link href="/construction/daily-logs">
              <Button type="button" variant="outline" data-testid="button-cancel">
                إلغاء
              </Button>
            </Link>
            <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save">
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Save className="h-4 w-4 ml-2" />
              )}
              حفظ
            </Button>
          </div>
        </form>

        {/* Photos section - only after creation */}
        {isEdit && logId && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  صور اليومية ({existingLog?.photos?.length || 0})
                </CardTitle>
                <Link href={`/construction/daily-logs/${logId}/print`}>
                  <Button variant="outline" size="sm" data-testid="button-print-log">
                    <Eye className="h-4 w-4 ml-1" />
                    معاينة الطباعة
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30">
                <div>
                  <Label>نوع الصورة</Label>
                  <Select value={photoType} onValueChange={setPhotoType}>
                    <SelectTrigger data-testid="select-photo-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PHOTO_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>وصف الصورة (اختياري)</Label>
                  <Input
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                    placeholder="مثال: صب أساسات الطابق الأول"
                    data-testid="input-photo-caption"
                  />
                </div>
                <div className="md:col-span-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                    data-testid="input-photo-file"
                  />
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full"
                    data-testid="button-upload-photo"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    ) : (
                      <Upload className="h-4 w-4 ml-2" />
                    )}
                    رفع صورة
                  </Button>
                </div>
              </div>

              {existingLog?.photos && existingLog.photos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {existingLog.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative border rounded-lg overflow-hidden group"
                      data-testid={`photo-${photo.id}`}
                    >
                      <img
                        src={photo.photoUrl}
                        alt={photo.caption || "صورة"}
                        className="w-full h-40 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCBmaWxsPSIjZWVlIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIvPjwvc3ZnPg==";
                        }}
                      />
                      <div className="p-2 bg-background">
                        <Badge variant="outline" className="text-xs">
                          {PHOTO_TYPES.find((t) => t.value === photo.photoType)?.label || photo.photoType}
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
                        className="absolute top-2 left-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deletePhotoMutation.mutate(photo.id)}
                        data-testid={`button-delete-photo-${photo.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Camera className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>لم يتم إضافة صور بعد</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!isEdit && (
          <Card className="border-dashed">
            <CardContent className="py-6 text-center text-muted-foreground">
              <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>سيمكنك رفع الصور بعد حفظ اليومية</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
