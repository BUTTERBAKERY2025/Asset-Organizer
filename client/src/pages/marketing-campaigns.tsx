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
import { Plus, Pencil, Trash2, Search, Loader2, Megaphone, Calendar, DollarSign, ArrowRight, LayoutGrid, List, GanttChart } from "lucide-react";
import { Progress } from "@/components/ui/progress";
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

const STATUS_BORDER_COLORS: Record<string, string> = {
  draft: "border-gray-400",
  planned: "border-blue-400",
  active: "border-green-400",
  paused: "border-yellow-400",
  completed: "border-purple-400",
  cancelled: "border-red-400",
};

function CampaignTimeline({ 
  campaigns, 
  isLoading, 
  canEdit, 
  onEdit 
}: { 
  campaigns: MarketingCampaign[]; 
  isLoading: boolean; 
  canEdit: boolean;
  onEdit: (campaign: MarketingCampaign) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Megaphone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">لا توجد حملات تسويقية</p>
        </CardContent>
      </Card>
    );
  }

  const sortedCampaigns = [...campaigns].sort((a, b) => 
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  const allDates = campaigns.flatMap(c => [new Date(c.startDate), new Date(c.endDate)]);
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  const totalDays = Math.max((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24), 1);
  const today = new Date();

  const getBarPosition = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startOffset = Math.max(0, (start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const leftPercent = (startOffset / totalDays) * 100;
    const widthPercent = Math.max((duration / totalDays) * 100, 2);
    return { left: `${leftPercent}%`, width: `${widthPercent}%` };
  };

  const getCampaignProgress = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (today < start) return 0;
    if (today > end) return 100;
    const total = end.getTime() - start.getTime();
    const elapsed = today.getTime() - start.getTime();
    return Math.round((elapsed / total) * 100);
  };

  const formatShortDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
  };

  const months: string[] = [];
  const tempDate = new Date(minDate);
  while (tempDate <= maxDate) {
    months.push(tempDate.toLocaleDateString("ar-SA", { month: "short", year: "numeric" }));
    tempDate.setMonth(tempDate.getMonth() + 1);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GanttChart className="w-5 h-5" />
          الجدول الزمني للحملات
        </CardTitle>
        <CardDescription>عرض مرئي لفترات الحملات التسويقية</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex gap-4 text-xs flex-wrap">
          {Object.entries(CAMPAIGN_STATUS_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${STATUS_COLORS[key]}`} />
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="flex border-b pb-2 mb-4 text-xs text-muted-foreground">
              {months.map((month, idx) => (
                <div key={idx} className="flex-1 text-center border-r last:border-r-0">
                  {month}
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {sortedCampaigns.map((campaign) => {
                const pos = getBarPosition(campaign.startDate, campaign.endDate);
                const progress = getCampaignProgress(campaign.startDate, campaign.endDate);
                const statusColor = STATUS_COLORS[campaign.status] || STATUS_COLORS.draft;
                const borderColor = STATUS_BORDER_COLORS[campaign.status] || STATUS_BORDER_COLORS.draft;

                return (
                  <div key={campaign.id} className="relative group">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-48 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{campaign.nameAr || campaign.name}</span>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => onEdit(campaign)}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatShortDate(campaign.startDate)} - {formatShortDate(campaign.endDate)}
                        </div>
                      </div>
                      <div className="flex-1 relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className={`absolute h-full ${statusColor} rounded-lg transition-all border-2 ${borderColor}`}
                          style={{ left: pos.left, width: pos.width }}
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs text-white font-medium drop-shadow-sm truncate px-2">
                              {CAMPAIGN_STATUS_LABELS[campaign.status as keyof typeof CAMPAIGN_STATUS_LABELS]}
                            </span>
                          </div>
                          {campaign.status === "active" && (
                            <div 
                              className="absolute top-0 left-0 h-full bg-white/30"
                              style={{ width: `${progress}%` }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg text-center">
            <p className="text-2xl font-bold">{campaigns.length}</p>
            <p className="text-xs text-muted-foreground">إجمالي الحملات</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600">
              {campaigns.filter(c => c.status === "active").length}
            </p>
            <p className="text-xs text-muted-foreground">حملات نشطة</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-600">
              {campaigns.filter(c => c.status === "planned").length}
            </p>
            <p className="text-xs text-muted-foreground">حملات مخططة</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-purple-600">
              {campaigns.filter(c => c.status === "completed").length}
            </p>
            <p className="text-xs text-muted-foreground">حملات مكتملة</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MarketingCampaignsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [objectiveFilter, setObjectiveFilter] = useState<string>("all");
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<MarketingCampaign | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");

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
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount) + " ر.س";
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
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/marketing">
              <Button variant="outline" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" data-testid="button-back">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">الحملات التسويقية</h1>
              <p className="text-sm text-muted-foreground">إدارة ومتابعة الحملات التسويقية</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                className="rounded-none h-9"
                onClick={() => setViewMode("table")}
                data-testid="button-view-table"
              >
                <List className="w-4 h-4 ml-1" />
                جدول
              </Button>
              <Button
                variant={viewMode === "timeline" ? "default" : "ghost"}
                size="sm"
                className="rounded-none h-9"
                onClick={() => setViewMode("timeline")}
                data-testid="button-view-timeline"
              >
                <GanttChart className="w-4 h-4 ml-1" />
                Timeline
              </Button>
            </div>
            {canEdit && (
              <Button className="h-11 sm:h-9" onClick={() => { form.reset(); setIsAddDialogOpen(true); }} data-testid="button-add-campaign">
                <Plus className="w-4 h-4 ml-2" />
                إضافة حملة جديدة
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="البحث في الحملات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 h-11 sm:h-10"
              data-testid="input-search-campaigns"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48 h-11 sm:h-10" data-testid="select-status-filter">
              <SelectValue placeholder="جميع الحالات" />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              <SelectItem value="all">جميع الحالات</SelectItem>
              {CAMPAIGN_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {CAMPAIGN_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={objectiveFilter} onValueChange={setObjectiveFilter}>
            <SelectTrigger className="w-full sm:w-48 h-11 sm:h-10" data-testid="select-objective-filter">
              <SelectValue placeholder="جميع الأهداف" />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              <SelectItem value="all">جميع الأهداف</SelectItem>
              {CAMPAIGN_OBJECTIVES.map((objective) => (
                <SelectItem key={objective} value={objective}>
                  {CAMPAIGN_OBJECTIVE_LABELS[objective]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={seasonFilter} onValueChange={setSeasonFilter}>
            <SelectTrigger className="w-full sm:w-48 h-11 sm:h-10" data-testid="select-season-filter">
              <SelectValue placeholder="جميع المواسم" />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              <SelectItem value="all">جميع المواسم</SelectItem>
              {CAMPAIGN_SEASONS.map((season) => (
                <SelectItem key={season} value={season}>
                  {CAMPAIGN_SEASON_LABELS[season]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {viewMode === "timeline" ? (
          <CampaignTimeline campaigns={filteredCampaigns} isLoading={isLoading} canEdit={canEdit} onEdit={openEditDialog} />
        ) : (
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
        )}

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
                    <SelectContent className="max-h-60 overflow-y-auto">
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
                    <SelectContent className="max-h-60 overflow-y-auto">
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
