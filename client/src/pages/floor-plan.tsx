import { useState, useMemo, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LayoutGrid, Plus, Trash2, Save, GripVertical, User as UserIcon, Square } from "lucide-react";
import type { Branch } from "@shared/schema";

interface BranchEmployee {
  id: number;
  branchId: string;
  employeeName: string;
  jobTitle: string;
  department?: string | null;
  status?: string;
}
interface FloorPlanData {
  plan: { id: number; branchId: string; name: string | null; width: number; height: number; backgroundColor: string };
  zones: Array<{ id: number; name: string; color: string; x: number; y: number; width: number; height: number }>;
  assignments: Array<{ id: number; employeeId: number; role: string | null; notes: string | null; x: number; y: number }>;
  employees: BranchEmployee[];
}

const ZONE_COLORS = [
  { name: "أصفر", value: "#fde68a" },
  { name: "أزرق", value: "#bfdbfe" },
  { name: "أخضر", value: "#bbf7d0" },
  { name: "وردي", value: "#fbcfe8" },
  { name: "بنفسجي", value: "#ddd6fe" },
  { name: "برتقالي", value: "#fed7aa" },
  { name: "رمادي", value: "#e5e7eb" },
];

const COMMON_ROLES = [
  "مدير الفرع", "مشرف", "كاشير", "ويتر", "شيف", "مساعد شيف",
  "باريستا", "عامل نظافة", "مضيف", "أمين مخزن", "حلواني",
];

