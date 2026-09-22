import { useMemo, useState } from "react";
import {
  AlertTriangle, Bell, Check, ChevronLeft, Clock3, Factory, PanelRight,
  RotateCcw, Search, SlidersHorizontal, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BRANCHES, KITCHEN_ORDERS, type KitchenOrderFixture, type KitchenOrderStatus } from "./_fixtures";
import { MockAppShell } from "./_Shell";
import "./_group.css";

type LocalOrder = KitchenOrderFixture & { localStatus?: KitchenOrderStatus; localDiscrepancy?: "none" | "open" | "resolved" };
type StageKey = "all" | "attention" | KitchenOrderStatus;

const STATUS: Record<KitchenOrderStatus, { label: string; tone: string }> = {
  requested: { label: "بانتظار الاعتماد", tone: "stream-status stream-status-requested" },
  approved: { label: "معتمد", tone: "stream-status stream-status-approved" },
  prepared: { label: "جاهز للإرسال", tone: "stream-status stream-status-prepared" },
  dispatched: { label: "في الطريق", tone: "stream-status stream-status-dispatched" },
  received: { label: "تم الاستلام", tone: "stream-status stream-status-received" },
  cancelled: { label: "ملغي", tone: "stream-status stream-status-cancelled" },
};

const formatDate = (date: string) => new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short" }).format(new Date(date));
const effectiveStatus = (order: LocalOrder) => order.localStatus ?? order.status;
const effectiveDiscrepancy = (order: LocalOrder) => order.localDiscrepancy ?? order.discrepancyStatus;
const needsAttention = (order: LocalOrder) => {
  const status = effectiveStatus(order);
  return status !== "cancelled" && (
    (status === "received" && effectiveDiscrepancy(order) === "open") ||
    (status !== "received" && Boolean(order.isLate))
  );
};

function StatusBadge({ status }: { status: KitchenOrderStatus }) {
  return <span className={STATUS[status].tone}>{STATUS[status].label}</span>;
}

function nextAction(order: LocalOrder) {
  const status = effectiveStatus(order);
  if (status === "requested") return "اعتماد الطلب";
  if (status === "approved") return "بدء التجهيز";
  if (status === "prepared") return "تأكيد الإرسال";
  if (status === "dispatched") return "بانتظار استلام الفرع";
  if (status === "received" && effectiveDiscrepancy(order) === "open") return "معالجة الفروقات";
  if (status === "received") return "مكتمل";
  return "محفوظ في السجل";
}

function followingStatus(status: KitchenOrderStatus) {
  if (status === "requested") return "approved";
  if (status === "approved") return "prepared";
  if (status === "prepared") return "dispatched";
  return null;
}

function DemoItems({ count }: { count: number }) {
  const items = ["كرواسون زبدة", "خبز سوردو", "ميني تارت فواكه", "كيك زعفران", "سينابون طازج"];
  return <div className="stream-items">{items.slice(0, Math.min(count, 5)).map((item, index) =>
    <div key={item} className="stream-item"><span>{item}</span><strong>{(index + 2) * 4} قطعة</strong></div>
  )}{count > 5 && <p className="stream-more">+ {count - 5} بنود أخرى في بيانات العرض</p>}</div>;
}

