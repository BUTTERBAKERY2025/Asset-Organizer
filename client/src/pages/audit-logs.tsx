import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { TablePagination } from "@/components/ui/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Loader2, FileText, RefreshCw, Filter, History, ArrowRight, Users, Activity, TrendingUp, Clock, Plus, Edit, Trash2, Eye, LogIn, Wifi, Monitor, Smartphone, Tablet, Globe } from "lucide-react";
import { Link } from "wouter";
import { SettingsBreadcrumb } from "@/components/settings-breadcrumb";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { SystemAuditLog, User } from "@shared/schema";
import { ExportButtons } from "@/components/export-buttons";

const exportColumns = [
  { header: "التاريخ", key: "createdAt", width: 18 },
  { header: "الوحدة", key: "module", width: 15 },
  { header: "الإجراء", key: "action", width: 12 },
  { header: "العنصر", key: "entityName", width: 20 },
  { header: "المستخدم", key: "userName", width: 15 },
  { header: "التفاصيل", key: "details", width: 35 },
];

const userStatsExportColumns = [
  { header: "المستخدم", key: "userName", width: 20 },
  { header: "إجمالي العمليات", key: "totalActions", width: 15 },
  { header: "إنشاء", key: "creates", width: 10 },
  { header: "تعديل", key: "updates", width: 10 },
  { header: "حذف", key: "deletes", width: 10 },
  { header: "عرض", key: "views", width: 10 },
  { header: "دخول", key: "logins", width: 10 },
  { header: "أكثر قسم", key: "topModule", width: 15 },
  { header: "آخر نشاط", key: "lastActivity", width: 18 },
];

const MODULES = [
  { value: "all", label: "جميع الأقسام" },
  { value: "inventory", label: "المخزون" },
  { value: "projects", label: "المشاريع" },
  { value: "contractors", label: "المقاولين" },
  { value: "transfers", label: "التحويلات" },
  { value: "users", label: "المستخدمين" },
  { value: "contracts", label: "العقود" },
  { value: "cashier", label: "الكاشير" },
  { value: "production", label: "الإنتاج" },
  { value: "warehouse", label: "المخازن" },
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
  { value: "login", label: "تسجيل دخول", color: "bg-cyan-500" },
  { value: "logout", label: "تسجيل خروج", color: "bg-slate-500" },
];

interface UserStats {
  userId: string;
  userName: string;
  totalActions: number;
  creates: number;
  updates: number;
  deletes: number;
  views: number;
  logins: number;
  lastActivity: string | null;
  topModule: string | null;
}

interface OnlineUser {
  sessionId: string;
  userId: string;
  userName: string;
  deviceInfo: { browser: string; os: string; device: string } | null;
  ipAddress: string | null;
  lastActivityAt: string;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState("all");
  const [selectedUser, setSelectedUser] = useState("all");
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("logs");

  // Fetch all users for filter
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch user statistics
  const { data: userStats = [], isLoading: statsLoading, refetch: refetchStats } = useQuery<UserStats[]>({
    queryKey: ["/api/system-audit-logs/user-stats"],
  });

  // Fetch online users
  const { data: onlineUsers = [], isLoading: onlineLoading, refetch: refetchOnline } = useQuery<OnlineUser[]>({
    queryKey: ["/api/online-users"],
    refetchInterval: 60000,
  });

