import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
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
  FileSpreadsheet,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OrgJobRole } from "@shared/schema";

const NODE_WIDTH = 100;
const NODE_HEIGHT = 120;
const HORIZONTAL_GAP = 40;
const VERTICAL_GAP = 80;

interface TreeNode extends OrgJobRole {
  children: TreeNode[];
  x?: number;
  y?: number;
  width?: number;
}

interface LayoutNode {
  node: TreeNode;
  x: number;
  y: number;
}

interface Edge {
  from: { x: number; y: number };
  to: { x: number; y: number };
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

function computeSubtreeWidth(node: TreeNode): number {
  if (node.children.length === 0) {
    return NODE_WIDTH;
  }
  const childrenWidth = node.children.reduce(
    (sum, child) => sum + computeSubtreeWidth(child) + HORIZONTAL_GAP,
    -HORIZONTAL_GAP
  );
  return Math.max(NODE_WIDTH, childrenWidth);
}

function layoutTree(
  node: TreeNode,
  x: number,
  y: number,
  nodes: LayoutNode[],
  edges: Edge[]
): number {
  const subtreeWidth = computeSubtreeWidth(node);
  const nodeX = x + subtreeWidth / 2;
  const nodeY = y;

  nodes.push({ node, x: nodeX, y: nodeY });

  if (node.children.length > 0) {
    let childX = x;
    node.children.forEach((child) => {
      const childWidth = computeSubtreeWidth(child);
      const childCenterX = childX + childWidth / 2;
      const childY = nodeY + NODE_HEIGHT + VERTICAL_GAP;

      edges.push({
        from: { x: nodeX, y: nodeY + NODE_HEIGHT / 2 + 30 },
        to: { x: childCenterX, y: childY },
      });

      layoutTree(child, childX, childY, nodes, edges);
      childX += childWidth + HORIZONTAL_GAP;
    });
  }

  return subtreeWidth;
}

function computeLayout(tree: TreeNode[]): { nodes: LayoutNode[]; edges: Edge[]; width: number; height: number } {
  const nodes: LayoutNode[] = [];
  const edges: Edge[] = [];
  let x = 50;
  let maxHeight = 0;

  tree.forEach((root) => {
    const width = layoutTree(root, x, 50, nodes, edges);
    x += width + HORIZONTAL_GAP * 2;
  });

  nodes.forEach((n) => {
    maxHeight = Math.max(maxHeight, n.y + NODE_HEIGHT + 50);
  });

  return { nodes, edges, width: x, height: maxHeight };
}

function OrgChartSVG({
  tree,
  scale,
  onView,
  onEdit,
  onDelete,
  onAddChild,
}: {
  tree: TreeNode[];
  scale: number;
  onView: (role: OrgJobRole) => void;
  onEdit: (role: OrgJobRole) => void;
  onDelete: (role: OrgJobRole) => void;
  onAddChild: (parentId: number) => void;
}) {
  const { nodes, edges, width, height } = useMemo(() => computeLayout(tree), [tree]);

  return (
    <div 
      className="relative overflow-auto"
      style={{ 
        transform: `scale(${scale})`, 
        transformOrigin: "top center",
        minHeight: height,
      }}
    >
      <svg
        width={width}
        height={height}
        className="absolute top-0 left-0"
        style={{ zIndex: 0 }}
      >
        {edges.map((edge, idx) => {
          const midY = (edge.from.y + edge.to.y) / 2;
          return (
            <path
              key={idx}
              d={`M ${edge.from.x} ${edge.from.y} 
                  C ${edge.from.x} ${midY}, 
                    ${edge.to.x} ${midY}, 
                    ${edge.to.x} ${edge.to.y}`}
              stroke="#10b981"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {nodes.map(({ node, x, y }) => (
        <OrgNode
          key={node.id}
          node={node}
          x={x}
          y={y}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
        />
      ))}
    </div>
  );
}

function OrgNode({
  node,
  x,
  y,
  onView,
  onEdit,
  onDelete,
  onAddChild,
}: {
  node: TreeNode;
  x: number;
  y: number;
  onView: (role: OrgJobRole) => void;
  onEdit: (role: OrgJobRole) => void;
  onDelete: (role: OrgJobRole) => void;
  onAddChild: (parentId: number) => void;
}) {
  const getGradient = (color: string) => {
    const colorMap: Record<string, { from: string; to: string; ring: string }> = {
      "bg-green-400": { from: "#34d399", to: "#059669", ring: "#10b981" },
      "bg-teal-400": { from: "#2dd4bf", to: "#0d9488", ring: "#14b8a6" },
      "bg-cyan-400": { from: "#22d3ee", to: "#0891b2", ring: "#06b6d4" },
      "bg-blue-400": { from: "#60a5fa", to: "#2563eb", ring: "#3b82f6" },
      "bg-indigo-400": { from: "#818cf8", to: "#4f46e5", ring: "#6366f1" },
      "bg-purple-400": { from: "#c084fc", to: "#9333ea", ring: "#a855f7" },
      "bg-amber-500": { from: "#fbbf24", to: "#d97706", ring: "#f59e0b" },
      "bg-amber-400": { from: "#fcd34d", to: "#f59e0b", ring: "#fbbf24" },
      "bg-orange-400": { from: "#fb923c", to: "#ea580c", ring: "#f97316" },
    };
    return colorMap[color] || colorMap["bg-green-400"];
  };

  const colors = getGradient(node.color || "bg-green-400");

  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        left: x - NODE_WIDTH / 2,
        top: y,
        width: NODE_WIDTH,
        zIndex: 1,
      }}
      data-testid={`node-${node.slug}`}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="focus:outline-none group">
            <div
              className="relative w-16 h-16 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
                boxShadow: `0 0 0 4px white, 0 0 0 6px ${colors.ring}`,
              }}
            >
              <User className="h-7 w-7 text-white" />
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-40">
          <DropdownMenuItem onClick={() => onView(node)} className="text-xs gap-2" data-testid={`view-${node.slug}`}>
            <Eye className="h-3 w-3" /> عرض التفاصيل
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(node)} className="text-xs gap-2" data-testid={`edit-${node.slug}`}>
            <Edit className="h-3 w-3" /> تعديل
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddChild(node.id)} className="text-xs gap-2" data-testid={`add-child-${node.slug}`}>
            <Plus className="h-3 w-3" /> إضافة تابع
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDelete(node)} className="text-xs gap-2 text-red-600" data-testid={`delete-${node.slug}`}>
            <Trash2 className="h-3 w-3" /> حذف
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mt-2 text-center">
        <p className="font-bold text-gray-800 text-xs leading-tight">{node.titleAr}</p>
        <p className="text-[10px] text-gray-500" dir="ltr">{node.titleEn}</p>
      </div>
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white shadow-lg ring-4 ring-green-200">
              <User className="h-7 w-7" />
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
            <TabsTrigger value="arabic">العربية</TabsTrigger>
            <TabsTrigger value="english">English</TabsTrigger>
          </TabsList>

          <TabsContent value="arabic" className="space-y-4 mt-4">
            <div className="bg-gradient-to-r from-green-50 to-teal-50 p-4 rounded-xl border border-green-100">
              <p className="text-gray-700 leading-relaxed text-sm">{role.summaryAr}</p>
            </div>
            
            {responsibilitiesAr.length > 0 && (
              <div>
                <h4 className="font-bold text-green-700 mb-3 flex items-center gap-2 text-sm">
                  <ClipboardList className="h-4 w-4" />
                  المهام والمسؤوليات
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {responsibilitiesAr.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-white p-2 rounded-lg border border-gray-100">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-700 text-[10px] flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-xs text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {qualificationsAr.length > 0 && (
              <div>
                <h4 className="font-bold text-green-700 mb-2 flex items-center gap-2 text-sm">
                  <Star className="h-4 w-4" />
                  المؤهلات
                </h4>
                <div className="flex flex-wrap gap-1">
                  {qualificationsAr.map((item, idx) => (
                    <Badge key={idx} variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="english" className="space-y-4 mt-4">
            <div className="bg-gradient-to-r from-green-50 to-teal-50 p-4 rounded-xl border border-green-100">
              <p className="text-gray-700 leading-relaxed text-sm" dir="ltr">{role.summaryEn}</p>
            </div>
            
            {responsibilitiesEn.length > 0 && (
              <div>
                <h4 className="font-bold text-green-700 mb-3 flex items-center gap-2 text-sm">
                  <ClipboardList className="h-4 w-4" />
                  Responsibilities
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {responsibilitiesEn.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-white p-2 rounded-lg border border-gray-100" dir="ltr">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-700 text-[10px] flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-xs text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {qualificationsEn.length > 0 && (
              <div>
                <h4 className="font-bold text-green-700 mb-2 flex items-center gap-2 text-sm">
                  <Star className="h-4 w-4" />
                  Qualifications
                </h4>
                <div className="flex flex-wrap gap-1" dir="ltr">
                  {qualificationsEn.map((item, idx) => (
                    <Badge key={idx} variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-4 pt-4 border-t flex justify-between items-center">
          <Link href={`/branch-employees?jobTitle=${encodeURIComponent(role.titleAr)}`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Users className="h-4 w-4" />
              عرض الموظفين
            </Button>
          </Link>
          <Button onClick={onClose} size="sm" className="bg-green-600 hover:bg-green-700">
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
  const getInitialFormData = useCallback(() => {
    const initialParentId = role?.parentId?.toString() || parentId?.toString() || "";
    return {
      slug: role?.slug || "",
      titleAr: role?.titleAr || "",
      titleEn: role?.titleEn || "",
      summaryAr: role?.summaryAr || "",
      summaryEn: role?.summaryEn || "",
      parentId: initialParentId,
      level: role?.level?.toString() || "1",
      orderIndex: role?.orderIndex?.toString() || "0",
      icon: role?.icon || "user",
      color: role?.color || "bg-green-400",
      responsibilitiesAr: ((role?.responsibilitiesAr as string[]) || []).join("\n"),
      responsibilitiesEn: ((role?.responsibilitiesEn as string[]) || []).join("\n"),
      qualificationsAr: ((role?.qualificationsAr as string[]) || []).join("\n"),
      qualificationsEn: ((role?.qualificationsEn as string[]) || []).join("\n"),
    };
  }, [role, parentId]);

  const [formData, setFormData] = useState(getInitialFormData);

  useEffect(() => {
    if (open) {
      setFormData(getInitialFormData());
    }
  }, [open, getInitialFormData]);

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

  const colorOptions = [
    { value: "bg-green-400", label: "أخضر", gradient: "from-green-400 to-green-600" },
    { value: "bg-teal-400", label: "فيروزي", gradient: "from-teal-400 to-teal-600" },
    { value: "bg-cyan-400", label: "سماوي", gradient: "from-cyan-400 to-cyan-600" },
    { value: "bg-blue-400", label: "أزرق", gradient: "from-blue-400 to-blue-600" },
    { value: "bg-indigo-400", label: "نيلي", gradient: "from-indigo-400 to-indigo-600" },
    { value: "bg-purple-400", label: "بنفسجي", gradient: "from-purple-400 to-purple-600" },
    { value: "bg-amber-500", label: "ذهبي", gradient: "from-amber-400 to-amber-600" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {role ? "تعديل الوظيفة" : parentId ? "إضافة وظيفة تابعة" : "إضافة وظيفة جديدة"}
          </DialogTitle>
          <DialogDescription>أدخل بيانات الوظيفة</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الوصف (عربي)</Label>
                  <Textarea
                    value={formData.summaryAr}
                    onChange={(e) => setFormData({ ...formData, summaryAr: e.target.value })}
                    placeholder="وصف الوظيفة"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (English)</Label>
                  <Textarea
                    value={formData.summaryEn}
                    onChange={(e) => setFormData({ ...formData, summaryEn: e.target.value })}
                    placeholder="Job description"
                    rows={2}
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>الوظيفة الأعلى</Label>
                  <Select
                    value={formData.parentId}
                    onValueChange={(v) => setFormData({ ...formData, parentId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="بدون" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">بدون</SelectItem>
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
                  />
                </div>
                <div className="space-y-2">
                  <Label>اللون</Label>
                  <Select
                    value={formData.color}
                    onValueChange={(v) => setFormData({ ...formData, color: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {colorOptions.map((opt) => (
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
                    rows={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Responsibilities (English)</Label>
                  <Textarea
                    value={formData.responsibilitiesEn}
                    onChange={(e) => setFormData({ ...formData, responsibilitiesEn: e.target.value })}
                    rows={8}
                    dir="ltr"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="qualifications" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>المؤهلات (عربي)</Label>
                  <Textarea
                    value={formData.qualificationsAr}
                    onChange={(e) => setFormData({ ...formData, qualificationsAr: e.target.value })}
                    rows={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Qualifications (English)</Label>
                  <Textarea
                    value={formData.qualificationsEn}
                    onChange={(e) => setFormData({ ...formData, qualificationsEn: e.target.value })}
                    rows={6}
                    dir="ltr"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-green-600 hover:bg-green-700 min-w-[100px]">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              {role ? "حفظ" : "إضافة"}
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
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الهيكل");
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

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-teal-50/20 print:bg-white" dir="rtl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6 print:hidden">
            <div className="flex items-center gap-4">
              <Link href="/branch-employees">
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  العودة
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Network className="h-6 w-6 text-green-600" />
                  الهيكل الوظيفي
                </h1>
                <p className="text-sm text-gray-500">إدارة التشغيل - Butter Bakery</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white rounded-lg shadow-sm border p-1 gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => setScale(s => Math.max(s - 0.1, 0.5))} className="h-8 w-8 p-0">
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
                    <Button variant="ghost" size="sm" onClick={() => setScale(s => Math.min(s + 0.1, 1.5))} className="h-8 w-8 p-0">
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>تكبير</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => setScale(1)} className="h-8 w-8 p-0">
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>إعادة ضبط</TooltipContent>
                </Tooltip>
              </div>

              <Button variant="outline" size="sm" onClick={() => handlePrint()} className="gap-2">
                <Printer className="h-4 w-4" />
                طباعة
              </Button>
              <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                تصدير
              </Button>
              <Button size="sm" onClick={handleAdd} className="bg-green-600 hover:bg-green-700 gap-2">
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
                <Loader2 className="h-12 w-12 animate-spin text-green-600 mb-4" />
                <p className="text-gray-500">جاري التحميل...</p>
              </div>
            ) : tree.length === 0 ? (
              <Card className="text-center py-16 bg-white/80 border-dashed border-2 border-gray-200">
                <CardContent>
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                    <Network className="h-10 w-10 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">لا توجد وظائف</h3>
                  <p className="text-gray-500 mb-6">ابدأ بإضافة الوظيفة الأولى</p>
                  <Button onClick={handleAdd} className="bg-green-600 hover:bg-green-700 gap-2">
                    <Plus className="h-4 w-4" />
                    إضافة أول وظيفة
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-3 space-y-4 print:hidden">
                  <Card className="bg-gradient-to-br from-green-500 to-teal-500 text-white shadow-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                          <Users className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{roles.length}</p>
                          <p className="text-sm opacity-90">إجمالي الوظائف</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                          <Building2 className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{Math.max(...roles.map((r: OrgJobRole) => r.level || 1))}</p>
                          <p className="text-sm opacity-90">عدد المستويات</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                          <Crown className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{tree.length}</p>
                          <p className="text-sm opacity-90">مناصب إدارية عليا</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/90 shadow-md">
                    <CardHeader className="pb-2 pt-3">
                      <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500" />
                        دليل الاستخدام
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-gray-600 space-y-2 pb-4">
                      <p className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        اضغط على الدائرة لفتح القائمة
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        استخدم التكبير/التصغير للتنقل
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        أضف وظائف تابعة من القائمة
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="col-span-6 print:col-span-12">
                  <Card className="bg-white/80 backdrop-blur shadow-xl border-0 overflow-hidden h-full">
                    <CardHeader className="bg-gradient-to-r from-green-500 to-teal-500 text-white py-3">
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-base">
                          <Crown className="h-5 w-5" />
                          التسلسل الهرمي الوظيفي
                        </span>
                        <Badge className="bg-white/20 text-white border-white/30 text-xs">
                          {roles.length} وظيفة
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 overflow-x-auto">
                      <OrgChartSVG
                        tree={tree}
                        scale={scale}
                        onView={setSelectedRole}
                        onEdit={handleEdit}
                        onDelete={setDeleteConfirm}
                        onAddChild={handleAddChild}
                      />
                    </CardContent>
                  </Card>
                </div>

                <div className="col-span-3 space-y-4 print:hidden">
                  <Card className="bg-white/90 shadow-md">
                    <CardHeader className="pb-2 pt-3">
                      <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-green-600" />
                        الوظائف الأخيرة
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="space-y-2">
                        {roles.slice(0, 5).map((role: OrgJobRole) => (
                          <div 
                            key={role.id} 
                            className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                            onClick={() => setSelectedRole(role)}
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center">
                              <User className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{role.titleAr}</p>
                              <p className="text-[10px] text-gray-500">المستوى {role.level}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
                    <CardContent className="p-4">
                      <div className="text-center">
                        <Network className="h-8 w-8 mx-auto mb-2 opacity-80" />
                        <p className="text-lg font-bold">Butter Bakery</p>
                        <p className="text-xs opacity-80">إدارة التشغيل</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/90 shadow-md">
                    <CardHeader className="pb-2 pt-3">
                      <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-blue-600" />
                        إجراءات سريعة
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4 space-y-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start gap-2 text-xs"
                        onClick={handleAdd}
                      >
                        <Plus className="h-3 w-3" />
                        إضافة وظيفة جديدة
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start gap-2 text-xs"
                        onClick={exportToExcel}
                      >
                        <FileSpreadsheet className="h-3 w-3" />
                        تصدير إلى Excel
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start gap-2 text-xs"
                        onClick={() => handlePrint()}
                      >
                        <Printer className="h-3 w-3" />
                        طباعة الهيكل
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
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
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                  إلغاء
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
                  disabled={deleteMutation.isPending}
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
