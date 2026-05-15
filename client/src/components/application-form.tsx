import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SignaturePad } from "@/components/signature-pad";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload, AlertCircle, Briefcase, User, Phone, Heart, GraduationCap, Award, Car, Shield, Languages as LanguagesIcon, Users, PenLine, Paperclip, Building2, BookOpen, Info, Globe } from "lucide-react";

const MAX_FILE_SIZE = 1.5 * 1024 * 1024;
const MAX_TOTAL_PAYLOAD = 4 * 1024 * 1024;

type Lang = "ar" | "en";
type EduRow = { level?: string; degree: string; field: string; institution: string; city?: string; yearFrom: string; yearTo: string; gpa?: string };
type ExpRow = { company: string; position: string; from: string; to: string; current?: boolean; salary?: string; allowance?: string; addressPhone?: string; duties?: string; reasonForQuit?: string; summary?: string };
type LangRow = { name: string; level: string };
type RefRow = { name: string; position: string; company: string; phone: string; address?: string };
type DependentRow = { name: string; age: string; relation: string };
type TrainingRow = { institute: string; city: string; from: string; to: string; specialize: string };
type LangSkillRow = { language: string; speaking: string; reading: string; writing: string };

interface Props {
  initial: any;
  vacancy: any;
  company: any;
  submitting: boolean;
  error?: string;
  onSubmit: (payload: any) => void;
}

