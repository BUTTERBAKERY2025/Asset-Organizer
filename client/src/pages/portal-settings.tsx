import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { UserCircle, Wallet, MapPin, Loader2 } from "lucide-react";

interface PortalSettings {
  show_salary?: boolean;
  allow_self_checkin?: boolean;
  [key: string]: boolean | undefined;
}

export default function PortalSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery<PortalSettings>({
    queryKey: ["/api/admin/portal-settings"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/portal-settings")).json(),
  });

  const mutation = useMutation({
    mutationFn: async (update: Partial<PortalSettings>) =>
      (await apiRequest("PUT", "/api/admin/portal-settings", update)).json(),
    onSuccess: (data: PortalSettings) => {
      qc.setQueryData(["/api/admin/portal-settings"], data);
      toast({ title: "تم حفظ الإعداد" });
    },
    onError: (e: any) =>
      toast({ title: "تعذّر حفظ الإعداد", description: e?.message, variant: "destructive" }),
  });

  const toggles = [
    {
      key: "allow_self_checkin",
      icon: MapPin,
      title: "السماح بتسجيل الحضور الذاتي",
      description:
        "تمكين الموظفين من تسجيل الحضور والانصراف من هواتفهم داخل نطاق موقع الفرع مع التوقيع.",
    },
    {
      key: "show_salary",
      icon: Wallet,
      title: "إظهار تبويب الراتب للموظفين",
      description:
        "عند التفعيل يستطيع الموظف رؤية تفاصيل راتبه في البوابة. مخفي افتراضيًا.",
    },
  ] as const;

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="إعدادات بوابة الموظف"
          description="التحكم في الميزات المتاحة للموظفين داخل بوابتي"
          icon={UserCircle}
        />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>الميزات</CardTitle>
              <CardDescription>تنطبق هذه الإعدادات على جميع الموظفين في البوابة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {toggles.map((t) => {
                const Icon = t.icon;
                const checked = !!settings?.[t.key];
                return (
                  <div
                    key={t.key}
                    className="flex items-start justify-between gap-4 rounded-lg border p-4"
                    data-testid={`row-setting-${t.key}`}
                  >
                    <div className="flex gap-3">
                      <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <Label htmlFor={`switch-${t.key}`} className="text-base font-semibold cursor-pointer">
                          {t.title}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
                      </div>
                    </div>
                    <Switch
                      id={`switch-${t.key}`}
                      checked={checked}
                      disabled={mutation.isPending}
                      onCheckedChange={(val) => mutation.mutate({ [t.key]: val })}
                      data-testid={`switch-${t.key}`}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
