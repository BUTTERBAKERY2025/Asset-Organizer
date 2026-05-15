import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import ApplicationForm from "@/components/application-form";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function EmploymentApplicationPublicPage() {
  const params = useParams();
  const token = (params as any).token as string;
  const [done, setDone] = useState(false);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: [`/api/public/applications/${token}`],
    queryFn: async () => {
      const r = await fetch(`/api/public/applications/${token}`);
      if (!r.ok) throw new Error((await r.json()).error || "خطأ");
      return r.json();
    },
    retry: false,
  });

  const submitMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/public/applications/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error((await r.json()).error || "خطأ في الإرسال");
      return r.json();
    },
    onSuccess: () => setDone(true),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E6]" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-[#e67e22]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E6] p-6" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-2">رابط غير صالح</h2>
            <p className="text-gray-600">{(error as any).message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E6] p-6" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">تم استلام طلبك بنجاح</h2>
            <p className="text-gray-600">سيتواصل معك فريق الموارد البشرية قريباً.</p>
            <p className="text-sm text-gray-500 mt-4">شركة الزبد الأفضل التجارية</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data?.readOnly) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E6] p-6" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-blue-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-2">تم استلام طلبك مسبقاً</h2>
            <p className="text-gray-600">رقم الطلب: {data.application.applicationNumber}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ApplicationForm
      initial={data?.application}
      vacancy={null}
      company={data?.company}
      submitting={submitMut.isPending}
      error={(submitMut.error as any)?.message}
      onSubmit={(payload) => submitMut.mutate(payload)}
    />
  );
}
