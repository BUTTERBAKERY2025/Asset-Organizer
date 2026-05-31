import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  UserCircle, Wallet, MapPin, Loader2, LayoutDashboard, CalendarRange, ClipboardCheck,
  CalendarDays, ShieldAlert, FileText, Award, Languages, KeyRound, ShieldCheck,
  Search, Copy, Printer, Users, ExternalLink, Save,
} from "lucide-react";

interface PortalSettings {
  [key: string]: boolean | string | undefined;
}

interface PortalAccount {
  id: number;
  employeeName: string;
  employeeNameEn: string | null;
  branchId: string;
  branchName: string;
  status: string;
  hasAccount: boolean;
  username: string | null;
}

interface GeneratedCredential {
  id: number;
  employeeName: string;
  username: string;
  password: string;
}

interface PortalSuggestion {
  employeeId: number;
  employeeName: string;
  employeeNameEn: string | null;
  branchId: string;
  branchName: string;
  userId: string;
  username: string | null;
  userFullName: string;
  matchType: "phone" | "name";
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

  const tabToggles = [
    { key: "allow_self_checkin", icon: MapPin, title: "تسجيل الحضور الذاتي", description: "تمكين الموظفين من تسجيل الحضور والانصراف من هواتفهم داخل نطاق موقع الفرع." },
    { key: "show_schedule", icon: CalendarRange, title: "تبويب الجدول", description: "عرض جدول الورديات الأسبوعي للموظف." },
    { key: "show_attendance", icon: ClipboardCheck, title: "تبويب الحضور", description: "عرض سجل حضور الموظف الشهري." },
    { key: "show_leaves", icon: CalendarDays, title: "تبويب الإجازات", description: "عرض الإجازات للموظف (يمكن إيقاف تقديم الطلبات من تبويب قواعد العمل)." },
    { key: "show_advances", icon: Wallet, title: "تبويب السلف", description: "عرض السلف للموظف (يمكن إيقاف تقديم الطلبات من تبويب قواعد العمل)." },
    { key: "show_warnings", icon: ShieldAlert, title: "تبويب الإنذارات", description: "عرض الإنذارات والمخالفات للموظف." },
    { key: "show_documents", icon: FileText, title: "تبويب الوثائق", description: "عرض وثائق الموظف (الهوية/الإقامة/الشهادة الصحية...)." },
    { key: "show_incentives", icon: Award, title: "تبويب الحوافز والنقاط", description: "عرض نقاط وحوافز الموظف." },
    { key: "show_salary", icon: Wallet, title: "تبويب الراتب", description: "عند التفعيل يرى الموظف تفاصيل راتبه. مخفي افتراضياً." },
  ] as const;

  const ruleToggles = [
    { key: "allow_leave_requests", icon: CalendarDays, title: "السماح بتقديم طلبات الإجازات", description: "عند الإيقاف يقدر الموظف يشوف إجازاته لكن ما يقدر يقدّم طلب جديد." },
    { key: "allow_advance_requests", icon: Wallet, title: "السماح بتقديم طلبات السلف", description: "عند الإيقاف يقدر الموظف يشوف سلفه لكن ما يقدر يقدّم طلب جديد." },
  ] as const;

  // Local state for value settings (saved on demand)
  const [maxAdvance, setMaxAdvance] = useState<string>("");
  const [defaultLang, setDefaultLang] = useState<string>("");
  const maxAdvanceValue = maxAdvance !== "" ? maxAdvance : String(settings?.max_advance_amount ?? "0");
  const defaultLangValue = defaultLang !== "" ? defaultLang : String(settings?.default_language ?? "ar");

  const saveRules = () => {
    const num = Number(maxAdvanceValue);
    if (!Number.isFinite(num) || num < 0) {
      toast({ title: "قيمة غير صحيحة", description: "الحد الأقصى للسلفة يجب أن يكون رقماً موجباً", variant: "destructive" });
      return;
    }
    mutation.mutate({ max_advance_amount: String(Math.floor(num)), default_language: defaultLangValue });
  };

