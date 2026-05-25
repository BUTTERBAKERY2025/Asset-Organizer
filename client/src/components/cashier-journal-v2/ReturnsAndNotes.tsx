import { Undo2, StickyNote } from "lucide-react";

interface ReturnsAndNotesProps {
  hasReturn: boolean;
  returnAmount: number;
  returnReason: string;
  returnReference: string;
  onToggleReturn: (v: boolean) => void;
  onReturnAmountChange: (n: number) => void;
  onReturnReasonChange: (s: string) => void;
  onReturnReferenceChange: (s: string) => void;
  notes: string;
  onNotesChange: (s: string) => void;
  disabled?: boolean;
}

export function ReturnsAndNotes(props: ReturnsAndNotesProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-black/[0.08] bg-white p-4" data-testid="card-returns">
        <div className="mb-3 flex items-center gap-2">
          <Undo2 className="h-4 w-4 text-[#534AB7]" />
          <span className="text-sm font-medium text-gray-900">المرتجعات</span>
        </div>

        {!props.hasReturn ? (
          <button
            type="button"
            onClick={() => props.onToggleReturn(true)}
            disabled={props.disabled}
            data-testid="button-add-return"
            className="w-full rounded-lg border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-700 hover:bg-gray-50"
          >
            + إضافة مرتجع
          </button>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[11px] text-gray-500">المبلغ</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={props.returnAmount || ""}
                  onChange={(e) => props.onReturnAmountChange(parseFloat(e.target.value) || 0)}
                  disabled={props.disabled}
                  placeholder="0.00"
                  data-testid="input-return-amount"
                  className="w-full rounded-lg border border-black/[0.08] bg-white px-2 py-1.5 text-sm focus:border-[#534AB7] focus:outline-none disabled:bg-gray-50"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-gray-500">رقم الفاتورة</span>
                <input
                  type="text"
                  value={props.returnReference}
                  onChange={(e) => props.onReturnReferenceChange(e.target.value)}
                  disabled={props.disabled}
                  placeholder="-"
                  data-testid="input-return-reference"
                  className="w-full rounded-lg border border-black/[0.08] bg-white px-2 py-1.5 text-sm focus:border-[#534AB7] focus:outline-none disabled:bg-gray-50"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[11px] text-gray-500">السبب</span>
              <input
                type="text"
                value={props.returnReason}
                onChange={(e) => props.onReturnReasonChange(e.target.value)}
                disabled={props.disabled}
                placeholder="سبب المرتجع"
                data-testid="input-return-reason"
                className="w-full rounded-lg border border-black/[0.08] bg-white px-2 py-1.5 text-sm focus:border-[#534AB7] focus:outline-none disabled:bg-gray-50"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                props.onToggleReturn(false);
                props.onReturnAmountChange(0);
                props.onReturnReasonChange("");
                props.onReturnReferenceChange("");
              }}
              disabled={props.disabled}
              data-testid="button-remove-return"
              className="text-xs text-gray-500 hover:text-red-600"
            >
              إزالة المرتجع
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-black/[0.08] bg-white p-4" data-testid="card-notes">
        <div className="mb-3 flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-[#534AB7]" />
          <span className="text-sm font-medium text-gray-900">ملاحظات</span>
        </div>
        <textarea
          value={props.notes}
          onChange={(e) => props.onNotesChange(e.target.value)}
          disabled={props.disabled}
          placeholder="أي ملاحظات إضافية..."
          data-testid="textarea-notes"
          rows={3}
          className="w-full resize-none rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm focus:border-[#534AB7] focus:outline-none disabled:bg-gray-50"
        />
      </div>
    </div>
  );
}
