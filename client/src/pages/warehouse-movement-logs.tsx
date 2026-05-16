import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { 
  History, Search, Filter, ArrowLeft, TrendingUp, TrendingDown, 
  ArrowRightLeft, Package, Calendar
} from "lucide-react";
import { Link } from "wouter";

type MovementLog = {
  id: number;
  itemId: number;
  itemName: string;
  branchId: string;
  branchName: string;
  movementType: string;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: string;
  referenceId: number;
  notes: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
};

type Branch = {
  id: string;
  name: string;
  nameAr: string;
};

const MOVEMENT_TYPES = [
  { value: "request_in", labelAr: "استلام من طلب", labelEn: "Request In", icon: TrendingUp, color: "text-green-500" },
  { value: "transfer_in", labelAr: "تحويل وارد", labelEn: "Transfer In", icon: TrendingUp, color: "text-green-500" },
  { value: "transfer_out", labelAr: "تحويل صادر", labelEn: "Transfer Out", icon: TrendingDown, color: "text-red-500" },
  { value: "adjustment_in", labelAr: "تعديل زيادة", labelEn: "Adjustment In", icon: TrendingUp, color: "text-blue-500" },
  { value: "adjustment_out", labelAr: "تعديل نقص", labelEn: "Adjustment Out", icon: TrendingDown, color: "text-orange-500" },
  { value: "consumption", labelAr: "استهلاك", labelEn: "Consumption", icon: TrendingDown, color: "text-red-500" },
  { value: "return", labelAr: "مرتجع", labelEn: "Return", icon: ArrowRightLeft, color: "text-purple-500" },
];

function getMovementTypeBadge(movementType: string, isRTL: boolean) {
  const type = MOVEMENT_TYPES.find(t => t.value === movementType);
  if (!type) return <Badge variant="outline">{movementType}</Badge>;
  
  const Icon = type.icon;
  return (
    <Badge variant="outline" className={`flex items-center gap-1 ${type.color}`}>
      <Icon className="w-3 h-3" />
      {isRTL ? type.labelAr : type.labelEn}
    </Badge>
  );
}

export default function WarehouseMovementLogsPage() {
  const { t, i18n } = useTranslation("platform-home");
  const isRTL = i18n.language === "ar";

  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: logs = [], isLoading } = useQuery<MovementLog[]>({
    queryKey: ["/api/warehouse/movement-logs", filterBranch, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterBranch !== "all") params.append("branchId", filterBranch);
      if (filterType !== "all") params.append("movementType", filterType);
      const response = await fetch(`/api/warehouse/movement-logs?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch logs");
      return response.json();
    },
  });

  const filteredLogs = logs.filter(log => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.itemName?.toLowerCase().includes(query) ||
        log.branchName?.toLowerCase().includes(query) ||
        log.notes?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 max-w-screen-2xl mx-auto space-y-4 sm:space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/warehouse-dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
              <ArrowLeft className={`w-4 h-4 sm:w-5 sm:h-5 ${isRTL ? "rotate-180" : ""}`} />
            </Button>
          </Link>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-indigo-500 flex items-center justify-center">
            <History className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
              {isRTL ? "سجل حركات المخزون" : "Inventory Movement Logs"}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              {isRTL ? "تتبع جميع حركات المواد الواردة والصادرة" : "Track all incoming and outgoing material movements"}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={isRTL ? "بحث باسم المادة أو الفرع..." : "Search by item name or branch..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 sm:h-10"
              data-testid="input-search"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[130px] sm:w-[180px] h-9 sm:h-10" data-testid="filter-type">
                <Filter className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <SelectValue placeholder={isRTL ? "النوع" : "Type"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? "جميع الأنواع" : "All Types"}</SelectItem>
                {MOVEMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {isRTL ? type.labelAr : type.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger className="w-[130px] sm:w-[180px] h-9 sm:h-10" data-testid="filter-branch">
                <SelectValue placeholder={isRTL ? "الفرع" : "Branch"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? "جميع الفروع" : "All Branches"}</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {isRTL ? branch.nameAr || branch.name : branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[80px]">{isRTL ? "التاريخ" : "Date"}</TableHead>
                    <TableHead className="min-w-[100px]">{isRTL ? "المادة" : "Item"}</TableHead>
                    <TableHead className="hidden sm:table-cell">{isRTL ? "الفرع" : "Branch"}</TableHead>
                    <TableHead>{isRTL ? "النوع" : "Type"}</TableHead>
                    <TableHead>{isRTL ? "الكمية" : "Qty"}</TableHead>
                    <TableHead className="hidden md:table-cell">{isRTL ? "قبل" : "Before"}</TableHead>
                    <TableHead className="hidden md:table-cell">{isRTL ? "بعد" : "After"}</TableHead>
                    <TableHead className="hidden lg:table-cell">{isRTL ? "بواسطة" : "By"}</TableHead>
                    <TableHead className="hidden lg:table-cell">{isRTL ? "ملاحظات" : "Notes"}</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      {isRTL ? "جاري التحميل..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {isRTL ? "لا توجد سجلات" : "No logs found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id} data-testid={`log-row-${log.id}`}>
                      <TableCell className="text-xs sm:text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-muted-foreground hidden sm:block" />
                          {new Date(log.createdAt).toLocaleDateString(isRTL ? 'en-GB' : 'en-US')}
                        </div>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleTimeString(isRTL ? 'en-GB' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 sm:gap-2">
                          <Package className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground hidden sm:block" />
                          <span className="text-xs sm:text-sm">{log.itemName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs sm:text-sm">{log.branchName || "-"}</TableCell>
                      <TableCell>{getMovementTypeBadge(log.movementType, isRTL)}</TableCell>
                      <TableCell>
                        <span className={`text-xs sm:text-sm ${log.quantity > 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}`}>
                          {log.quantity > 0 ? `+${log.quantity}` : log.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs sm:text-sm">{log.balanceBefore}</TableCell>
                      <TableCell className="hidden md:table-cell font-medium text-xs sm:text-sm">{log.balanceAfter}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs sm:text-sm">{log.createdByName || "-"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs sm:text-sm text-muted-foreground max-w-[150px] truncate">
                        {log.notes || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
