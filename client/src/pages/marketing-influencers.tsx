import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  User,
  Eye,
  Phone,
  Mail,
  MapPin,
  Star,
  Users,
  Activity,
  DollarSign,
  Calendar,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import type { MarketingInfluencer, InfluencerCampaignLink, InfluencerContact } from "@shared/schema";
import {
  INFLUENCER_SPECIALTY_LABELS,
  INFLUENCER_SPECIALTIES,
  INFLUENCER_PLATFORM_LABELS,
  INFLUENCER_PLATFORMS,
  INFLUENCER_CONTENT_TYPE_LABELS,
  INFLUENCER_CONTENT_TYPES,
} from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

interface InfluencerFormData {
  name: string;
  nameAr: string;
  email: string;
  phone: string;
  specialty: string;
  platforms: string[];
  contentTypes: string[];
  followerCount: number;
  engagementRate: number;
  avgViews: number;
  pricePerPost: number;
  pricePerStory: number;
  pricePerVideo: number;
  city: string;
  region: string;
  bestCollaborationTimes: string;
  notes: string;
  isActive: boolean;
}

const defaultFormData: InfluencerFormData = {
  name: "",
  nameAr: "",
  email: "",
  phone: "",
  specialty: "",
  platforms: [],
  contentTypes: [],
  followerCount: 0,
  engagementRate: 0,
  avgViews: 0,
  pricePerPost: 0,
  pricePerStory: 0,
  pricePerVideo: 0,
  city: "",
  region: "",
  bestCollaborationTimes: "",
  notes: "",
  isActive: true,
};

function formatFollowerCount(count: number | null): string {
  if (!count) return "0";
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || amount === 0) return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount) + " ر.س";
}

