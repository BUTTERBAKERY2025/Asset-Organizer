import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExportButtons } from "@/components/export-buttons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TablePagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Loader2, Database, Clock, CheckCircle, XCircle,
  HardDrive, ArrowRight, Download, RotateCcw, Eye, Search,
  AlertTriangle, FileJson, RefreshCw, Shield
} from "lucide-react";
import { Link } from "wouter";
import { SettingsBreadcrumb } from "@/components/settings-breadcrumb";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { Backup } from "@shared/schema";

const exportColumns = [
  { header: "اسم النسخة", key: "name", width: 25 },
  { header: "النوع", key: "type", width: 12 },
  { header: "الحالة", key: "status", width: 12 },
  { header: "عدد الجداول", key: "tableCount", width: 12 },
  { header: "عدد السجلات", key: "rowCount", width: 12 },
  { header: "الحجم", key: "fileSize", width: 12 },
  { header: "تاريخ الإنشاء", key: "createdAt", width: 18 },
];

interface TableStat {
  name: string;
  columns: number;
  rows: number;
  selected: boolean;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function BackupsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [backupName, setBackupName] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [tableSearch, setTableSearch] = useState("");


  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: backups = [], isLoading } = useQuery<Backup[]>({
    queryKey: ["/api/backups"],
    queryFn: async () => {
      const res = await fetch("/api/backups");
      if (!res.ok) throw new Error("Failed to fetch backups");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: tableStats = [], isLoading: tablesLoading } = useQuery<TableStat[]>({
    queryKey: ["/api/backups/tables"],
    queryFn: async () => {
      const res = await fetch("/api/backups/tables");
      if (!res.ok) throw new Error("Failed to fetch tables");
      return res.json();
    },
    enabled: isCreateDialogOpen,
  });

  useEffect(() => {
    if (tableStats.length > 0 && selectedTables.length === 0) {
      setSelectedTables(tableStats.filter(t => t.selected).map(t => t.name));
    }
  }, [tableStats]);

  const createMutation = useMutation({
    mutationFn: async ({ name, tables }: { name: string; tables: string[] }) => {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, selectedTables: tables }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل في إنشاء النسخة");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
      toast({ title: "تم بدء إنشاء النسخة الاحتياطية", description: "جاري نسخ البيانات في الخلفية..." });
      setIsCreateDialogOpen(false);
      setBackupName("");
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/backups/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete backup");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
      toast({ title: "تم حذف النسخة الاحتياطية" });
      setIsDeleteDialogOpen(false);
      setSelectedBackup(null);
    },
    onError: () => {
      toast({ title: "خطأ في حذف النسخة الاحتياطية", variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/backups/${id}/restore`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل في الاستعادة");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
      toast({
        title: "تمت الاستعادة",
        description: data.message,
      });
      setIsRestoreDialogOpen(false);
      setSelectedBackup(null);
    },
    onError: (err: Error) => {
      toast({ title: "خطأ في الاستعادة", description: err.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      name: backupName || `نسخة احتياطية - ${new Date().toLocaleDateString('ar-SA')}`,
      tables: selectedTables,
    });
  };

  const handleDownload = async (backup: Backup) => {
    try {
      const res = await fetch(`/api/backups/${backup.id}/download`);
      if (!res.ok) throw new Error("فشل في التحميل");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${backup.id}_${backup.name.replace(/\s+/g, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "تم تحميل النسخة الاحتياطية" });
    } catch {
      toast({ title: "خطأ في تحميل النسخة", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500 text-white text-[10px] sm:text-xs"><CheckCircle className="w-3 h-3 ml-1" />مكتملة</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500 text-white text-[10px] sm:text-xs"><Loader2 className="w-3 h-3 ml-1 animate-spin" />جاري التنفيذ</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500 text-white text-[10px] sm:text-xs"><Clock className="w-3 h-3 ml-1" />قيد الانتظار</Badge>;
      case "restoring":
        return <Badge className="bg-purple-500 text-white text-[10px] sm:text-xs"><RotateCcw className="w-3 h-3 ml-1 animate-spin" />جاري الاستعادة</Badge>;
      case "failed":
        return <Badge className="bg-red-500 text-white text-[10px] sm:text-xs"><XCircle className="w-3 h-3 ml-1" />فشلت</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] sm:text-xs">{status}</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "manual": return "يدوية";
      case "auto": return "تلقائية";
      case "scheduled": return "مجدولة";
      default: return type;
    }
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    try {
      return format(new Date(date), "PPpp", { locale: ar });
    } catch {
      return String(date);
    }
  };

  const parseTablesList = (tables: string | null): string[] => {
    if (!tables) return [];
    try {
      return JSON.parse(tables);
    } catch {
      return [];
    }
  };

  const completedBackups = backups.filter(b => b.status === "completed");
  const failedBackups = backups.filter(b => b.status === "failed");
  const inProgressBackups = backups.filter(b => b.status === "in_progress" || b.status === "restoring");
  const totalSize = backups.reduce((sum, b) => sum + (b.fileSize || 0), 0);

  const filteredTables = tableStats.filter(t =>
    t.name.toLowerCase().includes(tableSearch.toLowerCase())
  );

  const toggleTable = (name: string) => {
    setSelectedTables(prev =>
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    );
  };

  const selectAllTables = () => {
    setSelectedTables(tableStats.map(t => t.name));
  };

  const deselectAllTables = () => {
    setSelectedTables([]);
  };

  return (
    <Layout>
      <div className="page-container space-y-4" dir="rtl">
        <SettingsBreadcrumb currentPage="النسخ الاحتياطية" currentIcon={HardDrive} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" data-testid="btn-back">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
                النسخ الاحتياطية
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                إدارة النسخ الاحتياطية لقاعدة البيانات
              </p>
            </div>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 sm:h-9 w-full sm:w-auto" data-testid="button-create-backup">
                <Plus className="w-4 h-4 ml-2" />
                إنشاء نسخة احتياطية
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  إنشاء نسخة احتياطية جديدة
                </DialogTitle>
                <DialogDescription>
                  سيتم نسخ بيانات الجداول المحددة وحفظها بصيغة JSON
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="backup-name">اسم النسخة (اختياري)</Label>
                  <Input
                    id="backup-name"
                    value={backupName}
                    onChange={(e) => setBackupName(e.target.value)}
                    placeholder="مثال: نسخة قبل التحديث"
                    className="h-11 sm:h-10"
                    data-testid="input-backup-name"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>الجداول المحددة ({selectedTables.length} من {tableStats.length})</Label>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={selectAllTables} data-testid="button-select-all">
                        تحديد الكل
                      </Button>
                      <Button variant="outline" size="sm" onClick={deselectAllTables} data-testid="button-deselect-all">
                        إلغاء الكل
                      </Button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="بحث في الجداول..."
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      className="pr-9"
                      data-testid="input-table-search"
                    />
                  </div>
                  {tablesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span className="mr-2 text-sm text-muted-foreground">جاري تحميل معلومات الجداول...</span>
                    </div>
                  ) : (
                    <ScrollArea className="h-[300px] border rounded-md">
                      <div className="p-2 space-y-1">
                        {filteredTables.map(table => (
                          <label
                            key={table.name}
                            className="flex items-center gap-3 p-2 hover:bg-muted rounded-md cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedTables.includes(table.name)}
                              onCheckedChange={() => toggleTable(table.name)}
                              data-testid={`checkbox-table-${table.name}`}
                            />
                            <div className="flex-1 flex items-center justify-between min-w-0">
                              <span className="text-sm font-mono truncate">{table.name}</span>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                                <span>{table.rows} سجل</span>
                                <span>{table.columns} عمود</span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                <Button variant="outline" className="h-11 sm:h-9 w-full sm:w-auto" onClick={() => setIsCreateDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending || selectedTables.length === 0}
                  className="h-11 sm:h-9 w-full sm:w-auto"
                  data-testid="button-confirm-backup"
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                  إنشاء النسخة ({selectedTables.length} جدول)
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="kpi-grid">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6 md:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">إجمالي النسخ</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold" data-testid="text-total-backups">{backups.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6 md:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">النسخ الناجحة</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold text-green-600" data-testid="text-completed-backups">
                {completedBackups.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6 md:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">الحجم الإجمالي</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold" data-testid="text-total-size">
                {formatFileSize(totalSize)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6 md:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">آخر نسخة</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              <div className="text-xs sm:text-sm" data-testid="text-last-backup">
                {completedBackups.length > 0 ? formatDate(completedBackups[0].createdAt) : "لا توجد نسخ"}
              </div>
            </CardContent>
          </Card>
        </div>

        {inProgressBackups.length > 0 && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">
                    {inProgressBackups[0].status === 'restoring' ? 'جاري استعادة النسخة الاحتياطية...' : 'جاري إنشاء النسخة الاحتياطية...'}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">{inProgressBackups[0].name}</p>
                </div>
                <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
              </div>
              <Progress className="mt-3" value={undefined} />
            </CardContent>
          </Card>
        )}

        {failedBackups.length > 0 && (
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">
                    {failedBackups.length} نسخة فشلت في الإنشاء
                  </p>
                  {failedBackups[0].errorMessage && (
                    <p className="text-xs text-red-700 mt-1">{failedBackups[0].errorMessage}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <HardDrive className="w-4 h-4 sm:w-5 sm:h-5" />
                قائمة النسخ الاحتياطية
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <ExportButtons
                  data={backups.map(b => ({
                    ...b,
                    fileSize: formatFileSize(b.fileSize),
                    tableCount: b.tableCount || parseTablesList(b.tables).length,
                  }))}
                  columns={exportColumns}
                  fileName="النسخ_الاحتياطية"
                  title="تقرير النسخ الاحتياطية"
                  subtitle="قائمة جميع النسخ الاحتياطية في النظام"
                  sheetName="النسخ الاحتياطية"
                  disabled={isLoading}
                />
                <Badge variant="outline" className="text-xs" data-testid="badge-total-backups">
                  إجمالي: {backups.length} نسخة
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">لا توجد نسخ احتياطية</p>
                <p className="text-sm mt-2">أنشئ نسخة احتياطية لحماية بياناتك</p>
                <Button
                  className="mt-4"
                  onClick={() => setIsCreateDialogOpen(true)}
                  data-testid="button-create-first-backup"
                >
                  <Plus className="w-4 h-4 ml-2" />
                  إنشاء أول نسخة احتياطية
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الاسم</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">النوع</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right hidden md:table-cell">الجداول</TableHead>
                        <TableHead className="text-right hidden md:table-cell">السجلات</TableHead>
                        <TableHead className="text-right hidden lg:table-cell">الحجم</TableHead>
                        <TableHead className="text-right hidden lg:table-cell">التاريخ</TableHead>
                        <TableHead className="text-right">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backups.slice((currentPage - 1) * 10, currentPage * 10).map((backup) => (
                        <TableRow key={backup.id} data-testid={`row-backup-${backup.id}`}>
                          <TableCell className="font-medium text-xs sm:text-sm">{backup.name}</TableCell>
                          <TableCell className="hidden sm:table-cell text-xs sm:text-sm">{getTypeLabel(backup.type)}</TableCell>
                          <TableCell>{getStatusBadge(backup.status)}</TableCell>
                          <TableCell className="text-xs hidden md:table-cell">
                            {backup.tableCount || parseTablesList(backup.tables).length} جدول
                          </TableCell>
                          <TableCell className="text-xs hidden md:table-cell">
                            {backup.rowCount?.toLocaleString() || "-"}
                          </TableCell>
                          <TableCell className="text-xs hidden lg:table-cell">
                            {formatFileSize(backup.fileSize)}
                          </TableCell>
                          <TableCell className="text-[10px] sm:text-xs hidden lg:table-cell">
                            {formatDate(backup.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 sm:h-8 sm:w-8"
                                onClick={() => {
                                  setSelectedBackup(backup);
                                  setIsDetailsDialogOpen(true);
                                }}
                                title="تفاصيل"
                                data-testid={`button-details-backup-${backup.id}`}
                              >
                                <Eye className="w-4 h-4 text-blue-500" />
                              </Button>
                              {backup.status === "completed" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 sm:h-8 sm:w-8"
                                    onClick={() => handleDownload(backup)}
                                    title="تحميل"
                                    data-testid={`button-download-backup-${backup.id}`}
                                  >
                                    <Download className="w-4 h-4 text-green-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 sm:h-8 sm:w-8"
                                    onClick={() => {
                                      setSelectedBackup(backup);
                                      setIsRestoreDialogOpen(true);
                                    }}
                                    title="استعادة"
                                    data-testid={`button-restore-backup-${backup.id}`}
                                  >
                                    <RotateCcw className="w-4 h-4 text-purple-500" />
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 sm:h-8 sm:w-8"
                                onClick={() => {
                                  setSelectedBackup(backup);
                                  setIsDeleteDialogOpen(true);
                                }}
                                title="حذف"
                                data-testid={`button-delete-backup-${backup.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination
                  currentPage={currentPage}
                  totalItems={backups.length}
                  itemsPerPage={10}
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileJson className="w-5 h-5" />
                تفاصيل النسخة الاحتياطية
              </DialogTitle>
            </DialogHeader>
            {selectedBackup && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">الاسم</Label>
                    <p className="text-sm font-medium">{selectedBackup.name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">النوع</Label>
                    <p className="text-sm">{getTypeLabel(selectedBackup.type)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">الحالة</Label>
                    <div className="mt-1">{getStatusBadge(selectedBackup.status)}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">الحجم</Label>
                    <p className="text-sm">{formatFileSize(selectedBackup.fileSize)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">عدد الجداول</Label>
                    <p className="text-sm">{selectedBackup.tableCount || parseTablesList(selectedBackup.tables).length}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">عدد السجلات</Label>
                    <p className="text-sm">{selectedBackup.rowCount?.toLocaleString() || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">تاريخ الإنشاء</Label>
                    <p className="text-sm">{formatDate(selectedBackup.createdAt)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">تاريخ الاكتمال</Label>
                    <p className="text-sm">{formatDate(selectedBackup.completedAt)}</p>
                  </div>
                </div>

                {selectedBackup.restoredAt && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-2 text-purple-700 text-sm font-medium">
                      <RotateCcw className="w-4 h-4" />
                      تمت الاستعادة: {formatDate(selectedBackup.restoredAt)}
                    </div>
                  </div>
                )}

                {selectedBackup.errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
                      <XCircle className="w-4 h-4" />
                      خطأ: {selectedBackup.errorMessage}
                    </div>
                  </div>
                )}

                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">الجداول المنسوخة</Label>
                  <ScrollArea className="h-[150px] mt-2">
                    <div className="flex flex-wrap gap-1">
                      {parseTablesList(selectedBackup.tables).map(t => (
                        <Badge key={t} variant="outline" className="text-[10px] font-mono">{t}</Badge>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div className="flex gap-2 pt-2">
                  {selectedBackup.status === "completed" && (
                    <>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleDownload(selectedBackup)}
                        data-testid="button-dialog-download"
                      >
                        <Download className="w-4 h-4 ml-2" />
                        تحميل
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setIsDetailsDialogOpen(false);
                          setIsRestoreDialogOpen(true);
                        }}
                        data-testid="button-dialog-restore"
                      >
                        <RotateCcw className="w-4 h-4 ml-2" />
                        استعادة
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Restore Confirmation */}
        <AlertDialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="w-5 h-5" />
                تأكيد استعادة النسخة الاحتياطية
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  هل أنت متأكد من استعادة النسخة الاحتياطية <strong>"{selectedBackup?.name}"</strong>؟
                </p>
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-800 text-sm space-y-1">
                  <p className="font-bold flex items-center gap-1"><Shield className="w-4 h-4" /> تحذير مهم:</p>
                  <p>سيتم استبدال جميع البيانات الحالية في الجداول المحددة ببيانات النسخة الاحتياطية.</p>
                  <p>يُنصح بإنشاء نسخة احتياطية جديدة قبل الاستعادة.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedBackup && restoreMutation.mutate(selectedBackup.id)}
                className="bg-orange-500 hover:bg-orange-600"
                disabled={restoreMutation.isPending}
              >
                {restoreMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                تأكيد الاستعادة
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>حذف النسخة الاحتياطية</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف النسخة الاحتياطية "{selectedBackup?.name}"؟
                لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedBackup && deleteMutation.mutate(selectedBackup.id)}
                className="bg-red-500 hover:bg-red-600"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
