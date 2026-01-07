import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Building2,
  Users,
  Crown,
  UserCircle,
  Coffee,
  ShoppingCart,
  Utensils,
  ClipboardList,
  Wrench,
  ChefHat,
  Star,
  ArrowLeft,
  Network,
} from "lucide-react";

interface JobRole {
  id: string;
  titleAr: string;
  titleEn: string;
  level: number;
  icon: React.ReactNode;
  color: string;
  parentId?: string;
  summaryAr: string;
  summaryEn: string;
  responsibilitiesAr: string[];
  responsibilitiesEn: string[];
  qualificationsAr: string[];
  qualificationsEn: string[];
}

const jobRoles: JobRole[] = [
  {
    id: "operations-manager",
    titleAr: "مدير التشغيل",
    titleEn: "Operations Manager",
    level: 1,
    icon: <Crown className="h-6 w-6" />,
    color: "bg-amber-500",
    summaryAr: "المسؤول الأعلى عن جميع عمليات التشغيل في المنشأة",
    summaryEn: "Top executive responsible for all operational activities",
    responsibilitiesAr: [
      "وضع الاستراتيجيات التشغيلية للمنشأة",
      "الإشراف على جميع الفروع والمناطق",
      "اتخاذ القرارات التنفيذية المتعلقة بالتشغيل",
      "متابعة الأداء العام وتحقيق الأهداف",
      "التنسيق مع الإدارة العليا",
      "إدارة ميزانية التشغيل",
      "تطوير سياسات العمل والإجراءات",
    ],
    responsibilitiesEn: [
      "Develop operational strategies for the organization",
      "Supervise all branches and regions",
      "Make executive decisions related to operations",
      "Monitor overall performance and goal achievement",
      "Coordinate with senior management",
      "Manage operational budget",
      "Develop work policies and procedures",
    ],
    qualificationsAr: [
      "خبرة لا تقل عن 10 سنوات في إدارة التشغيل",
      "شهادة جامعية في إدارة الأعمال أو ما يعادلها",
      "مهارات قيادية متميزة",
      "القدرة على اتخاذ القرارات",
    ],
    qualificationsEn: [
      "Minimum 10 years experience in operations management",
      "Bachelor's degree in Business Administration or equivalent",
      "Excellent leadership skills",
      "Strong decision-making abilities",
    ],
  },
  {
    id: "assistant-operations-manager",
    titleAr: "مساعد مدير التشغيل",
    titleEn: "Assistant Operations Manager",
    level: 2,
    icon: <Star className="h-6 w-6" />,
    color: "bg-amber-400",
    parentId: "operations-manager",
    summaryAr: "يدعم مدير التشغيل في إدارة العمليات اليومية",
    summaryEn: "Supports the Operations Manager in daily operations management",
    responsibilitiesAr: [
      "مساعدة مدير التشغيل في المهام اليومية",
      "متابعة تنفيذ الخطط التشغيلية",
      "التواصل مع مديري المناطق",
      "إعداد التقارير الدورية",
      "حل المشكلات التشغيلية الطارئة",
      "تمثيل مدير التشغيل في غيابه",
    ],
    responsibilitiesEn: [
      "Assist Operations Manager in daily tasks",
      "Monitor execution of operational plans",
      "Communicate with regional managers",
      "Prepare periodic reports",
      "Solve urgent operational problems",
      "Represent Operations Manager in their absence",
    ],
    qualificationsAr: [
      "خبرة لا تقل عن 7 سنوات في التشغيل",
      "مهارات تواصل ممتازة",
      "قدرة على العمل تحت الضغط",
    ],
    qualificationsEn: [
      "Minimum 7 years experience in operations",
      "Excellent communication skills",
      "Ability to work under pressure",
    ],
  },
  {
    id: "regional-manager",
    titleAr: "مدير المنطقة",
    titleEn: "Regional Manager",
    level: 3,
    icon: <Building2 className="h-6 w-6" />,
    color: "bg-orange-400",
    parentId: "assistant-operations-manager",
    summaryAr: "مسؤول عن إدارة مجموعة من الفروع في منطقة جغرافية محددة",
    summaryEn: "Responsible for managing a group of branches in a specific geographic area",
    responsibilitiesAr: [
      "الإشراف على فروع المنطقة",
      "تحقيق أهداف المبيعات للمنطقة",
      "تطوير فريق العمل بالمنطقة",
      "متابعة جودة الخدمة والمنتجات",
      "إدارة ميزانية المنطقة",
      "التنسيق مع الإدارة العليا",
    ],
    responsibilitiesEn: [
      "Supervise regional branches",
      "Achieve regional sales targets",
      "Develop the regional team",
      "Monitor service and product quality",
      "Manage regional budget",
      "Coordinate with senior management",
    ],
    qualificationsAr: [
      "خبرة لا تقل عن 5 سنوات في إدارة الفروع",
      "معرفة بالسوق المحلي",
      "مهارات قيادية",
    ],
    qualificationsEn: [
      "Minimum 5 years experience in branch management",
      "Knowledge of local market",
      "Leadership skills",
    ],
  },
  {
    id: "branch-manager",
    titleAr: "مدير الفرع",
    titleEn: "Branch Manager",
    level: 4,
    icon: <Users className="h-6 w-6" />,
    color: "bg-yellow-400",
    parentId: "regional-manager",
    summaryAr: "المسؤول الأول عن إدارة الفرع وتحقيق أهدافه",
    summaryEn: "Primary person responsible for branch management and achieving its goals",
    responsibilitiesAr: [
      "إدارة العمليات اليومية للفرع",
      "تحقيق أهداف المبيعات",
      "إدارة فريق العمل",
      "ضمان جودة الخدمة والمنتجات",
      "إدارة المخزون والطلبات",
      "التعامل مع شكاوى العملاء",
      "إعداد التقارير اليومية والأسبوعية",
    ],
    responsibilitiesEn: [
      "Manage daily branch operations",
      "Achieve sales targets",
      "Manage work team",
      "Ensure service and product quality",
      "Manage inventory and orders",
      "Handle customer complaints",
      "Prepare daily and weekly reports",
    ],
    qualificationsAr: [
      "خبرة لا تقل عن 3 سنوات في إدارة الفروع",
      "مهارات إدارية وتنظيمية",
      "القدرة على حل المشكلات",
    ],
    qualificationsEn: [
      "Minimum 3 years experience in branch management",
      "Administrative and organizational skills",
      "Problem-solving ability",
    ],
  },
  {
    id: "branch-supervisor",
    titleAr: "مشرف الفرع",
    titleEn: "Branch Supervisor",
    level: 5,
    icon: <ClipboardList className="h-6 w-6" />,
    color: "bg-lime-400",
    parentId: "branch-manager",
    summaryAr: "يساعد مدير الفرع في الإشراف على العمليات اليومية",
    summaryEn: "Assists Branch Manager in supervising daily operations",
    responsibilitiesAr: [
      "الإشراف على سير العمل اليومي",
      "متابعة أداء الموظفين",
      "التأكد من تطبيق معايير الجودة",
      "حل المشكلات الفورية",
      "تنسيق الورديات",
      "استلام المخزون والتحقق منه",
    ],
    responsibilitiesEn: [
      "Supervise daily workflow",
      "Monitor employee performance",
      "Ensure quality standards are applied",
      "Solve immediate problems",
      "Coordinate shifts",
      "Receive and verify inventory",
    ],
    qualificationsAr: [
      "خبرة لا تقل عن سنتين في العمل بالمخابز",
      "مهارات إشرافية",
      "الاهتمام بالتفاصيل",
    ],
    qualificationsEn: [
      "Minimum 2 years experience in bakery work",
      "Supervisory skills",
      "Attention to detail",
    ],
  },
  {
    id: "shift-manager",
    titleAr: "مدير شفت",
    titleEn: "Shift Manager",
    level: 6,
    icon: <UserCircle className="h-6 w-6" />,
    color: "bg-green-400",
    parentId: "branch-supervisor",
    summaryAr: "مسؤول عن إدارة الوردية وضمان سير العمل بكفاءة",
    summaryEn: "Responsible for managing the shift and ensuring efficient workflow",
    responsibilitiesAr: [
      "إدارة فريق الوردية",
      "توزيع المهام على الموظفين",
      "التأكد من جاهزية المنتجات",
      "إغلاق الوردية وتسليم الصندوق",
      "حل مشاكل العملاء",
      "متابعة النظافة والنظام",
    ],
    responsibilitiesEn: [
      "Manage shift team",
      "Distribute tasks to employees",
      "Ensure product readiness",
      "Close shift and hand over cash register",
      "Solve customer problems",
      "Monitor cleanliness and order",
    ],
    qualificationsAr: [
      "خبرة لا تقل عن سنة في العمل",
      "قدرة على القيادة",
      "مهارات التواصل",
    ],
    qualificationsEn: [
      "Minimum 1 year work experience",
      "Leadership ability",
      "Communication skills",
    ],
  },
  {
    id: "team-leader",
    titleAr: "تيم ليدر",
    titleEn: "Team Leader",
    level: 7,
    icon: <Star className="h-6 w-6" />,
    color: "bg-teal-400",
    parentId: "shift-manager",
    summaryAr: "قائد فريق صغير يشرف على مجموعة من العاملين",
    summaryEn: "Leader of a small team supervising a group of workers",
    responsibilitiesAr: [
      "قيادة فريق العمل المباشر",
      "تدريب الموظفين الجدد",
      "متابعة تنفيذ المهام",
      "التواصل مع مدير الشفت",
      "ضمان جودة العمل",
    ],
    responsibilitiesEn: [
      "Lead direct work team",
      "Train new employees",
      "Monitor task execution",
      "Communicate with shift manager",
      "Ensure work quality",
    ],
    qualificationsAr: [
      "خبرة في نفس المجال",
      "مهارات تواصل جيدة",
      "روح القيادة",
    ],
    qualificationsEn: [
      "Experience in the same field",
      "Good communication skills",
      "Leadership spirit",
    ],
  },
  {
    id: "hall-manager",
    titleAr: "مدير صالة",
    titleEn: "Hall Manager",
    level: 7,
    icon: <Utensils className="h-6 w-6" />,
    color: "bg-cyan-400",
    parentId: "shift-manager",
    summaryAr: "مسؤول عن إدارة صالة الفرع وتجربة العملاء",
    summaryEn: "Responsible for managing the branch hall and customer experience",
    responsibilitiesAr: [
      "الإشراف على صالة الفرع",
      "التأكد من نظافة وترتيب الصالة",
      "متابعة رضا العملاء",
      "تنسيق عمل الويترز",
      "حل مشاكل العملاء فوراً",
    ],
    responsibilitiesEn: [
      "Supervise branch hall",
      "Ensure hall cleanliness and organization",
      "Monitor customer satisfaction",
      "Coordinate waiter work",
      "Solve customer problems immediately",
    ],
    qualificationsAr: [
      "خبرة في خدمة العملاء",
      "مظهر لائق",
      "مهارات تواصل ممتازة",
    ],
    qualificationsEn: [
      "Customer service experience",
      "Professional appearance",
      "Excellent communication skills",
    ],
  },
  {
    id: "cashier",
    titleAr: "كاشير",
    titleEn: "Cashier",
    level: 8,
    icon: <ShoppingCart className="h-6 w-6" />,
    color: "bg-blue-400",
    parentId: "team-leader",
    summaryAr: "مسؤول عن عمليات البيع والتحصيل",
    summaryEn: "Responsible for sales and collection operations",
    responsibilitiesAr: [
      "استقبال الطلبات من العملاء",
      "تسجيل المبيعات في النظام",
      "تحصيل المبالغ (نقداً وإلكترونياً)",
      "إصدار الفواتير",
      "تسليم الصندوق في نهاية الوردية",
      "التعامل الجيد مع العملاء",
    ],
    responsibilitiesEn: [
      "Receive orders from customers",
      "Record sales in the system",
      "Collect payments (cash and electronic)",
      "Issue invoices",
      "Hand over cash register at end of shift",
      "Deal professionally with customers",
    ],
    qualificationsAr: [
      "مهارات حسابية",
      "أمانة ودقة",
      "مهارات تواصل",
    ],
    qualificationsEn: [
      "Mathematical skills",
      "Honesty and accuracy",
      "Communication skills",
    ],
  },
  {
    id: "seller",
    titleAr: "بائع",
    titleEn: "Seller",
    level: 8,
    icon: <ShoppingCart className="h-6 w-6" />,
    color: "bg-indigo-400",
    parentId: "team-leader",
    summaryAr: "مسؤول عن البيع وتقديم المنتجات للعملاء",
    summaryEn: "Responsible for selling and presenting products to customers",
    responsibilitiesAr: [
      "عرض المنتجات للعملاء",
      "شرح أنواع المنتجات",
      "مساعدة العملاء في الاختيار",
      "تغليف المنتجات",
      "ترتيب وتنظيم المعروضات",
    ],
    responsibilitiesEn: [
      "Display products to customers",
      "Explain product types",
      "Help customers choose",
      "Package products",
      "Organize and arrange displays",
    ],
    qualificationsAr: [
      "مهارات بيع",
      "معرفة بالمنتجات",
      "حسن التعامل",
    ],
    qualificationsEn: [
      "Sales skills",
      "Product knowledge",
      "Good interpersonal skills",
    ],
  },
  {
    id: "barista",
    titleAr: "باريستا",
    titleEn: "Barista",
    level: 8,
    icon: <Coffee className="h-6 w-6" />,
    color: "bg-amber-600",
    parentId: "team-leader",
    summaryAr: "متخصص في تحضير المشروبات الساخنة والباردة",
    summaryEn: "Specialist in preparing hot and cold beverages",
    responsibilitiesAr: [
      "تحضير القهوة بأنواعها",
      "تحضير المشروبات الساخنة والباردة",
      "تنظيف وصيانة ماكينة القهوة",
      "ترتيب منطقة المشروبات",
      "ابتكار وصفات جديدة",
    ],
    responsibilitiesEn: [
      "Prepare various types of coffee",
      "Prepare hot and cold drinks",
      "Clean and maintain coffee machine",
      "Organize beverage area",
      "Create new recipes",
    ],
    qualificationsAr: [
      "خبرة في تحضير القهوة",
      "دورات تدريبية في الباريستا",
      "إبداع ودقة",
    ],
    qualificationsEn: [
      "Coffee preparation experience",
      "Barista training courses",
      "Creativity and precision",
    ],
  },
  {
    id: "waiter",
    titleAr: "ويتر",
    titleEn: "Waiter",
    level: 8,
    icon: <Utensils className="h-6 w-6" />,
    color: "bg-purple-400",
    parentId: "hall-manager",
    summaryAr: "مسؤول عن تقديم الطلبات للعملاء في الصالة",
    summaryEn: "Responsible for serving orders to customers in the hall",
    responsibilitiesAr: [
      "استقبال العملاء وتوجيههم للطاولات",
      "أخذ الطلبات",
      "تقديم الطلبات للعملاء",
      "تنظيف الطاولات",
      "التأكد من رضا العملاء",
    ],
    responsibilitiesEn: [
      "Welcome customers and guide them to tables",
      "Take orders",
      "Serve orders to customers",
      "Clean tables",
      "Ensure customer satisfaction",
    ],
    qualificationsAr: [
      "لياقة بدنية",
      "سرعة في العمل",
      "مظهر لائق",
    ],
    qualificationsEn: [
      "Physical fitness",
      "Speed at work",
      "Professional appearance",
    ],
  },
  {
    id: "order-handler",
    titleAr: "مقدم طلبات",
    titleEn: "Order Handler",
    level: 8,
    icon: <ClipboardList className="h-6 w-6" />,
    color: "bg-pink-400",
    parentId: "team-leader",
    summaryAr: "مسؤول عن تجهيز وتقديم الطلبات",
    summaryEn: "Responsible for preparing and presenting orders",
    responsibilitiesAr: [
      "استلام الطلبات من الكاشير",
      "تجهيز الطلبات بدقة",
      "التأكد من اكتمال الطلب",
      "تسليم الطلب للعميل",
      "التنسيق مع المطبخ",
    ],
    responsibilitiesEn: [
      "Receive orders from cashier",
      "Prepare orders accurately",
      "Ensure order completeness",
      "Deliver order to customer",
      "Coordinate with kitchen",
    ],
    qualificationsAr: [
      "دقة وانتباه",
      "سرعة في العمل",
      "تنظيم",
    ],
    qualificationsEn: [
      "Accuracy and attention",
      "Speed at work",
      "Organization",
    ],
  },
  {
    id: "baker",
    titleAr: "خباز",
    titleEn: "Baker",
    level: 8,
    icon: <ChefHat className="h-6 w-6" />,
    color: "bg-orange-500",
    parentId: "team-leader",
    summaryAr: "متخصص في إعداد وخبز المنتجات",
    summaryEn: "Specialist in preparing and baking products",
    responsibilitiesAr: [
      "تحضير العجائن والمخبوزات",
      "خبز المنتجات حسب المعايير",
      "متابعة جودة المنتجات",
      "تنظيف منطقة العمل",
      "الالتزام بوصفات الإنتاج",
    ],
    responsibilitiesEn: [
      "Prepare doughs and baked goods",
      "Bake products according to standards",
      "Monitor product quality",
      "Clean work area",
      "Follow production recipes",
    ],
    qualificationsAr: [
      "خبرة في الخبز",
      "معرفة بأنواع العجائن",
      "الاهتمام بالجودة",
    ],
    qualificationsEn: [
      "Baking experience",
      "Knowledge of dough types",
      "Focus on quality",
    ],
  },
  {
    id: "worker",
    titleAr: "عامل",
    titleEn: "Worker",
    level: 9,
    icon: <Wrench className="h-6 w-6" />,
    color: "bg-gray-400",
    parentId: "team-leader",
    summaryAr: "يقوم بالأعمال العامة والمساندة في الفرع",
    summaryEn: "Performs general and support work in the branch",
    responsibilitiesAr: [
      "النظافة العامة للفرع",
      "ترتيب وتنظيم المخزن",
      "نقل البضائع",
      "مساعدة الزملاء عند الحاجة",
      "أي مهام أخرى تُطلب منه",
    ],
    responsibilitiesEn: [
      "General branch cleaning",
      "Organize and arrange storage",
      "Transport goods",
      "Assist colleagues when needed",
      "Any other tasks as required",
    ],
    qualificationsAr: [
      "لياقة بدنية",
      "الالتزام بالعمل",
      "روح الفريق",
    ],
    qualificationsEn: [
      "Physical fitness",
      "Work commitment",
      "Team spirit",
    ],
  },
];

