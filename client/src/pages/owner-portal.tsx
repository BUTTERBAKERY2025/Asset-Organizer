import { useEffect, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Home, ChartNoAxesCombined, Package, UsersRound, Megaphone, RefreshCw, LogOut, Download, ChevronLeft, ChevronRight, ImageOff, CalendarDays, MapPin, X } from "lucide-react";
import logo from "@assets/logo_butter_bakery__1768502624540.png";
import { useAuth } from "@/hooks/useAuth";
import { ownerAccessRevoked, restoreOwnerAccess, subscribeOwnerAccess, useOwnerAssets, useOwnerBranches, useOwnerMarketing, useOwnerOverview, useOwnerSales, useOwnerShareholders } from "@/hooks/use-owner-portal";
import { exportOwnerPdf, ownerDelta, ownerMoney, ownerNumber } from "@/lib/owner-pdf";
import type { OwnerAssetsResponse, OwnerMarketingResponse, OwnerMarketingSection, OwnerSalesResponse, OwnerShareholdersResponse } from "@shared/owner-portal";
import "./owner-portal.css";

type Tab = "home" | "sales" | "assets" | "shareholders" | "marketing";
type OwnerDetail =
  | { kind: "asset"; item: OwnerAssetsResponse["items"][number] }
  | { kind: "shareholder"; item: OwnerShareholdersResponse["items"][number]; basis: string }
  | { kind: "marketing"; item: OwnerMarketingResponse["items"][number] };
