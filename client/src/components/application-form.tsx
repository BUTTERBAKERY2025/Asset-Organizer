import React, { useState } from "react";
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
import { Plus, Trash2, Upload, AlertCircle, Briefcase, User, Phone, Heart, GraduationCap, Award, Car, Shield, Languages as LanguagesIcon, Users, FileText, PenLine, Paperclip, Building2, BookOpen, Info } from "lucide-react";

const MAX_FILE_SIZE = 1.5 * 1024 * 1024;
const MAX_TOTAL_PAYLOAD = 4 * 1024 * 1024;

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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Section header component for visual consistency
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

const LEVEL_OPTIONS = ["ممتاز", "جيد", "ضعيف"];

export default function ApplicationForm({ initial, vacancy, company, submitting, error, onSubmit }: Props) {
  const { toast } = useToast();

  const ad = (initial?.additionalData as Record<string, any>) || {};

  // ===== الحقول الأساسية (موجودة بالـ schema) =====
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

  // ===== الحقول الموسّعة (تخزّن في additionalData) =====
  const [extra, setExtra] = useState({
    // الاسم رباعي عربي
    firstNameAr: ad.firstNameAr || "",
    fatherNameAr: ad.fatherNameAr || "",
    grandfatherNameAr: ad.grandfatherNameAr || "",
    familyNameAr: ad.familyNameAr || "",
    // الاسم رباعي إنجليزي
    firstNameEn: ad.firstNameEn || "",
    fatherNameEn: ad.fatherNameEn || "",
    grandfatherNameEn: ad.grandfatherNameEn || "",
    familyNameEn: ad.familyNameEn || "",
    // الميلاد والديانة
    placeOfBirth: ad.placeOfBirth || "",
    religion: ad.religion || "",
    // مكان إصدار الهوية
    idPlaceOfIssue: ad.idPlaceOfIssue || "",
    // الجواز
    passportNumber: ad.passportNumber || "",
    passportPlaceOfIssue: ad.passportPlaceOfIssue || "",
    passportIssueDate: ad.passportIssueDate || "",
    // التواصل
    homePhone: ad.homePhone || "",
    workPhone: ad.workPhone || "",
    postBox: ad.postBox || "",
    // الحالة العائلية
    hasDependents: !!ad.hasDependents,
    // الصحة
    chronicDiseases: ad.chronicDiseases || "",
    isPregnant: ad.isPregnant || "",
    bloodGroup: ad.bloodGroup || "",
    // عمل سابق
    workedHereBefore: ad.workedHereBefore || "",
    currentlyEmployed: ad.currentlyEmployed || "",
    startDate: ad.startDate || "",
    // التأمينات والراتب
    gosiNumber: ad.gosiNumber || "",
    minimumSalary: ad.minimumSalary || "",
    // رخصة القيادة
    drivingLicenseCategory: ad.drivingLicense?.category || "",
    drivingLicenseNumber: ad.drivingLicense?.number || "",
    drivingLicenseIssueDate: ad.drivingLicense?.issueDate || "",
    drivingLicenseExpiryDate: ad.drivingLicense?.expiryDate || "",
    drivingLicensePlaceOfIssue: ad.drivingLicense?.placeOfIssue || "",
    // السوابق
    hasConvictions: ad.hasConvictions || "",
    convictionsDetails: ad.convictionsDetails || "",
    // مهارات إضافية
    typingSpeed: ad.typingSpeed || "",
    otherSkills: ad.otherSkills || "",
    hobbies: ad.hobbies || "",
    // مصدر الوظيفة
    howKnewAboutJob: ad.howKnewAboutJob || "",
    relativesInCompany: ad.relativesInCompany || "",
    // معلومات أخرى
    otherData: ad.otherData || "",
  });

  // ===== المصفوفات =====
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
  const [langSkills, setLangSkills] = useState<LangSkillRow[]>(
    Array.isArray(ad.languageSkills) && ad.languageSkills.length > 0
      ? ad.languageSkills
      : [
          { language: "العربية", speaking: "", reading: "", writing: "" },
          { language: "الإنجليزية", speaking: "", reading: "", writing: "" },
        ]
  );
  const [skills, setSkills] = useState<string[]>(Array.isArray(initial?.skills) ? initial.skills : []);
  const [skillInput, setSkillInput] = useState("");
  const [languages, setLanguages] = useState<LangRow[]>(Array.isArray(initial?.languages) ? initial.languages : []);
  const [references, setReferences] = useState<RefRow[]>(Array.isArray(initial?.references) ? initial.references : []);

  const [cvUrl, setCvUrl] = useState<string>(initial?.cvUrl || "");
  const [photoUrl, setPhotoUrl] = useState<string>(initial?.photoUrl || "");
  const [idCopyUrl, setIdCopyUrl] = useState<string>(initial?.idCopyUrl || "");
  const [signature, setSignature] = useState<string | null>(initial?.signature || null);
  const [agreed, setAgreed] = useState<boolean>(false);

  const handleFile = async (file: File | undefined, setter: (v: string) => void, label: string) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "حجم الملف كبير", description: `الحد الأقصى ١.٥ ميجا لكل ملف. ${label}`, variant: "destructive" });
      return;
    }
    try {
      const url = await fileToDataUrl(file);
      setter(url);
      toast({ title: "تم رفع الملف", description: label });
    } catch {
      toast({ title: "خطأ في الرفع", variant: "destructive" });
    }
  };

  // اشتقاق الاسم الكامل من الأجزاء إن لم يُكتب يدوياً
  const buildFullName = (lang: "ar" | "en") => {
    if (lang === "ar") {
      const parts = [extra.firstNameAr, extra.fatherNameAr, extra.grandfatherNameAr, extra.familyNameAr].filter(Boolean);
      return parts.length ? parts.join(" ") : form.fullNameAr;
    }
    const parts = [extra.firstNameEn, extra.fatherNameEn, extra.grandfatherNameEn, extra.familyNameEn].filter(Boolean);
    return parts.length ? parts.join(" ") : form.fullNameEn;
  };

  const submit = () => {
    const finalNameAr = buildFullName("ar");
    if (!finalNameAr || !form.phone) {
      toast({ title: "بيانات ناقصة", description: "الاسم والجوال مطلوبان", variant: "destructive" });
      return;
    }
    if (!signature) {
      toast({ title: "التوقيع مطلوب", variant: "destructive" });
      return;
    }
    if (!agreed) {
      toast({ title: "يجب الموافقة على الإقرار", variant: "destructive" });
      return;
    }

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
      trainingCourses: trainings.filter((t) => t.institute || t.specialize),
      languageSkills: langSkills.filter((l) => l.language && (l.speaking || l.reading || l.writing)),
      typingSpeed: extra.typingSpeed || undefined,
      otherSkills: extra.otherSkills || undefined,
      hobbies: extra.hobbies || undefined,
      howKnewAboutJob: extra.howKnewAboutJob || undefined,
      relativesInCompany: extra.relativesInCompany || undefined,
      otherData: extra.otherData || undefined,
    };
    // إزالة الحقول الفارغة
    Object.keys(additionalData).forEach((k) => {
      if (additionalData[k] === undefined || additionalData[k] === "" ||
        (Array.isArray(additionalData[k]) && additionalData[k].length === 0)) {
        delete additionalData[k];
      }
    });

    const payload: any = {
      ...form,
      fullNameAr: finalNameAr,
      fullNameEn: buildFullName("en"),
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

    const sizeBytes = new Blob([JSON.stringify(payload)]).size;
    if (sizeBytes > MAX_TOTAL_PAYLOAD) {
      const mb = (sizeBytes / 1024 / 1024).toFixed(1);
      toast({
        title: "حجم البيانات كبير جداً",
        description: `إجمالي الحجم ${mb} ميجا. الرجاء استخدام صور/ملفات أصغر (الحد الأقصى ${(MAX_TOTAL_PAYLOAD / 1024 / 1024).toFixed(0)} ميجا إجمالاً).`,
        variant: "destructive",
      });
      return;
    }
    onSubmit(payload);
  };

  const titleText = vacancy ? vacancy.title : initial?.targetPosition || "طلب التوظيف";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF6ED] to-[#F5F0E6] py-6 px-3" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* رأس النموذج */}
        <Card className="border-2 border-[#e67e22]/20 shadow-md overflow-hidden">
          <div className="bg-gradient-to-l from-[#e67e22] to-[#d35400] p-1" />
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#e67e22] to-[#d35400] flex items-center justify-center shadow-md">
                  <Briefcase className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[#1a3a2f]">طلب توظيف</h1>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mt-0.5">EMPLOYMENT APPLICATION</p>
                  <p className="text-sm text-gray-700 mt-2 font-semibold">{company?.name || "شركة الزبد الأفضل التجارية"}</p>
                  {company?.cr && <p className="text-xs text-gray-500">س.ت: {company.cr}</p>}
                </div>
              </div>
            </div>
            {(titleText || vacancy?.branchName) && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                {titleText && (
                  <p className="text-sm font-semibold text-[#1a3a2f]">
                    الوظيفة المطلوبة <span className="text-gray-400 text-xs">/ Position Applied For</span>: <span className="text-[#e67e22]">{titleText}</span>
                  </p>
                )}
                {vacancy?.branchName && <p className="text-xs text-gray-600 mt-1">الفرع: {vacancy.branchName}</p>}
              </div>
            )}
            {vacancy?.description && <p className="text-sm mt-3 text-gray-700">{vacancy.description}</p>}
            {vacancy?.requirements && (
              <div className="mt-2 text-sm">
                <strong className="text-[#1a3a2f]">المتطلبات:</strong>
                <p className="text-gray-700 whitespace-pre-line mt-1">{vacancy.requirements}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 1. البيانات الشخصية */}
        <Card>
          <CardHeader><SectionTitle icon={User} title="البيانات الشخصية" subtitle="Personal Information" /></CardHeader>
          <CardContent className="space-y-4">
            {/* الاسم الرباعي بالعربي */}
            <div>
              <Label className="text-sm font-semibold text-[#1a3a2f]">الاسم الرباعي بالعربية <span className="text-red-500">*</span></Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                <Input placeholder="الاسم الأول" value={extra.firstNameAr} onChange={(e) => setExtra({ ...extra, firstNameAr: e.target.value })} data-testid="input-first-name-ar" />
                <Input placeholder="اسم الأب" value={extra.fatherNameAr} onChange={(e) => setExtra({ ...extra, fatherNameAr: e.target.value })} data-testid="input-father-name-ar" />
                <Input placeholder="اسم الجد" value={extra.grandfatherNameAr} onChange={(e) => setExtra({ ...extra, grandfatherNameAr: e.target.value })} data-testid="input-grandfather-name-ar" />
                <Input placeholder="اسم العائلة" value={extra.familyNameAr} onChange={(e) => setExtra({ ...extra, familyNameAr: e.target.value })} data-testid="input-family-name-ar" />
              </div>
            </div>
            {/* الاسم بالإنجليزي */}
            <div>
              <Label className="text-sm font-semibold text-[#1a3a2f]">الاسم الرباعي بالإنجليزية <span className="text-gray-400 text-xs">/ Full Name (English)</span></Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1" dir="ltr">
                <Input placeholder="First Name" value={extra.firstNameEn} onChange={(e) => setExtra({ ...extra, firstNameEn: e.target.value })} />
                <Input placeholder="Father's Name" value={extra.fatherNameEn} onChange={(e) => setExtra({ ...extra, fatherNameEn: e.target.value })} />
                <Input placeholder="Grandfather's Name" value={extra.grandfatherNameEn} onChange={(e) => setExtra({ ...extra, grandfatherNameEn: e.target.value })} />
                <Input placeholder="Family Name" value={extra.familyNameEn} onChange={(e) => setExtra({ ...extra, familyNameEn: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>تاريخ الميلاد <span className="text-gray-400 text-xs">/ Date of Birth</span></Label>
                <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
              </div>
              <div>
                <Label>مكان الميلاد <span className="text-gray-400 text-xs">/ Place of Birth</span></Label>
                <Input value={extra.placeOfBirth} onChange={(e) => setExtra({ ...extra, placeOfBirth: e.target.value })} />
              </div>
              <div>
                <Label>الجنسية <span className="text-gray-400 text-xs">/ Nationality</span></Label>
                <Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
              </div>
              <div>
                <Label>الديانة <span className="text-gray-400 text-xs">/ Religion</span></Label>
                <Input value={extra.religion} onChange={(e) => setExtra({ ...extra, religion: e.target.value })} />
              </div>
              <div>
                <Label>الجنس <span className="text-gray-400 text-xs">/ Gender</span></Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">ذكر</SelectItem>
                    <SelectItem value="female">أنثى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الحالة الاجتماعية <span className="text-gray-400 text-xs">/ Marital Status</span></Label>
                <Select value={form.maritalStatus} onValueChange={(v) => setForm({ ...form, maritalStatus: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">أعزب</SelectItem>
                    <SelectItem value="married">متزوج</SelectItem>
                    <SelectItem value="divorced">مطلق</SelectItem>
                    <SelectItem value="widowed">أرمل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>فصيلة الدم <span className="text-gray-400 text-xs">/ Blood Group</span></Label>
                <Select value={extra.bloodGroup} onValueChange={(v) => setExtra({ ...extra, bloodGroup: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. بيانات الهوية والجواز */}
        <Card>
          <CardHeader><SectionTitle icon={Shield} title="الهوية والجواز" subtitle="ID & Passport" /></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50/50">
              <p className="text-xs font-semibold text-[#1a3a2f] mb-2">بطاقة الأحوال المدنية / الإقامة <span className="text-gray-400">/ ID / Iqama</span></p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>نوع الهوية</Label>
                  <Select value={form.idType} onValueChange={(v) => setForm({ ...form, idType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="national">هوية وطنية</SelectItem>
                      <SelectItem value="iqama">إقامة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>رقم الهوية / الإقامة</Label>
                  <Input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
                </div>
                <div>
                  <Label>مكان الإصدار</Label>
                  <Input value={extra.idPlaceOfIssue} onChange={(e) => setExtra({ ...extra, idPlaceOfIssue: e.target.value })} />
                </div>
                <div>
                  <Label>تاريخ الانتهاء</Label>
                  <Input type="date" value={form.idExpiry} onChange={(e) => setForm({ ...form, idExpiry: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50/50">
              <p className="text-xs font-semibold text-[#1a3a2f] mb-2">جواز السفر <span className="text-gray-400">/ Passport</span></p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>رقم الجواز</Label>
                  <Input value={extra.passportNumber} onChange={(e) => setExtra({ ...extra, passportNumber: e.target.value })} />
                </div>
                <div>
                  <Label>مكان الإصدار</Label>
                  <Input value={extra.passportPlaceOfIssue} onChange={(e) => setExtra({ ...extra, passportPlaceOfIssue: e.target.value })} />
                </div>
                <div>
                  <Label>تاريخ الإصدار</Label>
                  <Input type="date" value={extra.passportIssueDate} onChange={(e) => setExtra({ ...extra, passportIssueDate: e.target.value })} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. بيانات التواصل */}
        <Card>
          <CardHeader><SectionTitle icon={Phone} title="بيانات التواصل" subtitle="Contact Information" /></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>الجوال <span className="text-red-500">*</span> <span className="text-gray-400 text-xs">/ Mobile</span></Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05xxxxxxxx" data-testid="input-phone" />
              </div>
              <div>
                <Label>الواتساب <span className="text-gray-400 text-xs">/ WhatsApp</span></Label>
                <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="05xxxxxxxx" />
              </div>
              <div>
                <Label>هاتف المنزل <span className="text-gray-400 text-xs">/ Home Phone</span></Label>
                <Input value={extra.homePhone} onChange={(e) => setExtra({ ...extra, homePhone: e.target.value })} />
              </div>
              <div>
                <Label>هاتف العمل <span className="text-gray-400 text-xs">/ Work Phone</span></Label>
                <Input value={extra.workPhone} onChange={(e) => setExtra({ ...extra, workPhone: e.target.value })} />
              </div>
              <div>
                <Label>البريد الإلكتروني <span className="text-gray-400 text-xs">/ E-Mail</span></Label>
                <Input type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>المدينة <span className="text-gray-400 text-xs">/ City</span></Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>العنوان الحالي <span className="text-gray-400 text-xs">/ Present Address</span></Label>
                <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <Label>صندوق البريد <span className="text-gray-400 text-xs">/ P.O. Box</span></Label>
                <Input value={extra.postBox} onChange={(e) => setExtra({ ...extra, postBox: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. المعالون */}
        <Card>
          <CardHeader><SectionTitle icon={Users} title="المعالون" subtitle="Dependents" /></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4">
              <Label className="text-sm">هل تعول أحداً؟ <span className="text-gray-400 text-xs">/ Have any dependents?</span></Label>
              <RadioGroup
                value={extra.hasDependents ? "yes" : "no"}
                onValueChange={(v) => setExtra({ ...extra, hasDependents: v === "yes" })}
                className="flex gap-4"
              >
                <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="yes" id="dep-yes" /><span>نعم</span></label>
                <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="no" id="dep-no" /><span>لا</span></label>
              </RadioGroup>
            </div>
            {extra.hasDependents && (
              <div className="space-y-2">
                {dependents.map((d, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                    <Input placeholder="الاسم" value={d.name} onChange={(e) => { const a = [...dependents]; a[i].name = e.target.value; setDependents(a); }} />
                    <Input placeholder="السن" value={d.age} onChange={(e) => { const a = [...dependents]; a[i].age = e.target.value; setDependents(a); }} />
                    <Input placeholder="القرابة" value={d.relation} onChange={(e) => { const a = [...dependents]; a[i].relation = e.target.value; setDependents(a); }} />
                    <Button size="sm" variant="ghost" className="text-red-600 justify-self-start" onClick={() => setDependents(dependents.filter((_, x) => x !== i))}>
                      <Trash2 className="w-4 h-4 ml-1" /> حذف
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setDependents([...dependents, { name: "", age: "", relation: "" }])}>
                  <Plus className="w-4 h-4 ml-1" /> إضافة معال
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. المعلومات الصحية والوظيفية */}
        <Card>
          <CardHeader><SectionTitle icon={Heart} title="معلومات صحية ووظيفية" subtitle="Health & Employment History" /></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>هل يوجد لديك أي أمراض مزمنة؟ <span className="text-gray-400 text-xs">/ Chronic diseases?</span></Label>
              <Textarea rows={2} value={extra.chronicDiseases} onChange={(e) => setExtra({ ...extra, chronicDiseases: e.target.value })} placeholder="إن وجدت اذكرها، وإلا اترك الحقل فارغاً" />
            </div>
            {form.gender === "female" && (
              <div className="flex items-center gap-4">
                <Label className="text-sm">هل يوجد حمل؟</Label>
                <RadioGroup value={extra.isPregnant} onValueChange={(v) => setExtra({ ...extra, isPregnant: v })} className="flex gap-4">
                  <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="yes" id="preg-y" /><span>نعم</span></label>
                  <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="no" id="preg-n" /><span>لا</span></label>
                </RadioGroup>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>هل سبق وعملت في هذه الشركة؟ <span className="text-gray-400 text-xs">/ Worked here before?</span></Label>
                <RadioGroup value={extra.workedHereBefore} onValueChange={(v) => setExtra({ ...extra, workedHereBefore: v })} className="flex gap-4 mt-2">
                  <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="yes" id="wb-y" /><span>نعم</span></label>
                  <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="no" id="wb-n" /><span>لا</span></label>
                </RadioGroup>
              </div>
              <div>
                <Label>هل تعمل حالياً؟ <span className="text-gray-400 text-xs">/ Currently employed?</span></Label>
                <RadioGroup value={extra.currentlyEmployed} onValueChange={(v) => setExtra({ ...extra, currentlyEmployed: v })} className="flex gap-4 mt-2">
                  <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="yes" id="ce-y" /><span>نعم</span></label>
                  <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="no" id="ce-n" /><span>لا</span></label>
                </RadioGroup>
              </div>
              <div>
                <Label>متى تستطيع مباشرة العمل؟ <span className="text-gray-400 text-xs">/ When can you start?</span></Label>
                <Input type="date" value={extra.startDate || form.availabilityDate} onChange={(e) => { setExtra({ ...extra, startDate: e.target.value }); setForm({ ...form, availabilityDate: e.target.value }); }} />
              </div>
              <div>
                <Label>الراتب المتوقع (ريال) <span className="text-gray-400 text-xs">/ Expected Salary</span></Label>
                <Input type="number" value={form.expectedSalary} onChange={(e) => setForm({ ...form, expectedSalary: e.target.value })} />
              </div>
              <div>
                <Label>الحد الأدنى المطلوب للراتب <span className="text-gray-400 text-xs">/ Minimum salary</span></Label>
                <Input type="number" value={extra.minimumSalary} onChange={(e) => setExtra({ ...extra, minimumSalary: e.target.value })} />
              </div>
              <div>
                <Label>رقم التأمينات الاجتماعية (إن وجد) <span className="text-gray-400 text-xs">/ GOSI No.</span></Label>
                <Input value={extra.gosiNumber} onChange={(e) => setExtra({ ...extra, gosiNumber: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 6. الخبرات العملية */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <SectionTitle icon={Building2} title="الخبرات العملية" subtitle="Work Experience" />
              <Button size="sm" variant="outline" onClick={() => setExperience([...experience, { company: "", position: "", from: "", to: "", salary: "", allowance: "", addressPhone: "", duties: "", reasonForQuit: "" }])}>
                <Plus className="w-4 h-4 ml-1" /> إضافة
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {experience.map((row, i) => (
              <div key={i} className="border-2 border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/30">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">خبرة {i + 1}</Badge>
                  {experience.length > 1 && (
                    <Button size="sm" variant="ghost" className="text-red-600 h-7" onClick={() => setExperience(experience.filter((_, x) => x !== i))}>
                      <Trash2 className="w-4 h-4 ml-1" /> حذف
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input placeholder="اسم الشركة / صاحب العمل" value={row.company} onChange={(e) => { const a = [...experience]; a[i].company = e.target.value; setExperience(a); }} />
                  <Input placeholder="المسمى الوظيفي" value={row.position} onChange={(e) => { const a = [...experience]; a[i].position = e.target.value; setExperience(a); }} />
                  <Input type="date" placeholder="من" value={row.from} onChange={(e) => { const a = [...experience]; a[i].from = e.target.value; setExperience(a); }} />
                  <Input type="date" placeholder="إلى" value={row.to} disabled={row.current} onChange={(e) => { const a = [...experience]; a[i].to = e.target.value; setExperience(a); }} />
                  <Input placeholder="الراتب" value={row.salary || ""} onChange={(e) => { const a = [...experience]; a[i].salary = e.target.value; setExperience(a); }} />
                  <Input placeholder="البدلات" value={row.allowance || ""} onChange={(e) => { const a = [...experience]; a[i].allowance = e.target.value; setExperience(a); }} />
                </div>
                <Input placeholder="الهاتف والعنوان" value={row.addressPhone || ""} onChange={(e) => { const a = [...experience]; a[i].addressPhone = e.target.value; setExperience(a); }} />
                <Textarea rows={2} placeholder="تفاصيل عن واجباتك / ملخص المهام" value={row.duties || row.summary || ""} onChange={(e) => { const a = [...experience]; a[i].duties = e.target.value; setExperience(a); }} />
                <Textarea rows={2} placeholder="سبب ترك العمل" value={row.reasonForQuit || ""} onChange={(e) => { const a = [...experience]; a[i].reasonForQuit = e.target.value; setExperience(a); }} />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!row.current} onCheckedChange={(c) => { const a = [...experience]; a[i].current = !!c; if (c) a[i].to = ""; setExperience(a); }} />
                  مازلت في هذه الوظيفة
                </label>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 7. التحصيل العلمي */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <SectionTitle icon={GraduationCap} title="التحصيل العلمي" subtitle="Education" />
              <Button size="sm" variant="outline" onClick={() => setEducation([...education, { level: "", degree: "", field: "", institution: "", city: "", yearFrom: "", yearTo: "" }])}>
                <Plus className="w-4 h-4 ml-1" /> إضافة
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {education.map((row, i) => (
              <div key={i} className="border-2 border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/30">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Select value={row.level || ""} onValueChange={(v) => { const a = [...education]; a[i].level = v; setEducation(a); }}>
                    <SelectTrigger><SelectValue placeholder="المرحلة الدراسية" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="elementary">ابتدائي</SelectItem>
                      <SelectItem value="intermediate">إعدادي</SelectItem>
                      <SelectItem value="secondary">ثانوي</SelectItem>
                      <SelectItem value="high_diploma">دبلوم بعد الثانوية</SelectItem>
                      <SelectItem value="university">جامعة</SelectItem>
                      <SelectItem value="postgraduate">دراسات عليا</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="اسم المدرسة / الجامعة" value={row.institution} onChange={(e) => { const a = [...education]; a[i].institution = e.target.value; setEducation(a); }} />
                  <Input placeholder="المدينة / البلد" value={row.city || ""} onChange={(e) => { const a = [...education]; a[i].city = e.target.value; setEducation(a); }} />
                  <Input placeholder="التخصص" value={row.field} onChange={(e) => { const a = [...education]; a[i].field = e.target.value; setEducation(a); }} />
                  <Input placeholder="المؤهل (بكالوريوس...)" value={row.degree} onChange={(e) => { const a = [...education]; a[i].degree = e.target.value; setEducation(a); }} />
                  <Input placeholder="الدرجة / المعدل" value={row.gpa || ""} onChange={(e) => { const a = [...education]; a[i].gpa = e.target.value; setEducation(a); }} />
                  <Input placeholder="من سنة" value={row.yearFrom} onChange={(e) => { const a = [...education]; a[i].yearFrom = e.target.value; setEducation(a); }} />
                  <Input placeholder="إلى سنة" value={row.yearTo} onChange={(e) => { const a = [...education]; a[i].yearTo = e.target.value; setEducation(a); }} />
                </div>
                {education.length > 1 && (
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setEducation(education.filter((_, x) => x !== i))}>
                    <Trash2 className="w-4 h-4 ml-1" /> حذف
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 8. الدورات التدريبية */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <SectionTitle icon={BookOpen} title="الدورات التدريبية" subtitle="Training Courses" />
              <Button size="sm" variant="outline" onClick={() => setTrainings([...trainings, { institute: "", city: "", from: "", to: "", specialize: "" }])}>
                <Plus className="w-4 h-4 ml-1" /> إضافة
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {trainings.map((t, i) => (
              <div key={i} className="border-2 border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/30">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input placeholder="اسم المعهد" value={t.institute} onChange={(e) => { const a = [...trainings]; a[i].institute = e.target.value; setTrainings(a); }} />
                  <Input placeholder="المدينة / البلد" value={t.city} onChange={(e) => { const a = [...trainings]; a[i].city = e.target.value; setTrainings(a); }} />
                  <Input placeholder="التخصص" value={t.specialize} onChange={(e) => { const a = [...trainings]; a[i].specialize = e.target.value; setTrainings(a); }} />
                  <Input type="date" placeholder="من" value={t.from} onChange={(e) => { const a = [...trainings]; a[i].from = e.target.value; setTrainings(a); }} />
                  <Input type="date" placeholder="إلى" value={t.to} onChange={(e) => { const a = [...trainings]; a[i].to = e.target.value; setTrainings(a); }} />
                </div>
                {trainings.length > 1 && (
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setTrainings(trainings.filter((_, x) => x !== i))}>
                    <Trash2 className="w-4 h-4 ml-1" /> حذف
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 9. اللغات والمهارات */}
        <Card>
          <CardHeader><SectionTitle icon={LanguagesIcon} title="اللغات والمهارات" subtitle="Languages & Skills" /></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-semibold text-[#1a3a2f]">معرفة اللغات <span className="text-gray-400 text-xs">/ Knowledge of Languages</span></Label>
              <div className="overflow-x-auto mt-2 -mx-1">
                <table className="w-full text-sm border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-amber-50">
                      <th className="border border-gray-200 p-2 text-right">اللغة / Language</th>
                      <th className="border border-gray-200 p-2">التحدث / Speaking</th>
                      <th className="border border-gray-200 p-2">القراءة / Reading</th>
                      <th className="border border-gray-200 p-2">الكتابة / Writing</th>
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
                              <SelectTrigger className="border-0 h-8"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                {LEVEL_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
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
                <Plus className="w-3 h-3 ml-1" /> إضافة لغة
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>سرعة الطباعة <span className="text-gray-400 text-xs">/ Typing Speed (كلمة/دقيقة)</span></Label>
                <Input value={extra.typingSpeed} onChange={(e) => setExtra({ ...extra, typingSpeed: e.target.value })} />
              </div>
              <div>
                <Label>مهارات أخرى <span className="text-gray-400 text-xs">/ Other Skills</span></Label>
                <Input value={extra.otherSkills} onChange={(e) => setExtra({ ...extra, otherSkills: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>المهارات (وسوم) <span className="text-gray-400 text-xs">/ Skill Tags</span></Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="أضف مهارة واضغط Enter"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && skillInput.trim()) { e.preventDefault(); setSkills([...skills, skillInput.trim()]); setSkillInput(""); }
                  }}
                />
                <Button type="button" variant="outline" onClick={() => { if (skillInput.trim()) { setSkills([...skills, skillInput.trim()]); setSkillInput(""); } }}>إضافة</Button>
              </div>
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {skills.map((s, i) => (
                    <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setSkills(skills.filter((_, x) => x !== i))}>{s} ×</Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>الهوايات <span className="text-gray-400 text-xs">/ Hobbies</span></Label>
              <Textarea rows={2} value={extra.hobbies} onChange={(e) => setExtra({ ...extra, hobbies: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        {/* 10. رخصة القيادة */}
        <Card>
          <CardHeader><SectionTitle icon={Car} title="رخصة القيادة" subtitle="Driving License" /></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>نوعها <span className="text-gray-400 text-xs">/ Category</span></Label>
              <Input value={extra.drivingLicenseCategory} onChange={(e) => setExtra({ ...extra, drivingLicenseCategory: e.target.value })} placeholder="خاصة / عامة / دراجة..." />
            </div>
            <div>
              <Label>رقمها <span className="text-gray-400 text-xs">/ Number</span></Label>
              <Input value={extra.drivingLicenseNumber} onChange={(e) => setExtra({ ...extra, drivingLicenseNumber: e.target.value })} />
            </div>
            <div>
              <Label>تاريخ صدورها <span className="text-gray-400 text-xs">/ Date of Issue</span></Label>
              <Input type="date" value={extra.drivingLicenseIssueDate} onChange={(e) => setExtra({ ...extra, drivingLicenseIssueDate: e.target.value })} />
            </div>
            <div>
              <Label>تاريخ انتهائها <span className="text-gray-400 text-xs">/ Expiry Date</span></Label>
              <Input type="date" value={extra.drivingLicenseExpiryDate} onChange={(e) => setExtra({ ...extra, drivingLicenseExpiryDate: e.target.value })} />
            </div>
            <div>
              <Label>مكان الإصدار <span className="text-gray-400 text-xs">/ Place of Issue</span></Label>
              <Input value={extra.drivingLicensePlaceOfIssue} onChange={(e) => setExtra({ ...extra, drivingLicensePlaceOfIssue: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        {/* 11. السوابق */}
        <Card>
          <CardHeader><SectionTitle icon={Award} title="السوابق القضائية" subtitle="Convictions" /></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4">
              <Label className="text-sm">هل صدرت بحقك أحكام قضائية؟ <span className="text-gray-400 text-xs">/ Convicted before?</span></Label>
              <RadioGroup value={extra.hasConvictions} onValueChange={(v) => setExtra({ ...extra, hasConvictions: v })} className="flex gap-4">
                <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="yes" id="cv-y" /><span>نعم</span></label>
                <label className="flex items-center gap-1 cursor-pointer"><RadioGroupItem value="no" id="cv-n" /><span>لا</span></label>
              </RadioGroup>
            </div>
            {extra.hasConvictions === "yes" && (
              <div>
                <Label>التفاصيل <span className="text-gray-400 text-xs">/ Details</span></Label>
                <Textarea rows={3} value={extra.convictionsDetails} onChange={(e) => setExtra({ ...extra, convictionsDetails: e.target.value })} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 12. مصدر معرفة الوظيفة والمعرفون */}
        <Card>
          <CardHeader><SectionTitle icon={Info} title="مصدر معرفة الوظيفة والمعرّفون" subtitle="Source & References" /></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>كيف عرفت عن فرصة العمل؟ <span className="text-gray-400 text-xs">/ How did you know about the job?</span></Label>
              <Input value={extra.howKnewAboutJob} onChange={(e) => setExtra({ ...extra, howKnewAboutJob: e.target.value })} />
            </div>
            <div>
              <Label>هل لديك أقارب يعملون في شركتنا؟ (اذكرهم) <span className="text-gray-400 text-xs">/ Relatives in our company?</span></Label>
              <Textarea rows={2} value={extra.relativesInCompany} onChange={(e) => setExtra({ ...extra, relativesInCompany: e.target.value })} />
            </div>

            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold text-[#1a3a2f]">المعرّفون (3 أشخاص) <span className="text-gray-400 text-xs">/ References</span></Label>
                <Button size="sm" variant="outline" onClick={() => setReferences([...references, { name: "", position: "", company: "", phone: "", address: "" }])}>
                  <Plus className="w-3 h-3 ml-1" /> إضافة
                </Button>
              </div>
              {references.length === 0 && <p className="text-sm text-gray-500">لم تتم إضافة معرّفين</p>}
              {references.map((r, i) => (
                <div key={i} className="border-2 border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/30 mb-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Input placeholder="الاسم / Name" value={r.name} onChange={(e) => { const a = [...references]; a[i].name = e.target.value; setReferences(a); }} />
                    <Input placeholder="الوظيفة / Position" value={r.position} onChange={(e) => { const a = [...references]; a[i].position = e.target.value; setReferences(a); }} />
                    <Input placeholder="الشركة / Company" value={r.company} onChange={(e) => { const a = [...references]; a[i].company = e.target.value; setReferences(a); }} />
                    <Input placeholder="الهاتف / Tel" value={r.phone} onChange={(e) => { const a = [...references]; a[i].phone = e.target.value; setReferences(a); }} />
                  </div>
                  <Input placeholder="العنوان / Address" value={r.address || ""} onChange={(e) => { const a = [...references]; a[i].address = e.target.value; setReferences(a); }} />
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setReferences(references.filter((_, x) => x !== i))}>
                    <Trash2 className="w-4 h-4 ml-1" /> حذف
                  </Button>
                </div>
              ))}
            </div>

            <div>
              <Label>هل هناك معلومات أخرى تود إضافتها؟ <span className="text-gray-400 text-xs">/ Other data of interest</span></Label>
              <Textarea rows={3} value={extra.otherData} onChange={(e) => setExtra({ ...extra, otherData: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        {/* 13. المرفقات */}
        <Card>
          <CardHeader><SectionTitle icon={Paperclip} title="المرفقات" subtitle="Attachments" /></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">الحد الأقصى لكل ملف ١.٥ ميجا (إجمالي الطلب ٤ ميجا) — يجب إرفاق نسخ من الشهادات الدراسية وشهادات الخبرات العملية</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: "السيرة الذاتية (PDF)", value: cvUrl, setter: setCvUrl, accept: ".pdf,.doc,.docx" },
                { label: "الصورة الشخصية", value: photoUrl, setter: setPhotoUrl, accept: "image/*" },
                { label: "نسخة الهوية", value: idCopyUrl, setter: setIdCopyUrl, accept: "image/*,.pdf" },
              ].map((f, i) => (
                <div key={i} className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center space-y-2 hover:border-[#e67e22]/50 transition-colors">
                  <Label className="block text-sm font-semibold">{f.label}</Label>
                  {f.value ? (
                    <>
                      {f.value.startsWith("data:image") ? (
                        <img src={f.value} className="max-h-24 mx-auto rounded" alt="" />
                      ) : (
                        <p className="text-xs text-green-600 font-semibold">تم الرفع ✓</p>
                      )}
                      <Button size="sm" variant="outline" onClick={() => f.setter("")}>إزالة</Button>
                    </>
                  ) : (
                    <label className="cursor-pointer block">
                      <input type="file" accept={f.accept} className="hidden" onChange={(e) => handleFile(e.target.files?.[0], f.setter, f.label)} />
                      <div className="rounded p-3 hover:bg-gray-50">
                        <Upload className="w-6 h-6 mx-auto text-gray-400" />
                        <p className="text-xs mt-1">انقر للرفع</p>
                      </div>
                    </label>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 14. الإقرار والتوقيع */}
        <Card className="border-2 border-[#e67e22]/20">
          <CardHeader><SectionTitle icon={PenLine} title="الإقرار والتوقيع" subtitle="Declaration & Signature" /></CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm leading-relaxed">
              أقرّ أنا الموقّع أدناه بأن جميع البيانات المذكورة في هذا الطلب صحيحة وكاملة حسب معرفتي واعتقادي، وأوافق على أن تتحققوا من صحتها، وأي معلومات غير صحيحة ستكون سبباً كافياً لمساءلتي.
              <p className="text-xs text-gray-500 mt-2 italic">I hereby certify that all the foregoing information is, to the best of my knowledge and belief, correct and complete, and I authorize you to verify it. Any false or omitted information will be sufficient cause for my responsibility.</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={agreed} onCheckedChange={(c) => setAgreed(!!c)} data-testid="checkbox-agree" />
              أوافق على الإقرار أعلاه
            </label>
            <div>
              <Label>التوقيع <span className="text-red-500">*</span></Label>
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
            {submitting ? "جاري الإرسال..." : "إرسال الطلب"}
          </Button>
        </div>
      </div>
    </div>
  );
}
