import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FileText, Plus, Pencil, Trash2, Copy, Loader2, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ContractTemplate } from "@shared/schema";

interface MilestoneDef { title: string; amountType: 'percentage' | 'fixed'; percentage: number; sequence: number; triggerType: string; }
interface GuaranteeDef { type: string; amountPercentage: number; validityMonths: number; }

const CATEGORIES = [
  { value: "civil", label: "مدنية" },
  { value: "electrical", label: "كهرباء" },
  { value: "mechanical", label: "ميكانيكية" },
  { value: "finishing", label: "تشطيبات" },
  { value: "general", label: "عام" },
];

const GUARANTEE_TYPES = [
  { value: "bid", label: "ابتدائي" },
  { value: "performance", label: "حسن تنفيذ" },
  { value: "advance", label: "دفعة مقدمة" },
  { value: "maintenance", label: "صيانة" },
];

const TRIGGER_TYPES = [
  { value: "manual", label: "يدوي" },
  { value: "date", label: "بتاريخ" },
  { value: "progress", label: "بنسبة إنجاز" },
  { value: "item_completion", label: "بإكمال بند" },
];

const emptyForm = {
  name: "",
  description: "",
  category: "general",
  defaultTerms: "",
  defaultRetentionPercentage: 5,
  defaultLdEnabled: false,
  defaultLdDailyRate: 0.1,
  defaultLdMaxPercentage: 10,
  defaultMilestones: [] as MilestoneDef[],
  defaultGuarantees: [] as GuaranteeDef[],
  isActive: true,
};

