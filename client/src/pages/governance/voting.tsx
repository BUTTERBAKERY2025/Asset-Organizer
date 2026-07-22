import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  Vote,
  ChevronLeft,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Calendar,
  AlertTriangle,
  Shield,
  Scale,
  FileText,
  History,
  UserCheck,
  Percent,
  Eye,
  Download,
  BarChart3,
  PieChart as PieChartIcon,
  Lock,
  Unlock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Share2,
  Copy,
  MessageCircle,
  Mail,
  ExternalLink,
  MoreVertical,
  Trash2,
  Loader2,
  Edit,
  Archive,
} from "lucide-react";
import type { BoardResolution, ResolutionVote, Shareholder } from "@shared/schema";
import { printBoardResolutionWithSignatures } from "@/lib/board-resolution-print";
import { exportToExcel, exportToCSV, printAsPDF } from "@/lib/export-utils";

const voteOptions = [
  { value: "for", label: "موافق", icon: ThumbsUp, color: "text-green-600 bg-green-100", chartColor: "#22c55e" },
  { value: "against", label: "رافض", icon: ThumbsDown, color: "text-red-600 bg-red-100", chartColor: "#ef4444" },
  { value: "abstain", label: "ممتنع", icon: Minus, color: "text-gray-600 bg-gray-100", chartColor: "#6b7280" },
];

interface VotingStats {
  totalEligibleShares: number;
  totalEligibleVotes: number;
  presentShares: number;
  proxyShares: number;
  quorumPercentage: number;
  quorumMet: boolean;
  requiredQuorum: number;
}

interface AuditLogEntry {
  id: number;
  action: string;
  actorName: string;
  actorType: string;
  timestamp: string;
  newValue: string;
  ipAddress: string;
  votingPower: number;
}

interface VotingTokenData {
  id: number;
  voteToken: string;
  shareholderId: number;
  shareholderName: string;
  shareholderEmail?: string;
  shareholderPhone?: string;
  numberOfShares: number;
  status: string;
  expiresAt?: string;
  vote?: string;
  votedAt?: string;
  signatureData?: string;
  comments?: string;
}

