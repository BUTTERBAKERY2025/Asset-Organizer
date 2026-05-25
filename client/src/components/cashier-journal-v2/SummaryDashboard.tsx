import { PieChart, Scale, AlertCircle, Clock, Check, ArrowDown, ArrowUp } from "lucide-react";
import { CHANNEL_COLORS, TOLERANCE_SAR, fmt } from "./constants";

export interface ChannelStatus {
  amount: number;
  status: "matched" | "diff" | "context" | "empty";
  diffLabel?: string;
  contextLabel?: string;
}

export interface DifferenceItem {
  key: string;
  source: string;
  descriptor: string;
  posLabel: string;
  posValue: number;
  actualLabel: string;
  actualValue: number | null;
  diff: number | null;
  status: "matched" | "pending" | "justified" | "unjustified";
  onAction?: () => void;
}

interface SummaryDashboardProps {
  branchName: string;
  shiftLabel: string;
  dateLabel: string;
  cashierName: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "posted";
  totalSales: number;
  invoiceCount: number;
  avgInvoice: number;
  collectedTotal: number;
  channelsUsed: number;
  openingBalance: number;
  netDifference: number;
  channels: {
    cash: ChannelStatus;
    cards: ChannelStatus;
    delivery: ChannelStatus;
    credit: ChannelStatus;
  };
  differences: DifferenceItem[];
}

const STATUS_LABELS: Record<SummaryDashboardProps["status"], string> = {
  draft: "مسودة",
  submitted: "قيد المراجعة",
  approved: "معتمدة",
  rejected: "مرفوضة",
  posted: "مرحّلة",
};

