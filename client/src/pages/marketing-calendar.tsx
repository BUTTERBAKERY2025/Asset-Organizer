import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, Plus, ChevronRight, ChevronLeft, Megaphone, Users, Gift, Star, ArrowRight, 
  ListTodo, CheckCircle2, Clock, AlertCircle, Sun, Moon, GraduationCap, Flag, Heart,
  Sparkles, ShoppingBag, Palmtree, Snowflake, Crown, Building2, Cake, PartyPopper,
  CalendarDays, Eye, EyeOff, Filter, TrendingUp, Download, Bell, DollarSign, Target,
  Zap, Copy, ExternalLink, AlertTriangle, Info
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  eventType: string;
  startDate: string;
  endDate?: string;
  allDay: boolean;
  campaignId?: number;
  branchId?: string;
  color?: string;
  notes?: string;
}

interface MarketingCampaign {
  id: number;
  name: string;
  nameAr?: string;
  status: string;
  startDate: string;
  endDate: string;
  objective?: string;
}

interface MarketingTask {
  id: number;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  assignedTo?: string;
}

interface SaudiOccasion {
  id: string;
  title: string;
  titleEn: string;
  date: string;
  endDate?: string;
  category: "holiday" | "national" | "religious" | "season" | "education" | "commercial" | "social";
  description: string;
  marketingTips: string[];
  icon: any;
  color: string;
  isOfficial: boolean;
  preparationDays: number;
  suggestedBudget: { min: number; max: number; currency: string };
  impactLevel: "high" | "medium" | "low";
  targetAudience: string[];
  campaignTemplates: {
    name: string;
    type: string;
    duration: number;
    channels: string[];
  }[];
}

interface UnifiedCalendarEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  type: "event" | "campaign_start" | "campaign_end" | "task" | "occasion";
  color: string;
  source: "calendar" | "campaign" | "task" | "saudi_occasion";
  originalData?: any;
  category?: string;
}

const EVENT_TYPES = [
  { value: "campaign_launch", label: "إطلاق حملة", color: "bg-amber-500" },
  { value: "campaign_end", label: "نهاية حملة", color: "bg-red-500" },
  { value: "influencer_post", label: "نشر مؤثر", color: "bg-blue-500" },
  { value: "content_deadline", label: "موعد تسليم محتوى", color: "bg-purple-500" },
  { value: "meeting", label: "اجتماع", color: "bg-green-500" },
  { value: "event", label: "فعالية", color: "bg-teal-500" },
  { value: "holiday", label: "مناسبة", color: "bg-orange-500" },
  { value: "promotion", label: "عرض ترويجي", color: "bg-cyan-500" },
  { value: "other", label: "أخرى", color: "bg-gray-500" },
];

const OCCASION_CATEGORIES = [
  { value: "all", label: "الكل", color: "bg-gray-500" },
  { value: "holiday", label: "إجازات رسمية", color: "bg-red-500", icon: Calendar },
  { value: "national", label: "مناسبات وطنية", color: "bg-green-600", icon: Flag },
  { value: "religious", label: "مناسبات دينية", color: "bg-emerald-500", icon: Moon },
  { value: "season", label: "مواسم", color: "bg-orange-500", icon: Sun },
  { value: "education", label: "تعليم ومدارس", color: "bg-blue-500", icon: GraduationCap },
  { value: "commercial", label: "تجارية وتسوق", color: "bg-purple-500", icon: ShoppingBag },
  { value: "social", label: "اجتماعية", color: "bg-rose-500", icon: Heart },
];

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const DAYS_AR = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

const formatNum = (n: number): string => n.toLocaleString('en-US');

// تواريخ المناسبات الإسلامية المتغيرة حسب السنة (التقويم الهجري يتقدم ~10-11 يوم سنوياً)
const getIslamicDates = (year: number) => {
  const dates: Record<number, { ramadanStart: string; ramadanEnd: string; eidFitrStart: string; eidFitrEnd: string; hajjStart: string; hajjEnd: string; eidAdhaStart: string; eidAdhaEnd: string }> = {
    2025: {
      ramadanStart: "2025-03-01", ramadanEnd: "2025-03-30",
      eidFitrStart: "2025-03-30", eidFitrEnd: "2025-04-02",
      hajjStart: "2025-06-04", hajjEnd: "2025-06-09",
      eidAdhaStart: "2025-06-06", eidAdhaEnd: "2025-06-10",
    },
    2026: {
      ramadanStart: "2026-02-18", ramadanEnd: "2026-03-19",
      eidFitrStart: "2026-03-20", eidFitrEnd: "2026-03-23",
      hajjStart: "2026-05-24", hajjEnd: "2026-05-29",
      eidAdhaStart: "2026-05-26", eidAdhaEnd: "2026-05-30",
    },
    2027: {
      ramadanStart: "2027-02-08", ramadanEnd: "2027-03-09",
      eidFitrStart: "2027-03-09", eidFitrEnd: "2027-03-12",
      hajjStart: "2027-05-13", hajjEnd: "2027-05-18",
      eidAdhaStart: "2027-05-15", eidAdhaEnd: "2027-05-19",
    },
    2028: {
      ramadanStart: "2028-01-28", ramadanEnd: "2028-02-26",
      eidFitrStart: "2028-02-26", eidFitrEnd: "2028-03-01",
      hajjStart: "2028-05-02", hajjEnd: "2028-05-07",
      eidAdhaStart: "2028-05-04", eidAdhaEnd: "2028-05-08",
    },
  };
  // Default fallback with approximate calculation
  return dates[year] || {
    ramadanStart: `${year}-03-01`, ramadanEnd: `${year}-03-30`,
    eidFitrStart: `${year}-03-30`, eidFitrEnd: `${year}-04-02`,
    hajjStart: `${year}-06-04`, hajjEnd: `${year}-06-09`,
    eidAdhaStart: `${year}-06-06`, eidAdhaEnd: `${year}-06-10`,
  };
};

