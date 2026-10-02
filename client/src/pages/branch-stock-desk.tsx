import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { apiRequest } from "@/lib/queryClient";

interface StockRow {
  id: number; itemId: number; name: string; unit: string;
  quantity: number; reservedQuantity: number; lastUpdated: string;
}
export default function BranchStockDesk() {
  const { user } = useAuth();
  const { canEdit } = usePermissions();
  const branchId = user?.branchId;
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const stock = useQuery<StockRow[]>({
    queryKey: ["/api/branch-stock-desk", user?.id, branchId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/branch-stock-desk?branchId=${encodeURIComponent(branchId!)}`);
      return response.json();
    },
    enabled: !!branchId, staleTime: 0, gcTime: 0,
  });
  async function count(row: StockRow) {
    const value = counts[row.itemId];
    if (!value || !/^\d+(?:\.\d{1,6})?$/.test(value)) {
      setError("أدخل الكمية الفعلية الصحيحة حتى ست منازل عشرية"); return;
    }
    setSaving(row.itemId); setError("");
    try {
      await apiRequest("POST", "/api/branch-stock-desk/count", {
        branchId, itemId: row.itemId, quantity: Number(value), expectedQuantity: Number(row.quantity),
      });
      setCounts(prev => { const next = { ...prev }; delete next[row.itemId]; return next; });
      await stock.refetch();
    } catch (e: any) { setError(e.message); } finally { setSaving(null); }
  }
  return <Layout><div className="mx-auto max-w-5xl space-y-4 p-4" dir="rtl">
    <h1 className="text-2xl font-bold">مخزون الفرع والجرد</h1>
    <p className="text-muted-foreground">مواد الفرع المسجلة فعلياً. اعتماد الجرد يصحح الرصيد ويسجل المراجع؛ لا يعدّل مخزون المستودع أو الحسابات المالية.</p>
    {!branchId && <p role="alert">يجب ربط الحساب بفرع قبل استخدام هذه الصفحة.</p>}
    {(error || stock.isError) && <p role="alert" className="text-destructive">{error || stock.error?.message}</p>}
    <Button variant="outline" onClick={() => stock.refetch()} disabled={stock.isFetching}>تحديث الرصيد</Button>
    {stock.isLoading && <p>جارٍ تحميل المخزون…</p>}
    {!stock.isLoading && !stock.isError && stock.data?.length === 0 && <p>لا توجد مواد مسجلة في مخزون هذا الفرع.</p>}
    {!stock.isError && !stock.isFetching && stock.data?.map(row => <Card key={row.id}><CardHeader><CardTitle className="text-base">{row.name}</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <span>الرصيد: {Number(row.quantity)} {row.unit}</span>
        <span>المحجوز: {Number(row.reservedQuantity)}</span>
        {canEdit("branch_stock") && <>
          <Input className="w-40" inputMode="decimal" aria-label={`الكمية الفعلية ${row.name}`} placeholder="الكمية الفعلية"
            value={counts[row.itemId] ?? ""} onChange={e => setCounts(prev => ({ ...prev, [row.itemId]: e.target.value }))} />
          <Button onClick={() => count(row)} disabled={saving !== null || stock.isFetching}>اعتماد الجرد</Button>
        </>}
      </CardContent></Card>)}
  </div></Layout>;
}