import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Plus, Image, Video, FileText, Download, Trash2, Eye, FolderOpen } from "lucide-react";
import { Link } from "wouter";

interface Campaign {
  id: number;
  name: string;
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

const assetTypeLabels: Record<string, string> = {
  image: "صورة",
  video: "فيديو",
  document: "مستند",
  design: "تصميم",
  audio: "صوت",
  other: "أخرى",
};

const assetTypeIcons: Record<string, React.ReactNode> = {
  image: <Image className="h-8 w-8 text-blue-500" />,
  video: <Video className="h-8 w-8 text-red-500" />,
  document: <FileText className="h-8 w-8 text-green-500" />,
  design: <Image className="h-8 w-8 text-purple-500" />,
  audio: <Video className="h-8 w-8 text-orange-500" />,
  other: <FolderOpen className="h-8 w-8 text-gray-500" />,
};

export default function MarketingAssetsPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterCampaignId, setFilterCampaignId] = useState<number | null>(null);
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
    queryKey: ["/api/marketing/assets", filterType, filterCampaignId],
    queryFn: async () => {
      let url = "/api/marketing/assets";
      const params = new URLSearchParams();
      if (filterType) params.append("assetType", filterType);
      if (filterCampaignId) params.append("campaignId", filterCampaignId.toString());
      if (params.toString()) url += `?${params.toString()}`;
      
      const res = await fetch(url);
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

  const getCampaignName = (campaignId: number | null) => {
    if (!campaignId) return "عام";
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign?.name || "غير محدد";
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-100 flex items-center justify-center" dir="rtl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-100 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/marketing">
              <Button variant="outline" size="sm" className="gap-2" data-testid="button-back">
                <ArrowRight className="h-4 w-4" />
                العودة للتسويق
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-800" data-testid="text-page-title">الأصول التسويقية</h1>
              <p className="text-gray-600">إدارة الصور والفيديوهات والملفات التسويقية</p>
            </div>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-pink-500 hover:bg-pink-600 gap-2" data-testid="button-add-asset">
                <Plus className="h-4 w-4" />
                إضافة أصل
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة أصل تسويقي</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>اسم الأصل</Label>
                  <Input
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
                    <SelectTrigger data-testid="select-asset-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(assetTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
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
                    <SelectTrigger data-testid="select-campaign">
                      <SelectValue placeholder="اختر الحملة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">عام (بدون حملة)</SelectItem>
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id.toString()}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>رابط الملف</Label>
                  <Input
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
                    value={tagsInput}
                    onChange={(e) => handleTagsChange(e.target.value)}
                    placeholder="رمضان, عروض, صيف"
                    data-testid="input-tags"
                  />
                </div>
                <Button
                  onClick={() => createAssetMutation.mutate(formData)}
                  disabled={!formData.name || createAssetMutation.isPending}
                  className="w-full bg-pink-500 hover:bg-pink-600"
                  data-testid="button-submit-asset"
                >
                  {createAssetMutation.isPending ? "جاري الإضافة..." : "إضافة الأصل"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4 mb-6">
          <Select
            value={filterType || "all"}
            onValueChange={(value) => setFilterType(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-48 bg-white" data-testid="select-filter-type">
              <SelectValue placeholder="جميع الأنواع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الأنواع</SelectItem>
              {Object.entries(assetTypeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterCampaignId?.toString() || "all"}
            onValueChange={(value) => setFilterCampaignId(value === "all" ? null : parseInt(value))}
          >
            <SelectTrigger className="w-48 bg-white" data-testid="select-filter-campaign">
              <SelectValue placeholder="جميع الحملات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحملات</SelectItem>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id.toString()}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {assets.map((asset) => (
            <Card key={asset.id} className="hover:shadow-lg transition-shadow" data-testid={`card-asset-${asset.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  {assetTypeIcons[asset.assetType] || assetTypeIcons.other}
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {assetTypeLabels[asset.assetType]}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <h3 className="font-semibold text-gray-800 mb-2 truncate">{asset.name}</h3>
                <p className="text-sm text-gray-500 mb-2">{getCampaignName(asset.campaignId)}</p>
                
                {asset.description && (
                  <p className="text-xs text-gray-400 mb-2 line-clamp-2">{asset.description}</p>
                )}

                {asset.tags && asset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {asset.tags.slice(0, 3).map((tag, i) => (
                      <span key={i} className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                    {asset.tags.length > 3 && (
                      <span className="text-xs text-gray-400">+{asset.tags.length - 3}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{formatFileSize(asset.fileSize)}</span>
                  <span>{new Date(asset.createdAt).toLocaleDateString('en-US')}</span>
                </div>

                <div className="flex gap-2 mt-3">
                  {asset.fileUrl && (
                    <a href={asset.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="flex-1" data-testid={`button-view-${asset.id}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAssetMutation.mutate(asset.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    data-testid={`button-delete-${asset.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {assets.length === 0 && (
          <Card className="p-12 text-center">
            <FolderOpen className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">لا توجد أصول</h3>
            <p className="text-gray-500">قم بإضافة الصور والفيديوهات والملفات التسويقية</p>
          </Card>
        )}
      </div>
    </div>
  );
}
