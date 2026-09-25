import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";

type Movement = {
  id: number; kind: string; status: string; item_name: string; unit: string; quantity: string;
  shipped_quantity: string; received_quantity: string; usable_quantity: string;
  damaged_quantity: string; written_off_quantity: string; shortage_quantity: string;
  quarantine_quantity: string; source_branch_id: string | null; destination_branch_id: string | null;
  source_warehouse_id: number | null; destination_warehouse_id: number | null;
  carrier_name: string | null; vehicle_number: string | null;
};
type Warehouse = { id: number; name: string; active: boolean };
type Material = { id: number; reference: string; name: string; unit: string; quantity: string };
type Product = Material & { substitute_product_id: number | null; substitute_product_name: string | null; substitute_unit: string | null; receipt_attribution_basis: string | null; original_good_received_quantity: string | null; total_good_received_quantity: string | null };
type Item = { id: number; name: string; unit: string; current_stock: number };
const get = async <T,>(path: string): Promise<T> => {
  const r = await fetch(path, { credentials: "include" });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || `HTTP ${r.status}`);
  return r.json();
};
const post = async (path: string, data: object) => {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || `HTTP ${r.status}`);
  return r.json();
};
const labels: Record<string,string> = {
  material_return: "إرجاع مواد الفرع إلى المستودع الرئيسي",
  product_return: "إرجاع منتج الفرع إلى المطبخ المركزي",
  warehouse_transfer: "نقل بين المستودعات",
  draft: "مسودة", requested: "محجوز / مطلوب", dispatched: "في الطريق",
  received: "استُلم للفحص", inspected: "مفحوص", cancelled: "ملغي",
};
const number = (value: string) => Number(value);

