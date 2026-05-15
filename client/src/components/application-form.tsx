import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { SignaturePad } from "@/components/signature-pad";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload, AlertCircle, Briefcase } from "lucide-react";

const MAX_FILE_SIZE = 1.5 * 1024 * 1024; // 1.5MB
const MAX_TOTAL_PAYLOAD = 4 * 1024 * 1024; // 4MB total — حدّ آمن لمتصفحات الجوال

type EduRow = { degree: string; field: string; institution: string; yearFrom: string; yearTo: string; gpa?: string };
type ExpRow = { company: string; position: string; from: string; to: string; current?: boolean; summary?: string };
type LangRow = { name: string; level: string };
type RefRow = { name: string; position: string; company: string; phone: string; email?: string };

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

export default function ApplicationForm({ initial, vacancy, company, submitting, error, onSubmit }: Props) {
  const { toast } = useToast();

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

  const [education, setEducation] = useState<EduRow[]>(
    (Array.isArray(initial?.education) && initial.education.length > 0 ? initial.education : [{ degree: "", field: "", institution: "", yearFrom: "", yearTo: "" }])
  );
  const [experience, setExperience] = useState<ExpRow[]>(
    (Array.isArray(initial?.experience) && initial.experience.length > 0 ? initial.experience : [{ company: "", position: "", from: "", to: "", summary: "" }])
  );
  const [skills, setSkills] = useState<string[]>(Array.isArray(initial?.skills) ? initial.skills : []);
  const [skillInput, setSkillInput] = useState("");
  const [languages, setLanguages] = useState<LangRow[]>(Array.isArray(initial?.languages) ? initial.languages : [{ name: "العربية", level: "أم" }]);
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

  const submit = () => {
    if (!form.fullNameAr || !form.phone) {
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
    const payload: any = {
      ...form,
      expectedSalary: form.expectedSalary ? Number(form.expectedSalary) : undefined,
      education: education.filter((e) => e.degree || e.institution),
      experience: experience.filter((e) => e.company || e.position),
      skills,
      languages: languages.filter((l) => l.name),
      references: references.filter((r) => r.name),
      cvUrl: cvUrl || undefined,
      photoUrl: photoUrl || undefined,
      idCopyUrl: idCopyUrl || undefined,
      signature,
      agreedToTerms: true,
    };
    if (!payload.email) delete payload.email;

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
    <div className="min-h-screen bg-[#F5F0E6] py-6 px-3" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-[#1a3a2f] flex items-center gap-2">
                  <Briefcase className="w-6 h-6 text-[#e67e22]" />
                  طلب توظيف
                </h1>
                <p className="text-sm text-gray-600 mt-1">{company?.name || "شركة الزبد الأفضل التجارية"}</p>
                {titleText && <p className="text-base font-semibold mt-2">الوظيفة: {titleText}</p>}
                {vacancy?.branchName && <p className="text-sm text-gray-600">الفرع: {vacancy.branchName}</p>}
                {vacancy?.description && <p className="text-sm mt-2 text-gray-700">{vacancy.description}</p>}
                {vacancy?.requirements && (
                  <div className="mt-2 text-sm">
                    <strong>المتطلبات:</strong>
                    <p className="text-gray-700 whitespace-pre-line">{vacancy.requirements}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* البيانات الشخصية */}
        <Card>
          <CardHeader><CardTitle className="text-lg">البيانات الشخصية</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>الاسم الرباعي بالعربي *</Label>
                <Input value={form.fullNameAr} onChange={(e) => setForm({ ...form, fullNameAr: e.target.value })} data-testid="input-name-ar" />
              </div>
              <div>
                <Label>الاسم بالإنجليزي</Label>
                <Input value={form.fullNameEn} onChange={(e) => setForm({ ...form, fullNameEn: e.target.value })} dir="ltr" />
              </div>
              <div>
                <Label>الجنسية</Label>
                <Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
              </div>
              <div>
                <Label>نوع الهوية</Label>
                <Select value={form.idType} onValueChange={(v) => setForm({ ...form, idType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="national">هوية وطنية</SelectItem>
                    <SelectItem value="iqama">إقامة</SelectItem>
                    <SelectItem value="passport">جواز سفر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>رقم الهوية / الإقامة</Label>
                <Input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
              </div>
              <div>
                <Label>تاريخ انتهاء الهوية</Label>
                <Input type="date" value={form.idExpiry} onChange={(e) => setForm({ ...form, idExpiry: e.target.value })} />
              </div>
              <div>
                <Label>تاريخ الميلاد</Label>
                <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
              </div>
              <div>
                <Label>الجنس</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">ذكر</SelectItem>
                    <SelectItem value="female">أنثى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الحالة الاجتماعية</Label>
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
                <Label>المدينة</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>العنوان التفصيلي</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
            </div>
          </CardContent>
        </Card>

        {/* التواصل */}
        <Card>
          <CardHeader><CardTitle className="text-lg">بيانات التواصل</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>الجوال *</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05xxxxxxxx" data-testid="input-phone" />
            </div>
            <div>
              <Label>الواتساب</Label>
              <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="05xxxxxxxx" />
            </div>
            <div>
              <Label>البريد الإلكتروني</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" />
            </div>
          </CardContent>
        </Card>

        {/* المؤهلات */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">المؤهلات العلمية</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setEducation([...education, { degree: "", field: "", institution: "", yearFrom: "", yearTo: "" }])}>
                <Plus className="w-4 h-4 ml-1" /> إضافة
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {education.map((row, i) => (
              <div key={i} className="border rounded p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input placeholder="المؤهل (بكالوريوس...)" value={row.degree} onChange={(e) => { const a = [...education]; a[i].degree = e.target.value; setEducation(a); }} />
                  <Input placeholder="التخصص" value={row.field} onChange={(e) => { const a = [...education]; a[i].field = e.target.value; setEducation(a); }} />
                  <Input placeholder="الجامعة / المعهد" value={row.institution} onChange={(e) => { const a = [...education]; a[i].institution = e.target.value; setEducation(a); }} />
                  <Input placeholder="من سنة" value={row.yearFrom} onChange={(e) => { const a = [...education]; a[i].yearFrom = e.target.value; setEducation(a); }} />
                  <Input placeholder="إلى سنة" value={row.yearTo} onChange={(e) => { const a = [...education]; a[i].yearTo = e.target.value; setEducation(a); }} />
                  <Input placeholder="المعدل (اختياري)" value={row.gpa || ""} onChange={(e) => { const a = [...education]; a[i].gpa = e.target.value; setEducation(a); }} />
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

        {/* الخبرات */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">الخبرات العملية</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setExperience([...experience, { company: "", position: "", from: "", to: "", summary: "" }])}>
                <Plus className="w-4 h-4 ml-1" /> إضافة
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {experience.map((row, i) => (
              <div key={i} className="border rounded p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input placeholder="جهة العمل" value={row.company} onChange={(e) => { const a = [...experience]; a[i].company = e.target.value; setExperience(a); }} />
                  <Input placeholder="المسمى الوظيفي" value={row.position} onChange={(e) => { const a = [...experience]; a[i].position = e.target.value; setExperience(a); }} />
                  <Input type="date" placeholder="من" value={row.from} onChange={(e) => { const a = [...experience]; a[i].from = e.target.value; setExperience(a); }} />
                  <Input type="date" placeholder="إلى" value={row.to} disabled={row.current} onChange={(e) => { const a = [...experience]; a[i].to = e.target.value; setExperience(a); }} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!row.current} onCheckedChange={(c) => { const a = [...experience]; a[i].current = !!c; if (c) a[i].to = ""; setExperience(a); }} />
                  مازلت في هذه الوظيفة
                </label>
                <Textarea placeholder="ملخص المهام" rows={2} value={row.summary || ""} onChange={(e) => { const a = [...experience]; a[i].summary = e.target.value; setExperience(a); }} />
                {experience.length > 1 && (
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setExperience(experience.filter((_, x) => x !== i))}>
                    <Trash2 className="w-4 h-4 ml-1" /> حذف
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* المهارات واللغات */}
        <Card>
          <CardHeader><CardTitle className="text-lg">المهارات واللغات</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>المهارات</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="أضف مهارة واضغط Enter"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && skillInput.trim()) {
                      e.preventDefault();
                      setSkills([...skills, skillInput.trim()]);
                      setSkillInput("");
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={() => { if (skillInput.trim()) { setSkills([...skills, skillInput.trim()]); setSkillInput(""); } }}>
                  إضافة
                </Button>
              </div>
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {skills.map((s, i) => (
                    <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setSkills(skills.filter((_, x) => x !== i))}>
                      {s} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>اللغات</Label>
                <Button size="sm" variant="outline" onClick={() => setLanguages([...languages, { name: "", level: "" }])}>
                  <Plus className="w-3 h-3 ml-1" /> إضافة
                </Button>
              </div>
              <div className="space-y-2 mt-2">
                {languages.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="اللغة" value={l.name} onChange={(e) => { const a = [...languages]; a[i].name = e.target.value; setLanguages(a); }} />
                    <Select value={l.level} onValueChange={(v) => { const a = [...languages]; a[i].level = v; setLanguages(a); }}>
                      <SelectTrigger className="w-[160px]"><SelectValue placeholder="المستوى" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="أم">لغة أم</SelectItem>
                        <SelectItem value="ممتاز">ممتاز</SelectItem>
                        <SelectItem value="جيد جداً">جيد جداً</SelectItem>
                        <SelectItem value="جيد">جيد</SelectItem>
                        <SelectItem value="مبتدئ">مبتدئ</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" className="text-red-600" onClick={() => setLanguages(languages.filter((_, x) => x !== i))}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* التوقعات */}
        <Card>
          <CardHeader><CardTitle className="text-lg">التوقعات</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>الراتب المتوقع (ريال)</Label>
              <Input type="number" value={form.expectedSalary} onChange={(e) => setForm({ ...form, expectedSalary: e.target.value })} />
            </div>
            <div>
              <Label>تاريخ الاستعداد للمباشرة</Label>
              <Input type="date" value={form.availabilityDate} onChange={(e) => setForm({ ...form, availabilityDate: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        {/* المعرّفون */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">المعرّفون (اختياري)</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setReferences([...references, { name: "", position: "", company: "", phone: "", email: "" }])}>
                <Plus className="w-4 h-4 ml-1" /> إضافة
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {references.length === 0 && <p className="text-sm text-gray-500">لا يوجد</p>}
            {references.map((r, i) => (
              <div key={i} className="border rounded p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input placeholder="الاسم" value={r.name} onChange={(e) => { const a = [...references]; a[i].name = e.target.value; setReferences(a); }} />
                  <Input placeholder="المنصب" value={r.position} onChange={(e) => { const a = [...references]; a[i].position = e.target.value; setReferences(a); }} />
                  <Input placeholder="جهة العمل" value={r.company} onChange={(e) => { const a = [...references]; a[i].company = e.target.value; setReferences(a); }} />
                  <Input placeholder="الجوال" value={r.phone} onChange={(e) => { const a = [...references]; a[i].phone = e.target.value; setReferences(a); }} />
                </div>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setReferences(references.filter((_, x) => x !== i))}>
                  <Trash2 className="w-4 h-4 ml-1" /> حذف
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* المرفقات */}
        <Card>
          <CardHeader><CardTitle className="text-lg">المرفقات</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">الحد الأقصى لكل ملف ١.٥ ميجا (إجمالي الطلب ٤ ميجا)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: "السيرة الذاتية (PDF)", value: cvUrl, setter: setCvUrl, accept: ".pdf,.doc,.docx" },
                { label: "الصورة الشخصية", value: photoUrl, setter: setPhotoUrl, accept: "image/*" },
                { label: "نسخة الهوية", value: idCopyUrl, setter: setIdCopyUrl, accept: "image/*,.pdf" },
              ].map((f, i) => (
                <div key={i} className="border rounded p-3 text-center space-y-2">
                  <Label className="block text-sm">{f.label}</Label>
                  {f.value ? (
                    <>
                      {f.value.startsWith("data:image") ? (
                        <img src={f.value} className="max-h-24 mx-auto" alt="" />
                      ) : (
                        <p className="text-xs text-green-600">تم الرفع ✓</p>
                      )}
                      <Button size="sm" variant="outline" onClick={() => f.setter("")}>إزالة</Button>
                    </>
                  ) : (
                    <label className="cursor-pointer block">
                      <input type="file" accept={f.accept} className="hidden" onChange={(e) => handleFile(e.target.files?.[0], f.setter, f.label)} />
                      <div className="border-2 border-dashed rounded p-4 hover:bg-gray-50">
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

        {/* التوقيع والإقرار */}
        <Card>
          <CardHeader><CardTitle className="text-lg">الإقرار والتوقيع</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
              أقر أنا الموقّع أدناه بأن جميع البيانات المذكورة في هذا الطلب صحيحة، وأتحمّل المسؤولية الكاملة عن أي معلومات غير دقيقة، وأوافق على إجراء التحقق منها.
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={agreed} onCheckedChange={(c) => setAgreed(!!c)} data-testid="checkbox-agree" />
              أوافق على الإقرار أعلاه
            </label>
            <div>
              <Label>التوقيع *</Label>
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
          <Button size="lg" onClick={submit} disabled={submitting} className="bg-[#e67e22] hover:bg-[#d35400]" data-testid="button-submit-application">
            {submitting ? "جاري الإرسال..." : "إرسال الطلب"}
          </Button>
        </div>
      </div>
    </div>
  );
}
