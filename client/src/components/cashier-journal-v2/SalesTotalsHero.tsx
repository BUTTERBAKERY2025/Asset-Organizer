import { Wallet } from "lucide-react";
import { fmt } from "./constants";

interface SalesTotalsHeroProps {
  totalSales: number;
  onTotalSalesChange: (n: number) => void;
  invoiceCount: number;
  onInvoiceCountChange: (n: number) => void;
  openingBalance: number;
  onOpeningBalanceChange: (n: number) => void;
  disabled?: boolean;
}

export function SalesTotalsHero({
  totalSales,
  onTotalSalesChange,
  invoiceCount,
  onInvoiceCountChange,
  openingBalance,
  onOpeningBalanceChange,
  disabled,
}: SalesTotalsHeroProps) {
  const avg = invoiceCount > 0 ? totalSales / invoiceCount : 0;

  return (
    <div
      className="rounded-xl bg-[#EEEDFE] p-4"
      data-testid="card-sales-totals"
    >
      <div className="mb-3 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-[#534AB7]" />
        <span className="text-sm font-medium text-[#26215C]">إجمالي المبيعات</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <InnerCell label="المبيعات (SAR) *">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={totalSales || ""}
            onChange={(e) => onTotalSalesChange(parseFloat(e.target.value) || 0)}
            disabled={disabled}
            placeholder="0.00"
            data-testid="input-total-sales"
            className="w-full bg-transparent text-lg font-medium text-gray-900 focus:outline-none"
          />
        </InnerCell>

        <InnerCell label="عدد الفواتير">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={invoiceCount || ""}
            onChange={(e) => onInvoiceCountChange(parseInt(e.target.value) || 0)}
            disabled={disabled}
            placeholder="0"
            data-testid="input-invoice-count"
            className="w-full bg-transparent text-lg font-medium text-gray-900 focus:outline-none"
          />
        </InnerCell>

        <InnerCell label="متوسط الفاتورة">
          <span
            className="block text-lg font-medium text-gray-500"
            data-testid="text-avg-invoice"
          >
            {fmt(avg)}
          </span>
        </InnerCell>

        <InnerCell label="العهدة">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={openingBalance || ""}
            onChange={(e) => onOpeningBalanceChange(parseFloat(e.target.value) || 0)}
            disabled={disabled}
            placeholder="0.00"
            data-testid="input-opening-balance"
            className="w-full bg-transparent text-lg font-medium text-gray-900 focus:outline-none"
          />
        </InnerCell>
      </div>
    </div>
  );
}

function InnerCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-3">
      <div className="mb-1 text-[11px] text-gray-500">{label}</div>
      {children}
    </div>
  );
}
