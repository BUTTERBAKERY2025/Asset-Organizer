import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { TablePagination } from "@/components/ui/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Loader2, FileText, RefreshCw, Filter } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { SystemAuditLog } from "@shared/schema";
import { ExportButtons } from "@/components/export-buttons";

const exportColumns = [
  { header: "التاريخ", key: "createdAt", width: 18 },
  { header: "الوحدة", key: "module", width: 15 },
  { header: "الإجراء", key: "action", width: 12 },
  { header: "العنصر", key: "entityName", width: 20 },
  { header: "المستخدم", key: "userName", width: 15 },
  { header: "التفاصيل", key: "details", width: 35 },
];

const MODULES = [
  { value: "all", label: "جميع الأقسام" },
  { value: "inventory", label: "المخزون" },
  { value: "projects", label: "المشاريع" },
  { value: "contractors", label: "المقاولين" },
  { value: "transfers", label: "التحويلات" },
  { value: "users", label: "المستخدمين" },
  { value: "contracts", label: "العقود" },
];

const ACTIONS = [
  { value: "create", label: "إنشاء", color: "bg-green-500" },
  { value: "update", label: "تعديل", color: "bg-blue-500" },
  { value: "delete", label: "حذف", color: "bg-red-500" },
  { value: "view", label: "عرض", color: "bg-gray-500" },
  { value: "export", label: "تصدير", color: "bg-purple-500" },
  { value: "transfer", label: "تحويل", color: "bg-orange-500" },
  { value: "approve", label: "موافقة", color: "bg-emerald-500" },
  { value: "reject", label: "رفض", color: "bg-rose-500" },
];

export default function AuditLogsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState("all");
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: logs = [], isLoading, refetch } = useQuery<SystemAuditLog[]>({
    queryKey: ["/api/system-audit-logs", selectedModule, searchQuery],
    queryFn: async () => {
      let url = "/api/system-audit-logs";
      if (searchQuery) {
        url = `/api/system-audit-logs/search?q=${encodeURIComponent(searchQuery)}`;
      } else if (selectedModule !== "all") {
        url = `/api/system-audit-logs/module/${selectedModule}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedModule, searchQuery]);

  const handleSearch = () => {
    setIsSearching(true);
    refetch().finally(() => setIsSearching(false));
  };

  const getActionBadge = (action: string) => {
    const actionInfo = ACTIONS.find(a => a.value === action);
    return (
      <Badge className={`${actionInfo?.color || 'bg-gray-500'} text-white`}>
        {actionInfo?.label || action}
      </Badge>
    );
  };

  const getModuleLabel = (module: string) => {
    const moduleInfo = MODULES.find(m => m.value === module);
    return moduleInfo?.label || module;
  };

  const formatDate = (date: string | Date) => {
    try {
      return format(new Date(date), "PPpp", { locale: ar });
    } catch {
      return String(date);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
              سجل التدقيق
            </h1>
            <p className="text-muted-foreground mt-1">
              متابعة جميع العمليات والتغييرات في النظام
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh-logs">
            <RefreshCw className="w-4 h-4 ml-2" />
            تحديث
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              البحث والتصفية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="البحث في السجلات..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pr-10"
                    data-testid="input-search-logs"
                  />
                </div>
              </div>
              <Select value={selectedModule} onValueChange={setSelectedModule}>
                <SelectTrigger className="w-[200px]" data-testid="select-module-filter">
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  {MODULES.map(module => (
                    <SelectItem key={module.value} value={module.value}>
                      {module.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleSearch} disabled={isSearching} data-testid="button-search">
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : (
                  <Search className="w-4 h-4 ml-2" />
                )}
                بحث
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              سجل العمليات
              <Badge variant="secondary" className="mr-2">{logs.length} سجل</Badge>
            </CardTitle>
            <ExportButtons
              data={logs}
              columns={exportColumns}
              fileName="سجل_التدقيق"
              title="سجل التدقيق"
              subtitle="جميع العمليات والتغييرات في النظام"
              sheetName="سجل التدقيق"
            />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد سجلات للعرض</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">القسم</TableHead>
                      <TableHead className="text-right">العملية</TableHead>
                      <TableHead className="text-right">العنصر</TableHead>
                      <TableHead className="text-right">المستخدم</TableHead>
                      <TableHead className="text-right">التفاصيل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.slice((currentPage - 1) * 15, currentPage * 15).map((log) => (
                      <TableRow key={log.id} data-testid={`row-audit-log-${log.id}`}>
                        <TableCell className="text-sm">
                          {formatDate(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getModuleLabel(log.module)}</Badge>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell className="font-medium">
                          {log.entityName || log.entityId}
                        </TableCell>
                        <TableCell>{log.userName || "غير محدد"}</TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {log.details || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination
                  currentPage={currentPage}
                  totalItems={logs.length}
                  itemsPerPage={15}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
