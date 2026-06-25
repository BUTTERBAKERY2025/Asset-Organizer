// مولّد قرار الجمعية العمومية الرسمي القابل للطباعة والتصدير PDF
// Official General Assembly Resolution Printer (formal legal-prose layout)

import { getCompanyLogoDataUri } from "./company-logo-data";
import { renderToPrintWindow, openPrintWindow, type PrintTarget } from "./print-window";

export interface PrintSignature {
  id: number;
  memberName?: string;
  memberPosition?: string;
  signatureData?: string | null;
  status: string;
  signedAt?: string | null;
  signerType?: string | null;
}

export interface PrintVote {
  id: number;
  voterName: string;
  voterType: string;
  vote: string; // for | against | abstain
  votingPower?: string | null;
  weightedVote?: string | null;
  votedAt?: string | null;
  comments?: string | null;
}

export interface PrintResolution {
  id: number;
  resolutionNumber: string;
  title: string;
  description?: string | null;
  resolutionType: string;
  category?: string | null;
  status: string;
  forVotes?: number | null;
  againstVotes?: number | null;
  abstainVotes?: number | null;
  totalVotes?: number | null;
  requiredMajority?: string | null;
  approvedAt?: string | null;
  createdAt?: string | null;
  notes?: string | null;
}

export interface PrintMeeting {
  id?: number;
  title?: string;
  meetingType?: string; // ordinary_assembly | extraordinary_assembly | ordinary | extraordinary
  meetingNumber?: string;
  meetingDate?: string;
  scheduledDate?: string;
  startTime?: string;
  location?: string;
  quorumRequired?: number;
}

export interface CompanyInfo {
  nameAr?: string;
  nameEn?: string;
  cr?: string;
  details?: string;
  city?: string;
}

const DEFAULT_COMPANY: Required<CompanyInfo> = {
  nameAr: "شركة الزبد الأفضل التجارية",
  nameEn: "THE BUTTER BEST TRADING COMPANY",
  cr: "7026155296",
  details: "شركة مساهمة مقفلة | المملكة العربية السعودية",
  city: "خميس مشيط",
};

const meetingTypeLabel = (t?: string) => {
  switch (t) {
    case "extraordinary":
    case "extraordinary_assembly":
      return "جمعية عمومية غير عادية";
    case "ordinary":
    case "ordinary_assembly":
      return "جمعية عمومية عادية";
    default:
      return "جمعية عمومية";
  }
};

// اسم الجمعية بصيغة المحضر الرسمي
const assemblyName = (t?: string) => {
  if (t && t.includes("extraordinary")) return "الجمعية العامة غير العادية";
  if (t && (t.includes("ordinary") || t.includes("general_assembly"))) return "الجمعية العامة العادية";
  return "الجمعية العامة";
};

const resolutionTypeLabel = (t: string) => {
  const map: Record<string, string> = {
    ordinary: "قرار عادي",
    extraordinary: "قرار استثنائي",
    general_assembly: "قرار جمعية عمومية عادية",
    extraordinary_assembly: "قرار جمعية عمومية غير عادية",
    regular: "قرار عادي",
    dividend: "توزيع أرباح",
    capital_change: "تعديل رأس المال",
    statute_amendment: "تعديل النظام الأساس",
    merger: "اندماج",
    dissolution: "تصفية/حل",
    board_election: "انتخاب مجلس الإدارة",
    strategic: "قرار استراتيجي",
    financial: "قرار مالي",
    administrative: "قرار إداري",
  };
  return map[t] || t;
};

const statusBadge = (s: string) => {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    approved: { label: "✓ تم اعتماد القرار", bg: "#e8f5e9", color: "#2e7d32" },
    implemented: { label: "✓ تم التنفيذ", bg: "#e8f5e9", color: "#1b5e20" },
    rejected: { label: "✗ تم رفض القرار", bg: "#ffebee", color: "#c62828" },
    voting: { label: "⏳ تحت التصويت", bg: "#fff3e0", color: "#e65100" },
    proposed: { label: "📋 مقترح", bg: "#e3f2fd", color: "#1565c0" },
    draft: { label: "📝 مسودة", bg: "#f5f5f5", color: "#616161" },
  };
  return map[s] || { label: s, bg: "#f5f5f5", color: "#333" };
};