const getSaudiOccasions = (year: number): SaudiOccasion[] => {
  const islamicDates = getIslamicDates(year);
  
  return [
    {
      id: "founding-day",
      title: "يوم التأسيس",
      titleEn: "Founding Day",
      date: `${year}-02-22`,
      category: "national",
      description: "ذكرى تأسيس الدولة السعودية الأولى عام 1727م",
      marketingTips: ["عروض خاصة بالتراث السعودي", "منتجات بألوان العلم", "حملات الفخر الوطني"],
      icon: Crown,
      color: "bg-green-600",
      isOfficial: true,
      preparationDays: 21,
      suggestedBudget: { min: 15000, max: 50000, currency: "SAR" },
      impactLevel: "high",
      targetAudience: ["العائلات", "الشباب", "المهتمين بالتراث"],
      campaignTemplates: [
        { name: "حملة التراث السعودي", type: "awareness", duration: 14, channels: ["social", "influencers", "outdoor"] },
        { name: "عروض يوم التأسيس", type: "promotional", duration: 7, channels: ["social", "email", "sms"] },
      ],
    },
    {
      id: "ramadan-start",
      title: "بداية شهر رمضان",
      titleEn: "Ramadan Start",
      date: islamicDates.ramadanStart,
      endDate: islamicDates.ramadanEnd,
      category: "religious",
      description: "شهر الصيام المبارك",
      marketingTips: ["عروض رمضانية", "منتجات الإفطار", "حملات التبرع والخير", "ساعات عمل خاصة"],
      icon: Moon,
      color: "bg-emerald-500",
      isOfficial: true,
      preparationDays: 30,
      suggestedBudget: { min: 50000, max: 200000, currency: "SAR" },
      impactLevel: "high",
      targetAudience: ["العائلات", "ربات البيوت", "الشباب"],
      campaignTemplates: [
        { name: "حملة رمضان الخير", type: "awareness", duration: 30, channels: ["tv", "social", "influencers"] },
        { name: "عروض الإفطار", type: "promotional", duration: 30, channels: ["social", "email", "app"] },
        { name: "حملة التبرعات", type: "csr", duration: 30, channels: ["social", "email"] },
      ],
    },
    {
      id: "eid-fitr",
      title: "عيد الفطر المبارك",
      titleEn: "Eid Al-Fitr",
      date: islamicDates.eidFitrStart,
      endDate: islamicDates.eidFitrEnd,
      category: "religious",
      description: "إجازة عيد الفطر",
      marketingTips: ["عروض العيد", "هدايا العيد", "ملابس العيد", "حلويات ومعمول"],
      icon: PartyPopper,
      color: "bg-amber-500",
      isOfficial: true,
      preparationDays: 21,
      suggestedBudget: { min: 30000, max: 100000, currency: "SAR" },
      impactLevel: "high",
      targetAudience: ["العائلات", "الأطفال", "الشباب"],
      campaignTemplates: [
        { name: "حملة عيدكم مبارك", type: "awareness", duration: 10, channels: ["social", "influencers", "outdoor"] },
        { name: "عروض العيد", type: "promotional", duration: 7, channels: ["social", "email", "sms"] },
      ],
    },
    {
      id: "summer-vacation-start",
      title: "بداية الإجازة الصيفية",
      titleEn: "Summer Vacation Start",
      date: `${year}-06-20`,
      endDate: `${year}-08-25`,
      category: "education",
      description: "إجازة الصيف للمدارس",
      marketingTips: ["عروض السفر", "أنشطة الأطفال", "دورات صيفية", "منتجات الترفيه"],
      icon: GraduationCap,
      color: "bg-blue-500",
      isOfficial: false,
      preparationDays: 14,
      suggestedBudget: { min: 20000, max: 80000, currency: "SAR" },
      impactLevel: "medium",
      targetAudience: ["العائلات", "الأطفال", "الطلاب"],
      campaignTemplates: [
        { name: "صيف ممتع", type: "awareness", duration: 60, channels: ["social", "influencers"] },
        { name: "عروض الصيف", type: "promotional", duration: 30, channels: ["social", "email"] },
      ],
    },
    {
      id: "summer-season",
      title: "موسم الصيف",
      titleEn: "Summer Season",
      date: `${year}-06-21`,
      endDate: `${year}-09-21`,
      category: "season",
      description: "فصل الصيف - ذروة السفر والسياحة",
      marketingTips: ["عروض السفر الداخلي", "منتجات الصيف", "مشروبات باردة", "حملات الترفيه"],
      icon: Sun,
      color: "bg-orange-500",
      isOfficial: false,
      preparationDays: 21,
      suggestedBudget: { min: 25000, max: 100000, currency: "SAR" },
      impactLevel: "medium",
      targetAudience: ["العائلات", "الشباب", "المسافرين"],
      campaignTemplates: [
        { name: "استمتع بصيفك", type: "awareness", duration: 90, channels: ["social", "outdoor"] },
      ],
    },
    {
      id: "eid-adha",
      title: "عيد الأضحى المبارك",
      titleEn: "Eid Al-Adha",
      date: islamicDates.eidAdhaStart,
      endDate: islamicDates.eidAdhaEnd,
      category: "religious",
      description: "إجازة عيد الأضحى وموسم الحج",
      marketingTips: ["عروض الأضاحي", "هدايا العيد", "ملابس العيد", "لحوم ومنتجات غذائية"],
      icon: PartyPopper,
      color: "bg-amber-600",
      isOfficial: true,
      preparationDays: 21,
      suggestedBudget: { min: 30000, max: 100000, currency: "SAR" },
      impactLevel: "high",
      targetAudience: ["العائلات", "الحجاج", "المضحين"],
      campaignTemplates: [
        { name: "عيد أضحى مبارك", type: "awareness", duration: 10, channels: ["social", "influencers"] },
        { name: "عروض الأضاحي", type: "promotional", duration: 14, channels: ["social", "email", "sms"] },
      ],
    },
    {
      id: "hajj-season",
      title: "موسم الحج",
      titleEn: "Hajj Season",
      date: islamicDates.hajjStart,
      endDate: islamicDates.hajjEnd,
      category: "religious",
      description: "موسم الحج المبارك",
      marketingTips: ["منتجات الحجاج", "خدمات الضيافة", "هدايا تذكارية"],
      icon: Building2,
      color: "bg-teal-600",
      isOfficial: false,
      preparationDays: 30,
      suggestedBudget: { min: 15000, max: 50000, currency: "SAR" },
      impactLevel: "medium",
      targetAudience: ["الحجاج", "العائلات"],
      campaignTemplates: [
        { name: "موسم الحج", type: "awareness", duration: 14, channels: ["social"] },
      ],
    },
    {
      id: "back-to-school",
      title: "العودة للمدارس",
      titleEn: "Back to School",
      date: `${year}-08-25`,
      endDate: `${year}-09-15`,
      category: "education",
      description: "موسم العودة للمدارس",
      marketingTips: ["أدوات مدرسية", "ملابس مدرسية", "حقائب وأجهزة", "عروض الطلاب"],
      icon: GraduationCap,
      color: "bg-indigo-500",
      isOfficial: false,
      preparationDays: 21,
      suggestedBudget: { min: 30000, max: 120000, currency: "SAR" },
      impactLevel: "high",
      targetAudience: ["الآباء", "الطلاب", "المعلمين"],
      campaignTemplates: [
        { name: "عودة موفقة", type: "awareness", duration: 21, channels: ["social", "influencers", "outdoor"] },
        { name: "عروض المدارس", type: "promotional", duration: 14, channels: ["social", "email", "sms"] },
      ],
    },
    {
      id: "national-day",
      title: "اليوم الوطني السعودي",
      titleEn: "Saudi National Day",
      date: `${year}-09-23`,
      category: "national",
      description: "ذكرى توحيد المملكة العربية السعودية",
      marketingTips: ["عروض وطنية", "منتجات بألوان العلم", "فعاليات احتفالية", "خصومات 23%"],
      icon: Flag,
      color: "bg-green-600",
      isOfficial: true,
      preparationDays: 30,
      suggestedBudget: { min: 40000, max: 150000, currency: "SAR" },
      impactLevel: "high",
      targetAudience: ["الجميع", "العائلات", "الشباب"],
      campaignTemplates: [
        { name: "همة حتى القمة", type: "awareness", duration: 14, channels: ["tv", "social", "influencers", "outdoor"] },
        { name: "عروض 93", type: "promotional", duration: 7, channels: ["social", "email", "sms"] },
      ],
    },
    {
      id: "riyadh-season",
      title: "موسم الرياض",
      titleEn: "Riyadh Season",
      date: `${year}-10-15`,
      endDate: `${year + 1}-02-28`,
      category: "commercial",
      description: "أكبر موسم ترفيهي في المملكة",
      marketingTips: ["شراكات مع الفعاليات", "عروض خاصة", "تجارب تفاعلية", "حملات رقمية مكثفة"],
      icon: Sparkles,
      color: "bg-purple-600",
      isOfficial: false,
      preparationDays: 45,
      suggestedBudget: { min: 50000, max: 300000, currency: "SAR" },
      impactLevel: "high",
      targetAudience: ["السياح", "العائلات", "الشباب"],
      campaignTemplates: [
        { name: "موسم الرياض", type: "awareness", duration: 120, channels: ["tv", "social", "influencers", "outdoor"] },
        { name: "عروض الموسم", type: "promotional", duration: 60, channels: ["social", "email", "app"] },
      ],
    },
    {
      id: "singles-day",
      title: "يوم العزاب 11.11",
      titleEn: "Singles Day",
      date: `${year}-11-11`,
      category: "commercial",
      description: "أكبر يوم تسوق في العالم",
      marketingTips: ["خصومات كبيرة", "عروض فلاش", "شحن مجاني", "حملات رقمية"],
      icon: ShoppingBag,
      color: "bg-red-500",
      isOfficial: false,
      preparationDays: 14,
      suggestedBudget: { min: 20000, max: 80000, currency: "SAR" },
      impactLevel: "medium",
      targetAudience: ["المتسوقين", "الشباب"],
      campaignTemplates: [
        { name: "عروض 11.11", type: "promotional", duration: 3, channels: ["social", "email", "sms", "app"] },
      ],
    },
    {
      id: "black-friday",
      title: "الجمعة البيضاء",
      titleEn: "White Friday",
      date: `${year}-11-29`,
      endDate: `${year}-12-02`,
      category: "commercial",
      description: "موسم التخفيضات الكبرى",
      marketingTips: ["خصومات ضخمة", "عروض محدودة", "حملات إعلانية مكثفة", "تسويق عبر المؤثرين"],
      icon: ShoppingBag,
      color: "bg-gray-900",
      isOfficial: false,
      preparationDays: 21,
      suggestedBudget: { min: 40000, max: 150000, currency: "SAR" },
      impactLevel: "high",
      targetAudience: ["المتسوقين", "الجميع"],
      campaignTemplates: [
        { name: "الجمعة البيضاء", type: "promotional", duration: 7, channels: ["social", "email", "sms", "influencers"] },
        { name: "تيزر الجمعة البيضاء", type: "awareness", duration: 7, channels: ["social", "email"] },
      ],
    },
    {
      id: "winter-season",
      title: "موسم الشتاء",
      titleEn: "Winter Season",
      date: `${year}-12-21`,
      endDate: `${year + 1}-03-20`,
      category: "season",
      description: "فصل الشتاء - موسم التخييم والرحلات البرية",
      marketingTips: ["منتجات التخييم", "ملابس شتوية", "مشروبات ساخنة", "رحلات برية"],
      icon: Snowflake,
      color: "bg-cyan-500",
      isOfficial: false,
      preparationDays: 14,
      suggestedBudget: { min: 15000, max: 60000, currency: "SAR" },
      impactLevel: "medium",
      targetAudience: ["العائلات", "محبي الطبيعة", "المغامرين"],
      campaignTemplates: [
        { name: "شتاء دافئ", type: "awareness", duration: 90, channels: ["social", "influencers"] },
      ],
    },
    {
      id: "year-end",
      title: "نهاية السنة الميلادية",
      titleEn: "Year End",
      date: `${year}-12-31`,
      category: "commercial",
      description: "تصفيات نهاية العام",
      marketingTips: ["تصفيات المخزون", "عروض نهاية السنة", "ملخص العام", "خطط السنة الجديدة"],
      icon: Calendar,
      color: "bg-amber-500",
      isOfficial: false,
      preparationDays: 14,
      suggestedBudget: { min: 20000, max: 80000, currency: "SAR" },
      impactLevel: "medium",
      targetAudience: ["المتسوقين", "الشركات"],
      campaignTemplates: [
        { name: "تصفيات نهاية السنة", type: "promotional", duration: 14, channels: ["social", "email", "sms"] },
      ],
    },
    {
      id: "mothers-day",
      title: "يوم الأم",
      titleEn: "Mother's Day",
      date: `${year}-03-21`,
      category: "social",
      description: "يوم تكريم الأمهات",
      marketingTips: ["هدايا للأمهات", "باقات ورود", "عروض سبا", "حلويات خاصة"],
      icon: Heart,
      color: "bg-rose-500",
      isOfficial: false,
      preparationDays: 14,
      suggestedBudget: { min: 10000, max: 40000, currency: "SAR" },
      impactLevel: "medium",
      targetAudience: ["الأبناء", "العائلات"],
      campaignTemplates: [
        { name: "شكراً أمي", type: "awareness", duration: 7, channels: ["social", "influencers"] },
        { name: "هدايا يوم الأم", type: "promotional", duration: 7, channels: ["social", "email"] },
      ],
    },
    {
      id: "fathers-day",
      title: "يوم الأب",
      titleEn: "Father's Day",
      date: `${year}-06-21`,
      category: "social",
      description: "يوم تكريم الآباء",
      marketingTips: ["هدايا للآباء", "منتجات رجالية", "تجارب خاصة"],
      icon: Heart,
      color: "bg-blue-600",
      isOfficial: false,
      preparationDays: 14,
      suggestedBudget: { min: 8000, max: 30000, currency: "SAR" },
      impactLevel: "low",
      targetAudience: ["الأبناء", "العائلات"],
      campaignTemplates: [
        { name: "شكراً أبي", type: "awareness", duration: 7, channels: ["social"] },
      ],
    },
    {
      id: "spring-break",
      title: "إجازة الربيع",
      titleEn: "Spring Break",
      date: `${year}-03-15`,
      endDate: `${year}-03-25`,
      category: "education",
      description: "إجازة منتصف العام الدراسي",
      marketingTips: ["أنشطة عائلية", "رحلات قصيرة", "فعاليات ترفيهية"],
      icon: Palmtree,
      color: "bg-lime-500",
      isOfficial: false,
      preparationDays: 14,
      suggestedBudget: { min: 15000, max: 50000, currency: "SAR" },
      impactLevel: "medium",
      targetAudience: ["العائلات", "الطلاب"],
      campaignTemplates: [
        { name: "إجازة ممتعة", type: "awareness", duration: 10, channels: ["social", "influencers"] },
      ],
    },
    {
      id: "midyear-sale",
      title: "تخفيضات منتصف العام",
      titleEn: "Mid-Year Sale",
      date: `${year}-06-15`,
      endDate: `${year}-06-30`,
      category: "commercial",
      description: "موسم تخفيضات منتصف السنة",
      marketingTips: ["تصفيات صيفية", "عروض موسمية", "خصومات متدرجة"],
      icon: ShoppingBag,
      color: "bg-rose-500",
      isOfficial: false,
      preparationDays: 14,
      suggestedBudget: { min: 25000, max: 100000, currency: "SAR" },
      impactLevel: "medium",
      targetAudience: ["المتسوقين", "الجميع"],
      campaignTemplates: [
        { name: "تخفيضات منتصف العام", type: "promotional", duration: 15, channels: ["social", "email", "sms"] },
      ],
    },
  ];
};

