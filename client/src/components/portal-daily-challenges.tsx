import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Gift, RefreshCw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type DailyChallenge = {
  id: number;
  name: string;
  challengeType: string;
  target: number;
  actual: number;
  progress: number;
  expectedPoints: number;
};

type ChallengeJournal = {
  id: number;
  shiftType: string | null;
  challenges: DailyChallenge[];
};

type TodayChallenges = {
  date: string;
  settingsActive: boolean;
  journals: ChallengeJournal[];
};

const SHIFT_LABELS: Record<string, string> = {
  morning: "الوردية الصباحية",
  evening: "الوردية المسائية",
  night: "الوردية الليلية",
  day: "الوردية النهارية",
  open: "وردية الافتتاح",
  close: "وردية الإغلاق",
};

const CHALLENGE_TYPE_LABELS: Record<string, string> = {
  sales: "المبيعات",
  sales_amount: "قيمة المبيعات",
  revenue: "الإيراد",
  transactions: "عدد العمليات",
  transaction_count: "عدد العمليات",
  customers: "عدد العملاء",
  customer_count: "عدد العملاء",
  items: "عدد المنتجات",
  items_sold: "عدد المنتجات",
};

const number = (value: number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 1 }).format(Number(value || 0));
const shiftLabel = (shift: string | null) => shift ? (SHIFT_LABELS[shift.toLowerCase()] || shift) : "وردية اليوم";
const typeLabel = (type: string) => CHALLENGE_TYPE_LABELS[type.toLowerCase()] || "تحدٍ يومي";
const unitFor = (type: string) => ["transactions", "transaction_count", "customers", "customer_count"].includes(type.toLowerCase()) ? "عميل" : "ر.س";

async function fetchTodayChallenges(): Promise<TodayChallenges> {
  const response = await fetch("/api/my/challenges/today", {
    credentials: "include",
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  if (!response.ok) {
    throw new Error("تعذر تحميل التحديات اليومية");
  }
  return response.json();
}

export function PortalDailyChallenges() {
  const { data, error, isLoading, isFetching, refetch } = useQuery<TodayChallenges>({
    queryKey: ["/api/my/challenges/today"],
    queryFn: fetchTodayChallenges,
    staleTime: 0,
    refetchOnMount: "always",
  });

  if (isLoading) {
    return (
      <Card data-testid="card-daily-challenges-loading">
        <CardContent className="p-4 space-y-3">
          <div className="h-5 w-40 rounded bg-muted animate-pulse" />
          <div className="h-20 rounded-lg bg-muted/70 animate-pulse" />
          <div className="h-20 rounded-lg bg-muted/70 animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30" data-testid="card-daily-challenges-error">
        <CardContent className="p-5 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <span>تعذر تحميل تقدم التحديات اليومية.</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-daily-challenges">إعادة المحاولة</Button>
        </CardContent>
      </Card>
    );
  }

  if (!data?.settingsActive) {
    return (
      <Card className="border-muted-foreground/20 bg-muted/30" data-testid="card-daily-challenges-disabled">
        <CardContent className="p-5 flex gap-3 items-start">
          <Target className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-sm">نظام النقاط غير مفعّل</h3>
            <p className="text-xs text-muted-foreground mt-1">لن تُحسب نقاط التحديات اليومية إلى أن يتم تفعيل النظام.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const journals = data.journals || [];
  const challenges = journals.flatMap((journal) => journal.challenges.map((challenge) => ({ journal, challenge })));

  if (!challenges.length) {
    return (
      <Card data-testid="card-daily-challenges-empty">
        <CardContent className="p-6 text-center">
          <Target className="h-7 w-7 mx-auto mb-2 text-muted-foreground/70" />
          <h3 className="font-semibold text-sm">لا توجد تحديات مسندة اليوم</h3>
          <p className="text-xs text-muted-foreground mt-1">سيظهر تقدمك هنا عند إضافة تحديات لورديتك أو حفظ سجل اليوم.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20" data-testid="card-daily-challenges">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-2">
            <div className="p-2 rounded-lg bg-primary/10 h-fit"><Target className="h-4 w-4 text-primary" /></div>
            <div>
              <h2 className="font-semibold text-sm">تحديات اليوم</h2>
              <p className="text-xs text-muted-foreground mt-0.5">تقدمك المسجل ليوم {data.date}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()} disabled={isFetching} aria-label="تحديث التحديات" data-testid="button-refresh-daily-challenges">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="space-y-3">
          {challenges.map(({ journal, challenge }) => {
            const progress = Math.min(100, Math.max(0, Number(challenge.progress || 0)));
            return (
              <div key={`${journal.id}-${challenge.id}`} className="rounded-lg border bg-card p-3 space-y-2.5" data-testid={`daily-challenge-${challenge.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm">{challenge.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{shiftLabel(journal.shiftType)}</div>
                  </div>
                  <div className="text-end shrink-0">
                    <div className="text-sm font-bold tabular-nums text-primary">{number(challenge.actual)} <span className="text-muted-foreground font-normal">/ {number(challenge.target)} {unitFor(challenge.challengeType)}</span></div>
                    <div className="text-[11px] text-muted-foreground">{Math.round(progress)}٪ من الهدف</div>
                  </div>
                </div>
                <Progress value={progress} className="h-2" aria-label={`تقدم ${challenge.name}: ${Math.round(progress)} بالمئة`} />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">النوع: {typeLabel(challenge.challengeType)}</span>
                  <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400"><Gift className="h-3.5 w-3.5" /> {number(challenge.expectedPoints)} نقطة متوقعة</span>
                </div>
              </div>
            );
          })}
        </div>
        {journals.some((journal) => journal.id === 0) && (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">بعض التحديات معروضة قبل حفظ سجل ورديتك؛ يبدأ احتساب تقدمها من الصفر.</p>
        )}
        <p className="border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">يعتمد التقدم على سجلات وردياتك المحفوظة، ويتحدث عند فتح التبويب أو الضغط على تحديث. النقاط تقدير لكل يومية على حدة وليست إجمالي نقاط اليوم، ولا تُعتمد إلا بعد اعتماد اليومية.</p>
      </CardContent>
    </Card>
  );
}