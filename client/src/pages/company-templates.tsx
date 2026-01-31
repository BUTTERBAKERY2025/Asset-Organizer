import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link } from "wouter";
import { 
  ArrowRight, 
  FileText, 
  Printer, 
  UserPlus,
  UserCheck,
  FileCheck,
  ClipboardList,
  Package,
  CreditCard,
  LogOut,
  AlertTriangle,
  Briefcase,
  Award,
  Building2,
  Phone,
  Mail,
  Calendar,
  User,
  Hash,
  MapPin,
  X,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { useReactToPrint } from "react-to-print";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const COMPANY_INFO = {
  name: "شركة الزبد الأفضل التجارية",
  nameEn: "Best Butter Trading Company",
  cr: "7026155296",
  logo: "/company-logo.png",
  address: "المملكة العربية السعودية",
  addressEn: "Kingdom of Saudi Arabia",
};

type TemplateType = 
  | "work_start" 
  | "final_settlement" 
  | "job_offer" 
  | "employment_application" 
  | "employee_status_change" 
  | "probation_evaluation" 
  | "asset_handover" 
  | "payment_order" 
  | "clearance" 
  | "penalty";

interface Template {
  id: TemplateType;
  title: string;
  titleEn: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const templates: Template[] = [
  {
    id: "work_start",
    title: "إشعار مباشرة العمل",
    titleEn: "Effective Date Notice",
    icon: <UserCheck className="h-5 w-5" />,
    description: "نموذج إثبات مباشرة الموظف للعمل",
    color: "bg-blue-600",
  },
  {
    id: "final_settlement",
    title: "مخالصة نهائية",
    titleEn: "Final Settlement",
    icon: <FileCheck className="h-5 w-5" />,
    description: "نموذج المخالصة النهائية عند انتهاء الخدمة",
    color: "bg-green-600",
  },
  {
    id: "job_offer",
    title: "عرض العمل",
    titleEn: "Job Offer",
    icon: <Briefcase className="h-5 w-5" />,
    description: "تفاصيل عرض العمل للموظف الجديد",
    color: "bg-amber-600",
  },
  {
    id: "employment_application",
    title: "طلب توظيف",
    titleEn: "Employment Application",
    icon: <UserPlus className="h-5 w-5" />,
    description: "نموذج طلب التوظيف للمتقدمين",
    color: "bg-purple-600",
  },
  {
    id: "employee_status_change",
    title: "طلب تعديل حالة موظف",
    titleEn: "Employee Status Change",
    icon: <ClipboardList className="h-5 w-5" />,
    description: "نموذج طلب تعديل حالة أو نقل موظف",
    color: "bg-indigo-600",
  },
  {
    id: "probation_evaluation",
    title: "تقييم موظف تحت التجربة",
    titleEn: "Probation Evaluation",
    icon: <Award className="h-5 w-5" />,
    description: "نموذج تقييم الموظف خلال فترة التجربة",
    color: "bg-teal-600",
  },
  {
    id: "asset_handover",
    title: "تسليم عهدة",
    titleEn: "Asset Handover",
    icon: <Package className="h-5 w-5" />,
    description: "نموذج تسليم واستلام العهدة",
    color: "bg-orange-600",
  },
  {
    id: "payment_order",
    title: "أمر صرف / دفع",
    titleEn: "Payment Order",
    icon: <CreditCard className="h-5 w-5" />,
    description: "نموذج أمر صرف أو تحويل مالي",
    color: "bg-emerald-600",
  },
  {
    id: "clearance",
    title: "إخلاء طرف",
    titleEn: "Clearance Form",
    icon: <LogOut className="h-5 w-5" />,
    description: "نموذج إخلاء طرف الموظف",
    color: "bg-slate-600",
  },
  {
    id: "penalty",
    title: "إجراء جزائي",
    titleEn: "Penalty Procedure",
    icon: <AlertTriangle className="h-5 w-5" />,
    description: "نموذج الإجراء الجزائي والمخالفات",
    color: "bg-red-600",
  },
];

function CompanyHeader({ templateTitle, templateTitleEn }: { templateTitle?: string; templateTitleEn?: string }) {
  return (
    <div className="mb-3 relative">
      {/* Watermark Background */}
      <div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '280px',
          height: '280px',
        }}
      >
        <img 
          src={COMPANY_INFO.logo} 
          alt="" 
          className="w-full h-full object-contain"
          style={{ opacity: 0.04 }}
        />
      </div>

      {/* Main Header with Logo on Left - Compact */}
      <div className="flex items-start justify-between border-b-2 border-[#1a3a2f] pb-2 mb-2 relative z-10">
        {/* Logo - Left Side */}
        <div className="flex-shrink-0">
          <img 
            src={COMPANY_INFO.logo} 
            alt="Company Logo" 
            className="h-14 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
        
        {/* Company Info - Center & Right */}
        <div className="flex-1 text-center px-2">
          <h1 className="text-base font-bold text-[#1a3a2f]">{COMPANY_INFO.name}</h1>
          <h2 className="text-sm font-semibold text-[#1a3a2f]">{COMPANY_INFO.nameEn}</h2>
          <span className="text-xs text-slate-600">سجل تجاري / C.R: {COMPANY_INFO.cr}</span>
        </div>
      </div>
      
      {/* Template Title - Compact */}
      {templateTitle && (
        <div className="text-center border border-[#1a3a2f] rounded py-1 px-2 bg-slate-50 relative z-10">
          <h2 className="text-sm font-bold text-[#1a3a2f]">{templateTitle}</h2>
          {templateTitleEn && <p className="text-xs font-medium text-slate-600">{templateTitleEn}</p>}
        </div>
      )}
    </div>
  );
}

function CompanyFooter() {
  return (
    <div className="mt-3 pt-2 border-t border-[#1a3a2f] text-center text-xs text-slate-600 relative z-10">
      <div className="flex justify-between items-center">
        <p className="font-semibold text-xs">{COMPANY_INFO.name}</p>
        <p className="text-xs">C.R: {COMPANY_INFO.cr}</p>
        <p className="font-semibold text-xs">{COMPANY_INFO.nameEn}</p>
      </div>
    </div>
  );
}

