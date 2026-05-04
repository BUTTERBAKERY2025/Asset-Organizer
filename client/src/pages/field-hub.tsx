import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, ClipboardList, ClipboardCheck, Camera, MapPin, AlertTriangle, Plus, ArrowLeft } from "lucide-react";
import type { ConstructionProject, ProjectDailyLog, FieldChecklist } from "@shared/schema";

interface FieldHubData {
  projects: ConstructionProject[];
  todayLogs: ProjectDailyLog[];
  openChecklists: FieldChecklist[];
  recentPhotos: any[];
  stats: { openChecklists: number; overdueChecklists: number; logsToday: number };
}

export default function FieldHubPage() {
  const { data, isLoading } = useQuery<FieldHubData>({
    queryKey: ["/api/field-hub"],
    refetchInterval: 60000,
  });

  return (
    <Layout>
      <div className="container mx-auto px-3 sm:px-6 py-4 max-w-5xl" dir="rtl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-field-hub-title">
              <Briefcase className="h-6 w-6 text-primary" /> مركز الميدان
            </h1>
            <p className="text-sm text-muted-foreground">المهام اليومية لمهندس الموقع</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
          <Card data-testid="stat-open-checklists">
            <CardContent className="p-3 text-center">
              <ClipboardList className="h-5 w-5 mx-auto mb-1 text-blue-600" />
              <div className="text-2xl font-bold" data-testid="text-open-count">{data?.stats.openChecklists ?? 0}</div>
              <div className="text-xs text-muted-foreground">قوائم مفتوحة</div>
            </CardContent>
          </Card>
          <Card data-testid="stat-overdue-checklists">
            <CardContent className="p-3 text-center">
              <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-red-600" />
              <div className="text-2xl font-bold text-red-700" data-testid="text-overdue-count">{data?.stats.overdueChecklists ?? 0}</div>
              <div className="text-xs text-muted-foreground">متأخرة</div>
            </CardContent>
          </Card>
          <Card data-testid="stat-logs-today">
            <CardContent className="p-3 text-center">
              <ClipboardCheck className="h-5 w-5 mx-auto mb-1 text-green-600" />
              <div className="text-2xl font-bold" data-testid="text-logs-today">{data?.stats.logsToday ?? 0}</div>
              <div className="text-xs text-muted-foreground">يوميات اليوم</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <Link href="/construction/daily-logs/new" data-testid="link-new-daily-log">
            <Button className="w-full h-14 gap-2" variant="default">
              <Plus className="h-5 w-5" /> يومية جديدة
            </Button>
          </Link>
          <Link href="/field-checklists/templates" data-testid="link-checklist-templates">
            <Button className="w-full h-14 gap-2" variant="outline">
              <ClipboardList className="h-5 w-5" /> قوالب القوائم
            </Button>
          </Link>
        </div>

        {/* Open checklists */}
        <Card className="mb-4">
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-5 w-5" /> قوائم التحقق المفتوحة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {isLoading ? (
              <div className="text-sm text-muted-foreground">جارٍ التحميل...</div>
            ) : (data?.openChecklists?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">لا توجد قوائم تحقق مفتوحة</div>
            ) : (
              <div className="space-y-2">
                {data!.openChecklists.map((c) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const overdue = c.dueDate && c.dueDate < today;
                  const progress = c.totalCount > 0 ? Math.round(((c.passCount + c.failCount + c.naCount) / c.totalCount) * 100) : 0;
                  return (
                    <Link key={c.id} href={`/field-checklists/${c.id}`} data-testid={`link-checklist-${c.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm flex items-center gap-2">
                            {c.title}
                            {overdue && <Badge variant="destructive" className="text-xs">متأخرة</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{c.category}</Badge>
                            <span>{progress}% — {c.passCount + c.failCount + c.naCount}/{c.totalCount}</span>
                            {c.dueDate && <span>· يستحق {c.dueDate}</span>}
                          </div>
                        </div>
                        <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's logs */}
        <Card className="mb-4">
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" /> يوميات اليوم
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {(data?.todayLogs?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">لا توجد يوميات مسجّلة اليوم</div>
            ) : (
              <div className="space-y-2">
                {data!.todayLogs.map((log) => (
                  <Link key={log.id} href={`/construction/daily-logs/${log.id}`} data-testid={`link-daily-log-${log.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{log.supervisorName} — {log.workDescription?.slice(0, 60)}</div>
                        <div className="text-xs text-muted-foreground">
                          {log.workersCount || 0} عامل · {log.status === "submitted" ? "مرسلة" : "مسوّدة"}
                        </div>
                      </div>
                      <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent photos */}
        {(data?.recentPhotos?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="h-5 w-5" /> أحدث الصور
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {data!.recentPhotos.slice(0, 12).map((p: any) => (
                  <a key={p.id} href={p.photo_url || p.photoUrl} target="_blank" rel="noreferrer" className="block" data-testid={`photo-recent-${p.id}`}>
                    <div className="relative aspect-square rounded overflow-hidden border">
                      <img src={p.photo_url || p.photoUrl} alt="" className="w-full h-full object-cover" />
                      {(p.gps_latitude || p.gpsLatitude) && (
                        <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5" /> GPS
                        </div>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Projects */}
        {(data?.projects?.length ?? 0) > 0 && (
          <Card className="mt-4">
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-5 w-5" /> مشاريعي
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data!.projects.slice(0, 8).map((p) => (
                  <Link key={p.id} href={`/construction-projects/${p.id}`} data-testid={`link-project-${p.id}`}>
                    <div className="p-3 rounded-lg border hover:bg-accent cursor-pointer">
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {p.location || "—"} · {p.status}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
