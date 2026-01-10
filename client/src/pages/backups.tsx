import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExportButtons } from "@/components/export-buttons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TablePagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Trash2, Loader2, Database, Clock, CheckCircle, XCircle, HardDrive } from "lucide-react";
import { SettingsBreadcrumb } from "@/components/settings-breadcrumb";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { Backup } from "@shared/schema";

const exportColumns = [
  { header: "اسم النسخة", key: "name", width: 25 },
  { header: "النوع", key: "type", width: 12 },
  { header: "الحالة", key: "status", width: 12 },
  { header: "تاريخ الإنشاء", key: "createdAt", width: 18 },
  { header: "الجداول", key: "tables", width: 30 },
];

export default function BackupsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [backupName, setBackupName] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: backups = [], isLoading } = useQuery<Backup[]>({
    queryKey: ["/api/backups"],
    queryFn: async () => {
      const res = await fetch("/api/backups");
      if (!res.ok) throw new Error("Failed to fetch backups");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type: "manual" }),
      });
      if (!res.ok) throw new Error("Failed to create backup");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
      toast({ title: "تم إنشاء النسخة الاحتياطية بنجاح" });
      setIsCreateDialogOpen(false);
      setBackupName("");
    },
    onError: () => {
      toast({ title: "خطأ في إنشاء النسخة الاحتياطية", variant: "destructive" });
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

  const handleCreate = () => {
    createMutation.mutate(backupName || `نسخة احتياطية - ${new Date().toLocaleDateString('en-GB')}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500 text-white"><CheckCircle className="w-3 h-3 ml-1" />مكتملة</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500 text-white"><Clock className="w-3 h-3 ml-1" />قيد التنفيذ</Badge>;
      case "failed":
        return <Badge className="bg-red-500 text-white"><XCircle className="w-3 h-3 ml-1" />فشلت</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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

  const parseTablesList = (tables: string | null) => {
    if (!tables) return [];
    try {
      return JSON.parse(tables);
    } catch {
      return [];
    }
  };

  return (
    <Layout>
      <div className="flex flex-col space-y-6">
        <SettingsBreadcrumb currentPage="النسخ الاحتياطية" currentIcon={HardDrive} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
              النسخ الاحتياطية
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              إدارة النسخ الاحتياطية لقاعدة البيانات
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 min-h-[44px] sm:h-9 sm:min-h-0 w-full sm:w-auto" data-testid="button-create-backup">
                <Plus className="w-4 h-4 ml-2" />
                إنشاء نسخة احتياطية
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إنشاء نسخة احتياطية جديدة</DialogTitle>
                <DialogDescription>
                  سيتم إنشاء نسخة احتياطية من جميع بيانات النظام
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="backup-name" className="text-sm sm:text-base">اسم النسخة (اختياري)</Label>
                  <Input
                    id="backup-name"
                    value={backupName}
                    onChange={(e) => setBackupName(e.target.value)}
                    placeholder="مثال: نسخة قبل التحديث"
                    className="h-11 min-h-[44px] sm:h-10 sm:min-h-0"
                    data-testid="input-backup-name"
                  />
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                <Button variant="outline" className="h-11 min-h-[44px] sm:h-9 sm:min-h-0 w-full sm:w-auto" onClick={() => setIsCreateDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending} className="h-11 min-h-[44px] sm:h-9 sm:min-h-0 w-full sm:w-auto" data-testid="button-confirm-backup">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                  إنشاء النسخة
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6 md:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">إجمالي النسخ</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold">{backups.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6 md:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">النسخ الناجحة</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold">
                {backups.filter(b => b.status === "completed").length}
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6 md:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">آخر نسخة</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              <div className="text-xs sm:text-sm">
                {backups.length > 0 ? formatDate(backups[0].createdAt) : "لا توجد نسخ"}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <HardDrive className="w-4 h-4 sm:w-5 sm:h-5" />
                قائمة النسخ الاحتياطية
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <ExportButtons
                  data={backups}
                  columns={exportColumns}
                  fileName="النسخ_الاحتياطية"
                  title="تقرير النسخ الاحتياطية"
                  subtitle="قائمة جميع النسخ الاحتياطية في النظام"
                  sheetName="النسخ الاحتياطية"
                  disabled={isLoading}
                />
                <Badge variant="outline" className="text-xs" data-testid="badge-total-backups">
                  إجمالي: {backups.length} نسخة احتياطية
                </Badge>
              </div>
            </div>
            <CardDescription className="text-xs sm:text-sm mt-2">
              جميع النسخ الاحتياطية المحفوظة في النظام
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد نسخ احتياطية</p>
                <p className="text-sm mt-2">أنشئ نسخة احتياطية لحماية بياناتك</p>
              </div>
            ) : (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">تاريخ الإنشاء</TableHead>
                    <TableHead className="text-right">الجداول</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.slice((currentPage - 1) * 10, currentPage * 10).map((backup) => (
                    <TableRow key={backup.id} data-testid={`row-backup-${backup.id}`}>
                      <TableCell className="font-medium">{backup.name}</TableCell>
                      <TableCell>{getTypeLabel(backup.type)}</TableCell>
                      <TableCell>{getStatusBadge(backup.status)}</TableCell>
                      <TableCell className="text-sm">{formatDate(backup.createdAt)}</TableCell>
                      <TableCell className="text-sm">
                        {parseTablesList(backup.tables).length} جدول
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0"
                          onClick={() => {
                            setSelectedBackup(backup);
                            setIsDeleteDialogOpen(true);
                          }}
                          data-testid={`button-delete-backup-${backup.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