export default function ContractTemplatesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContractTemplate | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<ContractTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/construction/contract-templates"],
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/construction/contract-templates"] });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      if (editing) {
        const res = await apiRequest("PATCH", `/api/construction/contract-templates/${editing.id}`, data);
        return await res.json();
      }
      const res = await apiRequest("POST", "/api/construction/contract-templates", data);
      return await res.json();
    },
    onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: editing ? "تم تحديث القالب" : "تم إنشاء القالب" }); },
    onError: (e: any) => toast({ title: "فشل الحفظ", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/construction/contract-templates/${id}`),
    onSuccess: () => { invalidate(); setDeleteTarget(null); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "فشل الحذف", description: e?.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (t: ContractTemplate) => {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description || "",
      category: t.category || "general",
      defaultTerms: t.defaultTerms || "",
      defaultRetentionPercentage: t.defaultRetentionPercentage || 0,
      defaultLdEnabled: t.defaultLdEnabled || false,
      defaultLdDailyRate: t.defaultLdDailyRate || 0,
      defaultLdMaxPercentage: t.defaultLdMaxPercentage || 10,
      defaultMilestones: ((t.defaultMilestones as any[]) || []) as MilestoneDef[],
      defaultGuarantees: ((t.defaultGuarantees as any[]) || []) as GuaranteeDef[],
      isActive: t.isActive ?? true,
    });
    setDialogOpen(true);
  };

  const addMilestone = () => setForm({ ...form, defaultMilestones: [...form.defaultMilestones, { title: "", amountType: 'percentage', percentage: 0, sequence: form.defaultMilestones.length + 1, triggerType: 'manual' }] });
  const updateMilestone = (i: number, patch: Partial<MilestoneDef>) => {
    const arr = [...form.defaultMilestones];
    arr[i] = { ...arr[i], ...patch };
    setForm({ ...form, defaultMilestones: arr });
  };
  const removeMilestone = (i: number) => setForm({ ...form, defaultMilestones: form.defaultMilestones.filter((_, idx) => idx !== i) });

  const addGuarantee = () => setForm({ ...form, defaultGuarantees: [...form.defaultGuarantees, { type: 'performance', amountPercentage: 5, validityMonths: 12 }] });
  const updateGuarantee = (i: number, patch: Partial<GuaranteeDef>) => {
    const arr = [...form.defaultGuarantees];
    arr[i] = { ...arr[i], ...patch };
    setForm({ ...form, defaultGuarantees: arr });
  };
  const removeGuarantee = (i: number) => setForm({ ...form, defaultGuarantees: form.defaultGuarantees.filter((_, idx) => idx !== i) });

  const milestonesPctSum = form.defaultMilestones
    .filter(m => m.amountType === 'percentage')
    .reduce((s, m) => s + (Number(m.percentage) || 0), 0);

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6 text-amber-600" />
            قوالب العقود
          </h1>
          <p className="text-sm text-muted-foreground mt-1">قوالب جاهزة لإنشاء عقود مقاولات بسرعة (مدنية، كهرباء، ميكانيكية، تشطيبات)</p>
        </div>
        <Button onClick={openCreate} className="bg-amber-600 hover:bg-amber-700" data-testid="button-add-template">
          <Plus className="h-4 w-4 ml-1" />
          قالب جديد
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-600" /></div>
      ) : templates.length === 0 ? (
        <Card><CardContent className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          لا توجد قوالب بعد. ابدأ بإنشاء قالب جديد.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((t) => {
            const cat = CATEGORIES.find(c => c.value === t.category)?.label || t.category;
            const ms = (t.defaultMilestones as any[])?.length || 0;
            const gs = (t.defaultGuarantees as any[])?.length || 0;
            return (
              <Card key={t.id} data-testid={`card-template-${t.id}`} className={!t.isActive ? "opacity-60" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base">{t.name}</CardTitle>
                      {t.description && <CardDescription className="line-clamp-2 mt-1">{t.description}</CardDescription>}
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      {cat && <Badge variant="secondary" className="text-xs">{cat}</Badge>}
                      {!t.isActive && <Badge variant="outline" className="text-xs">معطّل</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">احتجاز {t.defaultRetentionPercentage || 0}%</Badge>
                    {t.defaultLdEnabled && <Badge variant="outline" className="text-orange-700">غرامة {t.defaultLdDailyRate}%/يوم</Badge>}
                    <Badge variant="outline">{ms} مرحلة</Badge>
                    <Badge variant="outline">{gs} ضمان</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">استُخدم {t.usageCount || 0} مرة</div>
                  <div className="flex gap-1 pt-2 border-t">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(t)} disabled={saveMutation.isPending} data-testid={`button-edit-template-${t.id}`}>
                      <Pencil className="h-3.5 w-3.5 ml-1" /> تعديل
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setDeleteTarget(t)} disabled={deleteMutation.isPending} data-testid={`button-delete-template-${t.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "تعديل القالب" : "قالب جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>اسم القالب *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-template-name" />
              </div>
              <div>
                <Label>الفئة</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger data-testid="select-template-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Label htmlFor="t-active" className="cursor-pointer">نشط</Label>
                <Switch id="t-active" checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              </div>
              <div className="col-span-2">
                <Label>الوصف</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="col-span-2">
                <Label>البنود/الشروط الافتراضية</Label>
                <Textarea value={form.defaultTerms} onChange={(e) => setForm({ ...form, defaultTerms: e.target.value })} rows={3} placeholder="مثال: الدفع خلال 15 يوم من تقديم الفاتورة..." />
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <div className="font-medium text-sm">الإعدادات الافتراضية</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>نسبة احتجاز الضمان (%)</Label>
                  <Input type="number" step="0.1" min="0" max="100" value={form.defaultRetentionPercentage} onChange={(e) => setForm({ ...form, defaultRetentionPercentage: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="flex items-center justify-between bg-orange-50 rounded p-2 mt-5">
                  <Label className="cursor-pointer text-sm">تفعيل غرامة التأخير</Label>
                  <Switch checked={form.defaultLdEnabled} onCheckedChange={(v) => setForm({ ...form, defaultLdEnabled: v })} />
                </div>
              </div>
              {form.defaultLdEnabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>غرامة يومية (%)</Label>
                    <Input type="number" step="0.01" min="0" value={form.defaultLdDailyRate} onChange={(e) => setForm({ ...form, defaultLdDailyRate: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label>السقف الأقصى (%)</Label>
                    <Input type="number" step="0.1" min="0" max="100" value={form.defaultLdMaxPercentage} onChange={(e) => setForm({ ...form, defaultLdMaxPercentage: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
              )}
            </div>

            {/* Default milestones */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">مراحل الدفع الافتراضية</div>
                <div className="flex items-center gap-2">
                  {milestonesPctSum > 0 && (
                    <Badge variant={Math.abs(milestonesPctSum - 100) < 0.01 ? "default" : "secondary"} className="text-xs">
                      مجموع %: {milestonesPctSum}%
                    </Badge>
                  )}
                  <Button size="sm" variant="outline" onClick={addMilestone}><Plus className="h-3.5 w-3.5 ml-1" />مرحلة</Button>
                </div>
              </div>
              {form.defaultMilestones.map((m, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end bg-slate-50 rounded p-2">
                  <div className="col-span-1 text-center text-sm font-medium pt-2">#{i + 1}</div>
                  <div className="col-span-5">
                    <Input placeholder="عنوان المرحلة" value={m.title} onChange={(e) => updateMilestone(i, { title: e.target.value })} />
                  </div>
                  <div className="col-span-3">
                    <Input type="number" step="0.1" placeholder="%" value={m.percentage} onChange={(e) => updateMilestone(i, { percentage: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="col-span-2">
                    <Select value={m.triggerType} onValueChange={(v) => updateMilestone(i, { triggerType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TRIGGER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" variant="ghost" className="col-span-1 text-red-500" onClick={() => removeMilestone(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>

            {/* Default guarantees */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">الضمانات الافتراضية</div>
                <Button size="sm" variant="outline" onClick={addGuarantee}><Plus className="h-3.5 w-3.5 ml-1" />ضمان</Button>
              </div>
              {form.defaultGuarantees.map((g, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end bg-slate-50 rounded p-2">
                  <div className="col-span-4">
                    <Select value={g.type} onValueChange={(v) => updateGuarantee(i, { type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{GUARANTEE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input type="number" step="0.1" placeholder="% من العقد" value={g.amountPercentage} onChange={(e) => updateGuarantee(i, { amountPercentage: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="col-span-4">
                    <Input type="number" min="1" placeholder="مدة سريان (شهر)" value={g.validityMonths} onChange={(e) => updateGuarantee(i, { validityMonths: parseInt(e.target.value) || 12 })} />
                  </div>
                  <Button size="sm" variant="ghost" className="col-span-1 text-red-500" onClick={() => removeGuarantee(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.name.trim()} className="bg-amber-600 hover:bg-amber-700" data-testid="button-save-template">
              {saveMutation.isPending ? "جارِ الحفظ..." : "حفظ القالب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف القالب؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف "{deleteTarget?.name}" نهائياً. العقود المُنشأة من هذا القالب لن تتأثر.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} className="bg-red-600 hover:bg-red-700">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
