import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Users, Search, Calendar, Building, RotateCcw, Loader2, AlertCircle, ArrowRight, UserX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBranches } from "@/hooks/useBranches";

interface BranchEmployee {
  id: number;
  employeeNumber?: string | null;
  employeeName: string;
  employeeNameEn?: string | null;
  branchId: string;
  jobTitle: string;
  nationality: string;
  status: string;
  hireDate?: string | null;
  terminatedAt?: string | null;
  terminationReason?: string | null;
  totalSalary?: number;
  salary?: number;
}

function formatDate(d?: string | null, isRTL = true) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(isRTL ? "ar-SA" : "en-US");
  } catch {
    return "—";
  }
}

function diffMonths(from?: string | null, to?: string | null) {
  if (!from) return null;
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  if (isNaN(start) || isNaN(end) || end < start) return null;
  const months = Math.floor((end - start) / (1000 * 60 * 60 * 24 * 30.44));
  return months;
}

export default function TerminatedEmployeesPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { branches, canSelectBranch, userBranchId } = useBranches();

  const [selectedBranch, setSelectedBranch] = useState<string>(userBranchId || "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [terminatedFrom, setTerminatedFrom] = useState<string>("");
  const [terminatedTo, setTerminatedTo] = useState<string>("");

  const [rehireDialog, setRehireDialog] = useState<{ open: boolean; emp?: BranchEmployee }>({ open: false });
  const [rehireReason, setRehireReason] = useState("");

  const { data: bundle, isLoading, isError } = useQuery<{ employees?: BranchEmployee[]; stats?: any }>({
    queryKey: ["/api/branch-employees/bundle", selectedBranch, "terminated"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.set("branchId", selectedBranch);
      params.set("status", "terminated");
      const res = await fetch(`/api/branch-employees/bundle?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const rehireMutation = useMutation({
    mutationFn: async (vars: { id: number; reason: string }) => {
      const res = await fetch(`/api/branch-employees/${vars.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active", statusChangeReason: vars.reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Rehire failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: isRTL ? "تمت إعادة التوظيف" : "Employee Rehired", description: isRTL ? "تم تحويل الموظف إلى نشط" : "Status changed to active" });
      queryClient.invalidateQueries({ queryKey: ["/api/branch-employees/bundle"] });
      setRehireDialog({ open: false });
      setRehireReason("");
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: isRTL ? "فشل" : "Failed", description: e?.message || "" });
    },
  });

  const employees = useMemo(() => {
    const list = (bundle?.employees as BranchEmployee[] | undefined) || [];
    // dedupe by id
    const seen = new Map<number, BranchEmployee>();
    for (const e of list) if (!seen.has(e.id)) seen.set(e.id, e);
    return Array.from(seen.values());
  }, [bundle?.employees]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return employees.filter((e) => {
      if (q) {
        const hit = [e.employeeName, e.employeeNameEn, e.employeeNumber, e.jobTitle]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q));
        if (!hit) return false;
      }
      if (terminatedFrom && e.terminatedAt && e.terminatedAt.slice(0, 10) < terminatedFrom) return false;
      if (terminatedTo && e.terminatedAt && e.terminatedAt.slice(0, 10) > terminatedTo) return false;
      return true;
    });
  }, [employees, searchQuery, terminatedFrom, terminatedTo]);

  const branchName = (id: string) => branches?.find((b: any) => b.id === id)?.name || id;

  const totalTerminated = filtered.length;
  const thisMonth = filtered.filter((e) => {
    if (!e.terminatedAt) return false;
    const d = new Date(e.terminatedAt);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const thisYear = filtered.filter((e) => {
    if (!e.terminatedAt) return false;
    return new Date(e.terminatedAt).getFullYear() === new Date().getFullYear();
  }).length;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"} data-testid="page-terminated-employees">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserX className="w-6 h-6 text-red-600" />
            {isRTL ? "الموظفون منتهية خدمتهم" : "Terminated Employees"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isRTL ? "أرشيف جميع الموظفين الذين أُنهيت خدماتهم مع تفاصيل التاريخ والسبب" : "Archive of all terminated employees with date and reason details"}
          </p>
        </div>
        <Link href="/branch-employees">
          <Button variant="outline" data-testid="link-back-employees">
            <ArrowRight className="w-4 h-4 ms-2" />
            {isRTL ? "العودة لموظفي الفروع" : "Back to Branch Employees"}
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-lg"><UserX className="w-6 h-6 text-red-600" /></div>
              <div>
                <p className="text-sm text-gray-500">{isRTL ? "إجمالي منتهية خدماتهم" : "Total Terminated"}</p>
                <p className="text-2xl font-bold" data-testid="text-total-terminated">{totalTerminated}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-lg"><Calendar className="w-6 h-6 text-amber-600" /></div>
              <div>
                <p className="text-sm text-gray-500">{isRTL ? "هذا الشهر" : "This Month"}</p>
                <p className="text-2xl font-bold" data-testid="text-month-terminated">{thisMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg"><Calendar className="w-6 h-6 text-blue-600" /></div>
              <div>
                <p className="text-sm text-gray-500">{isRTL ? "هذا العام" : "This Year"}</p>
                <p className="text-2xl font-bold" data-testid="text-year-terminated">{thisYear}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Building className="w-4 h-4 text-gray-500" />
          <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={!canSelectBranch}>
            <SelectTrigger className="w-48" data-testid="filter-branch">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {canSelectBranch && <SelectItem value="all">{isRTL ? "جميع الفروع" : "All Branches"}</SelectItem>}
              {branches?.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isRTL ? "بحث بالاسم أو الرقم الوظيفي..." : "Search..."}
            className="pe-10"
            data-testid="input-search"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500">{isRTL ? "تاريخ الإنهاء من" : "From"}</Label>
          <Input type="date" value={terminatedFrom} onChange={(e) => setTerminatedFrom(e.target.value)} className="w-40" data-testid="input-from" />
          <Label className="text-xs text-gray-500">{isRTL ? "إلى" : "To"}</Label>
          <Input type="date" value={terminatedTo} onChange={(e) => setTerminatedTo(e.target.value)} className="w-40" data-testid="input-to" />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>{isRTL ? "قائمة الموظفين المنتهية خدماتهم" : "Terminated Employees List"}</CardTitle>
          <CardDescription>{isRTL ? `عرض ${filtered.length} موظف` : `Showing ${filtered.length} employees`}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>
          ) : isError ? (
            <div className="text-center py-8 text-red-600">
              <AlertCircle className="w-12 h-12 mx-auto mb-2" />
              <p>{isRTL ? "فشل في تحميل البيانات" : "Failed to load"}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>{isRTL ? "لا يوجد موظفون منتهية خدماتهم ضمن المعايير الحالية" : "No terminated employees found"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الرقم الوظيفي" : "Employee ID"}</TableHead>
                    <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الاسم" : "Name"}</TableHead>
                    <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "آخر فرع" : "Last Branch"}</TableHead>
                    <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الوظيفة" : "Job Title"}</TableHead>
                    <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "تاريخ التوظيف" : "Hire Date"}</TableHead>
                    <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "تاريخ الإنهاء" : "Termination Date"}</TableHead>
                    <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "مدة الخدمة" : "Service"}</TableHead>
                    <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "السبب" : "Reason"}</TableHead>
                    <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الإجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((emp) => {
                    const months = diffMonths(emp.hireDate, emp.terminatedAt);
                    return (
                      <TableRow key={emp.id} data-testid={`row-terminated-${emp.id}`}>
                        <TableCell className="font-mono text-xs text-amber-700">{emp.employeeNumber || "--"}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{emp.employeeName}</div>
                          {emp.employeeNameEn && <div className="text-xs text-gray-500" dir="ltr">{emp.employeeNameEn}</div>}
                        </TableCell>
                        <TableCell className="text-sm">{branchName(emp.branchId)}</TableCell>
                        <TableCell className="text-sm">{emp.jobTitle}</TableCell>
                        <TableCell className="text-sm">{formatDate(emp.hireDate, isRTL)}</TableCell>
                        <TableCell className="text-sm text-red-700">{formatDate(emp.terminatedAt, isRTL)}</TableCell>
                        <TableCell className="text-xs">
                          {months !== null ? (
                            <Badge variant="outline">
                              {months >= 12
                                ? `${Math.floor(months / 12)} ${isRTL ? "سنة" : "y"} ${months % 12} ${isRTL ? "شهر" : "m"}`
                                : `${months} ${isRTL ? "شهر" : "m"}`}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-xs max-w-[220px]">
                          <span className="text-gray-700 line-clamp-2" title={emp.terminationReason || ""}>
                            {emp.terminationReason || <span className="text-gray-400">—</span>}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-green-700 border-green-300 hover:bg-green-50"
                            onClick={() => { setRehireDialog({ open: true, emp }); setRehireReason(""); }}
                            data-testid={`btn-rehire-${emp.id}`}
                          >
                            <RotateCcw className="w-3 h-3" />
                            {isRTL ? "إعادة توظيف" : "Rehire"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rehire Dialog */}
      <Dialog open={rehireDialog.open} onOpenChange={(o) => !o && setRehireDialog({ open: false })}>
        <DialogContent dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRTL ? "إعادة توظيف الموظف" : "Rehire Employee"}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? `سيتم تحويل الحالة إلى "نشط" مع تسجيل ذلك في سجل تغييرات الحالة.`
                : 'Status will change to "active" and the change will be recorded in the status history.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {rehireDialog.emp && (
              <div className="text-sm bg-amber-50 rounded p-3 border border-amber-200">
                <div><strong>{isRTL ? "الاسم: " : "Name: "}</strong>{rehireDialog.emp.employeeName}</div>
                <div><strong>{isRTL ? "آخر فرع: " : "Last Branch: "}</strong>{branchName(rehireDialog.emp.branchId)}</div>
                <div><strong>{isRTL ? "تاريخ الإنهاء: " : "Terminated On: "}</strong>{formatDate(rehireDialog.emp.terminatedAt, isRTL)}</div>
              </div>
            )}
            <div className="space-y-2">
              <Label>{isRTL ? "سبب إعادة التوظيف (اختياري)" : "Reason for rehire (optional)"}</Label>
              <Textarea
                value={rehireReason}
                onChange={(e) => setRehireReason(e.target.value)}
                placeholder={isRTL ? "اكتب السبب..." : "Enter a reason..."}
                rows={3}
                data-testid="input-rehire-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRehireDialog({ open: false })} data-testid="btn-cancel-rehire">
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={() => rehireDialog.emp && rehireMutation.mutate({ id: rehireDialog.emp.id, reason: rehireReason })}
              disabled={rehireMutation.isPending}
              data-testid="btn-confirm-rehire"
            >
              {rehireMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isRTL ? "تأكيد إعادة التوظيف" : "Confirm Rehire")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
