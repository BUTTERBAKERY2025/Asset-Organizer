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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  ExternalLink,
  Building,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  CheckCircle,
  XCircle,
  TrendingUp,
  BarChart3,
  Link2,
  Copy,
} from "lucide-react";
import { Link } from "wouter";
import type { MarketingInfluencer, InfluencerCampaignLink, InfluencerContact, InfluencerPayment, CampaignExpense, MarketingCampaign } from "@shared/schema";
import {
  INFLUENCER_SPECIALTY_LABELS,
  INFLUENCER_SPECIALTIES,
  INFLUENCER_PLATFORM_LABELS,
  INFLUENCER_PLATFORMS,
  INFLUENCER_CONTENT_TYPE_LABELS,
  INFLUENCER_CONTENT_TYPES,
  INFLUENCER_PAYMENT_TYPE_LABELS,
  INFLUENCER_PAYMENT_METHOD_LABELS,
  INFLUENCER_PAYMENT_STATUS_LABELS,
  CAMPAIGN_EXPENSE_CATEGORY_LABELS,
  CAMPAIGN_EXPENSE_STATUS_LABELS,
} from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { InfluencerExcelImportDialog } from "@/components/influencer-excel-import-dialog";

interface InfluencerFormData {
  name: string;
  nameAr: string;
  email: string;
  phone: string;
  accountUrl: string;
  coverageUrl: string;
  specialty: string;
  platforms: string[];
  contentTypes: string[];
  followerCount: number;
  followerCountText: string;
  engagementRate: number;
  viewRating: number;
  avgViews: number;
  pricePerPost: number;
  pricePerStory: number;
  pricePerVideo: number;
  city: string;
  region: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  bankName: string;
  bestCollaborationTimes: string;
  notes: string;
  isActive: boolean;
}

const defaultFormData: InfluencerFormData = {
  name: "",
  nameAr: "",
  email: "",
  phone: "",
  accountUrl: "",
  coverageUrl: "",
  specialty: "",
  platforms: [],
  contentTypes: [],
  followerCount: 0,
  followerCountText: "",
  engagementRate: 0,
  viewRating: 0,
  avgViews: 0,
  pricePerPost: 0,
  pricePerStory: 0,
  pricePerVideo: 0,
  city: "",
  region: "",
  bankAccountNumber: "",
  bankAccountHolder: "",
  bankName: "",
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

function getInfluencerTier(followers: number | null): { tier: string; label: string; labelAr: string; color: string; bgColor: string } {
  const count = followers || 0;
  if (count >= 1000000) return { tier: 'mega', label: 'Mega', labelAr: 'ضخم', color: 'text-purple-700', bgColor: 'bg-purple-100' };
  if (count >= 100000) return { tier: 'macro', label: 'Macro', labelAr: 'كبير', color: 'text-blue-700', bgColor: 'bg-blue-100' };
  if (count >= 10000) return { tier: 'micro', label: 'Micro', labelAr: 'متوسط', color: 'text-green-700', bgColor: 'bg-green-100' };
  return { tier: 'nano', label: 'Nano', labelAr: 'صغير', color: 'text-gray-700', bgColor: 'bg-gray-100' };
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || amount === 0) return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount) + " ر.س";
}