  // Fetch logs based on filters
  const { data: logs = [], isLoading, refetch } = useQuery<SystemAuditLog[]>({
    queryKey: ["/api/system-audit-logs", selectedModule, selectedUser, searchQuery],
    queryFn: async () => {
      let url = "/api/system-audit-logs";
      if (searchQuery) {
        url = `/api/system-audit-logs/search?q=${encodeURIComponent(searchQuery)}`;
      } else if (selectedUser !== "all") {
        url = `/api/system-audit-logs/user/${selectedUser}`;
      } else if (selectedModule !== "all") {
        url = `/api/system-audit-logs/module/${selectedModule}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  });

  // Filter logs by module if user filter is active
  const filteredLogs = useMemo(() => {
    if (selectedUser !== "all" && selectedModule !== "all") {
      return logs.filter(log => log.module === selectedModule);
    }
    return logs;
  }, [logs, selectedModule, selectedUser]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedModule, selectedUser, searchQuery]);

  const handleSearch = () => {
    setIsSearching(true);
    refetch().finally(() => setIsSearching(false));
  };

  const handleRefresh = () => {
    refetch();
    refetchStats();
    refetchOnline();
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case "Mobile": return <Smartphone className="w-4 h-4" />;
      case "Tablet": return <Tablet className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  const getActionBadge = (action: string) => {
    const actionInfo = ACTIONS.find(a => a.value === action);
    return (
      <Badge className={`${actionInfo?.color || 'bg-gray-500'} text-white text-[10px] sm:text-xs`}>
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

  const formatShortDate = (date: string | Date | null) => {
    if (!date) return "-";
    try {
      return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ar });
    } catch {
      return String(date);
    }
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const total = userStats.reduce((sum, u) => sum + u.totalActions, 0);
    const creates = userStats.reduce((sum, u) => sum + u.creates, 0);
    const updates = userStats.reduce((sum, u) => sum + u.updates, 0);
    const deletes = userStats.reduce((sum, u) => sum + u.deletes, 0);
    const activeUsers = userStats.filter(u => u.totalActions > 0).length;
    return { total, creates, updates, deletes, activeUsers };
  }, [userStats]);

  return (
    <Layout>
      <div className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto space-y-4" dir="rtl">
        <SettingsBreadcrumb currentPage="سجل التدقيق" currentIcon={History} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" data-testid="btn-back">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
                سجل التدقيق
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                متابعة جميع العمليات والتغييرات في النظام
              </p>
            </div>
          </div>
          <Button onClick={handleRefresh} variant="outline" className="h-11 sm:h-9 w-full sm:w-auto" data-testid="button-refresh-logs">
            <RefreshCw className="w-4 h-4 ml-2" />
            تحديث
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-blue-600">إجمالي العمليات</p>
                <p className="text-lg font-bold text-blue-700">{summaryStats.total.toLocaleString('en')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-green-600">إنشاء</p>
                <p className="text-lg font-bold text-green-700">{summaryStats.creates.toLocaleString('en')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-lg">
                <Edit className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-amber-600">تعديل</p>
                <p className="text-lg font-bold text-amber-700">{summaryStats.updates.toLocaleString('en')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 bg-red-500 rounded-lg">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-red-600">حذف</p>
                <p className="text-lg font-bold text-red-700">{summaryStats.deletes.toLocaleString('en')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-purple-600">مستخدمين نشطين</p>
                <p className="text-lg font-bold text-purple-700">{summaryStats.activeUsers}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-11">
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              سجل العمليات
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              تقرير المستخدمين
            </TabsTrigger>
            <TabsTrigger value="online" className="flex items-center gap-2">
              <Wifi className="w-4 h-4" />
              المتصلين الآن
              {onlineUsers.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-green-100 text-green-700">
                  {onlineUsers.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="space-y-4 mt-4">
            {/* Filters */}
            <Card>
              <CardHeader className="p-3 sm:p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
                  البحث والتصفية
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="البحث في السجلات..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      className="pr-10 h-10"
                      data-testid="input-search-logs"
                    />
                  </div>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger className="h-10" data-testid="select-user-filter">
                      <SelectValue placeholder="اختر المستخدم" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع المستخدمين</SelectItem>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedModule} onValueChange={setSelectedModule}>
                    <SelectTrigger className="h-10" data-testid="select-module-filter">
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
                  <Button onClick={handleSearch} disabled={isSearching} className="h-10" data-testid="button-search">
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

            {/* Logs Table */}
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                  سجل العمليات
                  <Badge variant="secondary" className="mr-2 text-xs">{filteredLogs.length} سجل</Badge>
                </CardTitle>
                <ExportButtons
                  data={filteredLogs}
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
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>لا توجد سجلات للعرض</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">التاريخ</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">القسم</TableHead>
                          <TableHead className="text-right">العملية</TableHead>
                          <TableHead className="text-right">العنصر</TableHead>
                          <TableHead className="text-right hidden md:table-cell">المستخدم</TableHead>
                          <TableHead className="text-right hidden lg:table-cell">التفاصيل</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLogs.slice((currentPage - 1) * 15, currentPage * 15).map((log) => (
                          <TableRow key={log.id} data-testid={`row-audit-log-${log.id}`}>
                            <TableCell className="text-[10px] sm:text-xs">
                              {formatDate(log.createdAt)}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="outline" className="text-[10px] sm:text-xs">{getModuleLabel(log.module)}</Badge>
                            </TableCell>
                            <TableCell>{getActionBadge(log.action)}</TableCell>
                            <TableCell className="font-medium text-xs sm:text-sm">
                              {log.entityName || log.entityId}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs sm:text-sm">{log.userName || "غير محدد"}</TableCell>
                            <TableCell className="max-w-xs truncate text-xs sm:text-sm text-muted-foreground hidden lg:table-cell">
                              {log.details || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <TablePagination
                      currentPage={currentPage}
                      totalItems={filteredLogs.length}
                      itemsPerPage={15}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4 mt-4">
            {/* User Statistics Table */}
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                  تقرير أنشطة المستخدمين
                  <Badge variant="secondary" className="mr-2 text-xs">{userStats.length} مستخدم</Badge>
                </CardTitle>
                <ExportButtons
                  data={userStats.map(s => ({
                    ...s,
                    lastActivity: formatShortDate(s.lastActivity),
                    topModule: getModuleLabel(s.topModule || ''),
                  }))}
                  columns={userStatsExportColumns}
                  fileName="تقرير_أنشطة_المستخدمين"
                  title="تقرير أنشطة المستخدمين"
                  subtitle="إحصائيات العمليات لكل مستخدم"
                  sheetName="أنشطة المستخدمين"
                />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : userStats.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>لا توجد بيانات للعرض</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[800px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">#</TableHead>
                          <TableHead className="text-right">المستخدم</TableHead>
                          <TableHead className="text-center">إجمالي</TableHead>
                          <TableHead className="text-center">
                            <span className="flex items-center justify-center gap-1">
                              <Plus className="w-3 h-3 text-green-500" />
                              إنشاء
                            </span>
                          </TableHead>
                          <TableHead className="text-center">
                            <span className="flex items-center justify-center gap-1">
                              <Edit className="w-3 h-3 text-blue-500" />
                              تعديل
                            </span>
                          </TableHead>
                          <TableHead className="text-center">
                            <span className="flex items-center justify-center gap-1">
                              <Trash2 className="w-3 h-3 text-red-500" />
                              حذف
                            </span>
                          </TableHead>
                          <TableHead className="text-center">
                            <span className="flex items-center justify-center gap-1">
                              <Eye className="w-3 h-3 text-gray-500" />
                              عرض
                            </span>
                          </TableHead>
                          <TableHead className="text-center">
                            <span className="flex items-center justify-center gap-1">
                              <LogIn className="w-3 h-3 text-cyan-500" />
                              دخول
                            </span>
                          </TableHead>
                          <TableHead className="text-right hidden md:table-cell">أكثر قسم</TableHead>
                          <TableHead className="text-right hidden lg:table-cell">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              آخر نشاط
                            </span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userStats.map((stat, index) => (
                          <TableRow 
                            key={stat.userId} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              setSelectedUser(stat.userId);
                              setActiveTab("logs");
                            }}
                            data-testid={`row-user-stats-${stat.userId}`}
                          >
                            <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                            <TableCell className="font-medium">{stat.userName}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="font-bold">{stat.totalActions.toLocaleString('en')}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-green-600 font-medium">{stat.creates.toLocaleString('en')}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-blue-600 font-medium">{stat.updates.toLocaleString('en')}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-red-600 font-medium">{stat.deletes.toLocaleString('en')}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-gray-600 font-medium">{stat.views.toLocaleString('en')}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-cyan-600 font-medium">{stat.logins.toLocaleString('en')}</span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {stat.topModule && (
                                <Badge variant="outline" className="text-xs">
                                  {getModuleLabel(stat.topModule)}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                              {formatShortDate(stat.lastActivity)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="online" className="space-y-4 mt-4">
            {/* Online Users */}
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Wifi className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  المستخدمون المتصلون حالياً
                  <Badge variant="secondary" className="mr-2 text-xs bg-green-100 text-green-700">{onlineUsers.length} متصل</Badge>
                </CardTitle>
                <Button onClick={() => refetchOnline()} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 ml-2" />
                  تحديث
                </Button>
              </CardHeader>
              <CardContent>
                {onlineLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : onlineUsers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Wifi className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>لا يوجد مستخدمون متصلون حالياً</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {onlineUsers.map((user) => (
                      <Card 
                        key={user.sessionId} 
                        className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:shadow-md transition-shadow"
                        data-testid={`card-online-user-${user.userId}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                                  {user.userName?.charAt(0) || "?"}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white animate-pulse" />
                              </div>
                              <div>
                                <p className="font-semibold text-green-800">{user.userName}</p>
                                <p className="text-xs text-green-600">متصل الآن</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            {user.deviceInfo && (
                              <div className="flex items-center gap-2 text-green-700">
                                {getDeviceIcon(user.deviceInfo.device)}
                                <span>{user.deviceInfo.device} - {user.deviceInfo.browser}</span>
                              </div>
                            )}
                            {user.deviceInfo && (
                              <div className="flex items-center gap-2 text-green-600">
                                <Globe className="w-4 h-4" />
                                <span>{user.deviceInfo.os}</span>
                              </div>
                            )}
                            {user.ipAddress && (
                              <div className="flex items-center gap-2 text-green-600">
                                <Activity className="w-4 h-4" />
                                <span className="font-mono text-xs">{user.ipAddress}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-green-600">
                              <Clock className="w-4 h-4" />
                              <span className="text-xs">آخر نشاط: {formatShortDate(user.lastActivityAt)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