export default function VotingPage() {
  const [selectedResolution, setSelectedResolution] = useState<BoardResolution | null>(null);
  const [selectedVote, setSelectedVote] = useState<string>("");
  const [voteComment, setVoteComment] = useState("");
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showQuorumDetails, setShowQuorumDetails] = useState(false);
  const [showVotingLinks, setShowVotingLinks] = useState(false);
  const [votingTokens, setVotingTokens] = useState<VotingTokenData[]>([]);
  const [selectedResolutionForLinks, setSelectedResolutionForLinks] = useState<BoardResolution | null>(null);
  const [isProxyVote, setIsProxyVote] = useState(false);
  const [proxyHolderName, setProxyHolderName] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const [expandedResolution, setExpandedResolution] = useState<number | null>(null);
  const [deleteResolutionId, setDeleteResolutionId] = useState<number | null>(null);
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data: resolutions = [], isLoading } = useQuery<BoardResolution[]>({
    queryKey: ["/api/governance/resolutions"],
  });

  const { data: shareholders = [] } = useQuery<Shareholder[]>({
    queryKey: ["/api/governance/shareholders"],
  });

  // جلب سجل التدقيق
  interface AuditLogEntry {
    id: number;
    action: string;
    entityId: string;
    entityName: string | null;
    details: string | null;
    userName: string | null;
    ipAddress: string | null;
    createdAt: string;
  }
  
  const { data: auditLogs = [], refetch: refetchAuditLogs } = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/governance/voting-audit-log"],
    enabled: showAuditLog,
    staleTime: 15000,
    refetchOnMount: true,
  });

  const votingResolutions = resolutions.filter(r => r.status === 'voting');
  const preVotingResolutions = resolutions.filter(r => r.status === 'proposed');
  const completedVotes = resolutions.filter(r => r.status === 'approved' || r.status === 'rejected');

  const totalShares = shareholders.reduce((sum, s) => sum + (s.numberOfShares || 0), 0);
  const totalVotingShares = shareholders.filter(s => s.votingRights).reduce((sum, s) => sum + (s.numberOfShares || 0), 0);

  // حساب نصاب الانعقاد والأغلبية المطلوبة حسب نظام الشركات السعودي 1443هـ
  // Saudi Companies Law quorum and majority calculation
  const calculateQuorum = (resolution: BoardResolution): VotingStats => {
    const presentShares = (resolution.forVotes || 0) + (resolution.againstVotes || 0) + (resolution.abstainVotes || 0);
    const proxyShares = 0;
    const totalRepresented = presentShares + proxyShares;
    const quorumPercentage = totalVotingShares > 0 ? (totalRepresented / totalVotingShares) * 100 : 0;
    
    // نصاب الانعقاد الافتراضي 50% (الاجتماع الأول)
    // يمكن تعديله حسب نوع القرار في المستقبل
    const requiredQuorum = 50;

    return {
      totalEligibleShares: totalShares,
      totalEligibleVotes: totalVotingShares,
      presentShares,
      proxyShares,
      quorumPercentage,
      quorumMet: quorumPercentage >= requiredQuorum,
      requiredQuorum,
    };
  };
  
  const voteMutation = useMutation({
    mutationFn: async (data: { resolutionId: number; vote: string; comments?: string; isProxy?: boolean; proxyHolderName?: string }) => {
      const res = await fetch("/api/governance/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolutionId: data.resolutionId,
          voterType: "shareholder",
          voterName: data.isProxy ? data.proxyHolderName : "المستخدم الحالي",
          vote: data.vote,
          comments: data.comments,
          voteMethod: data.isProxy ? "proxy" : "electronic",
          ipAddress: "client",
        }),
      });
      if (!res.ok) throw new Error("Failed to submit vote");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions"] });
      setSelectedResolution(null);
      setSelectedVote("");
      setVoteComment("");
      setIsProxyVote(false);
      setProxyHolderName("");
      toast({ title: "تم تسجيل تصويتك بنجاح", description: "تم إضافة صوتك إلى سجل التدقيق" });
    },
    onError: () => {
      toast({ title: "فشل في تسجيل التصويت", variant: "destructive" });
    },
  });

  const createVotingTokensMutation = useMutation({
    mutationFn: async (resolutionId: number) => {
      const res = await fetch(`/api/governance/resolutions/${resolutionId}/voting-tokens/create-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInDays: 7 }),
      });
      if (!res.ok) throw new Error("Failed to create voting tokens");
      return res.json();
    },
    onSuccess: (data) => {
      setVotingTokens(data.tokens || []);
      toast({ title: "تم إنشاء روابط التصويت", description: data.message });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء روابط التصويت", variant: "destructive" });
    },
  });

  const reopenVoterMutation = useMutation({
    mutationFn: async ({ resolutionId, tokenId }: { resolutionId: number; tokenId: number }) => {
      const res = await fetch(`/api/governance/resolutions/${resolutionId}/voting-tokens/${tokenId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ expiresInDays: 7 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "فشل في إعادة فتح التصويت");
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      // Update the in-dialog token list with the new (pending) token + link.
      setVotingTokens((prev) =>
        prev.map((t) =>
          t.id === variables.tokenId
            ? { ...t, voteToken: data.voteToken, status: "pending", vote: null, votedAt: null }
            : t
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions"] });
      toast({ title: "تم إنشاء رابط تصويت جديد", description: "أرسل الرابط للمصوّت ليصوّت من جديد — آخر تصويت هو المعتمد." });
    },
    onError: (error: Error) => {
      toast({ title: "تعذر إعادة فتح التصويت", description: error.message, variant: "destructive" });
    },
  });

  const deleteResolutionMutation = useMutation({
    mutationFn: async (resolutionId: number) => {
      const res = await fetch(`/api/governance/resolutions/${resolutionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل في حذف القرار");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions"] });
      toast({ title: "تم حذف القرار بنجاح" });
      setDeleteResolutionId(null);
    },
    onError: (error: Error) => {
      toast({ title: "فشل في حذف القرار", description: error.message, variant: "destructive" });
    },
  });

  const openVotingLinksDialog = (resolution: BoardResolution) => {
    if ((resolution as any).isLocked) {
      toast({ title: "القرار مقفل نهائياً", description: "لا يمكن إنشاء روابط تصويت جديدة", variant: "destructive" });
      return;
    }
    setSelectedResolutionForLinks(resolution);
    setShowVotingLinks(true);
    createVotingTokensMutation.mutate(resolution.id);
  };

  const getVotingLink = (token: string) => {
    return `${window.location.origin}/vote-resolution.html#token=${token}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "تم نسخ الرابط" });
    } catch {
      toast({ title: "فشل في نسخ الرابط", variant: "destructive" });
    }
  };

  const shareViaWhatsApp = (token: VotingTokenData, resolutionTitle: string) => {
    const link = getVotingLink(token.voteToken);
    const message = `مرحباً ${token.shareholderName}،\n\nأنت مدعو للتصويت على قرار مجلس الإدارة:\n${resolutionTitle}\n\nرابط التصويت:\n${link}\n\nشكراً لك.`;
    window.open(`https://wa.me/${token.shareholderPhone?.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`);
  };

  const shareViaEmail = (token: VotingTokenData, resolutionTitle: string) => {
    const link = getVotingLink(token.voteToken);
    const subject = `دعوة للتصويت على قرار مجلس الإدارة - ${resolutionTitle}`;
    const body = `مرحباً ${token.shareholderName}،\n\nأنت مدعو للتصويت على قرار مجلس الإدارة:\n${resolutionTitle}\n\nرابط التصويت:\n${link}\n\nشكراً لك.\n\nشركة الزبد الأفضل التجارية`;
    window.open(`mailto:${token.shareholderEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleSubmitVote = () => {
    if (!selectedResolution || !selectedVote) return;
    if ((selectedResolution as any).isLocked) {
      toast({ title: "القرار مقفل نهائياً", description: "لا يمكن التصويت على قرار مقفل", variant: "destructive" });
      return;
    }
    if (isProxyVote && !proxyHolderName) {
      toast({ title: "يرجى إدخال اسم حامل الوكالة", variant: "destructive" });
      return;
    }
    voteMutation.mutate({
      resolutionId: selectedResolution.id,
      vote: selectedVote,
      comments: voteComment,
      isProxy: isProxyVote,
      proxyHolderName,
    });
  };

  const getVotePercentage = (res: BoardResolution) => {
    const total = (res.forVotes || 0) + (res.againstVotes || 0) + (res.abstainVotes || 0);
    if (total === 0) return 0;
    return ((res.forVotes || 0) / total) * 100;
  };

  const getWeightedResults = (res: BoardResolution) => {
    const forWeight = Number(res.forVotes) || 0;
    const againstWeight = Number(res.againstVotes) || 0;
    const abstainWeight = Number(res.abstainVotes) || 0;
    const total = forWeight + againstWeight + abstainWeight;
    
    return {
      for: { count: forWeight, percentage: total > 0 ? (forWeight / total) * 100 : 0 },
      against: { count: againstWeight, percentage: total > 0 ? (againstWeight / total) * 100 : 0 },
      abstain: { count: abstainWeight, percentage: total > 0 ? (abstainWeight / total) * 100 : 0 },
      total,
    };
  };

  const getRemainingTime = (deadline: Date | string | null) => {
    if (!deadline) return null;
    const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
    const diff = deadlineDate.getTime() - new Date().getTime();
    if (diff <= 0) return "انتهى";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} يوم`;
    return `${hours} ساعة`;
  };

  const getPieChartData = (res: BoardResolution) => {
    const results = getWeightedResults(res);
    return [
      { name: "موافق", value: results.for.count, color: "#22c55e" },
      { name: "رافض", value: results.against.count, color: "#ef4444" },
      { name: "ممتنع", value: results.abstain.count, color: "#6b7280" },
    ].filter(d => d.value > 0);
  };

  return (
    <Layout>
      <div className="page-container space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/governance">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-2 sm:p-3 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl">
              <Vote className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-pink-800" data-testid="page-title">
                التصويت الإلكتروني المتقدم
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">تصويت مرجح - وكالات - سجل تدقيق كامل</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 text-xs sm:text-sm">
                  <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">تصدير</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  const exportColumns = [
                    { key: "resolutionNumber", header: "رقم القرار", width: 15 },
                    { key: "title", header: "العنوان", width: 30 },
                    { key: "forVotes", header: "موافق", width: 12 },
                    { key: "againstVotes", header: "رافض", width: 12 },
                    { key: "abstainVotes", header: "ممتنع", width: 12 },
                    { key: "totalVotes", header: "الإجمالي", width: 12 },
                    { key: "status", header: "الحالة", width: 12 },
                  ];
                  exportToExcel(votingResolutions, exportColumns, "نتائج_التصويت", "التصويت");
                }}>
                  Excel تصدير
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const exportColumns = [
                    { key: "resolutionNumber", header: "رقم القرار", width: 15 },
                    { key: "title", header: "العنوان", width: 30 },
                    { key: "forVotes", header: "موافق", width: 12 },
                    { key: "againstVotes", header: "رافض", width: 12 },
                    { key: "abstainVotes", header: "ممتنع", width: 12 },
                    { key: "totalVotes", header: "الإجمالي", width: 12 },
                    { key: "status", header: "الحالة", width: 12 },
                  ];
                  exportToCSV(votingResolutions, exportColumns, "نتائج_التصويت");
                }}>
                  CSV تصدير
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const exportColumns = [
                    { key: "resolutionNumber", header: "رقم القرار", width: 15 },
                    { key: "title", header: "العنوان", width: 30 },
                    { key: "forVotes", header: "موافق", width: 12 },
                    { key: "againstVotes", header: "رافض", width: 12 },
                    { key: "abstainVotes", header: "ممتنع", width: 12 },
                    { key: "totalVotes", header: "الإجمالي", width: 12 },
                    { key: "status", header: "الحالة", width: 12 },
                  ];
                  printAsPDF(votingResolutions, exportColumns, "نتائج التصويت", "سجل التصويت الإلكتروني");
                }}>
                  طباعة
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" className="gap-2 text-xs sm:text-sm" onClick={() => setShowQuorumDetails(true)}>
              <Scale className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">النصاب</span>
            </Button>
            <Button variant="outline" className="gap-2 text-xs sm:text-sm" onClick={() => { setShowAuditLog(true); refetchAuditLogs(); }}>
              <History className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">سجل التدقيق</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card className="bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-pink-600">قيد التصويت</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-pink-800">{votingResolutions.length}</p>
                </div>
                <Vote className="h-6 w-6 sm:h-8 sm:w-8 text-pink-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-amber-600">تصويت مسبق</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-amber-800">{preVotingResolutions.length}</p>
                </div>
                <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-green-600">معتمدة</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-800">
                    {resolutions.filter(r => r.status === 'approved').length}
                  </p>
                </div>
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-red-600">مرفوضة</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-red-800">
                    {resolutions.filter(r => r.status === 'rejected').length}
                  </p>
                </div>
                <XCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 col-span-2 lg:col-span-1">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-blue-600">إجمالي الأسهم</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800">{totalShares.toLocaleString()}</p>
                </div>
                <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full sm:grid sm:max-w-lg sm:grid-cols-3 text-xs sm:text-sm">
            <TabsTrigger value="active" className="gap-1 sm:gap-2 px-1 sm:px-3">
              <Vote className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">جارية</span> ({votingResolutions.length})
            </TabsTrigger>
            <TabsTrigger value="pre" className="gap-1 sm:gap-2 px-1 sm:px-3">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">مسبقة</span> ({preVotingResolutions.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-1 sm:gap-2 px-1 sm:px-3">
              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">مكتملة</span> ({completedVotes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {votingResolutions.length > 0 ? (
              <div className="grid gap-4">
                {votingResolutions.map((resolution) => {
                  const remaining = getRemainingTime(resolution.votingDeadline);
                  const quorum = calculateQuorum(resolution);
                  const results = getWeightedResults(resolution);
                  const isExpanded = expandedResolution === resolution.id;
                  const pieData = getPieChartData(resolution);

                  return (
                    <Card key={resolution.id} className="border-2 border-pink-200 hover:shadow-lg transition-shadow" data-testid={`voting-card-${resolution.id}`}>
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {resolution.resolutionNumber}
                                </Badge>
                                <Badge className="bg-yellow-100 text-yellow-800">قيد التصويت</Badge>
                                {remaining && (
                                  <Badge className="bg-orange-100 text-orange-800 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {remaining}
                                  </Badge>
                                )}
                                {quorum.quorumMet ? (
                                  <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    النصاب مكتمل
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    النصاب غير مكتمل
                                  </Badge>
                                )}
                              </div>
                              <h3 className="font-semibold text-lg mb-2">{resolution.title}</h3>
                              <p className="text-sm text-gray-600 line-clamp-2 mb-3">{resolution.description}</p>
                              
                              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                                <div className="flex items-center gap-1">
                                  <Users className="h-4 w-4" />
                                  <span>{results.total} صوت</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Percent className="h-4 w-4" />
                                  <span>النصاب: {quorum.quorumPercentage.toFixed(1)}%</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Scale className="h-4 w-4" />
                                  <span>المطلوب: {quorum.requiredQuorum}%</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button 
                                className="bg-pink-600 hover:bg-pink-700"
                                onClick={() => {
                                  if ((resolution as any).isLocked) {
                                    toast({ title: "القرار مقفل نهائياً", description: "لا يمكن التصويت", variant: "destructive" });
                                    return;
                                  }
                                  setSelectedResolution(resolution);
                                }}
                                disabled={!!(resolution as any).isLocked}
                                title={(resolution as any).isLocked ? "القرار مقفل نهائياً" : ""}
                                data-testid={`vote-btn-${resolution.id}`}
                              >
                                {(resolution as any).isLocked ? <Lock className="h-4 w-4 ml-2" /> : <Vote className="h-4 w-4 ml-2" />}
                                {(resolution as any).isLocked ? "مقفل" : "صوّت الآن"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setExpandedResolution(isExpanded ? null : resolution.id)}
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                                {isExpanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                                onClick={() => openVotingLinksDialog(resolution)}
                                data-testid={`share-voting-links-${resolution.id}`}
                              >
                                <Share2 className="h-4 w-4 ml-1" />
                                مشاركة روابط التصويت
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" data-testid={`actions-btn-${resolution.id}`}>
                                    <MoreVertical className="h-4 w-4 ml-1" />
                                    إجراءات
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => setExpandedResolution(isExpanded ? null : resolution.id)}>
                                    <Eye className="h-4 w-4 ml-2" />
                                    عرض التفاصيل
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openVotingLinksDialog(resolution)}>
                                    <Share2 className="h-4 w-4 ml-2" />
                                    مشاركة الروابط
                                  </DropdownMenuItem>
                                  {isAdmin && !(resolution as any).isLocked && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                        onClick={() => setDeleteResolutionId(resolution.id)}
                                        data-testid={`delete-resolution-${resolution.id}`}
                                      >
                                        <Trash2 className="h-4 w-4 ml-2" />
                                        حذف القرار
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {(resolution as any).isLocked && (
                                    <DropdownMenuItem disabled className="text-amber-700">
                                      <Lock className="h-4 w-4 ml-2" />
                                      مقفل نهائياً
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">نتائج التصويت المرجح</span>
                              <span className="text-sm text-gray-500">{results.total.toLocaleString()} سهم مصوّت</span>
                            </div>
                            <Progress value={results.for.percentage} className="h-4 mb-3" />
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-2 rounded">
                                <ThumbsUp className="h-4 w-4" />
                                <div>
                                  <span className="font-bold">{results.for.count.toLocaleString()}</span>
                                  <span className="text-xs mr-1">({results.for.percentage.toFixed(1)}%)</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded">
                                <ThumbsDown className="h-4 w-4" />
                                <div>
                                  <span className="font-bold">{results.against.count.toLocaleString()}</span>
                                  <span className="text-xs mr-1">({results.against.percentage.toFixed(1)}%)</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-gray-600 bg-gray-100 p-2 rounded">
                                <Minus className="h-4 w-4" />
                                <div>
                                  <span className="font-bold">{results.abstain.count.toLocaleString()}</span>
                                  <span className="text-xs mr-1">({results.abstain.percentage.toFixed(1)}%)</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {isExpanded && pieData.length > 0 && (
                            <div className="bg-white rounded-lg border p-4">
                              <h4 className="font-medium mb-4 flex items-center gap-2">
                                <PieChartIcon className="h-4 w-4 text-pink-600" />
                                توزيع الأصوات
                              </h4>
                              <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={pieData}
                                      cx="50%"
                                      cy="50%"
                                      labelLine={false}
                                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                      outerRadius={80}
                                      fill="#8884d8"
                                      dataKey="value"
                                    >
                                      {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                      ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => value.toLocaleString() + " سهم"} />
                                    <Legend />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  لا يوجد قرارات قيد التصويت حالياً
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="pre" className="mt-6">
            {preVotingResolutions.length > 0 ? (
              <div className="grid gap-4">
                {preVotingResolutions.map((resolution) => (
                  <Card key={resolution.id} className="border border-amber-200 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {resolution.resolutionNumber}
                            </Badge>
                            <Badge className="bg-amber-100 text-amber-800">تصويت مسبق متاح</Badge>
                          </div>
                          <h3 className="font-semibold text-lg mb-2">{resolution.title}</h3>
                          <p className="text-sm text-gray-600">{resolution.description}</p>
                        </div>
                        <Button 
                          variant="outline"
                          className="border-amber-500 text-amber-700 hover:bg-amber-50"
                          onClick={() => {
                            if ((resolution as any).isLocked) {
                              toast({ title: "القرار مقفل نهائياً", description: "لا يمكن التصويت", variant: "destructive" });
                              return;
                            }
                            setSelectedResolution(resolution);
                          }}
                          disabled={!!(resolution as any).isLocked}
                          title={(resolution as any).isLocked ? "القرار مقفل نهائياً" : ""}
                        >
                          {(resolution as any).isLocked ? <Lock className="h-4 w-4 ml-2" /> : <Clock className="h-4 w-4 ml-2" />}
                          {(resolution as any).isLocked ? "مقفل" : "تصويت مسبق"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  لا يوجد قرارات للتصويت المسبق
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            {completedVotes.length > 0 ? (
              <div className="grid gap-4">
                {completedVotes.map((resolution) => {
                  const results = getWeightedResults(resolution);
                  return (
                    <Card key={resolution.id} className="hover:shadow-md transition-shadow" data-testid={`completed-vote-${resolution.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${resolution.status === 'approved' ? 'bg-green-100' : 'bg-red-100'}`}>
                              {resolution.status === 'approved' ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {resolution.resolutionNumber}
                                </Badge>
                                <Badge className={resolution.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                  {resolution.status === 'approved' ? 'معتمد' : 'مرفوض'}
                                </Badge>
                              </div>
                              <p className="font-medium">{resolution.title}</p>
                            </div>
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <div className="text-xl font-bold text-green-600">{results.for.percentage.toFixed(1)}%</div>
                                <div className="text-xs text-gray-500">موافق</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xl font-bold text-red-600">{results.against.percentage.toFixed(1)}%</div>
                                <div className="text-xs text-gray-500">رافض</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm text-gray-600">{results.total.toLocaleString()}</div>
                                <div className="text-xs text-gray-500">إجمالي</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  لا يوجد تصويتات مكتملة
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {isLoading && (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              جاري التحميل...
            </CardContent>
          </Card>
        )}

        <Dialog open={!!selectedResolution} onOpenChange={() => {
          setSelectedResolution(null);
          setSelectedVote("");
          setVoteComment("");
          setIsProxyVote(false);
          setProxyHolderName("");
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Vote className="h-5 w-5 text-pink-600" />
                التصويت على القرار
              </DialogTitle>
            </DialogHeader>
            {selectedResolution && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {selectedResolution.resolutionNumber}
                    </Badge>
                    <Badge className="bg-pink-100 text-pink-800">تصويت مرجح</Badge>
                  </div>
                  <h3 className="font-semibold">{selectedResolution.title}</h3>
                  <p className="text-sm text-gray-600 mt-2">{selectedResolution.description}</p>
                </div>

                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">التصويت بالوكالة</span>
                  </div>
                  <Switch
                    checked={isProxyVote}
                    onCheckedChange={setIsProxyVote}
                  />
                </div>

                {isProxyVote && (
                  <div className="space-y-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <Label htmlFor="proxyHolder">اسم حامل الوكالة *</Label>
                    <Input
                      id="proxyHolder"
                      value={proxyHolderName}
                      onChange={(e) => setProxyHolderName(e.target.value)}
                      placeholder="أدخل اسم حامل الوكالة"
                    />
                  </div>
                )}

                <div className="space-y-3">
                  <Label className="text-base font-medium">اختر تصويتك</Label>
                  <RadioGroup value={selectedVote} onValueChange={setSelectedVote} className="space-y-3">
                    {voteOptions.map((option) => (
                      <div
                        key={option.value}
                        className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedVote === option.value ? 'border-pink-500 bg-pink-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedVote(option.value)}
                      >
                        <RadioGroupItem value={option.value} id={option.value} />
                        <div className={`p-2 rounded-full ${option.color}`}>
                          <option.icon className="h-5 w-5" />
                        </div>
                        <Label htmlFor={option.value} className="text-base cursor-pointer flex-1">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comment">ملاحظات (اختياري)</Label>
                  <Textarea
                    id="comment"
                    value={voteComment}
                    onChange={(e) => setVoteComment(e.target.value)}
                    placeholder="أضف ملاحظاتك هنا..."
                  />
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                  <Shield className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800">
                    <p className="font-medium">تصويت آمن ومُدقق</p>
                    <p className="text-xs mt-1">سيتم تسجيل تصويتك مع بيانات التدقيق الكاملة (IP، الوقت، التوقيع)</p>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800">
                    تصويتك نهائي ولا يمكن تغييره بعد الإرسال.
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedResolution(null)}>إلغاء</Button>
              <Button 
                className="bg-pink-600 hover:bg-pink-700"
                onClick={handleSubmitVote}
                disabled={!selectedVote || voteMutation.isPending || (isProxyVote && !proxyHolderName)}
              >
                <Lock className="h-4 w-4 ml-2" />
                تأكيد التصويت
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showQuorumDetails} onOpenChange={setShowQuorumDetails}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-pink-600" />
                تفاصيل النصاب القانوني - نظام الشركات السعودي
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-blue-600">إجمالي الأسهم</p>
                    <p className="text-xl font-bold text-blue-800">{totalShares.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-green-600">أسهم لها حق التصويت</p>
                    <p className="text-xl font-bold text-green-800">{totalVotingShares.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-purple-600">عدد المساهمين</p>
                    <p className="text-xl font-bold text-purple-800">{shareholders.length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-amber-600">مساهمين لهم حق التصويت</p>
                    <p className="text-xl font-bold text-amber-800">{shareholders.filter(s => s.votingRights).length}</p>
                  </CardContent>
                </Card>
              </div>
              
              {/* جدول النسب القانونية حسب نظام الشركات السعودي 1443هـ */}
              <Card className="border-2 border-pink-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-pink-600" />
                    النسب القانونية حسب نظام الشركات السعودي 1443هـ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-pink-50">
                        <TableHead className="text-right font-bold">نوع الجمعية</TableHead>
                        <TableHead className="text-center font-bold">نصاب الاجتماع الأول</TableHead>
                        <TableHead className="text-center font-bold">نصاب الاجتماع الثاني</TableHead>
                        <TableHead className="text-center font-bold">الأغلبية المطلوبة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium text-right">
                          <Badge className="bg-blue-100 text-blue-800">الجمعية العامة العادية</Badge>
                        </TableCell>
                        <TableCell className="text-center">50% من رأس المال</TableCell>
                        <TableCell className="text-center text-green-600 font-medium">أي نسبة حضور</TableCell>
                        <TableCell className="text-center">50% + 1 (الأغلبية المطلقة)</TableCell>
                      </TableRow>
                      <TableRow className="bg-amber-50/50">
                        <TableCell className="font-medium text-right">
                          <Badge className="bg-amber-100 text-amber-800">الجمعية غير العادية (عادي)</Badge>
                        </TableCell>
                        <TableCell className="text-center">50% من رأس المال</TableCell>
                        <TableCell className="text-center">25% من رأس المال</TableCell>
                        <TableCell className="text-center font-medium text-amber-700">⅔ (66.67%)</TableCell>
                      </TableRow>
                      <TableRow className="bg-red-50/50">
                        <TableCell className="font-medium text-right">
                          <Badge className="bg-red-100 text-red-800">الجمعية غير العادية (جوهري)</Badge>
                        </TableCell>
                        <TableCell className="text-center">50% من رأس المال</TableCell>
                        <TableCell className="text-center">25% من رأس المال</TableCell>
                        <TableCell className="text-center font-medium text-red-700">¾ (75%)</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                    <p className="font-medium mb-1">القرارات الجوهرية تشمل:</p>
                    <p>زيادة رأس المال • تخفيض رأس المال • إطالة مدة الشركة • حل الشركة • الاندماج مع شركة أخرى</p>
                  </div>
                </CardContent>
              </Card>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-3">توزيع الملكية (أكبر 10 مساهمين)</h4>
                {shareholders.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={shareholders.slice(0, 10).map(s => ({ name: s.fullName.slice(0, 20), shares: s.numberOfShares }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={10} />
                        <YAxis />
                        <Tooltip formatter={(value: number) => value.toLocaleString()} />
                        <Bar dataKey="shares" fill="#ec4899" name="عدد الأسهم" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-4">لا يوجد بيانات مساهمين</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowQuorumDetails(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showAuditLog} onOpenChange={setShowAuditLog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-pink-600" />
                سجل تدقيق التصويت
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                <Shield className="h-5 w-5 text-green-600" />
                <span>جميع عمليات التصويت مسجلة ومُؤمّنة ولا يمكن التلاعب بها</span>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الوقت</TableHead>
                    <TableHead className="text-right">الإجراء</TableHead>
                    <TableHead className="text-right">المُستخدم</TableHead>
                    <TableHead className="text-right">التفاصيل</TableHead>
                    <TableHead className="text-right">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => {
                      let details: { vote?: string; voteMethod?: string; votingPower?: number } = {};
                      try {
                        if (log.details) details = JSON.parse(log.details);
                      } catch {}
                      const actionLabels: Record<string, string> = {
                        vote_submitted: 'تم التصويت',
                        resolution_created: 'إنشاء قرار',
                        resolution_updated: 'تحديث قرار',
                        meeting_created: 'إنشاء اجتماع',
                      };
                      const voteLabels: Record<string, string> = {
                        for: 'موافق',
                        against: 'رافض',
                        abstain: 'ممتنع',
                      };
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">
                            {new Date(log.createdAt).toLocaleDateString('ar-SA-u-nu-latn')}
                            <br />
                            <span className="text-xs text-gray-500">
                              {new Date(log.createdAt).toLocaleTimeString('ar-SA-u-nu-latn')}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {actionLabels[log.action] || log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>{log.userName || '-'}</TableCell>
                          <TableCell className="text-sm">
                            {details.vote && (
                              <Badge className={
                                details.vote === 'for' ? 'bg-green-100 text-green-800' :
                                details.vote === 'against' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }>
                                {voteLabels[details.vote] || details.vote}
                              </Badge>
                            )}
                            {details.votingPower && (
                              <span className="mr-2 text-gray-600">
                                ({details.votingPower?.toLocaleString?.()} سهم)
                              </span>
                            )}
                            {log.entityName && !details.vote && (
                              <span>{log.entityName}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500 font-mono">
                            {log.ipAddress || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        لا توجد سجلات تدقيق حالياً
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="flex justify-end">
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  تصدير السجل
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAuditLog(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showVotingLinks} onOpenChange={setShowVotingLinks}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-blue-600" />
                مشاركة روابط التصويت
              </DialogTitle>
            </DialogHeader>
            
            {selectedResolutionForLinks && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">
                    {selectedResolutionForLinks.resolutionNumber} - {selectedResolutionForLinks.title}
                  </h4>
                  <p className="text-sm text-blue-600">
                    يمكنك مشاركة روابط التصويت مع المساهمين عبر الواتساب أو البريد الإلكتروني
                  </p>
                  {/* Vote counts summary */}
                  <div className="flex gap-4 mt-3 pt-3 border-t border-blue-200">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 text-sm">إجمالي المساهمين:</span>
                      <Badge variant="outline" className="bg-white">{votingTokens.length}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 text-sm">تم التصويت:</span>
                      <Badge className="bg-green-100 text-green-800">{votingTokens.filter(t => t.status === 'voted').length}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-600 text-sm">في الانتظار:</span>
                      <Badge className="bg-yellow-100 text-yellow-800">{votingTokens.filter(t => t.status === 'pending').length}</Badge>
                    </div>
                  </div>
                </div>

                {createVotingTokensMutation.isPending ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="mr-2">جاري إنشاء روابط التصويت...</span>
                  </div>
                ) : votingTokens.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{(votingTokens[0] as any)?.voterType === 'board_member' ? 'عضو مجلس الإدارة' : 'المساهم'}</TableHead>
                        <TableHead>{(votingTokens[0] as any)?.voterType === 'board_member' ? 'الصفة' : 'الأسهم'}</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الرابط</TableHead>
                        <TableHead>الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {votingTokens.map((token) => (
                        <TableRow key={token.id}>
                          <TableCell className="font-medium">{token.shareholderName}</TableCell>
                          <TableCell>{(token as any).voterType === 'board_member' ? 'عضو مجلس' : token.numberOfShares?.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={token.status === 'voted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                              {token.status === 'voted' ? 'تم التصويت' : 'في انتظار التصويت'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Input
                                value={getVotingLink(token.voteToken)}
                                readOnly
                                className="text-xs w-48"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(getVotingLink(token.voteToken))}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {token.status === 'voted' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                                  disabled={reopenVoterMutation.isPending}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `سيتم إلغاء التصويت السابق لـ ${token.shareholderName} وإنشاء رابط جديد ليصوّت من جديد على نفس القرار. آخر تصويت هو المعتمد. متابعة؟`
                                      )
                                    ) {
                                      reopenVoterMutation.mutate({
                                        resolutionId: selectedResolutionForLinks.id,
                                        tokenId: token.id,
                                      });
                                    }
                                  }}
                                  data-testid={`button-revote-${token.id}`}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                  إعادة التصويت
                                </Button>
                              )}
                              {token.shareholderPhone && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 text-green-600 border-green-300 hover:bg-green-50"
                                  onClick={() => shareViaWhatsApp(token, selectedResolutionForLinks.title || '')}
                                >
                                  <MessageCircle className="h-4 w-4" />
                                  واتساب
                                </Button>
                              )}
                              {token.shareholderEmail && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 text-blue-600 border-blue-300 hover:bg-blue-50"
                                  onClick={() => shareViaEmail(token, selectedResolutionForLinks.title || '')}
                                >
                                  <Mail className="h-4 w-4" />
                                  بريد
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(getVotingLink(token.voteToken), '_blank')}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>لا يوجد مساهمين لهم حق التصويت</p>
                  </div>
                )}

                {/* Print Resolution with Signatures Button - always show if there are votes */}
                <div className="mt-4 pt-4 border-t flex gap-3">
                  <Button 
                    className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700"
                    onClick={() => printBoardResolutionWithSignatures(selectedResolutionForLinks!, votingTokens)}
                    disabled={!votingTokens.some(t => t.status === 'voted')}
                  >
                    <FileText className="h-4 w-4" />
                    طباعة القرار الرسمي
                    {votingTokens.filter(t => t.status === 'voted').length > 0 && (
                      <Badge className="bg-white text-amber-700 mr-2">
                        {votingTokens.filter(t => t.status === 'voted').length} تصويت
                      </Badge>
                    )}
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowVotingLinks(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <AlertDialog open={deleteResolutionId !== null} onOpenChange={(open) => !open && setDeleteResolutionId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف القرار</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا القرار؟ سيتم حذف جميع بيانات التصويت والتوقيعات المرتبطة به نهائياً. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!deleteResolutionId) return;
                const target = resolutions.find((r: any) => r.id === deleteResolutionId) as any;
                if (target?.isLocked) {
                  toast({ title: "القرار مقفل ولا يمكن حذفه", variant: "destructive" });
                  setDeleteResolutionId(null);
                  return;
                }
                deleteResolutionMutation.mutate(deleteResolutionId);
              }}
              disabled={deleteResolutionMutation.isPending}
            >
              {deleteResolutionMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 ml-2" />
                  حذف القرار
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
