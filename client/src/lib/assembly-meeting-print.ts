// مولّد محضر اجتماع الجمعية العمومية الرسمي القابل للطباعة والتصدير
// Official General Assembly Meeting Minutes Printer (formal legal-prose layout)

import { getCompanyLogoDataUri } from "./company-logo-data";

export interface MeetingPrint {
  id: number;
  title: string;
  meetingType: string;
  meetingNumber?: string | null;
  scheduledDate?: string | null;
  meetingDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  fiscalYear?: string | null;
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
  description?: string | null;
  resolutionType?: string | null;
  assemblyType?: string | null;
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
  city?: string;
}

const DEFAULT_COMPANY: Required<MeetingCompanyInfo> = {
  nameAr: "شركة الزبد الأفضل التجارية",
  nameEn: "THE BUTTER BEST TRADING COMPANY",
  cr: "7026155296",
  details: "شركة مساهمة مقفلة | المملكة العربية السعودية",
  city: "خميس مشيط",
};

const SECTION_ORDINALS = ["أولاً", "ثانياً", "ثالثاً", "رابعاً", "خامساً", "سادساً", "سابعاً", "ثامناً", "تاسعاً", "عاشراً"];
const RES_ORDINALS = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];

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

// اسم الجمعية للاستخدام في صياغة المحضر (الجمعية العامة العادية/غير العادية)
const assemblyName = (t?: string) => {
  if (t && t.includes("extraordinary")) return "الجمعية العامة غير العادية";
  if (t && t.includes("ordinary")) return "الجمعية العامة العادية";
  return "الجمعية العامة";
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

// صفة الحضور بالصيغة النظامية (أصالةً / وكالةً)
const capacityLabel = (a: AttendancePrint) => {
  if (a.attendanceMethod === "proxy") return "وكالةً";
  if (a.attendeeType === "observer") return "مراقب";
  if (a.attendeeType === "secretary") return "أمين السر";
  return "أصالةً";
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

const nf = (n: number) => n.toLocaleString("ar-SA-u-nu-latn");

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
const fmtWeekday = (d?: string | null) => {
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("ar-SA", { weekday: "long" }).format(new Date(d));
  } catch {
    return "";
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
  const asmName = assemblyName(meeting.meetingType);
  const legalForm = (co.details.split("|")[0] || "").trim() || "شركة مساهمة مقفلة";
  const meetingDate = meeting.meetingDate || meeting.scheduledDate;
  const greg = fmtDate(meetingDate);
  const hijri = fmtHijri(meetingDate);
  const weekday = fmtWeekday(meetingDate);
  const timeStr = (meeting.startTime || "").trim();

  const presentList = attendance.filter((a) => ["present", "late", "left_early"].includes(a.attendanceStatus));
  const totalAllShares = attendance.reduce((s, a) => s + (Number(a.representedShares) || 0), 0);
  const presentShares = presentList.reduce((s, a) => s + (Number(a.representedShares) || 0), 0);
  const headCount = attendance.length || 1;
  const headPct = (presentList.length / headCount) * 100;
  const representedPct = totalAllShares > 0 ? (presentShares / totalAllShares) * 100 : headPct;
  const quorumReq = Number(meeting.quorumRequired || 0);
  const quorumMet = representedPct >= quorumReq;

  // جدول الحضور
  const attRowsHtml = attendance.length
    ? attendance
        .map((a, i) => {
          const shares = Number(a.representedShares) || 0;
          const pctVal = totalAllShares > 0 ? (shares / totalAllShares) * 100 : Number(a.votingPower) || 0;
          const hasPct = shares > 0 || Number(a.votingPower) > 0;
          const safeSig = safeImageSrc(a.signatureUrl);
          return `
          <tr>
            <td style="text-align:center;">${i + 1}</td>
            <td>${escapeHtml(a.attendeeName)}</td>
            <td style="text-align:center;">${shares ? nf(shares) : "-"}</td>
            <td style="text-align:center;">${hasPct ? pctVal.toFixed(2) + "%" : "-"}</td>
            <td style="text-align:center;">${capacityLabel(a)}${a.proxyHolderName ? `<br/><span style="font-size:7.5pt;color:#666;">عن: ${escapeHtml(a.proxyHolderName)}</span>` : ""}</td>
            <td style="text-align:center;">${
              safeSig
                ? `<img class="sig-inline" src="${safeSig}" alt="توقيع ${escapeHtml(a.attendeeName)}" />`
                : a.attendanceStatus === "absent"
                ? "—"
                : "..............."
            }</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" style="text-align:center;color:#999;padding:16px;">لا توجد بيانات حضور مسجلة لهذا الاجتماع</td></tr>`;

  const totalRow =
    totalAllShares > 0
      ? `<tr class="tot"><td></td><td>الإجمالي</td><td style="text-align:center;">${nf(totalAllShares)}</td><td style="text-align:center;">100%</td><td></td><td></td></tr>`
      : "";

  // رئيس الاجتماع وأمين السر (استنباط من سجل الحضور)
  const chairman = attendance.find((a) => /رئيس/.test(a.attendeeRole || "")) || null;
  const secretary = attendance.find((a) => a.attendeeType === "secretary" || /أمين/.test(a.attendeeRole || "")) || null;
  const chairSig = chairman ? safeImageSrc(chairman.signatureUrl) : null;
  const secSig = secretary ? safeImageSrc(secretary.signatureUrl) : null;

  // جدول الأعمال
  const agendaList = (meeting.agenda || "")
    .split(/\r?\n/)
    .map((s) =>
      s
        .replace(/^\s*[\d\u0660-\u0669]+[\).\-]\s*/, "")
        .replace(/^\s*[-•]\s*/, "")
        .trim()
    )
    .filter(Boolean);

  // قرارات الجمعية كنص قانوني
  const resBlocksHtml = resolutions.length
    ? resolutions
        .map((r, i) => {
          const ord = RES_ORDINALS[i] || `رقم (${i + 1})`;
          const body = (r.description || "").trim();
          return `
          <div class="res-block">
            <div class="res-h">القرار ${ord}: ${escapeHtml(r.title)}</div>
            ${body ? `<div class="res-body">${escapeHtml(body).replace(/\n/g, "<br/>")}</div>` : ""}
          </div>`;
        })
        .join("")
    : `<div class="sec-p">لم تُسجَّل قرارات لهذا الاجتماع.</div>`;

  // نتيجة التصويت
  const allUnanimous = resolutions.length > 0 && resolutions.every((r) => (r.againstVotes || 0) === 0 && (r.abstainVotes || 0) === 0);
  const votingResultText = allUnanimous
    ? "بعد المناقشة، تمت الموافقة على القرارات الواردة أعلاه بالإجماع من الأصوات الحاضرة والممثَّلة في الاجتماع."
    : "بعد المناقشة، تمت الموافقة على القرارات الواردة أعلاه بأغلبية الأصوات الحاضرة والممثَّلة في الاجتماع.";

  const mType = meetingTypeLabel(meeting.meetingType);

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8" />
<title>محضر اجتماع ${escapeHtml(asmName)} وقراراتها — ${escapeHtml(meeting.title)}</title>
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
  .preamble { text-align: justify; font-size: 11pt; line-height: 2.05; margin: 12px 2px; }
  .sec { margin-top: 16px; }
  .sec-h { font-size: 12pt; font-weight: 800; color: #1a5f3c; border-right: 4px solid #1a5f3c; padding-right: 8px; margin-bottom: 6px; }
  .sec-p { text-align: justify; line-height: 2.05; margin-bottom: 6px; }
  table.att { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 8px 0; }
  table.att th { background: #1a5f3c; color: #fff; padding: 6px 5px; font-weight: 700; border: 1px solid #14492f; }
  table.att td { padding: 5px 6px; border: 1px solid #cfd8d3; vertical-align: middle; }
  table.att tr:nth-child(even) td { background: #f6f9f7; }
  table.att tr.tot td { font-weight: 800; background: #eef4f0; }
  table.att tr { page-break-inside: avoid; break-inside: avoid; }
  .sig-inline { max-height: 32px; max-width: 100px; object-fit: contain; }
  .att-note { font-size: 9pt; color: #555; margin-top: 4px; line-height: 1.8; }
  ol.agenda { margin: 6px 28px 6px 0; line-height: 2.05; }
  ol.agenda li { margin-bottom: 4px; }
  .res-block { margin-bottom: 12px; page-break-inside: avoid; break-inside: avoid; }
  .res-h { font-weight: 800; color: #1a3a2f; font-size: 11.5pt; margin-bottom: 4px; }
  .res-body { text-align: justify; line-height: 2.05; white-space: pre-wrap; }
  .sig-grid { display: flex; justify-content: space-around; gap: 30px; margin-top: 34px; page-break-inside: avoid; break-inside: avoid; }
  .sig-col { text-align: center; flex: 1; }
  .sig-title { font-weight: 800; color: #1a3a2f; margin-bottom: 6px; }
  .sig-name { font-weight: 700; margin-bottom: 2px; }
  .sig-role { font-size: 9pt; color: #555; margin-bottom: 22px; }
  .sig-img { max-height: 50px; max-width: 140px; object-fit: contain; display: block; margin: 0 auto 4px; }
  .sig-line { font-size: 10pt; color: #333; }
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

          <div class="doc-title">محضر اجتماع ${escapeHtml(asmName)} وقراراتها</div>
          <div class="doc-meta-line">الاجتماع رقم (${escapeHtml(meeting.meetingNumber || minutes?.minutesNumber || "—")})${meeting.fiscalYear ? ` — العام المالي ${escapeHtml(String(meeting.fiscalYear))}` : ""}</div>

          <div class="preamble">إنه في يوم ${weekday ? escapeHtml(weekday) : "(__________)"} الموافق ${hijri ? `(${escapeHtml(hijri)})` : "(__/__/144هـ)"} الموافق ${greg !== "-" ? `(${escapeHtml(greg)})` : "(__/__/2026م)"}، وفي تمام الساعة (${timeStr ? escapeHtml(timeStr) : "________"})، انعقدت ${escapeHtml(asmName)} لـ${escapeHtml(co.nameAr)} (${escapeHtml(legalForm)})، في ${escapeHtml(meeting.location || "مقر الشركة")}${co.city ? ` بمدينة ${escapeHtml(co.city)}` : ""}، وذلك بناءً على الدعوة الموجَّهة من مجلس الإدارة وفقاً لأحكام نظام الشركات والنظام الأساس للشركة.</div>

          <div class="sec">
            <div class="sec-h">${SECTION_ORDINALS[0]}: حضور الاجتماع واكتمال النصاب</div>
            <div class="sec-p">حضر الاجتماع المساهمون التالية أسماؤهم (أصالةً أو وكالةً)، وقد بلغت نسبة الأسهم الممثَّلة في الاجتماع (${representedPct.toFixed(2)}%) من إجمالي الأسهم المثبتة في كشف الحضور أدناه، وهي النسبة التي ${quorumMet ? "يكتمل بها النصاب القانوني اللازم لصحة انعقاد" : "لا يكتمل بها النصاب القانوني اللازم لانعقاد"} ${escapeHtml(asmName)} وفقاً للنظام الأساس للشركة ونظام الشركات (النصاب المطلوب ${quorumReq}%).</div>
            <table class="att">
              <thead>
                <tr>
                  <th style="width:34px;">م</th>
                  <th>اسم المساهم</th>
                  <th style="width:92px;">عدد الأسهم</th>
                  <th style="width:80px;">نسبة الملكية</th>
                  <th style="width:96px;">صفة الحضور</th>
                  <th style="width:120px;">التوقيع</th>
                </tr>
              </thead>
              <tbody>
                ${attRowsHtml}
                ${totalRow}
              </tbody>
            </table>
            ${totalAllShares > 0 ? `<div class="att-note">إجمالي عدد الأسهم الممثَّلة في الجدول أعلاه (${nf(totalAllShares)}) سهم.</div>` : ""}
          </div>

          <div class="sec">
            <div class="sec-h">${SECTION_ORDINALS[1]}: رئاسة الاجتماع وأمانة السر</div>
            <div class="sec-p">ترأّس الاجتماع ${chairman ? `الأستاذ/ ${escapeHtml(chairman.attendeeName)} — ${escapeHtml(chairman.attendeeRole || "رئيس مجلس الإدارة")}` : "الأستاذ/ (__________) — رئيس مجلس الإدارة"}، وتولّى أمانة سر الاجتماع ${secretary ? `${escapeHtml(secretary.attendeeName)} — ${escapeHtml(secretary.attendeeRole || "أمين سر مجلس الإدارة")}` : "(__________) — أمين سر مجلس الإدارة"}، وتم التحقق من اكتمال النصاب وصحة انعقاد ${escapeHtml(asmName)}.</div>
          </div>

          <div class="sec">
            <div class="sec-h">${SECTION_ORDINALS[2]}: جدول الأعمال</div>
            ${agendaList.length ? `<ol class="agenda">${agendaList.map((it) => `<li>${escapeHtml(it)}</li>`).join("")}</ol>` : `<div class="sec-p">لم يُدرج جدول أعمال تفصيلي لهذا الاجتماع.</div>`}
          </div>

          <div class="sec">
            <div class="sec-h">${SECTION_ORDINALS[3]}: قرارات الجمعية</div>
            ${resBlocksHtml}
          </div>

          <div class="sec">
            <div class="sec-h">${SECTION_ORDINALS[4]}: نتيجة التصويت</div>
            <div class="sec-p">${votingResultText}</div>
          </div>

          <div class="sec">
            <div class="sec-h">${SECTION_ORDINALS[5]}: ختام الاجتماع</div>
            <div class="sec-p">وحيث لم يكن هناك ما يُستجد من أعمال، رُفعت الجلسة، وتم تحرير هذا المحضر وتوقيعه من المختصين.</div>
          </div>

          ${meeting.notes ? `<div class="sec"><div class="sec-h">ملاحظات</div><div class="sec-p" style="white-space:pre-wrap;">${escapeHtml(meeting.notes)}</div></div>` : ""}

          <div class="sig-grid">
            <div class="sig-col">
              <div class="sig-title">رئيس ${escapeHtml(asmName)}</div>
              <div class="sig-name">${chairman ? escapeHtml(chairman.attendeeName) : "(__________)"}</div>
              <div class="sig-role">(${chairman && chairman.attendeeRole ? escapeHtml(chairman.attendeeRole) : "رئيس مجلس الإدارة"})</div>
              ${chairSig ? `<img class="sig-img" src="${chairSig}" alt="" />` : ""}
              <div class="sig-line">التوقيع: ........................</div>
            </div>
            <div class="sig-col">
              <div class="sig-title">أمين سر ${escapeHtml(asmName)}</div>
              <div class="sig-name">${secretary ? escapeHtml(secretary.attendeeName) : "(__________)"}</div>
              <div class="sig-role">(${secretary && secretary.attendeeRole ? escapeHtml(secretary.attendeeRole) : "أمين سر مجلس الإدارة"})</div>
              ${secSig ? `<img class="sig-img" src="${secSig}" alt="" />` : ""}
              <div class="sig-line">التوقيع: ........................</div>
            </div>
          </div>

          <div class="footer">
            <div>${escapeHtml(co.nameAr)} — س.ت ${escapeHtml(co.cr)}</div>
            <div>محضر ${escapeHtml(mType)} رسمي — تم الإصدار: ${new Date().toLocaleDateString("ar-SA-u-nu-latn")}</div>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
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
      description: r.description,
      resolutionType: r.resolutionType,
      assemblyType: r.assemblyType,
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
