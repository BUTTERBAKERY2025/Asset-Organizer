// مولّد محضر اجتماع الجمعية العمومية الرسمي القابل للطباعة والتصدير
// Official General Assembly Meeting Minutes Printer with Attendee Signatures

import { getCompanyLogoDataUri } from "./company-logo-data";

export interface MeetingPrint {
  id: number;
  title: string;
  meetingType: string;
  scheduledDate?: string | null;
  meetingDate?: string | null;
  location?: string | null;
  locationType?: string | null;
  virtualMeetingLink?: string | null;
  description?: string | null;
  agenda?: string | null;
  notes?: string | null;
  status: string;
  quorumRequired?: number | null;
}

export interface AttendancePrint {
  id: number;
  attendeeType: string; // board_member | shareholder | proxy | observer | secretary
  attendeeName: string;
  attendeeRole?: string | null;
  representedShares?: number | null;
  votingPower?: string | null;
  attendanceStatus: string; // present | absent | excused | late | left_early | expected
  attendanceMethod?: string | null; // in_person | virtual | proxy
  proxyHolderName?: string | null;
  signatureUrl?: string | null;
  signedAt?: string | null;
  arrivalTime?: string | null;
  departureTime?: string | null;
  notes?: string | null;
}

export interface MinutesPrint {
  id: number;
  minutesNumber: string;
  content: string;
  summary?: string | null;
  discussionPoints?: any;
  decisions?: any;
  votingResults?: any;
  status: string;
  preparedAt?: string | null;
  reviewedAt?: string | null;
}

export interface MeetingResolutionPrint {
  id: number;
  resolutionNumber: string;
  title: string;
  status: string;
  forVotes?: number | null;
  againstVotes?: number | null;
  abstainVotes?: number | null;
  totalVotes?: number | null;
}

export interface MeetingCompanyInfo {
  nameAr?: string;
  nameEn?: string;
  cr?: string;
  details?: string;
}

const DEFAULT_COMPANY: Required<MeetingCompanyInfo> = {
  nameAr: "شركة الزبد الأفضل التجارية",
  nameEn: "THE BUTTER BEST TRADING COMPANY",
  cr: "7026155296",
  details: "شركة مساهمة مقفلة | المملكة العربية السعودية",
};

const meetingTypeLabel = (t?: string) => {
  switch (t) {
    case "extraordinary":
    case "extraordinary_assembly":
      return "اجتماع جمعية عمومية غير عادية";
    case "ordinary":
    case "ordinary_assembly":
      return "اجتماع جمعية عمومية عادية";
    default:
      return "اجتماع جمعية عمومية";
  }
};

const attendeeTypeLabel = (t: string) => {
  const m: Record<string, string> = {
    board_member: "عضو مجلس إدارة",
    shareholder: "مساهم",
    proxy: "وكيل",
    observer: "مراقب",
    secretary: "أمين السر",
  };
  return m[t] || t;
};

const attendanceStatusLabel = (s: string) => {
  const m: Record<string, { label: string; color: string }> = {
    present: { label: "حاضر", color: "#2e7d32" },
    absent: { label: "غائب", color: "#c62828" },
    excused: { label: "غياب بعذر", color: "#e65100" },
    late: { label: "متأخر", color: "#f9a825" },
    left_early: { label: "غادر مبكراً", color: "#6a1b9a" },
    expected: { label: "متوقع", color: "#1565c0" },
  };
  return m[s] || { label: s, color: "#666" };
};

const attendanceMethodLabel = (m?: string | null) => {
  if (m === "virtual") return "حضور افتراضي";
  if (m === "proxy") return "بالوكالة";
  if (m === "in_person") return "حضور شخصي";
  return "-";
};

