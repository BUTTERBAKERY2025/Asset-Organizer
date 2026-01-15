import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowRight, Plus, Image, Video, FileText, Download, 
  Trash2, Eye, FolderOpen, Search, Filter, Tag, Calendar,
  MoreVertical, Edit, Link as LinkIcon
} from "lucide-react";
import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Campaign {
  id: number;
  name: string;
  nameAr?: string;
}

interface MarketingAsset {
  id: number;
  campaignId: number | null;
  name: string;
  assetType: string;
  fileUrl: string | null;
  fileSize: number | null;
  description: string | null;
  tags: string[];
  createdBy: number | null;
  createdAt: string;
}

const ASSET_TYPES = [
  { value: "image", label: "صورة", icon: Image, color: "bg-blue-100 text-blue-700" },
  { value: "video", label: "فيديو", icon: Video, color: "bg-red-100 text-red-700" },
  { value: "document", label: "مستند", icon: FileText, color: "bg-green-100 text-green-700" },
  { value: "design", label: "تصميم", icon: Image, color: "bg-purple-100 text-purple-700" },
  { value: "audio", label: "صوت", icon: Video, color: "bg-orange-100 text-orange-700" },
  { value: "other", label: "أخرى", icon: FolderOpen, color: "bg-gray-100 text-gray-700" },
];