export default function MarketingInfluencersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [selectedInfluencer, setSelectedInfluencer] = useState<MarketingInfluencer | null>(null);
  const [formData, setFormData] = useState<InfluencerFormData>(defaultFormData);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isEmployee } = useAuth();
  const canEdit = isAdmin || isEmployee;

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (specialtyFilter && specialtyFilter !== "all") params.append("specialty", specialtyFilter);
    if (statusFilter && statusFilter !== "all") params.append("isActive", statusFilter === "active" ? "true" : "false");
    return params.toString();
  };

  const { data: influencers = [], isLoading } = useQuery<MarketingInfluencer[]>({
    queryKey: ["/api/marketing/influencers", specialtyFilter, statusFilter],
    queryFn: async () => {
      const queryString = buildQueryString();
      const url = `/api/marketing/influencers${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch influencers");
      return res.json();
    },
  });

  const { data: campaignLinks = [] } = useQuery<InfluencerCampaignLink[]>({
    queryKey: ["/api/marketing/influencer-links", selectedInfluencer?.id],
    queryFn: async () => {
      if (!selectedInfluencer) return [];
      const res = await fetch(`/api/marketing/influencer-links?influencerId=${selectedInfluencer.id}`);
      if (!res.ok) throw new Error("Failed to fetch campaign links");
      return res.json();
    },
    enabled: !!selectedInfluencer && isDetailSheetOpen,
  });

  const { data: contacts = [] } = useQuery<InfluencerContact[]>({
    queryKey: ["/api/marketing/influencer-contacts", selectedInfluencer?.id],
    queryFn: async () => {
      if (!selectedInfluencer) return [];
      const res = await fetch(`/api/marketing/influencer-contacts?influencerId=${selectedInfluencer.id}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
    enabled: !!selectedInfluencer && isDetailSheetOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data: InfluencerFormData) => {
      const cleanData = {
        ...data,
        nameAr: data.nameAr || null,
        email: data.email || null,
        phone: data.phone || null,
        platforms: data.platforms.length > 0 ? data.platforms : null,
        contentTypes: data.contentTypes.length > 0 ? data.contentTypes : null,
        pricePerPost: data.pricePerPost || null,
        pricePerStory: data.pricePerStory || null,
        pricePerVideo: data.pricePerVideo || null,
        city: data.city || null,
        region: data.region || null,
        bestCollaborationTimes: data.bestCollaborationTimes || null,
        notes: data.notes || null,
        engagementRate: data.engagementRate || null,
      };
      const res = await fetch("/api/marketing/influencers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanData),
      });
      if (!res.ok) throw new Error("Failed to create influencer");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/influencers"] });
      setIsAddDialogOpen(false);
      setFormData(defaultFormData);
      toast({ title: "تم إضافة المؤثر بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في إضافة المؤثر", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InfluencerFormData & { id: number }) => {
      const { id, ...influencerData } = data;
      const cleanData = {
        ...influencerData,
        nameAr: influencerData.nameAr || null,
        email: influencerData.email || null,
        phone: influencerData.phone || null,
        platforms: influencerData.platforms.length > 0 ? influencerData.platforms : null,
        contentTypes: influencerData.contentTypes.length > 0 ? influencerData.contentTypes : null,
        pricePerPost: influencerData.pricePerPost || null,
        pricePerStory: influencerData.pricePerStory || null,
        pricePerVideo: influencerData.pricePerVideo || null,
        city: influencerData.city || null,
        region: influencerData.region || null,
        bestCollaborationTimes: influencerData.bestCollaborationTimes || null,
        notes: influencerData.notes || null,
        engagementRate: influencerData.engagementRate || null,
      };
      const res = await fetch(`/api/marketing/influencers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanData),
      });
      if (!res.ok) throw new Error("Failed to update influencer");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/influencers"] });
      setIsEditDialogOpen(false);
      setSelectedInfluencer(null);
      setFormData(defaultFormData);
      toast({ title: "تم تحديث المؤثر بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في تحديث المؤثر", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/marketing/influencers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete influencer");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/influencers"] });
      setIsDeleteDialogOpen(false);
      setSelectedInfluencer(null);
      toast({ title: "تم حذف المؤثر بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في حذف المؤثر", variant: "destructive" });
    },
  });

  const filteredInfluencers = influencers.filter((influencer) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      influencer.name.toLowerCase().includes(searchLower) ||
      influencer.nameAr?.toLowerCase().includes(searchLower) ||
      influencer.email?.toLowerCase().includes(searchLower)
    );
  });

  const openEditDialog = (influencer: MarketingInfluencer) => {
    setSelectedInfluencer(influencer);
    setFormData({
      name: influencer.name,
      nameAr: influencer.nameAr || "",
      email: influencer.email || "",
      phone: influencer.phone || "",
      specialty: influencer.specialty,
      platforms: influencer.platforms || [],
      contentTypes: influencer.contentTypes || [],
      followerCount: influencer.followerCount || 0,
      engagementRate: influencer.engagementRate || 0,
      avgViews: influencer.avgViews || 0,
      pricePerPost: influencer.pricePerPost || 0,
      pricePerStory: influencer.pricePerStory || 0,
      pricePerVideo: influencer.pricePerVideo || 0,
      city: influencer.city || "",
      region: influencer.region || "",
      bestCollaborationTimes: influencer.bestCollaborationTimes || "",
      notes: influencer.notes || "",
      isActive: influencer.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const openDetailSheet = (influencer: MarketingInfluencer) => {
    setSelectedInfluencer(influencer);
    setIsDetailSheetOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.specialty) {
      toast({ title: "يرجى ملء الحقول المطلوبة", variant: "destructive" });
      return;
    }
    if (selectedInfluencer && isEditDialogOpen) {
      updateMutation.mutate({ ...formData, id: selectedInfluencer.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const togglePlatform = (platform: string) => {
    setFormData((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }));
  };

  const toggleContentType = (contentType: string) => {
    setFormData((prev) => ({
      ...prev,
      contentTypes: prev.contentTypes.includes(contentType)
        ? prev.contentTypes.filter((c) => c !== contentType)
        : [...prev.contentTypes, contentType],
    }));
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return "-";
    const fullStars = Math.floor(rating);
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`w-4 h-4 ${i < fullStars ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`}
        />
      );
    }
    return <div className="flex items-center gap-0.5">{stars}</div>;
  };

  const InfluencerForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>الاسم (English) *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Influencer Name"
            dir="ltr"
            data-testid="input-influencer-name"
          />
        </div>
        <div className="space-y-2">
          <Label>الاسم (عربي)</Label>
          <Input
            value={formData.nameAr}
            onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
            placeholder="اسم المؤثر بالعربي"
            data-testid="input-influencer-name-ar"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>البريد الإلكتروني</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="email@example.com"
            dir="ltr"
            data-testid="input-influencer-email"
          />
        </div>
        <div className="space-y-2">
          <Label>رقم الهاتف</Label>
          <Input
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+966..."
            dir="ltr"
            data-testid="input-influencer-phone"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>التخصص *</Label>
        <Select
          value={formData.specialty}
          onValueChange={(value) => setFormData({ ...formData, specialty: value })}
        >
          <SelectTrigger data-testid="select-influencer-specialty">
            <SelectValue placeholder="اختر التخصص" />
          </SelectTrigger>
          <SelectContent>
            {INFLUENCER_SPECIALTIES.map((specialty) => (
              <SelectItem key={specialty} value={specialty}>
                {INFLUENCER_SPECIALTY_LABELS[specialty]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>المنصات</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {INFLUENCER_PLATFORMS.map((platform) => (
            <div key={platform} className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id={`platform-${platform}`}
                checked={formData.platforms.includes(platform)}
                onCheckedChange={() => togglePlatform(platform)}
                data-testid={`checkbox-platform-${platform}`}
              />
              <label htmlFor={`platform-${platform}`} className="text-sm cursor-pointer">
                {INFLUENCER_PLATFORM_LABELS[platform]}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>نوع المحتوى</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {INFLUENCER_CONTENT_TYPES.map((contentType) => (
            <div key={contentType} className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id={`content-${contentType}`}
                checked={formData.contentTypes.includes(contentType)}
                onCheckedChange={() => toggleContentType(contentType)}
                data-testid={`checkbox-content-${contentType}`}
              />
              <label htmlFor={`content-${contentType}`} className="text-sm cursor-pointer">
                {INFLUENCER_CONTENT_TYPE_LABELS[contentType]}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>عدد المتابعين</Label>
          <Input
            type="number"
            value={formData.followerCount}
            onChange={(e) => setFormData({ ...formData, followerCount: parseInt(e.target.value) || 0 })}
            placeholder="0"
            dir="ltr"
            data-testid="input-influencer-followers"
          />
        </div>
        <div className="space-y-2">
          <Label>معدل التفاعل (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.engagementRate}
            onChange={(e) => setFormData({ ...formData, engagementRate: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            dir="ltr"
            data-testid="input-influencer-engagement"
          />
        </div>
        <div className="space-y-2">
          <Label>متوسط المشاهدات</Label>
          <Input
            type="number"
            value={formData.avgViews}
            onChange={(e) => setFormData({ ...formData, avgViews: parseInt(e.target.value) || 0 })}
            placeholder="0"
            dir="ltr"
            data-testid="input-influencer-views"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>سعر المنشور (ر.س)</Label>
          <Input
            type="number"
            value={formData.pricePerPost}
            onChange={(e) => setFormData({ ...formData, pricePerPost: parseFloat(e.target.value) || 0 })}
            placeholder="0"
            dir="ltr"
            data-testid="input-influencer-price-post"
          />
        </div>
        <div className="space-y-2">
          <Label>سعر الستوري (ر.س)</Label>
          <Input
            type="number"
            value={formData.pricePerStory}
            onChange={(e) => setFormData({ ...formData, pricePerStory: parseFloat(e.target.value) || 0 })}
            placeholder="0"
            dir="ltr"
            data-testid="input-influencer-price-story"
          />
        </div>
        <div className="space-y-2">
          <Label>سعر الفيديو (ر.س)</Label>
          <Input
            type="number"
            value={formData.pricePerVideo}
            onChange={(e) => setFormData({ ...formData, pricePerVideo: parseFloat(e.target.value) || 0 })}
            placeholder="0"
            dir="ltr"
            data-testid="input-influencer-price-video"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>المدينة</Label>
          <Input
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="الرياض"
            data-testid="input-influencer-city"
          />
        </div>
        <div className="space-y-2">
          <Label>المنطقة</Label>
          <Input
            value={formData.region}
            onChange={(e) => setFormData({ ...formData, region: e.target.value })}
            placeholder="منطقة الرياض"
            data-testid="input-influencer-region"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>أفضل أوقات التعاون</Label>
        <Input
          value={formData.bestCollaborationTimes}
          onChange={(e) => setFormData({ ...formData, bestCollaborationTimes: e.target.value })}
          placeholder="مثال: المواسم، رمضان، الأعياد..."
          data-testid="input-influencer-best-times"
        />
      </div>

      <div className="space-y-2">
        <Label>ملاحظات</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="ملاحظات إضافية..."
          data-testid="input-influencer-notes"
        />
      </div>

      <div className="flex items-center space-x-2 space-x-reverse">
        <Checkbox
          id="is-active"
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData({ ...formData, isActive: !!checked })}
          data-testid="checkbox-influencer-active"
        />
        <label htmlFor="is-active" className="text-sm cursor-pointer">
          نشط
        </label>
      </div>

      <DialogFooter>
        <Button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
          data-testid="button-submit-influencer"
        >
          {(createMutation.isPending || updateMutation.isPending) && (
            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
          )}
          {selectedInfluencer && isEditDialogOpen ? "تحديث" : "إضافة"}
        </Button>
      </DialogFooter>
    </form>
  );

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
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
                المؤثرين والبلوجرز
              </h1>
              <p className="text-muted-foreground">إدارة ومتابعة المؤثرين والبلوجرز</p>
            </div>
          </div>
          {canEdit && (
            <Button
              onClick={() => {
                setFormData(defaultFormData);
                setSelectedInfluencer(null);
                setIsAddDialogOpen(true);
              }}
              data-testid="button-add-influencer"
            >
              <Plus className="w-4 h-4 ml-2" />
              إضافة مؤثر جديد
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="البحث بالاسم..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
              data-testid="input-search-influencers"
            />
          </div>
          <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-specialty-filter">
              <SelectValue placeholder="جميع التخصصات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع التخصصات</SelectItem>
              {INFLUENCER_SPECIALTIES.map((specialty) => (
                <SelectItem key={specialty} value={specialty}>
                  {INFLUENCER_SPECIALTY_LABELS[specialty]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
              <SelectValue placeholder="جميع الحالات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="inactive">غير نشط</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredInfluencers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <User className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لا يوجد مؤثرين</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInfluencers.map((influencer) => (
              <Card key={influencer.id} data-testid={`card-influencer-${influencer.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {influencer.profileImageUrl ? (
                        <img
                          src={influencer.profileImageUrl}
                          alt={influencer.name}
                          className="w-12 h-12 rounded-full object-cover"
                          data-testid={`img-influencer-${influencer.id}`}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <User className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-base">{influencer.name}</CardTitle>
                        {influencer.nameAr && (
                          <p className="text-sm text-muted-foreground">{influencer.nameAr}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant={influencer.isActive ? "default" : "secondary"}>
                      {influencer.isActive ? "نشط" : "غير نشط"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Badge variant="outline">
                      {INFLUENCER_SPECIALTY_LABELS[influencer.specialty as keyof typeof INFLUENCER_SPECIALTY_LABELS] ||
                        influencer.specialty}
                    </Badge>
                  </div>

                  {influencer.platforms && influencer.platforms.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {influencer.platforms.map((platform) => (
                        <Badge key={platform} variant="secondary" className="text-xs">
                          {INFLUENCER_PLATFORM_LABELS[platform as keyof typeof INFLUENCER_PLATFORM_LABELS] || platform}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{formatFollowerCount(influencer.followerCount)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Activity className="w-4 h-4" />
                      <span>{influencer.engagementRate ? `${influencer.engagementRate}%` : "-"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {renderStars(influencer.rating)}
                    {influencer.rating && <span className="text-sm text-muted-foreground">({influencer.rating.toFixed(1)})</span>}
                  </div>

                  <div className="space-y-1 text-sm text-muted-foreground">
                    {influencer.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span dir="ltr">{influencer.email}</span>
                      </div>
                    )}
                    {influencer.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <span dir="ltr">{influencer.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDetailSheet(influencer)}
                      data-testid={`button-view-influencer-${influencer.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    {canEdit && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(influencer)}
                          data-testid={`button-edit-influencer-${influencer.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedInfluencer(influencer);
                              setIsDeleteDialogOpen(true);
                            }}
                            data-testid={`button-delete-influencer-${influencer.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog
          open={isAddDialogOpen || isEditDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsAddDialogOpen(false);
              setIsEditDialogOpen(false);
              setSelectedInfluencer(null);
              setFormData(defaultFormData);
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>
                {selectedInfluencer && isEditDialogOpen ? "تعديل المؤثر" : "إضافة مؤثر جديد"}
              </DialogTitle>
              <DialogDescription>
                {selectedInfluencer && isEditDialogOpen
                  ? "قم بتعديل بيانات المؤثر"
                  : "أدخل بيانات المؤثر الجديد"}
              </DialogDescription>
            </DialogHeader>
            <InfluencerForm />
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف المؤثر "{selectedInfluencer?.name}" نهائياً. لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedInfluencer && deleteMutation.mutate(selectedInfluencer.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Sheet open={isDetailSheetOpen} onOpenChange={setIsDetailSheetOpen}>
          <SheetContent side="left" className="w-full sm:max-w-xl overflow-y-auto" dir="rtl">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                {selectedInfluencer?.profileImageUrl ? (
                  <img
                    src={selectedInfluencer.profileImageUrl}
                    alt={selectedInfluencer.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <span>{selectedInfluencer?.name}</span>
                  {selectedInfluencer?.nameAr && (
                    <p className="text-sm font-normal text-muted-foreground">{selectedInfluencer.nameAr}</p>
                  )}
                </div>
              </SheetTitle>
              <SheetDescription>
                {selectedInfluencer?.specialty &&
                  INFLUENCER_SPECIALTY_LABELS[selectedInfluencer.specialty as keyof typeof INFLUENCER_SPECIALTY_LABELS]}
              </SheetDescription>
            </SheetHeader>

            {selectedInfluencer && (
              <Tabs defaultValue="info" className="mt-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="info" data-testid="tab-info">معلومات</TabsTrigger>
                  <TabsTrigger value="campaigns" data-testid="tab-campaigns">الحملات</TabsTrigger>
                  <TabsTrigger value="contacts" data-testid="tab-contacts">التواصل</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">المتابعين</p>
                      <p className="font-medium flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {formatFollowerCount(selectedInfluencer.followerCount)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">معدل التفاعل</p>
                      <p className="font-medium flex items-center gap-1">
                        <Activity className="w-4 h-4" />
                        {selectedInfluencer.engagementRate ? `${selectedInfluencer.engagementRate}%` : "-"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">متوسط المشاهدات</p>
                      <p className="font-medium">{formatFollowerCount(selectedInfluencer.avgViews)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">التقييم</p>
                      {renderStars(selectedInfluencer.rating)}
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <h4 className="font-medium">الأسعار</h4>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">منشور</p>
                        <p className="font-medium">{formatCurrency(selectedInfluencer.pricePerPost)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">ستوري</p>
                        <p className="font-medium">{formatCurrency(selectedInfluencer.pricePerStory)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">فيديو</p>
                        <p className="font-medium">{formatCurrency(selectedInfluencer.pricePerVideo)}</p>
                      </div>
                    </div>
                  </div>

                  {selectedInfluencer.platforms && selectedInfluencer.platforms.length > 0 && (
                    <div className="border-t pt-4 space-y-2">
                      <h4 className="font-medium">المنصات</h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedInfluencer.platforms.map((platform) => (
                          <Badge key={platform} variant="secondary">
                            {INFLUENCER_PLATFORM_LABELS[platform as keyof typeof INFLUENCER_PLATFORM_LABELS] ||
                              platform}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedInfluencer.contentTypes && selectedInfluencer.contentTypes.length > 0 && (
                    <div className="border-t pt-4 space-y-2">
                      <h4 className="font-medium">نوع المحتوى</h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedInfluencer.contentTypes.map((type) => (
                          <Badge key={type} variant="outline">
                            {INFLUENCER_CONTENT_TYPE_LABELS[type as keyof typeof INFLUENCER_CONTENT_TYPE_LABELS] || type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4 space-y-2">
                    <h4 className="font-medium">معلومات التواصل</h4>
                    <div className="space-y-1 text-sm">
                      {selectedInfluencer.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span dir="ltr">{selectedInfluencer.email}</span>
                        </div>
                      )}
                      {selectedInfluencer.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span dir="ltr">{selectedInfluencer.phone}</span>
                        </div>
                      )}
                      {(selectedInfluencer.city || selectedInfluencer.region) && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span>
                            {[selectedInfluencer.city, selectedInfluencer.region].filter(Boolean).join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedInfluencer.bestCollaborationTimes && (
                    <div className="border-t pt-4 space-y-2">
                      <h4 className="font-medium">أفضل أوقات التعاون</h4>
                      <p className="text-sm text-muted-foreground">{selectedInfluencer.bestCollaborationTimes}</p>
                    </div>
                  )}

                  {selectedInfluencer.notes && (
                    <div className="border-t pt-4 space-y-2">
                      <h4 className="font-medium">ملاحظات</h4>
                      <p className="text-sm text-muted-foreground">{selectedInfluencer.notes}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="campaigns" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    {campaignLinks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="w-8 h-8 mx-auto mb-2" />
                        <p>لا توجد حملات مرتبطة</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {campaignLinks.map((link) => (
                          <Card key={link.id} data-testid={`card-campaign-link-${link.id}`}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">حملة #{link.campaignId}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {link.startDate} - {link.endDate}
                                  </p>
                                </div>
                                <Badge>{link.status}</Badge>
                              </div>
                              {link.contractAmount && (
                                <p className="text-sm mt-2">
                                  <DollarSign className="w-3 h-3 inline" />
                                  {formatCurrency(link.contractAmount)}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="contacts" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    {contacts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                        <p>لا يوجد سجل تواصل</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {contacts.map((contact) => (
                          <Card key={contact.id} data-testid={`card-contact-${contact.id}`}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">{contact.subject || contact.contactType}</p>
                                  <p className="text-sm text-muted-foreground">{contact.contactDate}</p>
                                </div>
                                {contact.outcome && (
                                  <Badge variant={contact.outcome === "positive" ? "default" : "secondary"}>
                                    {contact.outcome}
                                  </Badge>
                                )}
                              </div>
                              {contact.notes && (
                                <p className="text-sm text-muted-foreground mt-2">{contact.notes}</p>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </Layout>
  );
}
