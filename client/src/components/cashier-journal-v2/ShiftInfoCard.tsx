import { Clipboard } from "lucide-react";

interface BranchOption {
  id: number | string;
  name: string;
}

interface ShiftInfoCardProps {
  branchId: string;
  branches: BranchOption[];
  onBranchChange: (id: string) => void;
  journalDate: string;
  onDateChange: (d: string) => void;
  shiftType: "morning" | "evening" | string;
  onShiftChange: (s: string) => void;
  cashierName: string;
  disabled?: boolean;
}

export function ShiftInfoCard({
  branchId,
  branches,
  onBranchChange,
  journalDate,
  onDateChange,
  shiftType,
  onShiftChange,
  cashierName,
  disabled,
}: ShiftInfoCardProps) {
  return (
    <div
      className="rounded-xl border border-black/[0.08] bg-white p-4"
      data-testid="card-shift-info"
    >
      <div className="mb-3 flex items-center gap-2">
        <Clipboard className="h-4 w-4 text-[#534AB7]" />
        <span className="text-sm font-medium text-gray-900">معلومات اليومية</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Field label="الفرع" required>
          <select
            value={branchId}
            onChange={(e) => onBranchChange(e.target.value)}
            disabled={disabled}
            data-testid="select-branch"
            className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#534AB7] focus:outline-none disabled:bg-gray-50"
          >
            <option value="">اختر الفرع</option>
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="التاريخ" required>
          <input
            type="date"
            value={journalDate}
            onChange={(e) => onDateChange(e.target.value)}
            disabled={disabled}
            data-testid="input-journal-date"
            className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#534AB7] focus:outline-none disabled:bg-gray-50"
          />
        </Field>

        <Field label="الوردية" required>
          <select
            value={shiftType}
            onChange={(e) => onShiftChange(e.target.value)}
            disabled={disabled}
            data-testid="select-shift-type"
            className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#534AB7] focus:outline-none disabled:bg-gray-50"
          >
            <option value="morning">صباحي</option>
            <option value="evening">مسائي</option>
          </select>
        </Field>

        <Field label="الكاشير">
          <input
            type="text"
            value={cashierName}
            readOnly
            data-testid="input-cashier-name"
            className="w-full rounded-lg border border-black/[0.08] bg-[#F1EFE8] px-3 py-2 text-sm text-gray-700"
          />
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-gray-500">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}
