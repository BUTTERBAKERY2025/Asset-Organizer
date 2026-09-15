import { useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CentralKitchenRecipeCatalogContract, CentralKitchenRecipeContract, CentralKitchenRecipeStatus } from "@shared/central-kitchen-recipes";
import type { ModuleAction, SystemModule } from "@shared/schema";
import { AlertTriangle, CheckCircle2, ClipboardList, Eye, FilePlus2, History, Loader2, Pencil, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { ImportedRecipes } from "./imported-recipes";
import type { PreparedImportedRecipe } from "./imported-recipes-model";

type Kitchen = { id: string; name: string };
type IngredientDraft = { warehouseItemId: string; quantity: string };
type RecipeDraft = { productId: string; outputQuantity: string; notes: string; ingredients: IngredientDraft[] };
export const RECIPE_PERMISSION_MODULE = "central_kitchen_recipes" as SystemModule;
export type RecipePermissionAction = Extract<ModuleAction, "view" | "create" | "edit" | "delete" | "approve" | "print">;
export type PrintableRecipeContract = CentralKitchenRecipeContract & { kitchenName?: string | null };
const emptyDraft = (): RecipeDraft => ({ productId: "", outputQuantity: "", notes: "", ingredients: [{ warehouseItemId: "", quantity: "" }] });
const format = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-latn", { maximumFractionDigits: 6 }).format(value);
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat("ar-SA-u-nu-latn", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const statusNames: Record<CentralKitchenRecipeStatus, string> = { draft: "مسودة", approved: "معتمدة", superseded: "مستبدلة" };
const statusClass: Record<CentralKitchenRecipeStatus, string> = { draft: "border-amber-200 bg-amber-50 text-amber-800", approved: "border-emerald-200 bg-emerald-50 text-emerald-800", superseded: "border-slate-200 bg-slate-100 text-slate-600" };

export function recipeHasPermission(
  hasPermission: (module: SystemModule, action: ModuleAction) => boolean,
  action: RecipePermissionAction,
): boolean {
  return hasPermission(RECIPE_PERMISSION_MODULE, action);
}

export function escapePrintHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function openRecipePrintWindow(
  openWindow: (url?: string, target?: string) => Window | null,
): Window | null {
  return openWindow("", "_blank");
}

export function closeRecipePrintWindow(popup: Window): void {
  try { popup.close(); } catch { /* Ignore a browser popup that closed itself. */ }
}

export function buildRecipePrintDocument(recipe: PrintableRecipeContract, kitchenName?: string): string {
  const kitchen = kitchenName || recipe.kitchenName || recipe.kitchenId;
  const notes = recipe.notes ? escapePrintHtml(recipe.notes).replace(/\r?\n/g, "<br />") : "—";
  const ingredients = recipe.ingredients.map((ingredient) => `
        <tr>
          <td>${escapePrintHtml(ingredient.name)}</td>
          <td class="number">${escapePrintHtml(format(ingredient.quantity))}</td>
          <td>${escapePrintHtml(ingredient.unit)}</td>
        </tr>`).join("");

  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapePrintHtml(recipe.productName)} — دفتر الوصفات</title>
    <style>
      @page { size: A4 portrait; margin: 16mm; }
      :root { color-scheme: light; font-family: Tahoma, Arial, sans-serif; }
      body { margin: 0; color: #17202a; background: #fff; direction: rtl; line-height: 1.6; }
      h1 { margin: 0 0 4px; font-size: 24px; }
      h2 { margin: 0; font-size: 16px; color: #7c2d12; }
      .header { border-bottom: 2px solid #9a3412; padding-bottom: 12px; margin-bottom: 18px; }
      .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 14px 0 20px; }
      .meta-item { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
      .label { display: block; color: #6b7280; font-size: 11px; }
      .value { display: block; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #d1d5db; padding: 8px; text-align: right; }
      th { background: #fff7ed; color: #7c2d12; }
      .number { direction: ltr; text-align: right; font-family: monospace; }
      .notes { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; min-height: 35px; white-space: normal; }
      .section { margin-top: 20px; }
      .workflow { margin-top: 22px; color: #4b5563; font-size: 11px; }
    </style>
  </head>
  <body>
    <header class="header">
      <h1>دفتر وصفات المطبخ المركزي</h1>
      <h2>${escapePrintHtml(recipe.productName)}</h2>
    </header>
    <section class="meta" aria-label="بيانات الوصفة">
      <div class="meta-item"><span class="label">المنتج</span><span class="value">${escapePrintHtml(recipe.productName)}</span></div>
      <div class="meta-item"><span class="label">المطبخ</span><span class="value">${escapePrintHtml(kitchen)}</span></div>
      <div class="meta-item"><span class="label">الإصدار</span><span class="value">${escapePrintHtml(recipe.version)}</span></div>
      <div class="meta-item"><span class="label">الحالة</span><span class="value">${escapePrintHtml(statusNames[recipe.status])}</span></div>
      <div class="meta-item"><span class="label">ناتج الوصفة</span><span class="value">${escapePrintHtml(format(recipe.outputQuantity))} ${escapePrintHtml(recipe.outputUnit)}</span></div>
    </section>
    <section class="section">
      <h2>مواد الوصفة</h2>
      <table>
        <thead><tr><th>المادة</th><th>الكمية</th><th>الوحدة</th></tr></thead>
        <tbody>${ingredients || "<tr><td colspan=\"3\">لا توجد مواد</td></tr>"}</tbody>
      </table>
    </section>
    <section class="section">
      <h2>ملاحظات</h2>
      <div class="notes">${notes}</div>
    </section>
    <p class="workflow">المسودة تُعتمد أولاً. عند اختيار ربط الوصفة لدفعة جديدة تُجمّد لها نسخة الوصفة المعتمدة، ويُخصم احتياج المواد عند إتمام الدفعة؛ الاعتماد وحده لا يخصم المخزون. يمكن إنشاء دفعة غير مرتبطة عند اختيار ذلك في التشغيل، ولا تُعاد الدفعات السابقة للربط بأثر رجعي. تعديل الوصفة المعتمدة يكون عبر إصدار جديد.</p>
  </body>
</html>`;
}

export function writeRecipePrintDocument(popup: Window, recipe: PrintableRecipeContract, kitchenName?: string): void {
  try {
    popup.document.open();
    popup.document.write(buildRecipePrintDocument(recipe, kitchenName));
    popup.document.close();
    popup.focus();
    popup.print();
  } catch (error) {
    closeRecipePrintWindow(popup);
    throw error;
  }
}

async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, { method, credentials: "include", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    if (res.status === 403) throw new Error("لا تملك صلاحية تنفيذ هذا الإجراء في هذا المطبخ.");
    if (res.status === 409) throw new Error("تم تعديل الوصفة بواسطة مستخدم آخر. حدّث القائمة ثم حاول مجدداً.");
    const data = await res.json().catch(() => null) as { message?: string; error?: string } | null;
    throw new Error(data?.error || data?.message || "تعذر إتمام الطلب. حاول مجدداً.");
  }
  return res.json() as Promise<T>;
}

export function RecipeBook({ kitchens, kitchenId, onKitchenChange }: { kitchens: Kitchen[]; kitchenId: string; onKitchenChange: (id: string) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canRecipe = (action: RecipePermissionAction) => recipeHasPermission(hasPermission, action);
  const canViewRecipe = canRecipe("view");
  const canCreateRecipe = canRecipe("create");
  const canEditRecipe = canRecipe("edit");
  const canDeleteRecipe = canRecipe("delete");
  const canApproveRecipe = canRecipe("approve");
  const canPrintRecipe = canRecipe("print");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | CentralKitchenRecipeStatus>("all");
  const [selected, setSelected] = useState<CentralKitchenRecipeContract | null>(null);
  const [editor, setEditor] = useState<{ recipe: CentralKitchenRecipeContract | null; draft: RecipeDraft } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "approve" | "delete"; recipe: CentralKitchenRecipeContract } | null>(null);
  const idempotencyKeys = useRef(new Map<string, string>());
  const keyFor = (signature: string) => {
    const current = idempotencyKeys.current.get(signature);
    if (current) return current;
    const created = crypto.randomUUID();
    idempotencyKeys.current.set(signature, created);
    return created;
  };
  const recipeKey = ["/api/central-kitchen-recipes", kitchenId];
  const recipes = useQuery<CentralKitchenRecipeContract[]>({
    queryKey: recipeKey,
    queryFn: () => api(`/api/central-kitchen-recipes?kitchenId=${encodeURIComponent(kitchenId)}`),
    enabled: Boolean(kitchenId) && canViewRecipe,
  });
  const catalog = useQuery<CentralKitchenRecipeCatalogContract>({
    queryKey: ["/api/central-kitchen-recipes/catalog", kitchenId],
    queryFn: () => api(`/api/central-kitchen-recipes/catalog?kitchenId=${encodeURIComponent(kitchenId)}`),
    enabled: Boolean(kitchenId) && canViewRecipe && (canCreateRecipe || canEditRecipe),
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["/api/central-kitchen-recipes"] });
  const closeEditor = () => setEditor(null);
  const write = useMutation({
    mutationFn: async () => {
      if (!editor) throw new Error("تعذر فتح نموذج الوصفة.");
      if (editor.recipe ? !canEditRecipe : !canCreateRecipe) {
        throw new Error("لا تملك صلاحية تنفيذ هذا الإجراء على دفتر الوصفات.");
      }
      const product = catalog.data?.products.find(item => item.id === Number(editor.draft.productId));
      if (!product) throw new Error("اختر منتجاً من الكتالوج.");
      if (!/^\d+(?:\.\d{1,6})?$/.test(editor.draft.outputQuantity) || Number(editor.draft.outputQuantity) <= 0) throw new Error("أدخل كمية إخراج موجبة.");
      if (!editor.draft.ingredients.length) throw new Error("أضف مادة واحدة على الأقل.");
      const used = new Set<number>();
      const ingredients = editor.draft.ingredients.map(item => {
        const material = catalog.data?.materials.find(candidate => candidate.id === Number(item.warehouseItemId));
        if (!material) throw new Error("اختر مادة من الكتالوج.");
        if (used.has(material.id)) throw new Error("لا يمكن تكرار المادة في الوصفة.");
        used.add(material.id);
        if (!/^\d+(?:\.\d{1,6})?$/.test(item.quantity) || Number(item.quantity) <= 0) throw new Error("كل كميات المواد يجب أن تكون موجبة.");
        return { warehouseItemId: material.id, quantity: Number(item.quantity), unit: material.unit };
      });
      const payload = { kitchenId, productId: product.id, outputQuantity: Number(editor.draft.outputQuantity), outputUnit: product.unit, notes: editor.draft.notes.trim() || null, ingredients };
      const signature = JSON.stringify({ action: editor.recipe ? "update" : "create", id: editor.recipe?.id || null, payload, version: editor.recipe?.version || null, updateToken: editor.recipe?.updateToken || null });
      const idempotencyKey = keyFor(signature);
      if (editor.recipe) return { signature, response: await api(`/api/central-kitchen-recipes/${editor.recipe.id}`, "PATCH", { ...payload, version: editor.recipe.version, updateToken: editor.recipe.updateToken, idempotencyKey }) };
      return { signature, response: await api("/api/central-kitchen-recipes", "POST", { ...payload, idempotencyKey }) };
    },
    onSuccess: ({ signature }) => { idempotencyKeys.current.delete(signature); closeEditor(); refresh(); toast({ title: "تم حفظ مسودة الوصفة" }); },
    onError: error => toast({ title: "لم تُحفظ الوصفة", description: error instanceof Error ? error.message : "تحقق من البيانات.", variant: "destructive" }),
  });
  const action = useMutation({
    mutationFn: async () => {
      if (!confirm) throw new Error("تعذر تحديد إجراء الوصفة.");
      const { recipe, kind } = confirm;
      if (kind === "delete" && !canDeleteRecipe) {
        throw new Error("لا تملك صلاحية حذف مسودة الوصفة.");
      }
      if (kind === "approve" && !canApproveRecipe) {
        throw new Error("لا تملك صلاحية اعتماد الوصفة.");
      }
      const signature = JSON.stringify({ action: kind, id: recipe.id, version: recipe.version, updateToken: recipe.updateToken });
      const idempotencyKey = keyFor(signature);
      if (kind === "delete") return { signature, response: await api(`/api/central-kitchen-recipes/${recipe.id}`, "DELETE", { version: recipe.version, updateToken: recipe.updateToken, idempotencyKey }) };
      return { signature, response: await api(`/api/central-kitchen-recipes/${recipe.id}/approve`, "POST", { version: recipe.version, updateToken: recipe.updateToken, idempotencyKey }) };
    },
    onSuccess: ({ signature }) => { const kind = confirm?.kind; idempotencyKeys.current.delete(signature); setConfirm(null); setSelected(null); refresh(); toast({ title: kind === "approve" ? "تم اعتماد الوصفة" : "تم حذف المسودة" }); },
    onError: error => toast({ title: "تعذر إتمام الإجراء", description: error instanceof Error ? error.message : "حاول مجدداً.", variant: "destructive" }),
  });
  const revise = useMutation({
    mutationFn: async (recipe: CentralKitchenRecipeContract) => {
      if (!canCreateRecipe) throw new Error("لا تملك صلاحية إنشاء إصدار جديد من الوصفة.");
      const signature = JSON.stringify({ action: "revise", id: recipe.id, version: recipe.version, updateToken: recipe.updateToken });
      return { signature, recipe: await api<CentralKitchenRecipeContract>(`/api/central-kitchen-recipes/${recipe.id}/revise`, "POST", { version: recipe.version, updateToken: recipe.updateToken, idempotencyKey: keyFor(signature) }) };
    },
    onSuccess: ({ signature, recipe }) => { idempotencyKeys.current.delete(signature); refresh(); setSelected(null); openEditor(recipe); toast({ title: "تم إنشاء مسودة مراجعة" }); },
    onError: error => toast({ title: "تعذر إنشاء المراجعة", description: error instanceof Error ? error.message : "حاول مجدداً.", variant: "destructive" }),
  });
  const print = useMutation({
    mutationFn: async ({ recipe }: { recipe: CentralKitchenRecipeContract; popup: Window }): Promise<PrintableRecipeContract> => {
      if (!canViewRecipe || !canPrintRecipe) {
        throw new Error("لا تملك صلاحية طباعة الوصفة.");
      }
      return api<PrintableRecipeContract>(`/api/central-kitchen-recipes/${recipe.id}/print`);
    },
    onSuccess: (recipe, { popup }) => {
      try {
        writeRecipePrintDocument(
          popup,
          recipe,
          kitchens.find(kitchen => kitchen.id === recipe.kitchenId)?.name,
        );
      } catch {
        toast({
          title: "تعذر تجهيز نسخة الطباعة",
          description: "تعذر إنشاء مستند الوصفة للطباعة. حاول مجدداً.",
          variant: "destructive",
        });
      }
    },
    onError: (error, variables) => {
      if (variables?.popup) closeRecipePrintWindow(variables.popup);
      toast({
        title: "تعذر تحميل الوصفة للطباعة",
        description: error instanceof Error ? error.message : "تحقق من الاتصال ثم حاول مجدداً.",
        variant: "destructive",
      });
    },
  });
  const startPrint = (recipe: CentralKitchenRecipeContract) => {
    if (!canViewRecipe || !canPrintRecipe) return;
    let popup: Window | null = null;
    try {
      // Open in the click handler, before the asynchronous authorized fetch,
      // so browsers do not classify the print window as an unsolicited popup.
      popup = openRecipePrintWindow((url, target) => window.open(url, target));
    } catch {
      popup = null;
    }
    if (!popup) {
      toast({
        title: "تعذر فتح نافذة الطباعة",
        description: "اسمح بالنوافذ المنبثقة لهذا الموقع ثم حاول مجدداً.",
        variant: "destructive",
      });
      return;
    }
    print.mutate({ recipe, popup });
  };
  const openEditor = (recipe: CentralKitchenRecipeContract | null) => setEditor({ recipe, draft: recipe ? { productId: String(recipe.productId), outputQuantity: String(recipe.outputQuantity), notes: recipe.notes || "", ingredients: recipe.ingredients.map(i => ({ warehouseItemId: String(i.warehouseItemId), quantity: String(i.quantity) })) } : emptyDraft() });
  const prepareImportedRecipe = (draft: PreparedImportedRecipe) => {
    setSelected(null);
    setEditor({
      recipe: null,
      draft: {
        productId: String(draft.productId),
        outputQuantity: draft.outputQuantity,
        notes: draft.notes,
        ingredients: draft.ingredients.map(ingredient => ({
          warehouseItemId: String(ingredient.warehouseItemId),
          quantity: ingredient.quantity,
        })),
      },
    });
  };
  const filtered = useMemo(() => (recipes.data || []).filter(recipe => (filter === "all" || recipe.status === filter) && recipe.productName.toLowerCase().includes(search.trim().toLowerCase())), [recipes.data, filter, search]);
  const canWrite = canCreateRecipe;

  if (!canViewRecipe) return <State icon={<AlertTriangle />} title="لا تملك صلاحية عرض الوصفات" text="تحتاج إلى صلاحية عرض دفتر وصفات المطبخ المركزي للوصول إلى هذه الصفحة." />;
  return <section className="space-y-5">
    <Card className="overflow-hidden border-0 bg-[linear-gradient(120deg,hsl(22_55%_25%),hsl(350_38%_31%))] text-white shadow-lg"><CardContent className="p-5 sm:p-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 flex items-center gap-2 text-orange-100"><ClipboardList className="h-5 w-5" /><span className="text-xs font-semibold tracking-[.14em]">دفتر وصفات قابل للمراجعة</span></div><h2 className="text-2xl font-bold">وصفة معتمدة، وسجل لا ينسى.</h2><p className="mt-2 max-w-2xl text-sm text-orange-50">تبدأ الوصفة كمسودة ثم تُعتمد. عند اختيار ربط الوصفة لدفعة جديدة تُجمّد لها نسخة الوصفة المعتمدة، ويُخصم احتياج المواد عند إتمام الدفعة؛ الاعتماد وحده لا يخصم المخزون. يمكن اختيار دفعة غير مرتبطة بوصفة من التشغيل، ولا تُعاد الدفعات السابقة للربط بأثر رجعي. مراجعة الوصفة المعتمدة تكون إصداراً جديداً.</p></div><div className="flex flex-wrap gap-2"><Select value={kitchenId} onValueChange={onKitchenChange}><SelectTrigger className="w-52 border-white/20 bg-white/10 text-white"><SelectValue placeholder="اختر المطبخ" /></SelectTrigger><SelectContent>{kitchens.map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent></Select><Button variant="secondary" size="icon" onClick={refresh} aria-label="تحديث"><RefreshCw className={`h-4 w-4 ${recipes.isFetching ? "animate-spin" : ""}`} /></Button>{canWrite && <Button onClick={() => openEditor(null)}><FilePlus2 className="ml-2 h-4 w-4" />مسودة جديدة</Button>}</div></div></CardContent></Card>
     {kitchenId && <ImportedRecipes kitchenId={kitchenId} catalog={catalog.data} recipes={recipes.data} existingRecipesLoaded={!recipes.isLoading && !recipes.isError} canView={canViewRecipe} canCreate={canCreateRecipe} onPrepare={prepareImportedRecipe} />}
     {!kitchenId ? <State icon={<ClipboardList />} title="اختر مطبخاً مركزياً" text="اختر المطبخ لعرض وصفاته وسجل اعتمادها." /> : recipes.isLoading ? <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div> : recipes.isError ? <State icon={<AlertTriangle />} title="تعذر تحميل دفتر الوصفات" text={recipes.error instanceof Error ? recipes.error.message : "تحقق من الاتصال."} action={<Button onClick={() => recipes.refetch()} variant="outline">إعادة المحاولة</Button>} /> : <>
      <div className="flex flex-col gap-3 sm:flex-row"><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث باسم المنتج…" className="sm:max-w-sm" /><Select value={filter} onValueChange={value => setFilter(value as typeof filter)}><SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem><SelectItem value="approved">المعتمدة</SelectItem><SelectItem value="draft">المسودات</SelectItem><SelectItem value="superseded">السجل المستبدل</SelectItem></SelectContent></Select></div>
      {filtered.length === 0 ? <State icon={<History />} title={recipes.data?.length ? "لا نتائج مطابقة" : "لا توجد وصفات بعد"} text={recipes.data?.length ? "غيّر البحث أو تصفية الحالة." : "ابدأ بمسودة تربط منتج الكتالوج بمواد المطبخ."} /> : <Card><CardContent className="p-0"><div className="divide-y">{filtered.map(recipe => <button type="button" key={recipe.id} onClick={() => setSelected(recipe)} className="flex w-full items-center gap-3 p-4 text-right transition-colors hover:bg-muted/45"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{recipe.productName}</p><Badge variant="outline" className={statusClass[recipe.status]}>{statusNames[recipe.status]}</Badge></div><p className="mt-1 text-xs text-muted-foreground">إخراج {format(recipe.outputQuantity)} {recipe.outputUnit} · {recipe.ingredients.length} مواد · آخر تحديث {dateTime(recipe.updatedAt)}</p></div><Eye className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}</div></CardContent></Card>}
    </>}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}><DialogContent dir="rtl" className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle className="flex flex-wrap items-center gap-2">{selected?.productName}<Badge variant="outline" className={selected ? statusClass[selected.status] : ""}>{selected && statusNames[selected.status]}</Badge></DialogTitle><DialogDescription>إخراج {selected && format(selected.outputQuantity)} {selected?.outputUnit}</DialogDescription></DialogHeader>{selected && <RecipeDetails recipe={selected} />}<DialogFooter className="gap-2 sm:gap-0">{selected && canViewRecipe && canPrintRecipe && <Button data-testid="recipe-print" variant="outline" onClick={() => startPrint(selected)} disabled={print.isPending}>{print.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Printer className="ml-2 h-4 w-4" />}{print.isPending ? "جارٍ تجهيز الطباعة" : "طباعة"}</Button>}{selected?.status === "draft" && canEditRecipe && <Button variant="outline" onClick={() => { openEditor(selected); setSelected(null); }}><Pencil className="ml-2 h-4 w-4" />تعديل</Button>}{selected?.status === "draft" && canDeleteRecipe && <Button variant="destructive" onClick={() => setConfirm({ kind: "delete", recipe: selected })}><Trash2 className="ml-2 h-4 w-4" />حذف</Button>}{selected?.status === "draft" && canApproveRecipe && <Button onClick={() => setConfirm({ kind: "approve", recipe: selected })}><CheckCircle2 className="ml-2 h-4 w-4" />اعتماد</Button>}{selected?.status === "approved" && canCreateRecipe && <Button onClick={() => revise.mutate(selected)} disabled={revise.isPending}>{revise.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}إنشاء مراجعة</Button>}</DialogFooter></DialogContent></Dialog>
    <Dialog open={!!editor} onOpenChange={open => !open && !write.isPending && closeEditor()}><DialogContent dir="rtl" className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editor?.recipe ? "تعديل مسودة الوصفة" : "مسودة وصفة جديدة"}</DialogTitle><DialogDescription>الوحدات تأتي من الكتالوج ولا يمكن تعديلها هنا.</DialogDescription></DialogHeader>{editor && <RecipeForm draft={editor.draft} catalog={catalog.data} disabled={write.isPending || catalog.isLoading} productDisabled={Boolean(editor.recipe)} onChange={draft => setEditor(current => current ? { ...current, draft } : current)} />}<DialogFooter><Button variant="outline" onClick={closeEditor} disabled={write.isPending}>إلغاء</Button><Button onClick={() => write.mutate()} disabled={write.isPending || catalog.isLoading}>{write.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}حفظ المسودة</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={!!confirm} onOpenChange={open => !open && setConfirm(null)}><DialogContent dir="rtl"><DialogHeader><DialogTitle>{confirm?.kind === "approve" ? "اعتماد الوصفة" : "حذف المسودة"}</DialogTitle><DialogDescription>{confirm?.kind === "approve" ? "سيُتاح الإصدار المعتمد للربط الاختياري بدفعات جديدة. عند اختيار الربط تُجمّد الوصفة للدفعة ويُخصم احتياج المواد عند إتمامها؛ الاعتماد نفسه لا يخصم أي مخزون، ويمكن أن تبقى الدفعة غير مرتبطة." : "ستُحذف هذه المسودة نهائياً. لا يمكن حذف الوصفات المعتمدة أو المستبدلة."}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirm(null)}>إلغاء</Button><Button variant={confirm?.kind === "delete" ? "destructive" : "default"} disabled={action.isPending} onClick={() => action.mutate()}>{action.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}{confirm?.kind === "approve" ? "تأكيد الاعتماد" : "تأكيد الحذف"}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}

function RecipeForm({ draft, catalog, disabled, productDisabled, onChange }: { draft: RecipeDraft; catalog?: CentralKitchenRecipeCatalogContract; disabled: boolean; productDisabled: boolean; onChange: (draft: RecipeDraft) => void }) {
  const product = catalog?.products.find(item => item.id === Number(draft.productId));
  const updateIngredient = (index: number, next: Partial<IngredientDraft>) => onChange({ ...draft, ingredients: draft.ingredients.map((item, i) => i === index ? { ...item, ...next } : item) });
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><div><Label>منتج الإخراج</Label><Select value={draft.productId} onValueChange={value => onChange({ ...draft, productId: value })} disabled={disabled || productDisabled}><SelectTrigger className="mt-1"><SelectValue placeholder="اختر المنتج" /></SelectTrigger><SelectContent>{catalog?.products.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div><div><Label>كمية الإخراج</Label><div className="mt-1 flex gap-2"><Input dir="ltr" type="number" min="0.000001" step="0.000001" value={draft.outputQuantity} onChange={e => onChange({ ...draft, outputQuantity: e.target.value })} disabled={disabled} /><div className="flex w-20 items-center justify-center rounded-md border bg-muted text-sm">{product?.unit || "الوحدة"}</div></div></div></div><div className="rounded-xl border"><div className="flex items-center justify-between border-b px-3 py-2"><div><p className="text-sm font-semibold">مواد الوصفة</p><p className="text-xs text-muted-foreground">لا يمكن تكرار المادة.</p></div><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onChange({ ...draft, ingredients: [...draft.ingredients, { warehouseItemId: "", quantity: "" }] })}><Plus className="ml-1 h-4 w-4" />إضافة مادة</Button></div><div className="space-y-3 p-3">{draft.ingredients.map((ingredient, index) => { const material = catalog?.materials.find(item => item.id === Number(ingredient.warehouseItemId)); return <div key={index} className="grid gap-2 sm:grid-cols-[1fr_140px_76px_auto] sm:items-end"><div><Label className="text-xs">المادة</Label><Select value={ingredient.warehouseItemId} onValueChange={value => updateIngredient(index, { warehouseItemId: value })} disabled={disabled}><SelectTrigger className="mt-1"><SelectValue placeholder="اختر المادة" /></SelectTrigger><SelectContent>{catalog?.materials.map(item => <SelectItem key={item.id} value={String(item.id)} disabled={draft.ingredients.some((v, i) => i !== index && v.warehouseItemId === String(item.id))}>{item.name}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">الكمية</Label><Input dir="ltr" className="mt-1" type="number" min="0.000001" step="0.000001" value={ingredient.quantity} onChange={e => updateIngredient(index, { quantity: e.target.value })} disabled={disabled} /></div><div><Label className="text-xs">الوحدة</Label><div className="mt-1 flex h-10 items-center justify-center rounded-md border bg-muted text-xs">{material?.unit || "—"}</div></div><Button type="button" size="icon" variant="ghost" disabled={disabled || draft.ingredients.length === 1} onClick={() => onChange({ ...draft, ingredients: draft.ingredients.filter((_, i) => i !== index) })} aria-label="حذف المادة"><Trash2 className="h-4 w-4 text-destructive" /></Button></div>; })}</div></div><div><Label>ملاحظات</Label><Textarea className="mt-1 min-h-24" maxLength={2000} value={draft.notes} onChange={e => onChange({ ...draft, notes: e.target.value })} disabled={disabled} placeholder="معلومة تشغيلية أو وصف مختصر…" /></div></div>;
}

function RecipeDetails({ recipe }: { recipe: CentralKitchenRecipeContract }) { return <div className="space-y-4 text-sm"><div className="grid gap-2 rounded-xl bg-muted/50 p-3 sm:grid-cols-2"><p><span className="text-muted-foreground">أنشأها:</span> {recipe.createdBy} · {dateTime(recipe.createdAt)}</p><p><span className="text-muted-foreground">آخر تعديل:</span> {recipe.updatedBy} · {dateTime(recipe.updatedAt)}</p>{recipe.approvedBy && <p className="sm:col-span-2"><span className="text-muted-foreground">اعتمدها:</span> {recipe.approvedBy} · {dateTime(recipe.approvedAt)}</p>}</div><div><p className="mb-2 font-semibold">المواد</p><div className="overflow-hidden rounded-xl border">{recipe.ingredients.map(item => <div key={item.id} className="flex justify-between border-b px-3 py-2 last:border-0"><span>{item.name}</span><span className="font-mono">{format(item.quantity)} {item.unit}</span></div>)}</div></div>{recipe.notes && <div><p className="font-semibold">ملاحظات</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{recipe.notes}</p></div>}</div>; }
function State({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) { return <Card><CardContent className="flex flex-col items-center py-14 text-center"><div className="mb-3 text-muted-foreground">{icon}</div><h3 className="font-semibold">{title}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p>{action && <div className="mt-4">{action}</div>}</CardContent></Card>; }