  const renderToggle = (t: { key: string; icon: any; title: string; description: string }) => {
    const Icon = t.icon;
    const checked = !!settings?.[t.key];
    return (
      <div key={t.key} className="flex items-start justify-between gap-4 rounded-lg border p-4" data-testid={`row-setting-${t.key}`}>
        <div className="flex gap-3">
          <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
          <div>
            <Label htmlFor={`switch-${t.key}`} className="text-base font-semibold cursor-pointer">{t.title}</Label>
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
  };

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="إعدادات بوابة الموظف"
          description="لوحة تحكم شاملة لآلية عمل بوابتي وربطها بالموظفين"
          icon={UserCircle}
        />

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Tabs defaultValue="features" dir="rtl">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="features" data-testid="tab-features"><LayoutDashboard className="h-4 w-4 ms-1" />التبويبات والميزات</TabsTrigger>
              <TabsTrigger value="rules" data-testid="tab-rules"><ClipboardCheck className="h-4 w-4 ms-1" />قواعد العمل</TabsTrigger>
              <TabsTrigger value="accounts" data-testid="tab-accounts"><KeyRound className="h-4 w-4 ms-1" />ربط الحسابات</TabsTrigger>
              <TabsTrigger value="permissions" data-testid="tab-permissions"><ShieldCheck className="h-4 w-4 ms-1" />الصلاحيات</TabsTrigger>
            </TabsList>

            {/* التبويبات والميزات */}
            <TabsContent value="features" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>التبويبات والميزات الظاهرة للموظف</CardTitle>
                  <CardDescription>تحكم في ما يظهر داخل بوابتي لجميع الموظفين</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">{tabToggles.map(renderToggle)}</CardContent>
              </Card>
            </TabsContent>

            {/* قواعد العمل */}
            <TabsContent value="rules" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>قواعد الطلبات</CardTitle>
                  <CardDescription>التحكم في ما يقدر الموظف يقدّمه عبر البوابة</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">{ruleToggles.map(renderToggle)}</CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>القيم والإعدادات</CardTitle>
                  <CardDescription>الحد الأقصى للسلفة واللغة الافتراضية للبوابة</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-2 max-w-sm">
                    <Label htmlFor="input-max-advance" className="font-semibold flex items-center gap-2"><Wallet className="h-4 w-4" />الحد الأقصى للسلفة (ريال)</Label>
                    <Input
                      id="input-max-advance"
                      type="number"
                      min="0"
                      value={maxAdvanceValue}
                      onChange={(e) => setMaxAdvance(e.target.value)}
                      data-testid="input-max-advance"
                    />
                    <p className="text-xs text-muted-foreground">اكتب 0 لإلغاء الحد (سلفة بدون حد أقصى).</p>
                  </div>

                  <div className="grid gap-2 max-w-sm">
                    <Label className="font-semibold flex items-center gap-2"><Languages className="h-4 w-4" />اللغة الافتراضية للبوابة</Label>
                    <Select value={defaultLangValue} onValueChange={setDefaultLang}>
                      <SelectTrigger data-testid="select-default-language"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ar">العربية</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">تُطبَّق عند أول دخول للموظف، ويقدر يغيّرها بنفسه من داخل البوابة.</p>
                  </div>

                  <Button onClick={saveRules} disabled={mutation.isPending} data-testid="button-save-rules">
                    {mutation.isPending ? <Loader2 className="h-4 w-4 ms-1 animate-spin" /> : <Save className="h-4 w-4 ms-1" />}
                    حفظ القيم
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ربط الحسابات */}
            <TabsContent value="accounts" className="mt-4">
              <AccountsTab />
            </TabsContent>

            {/* الصلاحيات */}
            <TabsContent value="permissions" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>صلاحيات التحكم في البوابة</CardTitle>
                  <CardDescription>من يقدر يعدّل هذه الإعدادات ومن يقدر ينشئ حسابات للموظفين</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm leading-relaxed">
                  <div className="rounded-lg border p-4 space-y-1">
                    <div className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />تعديل إعدادات البوابة</div>
                    <p className="text-muted-foreground">يتطلب صلاحية وحدة «الإعدادات» (settings) — تعديل. أي مستخدم بدون هذه الصلاحية لا يستطيع فتح هذه الصفحة أو تغيير الإعدادات.</p>
                  </div>
                  <div className="rounded-lg border p-4 space-y-1">
                    <div className="font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" />إنشاء حسابات دخول للموظفين</div>
                    <p className="text-muted-foreground">يتطلب صلاحية وحدة «المستخدمون» (users) — إنشاء. التوليد الجماعي ومنح الحسابات محصور على من يملك هذه الصلاحية وضمن فروعه المصرّح بها فقط.</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-muted-foreground mb-3">للتحكم في من يملك هذه الصلاحيات، افتح صفحة إدارة المستخدمين والأدوار وعدّل صلاحيات الدور المطلوب.</p>
                    <Link href="/users">
                      <Button variant="outline" data-testid="link-users-roles"><ExternalLink className="h-4 w-4 ms-1" />إدارة المستخدمين والصلاحيات</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}

function AccountsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [results, setResults] = useState<GeneratedCredential[] | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const [selectedSug, setSelectedSug] = useState<Set<number>>(new Set());

  const { data: accounts = [], isLoading } = useQuery<PortalAccount[]>({
    queryKey: ["/api/admin/portal-accounts"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/portal-accounts")).json(),
  });

  const { data: suggestions = [] } = useQuery<PortalSuggestion[]>({
    queryKey: ["/api/admin/portal-accounts/suggestions"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/portal-accounts/suggestions")).json(),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      // الموظفون غير النشطين بدون حساب لا يُعرضون للتوليد (نُبقي فقط من لديه حساب للإدارة)
      if (!a.hasAccount && a.status !== "active") return false;
      if (filter === "linked" && !a.hasAccount) return false;
      if (filter === "unlinked" && a.hasAccount) return false;
      if (!q) return true;
      return (
        a.employeeName.toLowerCase().includes(q) ||
        (a.employeeNameEn || "").toLowerCase().includes(q) ||
        a.branchName.toLowerCase().includes(q) ||
        (a.username || "").toLowerCase().includes(q)
      );
    });
  }, [accounts, search, filter]);

  const selectableIds = useMemo(() => filtered.filter((a) => !a.hasAccount).map((a) => a.id), [filtered]);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) selectableIds.forEach((id) => next.delete(id));
      else selectableIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const generate = useMutation({
    mutationFn: async (ids: number[]) =>
      (await apiRequest("POST", "/api/admin/portal-accounts/bulk-generate", { employeeIds: ids })).json(),
    onSuccess: (data: { created: GeneratedCredential[]; skipped: { id: number; reason: string }[] }) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/portal-accounts"] });
      setSelected(new Set());
      setResults(data.created);
      toast({
        title: `تم إنشاء ${data.created.length} حساب`,
        description: data.skipped.length ? `تم تخطي ${data.skipped.length}` : undefined,
      });
    },
    onError: (e: any) => toast({ title: "تعذّر التوليد", description: e?.message, variant: "destructive" }),
  });

  const confirmLinks = useMutation({
    mutationFn: async (links: { employeeId: number; userId: string }[]) =>
      (await apiRequest("POST", "/api/admin/portal-accounts/confirm-links", { links })).json(),
    onSuccess: (data: { linked: any[]; skipped: { employeeId: number; reason: string }[] }) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/portal-accounts"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/portal-accounts/suggestions"] });
      setSelectedSug(new Set());
      toast({
        title: `تم ربط ${data.linked.length} حساب`,
        description: data.skipped.length ? `تم تخطي ${data.skipped.length}` : undefined,
      });
    },
    onError: (e: any) => toast({ title: "تعذّر الربط", description: e?.message, variant: "destructive" }),
  });

  const toggleSug = (employeeId: number) => {
    setSelectedSug((prev) => {
      const next = new Set(prev);
      next.has(employeeId) ? next.delete(employeeId) : next.add(employeeId);
      return next;
    });
  };
  const allSugSelected = suggestions.length > 0 && suggestions.every((s) => selectedSug.has(s.employeeId));
  const toggleAllSug = () => {
    setSelectedSug((prev) => {
      if (allSugSelected) return new Set();
      return new Set(suggestions.map((s) => s.employeeId));
    });
  };
  const submitConfirm = () => {
    const links = suggestions
      .filter((s) => selectedSug.has(s.employeeId))
      .map((s) => ({ employeeId: s.employeeId, userId: s.userId }));
    if (links.length) confirmLinks.mutate(links);
  };

  const copyAll = () => {
    if (!results) return;
    const text = results.map((r) => `${r.employeeName}\tاسم المستخدم: ${r.username}\tكلمة المرور: ${r.password}`).join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "تم نسخ بيانات الدخول" });
  };

  const printResults = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html dir="rtl"><head><title>بيانات الدخول</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px;text-align:right}</style></head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  const linkedCount = accounts.filter((a) => a.hasAccount).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />ربط الموظفين بحسابات الدخول</CardTitle>
        <CardDescription>
          {linkedCount} من {accounts.length} موظف لديهم حساب دخول. حدّد الموظفين بدون حساب ووّلد لهم حسابات دفعة واحدة.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestions.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 space-y-3" data-testid="section-suggestions">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold">
                <ShieldCheck className="h-5 w-5" />
                اقتراحات ربط تلقائي ({suggestions.length})
              </div>
              <Button
                size="sm"
                disabled={selectedSug.size === 0 || confirmLinks.isPending}
                onClick={submitConfirm}
                data-testid="button-confirm-links"
              >
                {confirmLinks.isPending ? <Loader2 className="h-4 w-4 ms-1 animate-spin" /> : <KeyRound className="h-4 w-4 ms-1" />}
                ربط المحدد ({selectedSug.size})
              </Button>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              هؤلاء الموظفون لديهم حساب موجود في إدارة المستخدمين يطابق بياناتهم. راجِع الاقتراحات وأكّد الربط لتجنّب إنشاء حسابات مكررة.
            </p>
            <div className="rounded-md border bg-background overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allSugSelected} onCheckedChange={toggleAllSug} data-testid="checkbox-select-all-suggestions" />
                    </TableHead>
                    <TableHead>الموظف</TableHead>
                    <TableHead>الفرع</TableHead>
                    <TableHead>الحساب المطابق</TableHead>
                    <TableHead>سبب المطابقة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions.map((s) => (
                    <TableRow key={s.employeeId} data-testid={`row-suggestion-${s.employeeId}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedSug.has(s.employeeId)}
                          onCheckedChange={() => toggleSug(s.employeeId)}
                          data-testid={`checkbox-suggestion-${s.employeeId}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{s.employeeName}</TableCell>
                      <TableCell className="text-muted-foreground">{s.branchName}</TableCell>
                      <TableCell className="text-sm">
                        <span className="font-mono">{s.username || "—"}</span>
                        {s.userFullName ? <span className="text-muted-foreground"> · {s.userFullName}</span> : null}
                      </TableCell>
                      <TableCell>
                        {s.matchType === "phone"
                          ? <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">رقم الجوال</Badge>
                          : <Badge variant="outline">الاسم</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pe-8"
              placeholder="ابحث بالاسم أو الفرع أو اسم المستخدم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-accounts"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-44" data-testid="select-account-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="linked">لديهم حساب</SelectItem>
              <SelectItem value="unlinked">بدون حساب</SelectItem>
            </SelectContent>
          </Select>
          <Button
            disabled={selected.size === 0 || generate.isPending}
            onClick={() => generate.mutate(Array.from(selected))}
            data-testid="button-bulk-generate"
          >
            {generate.isPending ? <Loader2 className="h-4 w-4 ms-1 animate-spin" /> : <KeyRound className="h-4 w-4 ms-1" />}
            توليد حسابات للمحدد ({selected.size})
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} disabled={selectableIds.length === 0} data-testid="checkbox-select-all" />
                  </TableHead>
                  <TableHead>الموظف</TableHead>
                  <TableHead>الفرع</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>اسم المستخدم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا يوجد موظفون</TableCell></TableRow>
                ) : (
                  filtered.map((a) => (
                    <TableRow key={a.id} data-testid={`row-account-${a.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(a.id)}
                          onCheckedChange={() => toggleOne(a.id)}
                          disabled={a.hasAccount}
                          data-testid={`checkbox-account-${a.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{a.employeeName}</TableCell>
                      <TableCell className="text-muted-foreground">{a.branchName}</TableCell>
                      <TableCell>
                        {a.hasAccount
                          ? <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">لديه حساب</Badge>
                          : <Badge variant="outline">بدون حساب</Badge>}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{a.username || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!results} onOpenChange={(o) => !o && setResults(null)}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader><DialogTitle>بيانات الدخول الجديدة</DialogTitle></DialogHeader>
          <p className="text-sm text-destructive font-medium">
            ⚠️ كلمات المرور تظهر مرة واحدة فقط — انسخها أو اطبعها وسلّمها للموظفين الآن.
          </p>
          <div ref={printRef}>
            <table className="w-full text-sm border-collapse" data-testid="table-generated-credentials">
              <thead>
                <tr className="border-b">
                  <th className="text-right p-2">الموظف</th>
                  <th className="text-right p-2">اسم المستخدم</th>
                  <th className="text-right p-2">كلمة المرور</th>
                </tr>
              </thead>
              <tbody>
                {(results || []).map((r) => (
                  <tr key={r.id} className="border-b" data-testid={`row-credential-${r.id}`}>
                    <td className="p-2">{r.employeeName}</td>
                    <td className="p-2 font-mono">{r.username}</td>
                    <td className="p-2 font-mono">{r.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={copyAll} data-testid="button-copy-credentials"><Copy className="h-4 w-4 ms-1" />نسخ الكل</Button>
            <Button variant="outline" onClick={printResults} data-testid="button-print-credentials"><Printer className="h-4 w-4 ms-1" />طباعة</Button>
            <Button onClick={() => setResults(null)} data-testid="button-close-credentials">تم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