// ===== ترجمات النموذج =====
const T = {
  ar: {
    title: "طلب توظيف",
    subtitle: "EMPLOYMENT APPLICATION",
    companyDefault: "شركة الزبد الأفضل التجارية",
    cr: "س.ت",
    positionApplied: "الوظيفة المطلوبة",
    branch: "الفرع",
    requirements: "المتطلبات",
    sec_personal: "البيانات الشخصية",
    sec_id: "الهوية والجواز",
    sec_contact: "بيانات التواصل",
    sec_dependents: "المعالون",
    sec_health: "معلومات صحية ووظيفية",
    sec_experience: "الخبرات العملية",
    sec_education: "التحصيل العلمي",
    sec_training: "الدورات التدريبية",
    sec_languages: "اللغات والمهارات",
    sec_driving: "رخصة القيادة",
    sec_convictions: "السوابق القضائية",
    sec_source: "مصدر معرفة الوظيفة والمعرّفون",
    sec_attachments: "المرفقات",
    sec_declaration: "الإقرار والتوقيع",
    fullNameAr: "الاسم الرباعي بالعربية",
    fullNameEn: "الاسم الرباعي بالإنجليزية",
    firstName: "الاسم الأول",
    fatherName: "اسم الأب",
    grandfatherName: "اسم الجد",
    familyName: "اسم العائلة",
    firstNameEn: "First Name",
    fatherNameEn: "Father's Name",
    grandfatherNameEn: "Grandfather's Name",
    familyNameEn: "Family Name",
    dob: "تاريخ الميلاد",
    placeOfBirth: "مكان الميلاد",
    nationality: "الجنسية",
    religion: "الديانة",
    gender: "الجنس",
    male: "ذكر",
    female: "أنثى",
    maritalStatus: "الحالة الاجتماعية",
    single: "أعزب",
    married: "متزوج",
    divorced: "مطلق",
    widowed: "أرمل",
    bloodGroup: "فصيلة الدم",
    select: "اختر",
    idCard: "بطاقة الأحوال المدنية / الإقامة",
    idType: "نوع الهوية",
    nationalId: "هوية وطنية",
    iqama: "إقامة",
    idNumber: "رقم الهوية / الإقامة",
    placeOfIssue: "مكان الإصدار",
    expiryDate: "تاريخ الانتهاء",
    passport: "جواز السفر",
    passportNumber: "رقم الجواز",
    issueDate: "تاريخ الإصدار",
    mobile: "الجوال",
    whatsapp: "الواتساب",
    homePhone: "هاتف المنزل",
    workPhone: "هاتف العمل",
    email: "البريد الإلكتروني",
    city: "المدينة",
    address: "العنوان الحالي",
    poBox: "صندوق البريد",
    haveDependents: "هل تعول أحداً؟",
    yes: "نعم",
    no: "لا",
    name: "الاسم",
    age: "السن",
    relation: "القرابة",
    delete: "حذف",
    addDependent: "إضافة معال",
    chronicDiseases: "هل يوجد لديك أي أمراض مزمنة؟",
    chronicHint: "إن وجدت اذكرها، وإلا اترك الحقل فارغاً",
    pregnant: "هل يوجد حمل؟",
    workedBefore: "هل سبق وعملت في هذه الشركة؟",
    currentlyEmployed: "هل تعمل حالياً؟",
    canStart: "متى تستطيع مباشرة العمل؟",
    expectedSalary: "الراتب المتوقع (ريال)",
    minSalary: "الحد الأدنى المطلوب للراتب",
    gosi: "رقم التأمينات الاجتماعية (إن وجد)",
    add: "إضافة",
    expIndex: "خبرة",
    company: "اسم الشركة / صاحب العمل",
    position: "المسمى الوظيفي",
    from: "من",
    to: "إلى",
    salary: "الراتب",
    allowance: "البدلات",
    addressPhone: "الهاتف والعنوان",
    duties: "تفاصيل عن واجباتك / ملخص المهام",
    reasonForQuit: "سبب ترك العمل",
    stillWorking: "مازلت في هذه الوظيفة",
    eduLevel: "المرحلة الدراسية",
    elementary: "ابتدائي",
    intermediate: "إعدادي",
    secondary: "ثانوي",
    diploma: "دبلوم بعد الثانوية",
    university: "جامعة",
    postgraduate: "دراسات عليا",
    schoolName: "اسم المدرسة / الجامعة",
    cityCountry: "المدينة / البلد",
    field: "التخصص",
    degree: "المؤهل (بكالوريوس...)",
    gpa: "الدرجة / المعدل",
    yearFrom: "من سنة",
    yearTo: "إلى سنة",
    instituteName: "اسم المعهد",
    languages: "معرفة اللغات",
    language: "اللغة",
    speaking: "التحدث",
    reading: "القراءة",
    writing: "الكتابة",
    excellent: "ممتاز",
    good: "جيد",
    weak: "ضعيف",
    addLanguage: "إضافة لغة",
    typingSpeed: "سرعة الطباعة",
    typingHint: "كلمة/دقيقة",
    otherSkills: "مهارات أخرى",
    skillTags: "المهارات (وسوم)",
    addSkillHint: "أضف مهارة واضغط Enter",
    hobbies: "الهوايات",
    licCategory: "نوعها",
    licCategoryHint: "خاصة / عامة / دراجة...",
    licNumber: "رقمها",
    licIssueDate: "تاريخ صدورها",
    licExpiryDate: "تاريخ انتهائها",
    convicted: "هل صدرت بحقك أحكام قضائية؟",
    details: "التفاصيل",
    howKnew: "كيف عرفت عن فرصة العمل؟",
    relativesInCo: "هل لديك أقارب يعملون في شركتنا؟ (اذكرهم)",
    references: "المعرّفون (3 أشخاص)",
    noReferences: "لم تتم إضافة معرّفين",
    refName: "الاسم",
    refPosition: "الوظيفة",
    refCompany: "الشركة",
    refPhone: "الهاتف",
    refAddress: "العنوان",
    otherInfo: "هل هناك معلومات أخرى تود إضافتها؟",
    attachHint: "الحد الأقصى لكل ملف ١.٥ ميجا (إجمالي الطلب ٤ ميجا) — يجب إرفاق نسخ من الشهادات الدراسية وشهادات الخبرات العملية",
    cv: "السيرة الذاتية (PDF)",
    photo: "الصورة الشخصية",
    idCopy: "نسخة الهوية",
    uploaded: "تم الرفع ✓",
    remove: "إزالة",
    clickToUpload: "انقر للرفع",
    declaration: "أقرّ أنا الموقّع أدناه بأن جميع البيانات المذكورة في هذا الطلب صحيحة وكاملة حسب معرفتي واعتقادي، وأوافق على أن تتحققوا من صحتها، وأي معلومات غير صحيحة ستكون سبباً كافياً لمساءلتي.",
    iAgree: "أوافق على الإقرار أعلاه",
    signature: "التوقيع",
    submit: "إرسال الطلب",
    submitting: "جاري الإرسال...",
    errMissing: "بيانات ناقصة",
    errMissingDesc: "الاسم والجوال مطلوبان",
    errSignature: "التوقيع مطلوب",
    errAgree: "يجب الموافقة على الإقرار",
    errFileSize: "حجم الملف كبير",
    errFileSizeDesc: "الحد الأقصى ١.٥ ميجا لكل ملف.",
    errPayload: "حجم البيانات كبير جداً",
    errPayloadDesc: (mb: string, max: string) => `إجمالي الحجم ${mb} ميجا. الرجاء استخدام صور/ملفات أصغر (الحد الأقصى ${max} ميجا إجمالاً).`,
    errUpload: "خطأ في الرفع",
    fileUploaded: "تم رفع الملف",
    requiredMark: "*",
  },
  en: {
    title: "Employment Application",
    subtitle: "طلب توظيف",
    companyDefault: "Butter Bakery Trading Co.",
    cr: "CR",
    positionApplied: "Position Applied For",
    branch: "Branch",
    requirements: "Requirements",
    sec_personal: "Personal Information",
    sec_id: "ID & Passport",
    sec_contact: "Contact Information",
    sec_dependents: "Dependents",
    sec_health: "Health & Employment History",
    sec_experience: "Work Experience",
    sec_education: "Education",
    sec_training: "Training Courses",
    sec_languages: "Languages & Skills",
    sec_driving: "Driving License",
    sec_convictions: "Convictions",
    sec_source: "Source & References",
    sec_attachments: "Attachments",
    sec_declaration: "Declaration & Signature",
    fullNameAr: "Full Name (Arabic)",
    fullNameEn: "Full Name (English)",
    firstName: "First Name (Arabic)",
    fatherName: "Father's Name (Arabic)",
    grandfatherName: "Grandfather's Name (Arabic)",
    familyName: "Family Name (Arabic)",
    firstNameEn: "First Name",
    fatherNameEn: "Father's Name",
    grandfatherNameEn: "Grandfather's Name",
    familyNameEn: "Family Name",
    dob: "Date of Birth",
    placeOfBirth: "Place of Birth",
    nationality: "Nationality",
    religion: "Religion",
    gender: "Gender",
    male: "Male",
    female: "Female",
    maritalStatus: "Marital Status",
    single: "Single",
    married: "Married",
    divorced: "Divorced",
    widowed: "Widowed",
    bloodGroup: "Blood Group",
    select: "Select",
    idCard: "National ID / Iqama",
    idType: "ID Type",
    nationalId: "National ID",
    iqama: "Iqama",
    idNumber: "ID / Iqama Number",
    placeOfIssue: "Place of Issue",
    expiryDate: "Expiry Date",
    passport: "Passport",
    passportNumber: "Passport Number",
    issueDate: "Date of Issue",
    mobile: "Mobile",
    whatsapp: "WhatsApp",
    homePhone: "Home Phone",
    workPhone: "Work Phone",
    email: "E-Mail",
    city: "City",
    address: "Present Address",
    poBox: "P.O. Box",
    haveDependents: "Do you have any dependents?",
    yes: "Yes",
    no: "No",
    name: "Name",
    age: "Age",
    relation: "Relation",
    delete: "Delete",
    addDependent: "Add Dependent",
    chronicDiseases: "Do you have any chronic diseases?",
    chronicHint: "List them if any, otherwise leave blank",
    pregnant: "Are you pregnant?",
    workedBefore: "Have you worked here before?",
    currentlyEmployed: "Are you currently employed?",
    canStart: "When can you start?",
    expectedSalary: "Expected Salary (SAR)",
    minSalary: "Minimum Acceptable Salary",
    gosi: "GOSI Number (if any)",
    add: "Add",
    expIndex: "Experience",
    company: "Company / Employer",
    position: "Job Title",
    from: "From",
    to: "To",
    salary: "Salary",
    allowance: "Allowances",
    addressPhone: "Phone & Address",
    duties: "Duties / Job Summary",
    reasonForQuit: "Reason for Leaving",
    stillWorking: "I still work here",
    eduLevel: "Education Level",
    elementary: "Elementary",
    intermediate: "Intermediate",
    secondary: "Secondary",
    diploma: "Post-Secondary Diploma",
    university: "University",
    postgraduate: "Postgraduate",
    schoolName: "School / University Name",
    cityCountry: "City / Country",
    field: "Field of Study",
    degree: "Degree (Bachelor's...)",
    gpa: "Grade / GPA",
    yearFrom: "From Year",
    yearTo: "To Year",
    instituteName: "Institute Name",
    languages: "Knowledge of Languages",
    language: "Language",
    speaking: "Speaking",
    reading: "Reading",
    writing: "Writing",
    excellent: "Excellent",
    good: "Good",
    weak: "Weak",
    addLanguage: "Add Language",
    typingSpeed: "Typing Speed",
    typingHint: "WPM",
    otherSkills: "Other Skills",
    skillTags: "Skill Tags",
    addSkillHint: "Type a skill and press Enter",
    hobbies: "Hobbies",
    licCategory: "Category",
    licCategoryHint: "Private / Public / Motorcycle...",
    licNumber: "License Number",
    licIssueDate: "Date of Issue",
    licExpiryDate: "Expiry Date",
    convicted: "Have you ever been convicted?",
    details: "Details",
    howKnew: "How did you hear about this job?",
    relativesInCo: "Do you have relatives working in our company? (List them)",
    references: "References (3 persons)",
    noReferences: "No references added",
    refName: "Name",
    refPosition: "Position",
    refCompany: "Company",
    refPhone: "Phone",
    refAddress: "Address",
    otherInfo: "Any other information you'd like to share?",
    attachHint: "Max 1.5 MB per file (4 MB total) — please attach copies of academic and work experience certificates",
    cv: "Resume / CV (PDF)",
    photo: "Personal Photo",
    idCopy: "ID Copy",
    uploaded: "Uploaded ✓",
    remove: "Remove",
    clickToUpload: "Click to upload",
    declaration: "I hereby certify that all the foregoing information is, to the best of my knowledge and belief, correct and complete, and I authorize you to verify it. Any false or omitted information will be sufficient cause for my responsibility.",
    iAgree: "I agree to the declaration above",
    signature: "Signature",
    submit: "Submit Application",
    submitting: "Submitting...",
    errMissing: "Missing data",
    errMissingDesc: "Name and mobile are required",
    errSignature: "Signature required",
    errAgree: "You must agree to the declaration",
    errFileSize: "File too large",
    errFileSizeDesc: "Maximum 1.5 MB per file.",
    errPayload: "Payload too large",
    errPayloadDesc: (mb: string, max: string) => `Total size ${mb} MB. Please use smaller images/files (max ${max} MB total).`,
    errUpload: "Upload error",
    fileUploaded: "File uploaded",
    requiredMark: "*",
  },
} as const;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function detectLang(): Lang {
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("lang");
    if (q === "en" || q === "ar") return q;
    const stored = localStorage.getItem("appform_lang");
    if (stored === "en" || stored === "ar") return stored;
    const nav = (navigator.language || "").toLowerCase();
    if (nav.startsWith("ar")) return "ar";
    return "en";
  } catch {
    return "ar";
  }
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#e67e22] to-[#d35400] flex items-center justify-center shadow-sm">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <CardTitle className="text-lg text-[#1a3a2f]">{title}</CardTitle>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function ApplicationForm({ initial, vacancy, company, submitting, error, onSubmit }: Props) {
  const { toast } = useToast();
  // Lazy initializer so the first render already uses the detected language
  // (fixes Arabic defaults appearing for English-detected users in langSkills, etc.)
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === "undefined") return "ar";
    return detectLang();
  });
  useEffect(() => {
    try { localStorage.setItem("appform_lang", lang); } catch {}
  }, [lang]);

  const t = T[lang];
  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";
  const subTitleSecondary = (key: keyof typeof T["ar"]) => (lang === "ar" ? T.en[key] : T.ar[key]) as string;

  const ad = (initial?.additionalData as Record<string, any>) || {};

  const [form, setForm] = useState({
    fullNameAr: initial?.fullNameAr || "",
    fullNameEn: initial?.fullNameEn || "",
    nationality: initial?.nationality || "",
    idNumber: initial?.idNumber || "",
    idType: initial?.idType || "national",
    idExpiry: initial?.idExpiry || "",
    dob: initial?.dob || "",
    gender: initial?.gender || "",
    maritalStatus: initial?.maritalStatus || "",
    city: initial?.city || "",
    address: initial?.address || "",
    phone: initial?.phone || "",
    whatsapp: initial?.whatsapp || "",
    email: initial?.email || "",
    expectedSalary: initial?.expectedSalary || "",
    availabilityDate: initial?.availabilityDate || "",
  });

  const [extra, setExtra] = useState({
    firstNameAr: ad.firstNameAr || "",
    fatherNameAr: ad.fatherNameAr || "",
    grandfatherNameAr: ad.grandfatherNameAr || "",
    familyNameAr: ad.familyNameAr || "",
    firstNameEn: ad.firstNameEn || "",
    fatherNameEn: ad.fatherNameEn || "",
    grandfatherNameEn: ad.grandfatherNameEn || "",
    familyNameEn: ad.familyNameEn || "",
    placeOfBirth: ad.placeOfBirth || "",
    religion: ad.religion || "",
    idPlaceOfIssue: ad.idPlaceOfIssue || "",
    passportNumber: ad.passportNumber || "",
    passportPlaceOfIssue: ad.passportPlaceOfIssue || "",
    passportIssueDate: ad.passportIssueDate || "",
    homePhone: ad.homePhone || "",
    workPhone: ad.workPhone || "",
    postBox: ad.postBox || "",
    hasDependents: !!ad.hasDependents,
    chronicDiseases: ad.chronicDiseases || "",
    isPregnant: ad.isPregnant || "",
    bloodGroup: ad.bloodGroup || "",
    workedHereBefore: ad.workedHereBefore || "",
    currentlyEmployed: ad.currentlyEmployed || "",
    startDate: ad.startDate || "",
    gosiNumber: ad.gosiNumber || "",
    minimumSalary: ad.minimumSalary || "",
    drivingLicenseCategory: ad.drivingLicense?.category || "",
    drivingLicenseNumber: ad.drivingLicense?.number || "",
    drivingLicenseIssueDate: ad.drivingLicense?.issueDate || "",
    drivingLicenseExpiryDate: ad.drivingLicense?.expiryDate || "",
    drivingLicensePlaceOfIssue: ad.drivingLicense?.placeOfIssue || "",
    hasConvictions: ad.hasConvictions || "",
    convictionsDetails: ad.convictionsDetails || "",
    typingSpeed: ad.typingSpeed || "",
    otherSkills: ad.otherSkills || "",
    hobbies: ad.hobbies || "",
    howKnewAboutJob: ad.howKnewAboutJob || "",
    relativesInCompany: ad.relativesInCompany || "",
    otherData: ad.otherData || "",
  });

  const [education, setEducation] = useState<EduRow[]>(
    Array.isArray(initial?.education) && initial.education.length > 0
      ? initial.education
      : [{ level: "", degree: "", field: "", institution: "", city: "", yearFrom: "", yearTo: "" }]
  );
  const [experience, setExperience] = useState<ExpRow[]>(
    Array.isArray(initial?.experience) && initial.experience.length > 0
      ? initial.experience
      : [{ company: "", position: "", from: "", to: "", salary: "", allowance: "", addressPhone: "", duties: "", reasonForQuit: "" }]
  );
  const [trainings, setTrainings] = useState<TrainingRow[]>(
    Array.isArray(ad.trainingCourses) && ad.trainingCourses.length > 0
      ? ad.trainingCourses
      : [{ institute: "", city: "", from: "", to: "", specialize: "" }]
  );
  const [dependents, setDependents] = useState<DependentRow[]>(
    Array.isArray(ad.dependents) && ad.dependents.length > 0 ? ad.dependents : [{ name: "", age: "", relation: "" }]
  );
  const [langSkills, setLangSkills] = useState<LangSkillRow[]>(() => {
    // Normalize legacy Arabic-label level values to canonical values
    const legacyMap: Record<string, string> = {
      "ممتاز": "excellent", "جيد": "good", "ضعيف": "weak",
      "Excellent": "excellent", "Good": "good", "Weak": "weak",
    };
    const normLevel = (v: string) => legacyMap[v] || v;
    if (Array.isArray(ad.languageSkills) && ad.languageSkills.length > 0) {
      return ad.languageSkills.map((l: LangSkillRow) => ({
        ...l, speaking: normLevel(l.speaking), reading: normLevel(l.reading), writing: normLevel(l.writing),
      }));
    }
    const isAr = lang === "ar";
    return [
      { language: isAr ? "العربية" : "Arabic", speaking: "", reading: "", writing: "" },
      { language: isAr ? "الإنجليزية" : "English", speaking: "", reading: "", writing: "" },
    ];
  });
  const [skills, setSkills] = useState<string[]>(Array.isArray(initial?.skills) ? initial.skills : []);
  const [skillInput, setSkillInput] = useState("");
  const [languages, setLanguages] = useState<LangRow[]>(Array.isArray(initial?.languages) ? initial.languages : []);
  const [references, setReferences] = useState<RefRow[]>(Array.isArray(initial?.references) ? initial.references : []);

  const [cvUrl, setCvUrl] = useState<string>(initial?.cvUrl || "");
  const [photoUrl, setPhotoUrl] = useState<string>(initial?.photoUrl || "");
  const [idCopyUrl, setIdCopyUrl] = useState<string>(initial?.idCopyUrl || "");
  const [signature, setSignature] = useState<string | null>(initial?.signature || null);
  const [agreed, setAgreed] = useState<boolean>(false);

  // Canonical values stored in DB; labels localized only.
  const LEVEL_OPTIONS: Array<{ value: string; label: string }> = [
    { value: "excellent", label: t.excellent },
    { value: "good", label: t.good },
    { value: "weak", label: t.weak },
  ];
  const levelLabel = (v: string) => LEVEL_OPTIONS.find((o) => o.value === v)?.label || v;

  const handleFile = async (file: File | undefined, setter: (v: string) => void, label: string) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: t.errFileSize, description: `${t.errFileSizeDesc} ${label}`, variant: "destructive" });
      return;
    }
    try {
      const url = await fileToDataUrl(file);
      setter(url);
      toast({ title: t.fileUploaded, description: label });
    } catch {
      toast({ title: t.errUpload, variant: "destructive" });
    }
  };

  const buildFullName = (whichLang: "ar" | "en") => {
    if (whichLang === "ar") {
      const parts = [extra.firstNameAr, extra.fatherNameAr, extra.grandfatherNameAr, extra.familyNameAr].filter(Boolean);
      return parts.length ? parts.join(" ") : form.fullNameAr;
    }
    const parts = [extra.firstNameEn, extra.fatherNameEn, extra.grandfatherNameEn, extra.familyNameEn].filter(Boolean);
    return parts.length ? parts.join(" ") : form.fullNameEn;
  };

  const submit = () => {
    const finalNameAr = buildFullName("ar");
    const finalNameEn = buildFullName("en");
    const nameOk = finalNameAr || finalNameEn;
    if (!nameOk || !form.phone) {
      toast({ title: t.errMissing, description: t.errMissingDesc, variant: "destructive" });
      return;
    }
    if (!signature) { toast({ title: t.errSignature, variant: "destructive" }); return; }
    if (!agreed) { toast({ title: t.errAgree, variant: "destructive" }); return; }

    const additionalData: Record<string, any> = {
      firstNameAr: extra.firstNameAr || undefined,
      fatherNameAr: extra.fatherNameAr || undefined,
      grandfatherNameAr: extra.grandfatherNameAr || undefined,
      familyNameAr: extra.familyNameAr || undefined,
      firstNameEn: extra.firstNameEn || undefined,
      fatherNameEn: extra.fatherNameEn || undefined,
      grandfatherNameEn: extra.grandfatherNameEn || undefined,
      familyNameEn: extra.familyNameEn || undefined,
      placeOfBirth: extra.placeOfBirth || undefined,
      religion: extra.religion || undefined,
      idPlaceOfIssue: extra.idPlaceOfIssue || undefined,
      passportNumber: extra.passportNumber || undefined,
      passportPlaceOfIssue: extra.passportPlaceOfIssue || undefined,
      passportIssueDate: extra.passportIssueDate || undefined,
      homePhone: extra.homePhone || undefined,
      workPhone: extra.workPhone || undefined,
      postBox: extra.postBox || undefined,
      hasDependents: extra.hasDependents,
      dependents: extra.hasDependents ? dependents.filter((d) => d.name) : [],
      chronicDiseases: extra.chronicDiseases || undefined,
      isPregnant: form.gender === "female" ? extra.isPregnant || undefined : undefined,
      bloodGroup: extra.bloodGroup || undefined,
      workedHereBefore: extra.workedHereBefore || undefined,
      currentlyEmployed: extra.currentlyEmployed || undefined,
      startDate: extra.startDate || undefined,
      gosiNumber: extra.gosiNumber || undefined,
      minimumSalary: extra.minimumSalary ? Number(extra.minimumSalary) : undefined,
      drivingLicense: (extra.drivingLicenseNumber || extra.drivingLicenseCategory)
        ? {
            category: extra.drivingLicenseCategory || undefined,
            number: extra.drivingLicenseNumber || undefined,
            issueDate: extra.drivingLicenseIssueDate || undefined,
            expiryDate: extra.drivingLicenseExpiryDate || undefined,
            placeOfIssue: extra.drivingLicensePlaceOfIssue || undefined,
          }
        : undefined,
      hasConvictions: extra.hasConvictions || undefined,
      convictionsDetails: extra.hasConvictions === "yes" ? extra.convictionsDetails || undefined : undefined,
      trainingCourses: trainings.filter((tr) => tr.institute || tr.specialize),
      languageSkills: langSkills.filter((l) => l.language && (l.speaking || l.reading || l.writing)),
      typingSpeed: extra.typingSpeed || undefined,
      otherSkills: extra.otherSkills || undefined,
      hobbies: extra.hobbies || undefined,
      howKnewAboutJob: extra.howKnewAboutJob || undefined,
      relativesInCompany: extra.relativesInCompany || undefined,
      otherData: extra.otherData || undefined,
      submittedInLanguage: lang,
    };
    Object.keys(additionalData).forEach((k) => {
      if (additionalData[k] === undefined || additionalData[k] === "" ||
        (Array.isArray(additionalData[k]) && additionalData[k].length === 0)) {
        delete additionalData[k];
      }
    });

    const payload: any = {
      ...form,
      fullNameAr: finalNameAr,
      fullNameEn: finalNameEn,
      expectedSalary: form.expectedSalary ? Number(form.expectedSalary) : undefined,
      education: education.filter((e) => e.degree || e.institution || e.level),
      experience: experience.filter((e) => e.company || e.position),
      skills,
      languages: languages.filter((l) => l.name),
      references: references.filter((r) => r.name),
      cvUrl: cvUrl || undefined,
      photoUrl: photoUrl || undefined,
      idCopyUrl: idCopyUrl || undefined,
      additionalData: Object.keys(additionalData).length > 0 ? additionalData : undefined,
      signature,
      agreedToTerms: true,
    };
    if (!payload.email) delete payload.email;
    if (!payload.fullNameEn) delete payload.fullNameEn;
    if (!payload.fullNameAr) payload.fullNameAr = finalNameEn;

    const sizeBytes = new Blob([JSON.stringify(payload)]).size;
    if (sizeBytes > MAX_TOTAL_PAYLOAD) {
      const mb = (sizeBytes / 1024 / 1024).toFixed(1);
      toast({
        title: t.errPayload,
        description: t.errPayloadDesc(mb, (MAX_TOTAL_PAYLOAD / 1024 / 1024).toFixed(0)),
        variant: "destructive",
      });
      return;
    }
    onSubmit(payload);
  };

  const titleText = vacancy ? vacancy.title : initial?.targetPosition || t.title;
  const req = <span className="text-red-500">{t.requiredMark}</span>;
  const sub = (key: keyof typeof T["ar"]) => <span className="text-gray-400 text-xs"> / {subTitleSecondary(key)}</span>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF6ED] to-[#F5F0E6] py-6 px-3" dir={dir} lang={lang}>
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Language toggle */}
        <div className="flex justify-end">
          <div className="inline-flex rounded-lg border-2 border-[#e67e22]/30 bg-white shadow-sm overflow-hidden">
            <Button
              type="button"
              size="sm"
              variant={lang === "ar" ? "default" : "ghost"}
              className={`rounded-none ${lang === "ar" ? "bg-[#e67e22] hover:bg-[#d35400] text-white" : "text-gray-700"}`}
              onClick={() => setLang("ar")}
              data-testid="button-lang-ar"
            >
              <Globe className="w-4 h-4 ms-1" />
              العربية
            </Button>
            <Button
              type="button"
              size="sm"
              variant={lang === "en" ? "default" : "ghost"}
              className={`rounded-none ${lang === "en" ? "bg-[#e67e22] hover:bg-[#d35400] text-white" : "text-gray-700"}`}
              onClick={() => setLang("en")}
              data-testid="button-lang-en"
            >
              <Globe className="w-4 h-4 me-1" />
              English
            </Button>
          </div>
        </div>

        {/* Header */}
        <Card className="border-2 border-[#e67e22]/20 shadow-md overflow-hidden">
          <div className="bg-gradient-to-l from-[#e67e22] to-[#d35400] p-1" />
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#e67e22] to-[#d35400] flex items-center justify-center shadow-md">
                  <Briefcase className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[#1a3a2f]">{t.title}</h1>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mt-0.5">{t.subtitle}</p>
                  <p className="text-sm text-gray-700 mt-2 font-semibold">{company?.name || t.companyDefault}</p>
                  {company?.cr && <p className="text-xs text-gray-500">{t.cr}: {company.cr}</p>}
                </div>
              </div>
            </div>
            {(titleText || vacancy?.branchName) && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                {titleText && (
                  <p className="text-sm font-semibold text-[#1a3a2f]">
                    {t.positionApplied}: <span className="text-[#e67e22]">{titleText}</span>
                  </p>
                )}
                {vacancy?.branchName && <p className="text-xs text-gray-600 mt-1">{t.branch}: {vacancy.branchName}</p>}
              </div>
            )}
            {vacancy?.description && <p className="text-sm mt-3 text-gray-700">{vacancy.description}</p>}
            {vacancy?.requirements && (
              <div className="mt-2 text-sm">
                <strong className="text-[#1a3a2f]">{t.requirements}:</strong>
                <p className="text-gray-700 whitespace-pre-line mt-1">{vacancy.requirements}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 1. Personal */}
        <Card>
          <CardHeader><SectionTitle icon={User} title={t.sec_personal} subtitle={subTitleSecondary("sec_personal")} /></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-semibold text-[#1a3a2f]">
                {t.fullNameAr}
                <span className="text-gray-500 text-xs font-normal ms-2">
                  {lang === "ar" ? "(الاسم بالعربية أو الإنجليزية مطلوب)" : "(Arabic or English name required)"}
                </span>
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1" dir="rtl">
                <Input placeholder={lang === "ar" ? T.ar.firstName : "الاسم الأول"} value={extra.firstNameAr} onChange={(e) => setExtra({ ...extra, firstNameAr: e.target.value })} data-testid="input-first-name-ar" />
                <Input placeholder={lang === "ar" ? T.ar.fatherName : "اسم الأب"} value={extra.fatherNameAr} onChange={(e) => setExtra({ ...extra, fatherNameAr: e.target.value })} data-testid="input-father-name-ar" />
                <Input placeholder={lang === "ar" ? T.ar.grandfatherName : "اسم الجد"} value={extra.grandfatherNameAr} onChange={(e) => setExtra({ ...extra, grandfatherNameAr: e.target.value })} data-testid="input-grandfather-name-ar" />
                <Input placeholder={lang === "ar" ? T.ar.familyName : "اسم العائلة"} value={extra.familyNameAr} onChange={(e) => setExtra({ ...extra, familyNameAr: e.target.value })} data-testid="input-family-name-ar" />
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold text-[#1a3a2f]">{t.fullNameEn}</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1" dir="ltr">
                <Input placeholder="First Name" value={extra.firstNameEn} onChange={(e) => setExtra({ ...extra, firstNameEn: e.target.value })} />
                <Input placeholder="Father's Name" value={extra.fatherNameEn} onChange={(e) => setExtra({ ...extra, fatherNameEn: e.target.value })} />
                <Input placeholder="Grandfather's Name" value={extra.grandfatherNameEn} onChange={(e) => setExtra({ ...extra, grandfatherNameEn: e.target.value })} />
                <Input placeholder="Family Name" value={extra.familyNameEn} onChange={(e) => setExtra({ ...extra, familyNameEn: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>{t.dob}</Label><Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
              <div><Label>{t.placeOfBirth}</Label><Input value={extra.placeOfBirth} onChange={(e) => setExtra({ ...extra, placeOfBirth: e.target.value })} /></div>
              <div><Label>{t.nationality}</Label><Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} /></div>
              <div><Label>{t.religion}</Label><Input value={extra.religion} onChange={(e) => setExtra({ ...extra, religion: e.target.value })} /></div>
              <div>
                <Label>{t.gender}</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue placeholder={t.select} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t.male}</SelectItem>
                    <SelectItem value="female">{t.female}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t.maritalStatus}</Label>
                <Select value={form.maritalStatus} onValueChange={(v) => setForm({ ...form, maritalStatus: v })}>
                  <SelectTrigger><SelectValue placeholder={t.select} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">{t.single}</SelectItem>
                    <SelectItem value="married">{t.married}</SelectItem>
                    <SelectItem value="divorced">{t.divorced}</SelectItem>
                    <SelectItem value="widowed">{t.widowed}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t.bloodGroup}</Label>
                <Select value={extra.bloodGroup} onValueChange={(v) => setExtra({ ...extra, bloodGroup: v })}>
                  <SelectTrigger><SelectValue placeholder={t.select} /></SelectTrigger>
                  <SelectContent>
                    {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. ID & Passport */}
        <Card>
          <CardHeader><SectionTitle icon={Shield} title={t.sec_id} subtitle={subTitleSecondary("sec_id")} /></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50/50">
              <p className="text-xs font-semibold text-[#1a3a2f] mb-2">{t.idCard}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>{t.idType}</Label>
                  <Select value={form.idType} onValueChange={(v) => setForm({ ...form, idType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="national">{t.nationalId}</SelectItem>
                      <SelectItem value="iqama">{t.iqama}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{t.idNumber}</Label><Input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} /></div>
                <div><Label>{t.placeOfIssue}</Label><Input value={extra.idPlaceOfIssue} onChange={(e) => setExtra({ ...extra, idPlaceOfIssue: e.target.value })} /></div>
                <div><Label>{t.expiryDate}</Label><Input type="date" value={form.idExpiry} onChange={(e) => setForm({ ...form, idExpiry: e.target.value })} /></div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50/50">
              <p className="text-xs font-semibold text-[#1a3a2f] mb-2">{t.passport}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><Label>{t.passportNumber}</Label><Input value={extra.passportNumber} onChange={(e) => setExtra({ ...extra, passportNumber: e.target.value })} /></div>
                <div><Label>{t.placeOfIssue}</Label><Input value={extra.passportPlaceOfIssue} onChange={(e) => setExtra({ ...extra, passportPlaceOfIssue: e.target.value })} /></div>
                <div><Label>{t.issueDate}</Label><Input type="date" value={extra.passportIssueDate} onChange={(e) => setExtra({ ...extra, passportIssueDate: e.target.value })} /></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Contact */}
        <Card>
          <CardHeader><SectionTitle icon={Phone} title={t.sec_contact} subtitle={subTitleSecondary("sec_contact")} /></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>{t.mobile} {req}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05xxxxxxxx" data-testid="input-phone" /></div>
              <div><Label>{t.whatsapp}</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="05xxxxxxxx" /></div>
              <div><Label>{t.homePhone}</Label><Input value={extra.homePhone} onChange={(e) => setExtra({ ...extra, homePhone: e.target.value })} /></div>
              <div><Label>{t.workPhone}</Label><Input value={extra.workPhone} onChange={(e) => setExtra({ ...extra, workPhone: e.target.value })} /></div>
              <div><Label>{t.email}</Label><Input type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>{t.city}</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>{t.address}</Label><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>{t.poBox}</Label><Input value={extra.postBox} onChange={(e) => setExtra({ ...extra, postBox: e.target.value })} /></div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Dependents */}
        <Card>
          <CardHeader><SectionTitle icon={Users} title={t.sec_dependents} subtitle={subTitleSecondary("sec_dependents")} /></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              <Label className="text-sm">{t.haveDependents}</Label>
              <RadioGroup value={extra.hasDependents ? "yes" : "no"} onValueChange={(v) => setExtra({ ...extra, hasDependents: v === "yes" })} className="flex gap-4">
                <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="yes" id="dep-yes" /><span>{t.yes}</span></label>
                <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="no" id="dep-no" /><span>{t.no}</span></label>
              </RadioGroup>
            </div>
            {extra.hasDependents && (
              <div className="space-y-2">
                {dependents.map((d, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                    <Input placeholder={t.name} value={d.name} onChange={(e) => { const a = [...dependents]; a[i].name = e.target.value; setDependents(a); }} />
                    <Input placeholder={t.age} value={d.age} onChange={(e) => { const a = [...dependents]; a[i].age = e.target.value; setDependents(a); }} />
                    <Input placeholder={t.relation} value={d.relation} onChange={(e) => { const a = [...dependents]; a[i].relation = e.target.value; setDependents(a); }} />
                    <Button size="sm" variant="ghost" className="text-red-600 justify-self-start" onClick={() => setDependents(dependents.filter((_, x) => x !== i))}>
                      <Trash2 className="w-4 h-4 me-1" /> {t.delete}
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setDependents([...dependents, { name: "", age: "", relation: "" }])}>
                  <Plus className="w-4 h-4 me-1" /> {t.addDependent}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. Health & Employment */}
        <Card>
          <CardHeader><SectionTitle icon={Heart} title={t.sec_health} subtitle={subTitleSecondary("sec_health")} /></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>{t.chronicDiseases}</Label>
              <Textarea rows={2} value={extra.chronicDiseases} onChange={(e) => setExtra({ ...extra, chronicDiseases: e.target.value })} placeholder={t.chronicHint} />
            </div>
            {form.gender === "female" && (
              <div className="flex items-center gap-4 flex-wrap">
                <Label className="text-sm">{t.pregnant}</Label>
                <RadioGroup value={extra.isPregnant} onValueChange={(v) => setExtra({ ...extra, isPregnant: v })} className="flex gap-4">
                  <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="yes" id="preg-y" /><span>{t.yes}</span></label>
                  <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="no" id="preg-n" /><span>{t.no}</span></label>
                </RadioGroup>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>{t.workedBefore}</Label>
                <RadioGroup value={extra.workedHereBefore} onValueChange={(v) => setExtra({ ...extra, workedHereBefore: v })} className="flex gap-4 mt-2">
                  <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="yes" id="wb-y" /><span>{t.yes}</span></label>
                  <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="no" id="wb-n" /><span>{t.no}</span></label>
                </RadioGroup>
              </div>
              <div>
                <Label>{t.currentlyEmployed}</Label>
                <RadioGroup value={extra.currentlyEmployed} onValueChange={(v) => setExtra({ ...extra, currentlyEmployed: v })} className="flex gap-4 mt-2">
                  <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="yes" id="ce-y" /><span>{t.yes}</span></label>
                  <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="no" id="ce-n" /><span>{t.no}</span></label>
                </RadioGroup>
              </div>
              <div><Label>{t.canStart}</Label><Input type="date" value={extra.startDate || form.availabilityDate} onChange={(e) => { setExtra({ ...extra, startDate: e.target.value }); setForm({ ...form, availabilityDate: e.target.value }); }} /></div>
              <div><Label>{t.expectedSalary}</Label><Input type="number" value={form.expectedSalary} onChange={(e) => setForm({ ...form, expectedSalary: e.target.value })} /></div>
              <div><Label>{t.minSalary}</Label><Input type="number" value={extra.minimumSalary} onChange={(e) => setExtra({ ...extra, minimumSalary: e.target.value })} /></div>
              <div><Label>{t.gosi}</Label><Input value={extra.gosiNumber} onChange={(e) => setExtra({ ...extra, gosiNumber: e.target.value })} /></div>
            </div>
          </CardContent>
        </Card>

        {/* 6. Experience */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <SectionTitle icon={Building2} title={t.sec_experience} subtitle={subTitleSecondary("sec_experience")} />
              <Button size="sm" variant="outline" onClick={() => setExperience([...experience, { company: "", position: "", from: "", to: "", salary: "", allowance: "", addressPhone: "", duties: "", reasonForQuit: "" }])}>
                <Plus className="w-4 h-4 me-1" /> {t.add}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {experience.map((row, i) => (
              <div key={i} className="border-2 border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/30">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">{t.expIndex} {i + 1}</Badge>
                  {experience.length > 1 && (
                    <Button size="sm" variant="ghost" className="text-red-600 h-7" onClick={() => setExperience(experience.filter((_, x) => x !== i))}>
                      <Trash2 className="w-4 h-4 me-1" /> {t.delete}
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input placeholder={t.company} value={row.company} onChange={(e) => { const a = [...experience]; a[i].company = e.target.value; setExperience(a); }} />
                  <Input placeholder={t.position} value={row.position} onChange={(e) => { const a = [...experience]; a[i].position = e.target.value; setExperience(a); }} />
                  <Input type="date" placeholder={t.from} value={row.from} onChange={(e) => { const a = [...experience]; a[i].from = e.target.value; setExperience(a); }} />
                  <Input type="date" placeholder={t.to} value={row.to} disabled={row.current} onChange={(e) => { const a = [...experience]; a[i].to = e.target.value; setExperience(a); }} />
                  <Input placeholder={t.salary} value={row.salary || ""} onChange={(e) => { const a = [...experience]; a[i].salary = e.target.value; setExperience(a); }} />
                  <Input placeholder={t.allowance} value={row.allowance || ""} onChange={(e) => { const a = [...experience]; a[i].allowance = e.target.value; setExperience(a); }} />
                </div>
                <Input placeholder={t.addressPhone} value={row.addressPhone || ""} onChange={(e) => { const a = [...experience]; a[i].addressPhone = e.target.value; setExperience(a); }} />
                <Textarea rows={2} placeholder={t.duties} value={row.duties || row.summary || ""} onChange={(e) => { const a = [...experience]; a[i].duties = e.target.value; setExperience(a); }} />
                <Textarea rows={2} placeholder={t.reasonForQuit} value={row.reasonForQuit || ""} onChange={(e) => { const a = [...experience]; a[i].reasonForQuit = e.target.value; setExperience(a); }} />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!row.current} onCheckedChange={(c) => { const a = [...experience]; a[i].current = !!c; if (c) a[i].to = ""; setExperience(a); }} />
                  {t.stillWorking}
                </label>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 7. Education */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <SectionTitle icon={GraduationCap} title={t.sec_education} subtitle={subTitleSecondary("sec_education")} />
              <Button size="sm" variant="outline" onClick={() => setEducation([...education, { level: "", degree: "", field: "", institution: "", city: "", yearFrom: "", yearTo: "" }])}>
                <Plus className="w-4 h-4 me-1" /> {t.add}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {education.map((row, i) => (
              <div key={i} className="border-2 border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/30">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Select value={row.level || ""} onValueChange={(v) => { const a = [...education]; a[i].level = v; setEducation(a); }}>
                    <SelectTrigger><SelectValue placeholder={t.eduLevel} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="elementary">{t.elementary}</SelectItem>
                      <SelectItem value="intermediate">{t.intermediate}</SelectItem>
                      <SelectItem value="secondary">{t.secondary}</SelectItem>
                      <SelectItem value="high_diploma">{t.diploma}</SelectItem>
                      <SelectItem value="university">{t.university}</SelectItem>
                      <SelectItem value="postgraduate">{t.postgraduate}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder={t.schoolName} value={row.institution} onChange={(e) => { const a = [...education]; a[i].institution = e.target.value; setEducation(a); }} />
                  <Input placeholder={t.cityCountry} value={row.city || ""} onChange={(e) => { const a = [...education]; a[i].city = e.target.value; setEducation(a); }} />
                  <Input placeholder={t.field} value={row.field} onChange={(e) => { const a = [...education]; a[i].field = e.target.value; setEducation(a); }} />
                  <Input placeholder={t.degree} value={row.degree} onChange={(e) => { const a = [...education]; a[i].degree = e.target.value; setEducation(a); }} />
                  <Input placeholder={t.gpa} value={row.gpa || ""} onChange={(e) => { const a = [...education]; a[i].gpa = e.target.value; setEducation(a); }} />
                  <Input placeholder={t.yearFrom} value={row.yearFrom} onChange={(e) => { const a = [...education]; a[i].yearFrom = e.target.value; setEducation(a); }} />
                  <Input placeholder={t.yearTo} value={row.yearTo} onChange={(e) => { const a = [...education]; a[i].yearTo = e.target.value; setEducation(a); }} />
                </div>
                {education.length > 1 && (
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setEducation(education.filter((_, x) => x !== i))}>
                    <Trash2 className="w-4 h-4 me-1" /> {t.delete}
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 8. Training */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <SectionTitle icon={BookOpen} title={t.sec_training} subtitle={subTitleSecondary("sec_training")} />
              <Button size="sm" variant="outline" onClick={() => setTrainings([...trainings, { institute: "", city: "", from: "", to: "", specialize: "" }])}>
                <Plus className="w-4 h-4 me-1" /> {t.add}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {trainings.map((tr, i) => (
              <div key={i} className="border-2 border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/30">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input placeholder={t.instituteName} value={tr.institute} onChange={(e) => { const a = [...trainings]; a[i].institute = e.target.value; setTrainings(a); }} />
                  <Input placeholder={t.cityCountry} value={tr.city} onChange={(e) => { const a = [...trainings]; a[i].city = e.target.value; setTrainings(a); }} />
                  <Input placeholder={t.field} value={tr.specialize} onChange={(e) => { const a = [...trainings]; a[i].specialize = e.target.value; setTrainings(a); }} />
                  <Input type="date" placeholder={t.from} value={tr.from} onChange={(e) => { const a = [...trainings]; a[i].from = e.target.value; setTrainings(a); }} />
                  <Input type="date" placeholder={t.to} value={tr.to} onChange={(e) => { const a = [...trainings]; a[i].to = e.target.value; setTrainings(a); }} />
                </div>
                {trainings.length > 1 && (
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setTrainings(trainings.filter((_, x) => x !== i))}>
                    <Trash2 className="w-4 h-4 me-1" /> {t.delete}
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 9. Languages & Skills */}
        <Card>
          <CardHeader><SectionTitle icon={LanguagesIcon} title={t.sec_languages} subtitle={subTitleSecondary("sec_languages")} /></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-semibold text-[#1a3a2f]">{t.languages}</Label>
              <div className="overflow-x-auto mt-2 -mx-1">
                <table className="w-full text-sm border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-amber-50">
                      <th className="border border-gray-200 p-2 text-start">{t.language}</th>
                      <th className="border border-gray-200 p-2">{t.speaking}</th>
                      <th className="border border-gray-200 p-2">{t.reading}</th>
                      <th className="border border-gray-200 p-2">{t.writing}</th>
                      <th className="border border-gray-200 p-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {langSkills.map((l, i) => (
                      <tr key={i}>
                        <td className="border border-gray-200 p-1">
                          <Input className="border-0 h-8" value={l.language} onChange={(e) => { const a = [...langSkills]; a[i].language = e.target.value; setLangSkills(a); }} />
                        </td>
                        {(["speaking","reading","writing"] as const).map((k) => (
                          <td key={k} className="border border-gray-200 p-1">
                            <Select value={l[k]} onValueChange={(v) => { const a = [...langSkills]; a[i][k] = v; setLangSkills(a); }}>
                              <SelectTrigger className="border-0 h-8"><SelectValue placeholder="—">{l[k] ? levelLabel(l[k]) : ""}</SelectValue></SelectTrigger>
                              <SelectContent>
                                {LEVEL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                        ))}
                        <td className="border border-gray-200 p-1 text-center">
                          {langSkills.length > 1 && (
                            <Button size="icon" variant="ghost" className="text-red-600 h-7 w-7" onClick={() => setLangSkills(langSkills.filter((_, x) => x !== i))}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setLangSkills([...langSkills, { language: "", speaking: "", reading: "", writing: "" }])}>
                <Plus className="w-3 h-3 me-1" /> {t.addLanguage}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>{t.typingSpeed} <span className="text-gray-400 text-xs">({t.typingHint})</span></Label><Input value={extra.typingSpeed} onChange={(e) => setExtra({ ...extra, typingSpeed: e.target.value })} /></div>
              <div><Label>{t.otherSkills}</Label><Input value={extra.otherSkills} onChange={(e) => setExtra({ ...extra, otherSkills: e.target.value })} /></div>
            </div>

            <div>
              <Label>{t.skillTags}</Label>
              <div className="flex gap-2 mt-1">
                <Input placeholder={t.addSkillHint} value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => {
                  if (e.key === "Enter" && skillInput.trim()) { e.preventDefault(); setSkills([...skills, skillInput.trim()]); setSkillInput(""); }
                }} />
                <Button type="button" variant="outline" onClick={() => { if (skillInput.trim()) { setSkills([...skills, skillInput.trim()]); setSkillInput(""); } }}>{t.add}</Button>
              </div>
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {skills.map((s, i) => (
                    <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setSkills(skills.filter((_, x) => x !== i))}>{s} ×</Badge>
                  ))}
                </div>
              )}
            </div>

            <div><Label>{t.hobbies}</Label><Textarea rows={2} value={extra.hobbies} onChange={(e) => setExtra({ ...extra, hobbies: e.target.value })} /></div>
          </CardContent>
        </Card>

        {/* 10. Driving License */}
        <Card>
          <CardHeader><SectionTitle icon={Car} title={t.sec_driving} subtitle={subTitleSecondary("sec_driving")} /></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>{t.licCategory}</Label><Input value={extra.drivingLicenseCategory} onChange={(e) => setExtra({ ...extra, drivingLicenseCategory: e.target.value })} placeholder={t.licCategoryHint} /></div>
            <div><Label>{t.licNumber}</Label><Input value={extra.drivingLicenseNumber} onChange={(e) => setExtra({ ...extra, drivingLicenseNumber: e.target.value })} /></div>
            <div><Label>{t.licIssueDate}</Label><Input type="date" value={extra.drivingLicenseIssueDate} onChange={(e) => setExtra({ ...extra, drivingLicenseIssueDate: e.target.value })} /></div>
            <div><Label>{t.licExpiryDate}</Label><Input type="date" value={extra.drivingLicenseExpiryDate} onChange={(e) => setExtra({ ...extra, drivingLicenseExpiryDate: e.target.value })} /></div>
            <div><Label>{t.placeOfIssue}</Label><Input value={extra.drivingLicensePlaceOfIssue} onChange={(e) => setExtra({ ...extra, drivingLicensePlaceOfIssue: e.target.value })} /></div>
          </CardContent>
        </Card>

        {/* 11. Convictions */}
        <Card>
          <CardHeader><SectionTitle icon={Award} title={t.sec_convictions} subtitle={subTitleSecondary("sec_convictions")} /></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              <Label className="text-sm">{t.convicted}</Label>
              <RadioGroup value={extra.hasConvictions} onValueChange={(v) => setExtra({ ...extra, hasConvictions: v })} className="flex gap-4">
                <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="yes" id="cv-y" /><span>{t.yes}</span></label>
                <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="no" id="cv-n" /><span>{t.no}</span></label>
              </RadioGroup>
            </div>
            {extra.hasConvictions === "yes" && (
              <div><Label>{t.details}</Label><Textarea rows={3} value={extra.convictionsDetails} onChange={(e) => setExtra({ ...extra, convictionsDetails: e.target.value })} /></div>
            )}
          </CardContent>
        </Card>

        {/* 12. Source & References */}
        <Card>
          <CardHeader><SectionTitle icon={Info} title={t.sec_source} subtitle={subTitleSecondary("sec_source")} /></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>{t.howKnew}</Label><Input value={extra.howKnewAboutJob} onChange={(e) => setExtra({ ...extra, howKnewAboutJob: e.target.value })} /></div>
            <div><Label>{t.relativesInCo}</Label><Textarea rows={2} value={extra.relativesInCompany} onChange={(e) => setExtra({ ...extra, relativesInCompany: e.target.value })} /></div>

            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold text-[#1a3a2f]">{t.references}</Label>
                <Button size="sm" variant="outline" onClick={() => setReferences([...references, { name: "", position: "", company: "", phone: "", address: "" }])}>
                  <Plus className="w-3 h-3 me-1" /> {t.add}
                </Button>
              </div>
              {references.length === 0 && <p className="text-sm text-gray-500">{t.noReferences}</p>}
              {references.map((r, i) => (
                <div key={i} className="border-2 border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/30 mb-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Input placeholder={t.refName} value={r.name} onChange={(e) => { const a = [...references]; a[i].name = e.target.value; setReferences(a); }} />
                    <Input placeholder={t.refPosition} value={r.position} onChange={(e) => { const a = [...references]; a[i].position = e.target.value; setReferences(a); }} />
                    <Input placeholder={t.refCompany} value={r.company} onChange={(e) => { const a = [...references]; a[i].company = e.target.value; setReferences(a); }} />
                    <Input placeholder={t.refPhone} value={r.phone} onChange={(e) => { const a = [...references]; a[i].phone = e.target.value; setReferences(a); }} />
                  </div>
                  <Input placeholder={t.refAddress} value={r.address || ""} onChange={(e) => { const a = [...references]; a[i].address = e.target.value; setReferences(a); }} />
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setReferences(references.filter((_, x) => x !== i))}>
                    <Trash2 className="w-4 h-4 me-1" /> {t.delete}
                  </Button>
                </div>
              ))}
            </div>

            <div><Label>{t.otherInfo}</Label><Textarea rows={3} value={extra.otherData} onChange={(e) => setExtra({ ...extra, otherData: e.target.value })} /></div>
          </CardContent>
        </Card>

        {/* 13. Attachments */}
        <Card>
          <CardHeader><SectionTitle icon={Paperclip} title={t.sec_attachments} subtitle={subTitleSecondary("sec_attachments")} /></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">{t.attachHint}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: t.cv, value: cvUrl, setter: setCvUrl, accept: ".pdf,.doc,.docx" },
                { label: t.photo, value: photoUrl, setter: setPhotoUrl, accept: "image/*" },
                { label: t.idCopy, value: idCopyUrl, setter: setIdCopyUrl, accept: "image/*,.pdf" },
              ].map((f, i) => (
                <div key={i} className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center space-y-2 hover:border-[#e67e22]/50 transition-colors">
                  <Label className="block text-sm font-semibold">{f.label}</Label>
                  {f.value ? (
                    <>
                      {f.value.startsWith("data:image") ? (
                        <img src={f.value} className="max-h-24 mx-auto rounded" alt="" />
                      ) : (
                        <p className="text-xs text-green-600 font-semibold">{t.uploaded}</p>
                      )}
                      <Button size="sm" variant="outline" onClick={() => f.setter("")}>{t.remove}</Button>
                    </>
                  ) : (
                    <label className="cursor-pointer block">
                      <input type="file" accept={f.accept} className="hidden" onChange={(e) => handleFile(e.target.files?.[0], f.setter, f.label)} />
                      <div className="rounded p-3 hover:bg-gray-50">
                        <Upload className="w-6 h-6 mx-auto text-gray-400" />
                        <p className="text-xs mt-1">{t.clickToUpload}</p>
                      </div>
                    </label>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 14. Declaration & Signature */}
        <Card className="border-2 border-[#e67e22]/20">
          <CardHeader><SectionTitle icon={PenLine} title={t.sec_declaration} subtitle={subTitleSecondary("sec_declaration")} /></CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm leading-relaxed">
              {t.declaration}
              <p className="text-xs text-gray-500 mt-2 italic" dir={lang === "ar" ? "ltr" : "rtl"}>
                {lang === "ar" ? T.en.declaration : T.ar.declaration}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={agreed} onCheckedChange={(c) => setAgreed(!!c)} data-testid="checkbox-agree" />
              {t.iAgree}
            </label>
            <div>
              <Label>{t.signature} {req}</Label>
              <SignaturePad onSignatureChange={setSignature} width={400} height={150} />
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end pb-10">
          <Button size="lg" onClick={submit} disabled={submitting} className="bg-[#e67e22] hover:bg-[#d35400] shadow-md" data-testid="button-submit-application">
            {submitting ? t.submitting : t.submit}
          </Button>
        </div>
      </div>
    </div>
  );
}
