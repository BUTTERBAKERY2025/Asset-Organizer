import { renderToPrintWindow, openPrintWindow, type PrintTarget } from "./print-window";

export interface PrintMeetingMinutes {
  id: number;
  meetingId: number;
  minutesNumber: string;
  content: string;
  summary: string | null;
  attendanceList: any;
  discussionPoints: any;
  decisions: any;
  votingResults?: any;
  status?: string;
  isLocked?: boolean;
}

export interface PrintMinutesMeeting {
  id: number;
  meetingType: string;
  title: string;
  meetingDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  locationType: string;
  virtualMeetingLink: string | null;
}

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

export const printMeetingMinutes = async (m: PrintMeetingMinutes, meeting?: PrintMinutesMeeting, targetWindow?: PrintTarget | null) => {
  const printWindow = targetWindow ?? openPrintWindow();
  const meetingDate = meeting?.meetingDate ? new Date(meeting.meetingDate) : new Date();
  const hijriDate = computeHijriDate(meetingDate);
  const hijriFull = formatHijriFull(meetingDate);
  const gregorianDate = meetingDate.toLocaleDateString('ar-SA-u-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const gregorianShort = meetingDate.toLocaleDateString('en-GB');
  const dayName = meetingDate.toLocaleDateString('ar-SA-u-nu-latn', { weekday: 'long' });
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
          if (sigRes.ok) {
            const sigs = await sigRes.json();
            for (const s of (Array.isArray(sigs) ? sigs : [])) {
              if (s.status !== 'signed' || !isSafeSig(s.signatureData)) continue;
              const entry = { url: s.signatureData as string, signedAt: s.signedAt };
              const name = s.memberName || s.signerName;
              if (name && !sigByName.has(normName(name))) sigByName.set(normName(name), entry);
              if (s.shareholderId && !sigByShareholderId.has(Number(s.shareholderId))) sigByShareholderId.set(Number(s.shareholderId), entry);
            }
          }
        } catch {}
        try {
          const tokRes = await fetch(`/api/governance/resolutions/${resolution.id}/voting-tokens`, { credentials: 'include' });
          if (tokRes.ok) {
            const toks = await tokRes.json();
            for (const t of (Array.isArray(toks) ? toks : [])) {
              if (!isSafeSig(t.signatureData)) continue;
              const entry = { url: t.signatureData as string, signedAt: t.votedAt || t.signedAt };
              if (t.shareholderName && !sigByName.has(normName(t.shareholderName))) sigByName.set(normName(t.shareholderName), entry);
              if (t.shareholderId && !sigByShareholderId.has(Number(t.shareholderId))) sigByShareholderId.set(Number(t.shareholderId), entry);
            }
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

            const signed = votedTokens.filter((t: any) => isSafeSig(t.signatureData));
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
              <img src="${isSafeSig(t.signatureData) ? t.signatureData : ''}" alt="توقيع ${sanitize(t.shareholderName)}" style="max-width:180px;max-height:80px;border:1px solid #ddd;border-radius:4px;background:white;padding:4px;" />
              <div style="font-size:8px;color:#aaa;margin-top:5px;">تم التوقيع: ${t.votedAt ? new Date(t.votedAt).toLocaleDateString('ar-SA-u-ca-gregory') + ' ' + new Date(t.votedAt).toLocaleTimeString('ar-SA-u-nu-latn') : '-'}</div>
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
  <script>window.addEventListener('load',function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},500);});</script>
</body>
</html>`;

  if (printWindow.win) {
    renderToPrintWindow(printWindow, printContent);
  }
};
