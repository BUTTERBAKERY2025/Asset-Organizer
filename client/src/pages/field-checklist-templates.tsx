import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ClipboardList, GripVertical, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { FieldChecklistTemplate, FieldChecklistTemplateItem } from "@shared/schema";

const CATEGORIES = [
  { value: "safety", label: "السلامة" },
  { value: "quality", label: "الجودة" },
  { value: "handover", label: "تسليم" },
  { value: "commissioning", label: "تشغيل" },
  { value: "inspection", label: "فحص" },
  { value: "opening", label: "افتتاح" },
  { value: "maintenance", label: "صيانة" },
];

const TRADES = [
  { value: "", label: "بدون تخصص" },
  { value: "paint", label: "دهانات" },
  { value: "tiling", label: "سيراميك" },
  { value: "hvac", label: "تكييف" },
  { value: "plumbing", label: "سباكة" },
  { value: "electrical", label: "كهرباء" },
  { value: "gypsum", label: "جبس" },
  { value: "glass", label: "زجاج" },
  { value: "mdf", label: "MDF" },
  { value: "signage", label: "لوحات" },
];

interface TplItem {
  text: string;
  isRequired: boolean;
  requiresPhoto: boolean;
  notes?: string;
}

export default function FieldChecklistTemplatesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<FieldChecklistTemplate | null>(null);
  const [open, setOpen] = useState(false);

  const { data: templates = [], isLoading } = useQuery<FieldChecklistTemplate[]>({
    queryKey: ["/api/field-checklist-templates", { includeInactive: true }],
    queryFn: async () => (await fetch("/api/field-checklist-templates?includeInactive=true", { credentials: "include" })).json(),
  });

  const delMut = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/field-checklist-templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/field-checklist-templates"] });
      toast({ title: "تم الحذف" });
    },
    onError: (e: any) => toast({ title: "فشل الحذف", description: e.message, variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="container mx-auto px-3 sm:px-6 py-4 max-w-5xl" dir="rtl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-templates-title">
            <ClipboardList className="h-6 w-6 text-primary" /> قوالب قوائم التحقق
          </h1>
          <Button onClick={() => { setEditing(null); setOpen(true); }} data-testid="button-new-template">
            <Plus className="h-4 w-4 ml-1" /> قالب جديد
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">جارٍ التحميل...</div>
        ) : templates.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">لا توجد قوالب — أنشئ قالباً جديداً</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {templates.map((t) => (
              <Card key={t.id} data-testid={`card-template-${t.id}`}>
                <CardContent className="p-4 flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{t.name}</span>
                      <Badge variant="outline">{CATEGORIES.find(c => c.value === t.category)?.label || t.category}</Badge>
                      {t.trade && <Badge variant="secondary">{TRADES.find(tr => tr.value === t.trade)?.label || t.trade}</Badge>}
                      {!t.isActive && <Badge variant="destructive">معطّل</Badge>}
                    </div>
                    {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }} data-testid={`button-edit-${t.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("حذف القالب؟")) delMut.mutate(t.id); }} data-testid={`button-delete-${t.id}`}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {open && <TemplateEditor template={editing} onClose={() => setOpen(false)} />}
      </div>
    </Layout>
  );
}

function TemplateEditor({ template, onClose }: { template: FieldChecklistTemplate | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!template;
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [category, setCategory] = useState(template?.category || "quality");
  const [trade, setTrade] = useState(template?.trade || "");
  const [isActive, setIsActive] = useState(template?.isActive ?? true);
  const [items, setItems] = useState<TplItem[]>([]);

  useQuery({
    queryKey: ["/api/field-checklist-templates", template?.id],
    enabled: !!template?.id,
    queryFn: async () => {
      const r = await fetch(`/api/field-checklist-templates/${template!.id}`, { credentials: "include" });
      const d = await r.json();
      setItems((d.items || []).map((it: FieldChecklistTemplateItem) => ({
        text: it.text, isRequired: it.isRequired, requiresPhoto: it.requiresPhoto, notes: it.notes || "",
      })));
      return d;
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = {
        name, description: description || null, category, trade: trade || null, isActive,
        items: items.filter(i => i.text.trim()),
      };
      if (isEdit) {
        return await apiRequest("PUT", `/api/field-checklist-templates/${template!.id}`, body);
      }
      return await apiRequest("POST", "/api/field-checklist-templates", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/field-checklist-templates"] });
      toast({ title: isEdit ? "تم التحديث" : "تم الإنشاء" });
      onClose();
    },
    onError: (e: any) => toast({ title: "فشل الحفظ", description: e.message, variant: "destructive" }),
  });

  function addItem() { setItems([...items, { text: "", isRequired: true, requiresPhoto: false }]); }
  function removeItem(i: number) { setItems(items.filter((_, x) => x !== i)); }
  function updateItem(i: number, patch: Partial<TplItem>) {
    setItems(items.map((it, x) => (x === i ? { ...it, ...patch } : it)));
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader><DialogTitle>{isEdit ? "تعديل القالب" : "قالب جديد"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>اسم القالب *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-template-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الفئة *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>التخصص</Label>
              <Select value={trade || "__none"} onValueChange={(v) => setTrade(v === "__none" ? "" : v)}>
                <SelectTrigger data-testid="select-trade"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">بدون</SelectItem>
                  {TRADES.filter(t => t.value).map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>الوصف</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(!!c)} />
            نشط
          </label>

          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base">البنود ({items.length})</Label>
              <Button size="sm" variant="outline" onClick={addItem} data-testid="button-add-item">
                <Plus className="h-4 w-4 ml-1" /> بند
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <Card key={i}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground mt-2" />
                      <Input
                        placeholder="نص البند..."
                        value={it.text}
                        onChange={(e) => updateItem(i, { text: e.target.value })}
                        className="flex-1"
                        data-testid={`input-item-text-${i}`}
                      />
                      <Button size="icon" variant="ghost" onClick={() => removeItem(i)} data-testid={`button-remove-item-${i}`}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-3 text-xs pr-6">
                      <label className="flex items-center gap-1">
                        <Checkbox checked={it.isRequired} onCheckedChange={(c) => updateItem(i, { isRequired: !!c })} />
                        إجباري
                      </label>
                      <label className="flex items-center gap-1">
                        <Checkbox checked={it.requiresPhoto} onCheckedChange={(c) => updateItem(i, { requiresPhoto: !!c })} />
                        يتطلب صورة
                      </label>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">أضف بنوداً للقالب</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => saveMut.mutate()} disabled={!name || saveMut.isPending} data-testid="button-save-template">
            {saveMut.isPending ? "جارٍ الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
