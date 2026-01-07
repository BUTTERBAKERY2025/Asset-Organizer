import { useState, useRef, useMemo, useCallback } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
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
  Network,
  Plus,
  Edit,
  Trash2,
  Printer,
  Download,
  FileSpreadsheet,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Eye,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OrgJobRole } from "@shared/schema";

const ICON_MAP: Record<string, React.ReactNode> = {
  crown: <Crown className="h-5 w-5" />,
  star: <Star className="h-5 w-5" />,
  building: <Building2 className="h-5 w-5" />,
  users: <Users className="h-5 w-5" />,
  clipboard: <ClipboardList className="h-5 w-5" />,
  "user-circle": <UserCircle className="h-5 w-5" />,
  utensils: <Utensils className="h-5 w-5" />,
  "shopping-cart": <ShoppingCart className="h-5 w-5" />,
  coffee: <Coffee className="h-5 w-5" />,
  "clipboard-list": <ClipboardList className="h-5 w-5" />,
  "chef-hat": <ChefHat className="h-5 w-5" />,
  wrench: <Wrench className="h-5 w-5" />,
  user: <UserCircle className="h-5 w-5" />,
};

const SMALL_ICON_MAP: Record<string, React.ReactNode> = {
  crown: <Crown className="h-4 w-4" />,
  star: <Star className="h-4 w-4" />,
  building: <Building2 className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
  clipboard: <ClipboardList className="h-4 w-4" />,
  "user-circle": <UserCircle className="h-4 w-4" />,
  utensils: <Utensils className="h-4 w-4" />,
  "shopping-cart": <ShoppingCart className="h-4 w-4" />,
  coffee: <Coffee className="h-4 w-4" />,
  "clipboard-list": <ClipboardList className="h-4 w-4" />,
  "chef-hat": <ChefHat className="h-4 w-4" />,
  wrench: <Wrench className="h-4 w-4" />,
  user: <UserCircle className="h-4 w-4" />,
};

const COLOR_OPTIONS = [
  { value: "bg-amber-500", label: "ذهبي", gradient: "from-amber-400 to-amber-600" },
  { value: "bg-amber-400", label: "ذهبي فاتح", gradient: "from-amber-300 to-amber-500" },
  { value: "bg-orange-400", label: "برتقالي", gradient: "from-orange-300 to-orange-500" },
  { value: "bg-yellow-400", label: "أصفر", gradient: "from-yellow-300 to-yellow-500" },
  { value: "bg-lime-400", label: "ليموني", gradient: "from-lime-300 to-lime-500" },
  { value: "bg-green-400", label: "أخضر", gradient: "from-green-300 to-green-500" },
  { value: "bg-teal-400", label: "فيروزي", gradient: "from-teal-300 to-teal-500" },
  { value: "bg-cyan-400", label: "سماوي", gradient: "from-cyan-300 to-cyan-500" },
  { value: "bg-blue-400", label: "أزرق", gradient: "from-blue-300 to-blue-500" },
  { value: "bg-indigo-400", label: "نيلي", gradient: "from-indigo-300 to-indigo-500" },
  { value: "bg-purple-400", label: "بنفسجي", gradient: "from-purple-300 to-purple-500" },
  { value: "bg-pink-400", label: "وردي", gradient: "from-pink-300 to-pink-500" },
  { value: "bg-gray-400", label: "رمادي", gradient: "from-gray-300 to-gray-500" },
];

const ICON_OPTIONS = [
  { value: "crown", label: "تاج" },
  { value: "star", label: "نجمة" },
  { value: "building", label: "مبنى" },
  { value: "users", label: "مجموعة" },
  { value: "clipboard", label: "قائمة" },
  { value: "user-circle", label: "مستخدم" },
  { value: "utensils", label: "أدوات طعام" },
  { value: "shopping-cart", label: "سلة" },
  { value: "coffee", label: "قهوة" },
  { value: "chef-hat", label: "طاقية شيف" },
  { value: "wrench", label: "مفتاح" },
];

interface TreeNode extends OrgJobRole {
  children: TreeNode[];
  x?: number;
  y?: number;
}

