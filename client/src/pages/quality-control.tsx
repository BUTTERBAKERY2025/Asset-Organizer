import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, ClipboardCheck, CheckCircle, XCircle, AlertTriangle, Thermometer, Calendar, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { QualityCheck, Branch } from "@shared/schema";

const CHECK_TYPES = [
  { value: "temperature", label: "درجة الحرارة", icon: Thermometer },
  { value: "appearance", label: "المظهر", icon: ClipboardCheck },
  { value: "taste", label: "الطعم", icon: ClipboardCheck },
  { value: "weight", label: "الوزن", icon: ClipboardCheck },
  { value: "packaging", label: "التغليف", icon: ClipboardCheck },
  { value: "cleanliness", label: "النظافة", icon: ClipboardCheck },
];

const CHECK_RESULTS = {
  passed: { label: "ناجح", color: "bg-green-100 text-green-800", icon: CheckCircle },
  failed: { label: "فاشل", color: "bg-red-100 text-red-800", icon: XCircle },
  needs_improvement: { label: "يحتاج تحسين", color: "bg-yellow-100 text-yellow-800", icon: AlertTriangle },
};

export default function QualityControlPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    branchId: "",
    checkType: "",
    checkDate: new Date().toISOString().split('T')[0],
    checkTime: new Date().toTimeString().slice(0, 5),
    result: "",
    score: "",
    temperature: "",
    checkedBy: "",
    issues: "",
    correctiveAction: "",
    notes: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: checks, isLoading } = useQuery<QualityCheck[]>({
    queryKey: ["/api/quality-checks"],
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("/api/quality-checks", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quality-checks"] });
      toast({ title: "تم تسجيل فحص الجودة بنجاح" });
      resetForm();
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في تسجيل فحص الجودة", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      branchId: "",
      checkType: "",
      checkDate: new Date().toISOString().split('T')[0],
      checkTime: new Date().toTimeString().slice(0, 5),
      result: "",
      score: "",
      temperature: "",
      checkedBy: "",
      issues: "",
      correctiveAction: "",
      notes: "",
    });
    setIsDialogOpen(false);
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      score: formData.score ? parseInt(formData.score) : null,
      temperature: formData.temperature ? parseFloat(formData.temperature) : null,
    };

    createMutation.mutate(data);
  };

  const getBranchName = (branchId: string) => branches?.find(b => b.id === branchId)?.name || branchId;
  const getCheckTypeLabel = (type: string) => CHECK_TYPES.find(t => t.value === type)?.label || type;

  const filteredChecks = checks?.filter(c =>
    getCheckTypeLabel(c.checkType).toLowerCase().includes(searchTerm.toLowerCase()) ||
    getBranchName(c.branchId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const passedCount = checks?.filter(c => c.result === 'passed').length || 0;
  const failedCount = checks?.filter(c => c.result === 'failed').length || 0;

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">مراقبة الجودة</h1>
            <p className="text-muted-foreground">فحوصات الجودة والمعايير</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-check">
                <Plus className="w-4 h-4 ml-2" />
                فحص جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>تسجيل فحص جودة</DialogTitle>
                <DialogDescription>أدخل بيانات الفحص</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الفرع *</Label>
                    <Select value={formData.branchId} onValueChange={v => setFormData({ ...formData, branchId: v })}>
                      <SelectTrigger data-testid="select-branch">
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches?.map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>نوع الفحص *</Label>
                    <Select value={formData.checkType} onValueChange={v => setFormData({ ...formData, checkType: v })}>
                      <SelectTrigger data-testid="select-check-type">
                        <SelectValue placeholder="اختر النوع" />
                      </SelectTrigger>
                      <SelectContent>
                        {CHECK_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>التاريخ *</Label>
                    <Input
                      type="date"
                      value={formData.checkDate}
                      onChange={e => setFormData({ ...formData, checkDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>الوقت</Label>
                    <Input
                      type="time"
                      value={formData.checkTime}
                      onChange={e => setFormData({ ...formData, checkTime: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>النتيجة *</Label>
                  <Select value={formData.result} onValueChange={v => setFormData({ ...formData, result: v })}>
                    <SelectTrigger data-testid="select-result">
                      <SelectValue placeholder="اختر النتيجة" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CHECK_RESULTS).map(([value, { label }]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الدرجة (0-100)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.score}
                      onChange={e => setFormData({ ...formData, score: e.target.value })}
                      placeholder="مثال: 85"
                    />
                  </div>
                  {formData.checkType === 'temperature' && (
                    <div>
                      <Label>درجة الحرارة (°C)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.temperature}
                        onChange={e => setFormData({ ...formData, temperature: e.target.value })}
                        placeholder="مثال: 25.5"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <Label>الفاحص *</Label>
                  <Input
                    value={formData.checkedBy}
                    onChange={e => setFormData({ ...formData, checkedBy: e.target.value })}
                    placeholder="اسم الفاحص"
                    data-testid="input-checked-by"
                  />
                </div>
                {formData.result === 'failed' || formData.result === 'needs_improvement' ? (
                  <>
                    <div>
                      <Label>المشاكل المكتشفة</Label>
                      <Textarea
                        value={formData.issues}
                        onChange={e => setFormData({ ...formData, issues: e.target.value })}
                        placeholder="اوصف المشاكل..."
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label>الإجراء التصحيحي</Label>
                      <Textarea
                        value={formData.correctiveAction}
                        onChange={e => setFormData({ ...formData, correctiveAction: e.target.value })}
                        placeholder="ما هو الإجراء المتخذ..."
                        rows={2}
                      />
                    </div>
                  </>
                ) : null}
                <div>
                  <Label>ملاحظات</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetForm}>إلغاء</Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={!formData.branchId || !formData.checkType || !formData.result || !formData.checkedBy}
                  data-testid="button-save-check"
                >
                  تسجيل الفحص
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <ClipboardCheck className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{checks?.length || 0}</div>
                <div className="text-sm text-muted-foreground">إجمالي الفحوصات</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{passedCount}</div>
                <div className="text-sm text-muted-foreground">ناجح</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{failedCount}</div>
                <div className="text-sm text-muted-foreground">فاشل</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pr-10"
              data-testid="input-search"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : filteredChecks?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ClipboardCheck className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لا توجد فحوصات</p>
              <Button variant="outline" className="mt-4" onClick={() => setIsDialogOpen(true)}>
                تسجيل أول فحص
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredChecks?.map(check => {
              const ResultIcon = CHECK_RESULTS[check.result as keyof typeof CHECK_RESULTS]?.icon || ClipboardCheck;
              return (
                <Card key={check.id} data-testid={`check-card-${check.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{getCheckTypeLabel(check.checkType)}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {getBranchName(check.branchId)}
                        </CardDescription>
                      </div>
                      <Badge className={CHECK_RESULTS[check.result as keyof typeof CHECK_RESULTS]?.color || "bg-gray-100"}>
                        <ResultIcon className="w-3 h-3 ml-1" />
                        {CHECK_RESULTS[check.result as keyof typeof CHECK_RESULTS]?.label || check.result}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {check.checkDate}
                      </div>
                      {check.checkTime && <span>{check.checkTime}</span>}
                    </div>
                    {check.score && (
                      <div className="text-sm">
                        الدرجة: <span className="font-bold">{check.score}/100</span>
                      </div>
                    )}
                    {check.temperature && (
                      <div className="flex items-center gap-1 text-sm">
                        <Thermometer className="w-3 h-3" />
                        {check.temperature}°C
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
                      <User className="w-3 h-3" />
                      الفاحص: {check.checkedBy}
                    </div>
                    {check.issues && (
                      <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                        المشاكل: {check.issues}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
