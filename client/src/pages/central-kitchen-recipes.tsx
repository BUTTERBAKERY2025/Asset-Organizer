import { useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { RecipeBook, RECIPE_PERMISSION_MODULE } from "@/components/central-kitchen/recipe-book";
import { Card, CardContent } from "@/components/ui/card";
import { useBranches } from "@/hooks/useBranches";
import { usePermissions } from "@/hooks/usePermissions";

type Kitchen = { id: string; name: string };

export default function CentralKitchenRecipesPage() {
  const { branches, isLoading } = useBranches();
  const { hasPermission } = usePermissions();
  const canViewRecipes = hasPermission(RECIPE_PERMISSION_MODULE, "view");
  const kitchens = useMemo<Kitchen[]>(
    () => branches
      .filter(branch => branch.isCentralKitchen)
      .map(branch => ({ id: branch.id, name: branch.name })),
    [branches],
  );
  const [kitchenId, setKitchenId] = useState("");

  useEffect(() => {
    if (!kitchens.length) {
      if (kitchenId) setKitchenId("");
      return;
    }
    if (!kitchenId || !kitchens.some(kitchen => kitchen.id === kitchenId)) {
      setKitchenId(kitchens[0].id);
    }
  }, [kitchens, kitchenId]);

  return (
    <Layout>
      <main dir="rtl" className="page-container space-y-5 pb-10">
        <PageHeader
          icon={ClipboardList}
          tone="production"
          title="دفتر وصفات المطبخ المركزي"
          description="إدارة إصدارات الوصفات المعتمدة دون فتح لوحة التشغيل أو صلاحيات الإنتاج."
        />
        {!canViewRecipes ? (
          <Card>
            <CardContent className="py-14 text-center">
              <p className="font-semibold">لا تملك صلاحية عرض دفتر الوصفات</p>
              <p className="mt-1 text-sm text-muted-foreground">
                تحتاج إلى صلاحية عرض وصفات المطبخ المركزي للوصول إلى هذه الصفحة.
              </p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="h-28 animate-pulse rounded-2xl bg-muted" />
        ) : (
          <RecipeBook
            kitchens={kitchens}
            kitchenId={kitchenId}
            onKitchenChange={setKitchenId}
          />
        )}
      </main>
    </Layout>
  );
}