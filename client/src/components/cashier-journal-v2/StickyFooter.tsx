import { Printer, Save, PenSquare } from "lucide-react";
import { fmt } from "./constants";

interface StickyFooterProps {
  totalSales: number;
  collectedTotal: number;
  netDifference: number;
  signatureMissing: boolean;
  onPrint: () => void;
  onSaveDraft: () => void;
  onSignAndFinalize: () => void;
  saving?: boolean;
  disabled?: boolean;
}

export function StickyFooter({
  totalSales,
  collectedTotal,
  netDifference,
  signatureMissing,
  onPrint,
  onSaveDraft,
  onSignAndFinalize,
  saving,
  disabled,
}: StickyFooterProps) {
  const isShortage = netDifference < 0;
  return (
    <div className="sticky bottom-0 z-10 mt-4 rounded-xl border border-black/[0.08] bg-[#F1EFE8] p-3" data-testid="sticky-footer">
      <div className="mb-2 flex items-center justify-between text-xs">
        <div className="text-gray-600">
          المحصل {fmt(collectedTotal, { suffix: "" })} − المبيعات {fmt(totalSales, { suffix: "" })}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">الفارق الإجمالي:</span>
          <span className={`text-base font-medium ${isShortage ? "text-[#791F1F]" : Math.abs(netDifference) < 0.01 ? "text-[#173404]" : "text-[#633806]"}`} data-testid="text-footer-net-diff">
            {netDifference >= 0 ? "+" : ""}{fmt(netDifference)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={onPrint}
          disabled={disabled}
          data-testid="button-print-summary"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Printer className="h-3.5 w-3.5" />
          طباعة الملخص
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={disabled || saving}
          data-testid="button-save-draft"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "جارٍ الحفظ..." : "حفظ كمسودة"}
        </button>
        <button
          type="button"
          onClick={onSignAndFinalize}
          disabled={disabled || saving}
          data-testid="button-sign-finalize"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-[#534AB7] px-3 py-2 text-xs font-medium text-white hover:bg-[#26215C] disabled:opacity-50"
        >
          <PenSquare className="h-3.5 w-3.5" />
          {signatureMissing ? "توقيع وإنهاء اليومية" : "إنهاء اليومية"}
        </button>
      </div>
    </div>
  );
}
