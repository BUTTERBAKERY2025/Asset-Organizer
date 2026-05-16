import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ar } from "date-fns/locale";
import {
  ArrowRight,
  FileSpreadsheet,
  FileText,
  Download,
  RefreshCw,
  Calendar,
  Building2,
  Clock,
  Package,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  AlertTriangle,
  CheckCircle,
  Target,
  Trash2,
  Users,
  Loader2,
  DollarSign,
  Percent,
  Factory,
  ClipboardCheck,
  Sparkles,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useProductionContext } from "@/contexts/ProductionContext";
import { useBranches } from "@/hooks/useBranches";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  ComposedChart,
  Area,
} from "recharts";

interface Branch {
  id: string;
  name: string;
}

interface ReportData {
  dailySummary: {
    totalBatches: number;
    totalQuantity: number;
    avgBatchSize: number;
    byDestination: Record<string, number>;
    byCategory: Record<string, number>;
    byHour: Record<string, number>;
    byStatus: Record<string, number>;
    byChef: Record<string, { batches: number; quantity: number }>;
  };
  targetComparison: {
    target: number;
    actual: number;
    completionRate: number;
    gap: number;
    status: string;
  };
  salesData?: {
    totalSales: number;
    journalCount: number;
  };
  wasteAnalysis: {
    totalReports: number;
    totalQuantity: number;
    totalValue: number;
    wastePercentage?: number;
    byReason: Record<string, number>;
    byProduct: Array<{ name: string; quantity: number; value: number }>;
  };
  qualityControl: {
    totalChecks: number;
    passed: number;
    failed: number;
    passRate: number;
    issues: Array<{ product: string; issue: string; date: string }>;
  };
  shiftPerformance: Array<{
    shift: string;
    production: number;
    target: number;
    efficiency: number;
  }>;
  productPerformance: Array<{
    productName: string;
    quantity: number;
    percentage: number;
    trend: number;
  }>;
  branchComparison: Array<{
    branchName: string;
    production: number;
    target: number;
    efficiency: number;
  }>;
  trends: {
    daily: Array<{ date: string; production: number; target: number; sales?: number; waste?: number }>;
    weekly: Array<{ week: string; production: number }>;
  };
  rawProductionEntries?: Array<{
    id: number;
    productName: string;
    productCategory: string | null;
    quantity: number;
    branchName: string;
    shiftName: string;
    destination: string;
    producedAt: string;
    productionDate: string | null; // Local date YYYY-MM-DD
    notes: string;
    // Status and chef tracking
    status: string | null;
    chefId: string | null;
    chefName: string | null;
    recorderName: string | null;
    // Completion tracking
    finishedAt: string | null;
    finishedById: string | null;
    finishedByName: string | null;
    // Carry-over tracking
    sourceBatchId: number | null;
  }>;
}

const CHART_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