export default function ReverseLogisticsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const globalManager = user?.role === "admin" || (user?.role === "operations_manager" && !(user.allowedBranches?.length));
  const params = new URLSearchParams(window.location.search);
  const initialKind = params.has("orderItemId") ? "product_return" : params.has("transferItemId") ? "material_return" : "material_return";
  const [kind, setKind] = useState(initialKind);
  const [line, setLine] = useState(params.get("orderItemId") || params.get("transferItemId") || "");
  const [component, setComponent] = useState("original");
  const [itemId, setItemId] = useState("");
  const [source, setSource] = useState("main");
  const [destination, setDestination] = useState("");
  const [quantity, setQuantity] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const draftAttempt = useRef<{ payload: string; key: string } | null>(null);
  const movements = useQuery<Movement[]>({ queryKey: ["/api/reverse-logistics"], queryFn: () => get("/api/reverse-logistics") });
  const sources = useQuery<{ materials: Material[]; products: Product[] }>({ queryKey: ["/api/reverse-logistics/sources"], queryFn: () => get("/api/reverse-logistics/sources") });
  const warehouses = useQuery<Warehouse[]>({ queryKey: ["/api/reverse-logistics/warehouses"], queryFn: () => get("/api/reverse-logistics/warehouses"), enabled: globalManager });
  const items = useQuery<Item[]>({ queryKey: ["/api/reverse-logistics/items"], queryFn: () => get("/api/reverse-logistics/items"), enabled: globalManager });
  const stock = useQuery<{warehouse_id:number; warehouse_name:string; item_id:number; item_name:string; unit:string; quantity:string; reserved_quantity:string}[]>({ queryKey: ["/api/reverse-logistics/stock"], queryFn: () => get("/api/reverse-logistics/stock"), enabled: globalManager });
  const act = async (path: string, data: object, refresh = true) => {
    setPending(true); setError(""); setSuccess("");
    try {
      const result = await post(path,data);
      setSuccess(`تم حفظ العملية #${result.id ?? ""} بنجاح`);
      if (refresh) {
        await qc.invalidateQueries({ queryKey: ["/api/reverse-logistics"] });
        await qc.invalidateQueries({ queryKey: ["/api/reverse-logistics/stock"] });
      }
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ العملية");
      return null;
    } finally { setPending(false); }
  };
  const create = async () => {
    const q = Number(quantity);
    if (!quantity || !Number.isFinite(q) || q <= 0) { setError("أدخل كمية موجبة"); return; }
    const data = kind === "material_return"
      ? { kind, originalTransferItemId: Number(line), quantity: q }
      : kind === "product_return"
        ? { kind, originalOrderItemId: Number(line), component, quantity: q }
        : { kind, itemId: Number(itemId), sourceWarehouseId: source === "main" ? null : Number(source), destinationWarehouseId: destination === "main" ? null : Number(destination), quantity: q };
    if (kind === "warehouse_transfer" && (!destination || destination === source)) { setError("اختر مستودعين مختلفين؛ الرئيسي ليس فرعاً"); return; }
    const payload = JSON.stringify(data);
    if (!draftAttempt.current || draftAttempt.current.payload !== payload)
      draftAttempt.current = { payload, key: crypto.randomUUID() };
    const result = await act("/api/reverse-logistics",{...data,idempotencyKey:draftAttempt.current.key});
    if (result) { setQuantity(""); setLine(""); draftAttempt.current = null; }
  };
  const perform = async (row: Movement, operation: string) => {
    const payload: Record<string, string | number> = { idempotencyKey: crypto.randomUUID() };
    if (operation === "receive") {
      const entered = window.prompt(`كمية الاستلام الفعلية من ${row.shipped_quantity} ${row.unit}؟ الناقص سيظل ظاهراً.`,row.shipped_quantity);
      if (entered === null || entered.trim() === "") return;
      payload.receivedQuantity = Number(entered);
    }
    if (operation === "inspect") {
      const usable = window.prompt(`المستلم ${row.received_quantity} ${row.unit}. كم صالحاً للإتاحة؟`,row.received_quantity);
      if (usable === null || usable.trim() === "") return;
      const damaged = window.prompt("كم تالِفاً يبقى في الحجر منفصلاً عن المخزون المتاح؟",String(Number(row.received_quantity)-Number(usable)));
      if (damaged === null || damaged.trim() === "") return;
      payload.usableQuantity = Number(usable); payload.damagedQuantity = Number(damaged);
    }
    if (operation === "writeoff") {
      const damaged = window.prompt(`الكمية التالفة المتبقية في الحجر: ${Number(row.damaged_quantity)-Number(row.written_off_quantity)}`,String(Number(row.damaged_quantity)-Number(row.written_off_quantity)));
      if (damaged === null || damaged.trim() === "") return;
      const reason = window.prompt("سبب شطب المخزون (اعتماد مدير التشغيل)")?.trim();
      if (!reason) return;
      payload.damagedQuantity = Number(damaged); payload.notes = reason;
    }
    if (operation === "cancel" && !window.confirm("إلغاء العملية وإطلاق حجز المصدر؟")) return;
    await act(`/api/reverse-logistics/${row.id}/${operation}`,payload);
  };
  const location = (id: number | null, branch: string | null) => branch || (id ? warehouses.data?.find(w => Number(w.id) === Number(id))?.name || `مستودع #${id}` : "المستودع الرئيسي");
  return <Layout>
    <main dir="rtl" className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header><h1 className="text-2xl font-bold">الإرجاع والنقل بين المستودعات</h1>
        <p className="text-sm text-muted-foreground">الكميات مرتبطة بالاستلام الأصلي؛ الحجر والتالف لا يدخلان المخزون المتاح. لا يُنشأ قيد مالي للشطب.</p></header>
      {error && <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</div>}
      {success && <div role="status" className="rounded border border-green-300 bg-green-50 p-3 text-green-800">{success}</div>}
      <Card><CardHeader><CardTitle>إنشاء مسودة</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="max-w-lg space-y-2"><Label>نوع الحركة</Label><Select value={kind} onValueChange={v => { setKind(v); setLine(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="material_return">{labels.material_return}</SelectItem>
          <SelectItem value="product_return">{labels.product_return}</SelectItem>
          {globalManager && <SelectItem value="warehouse_transfer">{labels.warehouse_transfer}</SelectItem>}
        </SelectContent></Select></div>
        {kind !== "warehouse_transfer" ? <div className="max-w-2xl space-y-2"><Label>البند الأصلي المستلم (لا تُخمن هوية المنتج أو تحويل الوحدة)</Label>
          <Select value={line} onValueChange={setLine}><SelectTrigger><SelectValue placeholder={sources.isLoading ? "تحميل البنود..." : "اختر بنداً من الوثيقة الأصلية"} /></SelectTrigger><SelectContent>
            {(kind === "material_return" ? sources.data?.materials || [] : sources.data?.products || []).map(o =>
              <SelectItem value={String(o.id)} key={o.id}>{o.reference} · {o.name} · {o.quantity} {o.unit} · بند #{o.id}</SelectItem>)}
          </SelectContent></Select>
          {params.has("transferItemId") || params.has("orderItemId") ? <p className="text-xs text-muted-foreground">تم اختيار البند من الوثيقة الأصلية؛ تحقق من الهوية والكمية قبل الطلب.</p> : null}
          {kind === "product_return" && <div className="space-y-2"><Label>هوية الاستلام الفعلية</Label><Select value={component} onValueChange={setComponent}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="original">المنتج الأصلي</SelectItem><SelectItem value="substitute">المنتج البديل (بعد تأكيد الإسناد)</SelectItem></SelectContent></Select>
            {sources.data?.products.find(p => String(p.id) === line)?.substitute_product_id && sources.data?.products.find(p => String(p.id) === line)?.receipt_attribution_basis !== "branch_confirmed" && <p className="text-amber-800 text-sm">يجب تأكيد إسناد استلام الأصلي والبديل في الطلب أولاً.</p>}
          </div>}
        </div> : <div className="grid gap-3 md:grid-cols-3">
          <div><Label>الصنف الفعال</Label><Select value={itemId} onValueChange={setItemId}><SelectTrigger><SelectValue placeholder="اختر صنفاً" /></SelectTrigger><SelectContent>{items.data?.map(i => <SelectItem value={String(i.id)} key={i.id}>{i.name} ({i.unit}) · الرئيسي {i.current_stock}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>من مستودع</Label><Select value={source} onValueChange={setSource}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="main">المستودع الرئيسي (رصيده الفعلي)</SelectItem>{warehouses.data?.filter(w=>w.active).map(w=><SelectItem value={String(w.id)} key={w.id}>{w.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>إلى مستودع</Label><Select value={destination} onValueChange={setDestination}><SelectTrigger><SelectValue placeholder="اختر الوجهة" /></SelectTrigger><SelectContent><SelectItem value="main">المستودع الرئيسي</SelectItem>{warehouses.data?.filter(w=>w.active).map(w=><SelectItem value={String(w.id)} key={w.id}>{w.name}</SelectItem>)}</SelectContent></Select></div>
        </div>}
        <div className="flex flex-wrap items-end gap-3"><div><Label htmlFor="return-quantity">الكمية {kind === "product_return" ? "(قطع صحيحة)" : "(نفس وحدة الأصل)"}</Label><Input id="return-quantity" type="number" min="0" step={kind === "product_return" ? "1" : "0.000001"} value={quantity} onChange={e=>setQuantity(e.target.value)} /></div>
          <Button disabled={pending || (kind === "warehouse_transfer" ? !itemId : !line)} onClick={create}>إنشاء المسودة</Button></div>
      </CardContent></Card>
      {globalManager && <Card><CardHeader><CardTitle>إدارة المستودعات الفعلية</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3">
        <Input className="max-w-xs" placeholder="اسم المستودع الجديد" value={name} onChange={e=>setName(e.target.value)} />
        <Button disabled={pending || name.trim().length < 2} onClick={async()=>{ if(await act("/api/reverse-logistics/warehouses",{name:name.trim()},false)){setName("");await qc.invalidateQueries({queryKey:["/api/reverse-logistics/warehouses"]});}}}>إضافة مستودع</Button>
        <span className="w-full text-xs text-muted-foreground">لا تُنسخ أرصدة المستودع الرئيسي تلقائياً. المستودع الجديد يبدأ بلا مخزون؛ نقل فعلي فقط يضيف إليه.</span>
        <div className="w-full space-y-1 text-sm"><strong>أرصدة المستودعات التابعة (المتاح = الرصيد − المحجوز)</strong>
          {stock.data?.length ? stock.data.map(s=><p key={`${s.warehouse_id}:${s.item_id}`} className="rounded border p-2">{s.warehouse_name} · {s.item_name}: {s.quantity} {s.unit} · محجوز {s.reserved_quantity}</p>) : <p className="text-muted-foreground">لا توجد أرصدة بعد؛ تتم إضافة الرصيد عند فحص حركة نقل واستلام صالح.</p>}
          {stock.isError && <p role="alert" className="text-red-700">{stock.error instanceof Error ? stock.error.message : "تعذر تحميل الأرصدة"}</p>}
        </div>
      </CardContent></Card>}
      <section className="space-y-3"><h2 className="text-xl font-semibold">الحركات والحجر</h2>
        {movements.isError && <p role="alert" className="text-red-700">{movements.error instanceof Error ? movements.error.message : "تعذر تحميل الحركات"}</p>}
        {movements.data?.length === 0 && <p className="text-muted-foreground">لا توجد حركات في نطاق صلاحياتك.</p>}
        {movements.data?.map(row => <Card key={row.id}><CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><strong>#{row.id} · {labels[row.kind]} · {row.item_name}</strong><p className="text-sm text-muted-foreground">{location(row.source_warehouse_id,row.source_branch_id)} ← {location(row.destination_warehouse_id,row.destination_branch_id)} · {labels[row.status]}</p></div><span className="rounded bg-muted px-2 py-1 text-sm">{row.quantity} {row.unit}</span></div>
          <div className="grid gap-2 text-sm sm:grid-cols-4"><span>شُحن: {row.shipped_quantity}</span><span>استُلم: {row.received_quantity}</span><span className={number(row.shortage_quantity)>0 ? "text-amber-700" : ""}>ناقص بالشحن: {row.shortage_quantity}</span><span>بالحجر: {row.quarantine_quantity} (تالف {number(row.damaged_quantity)-number(row.written_off_quantity)})</span></div>
          {row.carrier_name && <p className="text-sm">الناقل: {row.carrier_name} · المركبة: {row.vehicle_number || "غير مسجلة"}</p>}
          <div className="flex flex-wrap gap-2">
            {row.status === "draft" && <Button disabled={pending} onClick={()=>perform(row,"request")}>طلب وحجز المصدر</Button>}
            {row.status === "requested" && <><Link href={`/driver-deliveries?sourceType=reverse_movement&sourceId=${row.id}`}><Button variant="outline" size="sm">إسناد السائق وتوثيق التسليم</Button></Link><span className="text-xs text-amber-800">الإرسال بعد توثيق البنود وتأكيد السائق فقط</span><Button disabled={pending} onClick={()=>perform(row,"dispatch")}>إرسال وخصم المصدر</Button><Button variant="outline" disabled={pending} onClick={()=>perform(row,"cancel")}>إلغاء وإطلاق الحجز</Button></>}
            {row.status === "dispatched" && <Button disabled={pending} onClick={()=>perform(row,"receive")}>تسجيل الاستلام الفعلي</Button>}
            {row.status === "received" && <Button disabled={pending} onClick={()=>perform(row,"inspect")}>فحص وإتاحة الصالح</Button>}
            {row.status === "inspected" && number(row.damaged_quantity)>number(row.written_off_quantity) && globalManager && <Button variant="destructive" disabled={pending} onClick={()=>perform(row,"writeoff")}>اعتماد شطب التالف</Button>}
          </div>
        </CardContent></Card>)}
      </section>
    </main>
  </Layout>;
}