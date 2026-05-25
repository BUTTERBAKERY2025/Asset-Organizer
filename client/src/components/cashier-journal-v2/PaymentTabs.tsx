import { CreditCard, Coins, Truck, Clock, Check, X, AlertTriangle } from "lucide-react";
import { useState } from "react";
import type { PaymentMethod } from "@shared/schema";
import {
  CARD_NETWORKS,
  QUICK_CARDS,
  DELIVERY_COMPANIES,
  QUICK_DELIVERY,
  fmt,
} from "./constants";

export type PaymentTab = "cash" | "cards" | "delivery" | "credit";

export interface CardRow {
  method: PaymentMethod;
  label: string;
  pos: number;
  actual: number;
}

export interface DeliveryRow {
  method: PaymentMethod;
  label: string;
  latin?: string;
  orders: number;
  amount: number;
  commissionPct: number;
}

export interface CreditRow {
  customer: string;
  amount: number;
  dueDate?: string;
  notes?: string;
}

interface PaymentTabsProps {
  cashPos: number;
  cashActual: number;
  onCashPosChange: (n: number) => void;
  onCashActualChange: (n: number) => void;

  cardRows: CardRow[];
  onCardRowsChange: (rows: CardRow[]) => void;

  deliveryRows: DeliveryRow[];
  onDeliveryRowsChange: (rows: DeliveryRow[]) => void;

  creditRows: CreditRow[];
  onCreditRowsChange: (rows: CreditRow[]) => void;

  disabled?: boolean;
}

