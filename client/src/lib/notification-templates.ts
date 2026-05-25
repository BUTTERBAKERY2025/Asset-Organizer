import type { SystemNotification } from "@shared/schema";

export type NotificationTemplate = {
  id: string;
  label: string;
  category: "eid" | "ramadan" | "national" | "employee" | "achievement" | "general";
  icon: string;
  preview: string;
  data: Partial<SystemNotification>;
};

const BUTTER_GOLD = "#d4a017";

export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  // === الأعياد ===
  {
    id: "eid_fitr",
    label: "عيد الفطر المبارك",
    category: "eid",
    icon: "🌙",
    preview: "كل عام وأنتم بخير — تهنئة عيد الفطر السعيد",
    data: {
      title: "عيد الفطر المبارك",
      content:
        "إلى فريق Butter Bakery الكريم،\nتقبّل الله منا ومنكم صالح الأعمال، وأعاده عليكم وعلى أسركم باليُمن والخير والبركات.\nكل عام وأنتم بخير 🌙✨\n\nمع خالص التهاني،\nإدارة Butter Bakery",
      messageType: "greeting",
      displayStyle: "modal",
      priority: 4,
      emoji: "🌙",
      effectType: "fireworks",
      animationType: "zoom",
      backgroundColor: "#fffbe6",
      textColor: "#5a3e00",
      accentColor: BUTTER_GOLD,
      soundEnabled: true,
      soundType: "fanfare",
    },
  },
  {
    id: "eid_adha",
    label: "عيد الأضحى المبارك",
    category: "eid",
    icon: "🕋",
    preview: "تهنئة عيد الأضحى وتقبّل الله طاعتكم",
    data: {
      title: "عيد الأضحى المبارك",
      content:
        "إلى فريق Butter Bakery الموقّر،\nبمناسبة حلول عيد الأضحى المبارك، نتقدّم لكم بأطيب التهاني وأجمل الأمنيات.\nتقبّل الله منا ومنكم صالح الأعمال، وأعاد الله علينا وعليكم هذه المناسبة باليُمن والبركات.\nكل عام وأنتم بألف خير 🕋🐑\n\nمع خالص التقدير،\nإدارة Butter Bakery",
      messageType: "greeting",
      displayStyle: "modal",
      priority: 4,
      emoji: "🕋",
      effectType: "fireworks",
      animationType: "zoom",
      backgroundColor: "#fffbe6",
      textColor: "#5a3e00",
      accentColor: BUTTER_GOLD,
      soundEnabled: true,
      soundType: "fanfare",
    },
  },
  // === رمضان ===
  {
    id: "ramadan_kareem",
    label: "رمضان كريم",
    category: "ramadan",
    icon: "🌙",
    preview: "تهنئة بحلول شهر رمضان المبارك",
    data: {
      title: "رمضان كريم",
      content:
        "إلى فريق Butter Bakery،\nأبارك لكم حلول شهر رمضان المبارك، شهر الرحمة والمغفرة والبركة.\nنسأل الله أن يبلّغنا وإياكم صيامه وقيامه، وأن يجعلنا فيه من المقبولين الفائزين 🌙✨\n\nرمضان مبارك،\nإدارة Butter Bakery",
      messageType: "greeting",
      displayStyle: "modal",
      priority: 4,
      emoji: "🌙",
      effectType: "sparkles",
      animationType: "fade",
      backgroundColor: "#f5f0e1",
      textColor: "#4a3500",
      accentColor: BUTTER_GOLD,
      soundEnabled: false,
    },
  },
  // === المناسبات الوطنية ===
  {
    id: "saudi_national_day",
    label: "اليوم الوطني السعودي",
    category: "national",
    icon: "🇸🇦",
    preview: "تهنئة اليوم الوطني للمملكة العربية السعودية",
    data: {
      title: "اليوم الوطني السعودي 🇸🇦",
      content:
        "بكل فخر واعتزاز نحتفل باليوم الوطني للمملكة العربية السعودية.\nنرفع أسمى آيات التهاني لمقام خادم الحرمين الشريفين وسمو ولي عهده الأمين، وللشعب السعودي الكريم.\nدمتِ يا بلادي عزّاً وأمناً ورخاءً 🇸🇦💚\n\nهي لنا دار،\nإدارة Butter Bakery",
      messageType: "celebration",
      displayStyle: "fullscreen",
      priority: 5,
      emoji: "🇸🇦",
      effectType: "fireworks",
      animationType: "bounce",
      backgroundColor: "#0d4f1c",
      textColor: "#ffffff",
      accentColor: "#ffffff",
      soundEnabled: true,
      soundType: "fanfare",
    },
  },
  {
    id: "founding_day",
    label: "يوم التأسيس",
    category: "national",
    icon: "🌴",
    preview: "تهنئة بمناسبة يوم التأسيس السعودي",
    data: {
      title: "يوم التأسيس 🌴",
      content:
        "بمناسبة ذكرى يوم التأسيس، نستذكر بكل فخر ثلاثة قرون من المجد والعزّ منذ تأسيس الدولة السعودية الأولى.\nدمت يا بلادنا عزاً وفخراً 🌴💚\n\nيوم بدينا،\nإدارة Butter Bakery",
      messageType: "celebration",
      displayStyle: "modal",
      priority: 4,
      emoji: "🌴",
      effectType: "confetti",
      animationType: "slide",
      backgroundColor: "#5a4a1a",
      textColor: "#ffffff",
      accentColor: "#f4c842",
      soundEnabled: false,
    },
  },
  // === الموظفين ===
  {
    id: "work_anniversary",
    label: "ذكرى انضمامك لفريقنا",
    category: "employee",
    icon: "🏆",
    preview: "تهنئة الموظف بذكرى التحاقه بالعمل (يدعم {{name}} و {{years}})",
    data: {
      title: "ذكرى التحاقك بفريق Butter Bakery 🏆",
      content:
        "نتقدّم بأحرّ التهاني للزميل/ـة {{name}} بمناسبة مرور {{years}} على انضمامه/ـا لأسرة Butter Bakery.\nنشكر تفانيكم وإخلاصكم، ونتطلع لمزيد من النجاحات معاً 🌟\n\nمع خالص الشكر،\nإدارة Butter Bakery",
      messageType: "celebration",
      displayStyle: "modal",
      priority: 3,
      emoji: "🏆",
      effectType: "confetti",
      animationType: "bounce",
      backgroundColor: "#fff5d6",
      textColor: "#4a3500",
      accentColor: BUTTER_GOLD,
      soundEnabled: true,
      soundType: "chime",
    },
  },
  {
    id: "welcome_new_employee",
    label: "ترحيب بموظف جديد",
    category: "employee",
    icon: "🎉",
    preview: "ترحيب بموظف جديد ينضم للفريق",
    data: {
      title: "أهلاً بك في عائلة Butter Bakery 🎉",
      content:
        "نرحّب بانضمام الزميل/ـة {{name}} إلى فريق العمل.\nنتمنى له/ـا التوفيق والنجاح في مهامه/ـا الجديدة، وأن تكون رحلته/ـا معنا مليئة بالإنجازات والإبداع.\n\nأهلاً وسهلاً 🌟",
      messageType: "greeting",
      displayStyle: "slide_in",
      priority: 2,
      emoji: "🎉",
      effectType: "sparkles",
      animationType: "slide",
      backgroundColor: "#fffbe6",
      textColor: "#4a3500",
      accentColor: BUTTER_GOLD,
      soundEnabled: false,
    },
  },
  {
    id: "promotion",
    label: "تهنئة بالترقية",
    category: "employee",
    icon: "🥇",
    preview: "تهنئة الموظف بالترقية أو المنصب الجديد",
    data: {
      title: "تهنئة بالترقية 🥇",
      content:
        "نبارك للزميل/ـة {{name}} ترقيته/ـا إلى منصب {{position}}.\nنسأل الله لكم التوفيق والسداد في مسؤولياتكم الجديدة، ومزيداً من التقدّم والإبداع 🌟\n\nمع خالص التهاني،\nإدارة Butter Bakery",
      messageType: "celebration",
      displayStyle: "modal",
      priority: 4,
      emoji: "🥇",
      effectType: "confetti",
      animationType: "zoom",
      backgroundColor: "#fff5d6",
      textColor: "#4a3500",
      accentColor: BUTTER_GOLD,
      soundEnabled: true,
      soundType: "fanfare",
    },
  },
  // === الإنجازات ===
  {
    id: "performance_recognition",
    label: "تقدير الأداء المميّز",
    category: "achievement",
    icon: "⭐",
    preview: "شكر وتقدير للموظف/الفرع على الأداء المميّز",
    data: {
      title: "شكر وتقدير ⭐",
      content:
        "نتقدّم بأحرّ آيات الشكر والتقدير لـ {{name}} على الجهود المتميّزة والأداء الاستثنائي.\nأنتم نموذج يُحتذى به، نتمنى لكم دوام التألّق والنجاح 🌟\n\nمع خالص التقدير،\nإدارة Butter Bakery",
      messageType: "motivational",
      displayStyle: "modal",
      priority: 3,
      emoji: "⭐",
      effectType: "stars",
      animationType: "zoom",
      backgroundColor: "#fffbe6",
      textColor: "#4a3500",
      accentColor: BUTTER_GOLD,
      soundEnabled: true,
      soundType: "chime",
    },
  },
  {
    id: "sales_milestone",
    label: "تحقيق هدف المبيعات",
    category: "achievement",
    icon: "🎯",
    preview: "احتفال بتحقيق هدف مبيعات للفرع/الفريق",
    data: {
      title: "هدف المبيعات تحقّق! 🎯",
      content:
        "مبروك للفريق! تم تحقيق هدف المبيعات بفضل جهودكم المتميّزة وعملكم الجاد.\nالنجاح حليفكم، استمرّوا في الإبداع 💪🔥",
      messageType: "motivational",
      displayStyle: "banner",
      priority: 3,
      emoji: "🎯",
      effectType: "confetti",
      animationType: "bounce",
      backgroundColor: "#d4f7d4",
      textColor: "#1a4d1a",
      accentColor: "#22c55e",
      soundEnabled: true,
      soundType: "fanfare",
    },
  },
  // === عامة ===
  {
    id: "system_announcement",
    label: "إعلان رسمي عام",
    category: "general",
    icon: "📢",
    preview: "إعلان رسمي للموظفين والفروع",
    data: {
      title: "إعلان مهم",
      content: "نودّ إعلامكم بـ...",
      messageType: "announcement",
      displayStyle: "modal",
      priority: 3,
      emoji: "📢",
      animationType: "fade",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      accentColor: BUTTER_GOLD,
      soundEnabled: false,
    },
  },
  {
    id: "thank_you_general",
    label: "رسالة شكر عامة",
    category: "general",
    icon: "💐",
    preview: "رسالة شكر عامة للفريق",
    data: {
      title: "شكراً لكم 💐",
      content:
        "إلى فريق Butter Bakery الكريم،\nنتقدّم بخالص الشكر والامتنان لكم جميعاً على ما تبذلونه من جهد وتفانٍ.\nبكم نحقّق التميّز يوماً بعد يوم 🌹\n\nمع كل الحب،\nإدارة Butter Bakery",
      messageType: "motivational",
      displayStyle: "slide_in",
      priority: 2,
      emoji: "💐",
      effectType: "hearts",
      animationType: "slide",
      backgroundColor: "#fff0f5",
      textColor: "#5a1a3e",
      accentColor: "#e91e63",
      soundEnabled: false,
    },
  },
];

