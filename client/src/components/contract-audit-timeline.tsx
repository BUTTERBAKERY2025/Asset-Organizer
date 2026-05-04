import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Pencil, Trash2, CheckCircle2, XCircle, Wallet, FileText,
  ShieldCheck, AlertTriangle, History, User as UserIcon,
} from "lucide-react";

type AuditEntry = {
  id: number;
  module: string;
  entityId: string;
  entityName: string | null;
  action: string;
  details: string | null;
  userId: string | null;
  userName: string | null;
  description: string | null;
  createdAt: string;
};

const ACTION_META: Record<string, { label: string; color: string; icon: any }> = {
  create: { label: "إنشاء", color: "bg-emerald-500", icon: Plus },
  update: { label: "تحديث", color: "bg-blue-500", icon: Pencil },
  delete: { label: "حذف", color: "bg-red-500", icon: Trash2 },
  approve: { label: "اعتماد", color: "bg-emerald-600", icon: CheckCircle2 },
  reject: { label: "رفض", color: "bg-red-600", icon: XCircle },
  mark_paid: { label: "صرف", color: "bg-violet-600", icon: Wallet },
  release_retention: { label: "إفراج ضمان", color: "bg-amber-600", icon: ShieldCheck },
  release_guarantee: { label: "إفراج ضمان بنكي", color: "bg-amber-600", icon: ShieldCheck },
  apply_ld: { label: "تطبيق غرامة", color: "bg-red-700", icon: AlertTriangle },
  waive_ld: { label: "إعفاء غرامة", color: "bg-gray-500", icon: ShieldCheck },
};

const MODULE_LABELS: Record<string, string> = {
  contracts: "عقد",
  payment_requests: "طلب صرف",
  contract_variations: "أمر تغيير",
  contract_milestones: "مرحلة",
  contract_guarantees: "ضمان بنكي",
  contract_retentions: "احتجاز",
  contract_ld: "غرامة تأخير",
};

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ContractAuditTimeline({ contractId }: { contractId: number }) {
  const { data, isLoading, error } = useQuery<AuditEntry[]>({
    queryKey: [`/api/construction/contracts/${contractId}/audit`],
    enabled: !!contractId,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <Card data-testid="card-audit-timeline">
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> سجل التدقيق</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="card-audit-timeline">
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> سجل التدقيق</CardTitle></CardHeader>
        <CardContent className="text-center text-red-600 py-6">تعذّر تحميل السجل</CardContent>
      </Card>
    );
  }

  const entries = data || [];

  return (
    <Card data-testid="card-audit-timeline">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <History className="h-5 w-5" />
            سجل التدقيق
          </span>
          <Badge variant="outline">{entries.length} حدث</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">لا توجد أحداث مسجلة بعد</p>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute right-5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-primary/30 via-primary/20 to-transparent" />

            <ul className="space-y-3" data-testid="list-audit-entries">
              {entries.map((e) => {
                const meta = ACTION_META[e.action] || { label: e.action, color: "bg-gray-400", icon: FileText };
                const Icon = meta.icon;
                let parsedDetails: any = null;
                try { parsedDetails = e.details ? JSON.parse(e.details) : null; } catch {}

                return (
                  <li key={e.id} className="relative pr-12" data-testid={`audit-entry-${e.id}`}>
                    {/* Dot */}
                    <div className={`absolute right-3 top-1.5 w-5 h-5 rounded-full ${meta.color} flex items-center justify-center text-white shadow-md ring-2 ring-background`}>
                      <Icon className="h-3 w-3" />
                    </div>

                    <div className="bg-muted/30 hover:bg-muted/50 transition-colors rounded-lg p-3 border">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className={`${meta.color} text-white border-0 text-xs`}>
                          {meta.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {MODULE_LABELS[e.module] || e.module}
                        </Badge>
                        {e.entityName && (
                          <span className="text-xs font-semibold">{e.entityName}</span>
                        )}
                        <span className="text-xs text-muted-foreground mr-auto">
                          {formatDate(e.createdAt)}
                        </span>
                      </div>

                      {e.description && (
                        <p className="text-sm" data-testid={`audit-desc-${e.id}`}>{e.description}</p>
                      )}

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        {e.userName && (
                          <span className="flex items-center gap-1">
                            <UserIcon className="h-3 w-3" />
                            {e.userName}
                          </span>
                        )}
                        {parsedDetails?.amount != null && (
                          <span>المبلغ: <strong>{Number(parsedDetails.amount).toLocaleString("ar-SA")} ر.س</strong></span>
                        )}
                        {parsedDetails?.invoiceNumber && (
                          <span>الفاتورة: {parsedDetails.invoiceNumber}</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
