import { useState } from "react";
import { Search, ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  employeeStatusLabel, employeeStatusLabels, operationsEmployeeCanTransfer, operationsEmployeePage,
  type OperationsEmployee,
} from "@/lib/operations-employees";

export function OperationsEmployeeDirectory({ employees, branchId, canTransfer, onTransfer }: {
  employees: OperationsEmployee[]; branchId: string; canTransfer: boolean; onTransfer: (employee: OperationsEmployee) => void;
}) {
  const [filters, setFilters] = useState({ search: "", status: "all", jobTitle: "all" });
  const [page, setPage] = useState(1);
  const result = operationsEmployeePage(employees, filters, page);
  const update = (patch: Partial<typeof filters>) => { setFilters(previous => ({ ...previous, ...patch })); setPage(1); };
  const action = (employee: OperationsEmployee) => canTransfer
    ? <Button variant="outline" size="sm" disabled={!operationsEmployeeCanTransfer(employee, branchId, canTransfer)}
        onClick={() => onTransfer(employee)}><ArrowLeftRight className="ml-1 size-3.5" />نقل الموظف</Button>
    : <span className="text-xs text-muted-foreground">عرض فقط</span>;
  const status = (employee: OperationsEmployee) => <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${employee.status === "active" ? "bg-emerald-50 text-emerald-800" : "bg-muted text-muted-foreground"}`}>{employeeStatusLabel(employee.status)}</span>;
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_180px]">
      <label className="text-sm"><span className="mb-1 block">البحث</span><span className="relative block">
        <Search className="absolute right-3 top-3 size-4 text-muted-foreground" />
        <Input className="pr-9" value={filters.search} onChange={event => update({ search: event.target.value })} placeholder="اسم الموظف، رقمه أو وظيفته" />
      </span></label>
      <label className="text-sm">الحالة<select className="mt-1 min-h-10 w-full rounded-md border border-input bg-background px-2" value={filters.status} onChange={event => update({ status: event.target.value })}>
        <option value="all">كل الحالات</option>{Object.entries(employeeStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label className="text-sm">الوظيفة<select className="mt-1 min-h-10 w-full rounded-md border border-input bg-background px-2" value={filters.jobTitle} onChange={event => update({ jobTitle: event.target.value })}>
        <option value="all">كل الوظائف</option>{Array.from(new Set(employees.map(employee => employee.jobTitle))).filter(Boolean).sort().map(job => <option key={job} value={job}>{job}</option>)}
      </select></label>
    </div>
    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><p>{result.total} موظف مطابق من {employees.length}</p><p>النقل متاح للموظفين النشطين فقط؛ لا تعرض هذه الصفحة الملف الشخصي.</p></div>
    {!result.total ? <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{employees.length ? "لا يوجد موظفون يطابقون البحث والتصفية." : "لا يوجد موظفون في هذا الفرع."}</p> : <>
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full text-right text-sm"><thead className="bg-muted/50"><tr>{["رقم الموظف", "الموظف", "الوظيفة", "الحالة", "الإجراء"].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody>{result.rows.map(employee => <tr key={employee.id} className="border-t border-border">
            <td className="px-4 py-3"><bdi>{employee.employeeNumber || "غير مسجل"}</bdi></td><td className="px-4 py-3 font-semibold">{employee.employeeName}</td>
            <td className="px-4 py-3">{employee.jobTitle || "غير مسجلة"}</td><td className="px-4 py-3">{status(employee)}</td><td className="px-4 py-3">{action(employee)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="space-y-2 md:hidden">{result.rows.map(employee => <article key={employee.id} className="space-y-3 rounded-xl border border-border p-3">
        <div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{employee.employeeName}</h3><p className="mt-1 text-xs text-muted-foreground">الرقم: <bdi>{employee.employeeNumber || "غير مسجل"}</bdi> · {employee.jobTitle || "الوظيفة غير مسجلة"}</p></div>{status(employee)}</div>
        {action(employee)}
      </article>)}</div>
      <nav className="flex items-center justify-between gap-2" aria-label="صفحات دليل الموظفين">
        <Button variant="outline" size="sm" disabled={result.page <= 1} onClick={() => setPage(result.page - 1)}><ChevronRight className="ml-1 size-4" />السابق</Button>
        <span className="text-xs text-muted-foreground">صفحة {result.page} من {result.pages}</span>
        <Button variant="outline" size="sm" disabled={result.page >= result.pages} onClick={() => setPage(result.page + 1)}>التالي<ChevronLeft className="mr-1 size-4" /></Button>
      </nav>
    </>}
  </div>;
}