import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Loader2, Megaphone, Calendar, DollarSign, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import type { MarketingCampaign } from "@shared/schema";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUSES,
  CAMPAIGN_OBJECTIVE_LABELS,
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_SEASON_LABELS,
  CAMPAIGN_SEASONS,
} from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

const campaignFormSchema = z.object({
  name: z.string().min(1, "اسم الحملة مطلوب"),
  nameAr: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  objective: z.string().min(1, "هدف الحملة مطلوب"),
  season: z.string().optional().nullable(),
  totalBudget: z.coerce.number().min(0, "الميزانية يجب أن تكون 0 أو أكثر").default(0),
  startDate: z.string().min(1, "تاريخ البداية مطلوب"),
  endDate: z.string().min(1, "تاريخ النهاية مطلوب"),
  targetAudience: z.string().optional().nullable(),
  channels: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500",
  planned: "bg-blue-500",
  active: "bg-green-500",
  paused: "bg-yellow-500",
  completed: "bg-purple-500",
  cancelled: "bg-red-500",
};

export default function MarketingCampaignsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [objectiveFilter, setObjectiveFilter] = useState<string>("all");
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<MarketingCampaign | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isEmployee } = useAuth();
  const canEdit = isAdmin || isEmployee;

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
    if (objectiveFilter && objectiveFilter !== "all") params.append("objective", objectiveFilter);
    if (seasonFilter && seasonFilter !== "all") params.append("season", seasonFilter);
    return params.toString();
  };

  const { data: campaigns = [], isLoading } = useQuery<MarketingCampaign[]>({
    queryKey: ["/api/marketing/campaigns", statusFilter, objectiveFilter, seasonFilter],
    queryFn: async () => {
      const queryString = buildQueryString();
      const url = `/api/marketing/campaigns${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      return res.json();
    },
  });

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: "",
      nameAr: "",
      description: "",
      objective: "",
      season: "",
      totalBudget: 0,
      startDate: "",
      endDate: "",
      targetAudience: "",
      channels: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CampaignFormData) => {
      const cleanData = {
        ...data,
        nameAr: data.nameAr || null,
        description: data.description || null,
        season: data.season || null,
        targetAudience: data.targetAudience || null,
        channels: data.channels ? data.channels.split(",").map(c => c.trim()).filter(Boolean) : null,
        notes: data.notes || null,
      };
      const res = await fetch("/api/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanData),
      });
      if (!res.ok) throw new Error("Failed to create campaign");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/campaigns"] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({ title: "تم إنشاء الحملة بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في إنشاء الحملة", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CampaignFormData & { id: number }) => {
      const { id, ...campaignData } = data;
      const cleanData = {
        ...campaignData,
        nameAr: campaignData.nameAr || null,
        description: campaignData.description || null,
        season: campaignData.season || null,
        targetAudience: campaignData.targetAudience || null,
        channels: campaignData.channels ? campaignData.channels.split(",").map(c => c.trim()).filter(Boolean) : null,
        notes: campaignData.notes || null,
      };
      const res = await fetch(`/api/marketing/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanData),
      });
      if (!res.ok) throw new Error("Failed to update campaign");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/campaigns"] });
      setIsEditDialogOpen(false);
      setSelectedCampaign(null);
      toast({ title: "تم تحديث الحملة بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في تحديث الحملة", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/marketing/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete campaign");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/campaigns"] });
      setIsDeleteDialogOpen(false);
      setSelectedCampaign(null);
      toast({ title: "تم حذف الحملة بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في حذف الحملة", variant: "destructive" });
    },
  });

  const filteredCampaigns = campaigns.filter((campaign) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      campaign.name.toLowerCase().includes(searchLower) ||
      campaign.nameAr?.toLowerCase().includes(searchLower) ||
      campaign.description?.toLowerCase().includes(searchLower)
    );
  });

  const openEditDialog = (campaign: MarketingCampaign) => {
    setSelectedCampaign(campaign);
    form.reset({
      name: campaign.name,
      nameAr: campaign.nameAr || "",
      description: campaign.description || "",
      objective: campaign.objective,
      season: campaign.season || "",
      totalBudget: campaign.totalBudget || 0,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      targetAudience: campaign.targetAudience || "",
      channels: campaign.channels?.join(", ") || "",
      notes: campaign.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const onSubmit = (data: CampaignFormData) => {
    if (selectedCampaign) {
      updateMutation.mutate({ ...data, id: selectedCampaign.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "-";
    return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(amount);
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const formatter = new Intl.DateTimeFormat("ar-SA", { year: "numeric", month: "short", day: "numeric" });
    return `${formatter.format(start)} - ${formatter.format(end)}`;
  };

  const getStatusBadge = (status: string) => {
    const label = CAMPAIGN_STATUS_LABELS[status as keyof typeof CAMPAIGN_STATUS_LABELS] || status;
    const color = STATUS_COLORS[status] || "bg-gray-500";
    return (
      <Badge className={`${color} text-white`} data-testid={`badge-status-${status}`}>
        {label}
      </Badge>
    );
  };

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/marketing">
              <Button variant="outline" size="icon" data-testid="button-back">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">الحملات التسويقية</h1>
              <p className="text-muted-foreground">إدارة ومتابعة الحملات التسويقية</p>
            </div>
          </div>
          {canEdit && (
            <Button onClick={() => { form.reset(); setIsAddDialogOpen(true); }} data-testid="button-add-campaign">
              <Plus className="w-4 h-4 ml-2" />
              إضافة حملة جديدة
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="البحث في الحملات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
              data-testid="input-search-campaigns"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
              <SelectValue placeholder="جميع الحالات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              {CAMPAIGN_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {CAMPAIGN_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={objectiveFilter} onValueChange={setObjectiveFilter}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-objective-filter">
              <SelectValue placeholder="جميع الأهداف" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الأهداف</SelectItem>
              {CAMPAIGN_OBJECTIVES.map((objective) => (
                <SelectItem key={objective} value={objective}>
                  {CAMPAIGN_OBJECTIVE_LABELS[objective]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={seasonFilter} onValueChange={setSeasonFilter}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-season-filter">
              <SelectValue placeholder="جميع المواسم" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المواسم</SelectItem>
              {CAMPAIGN_SEASONS.map((season) => (
                <SelectItem key={season} value={season}>
                  {CAMPAIGN_SEASON_LABELS[season]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>قائمة الحملات</CardTitle>
            <CardDescription>جميع الحملات التسويقية المسجلة في النظام</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Megaphone className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">لا توجد حملات تسويقية</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>اسم الحملة</TableHead>
                      <TableHead>الهدف</TableHead>
                      <TableHead>الموسم</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الميزانية</TableHead>
                      <TableHead>الفترة</TableHead>
                      {canEdit && <TableHead>إجراءات</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCampaigns.map((campaign) => (
                      <TableRow key={campaign.id} data-testid={`row-campaign-${campaign.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Megaphone className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <span className="font-medium block">{campaign.name}</span>
                              {campaign.nameAr && (
                                <span className="text-sm text-muted-foreground">{campaign.nameAr}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {CAMPAIGN_OBJECTIVE_LABELS[campaign.objective as keyof typeof CAMPAIGN_OBJECTIVE_LABELS] || campaign.objective}
                        </TableCell>
                        <TableCell>
                          {campaign.season
                            ? CAMPAIGN_SEASON_LABELS[campaign.season as keyof typeof CAMPAIGN_SEASON_LABELS] || campaign.season
                            : "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-muted-foreground" />
                            <span>{formatCurrency(campaign.totalBudget)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm">{formatDateRange(campaign.startDate, campaign.endDate)}</span>
                          </div>
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(campaign)}
                                data-testid={`button-edit-campaign-${campaign.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCampaign(campaign);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                  data-testid={`button-delete-campaign-${campaign.id}`}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={isAddDialogOpen || isEditDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsAddDialogOpen(false);
              setIsEditDialogOpen(false);
              setSelectedCampaign(null);
              form.reset();
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>{selectedCampaign ? "تعديل الحملة" : "إضافة حملة جديدة"}</DialogTitle>
              <DialogDescription>
                {selectedCampaign ? "قم بتعديل بيانات الحملة التسويقية" : "أدخل بيانات الحملة التسويقية الجديدة"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اسم الحملة (English)</Label>
                  <Input
                    {...form.register("name")}
                    placeholder="Campaign Name"
                    dir="ltr"
                    data-testid="input-campaign-name"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>اسم الحملة (عربي)</Label>
                  <Input
                    {...form.register("nameAr")}
                    placeholder="اسم الحملة بالعربي"
                    data-testid="input-campaign-name-ar"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>الوصف</Label>
                <Textarea
                  {...form.register("description")}
                  placeholder="وصف الحملة التسويقية..."
                  data-testid="input-campaign-description"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الهدف</Label>
                  <Select
                    value={form.watch("objective")}
                    onValueChange={(value) => form.setValue("objective", value)}
                  >
                    <SelectTrigger data-testid="select-campaign-objective">
                      <SelectValue placeholder="اختر هدف الحملة" />
                    </SelectTrigger>
                    <SelectContent>
                      {CAMPAIGN_OBJECTIVES.map((objective) => (
                        <SelectItem key={objective} value={objective}>
                          {CAMPAIGN_OBJECTIVE_LABELS[objective]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.objective && (
                    <p className="text-sm text-destructive">{form.formState.errors.objective.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>الموسم</Label>
                  <Select
                    value={form.watch("season") || ""}
                    onValueChange={(value) => form.setValue("season", value)}
                  >
                    <SelectTrigger data-testid="select-campaign-season">
                      <SelectValue placeholder="اختر الموسم" />
                    </SelectTrigger>
                    <SelectContent>
                      {CAMPAIGN_SEASONS.map((season) => (
                        <SelectItem key={season} value={season}>
                          {CAMPAIGN_SEASON_LABELS[season]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>الميزانية الإجمالية (ريال)</Label>
                <Input
                  type="number"
                  {...form.register("totalBudget")}
                  placeholder="0"
                  dir="ltr"
                  data-testid="input-campaign-budget"
                />
                {form.formState.errors.totalBudget && (
                  <p className="text-sm text-destructive">{form.formState.errors.totalBudget.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>تاريخ البداية</Label>
                  <Input
                    type="date"
                    {...form.register("startDate")}
                    dir="ltr"
                    data-testid="input-campaign-start-date"
                  />
                  {form.formState.errors.startDate && (
                    <p className="text-sm text-destructive">{form.formState.errors.startDate.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>تاريخ النهاية</Label>
                  <Input
                    type="date"
                    {...form.register("endDate")}
                    dir="ltr"
                    data-testid="input-campaign-end-date"
                  />
                  {form.formState.errors.endDate && (
                    <p className="text-sm text-destructive">{form.formState.errors.endDate.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>الجمهور المستهدف</Label>
                <Input
                  {...form.register("targetAudience")}
                  placeholder="مثال: الشباب من 18-35 سنة"
                  data-testid="input-campaign-target-audience"
                />
              </div>

              <div className="space-y-2">
                <Label>القنوات التسويقية</Label>
                <Input
                  {...form.register("channels")}
                  placeholder="مثال: social, email, print (مفصولة بفواصل)"
                  data-testid="input-campaign-channels"
                />
                <p className="text-xs text-muted-foreground">أدخل القنوات مفصولة بفواصل</p>
              </div>

              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <Textarea
                  {...form.register("notes")}
                  placeholder="ملاحظات إضافية عن الحملة..."
                  data-testid="input-campaign-notes"
                />
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-campaign"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  )}
                  {selectedCampaign ? "حفظ التغييرات" : "إضافة الحملة"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>حذف الحملة</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف الحملة "{selectedCampaign?.name}"؟ لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedCampaign && deleteMutation.mutate(selectedCampaign.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-campaign"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
