import React, { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowUpLeft, Sparkles } from "lucide-react";
import type { OperationsCenterResponse, OperationsQueueItem } from "@shared/operations-center";
import { apiRequest, getHttpStatus } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  analyticsEvidencePeriod, analyticsNumber, analyticsSource, analyticsUnit, assistantContextKey, assistantRequest, assistantResponseMatches, assistantFailureLabel,
  finiteValue, periodLabel, validatedInsightHref, type AssistantInsight, type AssistantResponse, type PerformanceDays,
} from "./analytics-model";

export function assistantErrorMessage(error: unknown) {
  return assistantFailureLabel(getHttpStatus(error));
}

export function useOperationsAssistant(data: OperationsCenterResponse, actorId: string | undefined, days: PerformanceDays, refreshing = false) {
  const context = `${assistantContextKey(data, actorId, days)}:${refreshing}`;
  const mutation = useMutation({
    mutationFn: async (request: { context: string; body: ReturnType<typeof assistantRequest> }) => {
      const response = await apiRequest("POST", "/api/operations-center/insights", request.body);
      return { context: request.context, result: await response.json() as AssistantResponse };
    },
    retry: false,
  });
  // Context is also checked during render: old promises cannot flash a stale answer.
  useEffect(() => { mutation.reset(); }, [context]);
  const response = mutation.data?.context === context ? mutation.data.result : null;
  const matches = response ? assistantResponseMatches(response, data) : false;
  return {
    result: response && matches ? response : null,
    staleEvidence: !!response && !matches,
    error: mutation.variables?.context === context && mutation.isError ? assistantErrorMessage(mutation.error) : null,
    loading: mutation.variables?.context === context && mutation.isPending,
    refreshing,
    request: () => mutation.mutate({ context, body: assistantRequest(data, days) }),
  };
}
export type OperationsAssistantState = ReturnType<typeof useOperationsAssistant>;

export function AnalyticsAssistant({ data, assistant, open }: {
  data: OperationsCenterResponse; assistant: OperationsAssistantState;
  open: (href: string, branchId: string, item?: OperationsQueueItem) => void;
}) {
  const [linkError, setLinkError] = useState("");
  useEffect(() => { setLinkError(""); }, [assistant.result]);
  const review = (insight: AssistantInsight) => {
    const href = validatedInsightHref(insight, data, window.location.origin);
    if (!href) { setLinkError("رابط الدليل غير صالح أو لا يطابق النطاق والفترة؛ لم يتم فتحه."); return; }
    setLinkError("");
    const record = data.queue.find(row => row.sourceType === insight.sourceType && row.sourceId === insight.sourceId && row.branchId === insight.branchId);
    open(href, insight.branchId, record);
  };
  return <section aria-label="تحليل المساعد" className="space-y-3">
    <h3 className="flex items-center gap-2 text-sm font-bold"><Sparkles className="size-4 text-violet-700" />المساعد · قراءة مقترحة للأدلة</h3>
    <p className="text-xs leading-6 text-muted-foreground">طلب يدوي للفترة والنطاق الحاليين. نص المساعد ليس حقيقة تشغيلية ولا يثبت سببًا للتغير؛ راجع الدليل والمصدر قبل أي قرار. لا ينفذ هذا الطلب أي إجراء.</p>
    <p className="text-xs text-muted-foreground" dir="ltr">{periodLabel(data.analytics?.period)}</p>
    <Button variant="outline" size="sm" disabled={assistant.loading || assistant.refreshing || !data.analytics?.evidenceRevision} onClick={assistant.request}>{assistant.loading ? "جار تحليل أدلة الفترة…" : assistant.refreshing ? "جار تحديث الأدلة…" : "طلب تحليل مساعد للفترة"}</Button>
    {assistant.error && <p role="alert" className="text-xs leading-6 text-red-700">{assistant.error}</p>}
    {assistant.staleEvidence && <p role="status" className="text-xs text-amber-900">تغيرت الأدلة أثناء الطلب؛ لم نعرض استجابة قديمة. حدّث المركز ثم اطلب التحليل من جديد.</p>}
    {assistant.result && <div className="space-y-3" aria-live="polite">
      <p className="text-[11px] text-muted-foreground">استجابة المساعد · {new Intl.DateTimeFormat("ar-SA", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(assistant.result.generatedAt))}</p>
      {!assistant.result.insights.length && <p className="oc-panel p-3 text-xs leading-6">
        {assistant.result.status === "no_evidence" || assistant.result.status === "ready" ? "لا توجد أدلة مؤهلة كافية لتقديم قراءة مساعد لهذه الفترة والنطاق؛ لم نولّد تفسيرًا بديلًا."
          : assistant.result.status === "cooldown" ? `انتظر ${assistant.result.retryAfterSeconds || 60} ثانية قبل طلب تحليل جديد.`
          : assistant.result.status === "forbidden" ? "لا تملك صلاحية تحليل الأدلة لهذا النطاق."
          : "المساعد غير متاح الآن؛ لا توجد قراءة مؤكدة لعرضها."}
      </p>}
      {assistant.result.insights.map((insight, index) => <article className="oc-panel space-y-2 p-3" key={`${insight.sourceType}:${insight.sourceId}:${index}`}>
        <p className="text-[11px] font-bold text-violet-700">اقتراح المساعد · {data.branches.find(branch => branch.id === insight.branchId)?.name || "الفرع"}</p>
        <strong className="text-sm">{insight.title}</strong><p className="text-xs leading-6">{insight.explanation}</p>
        {insight.evidence && <div className="rounded-lg bg-violet-50 p-3 text-xs leading-6">
          <strong>الدليل المسجل: {insight.evidence.label}</strong>
          <p>{finiteValue(insight.evidence.value) ? `${analyticsNumber(insight.evidence.value)} ${analyticsUnit(insight.evidence.unit)}` : "القيمة الرقمية غير متاحة"} · الفترة: <span dir="ltr">{analyticsEvidencePeriod(insight.evidence.period)}</span></p>
          <p>المصدر: {analyticsSource(insight.evidence.source)}</p>
        </div>}
        <Button variant="outline" size="sm" onClick={() => review(insight)}>مراجعة المصدر <ArrowUpLeft className="mr-1 size-4" /></Button>
      </article>)}
    </div>}
    {linkError && <p role="alert" className="text-xs text-red-700">{linkError}</p>}
  </section>;
}