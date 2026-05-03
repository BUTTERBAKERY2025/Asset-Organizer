import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Upload, Loader2, FileSpreadsheet, ListTree } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import * as XLSX from "xlsx";

interface JournalEntry {
  id: number;
  entryNumber: string;
  entryDate: string;
  description: string;
  totalDebit: string;
  totalCredit: string;
  status: string;
}

interface BoqItem {
  id: number;
  itemNumber: string | null;
  description: string;
  unit: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  completedQuantity: number | null;
  status: string;
  isSection: boolean | null;
}

const fmt = (n: number | string) => {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(v || 0);
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  posted: { label: "مرحّل", color: "bg-emerald-100 text-emerald-800" },
  draft: { label: "مسودة", color: "bg-slate-100 text-slate-700" },
  reconciled: { label: "مسوّى", color: "bg-blue-100 text-blue-800" },
  void: { label: "ملغى", color: "bg-red-100 text-red-700" },
};

export function ContractAccountingCard({ contractId, canEdit }: { contractId: number; canEdit: boolean }) {
  const { data: entries = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: [`/api/construction/contracts/${contractId}/journal-entries`],
  });

  const totalDebit = entries.reduce((s, e) => s + (parseFloat(e.totalDebit) || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (parseFloat(e.totalCredit) || 0), 0);

  return (
    <Card className="border-blue-200" data-testid="card-accounting">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700">
          <BookOpen className="h-5 w-5" /> القيود المحاسبية
          <Badge variant="outline" className="ml-2">{entries.length}</Badge>
        </CardTitle>
        <CardDescription>
          قيود يومية تُنشأ تلقائياً عند الأحداث المحاسبية (إفراج ضمان، تطبيق غرامة، اعتماد أمر تغيير)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-6"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" /></div>
        ) : entries.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">لا توجد قيود محاسبية مرتبطة بهذا العقد بعد</div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-blue-50 rounded p-2 text-center">
                <div className="text-xs text-blue-700">إجمالي مدين</div>
                <div className="text-lg font-bold text-blue-800" data-testid="text-total-debit">{fmt(totalDebit)}</div>
              </div>
              <div className="bg-emerald-50 rounded p-2 text-center">
                <div className="text-xs text-emerald-700">إجمالي دائن</div>
                <div className="text-lg font-bold text-emerald-800" data-testid="text-total-credit">{fmt(totalCredit)}</div>
              </div>
            </div>
            <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
              {entries.map((e) => {
                const st = STATUS_LABELS[e.status] || { label: e.status, color: "bg-slate-100" };
                return (
                  <div key={e.id} className="p-2.5 hover:bg-slate-50" data-testid={`row-journal-${e.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono text-muted-foreground" data-testid={`text-entry-num-${e.id}`}>{e.entryNumber}</div>
                        <div className="text-sm font-medium truncate">{e.description}</div>
                        <div className="text-xs text-muted-foreground">{e.entryDate}</div>
                      </div>
                      <div className="text-left whitespace-nowrap">
                        <Badge className={`${st.color} text-xs`}>{st.label}</Badge>
                        <div className="text-sm font-bold mt-1">{fmt(e.totalDebit)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ContractBoqCard({ contractId, contractTotal, canEdit }: { contractId: number; contractTotal: number; canEdit: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");

  const { data: items = [], isLoading } = useQuery<BoqItem[]>({
    queryKey: [`/api/construction/contracts/${contractId}/boq`],
  });

  const importMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const res = await apiRequest("POST", `/api/construction/contracts/${contractId}/boq/import`, { items: rows });
      return await res.json();
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: [`/api/construction/contracts/${contractId}/boq`] });
      setImportOpen(false);
      setPreviewRows([]);
      setFileName("");
      toast({ title: `تم استيراد ${r?.inserted || 0} بند` });
    },
    onError: (e: any) => toast({ title: "فشل الاستيراد", description: e?.message, variant: "destructive" }),
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    // Normalize columns: accept Arabic or English headers
    const rows = json.map((r: any) => {
      const num = r['رقم البند'] || r['البند'] || r['#'] || r['itemNumber'] || r['item'] || '';
      const desc = r['الوصف'] || r['البيان'] || r['description'] || r['Description'] || '';
      const unit = r['الوحدة'] || r['unit'] || r['Unit'] || 'قطعة';
      const qty = parseFloat(r['الكمية'] || r['quantity'] || r['Qty'] || r['qty'] || 0) || 0;
      const price = parseFloat(r['سعر الوحدة'] || r['السعر'] || r['unitPrice'] || r['price'] || 0) || 0;
      const isSection = String(r['قسم'] || r['section'] || '').toLowerCase() === 'نعم' || String(r['قسم'] || r['section'] || '').toLowerCase() === 'yes';
      return {
        itemNumber: String(num || '').trim() || undefined,
        description: String(desc || '').trim(),
        unit: String(unit || 'قطعة').trim(),
        quantity: qty,
        unitPrice: price,
        isSection,
      };
    }).filter(r => r.description);
    setPreviewRows(rows);
  };

  const totals = items.reduce((acc, i) => {
    if (!i.isSection) {
      acc.total += (i.totalPrice || 0);
      acc.completed += ((i.completedQuantity || 0) * (i.unitPrice || 0));
    }
    return acc;
  }, { total: 0, completed: 0 });
  const progressPct = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;

  return (
    <Card className="border-purple-200" data-testid="card-boq">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-purple-700">
            <ListTree className="h-5 w-5" /> جدول الكميات (BOQ)
            <Badge variant="outline" className="ml-2">{items.filter(i => !i.isSection).length} بند</Badge>
          </CardTitle>
          <CardDescription>بنود العقد التفصيلية بكميات وأسعار وحدة، مع تتبّع الإنجاز</CardDescription>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setImportOpen(true)} className="bg-purple-600 hover:bg-purple-700" data-testid="button-import-boq">
            <Upload className="h-4 w-4 ml-1" /> استيراد Excel
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-6"><Loader2 className="h-6 w-6 animate-spin mx-auto text-purple-600" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            لا توجد بنود بعد. استخدم زر "استيراد Excel" لإضافة بنود BOQ من ملف.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-purple-50 rounded p-2 text-center">
                <div className="text-xs text-purple-700">إجمالي البنود</div>
                <div className="text-base font-bold text-purple-800">{fmt(totals.total)}</div>
              </div>
              <div className="bg-emerald-50 rounded p-2 text-center">
                <div className="text-xs text-emerald-700">قيمة المنجز</div>
                <div className="text-base font-bold text-emerald-800" data-testid="text-boq-completed">{fmt(totals.completed)}</div>
              </div>
              <div className="bg-amber-50 rounded p-2 text-center">
                <div className="text-xs text-amber-700">نسبة الإنجاز</div>
                <div className="text-base font-bold text-amber-800" data-testid="text-boq-progress">{progressPct}%</div>
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs">
                  <tr>
                    <th className="px-2 py-1.5 text-right">#</th>
                    <th className="px-2 py-1.5 text-right">الوصف</th>
                    <th className="px-2 py-1.5 text-center">الوحدة</th>
                    <th className="px-2 py-1.5 text-center">الكمية</th>
                    <th className="px-2 py-1.5 text-center">سعر الوحدة</th>
                    <th className="px-2 py-1.5 text-center">الإجمالي</th>
                    <th className="px-2 py-1.5 text-center">المنجز</th>
                  </tr>
                </thead>
                <tbody className="divide-y max-h-96 overflow-y-auto">
                  {items.map((it) => (
                    <tr key={it.id} className={it.isSection ? "bg-purple-50 font-bold" : "hover:bg-slate-50"} data-testid={`row-boq-${it.id}`}>
                      <td className="px-2 py-1.5 text-xs font-mono">{it.itemNumber || "-"}</td>
                      <td className="px-2 py-1.5">{it.description}</td>
                      <td className="px-2 py-1.5 text-center text-xs">{it.isSection ? "" : it.unit}</td>
                      <td className="px-2 py-1.5 text-center">{it.isSection ? "" : it.quantity}</td>
                      <td className="px-2 py-1.5 text-center text-xs">{it.isSection ? "" : fmt(it.unitPrice)}</td>
                      <td className="px-2 py-1.5 text-center font-medium">{it.isSection ? "" : fmt(it.totalPrice)}</td>
                      <td className="px-2 py-1.5 text-center text-xs">{it.isSection ? "" : `${it.completedQuantity || 0}/${it.quantity}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>استيراد جدول الكميات من Excel</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-900">
              <div className="font-medium mb-1">الأعمدة المتوقعة (عربي أو إنجليزي):</div>
              <div>رقم البند | الوصف | الوحدة | الكمية | سعر الوحدة | قسم (اختياري — اكتب "نعم" لصف عنوان قسم)</div>
            </div>
            <div>
              <Label>اختر ملف Excel</Label>
              <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} data-testid="input-boq-file" />
              {fileName && <div className="text-xs text-muted-foreground mt-1"><FileSpreadsheet className="h-3 w-3 inline ml-1" />{fileName} — {previewRows.length} صف</div>}
            </div>
            {previewRows.length > 0 && (
              <div className="border rounded max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr><th className="p-1.5 text-right">#</th><th className="p-1.5 text-right">الوصف</th><th className="p-1.5">الكمية</th><th className="p-1.5">السعر</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {previewRows.slice(0, 50).map((r, i) => (
                      <tr key={i} className={r.isSection ? "bg-purple-50 font-bold" : ""}>
                        <td className="p-1.5">{r.itemNumber || ""}</td>
                        <td className="p-1.5">{r.description}</td>
                        <td className="p-1.5 text-center">{r.quantity}</td>
                        <td className="p-1.5 text-center">{r.unitPrice}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewRows.length > 50 && <div className="p-2 text-xs text-center text-muted-foreground">+{previewRows.length - 50} صف إضافي</div>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setPreviewRows([]); setFileName(""); }}>إلغاء</Button>
            <Button onClick={() => importMutation.mutate(previewRows)} disabled={importMutation.isPending || previewRows.length === 0} className="bg-purple-600 hover:bg-purple-700" data-testid="button-confirm-import">
              {importMutation.isPending ? "جارِ الاستيراد..." : `استيراد ${previewRows.length} بند`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
