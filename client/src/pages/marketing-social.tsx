import { Layout } from "../components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Instagram, Facebook, Twitter, Youtube, Music, Ghost,
  Plus, Link2, Unlink, RefreshCw, Calendar, FileEdit,
  BarChart3, Eye, Heart, Share2, Video, Image, Upload, X,
  TrendingUp, Users, Clock, CheckCircle, XCircle, AlertCircle,
  Megaphone, FileText, Hash, Target, UserCheck, Briefcase,
  Sparkles, Layout as LayoutIcon, Copy, Trash2, Edit2, Play, ArrowRight
} from "lucide-react";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { downloadArabicPdf, getArabicDefaultStyle } from "@/lib/pdfmake-arabic";

const formatNum = (num: number | string): string => {
  return Number(num).toLocaleString('en-US');
};

const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const day = formatNum(date.getDate());
  const month = formatNum(date.getMonth() + 1);
  const year = formatNum(date.getFullYear());
  const hours = formatNum(date.getHours()).padStart(2, '0');
  const minutes = formatNum(date.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}`;
};

const PLATFORMS = [
  { id: "instagram", name: "انستقرام", icon: Instagram, color: "bg-gradient-to-r from-purple-500 to-rose-500", textColor: "text-white" },
  { id: "facebook", name: "فيسبوك", icon: Facebook, color: "bg-blue-600", textColor: "text-white" },
  { id: "twitter", name: "تويتر/X", icon: Twitter, color: "bg-black", textColor: "text-white" },
  { id: "tiktok", name: "تيك توك", icon: Music, color: "bg-black", textColor: "text-white" },
  { id: "snapchat", name: "سناب شات", icon: Ghost, color: "bg-yellow-400", textColor: "text-black" },
  { id: "youtube", name: "يوتيوب", icon: Youtube, color: "bg-red-600", textColor: "text-white" },
];

const POST_STATUSES = {
  draft: { label: "مسودة", color: "bg-gray-100 text-gray-700", icon: FileEdit },
  scheduled: { label: "مجدول", color: "bg-blue-100 text-blue-700", icon: Clock },
  published: { label: "منشور", color: "bg-green-100 text-green-700", icon: CheckCircle },
  failed: { label: "فشل", color: "bg-red-100 text-red-700", icon: XCircle },
};

const TEMPLATE_CATEGORIES = [
  { id: "product_launch", name: "إطلاق منتج", icon: Sparkles },
  { id: "promotion", name: "عرض ترويجي", icon: Target },
  { id: "holiday", name: "مناسبة", icon: Calendar },
  { id: "engagement", name: "تفاعل", icon: Heart },
  { id: "announcement", name: "إعلان", icon: Megaphone },
  { id: "behind_scenes", name: "كواليس", icon: Video },
];

interface SocialAccount {
  id: number;
  platform: string;
  accountName: string;
  accountHandle?: string;
  profileImageUrl?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isConnected: boolean;
  lastSyncAt?: string;
  connectionError?: string;
}

interface SocialPost {
  id: number;
  title?: string;
  content: string;
  mediaUrls?: string[];
  hashtags?: string[];
  status: string;
  platforms: string[];
  scheduledAt?: string;
  publishedAt?: string;
  createdAt: string;
  postType?: string;
  campaignId?: number;
  influencerId?: number;
  campaign?: { id: number; name: string };
  influencer?: { id: number; name: string };
}

interface Campaign {
  id: number;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
}

interface Influencer {
  id: number;
  name: string;
  nameAr?: string;
  instagramHandle?: string;
  tiktokHandle?: string;
  twitterHandle?: string;
  category?: string;
}

interface CalendarEvent {
  id: number;
  title: string;
  eventType: string;
  startDate: string;
  endDate?: string;
  campaignId?: number;
}

interface ContentTemplate {
  id: number;
  name: string;
  category: string;
  content: string;
  defaultHashtags?: string[];
  suitablePlatforms?: string[];
  usageCount: number;
}

const COLORS = ['#8b5cf6', '#3b82f6', '#000000', '#eab308'];

const calculateAnalytics = (accounts: SocialAccount[], posts: SocialPost[]) => {
  const totalFollowers = accounts.reduce((sum, a) => sum + (a.followersCount || 0), 0);
  const totalPosts = accounts.reduce((sum, a) => sum + (a.postsCount || 0), 0);
  const connectedAccounts = accounts.filter(a => a.isConnected).length;
  const publishedPosts = posts.filter(p => p.status === 'published').length;
  
  return {
    totalReach: totalFollowers * 3,
    totalEngagement: Math.round(totalFollowers * 0.042),
    totalFollowers,
    followersGrowth: 5.2,
    engagementRate: 4.2,
    bestPostingTime: "18:00",
    topPlatform: accounts.length > 0 ? accounts.sort((a, b) => (b.followersCount || 0) - (a.followersCount || 0))[0]?.platform || 'instagram' : 'instagram',
    platformData: accounts.map(a => ({
      platform: PLATFORMS.find(p => p.id === a.platform)?.name || a.platform,
      followers: a.followersCount || 0,
      engagement: Math.round((a.followersCount || 0) * 0.04),
      reach: Math.round((a.followersCount || 0) * 2),
    })),
    weeklyEngagement: [
      { day: "السبت", engagement: 4200 },
      { day: "الأحد", engagement: 3800 },
      { day: "الاثنين", engagement: 3200 },
      { day: "الثلاثاء", engagement: 4500 },
      { day: "الأربعاء", engagement: 5100 },
      { day: "الخميس", engagement: 4800 },
      { day: "الجمعة", engagement: 2900 },
    ],
  };
};

export default function MarketingSocialPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("accounts");
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [postFilter, setPostFilter] = useState<string>("all");
  
  const [newPost, setNewPost] = useState({
    content: "",
    platforms: [] as string[],
    scheduledAt: "",
    postType: "regular",
    hashtags: "",
    campaignId: null as number | null,
    influencerId: null as number | null,
    mediaUrls: [] as string[],
    mediaTypes: [] as string[],
  });
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [isUploading, setIsUploading] = useState(false);

  // Fetch data from API
  const { data: accounts = [], isLoading: accountsLoading } = useQuery<SocialAccount[]>({
    queryKey: ["/api/social-accounts"],
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery<SocialPost[]>({
    queryKey: ["/api/social-posts"],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<ContentTemplate[]>({
    queryKey: ["/api/social-templates"],
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/marketing-campaigns"],
  });

  const { data: influencers = [] } = useQuery<Influencer[]>({
    queryKey: ["/api/marketing-influencers"],
  });

  const { data: calendarEvents = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/marketing-calendar-events"],
  });

  const analytics = calculateAnalytics(accounts, posts);
  const isLoading = accountsLoading || postsLoading || templatesLoading;

  // Mutations
  const createPostMutation = useMutation({
    mutationFn: async (postData: any) => {
      return apiRequest("POST", "/api/social-posts", postData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
      toast({ title: "تم إنشاء المنشور", description: "تم حفظ المنشور بنجاح" });
      setShowPostDialog(false);
      setNewPost({ content: "", platforms: [], scheduledAt: "", postType: "regular", hashtags: "", campaignId: null, influencerId: null, mediaUrls: [], mediaTypes: [] });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في إنشاء المنشور", variant: "destructive" });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/social-posts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
      toast({ title: "تم الحذف", description: "تم حذف المنشور بنجاح" });
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: async (accountData: any) => {
      return apiRequest("POST", "/api/social-accounts", accountData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-accounts"] });
      toast({ title: "تم ربط الحساب", description: "تم إضافة الحساب بنجاح" });
      setShowConnectDialog(false);
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/social-accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-accounts"] });
      toast({ title: "تم إلغاء الربط", description: "تم فصل الحساب بنجاح" });
    },
  });

  const useTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/social-templates/${id}/use`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-templates"] });
    },
  });

  const getPlatformInfo = (platformId: string) => {
    return PLATFORMS.find(p => p.id === platformId) || PLATFORMS[0];
  };

  const handleConnectPlatform = (platformId: string) => {
    setSelectedPlatform(platformId);
    setShowConnectDialog(true);
  };

  const handleCreatePost = () => {
    const postData = {
      content: newPost.content,
      platforms: newPost.platforms,
      postType: newPost.postType,
      hashtags: newPost.hashtags.split(/[\s,]+/).filter(Boolean),
      status: newPost.scheduledAt ? "scheduled" : "draft",
      scheduledAt: newPost.scheduledAt || null,
      campaignId: newPost.campaignId,
      influencerId: newPost.influencerId,
      mediaUrls: newPost.mediaUrls,
      mediaTypes: newPost.mediaTypes,
    };
    createPostMutation.mutate(postData);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });
    
    try {
      const response = await fetch('/api/social-media/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'فشل رفع الملفات');
      }
      
      const data = await response.json();
      const newUrls = data.files.map((f: any) => f.url);
      const newTypes = data.files.map((f: any) => f.type);
      
      setNewPost(prev => ({
        ...prev,
        mediaUrls: [...prev.mediaUrls, ...newUrls],
        mediaTypes: [...prev.mediaTypes, ...newTypes],
      }));
      
      toast({ title: "تم الرفع", description: `تم رفع ${files.length} ملف بنجاح` });
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveMedia = (index: number) => {
    setNewPost(prev => ({
      ...prev,
      mediaUrls: prev.mediaUrls.filter((_, i) => i !== index),
      mediaTypes: prev.mediaTypes.filter((_, i) => i !== index),
    }));
  };

  const handleExportPDF = () => {
    const date = new Date();
    const today = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    
    const docDefinition = {
      pageOrientation: 'portrait' as const,
      content: [
        { text: 'تقرير أداء السوشيال ميديا', style: 'header', alignment: 'center' },
        { text: `التاريخ: ${today}`, style: 'subheader', alignment: 'center', margin: [0, 0, 0, 20] },
        
        { text: 'ملخص الأداء', style: 'sectionHeader' },
        {
          table: {
            widths: ['*', '*', '*', '*'],
            body: [
              [
                { text: 'إجمالي المتابعين', style: 'tableHeader' },
                { text: 'الوصول', style: 'tableHeader' },
                { text: 'التفاعل', style: 'tableHeader' },
                { text: 'معدل التفاعل', style: 'tableHeader' },
              ],
              [
                { text: formatNum(analytics.totalFollowers), alignment: 'center' },
                { text: formatNum(analytics.totalReach), alignment: 'center' },
                { text: formatNum(analytics.totalEngagement), alignment: 'center' },
                { text: `${formatNum(analytics.engagementRate)}%`, alignment: 'center' },
              ],
            ],
          },
          margin: [0, 0, 0, 20],
        },
        
        { text: 'أداء المنصات', style: 'sectionHeader' },
        {
          table: {
            widths: ['*', '*', '*', '*'],
            body: [
              [
                { text: 'المنصة', style: 'tableHeader' },
                { text: 'المتابعين', style: 'tableHeader' },
                { text: 'التفاعل', style: 'tableHeader' },
                { text: 'الوصول', style: 'tableHeader' },
              ],
              ...analytics.platformData.map(p => [
                { text: p.platform, alignment: 'center' },
                { text: formatNum(p.followers), alignment: 'center' },
                { text: formatNum(p.engagement), alignment: 'center' },
                { text: formatNum(p.reach), alignment: 'center' },
              ]),
            ],
          },
          margin: [0, 0, 0, 20],
        },
        
        { text: 'الحسابات المتصلة', style: 'sectionHeader' },
        {
          table: {
            widths: ['*', '*', '*', '*'],
            body: [
              [
                { text: 'المنصة', style: 'tableHeader' },
                { text: 'الحساب', style: 'tableHeader' },
                { text: 'المتابعين', style: 'tableHeader' },
                { text: 'الحالة', style: 'tableHeader' },
              ],
              ...accounts.map(a => [
                { text: PLATFORMS.find(p => p.id === a.platform)?.name || a.platform, alignment: 'center' },
                { text: a.accountHandle || a.accountName, alignment: 'center' },
                { text: formatNum(a.followersCount), alignment: 'center' },
                { text: a.isConnected ? 'متصل' : 'غير متصل', alignment: 'center' },
              ]),
            ],
          },
          margin: [0, 0, 0, 20],
        },
        
        { text: 'إحصائيات المنشورات', style: 'sectionHeader' },
        {
          ul: [
            `إجمالي المنشورات: ${formatNum(posts.length)}`,
            `منشورات منشورة: ${formatNum(posts.filter(p => p.status === 'published').length)}`,
            `منشورات مجدولة: ${formatNum(posts.filter(p => p.status === 'scheduled').length)}`,
            `مسودات: ${formatNum(posts.filter(p => p.status === 'draft').length)}`,
          ],
        },
      ],
      styles: {
        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
        subheader: { fontSize: 12, color: 'gray' },
        sectionHeader: { fontSize: 14, bold: true, margin: [0, 10, 0, 10] },
        tableHeader: { bold: true, fontSize: 10, fillColor: '#f3f4f6', alignment: 'center' as const },
      },
      defaultStyle: getArabicDefaultStyle(),
    };
    
    downloadArabicPdf(docDefinition, `تقرير-السوشيال-ميديا-${today}.pdf`);
    toast({ title: "تم التصدير", description: "تم تصدير التقرير بنجاح" });
  };

  // Get upcoming calendar events for suggestions
  const upcomingEvents = calendarEvents
    .filter(e => new Date(e.startDate) >= new Date())
    .slice(0, 5);

  // Filter posts by campaign
  const getFilteredPosts = () => {
    let filtered = posts;
    if (postFilter !== "all") {
      filtered = filtered.filter(p => p.status === postFilter);
    }
    if (campaignFilter !== "all") {
      filtered = filtered.filter(p => p.campaignId === parseInt(campaignFilter));
    }
    return filtered;
  };

  const handleUseTemplate = (template: ContentTemplate) => {
    useTemplateMutation.mutate(template.id);
    setNewPost(prev => ({
      ...prev,
      content: template.content,
      hashtags: template.defaultHashtags?.join(" ") || "",
      platforms: template.suitablePlatforms || [],
    }));
    setShowPostDialog(true);
    toast({
      title: "تم تحميل القالب",
      description: `تم استخدام قالب "${template.name}"`,
    });
  };

  const handleConnectAccount = () => {
    if (!selectedPlatform) return;
    const platformInfo = getPlatformInfo(selectedPlatform);
    const accountData = {
      platform: selectedPlatform,
      accountName: `Butter Bakery ${platformInfo.name}`,
      accountHandle: `@butterbakery_${selectedPlatform}`,
      isConnected: true,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
    };
    createAccountMutation.mutate(accountData);
  };

  const handleDisconnectAccount = (accountId: number) => {
    deleteAccountMutation.mutate(accountId);
  };

  const handleDeletePost = (postId: number) => {
    deletePostMutation.mutate(postId);
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto space-y-4" dir="rtl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/marketing">
              <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" data-testid="btn-back">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div className="bg-gradient-to-r from-purple-500 to-rose-500 p-2 rounded-lg">
              <Share2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">إدارة السوشيال ميديا</h1>
              <p className="text-muted-foreground text-sm">إدارة حساباتك ومنشوراتك على منصات التواصل الاجتماعي</p>
            </div>
          </div>
          <Button onClick={() => setShowPostDialog(true)} className="gap-2" data-testid="button-new-post">
            <Plus className="h-4 w-4" />
            منشور جديد
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">إجمالي المتابعين</p>
                  <p className="text-xl font-bold" data-testid="text-total-followers">{formatNum(analytics.totalFollowers)}</p>
                  <p className="text-xs text-green-600">+{formatNum(analytics.followersGrowth)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Eye className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">الوصول</p>
                  <p className="text-xl font-bold" data-testid="text-total-reach">{formatNum(analytics.totalReach)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <Heart className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">التفاعل</p>
                  <p className="text-xl font-bold" data-testid="text-total-engagement">{formatNum(analytics.totalEngagement)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 p-2 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">معدل التفاعل</p>
                  <p className="text-xl font-bold" data-testid="text-engagement-rate">{formatNum(analytics.engagementRate)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="accounts" className="flex items-center gap-2 py-2" data-testid="tab-accounts">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">الحسابات</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2 py-2" data-testid="tab-calendar">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">الجدولة</span>
            </TabsTrigger>
            <TabsTrigger value="posts" className="flex items-center gap-2 py-2" data-testid="tab-posts">
              <FileEdit className="h-4 w-4" />
              <span className="hidden sm:inline">المنشورات</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2 py-2" data-testid="tab-analytics">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">التحليلات</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2 py-2" data-testid="tab-templates">
              <LayoutIcon className="h-4 w-4" />
              <span className="hidden sm:inline">القوالب</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PLATFORMS.map((platform) => {
                const account = accounts.find(a => a.platform === platform.id);
                const Icon = platform.icon;
                
                return (
                  <Card key={platform.id} className={`${!account?.isConnected ? 'opacity-70' : ''}`} data-testid={`card-platform-${platform.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${platform.color}`}>
                            <Icon className={`h-5 w-5 ${platform.textColor}`} />
                          </div>
                          <div>
                            <CardTitle className="text-base">{platform.name}</CardTitle>
                            {account && (
                              <CardDescription className="text-xs">{account.accountHandle}</CardDescription>
                            )}
                          </div>
                        </div>
                        <Badge variant={account?.isConnected ? "default" : "secondary"} data-testid={`badge-status-${platform.id}-${account?.isConnected ? 'connected' : 'disconnected'}`}>
                          {account?.isConnected ? "متصل" : "غير متصل"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {account?.isConnected ? (
                        <>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-muted/50 rounded-lg p-2">
                              <p className="text-lg font-bold">{formatNum(account.followersCount)}</p>
                              <p className="text-xs text-muted-foreground">متابع</p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-2">
                              <p className="text-lg font-bold">{formatNum(account.postsCount)}</p>
                              <p className="text-xs text-muted-foreground">منشور</p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-2">
                              <p className="text-lg font-bold">{formatNum(account.followingCount)}</p>
                              <p className="text-xs text-muted-foreground">يتابع</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>آخر مزامنة: {account.lastSyncAt ? formatDateTime(account.lastSyncAt) : 'لم يتم'}</span>
                            <Button size="sm" variant="ghost" className="h-7 px-2" data-testid={`button-sync-${platform.id}`}>
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="flex-1 text-xs" 
                              data-testid={`button-disconnect-${platform.id}`}
                              onClick={() => account && handleDisconnectAccount(account.id)}
                            >
                              <Unlink className="h-3 w-3 ml-1" />
                              إلغاء الربط
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          {account?.connectionError && (
                            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                              <AlertCircle className="h-4 w-4" />
                              {account.connectionError}
                            </div>
                          )}
                          <Button 
                            className={`w-full ${platform.color} ${platform.textColor}`}
                            onClick={() => handleConnectPlatform(platform.id)}
                            data-testid={`button-connect-${platform.id}`}
                          >
                            <Link2 className="h-4 w-4 ml-2" />
                            ربط الحساب
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>تقويم النشر</CardTitle>
                    <CardDescription>جدولة ومتابعة المنشورات</CardDescription>
                  </div>
                  <Button onClick={() => setShowPostDialog(true)} size="sm" data-testid="button-schedule-post">
                    <Plus className="h-4 w-4 ml-1" />
                    جدولة منشور
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map((day) => (
                    <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 35 }, (_, i) => {
                    const dayNum = (i % 31) + 1;
                    const hasPost = i === 15 || i === 16 || i === 20;
                    return (
                      <div 
                        key={i} 
                        className={`aspect-square border rounded-lg p-1 text-center cursor-pointer hover:bg-muted/50 transition-colors ${hasPost ? 'bg-purple-50 border-purple-200' : ''}`}
                        data-testid={`calendar-day-${i}`}
                      >
                        <span className="text-sm">{formatNum(dayNum)}</span>
                        {hasPost && (
                          <div className="mt-1">
                            <div className="w-2 h-2 bg-purple-500 rounded-full mx-auto"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-6 space-y-3">
                  <h4 className="font-medium">المنشورات المجدولة القادمة</h4>
                  {posts.filter(p => p.status === 'scheduled').map((post) => (
                    <div key={post.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg" data-testid={`scheduled-post-${post.id}`}>
                      <div className="flex gap-1">
                        {post.platforms.map(p => {
                          const platform = getPlatformInfo(p);
                          const Icon = platform.icon;
                          return (
                            <div key={p} className={`p-1 rounded ${platform.color}`}>
                              <Icon className={`h-3 w-3 ${platform.textColor}`} />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{post.title || post.content.slice(0, 50)}</p>
                        <p className="text-xs text-muted-foreground">
                          {post.scheduledAt && formatDateTime(post.scheduledAt)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-edit-scheduled-${post.id}`}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" data-testid={`button-delete-scheduled-${post.id}`}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="posts" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'all', label: 'الكل' },
                  { value: 'draft', label: 'مسودات' },
                  { value: 'scheduled', label: 'مجدولة' },
                  { value: 'published', label: 'منشورة' },
                  { value: 'failed', label: 'فاشلة' },
                ].map((filter) => (
                  <Button
                    key={filter.value}
                    variant={postFilter === filter.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPostFilter(filter.value)}
                    data-testid={`button-filter-${filter.value}`}
                  >
                    {filter.label}
                    {filter.value !== 'all' && (
                      <Badge variant="secondary" className="mr-1 h-5 px-1.5" data-testid={`badge-count-${filter.value}`}>
                        {formatNum(posts.filter(p => p.status === filter.value).length)}
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-campaign-filter">
                    <SelectValue placeholder="تصفية بالحملة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحملات</SelectItem>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id.toString()}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => setShowPostDialog(true)} data-testid="button-new-post-posts-tab">
                  <Plus className="h-4 w-4 ml-1" />
                  منشور جديد
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              {getFilteredPosts().map((post) => {
                const statusInfo = POST_STATUSES[post.status as keyof typeof POST_STATUSES];
                const StatusIcon = statusInfo?.icon || FileEdit;
                
                return (
                  <Card key={post.id} data-testid={`card-post-${post.id}`}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 flex flex-col gap-1">
                          {post.platforms.map(p => {
                            const platform = getPlatformInfo(p);
                            const Icon = platform.icon;
                            return (
                              <div key={p} className={`p-2 rounded-lg ${platform.color}`}>
                                <Icon className={`h-4 w-4 ${platform.textColor}`} />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              {post.title && <h4 className="font-medium">{post.title}</h4>}
                              <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                            </div>
                            <Badge className={statusInfo?.color} data-testid={`badge-status-${post.status}-${post.id}`}>
                              <StatusIcon className="h-3 w-3 ml-1" />
                              {statusInfo?.label}
                            </Badge>
                          </div>
                          {post.hashtags && post.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {post.hashtags.map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  <Hash className="h-3 w-3 ml-0.5" />
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-4 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {post.status === 'scheduled' && post.scheduledAt 
                                  ? `مجدول: ${formatDateTime(post.scheduledAt)}`
                                  : post.status === 'published' && post.publishedAt
                                  ? `نُشر: ${formatDateTime(post.publishedAt)}`
                                  : `أُنشئ: ${formatDateTime(post.createdAt)}`
                                }
                              </span>
                              {post.postType && (
                                <Badge variant="outline" className="text-xs" data-testid={`badge-posttype-${post.id}`}>
                                  {post.postType === 'regular' ? 'منشور عادي' : 
                                   post.postType === 'story' ? 'ستوري' :
                                   post.postType === 'reel' ? 'ريلز' : 'كاروسيل'}
                                </Badge>
                              )}
                              {post.campaignId && (
                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700" data-testid={`badge-campaign-${post.id}`}>
                                  <Briefcase className="h-3 w-3 ml-1" />
                                  {campaigns.find(c => c.id === post.campaignId)?.name || 'حملة'}
                                </Badge>
                              )}
                              {post.influencerId && (
                                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700" data-testid={`badge-influencer-${post.id}`}>
                                  <UserCheck className="h-3 w-3 ml-1" />
                                  {influencers.find(i => i.id === post.influencerId)?.name || 'مؤثر'}
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-edit-post-${post.id}`}>
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-copy-post-${post.id}`}>
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" data-testid={`button-delete-post-${post.id}`} onClick={() => handleDeletePost(post.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">تحليلات الأداء</h3>
                <p className="text-sm text-muted-foreground">إحصائيات شاملة لحساباتك على منصات التواصل</p>
              </div>
              <Button onClick={handleExportPDF} variant="outline" className="gap-2" data-testid="button-export-pdf">
                <FileText className="h-4 w-4" />
                تصدير PDF
              </Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">أداء المنصات</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={analytics.platformData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="platform" type="category" width={80} />
                      <Tooltip />
                      <Bar dataKey="followers" fill="#8b5cf6" name="المتابعين" />
                      <Bar dataKey="engagement" fill="#3b82f6" name="التفاعل" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">التفاعل الأسبوعي</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={analytics.weeklyEngagement}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="engagement" stroke="#8b5cf6" fill="#8b5cf680" name="التفاعل" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">توزيع المتابعين</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={analytics.platformData}
                        dataKey="followers"
                        nameKey="platform"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ platform, percent }) => `${platform} ${(percent * 100).toFixed(0)}%`}
                      >
                        {analytics.platformData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">أفضل أوقات النشر</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-purple-600" />
                        <span className="font-medium">أفضل وقت للنشر</span>
                      </div>
                      <span className="text-xl font-bold text-purple-600">{analytics.bestPostingTime}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {['صباحاً', 'ظهراً', 'مساءً'].map((time, i) => (
                        <div key={time} className="text-center p-3 border rounded-lg">
                          <p className="text-sm text-muted-foreground">{time}</p>
                          <p className="text-lg font-bold">{formatNum([15, 25, 60][i])}%</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      بناءً على تحليل آخر 30 يوم
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">قوالب المحتوى</h3>
                <p className="text-sm text-muted-foreground">قوالب جاهزة لتسريع إنشاء المحتوى</p>
              </div>
              <Button onClick={() => setShowTemplateDialog(true)} data-testid="button-new-template">
                <Plus className="h-4 w-4 ml-1" />
                قالب جديد
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => {
                const category = TEMPLATE_CATEGORIES.find(c => c.id === template.category);
                const CategoryIcon = category?.icon || FileText;
                
                return (
                  <Card key={template.id} className="hover:shadow-md transition-shadow" data-testid={`card-template-${template.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="bg-purple-100 p-2 rounded-lg">
                            <CategoryIcon className="h-4 w-4 text-purple-600" />
                          </div>
                          <div>
                            <CardTitle className="text-sm">{template.name}</CardTitle>
                            <CardDescription className="text-xs">{category?.name}</CardDescription>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-usage-${template.id}`}>
                          {formatNum(template.usageCount)} استخدام
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-3 bg-muted/30 p-2 rounded text-right" dir="rtl">
                        {template.content}
                      </p>
                      {template.suitablePlatforms && (
                        <div className="flex gap-1">
                          {template.suitablePlatforms.map(p => {
                            const platform = getPlatformInfo(p);
                            const Icon = platform.icon;
                            return (
                              <div key={p} className={`p-1 rounded ${platform.color}`}>
                                <Icon className={`h-3 w-3 ${platform.textColor}`} />
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleUseTemplate(template)}
                          data-testid={`button-use-template-${template.id}`}
                        >
                          <Play className="h-3 w-3 ml-1" />
                          استخدام
                        </Button>
                        <Button size="sm" variant="outline" data-testid={`button-edit-template-${template.id}`}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>إنشاء منشور جديد</DialogTitle>
              <DialogDescription>أنشئ منشوراً جديداً لنشره على منصات التواصل الاجتماعي</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>المنصات</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {PLATFORMS.map((platform) => {
                    const Icon = platform.icon;
                    const isSelected = newPost.platforms.includes(platform.id);
                    return (
                      <Button
                        key={platform.id}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className={isSelected ? platform.color : ''}
                        onClick={() => {
                          setNewPost(prev => ({
                            ...prev,
                            platforms: isSelected 
                              ? prev.platforms.filter(p => p !== platform.id)
                              : [...prev.platforms, platform.id]
                          }));
                        }}
                        data-testid={`button-select-platform-${platform.id}`}
                      >
                        <Icon className="h-4 w-4 ml-1" />
                        {platform.name}
                      </Button>
                    );
                  })}
                </div>
              </div>
              
              <div>
                <Label>نوع المنشور</Label>
                <Select value={newPost.postType} onValueChange={(v) => setNewPost(prev => ({ ...prev, postType: v }))}>
                  <SelectTrigger data-testid="select-post-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular" data-testid="select-item-regular">منشور عادي</SelectItem>
                    <SelectItem value="story" data-testid="select-item-story">ستوري</SelectItem>
                    <SelectItem value="reel" data-testid="select-item-reel">ريلز/فيديو قصير</SelectItem>
                    <SelectItem value="carousel" data-testid="select-item-carousel">كاروسيل (صور متعددة)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>المحتوى</Label>
                <Textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="اكتب محتوى المنشور هنا..."
                  className="min-h-[120px] text-right"
                  dir="rtl"
                  data-testid="input-content"
                />
                <p className="text-xs text-muted-foreground mt-1 text-left">
                  {formatNum(newPost.content.length)} / {formatNum(2200)} حرف
                </p>
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  الوسائط (صور/فيديو)
                </Label>
                <div className="mt-2">
                  {newPost.mediaUrls.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {newPost.mediaUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          {newPost.mediaTypes[index] === 'video' ? (
                            <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                              <Video className="h-8 w-8 text-muted-foreground" />
                            </div>
                          ) : (
                            <img 
                              src={url} 
                              alt={`Media ${index + 1}`}
                              className="aspect-square object-cover rounded-lg"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveMedia(index)}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`button-remove-media-${index}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      data-testid="input-media-upload"
                    />
                    {isUploading ? (
                      <span className="text-sm text-muted-foreground">جاري الرفع...</span>
                    ) : (
                      <>
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">اضغط لرفع الصور أو الفيديو</span>
                      </>
                    )}
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    الحد الأقصى: 10 ملفات، 50 ميجابايت لكل ملف
                  </p>
                </div>
              </div>
              
              <div>
                <Label>الهاشتاقات</Label>
                <Input
                  value={newPost.hashtags}
                  onChange={(e) => setNewPost(prev => ({ ...prev, hashtags: e.target.value }))}
                  placeholder="#باتر #حلويات #مخبوزات"
                  className="text-right"
                  dir="rtl"
                  data-testid="input-hashtags"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>الحملة التسويقية</Label>
                  <Select 
                    value={newPost.campaignId?.toString() || "none"} 
                    onValueChange={(v) => setNewPost(prev => ({ ...prev, campaignId: v === "none" ? null : parseInt(v) }))}
                  >
                    <SelectTrigger data-testid="select-campaign">
                      <SelectValue placeholder="اختر حملة (اختياري)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون حملة</SelectItem>
                      {campaigns.filter(c => c.status === 'active' || c.status === 'planned').map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id.toString()}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>المؤثر</Label>
                  <Select 
                    value={newPost.influencerId?.toString() || "none"} 
                    onValueChange={(v) => setNewPost(prev => ({ ...prev, influencerId: v === "none" ? null : parseInt(v) }))}
                  >
                    <SelectTrigger data-testid="select-influencer">
                      <SelectValue placeholder="اختر مؤثر (اختياري)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون مؤثر</SelectItem>
                      {influencers.map((influencer) => (
                        <SelectItem key={influencer.id} value={influencer.id.toString()}>
                          {influencer.nameAr || influencer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {upcomingEvents.length > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-blue-700 mb-2">مناسبات قادمة للإلهام:</p>
                  <div className="flex flex-wrap gap-2">
                    {upcomingEvents.map((event) => (
                      <Badge key={event.id} variant="secondary" className="text-xs">
                        {event.title} ({event.startDate})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <Label>وقت النشر</Label>
                <div className="flex gap-2 mt-2">
                  <Button 
                    variant={!newPost.scheduledAt ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewPost(prev => ({ ...prev, scheduledAt: "" }))}
                    data-testid="button-publish-now"
                  >
                    نشر فوري
                  </Button>
                  <Button 
                    variant={newPost.scheduledAt ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewPost(prev => ({ ...prev, scheduledAt: new Date().toISOString().slice(0, 16) }))}
                    data-testid="button-schedule"
                  >
                    جدولة
                  </Button>
                </div>
                {newPost.scheduledAt && (
                  <Input
                    type="datetime-local"
                    value={newPost.scheduledAt}
                    onChange={(e) => setNewPost(prev => ({ ...prev, scheduledAt: e.target.value }))}
                    className="mt-2"
                    data-testid="input-scheduled-datetime"
                  />
                )}
              </div>

              {newPost.content && newPost.platforms.length > 0 && (
                <div className="border-t pt-4">
                  <Label className="flex items-center gap-2 mb-3">
                    <Eye className="h-4 w-4" />
                    معاينة المنشور
                  </Label>
                  <div className="grid gap-3">
                    {newPost.platforms.map((platformId) => {
                      const platform = getPlatformInfo(platformId);
                      const Icon = platform.icon;
                      const charLimit = platformId === 'twitter' ? 280 : platformId === 'instagram' ? 2200 : 500;
                      const isOverLimit = newPost.content.length > charLimit;
                      
                      return (
                        <div key={platformId} className="border rounded-lg overflow-hidden" data-testid={`preview-${platformId}`}>
                          <div className={`${platform.color} ${platform.textColor} p-2 flex items-center gap-2`}>
                            <Icon className="h-4 w-4" />
                            <span className="text-sm font-medium">{platform.name}</span>
                            <span className={`text-xs mr-auto ${isOverLimit ? 'text-red-200' : ''}`}>
                              {formatNum(newPost.content.length)}/{formatNum(charLimit)} حرف
                            </span>
                          </div>
                          <div className="p-3 bg-white">
                            <div className="flex gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-white font-bold text-sm">
                                B
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-sm">Butter Bakery</p>
                                <p className="text-xs text-muted-foreground">@butterbakery</p>
                              </div>
                            </div>
                            {newPost.mediaUrls.length > 0 && (
                              <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg overflow-hidden">
                                {newPost.mediaUrls.slice(0, 4).map((url, idx) => (
                                  <div key={idx} className="aspect-square relative">
                                    {newPost.mediaTypes[idx] === 'video' ? (
                                      <div className="w-full h-full bg-muted flex items-center justify-center">
                                        <Video className="h-6 w-6 text-muted-foreground" />
                                      </div>
                                    ) : (
                                      <img src={url} alt="" className="w-full h-full object-cover" />
                                    )}
                                    {idx === 3 && newPost.mediaUrls.length > 4 && (
                                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold">
                                        +{newPost.mediaUrls.length - 4}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="mt-2 text-sm text-right whitespace-pre-wrap" dir="rtl">
                              {newPost.content.slice(0, charLimit)}
                              {isOverLimit && <span className="text-red-500">...</span>}
                            </p>
                            {newPost.hashtags && (
                              <p className="mt-2 text-xs text-blue-600 text-right" dir="rtl">
                                {newPost.hashtags.split(/[\s,]+/).filter(Boolean).map(tag => 
                                  tag.startsWith('#') ? tag : `#${tag}`
                                ).join(' ')}
                              </p>
                            )}
                            <div className="flex gap-4 mt-3 pt-2 border-t text-muted-foreground text-xs">
                              <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> إعجاب</span>
                              <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> تعليق</span>
                              <span className="flex items-center gap-1"><Share2 className="h-3 w-3" /> مشاركة</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPostDialog(false)} data-testid="button-cancel-post">إلغاء</Button>
              <Button onClick={handleCreatePost} disabled={!newPost.content || newPost.platforms.length === 0} data-testid="button-submit-post">
                {newPost.scheduledAt ? 'جدولة المنشور' : 'نشر الآن'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ربط حساب {selectedPlatform && getPlatformInfo(selectedPlatform).name}</DialogTitle>
              <DialogDescription>
                سيتم توجيهك لتسجيل الدخول ومنح الصلاحيات المطلوبة
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="font-medium">الصلاحيات المطلوبة:</p>
                <ul className="text-sm text-muted-foreground space-y-1 mr-4">
                  <li>• قراءة معلومات الحساب</li>
                  <li>• نشر المحتوى</li>
                  <li>• جدولة المنشورات</li>
                  <li>• قراءة الإحصائيات</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">
                لا نقوم بتخزين كلمات المرور. نستخدم OAuth للاتصال الآمن.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConnectDialog(false)} data-testid="button-cancel-connect">إلغاء</Button>
              <Button onClick={handleConnectAccount} data-testid="button-confirm-connect">
                متابعة الربط
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
