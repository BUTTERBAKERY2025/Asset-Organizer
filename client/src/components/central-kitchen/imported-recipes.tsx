import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileText,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  allImportedReviewIssuesResolved,
  canReviewImportedRecipes,
  getImportSourceMarker,
  ingredientReviewIsResolved,
  isBoxToPieceOutputEquivalence,
  prepareImportedRecipe,
  recipeMatchesImportSource,
  requiresNumericAcknowledgement,
  sameRecipeUnit,
  type ImportedIngredientReview,
  type ImportedRecipeCatalogMaterial,
  type ImportedRecipeCatalogProduct,
  type ImportedRecipeReview,
  type ImportedRecipeSource,
  type PreparedImportedRecipe,
} from "./imported-recipes-model";

type RecipeCatalog = {
  products: ImportedRecipeCatalogProduct[];
  materials: ImportedRecipeCatalogMaterial[];
};

type ExistingRecipe = { notes?: string | null };

type ImportSourcesResponse = { sources: ImportedRecipeSource[] };

export type ImportedRecipesProps = {
  kitchenId: string;
  catalog?: RecipeCatalog;
  recipes?: ExistingRecipe[];
  existingRecipesLoaded: boolean;
  canView: boolean;
  canCreate: boolean;
  onPrepare: (draft: PreparedImportedRecipe) => void;
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function fetchImportSources(kitchenId: string): Promise<ImportSourcesResponse> {
  const response = await fetch(
    `/api/central-kitchen-recipes/import-sources?kitchenId=${encodeURIComponent(kitchenId)}`,
    { credentials: "include", cache: "no-store" },
  );
  if (!response.ok) {
    let message = "تعذر تحميل الوصفات المستوردة.";
    try {
      const body = await response.json() as { error?: unknown; message?: unknown };
      if (typeof body.error === "string" && body.error.trim()) message = body.error;
      else if (typeof body.message === "string" && body.message.trim()) message = body.message;
    } catch {
      // Keep the explicit fallback when the response is not JSON.
    }
    throw new Error(message);
  }
  const body = await response.json() as ImportSourcesResponse;
  if (!body || !Array.isArray(body.sources)) {
    throw new Error("استجابة الوصفات المستوردة غير صالحة.");
  }
  return body;
}

function sourceReviewState(source: ImportedRecipeSource): ImportedRecipeReview {
  return {
    sourceId: source.sourceId,
    productId: source.productId === null ? "" : String(source.productId),
    outputQuantity: source.outputQuantity === null ? "" : String(source.outputQuantity),
    ingredients: source.ingredients.map((ingredient, index) => ({
      rowId: `source:${index}`,
      sourceName: ingredient.sourceName,
      sourceQuantity: ingredient.sourceQuantity,
      sourceUnit: ingredient.sourceUnit,
      warehouseItemId: ingredient.warehouseItemId === null ? "" : String(ingredient.warehouseItemId),
      quantity: ingredient.quantity === null ? "" : String(ingredient.quantity),
      issue: ingredient.issue,
      quantityEdited: false,
      issueAcknowledged: false,
      numericAcknowledged: false,
    })),
    removedSourceRows: [],
    acknowledgedSourceIssues: [],
    notes: "",
    outputUnitAcknowledged: false,
  };
}

function sourceIssueKey(index: number): string {
  return `source:${index}`;
}

function numberText(value: number | null): string {
  return value === null ? "—" : new Intl.NumberFormat("ar-SA-u-nu-latn", {
    maximumFractionDigits: 6,
  }).format(value);
}

function sourceUnitMatchesMaterial(
  source: ImportedRecipeSource["ingredients"][number],
  material?: ImportedRecipeCatalogMaterial,
): boolean {
  if (!material) return false;
  const sourceUnit = (source.unit || source.sourceUnit || "").trim();
  return Boolean(sourceUnit) && sameRecipeUnit(sourceUnit, material.unit);
}

function rowSource(
  source: ImportedRecipeSource,
  row: ImportedIngredientReview,
): ImportedRecipeSource["ingredients"][number] {
  if (!row.rowId.startsWith("source:")) {
    return {
      sourceName: row.sourceName,
      sourceQuantity: row.sourceQuantity,
      sourceUnit: row.sourceUnit,
      warehouseItemId: null,
      quantity: null,
      unit: null,
      issue: row.issue,
    };
  }
  const index = Number(row.rowId.slice("source:".length));
  return source.ingredients[index] || {
    sourceName: row.sourceName,
    sourceQuantity: row.sourceQuantity,
    sourceUnit: row.sourceUnit,
    warehouseItemId: null,
    quantity: null,
    unit: null,
    issue: row.issue,
  };
}

export function ImportedRecipes({
  kitchenId,
  catalog,
  recipes = [],
  existingRecipesLoaded,
  canView,
  canCreate,
  onPrepare,
}: ImportedRecipesProps) {
  const [reviewSource, setReviewSource] = useState<ImportedRecipeSource | null>(null);
  const [sourcePreview, setSourcePreview] = useState<ImportedRecipeSource | null>(null);
  const [review, setReview] = useState<ImportedRecipeReview | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ImportedIngredientReview | null>(null);

  const sources = useQuery<ImportSourcesResponse, Error>({
    queryKey: ["/api/central-kitchen-recipes/import-sources", kitchenId],
    queryFn: () => fetchImportSources(kitchenId),
    enabled: Boolean(kitchenId) && canView,
    staleTime: 10_000,
  });

  const matchedSourceIds = useMemo(() => new Set(
    (sources.data?.sources || [])
      .filter(source => recipes.some(recipe => recipeMatchesImportSource(recipe, source.sourceId)))
      .map(source => source.sourceId),
  ), [recipes, sources.data?.sources]);

  const openReview = (source: ImportedRecipeSource) => {
    if (!canReviewImportedRecipes(canView, canCreate) || !existingRecipesLoaded || matchedSourceIds.has(source.sourceId)) return;
    setReviewSource(source);
    setReview(sourceReviewState(source));
  };

  const closeReview = () => {
    setReviewSource(null);
    setReview(null);
    setRemoveTarget(null);
  };

  const updateReview = (change: (current: ImportedRecipeReview) => ImportedRecipeReview) => {
    setReview(current => current ? change(current) : current);
  };

  const updateIngredient = (
    rowId: string,
    patch: Partial<ImportedIngredientReview>,
  ) => updateReview(current => ({
    ...current,
    ingredients: current.ingredients.map(row => row.rowId === rowId ? { ...row, ...patch } : row),
  }));

  const removeIngredient = () => {
    if (!removeTarget) return;
    const rowId = removeTarget.rowId;
    updateReview(current => ({
      ...current,
      ingredients: current.ingredients.filter(row => row.rowId !== rowId),
      removedSourceRows: rowId.startsWith("source:")
        ? [...new Set([...current.removedSourceRows, rowId])]
        : current.removedSourceRows,
    }));
    setRemoveTarget(null);
  };

  const addIngredient = () => updateReview(current => ({
    ...current,
    ingredients: [
      ...current.ingredients,
      {
        rowId: `added:${Date.now()}:${current.ingredients.length}`,
        sourceName: "مادة مضافة يدوياً",
        sourceQuantity: "",
        sourceUnit: "",
        warehouseItemId: "",
        quantity: "",
        issue: null,
        quantityEdited: true,
        issueAcknowledged: true,
        numericAcknowledged: true,
      },
    ],
  }));

  const reviewErrors = useMemo(() => {
    if (!reviewSource || !review || !catalog) return [];
    const product = catalog.products.find(item => item.id === Number(review.productId));
    const errors: string[] = [];
    if (!product) errors.push("اختر منتج الإخراج من الكتالوج.");
    if (!/^\d+(?:\.\d{1,6})?$/.test(review.outputQuantity) || Number(review.outputQuantity) <= 0) {
      errors.push("أدخل كمية إخراج موجبة بدقة لا تتجاوز ست خانات عشرية.");
    }
    if (review.notes.toLocaleUpperCase("en-US").includes("UNRESOLVED")) {
      errors.push("لا يمكن أن تحتوي ملاحظات الوصفة على علامة استيراد غير محسومة.");
    }
    if (reviewSource.outputUnit && product && !sameRecipeUnit(reviewSource.outputUnit, product.unit)) {
      if (isBoxToPieceOutputEquivalence(reviewSource.outputUnit, product.unit)) {
        if (review.outputUnitAcknowledged !== true) {
          errors.push("أكّد أن وحدة قطعة الكتالوج تمثل صندوقاً واحداً لهذا المصدر؛ لا يُفترض تحويل العدد.");
        }
      } else {
        errors.push("وحدة الناتج المصدر لا تطابق وحدة المنتج؛ اختر منتجاً بوحدة مطابقة، دون تحويل مفترض.");
      }
    }
    if (!review.ingredients.length) errors.push("أضف مادة واحدة على الأقل قبل الحفظ.");
    for (const row of review.ingredients) {
      const sourceRow = rowSource(reviewSource, row);
      const material = catalog.materials.find(item => item.id === Number(row.warehouseItemId));
      const explicitUnitCorrection = row.quantityEdited && row.numericAcknowledged;
      if (!row.rowId.startsWith("added:")
        && !sourceUnitMatchesMaterial(sourceRow, material)
        && !explicitUnitCorrection) {
        errors.push(`وحدة مادة المصدر «${row.sourceName || "بدون اسم"}» لا تطابق وحدة المادة المختارة.`);
      }
      if (!ingredientReviewIsResolved(row, sourceRow, material)) {
        errors.push(`لم تكتمل مراجعة مادة المصدر «${row.sourceName || "بدون اسم"}».`);
      }
    }
    if (!allImportedReviewIssuesResolved(reviewSource, review)) {
      errors.push("أكّد معالجة كل ملاحظات المصدر والمواد.");
    }
    return [...new Set(errors)];
  }, [catalog, review, reviewSource]);

  const saveReview = () => {
    if (!reviewSource || !review || !catalog) return;
    try {
      const prepared = prepareImportedRecipe(
        reviewSource,
        review,
        catalog.products,
        catalog.materials,
      );
      onPrepare(prepared);
      closeReview();
    } catch (error) {
      // The errors are also rendered inline; this guard keeps the callback
      // from being called when a stale catalog changed during review.
      void error;
    }
  };

  if (!canView) return null;

  return <section className="space-y-4" aria-labelledby="imported-recipes-title">
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-100 p-2 text-amber-800"><ClipboardCheck className="h-5 w-5" /></div>
            <div>
              <h2 id="imported-recipes-title" className="font-semibold text-amber-950">وصفات مستوردة بانتظار المراجعة</h2>
              <p className="mt-1 text-sm text-amber-900/80">هذه البطاقات واردة من المصدر على الخادم، وليست وصفات محفوظة أو معتمدة. راجع كل ربط قبل فتح محرر الحفظ المعتاد.</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => sources.refetch()} disabled={sources.isFetching}>
            <RefreshCw className={`ml-2 h-4 w-4 ${sources.isFetching ? "animate-spin" : ""}`} />تحديث المصادر
          </Button>
        </div>
        {!canCreate && <p className="rounded-md border border-amber-300 bg-background p-2 text-xs text-amber-900">عرض المصدر متاح بصلاحية العرض فقط؛ فتح مراجعة أو إعداد وصفة يتطلب صلاحية العرض والإنشاء معاً.</p>}
        {canCreate && !existingRecipesLoaded && <p className="rounded-md border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">جارٍ التحقق من الوصفات المحفوظة لمنع استيراد المصدر نفسه مرة أخرى؛ ستتاح المراجعة بعد اكتمال القائمة.</p>}
      </CardContent>
    </Card>

    {sources.isLoading ? <div className="space-y-2">{[1, 2, 3].map(index => <div key={index} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
      : sources.isError ? <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-destructive"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{errorMessage(sources.error, "تعذر تحميل الوصفات المستوردة.")}</span><Button type="button" variant="outline" size="sm" onClick={() => sources.refetch()}>إعادة المحاولة</Button></CardContent></Card>
        : !sources.data?.sources.length ? <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">لا توجد بطاقات استيراد لهذا المطبخ.</CardContent></Card>
          : <div className="grid gap-3 lg:grid-cols-2">{sources.data.sources.map(source => {
            const matched = matchedSourceIds.has(source.sourceId);
            return <Card key={source.sourceId} className={matched ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200"}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{source.name || "وصفة مستوردة بدون اسم"}</h3>
                      {matched ? <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800"><CheckCircle2 className="ml-1 h-3.5 w-3.5" />تم ربطها بوصفة محفوظة</Badge> : <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">بانتظار المراجعة</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">ناتج المصدر: {numberText(source.outputQuantity)} {source.outputUnit || "وحدة غير محددة"} · {source.ingredients.length} مواد · معرف المصدر {source.sourceId}</p>
                  </div>
                  {source.issues.length > 0 && <Badge variant="outline" className="shrink-0 border-rose-300 bg-rose-50 text-rose-800"><AlertTriangle className="ml-1 h-3.5 w-3.5" />{source.issues.length} ملاحظات</Badge>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setSourcePreview(source)}>
                    <FileText className="ml-2 h-4 w-4" />عرض النص الأصلي
                  </Button>
                  <Button type="button" size="sm" onClick={() => openReview(source)} disabled={!canCreate || !existingRecipesLoaded || matched}>
                    <ClipboardCheck className="ml-2 h-4 w-4" />{matched ? "تمت المعالجة" : !existingRecipesLoaded ? "بانتظار التحقق" : canCreate ? "مراجعة وإعداد المسودة" : "تتطلب صلاحية الإنشاء"}
                  </Button>
                </div>
              </CardContent>
            </Card>;
          })}</div>}

    <Dialog open={!!sourcePreview} onOpenChange={open => !open && setSourcePreview(null)}>
      <DialogContent dir="rtl" className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5" />النص الأصلي المستورد</DialogTitle>
          <DialogDescription>{sourcePreview?.name} · للعرض فقط، ولا يُحفظ النص الكامل في ملاحظات الوصفة.</DialogDescription>
        </DialogHeader>
        <pre className="max-h-[55dvh] overflow-auto whitespace-pre-wrap rounded-xl border bg-muted/30 p-4 text-sm leading-7">{sourcePreview?.rawSourceText || "لا يوجد نص مصدر."}</pre>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setSourcePreview(null)}>إغلاق</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={!!reviewSource && !!review} onOpenChange={open => !open && closeReview()}>
      <DialogContent dir="rtl" className="max-h-[94dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>مراجعة الوصفة المستوردة: {reviewSource?.name}</DialogTitle>
          <DialogDescription>لن تُنشأ وصفة أو تُكتب بيانات حتى تكتمل المراجعة. بعد ذلك يُفتح محرر الوصفة المعتاد للمراجعة النهائية ثم الحفظ.</DialogDescription>
        </DialogHeader>
        {reviewSource && review && <div className="space-y-5">
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-semibold">النص الأصلي (للمقارنة فقط)</p>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSourcePreview(reviewSource)}><Eye className="ml-1 h-4 w-4" />عرض موسع</Button>
            </div>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-6 text-muted-foreground">{reviewSource.rawSourceText || "لا يوجد نص مصدر."}</pre>
          </div>

          {reviewSource.issues.length > 0 && <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/60 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-rose-900"><AlertTriangle className="h-4 w-4" />ملاحظات المصدر العامة</p>
            {reviewSource.issues.map((issue, index) => <label key={`${sourceIssueKey(index)}:${issue}`} className="flex cursor-pointer items-start gap-2 text-sm text-rose-900">
              <Checkbox checked={review.acknowledgedSourceIssues.includes(sourceIssueKey(index))} onCheckedChange={checked => updateReview(current => ({ ...current, acknowledgedSourceIssues: checked === true ? [...new Set([...current.acknowledgedSourceIssues, sourceIssueKey(index)])] : current.acknowledgedSourceIssues.filter(key => key !== sourceIssueKey(index)) }))} className="mt-0.5" />
              <span>{issue}<span className="mt-0.5 block text-xs text-rose-800/80">أؤكد أنني راجعت هذه الملاحظة وعالجتها في البيانات أدناه.</span></span>
            </label>)}
          </div>}

          <div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
            <div>
              <Label>منتج الإخراج</Label>
              <Select value={review.productId} onValueChange={value => updateReview(current => ({ ...current, productId: value }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="اختر المنتج من الكتالوج" /></SelectTrigger>
                <SelectContent>{catalog?.products.map(product => <SelectItem key={product.id} value={String(product.id)}>{product.name} · {product.unit}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>كمية الإخراج</Label>
              <div className="mt-1 flex gap-2">
                <Input dir="ltr" type="number" min="0.000001" step="0.000001" value={review.outputQuantity} onChange={event => updateReview(current => ({ ...current, outputQuantity: event.target.value }))} />
                <div className="flex w-28 shrink-0 items-center justify-center rounded-md border bg-muted text-sm">{catalog?.products.find(item => item.id === Number(review.productId))?.unit || "وحدة المنتج"}</div>
              </div>
              {reviewSource.outputQuantity === null && <p className="mt-1 text-xs text-amber-800">لا يوجد ناتج موثوق في المصدر؛ أدخل الكمية يدوياً ولا تستخدم قيمة افتراضية.</p>}
              {reviewSource.outputUnit
                && catalog?.products.find(item => item.id === Number(review.productId))
                && !sameRecipeUnit(reviewSource.outputUnit, catalog.products.find(item => item.id === Number(review.productId))!.unit)
                && isBoxToPieceOutputEquivalence(reviewSource.outputUnit, catalog.products.find(item => item.id === Number(review.productId))!.unit)
                && <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">
                  <Checkbox checked={review.outputUnitAcknowledged === true} onCheckedChange={checked => updateReview(current => ({ ...current, outputUnitAcknowledged: checked === true }))} className="mt-0.5" />
                  <span>أقر أن وحدة الكتالوج «{catalog.products.find(item => item.id === Number(review.productId))?.unit}» تمثل صندوقاً واحداً لهذا المصدر. سيُحفظ العدد كما ورد بلا تحويل تلقائي من box إلى قطعة.</span>
                </label>}
              {reviewSource.outputUnit
                && catalog?.products.find(item => item.id === Number(review.productId))
                && !sameRecipeUnit(reviewSource.outputUnit, catalog.products.find(item => item.id === Number(review.productId))!.unit)
                && !isBoxToPieceOutputEquivalence(reviewSource.outputUnit, catalog.products.find(item => item.id === Number(review.productId))!.unit)
                && <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-900">وحدة الناتج لا تطابق وحدة المنتج ولا يوجد تحويل آمن معتمد؛ اختر منتجاً بوحدة مطابقة.</p>}
            </div>
          </div>

          <div className="rounded-xl border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
              <div><p className="font-semibold">مواد الوصفة</p><p className="text-xs text-muted-foreground">الوحدة المعروضة تأتي من المادة المختارة. لا يُفترض أي تحويل بين الوحدات؛ الأسطر التي تختار المادة نفسها تُجمع بدقة ست خانات عند فتح المحرر.</p></div>
              <Button type="button" size="sm" variant="outline" onClick={addIngredient}><Plus className="ml-1 h-4 w-4" />إضافة مادة</Button>
            </div>
            <div className="space-y-3 p-3">
              {review.ingredients.map(row => {
                const sourceRow = rowSource(reviewSource, row);
                const material = catalog?.materials.find(item => item.id === Number(row.warehouseItemId));
                const unitReview = Boolean(material) && !sourceUnitMatchesMaterial(sourceRow, material);
                const numericReview = requiresNumericAcknowledgement(sourceRow) || unitReview;
                return <div key={row.rowId} className="space-y-3 rounded-lg border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{row.sourceName || "مادة مضافة يدوياً"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">الأصل: {row.sourceQuantity || "—"} {row.sourceUnit || "وحدة غير محددة"}</p>
                    </div>
                    <Button type="button" size="icon" variant="ghost" aria-label={`طلب تأكيد حذف ${row.sourceName || "المادة"}`} onClick={() => setRemoveTarget(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_150px_100px] sm:items-end">
                    <div>
                      <Label className="text-xs">المادة من الكتالوج</Label>
                      <Select value={row.warehouseItemId} onValueChange={value => updateIngredient(row.rowId, { warehouseItemId: value })}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="اختر مادة مطابقة" /></SelectTrigger>
                        <SelectContent>{catalog?.materials.map(candidate => <SelectItem key={candidate.id} value={String(candidate.id)}>{candidate.name} · {candidate.unit}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">الكمية</Label>
                      <Input dir="ltr" className="mt-1" type="number" min="0.000001" step="0.000001" value={row.quantity} onChange={event => updateIngredient(row.rowId, { quantity: event.target.value, quantityEdited: true })} />
                    </div>
                    <div>
                      <Label className="text-xs">الوحدة الدقيقة</Label>
                      <div className="mt-1 flex h-10 items-center justify-center rounded-md border bg-muted text-xs">{material?.unit || "—"}</div>
                    </div>
                  </div>
                  {material && !sourceUnitMatchesMaterial(sourceRow, material) && <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{row.quantityEdited && row.numericAcknowledged ? "تم إدخال كمية مصححة صراحةً بوحدة المادة المختارة؛ لم يُفترض تحويل تلقائي من المصدر." : "وحدة المصدر لا تطابق وحدة المادة. أدخل كمية مصححة بوحدة المادة وأكّد الالتباس؛ لا يتم تحويل g إلى kg أو L أو قطعة تلقائياً."}</p>}
                  {row.issue && <label className="flex cursor-pointer items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-900">
                    <Checkbox checked={row.issueAcknowledged} onCheckedChange={checked => updateIngredient(row.rowId, { issueAcknowledged: checked === true })} className="mt-0.5" />
                    <span>{row.issue}<span className="mt-0.5 block">أؤكد أنني راجعت هذه الملاحظة وعالجتها.</span></span>
                  </label>}
                  {numericReview && <label className="flex cursor-pointer items-start gap-2 rounded-md border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
                    <Checkbox checked={row.numericAcknowledged} onCheckedChange={checked => updateIngredient(row.rowId, { numericAcknowledged: checked === true })} className="mt-0.5" />
                    <span>{requiresNumericAcknowledgement(sourceRow) ? "القيمة الرقمية الأصلية ملتبسة. أقرّ أنني عدّلت الكمية يدوياً وراجعت وحدتها (اختيار المادة وحده لا يحل الالتباس)." : "غيّرت وحدة المادة عن المصدر. أقرّ أنني أدخلت الكمية يدوياً بوحدة المادة المختارة (اختيار المادة وحده لا يحوّل القيمة)."}</span>
                  </label>}
                </div>;
              })}
              {!review.ingredients.length && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">أزيلت كل صفوف المصدر. أضف مادة أو ألغِ المراجعة قبل الحفظ.</p>}
            </div>
          </div>

          <div>
            <Label>ملاحظات طريقة الإدخال (اختياري)</Label>
            <Textarea className="mt-1 min-h-20" maxLength={1_900} value={review.notes} onChange={event => updateReview(current => ({ ...current, notes: event.target.value }))} placeholder="ملاحظة قصيرة ستُحفظ مع مرجع المصدر فقط؛ النص الأصلي الكامل يبقى في لوحة المصدر." />
            <p className="mt-1 text-xs text-muted-foreground">سيُحفظ المرجع {getImportSourceMarker(reviewSource.sourceId)} مع الملاحظات، بحد أقصى 2000 حرفاً.</p>
          </div>

          {reviewErrors.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p className="font-semibold">لا يمكن فتح محرر الحفظ بعد</p><ul className="mt-1 list-disc space-y-1 pr-4">{reviewErrors.slice(0, 8).map(error => <li key={error}>{error}</li>)}</ul></div>}
        </div>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeReview}>إلغاء</Button>
          <Button type="button" onClick={saveReview} disabled={!catalog || reviewErrors.length > 0}>
            <ClipboardCheck className="ml-2 h-4 w-4" />فتح محرر الحفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!removeTarget} onOpenChange={open => !open && setRemoveTarget(null)}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>تأكيد إزالة صف المصدر</AlertDialogTitle>
          <AlertDialogDescription>سيُزال صف «{removeTarget?.sourceName || "المادة"}» من المسودة المقترحة. لن يُحذف المصدر الأصلي، وتحتاج هذه الإزالة إلى تأكيد صريح قبل المتابعة.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={removeIngredient} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">تأكيد إزالة الصف</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
