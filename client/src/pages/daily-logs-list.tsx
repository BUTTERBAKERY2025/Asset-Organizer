import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Plus, Loader2, Eye, Pencil, Trash2, Printer, Calendar, FileText, FileDown, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import type { ProjectDailyLog, ConstructionProject } from "@shared/schema";

const TRADE_LABELS: Record<string, string> = {
  paint: "دهانات",
  tiling: "سيراميك",
  hvac: "تكييف",
  plumbing: "سباكة",
  electrical: "كهرباء",
  gypsum: "جبس",
  kitchen_steel: "ستيل مطبخ",
  glass: "زجاج",
  mdf: "MDF",
  signage: "لافتات",
  other: "أخرى",
};

export default function DailyLogsListPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const { canCreate, canEdit, canDelete } = usePermissions();

  const canCreateLog = isAdmin || canCreate("project_daily_logs");
  const canEditLog = isAdmin || canEdit("project_daily_logs");
  const canDeleteLog = isAdmin || canDelete("project_daily_logs");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const queryUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (projectFilter && projectFilter !== "all") qs.set("projectId", projectFilter);
    const q = qs.toString();
    return `/api/construction/daily-logs${q ? "?" + q : ""}`;
  }, [from, to, projectFilter]);

  const { data: logs = [], isLoading } = useQuery<ProjectDailyLog[]>({
    queryKey: [queryUrl],
  });

  const { data: projects = [] } = useQuery<ConstructionProject[]>({
    queryKey: ["/api/construction/projects"],
  });

  const projectMap = useMemo(() => {
    const m = new Map<number, ConstructionProject>();
    projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  const handleWhatsAppShare = (log: ProjectDailyLog) => {
    const projectTitle = projectMap.get(log.projectId)?.title || `#${log.projectId}`;
    const trade = (log as any).mainTrade
      ? TRADE_LABELS[(log as any).mainTrade] || (log as any).mainTrade
      : null;
    const lines = [
      `*يومية أعمال موقع*`,
      `📍 المشروع: ${projectTitle}`,
      `📅 التاريخ: ${log.logDate}`,
      `👤 المشرف: ${log.supervisorName}`,
      log.workersCount ? `👷 عدد العمالة: ${log.workersCount}` : null,
      trade ? `🔧 التشطيب: ${trade}` : null,
      ``,
      `*ملخص الأعمال:*`,
      log.workDescription,
      ``,
      `🔗 رابط اليومية: ${window.location.origin}/construction/daily-logs/${log.id}/print`,
    ].filter(Boolean).join("\n");
    const url = `https://wa.me/?text=${encodeURIComponent(lines)}`;
    window.open(url, "_blank");
  };

  const openPrint = (id: number, autoPrint = false) => {
    const url = `/construction/daily-logs/${id}/print${autoPrint ? "?autoprint=1" : ""}`;
    window.open(url, "_blank");
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/construction/daily-logs/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction/daily-logs"] });
      toast({ title: "تم حذف اليومية بنجاح" });
      setDeletingId(null);
    },
    onError: () => {
      toast({ title: "فشل في حذف اليومية", variant: "destructive" });
    },
  });

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6" dir="rtl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Calendar className="h-7 w-7" />
              يوميات أعمال المشاريع
            </h1>
            <p className="text-muted-foreground mt-1">
              سجل يومي للأعمال المنفذة بكل مشروع مع الصور وملاحظات الإشراف
            </p>
          </div>
          {canCreateLog && (
            <Link href="/construction/daily-logs/new">
              <Button data-testid="button-create-log">
                <Plus className="h-4 w-4 ml-2" />
                إضافة يومية جديدة
              </Button>
            </Link>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="project-filter">المشروع</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger id="project-filter" data-testid="select-project-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المشاريع</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[180px]">
                <Label htmlFor="from-date">من تاريخ</Label>
                <Input
                  id="from-date"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  data-testid="input-from-date"
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <Label htmlFor="to-date">إلى تاريخ</Label>
                <Input
                  id="to-date"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  data-testid="input-to-date"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setProjectFilter("all");
                }}
                data-testid="button-clear-filters"
              >
                إعادة ضبط
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader>
            <CardTitle>اليوميات ({logs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد يوميات في النطاق المحدد</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">المشروع</TableHead>
                      <TableHead className="text-right">المشرف</TableHead>
                      <TableHead className="text-right">الأعمال</TableHead>
                      <TableHead className="text-right">العمالة</TableHead>
                      <TableHead className="text-right">التشطيب</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                        <TableCell className="font-mono text-sm">{log.logDate}</TableCell>
                        <TableCell className="font-medium">
                          {projectMap.get(log.projectId)?.title || `#${log.projectId}`}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{log.supervisorName}</div>
                          {log.supervisorRole && (
                            <div className="text-xs text-muted-foreground">{log.supervisorRole}</div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate" title={log.workDescription}>
                          {log.workDescription}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{log.workersCount || 0}</Badge>
                        </TableCell>
                        <TableCell>
                          {(log as any).mainTrade ? (
                            <Badge variant="outline" data-testid={`badge-trade-${log.id}`}>
                              {TRADE_LABELS[(log as any).mainTrade] || (log as any).mainTrade}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            <Button
                              size="icon"
                              variant="ghost"
                              title="مشاركة واتساب"
                              onClick={() => handleWhatsAppShare(log)}
                              data-testid={`button-whatsapp-${log.id}`}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="تصدير PDF"
                              onClick={() => openPrint(log.id, true)}
                              data-testid={`button-pdf-${log.id}`}
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="طباعة"
                              onClick={() => openPrint(log.id, true)}
                              data-testid={`button-print-${log.id}`}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Link href={`/construction/daily-logs/${log.id}`}>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="عرض"
                                data-testid={`button-view-${log.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            {canEditLog && (
                              <Link href={`/construction/daily-logs/${log.id}/edit`}>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title="تعديل"
                                  data-testid={`button-edit-${log.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                            {canDeleteLog && (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="حذف"
                                onClick={() => setDeletingId(log.id)}
                                data-testid={`button-delete-${log.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف اليومية؟ سيتم حذف جميع الصور المرفقة معها.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingId && deleteMutation.mutate(deletingId)}
                className="bg-destructive text-destructive-foreground"
                data-testid="button-confirm-delete"
              >
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