export default function MarketingInfluencersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [followerRangeFilter, setFollowerRangeFilter] = useState<string>("all");
  const [bankInfoFilter, setBankInfoFilter] = useState<string>("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [selectedInfluencer, setSelectedInfluencer] = useState<MarketingInfluencer | null>(null);
  const [formData, setFormData] = useState<InfluencerFormData>(defaultFormData);
  const [isExporting, setIsExporting] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [activePageTab, setActivePageTab] = useState("influencers");
  const [coverageSearchQuery, setCoverageSearchQuery] = useState("");
  const [coverageRegionFilter, setCoverageRegionFilter] = useState<string>("all");
  const [coverageCampaignFilter, setCoverageCampaignFilter] = useState<string>("all");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

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
    staleTime: 1000 * 60 * 5, // 5 minutes
    placeholderData: (prev) => prev,
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

  const { data: payments = [] } = useQuery<InfluencerPayment[]>({
    queryKey: ["/api/marketing/influencers", selectedInfluencer?.id, "payments"],
    queryFn: async () => {
      if (!selectedInfluencer) return [];
      const res = await fetch(`/api/marketing/influencers/${selectedInfluencer.id}/payments`);
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: !!selectedInfluencer && isDetailSheetOpen,
  });

  const { data: totalPayments = 0 } = useQuery<number>({
    queryKey: ["/api/marketing/influencers", selectedInfluencer?.id, "total-payments"],
    queryFn: async () => {
      if (!selectedInfluencer) return 0;
      const res = await fetch(`/api/marketing/influencers/${selectedInfluencer.id}/total-payments`);
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      const data = await res.json();
      return data.total || 0;
    },
    enabled: !!selectedInfluencer && isDetailSheetOpen,
  });

  const { data: campaignExpenses = [] } = useQuery<CampaignExpense[]>({
    queryKey: ["/api/marketing/influencers", selectedInfluencer?.id, "expenses"],
    queryFn: async () => {
      if (!selectedInfluencer) return [];
      const res = await fetch(`/api/marketing/influencers/${selectedInfluencer.id}/expenses`);
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: !!selectedInfluencer && isDetailSheetOpen,
  });

  const { data: totalCampaignExpenses = 0 } = useQuery<number>({
    queryKey: ["/api/marketing/influencers", selectedInfluencer?.id, "total-expenses"],
    queryFn: async () => {
      if (!selectedInfluencer) return 0;
      const res = await fetch(`/api/marketing/influencers/${selectedInfluencer.id}/total-expenses`);
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      const data = await res.json();
      return data.total || 0;
    },
    enabled: !!selectedInfluencer && isDetailSheetOpen,
  });

  const { data: allCampaigns = [] } = useQuery<MarketingCampaign[]>({
    queryKey: ["/api/marketing/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/campaigns");
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    placeholderData: (prev) => prev,
  });

  const { data: allCampaignLinks = [] } = useQuery<InfluencerCampaignLink[]>({
    queryKey: ["/api/marketing/influencer-links/all"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/influencer-links");
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: activePageTab === "coverage-links",
  });

  const getCampaignName = (campaignId: number | null) => {
    if (!campaignId) return "-";
    const campaign = allCampaigns.find(c => c.id === campaignId);
    return campaign ? (campaign.nameAr || campaign.name) : "-";
  };

  const createMutation = useMutation({
    mutationFn: async (data: InfluencerFormData) => {
      const cleanData = {
        ...data,
        nameAr: data.nameAr || null,
        email: data.email || null,
        phone: data.phone || null,
        accountUrl: data.accountUrl || null,
        coverageUrl: data.coverageUrl || null,
        platforms: data.platforms.length > 0 ? data.platforms : null,
        contentTypes: data.contentTypes.length > 0 ? data.contentTypes : null,
        followerCountText: data.followerCountText || null,
        pricePerPost: data.pricePerPost || null,
        pricePerStory: data.pricePerStory || null,
        pricePerVideo: data.pricePerVideo || null,
        city: data.city || null,
        region: data.region || null,
        bankAccountNumber: data.bankAccountNumber || null,
        bankAccountHolder: data.bankAccountHolder || null,
        bankName: data.bankName || null,
        bestCollaborationTimes: data.bestCollaborationTimes || null,
        notes: data.notes || null,
        engagementRate: data.engagementRate || null,
        viewRating: data.viewRating || null,
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
        accountUrl: influencerData.accountUrl || null,
        coverageUrl: influencerData.coverageUrl || null,
        platforms: influencerData.platforms.length > 0 ? influencerData.platforms : null,
        contentTypes: influencerData.contentTypes.length > 0 ? influencerData.contentTypes : null,
        followerCountText: influencerData.followerCountText || null,
        pricePerPost: influencerData.pricePerPost || null,
        pricePerStory: influencerData.pricePerStory || null,
        pricePerVideo: influencerData.pricePerVideo || null,
        city: influencerData.city || null,
        region: influencerData.region || null,
        bankAccountNumber: influencerData.bankAccountNumber || null,
        bankAccountHolder: influencerData.bankAccountHolder || null,
        bankName: influencerData.bankName || null,
        bestCollaborationTimes: influencerData.bestCollaborationTimes || null,
        notes: influencerData.notes || null,
        engagementRate: influencerData.engagementRate || null,
        viewRating: influencerData.viewRating || null,
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
    const matchesSearch = 
      influencer.name.toLowerCase().includes(searchLower) ||
      influencer.nameAr?.toLowerCase().includes(searchLower) ||
      influencer.email?.toLowerCase().includes(searchLower) ||
      influencer.phone?.includes(searchLower);
    
    const matchesSpecialty = specialtyFilter === "all" || 
      influencer.specialty === specialtyFilter;
    
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" ? influencer.isActive : !influencer.isActive);
    
    const matchesPlatform = platformFilter === "all" || 
      (influencer.platforms && influencer.platforms.includes(platformFilter));
    
    const matchesRegion = regionFilter === "all" || 
      influencer.region?.toLowerCase().includes(regionFilter.toLowerCase());
    
    const matchesFollowerRange = (() => {
      if (followerRangeFilter === "all") return true;
      const count = influencer.followerCount || 0;
      switch (followerRangeFilter) {
        case "nano": return count < 10000;
        case "micro": return count >= 10000 && count < 100000;
        case "macro": return count >= 100000 && count < 1000000;
        case "mega": return count >= 1000000;
        default: return true;
      }
    })();
    
    const matchesBankInfo = (() => {
      if (bankInfoFilter === "all") return true;
      const hasBankInfo = !!(influencer.bankAccountNumber && influencer.bankName);
      return bankInfoFilter === "complete" ? hasBankInfo : !hasBankInfo;
    })();
    
    return matchesSearch && matchesSpecialty && matchesStatus && matchesPlatform && matchesRegion && matchesFollowerRange && matchesBankInfo;
  });

  const uniqueRegions = Array.from(new Set(influencers.map(i => i.region).filter((r): r is string => Boolean(r))));

  // Pagination calculations
  const totalPages = Math.ceil(filteredInfluencers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedInfluencers = filteredInfluencers.slice(startIndex, endIndex);
  
  // Reset to page 1 when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const kpiStats = {
    totalInfluencers: filteredInfluencers.length,
    activeInfluencers: filteredInfluencers.filter(i => i.isActive).length,
    avgFollowers: filteredInfluencers.length > 0 
      ? Math.round(filteredInfluencers.reduce((sum, i) => sum + (i.followerCount || 0), 0) / filteredInfluencers.length)
      : 0,
    avgEngagement: filteredInfluencers.length > 0
      ? (filteredInfluencers.reduce((sum, i) => sum + (i.engagementRate || 0), 0) / filteredInfluencers.length).toFixed(1)
      : "0",
    withBankInfo: filteredInfluencers.filter(i => i.bankAccountNumber && i.bankName).length,
    totalFollowers: filteredInfluencers.reduce((sum, i) => sum + (i.followerCount || 0), 0),
    tierNano: filteredInfluencers.filter(i => (i.followerCount || 0) < 10000).length,
    tierMicro: filteredInfluencers.filter(i => (i.followerCount || 0) >= 10000 && (i.followerCount || 0) < 100000).length,
    tierMacro: filteredInfluencers.filter(i => (i.followerCount || 0) >= 100000 && (i.followerCount || 0) < 1000000).length,
    tierMega: filteredInfluencers.filter(i => (i.followerCount || 0) >= 1000000).length,
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/marketing/influencers/export/excel");
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `influencers-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "تم تصدير البيانات بنجاح" });
    } catch (error) {
      toast({ title: "حدث خطأ", description: "فشل في تصدير البيانات", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPdf = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/marketing/influencers/export/pdf");
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `influencers-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "تم تصدير التقرير بنجاح" });
    } catch (error) {
      toast({ title: "حدث خطأ", description: "فشل في تصدير التقرير", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const hasBankInfo = (influencer: MarketingInfluencer) => 
    !!(influencer.bankAccountNumber && influencer.bankName);

  const openEditDialog = (influencer: MarketingInfluencer) => {
    setSelectedInfluencer(influencer);
    setFormData({
      name: influencer.name,
      nameAr: influencer.nameAr || "",
      email: influencer.email || "",
      phone: influencer.phone || "",
      accountUrl: influencer.accountUrl || "",
      coverageUrl: influencer.coverageUrl || "",
      specialty: influencer.specialty,
      platforms: influencer.platforms || [],
      contentTypes: influencer.contentTypes || [],
      followerCount: influencer.followerCount || 0,
      followerCountText: influencer.followerCountText || "",
      engagementRate: influencer.engagementRate || 0,
      viewRating: influencer.viewRating || 0,
      avgViews: influencer.avgViews || 0,
      pricePerPost: influencer.pricePerPost || 0,
      pricePerStory: influencer.pricePerStory || 0,
      pricePerVideo: influencer.pricePerVideo || 0,
      city: influencer.city || "",
      region: influencer.region || "",
      bankAccountNumber: influencer.bankAccountNumber || "",
      bankAccountHolder: influencer.bankAccountHolder || "",
      bankName: influencer.bankName || "",
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

  const influencerFormContent = (
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>رابط الحساب</Label>
          <Input
            value={formData.accountUrl}
            onChange={(e) => setFormData({ ...formData, accountUrl: e.target.value })}
            placeholder="https://instagram.com/..."
            dir="ltr"
            data-testid="input-influencer-account-url"
          />
        </div>
        <div className="space-y-2">
          <Label>روابط التغطية</Label>
          <Textarea
            value={formData.coverageUrl}
            onChange={(e) => setFormData({ ...formData, coverageUrl: e.target.value })}
            placeholder="أدخل كل رابط في سطر جديد..."
            dir="ltr"
            rows={3}
            className="resize-none"
            data-testid="input-influencer-coverage-url"
          />
          <p className="text-xs text-muted-foreground">يمكنك إضافة عدة روابط، كل رابط في سطر جديد</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>التخصص *</Label>
        <Select
          value={formData.specialty}
          onValueChange={(value) => setFormData({ ...formData, specialty: value })}
        >
          <SelectTrigger className="h-11 sm:h-10" data-testid="select-influencer-specialty">
            <SelectValue placeholder="اختر التخصص" />
          </SelectTrigger>
          <SelectContent className="max-h-60 overflow-y-auto">
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <div className="space-y-2">
          <Label>تقييم المشاهدات</Label>
          <Input
            type="number"
            value={formData.viewRating}
            onChange={(e) => setFormData({ ...formData, viewRating: parseInt(e.target.value) || 0 })}
            placeholder="0-100"
            dir="ltr"
            data-testid="input-influencer-view-rating"
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

      <div className="border-t pt-4 mt-4">
        <h4 className="font-medium mb-3">المعلومات البنكية</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>اسم البنك</Label>
            <Input
              value={formData.bankName}
              onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              placeholder="البنك الأهلي"
              data-testid="input-influencer-bank-name"
            />
          </div>
          <div className="space-y-2">
            <Label>رقم الحساب البنكي</Label>
            <Input
              value={formData.bankAccountNumber}
              onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
              placeholder="SA..."
              dir="ltr"
              data-testid="input-influencer-bank-account"
            />
          </div>
          <div className="space-y-2">
            <Label>اسم صاحب الحساب</Label>
            <Input
              value={formData.bankAccountHolder}
              onChange={(e) => setFormData({ ...formData, bankAccountHolder: e.target.value })}
              placeholder="الاسم الكامل"
              data-testid="input-influencer-bank-holder"
            />
          </div>
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
      <div className="p-4 md:p-8 lg:p-10 max-w-[1400px] mx-auto space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/marketing">
              <Button variant="outline" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" data-testid="button-back">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground" data-testid="text-page-title">
                المؤثرين والبلوجرز
              </h1>
              <p className="text-sm text-muted-foreground">إدارة ومتابعة المؤثرين والبلوجرز</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="h-11 sm:h-9"
              onClick={() => setIsImportDialogOpen(true)}
              data-testid="button-import-excel"
            >
              <FileSpreadsheet className="w-4 h-4 ml-2" />
              استيراد Excel
            </Button>
            <Button
              variant="outline"
              className="h-11 sm:h-9"
              onClick={exportToExcel}
              disabled={isExporting}
              data-testid="button-export-excel"
            >
              {isExporting ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 ml-2" />}
              تصدير Excel
            </Button>
            <Button
              variant="outline"
              className="h-11 sm:h-9"
              onClick={exportToPdf}
              disabled={isExporting}
              data-testid="button-export-pdf"
            >
              {isExporting ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <FileText className="w-4 h-4 ml-2" />}
              تصدير PDF
            </Button>
            {canEdit && (
              <Button
                className="h-11 sm:h-9"
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
        </div>

        <Tabs value={activePageTab} onValueChange={setActivePageTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="influencers" className="gap-2" data-testid="page-tab-influencers">
              <Users className="w-4 h-4" />
              المؤثرين
            </TabsTrigger>
            <TabsTrigger value="coverage-links" className="gap-2" data-testid="page-tab-coverage-links">
              <Link2 className="w-4 h-4" />
              لينك التغطيات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="influencers" className="space-y-4 mt-0">

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">إجمالي المؤثرين</p>
                  <p className="text-lg sm:text-2xl font-bold">{kpiStats.totalInfluencers}</p>
                </div>
                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">المؤثرين النشطين</p>
                  <p className="text-lg sm:text-2xl font-bold text-green-600">{kpiStats.activeInfluencers}</p>
                </div>
                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">متوسط المتابعين</p>
                  <p className="text-lg sm:text-2xl font-bold">{formatFollowerCount(kpiStats.avgFollowers)}</p>
                </div>
                <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">إجمالي المتابعين</p>
                  <p className="text-lg sm:text-2xl font-bold">{formatFollowerCount(kpiStats.totalFollowers)}</p>
                </div>
                <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">متوسط التفاعل</p>
                  <p className="text-lg sm:text-2xl font-bold">{kpiStats.avgEngagement}%</p>
                </div>
                <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">معلومات بنكية</p>
                  <p className="text-lg sm:text-2xl font-bold">{kpiStats.withBankInfo}</p>
                </div>
                <Building className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">توزيع المؤثرين حسب الفئة</CardTitle>
            <CardDescription>تصنيف المؤثرين بناءً على عدد المتابعين</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                  <div>
                    <p className="text-sm font-medium">Nano</p>
                    <p className="text-xs text-muted-foreground">&lt;10K</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-gray-700">{kpiStats.tierNano}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <div>
                    <p className="text-sm font-medium">Micro</p>
                    <p className="text-xs text-muted-foreground">10K-100K</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-green-700">{kpiStats.tierMicro}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <div>
                    <p className="text-sm font-medium">Macro</p>
                    <p className="text-xs text-muted-foreground">100K-1M</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-blue-700">{kpiStats.tierMacro}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 border border-purple-200">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <div>
                    <p className="text-sm font-medium">Mega</p>
                    <p className="text-xs text-muted-foreground">&gt;1M</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-purple-700">{kpiStats.tierMega}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="البحث بالاسم أو الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 h-11 sm:h-10"
                data-testid="input-search-influencers"
              />
            </div>
            <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
              <SelectTrigger className="w-full sm:w-40 h-11 sm:h-10" data-testid="select-specialty-filter">
                <SelectValue placeholder="التخصص" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <SelectItem value="all">جميع التخصصات</SelectItem>
                {INFLUENCER_SPECIALTIES.map((specialty) => (
                  <SelectItem key={specialty} value={specialty}>
                    {INFLUENCER_SPECIALTY_LABELS[specialty]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-32 h-11 sm:h-10" data-testid="select-status-filter">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="inactive">غير نشط</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="h-11 sm:h-10"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              data-testid="button-toggle-filters"
            >
              <Filter className="w-4 h-4 ml-2" />
              {showAdvancedFilters ? "إخفاء الفلاتر" : "فلاتر متقدمة"}
            </Button>
          </div>

          {showAdvancedFilters && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-4 bg-muted/30 rounded-lg border">
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="h-11 sm:h-10" data-testid="select-platform-filter">
                  <SelectValue placeholder="المنصة" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="all">جميع المنصات</SelectItem>
                  {INFLUENCER_PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {INFLUENCER_PLATFORM_LABELS[platform]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger className="h-11 sm:h-10" data-testid="select-region-filter">
                  <SelectValue placeholder="المنطقة" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="all">جميع المناطق</SelectItem>
                  {uniqueRegions.map((region) => (
                    <SelectItem key={region} value={region || ""}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={followerRangeFilter} onValueChange={setFollowerRangeFilter}>
                <SelectTrigger className="h-11 sm:h-10" data-testid="select-followers-filter">
                  <SelectValue placeholder="عدد المتابعين" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="all">جميع الفئات</SelectItem>
                  <SelectItem value="nano">Nano - صغير (&lt;10K)</SelectItem>
                  <SelectItem value="micro">Micro - متوسط (10K-100K)</SelectItem>
                  <SelectItem value="macro">Macro - كبير (100K-1M)</SelectItem>
                  <SelectItem value="mega">Mega - ضخم (&gt;1M)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={bankInfoFilter} onValueChange={setBankInfoFilter}>
                <SelectTrigger className="h-11 sm:h-10" data-testid="select-bank-filter">
                  <SelectValue placeholder="المعلومات البنكية" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="complete">مكتملة</SelectItem>
                  <SelectItem value="incomplete">غير مكتملة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
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
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المؤثر</TableHead>
                    <TableHead className="text-right">التخصص</TableHead>
                    <TableHead className="text-right hidden md:table-cell">المنصات</TableHead>
                    <TableHead className="text-right">المتابعين</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">التفاعل</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">التقييم</TableHead>
                    <TableHead className="text-right hidden md:table-cell">التواصل</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">البنك</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInfluencers.map((influencer) => (
                    <TableRow key={influencer.id} data-testid={`row-influencer-${influencer.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {influencer.profileImageUrl ? (
                            <img
                              src={influencer.profileImageUrl}
                              alt={influencer.name}
                              className="w-10 h-10 rounded-full object-cover"
                              data-testid={`img-influencer-${influencer.id}`}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              <User className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{influencer.name}</p>
                            {influencer.nameAr && (
                              <p className="text-sm text-muted-foreground">{influencer.nameAr}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] sm:text-xs">
                          {INFLUENCER_SPECIALTY_LABELS[influencer.specialty as keyof typeof INFLUENCER_SPECIALTY_LABELS] ||
                            influencer.specialty}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {influencer.platforms && influencer.platforms.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {influencer.platforms.slice(0, 2).map((platform) => (
                              <Badge key={platform} variant="secondary" className="text-[10px] sm:text-xs">
                                {INFLUENCER_PLATFORM_LABELS[platform as keyof typeof INFLUENCER_PLATFORM_LABELS] || platform}
                              </Badge>
                            ))}
                            {influencer.platforms.length > 2 && (
                              <Badge variant="secondary" className="text-[10px] sm:text-xs">+{influencer.platforms.length - 2}</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{formatFollowerCount(influencer.followerCount)}</span>
                          </div>
                          {(() => {
                            const tier = getInfluencerTier(influencer.followerCount);
                            return (
                              <Badge className={`text-xs ${tier.bgColor} ${tier.color} border-0 w-fit`}>
                                {tier.label}
                              </Badge>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1">
                          <Activity className="w-4 h-4 text-muted-foreground" />
                          <span>{influencer.engagementRate ? `${influencer.engagementRate}%` : "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1">
                          {renderStars(influencer.rating)}
                          {influencer.rating && <span className="text-xs sm:text-sm text-muted-foreground">({influencer.rating.toFixed(1)})</span>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="space-y-1 text-xs sm:text-sm text-muted-foreground">
                          {influencer.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              <span dir="ltr" className="text-xs truncate max-w-[120px]">{influencer.email}</span>
                            </div>
                          )}
                          {influencer.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              <span dir="ltr" className="text-xs">{influencer.phone}</span>
                            </div>
                          )}
                          {!influencer.email && !influencer.phone && <span>-</span>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {influencer.bankAccountNumber && influencer.bankName ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-xs text-muted-foreground truncate max-w-[80px]">{influencer.bankName}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <XCircle className="w-4 h-4 text-amber-500" />
                            <span className="text-xs">غير مكتمل</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={influencer.isActive ? "default" : "secondary"} className="text-[10px] sm:text-xs">
                          {influencer.isActive ? "نشط" : "غير نشط"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openDetailSheet(influencer)}
                            data-testid={`button-view-influencer-${influencer.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(influencer)}
                                data-testid={`button-edit-influencer-${influencer.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
            
            {/* Pagination Controls */}
            {filteredInfluencers.length > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  عرض {startIndex + 1} - {Math.min(endIndex, filteredInfluencers.length)} من {filteredInfluencers.length} مؤثر
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    data-testid="btn-first-page"
                  >
                    الأولى
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    data-testid="btn-prev-page"
                  >
                    السابق
                  </Button>
                  <span className="text-sm px-3">
                    صفحة {currentPage} من {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="btn-next-page"
                  >
                    التالي
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    data-testid="btn-last-page"
                  >
                    الأخيرة
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

          </TabsContent>

          <TabsContent value="coverage-links" className="space-y-4 mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="w-5 h-5" />
                  لينك التغطيات
                </CardTitle>
                <CardDescription>
                  جميع روابط التغطيات مع إمكانية الفلترة حسب الحملة والمنطقة
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="البحث بالاسم..."
                      value={coverageSearchQuery}
                      onChange={(e) => setCoverageSearchQuery(e.target.value)}
                      className="pr-10 h-10"
                      data-testid="input-search-coverage"
                    />
                  </div>
                  <Select value={coverageRegionFilter} onValueChange={setCoverageRegionFilter}>
                    <SelectTrigger className="w-full sm:w-40 h-10" data-testid="select-coverage-region">
                      <SelectValue placeholder="المنطقة" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      <SelectItem value="all">جميع المناطق</SelectItem>
                      {uniqueRegions.map((region) => (
                        <SelectItem key={region} value={region || ""}>
                          {region}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={coverageCampaignFilter} onValueChange={setCoverageCampaignFilter}>
                    <SelectTrigger className="w-full sm:w-48 h-10" data-testid="select-coverage-campaign">
                      <SelectValue placeholder="الحملة" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      <SelectItem value="all">جميع الحملات</SelectItem>
                      {allCampaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id.toString()}>
                          {campaign.nameAr || campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-right">المؤثر</TableHead>
                        <TableHead className="text-right">المنطقة</TableHead>
                        <TableHead className="text-right">لينك التغطية</TableHead>
                        <TableHead className="text-right">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {influencers
                        .filter(inf => inf.coverageUrl)
                        .filter(inf => {
                          const matchesSearch = coverageSearchQuery === "" || 
                            inf.name.toLowerCase().includes(coverageSearchQuery.toLowerCase()) ||
                            (inf.nameAr && inf.nameAr.toLowerCase().includes(coverageSearchQuery.toLowerCase()));
                          const matchesRegion = coverageRegionFilter === "all" || 
                            inf.region?.toLowerCase().includes(coverageRegionFilter.toLowerCase());
                          const matchesCampaign = coverageCampaignFilter === "all" ||
                            allCampaignLinks.some(link => 
                              link.influencerId === inf.id && 
                              link.campaignId === parseInt(coverageCampaignFilter)
                            );
                          return matchesSearch && matchesRegion && matchesCampaign;
                        })
                        .map((influencer) => (
                          <TableRow key={influencer.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {influencer.profileImageUrl ? (
                                  <img
                                    src={influencer.profileImageUrl}
                                    alt={influencer.name}
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                    <User className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-sm">{influencer.name}</p>
                                  {influencer.followerCountText && (
                                    <p className="text-xs text-muted-foreground">{influencer.followerCountText} متابع</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {influencer.region || "-"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {(influencer.coverageUrl || "").split('\n').filter(url => url.trim()).slice(0, 3).map((url, idx) => (
                                  <a
                                    key={idx}
                                    href={url.trim()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline flex items-center gap-1 text-sm max-w-[200px] truncate"
                                  >
                                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{url.trim()}</span>
                                  </a>
                                ))}
                                {(influencer.coverageUrl || "").split('\n').filter(url => url.trim()).length > 3 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{(influencer.coverageUrl || "").split('\n').filter(url => url.trim()).length - 3} روابط أخرى
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    const urls = (influencer.coverageUrl || "").split('\n').filter(url => url.trim());
                                    navigator.clipboard.writeText(urls.join('\n'));
                                    toast({
                                      title: "تم النسخ",
                                      description: `تم نسخ ${urls.length} رابط`,
                                    });
                                  }}
                                  data-testid={`button-copy-coverage-${influencer.id}`}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setSelectedInfluencer(influencer);
                                    setIsDetailSheetOpen(true);
                                  }}
                                  data-testid={`button-view-influencer-${influencer.id}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      {influencers.filter(inf => inf.coverageUrl).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            لا توجد تغطيات متاحة
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="text-sm text-muted-foreground">
                  إجمالي المؤثرين: {influencers.filter(inf => inf.coverageUrl).filter(inf => {
                    const matchesSearch = coverageSearchQuery === "" || 
                      inf.name.toLowerCase().includes(coverageSearchQuery.toLowerCase());
                    const matchesRegion = coverageRegionFilter === "all" || 
                      inf.region?.toLowerCase().includes(coverageRegionFilter.toLowerCase());
                    const matchesCampaign = coverageCampaignFilter === "all" ||
                      allCampaignLinks.some(link => 
                        link.influencerId === inf.id && 
                        link.campaignId === parseInt(coverageCampaignFilter)
                      );
                    return matchesSearch && matchesRegion && matchesCampaign;
                  }).length} | إجمالي الروابط: {influencers.filter(inf => inf.coverageUrl).filter(inf => {
                    const matchesSearch = coverageSearchQuery === "" || 
                      inf.name.toLowerCase().includes(coverageSearchQuery.toLowerCase());
                    const matchesRegion = coverageRegionFilter === "all" || 
                      inf.region?.toLowerCase().includes(coverageRegionFilter.toLowerCase());
                    const matchesCampaign = coverageCampaignFilter === "all" ||
                      allCampaignLinks.some(link => 
                        link.influencerId === inf.id && 
                        link.campaignId === parseInt(coverageCampaignFilter)
                      );
                    return matchesSearch && matchesRegion && matchesCampaign;
                  }).reduce((acc, inf) => acc + (inf.coverageUrl || "").split('\n').filter(url => url.trim()).length, 0)}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
            {influencerFormContent}
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

            {selectedInfluencer && canEdit && (
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setFormData({
                      name: selectedInfluencer.name,
                      nameAr: selectedInfluencer.nameAr || "",
                      email: selectedInfluencer.email || "",
                      phone: selectedInfluencer.phone || "",
                      specialty: selectedInfluencer.specialty || "food",
                      accountUrl: selectedInfluencer.accountUrl || "",
                      coverageUrl: selectedInfluencer.coverageUrl || "",
                      platforms: selectedInfluencer.platforms || [],
                      contentTypes: selectedInfluencer.contentTypes || [],
                      followerCount: selectedInfluencer.followerCount || 0,
                      followerCountText: selectedInfluencer.followerCountText || "",
                      pricePerPost: Number(selectedInfluencer.pricePerPost) || 0,
                      pricePerStory: Number(selectedInfluencer.pricePerStory) || 0,
                      pricePerVideo: 0,
                      engagementRate: Number(selectedInfluencer.engagementRate) || 0,
                      avgViews: 0,
                      region: selectedInfluencer.region || "",
                      city: selectedInfluencer.city || "",
                      viewRating: selectedInfluencer.viewRating || 0,
                      bankAccountNumber: selectedInfluencer.bankAccountNumber || "",
                      bankAccountHolder: "",
                      bankName: selectedInfluencer.bankName || "",
                      bestCollaborationTimes: "",
                      notes: selectedInfluencer.notes || "",
                      isActive: selectedInfluencer.isActive ?? true,
                    });
                    setIsDetailSheetOpen(false);
                    setIsEditDialogOpen(true);
                  }}
                  data-testid="button-edit-from-details"
                >
                  <Pencil className="w-4 h-4 ml-2" />
                  تعديل البيانات
                </Button>
              </div>
            )}

            {selectedInfluencer && (
              <Tabs defaultValue="info" className="mt-6">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="info" data-testid="tab-info">معلومات</TabsTrigger>
                  <TabsTrigger value="campaigns" data-testid="tab-campaigns">الحملات</TabsTrigger>
                  <TabsTrigger value="contacts" data-testid="tab-contacts">التواصل</TabsTrigger>
                  <TabsTrigger value="payments" data-testid="tab-payments">كشف الحساب</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">المتابعين</p>
                      <p className="font-medium flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {selectedInfluencer.followerCountText || formatFollowerCount(selectedInfluencer.followerCount)}
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
                      <p className="text-sm text-muted-foreground">تقييم المشاهدات</p>
                      <p className="font-medium">{selectedInfluencer.viewRating || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">التقييم</p>
                      {renderStars(selectedInfluencer.rating)}
                    </div>
                  </div>

                  {(selectedInfluencer.accountUrl || selectedInfluencer.coverageUrl) && (
                    <div className="border-t pt-4 space-y-2">
                      <h4 className="font-medium">الروابط</h4>
                      <div className="space-y-1 text-sm">
                        {selectedInfluencer.accountUrl && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">رابط الحساب:</span>
                            <a 
                              href={selectedInfluencer.accountUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline truncate max-w-[200px]"
                              dir="ltr"
                            >
                              {selectedInfluencer.accountUrl}
                            </a>
                          </div>
                        )}
                        {selectedInfluencer.coverageUrl && (
                          <div className="space-y-1">
                            <span className="text-muted-foreground">روابط التغطية:</span>
                            <div className="space-y-1">
                              {selectedInfluencer.coverageUrl.split('\n').filter(url => url.trim()).map((url, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <a 
                                    href={url.trim()} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline truncate max-w-[250px] text-sm"
                                    dir="ltr"
                                  >
                                    {url.trim()}
                                  </a>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => {
                                      navigator.clipboard.writeText(url.trim());
                                      toast({
                                        title: "تم النسخ",
                                        description: "تم نسخ الرابط",
                                      });
                                    }}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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

                  {(selectedInfluencer.bankName || selectedInfluencer.bankAccountNumber || selectedInfluencer.bankAccountHolder) && (
                    <div className="border-t pt-4 space-y-2">
                      <h4 className="font-medium">المعلومات البنكية</h4>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        {selectedInfluencer.bankName && (
                          <div>
                            <span className="text-muted-foreground">البنك:</span>{" "}
                            <span className="font-medium">{selectedInfluencer.bankName}</span>
                          </div>
                        )}
                        {selectedInfluencer.bankAccountNumber && (
                          <div>
                            <span className="text-muted-foreground">رقم الحساب:</span>{" "}
                            <span className="font-medium" dir="ltr">{selectedInfluencer.bankAccountNumber}</span>
                          </div>
                        )}
                        {selectedInfluencer.bankAccountHolder && (
                          <div>
                            <span className="text-muted-foreground">صاحب الحساب:</span>{" "}
                            <span className="font-medium">{selectedInfluencer.bankAccountHolder}</span>
                          </div>
                        )}
                      </div>
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

                <TabsContent value="payments" className="mt-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">مدفوعات مباشرة</p>
                          <p className="text-xl font-bold text-green-700">
                            {new Intl.NumberFormat("en-US").format(totalPayments)} ر.س
                          </p>
                        </div>
                        <DollarSign className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">مصروفات الحملات</p>
                          <p className="text-xl font-bold text-blue-700">
                            {new Intl.NumberFormat("en-US").format(totalCampaignExpenses)} ر.س
                          </p>
                        </div>
                        <Activity className="w-6 h-6 text-blue-600" />
                      </div>
                    </div>
                  </div>
                  <div className="mb-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-sm font-bold text-amber-800">
                      الإجمالي الكلي: {new Intl.NumberFormat("en-US").format(totalPayments + totalCampaignExpenses)} ر.س
                    </p>
                  </div>
                  
                  <ScrollArea className="h-[300px]">
                    {payments.length === 0 && campaignExpenses.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <DollarSign className="w-8 h-8 mx-auto mb-2" />
                        <p>لا توجد مدفوعات مسجلة</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {campaignExpenses.length > 0 && (
                          <>
                            <h4 className="font-semibold text-blue-600 flex items-center gap-2">
                              <Activity className="w-4 h-4" />
                              مصروفات من الحملات
                            </h4>
                            {campaignExpenses.map((expense) => (
                              <Card key={`expense-${expense.id}`} className="border-blue-200" data-testid={`card-expense-${expense.id}`}>
                                <CardContent className="p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Badge className="bg-blue-500">
                                        {CAMPAIGN_EXPENSE_STATUS_LABELS[expense.status] || expense.status}
                                      </Badge>
                                      <Badge variant="outline">
                                        {CAMPAIGN_EXPENSE_CATEGORY_LABELS[expense.category] || expense.category}
                                      </Badge>
                                    </div>
                                    <p className="font-bold text-blue-600">
                                      {new Intl.NumberFormat("en-US").format(expense.amount)} ر.س
                                    </p>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    <p className="font-medium">{expense.description}</p>
                                    <p className="flex items-center gap-1 mt-1">
                                      <Calendar className="w-3 h-3" />
                                      {expense.expenseDate}
                                    </p>
                                    <p className="text-xs text-blue-600 mt-1">
                                      الحملة: {getCampaignName(expense.campaignId)}
                                    </p>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </>
                        )}
                        {payments.length > 0 && (
                          <>
                            <h4 className="font-semibold text-green-600 flex items-center gap-2 mt-4">
                              <DollarSign className="w-4 h-4" />
                              مدفوعات مباشرة
                            </h4>
                            {payments.map((payment) => (
                              <Card key={`payment-${payment.id}`} className="border-green-200" data-testid={`card-payment-${payment.id}`}>
                                <CardContent className="p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Badge variant={payment.status === "completed" ? "default" : payment.status === "pending" ? "secondary" : "destructive"}>
                                        {INFLUENCER_PAYMENT_STATUS_LABELS[payment.status] || payment.status}
                                      </Badge>
                                      <Badge variant="outline">
                                        {INFLUENCER_PAYMENT_TYPE_LABELS[payment.paymentType] || payment.paymentType}
                                      </Badge>
                                    </div>
                                    <p className="font-bold text-green-600">
                                      {new Intl.NumberFormat("en-US").format(payment.amount)} ر.س
                                    </p>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    <p className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {payment.paymentDate}
                                    </p>
                                    {payment.paymentMethod && (
                                      <p>{INFLUENCER_PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod}</p>
                                    )}
                                    {payment.description && (
                                      <p className="mt-1">{payment.description}</p>
                                    )}
                                    {payment.referenceNumber && (
                                      <p className="text-xs">رقم المرجع: {payment.referenceNumber}</p>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            )}
          </SheetContent>
        </Sheet>

        <InfluencerExcelImportDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
        />
      </div>
    </Layout>
  );
}
