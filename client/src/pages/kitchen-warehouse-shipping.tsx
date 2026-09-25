import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

const base = "/api/kitchen-warehouse-shipping";
type Stock = { id: number; branch_id: string; product_name: string; unit: string; production_date: string; available: number };
type Warehouse = { id: number; name: string };
type Shipment = { id: number; source_branch_id: string; destination_name: string; product_name: string; unit: string; quantity: number; received_quantity: number | null; status: string; carrier_name: string | null; vehicle_number: string | null };
type WarehouseStock = { warehouse_id: number; warehouse_name: string; product_name: string; unit: string; production_date: string; quantity: number };
const key = () => crypto.randomUUID();
const fetchList = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error((await response.json()).message || "تعذر تحميل البيانات");
  return response.json();
};

export default function KitchenWarehouseShippingPage() {
  const { user } = useAuth();
  const manager = ["admin", "operations_manager"].includes(user?.role ?? "");
  const kitchen = manager || user?.role === "production_development_manager";
  const { toast } = useToast();
  const cache = useQueryClient();
  const [stockId,setStockId] = useState("");
  const [warehouseId,setWarehouseId] = useState("");
  const [quantity,setQuantity] = useState("");
  const [carrierName,setCarrierName] = useState("");
  const [vehicleNumber,setVehicleNumber] = useState("");
  const [receipts,setReceipts] = useState<Record<number,string>>({});
  const [busy,setBusy] = useState(false);
  const shipmentLinkConsumed = useRef(false);
  const returnDeliveryId = new URLSearchParams(window.location.search).get("deliveryId");
  const sources = useQuery({ queryKey:[base,"sources"], queryFn:() => fetchList<Stock[]>(`${base}/sources`), enabled:kitchen });
  const warehouses = useQuery({ queryKey:[base,"warehouses"], queryFn:() => fetchList<Warehouse[]>(`${base}/warehouses`), enabled:kitchen });
  const shipments = useQuery({ queryKey:[base,"shipments"], queryFn:() => fetchList<Shipment[]>(base) });
  useEffect(() => {
    if (shipmentLinkConsumed.current || !shipments.data) return;
    const raw = new URLSearchParams(window.location.search).get("shipmentId");
    if (!raw) return;
    shipmentLinkConsumed.current = true;
    const id = Number(raw);
    const target = Number.isSafeInteger(id) && id > 0 ? shipments.data.find(s => Number(s.id) === id) : null;
    if (!target) {
      toast({title:"الشحنة غير متاحة أو خارج نطاق صلاحيتك",variant:"destructive"});
      return;
    }
    window.setTimeout(() => document.getElementById(`warehouse-shipment-${id}`)?.scrollIntoView({behavior:"smooth",block:"center"}), 0);
    if (target.status === "received") toast({title:"الاستلام مسجل بالفعل",description:"ارجع لمهمة التوصيل لاعتماد الإيصال."});
  }, [shipments.data, toast]);
  const stored = useQuery({ queryKey:[base,"stock"], queryFn:() => fetchList<WarehouseStock[]>(`${base}/stock`), enabled:manager });
  const selected = sources.data?.find(s => String(s.id) === stockId);
  const perform = async (url: string, body: object) => {
    setBusy(true);
    try {
      const result = await apiRequest("POST",url,{...body,idempotencyKey:key()});
      if (!result.ok) throw new Error((await result.json()).message || "فشلت العملية");
      await Promise.all([
        cache.invalidateQueries({queryKey:[base,"sources"]}),
        cache.invalidateQueries({queryKey:[base,"shipments"]}),
        cache.invalidateQueries({queryKey:[base,"stock"]}),
        cache.invalidateQueries({queryKey:["/api/finished-goods-inventory"]}),
      ]);
      toast({title:"تم حفظ الحركة بنجاح"});
    } catch (error) {
      toast({title:"تعذر إتمام الحركة",description:(error as Error).message,variant:"destructive"});
    } finally { setBusy(false); }
  };
  const create = () => {
    const amount = Number(quantity);
    if (!selected || !warehouseId || !Number.isInteger(amount) || amount<=0 || amount>selected.available) {
      toast({title:"اختر دفعة ومنتجاً ومستودعاً وكمية صحيحة بالقطع",variant:"destructive"});
      return;
    }
    void perform(base,{stockId:selected.id,warehouseId:Number(warehouseId),quantity:amount});
  };
  const labels: Record<string,string> = {requested:"مطلوب / محجوز",dispatched:"خرج من المطبخ",received:"تم الاستلام",cancelled:"ملغى"};
  return <Layout><div dir="rtl" className="page-container space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">شحن المنتجات للمستودعات المستقلة</h1>
      <p className="text-sm text-muted-foreground">حجز من مخزون المطبخ النهائي، خروج فعلي، ثم تأكيد الكمية المستلمة. مخزون المنتجات مستقل عن المواد الخام.</p></div>
      <div className="flex flex-wrap gap-2">{returnDeliveryId && /^[1-9]\d*$/.test(returnDeliveryId) && <Link href={`/driver-deliveries?deliveryId=${returnDeliveryId}`}><Button variant="outline">العودة لمهمة التوصيل لاعتماد الإيصال</Button></Link>}<Link href="/finished-goods-inventory"><Button variant="outline">مخزون الإنتاج النهائي</Button></Link></div></div>
    {kitchen && <Card><CardHeader><CardTitle>طلب شحن جديد من دفعة إنتاج متاحة</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-4 items-end">
      <div><Label>المنتج والدفعة وتاريخ الإنتاج</Label><Select value={stockId} onValueChange={setStockId}><SelectTrigger><SelectValue placeholder="اختر المخزون الفعلي" /></SelectTrigger>
        <SelectContent>{sources.data?.map(s=><SelectItem key={s.id} value={String(s.id)}>{s.product_name} — {s.branch_id} — {s.production_date} ({s.available} {s.unit})</SelectItem>)}</SelectContent></Select></div>
      <div><Label>المستودع المستقل</Label><Select value={warehouseId} onValueChange={setWarehouseId}><SelectTrigger><SelectValue placeholder="اختر المستودع" /></SelectTrigger>
        <SelectContent>{warehouses.data?.map(w=><SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>الكمية ({selected?.unit || "وحدة الدفعة"}، عدد صحيح)</Label><Input type="number" min="1" max={selected?.available} step="1" value={quantity} onChange={e=>setQuantity(e.target.value)} /></div>
      <Button disabled={busy || sources.isLoading || warehouses.isLoading} onClick={create}>طلب وحجز الشحن</Button>
      {(sources.error || warehouses.error) && <p className="text-destructive md:col-span-4">{String((sources.error || warehouses.error)?.message)}</p>}
    </CardContent></Card>}
    <Card><CardHeader><CardTitle>حركات الشحن</CardTitle></CardHeader><CardContent className="space-y-4">
      {shipments.isLoading && <p>جارٍ التحميل...</p>}{shipments.error && <p className="text-destructive">{shipments.error.message}</p>}
      {shipments.data?.length === 0 && <p>لا توجد حركات حتى الآن.</p>}
      {shipments.data?.map(s=><div id={`warehouse-shipment-${s.id}`} key={s.id} className={`rounded border p-4 space-y-2 ${new URLSearchParams(window.location.search).get("shipmentId") === String(s.id) ? "border-primary bg-primary/5" : ""}`}>
        <div className="font-medium">#{s.id} · {s.product_name} · {s.quantity} {s.unit} · {s.source_branch_id} ← {s.destination_name}</div>
        <div className="text-sm">الحالة: {labels[s.status] || s.status} · الناقل: {s.carrier_name || "—"} · المركبة: {s.vehicle_number || "—"}
          {s.status==="received" && <> · المستلم: {s.received_quantity} · الفرق: {s.quantity-s.received_quantity!}</>}</div>
        {s.status==="dispatched" && <Link href={`/driver-deliveries?sourceType=kitchen_warehouse_shipment&sourceId=${s.id}`}><Button variant="outline" size="sm">إسناد سائق لهذه الشحنة / فتح مهمة التوصيل</Button></Link>}
        {s.status==="requested" && kitchen && <div className="flex flex-wrap items-end gap-2">
          <div><Label>الناقل الفعلي</Label><Input value={carrierName} onChange={e=>setCarrierName(e.target.value)} /></div>
          <div><Label>رقم المركبة</Label><Input value={vehicleNumber} onChange={e=>setVehicleNumber(e.target.value)} /></div>
          <Button disabled={busy || !carrierName.trim()} onClick={()=>void perform(`${base}/${s.id}/dispatch`,{carrierName,vehicleNumber})}>تأكيد الخروج</Button>
          <Button disabled={busy} variant="outline" onClick={()=>void perform(`${base}/${s.id}/cancel`,{})}>إلغاء وإطلاق الحجز</Button>
        </div>}
        {s.status==="dispatched" && manager && <div className="flex items-end gap-2">
          <div><Label>الكمية المستلمة فعلياً (0 إلى {s.quantity})</Label>
            <Input type="number" min="0" max={s.quantity} step="1" value={receipts[s.id] ?? ""} onChange={e=>setReceipts({...receipts,[s.id]:e.target.value})} /></div>
          <Button disabled={busy || receipts[s.id] === "" || !Number.isInteger(Number(receipts[s.id])) || Number(receipts[s.id])<0 || Number(receipts[s.id])>s.quantity}
            onClick={()=>void perform(`${base}/${s.id}/receive`,{receivedQuantity:Number(receipts[s.id])})}>تأكيد الاستلام والفارق</Button>
        </div>}
      </div>)}
    </CardContent></Card>
    {manager && <Card><CardHeader><CardTitle>مخزون المنتجات النهائيّة بالمستودعات حسب تاريخ الدفعة</CardTitle></CardHeader><CardContent>
      {stored.error && <p className="text-destructive">{stored.error.message}</p>}
      {stored.data?.length === 0 && <p>لا توجد أرصدة منتجات مستلمة.</p>}
      <div className="space-y-1">{stored.data?.map(row=><div className="border-b py-2" key={`${row.warehouse_id}-${row.product_name}-${row.production_date}-${row.unit}`}>
        {row.warehouse_name} · {row.product_name} · إنتاج {row.production_date} · {row.quantity} {row.unit}</div>)}</div>
    </CardContent></Card>}
  </div></Layout>;
}