function RoleCard({ role, onClick }: { role: JobRole; onClick: () => void }) {
  return (
    <Card
      className={`cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-105 border-2 hover:border-amber-400`}
      onClick={onClick}
      data-testid={`card-role-${role.id}`}
    >
      <CardContent className="p-4 text-center">
        <div
          className={`w-14 h-14 rounded-full ${role.color} flex items-center justify-center mx-auto mb-3 text-white shadow-md`}
        >
          {role.icon}
        </div>
        <h3 className="font-bold text-lg text-gray-800">{role.titleAr}</h3>
        <p className="text-sm text-gray-500">{role.titleEn}</p>
        <p className="text-xs text-gray-400 mt-2 line-clamp-2">{role.summaryAr}</p>
      </CardContent>
    </Card>
  );
}

function RoleDetailsDialog({
  role,
  open,
  onClose,
}: {
  role: JobRole | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-full ${role.color} flex items-center justify-center text-white`}
            >
              {role.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold">{role.titleAr}</h2>
              <p className="text-sm text-gray-500 font-normal">{role.titleEn}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="arabic" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="arabic" data-testid="tab-arabic">العربية</TabsTrigger>
            <TabsTrigger value="english" data-testid="tab-english">English</TabsTrigger>
          </TabsList>

          <TabsContent value="arabic" className="space-y-4 mt-4">
            <div>
              <h4 className="font-semibold text-amber-600 mb-2">ملخص الوظيفة</h4>
              <p className="text-gray-700 bg-amber-50 p-3 rounded-lg">{role.summaryAr}</p>
            </div>

            <div>
              <h4 className="font-semibold text-amber-600 mb-2">المهام والمسؤوليات</h4>
              <ul className="space-y-2">
                {role.responsibilitiesAr.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 bg-gray-50 p-2 rounded-lg"
                  >
                    <Badge variant="outline" className="mt-0.5 bg-amber-100 border-amber-300">
                      {idx + 1}
                    </Badge>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-amber-600 mb-2">المؤهلات المطلوبة</h4>
              <ul className="space-y-2">
                {role.qualificationsAr.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 text-gray-700"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="english" className="space-y-4 mt-4">
            <div>
              <h4 className="font-semibold text-amber-600 mb-2">Job Summary</h4>
              <p className="text-gray-700 bg-amber-50 p-3 rounded-lg">{role.summaryEn}</p>
            </div>

            <div>
              <h4 className="font-semibold text-amber-600 mb-2">Responsibilities</h4>
              <ul className="space-y-2">
                {role.responsibilitiesEn.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 bg-gray-50 p-2 rounded-lg"
                  >
                    <Badge variant="outline" className="mt-0.5 bg-amber-100 border-amber-300">
                      {idx + 1}
                    </Badge>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-amber-600 mb-2">Required Qualifications</h4>
              <ul className="space-y-2">
                {role.qualificationsEn.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 text-gray-700"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-4 pt-4 border-t flex justify-between items-center">
          <Link href={`/branch-employees?jobTitle=${encodeURIComponent(role.titleAr)}`}>
            <Button variant="outline" className="gap-2" data-testid="btn-view-employees">
              <Users className="h-4 w-4" />
              عرض الموظفين في هذا المنصب
            </Button>
          </Link>
          <Button onClick={onClose} data-testid="btn-close-dialog">إغلاق</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HierarchyLevel({
  roles,
  level,
  onRoleClick,
}: {
  roles: JobRole[];
  level: number;
  onRoleClick: (role: JobRole) => void;
}) {
  const levelRoles = roles.filter((r) => r.level === level);
  if (levelRoles.length === 0) return null;

  return (
    <div className="relative">
      {level > 1 && (
        <div className="absolute top-0 left-1/2 w-0.5 h-6 bg-amber-300 -translate-x-1/2 -translate-y-6" />
      )}
      <div className={`flex flex-wrap justify-center gap-4 ${level > 1 ? 'pt-2' : ''}`}>
        {levelRoles.map((role) => (
          <div key={role.id} className="relative">
            <RoleCard role={role} onClick={() => onRoleClick(role)} />
          </div>
        ))}
      </div>
      {roles.some((r) => r.level === level + 1) && (
        <div className="flex justify-center my-4">
          <div className="w-0.5 h-8 bg-amber-300" />
        </div>
      )}
    </div>
  );
}

export default function OrganizationalStructurePage() {
  const [selectedRole, setSelectedRole] = useState<JobRole | null>(null);

  const levels = Array.from(new Set(jobRoles.map((r) => r.level))).sort((a, b) => a - b);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white" dir="rtl">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/branch-employees">
            <Button variant="outline" className="gap-2" data-testid="btn-back">
              <ArrowLeft className="h-4 w-4" />
              العودة لإدارة الموظفين
            </Button>
          </Link>
          <div className="text-center flex-1">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Network className="h-8 w-8 text-amber-600" />
              <h1 className="text-3xl font-bold text-gray-800">الهيكل الوظيفي</h1>
            </div>
            <p className="text-gray-600">إدارة التشغيل - Butter Bakery</p>
          </div>
          <div className="w-32" />
        </div>

        <Card className="mb-8 border-amber-200 bg-gradient-to-l from-amber-100 to-amber-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center text-white">
                <Building2 className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">هيكل إدارة التشغيل</h2>
                <p className="text-gray-600">
                  اضغط على أي منصب لعرض الوصف الوظيفي التفصيلي والمهام والمسؤوليات
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-x-auto" data-testid="card-hierarchy">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              التسلسل الهرمي الوظيفي
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-8">
            <div className="min-w-[800px] space-y-2">
              {levels.map((level) => (
                <HierarchyLevel
                  key={level}
                  roles={jobRoles}
                  level={level}
                  onRoleClick={setSelectedRole}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="bg-amber-50 border-amber-200" data-testid="card-level-senior">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white">
                  <Crown className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">الإدارة العليا</p>
                  <p className="text-sm text-gray-600">المستوى 1-3</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200" data-testid="card-level-middle">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">الإدارة الوسطى</p>
                  <p className="text-sm text-gray-600">المستوى 4-6</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200" data-testid="card-level-frontline">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">الموظفين التنفيذيين</p>
                  <p className="text-sm text-gray-600">المستوى 7-9</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <RoleDetailsDialog
          role={selectedRole}
          open={!!selectedRole}
          onClose={() => setSelectedRole(null)}
        />
      </div>
    </div>
  );
}