const tabList = [
  { id: "home", label: "الرئيسية", icon: Home },
  { id: "sales", label: "المبيعات", icon: ChartNoAxesCombined },
  { id: "assets", label: "الأصول", icon: Package },
  { id: "shareholders", label: "المساهمون", icon: UsersRound },
  { id: "marketing", label: "التسويق", icon: Megaphone },
] as const;
const marketingSections: Array<{ id: OwnerMarketingSection; label: string }> = [
  { id: "campaigns", label: "الحملات" }, { id: "calendar", label: "التقويم" },
  { id: "tasks", label: "المهام" }, { id: "content", label: "المحتوى" },
];
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dateText = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("ar-SA-u-nu-latn", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh" }).format(d);
};
const fresh = (value?: string) => value ? `تحديث ${new Date(value).toLocaleString("ar-SA-u-nu-latn", { timeZone: "Asia/Riyadh", dateStyle: "short", timeStyle: "short" })}` : "بانتظار المصدر";
function Loading() { return <div aria-label="جارٍ تحميل البيانات" role="status"><div className="owner-skeleton" /><div className="owner-skeleton" /><div className="owner-skeleton" /></div>; }
function Empty({ title, hint }: { title: string; hint: string }) { return <div className="owner-empty"><strong>{title}</strong>{hint}</div>; }
function Thumbnail({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  return src && !failed ? <img className="owner-thumb" src={src} alt={alt} onError={() => setFailed(true)} /> : <div className="owner-thumb" role="img" aria-label="لا توجد صورة متاحة"><ImageOff size={19} /></div>;
}
function ErrorState({ retry }: { retry: () => void }) { return <div className="owner-empty" role="alert"><strong>تعذر جلب البيانات</strong><p>تحقق من الاتصال وحاول مرة أخرى. لم نعرض أرقاماً تقديرية.</p><button className="owner-action" onClick={retry}>إعادة المحاولة</button></div>; }
function Paging({ page, total, pageSize, setPage }: { page: number; total: number; pageSize: number; setPage: (page: number) => void }) {
  if (total <= pageSize) return null;
  return <div className="owner-pagination"><button className="owner-action" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="الصفحة السابقة"><ChevronRight size={16} /></button><span>صفحة {ownerNumber(page)} من {ownerNumber(Math.ceil(total / pageSize))}</span><button className="owner-action" disabled={page * pageSize >= total} onClick={() => setPage(page + 1)} aria-label="الصفحة التالية"><ChevronLeft size={16} /></button></div>;
}
function SalesList({ sales }: { sales: OwnerSalesResponse }) {
  return <div className="owner-list">{sales.branches.map(branch => <div className="owner-row owner-card" key={branch.id}>
    <div className="owner-row-main"><strong>{branch.name}</strong><small>{branch.status === "missing" ? <span className="owner-status missing">لم يصل تقرير للفترة</span> : `${ownerNumber(branch.journalCount)} يومية · ${ownerDelta(branch.sales || 0, branch.previousSales)}`}</small></div>
    <div className="owner-row-value">{ownerMoney(branch.sales)}</div>
  </div>)}</div>;
}

export default function OwnerPortal() {
  const queryClient = useQueryClient();
  const { logout, isLoggingOut } = useAuth();
  const revoked = useSyncExternalStore(subscribeOwnerAccess, ownerAccessRevoked);
  const [tab, setTab] = useState<Tab>(() => {
    const saved = sessionStorage.getItem("owner-tab");
    return tabList.some(t => t.id === saved) ? saved as Tab : "home";
  });
  const [branchId, setBranchId] = useState("all");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [searches, setSearches] = useState<Record<string, string>>({});
  const [pages, setPages] = useState<Record<string, number>>({});
  const [section, setSection] = useState<OwnerMarketingSection>("campaigns");
  const [detail, setDetail] = useState<OwnerDetail | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  useEffect(() => () => { void queryClient.cancelQueries({ queryKey: ["owner"] }); queryClient.removeQueries({ queryKey: ["owner"] }); }, [queryClient]);
  const branches = useOwnerBranches(!revoked);
  const overview = useOwnerOverview(dateTo, branchId, !revoked && (tab === "home" || tab === "sales" || exporting));
  const validDates = dateFrom <= dateTo;
  const sales = useOwnerSales(dateFrom, dateTo, branchId, !revoked && tab === "sales" && validDates);
  const searchKey = tab === "marketing" ? section : tab;
  const search = searches[searchKey] || "";
  const page = pages[searchKey] || 1;
  const assets = useOwnerAssets(branchId, searches.assets || "", pages.assets || 1, !revoked && tab === "assets");
  const shareholders = useOwnerShareholders(searches.shareholders || "", pages.shareholders || 1, !revoked && tab === "shareholders");
  const marketing = useOwnerMarketing(section, searches[section] || "", pages[section] || 1, !revoked && tab === "marketing");
  useEffect(() => { sessionStorage.setItem("owner-tab", tab); }, [tab]);
  useEffect(() => { if (detail) { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setDetail(null); }; document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); } }, [detail]);
  const retry = () => void queryClient.invalidateQueries({ queryKey: ["owner"] });
  const setSearch = (value: string) => { setSearches(v => ({ ...v, [searchKey]: value })); setPages(v => ({ ...v, [searchKey]: 1 })); };
  const setPage = (value: number) => setPages(v => ({ ...v, [searchKey]: value }));
  const changeBranch = (value: string) => { setBranchId(value); setPages({}); };
  const activeName = tabList.find(t => t.id === tab)?.label || "الرئيسية";
  const currentData = tab === "home" ? overview.data : tab === "sales" ? sales.data : tab === "assets" ? assets.data : tab === "shareholders" ? shareholders.data : marketing.data;
  const activeQuery = tab === "home" ? overview : tab === "sales" ? sales : tab === "assets" ? assets : tab === "shareholders" ? shareholders : marketing;
  const recheckAccess = async () => {
    try {
      await queryClient.refetchQueries({ queryKey: ["/api/auth/me"], type: "active" }, { throwOnError: true });
      const user = queryClient.getQueryData<{ role?: string } | null>(["/api/auth/me"]);
      if (!user || (user.role !== "business_owner" && user.role !== "admin")) throw new Error("لم يعد حسابك مخولاً لعرض بوابة المالك");
      setBranchId("all");
      setPages({});
      restoreOwnerAccess();
      setExportError("");
    } catch (error) { setExportError(error instanceof Error ? error.message : "تعذر التحقق من صلاحيتك"); }
  };
  const onExport = async () => {
    setExportError(""); setExporting(true);
    try {
      // A fresh read is deliberate: exporting an off-screen section still gets a matching summary.
      const summary = overview.data || await queryClient.fetchQuery({ queryKey: ["owner", "overview", dateTo, branchId], queryFn: async () => {
        const response = await fetch(`/api/owner/overview?${new URLSearchParams({ date: dateTo, branchId })}`, { credentials: "include" });
        if (!response.ok) throw new Error("تعذر تحميل الملخص");
        return response.json();
      } });
      if (!currentData || (tab === "sales" && !validDates)) throw new Error("انتظر اكتمال تحميل القسم قبل التصدير");
      const sectionData = tab === "sales" && sales.data ? { title: "مبيعات الفروع", columns: ["الفرع", "المبيعات", "الحالة"], rows: sales.data.branches.map(b => [b.name, ownerMoney(b.sales), b.status === "missing" ? "لم يصل تقرير" : "مسجل"]) } :
        tab === "assets" && assets.data ? { title: "الأصول", columns: ["الأصل", "الفرع", "الحالة"], rows: assets.data.items.map(a => [a.name, a.branchName, a.status]) } :
        tab === "shareholders" && shareholders.data ? { title: "المساهمون", columns: ["الاسم", "الأسهم", "نسبة الملكية"], rows: shareholders.data.items.map(s => [s.name, ownerNumber(s.shares), s.ownershipPercent === null ? "غير متاح" : `${ownerNumber(s.ownershipPercent)}%`]), note: shareholders.data.summary.ownershipBasis } :
        tab === "marketing" && marketing.data ? { title: `التسويق · ${marketingSections.find(s => s.id === section)?.label}`, columns: ["العنوان", "الحالة", "التاريخ"], rows: marketing.data.items.map(m => [m.title, m.status, m.date ? dateText(m.date) : "—"]), note: marketing.data.scopeLabel } : undefined;
      await exportOwnerPdf({ overview: summary, sales: sales.data, section: sectionData, sectionPage: tab === "home" || tab === "sales" ? undefined : page, branchName: branches.data?.branches.find(b => b.id === branchId)?.name || "جميع الفروع", period: tab === "sales" && dateFrom !== dateTo ? `${dateText(dateFrom)} — ${dateText(dateTo)}` : dateText(dateTo) });
    } catch (error) { setExportError(error instanceof Error ? error.message : "تعذر إنشاء PDF"); }
    finally { setExporting(false); }
  };

  if (revoked) return <div className="owner-portal" dir="rtl" lang="ar"><main className="owner-shell" style={{ paddingTop: "min(18vh,120px)" }}><div className="owner-brand"><img src={logo} alt="" /><strong>باتر بيكري · بوابة المالك</strong></div><div className="owner-section owner-card" role="alert"><h1 className="owner-title">تغيرت صلاحية الوصول</h1><p className="owner-sub">أُزيلت البيانات السابقة من هذه الجلسة. تحقّق من صلاحيتك لتحميل بيانات حديثة.</p><button className="owner-action" onClick={recheckAccess}>إعادة التحقق</button>{exportError && <p className="owner-sub">{exportError}</p>}</div></main></div>;

  return <div className="owner-portal" dir="rtl" lang="ar">
    <div className="owner-shell">
      <header className="owner-head"><div className="owner-brand"><img src={logo} alt="شعار باتر بيكري" /><div><strong>باتر بيكري</strong><small>OWNER PORTAL</small></div></div>
        <div className="owner-tools"><button className="owner-icon" title="تحديث البيانات" aria-label="تحديث البيانات" onClick={retry}><RefreshCw size={18} /></button><button className="owner-icon" title="تسجيل الخروج" aria-label="تسجيل الخروج" disabled={isLoggingOut} onClick={async () => { try { await logout(); window.location.assign("/login"); } catch { setExportError("تعذر تسجيل الخروج؛ حاول مرة أخرى"); } }}><LogOut size={18} /></button></div></header>
      <div className="owner-kicker">مساحة المالك · {dateText(today())}</div>
      <h1 className="owner-title">{tab === "home" ? "صورة اليوم، بوضوح." : activeName}</h1>
      <p className="owner-sub">{tab === "home" ? "ما يهمك من الفروع في مكان واحد." : tab === "sales" ? "المبيعات المسجلة في يوميات الفروع، وليست صافي الربح." : tab === "marketing" ? "نشاط التسويق على مستوى الشركة · للعرض فقط" : "بيانات أساسية للعرض فقط"}</p>
      {(tab === "home" || tab === "sales" || tab === "assets") && <div className="owner-filters" aria-label="تصفية البيانات">
        <label className="owner-field"><MapPin size={15} /><select aria-label="الفرع" value={branchId} onChange={e => changeBranch(e.target.value)}><option value="all">جميع الفروع</option>{branches.data?.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        {tab === "sales" && <label className="owner-field"><CalendarDays size={15} /><span>من</span><input type="date" aria-label="من تاريخ" value={dateFrom} max={dateTo} onChange={e => setDateFrom(e.target.value)} /></label>}
        {tab !== "assets" && <label className="owner-field"><span>{tab === "home" ? "التاريخ" : "إلى"}</span><input type="date" aria-label="إلى تاريخ" value={dateTo} min={tab === "sales" ? dateFrom : undefined} onChange={e => setDateTo(e.target.value)} /></label>}
      </div>}
      {branches.isError && (tab === "home" || tab === "sales" || tab === "assets") && <div className="owner-section"><ErrorState retry={retry} /></div>}
      {tab === "home" && (overview.isLoading ? <Loading /> : overview.isError ? <ErrorState retry={retry} /> : overview.data ? <>
        <div className="owner-hero"><small>المبيعات المسجلة · {dateText(overview.data.dateFrom)}{overview.data.dateTo !== overview.data.dateFrom ? ` — ${dateText(overview.data.dateTo)}` : ""}</small><h2>{ownerNumber(overview.data.totals.sales)} <span>ر.س</span></h2><p>{ownerDelta(overview.data.totals.sales, overview.data.totals.previousSales)}</p><div className="owner-pill">{ownerNumber(overview.data.totals.reportedBranches)} من {ownerNumber(overview.data.totals.branchCount)} فرع أرسل تقريراً</div></div>
        <div className="owner-section"><div className="owner-section-head"><h2>على مستوى العمل</h2><small>{fresh(overview.data.generatedAt)}</small></div><div className="owner-grid">
          <div className="owner-card owner-metric"><small>يوميات المبيعات</small><strong>{ownerNumber(overview.data.totals.journalCount)}</strong><em>من المصدر المسجل</em></div>
          <div className="owner-card owner-metric"><small>الأصول</small><strong>{ownerNumber(overview.data.assets.total)}</strong><em>{ownerNumber(overview.data.assets.needsAttention)} تحتاج اهتماماً</em></div>
          <div className="owner-card owner-metric"><small>المساهمون</small><strong>{ownerNumber(overview.data.shareholders.count)}</strong><em>بيانات الأسهم الأساسية</em></div>
          <div className="owner-card owner-metric"><small>حملات نشطة</small><strong>{ownerNumber(overview.data.marketing.activeCampaigns)}</strong><em>على مستوى الشركة</em></div>
        </div></div>
        <div className="owner-section"><div className="owner-section-head"><h2>الفروع اليوم</h2><button className="owner-link" onClick={() => setTab("sales")}>تفاصيل المبيعات ←</button></div><SalesList sales={overview.data} /></div>
        <p className="owner-sub" style={{ marginTop: 14 }}>المصدر: {overview.data.sourceLabel}. الفرع الذي لم يرسل تقريراً لا يُحتسب كمبيعات صفرية.</p>
      </> : null)}
      {tab === "sales" && (validDates ? sales.isLoading ? <Loading /> : sales.isError ? <ErrorState retry={retry} /> : sales.data ? <>
        <div className="owner-hero"><small>المبيعات المبلّغ عنها · {dateText(dateFrom)} — {dateText(dateTo)}</small><h2>{ownerNumber(sales.data.totals.sales)} <span>ر.س</span></h2><p>{ownerDelta(sales.data.totals.sales, sales.data.totals.previousSales)}</p><div className="owner-pill">تغطية {ownerNumber(sales.data.totals.reportedBranches)} / {ownerNumber(sales.data.totals.branchCount)} فروع</div></div>
        <div className="owner-section"><div className="owner-section-head"><h2>تفصيل الفروع</h2><small>{fresh(sales.data.generatedAt)}</small></div><SalesList sales={sales.data} /><p className="owner-sub">{sales.data.sourceLabel} · غياب التقرير ليس صفراً.</p></div>
      </> : null : <Empty title="نطاق التاريخ غير صالح" hint="اختر تاريخ بداية يسبق تاريخ النهاية." />)}
      {tab === "assets" && <div className="owner-section"><div className="owner-section-head"><h2>سجل الأصول</h2><small>{fresh(assets.data?.generatedAt)}</small></div><input className="owner-search" aria-label="بحث في الأصول" placeholder="ابحث عن أصل..." value={search} onChange={e => setSearch(e.target.value)} />{assets.isLoading ? <Loading /> : assets.isError ? <ErrorState retry={retry} /> : !assets.data?.items.length ? <Empty title="لا توجد أصول مطابقة" hint="جرّب تغيير الفرع أو كلمة البحث." /> : <><div className="owner-list">{assets.data.items.map(item => <button type="button" className="owner-row owner-card owner-detail-row" aria-label={`تفاصيل الأصل ${item.name}`} onClick={() => setDetail({ kind: "asset", item })} key={item.id}><Thumbnail src={item.imageUrl} alt={item.name} /><div className="owner-row-main"><strong>{item.name}</strong><small>{item.branchName}{item.category ? ` · ${item.category}` : ""}</small>{item.maintenanceSummary && <small>صيانة: {item.maintenanceSummary}</small>}</div><span className="owner-status">{item.status}</span></button>)}</div><Paging page={pages.assets || 1} total={assets.data.total} pageSize={assets.data.pageSize} setPage={setPage} /></>}</div>}
      {tab === "shareholders" && <div className="owner-section"><div className="owner-section-head"><h2>سجل المساهمين</h2><small>{fresh(shareholders.data?.generatedAt)}</small></div><input className="owner-search" aria-label="بحث في المساهمين" placeholder="ابحث بالاسم..." value={search} onChange={e => setSearch(e.target.value)} />{shareholders.isLoading ? <Loading /> : shareholders.isError ? <ErrorState retry={retry} /> : shareholders.data ? <><div className="owner-card" style={{ marginBottom: 12, background: "var(--soft)" }}><div className="owner-grid" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}><div className="owner-metric"><small>عدد المساهمين</small><strong>{ownerNumber(shareholders.data.summary.count)}</strong></div><div className="owner-metric"><small>إجمالي الأسهم المسجلة</small><strong>{ownerNumber(shareholders.data.summary.totalShares)}</strong></div></div><small style={{ color: "var(--muted)" }}>أساس النسبة: {shareholders.data.summary.ownershipBasis} · ليست قيمة رأس المال القانوني</small></div>{!shareholders.data.items.length ? <Empty title="لا توجد نتائج" hint="جرّب اسماً آخر." /> : <div className="owner-list">{shareholders.data.items.map(item => <button type="button" className="owner-card owner-row owner-detail-row" aria-label={`تفاصيل المساهم ${item.name}`} onClick={() => setDetail({ kind: "shareholder", item, basis: shareholders.data!.summary.ownershipBasis })} key={item.id}><div className="owner-row-main"><strong>{item.name}</strong><small>{ownerNumber(item.shares)} سهم</small></div><div className="owner-row-value">{item.ownershipPercent === null ? "غير متاح" : `${ownerNumber(item.ownershipPercent)}%`}</div></button>)}</div>}<Paging page={pages.shareholders || 1} total={shareholders.data.total} pageSize={shareholders.data.pageSize} setPage={setPage} /></> : null}</div>}
      {tab === "marketing" && <div className="owner-section"><div className="owner-tabs" role="tablist" aria-label="أقسام التسويق">{marketingSections.map(s => <button key={s.id} role="tab" aria-selected={section === s.id} className="owner-tab" data-active={section === s.id} onClick={() => setSection(s.id)}>{s.label}</button>)}</div><div className="owner-section-head"><h2>{marketingSections.find(s => s.id === section)?.label}</h2><small>{marketing.data?.scopeLabel || "على مستوى الشركة"} · {fresh(marketing.data?.generatedAt)}</small></div><input className="owner-search" aria-label="بحث في التسويق" placeholder="ابحث في القسم..." value={search} onChange={e => setSearch(e.target.value)} />{marketing.isLoading ? <Loading /> : marketing.isError ? <ErrorState retry={retry} /> : !marketing.data?.items.length ? <Empty title="لا توجد عناصر مطابقة" hint="جرّب تغيير القسم أو كلمة البحث." /> : <><div className="owner-list">{marketing.data.items.map(item => <button className="owner-row owner-card owner-detail-row" key={item.id} onClick={() => setDetail({ kind: "marketing", item })}>{item.imageUrl && <Thumbnail src={item.imageUrl} alt="" />}<div className="owner-row-main"><strong>{item.title}</strong><small>{item.date ? dateText(item.date) : "بلا تاريخ"}{item.summary ? ` · ${item.summary}` : ""}</small></div><span className="owner-status">{item.status}</span></button>)}</div><Paging page={pages[section] || 1} total={marketing.data.total} pageSize={marketing.data.pageSize} setPage={setPage} /></>}</div>}
      <div className="owner-section owner-actions"><button className="owner-action" disabled={exporting || activeQuery.isLoading || !currentData || (tab === "sales" && !validDates)} onClick={onExport}><Download size={15} style={{ display: "inline", marginLeft: 7 }} />{exporting ? "جارٍ تجهيز الملف..." : "تصدير PDF"}</button><small style={{ color: "var(--muted)" }}>ملخص عام + {tab === "home" ? "الرئيسية" : tab === "sales" ? "الفروع" : "الصفحة المعروضة فقط"}</small></div>
      {exportError && <p role="alert" className="owner-sub" style={{ color: "#9e3d41" }}>{exportError}</p>}
    </div>
    <nav className="owner-bottom" aria-label="تنقل بوابة المالك">{tabList.map(item => <button key={item.id} className="owner-nav" aria-current={tab === item.id ? "page" : undefined} data-active={tab === item.id} onClick={() => setTab(item.id)}><item.icon aria-hidden="true" />{item.label}</button>)}</nav>
    {detail && <div className="owner-dialog-backdrop" onClick={() => setDetail(null)}><div className="owner-dialog" role="dialog" aria-modal="true" aria-label={detail.kind === "asset" ? detail.item.name : detail.kind === "shareholder" ? detail.item.name : detail.item.title} onClick={e => e.stopPropagation()}><div className="owner-section-head"><h2>{detail.kind === "marketing" ? detail.item.title : detail.item.name}</h2><button className="owner-icon" autoFocus onClick={() => setDetail(null)} aria-label="إغلاق"><X size={18} /></button></div>
      {detail.kind === "asset" ? <><Thumbnail src={detail.item.imageUrl} alt={detail.item.name} /><p><strong>الفرع:</strong> {detail.item.branchName}</p><p><strong>الحالة:</strong> {detail.item.status}</p><p><strong>التصنيف:</strong> {detail.item.category || "غير محدد"}</p><p><strong>الصيانة:</strong> {detail.item.maintenanceSummary || "لا توجد ملاحظة صيانة مسجلة"}</p></> :
        detail.kind === "shareholder" ? <><p><strong>الأسهم المسجلة:</strong> {ownerNumber(detail.item.shares)} سهم</p><p><strong>نسبة الملكية:</strong> {detail.item.ownershipPercent === null ? "غير متاحة" : `${ownerNumber(detail.item.ownershipPercent)}%`}</p><p><strong>أساس النسبة:</strong> {detail.basis}؛ لا تمثل قيمة رأس المال القانوني.</p></> :
        <><span className="owner-status">{detail.item.status}</span><p>{detail.item.date ? dateText(detail.item.date) : "بلا تاريخ"}</p><p>{detail.item.summary || "لا توجد تفاصيل إضافية متاحة للعرض."}</p></>}
      <button className="owner-action" onClick={() => setDetail(null)}>إغلاق</button></div></div>}
  </div>;
}