function buildTree(roles: OrgJobRole[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];

  roles.forEach((role) => {
    map.set(role.id, { ...role, children: [] });
  });

  roles.forEach((role) => {
    const node = map.get(role.id)!;
    if (role.parentId && map.has(role.parentId)) {
      map.get(role.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortChildren = (node: TreeNode) => {
    node.children.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    node.children.forEach(sortChildren);
  };
  roots.forEach(sortChildren);

  return roots;
}

function OrgNode({
  node,
  scale,
  collapsedNodes,
  onToggleCollapse,
  onView,
  onEdit,
  onDelete,
  onAddChild,
}: {
  node: TreeNode;
  scale: number;
  collapsedNodes: Set<number>;
  onToggleCollapse: (id: number) => void;
  onView: (role: OrgJobRole) => void;
  onEdit: (role: OrgJobRole) => void;
  onDelete: (role: OrgJobRole) => void;
  onAddChild: (parentId: number) => void;
}) {
  const isCollapsed = collapsedNodes.has(node.id);
  const hasChildren = node.children.length > 0;
  const colorInfo = COLOR_OPTIONS.find(c => c.value === node.color) || COLOR_OPTIONS[0];

  return (
    <div className="flex flex-col items-center" data-testid={`node-${node.slug}`}>
      <div
        className="relative group"
        style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}
      >
        <div
          className="relative bg-white rounded-xl shadow-lg border-2 border-gray-100 hover:shadow-xl hover:border-amber-200 transition-all duration-300 cursor-pointer overflow-hidden"
          style={{ width: "180px" }}
        >
          <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${colorInfo.gradient}`} />
          
          <div className="p-4 pt-5">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorInfo.gradient} flex items-center justify-center text-white shadow-md`}>
                {ICON_MAP[node.icon || "user"]}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`menu-${node.slug}`}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => onView(node)} data-testid={`view-${node.slug}`}>
                    <Eye className="h-4 w-4 ml-2" />
                    عرض التفاصيل
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(node)} data-testid={`edit-${node.slug}`}>
                    <Edit className="h-4 w-4 ml-2" />
                    تعديل
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAddChild(node.id)} data-testid={`add-child-${node.slug}`}>
                    <Plus className="h-4 w-4 ml-2" />
                    إضافة تابع
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onDelete(node)} 
                    className="text-red-600"
                    data-testid={`delete-${node.slug}`}
                  >
                    <Trash2 className="h-4 w-4 ml-2" />
                    حذف
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2">
                {node.titleAr}
              </h3>
              <p className="text-xs text-gray-500 leading-tight" dir="ltr">
                {node.titleEn}
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <Badge 
                variant="outline" 
                className="text-[10px] px-2 py-0.5 bg-gray-50 text-gray-600 border-gray-200"
              >
                المستوى {node.level}
              </Badge>
              {hasChildren && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 rounded-full hover:bg-amber-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCollapse(node.id);
                  }}
                  data-testid={`toggle-${node.slug}`}
                >
                  {isCollapsed ? (
                    <ChevronDown className="h-4 w-4 text-amber-600" />
                  ) : (
                    <ChevronUp className="h-4 w-4 text-amber-600" />
                  )}
                </Button>
              )}
            </div>
          </div>

          {hasChildren && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm">
              {node.children.length} تابع
            </div>
          )}
        </div>
      </div>

      {hasChildren && !isCollapsed && (
        <>
          <div className="w-0.5 h-8 bg-gradient-to-b from-amber-400 to-amber-300" />
          
          <div className="relative">
            {node.children.length > 1 && (
              <div 
                className="absolute top-0 h-0.5 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-300"
                style={{
                  left: "50%",
                  right: "50%",
                  marginLeft: `-${(node.children.length - 1) * 100}px`,
                  marginRight: `-${(node.children.length - 1) * 100}px`,
                  width: `${(node.children.length - 1) * 200}px`,
                  transform: "translateX(-50%)",
                }}
              />
            )}
            
            <div className="flex gap-4 pt-0">
              {node.children.map((child, idx) => (
                <div key={child.id} className="flex flex-col items-center">
                  <div className="w-0.5 h-8 bg-gradient-to-b from-amber-300 to-amber-400" />
                  <OrgNode
                    node={child}
                    scale={scale}
                    collapsedNodes={collapsedNodes}
                    onToggleCollapse={onToggleCollapse}
                    onView={onView}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onAddChild={onAddChild}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RoleDetailsDialog({
  role,
  open,
  onClose,
}: {
  role: OrgJobRole | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!role) return null;

  const responsibilitiesAr = (role.responsibilitiesAr as string[]) || [];
  const responsibilitiesEn = (role.responsibilitiesEn as string[]) || [];
  const qualificationsAr = (role.qualificationsAr as string[]) || [];
  const qualificationsEn = (role.qualificationsEn as string[]) || [];
  const colorInfo = COLOR_OPTIONS.find(c => c.value === role.color) || COLOR_OPTIONS[0];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${colorInfo.gradient} flex items-center justify-center text-white shadow-lg`}>
              {ICON_MAP[role.icon || "user"]}
            </div>
            <div>
              <DialogTitle className="text-xl mb-1">{role.titleAr}</DialogTitle>
              <p className="text-sm text-gray-500" dir="ltr">{role.titleEn}</p>
              <Badge variant="outline" className="mt-2 text-xs">
                المستوى {role.level}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="arabic" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="arabic" data-testid="tab-arabic">العربية</TabsTrigger>
            <TabsTrigger value="english" data-testid="tab-english">English</TabsTrigger>
          </TabsList>

          <TabsContent value="arabic" className="space-y-4 mt-4">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-100">
              <p className="text-gray-700 leading-relaxed">{role.summaryAr}</p>
            </div>
            
            {responsibilitiesAr.length > 0 && (
              <div>
                <h4 className="font-bold text-amber-700 mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  المهام والمسؤوليات
                </h4>
                <div className="space-y-2">
                  {responsibilitiesAr.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {qualificationsAr.length > 0 && (
              <div>
                <h4 className="font-bold text-amber-700 mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  المؤهلات المطلوبة
                </h4>
                <div className="flex flex-wrap gap-2">
                  {qualificationsAr.map((item, idx) => (
                    <Badge key={idx} variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="english" className="space-y-4 mt-4">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-100">
              <p className="text-gray-700 leading-relaxed" dir="ltr">{role.summaryEn}</p>
            </div>
            
            {responsibilitiesEn.length > 0 && (
              <div>
                <h4 className="font-bold text-amber-700 mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Responsibilities
                </h4>
                <div className="space-y-2">
                  {responsibilitiesEn.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-white p-3 rounded-lg border border-gray-100 shadow-sm" dir="ltr">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {qualificationsEn.length > 0 && (
              <div>
                <h4 className="font-bold text-amber-700 mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Qualifications
                </h4>
                <div className="flex flex-wrap gap-2" dir="ltr">
                  {qualificationsEn.map((item, idx) => (
                    <Badge key={idx} variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-6 pt-4 border-t flex justify-between items-center">
          <Link href={`/branch-employees?jobTitle=${encodeURIComponent(role.titleAr)}`}>
            <Button variant="outline" className="gap-2" data-testid="btn-view-employees">
              <Users className="h-4 w-4" />
              عرض الموظفين
            </Button>
          </Link>
          <Button onClick={onClose} className="bg-amber-600 hover:bg-amber-700" data-testid="btn-close-dialog">
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RoleFormDialog({
  role,
  roles,
  parentId,
  open,
  onClose,
  onSave,
  isLoading,
}: {
  role: OrgJobRole | null;
  roles: OrgJobRole[];
  parentId: number | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  isLoading: boolean;
}) {
  const initialParentId = role?.parentId?.toString() || parentId?.toString() || "";
  const [formData, setFormData] = useState({
    slug: role?.slug || "",
    titleAr: role?.titleAr || "",
    titleEn: role?.titleEn || "",
    summaryAr: role?.summaryAr || "",
    summaryEn: role?.summaryEn || "",
    parentId: initialParentId,
    level: role?.level?.toString() || "1",
    orderIndex: role?.orderIndex?.toString() || "0",
    icon: role?.icon || "user",
    color: role?.color || "bg-amber-500",
    responsibilitiesAr: ((role?.responsibilitiesAr as string[]) || []).join("\n"),
    responsibilitiesEn: ((role?.responsibilitiesEn as string[]) || []).join("\n"),
    qualificationsAr: ((role?.qualificationsAr as string[]) || []).join("\n"),
    qualificationsEn: ((role?.qualificationsEn as string[]) || []).join("\n"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      slug: formData.slug || formData.titleEn.toLowerCase().replace(/\s+/g, "-"),
      titleAr: formData.titleAr,
      titleEn: formData.titleEn,
      summaryAr: formData.summaryAr,
      summaryEn: formData.summaryEn,
      parentId: formData.parentId ? parseInt(formData.parentId) : null,
      level: parseInt(formData.level) || 1,
      orderIndex: parseInt(formData.orderIndex) || 0,
      icon: formData.icon,
      color: formData.color,
      responsibilitiesAr: formData.responsibilitiesAr.split("\n").filter(Boolean),
      responsibilitiesEn: formData.responsibilitiesEn.split("\n").filter(Boolean),
      qualificationsAr: formData.qualificationsAr.split("\n").filter(Boolean),
      qualificationsEn: formData.qualificationsEn.split("\n").filter(Boolean),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {role ? "تعديل الوظيفة" : parentId ? "إضافة وظيفة تابعة" : "إضافة وظيفة جديدة"}
          </DialogTitle>
          <DialogDescription>أدخل بيانات الوظيفة بالعربية والإنجليزية</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="basic">البيانات الأساسية</TabsTrigger>
              <TabsTrigger value="responsibilities">المهام</TabsTrigger>
              <TabsTrigger value="qualifications">المؤهلات</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>المسمى الوظيفي (عربي) *</Label>
                  <Input
                    value={formData.titleAr}
                    onChange={(e) => setFormData({ ...formData, titleAr: e.target.value })}
                    placeholder="مدير الفرع"
                    required
                    className="h-10"
                    data-testid="input-title-ar"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Job Title (English) *</Label>
                  <Input
                    value={formData.titleEn}
                    onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
                    placeholder="Branch Manager"
                    required
                    dir="ltr"
                    className="h-10"
                    data-testid="input-title-en"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الوصف (عربي)</Label>
                  <Textarea
                    value={formData.summaryAr}
                    onChange={(e) => setFormData({ ...formData, summaryAr: e.target.value })}
                    placeholder="وصف مختصر للوظيفة"
                    rows={3}
                    data-testid="input-summary-ar"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (English)</Label>
                  <Textarea
                    value={formData.summaryEn}
                    onChange={(e) => setFormData({ ...formData, summaryEn: e.target.value })}
                    placeholder="Brief job description"
                    rows={3}
                    dir="ltr"
                    data-testid="input-summary-en"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>الوظيفة الأعلى</Label>
                  <Select
                    value={formData.parentId}
                    onValueChange={(v) => setFormData({ ...formData, parentId: v })}
                  >
                    <SelectTrigger data-testid="select-parent">
                      <SelectValue placeholder="بدون" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">بدون (أعلى مستوى)</SelectItem>
                      {roles.filter(r => r.id !== role?.id).map((r) => (
                        <SelectItem key={r.id} value={r.id.toString()}>{r.titleAr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>المستوى</Label>
                  <Input
                    type="number"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    min="1"
                    max="10"
                    data-testid="input-level"
                  />
                </div>
                <div className="space-y-2">
                  <Label>الأيقونة</Label>
                  <Select
                    value={formData.icon}
                    onValueChange={(v) => setFormData({ ...formData, icon: v })}
                  >
                    <SelectTrigger data-testid="select-icon">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-2">{SMALL_ICON_MAP[opt.value]} {opt.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>اللون</Label>
                  <Select
                    value={formData.color}
                    onValueChange={(v) => setFormData({ ...formData, color: v })}
                  >
                    <SelectTrigger data-testid="select-color">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-2">
                            <span className={`w-4 h-4 rounded-full bg-gradient-to-br ${opt.gradient}`} />
                            {opt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="responsibilities" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>المهام (عربي) - سطر لكل مهمة</Label>
                  <Textarea
                    value={formData.responsibilitiesAr}
                    onChange={(e) => setFormData({ ...formData, responsibilitiesAr: e.target.value })}
                    placeholder="إدارة العمليات اليومية&#10;تحقيق أهداف المبيعات&#10;إدارة فريق العمل"
                    rows={8}
                    data-testid="input-resp-ar"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Responsibilities (English) - one per line</Label>
                  <Textarea
                    value={formData.responsibilitiesEn}
                    onChange={(e) => setFormData({ ...formData, responsibilitiesEn: e.target.value })}
                    placeholder="Manage daily operations&#10;Achieve sales targets&#10;Manage team"
                    rows={8}
                    dir="ltr"
                    data-testid="input-resp-en"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="qualifications" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>المؤهلات (عربي) - سطر لكل مؤهل</Label>
                  <Textarea
                    value={formData.qualificationsAr}
                    onChange={(e) => setFormData({ ...formData, qualificationsAr: e.target.value })}
                    placeholder="خبرة 3 سنوات&#10;مهارات إدارية&#10;شهادة جامعية"
                    rows={6}
                    data-testid="input-qual-ar"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Qualifications (English) - one per line</Label>
                  <Textarea
                    value={formData.qualificationsEn}
                    onChange={(e) => setFormData({ ...formData, qualificationsEn: e.target.value })}
                    placeholder="3 years experience&#10;Management skills&#10;University degree"
                    rows={6}
                    dir="ltr"
                    data-testid="input-qual-en"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} data-testid="btn-cancel">
              إلغاء
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-amber-600 hover:bg-amber-700 min-w-[120px]" data-testid="btn-save">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              {role ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function OrganizationalStructurePage() {
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedRole, setSelectedRole] = useState<OrgJobRole | null>(null);
  const [editingRole, setEditingRole] = useState<OrgJobRole | null>(null);
  const [addChildParentId, setAddChildParentId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<OrgJobRole | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<number>>(new Set());
  const [scale, setScale] = useState(1);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["/api/org-job-roles"],
    queryFn: async () => {
      const res = await fetch("/api/org-job-roles");
      if (!res.ok) throw new Error("Failed to fetch roles");
      return res.json();
    },
  });

  const tree = useMemo(() => buildTree(roles), [roles]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/org-job-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-job-roles"] });
      setIsFormOpen(false);
      setEditingRole(null);
      setAddChildParentId(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/org-job-roles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-job-roles"] });
      setIsFormOpen(false);
      setEditingRole(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/org-job-roles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-job-roles"] });
      setDeleteConfirm(null);
    },
  });

  const handlePrint = useReactToPrint({ contentRef: printRef });

  const exportToExcel = () => {
    const data = roles.map((role: OrgJobRole) => ({
      "المستوى": role.level,
      "المسمى الوظيفي": role.titleAr,
      "Job Title": role.titleEn,
      "الوصف": role.summaryAr,
      "Description": role.summaryEn,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الهيكل الوظيفي");
    XLSX.writeFile(wb, `الهيكل_الوظيفي_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleSave = (data: any) => {
    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (role: OrgJobRole) => {
    setEditingRole(role);
    setAddChildParentId(null);
    setIsFormOpen(true);
  };

  const handleAddChild = (parentId: number) => {
    setEditingRole(null);
    setAddChildParentId(parentId);
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setEditingRole(null);
    setAddChildParentId(null);
    setIsFormOpen(true);
  };

  const toggleCollapse = useCallback((id: number) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const zoomIn = () => setScale(s => Math.min(s + 0.1, 1.5));
  const zoomOut = () => setScale(s => Math.max(s - 0.1, 0.5));
  const resetZoom = () => setScale(1);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-orange-50/20 print:bg-white" dir="rtl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6 print:hidden">
            <div className="flex items-center gap-4">
              <Link href="/branch-employees">
                <Button variant="outline" size="sm" className="gap-2 shadow-sm" data-testid="btn-back">
                  <ArrowLeft className="h-4 w-4" />
                  العودة
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Network className="h-7 w-7 text-amber-600" />
                  الهيكل الوظيفي
                </h1>
                <p className="text-sm text-gray-500">إدارة التشغيل - Butter Bakery</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white rounded-lg shadow-sm border p-1 gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={zoomOut} className="h-8 w-8 p-0" data-testid="btn-zoom-out">
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>تصغير</TooltipContent>
                </Tooltip>
                <span className="text-xs font-medium text-gray-600 min-w-[40px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={zoomIn} className="h-8 w-8 p-0" data-testid="btn-zoom-in">
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>تكبير</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={resetZoom} className="h-8 w-8 p-0" data-testid="btn-reset-zoom">
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>إعادة ضبط</TooltipContent>
                </Tooltip>
              </div>

              <Button variant="outline" size="sm" onClick={() => handlePrint()} className="gap-2 shadow-sm" data-testid="btn-print">
                <Printer className="h-4 w-4" />
                طباعة
              </Button>
              <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-2 shadow-sm" data-testid="btn-export">
                <FileSpreadsheet className="h-4 w-4" />
                تصدير Excel
              </Button>
              <Button size="sm" onClick={handleAdd} className="bg-amber-600 hover:bg-amber-700 gap-2 shadow-sm" data-testid="btn-add">
                <Plus className="h-4 w-4" />
                إضافة وظيفة
              </Button>
            </div>
          </div>

          <div ref={printRef} className="print:p-4">
            <div className="hidden print:block text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800">الهيكل الوظيفي</h1>
              <p className="text-gray-600">إدارة التشغيل - Butter Bakery</p>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Loader2 className="h-12 w-12 animate-spin text-amber-600 mb-4" />
                <p className="text-gray-500">جاري تحميل الهيكل الوظيفي...</p>
              </div>
            ) : tree.length === 0 ? (
              <Card className="text-center py-16 bg-white/80 backdrop-blur border-dashed border-2 border-gray-200">
                <CardContent>
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
                    <Network className="h-10 w-10 text-amber-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">لا توجد وظائف</h3>
                  <p className="text-gray-500 mb-6">ابدأ بإضافة الوظيفة الأولى في الهيكل الوظيفي</p>
                  <Button onClick={handleAdd} className="bg-amber-600 hover:bg-amber-700 gap-2" data-testid="btn-add-first">
                    <Plus className="h-4 w-4" />
                    إضافة أول وظيفة
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white/60 backdrop-blur shadow-xl border-0 overflow-hidden" data-testid="card-hierarchy">
                <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-4">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-3 text-lg">
                      <Crown className="h-6 w-6" />
                      التسلسل الهرمي الوظيفي
                    </span>
                    <Badge className="bg-white/20 text-white border-white/30 text-sm">
                      {roles.length} وظيفة
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 overflow-x-auto">
                  <div className="flex justify-center min-w-max py-4">
                    {tree.map((node) => (
                      <OrgNode
                        key={node.id}
                        node={node}
                        scale={scale}
                        collapsedNodes={collapsedNodes}
                        onToggleCollapse={toggleCollapse}
                        onView={setSelectedRole}
                        onEdit={handleEdit}
                        onDelete={setDeleteConfirm}
                        onAddChild={handleAddChild}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="mt-6 grid grid-cols-3 gap-4 print:hidden">
              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-md">
                      <Crown className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">الإدارة العليا</p>
                      <p className="text-sm text-gray-600">المستوى 1-3</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white shadow-md">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">الإدارة الوسطى</p>
                      <p className="text-sm text-gray-600">المستوى 4-6</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white shadow-md">
                      <Wrench className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">الموظفين التنفيذيين</p>
                      <p className="text-sm text-gray-600">المستوى 7-9</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <RoleDetailsDialog
            role={selectedRole}
            open={!!selectedRole}
            onClose={() => setSelectedRole(null)}
          />

          <RoleFormDialog
            role={editingRole}
            roles={roles}
            parentId={addChildParentId}
            open={isFormOpen}
            onClose={() => { setIsFormOpen(false); setEditingRole(null); setAddChildParentId(null); }}
            onSave={handleSave}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />

          <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <Trash2 className="h-5 w-5" />
                  تأكيد الحذف
                </DialogTitle>
                <DialogDescription className="pt-4">
                  هل أنت متأكد من حذف وظيفة <strong>"{deleteConfirm?.titleAr}"</strong>؟
                  <br />
                  <span className="text-red-500 text-sm">لا يمكن التراجع عن هذا الإجراء.</span>
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)} data-testid="btn-cancel-delete">
                  إلغاء
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
                  disabled={deleteMutation.isPending}
                  className="min-w-[100px]"
                  data-testid="btn-confirm-delete"
                >
                  {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                  حذف
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </TooltipProvider>
  );
}
