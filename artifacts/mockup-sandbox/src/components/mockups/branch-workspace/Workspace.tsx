import { useMemo, useState } from "react";
import {
  AlertTriangle, ChevronDown, ChevronLeft, ExternalLink, FileWarning, MoreHorizontal,
  RefreshCw, Store, X,
} from "lucide-react";
import { formatServerDate, groupCards, partitionActions, type OperationCard, type SectionId } from "./_shared/presentation";
import { sampleBoard, sampleBranch } from "./_shared/fixtures";
import "./_group.css";
import "./_workspace.css";

type Destination = { title: string; detail: string } | null;

const tabCopy: Record<SectionId, string> = {
  orders: "ما يصل إلى الفرع وما يحتاج متابعة توريد.",
  sales: "سير الوردية، اليوميات، والإغلاق.",
  operations: "المشكلات اليومية وسلامة موقع العمل.",
  people: "الفريق والوثائق والمتابعات الإدارية.",
};

function moduleSummary(card: OperationCard) {
  if (card.state === "error") return "تعذر جلب الحالة";
  if (card.statusLabel) return card.statusLabel;
  if (card.metrics[0]) return `${card.metrics[0].value.toLocaleString("en-US")} · ${card.metrics[0].label}`;
  return "لا توجد بيانات معروضة";
}

