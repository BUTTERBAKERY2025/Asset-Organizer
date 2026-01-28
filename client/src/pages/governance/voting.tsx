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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";
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
  const { toast } = useToast();
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
  
  const { data: auditLogs = [] } = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/governance/voting-audit-log"],
    enabled: showAuditLog,
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
    const isExtraordinary = resolution.resolutionType === 'extraordinary';
    
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

  const openVotingLinksDialog = (resolution: BoardResolution) => {
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

  const printResolutionWithSignatures = (resolution: BoardResolution, tokens: VotingTokenData[]) => {
    const votedTokens = tokens.filter(t => t.status === 'voted');
    const voteLabels: Record<string, string> = { for: 'موافق', against: 'رافض', abstain: 'ممتنع' };
    
    // Sanitize text to prevent XSS/HTML injection
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

    // بناء صفحات الجدول مع ترقيم لكل صفحة
    const rowsPerPage = 12;
    const totalPages = Math.max(1, Math.ceil(votedTokens.length / rowsPerPage));
    let pagesHtml = '';
    
    for (let page = 0; page < totalPages; page++) {
      const startIdx = page * rowsPerPage;
      const endIdx = Math.min(startIdx + rowsPerPage, votedTokens.length);
      const pageTokens = votedTokens.slice(startIdx, endIdx);
      const isLastPage = page === totalPages - 1;
      const pageNum = page + 1;
      
      let tableRows = '';
      pageTokens.forEach((token, idx) => {
        const voteClass = token.vote === 'for' ? 'vote-for' : token.vote === 'against' ? 'vote-against' : 'vote-abstain';
        const voteText = voteLabels[token.vote || ''] || sanitize(token.vote || '');
        const dateStr = token.votedAt ? new Date(token.votedAt).toLocaleDateString('ar-SA') + '<br>' + new Date(token.votedAt).toLocaleTimeString('ar-SA') : '-';
        const sigImg = isValidSignature(token.signatureData) ? '<img class="signature-img" src="' + token.signatureData + '" alt="توقيع" />' : '<span style="color: #999;">-</span>';
        
        tableRows += '<tr>' +
          '<td style="text-align: center; font-weight: 600;">' + (startIdx + idx + 1) + '</td>' +
          '<td style="font-weight: 600;">' + sanitize(token.shareholderName) + '</td>' +
          '<td style="text-align: center;">' + (token.numberOfShares || 0).toLocaleString() + '</td>' +
          '<td style="text-align: center;"><span class="vote-badge ' + voteClass + '">' + voteText + '</span></td>' +
          '<td style="text-align: center; font-size: 9px;">' + dateStr + '</td>' +
          '<td style="font-size: 9px; color: #666;">' + (sanitize(token.comments) || '-') + '</td>' +
          '<td>' + sigImg + '</td>' +
        '</tr>';
      });
      
      let footerSection = '';
      if (isLastPage) {
        footerSection = '<div class="footer">' +
          '<div>' +
            '<div style="font-weight: 600; color: #333; margin-bottom: 3px;">مستند رسمي صادر إلكترونياً</div>' +
            '<div>نظام BUTTER BAKERY - إدارة حوكمة الشركات | سجل تجاري: 7026155296</div>' +
            '<div>تاريخ الطباعة: ' + new Date().toLocaleDateString('ar-SA') + ' - ' + new Date().toLocaleTimeString('ar-SA') + '</div>' +
          '</div>' +
          '<div class="stamp-area">ختم الشركة</div>' +
          '<div style="text-align: left;">' +
            '<div style="font-weight: 600; color: #333; margin-bottom: 3px;">توقيع رئيس مجلس الإدارة</div>' +
            '<div style="border-bottom: 1px solid #333; width: 150px; height: 40px;"></div>' +
          '</div>' +
        '</div>';
      }
      
      pagesHtml += '<div class="print-page" style="' + (!isLastPage ? 'page-break-after: always;' : '') + '">' +
        '<table class="votes-table">' +
          '<thead><tr>' +
            '<th style="width: 5%;">#</th>' +
            '<th style="width: 20%;">اسم المساهم</th>' +
            '<th style="width: 12%;">عدد الأسهم</th>' +
            '<th style="width: 10%;">التصويت</th>' +
            '<th style="width: 13%;">تاريخ التصويت</th>' +
            '<th style="width: 20%;">الملاحظات</th>' +
            '<th style="width: 20%;">التوقيع الإلكتروني</th>' +
          '</tr></thead>' +
          '<tbody>' + tableRows + '</tbody>' +
        '</table>' +
        footerSection +
        '<div class="page-footer">' +
          '<span style="font-weight: 600; color: #333;">صفحة ' + pageNum + ' من ' + totalPages + '</span>' +
          '<span>شركة الزبد الأفضل التجارية | سجل تجاري: 7026155296 | رقم القرار: ' + (sanitize(resolution.resolutionNumber) || '-') + '</span>' +
        '</div>' +
      '</div>';
    }

    const printContent = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>قرار مجلس الإدارة - ${sanitize(resolution.resolutionNumber)}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          @page { 
            size: A4 landscape; 
            margin: 8mm 10mm 12mm 10mm;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Cairo', sans-serif; padding: 8px 15px 40px 15px; background: white; color: #333; direction: rtl; font-size: 10px; }
          
          .page-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 8px;
            color: #666;
            padding: 4px 10mm;
            background: white;
            border-top: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
          }
          
          .document-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #b8962f; padding-bottom: 8px; margin-bottom: 8px; }
          .header-right { text-align: right; }
          .header-center { text-align: center; flex: 1; }
          .header-left { text-align: left; }
          .logo { font-size: 18px; font-weight: 700; color: #b8962f; }
          .company-name { font-size: 12px; color: #333; font-weight: 600; }
          .company-name-en { font-size: 9px; color: #666; }
          .cr-number { font-size: 9px; color: #b8962f; font-weight: 600; margin-top: 2px; }
          .doc-title { font-size: 14px; font-weight: 700; color: #b8962f; margin-top: 3px; }
          .doc-number { font-size: 10px; color: #666; background: #f5f5f5; padding: 3px 10px; border-radius: 10px; display: inline-block; }
          
          .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px; }
          .info-box { background: #fafafa; border: 1px solid #e0e0e0; border-radius: 4px; padding: 6px 8px; }
          .info-box-header { font-weight: 600; color: #b8962f; margin-bottom: 4px; font-size: 10px; border-bottom: 1px solid #e0e0e0; padding-bottom: 3px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 9px; }
          .info-label { color: #666; }
          .info-value { font-weight: 600; color: #333; }
          
          .resolution-section { background: #fffef5; border: 1px solid #d4a853; border-radius: 4px; padding: 8px; margin-bottom: 8px; }
          .resolution-title { font-size: 11px; font-weight: 700; color: #333; margin-bottom: 4px; }
          .resolution-text { font-size: 10px; line-height: 1.5; color: #444; white-space: pre-wrap; }
          
          .result-badge { display: inline-block; padding: 4px 15px; border-radius: 12px; font-size: 11px; font-weight: 700; margin-top: 4px; }
          .result-approved { background: linear-gradient(135deg, #dcfce7, #bbf7d0); color: #166534; border: 2px solid #22c55e; }
          .result-rejected { background: linear-gradient(135deg, #fee2e2, #fecaca); color: #991b1b; border: 2px solid #ef4444; }
          
          .votes-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 9px; }
          .votes-table th { background: linear-gradient(135deg, #b8962f, #d4a853); color: white; padding: 4px 5px; text-align: right; font-weight: 600; font-size: 8px; }
          .votes-table td { padding: 4px 5px; border-bottom: 1px solid #e0e0e0; vertical-align: middle; }
          .votes-table tr:nth-child(even) { background: #fafafa; }
          
          .vote-badge { padding: 2px 6px; border-radius: 8px; font-size: 8px; font-weight: 600; display: inline-block; }
          .vote-for { background: #dcfce7; color: #166534; }
          .vote-against { background: #fee2e2; color: #991b1b; }
          .vote-abstain { background: #f3f4f6; color: #374151; }
          
          .signature-img { max-width: 80px; max-height: 25px; border: 1px solid #ddd; border-radius: 3px; }
          
          .footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e0e0e0; padding-top: 6px; margin-top: 6px; font-size: 8px; color: #888; }
          .stamp-area { border: 1px dashed #ccc; padding: 10px 25px; text-align: center; color: #999; border-radius: 4px; font-size: 8px; }
          
          @media print {
            body { padding: 5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .votes-table tr { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="document-header">
          <div class="header-right">
            <div class="logo">BUTTER BAKERY</div>
            <div class="company-name">شركة الزبد الأفضل التجارية</div>
            <div class="company-name-en">Butter Bakery Trading Co.</div>
            <div class="cr-number">سجل تجاري: 7026155296</div>
          </div>
          <div class="header-center">
            <div class="doc-title">محضر قرار مجلس الإدارة</div>
            <div class="doc-number">رقم القرار: ${sanitize(resolution.resolutionNumber) || '-'}</div>
          </div>
          <div class="header-left">
            <div style="color: #666; font-size: 10px;">التاريخ الهجري</div>
            <div style="font-weight: 600;">${new Date().toLocaleDateString('ar-SA-u-ca-islamic')}</div>
            <div style="color: #666; font-size: 10px; margin-top: 5px;">التاريخ الميلادي</div>
            <div style="font-weight: 600;">${new Date().toLocaleDateString('ar-SA')}</div>
          </div>
        </div>
        
        <div class="info-grid">
          <div class="info-box">
            <div class="info-box-header">بيانات القرار</div>
            <div class="info-row"><span class="info-label">نوع القرار:</span><span class="info-value">${resolution.resolutionType === 'ordinary' ? 'عادي' : resolution.resolutionType === 'extraordinary' ? 'غير عادي' : resolution.resolutionType === 'urgent' ? 'عاجل' : 'كتابي'}</span></div>
            <div class="info-row"><span class="info-label">الأغلبية المطلوبة:</span><span class="info-value">${requiredMajorityInfo.label} (${requiredMajorityInfo.percentage}%)</span></div>
            <div class="info-row"><span class="info-label">تاريخ انتهاء التصويت:</span><span class="info-value">${resolution.votingDeadline ? new Date(resolution.votingDeadline).toLocaleDateString('ar-SA') : '-'}</span></div>
          </div>
          <div class="info-box">
            <div class="info-box-header">ملخص التصويت</div>
            <div class="info-row"><span class="info-label">إجمالي المصوتين:</span><span class="info-value">${votedTokens.length} مساهم</span></div>
            <div class="info-row"><span class="info-label">موافق / رافض / ممتنع:</span><span class="info-value">${forVotes} / ${againstVotes} / ${abstainVotes}</span></div>
            <div class="info-row"><span class="info-label">إجمالي الأسهم المصوتة:</span><span class="info-value">${totalSharesVoted.toLocaleString()} سهم</span></div>
          </div>
          <div class="info-box">
            <div class="info-box-header">نتيجة التصويت</div>
            <div class="info-row"><span class="info-label">نسبة الموافقة:</span><span class="info-value" style="color: ${isApproved ? '#166534' : '#991b1b'}; font-size: 16px;">${approvalPercentage}%</span></div>
            <div style="text-align: center; margin-top: 8px;">
              <span class="result-badge ${isApproved ? 'result-approved' : 'result-rejected'}">${isApproved ? '✓ تمت الموافقة' : '✗ لم تتم الموافقة'}</span>
            </div>
          </div>
        </div>
        
        <div class="resolution-section">
          <div class="resolution-title">نص القرار: ${sanitize(resolution.title)}</div>
          <div class="resolution-text">${sanitize(resolution.description)}</div>
        </div>
        
        ${pagesHtml}
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const handleSubmitVote = () => {
    if (!selectedResolution || !selectedVote) return;
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
      <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-10 space-y-4" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/governance">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-3 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl">
              <Vote className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-pink-800" data-testid="page-title">
                التصويت الإلكتروني المتقدم
              </h1>
              <p className="text-gray-600">تصويت مرجح - وكالات - سجل تدقيق كامل</p>
            </div>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  تصدير
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
            <Button variant="outline" className="gap-2" onClick={() => setShowQuorumDetails(true)}>
              <Scale className="h-4 w-4" />
              النصاب
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setShowAuditLog(true)}>
              <History className="h-4 w-4" />
              سجل التدقيق
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-pink-600">قيد التصويت</p>
                  <p className="text-2xl font-bold text-pink-800">{votingResolutions.length}</p>
                </div>
                <Vote className="h-8 w-8 text-pink-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600">تصويت مسبق</p>
                  <p className="text-2xl font-bold text-amber-800">{preVotingResolutions.length}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">معتمدة</p>
                  <p className="text-2xl font-bold text-green-800">
                    {resolutions.filter(r => r.status === 'approved').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600">مرفوضة</p>
                  <p className="text-2xl font-bold text-red-800">
                    {resolutions.filter(r => r.status === 'rejected').length}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">إجمالي الأسهم</p>
                  <p className="text-2xl font-bold text-blue-800">{totalShares.toLocaleString()}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="active" className="gap-2">
              <Vote className="h-4 w-4" />
              جارية ({votingResolutions.length})
            </TabsTrigger>
            <TabsTrigger value="pre" className="gap-2">
              <Clock className="h-4 w-4" />
              مسبقة ({preVotingResolutions.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              مكتملة ({completedVotes.length})
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
                                onClick={() => setSelectedResolution(resolution)}
                                data-testid={`vote-btn-${resolution.id}`}
                              >
                                <Vote className="h-4 w-4 ml-2" />
                                صوّت الآن
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
                          onClick={() => setSelectedResolution(resolution)}
                        >
                          <Clock className="h-4 w-4 ml-2" />
                          تصويت مسبق
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
                            {new Date(log.createdAt).toLocaleDateString('ar-SA')}
                            <br />
                            <span className="text-xs text-gray-500">
                              {new Date(log.createdAt).toLocaleTimeString('ar-SA')}
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
                        <TableHead>المساهم</TableHead>
                        <TableHead>الأسهم</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الرابط</TableHead>
                        <TableHead>الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {votingTokens.map((token) => (
                        <TableRow key={token.id}>
                          <TableCell className="font-medium">{token.shareholderName}</TableCell>
                          <TableCell>{token.numberOfShares?.toLocaleString()}</TableCell>
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
    </Layout>
  );
}