const voteLabel = (v: string) => (v === "for" ? "موافق" : v === "against" ? "معارض" : v === "abstain" ? "ممتنع" : v);
const voteColor = (v: string) =>
  v === "for" ? "#2e7d32" : v === "against" ? "#c62828" : v === "abstain" ? "#e65100" : "#666";

const nf = (n: number) => n.toLocaleString("ar-SA-u-nu-latn");
// تنسيق رقمي آمن: يعيد "-" إذا كانت القيمة غير رقمية لتفادي ظهور NaN في الوثيقة الرسمية
const nfSafe = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? nf(n) : "-";
};

const fmtDate = (d?: string | null) => {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "-";
  }
};
const fmtHijri = (d?: string | null) => {
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { year: "numeric", month: "long", day: "numeric" }).format(new Date(d));
  } catch {
    return "";
  }
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));

// التحقق من أن بيانات التوقيع رابط آمن (data:image/* أو https) لمنع XSS عبر img src
const safeImageSrc = (src?: string | null): string | null => {
  if (!src || typeof src !== "string") return null;
  const trimmed = src.trim();
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) return trimmed;
  if (/^https:\/\/[^\s"'<>]+$/i.test(trimmed)) return trimmed;
  return null;
};

export function buildAssemblyResolutionHtml(
  resolution: PrintResolution,
  signatures: PrintSignature[],
  votes: PrintVote[],
  meeting?: PrintMeeting,
  company?: CompanyInfo,
  logoDataUri?: string | null
): string {
  const co = { ...DEFAULT_COMPANY, ...(company || {}) };
  const legalForm = (co.details.split("|")[0] || "").trim() || "شركة مساهمة مقفلة";
  const asmName = assemblyName(meeting?.meetingType || resolution.resolutionType);
  const st = statusBadge(resolution.status);

  const meetingDate = meeting?.meetingDate || meeting?.scheduledDate || resolution.approvedAt || resolution.createdAt;
  const greg = fmtDate(meetingDate);
  const hijri = fmtHijri(meetingDate);

  const votesFor = resolution.forVotes ?? votes.filter((v) => v.vote === "for").length;
  const votesAgainst = resolution.againstVotes ?? votes.filter((v) => v.vote === "against").length;
  const votesAbstain = resolution.abstainVotes ?? votes.filter((v) => v.vote === "abstain").length;
  const unanimous = votesAgainst === 0 && votesAbstain === 0 && (votesFor > 0 || votes.length > 0);
  const resultText = unanimous
    ? "تمت الموافقة على هذا القرار بالإجماع من الأصوات الحاضرة والممثَّلة في الاجتماع."
    : `تمت الموافقة على هذا القرار بأغلبية الأصوات (موافق: ${nf(votesFor)} — معارض: ${nf(votesAgainst)} — ممتنع: ${nf(votesAbstain)}).`;

  const statusNote =
    resolution.status === "rejected"
      ? "تم رفض هذا القرار."
      : resolution.status === "approved" || resolution.status === "implemented"
      ? "وقد صدر هذا القرار معتمداً وفقاً للأنظمة المرعية."
      : "";

  const description = (resolution.description || "").trim();

  const votersRowsHtml = votes.length
    ? votes
        .map(
          (v, i) => `
          <tr>
            <td style="text-align:center;">${i + 1}</td>
            <td>${escapeHtml(v.voterName)}</td>
            <td style="text-align:center;">${v.voterType === "shareholder" ? "مساهم" : v.voterType === "board_member" ? "عضو مجلس" : escapeHtml(v.voterType)}</td>
            <td style="text-align:center;color:${voteColor(v.vote)};font-weight:700;">${voteLabel(v.vote)}</td>
            <td style="text-align:center;">${v.votingPower ? nfSafe(v.votingPower) : "-"}</td>
            <td style="text-align:center;font-size:8.5pt;color:#666;">${fmtDate(v.votedAt)}</td>
          </tr>`
        )
        .join("")
    : "";

  const votersTableHtml = votes.length
    ? `
      <table class="att">
        <thead>
          <tr>
            <th style="width:34px;">م</th>
            <th>الاسم</th>
            <th style="width:90px;">الصفة</th>
            <th style="width:80px;">التصويت</th>
            <th style="width:90px;">عدد الأسهم</th>
            <th style="width:110px;">التاريخ</th>
          </tr>
        </thead>
        <tbody>${votersRowsHtml}</tbody>
      </table>`
    : "";

  const signaturesHtml = signatures.length
    ? `<div class="sig-cards">${signatures
        .map((sig) => {
          const safe = sig.status === "signed" ? safeImageSrc(sig.signatureData) : null;
          const box = safe
            ? `<img class="sig-img" src="${safe}" alt="توقيع ${escapeHtml(sig.memberName || "")}" />`
            : sig.status === "declined"
            ? `<div class="sig-empty">رفض التوقيع</div>`
            : sig.status === "signed"
            ? `<div class="sig-empty">توقيع غير صالح</div>`
            : `<div class="sig-line">التوقيع: ................</div>`;
          return `
          <div class="sig-card">
            <div class="sig-name">${escapeHtml(sig.memberName || "—")}</div>
            <div class="sig-role">(${escapeHtml(sig.memberPosition || (sig.signerType === "shareholder" ? "مساهم" : "عضو مجلس"))})</div>
            ${box}
            ${sig.status === "signed" && sig.signedAt ? `<div class="sig-date">${fmtDate(sig.signedAt)}</div>` : ""}
          </div>`;
        })
        .join("")}</div>`
    : `<div class="sig-grid">
        <div class="sig-col">
          <div class="sig-title">رئيس ${escapeHtml(asmName)}</div>
          <div class="sig-name">(__________)</div>
          <div class="sig-role">(رئيس مجلس الإدارة)</div>
          <div class="sig-line">التوقيع: ........................</div>
        </div>
        <div class="sig-col">
          <div class="sig-title">أمين سر ${escapeHtml(asmName)}</div>
          <div class="sig-name">(__________)</div>
          <div class="sig-role">(أمين سر مجلس الإدارة)</div>
          <div class="sig-line">التوقيع: ........................</div>
        </div>
      </div>`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8" />
<title>قرار ${escapeHtml(asmName)} رقم ${escapeHtml(resolution.resolutionNumber)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
  @page { size: A4; margin: 16mm 16mm 16mm 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: 'Cairo', sans-serif; direction: rtl; background: white; color: #1a1a1a; line-height: 1.9; font-size: 11pt; }
  .watermark { position: fixed; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; opacity: 0.05; z-index: 0; pointer-events: none; }
  .watermark img { width: 360px; height: 360px; object-fit: contain; }
  .page-wrap { width: 100%; max-width: 182mm; margin: 0 auto; border-collapse: collapse; position: relative; z-index: 1; }
  .page-wrap > thead > tr > td, .page-wrap > tbody > tr > td { padding: 0; border: none; background: transparent; }
  .page-wrap > tbody > tr { page-break-inside: auto; break-inside: auto; }
  .letterhead { text-align: center; border-bottom: 2.5px solid #1a5f3c; padding-bottom: 8px; margin-bottom: 4px; }
  .lh-row { display: flex; align-items: center; justify-content: center; gap: 14px; }
  .lh-logo { width: 62px; height: 62px; object-fit: contain; }
  .lh-co-ar { font-size: 15pt; font-weight: 800; color: #1a3a2f; }
  .lh-co-en { font-size: 8pt; color: #666; letter-spacing: 1px; }
  .lh-co-meta { font-size: 8.5pt; color: #555; margin-top: 2px; }
  .doc-title { text-align: center; font-size: 14pt; font-weight: 800; color: #1a3a2f; margin: 16px 0 4px; }
  .doc-meta-line { text-align: center; font-size: 10pt; color: #555; margin-bottom: 6px; }
  .status-line { text-align: center; font-weight: 800; color: ${st.color}; margin-bottom: 8px; }
  .preamble { text-align: justify; font-size: 11pt; line-height: 2.05; margin: 12px 2px; }
  .sec { margin-top: 16px; }
  .sec-h { font-size: 12pt; font-weight: 800; color: #1a5f3c; border-right: 4px solid #1a5f3c; padding-right: 8px; margin-bottom: 6px; }
  .sec-p { text-align: justify; line-height: 2.05; margin-bottom: 6px; }
  .res-h { font-weight: 800; color: #1a3a2f; font-size: 11.5pt; margin-bottom: 6px; }
  .res-body { text-align: justify; line-height: 2.05; white-space: pre-wrap; }
  table.att { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 8px 0; }
  table.att th { background: #1a5f3c; color: #fff; padding: 6px 5px; font-weight: 700; border: 1px solid #14492f; }
  table.att td { padding: 5px 6px; border: 1px solid #cfd8d3; vertical-align: middle; }
  table.att tr:nth-child(even) td { background: #f6f9f7; }
  table.att tr { page-break-inside: avoid; break-inside: avoid; }
  .sig-grid { display: flex; justify-content: space-around; gap: 30px; margin-top: 34px; page-break-inside: avoid; break-inside: avoid; }
  .sig-col { text-align: center; flex: 1; }
  .sig-cards { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 18px; }
  .sig-card { flex: 1 1 200px; min-width: 180px; text-align: center; border: 1px solid #cfd8d3; border-radius: 8px; padding: 12px 10px; page-break-inside: avoid; break-inside: avoid; }
  .sig-title { font-weight: 800; color: #1a3a2f; margin-bottom: 6px; }
  .sig-name { font-weight: 700; margin-bottom: 2px; }
  .sig-role { font-size: 9pt; color: #555; margin-bottom: 18px; }
  .sig-img { max-height: 50px; max-width: 140px; object-fit: contain; display: block; margin: 0 auto 4px; }
  .sig-empty { color: #999; font-size: 9pt; margin: 10px 0; }
  .sig-date { font-size: 8.5pt; color: #777; margin-top: 4px; }
  .sig-line { font-size: 10pt; color: #333; margin-top: 8px; }
  .footer { margin-top: 22px; padding-top: 8px; border-top: 1.5px solid #1a5f3c; font-size: 8pt; color: #666; display: flex; justify-content: space-between; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
  ${logoDataUri ? `<div class="watermark"><img src="${logoDataUri}" alt="" /></div>` : ""}
  <table class="page-wrap">
    <thead>
      <tr>
        <td>
          <div class="letterhead">
            <div class="lh-row">
              ${logoDataUri ? `<img class="lh-logo" src="${logoDataUri}" alt="${escapeHtml(co.nameAr)}" />` : ""}
              <div>
                <div class="lh-co-ar">${escapeHtml(co.nameAr)}</div>
                <div class="lh-co-en">${escapeHtml(co.nameEn)}</div>
                <div class="lh-co-meta">${escapeHtml(co.details)} — س.ت ${escapeHtml(co.cr)}${co.city ? ` — مدينة ${escapeHtml(co.city)}` : ""}</div>
              </div>
            </div>
          </div>
        </td>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>

          <div class="doc-title">قرار ${escapeHtml(asmName)}</div>
          <div class="doc-meta-line">رقم القرار: ${escapeHtml(resolution.resolutionNumber)}${greg !== "-" ? ` — بتاريخ ${escapeHtml(greg)}` : ""}</div>
          <div class="status-line">${escapeHtml(st.label)}</div>

          <div class="preamble">إنه بناءً على ما تم عرضه ومناقشته في اجتماع ${escapeHtml(asmName)} لـ${escapeHtml(co.nameAr)} (${escapeHtml(legalForm)})${greg !== "-" ? ` المنعقد بتاريخ (${escapeHtml(greg)})` : ""}${hijri ? ` الموافق (${escapeHtml(hijri)})` : ""}${meeting?.location ? ` في ${escapeHtml(meeting.location)}` : ""}، وبعد المداولة، أصدرت ${escapeHtml(asmName)} القرار التالي:</div>

          <div class="sec">
            <div class="sec-h">نص القرار</div>
            <div class="res-h">${escapeHtml(resolution.title)}</div>
            ${description ? `<div class="res-body">${escapeHtml(description).replace(/\n/g, "<br/>")}</div>` : `<div class="sec-p">—</div>`}
          </div>

          <div class="sec">
            <div class="sec-h">نتيجة التصويت</div>
            <div class="sec-p">${resultText}${statusNote ? ` ${statusNote}` : ""}</div>
            ${votersTableHtml}
          </div>

          ${resolution.notes ? `<div class="sec"><div class="sec-h">ملاحظات</div><div class="sec-p" style="white-space:pre-wrap;">${escapeHtml(resolution.notes)}</div></div>` : ""}

          <div class="sec">
            <div class="sec-h">التوقيعات</div>
            ${signaturesHtml}
          </div>

          <div class="footer">
            <div>${escapeHtml(co.nameAr)} — س.ت ${escapeHtml(co.cr)}</div>
            <div>وثيقة رسمية — تم الإصدار: ${new Date().toLocaleDateString("ar-SA-u-nu-latn")}</div>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
  <script>window.addEventListener('load',function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},400);});</script>
</body>
</html>`;
}

export async function fetchResolutionPrintData(resolutionId: number): Promise<{ signatures: PrintSignature[]; votes: PrintVote[] }> {
  const [sigRes, voteRes] = await Promise.all([
    fetch(`/api/governance/resolutions/${resolutionId}/signatures`, { credentials: "include" }),
    fetch(`/api/governance/resolutions/${resolutionId}/votes`, { credentials: "include" }),
  ]);
  const signatures = sigRes.ok ? await sigRes.json() : [];
  const votes = voteRes.ok ? await voteRes.json() : [];
  return { signatures, votes };
}

export async function printAssemblyResolution(
  resolution: PrintResolution,
  meeting?: PrintMeeting,
  company?: CompanyInfo,
  targetWindow?: PrintTarget | null
): Promise<void> {
  const w = targetWindow ?? openPrintWindow();
  if (!w.win) {
    alert("الرجاء السماح بالنوافذ المنبثقة لطباعة القرار");
    return;
  }
  const { signatures, votes } = await fetchResolutionPrintData(resolution.id);
  const logo = await getCompanyLogoDataUri();
  const html = buildAssemblyResolutionHtml(resolution, signatures, votes, meeting, company, logo);
  renderToPrintWindow(w, html);
}

export async function exportAssemblyResolutionExcel(
  resolution: PrintResolution,
  meeting?: PrintMeeting
): Promise<void> {
  const { signatures, votes } = await fetchResolutionPrintData(resolution.id);
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const meta = [
    ["رقم القرار", resolution.resolutionNumber],
    ["العنوان", resolution.title],
    ["النوع", resolutionTypeLabel(resolution.resolutionType)],
    ["نوع الاجتماع", meetingTypeLabel(meeting?.meetingType || resolution.resolutionType)],
    ["تاريخ الاجتماع", fmtDate(meeting?.meetingDate || meeting?.scheduledDate)],
    ["المكان", meeting?.location || "-"],
    ["الحالة", statusBadge(resolution.status).label.replace(/[^\u0600-\u06FF\sA-Za-z]/g, "").trim()],
    ["موافق", resolution.forVotes || votes.filter((v) => v.vote === "for").length],
    ["معارض", resolution.againstVotes || votes.filter((v) => v.vote === "against").length],
    ["ممتنع", resolution.abstainVotes || votes.filter((v) => v.vote === "abstain").length],
    ["إجمالي الأصوات", resolution.totalVotes || votes.length],
    ["النصاب المطلوب %", resolution.requiredMajority || "-"],
    ["تاريخ الاعتماد", fmtDate(resolution.approvedAt || resolution.createdAt)],
    ["الوصف", resolution.description || "-"],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(meta);
  wsMeta["!cols"] = [{ wch: 22 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, "بيانات القرار");

  const votesData = [
    ["#", "الاسم", "الصفة", "التصويت", "قوة التصويت", "التاريخ", "ملاحظات"],
    ...votes.map((v, i) => [
      i + 1,
      v.voterName,
      v.voterType === "shareholder" ? "مساهم" : v.voterType === "board_member" ? "عضو مجلس" : v.voterType,
      voteLabel(v.vote),
      v.votingPower ? Number(v.votingPower) : "",
      fmtDate(v.votedAt),
      v.comments || "",
    ]),
  ];
  const wsVotes = XLSX.utils.aoa_to_sheet(votesData);
  wsVotes["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsVotes, "سجل التصويت");

  const sigData = [
    ["#", "الاسم", "الصفة", "حالة التوقيع", "تاريخ التوقيع"],
    ...signatures.map((s, i) => [
      i + 1,
      s.memberName || "",
      s.memberPosition || (s.signerType === "shareholder" ? "مساهم" : "عضو مجلس"),
      s.status === "signed" ? "موقّع" : s.status === "declined" ? "مرفوض" : "معلّق",
      fmtDate(s.signedAt),
    ]),
  ];
  const wsSig = XLSX.utils.aoa_to_sheet(sigData);
  wsSig["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsSig, "التوقيعات");

  XLSX.writeFile(wb, `قرار_جمعية_${resolution.resolutionNumber}.xlsx`);
}