function WorkStartTemplate() {
  const printRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    employeeName: "",
    employeeNo: "",
    position: "",
    department: "",
    section: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    isFirstTime: true,
    returnedFrom: "",
    managerName: "",
    hrSpecialist: "",
    payrollAccountant: "",
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "إشعار مباشرة العمل",
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>اسم الموظف / Name</Label>
          <Input value={formData.employeeName} onChange={(e) => setFormData({...formData, employeeName: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>رقم الموظف / Employee No</Label>
          <Input value={formData.employeeNo} onChange={(e) => setFormData({...formData, employeeNo: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الوظيفة / Position</Label>
          <Input value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الإدارة / Department</Label>
          <Input value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>القسم / Section</Label>
          <Input value={formData.section} onChange={(e) => setFormData({...formData, section: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>تاريخ المباشرة / Start Date</Label>
          <Input type="date" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} />
        </div>
        <div className="space-y-2 col-span-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox checked={formData.isFirstTime} onCheckedChange={(checked) => setFormData({...formData, isFirstTime: checked as boolean})} />
              <Label>التحق بالعمل لأول مرة</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={!formData.isFirstTime} onCheckedChange={(checked) => setFormData({...formData, isFirstTime: !checked})} />
              <Label>التحق بالعمل بعد العودة من:</Label>
              <Input className="w-40" value={formData.returnedFrom} onChange={(e) => setFormData({...formData, returnedFrom: e.target.value})} disabled={formData.isFirstTime} />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label>المدير المباشر / Direct Manager</Label>
          <Input value={formData.managerName} onChange={(e) => setFormData({...formData, managerName: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الموظف المختص بالموارد البشرية</Label>
          <Input value={formData.hrSpecialist} onChange={(e) => setFormData({...formData, hrSpecialist: e.target.value})} />
        </div>
      </div>

      <Button onClick={() => handlePrint()} className="w-full gap-2 bg-amber-600 hover:bg-amber-700">
        <Printer className="h-4 w-4" /> طباعة النموذج
      </Button>

      <div className="hidden">
        <div ref={printRef} className="p-4 bg-white print:block text-sm" dir="rtl">
          <CompanyHeader templateTitle="إشعار مباشرة العمل" templateTitleEn="Effective Date Notice" />
          
          <div className="border border-slate-300 rounded p-2 mb-2">
            <h3 className="font-bold text-slate-700 mb-1 border-b pb-1 text-xs">1. بيانات الموظف / Employee Data</h3>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div><span className="font-semibold">الاسم / Name:</span> {formData.employeeName}</div>
              <div><span className="font-semibold">رقم الموظف / Employee No:</span> {formData.employeeNo}</div>
              <div><span className="font-semibold">الوظيفة / Job Title:</span> {formData.position}</div>
              <div><span className="font-semibold">الإدارة / Department:</span> {formData.department}</div>
              <div><span className="font-semibold">القسم / Section:</span> {formData.section}</div>
              <div><span className="font-semibold">تاريخ المباشرة / Start Date:</span> {formData.startDate}</div>
            </div>
            <div className="mt-4 pt-2 border-t">
              <span className="font-semibold">توقيع الموظف / Employee Signature:</span> ___________________
            </div>
          </div>

          <div className="border border-slate-300 rounded p-2 mb-2">
            <h3 className="font-bold text-slate-700 mb-1 border-b pb-1 text-xs">2. إلى: الموارد البشرية / To: HR Department</h3>
            <p className="text-sm mb-2">نأمل اعتماد مباشرة العمل للموظف / Please approve work commencement for employee:</p>
            <div className="flex gap-4 text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 border ${formData.isFirstTime ? 'bg-slate-800' : ''}`}></span>
                التحق بالعمل لأول مرة / First time joining
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 border ${!formData.isFirstTime ? 'bg-slate-800' : ''}`}></span>
                التحق بالعمل بعد العودة من / Returned from: {formData.returnedFrom}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-1 text-xs">
              <div><span className="font-semibold">المدير المباشر / Direct Manager:</span> {formData.managerName}</div>
              <div><span className="font-semibold">التوقيع / Signature:</span> ___________________</div>
              <div><span className="font-semibold">التاريخ / Date:</span> ___/___/______</div>
            </div>
          </div>

          <div className="border border-slate-300 rounded p-2">
            <h3 className="font-bold text-slate-700 mb-1 border-b pb-1 text-xs">3. لاستخدام الموارد البشرية فقط / HR Use Only</h3>
            <div className="space-y-2 text-sm">
              <p>□ المذكور باشر في التاريخ المحدد ويدرج اسمه بكشوفات الرواتب اعتباراً من: ___/___/______</p>
              <p className="text-xs text-slate-500 mr-6">The employee started on the specified date and will be added to payroll from: ___/___/______</p>
              <p>□ المذكور باشر العمل متأخراً _____ يوم ويدرج اسمه بكشوفات الرواتب اعتباراً من: ___/___/______</p>
              <p className="text-xs text-slate-500 mr-6">The employee started late by _____ days and will be added to payroll from: ___/___/______</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-1 text-xs">
              <div><span className="font-semibold">الموظف المختص / HR Specialist:</span> {formData.hrSpecialist}</div>
              <div><span className="font-semibold">التوقيع / Signature:</span> ___________________</div>
              <div><span className="font-semibold">محاسب الرواتب / Payroll Accountant:</span> ___________________</div>
              <div><span className="font-semibold">التاريخ / Date:</span> ___/___/______</div>
            </div>
          </div>

          <CompanyFooter />
        </div>
      </div>
    </div>
  );
}

function FinalSettlementTemplate() {
  const printRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    employeeName: "",
    employeeNo: "",
    nationality: "",
    position: "",
    department: "",
    section: "",
    joiningDate: "",
    endDate: format(new Date(), "yyyy-MM-dd"),
    endReason: "",
    totalAmount: "",
    totalAmountWords: "",
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "مخالصة نهائية",
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>اسم الموظف / Name</Label>
          <Input value={formData.employeeName} onChange={(e) => setFormData({...formData, employeeName: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>رقم الموظف / No</Label>
          <Input value={formData.employeeNo} onChange={(e) => setFormData({...formData, employeeNo: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الجنسية / Nationality</Label>
          <Input value={formData.nationality} onChange={(e) => setFormData({...formData, nationality: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الوظيفة / Job Title</Label>
          <Input value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الإدارة / Department</Label>
          <Input value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>القسم / Section</Label>
          <Input value={formData.section} onChange={(e) => setFormData({...formData, section: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>تاريخ التعيين / Joining Date</Label>
          <Input type="date" value={formData.joiningDate} onChange={(e) => setFormData({...formData, joiningDate: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>تاريخ انتهاء الخدمة / End Date</Label>
          <Input type="date" value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} />
        </div>
        <div className="space-y-2 col-span-2">
          <Label>سبب انتهاء العلاقة مع الشركة / Termination Reason</Label>
          <Input value={formData.endReason} onChange={(e) => setFormData({...formData, endReason: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>مبلغ المخالصة (ريال) / Settlement Amount (SAR)</Label>
          <Input type="number" value={formData.totalAmount} onChange={(e) => setFormData({...formData, totalAmount: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>المبلغ كتابة / Amount in Words</Label>
          <Input value={formData.totalAmountWords} onChange={(e) => setFormData({...formData, totalAmountWords: e.target.value})} placeholder="فقط ... ريال لا غير / Only ... SAR" />
        </div>
      </div>

      <Button onClick={() => handlePrint()} className="w-full gap-2 bg-green-600 hover:bg-green-700">
        <Printer className="h-4 w-4" /> طباعة النموذج / Print
      </Button>

      <div className="hidden">
        <div ref={printRef} className="p-4 bg-white print:block text-sm" dir="rtl">
          <CompanyHeader templateTitle="نموذج مخالصة نهائية" templateTitleEn="Final Settlement" />
          
          <div className="border border-slate-300 rounded p-2 mb-2">
            <h3 className="font-bold text-slate-700 mb-1 border-b pb-1 text-xs">1. بيانات الموظف / Employee Data</h3>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div><span className="font-semibold">الاسم / Name:</span> {formData.employeeName}</div>
              <div><span className="font-semibold">الجنسية / Nationality:</span> {formData.nationality}</div>
              <div><span className="font-semibold">الرقم / No:</span> {formData.employeeNo}</div>
              <div><span className="font-semibold">الوظيفة / Job Title:</span> {formData.position}</div>
              <div><span className="font-semibold">الإدارة / Dept:</span> {formData.department}</div>
              <div><span className="font-semibold">القسم / Section:</span> {formData.section}</div>
              <div><span className="font-semibold">تاريخ التعيين / Joining Date:</span> {formData.joiningDate}</div>
              <div><span className="font-semibold">تاريخ انتهاء الخدمة / End Date:</span> {formData.endDate}</div>
              <div className="col-span-2"><span className="font-semibold">سبب انتهاء العلاقة / Termination Reason:</span> {formData.endReason}</div>
            </div>
          </div>

          <div className="border border-slate-300 rounded p-2">
            <h3 className="font-bold text-slate-700 mb-1 border-b pb-1 text-xs">2. إقرار الموظف / Employee Affirmance</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-sm leading-relaxed">
                <p>بهذا أقر أنا الموقع أدناه بأنني قد تسلمت مبلغ المخالصة النهائية بقيمة:</p>
                <p className="font-bold text-lg my-2">({formData.totalAmountWords}) ريال</p>
                <p className="font-bold text-lg">{formData.totalAmount} ريال</p>
                <p className="mt-2">وهذا المبلغ يشمل كافة حقوقي المترتبة مع الشركة وفقاً للوائح العامة للشركة ونظام العمل والعمال، وبهذا تعتبر هذه المخالصة النهائية مبرئة للذمة ولا يجوز المطالبة بأي شيء بعد ذلك وتكون صلتي بالشركة قد انقطعت نهائياً.</p>
              </div>
              <div className="text-sm leading-relaxed" dir="ltr">
                <p>I, the undersigned hereby declare that I have received the amounts below at termination of my contract with the Company:</p>
                <p className="font-bold text-lg my-2">Total: (Only S.R {formData.totalAmount})</p>
                <p className="mt-2">The amount comprises all accrued entitlements due to me at termination of my contract pursuant to company regulations and the labor and workmen law.</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-1 text-xs border-t pt-4">
              <div>
                <p><span className="font-semibold">اسم الموظف:</span> {formData.employeeName}</p>
                <p className="mt-2"><span className="font-semibold">التوقيع:</span> ___________________</p>
                <p className="mt-2"><span className="font-semibold">التاريخ:</span> ___/___/______</p>
              </div>
              <div dir="ltr">
                <p><span className="font-semibold">Name:</span> {formData.employeeName}</p>
                <p className="mt-2"><span className="font-semibold">Signature:</span> ___________________</p>
                <p className="mt-2"><span className="font-semibold">Date:</span> ___/___/______</p>
              </div>
            </div>
          </div>

          <CompanyFooter />
        </div>
      </div>
    </div>
  );
}

function PaymentOrderTemplate() {
  const printRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    beneficiaryName: "",
    amount: "",
    amountWords: "",
    purpose: "supplier_payment",
    customPurpose: "",
    paymentMethod: "transfer",
    departmentManager: "",
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "أمر صرف",
  });

  const purposes = [
    { value: "supplier_payment", label: "سداد دفعة من الحساب / موردين", labelEn: "Supplier Payment" },
    { value: "advance_payment", label: "دفعات مقدمة / موردين", labelEn: "Advance Payment" },
    { value: "fixed_assets", label: "دفعات لشراء أصول ثابتة", labelEn: "Fixed Assets Purchase" },
    { value: "housing", label: "بدل سكن / إيجارات", labelEn: "Housing Allowance / Rent" },
    { value: "other", label: "أخرى", labelEn: "Other" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>التاريخ / Date</Label>
          <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>اسم المستفيد / Beneficiary Name</Label>
          <Input value={formData.beneficiaryName} onChange={(e) => setFormData({...formData, beneficiaryName: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>المبلغ (ريال) / Amount (SAR)</Label>
          <Input type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>المبلغ كتابة / Amount in Words</Label>
          <Input value={formData.amountWords} onChange={(e) => setFormData({...formData, amountWords: e.target.value})} />
        </div>
        <div className="space-y-2 col-span-2">
          <Label>الغرض من الصرف / Payment Purpose</Label>
          <Select value={formData.purpose} onValueChange={(value) => setFormData({...formData, purpose: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {purposes.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {formData.purpose === "other" && (
          <div className="space-y-2 col-span-2">
            <Label>تحديد الغرض / Specify Purpose</Label>
            <Input value={formData.customPurpose} onChange={(e) => setFormData({...formData, customPurpose: e.target.value})} />
          </div>
        )}
        <div className="space-y-2">
          <Label>طريقة الدفع / Payment Method</Label>
          <Select value={formData.paymentMethod} onValueChange={(value) => setFormData({...formData, paymentMethod: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">نقدي / Cash</SelectItem>
              <SelectItem value="check">شيك / Cheque</SelectItem>
              <SelectItem value="transfer">تحويل بنكي / Bank Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>مدير الإدارة الطالبة / Requesting Dept. Manager</Label>
          <Input value={formData.departmentManager} onChange={(e) => setFormData({...formData, departmentManager: e.target.value})} />
        </div>
      </div>

      <Button onClick={() => handlePrint()} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
        <Printer className="h-4 w-4" /> طباعة النموذج / Print
      </Button>

      <div className="hidden">
        <div ref={printRef} className="p-4 bg-white print:block text-sm" dir="rtl">
          <CompanyHeader templateTitle="نموذج أمر صرف / دفع" templateTitleEn="Payment Order" />
          <div className="text-center mb-4">
            <p className="text-sm text-slate-600">التاريخ / Date: {formData.date}</p>
          </div>

          <div className="mb-4">
            <p className="font-semibold">السيد المدير التنفيذي المحترم / Dear CEO</p>
            <p>تحية طيبة وبعد... / Greetings</p>
          </div>

          <div className="border border-slate-300 rounded p-2 mb-2">
            <p className="mb-3">الرجاء الموافقة على تحويل / صرف لأمر السيد / Please approve transfer/payment to: <span className="font-bold">{formData.beneficiaryName}</span></p>
            <p className="text-lg font-bold">المبلغ / Amount: ({formData.amount}) ريال SAR - ({formData.amountWords})</p>
            
            <div className="mt-4 space-y-2">
              <p className="font-semibold">وذلك عن / Purpose:</p>
              {purposes.map((p) => (
                <div key={p.value} className="flex items-center gap-2">
                  <span className={`w-4 h-4 border ${formData.purpose === p.value ? 'bg-slate-800' : ''}`}></span>
                  <span>{p.label} / {p.labelEn}</span>
                  {p.value === "other" && formData.purpose === "other" && <span>: {formData.customPurpose}</span>}
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t">
              <p className="font-semibold mb-2">طريقة الدفع / Payment Method:</p>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <span className={`w-4 h-4 border ${formData.paymentMethod === 'cash' ? 'bg-slate-800' : ''}`}></span>
                  نقدي / Cash
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-4 h-4 border ${formData.paymentMethod === 'check' ? 'bg-slate-800' : ''}`}></span>
                  شيك / Cheque
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-4 h-4 border ${formData.paymentMethod === 'transfer' ? 'bg-slate-800' : ''}`}></span>
                  تحويل بنكي / Bank Transfer
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="border rounded p-1.5">
              <p className="font-semibold text-xs">مدير الإدارة / Dept Manager</p>
              <p className="text-xs">{formData.departmentManager}</p>
              <p className="mt-1 text-xs">____________</p>
            </div>
            <div className="border rounded p-1.5">
              <p className="font-semibold text-xs">المالية / Finance</p>
              <p className="mt-2 text-xs">____________</p>
            </div>
            <div className="border rounded p-1.5">
              <p className="font-semibold text-xs">المدير التنفيذي / CEO</p>
              <p className="mt-2 text-xs">____________</p>
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-600">
            <p className="font-semibold">المرفقات المطلوبة / Required Attachments:</p>
            <ul className="list-disc mr-4 mt-1">
              <li>صورة من رقم أيبان المستفيد / Copy of beneficiary IBAN</li>
              <li>صورة من الفاتورة أو العقد أو بيان تفصيلي بالسداد / Copy of invoice, contract, or payment details</li>
              <li>صورة من عقد الإيجار أو السكن (إن وجد) / Copy of rent/housing contract (if applicable)</li>
            </ul>
          </div>

          <CompanyFooter />
        </div>
      </div>
    </div>
  );
}

function ClearanceTemplate() {
  const printRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    employeeName: "",
    employeeNo: "",
    nationality: "",
    position: "",
    department: "",
    section: "",
    clearanceReason: "exit",
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "إخلاء طرف",
  });

  const departments = [
    { name: "المدير المباشر", nameEn: "Direct Manager" },
    { name: "تقنية المعلومات", nameEn: "IT Department" },
    { name: "الحركة", nameEn: "Movement" },
    { name: "المالية", nameEn: "Financial" },
    { name: "الموارد البشرية", nameEn: "HR Department" },
    { name: "مدير الإدارة", nameEn: "Department Manager" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>اسم الموظف / Name</Label>
          <Input value={formData.employeeName} onChange={(e) => setFormData({...formData, employeeName: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>رقم الموظف / No</Label>
          <Input value={formData.employeeNo} onChange={(e) => setFormData({...formData, employeeNo: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الجنسية / Nationality</Label>
          <Input value={formData.nationality} onChange={(e) => setFormData({...formData, nationality: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الوظيفة / Title</Label>
          <Input value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الإدارة / Location</Label>
          <Input value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>القسم / Section</Label>
          <Input value={formData.section} onChange={(e) => setFormData({...formData, section: e.target.value})} />
        </div>
        <div className="space-y-2 col-span-2">
          <Label>سبب إخلاء الطرف / Clearance Reason</Label>
          <Select value={formData.clearanceReason} onValueChange={(value) => setFormData({...formData, clearanceReason: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vacation">إجازة / Vacation</SelectItem>
              <SelectItem value="exit">نهاية خدمة / Exit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={() => handlePrint()} className="w-full gap-2 bg-slate-600 hover:bg-slate-700">
        <Printer className="h-4 w-4" /> طباعة النموذج / Print
      </Button>

      <div className="hidden">
        <div ref={printRef} className="p-4 bg-white print:block text-sm" dir="rtl">
          <CompanyHeader templateTitle="إخلاء طرف" templateTitleEn="Clearance Form" />

          <div className="border border-slate-300 rounded p-2 mb-2">
            <h3 className="font-bold text-slate-700 mb-1 border-b pb-1 text-xs">1. بيانات الموظف / Employee Data</h3>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div><span className="font-semibold">الاسم / Name:</span> {formData.employeeName}</div>
              <div><span className="font-semibold">رقم الموظف / No:</span> {formData.employeeNo}</div>
              <div><span className="font-semibold">الجنسية / Nationality:</span> {formData.nationality}</div>
              <div><span className="font-semibold">الوظيفة / Title:</span> {formData.position}</div>
              <div><span className="font-semibold">الإدارة / Location:</span> {formData.department}</div>
              <div><span className="font-semibold">القسم / Section:</span> {formData.section}</div>
            </div>
            <div className="mt-3 flex gap-6">
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 border ${formData.clearanceReason === 'vacation' ? 'bg-slate-800' : ''}`}></span>
                إجازة / Vacation
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 border ${formData.clearanceReason === 'exit' ? 'bg-slate-800' : ''}`}></span>
                نهاية خدمة / Exit
              </div>
            </div>
          </div>

          <div className="border border-slate-300 rounded p-2">
            <h3 className="font-bold text-slate-700 mb-1 border-b pb-1 text-xs">2. الجهات ذات العلاقة / Related Departments</h3>
            <div className="space-y-4">
              {departments.map((dept, index) => (
                <div key={index} className="border-b pb-3 last:border-b-0">
                  <p className="font-semibold text-sm">{dept.name} / {dept.nameEn}</p>
                  <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                    <div><span className="font-semibold">الاسم / Name:</span> ___________________</div>
                    <div><span className="font-semibold">التوقيع / Signature:</span> ___________________</div>
                  </div>
                  <div className="flex gap-6 mt-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 border"></span>
                      يخلى طرفه / Clear
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 border"></span>
                      لا يخلى طرفه / Not Clear
                    </div>
                    <div>السبب / Reason: ___________________</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <CompanyFooter />
        </div>
      </div>
    </div>
  );
}

function PenaltyTemplate() {
  const printRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    employeeName: "",
    employeeNo: "",
    department: "",
    section: "",
    position: "",
    violation: "",
    penaltyType: "warning",
    suspensionDays: "",
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "إجراء جزائي",
  });

  const penalties = [
    { value: "attention", label: "لفت نظر", labelEn: "Draw Attention" },
    { value: "warning", label: "إنذار أول", labelEn: "Warning Letter" },
    { value: "deduction", label: "عقوبة خصم", labelEn: "Deduction" },
    { value: "final_warning", label: "إنذار نهائي بالفصل", labelEn: "Written Warning by Fired" },
    { value: "suspension", label: "إيقاف عن العمل", labelEn: "Stopping Work" },
    { value: "no_increase", label: "الحرمان من الزيادة السنوية", labelEn: "Stopping Yearly Increase" },
    { value: "fire_with_compensation", label: "فصل من الخدمة مع التعويض", labelEn: "Firing With Compensation" },
    { value: "fire_without_compensation", label: "فصل من الخدمة بدون تعويض", labelEn: "Firing Without Compensation" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>اسم الموظف / Name</Label>
          <Input value={formData.employeeName} onChange={(e) => setFormData({...formData, employeeName: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>رقم الموظف / No</Label>
          <Input value={formData.employeeNo} onChange={(e) => setFormData({...formData, employeeNo: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الإدارة / Location</Label>
          <Input value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>القسم / Section</Label>
          <Input value={formData.section} onChange={(e) => setFormData({...formData, section: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الوظيفة / Job Title</Label>
          <Input value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>نوع الإجراء الجزائي / Penalty Type</Label>
          <Select value={formData.penaltyType} onValueChange={(value) => setFormData({...formData, penaltyType: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {penalties.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {formData.penaltyType === "suspension" && (
          <div className="space-y-2">
            <Label>عدد أيام الإيقاف / Suspension Days</Label>
            <Input type="number" value={formData.suspensionDays} onChange={(e) => setFormData({...formData, suspensionDays: e.target.value})} />
          </div>
        )}
        <div className="space-y-2 col-span-2">
          <Label>المخالفة / Violation</Label>
          <Textarea value={formData.violation} onChange={(e) => setFormData({...formData, violation: e.target.value})} rows={3} />
        </div>
      </div>

      <Button onClick={() => handlePrint()} className="w-full gap-2 bg-red-600 hover:bg-red-700">
        <Printer className="h-4 w-4" /> طباعة النموذج / Print
      </Button>

      <div className="hidden">
        <div ref={printRef} className="p-4 bg-white print:block text-sm" dir="rtl">
          <CompanyHeader templateTitle="إجراء جزائي" templateTitleEn="Penalty Procedure" />

          <div className="border border-slate-300 rounded p-2 mb-2">
            <h3 className="font-bold text-slate-700 mb-1 border-b pb-1 text-xs">1. بيانات الموظف / Employee Data</h3>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div><span className="font-semibold">الاسم / Name:</span> {formData.employeeName}</div>
              <div><span className="font-semibold">الرقم / No:</span> {formData.employeeNo}</div>
              <div><span className="font-semibold">الإدارة / Location:</span> {formData.department}</div>
              <div><span className="font-semibold">القسم / Section:</span> {formData.section}</div>
              <div><span className="font-semibold">مسمى الوظيفة / Job Title:</span> {formData.position}</div>
            </div>
            <div className="mt-3">
              <span className="font-semibold">المخالفة / Violation:</span>
              <p className="mt-1 p-2 bg-slate-50 rounded">{formData.violation}</p>
            </div>
          </div>

          <div className="border border-slate-300 rounded p-2 mb-2">
            <h3 className="font-bold text-slate-700 mb-1 border-b pb-1 text-xs">2. الإجراء الجزائي / Penalty Action</h3>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {penalties.map((p) => (
                <div key={p.value} className="flex items-center gap-2">
                  <span className={`w-4 h-4 border ${formData.penaltyType === p.value ? 'bg-slate-800' : ''}`}></span>
                  <span>{p.label} / {p.labelEn}</span>
                  {p.value === "suspension" && formData.penaltyType === "suspension" && (
                    <span className="font-bold">({formData.suspensionDays} يوم)</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="border rounded p-1.5">
              <p className="font-semibold text-xs">الموظف / Employee</p>
              <p className="mt-1">التوقيع: ____________  التاريخ: ___/___/___</p>
            </div>
            <div className="border rounded p-1.5">
              <p className="font-semibold text-xs">الموارد البشرية / HR</p>
              <p className="mt-1">التوقيع: ____________  التاريخ: ___/___/___</p>
            </div>
          </div>

          <CompanyFooter />
        </div>
      </div>
    </div>
  );
}

function AssetHandoverTemplate() {
  const printRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    employeeName: "",
    position: "",
    date: format(new Date(), "yyyy-MM-dd"),
    assets: [
      { description: "", quantity: "", condition: "", remarks: "" },
      { description: "", quantity: "", condition: "", remarks: "" },
      { description: "", quantity: "", condition: "", remarks: "" },
      { description: "", quantity: "", condition: "", remarks: "" },
      { description: "", quantity: "", condition: "", remarks: "" },
    ],
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "تسليم عهدة",
  });

  const updateAsset = (index: number, field: string, value: string) => {
    const newAssets = [...formData.assets];
    newAssets[index] = { ...newAssets[index], [field]: value };
    setFormData({ ...formData, assets: newAssets });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>اسم الموظف / Name</Label>
          <Input value={formData.employeeName} onChange={(e) => setFormData({...formData, employeeName: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الوظيفة / Position</Label>
          <Input value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>التاريخ / Date</Label>
          <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-semibold mb-3">العهدة / Assets</h4>
        <div className="space-y-3">
          {formData.assets.map((asset, index) => (
            <div key={index} className="grid grid-cols-4 gap-2">
              <Input placeholder="بيان العهدة / Description" value={asset.description} onChange={(e) => updateAsset(index, "description", e.target.value)} />
              <Input placeholder="العدد / Qty" value={asset.quantity} onChange={(e) => updateAsset(index, "quantity", e.target.value)} />
              <Input placeholder="الحالة / Condition" value={asset.condition} onChange={(e) => updateAsset(index, "condition", e.target.value)} />
              <Input placeholder="ملاحظات / Remarks" value={asset.remarks} onChange={(e) => updateAsset(index, "remarks", e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      <Button onClick={() => handlePrint()} className="w-full gap-2 bg-orange-600 hover:bg-orange-700">
        <Printer className="h-4 w-4" /> طباعة النموذج / Print
      </Button>

      <div className="hidden">
        <div ref={printRef} className="p-4 bg-white print:block text-sm" dir="rtl">
          <CompanyHeader templateTitle="نموذج تسليم عهدة" templateTitleEn="Asset Handover Form" />

          <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
            <div><span className="font-semibold">الاسم / Name:</span> {formData.employeeName}</div>
            <div><span className="font-semibold">الوظيفة / Position:</span> {formData.position}</div>
            <div><span className="font-semibold">التاريخ / Date:</span> {formData.date}</div>
          </div>

          <table className="w-full border-collapse border text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="border p-2 w-12">م</th>
                <th className="border p-2">بيان العهدة / Description</th>
                <th className="border p-2 w-20">العدد / No</th>
                <th className="border p-2 w-24">الحالة / Condition</th>
                <th className="border p-2">ملاحظات / Remarks</th>
              </tr>
            </thead>
            <tbody>
              {formData.assets.map((asset, index) => (
                <tr key={index}>
                  <td className="border p-2 text-center">{index + 1}</td>
                  <td className="border p-2">{asset.description}</td>
                  <td className="border p-2 text-center">{asset.quantity}</td>
                  <td className="border p-2 text-center">{asset.condition}</td>
                  <td className="border p-2">{asset.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="border rounded p-1.5">
              <p className="font-semibold text-xs">المستلم / Received By</p>
              <p className="text-xs">الاسم: __________ التوقيع: __________ التاريخ: ___/___/___</p>
            </div>
            <div className="border rounded p-1.5">
              <p className="font-semibold text-xs">المسلم / Delivered By</p>
              <p className="text-xs">الاسم: __________ التوقيع: __________ التاريخ: ___/___/___</p>
            </div>
          </div>

          <CompanyFooter />
        </div>
      </div>
    </div>
  );
}

function EmployeeStatusChangeTemplate() {
  const printRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    employeeName: "",
    employeeNo: "",
    department: "",
    hireDate: "",
    currentSalary: "",
    location: "",
    fromPosition: "",
    toPosition: "",
    fromLocation: "",
    toLocation: "",
    fromDepartment: "",
    toDepartment: "",
    fromSalary: "",
    toSalary: "",
    effectiveDate: format(new Date(), "yyyy-MM-dd"),
    reason: "",
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "طلب تعديل حالة موظف",
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>التاريخ / Date</Label>
          <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>اسم الموظف / Employee Name</Label>
          <Input value={formData.employeeName} onChange={(e) => setFormData({...formData, employeeName: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>رقم الموظف / Employee No</Label>
          <Input value={formData.employeeNo} onChange={(e) => setFormData({...formData, employeeNo: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الإدارة/القسم الحالي / Current Dept/Section</Label>
          <Input value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>تاريخ التعيين / Date of Hire</Label>
          <Input type="date" value={formData.hireDate} onChange={(e) => setFormData({...formData, hireDate: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الراتب الأساسي الحالي / Current Basic Salary</Label>
          <Input value={formData.currentSalary} onChange={(e) => setFormData({...formData, currentSalary: e.target.value})} />
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-semibold mb-3">تفاصيل التعديل / Change Details</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <h5 className="font-medium text-slate-600">من (الحالي) / From (Current)</h5>
            <Input placeholder="الوظيفة / Position" value={formData.fromPosition} onChange={(e) => setFormData({...formData, fromPosition: e.target.value})} />
            <Input placeholder="الموقع / Location" value={formData.fromLocation} onChange={(e) => setFormData({...formData, fromLocation: e.target.value})} />
            <Input placeholder="الإدارة/القسم / Dept" value={formData.fromDepartment} onChange={(e) => setFormData({...formData, fromDepartment: e.target.value})} />
            <Input placeholder="الأجر / Salary" value={formData.fromSalary} onChange={(e) => setFormData({...formData, fromSalary: e.target.value})} />
          </div>
          <div className="space-y-3">
            <h5 className="font-medium text-slate-600">إلى (الجديد) / To (New)</h5>
            <Input placeholder="الوظيفة / Position" value={formData.toPosition} onChange={(e) => setFormData({...formData, toPosition: e.target.value})} />
            <Input placeholder="الموقع / Location" value={formData.toLocation} onChange={(e) => setFormData({...formData, toLocation: e.target.value})} />
            <Input placeholder="الإدارة/القسم / Dept" value={formData.toDepartment} onChange={(e) => setFormData({...formData, toDepartment: e.target.value})} />
            <Input placeholder="الأجر / Salary" value={formData.toSalary} onChange={(e) => setFormData({...formData, toSalary: e.target.value})} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>وذلك من تاريخ / Effective Date</Label>
          <Input type="date" value={formData.effectiveDate} onChange={(e) => setFormData({...formData, effectiveDate: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>سبب تقديم الطلب / Reason</Label>
          <Input value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} />
        </div>
      </div>

      <Button onClick={() => handlePrint()} className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700">
        <Printer className="h-4 w-4" /> طباعة النموذج / Print
      </Button>

      <div className="hidden">
        <div ref={printRef} className="p-4 bg-white print:block text-sm" dir="rtl">
          <CompanyHeader templateTitle="طلب تعديل حالة موظف" templateTitleEn="Employee Status Change Request" />
          <div className="text-center mb-4">
            <p className="text-sm text-slate-600">التاريخ / Date: {formData.date}</p>
          </div>

          <div className="mb-4">
            <p className="font-semibold">إلى: سعادة المدير التنفيذي المحترم / To: CEO</p>
          </div>

          <div className="border border-slate-300 rounded p-2 mb-2">
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div><span className="font-semibold">اسم الموظف / Employee Name:</span> {formData.employeeName}</div>
              <div><span className="font-semibold">رقم الموظف / Employee No:</span> {formData.employeeNo}</div>
              <div><span className="font-semibold">الإدارة/القسم / Dept/Section:</span> {formData.department}</div>
              <div><span className="font-semibold">تاريخ التعيين / Date of Hire:</span> {formData.hireDate}</div>
              <div><span className="font-semibold">الراتب الأساسي الحالي / Current Basic Salary:</span> {formData.currentSalary}</div>
              <div><span className="font-semibold">الموقع / Location:</span> {formData.location}</div>
            </div>
          </div>

          <p className="mb-3 text-sm">نأمل من سعادتكم الموافقة على نقل الموظف/ة الواردة بياناته على النحو التالي: / We request your approval to transfer the employee as follows:</p>

          <table className="w-full border-collapse border text-sm mb-4">
            <thead>
              <tr className="bg-slate-100">
                <th className="border p-2"></th>
                <th className="border p-2">من (الحالي) / From</th>
                <th className="border p-2">إلى (الجديد) / To</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-2 font-semibold">الوظيفة / Position</td>
                <td className="border p-2">{formData.fromPosition}</td>
                <td className="border p-2">{formData.toPosition}</td>
              </tr>
              <tr>
                <td className="border p-2 font-semibold">الموقع / Location</td>
                <td className="border p-2">{formData.fromLocation}</td>
                <td className="border p-2">{formData.toLocation}</td>
              </tr>
              <tr>
                <td className="border p-2 font-semibold">الإدارة/القسم / Section/Dept</td>
                <td className="border p-2">{formData.fromDepartment}</td>
                <td className="border p-2">{formData.toDepartment}</td>
              </tr>
              <tr>
                <td className="border p-2 font-semibold">الأجر / Salary</td>
                <td className="border p-2">{formData.fromSalary}</td>
                <td className="border p-2">{formData.toSalary}</td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-1 text-xs mb-4">
            <div><span className="font-semibold">وذلك من تاريخ / Effective Date:</span> {formData.effectiveDate}</div>
            <div><span className="font-semibold">سبب تقديم الطلب / Reason:</span> {formData.reason}</div>
          </div>

          <div className="grid grid-cols-2 gap-1 text-xs">
            <div className="border rounded p-1.5">
              <p className="font-semibold text-xs">مدير الإدارة / Dept Manager</p>
              <p className="text-xs">الاسم: __________ القرار: __________</p>
              <p className="text-xs">التوقيع: __________</p>
            </div>
            <div className="border rounded p-1.5">
              <p className="font-semibold text-xs">الموارد البشرية / HR</p>
              <p className="text-xs">الاسم: __________ القرار: __________</p>
              <p className="text-xs">التوقيع: __________</p>
            </div>
          </div>

          <div className="mt-2 border rounded p-1.5 text-xs text-center">
            <p className="font-semibold text-xs">المدير التنفيذي / CEO</p>
            <p className="mt-1">التوقيع: __________</p>
          </div>

          <CompanyFooter />
        </div>
      </div>
    </div>
  );
}

function ProbationEvaluationTemplate() {
  const printRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    employeeName: "",
    position: "",
    department: "",
    hireDate: "",
    supervisorName: "",
    evaluationDate: format(new Date(), "yyyy-MM-dd"),
    scores: {
      attendance: 0,
      productionQuality: 0,
      productionQuantity: 0,
      learningAbility: 0,
      workProgress: 0,
      followInstructions: 0,
      initiative: 0,
      colleagueRelations: 0,
      workOrganization: 0,
      timeUtilization: 0,
    },
    recommendation: "confirm",
    notes: "",
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "تقييم موظف تحت التجربة",
  });

  const evaluationItems = [
    { key: "attendance", label: "الحفاظ على مواعيد العمل", labelEn: "Punctuality" },
    { key: "productionQuality", label: "نوعية الإنتاج", labelEn: "Quality of Work" },
    { key: "productionQuantity", label: "كمية الإنتاج", labelEn: "Quantity of Work" },
    { key: "learningAbility", label: "القدرة على التعلم", labelEn: "Learning Ability" },
    { key: "workProgress", label: "التقدم في العمل", labelEn: "Work Progress" },
    { key: "followInstructions", label: "الالتزام بتعليمات المسؤول المباشر", labelEn: "Following Instructions" },
    { key: "initiative", label: "المبادرة وسرعة البديهة", labelEn: "Initiative" },
    { key: "colleagueRelations", label: "العلاقة مع الزملاء", labelEn: "Colleague Relations" },
    { key: "workOrganization", label: "القدرة على تنظيم العمل", labelEn: "Work Organization" },
    { key: "timeUtilization", label: "الإفادة من وقت العمل", labelEn: "Time Utilization" },
  ];

  const totalScore = Object.values(formData.scores).reduce((a, b) => a + b, 0);

  const getGrade = (score: number) => {
    if (score >= 90) return "ممتاز / Excellent";
    if (score >= 80) return "جيد جداً / Very Good";
    if (score >= 70) return "جيد / Good";
    if (score >= 60) return "متوسط / Average";
    return "ضعيف / Poor";
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>اسم الموظف / Employee Name</Label>
          <Input value={formData.employeeName} onChange={(e) => setFormData({...formData, employeeName: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الوظيفة / Position</Label>
          <Input value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الإدارة / Department</Label>
          <Input value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>تاريخ التعيين / Hire Date</Label>
          <Input type="date" value={formData.hireDate} onChange={(e) => setFormData({...formData, hireDate: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>اسم المسؤول المباشر / Supervisor Name</Label>
          <Input value={formData.supervisorName} onChange={(e) => setFormData({...formData, supervisorName: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>تاريخ التقييم / Evaluation Date</Label>
          <Input type="date" value={formData.evaluationDate} onChange={(e) => setFormData({...formData, evaluationDate: e.target.value})} />
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-semibold mb-3">عناصر التقويم (من 10) / Evaluation Items (out of 10)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {evaluationItems.map((item) => (
            <div key={item.key} className="flex items-center gap-3">
              <Label className="flex-1">{item.label} / {item.labelEn}</Label>
              <Select 
                value={String(formData.scores[item.key as keyof typeof formData.scores])} 
                onValueChange={(value) => setFormData({
                  ...formData, 
                  scores: {...formData.scores, [item.key]: Number(value)}
                })}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 2, 4, 6, 8, 10].map((score) => (
                    <SelectItem key={score} value={String(score)}>{score}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-slate-100 rounded flex justify-between items-center">
          <span className="font-semibold">المجموع / Total: {totalScore} / 100</span>
          <Badge className={totalScore >= 70 ? "bg-green-600" : totalScore >= 60 ? "bg-amber-600" : "bg-red-600"}>
            {getGrade(totalScore)}
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        <Label>توصية المسؤول المباشر / Supervisor Recommendation</Label>
        <Select value={formData.recommendation} onValueChange={(value) => setFormData({...formData, recommendation: value})}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="confirm">تثبيت / Confirm</SelectItem>
            <SelectItem value="extend">تمديد فترة التجربة / Extend Probation</SelectItem>
            <SelectItem value="terminate">الاستغناء عن الخدمة / Terminate</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>ملاحظات / Remarks</Label>
        <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3} />
      </div>

      <Button onClick={() => handlePrint()} className="w-full gap-2 bg-teal-600 hover:bg-teal-700">
        <Printer className="h-4 w-4" /> طباعة النموذج
      </Button>

      <div className="hidden">
        <div ref={printRef} className="p-4 bg-white print:block text-sm" dir="rtl">
          <CompanyHeader templateTitle="نموذج تقييم أداء لموظفين تحت التجربة" templateTitleEn="Probation Period Performance Evaluation" />

          <div className="grid grid-cols-2 gap-1 text-xs mb-4">
            <div><span className="font-semibold">اسم الموظف / Employee Name:</span> {formData.employeeName}</div>
            <div><span className="font-semibold">الوظيفة / Position:</span> {formData.position}</div>
            <div><span className="font-semibold">الإدارة / Department:</span> {formData.department}</div>
            <div><span className="font-semibold">تاريخ التعيين / Date of Hire:</span> {formData.hireDate}</div>
            <div><span className="font-semibold">اسم المسؤول المباشر / Supervisor Name:</span> {formData.supervisorName}</div>
            <div><span className="font-semibold">تاريخ تقييم الأداء / Evaluation Date:</span> {formData.evaluationDate}</div>
          </div>

          <table className="w-full border-collapse border text-sm mb-4">
            <thead>
              <tr className="bg-slate-100">
                <th className="border p-2">No.</th>
                <th className="border p-2">عناصر التقويم / Evaluation Criteria</th>
                <th className="border p-2">ممتاز<br/>Excellent (10)</th>
                <th className="border p-2">جيد جداً<br/>V.Good (8)</th>
                <th className="border p-2">جيد<br/>Good (6)</th>
                <th className="border p-2">متوسط<br/>Average (4)</th>
                <th className="border p-2">ضعيف<br/>Poor (2)</th>
              </tr>
            </thead>
            <tbody>
              {evaluationItems.map((item, index) => {
                const score = formData.scores[item.key as keyof typeof formData.scores];
                return (
                  <tr key={item.key}>
                    <td className="border p-2 text-center">{index + 1}</td>
                    <td className="border p-2">{item.label}<br/><span className="text-xs text-slate-500">{item.labelEn}</span></td>
                    <td className="border p-2 text-center">{score === 10 ? "✓" : ""}</td>
                    <td className="border p-2 text-center">{score === 8 ? "✓" : ""}</td>
                    <td className="border p-2 text-center">{score === 6 ? "✓" : ""}</td>
                    <td className="border p-2 text-center">{score === 4 ? "✓" : ""}</td>
                    <td className="border p-2 text-center">{score === 2 ? "✓" : ""}</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50 font-semibold">
                <td className="border p-2" colSpan={2}>المجموع / Total</td>
                <td className="border p-2 text-center" colSpan={5}>{totalScore} / 100 - {getGrade(totalScore)}</td>
              </tr>
            </tbody>
          </table>

          <div className="border rounded p-3 mb-4">
            <p className="font-semibold mb-2">توصية المسؤول المباشر / Supervisor Recommendation:</p>
            <div className="flex gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 border ${formData.recommendation === 'confirm' ? 'bg-slate-800' : ''}`}></span>
                تثبيت / Confirm
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 border ${formData.recommendation === 'extend' ? 'bg-slate-800' : ''}`}></span>
                تمديد فترة التجربة / Extend Probation
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 border ${formData.recommendation === 'terminate' ? 'bg-slate-800' : ''}`}></span>
                الاستغناء عن الخدمة / Terminate
              </div>
            </div>
            {formData.notes && (
              <div className="mt-2">
                <p className="font-semibold">ملاحظات / Notes:</p>
                <p>{formData.notes}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="border rounded p-1.5">
              <p className="font-semibold text-xs">المسؤول المباشر / Supervisor</p>
              <p className="text-xs">التوقيع: __________ التاريخ: ___/___/___</p>
            </div>
            <div className="border rounded p-1.5">
              <p className="font-semibold text-xs">الموظف / Employee</p>
              <p className="text-xs">التوقيع: __________ التاريخ: ___/___/___</p>
            </div>
          </div>

          <div className="mt-2 border rounded p-1.5 text-xs">
            <p className="font-semibold text-xs">قرار الموارد البشرية / HR Decision:</p>
            <div className="flex gap-4 mt-1 flex-wrap text-xs">
              <span>□ تثبيت</span>
              <span>□ تمديد</span>
              <span>□ إنهاء</span>
            </div>
            <p className="mt-1 text-xs">التوقيع: __________  التاريخ: ___/___/___</p>
          </div>

          <CompanyFooter />
        </div>
      </div>
    </div>
  );
}

function JobOfferTemplate() {
  const printRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    employeeName: "",
    nationality: "",
    idNumber: "",
    idPlace: "",
    idExpiry: "",
    phone: "",
    qualification: "",
    position: "",
    branch: "",
    basicSalary: "",
    housingAllowance: "",
    transportAllowance: "",
    otherAllowances: "",
    contractDuration: "1",
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "عرض العمل",
  });

  const totalSalary = Number(formData.basicSalary || 0) + Number(formData.housingAllowance || 0) + Number(formData.transportAllowance || 0) + Number(formData.otherAllowances || 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>التاريخ / Date</Label>
          <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الاسم الكامل / Full Name</Label>
          <Input value={formData.employeeName} onChange={(e) => setFormData({...formData, employeeName: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الجنسية / Nationality</Label>
          <Input value={formData.nationality} onChange={(e) => setFormData({...formData, nationality: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>رقم الهوية/الإقامة / ID/Iqama No</Label>
          <Input value={formData.idNumber} onChange={(e) => setFormData({...formData, idNumber: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>مكان الإصدار / Issue Place</Label>
          <Input value={formData.idPlace} onChange={(e) => setFormData({...formData, idPlace: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>تاريخ الانتهاء / Expiry Date</Label>
          <Input type="date" value={formData.idExpiry} onChange={(e) => setFormData({...formData, idExpiry: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>رقم الهاتف / Phone No</Label>
          <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>المؤهل العلمي / Qualification</Label>
          <Input value={formData.qualification} onChange={(e) => setFormData({...formData, qualification: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الوظيفة / Position</Label>
          <Input value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>الفرع / Branch</Label>
          <Input value={formData.branch} onChange={(e) => setFormData({...formData, branch: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>مدة العقد (سنوات) / Contract Duration (Years)</Label>
          <Select value={formData.contractDuration} onValueChange={(value) => setFormData({...formData, contractDuration: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">سنة واحدة / 1 Year</SelectItem>
              <SelectItem value="2">سنتان / 2 Years</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-semibold mb-3">الراتب والبدلات (شهرياً) / Salary & Allowances (Monthly)</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>الراتب الأساسي / Basic Salary</Label>
            <Input type="number" value={formData.basicSalary} onChange={(e) => setFormData({...formData, basicSalary: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>بدل السكن / Housing Allowance</Label>
            <Input type="number" value={formData.housingAllowance} onChange={(e) => setFormData({...formData, housingAllowance: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>بدل المواصلات / Transport Allowance</Label>
            <Input type="number" value={formData.transportAllowance} onChange={(e) => setFormData({...formData, transportAllowance: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>بدلات أخرى / Other Allowances</Label>
            <Input type="number" value={formData.otherAllowances} onChange={(e) => setFormData({...formData, otherAllowances: e.target.value})} />
          </div>
        </div>
        <div className="mt-3 p-3 bg-amber-50 rounded text-lg font-bold text-amber-800">
          الإجمالي / Total: {totalSalary.toLocaleString("en-US")} ريال SAR
        </div>
      </div>

      <Button onClick={() => handlePrint()} className="w-full gap-2 bg-amber-600 hover:bg-amber-700">
        <Printer className="h-4 w-4" /> طباعة النموذج / Print
      </Button>

      <div className="hidden">
        <div ref={printRef} className="p-4 bg-white print:block text-sm" dir="rtl">
          <CompanyHeader templateTitle="تفاصيل عرض العمل" templateTitleEn="Job Offer Specification" />

          <table className="w-full border-collapse border text-sm mb-4">
            <tbody>
              <tr>
                <td className="border p-2 font-semibold bg-slate-50">الاسم / Name</td>
                <td className="border p-2">{formData.employeeName}</td>
                <td className="border p-2 font-semibold bg-slate-50">الجنسية / Nationality</td>
                <td className="border p-2">{formData.nationality}</td>
                <td className="border p-2 font-semibold bg-slate-50">التاريخ / Date</td>
                <td className="border p-2">{formData.date}</td>
              </tr>
              <tr>
                <td className="border p-2 font-semibold bg-slate-50">رقم الهوية/الإقامة</td>
                <td className="border p-2">{formData.idNumber}</td>
                <td className="border p-2 font-semibold bg-slate-50">مكان الإصدار</td>
                <td className="border p-2">{formData.idPlace}</td>
                <td className="border p-2 font-semibold bg-slate-50">تاريخ الانتهاء</td>
                <td className="border p-2">{formData.idExpiry}</td>
              </tr>
              <tr>
                <td className="border p-2 font-semibold bg-slate-50">الوظيفة / Function</td>
                <td className="border p-2">{formData.position}</td>
                <td className="border p-2 font-semibold bg-slate-50">رقم الهاتف</td>
                <td className="border p-2">{formData.phone}</td>
                <td className="border p-2 font-semibold bg-slate-50">المؤهل العلمي</td>
                <td className="border p-2">{formData.qualification}</td>
              </tr>
              <tr>
                <td className="border p-2 font-semibold bg-slate-50">الإدارة</td>
                <td className="border p-2">{COMPANY_INFO.name}</td>
                <td className="border p-2 font-semibold bg-slate-50">الفرع</td>
                <td className="border p-2">{formData.branch}</td>
                <td className="border p-2 font-semibold bg-slate-50">مدة العقد</td>
                <td className="border p-2">{formData.contractDuration === "1" ? "سنة ميلادية" : "سنتين ميلاديتين"}</td>
              </tr>
            </tbody>
          </table>

          <table className="w-full border-collapse border text-sm mb-4">
            <thead>
              <tr className="bg-amber-50">
                <th className="border p-2" colSpan={2}>الراتب والعلاوات / Salary and Allowances</th>
                <th className="border p-2">شهرياً</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-2" colSpan={2}>الراتب الأساسي / Basic Salary</td>
                <td className="border p-2 text-center font-semibold">SR {Number(formData.basicSalary).toLocaleString("en-US")}</td>
              </tr>
              <tr>
                <td className="border p-2" colSpan={2}>بدل السكن / Housing Allowance</td>
                <td className="border p-2 text-center font-semibold">SR {Number(formData.housingAllowance).toLocaleString("en-US")}</td>
              </tr>
              <tr>
                <td className="border p-2" colSpan={2}>بدل المواصلات / Transport Allowance</td>
                <td className="border p-2 text-center font-semibold">SR {Number(formData.transportAllowance).toLocaleString("en-US")}</td>
              </tr>
              <tr>
                <td className="border p-2" colSpan={2}>بدلات أخرى / Other Allowances</td>
                <td className="border p-2 text-center font-semibold">SR {Number(formData.otherAllowances).toLocaleString("en-US")}</td>
              </tr>
              <tr className="bg-amber-100">
                <td className="border p-2 font-bold" colSpan={2}>الإجمالي / Total</td>
                <td className="border p-2 text-center font-bold text-lg">SR {totalSalary.toLocaleString("en-US")}</td>
              </tr>
            </tbody>
          </table>

          <div className="border rounded p-3 text-xs mb-4">
            <h4 className="font-semibold mb-2">مميزات وشروط أخرى / Other Benefits & Conditions:</h4>
            <ul className="space-y-1">
              <li>• الإجازة السنوية فقط (21) يوماً مدفوعة الأجر عن كل سنة ميلادية خدمة. / Annual leave: 21 paid days per year.</li>
              <li>• تذاكر سفر للموظف الأجنبي (حسب نظام الشركة). / Travel tickets for foreign employees (per company policy).</li>
              <li>• العلاج: يتم إدراج الموظف في قائمة التأمين الطبي للشركة. / Medical: Employee included in company medical insurance.</li>
              <li>• فترة التجربة: (180) يوماً حسب نظام العمل والعمال السعودي. / Probation: 180 days per Saudi Labor Law.</li>
              <li>• يعتبر هذا العرض لاغياً في حالة عدم مباشرة العمل في التاريخ المحدد. / Offer void if not joined on specified date.</li>
              <li>• يحق للشركة نقل الموظف لأي فرع حسب حاجة العمل. / Company may transfer employee as needed.</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
            <div className="border rounded p-1.5 text-center">
              <p className="font-semibold text-xs">الموارد البشرية / HR</p>
              <p className="mt-1">____________</p>
            </div>
            <div className="border rounded p-1.5 text-center">
              <p className="font-semibold text-xs">المدير التنفيذي / CEO</p>
              <p className="mt-1">____________</p>
            </div>
          </div>

          <div className="border rounded p-3 text-sm">
            <p>أوافق على ما جاء في تفاصيل هذا العرض، وأؤكد بأنني على استعداد لمباشرة العمل والالتزام بالبنود المدونة أعلاه.</p>
            <p className="text-xs text-slate-500 mt-1">I agree to the above job offer details and confirm my readiness to start work.</p>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div><span className="font-semibold">الاسم / Name:</span> ___________________</div>
              <div><span className="font-semibold">التوقيع / Signature:</span> ___________________</div>
              <div><span className="font-semibold">التاريخ / Date:</span> ___________________</div>
            </div>
          </div>

          <CompanyFooter />
        </div>
      </div>
    </div>
  );
}

function EmploymentApplicationTemplate() {
  const printRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    positionApplied: "",
    firstName: "",
    fatherName: "",
    grandFatherName: "",
    familyName: "",
    dob: "",
    birthPlace: "",
    nationality: "",
    religion: "",
    idNumber: "",
    idPlace: "",
    idExpiry: "",
    passportNumber: "",
    homePhone: "",
    mobile: "",
    email: "",
    address: "",
    maritalStatus: "single",
    hasDependents: false,
    hasDiseases: false,
    workedBefore: false,
    currentlyEmployed: false,
    startDate: "",
    licenseType: "",
    licenseNumber: "",
    bloodGroup: "",
    hasConvictions: false,
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "طلب توظيف",
  });

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-4">
        <h4 className="font-semibold mb-3">الوظيفة المطلوبة / Position Applied For</h4>
        <Input value={formData.positionApplied} onChange={(e) => setFormData({...formData, positionApplied: e.target.value})} placeholder="Position Applied For / الوظيفة المطلوبة" />
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-semibold mb-3">البيانات الشخصية / Personal Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>الاسم الأول / First Name</Label>
            <Input value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>اسم الأب / Father Name</Label>
            <Input value={formData.fatherName} onChange={(e) => setFormData({...formData, fatherName: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>اسم الجد / Grandfather</Label>
            <Input value={formData.grandFatherName} onChange={(e) => setFormData({...formData, grandFatherName: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>اسم العائلة / Family Name</Label>
            <Input value={formData.familyName} onChange={(e) => setFormData({...formData, familyName: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>تاريخ الميلاد / Date of Birth</Label>
            <Input type="date" value={formData.dob} onChange={(e) => setFormData({...formData, dob: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>مكان الميلاد / Place of Birth</Label>
            <Input value={formData.birthPlace} onChange={(e) => setFormData({...formData, birthPlace: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>الجنسية / Nationality</Label>
            <Input value={formData.nationality} onChange={(e) => setFormData({...formData, nationality: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>الديانة / Religion</Label>
            <Input value={formData.religion} onChange={(e) => setFormData({...formData, religion: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>رقم الهوية/الإقامة / ID/Iqama No</Label>
            <Input value={formData.idNumber} onChange={(e) => setFormData({...formData, idNumber: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>مكان الإصدار / Issue Place</Label>
            <Input value={formData.idPlace} onChange={(e) => setFormData({...formData, idPlace: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>تاريخ الانتهاء / Expiry Date</Label>
            <Input type="date" value={formData.idExpiry} onChange={(e) => setFormData({...formData, idExpiry: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>رقم الجواز / Passport No</Label>
            <Input value={formData.passportNumber} onChange={(e) => setFormData({...formData, passportNumber: e.target.value})} />
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-semibold mb-3">معلومات الاتصال / Contact Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>هاتف المنزل / Home Phone</Label>
            <Input value={formData.homePhone} onChange={(e) => setFormData({...formData, homePhone: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>الجوال / Mobile</Label>
            <Input value={formData.mobile} onChange={(e) => setFormData({...formData, mobile: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>البريد الإلكتروني / Email</Label>
            <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>العنوان / Address</Label>
            <Input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-semibold mb-3">معلومات إضافية / Additional Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>الحالة الاجتماعية / Marital Status</Label>
            <Select value={formData.maritalStatus} onValueChange={(value) => setFormData({...formData, maritalStatus: value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">أعزب / Single</SelectItem>
                <SelectItem value="married">متزوج / Married</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>فصيلة الدم / Blood Group</Label>
            <Input value={formData.bloodGroup} onChange={(e) => setFormData({...formData, bloodGroup: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>نوع رخصة القيادة / License Type</Label>
            <Input value={formData.licenseType} onChange={(e) => setFormData({...formData, licenseType: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>رقم الرخصة / License No</Label>
            <Input value={formData.licenseNumber} onChange={(e) => setFormData({...formData, licenseNumber: e.target.value})} />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Checkbox checked={formData.hasDependents} onCheckedChange={(checked) => setFormData({...formData, hasDependents: checked as boolean})} />
            <Label>لدي معالين / Dependents</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={formData.hasDiseases} onCheckedChange={(checked) => setFormData({...formData, hasDiseases: checked as boolean})} />
            <Label>أمراض مزمنة / Chronic Diseases</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={formData.workedBefore} onCheckedChange={(checked) => setFormData({...formData, workedBefore: checked as boolean})} />
            <Label>عملت سابقاً في الشركة / Prev. Employed</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={formData.currentlyEmployed} onCheckedChange={(checked) => setFormData({...formData, currentlyEmployed: checked as boolean})} />
            <Label>أعمل حالياً / Currently Employed</Label>
          </div>
        </div>
      </div>

      <Button onClick={() => handlePrint()} className="w-full gap-2 bg-purple-600 hover:bg-purple-700">
        <Printer className="h-4 w-4" /> طباعة النموذج
      </Button>

      <div className="hidden">
        <div ref={printRef} className="p-6 bg-white print:block text-sm" dir="rtl">
          <CompanyHeader templateTitle="طلب توظيف" templateTitleEn="Employment Application" />

          <div className="border-2 rounded p-3 mb-3">
            <p className="font-semibold">الوظيفة المطلوبة / Position Applied For: <span className="font-normal">{formData.positionApplied}</span></p>
          </div>

          <table className="w-full border-collapse border text-xs mb-3">
            <tbody>
              <tr>
                <td className="border p-1.5 font-semibold bg-slate-50 w-24">الاسم الأول<br/><span className="font-normal text-slate-500">First Name</span></td>
                <td className="border p-1.5">{formData.firstName}</td>
                <td className="border p-1.5 font-semibold bg-slate-50 w-24">اسم الأب<br/><span className="font-normal text-slate-500">Father</span></td>
                <td className="border p-1.5">{formData.fatherName}</td>
                <td className="border p-1.5 font-semibold bg-slate-50 w-24">اسم الجد<br/><span className="font-normal text-slate-500">Grandfather</span></td>
                <td className="border p-1.5">{formData.grandFatherName}</td>
                <td className="border p-1.5 font-semibold bg-slate-50 w-24">العائلة<br/><span className="font-normal text-slate-500">Family</span></td>
                <td className="border p-1.5">{formData.familyName}</td>
              </tr>
              <tr>
                <td className="border p-1.5 font-semibold bg-slate-50">تاريخ الميلاد<br/><span className="font-normal text-slate-500">DOB</span></td>
                <td className="border p-1.5">{formData.dob}</td>
                <td className="border p-1.5 font-semibold bg-slate-50">مكان الميلاد<br/><span className="font-normal text-slate-500">Birth Place</span></td>
                <td className="border p-1.5">{formData.birthPlace}</td>
                <td className="border p-1.5 font-semibold bg-slate-50">الجنسية<br/><span className="font-normal text-slate-500">Nationality</span></td>
                <td className="border p-1.5">{formData.nationality}</td>
                <td className="border p-1.5 font-semibold bg-slate-50">الديانة<br/><span className="font-normal text-slate-500">Religion</span></td>
                <td className="border p-1.5">{formData.religion}</td>
              </tr>
              <tr>
                <td className="border p-1.5 font-semibold bg-slate-50">رقم الهوية<br/><span className="font-normal text-slate-500">ID No</span></td>
                <td className="border p-1.5" colSpan={3}>{formData.idNumber}</td>
                <td className="border p-1.5 font-semibold bg-slate-50">مكان الإصدار<br/><span className="font-normal text-slate-500">Issue Place</span></td>
                <td className="border p-1.5">{formData.idPlace}</td>
                <td className="border p-1.5 font-semibold bg-slate-50">تاريخ الانتهاء<br/><span className="font-normal text-slate-500">Expiry</span></td>
                <td className="border p-1.5">{formData.idExpiry}</td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div>هاتف المنزل / Home Phone: {formData.homePhone}</div>
            <div>الجوال / Mobile: {formData.mobile}</div>
            <div>البريد الإلكتروني / Email: {formData.email}</div>
            <div>العنوان / Address: {formData.address}</div>
          </div>

          <div className="flex gap-4 text-xs mb-3">
            <div>الحالة الاجتماعية / Marital Status: {formData.maritalStatus === 'married' ? 'متزوج / Married □' : 'أعزب / Single □'}</div>
            <div>فصيلة الدم / Blood Group: {formData.bloodGroup}</div>
          </div>

          <div className="border rounded p-3 mb-3 text-xs">
            <p className="font-semibold mb-2">رخصة القيادة / Driving License:</p>
            <div className="grid grid-cols-4 gap-2">
              <div>نوعها / Type: {formData.licenseType}</div>
              <div>رقمها / No: {formData.licenseNumber}</div>
            </div>
          </div>

          <div className="border-t pt-3 mt-3 text-xs">
            <p className="mb-2">أقر بصحة المعلومات المذكورة أعلاه وأتحمل المسؤولية الكاملة في حال ثبوت عدم صحتها.</p>
            <p className="text-slate-500 mb-2">I certify the above information is correct and accept full responsibility for any inaccuracies.</p>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div>الاسم / Name: ___________________</div>
              <div>التوقيع / Signature: ___________________</div>
              <div>التاريخ / Date: ___________________</div>
            </div>
          </div>

          <CompanyFooter />
        </div>
      </div>
    </div>
  );
}

export default function CompanyTemplates() {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const renderTemplateForm = () => {
    switch (selectedTemplate) {
      case "work_start":
        return <WorkStartTemplate />;
      case "final_settlement":
        return <FinalSettlementTemplate />;
      case "job_offer":
        return <JobOfferTemplate />;
      case "employment_application":
        return <EmploymentApplicationTemplate />;
      case "employee_status_change":
        return <EmployeeStatusChangeTemplate />;
      case "probation_evaluation":
        return <ProbationEvaluationTemplate />;
      case "asset_handover":
        return <AssetHandoverTemplate />;
      case "payment_order":
        return <PaymentOrderTemplate />;
      case "clearance":
        return <ClearanceTemplate />;
      case "penalty":
        return <PenaltyTemplate />;
      default:
        return null;
    }
  };

  const getTemplateInfo = () => {
    return templates.find(t => t.id === selectedTemplate);
  };

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6" dir="rtl">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-700 to-amber-600 rounded-lg px-3 sm:px-5 py-3 sm:py-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white" data-testid="page-title">
                  النماذج والقوالب الجاهزة
                </h1>
                <p className="text-[10px] sm:text-xs text-amber-100">نماذج رسمية جاهزة للطباعة</p>
              </div>
            </div>
            <Link href="/executive">
              <Button size="sm" variant="secondary" className="h-8 text-xs gap-1 bg-white text-amber-700 hover:bg-amber-50">
                <ArrowRight className="h-3.5 w-3.5" />
                العودة
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {templates.map((template) => (
              <Card 
                key={template.id}
                className="cursor-pointer hover:shadow-md transition-all hover:border-amber-300 group"
                onClick={() => {
                  setSelectedTemplate(template.id);
                  setIsDialogOpen(true);
                }}
                data-testid={`template-card-${template.id}`}
              >
                <CardContent className="p-3 sm:p-4 text-center">
                  <div className={`${template.color} w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3 text-white group-hover:scale-110 transition-transform`}>
                    {template.icon}
                  </div>
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight">{template.title}</h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 mt-1 hidden sm:block">{template.titleEn}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-lg">
                  {getTemplateInfo() && (
                    <>
                      <div className={`${getTemplateInfo()?.color} p-2 rounded-lg text-white`}>
                        {getTemplateInfo()?.icon}
                      </div>
                      <div>
                        <span>{getTemplateInfo()?.title}</span>
                        <p className="text-sm font-normal text-slate-500">{getTemplateInfo()?.titleEn}</p>
                      </div>
                    </>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                {renderTemplateForm()}
              </div>
            </DialogContent>
          </Dialog>

          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Building2 className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-900">{COMPANY_INFO.name}</h3>
                  <p className="text-sm text-amber-700">{COMPANY_INFO.nameEn}</p>
                  <p className="text-xs text-amber-600 mt-1">سجل تجاري: {COMPANY_INFO.cr}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
