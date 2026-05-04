import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, MinusCircle, Camera, ArrowRight, Loader2, ClipboardCheck, AlertTriangle, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { GPSPhotoCapture, type CapturedPhoto } from "@/components/gps-photo-capture";
import type { FieldChecklist, FieldChecklistItem } from "@shared/schema";

interface DetailResp { checklist: FieldChecklist; items: FieldChecklistItem[]; }

const STATUS_OPTS: { value: "pass" | "fail" | "na"; label: string; icon: any; color: string }[] = [
  { value: "pass", label: "مطابق", icon: CheckCircle2, color: "text-green-600" },
  { value: "fail", label: "غير مطابق", icon: XCircle, color: "text-red-600" },
  { value: "na", label: "لا ينطبق", icon: MinusCircle, color: "text-gray-500" },
];

export default function FieldChecklistDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<DetailResp>({
    queryKey: [`/api/field-checklists/${id}`],
    queryFn: async () => (await fetch(`/api/field-checklists/${id}`, { credentials: "include" })).json(),
    enabled: !isNaN(id),
  });

  const updateItem = useMutation({
    mutationFn: async ({ itemId, patch }: { itemId: number; patch: any }) =>
      apiRequest("PATCH", `/api/field-checklists/${id}/items/${itemId}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/field-checklists/${id}`] }),
    onError: (e: any) => toast({ title: "فشل التحديث", description: e.message, variant: "destructive" }),
  });

  const completeMut = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/field-checklists/${id}/complete`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/field-checklists/${id}`] });
      qc.invalidateQueries({ queryKey: ["/api/field-hub"] });
      toast({ title: "تمّ إغلاق القائمة" });
    },
    onError: (e: any) => toast({ title: "تعذّر الإغلاق", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !data) {
    return <Layout><div className="container py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div></Layout>;
  }

  const { checklist, items } = data;
  const checked = items.filter((i) => i.status !== "pending").length;
  const progress = items.length > 0 ? Math.round((checked / items.length) * 100) : 0;
  const isFinal = checklist.status === "completed" || checklist.status === "cancelled";
  const requiredOpen = items.filter((i) => i.isRequired && i.status === "pending").length;
  const missingPhoto = items.filter(
    (i) => i.requiresPhoto && i.status !== "na" && (!Array.isArray(i.photos) || (i.photos as any[]).length === 0),
  ).length;

  return (
    <Layout>
      <div className="container mx-auto px-3 sm:px-6 py-4 max-w-3xl" dir="rtl">
        <Link href="/field-hub" data-testid="link-back-hub">
          <Button variant="ghost" size="sm" className="mb-2"><ArrowRight className="h-4 w-4 ml-1" /> رجوع</Button>
        </Link>

        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <CardTitle data-testid="text-checklist-title">{checklist.title}</CardTitle>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline">{checklist.category}</Badge>
                  <Badge variant={isFinal ? "secondary" : "default"} data-testid="badge-status">{checklist.status}</Badge>
                  {checklist.dueDate && <span className="text-xs text-muted-foreground">يستحق: {checklist.dueDate}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold" data-testid="text-progress">{progress}%</div>
                <div className="text-xs text-muted-foreground">{checked}/{items.length}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
              <div className="p-2 rounded bg-green-50 dark:bg-green-900/20">
                <div className="font-bold text-green-700">{checklist.passCount}</div><div>مطابق</div>
              </div>
              <div className="p-2 rounded bg-red-50 dark:bg-red-900/20">
                <div className="font-bold text-red-700">{checklist.failCount}</div><div>غير مطابق</div>
              </div>
              <div className="p-2 rounded bg-gray-50 dark:bg-gray-800">
                <div className="font-bold">{checklist.naCount}</div><div>لا ينطبق</div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="space-y-3">
          {items.map((item) => (
            <ChecklistItemCard
              key={item.id}
              item={item}
              disabled={isFinal || updateItem.isPending}
              onUpdate={(patch) => updateItem.mutate({ itemId: item.id, patch })}
            />
          ))}
        </div>

        {!isFinal && (
          <Card className="mt-4 sticky bottom-2 shadow-lg">
            <CardContent className="p-3">
              {(requiredOpen > 0 || missingPhoto > 0) && (
                <div className="text-xs text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1" data-testid="text-completion-warning">
                  <AlertTriangle className="h-3 w-3" />
                  {requiredOpen > 0 && <>{requiredOpen} بند إجباري · </>}
                  {missingPhoto > 0 && <>{missingPhoto} بند يحتاج صورة</>}
                </div>
              )}
              <Button
                className="w-full h-12"
                onClick={() => { if (confirm("إغلاق القائمة؟")) completeMut.mutate(); }}
                disabled={completeMut.isPending || requiredOpen > 0 || missingPhoto > 0}
                data-testid="button-complete-checklist"
              >
                <ClipboardCheck className="h-5 w-5 ml-2" />
                {completeMut.isPending ? "جارٍ..." : "إغلاق القائمة"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function ChecklistItemCard({ item, disabled, onUpdate }: {
  item: FieldChecklistItem;
  disabled: boolean;
  onUpdate: (patch: any) => void;
}) {
  const [notes, setNotes] = useState(item.notes || "");
  const photos: CapturedPhoto[] = Array.isArray(item.photos) ? (item.photos as any[]) : [];

  function setStatus(s: "pass" | "fail" | "na") {
    onUpdate({ status: s, notes: notes || null, photos });
  }
  function addPhoto(p: CapturedPhoto) {
    onUpdate({ photos: [...photos, p] });
  }
  function removePhoto(idx: number) {
    onUpdate({ photos: photos.filter((_, i) => i !== idx) });
  }

  const statusColor =
    item.status === "pass" ? "border-green-300 bg-green-50/50 dark:bg-green-900/10" :
    item.status === "fail" ? "border-red-300 bg-red-50/50 dark:bg-red-900/10" :
    item.status === "na" ? "border-gray-300 bg-gray-50/50 dark:bg-gray-800/50" :
    "";

  return (
    <Card className={statusColor} data-testid={`card-item-${item.id}`}>
      <CardContent className="p-3 space-y-3">
        <div className="flex items-start gap-2">
          <span className="text-xs text-muted-foreground mt-1">#{item.sequence}</span>
          <div className="flex-1">
            <div className="font-medium text-sm" data-testid={`text-item-${item.id}`}>{item.text}</div>
            <div className="flex gap-1 mt-1 flex-wrap">
              {item.isRequired && <Badge variant="outline" className="text-xs">إجباري</Badge>}
              {item.requiresPhoto && <Badge variant="outline" className="text-xs"><Camera className="h-3 w-3 ml-1" />صورة مطلوبة</Badge>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {STATUS_OPTS.map((s) => {
            const Icon = s.icon;
            const active = item.status === s.value;
            return (
              <Button
                key={s.value}
                variant={active ? "default" : "outline"}
                size="sm"
                disabled={disabled}
                onClick={() => setStatus(s.value)}
                className="h-10"
                data-testid={`button-status-${item.id}-${s.value}`}
              >
                <Icon className={`h-4 w-4 ml-1 ${!active ? s.color : ""}`} /> {s.label}
              </Button>
            );
          })}
        </div>

        {item.status !== "pending" && (
          <Textarea
            placeholder="ملاحظات..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => { if ((notes || "") !== (item.notes || "")) onUpdate({ notes: notes || null }); }}
            rows={2}
            disabled={disabled}
            className="text-sm"
            data-testid={`input-notes-${item.id}`}
          />
        )}

        {item.status !== "na" && item.status !== "pending" && (
          <div className="space-y-2">
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative" data-testid={`photo-${item.id}-${i}`}>
                    <img src={p.url} alt="" className="w-full h-20 object-cover rounded border" />
                    {p.lat != null && (
                      <div className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[9px] px-1 rounded flex items-center gap-0.5">
                        <MapPin className="h-2 w-2" />GPS
                      </div>
                    )}
                    {!disabled && (
                      <Button size="icon" variant="destructive" className="absolute -top-1 -left-1 h-5 w-5" onClick={() => removePhoto(i)} data-testid={`button-remove-photo-${item.id}-${i}`}>
                        ×
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!disabled && <GPSPhotoCapture folder={`checklist-${item.checklistId}`} onUpload={addPhoto} required={item.requiresPhoto} buttonLabel="إضافة صورة" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