/** Refined static branch workspace. Destinations deliberately preview only; no app actions are mutated. */
export function Workspace() {
  // Local design fixture only: keeps the extracted facts while making permitted menu behavior reviewable.
  const board = useMemo(() => ({
    ...sampleBoard,
    businessDate: "2026-09-25",
    generatedAt: "2026-09-25T07:30:00.000Z",
    cards: sampleBoard.cards.map((card) => {
      const demo = {
        kitchen: { metrics: [{ label: "طلبات مطبخ مفتوحة", value: 0 }], quickActions: [{ label: "إنشاء طلب", href: card.href, kind: "create" as const }] },
        warehouse: { metrics: [{ label: "تحويلات مفتوحة", value: 0 }], quickActions: [{ label: "إنشاء طلب تحويل", href: card.href, kind: "create" as const }] },
        cashier: { metrics: [{ label: "يوميات بانتظار المراجعة", value: 0 }], quickActions: [{ label: "إنشاء يومية", href: card.href, kind: "create" as const }] },
        complaints: { metrics: [{ label: "شكاوى مفتوحة", value: 0 }], quickActions: [{ label: "تسجيل شكوى", href: card.href, kind: "create" as const }] },
      }[card.id];
      if (demo) return { ...card, state: "ready" as const, ...demo };
      if (["employees", "advances"].includes(card.id)) return { ...card, state: "ready" as const, statusLabel: "البيانات التفصيلية في صفحة الوحدة" };
      return card;
    }),
  }), []);
  const groups = useMemo(() => groupCards(board.cards), [board.cards]);
  const [active, setActive] = useState<SectionId>("sales");
  const [destination, setDestination] = useState<Destination>(null);
  const [actionMenu, setActionMenu] = useState(false);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const activeGroup = groups.find((group) => group.section.id === active) ?? groups[0];
  const errors = board.cards.filter((card) => card.state === "error");
  const urgent = partitionActions(board.cards).now;
  const routine = partitionActions(board.cards).routine;
  const quickActions = board.cards.filter((card) => card.state === "ready").flatMap((card) => (card.quickActions ?? [])
    .filter((action) => action.kind === "create").map((action) => ({ ...action, card })));
  const updateTime = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit" }).format(new Date(board.generatedAt));
  const open = (title: string, detail: string) => setDestination({ title, detail });
  const refresh = () => {
    setRefreshed(true);
    window.setTimeout(() => setRefreshed(false), 1600);
  };

  return (
    <div className="branch-workspace-scope workspace" dir="rtl" data-testid="branch-workspace">
      <main className="workspace-shell">
        <header className="workspace-header">
          <div className="workspace-brand">
            <div className="workspace-mark"><Store size={19} /></div>
            <div>
              <p className="workspace-eyebrow">BUTTER BAKERY · عمليات الفروع</p>
              <h1>مساحة عمل الفرع</h1>
            </div>
          </div>
          <div className="workspace-header-actions">
            <button className="branch-picker" type="button" onClick={() => open("اختيار الفرع", `الفرع المعروض: ${sampleBranch.name}. هذه معاينة لفرع واحد.`)}>
              <span>الفرع</span><strong>{sampleBranch.name}</strong><ChevronDown size={15} />
            </button>
            <button className="icon-action" type="button" onClick={refresh} aria-label="تحديث المعاينة">
              <RefreshCw size={17} className={refreshed ? "is-spinning" : ""} />
            </button>
            <span className="workspace-sample">نموذج تصميم / بيانات توضيحية</span>
          </div>
        </header>

        <section className="workspace-context" aria-label="سياق يوم العمل">
          <div>
            <p className="workspace-date">يوم العمل</p>
            <strong>{formatServerDate(board.businessDate)}</strong>
          </div>
          <div className="context-divider" />
          <div>
            <p className="workspace-date">آخر تحديث توضيحي</p>
            <strong>{updateTime} <span>بتوقيت السعودية</span></strong>
          </div>
          <p className="refresh-feedback" aria-live="polite">{refreshed ? "تم تحديث المعاينة الآن" : "المعلومات أدناه بحسب المصادر المتاحة"}</p>
        </section>

        <section className="workspace-focus">
          <div className="focus-copy">
            <span className="section-kicker">ابدأ من هنا</span>
            <h2>{urgent.length === 1 ? "هناك موضوع واحد يحتاج متابعة" : `هناك ${urgent.length.toLocaleString("en-US")} موضوعات تحتاج متابعة`}</h2>
            <p>رتّبنا الأولويات بحسب المصدر؛ العدد يصف السجلات داخل الموضوع، وليس عدد المهام.</p>
          </div>
          <div className="focus-actions">
            {urgent.slice(0, 2).map((item) => (
              <button key={`${item.cardId}-${item.index}`} className="focus-item" type="button" onClick={() => open(item.cardTitle, `${item.label}: ${item.count.toLocaleString("en-US")} سجل. ${item.description ?? ""}`)}>
                <span className="focus-source">{item.cardTitle}</span>
                <strong>{item.label} <b>{item.count.toLocaleString("en-US")}</b></strong>
                <ChevronLeft size={17} />
              </button>
            ))}
            {urgent.length > 2 && <button className="focus-more" type="button" onClick={() => open("كل الموضوعات العاجلة", urgent.map((item) => `${item.cardTitle}: ${item.label} (${item.count.toLocaleString("en-US")})`).join(" · "))}>عرض {urgent.length - 2} موضوعات أخرى</button>}
          </div>
        </section>

        <section className="workspace-warning" aria-label="تنبيه اكتمال البيانات">
          <div className="warning-intro">
            <FileWarning size={19} />
            <p><strong>بعض المصادر غير جاهزة للتحقق.</strong> لا يعني عدم ظهورها أنها بلا عمل؛ تظهر الحالة المتاحة فقط.</p>
          </div>
          <button type="button" className="details-link" onClick={() => setErrorsOpen((value) => !value)} aria-expanded={errorsOpen}>
            {errorsOpen ? "إخفاء التفاصيل" : `عرض المصادر (${errors.length})`} <ChevronDown size={15} className={errorsOpen ? "up" : ""} />
          </button>
          {errorsOpen && <div className="error-list">
            {errors.map((card) => <button type="button" key={card.id} onClick={() => open(card.title, "تعذر تحديث مؤشرات هذه الوحدة في نموذج البيانات. لا توجد أرقام بديلة معروضة.")}>{card.title}<span>غير متاح</span></button>)}
          </div>}
        </section>

        <div className="workspace-workbar">
          <div className="workspace-tabs" role="tablist" aria-label="مجالات العمل">
            {groups.map(({ section, cards }) => <button key={section.id} type="button" role="tab" aria-selected={active === section.id} className={active === section.id ? "active" : ""} onClick={() => setActive(section.id)}>
              {section.label}<span>{cards.length}</span>
            </button>)}
          </div>
          <div className="new-action-wrap">
            <button className="new-action" type="button" onClick={() => setActionMenu((value) => !value)} aria-expanded={actionMenu}>
              <MoreHorizontal size={18} /> إجراء جديد
            </button>
            {actionMenu && <div className="action-menu">
              {quickActions.length ? quickActions.map(({ card, label, href }) => <button key={href} type="button" onClick={() => { setActionMenu(false); open(label, `وجهة توضيحية: ${card.title}`); }}>{label} · {card.title}</button>) : <p>لا توجد صلاحية إنشاء أو استلام معلنة لهذا الفرع.</p>}
            </div>}
          </div>
        </div>

        <section className="module-area" role="tabpanel">
          <div className="module-area-head">
            <div><span className="section-kicker">{activeGroup.section.label}</span><h2>{tabCopy[activeGroup.section.id]}</h2></div>
            <div className="module-head-meta"><p>{activeGroup.cards.length} وحدات متاحة للعرض</p>{routine.length > 0 && <button type="button" onClick={() => open("متابعات روتينية", routine.map((item) => `${item.cardTitle}: ${item.label} (${item.count.toLocaleString("en-US")})`).join(" · "))}>متابعات روتينية ({routine.length})</button>}</div>
          </div>
          <div className="module-list">
            {activeGroup.cards.map((card) => (
              <article className={`module-row ${card.state === "error" ? "unavailable" : ""}`} key={card.id}>
                <button className="module-main" type="button" onClick={() => open(card.title, card.description ?? `${moduleSummary(card)}. هذه وجهة معاينة فقط ولا يتم فتح التطبيق.`)}>
                  <span className="module-status" aria-hidden="true" />
                  <span className="module-title"><strong>{card.title}</strong><small>{moduleSummary(card)}</small></span>
                  {card.state === "error" ? <small className="error-tag"><AlertTriangle size={13} /> غير متاح</small> : <ChevronLeft size={18} />}
                </button>
                {card.state === "ready" && (card.metrics.length > 0 || card.description) && <button className="module-detail" type="button" onClick={() => open(`${card.title} · تفاصيل`, card.description ?? card.metrics.map((m) => `${m.label}: ${m.value.toLocaleString("en-US")}${m.unit ? ` ${m.unit}` : ""}`).join(" — "))}>تفاصيل</button>}
              </article>
            ))}
          </div>
        </section>

        {destination && <div className="preview-layer" role="dialog" aria-modal="true" aria-labelledby="preview-title">
          <div className="preview-card">
            <button type="button" className="close-preview" onClick={() => setDestination(null)} aria-label="إغلاق"><X size={19} /></button>
            <span className="section-kicker">معاينة وجهة</span>
            <h2 id="preview-title">{destination.title}</h2>
            <p>{destination.detail}</p>
            <div className="preview-note"><ExternalLink size={15} /> لا توجد أي عملية فعلية في نموذج التصميم.</div>
            <button className="preview-close-button" type="button" onClick={() => setDestination(null)}>فهمت</button>
          </div>
        </div>}
      </main>
    </div>
  );
}