export default function FloorPlanPage() {
  const { activeBranch, allowedBranches, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Branch selection
  const { data: allBranches = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"] });
  const branches = useMemo(
    () => isAdmin ? allBranches : allBranches.filter(b => allowedBranches.some(ub => ub.branchId === b.id)),
    [allBranches, allowedBranches, isAdmin]
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  useEffect(() => {
    if (!selectedBranchId && (activeBranch?.id || branches[0]?.id)) {
      setSelectedBranchId(activeBranch?.id || branches[0].id);
    }
  }, [activeBranch, branches, selectedBranchId]);

  // Floor plan bundle
  const { data, isLoading } = useQuery<FloorPlanData>({
    queryKey: [`/api/floor-plans/${selectedBranchId}`],
    enabled: !!selectedBranchId,
  });

  // Dialogs state
  const [zoneDialog, setZoneDialog] = useState<{ mode: "create" | "edit"; x?: number; y?: number; id?: number; name?: string; color?: string; width?: number; height?: number } | null>(null);
  const [assignDialog, setAssignDialog] = useState<{ x: number; y: number; employeeId?: number } | null>(null);
  const [editAssignDialog, setEditAssignDialog] = useState<{ id: number; employeeName: string; role: string; notes: string } | null>(null);

  // ---- Mutations ----
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/floor-plans/${selectedBranchId}`] });

  const createZone = useMutation({
    mutationFn: async (body: any) => (await apiRequest("POST", `/api/floor-plans/${selectedBranchId}/zones`, body)).json(),
    onSuccess: () => { invalidate(); setZoneDialog(null); toast({ title: "تمت إضافة المنطقة" }); },
    onError: (e: any) => toast({ title: "فشل إضافة المنطقة", description: e?.message, variant: "destructive" }),
  });
  const updateZone = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) =>
      (await apiRequest("PATCH", `/api/floor-plans/${selectedBranchId}/zones/${id}`, body)).json(),
    onSuccess: () => { invalidate(); setZoneDialog(null); },
    onError: (e: any) => toast({ title: "فشل التحديث", description: e?.message, variant: "destructive" }),
  });
  const deleteZone = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/floor-plans/${selectedBranchId}/zones/${id}`)).json(),
    onSuccess: () => { invalidate(); setZoneDialog(null); toast({ title: "تم حذف المنطقة" }); },
  });

  const createAssignment = useMutation({
    mutationFn: async (body: any) => (await apiRequest("POST", `/api/floor-plans/${selectedBranchId}/assignments`, body)).json(),
    onSuccess: () => { invalidate(); setAssignDialog(null); toast({ title: "تم تعيين الموظف" }); },
    onError: (e: any) => toast({ title: "فشل التعيين", description: e?.message, variant: "destructive" }),
  });
  const updateAssignment = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) =>
      (await apiRequest("PATCH", `/api/floor-plans/${selectedBranchId}/assignments/${id}`, body)).json(),
    onSuccess: () => { invalidate(); setEditAssignDialog(null); },
    onError: (e: any) => toast({ title: "فشل التحديث", description: e?.message, variant: "destructive" }),
  });
  const deleteAssignment = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/floor-plans/${selectedBranchId}/assignments/${id}`)).json(),
    onSuccess: () => { invalidate(); setEditAssignDialog(null); toast({ title: "تم إزالة الموظف من المخطط" }); },
  });

  // ---- Drag & Drop helpers ----
  const getCanvasCoords = (e: React.DragEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.round((e as any).clientX - rect.left)),
      y: Math.max(0, Math.round((e as any).clientY - rect.top)),
    };
  };

  const onDropOnCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    const employeeIdStr = e.dataTransfer.getData("application/x-employee-id");
    const moveAssignIdStr = e.dataTransfer.getData("application/x-assignment-id");
    const moveZoneIdStr = e.dataTransfer.getData("application/x-zone-id");
    const { x, y } = getCanvasCoords(e);
    if (employeeIdStr) {
      const employeeId = parseInt(employeeIdStr, 10);
      const existing = data?.assignments.find(a => a.employeeId === employeeId);
      if (existing) {
        updateAssignment.mutate({ id: existing.id, body: { x, y } });
      } else {
        setAssignDialog({ x, y, employeeId });
      }
    } else if (moveAssignIdStr) {
      const id = parseInt(moveAssignIdStr, 10);
      const dx = parseInt(e.dataTransfer.getData("x-offset") || "0", 10);
      const dy = parseInt(e.dataTransfer.getData("y-offset") || "0", 10);
      updateAssignment.mutate({ id, body: { x: Math.max(0, x - dx), y: Math.max(0, y - dy) } });
    } else if (moveZoneIdStr) {
      const id = parseInt(moveZoneIdStr, 10);
      const dx = parseInt(e.dataTransfer.getData("x-offset") || "0", 10);
      const dy = parseInt(e.dataTransfer.getData("y-offset") || "0", 10);
      updateZone.mutate({ id, body: { x: Math.max(0, x - dx), y: Math.max(0, y - dy) } });
    }
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return; // only blank canvas clicks (not on a zone/pawn)
    if (unplacedEmployees.length === 0) return;
    const { x, y } = getCanvasCoords(e);
    setAssignDialog({ x, y });
  };

  // Employees that are NOT yet placed on the plan
  const placedEmployeeIds = new Set((data?.assignments || []).map(a => a.employeeId));
  const unplacedEmployees = (data?.employees || []).filter(e => !placedEmployeeIds.has(e.id));
  const employeeById = useMemo(() => {
    const m = new Map<number, BranchEmployee>();
    (data?.employees || []).forEach(e => m.set(e.id, e));
    return m;
  }, [data]);

  return (
    <Layout>
      <div className="container mx-auto p-4 space-y-4" dir="rtl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <LayoutGrid className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">مخطط أرضية الفرع</h1>
              <p className="text-sm text-muted-foreground">وزّع فريق العمل على مناطق الفرع بشكل مرئي</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="branch-sel" className="text-sm whitespace-nowrap">الفرع:</Label>
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger id="branch-sel" className="w-56" data-testid="select-branch">
                <SelectValue placeholder="اختر فرع" />
              </SelectTrigger>
              <SelectContent>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id} data-testid={`select-branch-${b.id}`}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!selectedBranchId ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">اختر فرعاً للبدء</CardContent></Card>
        ) : isLoading || !data ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">جارٍ التحميل...</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            {/* Sidebar */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Square className="w-4 h-4" /> الأدوات
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full justify-start" variant="outline" onClick={() => setZoneDialog({ mode: "create" })} data-testid="btn-add-zone">
                    <Plus className="w-4 h-4 ml-1" /> إضافة منطقة
                  </Button>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    اسحب موظفاً من الأسفل وأفلته على المخطط، أو اسحب المنطقة/الموظف لتحريكه، واضغط عليه لتعديله.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserIcon className="w-4 h-4" /> موظفو الفرع
                    <Badge variant="secondary" className="ms-auto">{unplacedEmployees.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[520px]">
                    <div className="p-3 space-y-1.5">
                      {unplacedEmployees.length === 0 ? (
                        <div className="text-center text-xs text-muted-foreground py-6">
                          {data.employees.length === 0 ? "لا يوجد موظفون نشطون بهذا الفرع" : "جميع الموظفين موزَّعون على المخطط"}
                        </div>
                      ) : unplacedEmployees.map(emp => (
                        <div
                          key={emp.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("application/x-employee-id", String(emp.id));
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          className="flex items-center gap-2 p-2 rounded-md border border-border bg-card hover:bg-accent hover:border-primary cursor-grab active:cursor-grabbing transition-colors"
                          data-testid={`employee-pill-${emp.id}`}
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{emp.employeeName}</div>
                            <div className="text-xs text-muted-foreground truncate">{emp.jobTitle}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Canvas */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">المخطط</CardTitle>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {data.plan.width} × {data.plan.height}  ·  المناطق: {data.zones.length}  ·  المعيَّنون: {data.assignments.length}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto bg-muted/30">
                  <div
                    ref={canvasRef}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                    onDrop={onDropOnCanvas}
                    onClick={onCanvasClick}
                    className="relative"
                    style={{
                      width: data.plan.width,
                      height: data.plan.height,
                      backgroundColor: data.plan.backgroundColor || "#f8fafc",
                      backgroundImage: "linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)",
                      backgroundSize: "40px 40px",
                    }}
                    data-testid="floor-plan-canvas"
                  >
                    {/* Zones */}
                    {data.zones.map(z => (
                      <div
                        key={z.id}
                        draggable
                        onDragStart={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          e.dataTransfer.setData("application/x-zone-id", String(z.id));
                          e.dataTransfer.setData("x-offset", String(Math.round(e.clientX - rect.left)));
                          e.dataTransfer.setData("y-offset", String(Math.round(e.clientY - rect.top)));
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoneDialog({ mode: "edit", id: z.id, name: z.name, color: z.color, width: z.width, height: z.height });
                        }}
                        className="absolute rounded-lg border-2 border-dashed cursor-grab active:cursor-grabbing flex items-start justify-start p-2 shadow-sm hover:shadow-md hover:border-solid transition-shadow"
                        style={{
                          left: z.x, top: z.y, width: z.width, height: z.height,
                          backgroundColor: z.color + "cc", borderColor: z.color,
                        }}
                        data-testid={`zone-${z.id}`}
                      >
                        <span className="text-xs font-semibold text-foreground/80 bg-white/70 px-1.5 py-0.5 rounded">{z.name}</span>
                      </div>
                    ))}

                    {/* Assignments (employee pawns) */}
                    {data.assignments.map(a => {
                      const emp = employeeById.get(a.employeeId);
                      if (!emp) return null;
                      const initials = emp.employeeName.split(" ").slice(0, 2).map(s => s[0]).join("");
                      return (
                        <div
                          key={a.id}
                          draggable
                          onDragStart={(e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            e.dataTransfer.setData("application/x-assignment-id", String(a.id));
                            e.dataTransfer.setData("x-offset", String(Math.round(e.clientX - rect.left)));
                            e.dataTransfer.setData("y-offset", String(Math.round(e.clientY - rect.top)));
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditAssignDialog({
                              id: a.id, employeeName: emp.employeeName,
                              role: a.role || emp.jobTitle || "", notes: a.notes || "",
                            });
                          }}
                          className="absolute z-10 flex flex-col items-center cursor-grab active:cursor-grabbing group"
                          style={{ left: a.x - 28, top: a.y - 28 }}
                          data-testid={`assignment-${a.id}`}
                        >
                          <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shadow-lg border-4 border-white group-hover:scale-110 transition-transform">
                            {initials || <UserIcon className="w-6 h-6" />}
                          </div>
                          <div className="mt-1 px-2 py-0.5 rounded-md bg-white/95 shadow text-[11px] font-medium text-center max-w-[120px] truncate">
                            {emp.employeeName}
                          </div>
                          {(a.role || emp.jobTitle) && (
                            <div className="mt-0.5 text-[10px] text-muted-foreground bg-white/80 px-1.5 py-0.5 rounded">
                              {a.role || emp.jobTitle}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Zone Dialog (create + edit) */}
        <Dialog open={!!zoneDialog} onOpenChange={(o) => { if (!o) setZoneDialog(null); }}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>{zoneDialog?.mode === "edit" ? "تعديل منطقة" : "إضافة منطقة"}</DialogTitle>
              <DialogDescription>المنطقة عبارة عن مستطيل ملوّن يمثّل قسماً في الفرع (مطبخ، صالة، باريستا...).</DialogDescription>
            </DialogHeader>
            <ZoneForm
              key={zoneDialog?.id ?? "new"}
              initial={zoneDialog || undefined}
              isEdit={zoneDialog?.mode === "edit"}
              onSubmit={(form) => {
                if (zoneDialog?.mode === "edit" && zoneDialog.id) {
                  updateZone.mutate({ id: zoneDialog.id, body: { name: form.name, color: form.color, width: form.width, height: form.height } });
                } else {
                  createZone.mutate({ name: form.name, color: form.color, x: zoneDialog?.x ?? 60, y: zoneDialog?.y ?? 60, width: form.width, height: form.height });
                }
              }}
              onDelete={zoneDialog?.mode === "edit" && zoneDialog.id ? () => deleteZone.mutate(zoneDialog.id!) : undefined}
              pending={createZone.isPending || updateZone.isPending || deleteZone.isPending}
            />
          </DialogContent>
        </Dialog>

        {/* Assign Dialog (place employee at click point) */}
        <Dialog open={!!assignDialog} onOpenChange={(o) => { if (!o) setAssignDialog(null); }}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>تعيين موظف</DialogTitle>
              <DialogDescription>اختر الموظف والوظيفة في هذا الموقع.</DialogDescription>
            </DialogHeader>
            <AssignForm
              employees={unplacedEmployees}
              presetEmployeeId={assignDialog?.employeeId}
              onSubmit={(form) => createAssignment.mutate({ ...form, x: assignDialog?.x, y: assignDialog?.y })}
              pending={createAssignment.isPending}
            />
          </DialogContent>
        </Dialog>

        {/* Edit existing assignment */}
        <Dialog open={!!editAssignDialog} onOpenChange={(o) => { if (!o) setEditAssignDialog(null); }}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>تعديل تعيين {editAssignDialog?.employeeName}</DialogTitle>
            </DialogHeader>
            {editAssignDialog && (
              <div className="space-y-3">
                <div>
                  <Label className="mb-1 block">الوظيفة في هذا الشِفت</Label>
                  <Select
                    value={editAssignDialog.role}
                    onValueChange={(v) => setEditAssignDialog({ ...editAssignDialog, role: v })}
                  >
                    <SelectTrigger data-testid="select-role-edit"><SelectValue placeholder="اختر..." /></SelectTrigger>
                    <SelectContent>
                      {COMMON_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block">ملاحظة</Label>
                  <Input
                    value={editAssignDialog.notes}
                    onChange={(e) => setEditAssignDialog({ ...editAssignDialog, notes: e.target.value })}
                    placeholder="اختياري"
                    data-testid="input-notes-edit"
                  />
                </div>
                <DialogFooter className="flex-row-reverse gap-2 sm:gap-2 sm:justify-between">
                  <Button
                    variant="destructive"
                    onClick={() => deleteAssignment.mutate(editAssignDialog.id)}
                    disabled={deleteAssignment.isPending}
                    data-testid="btn-remove-assignment"
                  >
                    <Trash2 className="w-4 h-4 ml-1" /> إزالة من المخطط
                  </Button>
                  <Button
                    onClick={() => updateAssignment.mutate({ id: editAssignDialog.id, body: { role: editAssignDialog.role, notes: editAssignDialog.notes } })}
                    disabled={updateAssignment.isPending}
                    data-testid="btn-save-assignment"
                  >
                    <Save className="w-4 h-4 ml-1" /> حفظ
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

function ZoneForm({ initial, isEdit, onSubmit, onDelete, pending }: {
  initial?: { name?: string; color?: string; width?: number; height?: number };
  isEdit?: boolean;
  onSubmit: (f: { name: string; color: string; width: number; height: number }) => void;
  onDelete?: () => void;
  pending?: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [color, setColor] = useState(initial?.color || ZONE_COLORS[0].value);
  const [width, setWidth] = useState(initial?.width ?? 220);
  const [height, setHeight] = useState(initial?.height ?? 160);
  return (
    <div className="space-y-3">
      <div>
        <Label className="mb-1 block">اسم المنطقة</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثل: المطبخ، الصالة، الكاشير..." data-testid="input-zone-name" />
      </div>
      <div>
        <Label className="mb-1 block">اللون</Label>
        <div className="flex flex-wrap gap-2">
          {ZONE_COLORS.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              className={`w-9 h-9 rounded-full border-2 transition-transform ${color === c.value ? "border-primary scale-110" : "border-transparent"}`}
              style={{ backgroundColor: c.value }}
              title={c.name}
              data-testid={`color-${c.value.replace("#","")}`}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="mb-1 block">العرض</Label>
          <Input type="number" value={width} onChange={e => setWidth(Math.max(60, parseInt(e.target.value) || 60))} data-testid="input-zone-width" />
        </div>
        <div><Label className="mb-1 block">الارتفاع</Label>
          <Input type="number" value={height} onChange={e => setHeight(Math.max(60, parseInt(e.target.value) || 60))} data-testid="input-zone-height" />
        </div>
      </div>
      <DialogFooter className="flex-row-reverse gap-2 sm:gap-2 sm:justify-between">
        {onDelete && (
          <Button variant="destructive" onClick={onDelete} disabled={pending} data-testid="btn-delete-zone">
            <Trash2 className="w-4 h-4 ml-1" /> حذف
          </Button>
        )}
        <Button onClick={() => name.trim() && onSubmit({ name: name.trim(), color, width, height })} disabled={!name.trim() || pending} data-testid="btn-save-zone">
          <Save className="w-4 h-4 ml-1" /> حفظ
        </Button>
      </DialogFooter>
    </div>
  );
}

function AssignForm({ employees, presetEmployeeId, onSubmit, pending }: {
  employees: BranchEmployee[];
  presetEmployeeId?: number;
  onSubmit: (f: { employeeId: number; role: string; notes: string }) => void;
  pending?: boolean;
}) {
  const [employeeId, setEmployeeId] = useState<string>(presetEmployeeId ? String(presetEmployeeId) : "");
  const selectedEmp = employees.find(e => e.id === parseInt(employeeId, 10));
  const [role, setRole] = useState<string>("");
  const [notes, setNotes] = useState("");
  useEffect(() => { if (selectedEmp && !role) setRole(selectedEmp.jobTitle || ""); }, [selectedEmp, role]);

  return (
    <div className="space-y-3">
      <div>
        <Label className="mb-1 block">الموظف</Label>
        <Select value={employeeId} onValueChange={setEmployeeId} disabled={!!presetEmployeeId}>
          <SelectTrigger data-testid="select-employee-assign"><SelectValue placeholder="اختر موظفاً..." /></SelectTrigger>
          <SelectContent>
            {employees.map(e => (
              <SelectItem key={e.id} value={String(e.id)}>{e.employeeName} — {e.jobTitle}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="mb-1 block">الوظيفة في هذا الشِفت</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger data-testid="select-role-assign"><SelectValue placeholder="اختر..." /></SelectTrigger>
          <SelectContent>
            {COMMON_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            {selectedEmp?.jobTitle && !COMMON_ROLES.includes(selectedEmp.jobTitle) && (
              <SelectItem value={selectedEmp.jobTitle}>{selectedEmp.jobTitle}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="mb-1 block">ملاحظة (اختياري)</Label>
        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="مثل: في صندوق الكاشير الأمامي" data-testid="input-notes-assign" />
      </div>
      <DialogFooter>
        <Button
          onClick={() => employeeId && onSubmit({ employeeId: parseInt(employeeId, 10), role, notes })}
          disabled={!employeeId || pending}
          data-testid="btn-confirm-assign"
        >
          <Save className="w-4 h-4 ml-1" /> تعيين الموظف
        </Button>
      </DialogFooter>
    </div>
  );
}
