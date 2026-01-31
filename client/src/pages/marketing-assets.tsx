import { useState, useRef } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowRight, Plus, Image, Video, FileText, Download, 
  Trash2, Eye, FolderOpen, Search, Filter, Tag, Calendar,
  MoreVertical, Edit, Link as LinkIcon, Upload, Loader2, MapPin, Building2
} from "lucide-react";
import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Branch {
  id: string;
  name: string;
  nameAr?: string;
}

interface Campaign {
  id: number;
  name: string;
  nameAr?: string;
}

interface MarketingAsset {
  id: number;
  campaignId: number | null;
  branchId: string | null;
  name: string;
  assetType: string;
  fileUrl: string | null;
  fileSize: number | null;
  description: string | null;
  location: string | null;
  quantity: number;
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
  const [filterBranchId, setFilterBranchId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    campaignId: null as number | null,
    branchId: null as string | null,
    name: "",
    assetType: "image",
    fileUrl: "",
    fileSize: null as number | null,
    description: "",
    location: "",
    quantity: 1,
    tags: [] as string[],
  });
  const [tagsInput, setTagsInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) return [];
      return res.json();
    },
  });

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
      branchId: null as string | null,
      name: "",
      assetType: "image",
      fileUrl: "",
      fileSize: null,
      description: "",
      location: "",
      quantity: 1,
      tags: [],
    });
    setTagsInput("");
    setUploadedFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadedFileName(file.name);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formDataUpload,
      });

      if (!response.ok) {
        throw new Error("فشل في رفع الملف");
      }

      const result = await response.json();
      const fileUrl = result.filePath ? `/api/documents/file/${result.filePath}` : (result.url || result.fileUrl);
      setFormData(prev => ({
        ...prev,
        fileUrl: fileUrl,
        fileSize: file.size,
      }));
      toast({ title: "تم رفع الملف بنجاح" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "فشل في رفع الملف", variant: "destructive" });
      setUploadedFileName("");
    } finally {
      setIsUploading(false);
    }
  };

  const handleTagsChange = (value: string) => {
    setTagsInput(value);
    const tags = value.split(",").map(tag => tag.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, tags }));
  };

  const openEditDialog = (asset: MarketingAsset) => {
    setFormData({
      campaignId: asset.campaignId,
      branchId: asset.branchId,
      name: asset.name,
      assetType: asset.assetType,
      fileUrl: asset.fileUrl || "",
      fileSize: asset.fileSize,
      description: asset.description || "",
      location: asset.location || "",
      quantity: asset.quantity || 1,
      tags: asset.tags || [],
    });
    setTagsInput((asset.tags || []).join(", "));
    setEditingAsset(asset);
    setIsEditDialogOpen(true);
  };

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return "المركز الرئيسي";
    const branch = branches.find(b => b.id === branchId);
    return branch?.nameAr || branch?.name || "غير محدد";
  };

  const getCampaignName = (campaignId: number | null) => {
    if (!campaignId) return "-";
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const filteredAssets = assets.filter(asset => {
    const matchesType = filterType === "all" || asset.assetType === filterType;
    const matchesCampaign = filterCampaignId === "all" || 
      (filterCampaignId === "none" && !asset.campaignId) ||
      asset.campaignId?.toString() === filterCampaignId;
    const matchesBranch = filterBranchId === "all" ||
      (filterBranchId === "none" && !asset.branchId) ||
      asset.branchId?.toString() === filterBranchId;
    const matchesSearch = !searchQuery || 
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (asset.description?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (asset.location?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (asset.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesType && matchesCampaign && matchesBranch && matchesSearch;
  });

  const assetStats = {
    total: assets.length,
    images: assets.filter(a => a.assetType === "image").length,
    videos: assets.filter(a => a.assetType === "video").length,
    documents: assets.filter(a => a.assetType === "document").length,
  };

  const AssetFormContent = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
      <div>
        <Label>اسم الأصل *</Label>
        <Input
          className="h-11 sm:h-10"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="مثال: بانر رمضان"
          data-testid="input-asset-name"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>نوع الأصل</Label>
          <Select
            value={formData.assetType}
            onValueChange={(value) => setFormData(prev => ({ ...prev, assetType: value }))}
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
          <Label>الكمية</Label>
          <Input
            type="number"
            min="1"
            className="h-11 sm:h-10"
            value={formData.quantity}
            onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
            data-testid="input-quantity"
          />
        </div>
      </div>
      <div>
        <Label>الفرع *</Label>
        <Select
          value={formData.branchId?.toString() || "none"}
          onValueChange={(value) => setFormData(prev => ({ ...prev, branchId: value === "none" ? null : value }))}
        >
          <SelectTrigger className="h-11 sm:h-10" data-testid="select-branch">
            <SelectValue placeholder="اختر الفرع" />
          </SelectTrigger>
          <SelectContent className="max-h-60 overflow-y-auto">
            <SelectItem value="none">المركز الرئيسي</SelectItem>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id.toString()}>
                {branch.nameAr || branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>مكان التواجد</Label>
        <Input
          className="h-11 sm:h-10"
          value={formData.location || ""}
          onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
          placeholder="مثال: المخزن، الواجهة، المكتب..."
          data-testid="input-location"
        />
      </div>
      <div>
        <Label>الحملة (اختياري)</Label>
        <Select
          value={formData.campaignId?.toString() || "none"}
          onValueChange={(value) => setFormData(prev => ({ ...prev, campaignId: value === "none" ? null : parseInt(value) }))}
        >
          <SelectTrigger className="h-11 sm:h-10" data-testid="select-campaign">
            <SelectValue placeholder="اختر الحملة" />
          </SelectTrigger>
          <SelectContent className="max-h-60 overflow-y-auto">
            <SelectItem value="none">بدون حملة</SelectItem>
            {campaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id.toString()}>
                {campaign.nameAr || campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>رفع ملف</Label>
        <div className="flex flex-col gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx"
            className="hidden"
            data-testid="input-file-upload"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="h-11 sm:h-10 w-full"
            data-testid="button-upload-file"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                جاري الرفع...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 ml-2" />
                اختر ملف للرفع
              </>
            )}
          </Button>
          {uploadedFileName && (
            <p className="text-sm text-green-600">تم رفع: {uploadedFileName}</p>
          )}
        </div>
      </div>
      <div>
        <Label>أو أدخل رابط الملف</Label>
        <Input
          className="h-11 sm:h-10"
          value={formData.fileUrl || ""}
          onChange={(e) => setFormData(prev => ({ ...prev, fileUrl: e.target.value }))}
          placeholder="https://..."
          data-testid="input-file-url"
        />
      </div>
      <div>
        <Label>الوصف</Label>
        <Textarea
          value={formData.description || ""}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
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
        <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-4" dir="rtl">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-4" dir="rtl">
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
            <DialogContent className="max-w-lg" dir="rtl">
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
            <div className="flex flex-col lg:flex-row gap-4">
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
                <SelectTrigger className="w-full lg:w-40 h-11 sm:h-10" data-testid="select-filter-type">
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
              <Select value={filterBranchId} onValueChange={setFilterBranchId}>
                <SelectTrigger className="w-full lg:w-40 h-11 sm:h-10" data-testid="select-filter-branch">
                  <Building2 className="w-4 h-4 ml-2" />
                  <SelectValue placeholder="الفرع" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  <SelectItem value="none">المركز الرئيسي</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.nameAr || branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCampaignId} onValueChange={setFilterCampaignId}>
                <SelectTrigger className="w-full lg:w-40 h-11 sm:h-10" data-testid="select-filter-campaign">
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

        <Card>
          <CardContent className="p-0">
            {filteredAssets.length > 0 ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">اسم الأصل</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right hidden md:table-cell">الفرع</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">مكان التواجد</TableHead>
                      <TableHead className="text-right">الكمية</TableHead>
                      <TableHead className="text-right hidden md:table-cell">الحملة</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">حجم الملف</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">تاريخ الإضافة</TableHead>
                      <TableHead className="text-right w-16">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssets.map((asset) => {
                      const typeInfo = getAssetTypeInfo(asset.assetType);
                      const TypeIcon = typeInfo.icon;
                      
                      return (
                        <TableRow key={asset.id} data-testid={`row-asset-${asset.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                                <TypeIcon className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-medium">{asset.name}</p>
                                {asset.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">{asset.description}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${typeInfo.color} text-[10px] sm:text-xs`}>
                              {typeInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-1">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                              {getBranchName(asset.branchId)}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {asset.location ? (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                {asset.location}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px] sm:text-xs">{asset.quantity || 1}</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{getCampaignName(asset.campaignId)}</TableCell>
                          <TableCell className="hidden lg:table-cell">{formatFileSize(asset.fileSize)}</TableCell>
                          <TableCell className="hidden sm:table-cell">{formatDate(asset.createdAt)}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
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
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">لا توجد أصول</h3>
                <p className="text-muted-foreground mb-4">ابدأ بإضافة أصول تسويقية جديدة</p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة أصل جديد
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-lg" dir="rtl">
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