export function Streamlined() {
  const [orders, setOrders] = useState<LocalOrder[]>(KITCHEN_ORDERS);
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("all");
  const [kitchen, setKitchen] = useState("all");
  const [date, setDate] = useState("all");
  const [stage, setStage] = useState<StageKey>("attention");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notice, setNotice] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const kitchens = useMemo(() => [...new Set(orders.map(order => order.centralKitchenName))], [orders]);
  const counts = useMemo(() => {
    const count = (key: StageKey) => orders.filter(order =>
      key === "all" ? effectiveStatus(order) !== "cancelled" :
        key === "attention" ? needsAttention(order) :
          effectiveStatus(order) === key
    ).length;
    return { all: count("all"), attention: count("attention"), requested: count("requested"), approved: count("approved"), prepared: count("prepared"), dispatched: count("dispatched"), received: count("received"), cancelled: count("cancelled") };
  }, [orders]);

  const filtered = useMemo(() => orders
    .filter(order => {
      const haystack = `${order.orderNumber} ${order.requestBranchName} ${order.centralKitchenName}`.toLowerCase();
      const stageMatch = stage === "all" ? effectiveStatus(order) !== "cancelled" : stage === "attention" ? needsAttention(order) : effectiveStatus(order) === stage;
      const dateMatch = date === "all" || (date === "today" ? order.neededDate === "2026-04-02" : order.neededDate < "2026-04-02");
      return stageMatch && (branch === "all" || order.requestBranchId === branch) && (kitchen === "all" || order.centralKitchenName === kitchen) && dateMatch && (!search || haystack.includes(search.toLowerCase()));
    })
    .sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)) || a.neededDate.localeCompare(b.neededDate) || a.neededTime.localeCompare(b.neededTime)), [orders, branch, kitchen, date, search, stage]);

  const selected = orders.find(order => order.id === selectedId) ?? null;
  const advance = (id: number) => {
    setOrders(current => current.map(order => {
      if (order.id !== id) return order;
      const status = effectiveStatus(order);
      if (status === "received" && effectiveDiscrepancy(order) === "open") return { ...order, localDiscrepancy: "resolved" };
      const next = followingStatus(status);
      return next ? { ...order, localStatus: next } : order;
    }));
  };
  const reset = () => {
    setOrders(KITCHEN_ORDERS);
    setSearch(""); setBranch("all"); setKitchen("all"); setDate("all"); setStage("attention"); setSelectedId(null); setNotice(false);
  };
  const intake = () => {
    const incoming: LocalOrder = { id: 24102, orderNumber: "CK-2026-0102", requestBranchId: "olaya", requestBranchName: "فرع العليا", centralKitchenName: "المطبخ المركزي — الرياض", neededDate: "2026-04-02", neededTime: "08:15", itemCount: 6, status: "requested", inventoryMode: "real", notes: "طلب عرض توضيحي وارد الآن." };
    setOrders(current => current.some(order => order.id === incoming.id) ? current : [incoming, ...current]);
    setNotice(true);
  };
  const tabs: { key: StageKey; label: string }[] = [
    { key: "attention", label: "يتطلب تدخلاً" }, { key: "requested", label: "طلبات جديدة" },
    { key: "approved", label: "قيد التجهيز" }, { key: "prepared", label: "جاهز للإرسال" },
    { key: "dispatched", label: "في الطريق" }, { key: "received", label: "المستلمة" },
  ];

  return <div className="kitchen-orders-scope streamlined min-h-screen">
    <MockAppShell>
      <main dir="rtl" className="stream-page">
        <header className="stream-header">
          <div className="stream-title"><div className="stream-mark"><Factory size={19} /></div><div><div className="stream-eyebrow">BUTTER BAKERY · لوحة تجريبية</div><h1>تدفّق طلبات المطبخ</h1><p>رتّب ما يحتاج قراراً الآن، ثم افتح التفاصيل عند الحاجة.</p></div></div>
          <div className="stream-utilities"><span className="stream-live"><i />عرض محلي فقط</span><button className="stream-text-button" type="button" onClick={reset}><RotateCcw size={14} />إعادة الضبط</button><button className="stream-text-button" type="button" onClick={intake}><Bell size={14} />استقبال طلب تجريبي</button></div>
        </header>

        {notice && <section className="stream-notice" aria-live="polite"><div><Bell size={16} /><span><strong>وارد جديد في العرض.</strong> أضيف CK-2026-0102 إلى نفس الفلاتر الحالية دون تغييرها.</span></div><button type="button" onClick={() => setNotice(false)} aria-label="إغلاق التنبيه"><X size={16} /></button></section>}

        <nav className="stream-tabs" aria-label="مراحل الطلبات">
          {tabs.map(tab => <button key={tab.key} type="button" onClick={() => setStage(tab.key)} className={cn("stream-tab", stage === tab.key && "is-active")}>
            <span>{tab.label}</span><b>{counts[tab.key]}</b>
          </button>)}
        </nav>

        <section className="stream-workspace">
          <div className="stream-queue">
            <div className="stream-controlbar">
              <div className="stream-search"><Search size={17} /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="رقم الطلب أو الفرع أو المطبخ" aria-label="بحث في الطلبات" /></div>
              <Button variant="outline" className="stream-filter-toggle" type="button" onClick={() => setFiltersOpen(open => !open)} aria-expanded={filtersOpen}><SlidersHorizontal size={16} />تصفية</Button>
              <span className="stream-result-count">{filtered.length} طلب</span>
            </div>
            <div className={cn("stream-filters", filtersOpen && "is-open")}>
              <Select value={branch} onValueChange={setBranch}><SelectTrigger><SelectValue placeholder="الفرع" /></SelectTrigger><SelectContent><SelectItem value="all">كل الفروع</SelectItem>{BRANCHES.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
              <Select value={kitchen} onValueChange={setKitchen}><SelectTrigger><SelectValue placeholder="المطبخ" /></SelectTrigger><SelectContent><SelectItem value="all">كل المطابخ</SelectItem>{kitchens.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
              <Select value={date} onValueChange={setDate}><SelectTrigger><SelectValue placeholder="موعد الحاجة" /></SelectTrigger><SelectContent><SelectItem value="all">كل المواعيد</SelectItem><SelectItem value="today">احتياج اليوم</SelectItem><SelectItem value="past">طلبات سابقة</SelectItem></SelectContent></Select>
            </div>

            <div className="stream-list" aria-label="طلبات المطبخ">
              {filtered.map(order => {
                const status = effectiveStatus(order);
                const active = selectedId === order.id;
                return <button key={order.id} type="button" onClick={() => setSelectedId(order.id)} className={cn("stream-row", active && "is-selected", needsAttention(order) && "needs-attention")}>
                  <div className="stream-row-main"><div className="stream-order-line"><strong>{order.orderNumber}</strong>{needsAttention(order) && <span className="stream-alert"><AlertTriangle size={13} />{effectiveDiscrepancy(order) === "open" ? "فروقات مفتوحة" : "متأخر"}</span>}</div><span>{order.requestBranchName}<i>←</i>{order.centralKitchenName}</span></div>
                  <div className="stream-need"><span>مطلوب</span><strong>{formatDate(order.neededDate)} · {order.neededTime}</strong></div>
                  <div className="stream-state"><StatusBadge status={status} /><span>{nextAction(order)}</span></div><ChevronLeft className="stream-chevron" size={18} />
                </button>;
              })}
              {!filtered.length && <div className="stream-empty"><Search size={22} /><strong>لا توجد طلبات ضمن هذا العرض</strong><span>غيّر الفلاتر أو ابحث برقم آخر.</span><button type="button" onClick={() => { setSearch(""); setBranch("all"); setKitchen("all"); setDate("all"); }}>مسح الفلاتر</button></div>}
            </div>
          </div>

          <aside className={cn("stream-detail", selected && "is-visible")} aria-label="تفاصيل الطلب">
            {selected ? <><div className="stream-detail-head"><div><span className="stream-eyebrow">تفاصيل الطلب · بيانات عرض</span><h2>{selected.orderNumber}</h2></div><button type="button" onClick={() => setSelectedId(null)} aria-label="إغلاق التفاصيل"><X size={17} /></button></div>
              <div className="stream-detail-route"><div><span>من الفرع</span><strong>{selected.requestBranchName}</strong></div><ChevronLeft size={18} /><div><span>إلى</span><strong>{selected.centralKitchenName}</strong></div></div>
              <div className="stream-detail-meta"><div><Clock3 size={16} /><span>موعد الحاجة</span><strong>{formatDate(selected.neededDate)} · {selected.neededTime}</strong></div><div><PanelRight size={16} /><span>الحالة الحالية</span><StatusBadge status={effectiveStatus(selected)} /></div></div>
              {needsAttention(selected) && <div className="stream-detail-warning"><AlertTriangle size={16} /><span>{effectiveDiscrepancy(selected) === "open" ? "تم الاستلام مع فروقات مفتوحة؛ لا يعد الطلب مكتملاً." : "تم إرسال الطلب بعد الموعد التشغيلي."}</span></div>}
              <section className="stream-detail-section"><div className="stream-section-title"><h3>البنود المطلوبة</h3><span>{selected.itemCount} بنود</span></div><DemoItems count={selected.itemCount} /></section>
              {selected.notes && <section className="stream-note"><span>ملاحظة الفرع</span><p>{selected.notes}</p></section>}
              <div className="stream-demo-action"><p>محاكاة محلية فقط — لا يتم إرسال أي تغيير للنظام.</p>{(followingStatus(effectiveStatus(selected)) || (effectiveStatus(selected) === "received" && effectiveDiscrepancy(selected) === "open")) ? <Button type="button" onClick={() => advance(selected.id)}><Check size={16} />{nextAction(selected)}</Button> : <Button type="button" disabled>لا يوجد إجراء تالٍ</Button>}</div>
            </> : <div className="stream-detail-placeholder"><PanelRight size={26} /><strong>اختر طلباً من القائمة</strong><span>تظهر البنود ومسار الإجراء هنا دون ازدحام القائمة.</span></div>}
          </aside>
        </section>
      </main>
    </MockAppShell>
    <style>{`
      .streamlined { --butter:#4f2a63; --plum:#2f1c3a; --cream:#fffaf2; --paper:#fffdf9; --peach:#f5d4b6; --line:#e6ddd6; background:#f6f0e8; color:var(--plum); }
      .stream-page{max-width:1440px;margin:auto;padding:26px 34px 42px}.stream-header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:22px}.stream-title{display:flex;gap:13px;align-items:center}.stream-mark{height:42px;width:42px;border-radius:14px;background:var(--butter);color:#fff7ef;display:grid;place-items:center;box-shadow:0 8px 20px #4f2a6322}.stream-eyebrow{font-size:10px;letter-spacing:.12em;font-weight:700;color:#9a725e}.stream-title h1{font-size:25px;line-height:1.2;margin:2px 0;font-weight:700;letter-spacing:-.03em}.stream-title p{font-size:12px;color:#826d69;margin:0}.stream-utilities{display:flex;align-items:center;gap:13px;flex-wrap:wrap}.stream-live{font-size:11px;color:#765c53;background:#fff8ec;border:1px solid #e6d3ba;border-radius:20px;padding:6px 10px;white-space:nowrap}.stream-live i{display:inline-block;width:6px;height:6px;background:#b76a38;border-radius:10px;margin-left:6px}.stream-text-button{border:0;background:transparent;color:#694d60;font-family:inherit;font-size:12px;cursor:pointer;padding:7px 3px;display:flex;align-items:center;gap:5px}.stream-text-button:hover{text-decoration:underline}.stream-notice{background:#f7e5d3;border:1px solid #e9c8a6;border-radius:12px;padding:10px 13px;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#633b33;margin-bottom:16px}.stream-notice div{display:flex;align-items:center;gap:8px}.stream-notice button,.stream-detail-head button{border:0;background:transparent;color:inherit;cursor:pointer;padding:4px}.stream-tabs{display:flex;border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none;margin-bottom:17px}.stream-tab{display:flex;flex:none;align-items:center;gap:7px;padding:10px 13px 12px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;font-family:inherit;color:#806f70;font-size:12px;cursor:pointer}.stream-tab b{background:#e9e0db;border-radius:10px;padding:1px 6px;font-size:10px;color:#765f60}.stream-tab.is-active{color:var(--butter);border-bottom-color:var(--butter);font-weight:700}.stream-tab.is-active b{background:#ead8e8;color:var(--butter)}.stream-workspace{display:grid;grid-template-columns:minmax(0,1fr) 356px;gap:16px;align-items:start}.stream-queue,.stream-detail{background:var(--paper);border:1px solid var(--line);border-radius:16px;box-shadow:0 8px 24px #35201b09}.stream-controlbar{display:flex;align-items:center;gap:9px;padding:13px;border-bottom:1px solid #eee5df}.stream-search{position:relative;flex:1}.stream-search svg{position:absolute;right:11px;top:11px;color:#9b8580}.stream-search input{background:#fbf7f3;border-color:#e9dfd8;height:39px;padding-right:35px;font-size:12px}.stream-filter-toggle{height:39px;border-color:#e6d9d1;background:#fffaf6;color:#633e52;font-family:inherit;font-size:12px;gap:6px}.stream-result-count{font-size:11px;color:#998582;white-space:nowrap}.stream-filters{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 13px;max-height:0;opacity:0;overflow:hidden;transition:max-height .25s ease,opacity .2s ease,padding .25s ease}.stream-filters.is-open{padding:12px 13px;max-height:75px;opacity:1}.stream-filters button{font-family:inherit;font-size:12px;background:#fffdfa}.stream-list{padding:6px}.stream-row{width:100%;display:grid;grid-template-columns:minmax(185px,1.25fr) minmax(135px,.7fr) minmax(130px,.8fr) 18px;gap:12px;text-align:right;align-items:center;border:1px solid transparent;border-radius:11px;padding:12px;background:transparent;color:inherit;font-family:inherit;cursor:pointer;transition:background .15s,transform .15s}.stream-row:hover{background:#fcf6f1}.stream-row.is-selected{background:#f5edf4;border-color:#e9d8e7}.stream-row.needs-attention{box-shadow:inset -3px 0 #c56a45}.stream-order-line{display:flex;gap:7px;align-items:center}.stream-order-line strong{font-family:"Plus Jakarta Sans",sans-serif;font-size:12px;color:#4f2a63;direction:ltr}.stream-row-main>span{font-size:11px;color:#6e5f60;display:block;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.stream-row-main i{font-style:normal;color:#b49f99;padding:0 5px}.stream-alert{font-size:10px;background:#f9e4d6;color:#934829;border-radius:4px;padding:2px 5px;display:inline-flex;align-items:center;gap:3px}.stream-need span,.stream-state>span{display:block;font-size:10px;color:#9d8985}.stream-need strong{font-size:11px;font-weight:600;white-space:nowrap}.stream-state{display:flex;flex-direction:column;gap:4px}.stream-status{font-size:10px;font-weight:700;width:max-content;border-radius:4px;padding:3px 6px}.stream-status-requested{background:#f7e8ca;color:#7d5815}.stream-status-approved{background:#e7e5f6;color:#4d4388}.stream-status-prepared{background:#dcece7;color:#286458}.stream-status-dispatched{background:#f9e2d2;color:#934d2d}.stream-status-received{background:#e0eee4;color:#366948}.stream-status-cancelled{background:#eee9e6;color:#80716b}.stream-chevron{color:#b59e9a}.stream-detail{position:sticky;top:12px;min-height:520px;padding:18px}.stream-detail-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #eee4de;padding-bottom:15px}.stream-detail-head h2{font-family:"Plus Jakarta Sans",sans-serif;color:var(--butter);font-size:19px;direction:ltr;margin:4px 0 0}.stream-detail-route{display:flex;align-items:center;gap:10px;padding:15px 0}.stream-detail-route div{flex:1}.stream-detail-route span,.stream-detail-meta span,.stream-note span{display:block;font-size:10px;color:#9c8883;margin-bottom:3px}.stream-detail-route strong{font-size:12px;line-height:1.7}.stream-detail-route svg{color:#af9491}.stream-detail-meta{background:#fbf5f0;border-radius:10px;padding:11px;display:grid;gap:10px}.stream-detail-meta>div{display:grid;grid-template-columns:18px 1fr;column-gap:7px;align-items:center}.stream-detail-meta svg{grid-row:span 2;color:#8b5d6d}.stream-detail-meta strong{font-size:11px}.stream-detail-warning{padding:9px;margin-top:12px;background:#f9e7dc;border-radius:8px;color:#833e29;font-size:11px;display:flex;gap:7px;line-height:1.6}.stream-detail-section{padding-top:18px}.stream-section-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}.stream-section-title h3{font-size:13px;margin:0}.stream-section-title span{font-size:10px;color:#957e79}.stream-items{border-top:1px solid #eee6df}.stream-item{display:flex;justify-content:space-between;padding:8px 1px;border-bottom:1px solid #eee6df;font-size:11px}.stream-item strong{font-weight:600}.stream-more{font-size:10px;color:#8d7772;margin:8px 0}.stream-note{background:#f6f0e5;border-right:3px solid #c7955a;margin-top:15px;padding:9px 10px}.stream-note p{font-size:11px;margin:2px 0 0;line-height:1.7}.stream-demo-action{border-top:1px solid #eee4de;margin-top:16px;padding-top:13px}.stream-demo-action p{font-size:10px;color:#947e78;line-height:1.5;margin:0 0 8px}.stream-demo-action button{width:100%;background:var(--butter);font-family:inherit;font-size:12px;gap:6px}.stream-demo-action button:disabled{background:#e6ded9;color:#8a7974}.stream-detail-placeholder{height:480px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:8px;color:#8e7875;padding:24px}.stream-detail-placeholder strong{color:#694d60;font-size:13px}.stream-detail-placeholder span{font-size:11px;line-height:1.7}.stream-empty{padding:58px 16px;display:flex;flex-direction:column;align-items:center;gap:8px;color:#8d7772;text-align:center}.stream-empty strong{font-size:13px;color:#674d56}.stream-empty span{font-size:11px}.stream-empty button{font-family:inherit;font-size:11px;color:var(--butter);background:none;border:0;text-decoration:underline;cursor:pointer}
      @media(max-width:850px){.stream-page{padding:18px}.stream-workspace{grid-template-columns:1fr}.stream-detail{position:relative;top:auto;min-height:auto}.stream-row{grid-template-columns:minmax(155px,1fr) minmax(125px,.7fr) minmax(115px,.75fr) 16px}}
      @media(max-width:560px){.stream-page{padding:12px}.stream-header{display:block;margin-bottom:15px}.stream-utilities{margin-top:12px;gap:7px}.stream-title h1{font-size:21px}.stream-title p{font-size:11px}.stream-notice{font-size:10px;padding:9px}.stream-tabs{margin-inline:-12px;padding-inline:4px}.stream-tab{font-size:11px;padding-inline:10px}.stream-workspace{gap:10px}.stream-controlbar{padding:10px;flex-wrap:wrap}.stream-search{flex-basis:100%}.stream-filter-toggle{flex:1}.stream-result-count{margin-inline-start:auto}.stream-filters{grid-template-columns:1fr;max-height:0}.stream-filters.is-open{max-height:190px}.stream-row{grid-template-columns:1fr 18px;gap:6px;padding:12px 10px}.stream-need{grid-column:1}.stream-state{grid-column:1;grid-row:3;flex-direction:row;align-items:center}.stream-chevron{grid-column:2;grid-row:1 / span 3}.stream-detail{padding:15px}.stream-detail-route{gap:6px}.stream-detail-route strong{font-size:11px}}
    `}</style>
  </div>;
}

export default Streamlined;