const DATE_PRESETS = [
  { label: "اليوم", getValue: () => ({ start: new Date(), end: new Date() }) },
  { label: "أمس", getValue: () => ({ start: subDays(new Date(), 1), end: subDays(new Date(), 1) }) },
  { label: "آخر 7 أيام", getValue: () => ({ start: subDays(new Date(), 6), end: new Date() }) },
  { label: "آخر 30 يوم", getValue: () => ({ start: subDays(new Date(), 29), end: new Date() }) },
  { label: "هذا الأسبوع", getValue: () => ({ start: startOfWeek(new Date(), { weekStartsOn: 0 }), end: endOfWeek(new Date(), { weekStartsOn: 0 }) }) },
  { label: "هذا الشهر", getValue: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
];

type SortField = 'productName' | 'quantity' | 'productionDate' | 'status' | 'chefName' | 'productCategory';
type SortOrder = 'asc' | 'desc';

interface InventoryItem {
  id: number;
  branchId: string;
  branchName?: string;
  productId: number | null;
  productName: string;
  productNameNormalized: string;
  productCategory: string | null;
  quantity: number;
  unit: string | null;
  productionDate: string;
  updatedAt: string;
  lastBatchId: number | null;
}

interface TransferItem {
  id: number;
  inventoryId: number;
  productName: string;
  productCategory: string | null;
  quantity: number;
  unit: string | null;
  sourceBranchId: string;
  sourceBranchName?: string;
  destinationType: string;
  destinationBranchId: string | null;
  destinationBranchName?: string;
  notes: string | null;
  transferDate: string;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  status: string;
}

function InventoryReportTab({ branchId, startDate, endDate }: { branchId: string; startDate: string; endDate: string }) {
  const { data: inventory, isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/finished-goods-inventory", branchId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId && branchId !== "all") params.append("branchId", branchId);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      const res = await fetch(`/api/finished-goods-inventory?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("فشل في جلب بيانات المخزون");
      return res.json();
    },
  });

  const totalBalance = useMemo(() => 
    inventory?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
  , [inventory]);

  const byCategory = useMemo(() => {
    const categories: Record<string, number> = {};
    inventory?.forEach(item => {
      const cat = item.productCategory || "غير مصنف";
      categories[cat] = (categories[cat] || 0) + (item.quantity || 0);
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [inventory]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-gray-500">إجمالي المخزون</span>
            </div>
            <p className="text-2xl font-bold text-purple-700" data-testid="text-total-inventory">{totalBalance}</p>
            <p className="text-xs text-gray-400">وحدة</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-gray-500">عدد الأصناف</span>
            </div>
            <p className="text-2xl font-bold text-blue-700" data-testid="text-items-count">{inventory?.length || 0}</p>
            <p className="text-xs text-gray-400">صنف</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-green-600" />
              <span className="text-xs text-gray-500">التصنيفات</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{byCategory.length}</p>
            <p className="text-xs text-gray-400">تصنيف</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-gray-500">متوسط الرصيد</span>
            </div>
            <p className="text-2xl font-bold text-amber-700">
              {inventory && inventory.length > 0 ? Math.round(totalBalance / inventory.length) : 0}
            </p>
            <p className="text-xs text-gray-400">وحدة/صنف</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">توزيع المخزون حسب التصنيف</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {byCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={byCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {byCategory.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">لا توجد بيانات</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">أعلى الأصناف رصيداً</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2" data-testid="top-inventory-list">
              {inventory?.slice()
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 8)
                .map((item, i) => (
                  <div key={item.id} className="flex justify-between items-center p-2 rounded-lg bg-gray-50" data-testid={`row-inventory-${i}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-xs font-medium text-purple-700">
                        {i + 1}
                      </div>
                      <div>
                        <span className="text-sm font-medium">{item.productName}</span>
                        {item.productCategory && (
                          <span className="text-xs text-gray-400 mr-2">({item.productCategory})</span>
                        )}
                      </div>
                    </div>
                    <Badge className="text-xs bg-purple-600">{item.quantity} {item.unit || "وحدة"}</Badge>
                  </div>
                ))}
              {(!inventory || inventory.length === 0) && (
                <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">تفاصيل المخزون</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-right p-2">المنتج</th>
                  <th className="text-right p-2">التصنيف</th>
                  <th className="text-right p-2">الفرع</th>
                  <th className="text-right p-2">الرصيد</th>
                  <th className="text-right p-2">تاريخ الإنتاج</th>
                  <th className="text-right p-2">آخر تحديث</th>
                </tr>
              </thead>
              <tbody>
                {inventory?.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{item.productName}</td>
                    <td className="p-2 text-gray-500">{item.productCategory || "-"}</td>
                    <td className="p-2 text-gray-500">{item.branchName || "-"}</td>
                    <td className="p-2">
                      <Badge variant={item.quantity > 0 ? "default" : "destructive"}>
                        {item.quantity} {item.unit || "وحدة"}
                      </Badge>
                    </td>
                    <td className="p-2 text-gray-500">{item.productionDate}</td>
                    <td className="p-2 text-gray-500">{format(new Date(item.updatedAt), "yyyy/MM/dd HH:mm")}</td>
                  </tr>
                ))}
                {(!inventory || inventory.length === 0) && (
                  <tr><td colSpan={6} className="p-4 text-center text-gray-400">لا توجد بيانات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TransfersReportTab({ branchId, startDate, endDate }: { branchId: string; startDate: string; endDate: string }) {
  const { data: transfers, isLoading } = useQuery<TransferItem[]>({
    queryKey: ["/api/finished-goods-transfers", branchId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId && branchId !== "all") params.append("sourceBranchId", branchId);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      const res = await fetch(`/api/finished-goods-transfers?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("فشل في جلب بيانات التحويلات");
      return res.json();
    },
  });

  const totalTransferred = useMemo(() => 
    transfers?.reduce((sum, t) => sum + (t.quantity || 0), 0) || 0
  , [transfers]);

  const getDestinationLabel = (type: string, branchName?: string | null) => {
    const destMap: Record<string, string> = {
      'display_bar': 'بار العرض',
      'بار_العرض': 'بار العرض',
      'kitchen_trolley': 'عربة المطبخ',
      'freezer': 'الفريزر',
      'refrigerator': 'الثلاجة',
      'branch': branchName || 'فرع آخر',
    };
    return destMap[type] || type;
  };

  const byDestination = useMemo(() => {
    const destinations: Record<string, number> = {};
    transfers?.forEach(t => {
      const dest = getDestinationLabel(t.destinationType, t.destinationBranchName);
      destinations[dest] = (destinations[dest] || 0) + t.quantity;
    });
    return Object.entries(destinations).map(([name, value]) => ({ name, value }));
  }, [transfers]);

  const displayBarTotal = useMemo(() => 
    transfers?.filter(t => t.destinationType === "display_bar" || t.destinationType === "بار_العرض")
      .reduce((sum, t) => sum + t.quantity, 0) || 0
  , [transfers]);

  const branchTotal = useMemo(() => 
    transfers?.filter(t => t.destinationType === "branch")
      .reduce((sum, t) => sum + t.quantity, 0) || 0
  , [transfers]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRight className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-gray-500">إجمالي التحويلات</span>
            </div>
            <p className="text-2xl font-bold text-blue-700" data-testid="text-total-transfers">{totalTransferred}</p>
            <p className="text-xs text-gray-400">وحدة</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Factory className="h-4 w-4 text-orange-600" />
              <span className="text-xs text-gray-500">بار العرض</span>
            </div>
            <p className="text-2xl font-bold text-orange-700" data-testid="text-display-bar">{displayBarTotal}</p>
            <p className="text-xs text-gray-400">وحدة</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-green-600" />
              <span className="text-xs text-gray-500">للفروع</span>
            </div>
            <p className="text-2xl font-bold text-green-700" data-testid="text-branch-transfers">{branchTotal}</p>
            <p className="text-xs text-gray-400">وحدة</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardCheck className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-gray-500">عدد العمليات</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">{transfers?.length || 0}</p>
            <p className="text-xs text-gray-400">عملية</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">توزيع التحويلات حسب الوجهة</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {byDestination.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDestination}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8b5cf6" name="الكمية" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">لا توجد بيانات</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">آخر التحويلات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2" data-testid="recent-transfers-list">
              {transfers?.slice(0, 8).map((t, i) => (
                <div key={t.id} className="flex justify-between items-center p-2 rounded-lg bg-gray-50" data-testid={`row-transfer-${i}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      t.destinationType === "display_bar" || t.destinationType === "بار_العرض"
                        ? "bg-orange-100 text-orange-700"
                        : t.destinationType === "branch"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
                    }`}>
                      {t.destinationType === "display_bar" || t.destinationType === "بار_العرض" ? "ب" 
                        : t.destinationType === "branch" ? "ف" 
                        : t.destinationType === "kitchen_trolley" ? "ع"
                        : t.destinationType === "freezer" ? "ث"
                        : t.destinationType === "refrigerator" ? "ث"
                        : "أ"}
                    </div>
                    <div>
                      <span className="text-sm font-medium">{t.productName}</span>
                      <span className="text-xs text-gray-400 mr-2">
                        → {getDestinationLabel(t.destinationType, t.destinationBranchName)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="text-xs bg-blue-600">{t.quantity} {t.unit || "وحدة"}</Badge>
                    <span className="text-xs text-gray-400">
                      {format(new Date(t.createdAt), "MM/dd HH:mm")}
                    </span>
                  </div>
                </div>
              ))}
              {(!transfers || transfers.length === 0) && (
                <p className="text-sm text-gray-400 text-center py-4">لا توجد تحويلات</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">سجل التحويلات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-right p-2">المنتج</th>
                  <th className="text-right p-2">الكمية</th>
                  <th className="text-right p-2">من</th>
                  <th className="text-right p-2">إلى</th>
                  <th className="text-right p-2">بواسطة</th>
                  <th className="text-right p-2">التاريخ</th>
                  <th className="text-right p-2">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {transfers?.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{t.productName}</td>
                    <td className="p-2">
                      <Badge variant="outline">{t.quantity} {t.unit || "وحدة"}</Badge>
                    </td>
                    <td className="p-2 text-gray-500">{t.sourceBranchName || "-"}</td>
                    <td className="p-2">
                      <Badge className={t.destinationType === "display_bar" || t.destinationType === "بار_العرض" 
                        ? "bg-orange-500" 
                        : t.destinationType === "branch" ? "bg-blue-500" 
                        : "bg-purple-500"}>
                        {getDestinationLabel(t.destinationType, t.destinationBranchName)}
                      </Badge>
                    </td>
                    <td className="p-2 text-gray-500">{t.createdByName || "-"}</td>
                    <td className="p-2 text-gray-500">{format(new Date(t.createdAt), "yyyy/MM/dd HH:mm")}</td>
                    <td className="p-2 text-gray-500">{t.notes || "-"}</td>
                  </tr>
                ))}
                {(!transfers || transfers.length === 0) && (
                  <tr><td colSpan={7} className="p-4 text-center text-gray-400">لا توجد تحويلات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProductionReportsPage() {
  const { toast } = useToast();
  const { selectedBranch, setSelectedBranch, selectedDate, setSelectedDate } = useProductionContext();
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [activeTab, setActiveTab] = useState("data");
  const [isExporting, setIsExporting] = useState<string | null>(null);
  
  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterChef, setFilterChef] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('productionDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { branches, userBranchId, canSelectBranch } = useBranches();

  useEffect(() => {
    if (userBranchId && (!selectedBranch || selectedBranch === "all")) {
      setSelectedBranch(userBranchId);
    }
  }, [userBranchId, selectedBranch, setSelectedBranch]);

  const { data: reportData, isLoading, isError, error, refetch } = useQuery<ReportData>({
    queryKey: ["/api/production/reports", selectedBranch, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        branchId: selectedBranch || "all",
        startDate,
        endDate,
      });
      const res = await fetch(`/api/production/reports?${params}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) throw new Error("يرجى تسجيل الدخول أولاً");
        throw new Error("فشل في جلب التقارير");
      }
      return res.json();
    },
    retry: 1,
    staleTime: 30000,
  });

  const applyDatePreset = (preset: typeof DATE_PRESETS[0]) => {
    const { start, end } = preset.getValue();
    setStartDate(format(start, "yyyy-MM-dd"));
    setEndDate(format(end, "yyyy-MM-dd"));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "SAR" }).format(amount);
  };
  
  // Extract unique values for filters
  const filterOptions = useMemo(() => {
    const entries = reportData?.rawProductionEntries || [];
    const categories = Array.from(new Set(entries.map(e => e.productCategory).filter(Boolean))) as string[];
    const chefs = Array.from(new Set(entries.map(e => e.chefName).filter(Boolean))) as string[];
    return { categories, chefs };
  }, [reportData?.rawProductionEntries]);
  
  // Reset page when filters, data, or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterCategory, filterChef, sortField, sortOrder, reportData?.rawProductionEntries, pageSize]);
  
  // Filter, sort and paginate data
  const processedData = useMemo(() => {
    let entries = reportData?.rawProductionEntries || [];
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      entries = entries.filter(e => 
        e.productName.toLowerCase().includes(term) ||
        (e.chefName && e.chefName.toLowerCase().includes(term)) ||
        (e.notes && e.notes.toLowerCase().includes(term))
      );
    }
    
    // Apply status filter
    if (filterStatus !== "all") {
      entries = entries.filter(e => e.status === filterStatus);
    }
    
    // Apply category filter
    if (filterCategory !== "all") {
      entries = entries.filter(e => e.productCategory === filterCategory);
    }
    
    // Apply chef filter
    if (filterChef !== "all") {
      entries = entries.filter(e => e.chefName === filterChef);
    }
    
    // Sort entries
    entries = [...entries].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      
      if (sortField === 'quantity') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    const totalCount = entries.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedEntries = entries.slice(startIndex, startIndex + pageSize);
    
    // Calculate filtered stats
    const filteredTotal = entries.reduce((sum, e) => sum + e.quantity, 0);
    const finishedCount = entries.filter(e => e.status === 'finished').length;
    const inProgressCount = entries.filter(e => e.status === 'in_progress').length;
    
    return {
      entries: paginatedEntries,
      allFilteredEntries: entries,
      totalCount,
      totalPages,
      currentPage,
      filteredTotal,
      finishedCount,
      inProgressCount
    };
  }, [reportData?.rawProductionEntries, searchTerm, filterStatus, filterCategory, filterChef, sortField, sortOrder, currentPage, pageSize]);
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };
  
  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setFilterCategory("all");
    setFilterChef("all");
  };
  
  const hasActiveFilters = searchTerm || filterStatus !== "all" || filterCategory !== "all" || filterChef !== "all";

  const exportToExcel = useCallback(async (reportType: string) => {
    if (!reportData) return;
    setIsExporting("excel");
    
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const branchName = branches?.find(b => b.id === selectedBranch)?.name || "جميع الفروع";
      
      if (reportType === "all" || reportType === "summary") {
        const summaryData = [
          ["تقرير الإنتاج اليومي"],
          ["الفرع", branchName],
          ["الفترة", `${startDate} - ${endDate}`],
          [""],
          ["إجمالي الدفعات", reportData.dailySummary.totalBatches],
          ["إجمالي الكمية", reportData.dailySummary.totalQuantity],
          ["متوسط حجم الدفعة", reportData.dailySummary.avgBatchSize.toFixed(1)],
          [""],
          ["التوزيع حسب الوجهة"],
          ...Object.entries(reportData.dailySummary.byDestination).map(([dest, qty]) => [dest, qty]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, ws, "ملخص الإنتاج");
      }
      
      if (reportType === "all" || reportType === "targets") {
        const targetData = [
          ["تقرير الأهداف والإنجاز"],
          ["الهدف", reportData.targetComparison.target],
          ["الفعلي", reportData.targetComparison.actual],
          ["نسبة الإنجاز", `${reportData.targetComparison.completionRate.toFixed(1)}%`],
          ["الفجوة", reportData.targetComparison.gap],
          ["الحالة", reportData.targetComparison.status],
        ];
        const ws = XLSX.utils.aoa_to_sheet(targetData);
        XLSX.utils.book_append_sheet(wb, ws, "الأهداف");
      }
      
      if (reportType === "all" || reportType === "waste") {
        const wasteData = [
          ["تقرير الهدر"],
          ["إجمالي التقارير", reportData.wasteAnalysis.totalReports],
          ["إجمالي الكمية المهدرة", reportData.wasteAnalysis.totalQuantity],
          ["إجمالي القيمة المهدرة", reportData.wasteAnalysis.totalValue],
          [""],
          ["التوزيع حسب السبب"],
          ...Object.entries(reportData.wasteAnalysis.byReason).map(([reason, qty]) => [reason, qty]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(wasteData);
        XLSX.utils.book_append_sheet(wb, ws, "الهدر");
      }

      if (reportType === "all" || reportType === "products") {
        const productData = [
          ["المنتج", "الكمية", "النسبة", "الاتجاه"],
          ...reportData.productPerformance.map(p => [
            p.productName, p.quantity, `${p.percentage.toFixed(1)}%`, `${p.trend >= 0 ? '+' : ''}${p.trend.toFixed(1)}%`
          ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(productData);
        XLSX.utils.book_append_sheet(wb, ws, "أداء المنتجات");
      }

      if (reportType === "all" || reportType === "data") {
        const entriesToExport = processedData.allFilteredEntries;
        if (entriesToExport && entriesToExport.length > 0) {
          const rawData = [
            ["#", "المنتج", "التصنيف", "الكمية", "الفرع", "الوجهة", "الحالة", "الشيف", "مسجل بواسطة", "تاريخ الإنتاج", "وقت الإنتاج", "أكمل بواسطة", "وقت الإكمال", "مرحل من", "ملاحظات"],
            ...entriesToExport.map((entry, idx) => [
              idx + 1,
              entry.productName,
              entry.productCategory || '-',
              entry.quantity,
              entry.branchName,
              entry.destination,
              entry.status === 'finished' ? 'مكتمل' : entry.status === 'in_progress' ? 'قيد التحضير' : '-',
              entry.chefName || '-',
              entry.recorderName || '-',
              entry.productionDate || '-',
              entry.producedAt ? format(new Date(entry.producedAt), "HH:mm") : '-',
              entry.finishedByName || '-',
              entry.finishedAt ? format(new Date(entry.finishedAt), "yyyy/MM/dd HH:mm") : '-',
              entry.sourceBatchId ? `#${entry.sourceBatchId}` : '-',
              entry.notes || ''
            ]),
          ];
          const ws = XLSX.utils.aoa_to_sheet(rawData);
          XLSX.utils.book_append_sheet(wb, ws, "بيانات الإنتاج");
        }
      }

      XLSX.writeFile(wb, `تقارير_الإنتاج_${startDate}_${endDate}.xlsx`);
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "فشل تصدير ملف Excel",
        description: (error as Error)?.message || "تحقق من البيانات وحاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setIsExporting(null);
    }
  }, [reportData, branches, selectedBranch, startDate, endDate, processedData, toast]);

  const exportToCSV = useCallback(async (reportType: string) => {
    if (!reportData) return;
    setIsExporting("csv");
    
    try {
      let csvContent = "";
      
      if (reportType === "summary") {
        csvContent = "النوع,القيمة\n";
        csvContent += `إجمالي الدفعات,${reportData.dailySummary.totalBatches}\n`;
        csvContent += `إجمالي الكمية,${reportData.dailySummary.totalQuantity}\n`;
        csvContent += `متوسط حجم الدفعة,${reportData.dailySummary.avgBatchSize.toFixed(1)}\n`;
      } else if (reportType === "products") {
        csvContent = "المنتج,الكمية,النسبة,الاتجاه\n";
        reportData.productPerformance.forEach(p => {
          csvContent += `${p.productName},${p.quantity},${p.percentage.toFixed(1)}%,${p.trend >= 0 ? '+' : ''}${p.trend.toFixed(1)}%\n`;
        });
      } else if (reportType === "data" && processedData.allFilteredEntries.length > 0) {
        csvContent = "#,المنتج,التصنيف,الكمية,الفرع,الوجهة,الحالة,الشيف,مسجل بواسطة,تاريخ الإنتاج,وقت الإنتاج,أكمل بواسطة,وقت الإكمال,مرحل من,ملاحظات\n";
        processedData.allFilteredEntries.forEach((entry, idx) => {
          const statusText = entry.status === 'finished' ? 'مكتمل' : entry.status === 'in_progress' ? 'قيد التحضير' : '-';
          csvContent += `${idx + 1},${entry.productName},${entry.productCategory || '-'},${entry.quantity},${entry.branchName},${entry.destination},${statusText},${entry.chefName || '-'},${entry.recorderName || '-'},${entry.productionDate || '-'},"${entry.producedAt ? format(new Date(entry.producedAt), 'HH:mm') : '-'}",${entry.finishedByName || '-'},"${entry.finishedAt ? format(new Date(entry.finishedAt), 'yyyy/MM/dd HH:mm') : '-'}",${entry.sourceBatchId ? '#' + entry.sourceBatchId : '-'},${entry.notes || ''}\n`;
        });
      }
      
      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `تقرير_${reportType}_${startDate}.csv`;
      link.click();
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "فشل تصدير ملف CSV",
        description: (error as Error)?.message || "تحقق من البيانات وحاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setIsExporting(null);
    }
  }, [reportData, startDate, processedData, toast]);

  const exportToPDF = useCallback(async () => {
    setIsExporting("pdf");
    try {
      const response = await fetch("/api/pdf/production-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          startDate,
          endDate,
          totalBatches: reportData?.dailySummary.totalBatches || 0,
          totalQuantity: reportData?.dailySummary.totalQuantity || 0,
          completionRate: reportData?.targetComparison.completionRate || 0,
        }),
      });
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `تقارير_الإنتاج_${startDate}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF export error:", error);
      toast({
        title: "فشل تصدير ملف PDF",
        description: (error as Error)?.message || "تحقق من الاتصال وحاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setIsExporting(null);
    }
  }, [reportData, startDate, endDate, toast]);

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 max-w-[1400px] mx-auto space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/production-dashboard">
              <Button variant="ghost" size="icon" className="h-11 w-11 min-h-[44px] min-w-[44px] sm:h-10 sm:w-10 sm:min-h-0 sm:min-w-0" data-testid="btn-back">
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">التقارير الشاملة للإنتاج</h1>
              <p className="text-xs sm:text-sm text-gray-500">جميع تقارير الإنتاج والتحليلات</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="btn-refresh"
              className="h-11 sm:h-9"
            >
              <RefreshCw className={`h-4 w-4 ml-1 ${isLoading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
          </div>
        </div>

        {/* Quick Links to Related Pages */}
        <Card className="bg-gradient-to-l from-amber-50 to-white border-amber-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-gray-700">روابط سريعة للصفحات ذات الصلة</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
              <Link href="/daily-production">
                <Button variant="outline" size="sm" className="w-full h-auto py-2 flex flex-col items-center gap-1 hover:bg-amber-50 hover:border-amber-300" data-testid="link-daily-production">
                  <Package className="h-4 w-4 text-amber-600" />
                  <span className="text-xs">الإنتاج اليومي</span>
                </Button>
              </Link>
              <Link href="/advanced-production-orders">
                <Button variant="outline" size="sm" className="w-full h-auto py-2 flex flex-col items-center gap-1 hover:bg-blue-50 hover:border-blue-300" data-testid="link-orders">
                  <Target className="h-4 w-4 text-blue-600" />
                  <span className="text-xs">أوامر الإنتاج</span>
                </Button>
              </Link>
                            <Link href="/display-bar-waste">
                <Button variant="outline" size="sm" className="w-full h-auto py-2 flex flex-col items-center gap-1 hover:bg-red-50 hover:border-red-300" data-testid="link-waste">
                  <Trash2 className="h-4 w-4 text-red-600" />
                  <span className="text-xs">إدارة الهالك</span>
                </Button>
              </Link>
              <Link href="/quality-control">
                <Button variant="outline" size="sm" className="w-full h-auto py-2 flex flex-col items-center gap-1 hover:bg-green-50 hover:border-green-300" data-testid="link-quality">
                  <ClipboardCheck className="h-4 w-4 text-green-600" />
                  <span className="text-xs">مراقبة الجودة</span>
                </Button>
              </Link>
              <Link href="/cashier-journal">
                <Button variant="outline" size="sm" className="w-full h-auto py-2 flex flex-col items-center gap-1 hover:bg-emerald-50 hover:border-emerald-300" data-testid="link-cashier">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs">يوميات الكاشير</span>
                </Button>
              </Link>
              <Link href="/production-dashboard">
                <Button variant="outline" size="sm" className="w-full h-auto py-2 flex flex-col items-center gap-1 hover:bg-cyan-50 hover:border-cyan-300" data-testid="link-dashboard">
                  <Factory className="h-4 w-4 text-cyan-600" />
                  <span className="text-xs">لوحة الإنتاج</span>
                </Button>
              </Link>
              <Link href="/command-center">
                <Button variant="outline" size="sm" className="w-full h-auto py-2 flex flex-col items-center gap-1 hover:bg-orange-50 hover:border-orange-300" data-testid="link-command">
                  <BarChart3 className="h-4 w-4 text-orange-600" />
                  <span className="text-xs">مركز القيادة</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-500" />
                <Select value={selectedBranch || "all"} onValueChange={setSelectedBranch} disabled={!canSelectBranch}>
                  <SelectTrigger className="w-[140px] h-11 sm:h-10 text-sm" data-testid="select-branch">
                    <SelectValue placeholder="الفرع" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {canSelectBranch && <SelectItem value="all">جميع الفروع</SelectItem>}
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-[130px] h-11 sm:h-10 text-sm"
                  data-testid="input-start-date"
                />
                <span className="text-gray-400">-</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-[130px] h-11 sm:h-10 text-sm"
                  data-testid="input-end-date"
                />
              </div>

              <div className="flex gap-1 flex-wrap">
                {DATE_PRESETS.slice(0, 4).map((preset, i) => (
                  <Button
                    key={i}
                    variant="ghost"
                    size="sm"
                    className="h-11 sm:h-9 text-xs px-2"
                    onClick={() => applyDatePreset(preset)}
                    data-testid={`btn-preset-${i}`}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              <div className="flex gap-1 mr-auto flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 sm:h-9 text-xs"
                  onClick={() => exportToExcel("all")}
                  disabled={isExporting !== null || !reportData}
                  data-testid="btn-export-excel"
                >
                  {isExporting === "excel" ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <FileSpreadsheet className="h-3 w-3 ml-1" />}
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 sm:h-9 text-xs"
                  onClick={exportToPDF}
                  disabled={isExporting !== null || !reportData}
                  data-testid="btn-export-pdf"
                >
                  {isExporting === "pdf" ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <FileText className="h-3 w-3 ml-1" />}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 sm:h-9 text-xs"
                  onClick={() => exportToCSV("summary")}
                  disabled={isExporting !== null || !reportData}
                  data-testid="btn-export-csv"
                >
                  {isExporting === "csv" ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <Download className="h-3 w-3 ml-1" />}
                  CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-5 md:grid-cols-11 gap-1 h-auto p-1">
            <TabsTrigger value="data" className="text-xs py-1.5 bg-amber-100" data-testid="tab-data">
              <FileSpreadsheet className="h-3 w-3 ml-1" />
              البيانات
            </TabsTrigger>
            <TabsTrigger value="summary" className="text-xs py-1.5" data-testid="tab-summary">
              <BarChart3 className="h-3 w-3 ml-1" />
              الملخص
            </TabsTrigger>
            <TabsTrigger value="inventory" className="text-xs py-1.5" data-testid="tab-inventory">
              <Package className="h-3 w-3 ml-1" />
              المخزون النهائي
            </TabsTrigger>
            <TabsTrigger value="transfers" className="text-xs py-1.5" data-testid="tab-transfers">
              <ArrowRight className="h-3 w-3 ml-1" />
              التحويلات
            </TabsTrigger>
            <TabsTrigger value="targets" className="text-xs py-1.5" data-testid="tab-targets">
              <Target className="h-3 w-3 ml-1" />
              الأهداف
            </TabsTrigger>
            <TabsTrigger value="products" className="text-xs py-1.5" data-testid="tab-products">
              <Sparkles className="h-3 w-3 ml-1" />
              المنتجات
            </TabsTrigger>
            <TabsTrigger value="waste" className="text-xs py-1.5" data-testid="tab-waste">
              <Trash2 className="h-3 w-3 ml-1" />
              الهدر
            </TabsTrigger>
            <TabsTrigger value="quality" className="text-xs py-1.5" data-testid="tab-quality">
              <CheckCircle className="h-3 w-3 ml-1" />
              الجودة
            </TabsTrigger>
            <TabsTrigger value="shifts" className="text-xs py-1.5" data-testid="tab-shifts">
              <Clock className="h-3 w-3 ml-1" />
              الورديات
            </TabsTrigger>
            <TabsTrigger value="branches" className="text-xs py-1.5" data-testid="tab-branches">
              <Building2 className="h-3 w-3 ml-1" />
              الفروع
            </TabsTrigger>
            <TabsTrigger value="trends" className="text-xs py-1.5" data-testid="tab-trends">
              <TrendingUp className="h-3 w-3 ml-1" />
              الاتجاهات
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : isError ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-8 text-center">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-red-700 mb-2">خطأ في جلب التقارير</h3>
                <p className="text-red-600 mb-4">{error?.message || "حدث خطأ غير متوقع"}</p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => refetch()} variant="outline" data-testid="btn-retry">
                    <RefreshCw className="h-4 w-4 ml-2" />
                    إعادة المحاولة
                  </Button>
                  <Link href="/login">
                    <Button variant="default" data-testid="btn-login">
                      تسجيل الدخول
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <TabsContent value="data" className="space-y-4">
                {/* Quick Stats Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Package className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">إجمالي السجلات</p>
                        <p className="text-xl font-bold text-blue-700">{processedData.totalCount}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                        <BarChart3 className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">إجمالي الكمية</p>
                        <p className="text-xl font-bold text-green-700">{processedData.filteredTotal}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">مكتمل</p>
                        <p className="text-xl font-bold text-emerald-700">{processedData.finishedCount}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
                        <Clock className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">قيد التحضير</p>
                        <p className="text-xl font-bold text-amber-700">{processedData.inProgressCount}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-amber-200">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-amber-600" />
                        <CardTitle className="text-lg">بيانات الإنتاج</CardTitle>
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                          {processedData.totalCount} / {reportData?.rawProductionEntries?.length || 0}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant={showFilters ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setShowFilters(!showFilters)}
                          data-testid="btn-toggle-filters"
                        >
                          <Filter className="h-3 w-3 ml-1" />
                          فلاتر
                          {hasActiveFilters && <span className="mr-1 h-2 w-2 bg-red-500 rounded-full" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs bg-green-50 hover:bg-green-100 border-green-300"
                          onClick={() => exportToExcel("data")}
                          disabled={isExporting !== null || !processedData.allFilteredEntries.length}
                          data-testid="btn-export-data-excel"
                        >
                          {isExporting === "excel" ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <FileSpreadsheet className="h-3 w-3 ml-1" />}
                          Excel
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs bg-blue-50 hover:bg-blue-100 border-blue-300"
                          onClick={() => exportToCSV("data")}
                          disabled={isExporting !== null || !processedData.allFilteredEntries.length}
                          data-testid="btn-export-data-csv"
                        >
                          {isExporting === "csv" ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <Download className="h-3 w-3 ml-1" />}
                          CSV
                        </Button>
                      </div>
                    </div>
                    
                    {/* Filters Panel */}
                    {showFilters && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg border space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">خيارات الفلترة والبحث</span>
                          {hasActiveFilters && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600" onClick={clearFilters} data-testid="btn-clear-filters">
                              <X className="h-3 w-3 ml-1" />
                              مسح الكل
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="relative">
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              placeholder="بحث بالمنتج أو الشيف..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pr-9 h-9 text-sm"
                              data-testid="input-search"
                            />
                          </div>
                          <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="h-9 text-sm" data-testid="select-filter-status">
                              <SelectValue placeholder="الحالة" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">جميع الحالات</SelectItem>
                              <SelectItem value="finished">مكتمل</SelectItem>
                              <SelectItem value="in_progress">قيد التحضير</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={filterCategory} onValueChange={setFilterCategory}>
                            <SelectTrigger className="h-9 text-sm" data-testid="select-filter-category">
                              <SelectValue placeholder="التصنيف" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">جميع التصنيفات</SelectItem>
                              {filterOptions.categories.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={filterChef} onValueChange={setFilterChef}>
                            <SelectTrigger className="h-9 text-sm" data-testid="select-filter-chef">
                              <SelectValue placeholder="الشيف" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">جميع الشيفات</SelectItem>
                              {filterOptions.chefs.map(chef => (
                                <SelectItem key={chef} value={chef}>{chef}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {processedData.entries.length > 0 ? (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse" data-testid="table-production-data">
                            <thead>
                              <tr className="bg-amber-50 border-b border-amber-200">
                                <th className="p-2 text-right font-medium text-amber-800">#</th>
                                <th 
                                  className="p-2 text-right font-medium text-amber-800 cursor-pointer hover:bg-amber-100 select-none"
                                  onClick={() => handleSort('productName')}
                                >
                                  <span className="flex items-center gap-1">
                                    المنتج
                                    <ArrowUpDown className={`h-3 w-3 ${sortField === 'productName' ? 'text-amber-600' : 'text-gray-400'}`} />
                                  </span>
                                </th>
                                <th 
                                  className="p-2 text-right font-medium text-amber-800 cursor-pointer hover:bg-amber-100 select-none"
                                  onClick={() => handleSort('productCategory')}
                                >
                                  <span className="flex items-center gap-1">
                                    التصنيف
                                    <ArrowUpDown className={`h-3 w-3 ${sortField === 'productCategory' ? 'text-amber-600' : 'text-gray-400'}`} />
                                  </span>
                                </th>
                                <th 
                                  className="p-2 text-right font-medium text-amber-800 cursor-pointer hover:bg-amber-100 select-none"
                                  onClick={() => handleSort('quantity')}
                                >
                                  <span className="flex items-center gap-1">
                                    الكمية
                                    <ArrowUpDown className={`h-3 w-3 ${sortField === 'quantity' ? 'text-amber-600' : 'text-gray-400'}`} />
                                  </span>
                                </th>
                                <th className="p-2 text-right font-medium text-amber-800">الفرع</th>
                                <th className="p-2 text-right font-medium text-amber-800">الوجهة</th>
                                <th 
                                  className="p-2 text-right font-medium text-amber-800 cursor-pointer hover:bg-amber-100 select-none"
                                  onClick={() => handleSort('status')}
                                >
                                  <span className="flex items-center gap-1">
                                    الحالة
                                    <ArrowUpDown className={`h-3 w-3 ${sortField === 'status' ? 'text-amber-600' : 'text-gray-400'}`} />
                                  </span>
                                </th>
                                <th 
                                  className="p-2 text-right font-medium text-amber-800 cursor-pointer hover:bg-amber-100 select-none"
                                  onClick={() => handleSort('chefName')}
                                >
                                  <span className="flex items-center gap-1">
                                    الشيف
                                    <ArrowUpDown className={`h-3 w-3 ${sortField === 'chefName' ? 'text-amber-600' : 'text-gray-400'}`} />
                                  </span>
                                </th>
                                <th className="p-2 text-right font-medium text-amber-800">مسجل بواسطة</th>
                                <th 
                                  className="p-2 text-right font-medium text-amber-800 cursor-pointer hover:bg-amber-100 select-none"
                                  onClick={() => handleSort('productionDate')}
                                >
                                  <span className="flex items-center gap-1">
                                    تاريخ الإنتاج
                                    <ArrowUpDown className={`h-3 w-3 ${sortField === 'productionDate' ? 'text-amber-600' : 'text-gray-400'}`} />
                                  </span>
                                </th>
                                <th className="p-2 text-right font-medium text-amber-800">وقت الإنتاج</th>
                                <th className="p-2 text-right font-medium text-amber-800">أكمل بواسطة</th>
                                <th className="p-2 text-right font-medium text-amber-800">وقت الإكمال</th>
                                <th className="p-2 text-right font-medium text-amber-800">مرحل من</th>
                                <th className="p-2 text-right font-medium text-amber-800">ملاحظات</th>
                              </tr>
                            </thead>
                            <tbody>
                              {processedData.entries.map((entry, idx) => (
                                <tr key={entry.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} data-testid={`row-production-${entry.id}`}>
                                  <td className="p-2 border-b text-gray-600">{(currentPage - 1) * pageSize + idx + 1}</td>
                                  <td className="p-2 border-b font-medium">{entry.productName}</td>
                                  <td className="p-2 border-b text-gray-600 text-xs">{entry.productCategory || '-'}</td>
                                  <td className="p-2 border-b text-green-700 font-bold">{entry.quantity}</td>
                                  <td className="p-2 border-b">{entry.branchName}</td>
                                  <td className="p-2 border-b">{entry.destination}</td>
                                  <td className="p-2 border-b">
                                    <Badge variant={entry.status === 'finished' ? 'default' : 'secondary'} className={entry.status === 'finished' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                                      {entry.status === 'finished' ? 'مكتمل' : entry.status === 'in_progress' ? 'قيد التحضير' : '-'}
                                    </Badge>
                                  </td>
                                  <td className="p-2 border-b text-blue-700 text-xs">{entry.chefName || '-'}</td>
                                  <td className="p-2 border-b text-gray-600 text-xs">{entry.recorderName || '-'}</td>
                                  <td className="p-2 border-b text-indigo-700 text-xs font-medium">
                                    {entry.productionDate || '-'}
                                  </td>
                                  <td className="p-2 border-b text-gray-600 text-xs">
                                    {entry.producedAt ? format(new Date(entry.producedAt), "HH:mm", { locale: ar }) : '-'}
                                  </td>
                                  <td className="p-2 border-b text-purple-700 text-xs">{entry.finishedByName || '-'}</td>
                                  <td className="p-2 border-b text-gray-600 text-xs">
                                    {entry.finishedAt ? format(new Date(entry.finishedAt), "yyyy/MM/dd HH:mm", { locale: ar }) : '-'}
                                  </td>
                                  <td className="p-2 border-b text-orange-600 text-xs">
                                    {entry.sourceBatchId ? `#${entry.sourceBatchId}` : '-'}
                                  </td>
                                  <td className="p-2 border-b text-gray-500 text-xs max-w-[150px] truncate">{entry.notes || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-amber-100 font-bold">
                                <td colSpan={3} className="p-2 text-amber-800">المجموع (الصفحة الحالية)</td>
                                <td className="p-2 text-green-700">{processedData.entries.reduce((sum, e) => sum + e.quantity, 0)}</td>
                                <td colSpan={11}></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        
                        {/* Pagination */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>عرض</span>
                            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                              <SelectTrigger className="h-8 w-20" data-testid="select-page-size">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                              </SelectContent>
                            </Select>
                            <span>من {processedData.totalCount} سجل</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                              data-testid="btn-prev-page"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                            <span className="text-sm px-3">
                              صفحة {currentPage} من {processedData.totalPages || 1}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => setCurrentPage(p => Math.min(processedData.totalPages, p + 1))}
                              disabled={currentPage >= processedData.totalPages}
                              data-testid="btn-next-page"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>{hasActiveFilters ? 'لا توجد نتائج تطابق معايير البحث' : 'لا توجد بيانات إنتاج في الفترة المحددة'}</p>
                        <p className="text-xs mt-2">{hasActiveFilters ? 'جرّب تغيير الفلاتر أو مسحها' : 'جرّب تغيير الفترة الزمنية أو الفرع'}</p>
                        {hasActiveFilters && (
                          <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters} data-testid="btn-clear-filters-empty">
                            مسح الفلاتر
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="summary" className="space-y-4">
                {/* KPI Cards Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Package className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="text-xs text-gray-600">إجمالي الدفعات</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700">{reportData?.dailySummary.totalBatches || 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                          <BarChart3 className="h-4 w-4 text-green-600" />
                        </div>
                        <span className="text-xs text-gray-600">إجمالي الكمية</span>
                      </div>
                      <p className="text-2xl font-bold text-green-700">{reportData?.dailySummary.totalQuantity || 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 bg-amber-100 rounded-full flex items-center justify-center">
                          <Target className="h-4 w-4 text-amber-600" />
                        </div>
                        <span className="text-xs text-gray-600">نسبة الإنجاز</span>
                      </div>
                      <p className="text-2xl font-bold text-amber-700">{reportData?.targetComparison.completionRate?.toFixed(0) || 0}%</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 bg-emerald-100 rounded-full flex items-center justify-center">
                          <DollarSign className="h-4 w-4 text-emerald-600" />
                        </div>
                        <span className="text-xs text-gray-600">إجمالي المبيعات</span>
                      </div>
                      <p className="text-xl font-bold text-emerald-700">{formatCurrency(reportData?.salesData?.totalSales || 0)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </div>
                        <span className="text-xs text-gray-600">قيمة الهالك</span>
                      </div>
                      <p className="text-xl font-bold text-red-700">{formatCurrency(reportData?.wasteAnalysis.totalValue || 0)}</p>
                    </CardContent>
                  </Card>
                  <Card className={`bg-gradient-to-br ${(reportData?.wasteAnalysis.wastePercentage || 0) > 5 ? 'from-red-50 border-red-300' : (reportData?.wasteAnalysis.wastePercentage || 0) > 2 ? 'from-amber-50 border-amber-300' : 'from-green-50 border-green-300'} to-white`}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${(reportData?.wasteAnalysis.wastePercentage || 0) > 5 ? 'bg-red-100' : (reportData?.wasteAnalysis.wastePercentage || 0) > 2 ? 'bg-amber-100' : 'bg-green-100'}`}>
                          <Percent className={`h-4 w-4 ${(reportData?.wasteAnalysis.wastePercentage || 0) > 5 ? 'text-red-600' : (reportData?.wasteAnalysis.wastePercentage || 0) > 2 ? 'text-amber-600' : 'text-green-600'}`} />
                        </div>
                        <span className="text-xs text-gray-600">نسبة الهدر</span>
                      </div>
                      <p className={`text-xl font-bold ${(reportData?.wasteAnalysis.wastePercentage || 0) > 5 ? 'text-red-700' : (reportData?.wasteAnalysis.wastePercentage || 0) > 2 ? 'text-amber-700' : 'text-green-700'}`}>
                        {(reportData?.wasteAnalysis.wastePercentage || 0).toFixed(2)}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Production Trends Chart */}
                {reportData?.trends?.daily && reportData.trends.daily.length > 0 && (
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        اتجاهات الإنتاج والمبيعات
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-2 pb-4">
                      <ResponsiveContainer width="100%" height={250}>
                        <ComposedChart data={reportData.trends.daily}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Legend />
                          <Bar yAxisId="left" dataKey="production" name="الإنتاج" fill="#f59e0b" />
                          <Bar yAxisId="left" dataKey="target" name="الهدف" fill="#3b82f6" />
                          <Line yAxisId="right" type="monotone" dataKey="sales" name="المبيعات" stroke="#10b981" strokeWidth={2} />
                          <Area yAxisId="left" type="monotone" dataKey="waste" name="الهدر" fill="#ef4444" fillOpacity={0.3} stroke="#ef4444" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">التوزيع حسب الوجهة</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {Object.entries(reportData?.dailySummary.byDestination || {}).length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={180}>
                            <RechartsPie>
                              <Pie
                                data={Object.entries(reportData?.dailySummary.byDestination || {}).map(([name, value]) => ({ name, value }))}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={70}
                                paddingAngle={2}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                labelLine={false}
                              >
                                {Object.entries(reportData?.dailySummary.byDestination || {}).map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </RechartsPie>
                          </ResponsiveContainer>
                          <div className="space-y-1 mt-2">
                            {Object.entries(reportData?.dailySummary.byDestination || {}).map(([dest, qty], i) => (
                              <div key={dest} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                  <span className="text-gray-600">{dest}</span>
                                </div>
                                <Badge variant="outline" className="text-xs">{qty}</Badge>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">التوزيع حسب الفئة</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {Object.entries(reportData?.dailySummary.byCategory || {}).length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={Object.entries(reportData?.dailySummary.byCategory || {}).map(([name, value]) => ({ name, value }))}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip />
                              <Bar dataKey="value" fill="#f59e0b">
                                {Object.entries(reportData?.dailySummary.byCategory || {}).map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                          <div className="space-y-1 mt-2">
                            {Object.entries(reportData?.dailySummary.byCategory || {}).map(([cat, qty], i) => (
                              <div key={cat} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                  <span className="text-gray-600">{cat}</span>
                                </div>
                                <Badge variant="outline" className="text-xs">{qty}</Badge>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p>
                      )}
                    </CardContent>
                  </Card>
                  
                  {/* Status Distribution Card */}
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">توزيع حسب الحالة</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {Object.entries(reportData?.dailySummary.byStatus || {}).length > 0 ? (
                        <div className="space-y-2" data-testid="status-distribution-list">
                          {Object.entries(reportData?.dailySummary.byStatus || {}).map(([status, count], i) => (
                            <div key={status} className="flex justify-between items-center p-2 rounded-lg bg-gray-50" data-testid={`row-status-${i}`}>
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${status === 'مكتمل' ? 'bg-green-500' : status === 'قيد التنفيذ' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                                <span className="text-sm">{status}</span>
                              </div>
                              <Badge variant={status === 'مكتمل' ? 'default' : 'secondary'} className="text-xs">
                                {count}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p>
                      )}
                    </CardContent>
                  </Card>
                  
                  {/* Chef Productivity Card */}
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">إنتاجية الشيفات</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {Object.entries(reportData?.dailySummary.byChef || {}).length > 0 ? (
                        <div className="space-y-2" data-testid="chef-productivity-list">
                          {Object.entries(reportData?.dailySummary.byChef || {})
                            .sort((a, b) => b[1].quantity - a[1].quantity)
                            .map(([chef, stats], i) => (
                            <div key={chef} className="flex justify-between items-center p-2 rounded-lg bg-gray-50" data-testid={`row-chef-${i}`}>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-medium text-amber-700">
                                  {i + 1}
                                </div>
                                <span className="text-sm font-medium">{chef}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">{stats.batches} دفعة</Badge>
                                <Badge className="text-xs bg-green-600">{stats.quantity} وحدة</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Finished Goods Inventory Tab */}
              <TabsContent value="inventory" className="space-y-4">
                <InventoryReportTab branchId={selectedBranch} startDate={startDate} endDate={endDate} />
              </TabsContent>

              {/* Transfers Tab */}
              <TabsContent value="transfers" className="space-y-4">
                <TransfersReportTab branchId={selectedBranch} startDate={startDate} endDate={endDate} />
              </TabsContent>

              <TabsContent value="targets" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">الهدف</p>
                      <p className="text-xl font-bold text-gray-700">{reportData?.targetComparison.target || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">الفعلي</p>
                      <p className="text-xl font-bold text-green-600">{reportData?.targetComparison.actual || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">الفجوة</p>
                      <p className={`text-xl font-bold ${(reportData?.targetComparison.gap || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(reportData?.targetComparison.gap || 0) >= 0 ? '+' : ''}{reportData?.targetComparison.gap || 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className={`${(reportData?.targetComparison.completionRate || 0) >= 100 ? 'bg-green-50 border-green-200' : (reportData?.targetComparison.completionRate || 0) >= 80 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">نسبة الإنجاز</p>
                      <p className={`text-xl font-bold ${(reportData?.targetComparison.completionRate || 0) >= 100 ? 'text-green-600' : (reportData?.targetComparison.completionRate || 0) >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                        {reportData?.targetComparison.completionRate?.toFixed(1) || 0}%
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="products" className="space-y-4">
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      أداء المنتجات
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {reportData?.productPerformance && reportData.productPerformance.length > 0 ? (
                      <div className="space-y-2">
                        {reportData.productPerformance.map((product, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{product.productName}</span>
                              <Badge variant="outline" className="text-xs">{product.quantity}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">{product.percentage.toFixed(1)}%</span>
                              <span className={`text-xs font-medium ${product.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {product.trend >= 0 ? <TrendingUp className="h-3 w-3 inline" /> : <TrendingDown className="h-3 w-3 inline" />}
                                {Math.abs(product.trend).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-8">لا توجد بيانات منتجات</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="waste" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">تقارير الهدر</p>
                      <p className="text-xl font-bold text-red-600">{reportData?.wasteAnalysis.totalReports || 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">الكمية المهدرة</p>
                      <p className="text-xl font-bold text-red-600">{reportData?.wasteAnalysis.totalQuantity || 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">قيمة الهدر</p>
                      <p className="text-xl font-bold text-red-600">{formatCurrency(reportData?.wasteAnalysis.totalValue || 0)}</p>
                    </CardContent>
                  </Card>
                  <Card className={`bg-gradient-to-br ${(reportData?.wasteAnalysis.wastePercentage || 0) > 5 ? 'from-red-100 border-red-300' : (reportData?.wasteAnalysis.wastePercentage || 0) > 2 ? 'from-amber-100 border-amber-300' : 'from-green-100 border-green-300'} to-white`}>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">نسبة الهدر من المبيعات</p>
                      <p className={`text-xl font-bold ${(reportData?.wasteAnalysis.wastePercentage || 0) > 5 ? 'text-red-600' : (reportData?.wasteAnalysis.wastePercentage || 0) > 2 ? 'text-amber-600' : 'text-green-600'}`}>
                        {(reportData?.wasteAnalysis.wastePercentage || 0).toFixed(2)}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">التوزيع حسب السبب</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {Object.entries(reportData?.wasteAnalysis.byReason || {}).length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={180}>
                            <RechartsPie>
                              <Pie
                                data={Object.entries(reportData?.wasteAnalysis.byReason || {}).map(([name, value]) => ({ name, value }))}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={70}
                                paddingAngle={2}
                                dataKey="value"
                                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                labelLine={false}
                              >
                                {Object.entries(reportData?.wasteAnalysis.byReason || {}).map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16'][index % 5]} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </RechartsPie>
                          </ResponsiveContainer>
                          <div className="space-y-2 mt-2">
                            {Object.entries(reportData?.wasteAnalysis.byReason || {}).map(([reason, qty], i) => (
                              <div key={reason} className="flex justify-between items-center p-2 bg-red-50 rounded text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded" style={{ backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16'][i % 5] }} />
                                  <span>{reason}</span>
                                </div>
                                <Badge variant="destructive">{qty}</Badge>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات هدر</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">أكثر المنتجات هدرًا (Top 10)</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {reportData?.wasteAnalysis.byProduct && reportData.wasteAnalysis.byProduct.length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={reportData.wasteAnalysis.byProduct.slice(0, 10)} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" tick={{ fontSize: 10 }} />
                              <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9 }} />
                              <Tooltip formatter={(value, name) => name === 'value' ? formatCurrency(value as number) : value} />
                              <Bar dataKey="quantity" name="الكمية" fill="#ef4444" />
                            </BarChart>
                          </ResponsiveContainer>
                          <div className="space-y-1 mt-2 max-h-32 overflow-y-auto">
                            {reportData.wasteAnalysis.byProduct.slice(0, 10).map((product, i) => (
                              <div key={i} className="flex justify-between items-center text-xs p-1 hover:bg-red-50 rounded">
                                <span className="text-gray-600 truncate">{product.name}</span>
                                <div className="flex gap-2">
                                  <Badge variant="outline" className="text-xs">{product.quantity}</Badge>
                                  <Badge variant="destructive" className="text-xs">{formatCurrency(product.value)}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات منتجات</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Link to Waste Management Page */}
                <div className="flex justify-center">
                  <Link href="/display-bar-waste">
                    <Button variant="outline" className="gap-2">
                      <Trash2 className="h-4 w-4" />
                      عرض صفحة إدارة الهالك الكاملة
                      <ArrowRight className="h-4 w-4 rotate-180" />
                    </Button>
                  </Link>
                </div>
              </TabsContent>

              <TabsContent value="quality" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">إجمالي الفحوصات</p>
                      <p className="text-xl font-bold">{reportData?.qualityControl.totalChecks || 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">ناجح</p>
                      <p className="text-xl font-bold text-green-600">{reportData?.qualityControl.passed || 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">فاشل</p>
                      <p className="text-xl font-bold text-red-600">{reportData?.qualityControl.failed || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">نسبة النجاح</p>
                      <p className="text-xl font-bold text-green-600">{reportData?.qualityControl.passRate?.toFixed(0) || 0}%</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="shifts" className="space-y-4">
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      أداء الورديات
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {reportData?.shiftPerformance && reportData.shiftPerformance.length > 0 ? (
                      <div className="space-y-3">
                        {reportData.shiftPerformance.map((shift, i) => (
                          <div key={i} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">{shift.shift}</span>
                              <Badge variant={shift.efficiency >= 100 ? "default" : shift.efficiency >= 80 ? "secondary" : "destructive"}>
                                {shift.efficiency.toFixed(0)}%
                              </Badge>
                            </div>
                            <div className="flex justify-between text-sm text-gray-500">
                              <span>الإنتاج: {shift.production}</span>
                              <span>الهدف: {shift.target}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-8">لا توجد بيانات ورديات</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="branches" className="space-y-4">
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      مقارنة الفروع
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {reportData?.branchComparison && reportData.branchComparison.length > 0 ? (
                      <div className="space-y-3">
                        {reportData.branchComparison.map((branch, i) => (
                          <div key={i} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">{branch.branchName}</span>
                              <Badge variant={branch.efficiency >= 100 ? "default" : branch.efficiency >= 80 ? "secondary" : "destructive"}>
                                {branch.efficiency.toFixed(0)}%
                              </Badge>
                            </div>
                            <div className="flex justify-between text-sm text-gray-500">
                              <span>الإنتاج: {branch.production}</span>
                              <span>الهدف: {branch.target}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-8">لا توجد بيانات فروع</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="trends" className="space-y-4">
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      اتجاهات الإنتاج
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {reportData?.trends.daily && reportData.trends.daily.length > 0 ? (
                      <div className="space-y-2">
                        {reportData.trends.daily.map((day, i) => (
                          <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="text-sm">{day.date}</span>
                            <div className="flex gap-4">
                              <span className="text-sm text-green-600">الإنتاج: {day.production}</span>
                              <span className="text-sm text-gray-500">الهدف: {day.target}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-8">لا توجد بيانات اتجاهات</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}