export function PaymentTabs(props: PaymentTabsProps) {
  const [tab, setTab] = useState<PaymentTab>("cash");

  const cashDone = props.cashPos > 0 || props.cashActual > 0;
  const cardsCount = props.cardRows.filter((r) => r.pos > 0 || r.actual > 0).length;
  const deliveryCount = props.deliveryRows.filter((r) => r.orders > 0 || r.amount > 0).length;
  const creditCount = props.creditRows.length;

  const subtotal =
    props.cashActual +
    props.cardRows.reduce((s, r) => s + r.actual, 0) +
    props.deliveryRows.reduce((s, r) => s + r.amount * (1 - r.commissionPct / 100), 0) +
    props.creditRows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="rounded-xl border border-black/[0.08] bg-white p-4" data-testid="card-payments">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-[#534AB7]" />
          <span className="text-sm font-medium text-gray-900">طرق الدفع</span>
        </div>
        <span className="text-xs text-gray-500" data-testid="text-payments-subtotal">
          المجموع: {fmt(subtotal)}
        </span>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200">
        <TabButton
          active={tab === "cash"}
          onClick={() => setTab("cash")}
          icon={<Coins className="h-3.5 w-3.5" />}
          label="نقدي"
          badge={cashDone ? <DoneBadge /> : null}
          testId="tab-cash"
        />
        <TabButton
          active={tab === "cards"}
          onClick={() => setTab("cards")}
          icon={<CreditCard className="h-3.5 w-3.5" />}
          label="البطاقات"
          badge={cardsCount > 0 ? <CountBadge n={cardsCount} /> : null}
          testId="tab-cards"
        />
        <TabButton
          active={tab === "delivery"}
          onClick={() => setTab("delivery")}
          icon={<Truck className="h-3.5 w-3.5" />}
          label="التوصيل"
          badge={deliveryCount > 0 ? <CountBadge n={deliveryCount} /> : null}
          testId="tab-delivery"
        />
        <TabButton
          active={tab === "credit"}
          onClick={() => setTab("credit")}
          icon={<Clock className="h-3.5 w-3.5" />}
          label="آجل"
          badge={creditCount > 0 ? <CountBadge n={creditCount} /> : null}
          testId="tab-credit"
        />
      </div>

      {tab === "cash" && (
        <CashTab
          pos={props.cashPos}
          actual={props.cashActual}
          onPosChange={props.onCashPosChange}
          onActualChange={props.onCashActualChange}
          disabled={props.disabled}
        />
      )}

      {tab === "cards" && (
        <CardsTab
          rows={props.cardRows}
          onChange={props.onCardRowsChange}
          disabled={props.disabled}
        />
      )}

      {tab === "delivery" && (
        <DeliveryTab
          rows={props.deliveryRows}
          onChange={props.onDeliveryRowsChange}
          disabled={props.disabled}
        />
      )}

      {tab === "credit" && (
        <CreditTab
          rows={props.creditRows}
          onChange={props.onCreditRowsChange}
          disabled={props.disabled}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge: React.ReactNode;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-xs transition-colors ${
        active
          ? "border-[#534AB7] font-medium text-[#534AB7]"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge}
    </button>
  );
}

function DoneBadge() {
  return (
    <span className="flex items-center gap-0.5 rounded-full bg-[#EAF3DE] px-1.5 py-0.5 text-[10px] text-[#173404]">
      <Check className="h-2.5 w-2.5" />
    </span>
  );
}

function CountBadge({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-[#EEEDFE] px-1.5 py-0.5 text-[10px] text-[#534AB7]">
      {n}
    </span>
  );
}

function NumInput({
  value,
  onChange,
  disabled,
  placeholder = "0.00",
  testId,
  highlight,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  placeholder?: string;
  testId?: string;
  highlight?: boolean;
  ariaLabel?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="0.01"
      min="0"
      value={value || ""}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      disabled={disabled}
      placeholder={placeholder}
      data-testid={testId}
      aria-label={ariaLabel}
      className={`w-full rounded-lg border bg-white px-2 py-1.5 text-center text-sm text-gray-900 focus:outline-none ${
        highlight ? "border-[#BA7517] focus:border-[#BA7517]" : "border-black/[0.08] focus:border-[#534AB7]"
      } disabled:bg-gray-50`}
    />
  );
}

function DiffPill({ diff }: { diff: number | null }) {
  if (diff === null) {
    return <span className="text-xs text-gray-400" data-testid="pill-diff-pending">في الانتظار</span>;
  }
  if (Math.abs(diff) < 0.01) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-[#EAF3DE] px-2 py-0.5 text-xs text-[#173404]">
        <Check className="h-3 w-3" /> 0.00
      </span>
    );
  }
  if (Math.abs(diff) <= 5) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FAEEDA] px-2 py-0.5 text-xs text-[#633806]">
        <AlertTriangle className="h-3 w-3" /> {diff > 0 ? "+" : ""}
        {diff.toFixed(2)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FCEBEB] px-2 py-0.5 text-xs text-[#791F1F]">
      <AlertTriangle className="h-3 w-3" /> {diff > 0 ? "+" : ""}
      {diff.toFixed(2)}
    </span>
  );
}

function CashTab({
  pos,
  actual,
  onPosChange,
  onActualChange,
  disabled,
}: {
  pos: number;
  actual: number;
  onPosChange: (n: number) => void;
  onActualChange: (n: number) => void;
  disabled?: boolean;
}) {
  const diff = actual - pos;
  const bg = Math.abs(diff) < 0.01 ? "bg-[#EAF3DE] text-[#173404]" : diff < 0 ? "bg-[#FCEBEB] text-[#791F1F]" : "bg-[#FAEEDA] text-[#633806]";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-gray-500">النقد المسجل (POS)</span>
          <NumInput value={pos} onChange={onPosChange} disabled={disabled} testId="input-cash-pos" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-gray-500">الفعلي في الصندوق</span>
          <NumInput value={actual} onChange={onActualChange} disabled={disabled} testId="input-cash-actual" />
        </label>
      </div>
      <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${bg}`} data-testid="status-cash-diff">
        <span>الفرق النقدي</span>
        <span className="flex items-center gap-1 font-medium">
          {diff >= 0 ? "+" : ""}
          {diff.toFixed(2)} SAR
          {Math.abs(diff) < 0.01 ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
        </span>
      </div>
    </div>
  );
}

function CardsTab({
  rows,
  onChange,
  disabled,
}: {
  rows: CardRow[];
  onChange: (rows: CardRow[]) => void;
  disabled?: boolean;
}) {
  const updateRow = (idx: number, patch: Partial<CardRow>) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const removeRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const addQuick = (method: PaymentMethod, label: string) => {
    if (rows.some((r) => r.method === method)) return;
    onChange([...rows, { method, label, pos: 0, actual: 0 }]);
  };

  const totalPos = rows.reduce((s, r) => s + r.pos, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const totalDiff = totalActual - totalPos;

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[1.2fr_1fr_1fr_0.8fr_32px] gap-2 px-2 text-[11px] text-gray-500 md:grid">
        <span>الشبكة</span>
        <span className="text-center">المسجل (POS)</span>
        <span className="text-center">الفعلي (التقرير)</span>
        <span className="text-center">الفرق</span>
        <span />
      </div>

      {rows.map((row, idx) => {
        const network = CARD_NETWORKS.find((n) => n.method === row.method);
        const diff = row.actual > 0 || row.pos > 0 ? row.actual - row.pos : null;
        const highlight = diff !== null && Math.abs(diff) > 0.01;
        return (
          <div
            key={`${row.method}-${idx}`}
            className="grid grid-cols-2 items-center gap-2 rounded-lg bg-[#F1EFE8] p-2.5 md:grid-cols-[1.2fr_1fr_1fr_0.8fr_32px]"
            data-testid={`row-card-${row.method}`}
          >
            <div className="col-span-2 flex items-center justify-between gap-2 md:col-span-1 md:justify-start">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-6 w-9 items-center justify-center rounded text-[10px] font-medium"
                  style={{ background: network?.bg ?? "#666", color: network?.text ?? "#fff" }}
                >
                  {network?.abbr ?? row.label}
                </span>
                <span className="text-sm text-gray-900">{row.label}</span>
              </div>
              <button
                type="button"
                onClick={() => removeRow(idx)}
                disabled={disabled}
                data-testid={`button-remove-card-${row.method}`}
                className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-white hover:text-gray-700 md:hidden"
                aria-label="حذف"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-gray-500 md:hidden">المسجل (POS)</span>
              <NumInput value={row.pos} onChange={(v) => updateRow(idx, { pos: v })} disabled={disabled} testId={`input-card-pos-${row.method}`} ariaLabel={`المسجل ${row.label}`} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-gray-500 md:hidden">الفعلي (التقرير)</span>
              <NumInput value={row.actual} onChange={(v) => updateRow(idx, { actual: v })} disabled={disabled} testId={`input-card-actual-${row.method}`} highlight={highlight} ariaLabel={`الفعلي ${row.label}`} />
            </label>
            <div className="col-span-2 flex items-center justify-between md:col-span-1 md:justify-center">
              <span className="text-[10px] text-gray-500 md:hidden">الفرق</span>
              <DiffPill diff={diff} />
            </div>
            <button
              type="button"
              onClick={() => removeRow(idx)}
              disabled={disabled}
              data-testid={`button-remove-card-desktop-${row.method}`}
              className="hidden h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-white hover:text-gray-700 md:flex"
              aria-label="حذف"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs text-gray-500">إضافة سريعة:</span>
        {QUICK_CARDS.map((q) => (
          <button
            key={q.method}
            type="button"
            onClick={() => addQuick(q.method, q.label)}
            disabled={disabled || rows.some((r) => r.method === q.method)}
            data-testid={`button-quick-card-${q.method}`}
            className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            + {q.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg bg-[#EEEDFE] p-3 text-xs sm:gap-3">
        <div>
          <div className="text-gray-500">مجموع المسجل</div>
          <div className="font-medium text-gray-900" data-testid="text-cards-total-pos">{fmt(totalPos)}</div>
        </div>
        <div>
          <div className="text-gray-500">مجموع الفعلي</div>
          <div className="font-medium text-gray-900" data-testid="text-cards-total-actual">{fmt(totalActual)}</div>
        </div>
        <div>
          <div className="text-gray-500">صافي الفرق</div>
          <div className={`font-medium ${Math.abs(totalDiff) < 0.01 ? "text-[#173404]" : "text-[#791F1F]"}`} data-testid="text-cards-total-diff">
            {totalDiff >= 0 ? "+" : ""}{fmt(totalDiff)}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeliveryTab({
  rows,
  onChange,
  disabled,
}: {
  rows: DeliveryRow[];
  onChange: (rows: DeliveryRow[]) => void;
  disabled?: boolean;
}) {
  const updateRow = (idx: number, patch: Partial<DeliveryRow>) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const removeRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const addQuick = (method: PaymentMethod, label: string) => {
    if (rows.some((r) => r.method === method)) return;
    onChange([...rows, { method, label, orders: 0, amount: 0, commissionPct: 20 }]);
  };

  const totalOrders = rows.reduce((s, r) => s + r.orders, 0);
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const totalCommission = rows.reduce((s, r) => s + r.amount * r.commissionPct / 100, 0);
  const totalNet = totalAmount - totalCommission;

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[1.3fr_0.6fr_1fr_0.9fr_1fr_32px] gap-2 px-2 text-[11px] text-gray-500 md:grid">
        <span>الشركة</span>
        <span className="text-center">عدد الطلبات</span>
        <span className="text-center">إجمالي المبلغ</span>
        <span className="text-center">العمولة (%)</span>
        <span className="text-center">الصافي</span>
        <span />
      </div>

      {rows.map((row, idx) => {
        const company = DELIVERY_COMPANIES.find((c) => c.method === row.method);
        const inactive = row.orders === 0 && row.amount === 0;
        const net = row.amount * (1 - row.commissionPct / 100);
        return (
          <div
            key={`${row.method}-${idx}`}
            className={`grid grid-cols-2 items-center gap-2 rounded-lg bg-[#F1EFE8] p-2.5 md:grid-cols-[1.3fr_0.6fr_1fr_0.9fr_1fr_32px] ${inactive ? "opacity-60" : ""}`}
            data-testid={`row-delivery-${row.method}`}
          >
            <div className="col-span-2 flex items-center justify-between gap-2 md:col-span-1">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded text-[10px] font-medium text-white ${
                    company?.bg === "transparent" ? "border border-dashed border-gray-400 text-gray-500" : ""
                  }`}
                  style={company?.bg !== "transparent" ? { background: company?.bg ?? "#666" } : {}}
                >
                  {company?.abbr ?? row.label}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">{row.label}</span>
                  {row.latin && <span className="text-[10px] text-gray-500">{row.latin}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeRow(idx)}
                disabled={disabled}
                data-testid={`button-remove-delivery-mobile-${row.method}`}
                className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-white hover:text-gray-700 md:hidden"
                aria-label="حذف"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-gray-500 md:hidden">عدد الطلبات</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={row.orders || ""}
                onChange={(e) => updateRow(idx, { orders: parseInt(e.target.value) || 0 })}
                disabled={disabled}
                placeholder="0"
                data-testid={`input-delivery-orders-${row.method}`}
                aria-label={`عدد طلبات ${row.label}`}
                className="w-full rounded-lg border border-black/[0.08] bg-white px-2 py-1.5 text-center text-sm focus:border-[#534AB7] focus:outline-none disabled:bg-gray-50"
              />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-gray-500 md:hidden">إجمالي المبلغ</span>
              <NumInput value={row.amount} onChange={(v) => updateRow(idx, { amount: v })} disabled={disabled} testId={`input-delivery-amount-${row.method}`} ariaLabel={`إجمالي مبلغ ${row.label}`} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-gray-500 md:hidden">العمولة (%)</span>
              <div className="flex items-center gap-1">
                <NumInput value={row.commissionPct} onChange={(v) => updateRow(idx, { commissionPct: v })} disabled={disabled} testId={`input-delivery-commission-${row.method}`} placeholder="0" ariaLabel={`عمولة ${row.label} بالنسبة المئوية`} />
                <span className="text-xs text-gray-500">%</span>
              </div>
            </label>
            <div className="col-span-2 flex items-center justify-between rounded bg-white/60 px-2 py-1 md:col-span-1 md:justify-center md:bg-transparent md:px-0 md:py-0">
              <span className="text-[10px] text-gray-500 md:hidden">الصافي</span>
              <span className="text-sm font-medium text-[#173404]" data-testid={`text-delivery-net-${row.method}`}>
                {row.amount > 0 ? fmt(net) : "—"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => removeRow(idx)}
              disabled={disabled}
              data-testid={`button-remove-delivery-${row.method}`}
              className="hidden h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-white hover:text-gray-700 md:flex"
              aria-label="حذف"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs text-gray-500">إضافة شركة:</span>
        {QUICK_DELIVERY.map((q) => (
          <button
            key={q.method}
            type="button"
            onClick={() => addQuick(q.method, q.label)}
            disabled={disabled || rows.some((r) => r.method === q.method)}
            data-testid={`button-quick-delivery-${q.method}`}
            className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            + {q.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg bg-[#EEEDFE] p-3 text-xs sm:grid-cols-4">
        <div>
          <div className="text-gray-500">عدد الطلبات</div>
          <div className="font-medium text-gray-900" data-testid="text-delivery-total-orders">{totalOrders} طلب</div>
        </div>
        <div>
          <div className="text-gray-500">إجمالي المبيعات</div>
          <div className="font-medium text-[#534AB7]" data-testid="text-delivery-total-amount">{fmt(totalAmount)}</div>
        </div>
        <div>
          <div className="text-gray-500">إجمالي العمولات</div>
          <div className="font-medium text-[#791F1F]" data-testid="text-delivery-total-commission">{fmt(totalCommission)}</div>
        </div>
        <div>
          <div className="text-gray-500">صافي التحويل</div>
          <div className="font-medium text-[#173404]" data-testid="text-delivery-total-net">{fmt(totalNet)}</div>
        </div>
      </div>
    </div>
  );
}

function CreditTab({
  rows,
  onChange,
  disabled,
}: {
  rows: CreditRow[];
  onChange: (rows: CreditRow[]) => void;
  disabled?: boolean;
}) {
  const addRow = () => onChange([...rows, { customer: "", amount: 0 }]);
  const updateRow = (idx: number, patch: Partial<CreditRow>) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500" data-testid="empty-credit">
          لا توجد مبيعات آجلة. اضغط "إضافة" لتسجيل مبلغ مدين.
        </div>
      )}
      {rows.map((row, idx) => (
        <div key={idx} className="grid grid-cols-2 gap-2 rounded-lg bg-[#F1EFE8] p-2.5 md:grid-cols-[1.5fr_1fr_1fr_32px]" data-testid={`row-credit-${idx}`}>
          <input
            type="text"
            value={row.customer}
            onChange={(e) => updateRow(idx, { customer: e.target.value })}
            disabled={disabled}
            placeholder="اسم العميل"
            data-testid={`input-credit-customer-${idx}`}
            className="col-span-2 w-full rounded-lg border border-black/[0.08] bg-white px-2 py-1.5 text-sm focus:border-[#534AB7] focus:outline-none md:col-span-1"
          />
          <NumInput value={row.amount} onChange={(v) => updateRow(idx, { amount: v })} disabled={disabled} testId={`input-credit-amount-${idx}`} />
          <input
            type="date"
            value={row.dueDate ?? ""}
            onChange={(e) => updateRow(idx, { dueDate: e.target.value })}
            disabled={disabled}
            data-testid={`input-credit-due-${idx}`}
            className="w-full rounded-lg border border-black/[0.08] bg-white px-2 py-1.5 text-sm focus:border-[#534AB7] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => removeRow(idx)}
            disabled={disabled}
            data-testid={`button-remove-credit-${idx}`}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-white hover:text-gray-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addRow}
          disabled={disabled}
          data-testid="button-add-credit"
          className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
        >
          + إضافة مدين
        </button>
        <span className="text-xs text-gray-500">
          المجموع: <span className="font-medium text-gray-900" data-testid="text-credit-total">{fmt(total)}</span>
        </span>
      </div>
    </div>
  );
}