export default function MarketingAssetsPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<MarketingAsset | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCampaignId, setFilterCampaignId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    campaignId: null as number | null,
    name: "",
    assetType: "image",
    fileUrl: "",
    fileSize: null as number | null,
    description: "",
    tags: [] as string[],
  });
  const [tagsInput, setTagsInput] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/marketing/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/campaigns");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: assets = [], isLoading } = useQuery<MarketingAsset[]>({
    queryKey: ["/api/marketing/assets"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/assets");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createAssetMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/marketing/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل في إضافة الأصل");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/assets"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "تم إضافة الأصل بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إضافة الأصل", variant: "destructive" });
    },
  });

  const updateAssetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const res = await fetch(`/api/marketing/assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل في تحديث الأصل");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/assets"] });
      setIsEditDialogOpen(false);
      setEditingAsset(null);
      resetForm();
      toast({ title: "تم تحديث الأصل بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في تحديث الأصل", variant: "destructive" });
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/marketing/assets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل في حذف الأصل");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/assets"] });
      toast({ title: "تم حذف الأصل بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في حذف الأصل", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      campaignId: null,
      name: "",
      assetType: "image",
      fileUrl: "",
      fileSize: null,
      description: "",
      tags: [],
    });
    setTagsInput("");
  };

  const handleTagsChange = (value: string) => {
    setTagsInput(value);
    const tags = value.split(",").map(tag => tag.trim()).filter(Boolean);
    setFormData({ ...formData, tags });
  };

  const openEditDialog = (asset: MarketingAsset) => {
    setFormData({
      campaignId: asset.campaignId,
      name: asset.name,
      assetType: asset.assetType,
      fileUrl: asset.fileUrl || "",
      fileSize: asset.fileSize,
      description: asset.description || "",
      tags: asset.tags || [],
    });
    setTagsInput((asset.tags || []).join(", "));
    setEditingAsset(asset);
    setIsEditDialogOpen(true);
  };

  const getCampaignName = (campaignId: number | null) => {
    if (!campaignId) return "عام";
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign?.nameAr || campaign?.name || "غير محدد";
  };

  const getAssetTypeInfo = (type: string) => {
    return ASSET_TYPES.find(t => t.value === type) || ASSET_TYPES[ASSET_TYPES.length - 1];
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredAssets = assets.filter(asset => {
    const matchesType = filterType === "all" || asset.assetType === filterType;
    const matchesCampaign = filterCampaignId === "all" || 
      (filterCampaignId === "none" && !asset.campaignId) ||
      asset.campaignId?.toString() === filterCampaignId;
    const matchesSearch = !searchQuery || 
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (asset.description?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (asset.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesType && matchesCampaign && matchesSearch;
  });

  const assetStats = {
    total: assets.length,
    images: assets.filter(a => a.assetType === "image").length,
    videos: assets.filter(a => a.assetType === "video").length,
    documents: assets.filter(a => a.assetType === "document").length,
  };

  const AssetFormContent = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4">
      <div>
        <Label>اسم الأصل *</Label>
        <Input
          className="h-11 sm:h-10"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="مثال: بانر رمضان"
          data-testid="input-asset-name"
        />
      </div>
      <div>
        <Label>نوع الأصل</Label>
        <Select
          value={formData.assetType}
          onValueChange={(value) => setFormData({ ...formData, assetType: value })}
        >
          <SelectTrigger className="h-11 sm:h-10" data-testid="select-asset-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-60 overflow-y-auto">
            {ASSET_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex items-center gap-2">
                  <type.icon className="w-4 h-4" />
                  {type.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>الحملة (اختياري)</Label>
        <Select
          value={formData.campaignId?.toString() || "none"}
          onValueChange={(value) => setFormData({ ...formData, campaignId: value === "none" ? null : parseInt(value) })}
        >
          <SelectTrigger className="h-11 sm:h-10" data-testid="select-campaign">
            <SelectValue placeholder="اختر الحملة" />
          </SelectTrigger>
          <SelectContent className="max-h-60 overflow-y-auto">
            <SelectItem value="none">عام (بدون حملة)</SelectItem>
            {campaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id.toString()}>
                {campaign.nameAr || campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>رابط الملف</Label>
        <Input
          className="h-11 sm:h-10"
          value={formData.fileUrl || ""}
          onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
          placeholder="https://..."
          data-testid="input-file-url"
        />
      </div>
      <div>
        <Label>الوصف</Label>
        <Textarea
          value={formData.description || ""}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="وصف الأصل التسويقي..."
          data-testid="input-description"
        />
      </div>
      <div>
        <Label>الوسوم (مفصولة بفاصلة)</Label>
        <Input
          className="h-11 sm:h-10"
          value={tagsInput}
          onChange={(e) => handleTagsChange(e.target.value)}
          placeholder="رمضان, عروض, صيف"
          data-testid="input-tags"
        />
      </div>
      <Button
        onClick={() => {
          if (isEdit && editingAsset) {
            updateAssetMutation.mutate({ id: editingAsset.id, data: formData });
          } else {
            createAssetMutation.mutate(formData);
          }
        }}
        disabled={!formData.name || createAssetMutation.isPending || updateAssetMutation.isPending}
        className="w-full h-11 sm:h-9"
        data-testid="button-submit-asset"
      >
        {createAssetMutation.isPending || updateAssetMutation.isPending 
          ? "جاري الحفظ..." 
          : isEdit ? "حفظ التغييرات" : "إضافة الأصل"}
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-4" dir="rtl">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <Skeleton key={i} className="h-48" />)}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/marketing">
              <Button variant="outline" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" data-testid="button-back">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold" data-testid="page-title">الأصول التسويقية</h1>
              <p className="text-sm text-muted-foreground">إدارة الصور والفيديوهات والملفات التسويقية</p>
            </div>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 sm:h-9" data-testid="button-add-asset">
                <Plus className="w-4 h-4 ml-2" />
                إضافة أصل
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة أصل تسويقي</DialogTitle>
              </DialogHeader>
              <AssetFormContent />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <FolderOpen className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{assetStats.total}</p>
                  <p className="text-sm text-muted-foreground">إجمالي الأصول</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <Image className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{assetStats.images}</p>
                  <p className="text-sm text-muted-foreground">صور</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <Video className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{assetStats.videos}</p>
                  <p className="text-sm text-muted-foreground">فيديوهات</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <FileText className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{assetStats.documents}</p>
                  <p className="text-sm text-muted-foreground">مستندات</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pr-10 h-11 sm:h-10"
                  placeholder="بحث في الأصول..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-48 h-11 sm:h-10" data-testid="select-filter-type">
                  <Filter className="w-4 h-4 ml-2" />
                  <SelectValue placeholder="نوع الأصل" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  {ASSET_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCampaignId} onValueChange={setFilterCampaignId}>
                <SelectTrigger className="w-full sm:w-48 h-11 sm:h-10" data-testid="select-filter-campaign">
                  <SelectValue placeholder="الحملة" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="all">جميع الحملات</SelectItem>
                  <SelectItem value="none">بدون حملة</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id.toString()}>
                      {campaign.nameAr || campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {filteredAssets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredAssets.map((asset) => {
              const typeInfo = getAssetTypeInfo(asset.assetType);
              const TypeIcon = typeInfo.icon;
              
              return (
                <Card key={asset.id} className="hover:shadow-lg transition-shadow group" data-testid={`card-asset-${asset.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className={`p-3 rounded-lg ${typeInfo.color}`}>
                        <TypeIcon className="w-6 h-6" />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(asset)}>
                            <Edit className="w-4 h-4 ml-2" />
                            تعديل
                          </DropdownMenuItem>
                          {asset.fileUrl && (
                            <DropdownMenuItem asChild>
                              <a href={asset.fileUrl} target="_blank" rel="noopener noreferrer">
                                <Eye className="w-4 h-4 ml-2" />
                                معاينة
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => deleteAssetMutation.mutate(asset.id)}
                          >
                            <Trash2 className="w-4 h-4 ml-2" />
                            حذف
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h3 className="font-semibold truncate">{asset.name}</h3>
                      <p className="text-sm text-muted-foreground">{getCampaignName(asset.campaignId)}</p>
                    </div>
                    
                    {asset.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{asset.description}</p>
                    )}

                    {asset.tags && asset.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {asset.tags.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {asset.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{asset.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(asset.createdAt).toLocaleDateString('ar-SA')}
                      </div>
                      <span>{formatFileSize(asset.fileSize)}</span>
                    </div>

                    {asset.fileUrl && (
                      <a 
                        href={asset.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <Button variant="outline" size="sm" className="w-full h-9 gap-2">
                          <LinkIcon className="w-4 h-4" />
                          فتح الملف
                        </Button>
                      </a>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12">
            <div className="text-center">
              <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">لا توجد أصول</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || filterType !== "all" || filterCampaignId !== "all"
                  ? "لا توجد نتائج مطابقة للبحث"
                  : "قم بإضافة الصور والفيديوهات والملفات التسويقية"}
              </p>
              {!searchQuery && filterType === "all" && filterCampaignId === "all" && (
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة أصل جديد
                </Button>
              )}
            </div>
          </Card>
        )}

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل الأصل</DialogTitle>
            </DialogHeader>
            <AssetFormContent isEdit />
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
