import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import type {
  CentralKitchenMaterialRequirementsContract,
} from "@shared/central-kitchen-batch-materials";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";

type RecipeRequirementsOptions = {
  kitchenId: string;
  productId: number;
  quantity: string;
  batchId?: never;
  enabled?: boolean;
} | {
  kitchenId?: never;
  productId?: never;
  quantity?: never;
  batchId: number;
  enabled?: boolean;
};

function responseError(response: Response, fallback: string) {
  return response.json()
    .then((body: unknown) => {
      if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
        throw new Error(body.error);
      }
      throw new Error(fallback);
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message !== fallback) throw error;
      throw new Error(fallback);
    });
}

function formatConsumedAt(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return `في ${value}`;
  return `في ${new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(date)}`;
}

export function useRecipeMaterialRequirements(options: RecipeRequirementsOptions): UseQueryResult<CentralKitchenMaterialRequirementsContract, Error> {
  const batchOptions = "batchId" in options ? options : null;
  const previewOptions = "batchId" in options ? null : options;
  const enabled = options.enabled !== false && (batchOptions
    ? Number.isInteger(batchOptions.batchId) && batchOptions.batchId > 0
    : Boolean(previewOptions?.kitchenId && previewOptions.productId && previewOptions.quantity && Number(previewOptions.quantity) > 0));
  const queryKey = batchOptions
    ? ["/api/central-kitchen/production/batches", batchOptions.batchId, "material-requirements"]
    : ["/api/central-kitchen/production/requirements", previewOptions?.kitchenId, previewOptions?.productId, previewOptions?.quantity];
  return useQuery<CentralKitchenMaterialRequirementsContract, Error>({
    queryKey,
    enabled,
    staleTime: 10_000,
    queryFn: async () => {
      const url = batchOptions
        ? `/api/central-kitchen/production/batches/${batchOptions.batchId}/material-requirements`
        : `/api/central-kitchen/production/requirements?kitchenId=${encodeURIComponent(previewOptions!.kitchenId)}&productId=${previewOptions!.productId}&quantity=${encodeURIComponent(previewOptions!.quantity)}`;
      let response: Response;
      try {
        response = await fetch(url, { credentials: "include", cache: "no-store" });
      } catch {
        throw new Error("تعذر الاتصال بالخادم لقراءة احتياج مواد الوصفة.");
      }
      if (!response.ok) {
        return responseError(response, "تعذر تحميل احتياج مواد الوصفة.");
      }
      try {
        return await response.json() as CentralKitchenMaterialRequirementsContract;
      } catch {
        throw new Error("استجابة احتياج مواد الوصفة غير صالحة.");
      }
    },
  });
}

