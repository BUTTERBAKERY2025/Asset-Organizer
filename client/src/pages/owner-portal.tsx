import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Home, ChartNoAxesCombined, Package, UsersRound, Megaphone, RefreshCw, LogOut, Download, ChevronLeft, ChevronRight, ImageOff, CalendarDays, MapPin, X } from "lucide-react";
import logo from "@assets/logo_butter_bakery__1768502624540.png";
import { useAuth } from "@/hooks/useAuth";
import { assertOwnerAccessGeneration, getOwnerAccessGeneration, ownerAccessRevoked, ownerGet, restoreOwnerAccess, subscribeOwnerAccess, useOwnerAssets, useOwnerBranches, useOwnerMarketing, useOwnerOverview, useOwnerSales, useOwnerShareholders } from "@/hooks/use-owner-portal";
import { exportOwnerPdf, ownerComparison, ownerCoverageWarning, ownerMoney, ownerNumber, ownerRiyadhDate } from "@/lib/owner-pdf";
import type { OwnerAssetsResponse, OwnerMarketingResponse, OwnerMarketingSection, OwnerOverviewResponse, OwnerSalesResponse, OwnerShareholdersResponse } from "@shared/owner-portal";
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
const today = ownerRiyadhDate;
const previousDay = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
};
const dateText = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("ar-SA-u-nu-latn", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh" }).format(d);
};
const statusText = (status: string) => ({
  active: "نشط", inactive: "غير نشط", pending: "قيد الانتظار", completed: "مكتمل",
  in_progress: "قيد التنفيذ", scheduled: "مجدول", published: "منشور",
  draft: "مسودة", cancelled: "ملغى", available: "متاح", maintenance: "صيانة",
} as Record<string, string>)[status] || status;
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
    <div className="owner-row-main"><strong>{branch.name}</strong><small>{branch.status === "missing" ? <span className="owner-status missing">لم يصل تقرير للفترة</span> : `${ownerNumber(branch.journalCount)} يومية`}</small></div>
    <div className="owner-row-value">{ownerMoney(branch.sales)}</div>
  </div>)}</div>;
}
function Coverage({ sales }: { sales: OwnerSalesResponse }) {
  const warning = ownerCoverageWarning(sales);
  return warning ? <p className="owner-coverage" role="status">{warning}</p> : null;
}
function SectionUnavailable({ retry }: { retry: () => void }) {
  return <div className="owner-metric owner-card" role="alert"><strong className="owner-unavailable">غير متاح حالياً</strong><button type="button" className="owner-action" onClick={retry}>إعادة المحاولة</button></div>;
}
function LastReport({ date, onSelect }: { date?: string | null; onSelect: (date: string) => void }) {
  return <p className="owner-sub">{date ? <>آخر تقرير متاح: {dateText(date)} <button type="button" className="owner-link" style={{ color: "#fff", textDecoration: "underline" }} onClick={() => onSelect(date)}>عرض آخر تقرير</button></> : "لا يوجد تقرير متاح لهذا الفرع حتى الآن."}</p>;
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const exportSnapshot = JSON.stringify({ tab, branchId, dateFrom, dateTo, section, searches, pages });
  const snapshotRef = useRef(exportSnapshot);
  snapshotRef.current = exportSnapshot;
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
  useEffect(() => { setDetail(null); }, [revoked, branchId, dateFrom, dateTo, tab, section, searches, pages]);
  useEffect(() => {
    if (!detail || revoked) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const prior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = priorOverflow;
      if (!revoked && prior?.isConnected) prior.focus();
    };
  }, [detail, revoked]);
  const retry = () => void queryClient.invalidateQueries({ queryKey: ["owner"] });
  const setSearch = (value: string) => { if (exporting) return; setSearches(v => ({ ...v, [searchKey]: value })); setPages(v => ({ ...v, [searchKey]: 1 })); };
  const setPage = (value: number) => { if (!exporting) setPages(v => ({ ...v, [searchKey]: value })); };
  const changeBranch = (value: string) => { setBranchId(value); setPages({}); };
  const selectReportDate = (date: string) => { setDateFrom(date); setDateTo(date); };
  const chooseSalesPeriod = (period: "today" | "yesterday" | "month") => {
    const end = period === "yesterday" ? previousDay(today()) : today();
    setDateFrom(period === "month" ? `${end.slice(0, 7)}-01` : end);
    setDateTo(end);
  };
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
    if (exporting || !validDates && tab === "sales") return;
    const generation = getOwnerAccessGeneration();
    const snapshot = snapshotRef.current;
    const assertSnapshot = () => {
      assertOwnerAccessGeneration(generation);
      if (snapshotRef.current !== snapshot) throw new Error("تغيرت عوامل التصفية أثناء التصدير؛ أعد المحاولة");
    };
    setExportError(""); setExporting(true);
    try {
      // Bypass React Query's cache: summary and the visible page must both reflect a fresh read.
      const summary = await ownerGet<OwnerOverviewResponse>("/api/owner/overview", { date: dateTo, branchId });
      assertSnapshot();
      const active = tab === "home" ? summary :
        tab === "sales" ? await ownerGet<OwnerSalesResponse>("/api/owner/sales", { dateFrom, dateTo, branchId }) :
        tab === "assets" ? await ownerGet<OwnerAssetsResponse>("/api/owner/assets", { branchId, search: searches.assets || "", page: String(pages.assets || 1) }) :
        tab === "shareholders" ? await ownerGet<OwnerShareholdersResponse>("/api/owner/shareholders", { search: searches.shareholders || "", page: String(pages.shareholders || 1) }) :
        await ownerGet<OwnerMarketingResponse>("/api/owner/marketing", { section, search: searches[section] || "", page: String(pages[section] || 1) });
      assertSnapshot();
      const sectionData = tab === "sales" && "branches" in active ? { title: "مبيعات الفروع", columns: ["الفرع", "المبيعات", "الحالة"], rows: active.branches.map(b => [b.name, ownerMoney(b.sales), b.status === "missing" ? "لم يصل تقرير" : "مسجل"]) } :
        tab === "assets" && "items" in active ? { title: "الأصول", columns: ["الأصل", "الفرع", "الحالة"], rows: (active as OwnerAssetsResponse).items.map(a => [a.name, a.branchName, statusText(a.status)]) } :
        tab === "shareholders" && "items" in active ? { title: "المساهمون", columns: ["الاسم", "الأسهم", "نسبة الملكية"], rows: (active as OwnerShareholdersResponse).items.map(s => [s.name, ownerNumber(s.shares), s.ownershipPercent === null ? "غير متاح" : `${ownerNumber(s.ownershipPercent)}%`]), note: (active as OwnerShareholdersResponse).summary.ownershipBasis } :
        tab === "marketing" && "items" in active ? { title: `التسويق · ${marketingSections.find(s => s.id === section)?.label}`, columns: ["العنوان", "الحالة", "التاريخ"], rows: (active as OwnerMarketingResponse).items.map(m => [m.title, statusText(m.status), m.date ? dateText(m.date) : "—"]), note: (active as OwnerMarketingResponse).scopeLabel } : undefined;
      await exportOwnerPdf({ overview: summary, sales: tab === "sales" ? active as OwnerSalesResponse : undefined, section: sectionData, sectionPage: tab === "home" || tab === "sales" ? undefined : page, branchName: branches.data?.branches.find(b => b.id === branchId)?.name || "جميع الفروع", period: tab === "sales" && dateFrom !== dateTo ? `${dateText(dateFrom)} — ${dateText(dateTo)}` : dateText(dateTo), accessGeneration: generation, assertSnapshot });
    } catch (error) { setExportError(error instanceof Error ? error.message : "تعذر إنشاء PDF"); }
    finally { setExporting(false); }
  };

  if (revoked) return <div className="owner-portal" dir="rtl" lang="ar"><main className="owner-shell" style={{ paddingTop: "min(18vh,120px)" }}><div className="owner-brand"><img src={logo} alt="" /><strong>باتر بيكري · بوابة المالك</strong></div><div className="owner-section owner-card" role="alert"><h1 className="owner-title">تغيرت صلاحية الوصول</h1><p className="owner-sub">أُزيلت البيانات السابقة من هذه الجلسة. تحقّق من صلاحيتك لتحميل بيانات حديثة.</p><button className="owner-action" onClick={recheckAccess}>إعادة التحقق</button>{exportError && <p className="owner-sub">{exportError}</p>}</div></main></div>;

  return <div className="owner-portal" dir="rtl" lang="ar">
    <div className="owner-shell">
      <header className="owner-head"><div className="owner-brand"><img src={logo} alt="شعار باتر بيكري" /><div><strong>باتر بيكري</strong><small>OWNER PORTAL</small></div></div>
        <div className="owner-tools"><button className="owner-icon" title="تحديث البيانات" aria-label="تحديث البيانات" onClick={retry}><RefreshCw size={18} /></button><button className="owner-icon" title="تسجيل الخروج" aria-label="تسجيل الخروج" disabled={isLoggingOut} onClick={async () => { try { await logout(); window.location.assign("/login"); } catch { setExportError("تعذر تسجيل الخروج؛ حاول مرة أخرى"); } }}><LogOut size={18} /></button></div></header>
      <div className="owner-kicker">مساحة المالك · {dateText(today())}</div>
      <h1 className="owner-title">{tab === "home" ? dateTo === today() ? "صورة اليوم، بوضوح." : "صورة الفترة، بوضوح." : activeName}</h1>
      <p className="owner-sub">{tab === "home" || tab === "sales" ? "إجمالي المبيعات (شامل الضريبة) كما سُجلت في يوميات الكاشير، وليست صافي الربح." : tab === "marketing" ? "نشاط التسويق على مستوى الشركة · للعرض فقط" : "بيانات أساسية للعرض فقط"}</p>
      {(tab === "home" || tab === "sales" || tab === "assets") && <div className="owner-filters" aria-label="تصفية البيانات">
        <label className="owner-field"><MapPin size={15} /><select disabled={exporting} aria-label="الفرع" value={branchId} onChange={e => changeBranch(e.target.value)}><option value="all">جميع الفروع</option>{branches.data?.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        {tab === "sales" && <label className="owner-field"><CalendarDays size={15} /><span>من</span><input disabled={exporting} type="date" aria-label="من تاريخ" value={dateFrom} max={dateTo} onChange={e => setDateFrom(e.target.value)} /></label>}
        {tab !== "assets" && <label className="owner-field"><span>{tab === "home" ? "التاريخ" : "إلى"}</span><input disabled={exporting} type="date" aria-label="إلى تاريخ" value={dateTo} min={tab === "sales" ? dateFrom : undefined} onChange={e => setDateTo(e.target.value)} /></label>}
        {tab === "sales" && <><button disabled={exporting} type="button" className="owner-action" onClick={() => chooseSalesPeriod("today")}>اليوم</button><button disabled={exporting} type="button" className="owner-action" onClick={() => chooseSalesPeriod("yesterday")}>مبيعات أمس</button><button disabled={exporting} type="button" className="owner-action" onClick={() => chooseSalesPeriod("month")}>مبيعات إجمالي الشهر</button></>}
      </div>}
      {branches.isError && (tab === "home" || tab === "sales" || tab === "assets") && <div className="owner-section"><ErrorState retry={retry} /></div>}
      {tab === "home" && (overview.isLoading ? <Loading /> : overview.isError ? <ErrorState retry={retry} /> : overview.data ? <>
        {overview.data.sectionErrors?.sales ? <div className="owner-section"><h2>المبيعات</h2><SectionUnavailable retry={retry} /></div> : <div className="owner-hero"><small>إجمالي المبيعات (شامل الضريبة) · {dateText(overview.data.dateFrom)}{overview.data.dateTo !== overview.data.dateFrom ? ` — ${dateText(overview.data.dateTo)}` : ""}</small>{overview.data.totals.reportedBranches === 0 ? <><h2>لم يصل تقرير للفترة</h2><LastReport date={overview.data.latestReportDate} onSelect={selectReportDate} /></> : <><h2>{ownerNumber(overview.data.totals.sales)} <span>ر.س</span></h2><p>{ownerComparison(overview.data)}</p></>}<div className="owner-pill">{ownerNumber(overview.data.totals.reportedBranches)} من {ownerNumber(overview.data.totals.branchCount)} فرع أرسل تقريراً</div></div>}
        {!overview.data.sectionErrors?.sales && <Coverage sales={overview.data} />}
        <div className="owner-section"><div className="owner-section-head"><h2>على مستوى العمل</h2><small>{fresh(overview.data.generatedAt)}</small></div><div className="owner-grid">
          {overview.data.sectionErrors?.sales ? null : <div className="owner-card owner-metric"><small>يوميات المبيعات</small><strong>{ownerNumber(overview.data.totals.journalCount)}</strong><em>من المصدر المسجل</em></div>}
          {overview.data.assets && !overview.data.sectionErrors?.assets ? <div className="owner-card owner-metric"><small>الأصول</small><strong>{ownerNumber(overview.data.assets.total)}</strong><em>{ownerNumber(overview.data.assets.needsAttention)} تحتاج اهتماماً</em></div> : <div><small>الأصول</small><SectionUnavailable retry={retry} /></div>}
          {overview.data.shareholders && !overview.data.sectionErrors?.shareholders ? <div className="owner-card owner-metric"><small>المساهمون</small><strong>{ownerNumber(overview.data.shareholders.count)}</strong><em>بيانات الأسهم الأساسية</em></div> : <div><small>المساهمون</small><SectionUnavailable retry={retry} /></div>}
          {overview.data.marketing && !overview.data.sectionErrors?.marketing ? <div className="owner-card owner-metric"><small>حملات نشطة</small><strong>{ownerNumber(overview.data.marketing.activeCampaigns)}</strong><em>على مستوى الشركة</em></div> : <div><small>الحملات النشطة</small><SectionUnavailable retry={retry} /></div>}
        </div></div>
        {!overview.data.sectionErrors?.sales && <div className="owner-section"><div className="owner-section-head"><h2>{dateTo === today() ? "الفروع اليوم" : "الفروع في التاريخ المحدد"}</h2><button disabled={exporting} className="owner-link" onClick={() => setTab("sales")}>تفاصيل المبيعات ←</button></div><SalesList sales={overview.data} /></div>}
        <p className="owner-sub" style={{ marginTop: 14 }}>المصدر: {overview.data.sourceLabel}. الفرع الذي لم يرسل تقريراً لا يُحتسب كمبيعات صفرية.</p>
      </> : null)}
      {tab === "sales" && (validDates ? sales.isLoading ? <Loading /> : sales.isError ? <ErrorState retry={retry} /> : sales.data ? <>
        <div className="owner-hero"><small>إجمالي المبيعات (شامل الضريبة) · {dateText(dateFrom)} — {dateText(dateTo)}</small>{sales.data.totals.reportedBranches === 0 ? <><h2>لم يصل تقرير للفترة</h2><LastReport date={sales.data.latestReportDate} onSelect={selectReportDate} /></> : <><h2>{ownerNumber(sales.data.totals.sales)} <span>ر.س</span></h2><p>{ownerComparison(sales.data)}</p></>}<div className="owner-pill">تغطية {ownerNumber(sales.data.totals.reportedBranches)} / {ownerNumber(sales.data.totals.branchCount)} فروع</div></div>
        <Coverage sales={sales.data} />
        <div className="owner-section"><div className="owner-section-head"><h2>تفصيل الفروع</h2><small>{fresh(sales.data.generatedAt)}</small></div><SalesList sales={sales.data} /><p className="owner-sub">{sales.data.sourceLabel} · غياب التقرير ليس صفراً.</p></div>
      </> : null : <Empty title="نطاق التاريخ غير صالح" hint="اختر تاريخ بداية يسبق تاريخ النهاية." />)}
       {tab === "assets" && <div className="owner-section"><div className="owner-section-head"><h2>سجل الأصول</h2><small>{fresh(assets.data?.generatedAt)}</small></div><input disabled={exporting} className="owner-search" aria-label="بحث في الأصول" placeholder="ابحث عن أصل..." value={search} onChange={e => setSearch(e.target.value)} />{assets.isLoading ? <Loading /> : assets.isError ? <ErrorState retry={retry} /> : !assets.data?.items.length ? <Empty title="لا توجد أصول مطابقة" hint="جرّب تغيير الفرع أو كلمة البحث." /> : <><div className="owner-list">{assets.data.items.map(item => <button type="button" className="owner-row owner-card owner-detail-row" aria-label={`تفاصيل الأصل ${item.name}`} onClick={() => setDetail({ kind: "asset", item })} key={item.id}><Thumbnail src={item.imageUrl} alt={item.name} /><div className="owner-row-main"><strong>{item.name}</strong><small>{item.branchName}{item.category ? ` · ${item.category}` : ""}</small>{item.maintenanceSummary && <small>صيانة: {item.maintenanceSummary}</small>}</div><span className="owner-status">{statusText(item.status)}</span></button>)}</div><Paging page={pages.assets || 1} total={assets.data.total} pageSize={assets.data.pageSize} setPage={setPage} /></>}</div>}
       {tab === "shareholders" && <div className="owner-section"><div className="owner-section-head"><h2>سجل المساهمين</h2><small>{fresh(shareholders.data?.generatedAt)}</small></div><input disabled={exporting} className="owner-search" aria-label="بحث في المساهمين" placeholder="ابحث بالاسم..." value={search} onChange={e => setSearch(e.target.value)} />{shareholders.isLoading ? <Loading /> : shareholders.isError ? <ErrorState retry={retry} /> : shareholders.data ? <><div className="owner-card" style={{ marginBottom: 12, background: "var(--soft)" }}><div className="owner-grid" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}><div className="owner-metric"><small>عدد المساهمين</small><strong>{ownerNumber(shareholders.data.summary.count)}</strong></div><div className="owner-metric"><small>إجمالي الأسهم المسجلة</small><strong>{ownerNumber(shareholders.data.summary.totalShares)}</strong></div></div><small style={{ color: "var(--muted)" }}>أساس النسبة: {shareholders.data.summary.ownershipBasis} · ليست قيمة رأس المال القانوني</small></div>{!shareholders.data.items.length ? <Empty title="لا توجد نتائج" hint="جرّب اسماً آخر." /> : <div className="owner-list">{shareholders.data.items.map(item => <button type="button" className="owner-card owner-row owner-detail-row" aria-label={`تفاصيل المساهم ${item.name}`} onClick={() => setDetail({ kind: "shareholder", item, basis: shareholders.data!.summary.ownershipBasis })} key={item.id}><div className="owner-row-main"><strong>{item.name}</strong><small>{ownerNumber(item.shares)} سهم</small></div><div className="owner-row-value">{item.ownershipPercent === null ? "غير متاح" : `${ownerNumber(item.ownershipPercent)}%`}</div></button>)}</div>}<Paging page={pages.shareholders || 1} total={shareholders.data.total} pageSize={shareholders.data.pageSize} setPage={setPage} /></> : null}</div>}
       {tab === "marketing" && <div className="owner-section"><div className="owner-tabs" role="group" aria-label="أقسام التسويق">{marketingSections.map(s => <button key={s.id} disabled={exporting} aria-pressed={section === s.id} className="owner-tab" data-active={section === s.id} onClick={() => setSection(s.id)}>{s.label}</button>)}</div><div className="owner-section-head"><h2>{marketingSections.find(s => s.id === section)?.label}</h2><small>{marketing.data?.scopeLabel || "على مستوى الشركة"} · {fresh(marketing.data?.generatedAt)}</small></div><input disabled={exporting} className="owner-search" aria-label="بحث في التسويق" placeholder="ابحث في القسم..." value={search} onChange={e => setSearch(e.target.value)} />{marketing.isLoading ? <Loading /> : marketing.isError ? <ErrorState retry={retry} /> : !marketing.data?.items.length ? <Empty title="لا توجد عناصر مطابقة" hint="جرّب تغيير القسم أو كلمة البحث." /> : <><div className="owner-list">{marketing.data.items.map(item => <button className="owner-row owner-card owner-detail-row" key={item.id} onClick={() => setDetail({ kind: "marketing", item })}>{item.imageUrl && <Thumbnail src={item.imageUrl} alt="" />}<div className="owner-row-main"><strong>{item.title}</strong><small>{item.date ? dateText(item.date) : "بلا تاريخ"}{item.summary ? ` · ${item.summary}` : ""}</small></div><span className="owner-status">{statusText(item.status)}</span></button>)}</div><Paging page={pages[section] || 1} total={marketing.data.total} pageSize={marketing.data.pageSize} setPage={setPage} /></>}</div>}
      <div className="owner-section owner-actions"><button className="owner-action" disabled={exporting || activeQuery.isLoading || !currentData || (tab === "sales" && !validDates)} onClick={onExport}><Download size={15} style={{ display: "inline", marginLeft: 7 }} />{exporting ? "جارٍ تجهيز الملف..." : "تصدير PDF"}</button><small style={{ color: "var(--muted)" }}>ملخص عام + {tab === "home" ? "الرئيسية" : tab === "sales" ? "الفروع" : "الصفحة المعروضة فقط"}</small></div>
      {exportError && <p role="alert" className="owner-sub" style={{ color: "#9e3d41" }}>{exportError}</p>}
    </div>
     <nav className="owner-bottom" aria-label="تنقل بوابة المالك">{tabList.map(item => <button key={item.id} disabled={exporting} className="owner-nav" aria-current={tab === item.id ? "page" : undefined} data-active={tab === item.id} onClick={() => setTab(item.id)}><item.icon aria-hidden="true" />{item.label}</button>)}</nav>
     {detail && !revoked && <dialog ref={dialogRef} className="owner-dialog" aria-label={detail.kind === "asset" ? detail.item.name : detail.kind === "shareholder" ? detail.item.name : detail.item.title} onClose={() => setDetail(null)} onClick={e => { if (e.target === dialogRef.current) setDetail(null); }}><div className="owner-section-head"><h2>{detail.kind === "marketing" ? detail.item.title : detail.item.name}</h2><button className="owner-icon" autoFocus onClick={() => setDetail(null)} aria-label="إغلاق"><X size={18} /></button></div>
      {detail.kind === "asset" ? <><Thumbnail src={detail.item.imageUrl} alt={detail.item.name} /><p><strong>الفرع:</strong> {detail.item.branchName}</p><p><strong>الحالة:</strong> {statusText(detail.item.status)}</p><p><strong>التصنيف:</strong> {detail.item.category || "غير محدد"}</p><p><strong>الصيانة:</strong> {detail.item.maintenanceSummary || "لا توجد ملاحظة صيانة مسجلة"}</p></> :
        detail.kind === "shareholder" ? <><p><strong>الأسهم المسجلة:</strong> {ownerNumber(detail.item.shares)} سهم</p><p><strong>نسبة الملكية:</strong> {detail.item.ownershipPercent === null ? "غير متاحة" : `${ownerNumber(detail.item.ownershipPercent)}%`}</p><p><strong>أساس النسبة:</strong> {detail.basis}؛ لا تمثل قيمة رأس المال القانوني.</p></> :
        <><span className="owner-status">{statusText(detail.item.status)}</span><p>{detail.item.date ? dateText(detail.item.date) : "بلا تاريخ"}</p><p>{detail.item.summary || "لا توجد تفاصيل إضافية متاحة للعرض."}</p></>}
       <button className="owner-action" onClick={() => setDetail(null)}>إغلاق</button></dialog>}
  </div>;
}