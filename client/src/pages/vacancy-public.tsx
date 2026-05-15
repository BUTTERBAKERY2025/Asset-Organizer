import React, { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import ApplicationForm from "@/components/application-form";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function VacancyPublicPage() {
  const params = useParams();
  const slug = (params as any).slug as string;
  const [done, setDone] = useState<{ applicationNumber: string } | null>(null);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: [`/api/public/vacancies/${slug}`],
    queryFn: async () => {
      const r = await fetch(`/api/public/vacancies/${slug}`);
      if (!r.ok) throw new Error((await r.json()).error || "خطأ");
      return r.json();
    },
    retry: false,
  });

  const submitMut = useMutation({
    mutationFn: async (payload: any) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 90000);
      let r: Response;
      try {
        r = await fetch(`/api/public/vacancies/${slug}/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
      } catch (err: any) {
        clearTimeout(timer);
        if (err?.name === "AbortError") throw new Error("انتهت مهلة الإرسال. تأكد من الاتصال بالإنترنت وحاول مرة أخرى.");
        throw new Error("فشل الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً.");
      }
      clearTimeout(timer);
      if (!r.ok) {
        const fallback = r.status === 413 ? "حجم البيانات كبير جداً. الرجاء استخدام ملفات أصغر."
          : (r.status === 502 || r.status === 504) ? "الخادم لم يستجب. حاول لاحقاً."
          : `خطأ ${r.status}`;
        let msg = fallback;
        try { const j = await r.json(); if (j?.error) msg = j.error; } catch {}
        throw new Error(msg);
      }
      return r.json();
    },
    onSuccess: (d: any) => setDone({ applicationNumber: d.applicationNumber }),
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F5F0E6]" dir="rtl"><Loader2 className="w-8 h-8 animate-spin text-[#e67e22]" /></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E6] p-6" dir="rtl">
        <Card className="max-w-md w-full"><CardContent className="pt-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">الوظيفة غير متاحة</h2>
          <p className="text-gray-600">{(error as any).message}</p>
        </CardContent></Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E6] p-6" dir="rtl">
        <Card className="max-w-md w-full"><CardContent className="pt-6 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">تم استلام طلبك بنجاح</h2>
          <p className="text-gray-600">رقم الطلب: <span className="font-mono">{done.applicationNumber}</span></p>
          <p className="text-sm text-gray-500 mt-4">شركة الزبد الأفضل التجارية</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <ApplicationForm
      initial={null}
      vacancy={data?.vacancy}
      company={data?.company}
      submitting={submitMut.isPending}
      error={(submitMut.error as any)?.message}
      onSubmit={(payload) => submitMut.mutate(payload)}
    />
  );
}
