import { Layout } from "../components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { 
  Instagram, Facebook, Twitter, Youtube, Music, Ghost,
  Plus, Link2, Unlink, RefreshCw, Calendar, Send, FileEdit,
  BarChart3, Eye, Heart, MessageCircle, Share2, Bookmark,
  TrendingUp, Users, Clock, CheckCircle, XCircle, AlertCircle,
  Megaphone, Image, Video, FileText, Hash, Target, ChevronLeft,
  Sparkles, Layout as LayoutIcon, Copy, Trash2, Edit2, Play
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend, LineChart, Line
} from "recharts";

const formatNum = (num: number | string): string => {
  return Number(num).toLocaleString('en-US');
};

const PLATFORMS = [
  { id: "instagram", name: "انستقرام", icon: Instagram, color: "bg-gradient-to-r from-purple-500 to-pink-500", textColor: "text-white" },
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

const mockAccounts: SocialAccount[] = [
  { id: 1, platform: "instagram", accountName: "Butter Bakery", accountHandle: "@butterbakery_sa", followersCount: 125000, followingCount: 450, postsCount: 892, isConnected: true, lastSyncAt: "2026-01-15T10:30:00" },
  { id: 2, platform: "twitter", accountName: "Butter Bakery SA", accountHandle: "@ButterBakerySA", followersCount: 45000, followingCount: 320, postsCount: 1245, isConnected: true, lastSyncAt: "2026-01-15T09:00:00" },
  { id: 3, platform: "tiktok", accountName: "ButterBakerySA", accountHandle: "@butterbakerysa", followersCount: 89000, followingCount: 50, postsCount: 156, isConnected: true, lastSyncAt: "2026-01-14T18:00:00" },
  { id: 4, platform: "snapchat", accountName: "ButterBakery", accountHandle: "@butterbakery", followersCount: 67000, followingCount: 0, postsCount: 0, isConnected: false, connectionError: "انتهت صلاحية الاتصال" },
];

const mockPosts: SocialPost[] = [
  { id: 1, title: "عرض نهاية الأسبوع", content: "استمتعوا بخصم 20% على جميع الكيكات هذا الأسبوع! 🎂✨", hashtags: ["عروض_باتر", "كيك", "حلويات"], status: "published", platforms: ["instagram", "twitter"], publishedAt: "2026-01-14T12:00:00", createdAt: "2026-01-13T10:00:00", postType: "regular" },
  { id: 2, title: "وصفة جديدة", content: "تعرفوا على أحدث إضافاتنا: كيكة الفستق بالكراميل المملح 😋", hashtags: ["وصفات_جديدة", "فستق", "كراميل"], status: "scheduled", platforms: ["instagram", "tiktok"], scheduledAt: "2026-01-16T15:00:00", createdAt: "2026-01-15T08:00:00", postType: "reel" },
  { id: 3, title: "كواليس المطبخ", content: "شاهدوا كيف نصنع الكرواسون الطازج كل صباح! 🥐", hashtags: ["كواليس", "كرواسون", "مخبوزات"], status: "draft", platforms: ["instagram"], createdAt: "2026-01-15T11:00:00", postType: "story" },
  { id: 4, content: "منشور تجريبي فشل في النشر", status: "failed", platforms: ["twitter"], createdAt: "2026-01-14T09:00:00", postType: "regular" },
];

const mockTemplates: ContentTemplate[] = [
  { id: 1, name: "عرض خصم", category: "promotion", content: "🎉 عرض خاص! خصم {discount}% على {product}\nالعرض ساري حتى {end_date}\n#عروض_باتر #حلويات", defaultHashtags: ["عروض_باتر", "خصم"], suitablePlatforms: ["instagram", "twitter"], usageCount: 45 },
  { id: 2, name: "إطلاق منتج جديد", category: "product_launch", content: "✨ جديد في باتر!\nتعرفوا على {product_name}\n{description}\nمتوفر الآن في جميع فروعنا", defaultHashtags: ["جديد_باتر", "منتج_جديد"], suitablePlatforms: ["instagram", "tiktok"], usageCount: 23 },
  { id: 3, name: "تهنئة مناسبة", category: "holiday", content: "🌙 كل عام وأنتم بخير بمناسبة {occasion}\nنتمنى لكم {wishes}", defaultHashtags: ["باتر", "مناسبات"], suitablePlatforms: ["instagram", "twitter", "snapchat"], usageCount: 18 },
];

const mockAnalytics = {
  totalReach: 450000,
  totalEngagement: 28500,
  totalFollowers: 326000,
  followersGrowth: 12.5,
  engagementRate: 4.2,
  bestPostingTime: "18:00",
  topPlatform: "instagram",
  platformData: [
    { platform: "انستقرام", followers: 125000, engagement: 15000, reach: 250000 },
    { platform: "تويتر", followers: 45000, engagement: 5500, reach: 80000 },
    { platform: "تيك توك", followers: 89000, engagement: 7000, reach: 100000 },
    { platform: "سناب شات", followers: 67000, engagement: 1000, reach: 20000 },
  ],
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

const COLORS = ['#8b5cf6', '#3b82f6', '#000000', '#eab308'];

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
  });

  const accounts = mockAccounts;
  const posts = mockPosts;
  const templates = mockTemplates;
  const analytics = mockAnalytics;

  const filteredPosts = postFilter === "all" 
    ? posts 
    : posts.filter(p => p.status === postFilter);

  const getPlatformInfo = (platformId: string) => {
    return PLATFORMS.find(p => p.id === platformId) || PLATFORMS[0];
  };

  const handleConnectPlatform = (platformId: string) => {
    setSelectedPlatform(platformId);
    setShowConnectDialog(true);
  };

  const handleCreatePost = () => {
    toast({
      title: "تم إنشاء المنشور",
      description: "تم حفظ المنشور بنجاح",
    });
    setShowPostDialog(false);
    setNewPost({ content: "", platforms: [], scheduledAt: "", postType: "regular", hashtags: "" });
  };

  const handleUseTemplate = (template: ContentTemplate) => {
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

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg">
              <Share2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">إدارة السوشيال ميديا</h1>
              <p className="text-muted-foreground text-sm">إدارة حساباتك ومنشوراتك على منصات التواصل الاجتماعي</p>
            </div>
          </div>
          <Button onClick={() => setShowPostDialog(true)} className="gap-2">
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
                  <p className="text-xl font-bold">{formatNum(analytics.totalFollowers)}</p>
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
                  <p className="text-xl font-bold">{formatNum(analytics.totalReach)}</p>
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
                  <p className="text-xl font-bold">{formatNum(analytics.totalEngagement)}</p>
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
                  <p className="text-xl font-bold">{formatNum(analytics.engagementRate)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="accounts" className="flex items-center gap-2 py-2">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">الحسابات</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2 py-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">الجدولة</span>
            </TabsTrigger>
            <TabsTrigger value="posts" className="flex items-center gap-2 py-2">
              <FileEdit className="h-4 w-4" />
              <span className="hidden sm:inline">المنشورات</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2 py-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">التحليلات</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2 py-2">
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
                  <Card key={platform.id} className={`${!account?.isConnected ? 'opacity-70' : ''}`}>
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
                        <Badge variant={account?.isConnected ? "default" : "secondary"}>
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
                            <span>آخر مزامنة: {account.lastSyncAt ? new Date(account.lastSyncAt).toLocaleString('ar-SA') : 'لم يتم'}</span>
                            <Button size="sm" variant="ghost" className="h-7 px-2">
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1 text-xs">
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
                  <Button onClick={() => setShowPostDialog(true)} size="sm">
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
                    <div key={post.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
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
                          {post.scheduledAt && new Date(post.scheduledAt).toLocaleString('ar-SA')}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7">
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500">
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
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
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
                  >
                    {filter.label}
                    {filter.value !== 'all' && (
                      <Badge variant="secondary" className="mr-1 h-5 px-1.5">
                        {formatNum(posts.filter(p => p.status === filter.value).length)}
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>
              <Button onClick={() => setShowPostDialog(true)}>
                <Plus className="h-4 w-4 ml-1" />
                منشور جديد
              </Button>
            </div>

            <div className="grid gap-4">
              {filteredPosts.map((post) => {
                const statusInfo = POST_STATUSES[post.status as keyof typeof POST_STATUSES];
                const StatusIcon = statusInfo?.icon || FileEdit;
                
                return (
                  <Card key={post.id}>
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
                            <Badge className={statusInfo?.color}>
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
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {post.status === 'scheduled' && post.scheduledAt 
                                  ? `مجدول: ${new Date(post.scheduledAt).toLocaleString('ar-SA')}`
                                  : post.status === 'published' && post.publishedAt
                                  ? `نُشر: ${new Date(post.publishedAt).toLocaleString('ar-SA')}`
                                  : `أُنشئ: ${new Date(post.createdAt).toLocaleString('ar-SA')}`
                                }
                              </span>
                              {post.postType && (
                                <Badge variant="outline" className="text-xs">
                                  {post.postType === 'regular' ? 'منشور عادي' : 
                                   post.postType === 'story' ? 'ستوري' :
                                   post.postType === 'reel' ? 'ريلز' : 'كاروسيل'}
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7">
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7">
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500">
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
              <Button onClick={() => setShowTemplateDialog(true)}>
                <Plus className="h-4 w-4 ml-1" />
                قالب جديد
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => {
                const category = TEMPLATE_CATEGORIES.find(c => c.id === template.category);
                const CategoryIcon = category?.icon || FileText;
                
                return (
                  <Card key={template.id} className="hover:shadow-md transition-shadow">
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
                        <Badge variant="secondary" className="text-xs">
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
                        >
                          <Play className="h-3 w-3 ml-1" />
                          استخدام
                        </Button>
                        <Button size="sm" variant="outline">
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">منشور عادي</SelectItem>
                    <SelectItem value="story">ستوري</SelectItem>
                    <SelectItem value="reel">ريلز/فيديو قصير</SelectItem>
                    <SelectItem value="carousel">كاروسيل (صور متعددة)</SelectItem>
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
                />
                <p className="text-xs text-muted-foreground mt-1 text-left">
                  {formatNum(newPost.content.length)} / {formatNum(2200)} حرف
                </p>
              </div>
              
              <div>
                <Label>الهاشتاقات</Label>
                <Input
                  value={newPost.hashtags}
                  onChange={(e) => setNewPost(prev => ({ ...prev, hashtags: e.target.value }))}
                  placeholder="#باتر #حلويات #مخبوزات"
                  className="text-right"
                  dir="rtl"
                />
              </div>
              
              <div>
                <Label>وقت النشر</Label>
                <div className="flex gap-2 mt-2">
                  <Button 
                    variant={!newPost.scheduledAt ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewPost(prev => ({ ...prev, scheduledAt: "" }))}
                  >
                    نشر فوري
                  </Button>
                  <Button 
                    variant={newPost.scheduledAt ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewPost(prev => ({ ...prev, scheduledAt: new Date().toISOString().slice(0, 16) }))}
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
                  />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPostDialog(false)}>إلغاء</Button>
              <Button onClick={handleCreatePost} disabled={!newPost.content || newPost.platforms.length === 0}>
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
              <Button variant="outline" onClick={() => setShowConnectDialog(false)}>إلغاء</Button>
              <Button onClick={() => {
                toast({
                  title: "جاري الربط...",
                  description: "سيتم توجيهك لصفحة تسجيل الدخول",
                });
                setShowConnectDialog(false);
              }}>
                متابعة الربط
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
