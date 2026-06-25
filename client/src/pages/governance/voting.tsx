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
import companyStampSvg from "@assets/company-stamp.svg?raw";
import officialLetterhead from "@assets/official-letterhead.png?inline";
import type { BoardResolution, ResolutionVote, Shareholder } from "@shared/schema";
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
  
  // حساب الأغلبية المطلوبة للموافقة حسب نظام الشركات السعودي 1443هـ
  // Required majority for approval based on Saudi Companies Law
  // نستخدم requiredMajority المحفوظ في القرار أو نحسبه حسب نوع القرار
  const getRequiredMajority = (resolution: BoardResolution): { percentage: number; label: string } => {
    // إذا كان هناك قيمة محددة مسبقاً في القرار، نستخدمها
    const savedMajority = Number(resolution.requiredMajority);
    
    // تحديد النوع والنسبة بناءً على نوع القرار
    const isExtraordinary = resolution.resolutionType === 'extraordinary' || resolution.resolutionType === 'extraordinary_assembly';
    
    if (isExtraordinary) {
      // للقرارات غير العادية: نتحقق إذا كانت النسبة المحددة 75% (قرار جوهري)
      if (savedMajority >= 75) {
        return { percentage: 75, label: '¾ الأسهم (قرار جوهري)' };
      }
      // القرارات غير العادية العادية: 66.67% (2/3)
      return { percentage: savedMajority >= 66 ? savedMajority : 66.67, label: '⅔ الأسهم' };
    }
    
    // الجمعية العادية: الأغلبية المطلقة (50%+1)
    return { percentage: savedMajority > 50 ? savedMajority : 50.01, label: 'الأغلبية المطلقة (50%+1)' };
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

  const computeHijriDate = (date: Date): string => {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(date);
    const day = parts.find(p => p.type === 'day')?.value || '1';
    const month = parts.find(p => p.type === 'month')?.value || '1';
    const year = parts.find(p => p.type === 'year')?.value || '1447';
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  };

  const printResolutionWithSignatures = (resolution: BoardResolution, tokens: VotingTokenData[]) => {
    const votedTokens = tokens.filter(t => t.status === 'voted');
    const voteLabels: Record<string, string> = { for: 'موافق', against: 'رافض', abstain: 'ممتنع' };
    
    const docDate = (() => {
      const times = votedTokens
        .map(t => (t.votedAt ? new Date(t.votedAt).getTime() : 0))
        .filter(n => n > 0);
      return times.length ? new Date(Math.max(...times)) : new Date();
    })();
    const hijriDateStr = computeHijriDate(docDate);
    const gregDateStr = docDate.toLocaleDateString('en-GB');
    
    const fixHijriInText = (text: string): string => {
      if (!text) return text;
      const gregorianMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})م/);
      if (gregorianMatch) {
        const gDay = parseInt(gregorianMatch[1]);
        const gMonth = parseInt(gregorianMatch[2]);
        const gYear = parseInt(gregorianMatch[3]);
        const refDate = new Date(gYear, gMonth - 1, gDay);
        if (!isNaN(refDate.getTime())) {
          const correctHijri = computeHijriDate(refDate);
          return text.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})هـ/g, correctHijri + 'هـ');
        }
      }
      return text.replace(
        /(\d{1,2})\/(\d{1,2})\/(\d{4})هـ/g,
        (match) => {
          const correctHijri = computeHijriDate(new Date());
          return correctHijri + 'هـ';
        }
      );
    };
    
    const sanitize = (text: string | undefined | null): string => {
      if (!text) return '';
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };
    
    // Validate signature data format (must be data:image/ URI)
    const isValidSignature = (data: string | undefined | null): boolean => {
      if (!data) return false;
      return data.startsWith('data:image/png') || data.startsWith('data:image/jpeg');
    };
    
    // Calculate vote summary
    const forVotes = votedTokens.filter(t => t.vote === 'for').length;
    const againstVotes = votedTokens.filter(t => t.vote === 'against').length;
    const abstainVotes = votedTokens.filter(t => t.vote === 'abstain').length;
    const totalSharesVoted = votedTokens.reduce((sum, t) => sum + (t.numberOfShares || 0), 0);
    const forShares = votedTokens.filter(t => t.vote === 'for').reduce((sum, t) => sum + (t.numberOfShares || 0), 0);
    const approvalPercentage = totalSharesVoted > 0 ? ((forShares / totalSharesVoted) * 100).toFixed(2) : '0';
    
    // حساب الأغلبية المطلوبة حسب نظام الشركات السعودي 1443هـ
    const requiredMajorityInfo = getRequiredMajority(resolution);
    const isApproved = Number(approvalPercentage) >= requiredMajorityInfo.percentage;

    // توقيع رئيس مجلس الإدارة (عبدالحافظ احمد إبراهيم ال مكوش) — يُؤخذ من توقيعه الإلكتروني
    const normalizeAr = (s: string | undefined | null) =>
      (s || '').replace(/[إأآا]/g, 'ا').replace(/\s+/g, ' ').trim();
    const chairmanToken = votedTokens.find(t => {
      const n = normalizeAr(t.shareholderName);
      return n.startsWith('عبدالحافظ') && n.includes('مكوش');
    });
    const chairmanSig = isValidSignature(chairmanToken?.signatureData) ? chairmanToken!.signatureData : '';
    const chairmanName = chairmanToken?.shareholderName || 'عبدالحافظ احمد إبراهيم ال مكوش';

    const docTitle =
      (resolution.resolutionType === 'extraordinary' || resolution.resolutionType === 'extraordinary_assembly')
        ? 'محضر قرار الجمعية العمومية غير العادية'
        : (resolution.resolutionType === 'general_assembly' || resolution.resolutionType === 'ordinary_assembly')
          ? 'محضر قرار الجمعية العمومية العادية'
          : 'محضر قرار مجلس الإدارة';

    const typeLabel =
      (resolution.resolutionType === 'ordinary' || resolution.resolutionType === 'regular') ? 'قرار عادي'
      : (resolution.resolutionType === 'extraordinary' || resolution.resolutionType === 'extraordinary_assembly') ? 'جمعية غير عادية'
      : (resolution.resolutionType === 'general_assembly' || resolution.resolutionType === 'ordinary_assembly') ? 'جمعية عادية'
      : resolution.resolutionType === 'emergency' ? 'قرار طارئ'
      : resolution.resolutionType === 'administrative' ? 'قرار إداري'
      : resolution.resolutionType === 'financial' ? 'قرار مالي'
      : resolution.resolutionType === 'circular' ? 'قرار بالتمرير'
      : sanitize(resolution.resolutionType || '');

    const resNum = sanitize(resolution.resolutionNumber) || '-';

    // Returns the resolution text as structured blocks. `text`/`title` are already
    // sanitized; the paginator can split a long block by its lines across pages.
    type ResBlock = { cls: 'res-box' | 'res-intro'; title?: string; text: string };
    const buildResolutionBlocks = (raw: string | undefined | null): ResBlock[] => {
      const text = fixHijriInText(sanitize(raw || ''));
      if (!text.trim()) return [{ cls: 'res-box', text: '-' }];
      const lines = text.split(/\r?\n/);
      const intro: string[] = [];
      const sections: { title: string; body: string[] }[] = [];
      let cur: { title: string; body: string[] } | null = null;
      for (const ln of lines) {
        const t = ln.trim();
        if (/^القرار\s+\S+/.test(t) && t.length <= 80) {
          cur = { title: t, body: [] };
          sections.push(cur);
        } else if (cur) {
          cur.body.push(ln);
        } else {
          intro.push(ln);
        }
      }
      const introText = intro.join('\n').trim();
      if (!sections.length) {
        return [{ cls: 'res-box', text: introText || text }];
      }
      const out: ResBlock[] = [];
      if (introText) out.push({ cls: 'res-intro', text: introText });
      for (const s of sections) {
        out.push({ cls: 'res-box', title: s.title, text: s.body.join('\n').trim() });
      }
      return out;
    };

    // ----- ordered flow items: html = fixed block, text = splittable resolution text -----
    type FlowItem =
      | { kind: 'html'; html: string; head?: boolean; beforeTable?: boolean }
      | { kind: 'text'; cls: 'res-box' | 'res-intro'; title?: string; text: string };
    const flowItems: FlowItem[] = [
      { kind: 'html', html: '<div class="doc-title-main">' + docTitle + '</div>' },
      { kind: 'html', html:
        '<div class="doc-meta-wrap">' +
          '<span class="doc-meta-pill">رقم القرار ' + resNum + '<span class="sep">•</span>التاريخ الهجري ' + hijriDateStr + 'هـ<span class="sep">•</span>التاريخ الميلادي ' + gregDateStr + 'م</span>' +
        '</div>' },
      { kind: 'html', html:
        '<div class="info-strip">' +
          '<div class="info-cell"><div class="lbl">نوع القرار</div><div class="val">' + typeLabel + '</div></div>' +
          '<div class="info-cell"><div class="lbl">الأغلبية المطلوبة</div><div class="val">' + requiredMajorityInfo.percentage + '%</div></div>' +
          '<div class="info-cell"><div class="lbl">عدد المصوتين</div><div class="val">' + votedTokens.length + ' مساهم</div></div>' +
          '<div class="info-cell"><div class="lbl">الأسهم المصوتة</div><div class="val">' + totalSharesVoted.toLocaleString('en-US') + '</div></div>' +
          '<div class="info-cell"><div class="lbl">نتيجة التصويت</div><div class="val ' + (isApproved ? 'ok' : 'reject') + '">' + approvalPercentage + '% ' + (isApproved ? 'معتمد' : 'غير معتمد') + '</div></div>' +
        '</div>' },
      { kind: 'html', html: '<div class="section-head">نص القرار</div>', head: true },
      ...buildResolutionBlocks(resolution.description).map((b): FlowItem => ({ kind: 'text', cls: b.cls, title: b.title, text: b.text })),
      { kind: 'html', html: '<div class="section-head">سجل التصويت</div>', head: true, beforeTable: true },
    ];

    // ----- voting table parts (head row + body rows + totals) -----
    const tableHeadHtml =
      '<tr>' +
        '<th style="width:5%;">#</th>' +
        '<th class="name" style="width:25%;">اسم المساهم</th>' +
        '<th style="width:13%;">عدد الأسهم</th>' +
        '<th style="width:11%;">التصويت</th>' +
        '<th style="width:20%;">تاريخ ووقت التصويت</th>' +
        '<th style="width:26%;">التوقيع</th>' +
      '</tr>';

    const tableRowHtmls: string[] = votedTokens.map((token, idx) => {
      const voteClass = token.vote === 'for' ? 'vt-for' : token.vote === 'against' ? 'vt-against' : 'vt-abstain';
      const voteText = voteLabels[token.vote || ''] || sanitize(token.vote || '');
      const dateStr = token.votedAt ? new Date(token.votedAt).toLocaleTimeString('en-GB') + ' — ' + new Date(token.votedAt).toLocaleDateString('en-GB') : '-';
      const signTxt = isValidSignature(token.signatureData)
        ? '<img class="vt-sign-img" src="' + token.signatureData + '" alt="توقيع المساهم" /><span class="sign-elec">موقّع إلكترونياً</span>'
        : '<span style="color:#bbb;">-</span>';
      return '<tr>' +
        '<td>' + (idx + 1) + '</td>' +
        '<td class="name">' + sanitize(token.shareholderName) + '</td>' +
        '<td>' + (token.numberOfShares || 0).toLocaleString('en-US') + '</td>' +
        '<td><span class="vt-badge ' + voteClass + '">' + voteText + '</span></td>' +
        '<td>' + dateStr + '</td>' +
        '<td>' + signTxt + '</td>' +
      '</tr>';
    });

    // Totals rendered as a standalone block (not a <tfoot>) so the paginator can
    // place it cleanly after the last chunk of rows.
    const totalsBlockHtml =
      '<div class="vt-total">' +
        '<span>الإجمالي: ' + votedTokens.length + ' مساهم</span>' +
        '<span>إجمالي الأسهم: ' + totalSharesVoted.toLocaleString('en-US') + '</span>' +
        '<span>نسبة الموافقة ' + approvalPercentage + '% (' + forVotes + ' موافق / ' + againstVotes + ' رافض / ' + abstainVotes + ' ممتنع)</span>' +
      '</div>';

    const printNow = new Date();
    const signBlockHtml = '<div class="sign-row">' +
        '<div class="sign-col">' +
          '<div class="sign-role">رئيس مجلس الإدارة</div>' +
          (chairmanSig
            ? '<img class="sign-img" src="' + chairmanSig + '" alt="توقيع رئيس مجلس الإدارة" />'
            : '<div class="sign-blank"></div>') +
          '<div class="sign-name">' + sanitize(chairmanName) + '</div>' +
        '</div>' +
        '<div class="stamp-col">' +
          '<div class="stamp-lbl">ختم الشركة</div>' +
          '<div class="stamp-svg">' + companyStampSvg + '</div>' +
        '</div>' +
        '<div class="sign-col"></div>' +
      '</div>' +
      '<div class="doc-note">مستند رسمي صادر إلكترونياً عبر نظام إدارة حوكمة الشركات | تاريخ الطباعة: ' + printNow.toLocaleDateString('en-GB') + ' — ' + printNow.toLocaleTimeString('en-GB') + ' | رقم القرار ' + (sanitize(resolution.resolutionNumber) || '-') + '</div>';

    // Inject runtime data into the print window's pagination script. Escaping `</`
    // prevents any data URI / SVG string from prematurely closing the <script> tag.
    const toJs = (v: unknown) => JSON.stringify(v).replace(/<\//g, '<\\/');

    const printContent = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>${docTitle} - ${resNum}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { background: #fff; }
          body { font-family: 'Cairo', sans-serif; color: #333; direction: rtl; font-size: 9px; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          /* Each .sheet is exactly one A4 page. The letterhead is absolutely
             positioned INSIDE the bounded sheet (never position:fixed), which
             eliminates the Chrome blank-first-page bug caused by a full-page
             fixed image at @page margin:0. */
          .sheet { position: relative; width: 210mm; height: 297mm; overflow: hidden; background: #fff; page-break-after: always; break-after: page; }
          .sheet:last-child { page-break-after: auto; break-after: auto; }
          .sheet-bg { position: absolute; top: 0; left: 0; width: 210mm; height: 297mm; z-index: 0; }
          .sheet-content { position: absolute; top: 30mm; left: 16mm; right: 16mm; bottom: 26mm; z-index: 1; overflow: hidden; }
          /* Sits in the clear band just above the letterhead's dark footer bar. */
          .pagenum { position: absolute; bottom: 20mm; left: 0; right: 0; text-align: center; font-size: 8px; color: #8a8a8a; z-index: 2; }
          #measure { position: absolute; left: -10000px; top: 0; width: 178mm; visibility: hidden; }

          .doc-title-main { text-align: center; font-size: 16px; font-weight: 700; color: #2b3a4f; margin-bottom: 4px; }
          .doc-meta-wrap { text-align: center; margin-bottom: 8px; }
          .doc-meta-pill { display: inline-block; background: #fbf6e9; border: 1px solid #e6d4a3; color: #7a6326; border-radius: 14px; padding: 4px 18px; font-size: 9px; font-weight: 600; }
          .doc-meta-pill .sep { color: #c9a45b; margin: 0 7px; }

          .info-strip { display: flex; background: #faf8f1; border: 1px solid #e9dfc4; border-radius: 7px; overflow: hidden; margin-bottom: 9px; }
          .info-cell { flex: 1; text-align: center; padding: 5px 4px; border-left: 1px solid #ece2c8; }
          .info-cell:last-child { border-left: none; }
          .info-cell .lbl { font-size: 8px; color: #b8962f; font-weight: 600; margin-bottom: 4px; }
          .info-cell .val { font-size: 11px; font-weight: 700; color: #2b3a4f; }
          .info-cell .val.ok { color: #2e7d52; }
          .info-cell .val.reject { color: #c0392b; }

          .section-head { font-size: 13px; font-weight: 700; color: #2b3a4f; margin: 3px 0 5px; padding-right: 9px; border-right: 3px solid #b8962f; }

          .res-intro { font-size: 9px; color: #555; line-height: 1.6; margin-bottom: 6px; }
          .res-box { background: #fdfbf3; border: 1px solid #ecdcb4; border-right: 3px solid #c9a45b; border-radius: 5px; padding: 6px 10px; margin-bottom: 6px; }
          .res-box-title { font-size: 10px; font-weight: 700; color: #b8962f; margin-bottom: 4px; }
          .res-box-text { font-size: 9px; color: #444; line-height: 1.75; white-space: pre-wrap; }

          .vt { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 6px; }
          .vt th { background: #2b3a4f; color: #fff; padding: 4px 6px; font-weight: 600; font-size: 9px; text-align: center; }
          .vt th.name { text-align: right; }
          .vt td { padding: 2px 6px; border-bottom: 1px solid #eee; text-align: center; color: #444; }
          .vt td.name { text-align: right; font-weight: 600; color: #2b3a4f; }
          .vt tbody tr:nth-child(even) { background: #faf9f5; }
          .vt-badge { display: inline-block; border-radius: 10px; padding: 1px 11px; font-size: 8px; font-weight: 600; }
          .vt-for { background: #e3f3e9; color: #2e7d52; border: 1px solid #bfe3cd; }
          .vt-against { background: #fbe5e5; color: #b3261e; border: 1px solid #f0c0c0; }
          .vt-abstain { background: #eef0f2; color: #556; border: 1px solid #d8dde2; }
          .sign-elec { color: #8a8a8a; font-size: 7px; display: block; }
          /* Fixed height (not max-height) so row height is deterministic before the
             data-URI image finishes decoding -> accurate measurement. */
          .vt-sign-img { height: 18px; width: auto; max-width: 86px; display: block; margin: 0 auto 1px; }

          .vt-total { display: flex; justify-content: space-between; gap: 8px; background: #f3ead2; color: #5a4a1e; font-weight: 700; padding: 6px 10px; font-size: 9px; border-radius: 4px; margin-bottom: 8px; }

          .sign-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 12px; }
          .sign-col { flex: 1; text-align: center; }
          .sign-role { font-size: 10px; font-weight: 700; color: #2b3a4f; margin-bottom: 6px; }
          .sign-img { height: 44px; width: auto; max-width: 150px; display: block; margin: 0 auto 3px; }
          .sign-blank { height: 42px; }
          .sign-name { font-size: 9px; font-weight: 600; color: #333; border-top: 1px solid #b9b9b9; padding-top: 4px; display: inline-block; min-width: 170px; }
          .stamp-col { flex: 1; text-align: center; }
          .stamp-lbl { font-size: 9px; color: #888; margin-bottom: 4px; }
          .stamp-svg { display: inline-block; }
          .stamp-svg svg { width: 150px; height: 150px; }

          .doc-note { text-align: center; font-size: 7.5px; color: #8a8a8a; margin-top: 10px; }

          /* Emergency fallback layout (used only if the paginator fails for any
             reason) — guarantees the content is visible instead of a blank page. */
          .fallback { padding: 18mm 16mm; }
          .fallback-bg { display: none; }
          .fallback .vt { margin-top: 8px; }
        </style>
      </head>
      <body>
        <div id="measure"></div>
        <script>
        (function () {
          var MM = 96 / 25.4;
          var AVAIL = (297 - 30 - 26) * MM; // usable content height per sheet (px)
          var BG = ${toJs(officialLetterhead)};
          var flow = ${toJs(flowItems)};
          var theadHtml = ${toJs(tableHeadHtml)};
          var rowHtmls = ${toJs(tableRowHtmls)};
          var totalsHtml = ${toJs(totalsBlockHtml)};
          var signHtml = ${toJs(signBlockHtml)};

          var measure = document.getElementById('measure');
          function mk(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
          function oh(el) {
            var r = el.getBoundingClientRect();
            var s = getComputedStyle(el);
            return r.height + (parseFloat(s.marginTop) || 0) + (parseFloat(s.marginBottom) || 0);
          }
          // Measure an html string's flow height, then remove it.
          function measureHtml(html) { var e = mk(html); measure.appendChild(e); var h = oh(e); measure.removeChild(e); return h; }
          // Render a (possibly partial) resolution text block. The section title only
          // appears on the first piece; continuation pieces repeat the box framing.
          function renderText(it, text, cont) {
            if (it.cls === 'res-intro') return '<div class="res-intro">' + text + '</div>';
            var t = (it.title && !cont) ? '<div class="res-box-title">' + it.title + '</div>' : '';
            return '<div class="res-box">' + t + '<div class="res-box-text">' + text + '</div></div>';
          }
          var NO_VOTERS = '<tr><td colspan="6" style="text-align:center;color:#999;padding:8px;">لا يوجد مصوتون</td></tr>';

          // Flips to true only AFTER content has been successfully inserted into the
          // document, so a late failure in build() still leaves fallback() available.
          var hasRendered = false;
          function doPrint() { setTimeout(function () { try { window.focus(); window.print(); } catch (e) {} }, 350); }

          // Emergency fallback: a single flowing render that is guaranteed to show the
          // content even if the bounded-sheet paginator throws or never runs. It drops
          // per-page numbering but never leaves the user with a blank page.
          function fallback() {
            if (hasRendered) return;
            var ok = false;
            try {
              var m = document.getElementById('measure'); if (m && m.parentNode) m.parentNode.removeChild(m);
              var html = '<div class="fallback">';
              for (var i = 0; i < flow.length; i++) {
                var it = flow[i];
                if (it.kind === 'html') { html += it.html; }
                else {
                  var t = (it.title) ? '<div class="res-box-title">' + it.title + '</div>' : '';
                  html += (it.cls === 'res-intro')
                    ? '<div class="res-intro">' + it.text + '</div>'
                    : '<div class="res-box">' + t + '<div class="res-box-text">' + it.text + '</div></div>';
                }
              }
              var rows = (rowHtmls && rowHtmls.length) ? rowHtmls.join('') : NO_VOTERS;
              html += '<table class="vt"><thead>' + theadHtml + '</thead><tbody>' + rows + '</tbody></table>';
              html += totalsHtml + signHtml + '</div>';
              document.body.insertAdjacentHTML('beforeend', html);
              ok = true;
            } catch (e) {}
            if (ok) { hasRendered = true; doPrint(); }
          }

          function build() {
            if (hasRendered) return;
            var sheets = [];
            var cur = [];
            var curH = 0;
            function flush() { if (cur.length) { sheets.push(cur); cur = []; curH = 0; } }
            function add(html, h) { if (curH + h > AVAIL && cur.length) { flush(); } cur.push(html); curH += h; }

            // First non-empty line of a text item (used for keep-with-next measuring).
            function firstLineOf(it) {
              var ls = it.text.split(/\\r?\\n/);
              for (var x = 0; x < ls.length; x++) { if (ls[x].trim()) return ls[x]; }
              return it.text;
            }
            // A single line too tall for an empty page: split it by words so it still
            // flows across pages instead of being clipped by overflow:hidden.
            function placeLongLine(it, line, cont) {
              var words = line.split(/(\\s+)/);
              var i = 0;
              while (i < words.length) {
                var avail = AVAIL - curH;
                var best = null;
                for (var k = i; k < words.length; k++) {
                  var tx = words.slice(i, k + 1).join('');
                  var h = measureHtml(renderText(it, tx, cont));
                  if (h <= avail) best = { k: k, text: tx, h: h }; else break;
                }
                if (!best) {
                  if (cur.length) { flush(); continue; }
                  // Single word taller than a whole page (effectively impossible for a
                  // resolution) -> force it; only residual clip path that remains.
                  var w = words[i];
                  cur.push(renderText(it, w, cont)); curH += measureHtml(renderText(it, w, cont)); i++; cont = true; flush();
                  continue;
                }
                cur.push(renderText(it, best.text, cont)); curH += best.h; i = best.k + 1; cont = true;
                if (i < words.length) flush();
              }
            }
            // Splittable resolution text: fill the current page line-by-line, spilling
            // overflow onto new pages so long resolutions are never clipped.
            function placeText(it) {
              var fh = measureHtml(renderText(it, it.text, false));
              if (curH + fh <= AVAIL) { cur.push(renderText(it, it.text, false)); curH += fh; return; }
              var lines = it.text.split(/\\r?\\n/);
              var idx = 0, cont = false;
              while (idx < lines.length) {
                var avail = AVAIL - curH;
                var best = null;
                for (var k = idx; k < lines.length; k++) {
                  var tx = lines.slice(idx, k + 1).join('\\n');
                  var h = measureHtml(renderText(it, tx, cont));
                  if (h <= avail) best = { k: k, text: tx, h: h }; else break;
                }
                if (!best) {
                  if (cur.length) { flush(); continue; } // retry on a fresh page
                  placeLongLine(it, lines[idx], cont); idx++; cont = true; // line alone > empty page
                  continue;
                }
                cur.push(renderText(it, best.text, cont)); curH += best.h; idx = best.k + 1; cont = true;
                if (idx < lines.length) flush();
              }
            }

            // Measure the voting table head + row heights (deterministic: fixed img heights).
            var effRows = rowHtmls.length ? rowHtmls : [NO_VOTERS];
            var tableEl = mk('<table class="vt"><thead>' + theadHtml + '</thead><tbody>' + effRows.join('') + '</tbody></table>');
            measure.appendChild(tableEl);
            var theadH = tableEl.querySelector('thead').getBoundingClientRect().height;
            var rowEls = tableEl.querySelectorAll('tbody tr');
            var rowH = [].map.call(rowEls, function (tr) { return tr.getBoundingClientRect().height; });
            measure.removeChild(tableEl);

            // Flow items (header + splittable resolution text).
            for (var i = 0; i < flow.length; i++) {
              var it = flow[i];
              if (it.kind === 'html' && it.head) {
                var headH = measureHtml(it.html);
                var follow = 0;
                if (it.beforeTable) {
                  follow = theadH + (rowH[0] || 30);
                } else if (i + 1 < flow.length) {
                  var nx = flow[i + 1];
                  follow = (nx.kind === 'html')
                    ? measureHtml(nx.html)
                    : measureHtml(renderText(nx, firstLineOf(nx), false)); // first text fragment
                }
                if (curH + headH + follow > AVAIL && cur.length) { flush(); }
                cur.push(it.html); curH += headH;
              } else if (it.kind === 'html') {
                add(it.html, measureHtml(it.html));
              } else {
                placeText(it);
              }
            }

            // Voting table: re-emit the header row at the top of every sheet chunk.
            var r = 0;
            while (r < effRows.length) {
              if (curH + theadH + rowH[r] > AVAIL && cur.length) { flush(); }
              var chunk = [];
              var used = theadH;
              while (r < effRows.length && curH + used + rowH[r] <= AVAIL) { chunk.push(effRows[r]); used += rowH[r]; r++; }
              if (!chunk.length) { chunk.push(effRows[r]); used += rowH[r]; r++; } // row taller than page: force one
              cur.push('<table class="vt"><thead>' + theadHtml + '</thead><tbody>' + chunk.join('') + '</tbody></table>');
              curH += used;
            }

            add(totalsHtml, measureHtml(totalsHtml));
            add(signHtml, measureHtml(signHtml));
            flush();

            if (measure.parentNode) measure.parentNode.removeChild(measure);

            var N = sheets.length || 1;
            var out = sheets.map(function (s, idx) {
              return '<div class="sheet">' +
                '<img class="sheet-bg" src="' + BG + '" alt="" />' +
                '<div class="sheet-content">' + s.join('') + '</div>' +
                '<div class="pagenum">صفحة ' + (idx + 1) + ' من ' + N + '</div>' +
                '</div>';
            }).join('');
            document.body.insertAdjacentHTML('beforeend', out);
            hasRendered = true;
            doPrint();
          }

          // Run the paginator; if it throws for ANY reason, drop to the guaranteed
          // fallback render so the user never gets a blank page.
          function tryBuild() {
            if (hasRendered) return;
            try { build(); } catch (e) { fallback(); }
          }

          // Measure after fonts are ready (image heights are pinned via CSS, so they
          // do not depend on async decoding). Hard fallback if fonts never settle.
          if (document.fonts && document.fonts.ready) { document.fonts.ready.then(function () { setTimeout(tryBuild, 40); }); }
          setTimeout(tryBuild, 1200);
          // Watchdog: if nothing has rendered shortly after, force the fallback.
          setTimeout(fallback, 3000);
        })();
        <\/script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
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
          <TabsList className="grid w-full max-w-lg grid-cols-3 text-xs sm:text-sm">
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
                    onClick={() => printResolutionWithSignatures(selectedResolutionForLinks!, votingTokens)}
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
