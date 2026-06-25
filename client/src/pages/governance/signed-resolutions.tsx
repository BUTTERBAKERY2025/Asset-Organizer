import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  Search,
  FileSignature,
  Printer,
  Loader2,
  ScrollText,
  Gavel,
  Users,
  FileText,
  Filter,
} from "lucide-react";
import type { BoardResolution, AssemblyResolution, MeetingMinutes } from "@shared/schema";
import { printBoardResolutionWithSignatures, type VotingTokenData } from "@/lib/board-resolution-print";
import { printAssemblyResolution, type PrintResolution } from "@/lib/assembly-resolution-print";

type SourceType = "board" | "assembly" | "minutes";

interface UnifiedRow {
  key: string;
  source: SourceType;
  id: number;
  number: string;
  title: string;
  typeLabel: string;
  status: string;
  date: Date | null;
  raw: BoardResolution | AssemblyResolution | MeetingMinutes;
}

const sourceMeta: Record<SourceType, { label: string; icon: any; color: string; bg: string; border: string }> = {
  board: { label: "قرار مجلس إدارة", icon: Gavel, color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200" },
  assembly: { label: "قرار جمعية عمومية", icon: Users, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  minutes: { label: "محضر جمعية", icon: ScrollText, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
};

const boardTypeLabel = (t?: string | null) =>
  t === "extraordinary" || t === "extraordinary_assembly" ? "غير عادي"
  : t === "general_assembly" || t === "ordinary_assembly" ? "جمعية عادية"
  : t === "emergency" ? "طارئ"
  : t === "administrative" ? "إداري"
  : t === "financial" ? "مالي"
  : t === "circular" ? "بالتمرير"
  : "عادي";

const assemblyTypeLabel = (t?: string | null) =>
  t === "extraordinary" ? "جمعية غير عادية" : "جمعية عادية";

const statusLabel = (s?: string | null) =>
  s === "approved" ? "معتمد"
  : s === "implemented" ? "منفذ"
  : s === "signed" ? "موقّع"
  : s === "archived" ? "مؤرشف"
  : s || "";

const fmtDate = (d: Date | null) =>
  d ? d.toLocaleDateString("en-GB") : "-";

export default function SignedResolutionsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | SourceType>("all");
  const [printingKey, setPrintingKey] = useState<string | null>(null);

  const { data: boardResolutions = [], isLoading: loadingBoard } = useQuery<BoardResolution[]>({
    queryKey: ["/api/governance/resolutions"],
  });
  const { data: assemblyResolutions = [], isLoading: loadingAssembly } = useQuery<AssemblyResolution[]>({
    queryKey: ["/api/governance/assembly-resolutions"],
  });
  const { data: minutes = [], isLoading: loadingMinutes } = useQuery<MeetingMinutes[]>({
    queryKey: ["/api/governance/minutes"],
  });

  const isLoading = loadingBoard || loadingAssembly || loadingMinutes;

  const rows = useMemo<UnifiedRow[]>(() => {
    const out: UnifiedRow[] = [];

    for (const r of boardResolutions) {
      const finalized = r.status === "approved" || r.status === "implemented" || r.isLocked;
      if (!finalized) continue;
      out.push({
        key: `board-${r.id}`,
        source: "board",
        id: r.id,
        number: r.resolutionNumber,
        title: r.title,
        typeLabel: boardTypeLabel(r.resolutionType),
        status: r.status || "",
        date: r.approvedAt ? new Date(r.approvedAt) : r.proposedAt ? new Date(r.proposedAt) : null,
        raw: r,
      });
    }

    for (const r of assemblyResolutions) {
      const finalized = r.status === "approved" || r.status === "implemented" || r.isLocked;
      if (!finalized) continue;
      out.push({
        key: `assembly-${r.id}`,
        source: "assembly",
        id: r.id,
        number: r.resolutionNumber,
        title: r.title,
        typeLabel: assemblyTypeLabel(r.assemblyType),
        status: r.status || "",
        date: r.approvedAt ? new Date(r.approvedAt) : r.proposedAt ? new Date(r.proposedAt) : null,
        raw: r,
      });
    }

    for (const m of minutes) {
      const finalized = m.status === "signed" || m.status === "archived" || m.isLocked;
      if (!finalized) continue;
      out.push({
        key: `minutes-${m.id}`,
        source: "minutes",
        id: m.id,
        number: m.minutesNumber,
        title: m.summary || m.minutesNumber,
        typeLabel: "محضر اجتماع",
        status: m.status || "",
        date: m.lockedAt ? new Date(m.lockedAt) : m.createdAt ? new Date(m.createdAt) : null,
        raw: m,
      });
    }

    out.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    return out;
  }, [boardResolutions, assemblyResolutions, minutes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.source !== filter) return false;
      if (!q) return true;
      return (
        r.number.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.typeLabel.toLowerCase().includes(q)
      );
    });
  }, [rows, search, filter]);

  const counts = useMemo(() => ({
    all: rows.length,
    board: rows.filter((r) => r.source === "board").length,
    assembly: rows.filter((r) => r.source === "assembly").length,
    minutes: rows.filter((r) => r.source === "minutes").length,
  }), [rows]);

  const handlePrint = async (row: UnifiedRow) => {
    if (row.source === "minutes") {
      setLocation("/governance/assembly-minutes");
      return;
    }
    setPrintingKey(row.key);
    try {
      if (row.source === "board") {
        const res = await fetch(`/api/governance/resolutions/${row.id}/voting-tokens`, { credentials: "include" });
        if (!res.ok) throw new Error("tokens");
        const tokens = (await res.json()) as VotingTokenData[];
        printBoardResolutionWithSignatures(row.raw as BoardResolution, Array.isArray(tokens) ? tokens : []);
      } else {
        await printAssemblyResolution(row.raw as unknown as PrintResolution);
      }
    } catch (e) {
      toast({
        title: "تعذّرت الطباعة",
        description: "حدث خطأ أثناء تجهيز المستند للطباعة. حاول مرة أخرى.",
        variant: "destructive",
      });
    } finally {
      setPrintingKey(null);
    }
  };

  const filterTabs: { id: "all" | SourceType; label: string; count: number }[] = [
    { id: "all", label: "الكل", count: counts.all },
    { id: "board", label: "مجلس الإدارة", count: counts.board },
    { id: "assembly", label: "الجمعية العمومية", count: counts.assembly },
    { id: "minutes", label: "محاضر الجمعيات", count: counts.minutes },
  ];

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <FileSignature className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="text-page-title">القرارات الموقعة</h1>
              <p className="text-sm text-gray-500">جميع القرارات المعتمدة والمحاضر الموقّعة — جاهزة للطباعة بالتوقيعات</p>
            </div>
          </div>
          <Link href="/governance">
            <Button variant="outline" className="gap-2" data-testid="button-back-governance">
              <ChevronLeft className="h-4 w-4" />
              عودة للحوكمة
            </Button>
          </Link>
        </div>

        {/* Filters + search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                {filterTabs.map((t) => (
                  <Button
                    key={t.id}
                    size="sm"
                    variant={filter === t.id ? "default" : "outline"}
                    className={filter === t.id ? "bg-amber-600 hover:bg-amber-700 gap-2" : "gap-2"}
                    onClick={() => setFilter(t.id)}
                    data-testid={`button-filter-${t.id}`}
                  >
                    {t.id === "all" ? <Filter className="h-3.5 w-3.5" /> : null}
                    {t.label}
                    <Badge variant="secondary" className="ml-1">{t.count}</Badge>
                  </Button>
                ))}
              </div>
              <div className="relative md:w-72">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث برقم القرار أو العنوان..."
                  className="pr-9"
                  data-testid="input-search"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-600" />
              النتائج
              <Badge variant="secondary" data-testid="text-results-count">{filtered.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="mr-2">جارٍ التحميل...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400" data-testid="empty-state">
                <FileSignature className="h-12 w-12 mb-3 opacity-40" />
                <p className="font-medium">لا توجد قرارات موقّعة مطابقة</p>
                <p className="text-sm">ستظهر هنا القرارات المعتمدة والمحاضر الموقّعة فقط.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((row) => {
                  const meta = sourceMeta[row.source];
                  const Icon = meta.icon;
                  const printing = printingKey === row.key;
                  return (
                    <div
                      key={row.key}
                      className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between ${meta.border}`}
                      data-testid={`row-resolution-${row.key}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.bg} ${meta.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-bold text-gray-900" data-testid={`text-number-${row.key}`}>
                              {row.number}
                            </span>
                            <Badge className={`${meta.bg} ${meta.color} border ${meta.border} hover:${meta.bg}`}>
                              {meta.label}
                            </Badge>
                            <Badge variant="outline">{row.typeLabel}</Badge>
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{statusLabel(row.status)}</Badge>
                          </div>
                          <p className="mt-1 font-medium text-gray-800 line-clamp-2" data-testid={`text-title-${row.key}`}>
                            {row.title}
                          </p>
                          <p className="text-xs text-gray-400">التاريخ: {fmtDate(row.date)}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                        <Button
                          className="gap-2 bg-amber-600 hover:bg-amber-700"
                          onClick={() => handlePrint(row)}
                          disabled={printing}
                          data-testid={`button-print-${row.key}`}
                        >
                          {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                          {row.source === "minutes" ? "فتح المحضر للطباعة" : "طباعة بالتوقيع"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