export function RecipeMaterialsPreview({
  query,
  recipeBacked,
  onRecipeBackedChange,
  kitchenId,
  batchId,
  showToggle = false,
}: {
  query: UseQueryResult<CentralKitchenMaterialRequirementsContract, Error>;
  recipeBacked?: boolean;
  onRecipeBackedChange?: (value: boolean | null) => void;
  kitchenId?: string;
  batchId?: number;
  showToggle?: boolean;
}) {
  if (query.isLoading) {
    return <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />جارٍ التحقق من الوصفة المعتمدة واحتياج المواد...</div>;
  }
  if (query.isError) {
    return <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-medium">تعذر تحميل احتياج مواد الوصفة</p><p className="mt-1">{query.error.message}</p></div></div>;
  }
  if (!query.data) return null;
  const data = query.data;
  const hasRecipe = data.recipe !== null;
  const isFrozenBatch = batchId !== undefined;
  const shortageCount = data.requirements.filter(item => Number(item.shortageQuantity) > 0).length;
  const transferHref = (item: typeof data.requirements[number]) => {
    if (!kitchenId) return "/transfer-requests";
    const params = new URLSearchParams({
      destinationBranchId: kitchenId,
      warehouseItemId: String(item.warehouseItemId),
      quantity: item.shortageQuantity,
      availableQuantity: item.availableQuantity,
    });
    return `/transfer-requests?${params.toString()}`;
  };

  return <Card className={recipeBacked === false ? "border-dashed" : "border-violet-200 bg-violet-50/30"}>
    <CardContent className="space-y-3 p-4">
      {showToggle && onRecipeBackedChange && <label className="flex cursor-pointer items-start gap-3 rounded-md border bg-background p-3">
        <Checkbox checked={hasRecipe ? recipeBacked === true : recipeBacked === false} onCheckedChange={checked => onRecipeBackedChange(hasRecipe ? checked === true : checked ? false : null)} />
        <span><span className="block text-sm font-medium">{hasRecipe ? "ربط الدفعة بالوصفة المعتمدة" : "تأكيد إنشاء دفعة غير مرتبطة بوصفة"}</span><span className="mt-1 block text-xs text-muted-foreground">{hasRecipe ? "يتم تجميد الوصفة الحالية عند الإنشاء ولا تُعدّل الدفعات السابقة بأثر رجعي." : "لا توجد وصفة معتمدة حالياً؛ لن يتم افتراض وصفة أو خصم مواد."}</span></span>
      </label>}
      {!hasRecipe ? <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-medium">{isFrozenBatch ? (data.message || "هذه الدفعة غير مرتبطة بوصفة مواد.") : "لا توجد وصفة معتمدة لهذا المنتج في المطبخ المحدد."}</p>{!isFrozenBatch && <p className="mt-1 text-xs">يمكن إنشاء دفعة غير مرتبطة فقط بعد اختيار ذلك صراحةً. لن يتم افتراض وصفة أو خصم مواد.</p>}</div></div> : <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-violet-200 bg-background p-3">
        <div><p className="text-sm font-semibold">مصدر احتياج المواد</p><p className="mt-1 text-xs text-muted-foreground">الوصفة المعتمدة #{data.recipe.recipeId} · الإصدار {data.recipe.recipeVersion} · ناتج {data.recipe.outputQuantity} {data.recipe.outputUnit}</p></div>
        <Badge variant="outline" className="border-violet-300 text-violet-800"><CheckCircle2 className="ml-1 h-3.5 w-3.5" />وصفة معتمدة</Badge>
      </div>}
      {data.message && !hasRecipe && !isFrozenBatch && <p className="text-xs text-muted-foreground">{data.message}</p>}
      {isFrozenBatch && hasRecipe && <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-3 text-sm"><span className="text-muted-foreground">حالة صرف مواد الوصفة</span>{data.materialConsumptionStatus === "consumed" ? <span className="font-medium text-emerald-700"><Badge variant="outline" className="ml-2 border-emerald-300 bg-emerald-50 text-emerald-800">تم الصرف</Badge>{formatConsumedAt(data.consumedAt)}</span> : data.materialConsumptionStatus === "pending" ? <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">بانتظار الصرف عند إنهاء الدفعة</Badge> : <Badge variant="outline">لا ينطبق</Badge>}</div>}
      {hasRecipe && data.requirements.length > 0 && <div className="overflow-x-auto rounded-md border bg-background"><table className="w-full text-sm"><thead className="bg-muted/40"><tr><th className="p-2 text-right font-medium">المادة</th><th className="p-2 text-right font-medium">المطلوب</th><th className="p-2 text-right font-medium">المتاح</th><th className="p-2 text-right font-medium">النقص</th><th className="p-2 text-right font-medium"> </th></tr></thead><tbody>{data.requirements.map(item => {
        const shortage = Number(item.shortageQuantity) > 0;
        return <tr key={item.warehouseItemId} className="border-t"><td className="p-2"><span className="font-medium">{item.materialName}</span><span className="block text-xs text-muted-foreground">{item.unit} · وصفة {item.recipeQuantity}</span></td><td className="p-2 font-mono">{item.requiredQuantity} {item.unit}</td><td className="p-2 font-mono">{item.availableQuantity} {item.unit}<span className="block text-[11px] text-muted-foreground">حالي {item.currentQuantity} · محجوز {item.reservedQuantity}</span></td><td className={`p-2 font-mono ${shortage ? "font-semibold text-rose-700" : "text-emerald-700"}`}>{item.shortageQuantity} {item.unit}</td><td className="p-2">{shortage && <Link href={transferHref(item)} className="inline-flex items-center whitespace-nowrap text-xs font-medium text-primary hover:underline">طلب من المستودع <ArrowLeft className="mr-1 h-3.5 w-3.5" /></Link>}</td></tr>;
      })}</tbody></table></div>}
      {hasRecipe && data.requirements.length === 0 && <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">الوصفة المعتمدة لا تحتوي مواداً.</p>}
      {hasRecipe && shortageCount > 0 && <p className="text-xs text-amber-800">يوجد نقص في {shortageCount} مادة. يمكن إنشاء الدفعة الآن، وسيتم منع إنهائها حتى يتوفر الرصيد الدقيق.</p>}
      {isFrozenBatch && hasRecipe && <p className="text-xs text-muted-foreground">هذه لقطة وصفة مجمّدة للدفعة؛ الرصيد الحالي للعرض فقط، ويُتحقق من الرصيد الذري عند الإنهاء.</p>}
    </CardContent>
  </Card>;
}
