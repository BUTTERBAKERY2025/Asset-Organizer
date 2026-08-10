import companyStampSvgRaw from "@assets/company-stamp.svg?raw";

// ملف ختم الشركة الأصلي مساحته 810×810 لكن رسم الختم الفعلي يشغل مستطيلاً صغيراً
// (getBBox: x≈245.8 y≈304.5 w≈332 h≈157.2) — بدون قصّ الـ viewBox يظهر الختم
// ضئيلاً شبه مختفٍ داخل صندوق فارغ عند الطباعة.
const companyStampSvg = companyStampSvgRaw
  .replace(/viewBox="[^"]+"/, 'viewBox="239.8 298.5 344 169.2"')
  .replace(/\swidth="[^"]+"/, ' ')
  .replace(/\sheight="[^"]+"/, ' ');
import officialLetterhead from "@assets/official-letterhead.png?inline";
import type { BoardResolution } from "@shared/schema";
import { renderToPrintWindow, openPrintWindow, type PrintTarget } from "./print-window";

export interface VotingTokenData {
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
  voterType?: string; // 'board_member' | 'shareholder'
  boardMemberPosition?: string | null; // chairman | vice_chairman | managing_director | member ...
  voteWeight?: number | null;
}

// توقيعات أعضاء مجلس الإدارة المعتمدين للقرار — مصدرها جدول resolution_signatures
// (نفس مصدر التوقيعات الذي تستخدمه صفحة القرارات وطباعة قرارات الجمعية)
export interface BoardSignature {
  id: number;
  status: string;
  signatureData?: string | null;
  signedAt?: string | null;
  memberName?: string;
  memberPosition?: string;
}

const BOARD_POSITION_LABELS: Record<string, string> = {
  chairman: 'رئيس مجلس الإدارة',
  vice_chairman: 'نائب رئيس مجلس الإدارة',
  managing_director: 'العضو المنتدب',
  member: 'عضو مجلس الإدارة',
  board_member: 'عضو مجلس الإدارة',
  secretary: 'أمين سر المجلس',
  ceo: 'الرئيس التنفيذي',
};
const translateBoardPosition = (pos: string | undefined | null): string => {
  if (!pos) return 'عضو مجلس الإدارة';
  return BOARD_POSITION_LABELS[pos] || pos;
};

const computeHijriDate = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(date);
  const day = parts.find(p => p.type === 'day')?.value || '1';
  const month = parts.find(p => p.type === 'month')?.value || '1';
  const year = parts.find(p => p.type === 'year')?.value || '1447';
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
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

