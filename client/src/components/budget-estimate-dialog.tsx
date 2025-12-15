import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Calculator, Sparkles, CheckCircle2, AlertCircle, Loader2, Save, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface BudgetEstimate {
  categoryId: number;
  categoryName: string;
  estimatedAmount: number;
  percentOfTotal: number;
  basedOnProjects: number;
  avgHistoricalCost?: number;
  confidence: string;
}

interface BudgetEstimateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  projectTitle: string;
}

const formatNumber = (num: number) => num.toLocaleString("en-US");
const formatCurrency = (num: number) => formatNumber(num) + " ر.س";

export function BudgetEstimateDialog({ open, onOpenChange, projectId, projectTitle }: BudgetEstimateDialogProps) {
  const [totalBudget, setTotalBudget] = useState<string>("");
  const [estimates, setEstimates] = useState<BudgetEstimate[]>([]);
  const [editedEstimates, setEditedEstimates] = useState<Record<number, number>>({});
  const [isGenerated, setIsGenerated] = useState(false);
  const [hasHistoricalData, setHasHistoricalData] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async (budget: number) => {
      const res = await fetch("/api/construction/budget-estimates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ totalBudget: budget }),
      });
      if (!res.ok) throw new Error("Failed to generate estimates");
      return res.json();
    },
    onSuccess: (data) => {
      setEstimates(data.estimates);
      setHasHistoricalData(data.hasHistoricalData);
      setIsGenerated(true);
      const initialEdits: Record<number, number> = {};
      data.estimates.forEach((e: BudgetEstimate) => {
        initialEdits[e.categoryId] = e.estimatedAmount;
      });
      setEditedEstimates(initialEdits);
    },
    onError: () => {
      toast({ title: "فشل في توليد التقديرات", variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(editedEstimates).filter(([_, amount]) => amount > 0);
      for (const [categoryId, amount] of entries) {
        const res = await fetch("/api/construction/budget-allocations/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            projectId,
            categoryId: parseInt(categoryId),
            plannedAmount: amount,
          }),
        });
        if (!res.ok) throw new Error("Failed to save budget");
      }
    },
    onSuccess: () => {
      toast({ title: "تم حفظ الميزانية بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/construction/projects", projectId, "budget-allocations"] });
      handleClose();
    },
    onError: () => {
      toast({ title: "فشل في حفظ الميزانية", variant: "destructive" });
    },
  });

  const handleClose = () => {
    setTotalBudget("");
    setEstimates([]);
    setEditedEstimates({});
    setIsGenerated(false);
    onOpenChange(false);
  };

  const handleGenerate = () => {
    const budget = parseFloat(totalBudget);
    if (isNaN(budget) || budget <= 0) {
      toast({ title: "أدخل ميزانية صحيحة", variant: "destructive" });
      return;
    }
    generateMutation.mutate(budget);
  };

  const handleEstimateChange = (categoryId: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEditedEstimates(prev => ({ ...prev, [categoryId]: numValue }));
  };

  const totalEdited = Object.values(editedEstimates).reduce((sum, val) => sum + val, 0);
  const budgetNum = parseFloat(totalBudget) || 0;
  const difference = budgetNum - totalEdited;

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "high":
        return <Badge className="bg-green-500">عالية</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500">متوسطة</Badge>;
      default:
        return <Badge variant="secondary">منخفضة</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-4xl max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            الميزانية التقديرية الذكية
          </DialogTitle>
          <DialogDescription>
            توليد ميزانية تقديرية للمشروع بناءً على بيانات المشروعات السابقة
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-4">
            <p className="font-medium mb-2">المشروع: {projectTitle}</p>
          </div>

          {!isGenerated ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="totalBudget">الميزانية الإجمالية المتاحة (ر.س)</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="totalBudget"
                    type="number"
                    placeholder="مثال: 500000"
                    value={totalBudget}
                    onChange={(e) => setTotalBudget(e.target.value)}
                    className="font-mono"
                    dir="ltr"
                  />
                  <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
                    {generateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    ) : (
                      <Calculator className="w-4 h-4 ml-2" />
                    )}
                    توليد التقديرات
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800 text-sm">
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-5 h-5 mt-0.5" />
                  <div>
                    <p className="font-medium">كيف تعمل الميزانية التقديرية؟</p>
                    <p className="mt-1">يحلل النظام بيانات بنود المشروعات السابقة ويحسب متوسط التكلفة لكل تصنيف، ثم يوزع الميزانية المدخلة بنفس النسب.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {!hasHistoricalData && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 mt-0.5" />
                    <div>
                      <p className="font-medium">لا توجد بيانات تاريخية كافية</p>
                      <p className="mt-1">تم توزيع الميزانية بالتساوي. يمكنك تعديل القيم حسب احتياجاتك.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between bg-muted/30 rounded-lg p-4">
                <div>
                  <span className="text-muted-foreground">الميزانية الإجمالية:</span>
                  <span className="font-bold font-mono mr-2">{formatCurrency(budgetNum)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">المجموع المخصص:</span>
                  <span className={`font-bold font-mono mr-2 ${difference !== 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {formatCurrency(totalEdited)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">الفرق:</span>
                  <span className={`font-bold font-mono mr-2 ${difference !== 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {formatCurrency(difference)}
                  </span>
                </div>
              </div>

              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>البند</TableHead>
                      <TableHead>التقدير الأولي</TableHead>
                      <TableHead>النسبة</TableHead>
                      <TableHead>الثقة</TableHead>
                      <TableHead>المبلغ المعدل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {estimates.map((estimate) => (
                      <TableRow key={estimate.categoryId}>
                        <TableCell className="font-medium">{estimate.categoryName}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {formatCurrency(estimate.estimatedAmount)}
                          {estimate.avgHistoricalCost && estimate.avgHistoricalCost > 0 && (
                            <div className="text-xs text-muted-foreground">
                              متوسط سابق: {formatCurrency(estimate.avgHistoricalCost)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={estimate.percentOfTotal} className="w-16 h-2" />
                            <span className="font-mono text-sm">{estimate.percentOfTotal}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getConfidenceBadge(estimate.confidence)}
                          {estimate.basedOnProjects > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              من {estimate.basedOnProjects} مشروع
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={editedEstimates[estimate.categoryId] || 0}
                            onChange={(e) => handleEstimateChange(estimate.categoryId, e.target.value)}
                            className="w-32 font-mono"
                            dir="ltr"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            إلغاء
          </Button>
          {isGenerated && (
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 ml-2" />
              )}
              اعتماد الميزانية
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
