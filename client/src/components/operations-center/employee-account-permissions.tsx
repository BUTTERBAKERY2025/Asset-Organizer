import type { DelegatedPermission } from "@shared/employee-account-delegation";
import { ACTION_LABELS, MODULE_LABELS } from "@shared/schema";
import { constrainDelegatedPermissions } from "@/lib/employee-account-delegation";

export function EmployeeAccountPermissions({ available, selected, onChange, disabled = false, emptyMessage, legend }: {
  available: DelegatedPermission[];
  selected: DelegatedPermission[];
  onChange: (permissions: DelegatedPermission[]) => void;
  disabled?: boolean;
  emptyMessage?: string;
  legend?: string;
}) {
  const toggle = (module: string, action: string, checked: boolean) => {
    const next = selected.map(row => ({ ...row, actions: [...row.actions] }));
    const row = next.find(permission => permission.module === module);
    if (checked) {
      if (row) row.actions.push(action);
      else next.push({ module, actions: [action] });
    } else if (row) row.actions = row.actions.filter(value => value !== action);
    onChange(constrainDelegatedPermissions(next, available));
  };
  return <fieldset disabled={disabled} className="space-y-2">
    <legend className="mb-2 text-sm font-bold">{legend ?? "الصلاحيات المسموح بها"}</legend>
    {!available.length ? <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">{emptyMessage ?? "لا توجد صلاحيات متاحة للتفويض. يلزم اعتمادها من مدير النظام."}</p>
      : available.map(permission => <div key={permission.module} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
        <p className="text-xs font-bold">{MODULE_LABELS[permission.module as keyof typeof MODULE_LABELS] ?? permission.module}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {permission.actions.map(action => <label key={action} className={`flex min-h-11 cursor-pointer items-center gap-2 text-xs ${disabled ? "opacity-60" : ""}`}>
            <input type="checkbox" className="h-4 w-4 accent-violet-700" checked={selected.some(row => row.module === permission.module && row.actions.includes(action))}
              onChange={event => toggle(permission.module, action, event.target.checked)}
              aria-label={`${MODULE_LABELS[permission.module as keyof typeof MODULE_LABELS] ?? permission.module}: ${ACTION_LABELS[action as keyof typeof ACTION_LABELS] ?? action}`} />
            {ACTION_LABELS[action as keyof typeof ACTION_LABELS] ?? action}
          </label>)}
        </div>
      </div>)}
  </fieldset>;
}