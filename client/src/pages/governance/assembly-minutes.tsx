import { useState, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  FileText,
  Plus,
  ChevronLeft,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Vote,
  Users,
  Building2,
  Gavel,
  Printer,
  Download,
  Edit,
  Trash2,
  MapPin,
  Video,
  Send,
  Loader2,
  MoreVertical,
  Archive,
  FileCheck,
  FilePen,
} from "lucide-react";

interface Shareholder {
  id: number;
  fullName: string;
  numberOfShares: number | null;
  shareholdingPercentage: string | null;
  votingRights: boolean;
}

interface MeetingMinutes {
  id: number;
  meetingId: number;
  minutesNumber: string;
  content: string;
  summary: string | null;
  attendanceList: any;
  discussionPoints: any;
  decisions: any;
  votingResults: any;
  status: string;
  preparedBy: string | null;
  preparedAt: string | null;
  createdAt: string;
}

interface BoardResolution {
  id: number;
  resolutionNumber: string;
  title: string;
  description: string;
  resolutionType: string;
  status: string;
  createdAt: string;
}

interface GovernanceMeeting {
  id: number;
  meetingNumber: string;
  meetingType: string;
  title: string;
  description: string | null;
  meetingDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  locationType: string;
  virtualMeetingLink: string | null;
  agenda: string | null;
  status: string;
  quorumRequired: string;
  createdAt: string;
}

const minutesStatuses = [
  { value: "draft", label: "مسودة", color: "bg-gray-100 text-gray-800" },
  { value: "pending_review", label: "قيد المراجعة", color: "bg-blue-100 text-blue-800" },
  { value: "pending_signature", label: "بانتظار التوقيع", color: "bg-yellow-100 text-yellow-800" },
  { value: "signed", label: "موقّع", color: "bg-green-100 text-green-800" },
  { value: "archived", label: "مؤرشف", color: "bg-purple-100 text-purple-800" },
];