export default function MarketingCalendarPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCampaigns, setShowCampaigns] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showOccasions, setShowOccasions] = useState(true);
  const [occasionFilter, setOccasionFilter] = useState("all");
  const [selectedDayEvents, setSelectedDayEvents] = useState<UnifiedCalendarEvent[]>([]);
  const [isDayDialogOpen, setIsDayDialogOpen] = useState(false);
  const [selectedOccasion, setSelectedOccasion] = useState<SaudiOccasion | null>(null);
  const [isOccasionDialogOpen, setIsOccasionDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("calendar");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    eventType: "campaign_launch",
    startDate: "",
    endDate: "",
    allDay: true,
    notes: "",
  });

  const currentYear = currentDate.getFullYear();
  const saudiOccasions = useMemo(() => getSaudiOccasions(currentYear), [currentYear]);

  const { data: events = [], isLoading: eventsLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/marketing/calendar-events"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/calendar-events");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<MarketingCampaign[]>({
    queryKey: ["/api/marketing/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/campaigns");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<MarketingTask[]>({
    queryKey: ["/api/marketing/tasks"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/tasks");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const isLoading = eventsLoading || campaignsLoading || tasksLoading;

  const filteredOccasions = useMemo(() => {
    if (occasionFilter === "all") return saudiOccasions;
    return saudiOccasions.filter(o => o.category === occasionFilter);
  }, [saudiOccasions, occasionFilter]);

  const unifiedEvents = useMemo(() => {
    const unified: UnifiedCalendarEvent[] = [];

    if (showOccasions) {
      filteredOccasions.forEach(occasion => {
        unified.push({
          id: `occasion-${occasion.id}`,
          title: occasion.title,
          date: occasion.date,
          endDate: occasion.endDate,
          type: "occasion",
          color: occasion.color,
          source: "saudi_occasion",
          originalData: occasion,
          category: occasion.category,
        });
      });
    }

    if (showEvents) {
      events.forEach(event => {
        if (!event.startDate) return;
        const typeInfo = EVENT_TYPES.find(t => t.value === event.eventType) || EVENT_TYPES[EVENT_TYPES.length - 1];
        unified.push({
          id: `event-${event.id}`,
          title: event.title,
          date: event.startDate,
          endDate: event.endDate || undefined,
          type: "event",
          color: typeInfo.color,
          source: "calendar",
          originalData: event,
        });
      });
    }

    if (showCampaigns) {
      campaigns.forEach(campaign => {
        if (campaign.startDate) {
          unified.push({
            id: `campaign-start-${campaign.id}`,
            title: `بداية: ${campaign.nameAr || campaign.name}`,
            date: campaign.startDate,
            type: "campaign_start",
            color: "bg-green-500",
            source: "campaign",
            originalData: campaign,
          });
        }
        if (campaign.endDate) {
          unified.push({
            id: `campaign-end-${campaign.id}`,
            title: `نهاية: ${campaign.nameAr || campaign.name}`,
            date: campaign.endDate,
            type: "campaign_end",
            color: "bg-red-500",
            source: "campaign",
            originalData: campaign,
          });
        }
      });
    }

    if (showTasks) {
      tasks.filter(t => t.dueDate && t.status !== "completed").forEach(task => {
        const priorityColors: Record<string, string> = {
          urgent: "bg-red-600",
          high: "bg-orange-500",
          medium: "bg-blue-500",
          low: "bg-gray-500",
        };
        unified.push({
          id: `task-${task.id}`,
          title: `مهمة: ${task.title}`,
          date: task.dueDate!,
          type: "task",
          color: priorityColors[task.priority] || "bg-blue-500",
          source: "task",
          originalData: task,
        });
      });
    }

    return unified.filter(e => e.date && !isNaN(new Date(e.date).getTime()));
  }, [events, campaigns, tasks, filteredOccasions, showEvents, showCampaigns, showTasks, showOccasions]);

  const createEventMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/marketing/calendar-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل في إنشاء الحدث");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/calendar-events"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "تم إنشاء الحدث بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء الحدث", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      eventType: "campaign_launch",
      startDate: "",
      endDate: "",
      allDay: true,
      notes: "",
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    return { daysInMonth, startingDay };
  };

  const { daysInMonth, startingDay } = getDaysInMonth(currentDate);

  const getEventsForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return unifiedEvents.filter(e => {
      if (!e.date) return false;
      const startMatch = e.date.startsWith(dateStr);
      if (startMatch) return true;
      if (e.endDate) {
        const eventStart = new Date(e.date);
        const eventEnd = new Date(e.endDate);
        const checkDate = new Date(dateStr);
        return checkDate >= eventStart && checkDate <= eventEnd;
      }
      return false;
    });
  };

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = getEventsForDate(day);
    if (dayEvents.length > 0) {
      setSelectedDate(dateStr);
      setSelectedDayEvents(dayEvents);
      setIsDayDialogOpen(true);
    } else {
      setSelectedDate(dateStr);
      setFormData(prev => ({ ...prev, startDate: dateStr }));
      setIsAddDialogOpen(true);
    }
  };

  const handleAddEventFromDay = () => {
    setIsDayDialogOpen(false);
    if (selectedDate) {
      setFormData(prev => ({ ...prev, startDate: selectedDate }));
      setIsAddDialogOpen(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.startDate) {
      toast({ title: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    createEventMutation.mutate(formData);
  };

  const handleOccasionClick = (occasion: SaudiOccasion) => {
    setSelectedOccasion(occasion);
    setIsOccasionDialogOpen(true);
  };

  const createCampaignFromOccasion = () => {
    if (selectedOccasion) {
      const startDate = new Date(selectedOccasion.date);
      startDate.setDate(startDate.getDate() - 14);
      setFormData({
        title: `حملة ${selectedOccasion.title}`,
        description: selectedOccasion.description,
        eventType: "campaign_launch",
        startDate: startDate.toISOString().split('T')[0],
        endDate: selectedOccasion.date,
        allDay: true,
        notes: selectedOccasion.marketingTips.join('\n'),
      });
      setIsOccasionDialogOpen(false);
      setIsAddDialogOpen(true);
    }
  };

  const getEventTypeInfo = (type: string) => {
    return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[EVENT_TYPES.length - 1];
  };

  const today = new Date();
  const isToday = (day: number) => {
    return today.getFullYear() === currentDate.getFullYear() &&
           today.getMonth() === currentDate.getMonth() &&
           today.getDate() === day;
  };

  const getSourceIcon = (source: string, data?: any) => {
    if (source === "saudi_occasion" && data?.icon) {
      const Icon = data.icon;
      return <Icon className="w-3 h-3" />;
    }
    switch (source) {
      case "campaign": return <Megaphone className="w-3 h-3" />;
      case "task": return <ListTodo className="w-3 h-3" />;
      case "saudi_occasion": return <Star className="w-3 h-3" />;
      default: return <Calendar className="w-3 h-3" />;
    }
  };

  const upcomingOccasions = saudiOccasions
    .filter(o => new Date(o.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const day = formatNum(date.getDate());
    const month = MONTHS_AR[date.getMonth()];
    const year = formatNum(date.getFullYear());
    return `${day} ${month} ${year}`;
  };

  const getDaysUntil = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    const diffTime = eventDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const campaignCount = campaigns.filter(c => c.status === "active").length;
  const pendingTasksCount = tasks.filter(t => t.status !== "completed" && t.dueDate).length;
  const thisMonthOccasions = filteredOccasions.filter(o => {
    const date = new Date(o.date);
    return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
  });

  const getCategoryInfo = (category: string) => {
    return OCCASION_CATEGORIES.find(c => c.value === category) || OCCASION_CATEGORIES[0];
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/marketing">
              <Button variant="outline" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" data-testid="button-back">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold" data-testid="page-title">التقويم التسويقي</h1>
              <p className="text-sm text-muted-foreground">المناسبات والمواسم والحملات</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-11 sm:h-9" data-testid="button-add-event">
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة حدث
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إضافة حدث جديد</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>عنوان الحدث *</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="أدخل عنوان الحدث"
                      data-testid="input-event-title"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>نوع الحدث</Label>
                      <Select value={formData.eventType} onValueChange={(v) => setFormData({ ...formData, eventType: v })}>
                        <SelectTrigger data-testid="select-event-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EVENT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${type.color}`} />
                                {type.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>طوال اليوم</Label>
                      <div className="flex items-center gap-2 h-10">
                        <Switch
                          checked={formData.allDay}
                          onCheckedChange={(checked) => setFormData({ ...formData, allDay: checked })}
                        />
                        <span className="text-sm">{formData.allDay ? "نعم" : "لا"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>تاريخ البداية *</Label>
                      <Input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        data-testid="input-event-start-date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>تاريخ النهاية</Label>
                      <Input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        data-testid="input-event-end-date"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>الوصف</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="وصف الحدث"
                      rows={2}
                      data-testid="input-event-description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ملاحظات</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="ملاحظات إضافية"
                      rows={2}
                      data-testid="input-event-notes"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      إلغاء
                    </Button>
                    <Button type="submit" disabled={createEventMutation.isPending} data-testid="button-submit-event">
                      {createEventMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                  <Flag className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xl font-bold text-green-700">{thisMonthOccasions.length}</div>
                  <div className="text-xs text-muted-foreground">مناسبات هذا الشهر</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                  <Megaphone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xl font-bold text-amber-700">{campaignCount}</div>
                  <div className="text-xs text-muted-foreground">حملات نشطة</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                  <ListTodo className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xl font-bold text-blue-700">{pendingTasksCount}</div>
                  <div className="text-xs text-muted-foreground">مهام معلقة</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xl font-bold text-purple-700">{events.length}</div>
                  <div className="text-xs text-muted-foreground">أحداث مخصصة</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full sm:w-auto grid grid-cols-4 h-auto">
            <TabsTrigger value="calendar" className="gap-2 py-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">التقويم</span>
            </TabsTrigger>
            <TabsTrigger value="occasions" className="gap-2 py-2">
              <Star className="w-4 h-4" />
              <span className="hidden sm:inline">المناسبات</span>
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-2 py-2">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">القادمة</span>
            </TabsTrigger>
            <TabsTrigger value="compare" className="gap-2 py-2">
              <CalendarDays className="w-4 h-4" />
              <span className="hidden sm:inline">مقارنة</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-4">
            <div className="grid lg:grid-cols-4 gap-4">
              <div className="lg:col-span-3">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={goToPrevMonth} data-testid="button-prev-month">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={goToToday} data-testid="button-today">
                          اليوم
                        </Button>
                        <Button variant="outline" size="icon" onClick={goToNextMonth} data-testid="button-next-month">
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                      </div>
                      <h2 className="text-lg font-bold">
                        {MONTHS_AR[currentDate.getMonth()]} {currentDate.getFullYear()}
                      </h2>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-96 w-full" />
                    ) : (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="grid grid-cols-7 bg-muted/50">
                          {DAYS_AR.map((day) => (
                            <div key={day} className="p-2 text-center text-xs font-medium border-b">
                              {day}
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7">
                          {Array.from({ length: startingDay }).map((_, i) => (
                            <div key={`empty-${i}`} className="min-h-[80px] p-1 border-b border-l bg-muted/20" />
                          ))}
                          {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dayEvents = getEventsForDate(day);
                            const hasOccasion = dayEvents.some(e => e.source === "saudi_occasion");
                            return (
                              <div
                                key={day}
                                onClick={() => handleDayClick(day)}
                                className={`min-h-[80px] p-1 border-b border-l cursor-pointer transition-colors hover:bg-muted/50 ${
                                  isToday(day) ? "bg-amber-50 ring-2 ring-amber-400 ring-inset" : ""
                                } ${hasOccasion ? "bg-green-50/50" : ""}`}
                                data-testid={`calendar-day-${day}`}
                              >
                                <div className={`text-sm font-medium mb-1 ${isToday(day) ? "text-amber-600" : ""}`}>
                                  {day}
                                </div>
                                <div className="space-y-0.5">
                                  {dayEvents.slice(0, 3).map((event) => (
                                    <div
                                      key={event.id}
                                      className={`text-[10px] px-1 py-0.5 rounded truncate text-white flex items-center gap-1 ${event.color}`}
                                      title={event.title}
                                    >
                                      {getSourceIcon(event.source, event.originalData)}
                                      <span className="truncate">{event.title}</span>
                                    </div>
                                  ))}
                                  {dayEvents.length > 3 && (
                                    <div className="text-[10px] text-muted-foreground text-center">
                                      +{dayEvents.length - 3} المزيد
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      فلترة العرض
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-green-600" />
                        <span className="text-sm">المناسبات السعودية</span>
                      </div>
                      <Switch checked={showOccasions} onCheckedChange={setShowOccasions} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Megaphone className="w-4 h-4 text-amber-600" />
                        <span className="text-sm">الحملات</span>
                      </div>
                      <Switch checked={showCampaigns} onCheckedChange={setShowCampaigns} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ListTodo className="w-4 h-4 text-blue-600" />
                        <span className="text-sm">المهام</span>
                      </div>
                      <Switch checked={showTasks} onCheckedChange={setShowTasks} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-purple-600" />
                        <span className="text-sm">الأحداث</span>
                      </div>
                      <Switch checked={showEvents} onCheckedChange={setShowEvents} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">المناسبات القادمة</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {upcomingOccasions.map((occasion) => {
                        const daysUntil = getDaysUntil(occasion.date);
                        const Icon = occasion.icon;
                        return (
                          <div
                            key={occasion.id}
                            onClick={() => handleOccasionClick(occasion)}
                            className="p-2 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-lg ${occasion.color} flex items-center justify-center`}>
                                <Icon className="w-4 h-4 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{occasion.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {daysUntil === 0 ? "اليوم" : daysUntil === 1 ? "غداً" : `بعد ${formatNum(daysUntil)} يوم`}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="occasions" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500" />
                    تقويم المناسبات السعودية {formatNum(currentYear)}
                  </CardTitle>
                  <Select value={occasionFilter} onValueChange={setOccasionFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="تصفية حسب النوع" />
                    </SelectTrigger>
                    <SelectContent>
                      {OCCASION_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${cat.color}`} />
                            {cat.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOccasions.map((occasion) => {
                    const Icon = occasion.icon;
                    const daysUntil = getDaysUntil(occasion.date);
                    const isPast = daysUntil < 0;
                    const categoryInfo = getCategoryInfo(occasion.category);
                    return (
                      <Card
                        key={occasion.id}
                        onClick={() => handleOccasionClick(occasion)}
                        className={`cursor-pointer hover:shadow-md transition-all ${isPast ? "opacity-60" : ""}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`w-12 h-12 rounded-xl ${occasion.color} flex items-center justify-center flex-shrink-0`}>
                              <Icon className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold truncate">{occasion.title}</h3>
                                {occasion.isOfficial && (
                                  <Badge variant="secondary" className="text-xs">رسمي</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">{formatDate(occasion.date)}</p>
                              <Badge className={`${categoryInfo.color} text-white text-xs`}>
                                {categoryInfo.label}
                              </Badge>
                              {!isPast && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  {daysUntil === 0 ? "🎉 اليوم!" : daysUntil === 1 ? "⏰ غداً" : `📅 بعد ${formatNum(daysUntil)} يوم`}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upcoming" className="mt-4">
            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    الفرص التسويقية القادمة
                  </CardTitle>
                  <CardDescription>
                    خطط حملاتك مسبقاً استناداً للمناسبات القادمة
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {saudiOccasions
                        .filter(o => getDaysUntil(o.date) >= 0)
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map((occasion) => {
                          const Icon = occasion.icon;
                          const daysUntil = getDaysUntil(occasion.date);
                          return (
                            <div
                              key={occasion.id}
                              onClick={() => handleOccasionClick(occasion)}
                              className="p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/50 cursor-pointer transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg ${occasion.color} flex items-center justify-center`}>
                                  <Icon className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-medium">{occasion.title}</h4>
                                    <Badge variant={daysUntil <= 30 ? "destructive" : "secondary"} className="text-xs">
                                      {daysUntil === 0 ? "اليوم" : `${formatNum(daysUntil)} يوم`}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{formatDate(occasion.date)}</p>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {occasion.marketingTips.slice(0, 3).map((tip, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {tip}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-amber-500" />
                    توصيات الحملات
                  </CardTitle>
                  <CardDescription>
                    اقتراحات حملات بناءً على المناسبات القريبة
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {saudiOccasions
                        .filter(o => {
                          const days = getDaysUntil(o.date);
                          return days >= 0 && days <= 60;
                        })
                        .slice(0, 5)
                        .map((occasion) => {
                          const Icon = occasion.icon;
                          const daysUntil = getDaysUntil(occasion.date);
                          const prepDays = Math.max(0, daysUntil - 14);
                          return (
                            <Card key={occasion.id} className="bg-muted/30">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className={`w-8 h-8 rounded-lg ${occasion.color} flex items-center justify-center`}>
                                    <Icon className="w-4 h-4 text-white" />
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-sm">{occasion.title}</h4>
                                    <p className="text-xs text-muted-foreground">
                                      ابدأ التحضير {prepDays > 0 ? `خلال ${formatNum(prepDays)} يوم` : "الآن!"}
                                    </p>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-muted-foreground">أفكار للحملة:</p>
                                  <ul className="text-xs space-y-1">
                                    {occasion.marketingTips.map((tip, i) => (
                                      <li key={i} className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                        {tip}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <Button
                                  size="sm"
                                  className="w-full mt-3"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOccasion(occasion);
                                    createCampaignFromOccasion();
                                  }}
                                >
                                  <Plus className="w-3 h-3 ml-1" />
                                  إنشاء حملة
                                </Button>
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="compare" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-blue-500" />
                    مقارنة المناسبات بين السنوات
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{formatNum(currentYear - 1)}</Badge>
                    <span className="text-muted-foreground">vs</span>
                    <Badge variant="outline">{formatNum(currentYear)}</Badge>
                    <span className="text-muted-foreground">vs</span>
                    <Badge variant="outline">{formatNum(currentYear + 1)}</Badge>
                  </div>
                </div>
                <CardDescription>
                  قارن تواريخ المناسبات عبر السنوات للتخطيط المسبق
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {saudiOccasions.map((occasion) => {
                      const Icon = occasion.icon;
                      const prevYearOccasions = getSaudiOccasions(currentYear - 1);
                      const nextYearOccasions = getSaudiOccasions(currentYear + 1);
                      const prevOccasion = prevYearOccasions.find(o => o.id === occasion.id);
                      const nextOccasion = nextYearOccasions.find(o => o.id === occasion.id);
                      
                      return (
                        <Card key={occasion.id} className="overflow-hidden">
                          <div className={`${occasion.color} p-3 flex items-center gap-3`}>
                            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-white">{occasion.title}</h4>
                              <p className="text-xs text-white/80">{occasion.titleEn}</p>
                            </div>
                            <div className="mr-auto">
                              <Badge variant={occasion.impactLevel === 'high' ? 'destructive' : 'secondary'} className="bg-white/20 text-white border-0">
                                {occasion.impactLevel === 'high' ? 'تأثير عالي' : occasion.impactLevel === 'medium' ? 'تأثير متوسط' : 'تأثير منخفض'}
                              </Badge>
                            </div>
                          </div>
                          <CardContent className="p-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div className="text-center p-3 rounded-lg bg-muted/30">
                                <p className="text-xs text-muted-foreground mb-1">{formatNum(currentYear - 1)}</p>
                                <p className="font-medium text-sm">{prevOccasion ? formatDate(prevOccasion.date) : '-'}</p>
                                {prevOccasion?.endDate && (
                                  <p className="text-xs text-muted-foreground">حتى {formatDate(prevOccasion.endDate)}</p>
                                )}
                              </div>
                              <div className="text-center p-3 rounded-lg bg-primary/10 border-2 border-primary/20">
                                <p className="text-xs text-primary font-medium mb-1">{formatNum(currentYear)} (الحالي)</p>
                                <p className="font-bold text-sm">{formatDate(occasion.date)}</p>
                                {occasion.endDate && (
                                  <p className="text-xs text-muted-foreground">حتى {formatDate(occasion.endDate)}</p>
                                )}
                              </div>
                              <div className="text-center p-3 rounded-lg bg-muted/30">
                                <p className="text-xs text-muted-foreground mb-1">{formatNum(currentYear + 1)}</p>
                                <p className="font-medium text-sm">{nextOccasion ? formatDate(nextOccasion.date) : '-'}</p>
                                {nextOccasion?.endDate && (
                                  <p className="text-xs text-muted-foreground">حتى {formatDate(nextOccasion.endDate)}</p>
                                )}
                              </div>
                            </div>
                            <div className="mt-4 flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <DollarSign className="w-3 h-3" />
                                <span>الميزانية المقترحة: {occasion.suggestedBudget.min.toLocaleString('en-US')} - {occasion.suggestedBudget.max.toLocaleString('en-US')} {occasion.suggestedBudget.currency}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>ابدأ قبل {formatNum(occasion.preparationDays)} يوم</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isDayDialogOpen} onOpenChange={setIsDayDialogOpen}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>أحداث يوم {selectedDate ? formatDate(selectedDate) : ""}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {selectedDayEvents.map((event) => (
                  <div key={event.id} className="p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg ${event.color} flex items-center justify-center`}>
                        {getSourceIcon(event.source, event.originalData)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{event.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {event.source === "saudi_occasion" ? "مناسبة سعودية" :
                           event.source === "campaign" ? "حملة" :
                           event.source === "task" ? "مهمة" : "حدث"}
                        </p>
                      </div>
                    </div>
                    {event.source === "saudi_occasion" && event.originalData && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground">{event.originalData.description}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full"
                          onClick={() => {
                            setIsDayDialogOpen(false);
                            handleOccasionClick(event.originalData);
                          }}
                        >
                          عرض التفاصيل
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex justify-end">
              <Button onClick={handleAddEventFromDay}>
                <Plus className="w-4 h-4 ml-2" />
                إضافة حدث
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isOccasionDialogOpen} onOpenChange={setIsOccasionDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            {selectedOccasion && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-xl ${selectedOccasion.color} flex items-center justify-center`}>
                      <selectedOccasion.icon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl">{selectedOccasion.title}</DialogTitle>
                      <DialogDescription>{selectedOccasion.titleEn}</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <Card className="bg-muted/30">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Calendar className="w-4 h-4" />
                        التاريخ
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(selectedOccasion.date)}
                        {selectedOccasion.endDate && ` - ${formatDate(selectedOccasion.endDate)}`}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge className={`${getCategoryInfo(selectedOccasion.category).color} text-white`}>
                          {getCategoryInfo(selectedOccasion.category).label}
                        </Badge>
                        {selectedOccasion.isOfficial && (
                          <Badge variant="outline">إجازة رسمية</Badge>
                        )}
                        <Badge variant={selectedOccasion.impactLevel === 'high' ? 'destructive' : selectedOccasion.impactLevel === 'medium' ? 'default' : 'secondary'}>
                          تأثير {selectedOccasion.impactLevel === 'high' ? 'عالي' : selectedOccasion.impactLevel === 'medium' ? 'متوسط' : 'منخفض'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-muted/30">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <DollarSign className="w-4 h-4" />
                        الميزانية المقترحة
                      </div>
                      <div className="text-lg font-bold text-primary">
                        {selectedOccasion.suggestedBudget.min.toLocaleString('en-US')} - {selectedOccasion.suggestedBudget.max.toLocaleString('en-US')} {selectedOccasion.suggestedBudget.currency}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        ابدأ التحضير قبل {formatNum(selectedOccasion.preparationDays)} يوم
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4 mt-4">
                  <div>
                    <p className="text-sm font-medium mb-1">الوصف</p>
                    <p className="text-sm text-muted-foreground">{selectedOccasion.description}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      الجمهور المستهدف
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedOccasion.targetAudience.map((audience, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {audience}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      أفكار تسويقية
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedOccasion.marketingTips.map((tip, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {tip}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Megaphone className="w-4 h-4" />
                      قوالب الحملات الجاهزة
                    </p>
                    <div className="space-y-2">
                      {selectedOccasion.campaignTemplates.map((template, i) => (
                        <Card key={i} className="bg-white border">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{template.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {template.type === 'awareness' ? 'توعية' : template.type === 'promotional' ? 'ترويجي' : template.type === 'csr' ? 'مسؤولية اجتماعية' : template.type}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">{formatNum(template.duration)} يوم</span>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {template.channels.map((ch, ci) => (
                                    <span key={ci} className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                      {ch === 'social' ? 'سوشيال' : ch === 'email' ? 'إيميل' : ch === 'sms' ? 'رسائل' : ch === 'influencers' ? 'مؤثرين' : ch === 'outdoor' ? 'خارجي' : ch === 'tv' ? 'تلفزيون' : ch === 'app' ? 'التطبيق' : ch}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const startDate = new Date(selectedOccasion.date);
                                  startDate.setDate(startDate.getDate() - template.duration);
                                  setFormData({
                                    title: template.name,
                                    description: `حملة ${selectedOccasion.title} - ${template.type === 'awareness' ? 'توعية' : template.type === 'promotional' ? 'ترويجي' : template.type}`,
                                    eventType: template.type === 'promotional' ? 'promotion' : 'campaign_launch',
                                    startDate: startDate.toISOString().split('T')[0],
                                    endDate: selectedOccasion.date,
                                    allDay: true,
                                    notes: `القنوات: ${template.channels.join(', ')}\nالمدة: ${formatNum(template.duration)} يوم`,
                                  });
                                  setIsOccasionDialogOpen(false);
                                  setIsAddDialogOpen(true);
                                }}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <Bell className="w-4 h-4 text-amber-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-800">تنبيه التحضير</p>
                          <p className="text-xs text-amber-700">
                            يُنصح ببدء التحضير للحملة قبل {formatNum(selectedOccasion.preparationDays)} يوم من المناسبة
                            {getDaysUntil(selectedOccasion.date) > 0 && getDaysUntil(selectedOccasion.date) <= selectedOccasion.preparationDays && (
                              <span className="font-bold text-amber-900"> - حان وقت البدء الآن!</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const uid = `${selectedOccasion.id}-${Date.now()}@butter-bakery`;
                      const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
                      const dtstart = selectedOccasion.date.replace(/-/g, '');
                      const dtend = selectedOccasion.endDate 
                        ? new Date(new Date(selectedOccasion.endDate).getTime() + 86400000).toISOString().split('T')[0].replace(/-/g, '')
                        : new Date(new Date(selectedOccasion.date).getTime() + 86400000).toISOString().split('T')[0].replace(/-/g, '');
                      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Butter Bakery//Marketing Calendar//AR
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtstamp}
DTSTART;VALUE=DATE:${dtstart}
DTEND;VALUE=DATE:${dtend}
SUMMARY:${selectedOccasion.title}
DESCRIPTION:${selectedOccasion.description.replace(/\n/g, '\\n')}
END:VEVENT
END:VCALENDAR`;
                      const blob = new Blob([icsContent], { type: 'text/calendar' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${selectedOccasion.id}.ics`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({ title: "تم تصدير المناسبة للتقويم" });
                    }}
                  >
                    <Download className="w-4 h-4 ml-1" />
                    تصدير
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setIsOccasionDialogOpen(false)}>
                    إغلاق
                  </Button>
                  <Button className="flex-1" onClick={createCampaignFromOccasion}>
                    <Plus className="w-4 h-4 ml-2" />
                    إنشاء حملة
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