export function SummaryDashboard(props: SummaryDashboardProps) {
  const isShortage = props.netDifference < 0;
  const shortagePct = props.totalSales > 0 ? Math.abs(props.netDifference / props.totalSales) * 100 : 0;
  const channelTotal =
    props.channels.cash.amount + props.channels.cards.amount + props.channels.delivery.amount + props.channels.credit.amount;
  const pct = (v: number) => (channelTotal > 0 ? (v / channelTotal) * 100 : 0);

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-[#26215C] p-5 text-white" data-testid="hero-summary">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-xs text-white/70">ملخص اليومية</div>
            <h2 className="text-lg font-medium">
              {props.branchName} — {props.shiftLabel}
            </h2>
            <div className="text-xs text-white/70">
              {props.dateLabel} · الكاشير {props.cashierName}
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs">
            <Clock className="h-3 w-3" />
            {STATUS_LABELS[props.status]}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <HeroCard label="إجمالي المبيعات" value={fmt(props.totalSales)} valueClass="text-2xl" context={`${props.invoiceCount} فاتورة · متوسط ${fmt(props.avgInvoice)}`} />
          <HeroCard label="إجمالي المحصل" value={fmt(props.collectedTotal)} context={`من ${props.channelsUsed} قنوات`} />
          <HeroCard label="العهدة" value={fmt(props.openingBalance)} context="رصيد ابتدائي" />
          <HeroCard
            label="صافي العجز"
            value={`${isShortage ? "↓" : "↑"} ${fmt(Math.abs(props.netDifference))}`}
            context={`${shortagePct.toFixed(2)}% من المبيعات`}
            override={isShortage ? "bg-[#791F1F]" : Math.abs(props.netDifference) < 0.01 ? "bg-[#173404]" : "bg-[#633806]"}
            icon={isShortage ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
          />
        </div>
      </div>

      <div className="rounded-xl border border-black/[0.08] bg-white p-4" data-testid="channel-breakdown">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-[#534AB7]" />
            <span className="text-sm font-medium">تفصيل المبيعات حسب القناة</span>
          </div>
          <span className="text-xs text-gray-500">100% من المبيعات</span>
        </div>

        <div className="mb-3 flex h-7 overflow-hidden rounded-lg">
          <Segment color={CHANNEL_COLORS.credit} pct={pct(props.channels.credit.amount)} />
          <Segment color={CHANNEL_COLORS.delivery} pct={pct(props.channels.delivery.amount)} />
          <Segment color={CHANNEL_COLORS.cards} pct={pct(props.channels.cards.amount)} />
          <Segment color={CHANNEL_COLORS.cash} pct={pct(props.channels.cash.amount)} />
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <ChannelRow color={CHANNEL_COLORS.cash} name="نقدي" channel={props.channels.cash} />
          <ChannelRow color={CHANNEL_COLORS.cards} name="بطاقات" channel={props.channels.cards} />
          <ChannelRow color={CHANNEL_COLORS.delivery} name="تطبيقات التوصيل" channel={props.channels.delivery} />
          <ChannelRow color={CHANNEL_COLORS.credit} name="آجل / ذمم" channel={props.channels.credit} />
        </div>
      </div>

      <div className="rounded-xl border border-black/[0.08] bg-white p-4" data-testid="reconciliation-equation">
        <div className="mb-3 flex items-center gap-2">
          <Scale className="h-4 w-4 text-[#534AB7]" />
          <span className="text-sm font-medium">معادلة المطابقة</span>
        </div>

        <div className="grid grid-cols-[1fr_24px_1fr_24px_1fr] items-stretch gap-2 rounded-lg bg-[#F1EFE8] p-3">
          <EqCell label="المبيعات" value={fmt(props.totalSales)} />
          <EqOp op="−" />
          <EqCell label="المحصل" value={fmt(props.collectedTotal)} />
          <EqOp op="=" />
          <EqCell
            label={isShortage ? "العجز" : Math.abs(props.netDifference) < 0.01 ? "متطابق" : "الفائض"}
            value={`${isShortage ? "−" : ""}${fmt(Math.abs(props.netDifference))}`}
            bgClass={isShortage ? "bg-[#FCEBEB] text-[#791F1F]" : "bg-[#EAF3DE] text-[#173404]"}
          />
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-gray-500">الحد المسموح: ±{TOLERANCE_SAR} ر.س</span>
            <span className={`flex items-center gap-1 ${Math.abs(props.netDifference) > TOLERANCE_SAR ? "text-[#791F1F]" : "text-[#633806]"}`}>
              <AlertCircle className="h-3 w-3" />
              {Math.abs(props.netDifference) > TOLERANCE_SAR ? "خارج الحد" : "ضمن الحد"}
            </span>
          </div>
          <ToleranceBar diff={props.netDifference} />
        </div>
      </div>

      <div className="rounded-xl border border-black/[0.08] bg-white p-4" data-testid="differences-analysis">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#BA7517]" />
            <span className="text-sm font-medium">تحليل الفروقات</span>
          </div>
          <span className="text-xs text-gray-500">{props.differences.length} فروقات مرصودة</span>
        </div>
        <div className="space-y-2">
          {props.differences.length === 0 && (
            <div className="rounded-lg bg-[#EAF3DE] p-3 text-xs text-[#173404]">
              لا توجد فروقات — كل القنوات متطابقة.
            </div>
          )}
          {props.differences.map((d) => (
            <DiffRow key={d.key} item={d} />
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroCard({
  label,
  value,
  context,
  valueClass = "text-lg",
  override,
  icon,
}: {
  label: string;
  value: string;
  context?: string;
  valueClass?: string;
  override?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg p-3 ${override ?? "bg-white/10"}`}>
      <div className="text-[11px] text-white/70">{label}</div>
      <div className={`flex items-center gap-1 font-medium ${valueClass}`}>
        {icon}
        {value}
      </div>
      {context && <div className="text-[10px] text-white/60">{context}</div>}
    </div>
  );
}

function Segment({ color, pct }: { color: string; pct: number }) {
  if (pct < 0.5) return null;
  return (
    <div className="flex items-center justify-center text-[10px] font-medium text-white" style={{ background: color, width: `${pct}%` }}>
      {Math.round(pct)}%
    </div>
  );
}

function ChannelRow({
  color,
  name,
  channel,
}: {
  color: string;
  name: string;
  channel: ChannelStatus;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[#F1EFE8] px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
        <span className="text-gray-900">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-900">{fmt(channel.amount)}</span>
        {channel.status === "matched" && (
          <span className="flex items-center gap-0.5 rounded-full bg-[#EAF3DE] px-1.5 py-0.5 text-[10px] text-[#173404]">
            <Check className="h-2.5 w-2.5" />
          </span>
        )}
        {channel.status === "diff" && channel.diffLabel && (
          <span className="rounded-full bg-[#FAEEDA] px-1.5 py-0.5 text-[10px] text-[#633806]">⚠ {channel.diffLabel}</span>
        )}
        {channel.status === "context" && channel.contextLabel && (
          <span className="text-[10px] text-gray-500">{channel.contextLabel}</span>
        )}
        {channel.status === "empty" && (
          <span className="text-[10px] text-gray-400">—</span>
        )}
      </div>
    </div>
  );
}

function EqCell({ label, value, bgClass }: { label: string; value: string; bgClass?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg px-2 py-3 ${bgClass ?? "bg-white"}`}>
      <span className="text-[10px] opacity-70">{label}</span>
      <span className="text-lg font-medium">{value}</span>
    </div>
  );
}

function EqOp({ op }: { op: string }) {
  return <div className="flex items-center justify-center text-xl text-gray-400">{op}</div>;
}

function ToleranceBar({ diff }: { diff: number }) {
  const pct = Math.min(Math.abs(diff) / (TOLERANCE_SAR * 2), 1) * 50;
  const left = diff < 0 ? 50 - pct : 50;
  const exceeded = Math.abs(diff) > TOLERANCE_SAR;
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200">
      <div className="absolute left-1/2 top-1/2 h-3 w-px -translate-y-1/2 bg-gray-400" />
      <div
        className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full ${exceeded ? "bg-[#791F1F]" : "bg-[#BA7517]"}`}
        style={{ left: `${left + (diff >= 0 ? pct : 0)}%`, transform: "translate(-50%, -50%)" }}
      />
    </div>
  );
}

function DiffRow({ item }: { item: DifferenceItem }) {
  const isPending = item.status === "pending";
  const bgClass = isPending ? "bg-[#FAEEDA] text-[#412402]" : "bg-[#F1EFE8] text-gray-900";

  return (
    <div className={`grid grid-cols-[1.5fr_1fr_1fr_0.8fr] items-center gap-2 rounded-lg p-2.5 text-xs ${bgClass}`} data-testid={`diff-row-${item.key}`}>
      <div>
        <div className="font-medium">{item.source}</div>
        <div className="text-[10px] opacity-70">{item.descriptor}</div>
      </div>
      <div className="text-[10px]">
        <div>{item.posLabel}</div>
        <div>{item.actualLabel}</div>
      </div>
      <div>
        {item.diff === null ? (
          <span className="text-gray-500">في الانتظار</span>
        ) : Math.abs(item.diff) < 0.01 ? (
          <span className="rounded-full bg-[#EAF3DE] px-2 py-0.5 text-[#173404]">✓ 0.00</span>
        ) : item.diff < 0 ? (
          <span className="rounded-full bg-[#FCEBEB] px-2 py-0.5 text-[#791F1F]">↓ {item.diff.toFixed(2)}</span>
        ) : (
          <span className="rounded-full bg-[#FAEEDA] px-2 py-0.5 text-[#633806]">↑ +{item.diff.toFixed(2)}</span>
        )}
      </div>
      <button
        type="button"
        onClick={item.onAction}
        data-testid={`button-diff-action-${item.key}`}
        className="rounded-lg border border-current/30 bg-white/50 px-2 py-1 text-[11px] hover:bg-white"
      >
        {item.status === "pending" ? "إكمال" : item.status === "justified" ? "✓ مبرر" : "إضافة سبب"}
      </button>
    </div>
  );
}