export default function AssemblyMinutesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState<MeetingMinutes | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [deleteMinutesId, setDeleteMinutesId] = useState<number | null>(null);
  const [signingAttendeeIndex, setSigningAttendeeIndex] = useState<number | null>(null);
  const sigPadRef = useRef<SignatureCanvas | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    assemblyType: "ordinary_assembly",
    title: "",
    meetingDate: "",
    meetingTime: "17:00",
    endTime: "",
    location: "",
    locationType: "virtual",
    virtualMeetingLink: "",
    quorumRequired: "50",
    agenda: "",
    content: "",
    decisions: [{ description: "", responsible: "" }],
    createResolution: true,
  });

  const { data: minutes = [], isLoading } = useQuery<MeetingMinutes[]>({
    queryKey: ["/api/governance/minutes"],
  });

  const { data: shareholders = [] } = useQuery<Shareholder[]>({
    queryKey: ["/api/governance/shareholders"],
  });

  const { data: resolutions = [] } = useQuery<BoardResolution[]>({
    queryKey: ["/api/governance/resolutions"],
  });

  const { data: meetings = [] } = useQuery<GovernanceMeeting[]>({
    queryKey: ["/api/governance/meetings"],
  });

  const totalShares = shareholders.reduce((sum, s) => sum + (s.numberOfShares || 0), 0);

  const deleteMinutesMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/governance/minutes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل في حذف المحضر");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/minutes"] });
      setDeleteMinutesId(null);
      toast({ title: "تم حذف المحضر بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في حذف المحضر", variant: "destructive" });
    },
  });

  const updateAttendanceListMutation = useMutation({
    mutationFn: async ({ id, attendanceList }: { id: number; attendanceList: any[] }) => {
      const res = await fetch(`/api/governance/minutes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ attendanceList }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "فشل في حفظ التوقيع");
      }
      return res.json();
    },
    onSuccess: (updated: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/minutes"] });
      if (selectedMinutes && updated && updated.id === selectedMinutes.id) {
        setSelectedMinutes({ ...selectedMinutes, attendanceList: updated.attendanceList });
      }
      toast({ title: "تم حفظ التوقيع بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في حفظ التوقيع", variant: "destructive" });
    },
  });

  const updateMinutesStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/governance/minutes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل في تحديث الحالة");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/minutes"] });
      toast({ title: "تم تحديث حالة المحضر بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في تحديث الحالة", variant: "destructive" });
    },
  });

  const createMinutesMutation = useMutation({
    mutationFn: async (data: any) => {
      const meetingRes = await fetch("/api/governance/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          meetingType: data.assemblyType,
          title: data.title,
          description: data.content,
          meetingDate: data.meetingDate ? new Date(data.meetingDate) : new Date(),
          startTime: data.meetingTime,
          endTime: data.endTime,
          location: data.location,
          locationType: data.locationType,
          virtualMeetingLink: data.virtualMeetingLink,
          agenda: data.agenda,
          quorumRequired: data.quorumRequired,
          fiscalYear: new Date().getFullYear().toString(),
          status: "completed",
        }),
      });
      if (!meetingRes.ok) {
        const err = await meetingRes.json();
        throw new Error(err.error || "فشل في إنشاء الاجتماع");
      }
      const meeting = await meetingRes.json();

      const attendanceList = shareholders
        .filter(s => s.votingRights)
        .map(s => ({
          name: s.fullName,
          role: "مساهم",
          shares: s.numberOfShares || 0,
          percentage: totalShares > 0 ? ((s.numberOfShares || 0) / totalShares * 100).toFixed(2) : "0",
          status: "present",
        }));

      const decisionsData = data.decisions
        .filter((d: any) => d.description.trim())
        .map((d: any, i: number) => ({
          number: i + 1,
          description: d.description,
          responsible: d.responsible,
          deadline: "",
        }));

      const minutesRes = await fetch("/api/governance/minutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          meetingId: meeting.id,
          content: data.content,
          summary: data.title,
          attendanceList,
          discussionPoints: data.agenda ? data.agenda.split("\n").filter((l: string) => l.trim()).map((topic: string, i: number) => ({
            topic: topic.replace(/^\d+\.\s*/, ""),
            discussion: "",
            conclusion: "",
          })) : [],
          decisions: decisionsData,
          status: "draft",
        }),
      });
      if (!minutesRes.ok) {
        const err = await minutesRes.json();
        throw new Error(err.error || "فشل في إنشاء المحضر");
      }
      const minutesResult = await minutesRes.json();

      let resolution = null;
      if (data.createResolution) {
        const resType = data.assemblyType === "extraordinary_assembly" ? "extraordinary_assembly" : "general_assembly";
        const resolutionRes = await fetch("/api/governance/resolutions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: data.title,
            description: data.content,
            resolutionType: resType,
            category: "legal",
            priority: "high",
            status: "draft",
            votingRequired: true,
          }),
        });
        if (resolutionRes.ok) {
          resolution = await resolutionRes.json();
        }
      }

      return { meeting, minutes: minutesResult, resolution };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/minutes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions"] });
      setShowCreate(false);
      resetForm();
      const msg = result.resolution
        ? `تم إنشاء محضر الجمعية وقرار التصويت رقم ${result.resolution.resolutionNumber} بنجاح`
        : "تم إنشاء محضر الجمعية بنجاح";
      toast({ title: msg });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في إنشاء المحضر", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setForm({
      assemblyType: "ordinary_assembly",
      title: "",
      meetingDate: "",
      meetingTime: "17:00",
      endTime: "",
      location: "",
      locationType: "virtual",
      virtualMeetingLink: "",
      quorumRequired: "50",
      agenda: "",
      content: "",
      decisions: [{ description: "", responsible: "" }],
      createResolution: true,
    });
  };

  const addDecision = () => {
    setForm({ ...form, decisions: [...form.decisions, { description: "", responsible: "" }] });
  };

  const removeDecision = (index: number) => {
    setForm({ ...form, decisions: form.decisions.filter((_, i) => i !== index) });
  };

  const updateDecision = (index: number, field: string, value: string) => {
    const updated = [...form.decisions];
    updated[index] = { ...updated[index], [field]: value };
    setForm({ ...form, decisions: updated });
  };

  const getStatusBadge = (status: string) => {
    const s = minutesStatuses.find(ms => ms.value === status);
    return <Badge className={s?.color || "bg-gray-100 text-gray-800"}>{s?.label || status}</Badge>;
  };

  const getAssemblyTypeLabel = (type: string) => {
    if (type === "ordinary_assembly") return "جمعية عمومية عادية";
    if (type === "extraordinary_assembly") return "جمعية عمومية غير عادية";
    return type;
  };

  const computeHijriDate = (date: Date): string => {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(date);
    const day = parts.find(p => p.type === 'day')?.value || '1';
    const month = parts.find(p => p.type === 'month')?.value || '1';
    const year = parts.find(p => p.type === 'year')?.value || '1447';
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  };

  const formatHijriFull = (date: Date): string => {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  };

  const sanitize = (text: string | undefined | null): string => {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  };

  const fixHijriInContent = (content: string, meetingDate: Date): string => {
    const correctHijri = computeHijriDate(meetingDate);
    const correctParts = correctHijri.split('/');
    const correctDay = parseInt(correctParts[0]);
    const correctMonth = parseInt(correctParts[1]);
    const correctYear = correctParts[2];
    
    const fixed = content.replace(
      /(\d{1,2})\/(\d{1,2})\/(\d{4})هـ/g,
      (match, d, m, y) => {
        if (y === correctYear) {
          return `${correctDay.toString().padStart(2, '0')}/${correctMonth.toString().padStart(2, '0')}/${correctYear}هـ`;
        }
        return match;
      }
    );
    return fixed;
  };

  const printMinutes = async (m: MeetingMinutes) => {
    const meeting = getMeetingForMinutes(m.meetingId);
    const meetingDate = meeting?.meetingDate ? new Date(meeting.meetingDate) : new Date();
    const hijriDate = computeHijriDate(meetingDate);
    const hijriFull = formatHijriFull(meetingDate);
    const gregorianDate = meetingDate.toLocaleDateString('ar-SA-u-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    const gregorianShort = meetingDate.toLocaleDateString('en-GB');
    const dayName = meetingDate.toLocaleDateString('ar-SA', { weekday: 'long' });
    const locationText = meeting?.locationType === "virtual" ? "عن بُعد عبر الوسائل الإلكترونية" : meeting?.locationType === "hybrid" ? "حضوري وعن بُعد" : "حضوري";
    const locationDetail = meeting?.location || meeting?.virtualMeetingLink || "";
    const assemblyType = meeting ? getAssemblyTypeLabel(meeting.meetingType) : "";
    const timeText = meeting?.startTime ? `في تمام الساعة ${meeting.startTime} مساءً` : "";

    const attendees = Array.isArray(m.attendanceList) ? m.attendanceList : [];
    const decisions = Array.isArray(m.decisions) ? m.decisions : [];
    const discussionPoints = Array.isArray(m.discussionPoints) ? m.discussionPoints : [];

    const contentWithFixedHijri = m.content ? fixHijriInContent(sanitize(m.content), meetingDate) : "";

    const normName = (s: any) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const isSafeSig = (u: any) => typeof u === 'string' && (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/.test(u) || /^https:\/\//.test(u));
    const sigByName = new Map<string, { url: string; signedAt?: string | null }>();
    const sigByShareholderId = new Map<number, { url: string; signedAt?: string | null }>();
    try {
      const attRes = await fetch(`/api/governance/meetings/${m.meetingId}/attendance`, { credentials: 'include' });
      if (attRes.ok) {
        const attRows = await attRes.json();
        for (const r of (Array.isArray(attRows) ? attRows : [])) {
          if (!isSafeSig(r.signatureUrl)) continue;
          const entry = { url: r.signatureUrl as string, signedAt: r.signedAt };
          if (r.attendeeName) sigByName.set(normName(r.attendeeName), entry);
          if (r.shareholderId) sigByShareholderId.set(Number(r.shareholderId), entry);
        }
      }
    } catch (err) {
      console.error('Error fetching attendance signatures:', err);
    }

    try {
      const resolutionsRes = await fetch(`/api/governance/resolutions`, { credentials: 'include' });
      if (resolutionsRes.ok) {
        const allResolutions = await resolutionsRes.json();
        const meetingResolutions = (Array.isArray(allResolutions) ? allResolutions : []).filter((r: any) => r.meetingId === m.meetingId);
        for (const resolution of meetingResolutions) {
          try {
            const sigRes = await fetch(`/api/governance/resolutions/${resolution.id}/signatures`, { credentials: 'include' });
            if (!sigRes.ok) continue;
            const sigs = await sigRes.json();
            for (const s of (Array.isArray(sigs) ? sigs : [])) {
              if (s.status !== 'signed' || !isSafeSig(s.signatureData)) continue;
              const entry = { url: s.signatureData as string, signedAt: s.signedAt };
              const name = s.memberName || s.signerName;
              if (name && !sigByName.has(normName(name))) sigByName.set(normName(name), entry);
              if (s.shareholderId && !sigByShareholderId.has(Number(s.shareholderId))) sigByShareholderId.set(Number(s.shareholderId), entry);
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Error fetching resolution signatures:', err);
    }

    const attendeesRows = attendees.map((a: any, i: number) => {
      const inlineSig = isSafeSig(a.signatureUrl) ? { url: a.signatureUrl as string, signedAt: a.signedAt } : null;
      const sig = inlineSig || (a.shareholderId && sigByShareholderId.get(Number(a.shareholderId))) || sigByName.get(normName(a.name));
      const sigCell = sig
        ? `<img src="${sig.url}" alt="توقيع ${sanitize(a.name)}" style="max-width:120px;max-height:50px;object-fit:contain;background:white;padding:2px;border:1px solid #eee;border-radius:4px;" />${sig.signedAt ? `<div style="font-size:8px;color:#999;margin-top:2px;">${new Date(sig.signedAt).toLocaleDateString('en-GB')}</div>` : ''}`
        : `<span style="color:#bbb;font-size:10px;">—</span>`;
      return `<tr><td style="text-align:center;">${i + 1}</td><td>${sanitize(a.name)}</td><td style="text-align:center;">${(a.shares || 0).toLocaleString()}</td><td style="text-align:center;">${a.percentage || '0'}%</td><td style="text-align:center;">${a.status === 'present' ? 'حاضر' : a.status === 'proxy' ? 'بالوكالة' : 'غائب'}</td><td style="text-align:center;">${sigCell}</td></tr>`;
    }).join('');

    const decisionsHtml = decisions.map((d: any, i: number) =>
      `<div style="margin-bottom:8px;"><strong>${d.number || i + 1}.</strong> ${sanitize(d.description)}${d.responsible ? ` <span style="color:#666;">(المسؤول: ${sanitize(d.responsible)})</span>` : ''}</div>`
    ).join('');

    let votingResultsHtml = '';
    let shareholderSignaturesHtml = '';
    try {
      const resolutionsRes = await fetch(`/api/governance/resolutions`, { credentials: 'include' });
      if (resolutionsRes.ok) {
        const allResolutions = await resolutionsRes.json();
        const meetingResolutions = allResolutions.filter((r: any) => r.meetingId === m.meetingId);

        if (meetingResolutions.length > 0) {
          const perResolutionSections: string[] = [];
          let allSignedTokens: any[] = [];

          for (const resolution of meetingResolutions) {
            try {
              const tokensRes = await fetch(`/api/governance/resolutions/${resolution.id}/voting-tokens`, { credentials: 'include' });
              if (!tokensRes.ok) continue;
              const tokens = await tokensRes.json();
              if (tokens.length === 0) continue;

              const votedTokens = tokens.filter((t: any) => t.status === 'voted');
              const forVotes = votedTokens.filter((t: any) => t.vote === 'for');
              const againstVotes = votedTokens.filter((t: any) => t.vote === 'against');
              const abstainVotes = votedTokens.filter((t: any) => t.vote === 'abstain');

              const totalWeight = tokens.reduce((sum: number, t: any) => sum + (t.voteWeight || 0), 0);
              const forWeight = forVotes.reduce((sum: number, t: any) => sum + (t.voteWeight || 0), 0);
              const againstWeight = againstVotes.reduce((sum: number, t: any) => sum + (t.voteWeight || 0), 0);
              const abstainWeight = abstainVotes.reduce((sum: number, t: any) => sum + (t.voteWeight || 0), 0);

              const forPercent = totalWeight > 0 ? ((forWeight / totalWeight) * 100).toFixed(2) : '0';
              const againstPercent = totalWeight > 0 ? ((againstWeight / totalWeight) * 100).toFixed(2) : '0';
              const abstainPercent = totalWeight > 0 ? ((abstainWeight / totalWeight) * 100).toFixed(2) : '0';

              const reqMajority = parseFloat(resolution.requiredMajority || '50');
              const isApproved = parseFloat(forPercent) >= reqMajority;

              const voteResultBadge = isApproved
                ? '<span style="background:#dcfce7;color:#166534;padding:4px 12px;border-radius:12px;font-weight:700;font-size:12px;">✓ تمت الموافقة</span>'
                : '<span style="background:#fee2e2;color:#991b1b;padding:4px 12px;border-radius:12px;font-weight:700;font-size:12px;">✕ لم تتم الموافقة</span>';

              const votingDetailsRows = tokens.map((t: any, i: number) => {
                const voteLabel = t.vote === 'for' ? 'موافق' : t.vote === 'against' ? 'معارض' : t.vote === 'abstain' ? 'ممتنع' : 'لم يصوت';
                const voteColor = t.vote === 'for' ? '#166534' : t.vote === 'against' ? '#991b1b' : t.vote === 'abstain' ? '#92400e' : '#6b7280';
                const votedDate = t.votedAt ? new Date(t.votedAt).toLocaleDateString('ar-SA-u-ca-gregory') : '-';
                return `<tr>
                  <td style="text-align:center;">${i + 1}</td>
                  <td>${sanitize(t.shareholderName)}</td>
                  <td style="text-align:center;">${(t.voteWeight || 0).toLocaleString()}</td>
                  <td style="text-align:center;color:${voteColor};font-weight:600;">${voteLabel}</td>
                  <td style="text-align:center;">${votedDate}</td>
                </tr>`;
              }).join('');

              perResolutionSections.push(`
    <div style="margin-bottom:20px;border:1px solid #e5e5e5;border-radius:8px;padding:15px;">
      <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:5px;">${sanitize(resolution.resolutionNumber)} - ${sanitize(resolution.title)}</div>
      <div style="font-size:10px;color:#888;margin-bottom:10px;">الأغلبية المطلوبة: ${reqMajority}%</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">
        <div style="background:#dcfce7;border:1px solid #bbf7d0;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:9px;color:#166534;">موافق</div>
          <div style="font-size:16px;font-weight:700;color:#166534;">${forWeight.toLocaleString()}</div>
          <div style="font-size:9px;color:#166534;">${forPercent}%</div>
        </div>
        <div style="background:#fee2e2;border:1px solid #fecaca;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:9px;color:#991b1b;">معارض</div>
          <div style="font-size:16px;font-weight:700;color:#991b1b;">${againstWeight.toLocaleString()}</div>
          <div style="font-size:9px;color:#991b1b;">${againstPercent}%</div>
        </div>
        <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:9px;color:#92400e;">ممتنع</div>
          <div style="font-size:16px;font-weight:700;color:#92400e;">${abstainWeight.toLocaleString()}</div>
          <div style="font-size:9px;color:#92400e;">${abstainPercent}%</div>
        </div>
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:9px;color:#0c4a6e;">النتيجة</div>
          <div style="margin-top:3px;">${voteResultBadge}</div>
        </div>
      </div>
      <div style="font-size:10px;color:#666;margin-bottom:6px;">المصوتون: ${votedTokens.length} من ${tokens.length} مساهم | إجمالي الأصوات: ${totalWeight.toLocaleString()} سهم</div>
      <table>
        <thead>
          <tr><th>#</th><th>اسم المساهم</th><th>قوة التصويت (أسهم)</th><th>التصويت</th><th>تاريخ التصويت</th></tr>
        </thead>
        <tbody>${votingDetailsRows}</tbody>
      </table>
    </div>`);

              const signed = votedTokens.filter((t: any) => t.signatureData);
              allSignedTokens = [...allSignedTokens, ...signed];
            } catch {}
          }

          if (perResolutionSections.length > 0) {
            votingResultsHtml = `
  <div class="section" style="page-break-before: auto;">
    <div class="section-title">نتائج التصويت الإلكتروني (${perResolutionSections.length} قرار)</div>
    ${perResolutionSections.join('')}
  </div>`;
          }

          if (allSignedTokens.length > 0) {
            const uniqueSigned = allSignedTokens.filter((t: any, i: number, arr: any[]) =>
              arr.findIndex((x: any) => x.shareholderId === t.shareholderId) === i
            );
            const sigGridItems = uniqueSigned.map((t: any) => `
              <div style="border:1px solid #e5e5e5;border-radius:8px;padding:12px;text-align:center;background:#fafafa;">
                <div style="font-size:11px;font-weight:600;color:#333;margin-bottom:5px;">${sanitize(t.shareholderName)}</div>
                <div style="font-size:9px;color:#888;margin-bottom:8px;">عدد الأسهم: ${(t.voteWeight || 0).toLocaleString()} | التصويت: ${t.vote === 'for' ? 'موافق' : t.vote === 'against' ? 'معارض' : 'ممتنع'}</div>
                <img src="${t.signatureData}" alt="توقيع ${sanitize(t.shareholderName)}" style="max-width:180px;max-height:80px;border:1px solid #ddd;border-radius:4px;background:white;padding:4px;" />
                <div style="font-size:8px;color:#aaa;margin-top:5px;">تم التوقيع: ${t.votedAt ? new Date(t.votedAt).toLocaleDateString('ar-SA-u-ca-gregory') + ' ' + new Date(t.votedAt).toLocaleTimeString('ar-SA') : '-'}</div>
              </div>
            `).join('');

            shareholderSignaturesHtml = `
  <div class="section" style="page-break-before: auto;">
    <div class="section-title">توقيعات المساهمين الإلكترونية (${uniqueSigned.length} توقيع)</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
      ${sigGridItems}
    </div>
    <div style="margin-top:10px;padding:8px 12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;font-size:10px;color:#0c4a6e;text-align:center;">
      جميع التوقيعات أعلاه تم التحقق منها إلكترونياً عبر نظام التصويت الآمن لشركة الزبد الأفضل التجارية
    </div>
  </div>`;
          }
        }
      }
    } catch (err) {
      console.error('Error fetching voting data for print:', err);
    }

    const printContent = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>محضر ${sanitize(m.minutesNumber)} - شركة الزبد الأفضل التجارية</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; padding: 30px 40px; color: #1a1a1a; line-height: 1.8; font-size: 13px; direction: rtl; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #b8860b; padding-bottom: 15px; margin-bottom: 20px; }
    .header-right { text-align: right; }
    .header-left { text-align: left; }
    .logo { font-size: 22px; font-weight: 800; color: #b8860b; letter-spacing: 2px; }
    .company-name { font-size: 16px; font-weight: 700; color: #333; margin-top: 2px; }
    .company-name-en { font-size: 11px; color: #888; }
    .cr-number { font-size: 10px; color: #999; margin-top: 3px; }
    .date-box { text-align: left; font-size: 11px; }
    .date-box .label { color: #888; font-size: 9px; }
    .date-box .value { font-weight: 600; color: #333; }
    .doc-title { text-align: center; font-size: 18px; font-weight: 700; color: #b8860b; margin: 15px 0 5px; padding: 10px; background: linear-gradient(135deg, #fdf6e3 0%, #fff8e7 100%); border: 1px solid #e8d5a3; border-radius: 8px; }
    .doc-subtitle { text-align: center; font-size: 13px; color: #666; margin-bottom: 15px; }
    .doc-number { text-align: center; font-size: 12px; color: #666; margin-bottom: 20px; font-family: monospace; }
    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
    .info-item { background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 6px; padding: 10px; text-align: center; }
    .info-item .label { font-size: 10px; color: #888; margin-bottom: 3px; }
    .info-item .value { font-size: 12px; font-weight: 600; color: #333; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 14px; font-weight: 700; color: #b8860b; padding: 8px 12px; background: #fdf6e3; border-right: 4px solid #b8860b; border-radius: 0 6px 6px 0; margin-bottom: 10px; }
    .content-text { padding: 10px 15px; background: #fafafa; border: 1px solid #eee; border-radius: 6px; line-height: 2; text-align: justify; white-space: pre-wrap; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th { background: #b8860b; color: white; padding: 8px 10px; font-size: 11px; font-weight: 600; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
    tr:nth-child(even) td { background: #fafafa; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e5e5; }
    .sig-box { text-align: center; padding: 15px; }
    .sig-label { font-size: 10px; color: #888; margin-bottom: 5px; }
    .sig-name { font-size: 12px; font-weight: 600; margin-bottom: 20px; }
    .sig-line { border-bottom: 1px solid #999; width: 80%; margin: 0 auto; padding-top: 40px; }
    .footer { border-top: 2px solid #b8860b; padding-top: 10px; margin-top: 30px; display: flex; justify-content: space-between; font-size: 9px; color: #999; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 80px; color: rgba(184,134,11,0.04); font-weight: 800; pointer-events: none; z-index: -1; }
    @media print {
      body { padding: 15px 25px; }
      .watermark { display: block; }
      @page { margin: 10mm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="watermark">BUTTER BAKERY</div>
  
  <div class="header">
    <div class="header-right">
      <div class="logo">BUTTER BAKERY</div>
      <div class="company-name">شركة الزبد الأفضل التجارية</div>
      <div class="company-name-en">Butter Bakery Trading Co.</div>
      <div class="cr-number">سجل تجاري: 7026155296</div>
    </div>
    <div class="header-left">
      <div class="date-box">
        <div class="label">التاريخ الهجري</div>
        <div class="value">${hijriDate}هـ</div>
        <div class="label" style="margin-top:5px;">التاريخ الميلادي</div>
        <div class="value">${meetingDate.toLocaleDateString('en-GB')}</div>
      </div>
    </div>
  </div>

  <div class="doc-title">محضر ${sanitize(assemblyType)}</div>
  <div class="doc-subtitle">${sanitize(m.summary || meeting?.title || '')}</div>
  <div class="doc-number">رقم المحضر: ${sanitize(m.minutesNumber)}</div>

  <div class="info-grid">
    <div class="info-item">
      <div class="label">التاريخ</div>
      <div class="value">${gregorianDate}</div>
    </div>
    <div class="info-item">
      <div class="label">الوقت</div>
      <div class="value">${meeting?.startTime || '-'} - ${meeting?.endTime || '-'}</div>
    </div>
    <div class="info-item">
      <div class="label">نوع الانعقاد</div>
      <div class="value">${locationText}</div>
    </div>
    <div class="info-item">
      <div class="label">المكان</div>
      <div class="value">${sanitize(locationDetail) || '-'}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">الديباجة الرسمية</div>
    <div class="content-text" style="text-align: center; font-size: 14px; line-height: 2.2;">
      <strong>محضر ${sanitize(assemblyType)}</strong><br>
      المنعقدة يوم ${dayName} ${hijriDate}هـ الموافق ${gregorianShort}م<br>
      ${timeText} (${locationText})<br>
      ${locationDetail ? `المكان: ${sanitize(locationDetail)}` : ''}
    </div>
    <div style="margin-top: 10px; padding: 8px 15px; background: #fafafa; border: 1px solid #eee; border-radius: 6px; line-height: 2; text-align: justify;">
      بناءً على دعوة مجلس الإدارة الموجهة إلى مساهمي الشركة على عناوينهم المعتمدة لدى الشركة، انعقد اجتماع ${sanitize(assemblyType)} ${locationText} ${timeText} من التاريخ أعلاه، وذلك للنظر في جدول الأعمال التالي:
    </div>
  </div>

  ${contentWithFixedHijri ? `
  <div class="section">
    <div class="section-title">محتوى المحضر</div>
    <div class="content-text">${contentWithFixedHijri}</div>
  </div>` : ''}

  ${discussionPoints.length > 0 ? `
  <div class="section">
    <div class="section-title">جدول الأعمال</div>
    <div class="content-text">${discussionPoints.map((p: any, i: number) => `${i + 1}. ${sanitize(p.topic)}`).join('<br>')}</div>
  </div>` : ''}

  ${attendees.length > 0 ? `
  <div class="section">
    <div class="section-title">قائمة الحضور (${attendees.length} مساهم)</div>
    <table>
      <thead>
        <tr><th>#</th><th>اسم المساهم</th><th>عدد الأسهم</th><th>النسبة</th><th>الحالة</th><th>التوقيع</th></tr>
      </thead>
      <tbody>${attendeesRows}</tbody>
    </table>
  </div>` : ''}

  ${decisions.length > 0 ? `
  <div class="section">
    <div class="section-title">القرارات المتخذة (${decisions.length})</div>
    <div class="content-text">${decisionsHtml}</div>
  </div>` : ''}

  ${votingResultsHtml}

  ${shareholderSignaturesHtml}

  <div class="signatures">
    <div class="sig-box">
      <div class="sig-label">رئيس مجلس الإدارة</div>
      <div class="sig-name">________________</div>
      <div class="sig-line"></div>
      <div style="font-size:9px;color:#999;margin-top:5px;">التوقيع</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">أمين السر</div>
      <div class="sig-name">________________</div>
      <div class="sig-line"></div>
      <div style="font-size:9px;color:#999;margin-top:5px;">التوقيع</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">جامع الأصوات</div>
      <div class="sig-name">________________</div>
      <div class="sig-line"></div>
      <div style="font-size:9px;color:#999;margin-top:5px;">التوقيع</div>
    </div>
  </div>

  <div class="footer">
    <span>شركة الزبد الأفضل التجارية | سجل تجاري: 7026155296</span>
    <span>رقم المحضر: ${sanitize(m.minutesNumber)} | ${hijriFull} الموافق ${meetingDate.toLocaleDateString('en-GB')}</span>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const exportMinutesAsPdf = (m: MeetingMinutes) => {
    printMinutes(m);
  };

  const assemblyMeetingIds = new Set(
    meetings
      .filter(m => m.meetingType === "ordinary_assembly" || m.meetingType === "extraordinary_assembly")
      .map(m => m.id)
  );

  const assemblyMinutes = minutes.filter(m => assemblyMeetingIds.has(m.meetingId));

  const filteredMinutes = activeTab === "all"
    ? assemblyMinutes
    : assemblyMinutes.filter(m => m.status === activeTab);

  const getMeetingForMinutes = (meetingId: number) => meetings.find(m => m.id === meetingId);

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return date;
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/governance">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-xl">
                <FileText className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-emerald-800">محاضر الجمعيات العمومية</h1>
                <p className="text-sm text-gray-500">توثيق وأرشفة محاضر اجتماعات الجمعية العمومية والقرارات</p>
              </div>
            </div>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4" />
            إنشاء محضر جديد
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 text-center">
              <FileText className="h-6 w-6 text-blue-500 mx-auto mb-1" />
              <p className="text-xs text-blue-600">إجمالي المحاضر</p>
              <p className="text-xl font-bold text-blue-800">{assemblyMinutes.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-4 text-center">
              <Edit className="h-6 w-6 text-gray-500 mx-auto mb-1" />
              <p className="text-xs text-gray-600">مسودات</p>
              <p className="text-xl font-bold text-gray-800">{assemblyMinutes.filter(m => m.status === "draft").length}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-1" />
              <p className="text-xs text-green-600">موقّعة</p>
              <p className="text-xl font-bold text-green-800">{assemblyMinutes.filter(m => m.status === "signed").length}</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4 text-center">
              <Users className="h-6 w-6 text-purple-500 mx-auto mb-1" />
              <p className="text-xs text-purple-600">المساهمين</p>
              <p className="text-xl font-bold text-purple-800">{shareholders.filter(s => s.votingRights).length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">الكل ({assemblyMinutes.length})</TabsTrigger>
            <TabsTrigger value="draft">مسودات ({assemblyMinutes.filter(m => m.status === "draft").length})</TabsTrigger>
            <TabsTrigger value="signed">موقّعة ({assemblyMinutes.filter(m => m.status === "signed").length})</TabsTrigger>
            <TabsTrigger value="archived">مؤرشفة ({assemblyMinutes.filter(m => m.status === "archived").length})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">جاري التحميل...</CardContent>
              </Card>
            ) : filteredMinutes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg mb-2">لا توجد محاضر جمعيات</p>
                  <p className="text-sm mb-4">ابدأ بإنشاء محضر جمعية عمومية جديد</p>
                  <Button onClick={() => setShowCreate(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    إنشاء محضر جديد
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredMinutes.map((m) => {
                  const meeting = getMeetingForMinutes(m.meetingId);
                  return (
                    <Card key={m.id} className="hover:shadow-lg transition-shadow" data-testid={`minutes-card-${m.id}`}>
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant="outline" className="font-mono text-xs">{m.minutesNumber}</Badge>
                              {getStatusBadge(m.status)}
                              {meeting && (
                                <Badge variant="outline" className="text-xs">
                                  {getAssemblyTypeLabel(meeting.meetingType)}
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-semibold text-lg">{m.summary || meeting?.title || "محضر جمعية"}</h3>
                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                              {meeting && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  <span>{formatDate(meeting.meetingDate)}</span>
                                </div>
                              )}
                              {m.attendanceList && Array.isArray(m.attendanceList) && (
                                <div className="flex items-center gap-1">
                                  <Users className="h-4 w-4" />
                                  <span>{m.attendanceList.length} حاضر</span>
                                </div>
                              )}
                              {m.decisions && Array.isArray(m.decisions) && (
                                <div className="flex items-center gap-1">
                                  <Gavel className="h-4 w-4" />
                                  <span>{m.decisions.length} قرار</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-wrap items-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => { setSelectedMinutes(m); setShowDetails(true); }}
                              data-testid={`view-minutes-${m.id}`}
                            >
                              <Eye className="h-4 w-4" />
                              عرض
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => printMinutes(m)}
                              data-testid={`print-minutes-${m.id}`}
                            >
                              <Printer className="h-4 w-4" />
                              طباعة
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => exportMinutesAsPdf(m)}
                              data-testid={`export-minutes-${m.id}`}
                            >
                              <Download className="h-4 w-4" />
                              تصدير
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={async () => {
                                const linkedRes = resolutions.find(r =>
                                  r.title === (m.summary || meeting?.title) &&
                                  (r.resolutionType === "general_assembly" || r.resolutionType === "extraordinary_assembly")
                                );
                                if (linkedRes) {
                                  if (linkedRes.status !== 'voting' && linkedRes.status !== 'approved' && linkedRes.status !== 'rejected') {
                                    await fetch(`/api/governance/resolutions/${linkedRes.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      credentials: 'include',
                                      body: JSON.stringify({ status: 'voting' }),
                                    });
                                    queryClient.invalidateQueries({ queryKey: ["/api/governance/resolutions"] });
                                  }
                                  setLocation('/governance/voting');
                                } else {
                                  toast({ title: "لا يوجد قرار مرتبط بهذا المحضر للتصويت عليه", variant: "destructive" });
                                }
                              }}
                              data-testid={`vote-minutes-${m.id}`}
                            >
                              <Vote className="h-4 w-4" />
                              التصويت
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="px-2" data-testid={`actions-minutes-${m.id}`}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                {m.status === "draft" && (
                                  <DropdownMenuItem
                                    onClick={() => updateMinutesStatusMutation.mutate({ id: m.id, status: "pending_review" })}
                                    data-testid={`status-review-${m.id}`}
                                  >
                                    <FileCheck className="h-4 w-4 ml-2" />
                                    إرسال للمراجعة
                                  </DropdownMenuItem>
                                )}
                                {m.status === "pending_review" && (
                                  <DropdownMenuItem
                                    onClick={() => updateMinutesStatusMutation.mutate({ id: m.id, status: "pending_signature" })}
                                    data-testid={`status-sign-${m.id}`}
                                  >
                                    <FilePen className="h-4 w-4 ml-2" />
                                    جاهز للتوقيع
                                  </DropdownMenuItem>
                                )}
                                {m.status === "pending_signature" && (
                                  <DropdownMenuItem
                                    onClick={() => updateMinutesStatusMutation.mutate({ id: m.id, status: "signed" })}
                                    data-testid={`status-signed-${m.id}`}
                                  >
                                    <CheckCircle className="h-4 w-4 ml-2" />
                                    تم التوقيع
                                  </DropdownMenuItem>
                                )}
                                {m.status !== "archived" && m.status !== "draft" && (
                                  <DropdownMenuItem
                                    onClick={() => updateMinutesStatusMutation.mutate({ id: m.id, status: "archived" })}
                                    data-testid={`status-archive-${m.id}`}
                                  >
                                    <Archive className="h-4 w-4 ml-2" />
                                    أرشفة
                                  </DropdownMenuItem>
                                )}
                                {m.status !== "draft" && (
                                  <DropdownMenuItem
                                    onClick={() => updateMinutesStatusMutation.mutate({ id: m.id, status: "draft" })}
                                    data-testid={`status-draft-${m.id}`}
                                  >
                                    <Edit className="h-4 w-4 ml-2" />
                                    إعادة لمسودة
                                  </DropdownMenuItem>
                                )}
                                {isAdmin && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600 focus:text-red-600"
                                      onClick={() => setDeleteMinutesId(m.id)}
                                      data-testid={`delete-minutes-${m.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 ml-2" />
                                      حذف المحضر
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-emerald-600" />
                إنشاء محضر جمعية عمومية
              </DialogTitle>
              <DialogDescription>
                أنشئ محضر اجتماع جمعية عمومية متكامل مع إمكانية إنشاء قرار للتصويت عليه من المساهمين
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>نوع الجمعية *</Label>
                  <Select
                    value={form.assemblyType}
                    onValueChange={(v) => setForm({ ...form, assemblyType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ordinary_assembly">جمعية عمومية عادية</SelectItem>
                      <SelectItem value="extraordinary_assembly">جمعية عمومية غير عادية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>عنوان المحضر *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="مثال: محضر اجتماع الجمعية العمومية العادية 2026"
                  />
                </div>
              </div>

              <Separator />
              <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                تفاصيل الاجتماع
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>تاريخ الاجتماع *</Label>
                  <Input
                    type="date"
                    value={form.meetingDate}
                    onChange={(e) => setForm({ ...form, meetingDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>وقت البدء</Label>
                  <Input
                    type="time"
                    value={form.meetingTime}
                    onChange={(e) => setForm({ ...form, meetingTime: e.target.value })}
                  />
                </div>
                <div>
                  <Label>وقت الانتهاء</Label>
                  <Input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>نوع الانعقاد</Label>
                  <Select
                    value={form.locationType}
                    onValueChange={(v) => setForm({ ...form, locationType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_person">حضوري</SelectItem>
                      <SelectItem value="virtual">عن بُعد (إلكتروني)</SelectItem>
                      <SelectItem value="hybrid">مختلط</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>المكان / رابط الاجتماع</Label>
                  {form.locationType === "in_person" ? (
                    <Input
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="قاعة الاجتماعات الرئيسية"
                    />
                  ) : (
                    <Input
                      value={form.virtualMeetingLink}
                      onChange={(e) => setForm({ ...form, virtualMeetingLink: e.target.value })}
                      placeholder="https://..."
                    />
                  )}
                </div>
              </div>

              <div>
                <Label>النصاب المطلوب (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.quorumRequired}
                  onChange={(e) => setForm({ ...form, quorumRequired: e.target.value })}
                />
              </div>

              <Separator />
              <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                <Gavel className="h-4 w-4" />
                جدول الأعمال
              </h3>

              <div>
                <Textarea
                  value={form.agenda}
                  onChange={(e) => setForm({ ...form, agenda: e.target.value })}
                  placeholder={"1. الموضوع الأول\n2. الموضوع الثاني\n3. الموضوع الثالث"}
                  rows={5}
                />
              </div>

              <Separator />
              <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                محتوى المحضر
              </h3>

              <div>
                <Textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="اكتب نص محضر الاجتماع الكامل هنا..."
                  rows={10}
                />
              </div>

              <Separator />
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                  <Gavel className="h-4 w-4" />
                  القرارات المتخذة
                </h3>
                <Button variant="outline" size="sm" onClick={addDecision} className="gap-1">
                  <Plus className="h-3 w-3" />
                  إضافة قرار
                </Button>
              </div>

              {form.decisions.map((decision, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <span className="mt-2 text-sm font-mono text-gray-400 min-w-[24px]">{index + 1}.</span>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="md:col-span-2">
                      <Input
                        value={decision.description}
                        onChange={(e) => updateDecision(index, "description", e.target.value)}
                        placeholder="نص القرار"
                      />
                    </div>
                    <div>
                      <Input
                        value={decision.responsible}
                        onChange={(e) => updateDecision(index, "responsible", e.target.value)}
                        placeholder="المسؤول عن التنفيذ"
                      />
                    </div>
                  </div>
                  {form.decisions.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeDecision(index)} className="mt-1">
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  )}
                </div>
              ))}

              <Separator />
              <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                <Users className="h-4 w-4" />
                المساهمين ({shareholders.filter(s => s.votingRights).length} مساهم - إجمالي الأسهم: {totalShares.toLocaleString()})
              </h3>

              <Card className="bg-gray-50">
                <CardContent className="p-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المساهم</TableHead>
                        <TableHead className="text-right">عدد الأسهم</TableHead>
                        <TableHead className="text-right">النسبة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shareholders.filter(s => s.votingRights).map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-sm">{s.fullName}</TableCell>
                          <TableCell className="text-sm">{(s.numberOfShares || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-sm">
                            {totalShares > 0 ? ((s.numberOfShares || 0) / totalShares * 100).toFixed(2) : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Separator />
              <Card className={form.createResolution ? "bg-emerald-50 border-emerald-300" : "bg-gray-50"}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={form.createResolution}
                      onCheckedChange={(checked) => setForm({ ...form, createResolution: !!checked })}
                    />
                    <div>
                      <p className="font-semibold text-sm">إنشاء قرار للتصويت الإلكتروني</p>
                      <p className="text-xs text-gray-500">
                        سيتم إنشاء قرار تلقائياً مرتبط بهذا المحضر ليتمكن جميع المساهمين من التصويت عليه إلكترونياً
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>إلغاء</Button>
              <Button
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => createMinutesMutation.mutate(form)}
                disabled={!form.title || !form.meetingDate || !form.content || createMinutesMutation.isPending}
              >
                {createMinutesMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الإنشاء...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    إنشاء المحضر
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedMinutes && (() => {
              const meeting = getMeetingForMinutes(selectedMinutes.meetingId);
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-emerald-600" />
                      {selectedMinutes.summary || meeting?.title || "محضر الجمعية"}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono">{selectedMinutes.minutesNumber}</Badge>
                      {getStatusBadge(selectedMinutes.status)}
                      {meeting && <Badge variant="outline">{getAssemblyTypeLabel(meeting.meetingType)}</Badge>}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex gap-2 mb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => printMinutes(selectedMinutes)}
                      data-testid="detail-print-minutes"
                    >
                      <Printer className="h-4 w-4" />
                      طباعة المحضر
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => exportMinutesAsPdf(selectedMinutes)}
                      data-testid="detail-export-minutes"
                    >
                      <Download className="h-4 w-4" />
                      تصدير PDF
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {meeting && (
                      <Card>
                        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-gray-500 text-xs">التاريخ</p>
                            <p className="font-medium">{formatDate(meeting.meetingDate)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">الوقت</p>
                            <p className="font-medium">{meeting.startTime || "-"} - {meeting.endTime || "-"}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">نوع الانعقاد</p>
                            <p className="font-medium">
                              {meeting.locationType === "virtual" ? "عن بُعد" : meeting.locationType === "hybrid" ? "مختلط" : "حضوري"}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">المكان</p>
                            <p className="font-medium">{meeting.location || meeting.virtualMeetingLink || "-"}</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {selectedMinutes.content && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          محتوى المحضر
                        </h4>
                        <Card>
                          <CardContent className="p-4 text-sm whitespace-pre-wrap leading-7">
                            {selectedMinutes.content}
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {selectedMinutes.attendanceList && Array.isArray(selectedMinutes.attendanceList) && selectedMinutes.attendanceList.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          قائمة الحضور ({selectedMinutes.attendanceList.length})
                        </h4>
                        <Card>
                          <CardContent className="p-3">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-right">الاسم</TableHead>
                                  <TableHead className="text-right">الأسهم</TableHead>
                                  <TableHead className="text-right">النسبة</TableHead>
                                  <TableHead className="text-right">التوقيع</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {selectedMinutes.attendanceList.map((a: any, i: number) => {
                                  const hasSig = typeof a.signatureUrl === 'string' && a.signatureUrl.startsWith('data:image/');
                                  const isPresent = !a.status || a.status === 'present' || a.status === 'proxy';
                                  return (
                                    <TableRow key={i}>
                                      <TableCell className="font-medium text-sm">{a.name}</TableCell>
                                      <TableCell className="text-sm">{(a.shares || 0).toLocaleString()}</TableCell>
                                      <TableCell className="text-sm">{a.percentage}%</TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          {hasSig && (
                                            <img
                                              src={a.signatureUrl}
                                              alt="توقيع"
                                              className="h-8 w-20 object-contain border rounded bg-white"
                                              data-testid={`img-attendee-signature-${i}`}
                                            />
                                          )}
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            disabled={!isPresent}
                                            onClick={() => setSigningAttendeeIndex(i)}
                                            data-testid={`button-sign-attendee-${i}`}
                                          >
                                            {hasSig ? 'تعديل' : 'توقيع'}
                                          </Button>
                                          {hasSig && (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                                              onClick={() => {
                                                if (!selectedMinutes) return;
                                                const next = (selectedMinutes.attendanceList as any[]).map((x, idx) =>
                                                  idx === i ? { ...x, signatureUrl: null, signedAt: null } : x
                                                );
                                                updateAttendanceListMutation.mutate({ id: selectedMinutes.id, attendanceList: next });
                                              }}
                                              data-testid={`button-clear-attendee-signature-${i}`}
                                            >
                                              مسح
                                            </Button>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {selectedMinutes.decisions && Array.isArray(selectedMinutes.decisions) && selectedMinutes.decisions.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <Gavel className="h-4 w-4" />
                          القرارات المتخذة ({selectedMinutes.decisions.length})
                        </h4>
                        <div className="space-y-2">
                          {selectedMinutes.decisions.map((d: any, i: number) => (
                            <Card key={i}>
                              <CardContent className="p-3">
                                <div className="flex items-start gap-2">
                                  <span className="font-mono text-gray-400 text-sm mt-0.5">{d.number || i + 1}.</span>
                                  <div>
                                    <p className="text-sm">{d.description}</p>
                                    {d.responsible && (
                                      <p className="text-xs text-gray-500 mt-1">المسؤول: {d.responsible}</p>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        <Dialog open={signingAttendeeIndex !== null} onOpenChange={(open) => { if (!open) setSigningAttendeeIndex(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>توقيع المساهم</DialogTitle>
              <DialogDescription>
                {selectedMinutes && signingAttendeeIndex !== null
                  ? (selectedMinutes.attendanceList as any[])?.[signingAttendeeIndex]?.name
                  : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white">
              <SignatureCanvas
                ref={(ref) => { sigPadRef.current = ref; }}
                penColor="black"
                backgroundColor="rgba(255,255,255,1)"
                canvasProps={{ className: "w-full h-48 rounded-lg", "data-testid": "canvas-attendee-signature" } as any}
              />
            </div>
            <p className="text-xs text-gray-500 text-center">ارسم التوقيع بالإصبع أو الفأرة في المساحة أعلاه</p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => sigPadRef.current?.clear()} data-testid="button-clear-attendee-canvas">مسح</Button>
              <Button variant="outline" onClick={() => setSigningAttendeeIndex(null)} data-testid="button-cancel-attendee-signature">إلغاء</Button>
              <Button
                onClick={() => {
                  if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
                    toast({ title: "يرجى رسم التوقيع أولاً", variant: "destructive" });
                    return;
                  }
                  if (!selectedMinutes || signingAttendeeIndex === null) return;
                  const dataUrl = sigPadRef.current.toDataURL("image/png");
                  const next = (selectedMinutes.attendanceList as any[]).map((x, idx) =>
                    idx === signingAttendeeIndex ? { ...x, signatureUrl: dataUrl, signedAt: new Date().toISOString() } : x
                  );
                  updateAttendanceListMutation.mutate(
                    { id: selectedMinutes.id, attendanceList: next },
                    { onSuccess: () => setSigningAttendeeIndex(null) }
                  );
                }}
                disabled={updateAttendanceListMutation.isPending}
                data-testid="button-save-attendee-signature"
              >
                {updateAttendanceListMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ التوقيع"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteMinutesId !== null} onOpenChange={(open) => !open && setDeleteMinutesId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد حذف المحضر</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف هذا المحضر؟ لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => deleteMinutesId && deleteMinutesMutation.mutate(deleteMinutesId)}
                data-testid="confirm-delete-minutes"
              >
                {deleteMinutesMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "حذف"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