export const TEMPLATE_CATEGORIES: { value: NotificationTemplate["category"]; label: string; icon: string }[] = [
  { value: "eid", label: "الأعياد", icon: "🌙" },
  { value: "ramadan", label: "رمضان", icon: "🌙" },
  { value: "national", label: "المناسبات الوطنية", icon: "🇸🇦" },
  { value: "employee", label: "الموظفين", icon: "👥" },
  { value: "achievement", label: "الإنجازات", icon: "🏆" },
  { value: "general", label: "عامة", icon: "📢" },
];

export function applyTemplate(template: NotificationTemplate, baseForm: Record<string, any>): Record<string, any> {
  return {
    ...baseForm,
    ...template.data,
    // Preserve targeting & scheduling (don't overwrite user's choices)
    targetAllBranches: baseForm.targetAllBranches,
    targetBranchIds: baseForm.targetBranchIds,
    targetRoleIds: baseForm.targetRoleIds,
    startDate: baseForm.startDate,
    endDate: baseForm.endDate,
    createdBy: baseForm.createdBy,
  };
}

/** Available user roles for targeting. Mirrors users.role values in the system. */
export const TARGET_ROLES: { value: string; label: string }[] = [
  { value: "admin", label: "مدير عام / Admin" },
  { value: "general_manager", label: "المدير العام التنفيذي" },
  { value: "branch_manager", label: "مدير فرع" },
  { value: "supervisor", label: "مشرف" },
  { value: "employee", label: "موظف / كاشير" },
  { value: "attendance_clerk", label: "موظف الحضور" },
  { value: "viewer", label: "مشاهد فقط" },
];