export const buildBoardResolutionHtml = (resolution: BoardResolution, tokens: VotingTokenData[], signatures: BoardSignature[] = []): string => {
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
  // حماية XSS: توقيع صالح = data URI كامل وصارم (MIME + base64 فقط) —
  // أي محرف خارج أبجدية base64 (مثل علامة اقتباس لكسر السمة) يرفض التوقيع بالكامل.
  const isValidSignature = (data: string | undefined | null): boolean => {
    if (!data) return false;
    return /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(data);
  };

  // ترتيب المصوتين حسب المنصب: الرئيس ← نائب الرئيس ← العضو المنتدب ← أمين السر ← الأعضاء
  // (لأعضاء مجلس الإدارة فقط؛ المساهمون يبقون بترتيبهم الأصلي)
  const POSITION_RANK: Record<string, number> = {
    chairman: 0,
    vice_chairman: 1,
    managing_director: 2,
    ceo: 3,
    secretary: 4,
    member: 5,
    board_member: 5,
  };
  const positionRank = (t: VotingTokenData): number =>
    POSITION_RANK[t.boardMemberPosition || ''] ?? 9;

  // Calculate vote summary
  const forVotes = votedTokens.filter(t => t.vote === 'for').length;
  const againstVotes = votedTokens.filter(t => t.vote === 'against').length;
  const abstainVotes = votedTokens.filter(t => t.vote === 'abstain').length;
  const totalSharesVoted = votedTokens.reduce((sum, t) => sum + (t.numberOfShares || 0), 0);

  // قرارات مجلس الإدارة تُحتسب بعدد الأصوات (صوت لكل عضو) وليس بالأسهم —
  // بخلاف قرارات الجمعيات التي تُحتسب بالأسهم حسب نظام الشركات.
  // التصنيف: وجود مصوّت من نوع عضو مجلس، أو (قرار غير جمعوي وأسهمه صفر) —
  // قرارات الجمعيات لا تتحول أبداً للاحتساب بالرأس حتى لو كانت الأسهم صفراً.
  const isAssemblyResolution =
    resolution.resolutionType === 'extraordinary' ||
    resolution.resolutionType === 'extraordinary_assembly' ||
    resolution.resolutionType === 'general_assembly' ||
    resolution.resolutionType === 'ordinary_assembly';
  // أي قرار غير جمعوي هو قرار مجلس إدارة يُحتسب بالرأس ويُعرض بنسق «عضو» —
  // حتى لو لم يُسجَّل عليه تصويت إلكتروني بعد (مثل RES-2026-0019)، لا يتحول
  // أبداً لنسق المساهمين/الأسهم الخاص بالجمعيات.
  const isBoardVote =
    votedTokens.some(t => t.voterType === 'board_member') ||
    (!isAssemblyResolution && totalSharesVoted === 0);

  // ترتيب المصوتين حسب المنصب لقرارات المجلس فقط؛ المساهمون يبقون بترتيبهم الأصلي.
  const orderedTokens = isBoardVote
    ? [...votedTokens].sort((a, b) => {
        const ra = positionRank(a);
        const rb = positionRank(b);
        if (ra !== rb) return ra - rb;
        return (a.votedAt || '').localeCompare(b.votedAt || '');
      })
    : votedTokens;
  const forShares = votedTokens.filter(t => t.vote === 'for').reduce((sum, t) => sum + (t.numberOfShares || 0), 0);
  const approvalPercentage = isBoardVote
    ? (votedTokens.length > 0 ? ((forVotes / votedTokens.length) * 100).toFixed(2) : '0')
    : (totalSharesVoted > 0 ? ((forShares / totalSharesVoted) * 100).toFixed(2) : '0');

  // حساب الأغلبية المطلوبة حسب نظام الشركات السعودي 1443هـ
  const requiredMajorityInfo = getRequiredMajority(resolution);
  // قرارات بلا تصويت إلكتروني (اعتُمدت بالتمرير والتوقيع): النتيجة من حالة القرار
  // نفسه لا من نسبة أصوات صفرية — وإلا ظهر قرار معتمد كأنه «غير معتمد 0%».
  const noVotes = votedTokens.length === 0;
  const statusApproved = ['approved', 'implemented', 'completed'].includes(resolution.status || '');
  const isApproved = noVotes ? statusApproved : Number(approvalPercentage) >= requiredMajorityInfo.percentage;
  const isUnanimous = isApproved && (noVotes || (forVotes === votedTokens.length && votedTokens.length > 0));
  const resultLabel = isApproved ? (isUnanimous ? 'معتمد بالإجماع' : 'معتمد') : 'غير معتمد';
  const voterNoun = isBoardVote ? 'عضو' : 'مساهم';

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

  // تقسيم نص القرار إلى بنود (أولاً، ثانياً، ...) لعرض سجل التصويت أسفل كل بند.
  // يُعيد المقدمة (إن وُجدت) ثم كل بند بعنوانه ونصّه بعد التنقية. عند تعذّر اكتشاف
  // بنود مُرقّمة يُعاد مصفوفة فارغة فيتم الرجوع تلقائياً إلى جدول تصويت واحد مُجمّع.
  type Clause = { title: string; body: string };
  const buildClauses = (raw: string | undefined | null): { preamble: string; clauses: Clause[] } => {
    const text = fixHijriInText(sanitize(raw || ''));
    if (!text.trim()) return { preamble: '', clauses: [] };
    const ord = '(?:أولا|ثانيا|ثالثا|رابعا|خامسا|سادسا|سابعا|ثامنا|تاسعا|عاشرا)';
    // المحاولة الأولى: العلامة في بداية سطر مع أي فاصل. الثانية: العلامة متبوعة
    // بنقطتين في أي موضع (تلتقط الحالة التي يكون فيها النص فقرة واحدة بلا أسطر).
    const tryRes = [
      new RegExp('(?:^|\\n)\\s*(' + ord + '[\u064b\ufe8d]?)\\s*[:\uff1a.\\-\u2013]', 'g'),
      new RegExp('(' + ord + '[\u064b\ufe8d]?)\\s*[:\uff1a]', 'g'),
    ];
    let marks: { idx: number }[] = [];
    for (const re of tryRes) {
      marks = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        marks.push({ idx: m.index + m[0].indexOf(m[1]) });
      }
      if (marks.length >= 2) break;
    }
    if (marks.length < 2) return { preamble: text.trim(), clauses: [] };
    const preamble = text.slice(0, marks[0].idx).trim();
    const clauses: Clause[] = [];
    for (let i = 0; i < marks.length; i++) {
      const segEnd = i + 1 < marks.length ? marks[i + 1].idx : text.length;
      const seg = text.slice(marks[i].idx, segEnd).trim();
      const nl = seg.search(/\r?\n/);
      let title = '';
      let body = seg;
      if (nl !== -1) { title = seg.slice(0, nl).trim(); body = seg.slice(nl + 1).trim(); }
      if (!body) { body = title; title = ''; }
      clauses.push({ title, body });
    }
    return { preamble, clauses };
  };
  const { preamble: clausePreamble, clauses } = buildClauses(resolution.description);

  // ----- ordered flow items: html = fixed block, text = splittable resolution text -----
  type FlowItem =
    | { kind: 'html'; html: string; head?: boolean; beforeTable?: boolean }
    | { kind: 'text'; cls: 'res-box' | 'res-intro'; title?: string; text: string }
    | { kind: 'table' };
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
        (noVotes
          ? '<div class="info-cell"><div class="lbl">آلية الاعتماد</div><div class="val">بالتمرير والتوقيع</div></div>' +
            '<div class="info-cell"><div class="lbl">نتيجة القرار</div><div class="val ' + (isApproved ? 'ok' : 'reject') + '">' + resultLabel + '</div></div>'
          : '<div class="info-cell"><div class="lbl">عدد المصوتين</div><div class="val">' + votedTokens.length + ' ' + voterNoun + '</div></div>' +
            (isBoardVote
              ? '<div class="info-cell"><div class="lbl">الأصوات</div><div class="val">' + forVotes + ' موافق من ' + votedTokens.length + '</div></div>'
              : '<div class="info-cell"><div class="lbl">الأسهم المصوتة</div><div class="val">' + totalSharesVoted.toLocaleString('en-US') + '</div></div>') +
            '<div class="info-cell"><div class="lbl">نتيجة التصويت</div><div class="val ' + (isApproved ? 'ok' : 'reject') + '">' + approvalPercentage + '% ' + resultLabel + '</div></div>') +
      '</div>' },
    { kind: 'html', html: '<div class="section-head">نص القرار</div>', head: true },
  ];

  if (clauses.length) {
    // لكل بند: نص البند ثم سجل تصويت المساهمين أسفله (نفس مواقف القرار ككل).
    if (clausePreamble) flowItems.push({ kind: 'text', cls: 'res-intro', text: clausePreamble });
    clauses.forEach((c) => {
      flowItems.push({ kind: 'text', cls: 'res-box', title: c.title || undefined, text: c.body || '-' });
      if (!noVotes) {
        flowItems.push({ kind: 'html', html: '<div class="section-head">سجل التصويت على هذا البند</div>', head: true, beforeTable: true });
        flowItems.push({ kind: 'table' });
      }
    });
  } else {
    // لا توجد بنود مُرقّمة: نعرض نص القرار كاملاً مع جدول تصويت واحد كما كان.
    buildResolutionBlocks(resolution.description).forEach((b) => {
      flowItems.push({ kind: 'text', cls: b.cls, title: b.title, text: b.text });
    });
    if (!noVotes) {
      flowItems.push({ kind: 'html', html: '<div class="section-head">سجل التصويت</div>', head: true, beforeTable: true });
      flowItems.push({ kind: 'table' });
    }
  }

  // ----- voting table parts (head row + body rows + totals) -----
  const tableHeadHtml =
    '<tr>' +
      '<th style="width:5%;">#</th>' +
      '<th class="name" style="width:25%;">' + (isBoardVote ? 'اسم العضو' : 'اسم المساهم') + '</th>' +
      '<th style="width:13%;">' + (isBoardVote ? 'الصفة' : 'عدد الأسهم') + '</th>' +
      '<th style="width:11%;">التصويت</th>' +
      '<th style="width:20%;">تاريخ ووقت التصويت</th>' +
      '<th style="width:26%;">التوقيع</th>' +
    '</tr>';

  const tableRowHtmls: string[] = orderedTokens.map((token, idx) => {
    const voteClass = token.vote === 'for' ? 'vt-for' : token.vote === 'against' ? 'vt-against' : 'vt-abstain';
    const voteText = voteLabels[token.vote || ''] || sanitize(token.vote || '');
    const dateStr = token.votedAt ? new Date(token.votedAt).toLocaleTimeString('en-GB') + ' — ' + new Date(token.votedAt).toLocaleDateString('en-GB') : '-';
    const signTxt = isValidSignature(token.signatureData)
      ? '<img class="vt-sign-img" src="' + token.signatureData + '" alt="توقيع ' + voterNoun + '" /><span class="sign-elec">موقّع إلكترونياً</span>'
      : '<span style="color:#bbb;">-</span>';
    return '<tr>' +
      '<td>' + (idx + 1) + '</td>' +
      '<td class="name">' + sanitize(token.shareholderName) + '</td>' +
      '<td>' + (isBoardVote ? sanitize(translateBoardPosition(token.boardMemberPosition)) : (token.numberOfShares || 0).toLocaleString('en-US')) + '</td>' +
      '<td><span class="vt-badge ' + voteClass + '">' + voteText + '</span></td>' +
      '<td>' + dateStr + '</td>' +
      '<td>' + signTxt + '</td>' +
    '</tr>';
  });

  // Totals rendered as a standalone block (not a <tfoot>) so the paginator can
  // place it cleanly after the last chunk of rows.
  const totalsBlockHtml = noVotes ? '' :
    '<div class="vt-total">' +
      '<span>الإجمالي: ' + votedTokens.length + ' ' + voterNoun + '</span>' +
      (isBoardVote ? '' : '<span>إجمالي الأسهم: ' + totalSharesVoted.toLocaleString('en-US') + '</span>') +
      '<span>نسبة الموافقة ' + approvalPercentage + '% (' + forVotes + ' موافق / ' + againstVotes + ' رافض / ' + abstainVotes + ' ممتنع)</span>' +
    '</div>';

  // قسم توقيعات أعضاء مجلس الإدارة المعتمدين للقرار (إن وُجدت طلبات توقيع).
  // التوقيعات تُجلب من نفس مصدر صفحة القرارات حتى تظهر هنا كما تظهر في قرارات الجمعية.
  // استبعاد رئيس مجلس الإدارة من شبكة البطاقات لأنه يظهر بالفعل في كتلة التوقيع
  // الرسمي بالأسفل (مع ختم الشركة) — منعاً لتكرار اسمه وتوقيعه.
  const boardMemberSigs = signatures
    .filter((sig) => {
      const n = normalizeAr(sig.memberName);
      return !(n.startsWith('عبدالحافظ') && n.includes('مكوش'));
    })
    // ترتيب بطاقات التوقيعات حسب المنصب أيضاً: نائب الرئيس ← العضو المنتدب ← الأعضاء
    .sort((a, b) => (POSITION_RANK[a.memberPosition || ''] ?? 9) - (POSITION_RANK[b.memberPosition || ''] ?? 9));
  const memberSignaturesHtml = boardMemberSigs.length
    ? '<div class="section-head" style="margin-top:10px;">توقيعات أعضاء مجلس الإدارة</div>' +
      '<div class="sig-grid">' +
      boardMemberSigs.map((sig) => {
        const signed = sig.status === 'signed';
        const img = signed && isValidSignature(sig.signatureData) ? sig.signatureData : '';
        const inner = img
          ? '<img class="sig-img2" src="' + img + '" alt="توقيع ' + sanitize(sig.memberName) + '" />'
          : sig.status === 'declined'
            ? '<span class="sig-x">✗ رفض التوقيع</span>'
            : '<span class="sig-wait">في انتظار التوقيع</span>';
        // تاريخ التوقيع في المستند الرسمي = تاريخ القرار نفسه (وليس تاريخ التوقيع الفعلي في النظام)
        const dateLine = signed ? '<span class="sig-date">تاريخ التوقيع: ' + gregDateStr + '</span>' : '';
        const okBadge = signed ? '<span class="sig-ok">✓ موقّع</span>' : sig.status === 'declined' ? '<span class="sig-rej">✗ مرفوض</span>' : '<span class="sig-pend">⏳ معلّق</span>';
        return '<div class="sig-card ' + (signed ? 'signed' : sanitize(sig.status)) + '">' +
          '<div class="sig-role">' + sanitize(translateBoardPosition(sig.memberPosition)) + '</div>' +
          '<div class="sig-name">' + sanitize(sig.memberName) + '</div>' +
          '<div class="sig-img-wrap">' + inner + '</div>' +
          '<div class="sig-foot">' + okBadge + dateLine + '</div>' +
          '</div>';
      }).join('') +
      '</div>'
    : '';

  const printNow = new Date();
  // توقيع رئيس مجلس الإدارة: مصدره الأساسي جدول طلبات التوقيع (resolution_signatures)
  // — لأن القرارات المعتمدة بالتمرير لا تملك voting_tokens أصلاً — مع التراجع
  // لتوقيع التصويت الإلكتروني إن وُجد. الرئيس مستبعد من شبكة البطاقات أعلاه،
  // لذا يجب أن يظهر هنا بجانب ختم الشركة وإلا اختفى توقيعه من المستند كلياً.
  const chairmanSigEntry = signatures.find((sig) => {
    const n = normalizeAr(sig.memberName);
    return n.startsWith('عبدالحافظ') && n.includes('مكوش');
  });
  const chairmanSigImg =
    (chairmanSigEntry && chairmanSigEntry.status === 'signed' && isValidSignature(chairmanSigEntry.signatureData))
      ? chairmanSigEntry.signatureData!
      : chairmanSig;
  const chairmanDisplayName = chairmanSigEntry?.memberName || chairmanName;
  const chairmanColHtml =
    '<div class="chair-col">' +
      '<div class="sign-role">رئيس مجلس الإدارة</div>' +
      (chairmanSigImg
        ? '<img class="chair-sig" src="' + chairmanSigImg + '" alt="توقيع رئيس مجلس الإدارة" />'
        : '<div class="sign-blank"></div>') +
      '<div class="sign-name">' + sanitize(chairmanDisplayName) + '</div>' +
    '</div>';
  const signBlockHtml = memberSignaturesHtml + '<div class="sign-row">' +
      chairmanColHtml +
      '<div class="stamp-col">' +
        '<div class="stamp-lbl">ختم الشركة</div>' +
        '<div class="stamp-svg">' + companyStampSvg + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="doc-note">مستند رسمي صادر إلكترونياً عبر نظام إدارة حوكمة الشركات | تاريخ الطباعة: ' + printNow.toLocaleDateString('en-GB') + ' — ' + printNow.toLocaleTimeString('en-GB') + ' | رقم القرار ' + (sanitize(resolution.resolutionNumber) || '-') + '</div>';

  // نسخة مضغوطة من كتلة الختم والتوقيعات: يستخدمها المُرقّم عندما لا تتسع الكتلة
  // الكاملة في نهاية الصفحة — حتى لا يظهر الختم وحيداً في صفحة ثانية.
  const signBlockCompactHtml = '<div class="sign-compact">' + signBlockHtml + '</div>';

  // Inject runtime data into the print window's pagination script. Escaping `</`
  // prevents any data URI / SVG string from prematurely closing the <script> tag.
  const toJs = (v: unknown) => JSON.stringify(v).replace(/<\//g, '<\\/');

  // All print data is serialized into a single JSON island (a
  // <script type="application/json"> block). The HTML parser treats its
  // contents as inert text, so no value here can ever break the executable
  // script's JS syntax — which previously could fail to parse on certain
  // characters and leave the user with a completely blank print page.
  const printDataJson = toJs({
    BG: officialLetterhead,
    flow: flowItems,
    theadHtml: tableHeadHtml,
    rowHtmls: tableRowHtmls,
    totalsHtml: totalsBlockHtml,
    signHtml: signBlockHtml,
    signHtmlCompact: signBlockCompactHtml,
  });

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
        .sheet { position: relative; width: 210mm; height: 297mm; overflow: hidden; background: #fff; page-break-after: always; break-after: page; margin: 0 auto; }
        .sheet:last-child { page-break-after: auto; break-after: auto; }
        .sheet-bg { position: absolute; top: 0; left: 0; width: 210mm; height: 297mm; z-index: 0; }
        /* Insets matched to the official letterhead artwork: header gold rule ends
           at ~54mm, footer green rule sits at ~274mm, side rules inset ~20mm. */
        .sheet-content { position: absolute; top: 56mm; left: 20mm; right: 20mm; bottom: 30mm; z-index: 1; overflow: hidden; }
        /* Sits in the clear white band just above the letterhead's footer rule. */
        .pagenum { position: absolute; bottom: 25mm; left: 0; right: 0; text-align: center; font-size: 8px; color: #8a8a8a; z-index: 2; }
        #measure { position: absolute; left: -10000px; top: 0; width: 170mm; visibility: hidden; }

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
        .vt-sign-img { height: 18px; width: auto; max-width: 86px; display: block; margin: 0 auto 1px; mix-blend-mode: multiply; }

        .vt-total { display: flex; justify-content: space-between; gap: 8px; background: #f3ead2; color: #5a4a1e; font-weight: 700; padding: 6px 10px; font-size: 9px; border-radius: 4px; margin-bottom: 8px; }

        .sign-row { display: flex; justify-content: center; align-items: flex-end; margin-top: 12px; }
        .sign-col { flex: 1; text-align: center; }
        .sign-role { font-size: 10px; font-weight: 700; color: #2b3a4f; margin-bottom: 6px; }
        .sign-img { height: 44px; width: auto; max-width: 150px; display: block; margin: 0 auto 3px; }
        .sign-blank { height: 42px; }
        .sign-name { font-size: 9px; font-weight: 600; color: #333; border-top: 1px solid #b9b9b9; padding-top: 4px; display: inline-block; min-width: 170px; }
        .sign-row { gap: 40px; }
        .chair-col { text-align: center; padding-bottom: 24px; }
        .chair-sig { height: 60px; width: auto; max-width: 200px; display: block; margin: 0 auto 3px; mix-blend-mode: multiply; }
        .sign-compact .chair-sig { height: 40px; }
        .sign-compact .chair-col { padding-bottom: 12px; }
        .stamp-col { text-align: center; }
        .stamp-lbl { font-size: 9px; color: #888; margin-bottom: 4px; }
        .stamp-svg { display: inline-block; }
        .stamp-svg svg { width: 220px; height: auto; }
        /* الوضع المضغوط: ختم أصغر وهوامش أقل ليتسع الختم في نفس صفحة المحتوى */
        .sign-compact .stamp-svg svg { width: 150px; height: auto; }
        .sign-compact .sign-row { margin-top: 4px; }
        .sign-compact .sig-card { padding: 4px 8px 3px; }
        .sign-compact .sig-img2 { max-height: 34px; }
        .sign-compact .doc-note { margin-top: 4px; }

        /* بطاقات توقيع أعضاء مجلس الإدارة (مطابقة لأسلوب صفحة القرارات) */
        .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 4px 0 8px; }
        .sig-card { border: 1px solid #e3dcc6; border-radius: 7px; padding: 7px 10px 5px; background: #fffdf8; text-align: center; page-break-inside: avoid; break-inside: avoid; }
        .sig-card.signed { border-color: #cfe3d6; background: #fbfdfb; }
        .sig-card.declined { border-color: #f0c0c0; background: #fdf6f6; }
        .sig-role { font-size: 8px; color: #b8962f; font-weight: 700; margin-bottom: 2px; }
        .sig-name { font-size: 11px; font-weight: 700; color: #2b3a4f; margin-bottom: 3px; }
        .sig-img-wrap { height: 38px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; border-bottom: 1px solid #e7e2d4; padding-bottom: 3px; }
        .sig-img2 { max-height: 36px; max-width: 160px; mix-blend-mode: multiply; }
        .sig-wait { font-size: 8px; color: #b0a98f; }
        .sig-x { font-size: 8px; color: #c0392b; }
        .sig-foot { display: flex; justify-content: center; gap: 8px; align-items: center; flex-wrap: wrap; }
        .sig-ok { font-size: 8px; color: #2e7d52; font-weight: 700; }
        .sig-rej { font-size: 8px; color: #c0392b; font-weight: 700; }
        .sig-pend { font-size: 8px; color: #b8860b; font-weight: 700; }
        .sig-date { font-size: 8px; color: #888; }

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
      <script id="print-data" type="application/json">${printDataJson}</script>
      <script>
      (function () {
        var MM = 96 / 25.4;
        var AVAIL = (297 - 56 - 30) * MM; // usable content height per sheet (px)
        // Data is read from the JSON island; this executable script contains no
        // interpolated data, so it always parses and the fallback/watchdog below
        // are guaranteed to run even on unusual input.
        var __D__ = {};
        try { __D__ = JSON.parse(document.getElementById('print-data').textContent); } catch (e) { __D__ = {}; }
        var BG = __D__.BG || '';
        var flow = __D__.flow || [];
        var theadHtml = __D__.theadHtml || '';
        var rowHtmls = __D__.rowHtmls || [];
        var totalsHtml = __D__.totalsHtml || '';
        var signHtml = __D__.signHtml || '';
        var signHtmlCompact = __D__.signHtmlCompact || signHtml;

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
            var rows = (rowHtmls && rowHtmls.length) ? rowHtmls.join('') : NO_VOTERS;
            for (var i = 0; i < flow.length; i++) {
              var it = flow[i];
              if (it.kind === 'table') {
                html += '<table class="vt"><thead>' + theadHtml + '</thead><tbody>' + rows + '</tbody></table>';
              } else if (it.kind === 'html') { html += it.html; }
              else {
                var t = (it.title) ? '<div class="res-box-title">' + it.title + '</div>' : '';
                html += (it.cls === 'res-intro')
                  ? '<div class="res-intro">' + it.text + '</div>'
                  : '<div class="res-box">' + t + '<div class="res-box-text">' + it.text + '</div></div>';
              }
            }
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

          // Emit one voting table, re-emitting the header row at the top of every
          // sheet chunk. The same shared rows/heights are reused under each بند.
          function emitTable() {
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
          }

          // Flow items (header + splittable resolution text + per-بند voting tables).
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
                  : nx.kind === 'table'
                    ? theadH + (rowH[0] || 30)
                    : measureHtml(renderText(nx, firstLineOf(nx), false)); // first text fragment
              }
              if (curH + headH + follow > AVAIL && cur.length) { flush(); }
              cur.push(it.html); curH += headH;
            } else if (it.kind === 'html') {
              add(it.html, measureHtml(it.html));
            } else if (it.kind === 'table') {
              emitTable();
            } else {
              placeText(it);
            }
          }

          add(totalsHtml, measureHtml(totalsHtml));
          // كتلة الختم والتوقيعات: إن لم تتسع كاملةً في بقية الصفحة نجرب النسخة
          // المضغوطة (ختم أصغر) قبل اللجوء لصفحة جديدة — حتى لا يطلع الختم وحده في صفحة.
          (function () {
            var fullH = measureHtml(signHtml);
            if (curH + fullH <= AVAIL || !cur.length) { cur.push(signHtml); curH += fullH; return; }
            var compactH = measureHtml(signHtmlCompact);
            if (curH + compactH <= AVAIL) { cur.push(signHtmlCompact); curH += compactH; return; }
            flush(); cur.push(signHtml); curH += fullH;
          })();
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

  return printContent;
};

// جلب توقيعات أعضاء مجلس الإدارة للقرار من نفس مصدر صفحة القرارات.
// يُرجع مصفوفة فارغة بهدوء عند أي خطأ حتى لا تتعطل الطباعة.
export async function fetchBoardResolutionSignatures(resolutionId: number): Promise<BoardSignature[]> {
  try {
    const res = await fetch('/api/governance/resolutions/' + resolutionId + '/signatures', { credentials: 'include' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export const printBoardResolutionWithSignatures = async (resolution: BoardResolution, tokens: VotingTokenData[], targetWindow?: PrintTarget | null) => {
  // نفتح نافذة الطباعة بشكل متزامن أولاً (قبل أي await) لتفادي حظر النوافذ المنبثقة.
  const printTarget = targetWindow ?? openPrintWindow();
  if (!printTarget.win) return;
  const signatures = await fetchBoardResolutionSignatures(resolution.id);
  const printContent = buildBoardResolutionHtml(resolution, tokens, signatures);
  renderToPrintWindow(printTarget, printContent);
};
