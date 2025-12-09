import { useMemo, useRef, useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Printer, AlertTriangle, XCircle, HelpCircle, Download } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import * as XLSX from "xlsx";
import type { Branch, InventoryItem } from "@shared/schema";

export default function MaintenancePage() {
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: branches = [], isLoading: branchesLoading } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

  const { data: inventoryItems = [], isLoading: inventoryLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
    queryFn: async () => {
      const res = await fetch("/api/inventory");
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    },
  });

  const branchMap = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach(b => { map[b.id] = b.name; });
    return map;
  }, [branches]);

  const problemItems = useMemo(() => {
    return inventoryItems.filter(item => {
      const status = item.status || "undefined";
      const isProblem = status === "maintenance" || status === "damaged" || status === "missing" || status === "undefined";
      const matchesBranch = selectedBranch === "all" || item.branchId === selectedBranch;
      const matchesStatus = selectedStatus === "all" || 
        (selectedStatus === "undefined" ? !item.status : item.status === selectedStatus);
      return isProblem && matchesBranch && matchesStatus;
    });
  }, [inventoryItems, selectedBranch, selectedStatus]);

  const stats = useMemo(() => {
    const allProblems = inventoryItems.filter(item => 
      item.status === "maintenance" || item.status === "damaged" || item.status === "missing" || !item.status
    );
    return {
      maintenance: inventoryItems.filter(i => i.status === "maintenance").length,
      damaged: inventoryItems.filter(i => i.status === "damaged").length,
      missing: inventoryItems.filter(i => i.status === "missing").length,
      undefined: inventoryItems.filter(i => !i.status).length,
      total: allProblems.length,
    };
  }, [inventoryItems]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "تقرير الصيانة والأصناف المفقودة",
  });

  const getStatusLabel = (status?: string | null) => {
    switch(status) {
      case "maintenance": return "صيانة";
      case "damaged": return "تالف";
      case "missing": return "مفقود";
      default: return "غير محدد";
    }
  };

  const handleExport = () => {
    const exportData = problemItems.map(item => ({
      "المعرف": item.id,
      "الفرع": branchMap[item.branchId] || item.branchId,
      "اسم الصنف": item.name,
      "الفئة": item.category,
      "الكمية": item.quantity,
      "الوحدة": item.unit,
      "الحالة": getStatusLabel(item.status),
      "الرقم التسلسلي": item.serialNumber || "-",
      "ملاحظات": item.notes || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "تقرير الصيانة");
    XLSX.writeFile(workbook, "maintenance_report.xlsx");
  };

  const getStatusBadge = (status?: string | null) => {
    switch(status) {
      case "maintenance": 
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200 gap-1"><AlertTriangle className="w-3 h-3" /> صيانة</Badge>;
      case "damaged": 
        return <Badge className="bg-red-100 text-red-700 border-red-200 gap-1"><XCircle className="w-3 h-3" /> تالف</Badge>;
      case "missing": 
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200 gap-1"><HelpCircle className="w-3 h-3" /> مفقود</Badge>;
      default: 
        return <Badge variant="outline">غير محدد</Badge>;
    }
  };

  const isLoading = branchesLoading || inventoryLoading;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">جاري تحميل البيانات...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-maintenance-title">تقرير الصيانة</h1>
            <p className="text-muted-foreground mt-1">الأصناف التي تحتاج صيانة أو تالفة أو مفقودة</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handlePrint()} className="gap-2" data-testid="button-print-maintenance">
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </Button>
            <Button variant="outline" onClick={handleExport} className="gap-2" data-testid="button-export-maintenance">
              <Download className="w-4 h-4" />
              <span>تصدير Excel</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-maintenance-count">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">تحتاج صيانة</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{stats.maintenance}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-damaged-count">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">تالف</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats.damaged}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-missing-count">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">مفقود</CardTitle>
              <HelpCircle className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-500">{stats.missing}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-undefined-count">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">غير محدد</CardTitle>
              <HelpCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{stats.undefined}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>قائمة الأصناف</CardTitle>
            <CardDescription>إجمالي {problemItems.length} صنف يحتاج متابعة</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-full md:w-[200px]" data-testid="select-branch-filter-maintenance">
                  <SelectValue placeholder="جميع الفروع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full md:w-[200px]" data-testid="select-status-filter-maintenance">
                  <SelectValue placeholder="جميع الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="maintenance">صيانة</SelectItem>
                  <SelectItem value="damaged">تالف</SelectItem>
                  <SelectItem value="missing">مفقود</SelectItem>
                  <SelectItem value="undefined">غير محدد</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div ref={printRef} className="print:p-4">
              <div className="hidden print:block text-center mb-4">
                <h2 className="text-xl font-bold">تقرير الصيانة والأصناف المفقودة</h2>
                <p className="text-sm text-muted-foreground">تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')}</p>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right w-[80px]">المعرف</TableHead>
                      <TableHead className="text-right">الصنف</TableHead>
                      <TableHead className="text-right w-[120px]">الفرع</TableHead>
                      <TableHead className="text-right w-[100px]">الفئة</TableHead>
                      <TableHead className="text-right w-[80px]">الكمية</TableHead>
                      <TableHead className="text-right w-[100px]">الحالة</TableHead>
                      <TableHead className="text-right print:hidden">ملاحظات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {problemItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          لا توجد أصناف تحتاج متابعة
                        </TableCell>
                      </TableRow>
                    ) : (
                      problemItems.map((item) => (
                        <TableRow key={item.id} data-testid={`row-maintenance-${item.id}`}>
                          <TableCell className="font-mono text-xs">{item.id}</TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-sm">{branchMap[item.branchId]}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.category}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.quantity} {item.unit}</Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate print:hidden">
                            {item.notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