const meetingStatusLabel = (s: string) => {
  const m: Record<string, { label: string; bg: string; color: string }> = {
    scheduled: { label: "مجدول", bg: "#e3f2fd", color: "#1565c0" },
    in_progress: { label: "جاري الانعقاد", bg: "#fff3e0", color: "#e65100" },
    completed: { label: "مكتمل", bg: "#e8f5e9", color: "#2e7d32" },
    postponed: { label: "مؤجل", bg: "#fffde7", color: "#f57f17" },
    cancelled: { label: "ملغى", bg: "#ffebee", color: "#c62828" },
  };
  return m[s] || { label: s, bg: "#f5f5f5", color: "#333" };
};

const fmtDate = (d?: string | null) => {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "-";
  }
};
const fmtTime = (d?: string | null) => {
  if (!d) return "";
  try {
    return new Date(d).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));

// لا نسمح إلا بـ data:image/* أو https لمنع XSS عبر img src
const safeImageSrc = (src?: string | null): string | null => {
  if (!src || typeof src !== "string") return null;
  const t = src.trim();
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(t)) return t;
  if (/^https:\/\/[^\s"'<>]+$/i.test(t)) return t;
  return null;
};

const voteLabel = (s: string) => {
  if (s === "approved" || s === "implemented") return { txt: "✓ معتمد", color: "#2e7d32" };
  if (s === "rejected") return { txt: "✗ مرفوض", color: "#c62828" };
  if (s === "voting") return { txt: "⏳ تحت التصويت", color: "#e65100" };
  return { txt: s, color: "#666" };
};

export function buildAssemblyMeetingHtml(
  meeting: MeetingPrint,
  attendance: AttendancePrint[],
  resolutions: MeetingResolutionPrint[],
  minutes?: MinutesPrint | null,
  company?: MeetingCompanyInfo,
  logoDataUri?: string | null
): string {
  const co = { ...DEFAULT_COMPANY, ...(company || {}) };
  const mType = meetingTypeLabel(meeting.meetingType);
  const mStat = meetingStatusLabel(meeting.status);
  const meetingDate = meeting.meetingDate || meeting.scheduledDate;

  const presentCount = attendance.filter((a) => a.attendanceStatus === "present" || a.attendanceStatus === "late" || a.attendanceStatus === "left_early").length;
  const absentCount = attendance.filter((a) => a.attendanceStatus === "absent").length;
  const excusedCount = attendance.filter((a) => a.attendanceStatus === "excused").length;
  const proxyCount = attendance.filter((a) => a.attendanceMethod === "proxy").length;
  const totalCount = attendance.length || 1;
  const attendancePct = ((presentCount / totalCount) * 100).toFixed(1);
  const totalShares = attendance
    .filter((a) => a.attendanceStatus === "present" || a.attendanceStatus === "late" || a.attendanceStatus === "left_early")
    .reduce((sum, a) => sum + (Number(a.representedShares) || 0), 0);

  const quorumReq = meeting.quorumRequired || 0;
  const quorumMet = parseFloat(attendancePct) >= quorumReq;

  // قائمة الحضور مع التواقيع
  const attendanceRowsHtml = attendance.length
    ? attendance
        .map((a, i) => {
          const st = attendanceStatusLabel(a.attendanceStatus);
          const safeSig = safeImageSrc(a.signatureUrl);
          return `
        <tr>
          <td style="text-align:center;font-weight:700;">${i + 1}</td>
          <td style="font-weight:600;">${escapeHtml(a.attendeeName)}</td>
          <td style="text-align:center;">${escapeHtml(attendeeTypeLabel(a.attendeeType))}</td>
          <td style="text-align:center;">${a.representedShares ? Number(a.representedShares).toLocaleString("ar-SA-u-nu-latn") : "-"}</td>
          <td style="text-align:center;color:${st.color};font-weight:700;">${st.label}</td>
          <td style="text-align:center;font-size:8pt;">${escapeHtml(attendanceMethodLabel(a.attendanceMethod))}${a.proxyHolderName ? `<br/><span style="font-size:7pt;color:#666;">وكيل: ${escapeHtml(a.proxyHolderName)}</span>` : ""}</td>
          <td class="sig-cell">
            ${
              safeSig
                ? `<img src="${safeSig}" alt="توقيع ${escapeHtml(a.attendeeName)}" />`
                : a.attendanceStatus === "absent"
                ? `<span class="sig-na">—</span>`
                : `<span class="sig-empty">_______________</span>`
            }
            ${a.signedAt ? `<div class="sig-date">${fmtDate(a.signedAt)} ${fmtTime(a.signedAt)}</div>` : ""}
          </td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="7" style="text-align:center;color:#999;padding:18px;">لا توجد بيانات حضور مسجلة لهذا الاجتماع</td></tr>`;

  // قرارات الاجتماع
  const resolutionsHtml = resolutions.length
    ? `
      <div class="section">
        <div class="section-title"><span class="section-icon">٤</span><span>القرارات المتخذة في الاجتماع (${resolutions.length})</span></div>
        <table>
          <thead>
            <tr>
              <th style="width:32px;">#</th>
              <th style="width:110px;">رقم القرار</th>
              <th>عنوان القرار</th>
              <th style="width:60px;">موافق</th>
              <th style="width:60px;">معارض</th>
              <th style="width:60px;">ممتنع</th>
              <th style="width:110px;">النتيجة</th>
            </tr>
          </thead>
          <tbody>
            ${resolutions
              .map((r, i) => {
                const v = voteLabel(r.status);
                return `
              <tr>
                <td style="text-align:center;">${i + 1}</td>
                <td class="mono" style="text-align:center;">${escapeHtml(r.resolutionNumber)}</td>
                <td style="font-weight:600;">${escapeHtml(r.title)}</td>
                <td style="text-align:center;color:#2e7d32;font-weight:700;">${r.forVotes ?? 0}</td>
                <td style="text-align:center;color:#c62828;font-weight:700;">${r.againstVotes ?? 0}</td>
                <td style="text-align:center;color:#e65100;font-weight:700;">${r.abstainVotes ?? 0}</td>
                <td style="text-align:center;color:${v.color};font-weight:700;">${v.txt}</td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`
    : "";

  const minutesHtml = minutes
    ? `
      <div class="section">
        <div class="section-title"><span class="section-icon">٥</span><span>محتوى المحضر — ${escapeHtml(minutes.minutesNumber)}</span></div>
        ${minutes.summary ? `<div class="summary-box"><strong>الملخص:</strong> ${escapeHtml(minutes.summary)}</div>` : ""}
        <div class="minutes-content">${escapeHtml(minutes.content || "").replace(/\n/g, "<br/>")}</div>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8" />
<title>محضر ${escapeHtml(mType)} — ${escapeHtml(meeting.title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
  @page { size: A4; margin: 12mm 12mm 14mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: 'Cairo', sans-serif; direction: rtl; background: white; color: #1a1a1a; line-height: 1.55; font-size: 10pt; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 360px; height: 360px; opacity: 0.06; z-index: 0; pointer-events: none; }
  .watermark img { width: 100%; height: 100%; object-fit: contain; }
  .doc { max-width: 186mm; margin: 0 auto; position: relative; z-index: 1; }
  .header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; margin-bottom: 12px; background: linear-gradient(to left, #f6f9f7, #ffffff, #f6f9f7); border: 1.5px solid #1a5f3c; border-radius: 8px; }
  .logo-row { display: flex; align-items: center; gap: 12px; }
  .logo { width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg, #1a5f3c, #2e7d4f); color: white; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; }
  .logo-img { width: 62px; height: 62px; object-fit: contain; }
  .co-info { line-height: 1.3; }
  .co-name-ar { font-size: 14pt; font-weight: 800; color: #1a3a2f; }
  .co-name-en { font-size: 8pt; color: #555; letter-spacing: 1px; }
  .co-details { font-size: 8pt; color: #666; margin-top: 2px; }
  .doc-title-box { text-align: center; }
  .doc-type { background: #1a5f3c; color: white; padding: 4px 14px; border-radius: 14px; font-size: 9pt; font-weight: 700; display: inline-block; }
  .doc-num { margin-top: 4px; font-weight: 700; font-size: 11pt; color: #1a3a2f; }
  .meeting-title { text-align: center; font-size: 13pt; font-weight: 800; color: #1a3a2f; padding: 8px; background: #f8faf9; border: 1.5px solid #1a5f3c; border-radius: 6px; margin-bottom: 10px; }
  .meta-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 12px; padding: 8px; background: #fafaf7; border: 1px solid #e0d8c5; border-radius: 6px; font-size: 9pt; }
  .meta-cell { display: flex; flex-direction: column; }
  .meta-label { color: #888; font-size: 7.5pt; }
  .meta-value { font-weight: 700; color: #1a3a2f; margin-top: 1px; }
  .section { margin-top: 14px; }
  .section-title { display: flex; align-items: center; gap: 8px; font-weight: 700; color: #1a3a2f; font-size: 11pt; padding-bottom: 4px; border-bottom: 2px solid #1a5f3c; margin-bottom: 8px; }
  .section-icon { width: 22px; height: 22px; border-radius: 50%; background: #1a5f3c; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 10pt; font-weight: 700; }
  .quorum-summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 8px; }
  .q-stat { padding: 6px; border-radius: 6px; text-align: center; border: 1.2px solid; }
  .q-stat.present { background: #e8f5e9; border-color: #2e7d32; color: #1b5e20; }
  .q-stat.absent { background: #ffebee; border-color: #c62828; color: #b71c1c; }
  .q-stat.excused { background: #fff3e0; border-color: #e65100; color: #e65100; }
  .q-stat.proxy { background: #e3f2fd; border-color: #1565c0; color: #0d47a1; }
  .q-stat.shares { background: #f3e5f5; border-color: #6a1b9a; color: #4a148c; }
  .q-num { font-size: 16pt; font-weight: 800; }
  .q-label { font-size: 8pt; font-weight: 700; margin-top: 1px; }
  .quorum-badge { padding: 6px 10px; text-align: center; font-weight: 700; border-radius: 6px; font-size: 10pt; margin-bottom: 8px; ${quorumMet ? "background:#e8f5e9;color:#1b5e20;border:1.5px solid #2e7d32;" : "background:#ffebee;color:#b71c1c;border:1.5px solid #c62828;"} }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th { background: #1a5f3c; color: white; padding: 6px 4px; font-weight: 700; }
  td { padding: 5px 6px; border-bottom: 1px solid #eee; vertical-align: middle; }
  tr:nth-child(even) td { background: #fafafa; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  .mono { font-family: monospace; font-size: 8pt; }
  .sig-cell { width: 110px; text-align: center; }
  .sig-cell img { max-height: 36px; max-width: 100px; object-fit: contain; }
  .sig-empty { color: #aaa; font-style: italic; font-size: 8pt; }
  .sig-na { color: #ccc; }
  .sig-date { font-size: 7pt; color: #666; margin-top: 2px; }
  .agenda-box { padding: 10px 14px; background: #f8faf9; border-right: 4px solid #1a5f3c; border-radius: 4px; white-space: pre-wrap; font-size: 9.5pt; line-height: 1.7; }
  .summary-box { padding: 8px 12px; background: #fffde7; border-right: 3px solid #f9a825; border-radius: 4px; margin-bottom: 8px; font-size: 9.5pt; }
  .minutes-content { padding: 8px 12px; line-height: 1.8; text-align: justify; font-size: 10pt; }
  .meeting-status-badge { padding: 3px 10px; border-radius: 12px; display: inline-block; font-size: 8.5pt; font-weight: 700; background: ${mStat.bg}; color: ${mStat.color}; }
  .footer { margin-top: 18px; padding: 6px 10px; background: #f5f5f5; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 7.5pt; color: #555; border-top: 2px solid #1a5f3c; }
  .auth-sig-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 16px; padding-top: 14px; border-top: 1.5px dashed #1a5f3c; }
  .auth-sig { text-align: center; }
  .auth-sig-line { border-bottom: 1.5px solid #1a3a2f; height: 38px; margin-bottom: 4px; }
  .auth-sig-label { font-weight: 700; font-size: 9pt; color: #1a3a2f; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="doc">
    ${logoDataUri ? `<div class="watermark"><img src="${logoDataUri}" alt="" /></div>` : ""}
    <div class="header">
      <div class="logo-row">
        ${logoDataUri ? `<img class="logo-img" src="${logoDataUri}" alt="${escapeHtml(co.nameAr)}" />` : `<div class="logo">${escapeHtml((co.nameAr || "B").trim().charAt(0))}</div>`}
        <div class="co-info">
          <div class="co-name-ar">${escapeHtml(co.nameAr)}</div>
          <div class="co-name-en">${escapeHtml(co.nameEn)}</div>
          <div class="co-details">${escapeHtml(co.details)} | س.ت: ${escapeHtml(co.cr)}</div>
        </div>
      </div>
      <div class="doc-title-box">
        <div class="doc-type">${escapeHtml(mType)}</div>
        <div class="doc-num">${escapeHtml(minutes?.minutesNumber || `اجتماع رقم: ${meeting.id}`)}</div>
      </div>
    </div>

    <div class="meeting-title">${escapeHtml(meeting.title)}</div>

    <div class="meta-row">
      <div class="meta-cell"><span class="meta-label">تاريخ الانعقاد</span><span class="meta-value">${escapeHtml(fmtDate(meetingDate))}</span></div>
      <div class="meta-cell"><span class="meta-label">المكان</span><span class="meta-value">${escapeHtml(meeting.location || (meeting.locationType === "virtual" ? "افتراضي" : "-"))}</span></div>
      <div class="meta-cell"><span class="meta-label">النصاب المطلوب</span><span class="meta-value">${quorumReq}%</span></div>
      <div class="meta-cell"><span class="meta-label">حالة الاجتماع</span><span class="meta-value"><span class="meeting-status-badge">${mStat.label}</span></span></div>
    </div>

    ${
      meeting.agenda
        ? `<div class="section">
            <div class="section-title"><span class="section-icon">١</span><span>جدول الأعمال</span></div>
            <div class="agenda-box">${escapeHtml(meeting.agenda)}</div>
          </div>`
        : ""
    }

    <div class="section">
      <div class="section-title"><span class="section-icon">٢</span><span>إحصائيات الحضور والنصاب</span></div>
      <div class="quorum-summary">
        <div class="q-stat present"><div class="q-num">${presentCount}</div><div class="q-label">حاضر</div></div>
        <div class="q-stat absent"><div class="q-num">${absentCount}</div><div class="q-label">غائب</div></div>
        <div class="q-stat excused"><div class="q-num">${excusedCount}</div><div class="q-label">عذر</div></div>
        <div class="q-stat proxy"><div class="q-num">${proxyCount}</div><div class="q-label">بالوكالة</div></div>
        <div class="q-stat shares"><div class="q-num">${totalShares.toLocaleString("ar-SA-u-nu-latn")}</div><div class="q-label">أسهم حاضرة</div></div>
      </div>
      <div class="quorum-badge">
        نسبة الحضور: ${attendancePct}% — ${quorumMet ? `✓ تم تحقق النصاب القانوني (المطلوب ${quorumReq}%)` : `✗ لم يتحقق النصاب القانوني (المطلوب ${quorumReq}%)`}
      </div>
    </div>

    <div class="section">
      <div class="section-title"><span class="section-icon">٣</span><span>سجل الحضور والتوقيعات (${attendance.length})</span></div>
      <table>
        <thead>
          <tr>
            <th style="width:30px;">#</th>
            <th>الاسم</th>
            <th style="width:90px;">الصفة</th>
            <th style="width:70px;">الأسهم</th>
            <th style="width:70px;">الحالة</th>
            <th style="width:90px;">طريقة الحضور</th>
            <th style="width:120px;">التوقيع</th>
          </tr>
        </thead>
        <tbody>${attendanceRowsHtml}</tbody>
      </table>
    </div>

    ${resolutionsHtml}
    ${minutesHtml}

    ${
      meeting.notes
        ? `<div class="section">
            <div class="section-title"><span class="section-icon">📝</span><span>ملاحظات</span></div>
            <div class="agenda-box">${escapeHtml(meeting.notes)}</div>
          </div>`
        : ""
    }

    <div class="auth-sig-row">
      <div class="auth-sig">
        <div class="auth-sig-line"></div>
        <div class="auth-sig-label">رئيس الاجتماع</div>
      </div>
      <div class="auth-sig">
        <div class="auth-sig-line"></div>
        <div class="auth-sig-label">أمين السر</div>
      </div>
      <div class="auth-sig">
        <div class="auth-sig-line"></div>
        <div class="auth-sig-label">مدقق المحضر</div>
      </div>
    </div>

    <div class="footer">
      <div>${escapeHtml(co.nameAr)} | س.ت: ${escapeHtml(co.cr)}</div>
      <div>تم الإصدار: ${new Date().toLocaleDateString("ar-SA-u-nu-latn")} | محضر رسمي</div>
    </div>
  </div>
</body>
</html>`;
}

export async function fetchMeetingPrintData(meetingId: number): Promise<{
  attendance: AttendancePrint[];
  minutes: MinutesPrint | null;
  resolutions: MeetingResolutionPrint[];
}> {
  const [attRes, minRes, allResRes] = await Promise.all([
    fetch(`/api/governance/meetings/${meetingId}/attendance`, { credentials: "include" }),
    fetch(`/api/governance/meetings/${meetingId}/minutes`, { credentials: "include" }),
    fetch(`/api/governance/resolutions`, { credentials: "include" }),
  ]);
  const attendance: AttendancePrint[] = attRes.ok ? await attRes.json() : [];
  const minutes: MinutesPrint | null = minRes.ok ? await minRes.json() : null;
  const allRes: any[] = allResRes.ok ? await allResRes.json() : [];
  const resolutions: MeetingResolutionPrint[] = allRes
    .filter((r) => r.meetingId === meetingId)
    .map((r) => ({
      id: r.id,
      resolutionNumber: r.resolutionNumber,
      title: r.title,
      status: r.status,
      forVotes: r.forVotes,
      againstVotes: r.againstVotes,
      abstainVotes: r.abstainVotes,
      totalVotes: r.totalVotes,
    }));
  return { attendance, minutes, resolutions };
}

export async function printAssemblyMeeting(meeting: MeetingPrint, company?: MeetingCompanyInfo): Promise<void> {
  const { attendance, minutes, resolutions } = await fetchMeetingPrintData(meeting.id);
  const logo = await getCompanyLogoDataUri();
  const html = buildAssemblyMeetingHtml(meeting, attendance, resolutions, minutes, company, logo);
  const w = window.open("", "_blank");
  if (!w) {
    alert("الرجاء السماح بالنوافذ المنبثقة لطباعة المحضر");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.onload = () => setTimeout(() => w.print(), 400);
}

export async function exportAssemblyMeetingExcel(meeting: MeetingPrint): Promise<void> {
  const { attendance, minutes, resolutions } = await fetchMeetingPrintData(meeting.id);
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const meetingDate = meeting.meetingDate || meeting.scheduledDate;
  const presentCount = attendance.filter((a) => ["present", "late", "left_early"].includes(a.attendanceStatus)).length;
  const absentCount = attendance.filter((a) => a.attendanceStatus === "absent").length;
  const excusedCount = attendance.filter((a) => a.attendanceStatus === "excused").length;
  const totalShares = attendance
    .filter((a) => ["present", "late", "left_early"].includes(a.attendanceStatus))
    .reduce((sum, a) => sum + (Number(a.representedShares) || 0), 0);

  const meta = [
    ["عنوان الاجتماع", meeting.title],
    ["نوع الاجتماع", meetingTypeLabel(meeting.meetingType)],
    ["رقم المحضر", minutes?.minutesNumber || "-"],
    ["تاريخ الانعقاد", fmtDate(meetingDate)],
    ["المكان", meeting.location || "-"],
    ["نوع المكان", meeting.locationType === "virtual" ? "افتراضي" : "حضوري"],
    ["النصاب المطلوب %", meeting.quorumRequired || 0],
    ["حالة الاجتماع", meetingStatusLabel(meeting.status).label],
    ["إجمالي المسجلين", attendance.length],
    ["الحاضرون", presentCount],
    ["الغائبون", absentCount],
    ["بعذر", excusedCount],
    ["إجمالي الأسهم الحاضرة", totalShares],
    ["جدول الأعمال", meeting.agenda || "-"],
    ["ملاحظات", meeting.notes || "-"],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(meta);
  wsMeta["!cols"] = [{ wch: 24 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, "بيانات الاجتماع");

  const attData = [
    ["#", "الاسم", "الصفة", "الأسهم الممثلة", "قوة التصويت", "الحالة", "طريقة الحضور", "اسم الوكيل", "وقت التوقيع", "ملاحظات"],
    ...attendance.map((a, i) => [
      i + 1,
      a.attendeeName,
      attendeeTypeLabel(a.attendeeType),
      a.representedShares ? Number(a.representedShares) : "",
      a.votingPower ? Number(a.votingPower) : "",
      attendanceStatusLabel(a.attendanceStatus).label,
      attendanceMethodLabel(a.attendanceMethod),
      a.proxyHolderName || "",
      a.signedAt ? `${fmtDate(a.signedAt)} ${fmtTime(a.signedAt)}` : "",
      a.notes || "",
    ]),
  ];
  const wsAtt = XLSX.utils.aoa_to_sheet(attData);
  wsAtt["!cols"] = [
    { wch: 5 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsAtt, "الحضور والتوقيعات");

  const resData = [
    ["#", "رقم القرار", "العنوان", "موافق", "معارض", "ممتنع", "إجمالي", "النتيجة"],
    ...resolutions.map((r, i) => [
      i + 1,
      r.resolutionNumber,
      r.title,
      r.forVotes ?? 0,
      r.againstVotes ?? 0,
      r.abstainVotes ?? 0,
      r.totalVotes ?? 0,
      voteLabel(r.status).txt,
    ]),
  ];
  const wsRes = XLSX.utils.aoa_to_sheet(resData);
  wsRes["!cols"] = [{ wch: 5 }, { wch: 16 }, { wch: 50 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsRes, "قرارات الاجتماع");

  if (minutes?.content) {
    const minSheet = [
      ["رقم المحضر", minutes.minutesNumber],
      ["الحالة", minutes.status],
      ["تم الإعداد في", fmtDate(minutes.preparedAt)],
      ["الملخص", minutes.summary || ""],
      [""],
      ["محتوى المحضر"],
      [minutes.content],
    ];
    const wsMin = XLSX.utils.aoa_to_sheet(minSheet);
    wsMin["!cols"] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsMin, "محتوى المحضر");
  }

  const safeTitle = meeting.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
  XLSX.writeFile(wb, `محضر_${safeTitle}_${meeting.id}.xlsx`);
}
