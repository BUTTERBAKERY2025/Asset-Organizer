// مولّد قرار الجمعية العمومية الرسمي القابل للطباعة والتصدير PDF
// Official General Assembly Resolution Printer with Voting Signatures

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
  votesFor?: number | null;
  votesAgainst?: number | null;
  votesAbstain?: number | null;
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
  meetingDate?: string;
  scheduledDate?: string;
  location?: string;
  quorumRequired?: number;
}

export interface CompanyInfo {
  nameAr?: string;
  nameEn?: string;
  cr?: string;
  details?: string;
}

const DEFAULT_COMPANY: Required<CompanyInfo> = {
  nameAr: "شركة الزبد الأفضل التجارية",
  nameEn: "THE BUTTER BEST TRADING COMPANY",
  cr: "7026155296",
  details: "شركة مساهمة مقفلة | المملكة العربية السعودية",
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

const resolutionTypeLabel = (t: string) => {
  const map: Record<string, string> = {
    ordinary: "قرار عادي",
    extraordinary: "قرار استثنائي",
    general_assembly: "قرار جمعية عمومية عادية",
    extraordinary_assembly: "قرار جمعية عمومية غير عادية",
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

const fmtDate = (d?: string | null) => {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "-";
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
  company?: CompanyInfo
): string {
  const co = { ...DEFAULT_COMPANY, ...(company || {}) };
  const st = statusBadge(resolution.status);
  const meetingType = meetingTypeLabel(meeting?.meetingType || resolution.resolutionType);
  const resType = resolutionTypeLabel(resolution.resolutionType);

  const totalVotes = resolution.totalVotes || votes.length || 0;
  const votesFor = resolution.votesFor ?? votes.filter((v) => v.vote === "for").length;
  const votesAgainst = resolution.votesAgainst ?? votes.filter((v) => v.vote === "against").length;
  const votesAbstain = resolution.votesAbstain ?? votes.filter((v) => v.vote === "abstain").length;
  const pct = (n: number) => (totalVotes > 0 ? ((n / totalVotes) * 100).toFixed(1) : "0.0");

  const votersRowsHtml = votes.length
    ? votes
        .map(
          (v, i) => `
        <tr>
          <td style="text-align:center;">${i + 1}</td>
          <td>${escapeHtml(v.voterName)}</td>
          <td style="text-align:center;">${v.voterType === "shareholder" ? "مساهم" : v.voterType === "board_member" ? "عضو مجلس" : escapeHtml(v.voterType)}</td>
          <td style="text-align:center;color:${voteColor(v.vote)};font-weight:700;">${voteLabel(v.vote)}</td>
          <td style="text-align:center;">${v.votingPower ? Number(v.votingPower).toLocaleString("ar-SA") : "-"}</td>
          <td style="text-align:center;font-size:8pt;color:#666;">${fmtDate(v.votedAt)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="6" style="text-align:center;color:#999;padding:14px;">لا توجد بيانات تصويت مسجلة</td></tr>`;

  const signaturesHtml = signatures.length
    ? signatures
        .map(
          (sig) => `
      <div class="sig-card sig-${sig.status}">
        <div class="sig-name">${escapeHtml(sig.memberName || "—")}</div>
        <div class="sig-pos">${escapeHtml(sig.memberPosition || (sig.signerType === "shareholder" ? "مساهم" : "عضو مجلس"))}</div>
        <div class="sig-box">
          ${(() => {
            const safe = sig.status === "signed" ? safeImageSrc(sig.signatureData) : null;
            if (safe) return `<img src="${safe}" alt="توقيع ${escapeHtml(sig.memberName || "")}" />`;
            if (sig.status === "signed") return `<div class="sig-empty">توقيع غير صالح</div>`;
            if (sig.status === "declined") return `<div class="sig-empty declined">رفض التوقيع</div>`;
            return `<div class="sig-empty">في انتظار التوقيع</div>`;
          })()}
        </div>
        <div class="sig-foot">
          ${sig.status === "signed" && sig.signedAt ? `<span class="sig-date">${fmtDate(sig.signedAt)}</span>` : `<span></span>`}
          <span class="sig-status sig-status-${sig.status}">${
            sig.status === "signed" ? "✓ موقّع" : sig.status === "declined" ? "✗ مرفوض" : "⏳ معلّق"
          }</span>
        </div>
      </div>`
        )
        .join("")
    : `<div class="sig-empty-all">لم يتم إرسال طلبات توقيع لهذا القرار بعد</div>`;

  const meetingDate = meeting?.meetingDate || meeting?.scheduledDate;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8" />
<title>قرار جمعية عمومية رقم ${escapeHtml(resolution.resolutionNumber)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
  @page { size: A4; margin: 12mm 12mm 14mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: 'Cairo', sans-serif; direction: rtl; background: white; color: #1a1a1a; line-height: 1.55; font-size: 10.5pt; }
  .doc { max-width: 186mm; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; margin-bottom: 12px; background: linear-gradient(to left, #f6f9f7, #ffffff, #f6f9f7); border: 1.5px solid #1a5f3c; border-radius: 8px; }
  .logo-row { display: flex; align-items: center; gap: 12px; }
  .logo { width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg, #1a5f3c, #2e7d4f); color: white; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; }
  .co-info { line-height: 1.3; }
  .co-name-ar { font-size: 14pt; font-weight: 800; color: #1a3a2f; }
  .co-name-en { font-size: 8pt; color: #555; letter-spacing: 1px; }
  .co-details { font-size: 8pt; color: #666; margin-top: 2px; }
  .doc-title-box { text-align: center; }
  .doc-type { background: #1a5f3c; color: white; padding: 4px 14px; border-radius: 14px; font-size: 9pt; font-weight: 700; display: inline-block; }
  .doc-num { margin-top: 4px; font-weight: 700; font-size: 11pt; color: #1a3a2f; }
  .meta-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 12px; padding: 8px; background: #fafaf7; border: 1px solid #e0d8c5; border-radius: 6px; font-size: 9pt; }
  .meta-cell { display: flex; flex-direction: column; }
  .meta-label { color: #888; font-size: 7.5pt; }
  .meta-value { font-weight: 700; color: #1a3a2f; margin-top: 1px; }
  .section { margin-top: 14px; page-break-inside: avoid; break-inside: avoid; }
  .section-title { display: flex; align-items: center; gap: 8px; font-weight: 700; color: #1a3a2f; font-size: 11pt; padding-bottom: 4px; border-bottom: 2px solid #1a5f3c; margin-bottom: 8px; }
  .section-icon { width: 22px; height: 22px; border-radius: 50%; background: #1a5f3c; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 10pt; font-weight: 700; }
  .resolution-title { font-size: 13pt; font-weight: 700; color: #1a3a2f; padding: 8px 12px; background: #f8faf9; border-right: 4px solid #1a5f3c; border-radius: 4px; margin-bottom: 8px; }
  .resolution-text { font-size: 10.5pt; line-height: 1.7; color: #2c2c2c; padding: 6px 12px; text-align: justify; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th { background: #1a5f3c; color: white; padding: 6px 4px; font-weight: 700; }
  td { padding: 5px 6px; border-bottom: 1px solid #eee; }
  tr:nth-child(even) td { background: #fafafa; }
  .vote-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 8px; }
  .vote-stat { padding: 8px; border-radius: 6px; text-align: center; border: 1.5px solid; }
  .vote-stat.for { background: #e8f5e9; border-color: #2e7d32; color: #1b5e20; }
  .vote-stat.against { background: #ffebee; border-color: #c62828; color: #b71c1c; }
  .vote-stat.abstain { background: #fff3e0; border-color: #e65100; color: #e65100; }
  .vote-num { font-size: 18pt; font-weight: 800; }
  .vote-pct { font-size: 8pt; opacity: .8; margin-top: 1px; }
  .vote-label { font-size: 9pt; font-weight: 700; margin-top: 2px; }
  .result-badge { padding: 8px; text-align: center; font-weight: 700; border-radius: 6px; font-size: 11pt; background: ${st.bg}; color: ${st.color}; border: 1.5px solid ${st.color}; margin-top: 6px; }
  .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .sig-card { border: 1.2px solid #d0d0d0; border-radius: 6px; padding: 6px; background: white; page-break-inside: avoid; break-inside: avoid; }
  .sig-card.sig-signed { border-color: #2e7d32; background: #f1f8f1; }
  .sig-card.sig-declined { border-color: #c62828; background: #fdecec; }
  .sig-name { font-weight: 700; font-size: 9.5pt; color: #1a3a2f; }
  .sig-pos { font-size: 8pt; color: #666; margin-bottom: 4px; }
  .sig-box { height: 56px; display: flex; align-items: center; justify-content: center; background: #fff; border: 1px dashed #ccc; border-radius: 4px; overflow: hidden; }
  .sig-box img { max-height: 52px; max-width: 100%; object-fit: contain; }
  .sig-empty { color: #999; font-size: 8pt; font-style: italic; }
  .sig-empty.declined { color: #c62828; font-style: normal; font-weight: 600; }
  .sig-empty-all { padding: 18px; text-align: center; color: #888; background: #fafafa; border: 1px dashed #ccc; border-radius: 6px; grid-column: 1 / -1; }
  .sig-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 7.5pt; }
  .sig-date { color: #666; }
  .sig-status { padding: 1px 6px; border-radius: 8px; font-weight: 700; }
  .sig-status-signed { background: #e8f5e9; color: #2e7d32; }
  .sig-status-declined { background: #ffebee; color: #c62828; }
  .sig-status-pending { background: #fff3e0; color: #e65100; }
  .footer { margin-top: 18px; padding: 6px 10px; background: #f5f5f5; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 7.5pt; color: #555; border-top: 2px solid #1a5f3c; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="doc">
    <div class="header">
      <div class="logo-row">
        <div class="logo">${escapeHtml((co.nameAr || "B").trim().charAt(0))}</div>
        <div class="co-info">
          <div class="co-name-ar">${escapeHtml(co.nameAr)}</div>
          <div class="co-name-en">${escapeHtml(co.nameEn)}</div>
          <div class="co-details">${escapeHtml(co.details)} | س.ت: ${escapeHtml(co.cr)}</div>
        </div>
      </div>
      <div class="doc-title-box">
        <div class="doc-type">${escapeHtml(meetingType)}</div>
        <div class="doc-num">قرار رقم: ${escapeHtml(resolution.resolutionNumber)}</div>
      </div>
    </div>

    <div class="meta-row">
      <div class="meta-cell"><span class="meta-label">نوع القرار</span><span class="meta-value">${escapeHtml(resType)}</span></div>
      <div class="meta-cell"><span class="meta-label">تاريخ الاجتماع</span><span class="meta-value">${escapeHtml(fmtDate(meetingDate))}</span></div>
      <div class="meta-cell"><span class="meta-label">المكان</span><span class="meta-value">${escapeHtml(meeting?.location || "-")}</span></div>
      <div class="meta-cell"><span class="meta-label">تاريخ الاعتماد</span><span class="meta-value">${escapeHtml(fmtDate(resolution.approvedAt || resolution.createdAt))}</span></div>
    </div>

    <div class="section">
      <div class="section-title"><span class="section-icon">١</span><span>نص القرار</span></div>
      <div class="resolution-title">${escapeHtml(resolution.title)}</div>
      ${resolution.description ? `<div class="resolution-text">${escapeHtml(resolution.description)}</div>` : ""}
    </div>

    <div class="section">
      <div class="section-title"><span class="section-icon">٢</span><span>نتائج التصويت</span></div>
      <div class="vote-summary">
        <div class="vote-stat for"><div class="vote-num">${votesFor}</div><div class="vote-pct">${pct(votesFor)}%</div><div class="vote-label">موافق</div></div>
        <div class="vote-stat against"><div class="vote-num">${votesAgainst}</div><div class="vote-pct">${pct(votesAgainst)}%</div><div class="vote-label">معارض</div></div>
        <div class="vote-stat abstain"><div class="vote-num">${votesAbstain}</div><div class="vote-pct">${pct(votesAbstain)}%</div><div class="vote-label">ممتنع</div></div>
      </div>
      <div class="result-badge">${st.label}</div>
    </div>

    <div class="section">
      <div class="section-title"><span class="section-icon">٣</span><span>سجل المصوتين (${votes.length})</span></div>
      <table>
        <thead>
          <tr>
            <th style="width:32px;">#</th>
            <th>الاسم</th>
            <th style="width:80px;">الصفة</th>
            <th style="width:70px;">التصويت</th>
            <th style="width:80px;">قوة التصويت</th>
            <th style="width:90px;">التاريخ</th>
          </tr>
        </thead>
        <tbody>${votersRowsHtml}</tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title"><span class="section-icon">✍</span><span>التوقيعات (${signatures.filter((s) => s.status === "signed").length} / ${signatures.length})</span></div>
      <div class="signatures">${signaturesHtml}</div>
    </div>

    <div class="footer">
      <div>${escapeHtml(co.nameAr)} | س.ت: ${escapeHtml(co.cr)}</div>
      <div>تم الإصدار: ${new Date().toLocaleDateString("ar-SA")} | وثيقة رسمية</div>
    </div>
  </div>
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
  company?: CompanyInfo
): Promise<void> {
  const { signatures, votes } = await fetchResolutionPrintData(resolution.id);
  const html = buildAssemblyResolutionHtml(resolution, signatures, votes, meeting, company);
  const w = window.open("", "_blank");
  if (!w) {
    alert("الرجاء السماح بالنوافذ المنبثقة لطباعة القرار");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.onload = () => setTimeout(() => w.print(), 400);
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
    ["موافق", resolution.votesFor || votes.filter((v) => v.vote === "for").length],
    ["معارض", resolution.votesAgainst || votes.filter((v) => v.vote === "against").length],
    ["ممتنع", resolution.votesAbstain || votes.filter((v) => v.vote === "abstain").length],
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
