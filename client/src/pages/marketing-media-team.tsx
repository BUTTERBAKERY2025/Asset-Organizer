import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Camera, Upload, Image as ImageIcon, Video, Palette, Type, FileImage, FolderArchive,
  Search, Download, Trash2, Copy, Loader2, X, Plus, Pencil, Eye, FileText, Sparkles,
  Folder, FolderOpen, ArrowRight, Layers, HardDrive, Calendar,
  LayoutGrid, Grid3x3, List as ListIcon,
} from "lucide-react";
import butterLogo from "@/assets/butter-logo.png";

interface MediaAsset {
  id: number; category: string; title: string; description: string | null;
  fileType: string; mimeType: string; fileName: string; storagePath: string;
  fileSize: number; thumbnailPath: string | null; tags: string[] | null;
  branchId: number | null; campaignId: number | null; platform: string | null;
  publishDate: string | null; designer: string | null; uploadedBy: string | null;
  createdAt: string;
}
interface BrandColor { id: number; name: string; hex: string; description: string | null; usage: string | null; sortOrder: number; }
interface BrandFont { id: number; name: string; family: string; language: string; weights: string | null; downloadUrl: string | null; notes: string | null; sortOrder: number; }
interface MediaCampaign {
  id: number; name: string; description: string | null; coverColor: string | null;
  status: string; startDate: string | null; endDate: string | null; branchId: number | null;
  createdAt: string; asset_count?: number; total_size?: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  identity: "الهوية البصرية",
  photos: "بنك الصور",
  products: "منتجات الفريق",
  templates: "القوالب الجاهزة",
  archive: "الأرشيف الخام",
  campaigns: "حملات التصميم",
};
const PLATFORM_LABELS: Record<string, string> = {
  instagram: "إنستقرام", tiktok: "تيك توك", snapchat: "سناب شات",
  twitter: "إكس / تويتر", youtube: "يوتيوب", facebook: "فيسبوك", other: "أخرى",
};

function formatBytes(b: number) {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), u.length - 1);
  return (b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + " " + u[i];
}

type ViewMode = "grid" | "large" | "list";

function ViewModeToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const opts: { v: ViewMode; icon: any; title: string }[] = [
    { v: "grid", icon: Grid3x3, title: "شبكة عادية" },
    { v: "large", icon: LayoutGrid, title: "شبكة كبيرة" },
    { v: "list", icon: ListIcon, title: "قائمة" },
  ];
  return (
    <div className="inline-flex border rounded-lg bg-white p-0.5">
      {opts.map(o => {
        const Icon = o.icon;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            title={o.title}
            data-testid={`view-mode-${o.v}`}
            className={`p-1.5 rounded transition ${value === o.v ? "bg-violet-600 text-white" : "text-slate-500 hover:bg-violet-50"}`}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}

function AssetGrid({ assets, view, onView, onEdit, onDelete }: {
  assets: MediaAsset[]; view: ViewMode;
  onView: (a: MediaAsset) => void; onEdit: (a: MediaAsset) => void; onDelete: (a: MediaAsset) => void;
}) {
  if (view === "list") {
    return (
      <div className="divide-y border rounded-lg overflow-hidden bg-white">
        {assets.map(a => <AssetListRow key={a.id} asset={a} onView={() => onView(a)} onEdit={() => onEdit(a)} onDelete={() => onDelete(a)} />)}
      </div>
    );
  }
  const gridClass = view === "large"
    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
    : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3";
  return (
    <div className={gridClass}>
      {assets.map(a => <AssetCard key={a.id} asset={a} large={view === "large"} onView={() => onView(a)} onEdit={() => onEdit(a)} onDelete={() => onDelete(a)} />)}
    </div>
  );
}

function AssetListRow({ asset, onView, onEdit, onDelete }: { asset: MediaAsset; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  const isImage = asset.fileType === "image";
  const isVideo = asset.fileType === "video";
  const thumb = `/api/media/assets/${asset.id}/view`;
  return (
    <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 hover:bg-violet-50/40 transition" data-testid={`asset-row-${asset.id}`}>
      <div className="w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 cursor-pointer" onClick={onView}>
        {isImage ? <img src={thumb} alt={asset.title} className="w-full h-full object-cover" loading="lazy" />
          : isVideo ? <div className="w-full h-full flex items-center justify-center bg-slate-800 text-white"><Video className="w-5 h-5 sm:w-6 sm:h-6" /></div>
          : <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-500"><FileText className="w-5 h-5 sm:w-6 sm:h-6" /></div>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-xs sm:text-sm truncate" title={asset.title}>{asset.title}</div>
        <div className="text-[10px] sm:text-xs text-slate-500 truncate">{asset.fileName}</div>
        <div className="flex flex-wrap items-center gap-1 mt-0.5 sm:mt-1">
          <span className="sm:hidden text-[10px] text-slate-500">{formatBytes(asset.fileSize)}</span>
          {asset.tags && asset.tags.slice(0, 2).map(t => <Badge key={t} variant="secondary" className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0">{t}</Badge>)}
        </div>
      </div>
      <div className="hidden lg:block text-xs text-slate-500 w-24 text-center truncate">{asset.designer || "—"}</div>
      <div className="hidden sm:block text-xs text-slate-500 w-20 text-center">{formatBytes(asset.fileSize)}</div>
      {asset.platform && <Badge variant="outline" className="text-[10px] hidden md:inline-flex">{PLATFORM_LABELS[asset.platform] || asset.platform}</Badge>}
      <div className="flex gap-0.5 sm:gap-1 flex-shrink-0">
        <Button size="sm" variant="outline" className="h-9 w-9 sm:h-8 sm:w-auto sm:px-2 p-0" onClick={onView} title="معاينة"><Eye className="w-4 h-4 sm:w-3.5 sm:h-3.5" /></Button>
        <a href={`/api/media/assets/${asset.id}/download`}><Button size="sm" variant="outline" className="h-9 w-9 sm:h-8 sm:w-auto sm:px-2 p-0" title="تنزيل"><Download className="w-4 h-4 sm:w-3.5 sm:h-3.5" /></Button></a>
        <Button size="sm" variant="outline" className="hidden sm:inline-flex h-8 px-2" onClick={onEdit} title="تعديل"><Pencil className="w-3.5 h-3.5" /></Button>
        <Button size="sm" variant="outline" className="hidden sm:inline-flex h-8 px-2 text-red-600 hover:bg-red-50" onClick={onDelete} title="حذف"><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    </div>
  );
}

export default function MarketingMediaTeamPage() {
  const [tab, setTab] = useState("identity");

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6 pb-20 md:pb-6">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-l from-violet-600 via-purple-600 to-fuchsia-600 p-4 sm:p-6 md:p-8 text-white shadow-lg">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_left,white_0%,transparent_50%)]" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4">
              <div className="bg-white/20 backdrop-blur p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-white/30 flex-shrink-0">
                <Camera className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold leading-tight">فريق التصوير والميديا</h1>
                <p className="text-violet-50 text-xs sm:text-sm md:text-base mt-1 max-w-2xl leading-relaxed">
                  مكتبة بصرية موحّدة — الهوية، بنك الصور، المنتجات، القوالب، الأرشيف، وحملات التصميم
                </p>
              </div>
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} dir="rtl">
          {/* تبويبات قابلة للسحب الأفقي على الجوال — sticky على الجوال للوصول السريع */}
          <div className="sticky top-0 z-20 -mx-3 sm:-mx-4 md:mx-0 px-3 sm:px-4 md:px-0 py-2 -my-2 md:my-0 md:py-0 bg-slate-50/90 md:bg-transparent backdrop-blur md:backdrop-blur-none">
            <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
              <TabsList className="bg-white border shadow-sm h-auto p-1 sm:p-1.5 inline-flex gap-1 min-w-full md:min-w-0">
                <TabTriggerStyled value="identity" icon={<Palette className="w-4 h-4" />} label="الهوية" labelLg="الهوية البصرية" />
                <TabTriggerStyled value="campaigns" icon={<FolderOpen className="w-4 h-4" />} label="الحملات" labelLg="حملات التصميم" highlight />
                <TabTriggerStyled value="photos" icon={<ImageIcon className="w-4 h-4" />} label="الصور" labelLg="بنك الصور" />
                <TabTriggerStyled value="products" icon={<Sparkles className="w-4 h-4" />} label="المنتجات" labelLg="منتجات الفريق" />
                <TabTriggerStyled value="templates" icon={<FileImage className="w-4 h-4" />} label="القوالب" />
                <TabTriggerStyled value="archive" icon={<FolderArchive className="w-4 h-4" />} label="الأرشيف" labelLg="الأرشيف الخام" />
              </TabsList>
            </div>
          </div>

          <TabsContent value="identity" className="mt-4 sm:mt-6"><IdentityTab /></TabsContent>
          <TabsContent value="campaigns" className="mt-4 sm:mt-6"><CampaignsTab /></TabsContent>
          <TabsContent value="photos" className="mt-4 sm:mt-6"><AssetGalleryTab category="photos" /></TabsContent>
          <TabsContent value="products" className="mt-4 sm:mt-6"><AssetGalleryTab category="products" showPlatform /></TabsContent>
          <TabsContent value="templates" className="mt-4 sm:mt-6"><AssetGalleryTab category="templates" /></TabsContent>
          <TabsContent value="archive" className="mt-4 sm:mt-6"><AssetGalleryTab category="archive" /></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function TabTriggerStyled({ value, icon, label, labelLg, highlight }: { value: string; icon: React.ReactNode; label: string; labelLg?: string; highlight?: boolean }) {
  return (
    <TabsTrigger
      value={value}
      data-testid={`tab-${value}`}
      className={`relative gap-1.5 sm:gap-2 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap
        data-[state=active]:bg-gradient-to-l data-[state=active]:from-violet-500 data-[state=active]:to-fuchsia-500
        data-[state=active]:text-white data-[state=active]:shadow-md
        text-slate-600 hover:bg-violet-50 transition`}
    >
      {icon}
      <span className="md:hidden">{label}</span>
      <span className="hidden md:inline">{labelLg || label}</span>
      {highlight && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
    </TabsTrigger>
  );
}

/* ============================== الهوية البصرية ============================== */
function IdentityTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: colors = [] } = useQuery<BrandColor[]>({ queryKey: ["/api/media/brand/colors"] });
  const { data: fonts = [] } = useQuery<BrandFont[]>({ queryKey: ["/api/media/brand/fonts"] });
  const { data: logoAssets = [] } = useQuery<MediaAsset[]>({
    queryKey: ["/api/media/assets", "identity"],
    queryFn: async () => { const r = await fetch("/api/media/assets?category=identity"); return r.json(); },
  });
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/media/stats"],
    queryFn: async () => { const r = await fetch("/api/media/stats"); return r.json(); },
  });

  const [colorOpen, setColorOpen] = useState(false);
  const [editColor, setEditColor] = useState<BrandColor | null>(null);
  const [fontOpen, setFontOpen] = useState(false);
  const [editFont, setEditFont] = useState<BrandFont | null>(null);

  // استخراج إحصائيات بنوع الملف
  const imgCount = stats?.byType?.find((r: any) => r.file_type === "image")?.count || 0;
  const vidCount = stats?.byType?.find((r: any) => r.file_type === "video")?.count || 0;
  const docCount = (stats?.byType || []).filter((r: any) => r.file_type !== "image" && r.file_type !== "video").reduce((s: number, r: any) => s + Number(r.count || 0), 0);
  const totalCount = Number(stats?.totals?.total_count || 0);
  const totalSize = Number(stats?.totals?.total_size || 0);
  const campsTotal = Number(stats?.campaigns?.total || 0);
  const campsActive = Number(stats?.campaigns?.active || 0);

  // أبرز فئات الملفات
  const catRows = stats?.byCategory || [];
  const maxCatCount = Math.max(1, ...catRows.map((r: any) => Number(r.count || 0)));

  const saveColor = useMutation({
    mutationFn: async (body: any) => {
      const r = await apiRequest(editColor ? "PATCH" : "POST", editColor ? `/api/media/brand/colors/${editColor.id}` : "/api/media/brand/colors", body);
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/media/brand/colors"] }); setColorOpen(false); setEditColor(null); toast({ title: "تم الحفظ" }); },
    onError: (e: any) => toast({ title: "فشل", description: e.message, variant: "destructive" }),
  });
  const delColor = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/media/brand/colors/${id}`); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/media/brand/colors"] }); toast({ title: "تم الحذف" }); },
  });
  const saveFont = useMutation({
    mutationFn: async (body: any) => {
      const r = await apiRequest(editFont ? "PATCH" : "POST", editFont ? `/api/media/brand/fonts/${editFont.id}` : "/api/media/brand/fonts", body);
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/media/brand/fonts"] }); setFontOpen(false); setEditFont(null); toast({ title: "تم الحفظ" }); },
    onError: (e: any) => toast({ title: "فشل", description: e.message, variant: "destructive" }),
  });
  const delFont = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/media/brand/fonts/${id}`); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/media/brand/fonts"] }); toast({ title: "تم الحذف" }); },
  });

  const copyHex = (hex: string) => { navigator.clipboard.writeText(hex); toast({ title: "تم النسخ", description: hex }); };

  return (
    <div className="space-y-5">
      {/* ===== داش بورد الإحصائيات ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        <MiniStat icon={<Layers className="w-4 h-4" />} label="إجمالي الملفات" value={totalCount} tone="amber" />
        <MiniStat icon={<ImageIcon className="w-4 h-4" />} label="الصور" value={imgCount} tone="blue" />
        <MiniStat icon={<Video className="w-4 h-4" />} label="الفيديوهات" value={vidCount} tone="rose" />
        <MiniStat icon={<FileText className="w-4 h-4" />} label="ملفات أخرى" value={docCount} tone="purple" />
        <MiniStat icon={<FolderOpen className="w-4 h-4" />} label="الحملات" value={`${campsActive}/${campsTotal}`} tone="green" />
        <MiniStat icon={<HardDrive className="w-4 h-4" />} label="حجم المكتبة" value={formatBytes(totalSize)} tone="slate" />
      </div>

      {/* ===== توزيع الملفات حسب الفئة + ملخص الهوية ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* بطاقة توزيع */}
        <Card className="lg:col-span-2 border-0 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-2 bg-gradient-to-l from-slate-50 to-white border-b py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="bg-violet-100 text-violet-700 p-1.5 rounded-md"><Layers className="w-4 h-4" /></div>
              توزيع الملفات حسب الفئة
            </CardTitle>
            <Badge variant="secondary" className="text-[10px]">{catRows.length} فئة</Badge>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {catRows.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-6">لا توجد بيانات بعد</div>
            ) : catRows.map((r: any) => {
              const pct = Math.round((Number(r.count) / maxCatCount) * 100);
              return (
                <div key={r.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{CATEGORY_LABELS[r.category] || r.category}</span>
                    <span className="text-slate-500"><span className="font-bold text-slate-800">{r.count}</span> ملف · {formatBytes(Number(r.total_size))}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-l from-violet-500 to-fuchsia-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* بطاقة ملخص الهوية */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-l from-violet-50/80 to-white border-b py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="bg-violet-100 text-violet-700 p-1.5 rounded-md"><Sparkles className="w-4 h-4" /></div>
              عناصر الهوية
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <IdentitySummaryRow icon={<ImageIcon className="w-4 h-4" />} label="أصول الهوية (لوجو)" value={logoAssets.length} color="amber" />
            <IdentitySummaryRow icon={<Palette className="w-4 h-4" />} label="الألوان الرسمية" value={colors.length} color="rose" />
            <IdentitySummaryRow icon={<Type className="w-4 h-4" />} label="الخطوط المعتمدة" value={fonts.length} color="indigo" />
            <IdentitySummaryRow icon={<FolderOpen className="w-4 h-4" />} label="الحملات النشطة" value={campsActive} color="green" />
          </CardContent>
        </Card>
      </div>

      {/* ===== اللوجو الرسمي ===== */}
      <SectionCard title="اللوجو الرسمي" icon={<ImageIcon className="w-4 h-4" />} count={logoAssets.length}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <LogoPreview label="كريمي" bg="#FFF8EE" />
          <LogoPreview label="أبيض" bg="#FFFFFF" />
          <LogoPreview label="ذهبي" bg="#D4A574" />
          <LogoPreview label="أسود" bg="#1A1A1A" />
        </div>
      </SectionCard>

      {/* ===== لوحة الألوان ===== */}
      <SectionCard title="لوحة الألوان الرسمية" icon={<Palette className="w-4 h-4" />} count={colors.length} action={
        <Button size="sm" onClick={() => { setEditColor(null); setColorOpen(true); }} data-testid="btn-add-color" className="bg-violet-600 hover:bg-violet-700 h-8">
          <Plus className="w-3.5 h-3.5 ml-1" /> <span className="hidden sm:inline">إضافة لون</span><span className="sm:hidden">لون</span>
        </Button>
      }>
        {colors.length === 0 ? <EmptyState text="لا توجد ألوان بعد" sub="أضف أول لون لبناء لوحة الهوية البصرية" /> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
            {colors.map(c => (
              <div key={c.id} className="border rounded-xl overflow-hidden bg-white hover:shadow-md hover:border-violet-300 transition group" data-testid={`color-${c.id}`}>
                <div className="h-20 cursor-pointer relative" style={{ backgroundColor: c.hex }} onClick={() => copyHex(c.hex)}>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition">
                    <div className="bg-white/90 text-slate-800 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1">
                      <Copy className="w-3 h-3" /> نسخ
                    </div>
                  </div>
                </div>
                <div className="p-2.5">
                  <div className="font-bold text-xs truncate" title={c.name}>{c.name}</div>
                  <code className="text-[10px] text-slate-500 font-mono block cursor-pointer hover:text-violet-600 truncate" onClick={() => copyHex(c.hex)} title="نسخ">{c.hex.toUpperCase()}</code>
                  {c.usage && <div className="text-[10px] text-slate-400 mt-0.5 truncate" title={c.usage}>{c.usage}</div>}
                  <div className="flex gap-0.5 mt-1.5 pt-1.5 border-t">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditColor(c); setColorOpen(true); }}><Pencil className="w-3 h-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600 hover:bg-red-50" onClick={() => { if (confirm("حذف اللون؟")) delColor.mutate(c.id); }}><Trash2 className="w-3 h-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 mr-auto" onClick={() => copyHex(c.hex)} title="نسخ"><Copy className="w-3 h-3" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ===== الخطوط ===== */}
      <SectionCard title="الخطوط المعتمدة" icon={<Type className="w-4 h-4" />} count={fonts.length} action={
        <Button size="sm" onClick={() => { setEditFont(null); setFontOpen(true); }} data-testid="btn-add-font" className="bg-violet-600 hover:bg-violet-700 h-8">
          <Plus className="w-3.5 h-3.5 ml-1" /> <span className="hidden sm:inline">إضافة خط</span><span className="sm:hidden">خط</span>
        </Button>
      }>
        {fonts.length === 0 ? <EmptyState text="لا توجد خطوط بعد" sub="أضف خطوط العلامة التجارية ليتمكن الفريق من استخدامها" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {fonts.map(f => (
              <div key={f.id} className="border rounded-xl p-3.5 bg-white hover:shadow-md hover:border-violet-300 transition group relative overflow-hidden" data-testid={`font-${f.id}`}>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-l from-violet-500 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition" />
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate" title={f.name}>{f.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{f.language === "ar" ? "عربي" : f.language === "en" ? "إنجليزي" : "متعدد"}</Badge>
                      {f.weights && <span className="text-[10px] text-slate-400">· {f.weights}</span>}
                    </div>
                  </div>
                  <div className="flex gap-0.5 flex-shrink-0">
                    {f.downloadUrl && <a href={f.downloadUrl} target="_blank" rel="noreferrer"><Button size="icon" variant="ghost" className="h-6 w-6"><Download className="w-3 h-3" /></Button></a>}
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditFont(f); setFontOpen(true); }}><Pencil className="w-3 h-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600 hover:bg-red-50" onClick={() => { if (confirm("حذف الخط؟")) delFont.mutate(f.id); }}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
                <div className="text-xl my-2 leading-relaxed text-slate-700 truncate" style={{ fontFamily: f.family }}>أبجد هوز — Aa Bb 123</div>
                {f.notes && <div className="text-[10px] text-slate-400 truncate" title={f.notes}>{f.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <ColorDialog open={colorOpen} onClose={() => { setColorOpen(false); setEditColor(null); }} initial={editColor} onSave={(v: any) => saveColor.mutate(v)} saving={saveColor.isPending} />
      <FontDialog open={fontOpen} onClose={() => { setFontOpen(false); setEditFont(null); }} initial={editFont} onSave={(v: any) => saveFont.mutate(v)} saving={saveFont.isPending} />
    </div>
  );
}

function MiniStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: any; tone: string }) {
  const tones: Record<string, { bg: string; text: string; ring: string }> = {
    amber:  { bg: "bg-violet-50",  text: "text-violet-700",  ring: "ring-violet-100" },
    blue:   { bg: "bg-blue-50",    text: "text-blue-700",    ring: "ring-blue-100" },
    rose:   { bg: "bg-rose-50",    text: "text-rose-700",    ring: "ring-rose-100" },
    purple: { bg: "bg-purple-50",  text: "text-purple-700",  ring: "ring-purple-100" },
    green:  { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-100" },
    indigo: { bg: "bg-indigo-50",  text: "text-indigo-700",  ring: "ring-indigo-100" },
    slate:  { bg: "bg-slate-100",  text: "text-slate-700",   ring: "ring-slate-200" },
  };
  const t = tones[tone] || tones.amber;
  return (
    <div className="bg-white border rounded-xl p-3 hover:shadow-sm transition group">
      <div className="flex items-center gap-2">
        <div className={`${t.bg} ${t.text} p-1.5 rounded-lg ring-1 ${t.ring} group-hover:scale-110 transition`}>{icon}</div>
        <div className="text-[10px] sm:text-xs text-slate-500 truncate">{label}</div>
      </div>
      <div className="text-lg sm:text-xl font-bold text-slate-800 mt-1.5 truncate">{value}</div>
    </div>
  );
}

function IdentitySummaryRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    amber: "bg-violet-100 text-violet-700",
    rose: "bg-rose-100 text-rose-700",
    indigo: "bg-indigo-100 text-indigo-700",
    green: "bg-emerald-100 text-emerald-700",
  };
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition">
      <div className={`${colors[color]} p-2 rounded-lg`}>{icon}</div>
      <div className="flex-1 text-xs sm:text-sm font-medium text-slate-700">{label}</div>
      <div className="text-lg font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

function SectionCard({ title, icon, count, action, children }: any) {
  return (
    <Card className="border-2 border-slate-100 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 bg-gradient-to-l from-violet-50/80 to-white border-b py-3 sm:py-4 px-3 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base min-w-0">
          <div className="bg-violet-100 text-violet-700 p-1.5 sm:p-2 rounded-lg flex-shrink-0">{icon}</div>
          <span className="truncate">{title}</span>
          {count !== undefined && <Badge variant="secondary" className="mr-1 sm:mr-2 flex-shrink-0">{count}</Badge>}
        </CardTitle>
        {action && <div className="flex-shrink-0">{action}</div>}
      </CardHeader>
      <CardContent className="p-3 sm:p-5">{children}</CardContent>
    </Card>
  );
}

function EmptyState({ text, sub, action }: { text: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-10 text-slate-500">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 mb-3">
        <ImageIcon className="w-7 h-7 text-slate-400" />
      </div>
      <p className="font-medium">{text}</p>
      {sub && <p className="text-xs mt-1 text-slate-400">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function LogoPreview({ label, bg }: { label: string; bg: string }) {
  const isDark = bg === "#1A1A1A";
  return (
    <div className="border rounded-xl overflow-hidden hover:shadow-md hover:border-violet-300 transition group">
      <div className="h-24 sm:h-28 flex items-center justify-center p-3 sm:p-4 relative" style={{ backgroundColor: bg }}>
        <img src={butterLogo} alt="Butter Bakery" className="max-h-full max-w-full object-contain group-hover:scale-105 transition" />
        <div className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${isDark ? "bg-white/50" : "bg-slate-300"}`} />
      </div>
      <div className="text-[11px] sm:text-xs text-center py-1.5 sm:py-2 bg-white font-semibold text-slate-700">على الـ{label}</div>
    </div>
  );
}

function ColorDialog({ open, onClose, initial, onSave, saving }: any) {
  const [form, setForm] = useState<any>({ name: "", hex: "#D4A574", description: "", usage: "", sortOrder: 0 });
  useEffect(() => { if (open) setForm(initial || { name: "", hex: "#D4A574", description: "", usage: "", sortOrder: 0 }); }, [open, initial]);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>{initial ? "تعديل لون" : "إضافة لون"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>الاسم</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-color-name" /></div>
          <div className="flex gap-2 items-end">
            <div className="flex-1"><Label>كود اللون (HEX)</Label><Input value={form.hex} onChange={e => setForm({ ...form, hex: e.target.value })} data-testid="input-color-hex" /></div>
            <input type="color" value={form.hex} onChange={e => setForm({ ...form, hex: e.target.value })} className="h-10 w-14 border rounded cursor-pointer" />
          </div>
          <div><Label>الاستخدام</Label><Input value={form.usage || ""} onChange={e => setForm({ ...form, usage: e.target.value })} placeholder="Primary, CTA, Background..." /></div>
          <div><Label>وصف</Label><Textarea value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
          <div><Label>ترتيب</Label><Input type="number" value={form.sortOrder || 0} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => onSave(form)} disabled={saving || !form.name || !form.hex} data-testid="btn-save-color" className="bg-violet-600 hover:bg-violet-700">
            {saving && <Loader2 className="w-4 h-4 animate-spin ml-2" />} حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FontDialog({ open, onClose, initial, onSave, saving }: any) {
  const [form, setForm] = useState<any>({ name: "", family: "", language: "ar", weights: "", downloadUrl: "", notes: "", sortOrder: 0 });
  useEffect(() => { if (open) setForm(initial || { name: "", family: "", language: "ar", weights: "", downloadUrl: "", notes: "", sortOrder: 0 }); }, [open, initial]);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>{initial ? "تعديل خط" : "إضافة خط"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>اسم الخط</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>عائلة CSS (font-family)</Label><Input value={form.family} onChange={e => setForm({ ...form, family: e.target.value })} placeholder="Cairo, sans-serif" /></div>
          <div>
            <Label>اللغة</Label>
            <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ar">عربي</SelectItem>
                <SelectItem value="en">إنجليزي</SelectItem>
                <SelectItem value="both">عربي وإنجليزي</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>الأوزان (مفصولة بفواصل)</Label><Input value={form.weights || ""} onChange={e => setForm({ ...form, weights: e.target.value })} placeholder="400,600,700" /></div>
          <div><Label>رابط التحميل</Label><Input value={form.downloadUrl || ""} onChange={e => setForm({ ...form, downloadUrl: e.target.value })} placeholder="https://..." /></div>
          <div><Label>ملاحظات</Label><Textarea value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          <div><Label>ترتيب</Label><Input type="number" value={form.sortOrder || 0} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => onSave(form)} disabled={saving || !form.name || !form.family} data-testid="btn-save-font" className="bg-violet-600 hover:bg-violet-700">
            {saving && <Loader2 className="w-4 h-4 animate-spin ml-2" />} حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== حملات التصميم ============================== */
const CAMPAIGN_COLORS = ["#D4A574", "#E8833A", "#5C3A21", "#7C3AED", "#0EA5E9", "#10B981", "#EF4444", "#F59E0B", "#EC4899", "#6366F1"];

function CampaignsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MediaCampaign | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const params = new URLSearchParams(); if (statusFilter) params.set("status", statusFilter);
  const { data: campaigns = [], isLoading } = useQuery<MediaCampaign[]>({
    queryKey: ["/api/media/campaigns", statusFilter],
    queryFn: async () => { const r = await fetch(`/api/media/campaigns?${params}`); return r.json(); },
  });

  const save = useMutation({
    mutationFn: async (body: any) => {
      const r = await apiRequest(editing ? "PATCH" : "POST", editing ? `/api/media/campaigns/${editing.id}` : "/api/media/campaigns", body);
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/media/campaigns"] }); setCreateOpen(false); setEditing(null); toast({ title: "تم الحفظ" }); },
    onError: (e: any) => toast({ title: "فشل", description: e.message, variant: "destructive" }),
  });
  const del = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/media/campaigns/${id}`); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/media/campaigns"] }); toast({ title: "تم حذف الحملة" }); },
  });

  if (openId !== null) {
    return <CampaignDetail id={openId} onBack={() => setOpenId(null)} />;
  }

  const totalAssets = campaigns.reduce((s, c) => s + (Number(c.asset_count) || 0), 0);
  const totalSize = campaigns.reduce((s, c) => s + (Number(c.total_size) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox icon={<FolderOpen className="w-5 h-5" />} label="عدد الحملات" value={campaigns.length} color="amber" />
        <StatBox icon={<Layers className="w-5 h-5" />} label="إجمالي الملفات" value={totalAssets} color="orange" />
        <StatBox icon={<HardDrive className="w-5 h-5" />} label="حجم التخزين" value={formatBytes(totalSize)} color="purple" />
        <StatBox icon={<Sparkles className="w-5 h-5" />} label="نشطة" value={campaigns.filter(c => c.status === "active").length} color="green" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter || "_all"} onValueChange={v => setStatusFilter(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-32 sm:w-40 h-10 sm:h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">كل الحملات</SelectItem>
            <SelectItem value="active">النشطة</SelectItem>
            <SelectItem value="archived">المؤرشفة</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={() => { setEditing(null); setCreateOpen(true); }} className="bg-violet-600 hover:bg-violet-700 h-10 sm:h-9" data-testid="btn-create-campaign">
          <Plus className="w-4 h-4 ml-1" /> <span className="hidden sm:inline">حملة جديدة</span><span className="sm:hidden">جديدة</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>
      ) : campaigns.length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState
          text="لا توجد حملات بعد"
          sub="أنشئ أول حملة لتنظيم كل التصميمات والصور والفيديوهات الخاصة بها في مكان واحد"
          action={<Button onClick={() => setCreateOpen(true)} className="bg-violet-600 hover:bg-violet-700"><Plus className="w-4 h-4 ml-1" /> إنشاء حملة</Button>}
        /></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {campaigns.map(c => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onOpen={() => setOpenId(c.id)}
              onEdit={() => { setEditing(c); setCreateOpen(true); }}
              onDelete={() => { if (confirm(`حذف الحملة "${c.name}"؟ (الملفات لن تُحذف)`)) del.mutate(c.id); }}
            />
          ))}
        </div>
      )}

      <CampaignDialog open={createOpen} onClose={() => { setCreateOpen(false); setEditing(null); }} initial={editing} onSave={(v: any) => save.mutate(v)} saving={save.isPending} />
    </div>
  );
}

function StatBox({ icon, label, value, color }: any) {
  const colors: Record<string, string> = {
    amber: "from-violet-500 to-fuchsia-500",
    orange: "from-orange-500 to-red-500",
    purple: "from-purple-500 to-indigo-500",
    green: "from-emerald-500 to-teal-500",
  };
  return (
    <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition">
      <CardContent className="p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3">
        <div className={`bg-gradient-to-br ${colors[color]} text-white p-2 sm:p-2.5 rounded-lg sm:rounded-xl flex-shrink-0`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs text-slate-500 truncate">{label}</div>
          <div className="text-base sm:text-xl font-bold text-slate-800 truncate">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignCard({ campaign, onOpen, onEdit, onDelete }: { campaign: MediaCampaign; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  const color = campaign.coverColor || "#D4A574";
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 group border-2 border-transparent hover:border-violet-300" data-testid={`campaign-${campaign.id}`}>
      <div
        className="h-24 sm:h-28 relative cursor-pointer flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
        onClick={onOpen}
      >
        <FolderOpen className="w-10 h-10 sm:w-12 sm:h-12 text-white/90 group-hover:scale-110 transition" />
        {campaign.status === "archived" && (
          <Badge className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-slate-700 text-white text-[10px] sm:text-xs">مؤرشفة</Badge>
        )}
        <Badge className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-white/90 text-slate-800 hover:bg-white text-[10px] sm:text-xs">
          {campaign.asset_count || 0} ملف
        </Badge>
      </div>
      <CardContent className="p-3 sm:p-4">
        <h3 className="font-bold text-sm sm:text-base truncate" title={campaign.name}>{campaign.name}</h3>
        {campaign.description && <p className="text-[11px] sm:text-xs text-slate-500 mt-1 line-clamp-2">{campaign.description}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs text-slate-500 mt-2">
          <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> {formatBytes(Number(campaign.total_size) || 0)}</span>
          {campaign.startDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {campaign.startDate}</span>}
        </div>
        <div className="flex gap-1 mt-3">
          <Button size="sm" className="flex-1 bg-violet-600 hover:bg-violet-700 h-9 sm:h-8 text-xs" onClick={onOpen}>
            فتح <ArrowRight className="w-3 h-3 mr-1 rtl:rotate-180" />
          </Button>
          <Button size="sm" variant="outline" className="h-9 sm:h-8 w-9 sm:w-auto sm:px-2 p-0" onClick={onEdit}><Pencil className="w-3.5 h-3.5 sm:w-3 sm:h-3" /></Button>
          <Button size="sm" variant="outline" className="h-9 sm:h-8 w-9 sm:w-auto sm:px-2 p-0 text-red-600 hover:bg-red-50" onClick={onDelete}><Trash2 className="w-3.5 h-3.5 sm:w-3 sm:h-3" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignDialog({ open, onClose, initial, onSave, saving }: any) {
  const [form, setForm] = useState<any>({ name: "", description: "", coverColor: "#D4A574", status: "active", startDate: "", endDate: "" });
  useEffect(() => { if (open) setForm(initial || { name: "", description: "", coverColor: "#D4A574", status: "active", startDate: "", endDate: "" }); }, [open, initial]);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader><DialogTitle className="text-base sm:text-lg">{initial ? "تعديل الحملة" : "إنشاء حملة جديدة"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>اسم الحملة *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="حملة افتتاح فرع الرياض" data-testid="input-campaign-name" /></div>
          <div><Label>وصف الحملة</Label><Textarea value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="نبذة قصيرة عن الحملة..." /></div>
          <div>
            <Label>لون الغلاف</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {CAMPAIGN_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm({ ...form, coverColor: c })}
                  className={`w-8 h-8 rounded-lg border-2 transition ${form.coverColor === c ? "border-slate-900 scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>تاريخ البداية</Label><Input type="date" value={form.startDate || ""} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><Label>تاريخ النهاية</Label><Input type="date" value={form.endDate || ""} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
          <div>
            <Label>الحالة</Label>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">نشطة</SelectItem>
                <SelectItem value="archived">مؤرشفة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => onSave(form)} disabled={saving || !form.name} className="bg-violet-600 hover:bg-violet-700" data-testid="btn-save-campaign">
            {saving && <Loader2 className="w-4 h-4 animate-spin ml-2" />} حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CampaignDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: campaign } = useQuery<MediaCampaign>({
    queryKey: [`/api/media/campaigns/${id}`],
    queryFn: async () => { const r = await fetch(`/api/media/campaigns/${id}`); return r.json(); },
  });
  const [q, setQ] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewing, setPreviewing] = useState<MediaAsset | null>(null);
  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem("media-view-campaign") as ViewMode) || "grid");
  useEffect(() => { localStorage.setItem("media-view-campaign", view); }, [view]);

  const params = new URLSearchParams({ campaignId: String(id) }); if (q.trim()) params.set("q", q.trim());
  const { data: assets = [], isLoading } = useQuery<MediaAsset[]>({
    queryKey: ["/api/media/assets", "campaign", id, q],
    queryFn: async () => { const r = await fetch(`/api/media/assets?${params}`); return r.json(); },
  });

  const delAsset = useMutation({
    mutationFn: async (aid: number) => { await apiRequest("DELETE", `/api/media/assets/${aid}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/media/assets"] });
      qc.invalidateQueries({ queryKey: ["/api/media/campaigns"] });
      toast({ title: "تم الحذف" });
    },
  });

  const color = campaign?.coverColor || "#D4A574";
  const totalSize = assets.reduce((s, a) => s + a.fileSize, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl sm:rounded-2xl p-3 sm:p-5 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
            <Button variant="secondary" size="sm" onClick={onBack} className="bg-white/20 hover:bg-white/30 text-white border-0 h-9 w-9 p-0 flex-shrink-0">
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <FolderOpen className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold truncate">{campaign?.name || "..."}</h2>
                {campaign?.status === "archived" && <Badge className="bg-slate-700 text-[10px] sm:text-xs">مؤرشفة</Badge>}
              </div>
              {campaign?.description && <p className="text-xs sm:text-sm text-white/90 mt-1 max-w-2xl line-clamp-2">{campaign.description}</p>}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] sm:text-xs text-white/80 mt-2">
                <span>{assets.length} ملف</span>
                <span>{formatBytes(totalSize)}</span>
                {campaign?.startDate && <span>من {campaign.startDate}</span>}
                {campaign?.endDate && <span>إلى {campaign.endDate}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 sm:flex-shrink-0">
            {assets.length > 0 && (
              <a href={`/api/media/campaigns/${id}/download-all`} className="flex-1 sm:flex-initial">
                <Button size="sm" variant="secondary" className="w-full sm:w-auto bg-white/20 hover:bg-white/30 text-white border-0 h-9" data-testid="btn-download-zip">
                  <Download className="w-4 h-4 ml-1" /> تنزيل الكل (ZIP)
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-full sm:min-w-[200px] order-1">
          <Search className="absolute right-2 top-2.5 sm:top-3 w-4 h-4 text-slate-400" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث داخل الحملة..." className="pr-8 h-10 sm:h-9" />
        </div>
        <div className="order-2"><ViewModeToggle value={view} onChange={setView} /></div>
        <Button onClick={() => setUploadOpen(true)} className="bg-violet-600 hover:bg-violet-700 h-10 sm:h-9 order-3 flex-1 sm:flex-initial" data-testid="btn-upload-to-campaign">
          <Upload className="w-4 h-4 ml-1" /> رفع للحملة
        </Button>
      </div>

      {/* Gallery */}
      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>
          ) : assets.length === 0 ? (
            <EmptyState
              text="لا توجد ملفات في هذه الحملة بعد"
              sub="ارفع صور، فيديوهات، PDF، أو ملفات تصميم خاصة بالحملة"
              action={<Button onClick={() => setUploadOpen(true)} className="bg-violet-600 hover:bg-violet-700"><Upload className="w-4 h-4 ml-1" /> رفع جديد</Button>}
            />
          ) : (
            <AssetGrid
              assets={assets}
              view={view}
              onView={setPreviewing}
              onEdit={setEditing}
              onDelete={(a) => { if (confirm(`حذف "${a.title}"؟`)) delAsset.mutate(a.id); }}
            />
          )}
        </CardContent>
      </Card>

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        category="campaigns"
        allowVideo
        acceptDesign
        showPlatform
        fixedCampaignId={id}
        onUploaded={() => {
          qc.invalidateQueries({ queryKey: ["/api/media/assets"] });
          qc.invalidateQueries({ queryKey: ["/api/media/campaigns"] });
          setUploadOpen(false);
        }}
      />
      <PreviewDialog asset={previewing} onClose={() => setPreviewing(null)} />
      <EditAssetDialog asset={editing} onClose={() => setEditing(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["/api/media/assets"] }); setEditing(null); }} />
    </div>
  );
}

/* ============================== معرض الأصول العام ============================== */
function AssetGalleryTab({ category, showPlatform }: { category: string; showPlatform?: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState<string>("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewing, setPreviewing] = useState<MediaAsset | null>(null);
  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem(`media-view-${category}`) as ViewMode) || "grid");
  useEffect(() => { localStorage.setItem(`media-view-${category}`, view); }, [view, category]);

  const params = new URLSearchParams({ category });
  if (q.trim()) params.set("q", q.trim());
  if (platform) params.set("platform", platform);

  const { data: assets = [], isLoading } = useQuery<MediaAsset[]>({
    queryKey: ["/api/media/assets", category, q, platform],
    queryFn: async () => { const r = await fetch(`/api/media/assets?${params.toString()}`); return r.json(); },
  });

  const delAsset = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/media/assets/${id}`); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/media/assets"] }); toast({ title: "تم الحذف" }); setPreviewing(null); },
    onError: (e: any) => toast({ title: "فشل الحذف", description: e.message, variant: "destructive" }),
  });

  const totalSize = assets.reduce((s, a) => s + a.fileSize, 0);
  const allowVideo = category === "products" || category === "archive";
  const acceptDesign = category === "templates";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatBox icon={<Layers className="w-5 h-5" />} label="عدد الملفات" value={assets.length} color="amber" />
        <StatBox icon={<HardDrive className="w-5 h-5" />} label="الحجم الكلي" value={formatBytes(totalSize)} color="purple" />
        <StatBox icon={<Sparkles className="w-5 h-5" />} label="الفئة" value={CATEGORY_LABELS[category]} color="orange" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-full sm:min-w-[200px] order-1">
          <Search className="absolute right-2 top-2.5 sm:top-3 w-4 h-4 text-slate-400" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث..." className="pr-8 h-10 sm:h-9" data-testid="input-search-assets" />
        </div>
        {showPlatform && (
          <Select value={platform || "_all"} onValueChange={v => setPlatform(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-36 sm:w-44 h-10 sm:h-9 order-2"><SelectValue placeholder="المنصات" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">كل المنصات</SelectItem>
              {Object.entries(PLATFORM_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="order-3 sm:order-2"><ViewModeToggle value={view} onChange={setView} /></div>
        <Button onClick={() => setUploadOpen(true)} className="bg-violet-600 hover:bg-violet-700 h-10 sm:h-9 order-4 sm:order-3 flex-1 sm:flex-initial" data-testid="btn-upload-asset">
          <Upload className="w-4 h-4 ml-1" /> رفع جديد
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>
          ) : assets.length === 0 ? (
            <EmptyState text={`لا توجد ملفات في "${CATEGORY_LABELS[category]}"`} sub="اضغط رفع جديد لإضافة أول ملف" />
          ) : (
            <AssetGrid
              assets={assets}
              view={view}
              onView={setPreviewing}
              onEdit={setEditing}
              onDelete={(a) => { if (confirm(`حذف "${a.title}"؟`)) delAsset.mutate(a.id); }}
            />
          )}
        </CardContent>
      </Card>

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} category={category} allowVideo={allowVideo} acceptDesign={acceptDesign} showPlatform={!!showPlatform} onUploaded={() => { qc.invalidateQueries({ queryKey: ["/api/media/assets"] }); setUploadOpen(false); }} />
      <PreviewDialog asset={previewing} onClose={() => setPreviewing(null)} />
      <EditAssetDialog asset={editing} onClose={() => setEditing(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["/api/media/assets"] }); setEditing(null); }} />
    </div>
  );
}

function AssetCard({ asset, onView, onEdit, onDelete, large }: { asset: MediaAsset; onView: () => void; onEdit: () => void; onDelete: () => void; large?: boolean }) {
  const isImage = asset.fileType === "image";
  const isVideo = asset.fileType === "video";
  const thumb = `/api/media/assets/${asset.id}/view`;
  const titleSize = large ? "text-sm" : "text-xs";
  const iconSize = large ? "w-16 h-16" : "w-10 h-10";
  return (
    <div className="group border rounded-xl overflow-hidden bg-white hover:shadow-lg hover:border-violet-300 transition-all" data-testid={`asset-${asset.id}`}>
      <div className={`${large ? "aspect-video" : "aspect-square"} bg-slate-100 relative cursor-pointer`} onClick={onView}>
        {isImage ? (
          <img src={thumb} alt={asset.title} className="w-full h-full object-cover" loading="lazy" />
        ) : isVideo ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-white relative">
            <Video className={iconSize} />
            <Badge className="absolute bottom-1 right-1 text-[10px] bg-black/60">فيديو</Badge>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-3 bg-gradient-to-br from-slate-50 to-slate-100">
            <FileText className={`${iconSize} mb-1`} />
            <span className={`${large ? "text-sm" : "text-xs"} uppercase font-bold`}>{asset.fileName.split(".").pop()}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
          <Eye className={large ? "w-8 h-8 text-white" : "w-6 h-6 text-white"} />
        </div>
      </div>
      <div className={large ? "p-3" : "p-2 sm:p-2.5"}>
        <div className={`${titleSize} font-bold truncate`} title={asset.title}>{asset.title}</div>
        {large && asset.description && <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{asset.description}</div>}
        <div className="text-[10px] text-slate-500 flex items-center justify-between mt-0.5 gap-1">
          <span className="truncate">{formatBytes(asset.fileSize)}</span>
          {asset.platform && <Badge variant="outline" className="text-[9px] px-1 py-0 flex-shrink-0">{PLATFORM_LABELS[asset.platform] || asset.platform}</Badge>}
        </div>
        {large && asset.tags && asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">{asset.tags.slice(0, 4).map(t => <Badge key={t} variant="secondary" className="text-[9px] px-1.5 py-0">{t}</Badge>)}</div>
        )}
        <div className="flex gap-1 mt-2">
          <a href={`/api/media/assets/${asset.id}/download`} className="flex-1"><Button size="sm" variant="outline" className="w-full h-8 sm:h-7 text-xs"><Download className="w-3.5 h-3.5 sm:w-3 sm:h-3" /></Button></a>
          <Button size="sm" variant="outline" className="h-8 sm:h-7 w-8 sm:w-auto sm:px-2 p-0" onClick={onEdit}><Pencil className="w-3.5 h-3.5 sm:w-3 sm:h-3" /></Button>
          <Button size="sm" variant="outline" className="h-8 sm:h-7 w-8 sm:w-auto sm:px-2 p-0 text-red-600 hover:bg-red-50" onClick={onDelete}><Trash2 className="w-3.5 h-3.5 sm:w-3 sm:h-3" /></Button>
        </div>
      </div>
    </div>
  );
}

function UploadDialog({ open, onClose, category, allowVideo, acceptDesign, showPlatform, fixedCampaignId, onUploaded }: any) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [meta, setMeta] = useState<any>({ title: "", description: "", tags: "", platform: "", publishDate: "", designer: "" });
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);

  const accept = (() => {
    const t = ["image/*"];
    if (allowVideo) t.push("video/*");
    if (acceptDesign || category === "campaigns") t.push(".psd,.ai,.indd,.pdf,.fig,.sketch,.eps,.zip");
    return t.join(",");
  })();

  const reset = () => { setFiles([]); setMeta({ title: "", description: "", tags: "", platform: "", publishDate: "", designer: "" }); setProgress({}); };

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/media/assets/upload");
          xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(p => ({ ...p, [file.name]: Math.round((e.loaded / e.total) * 100) })); };
          xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error((() => { try { return JSON.parse(xhr.responseText).error; } catch { return xhr.statusText; } })()));
          xhr.onerror = () => reject(new Error("فشل الاتصال"));
          const fd = new FormData();
          fd.append("file", file);
          fd.append("category", category);
          fd.append("title", files.length === 1 ? (meta.title || file.name) : file.name);
          if (meta.description) fd.append("description", meta.description);
          if (meta.tags) fd.append("tags", meta.tags);
          if (meta.platform) fd.append("platform", meta.platform);
          if (meta.publishDate) fd.append("publishDate", meta.publishDate);
          if (meta.designer) fd.append("designer", meta.designer);
          if (fixedCampaignId) fd.append("campaignId", String(fixedCampaignId));
          xhr.send(fd);
        });
      }
      toast({ title: "تم الرفع", description: `${files.length} ملف` });
      reset();
      onUploaded();
    } catch (e: any) {
      toast({ title: "فشل الرفع", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { if (!uploading) { reset(); onClose(); } }}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader><DialogTitle className="text-base sm:text-lg">رفع ملف جديد — {CATEGORY_LABELS[category]}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div
            className="border-2 border-dashed border-violet-300 rounded-xl p-6 text-center cursor-pointer hover:bg-violet-50/50 transition"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => { e.preventDefault(); setFiles(Array.from(e.dataTransfer.files)); }}
            data-testid="upload-dropzone"
          >
            <Upload className="w-10 h-10 text-violet-600 mx-auto mb-2" />
            <p className="text-sm font-semibold">اسحب الملفات هنا أو اضغط للاختيار</p>
            <p className="text-xs text-slate-500 mt-1">
              {category === "campaigns" ? "صور، فيديو، PDF، ملفات تصميم (PSD/AI/PDF/ZIP)" :
                allowVideo ? "صور وفيديوهات" : "صور"}
              {acceptDesign && " وملفات تصميم"} — حتى 200MB لكل ملف
            </p>
            <input ref={fileRef} type="file" accept={accept} multiple className="hidden" onChange={e => setFiles(Array.from(e.target.files || []))} />
          </div>

          {files.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto border rounded p-2 bg-slate-50">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-slate-500 mx-2">{formatBytes(f.size)}</span>
                  {progress[f.name] !== undefined ? <span className="text-violet-600 font-bold">{progress[f.name]}%</span> :
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setFiles(files.filter((_, x) => x !== i))} disabled={uploading}><X className="w-3 h-3" /></Button>}
                </div>
              ))}
            </div>
          )}

          {files.length === 1 && (
            <div><Label>عنوان مخصص (اختياري)</Label><Input value={meta.title} onChange={e => setMeta({ ...meta, title: e.target.value })} /></div>
          )}
          <div><Label>وصف</Label><Textarea value={meta.description} onChange={e => setMeta({ ...meta, description: e.target.value })} rows={2} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>وسوم (مفصولة بفواصل)</Label><Input value={meta.tags} onChange={e => setMeta({ ...meta, tags: e.target.value })} placeholder="حلويات, إفطار" /></div>
            <div><Label>المصمم/المصور</Label><Input value={meta.designer} onChange={e => setMeta({ ...meta, designer: e.target.value })} /></div>
          </div>
          {showPlatform && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>المنصة</Label>
                <Select value={meta.platform || "_none"} onValueChange={v => setMeta({ ...meta, platform: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— بدون —</SelectItem>
                    {Object.entries(PLATFORM_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>تاريخ النشر</Label><Input type="date" value={meta.publishDate} onChange={e => setMeta({ ...meta, publishDate: e.target.value })} /></div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={uploading}>إلغاء</Button>
          <Button onClick={handleUpload} disabled={!files.length || uploading} className="bg-violet-600 hover:bg-violet-700" data-testid="btn-confirm-upload">
            {uploading && <Loader2 className="w-4 h-4 animate-spin ml-2" />} رفع {files.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewDialog({ asset, onClose }: { asset: MediaAsset | null; onClose: () => void }) {
  if (!asset) return null;
  const src = `/api/media/assets/${asset.id}/view`;
  return (
    <Dialog open={!!asset} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-4xl max-h-[95vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader><DialogTitle className="text-sm sm:text-base truncate pr-6">{asset.title}</DialogTitle></DialogHeader>
        <div className="bg-slate-900 rounded-lg flex items-center justify-center min-h-[200px] sm:min-h-[300px] max-h-[60vh] sm:max-h-[70vh] overflow-auto">
          {asset.fileType === "image" ? (
            <img src={src} alt={asset.title} className="max-w-full max-h-[70vh] object-contain" />
          ) : asset.fileType === "video" ? (
            <video src={src} controls className="max-w-full max-h-[70vh]" />
          ) : (
            <div className="text-white p-10 text-center">
              <FileText className="w-16 h-16 mx-auto mb-3" />
              <p className="text-sm">لا يمكن معاينة هذا النوع — اضغط تنزيل</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mt-2">
          <div><strong>الملف:</strong> {asset.fileName}</div>
          <div><strong>الحجم:</strong> {formatBytes(asset.fileSize)}</div>
          <div><strong>النوع:</strong> {asset.mimeType}</div>
          {asset.designer && <div><strong>المصمم:</strong> {asset.designer}</div>}
          {asset.platform && <div><strong>المنصة:</strong> {PLATFORM_LABELS[asset.platform] || asset.platform}</div>}
          {asset.publishDate && <div><strong>تاريخ النشر:</strong> {asset.publishDate}</div>}
        </div>
        {asset.description && <p className="text-sm text-slate-700 mt-2">{asset.description}</p>}
        {asset.tags && asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">{asset.tags.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
        )}
        <DialogFooter>
          <a href={`/api/media/assets/${asset.id}/download`}><Button className="bg-violet-600 hover:bg-violet-700"><Download className="w-4 h-4 ml-1" /> تنزيل</Button></a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAssetDialog({ asset, onClose, onSaved }: { asset: MediaAsset | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (asset) setForm({ title: asset.title, description: asset.description || "", tags: (asset.tags || []).join(","), designer: asset.designer || "", platform: asset.platform || "", publishDate: asset.publishDate || "" }); }, [asset]);
  const m = useMutation({
    mutationFn: async () => { const r = await apiRequest("PATCH", `/api/media/assets/${asset!.id}`, form); return r.json(); },
    onSuccess: () => { toast({ title: "تم الحفظ" }); onSaved(); },
    onError: (e: any) => toast({ title: "فشل", description: e.message, variant: "destructive" }),
  });
  if (!asset || !form) return null;
  return (
    <Dialog open={!!asset} onOpenChange={onClose}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>تعديل بيانات: {asset.fileName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>العنوان</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>الوصف</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
          <div><Label>الوسوم</Label><Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} /></div>
          <div><Label>المصمم/المصور</Label><Input value={form.designer} onChange={e => setForm({ ...form, designer: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>المنصة</Label>
              <Select value={form.platform || "_none"} onValueChange={v => setForm({ ...form, platform: v === "_none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— بدون —</SelectItem>
                  {Object.entries(PLATFORM_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>تاريخ النشر</Label><Input type="date" value={form.publishDate} onChange={e => setForm({ ...form, publishDate: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending} className="bg-violet-600 hover:bg-violet-700">{m.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />} حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
