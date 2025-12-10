import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Filter, Save, Star, X, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SavedFilter } from "@shared/schema";

export interface FilterConfig {
  status: string;
  priceMin: string;
  priceMax: string;
  lastCheckFrom: string;
  lastCheckTo: string;
  needsInspection: boolean;
}

interface AdvancedFiltersProps {
  filters: FilterConfig;
  onFiltersChange: (filters: FilterConfig) => void;
  onApply: () => void;
  onClear: () => void;
}

const defaultFilters: FilterConfig = {
  status: "all",
  priceMin: "",
  priceMax: "",
  lastCheckFrom: "",
  lastCheckTo: "",
  needsInspection: false,
};

export function AdvancedFilters({ filters, onFiltersChange, onApply, onClear }: AdvancedFiltersProps) {
  const [open, setOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: savedFilters = [] } = useQuery<SavedFilter[]>({
    queryKey: ["/api/filters"],
    queryFn: async () => {
      const res = await fetch("/api/filters");
      if (!res.ok) throw new Error("Failed to fetch saved filters");
      return res.json();
    },
  });

  const saveFilterMutation = useMutation({
    mutationFn: async (data: { name: string; filterConfig: string }) => {
      const res = await fetch("/api/filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save filter");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/filters"] });
      toast({ title: "تم حفظ الفلتر بنجاح" });
      setSaveDialogOpen(false);
      setFilterName("");
    },
  });

  const deleteFilterMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/filters/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete filter");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/filters"] });
      toast({ title: "تم حذف الفلتر" });
    },
  });

  const handleSaveFilter = () => {
    if (!filterName.trim()) return;
    saveFilterMutation.mutate({
      name: filterName,
      filterConfig: JSON.stringify(filters),
    });
  };

  const handleLoadFilter = (filter: SavedFilter) => {
    try {
      const config = JSON.parse(filter.filterConfig) as FilterConfig;
      onFiltersChange(config);
      toast({ title: `تم تحميل فلتر "${filter.name}"` });
    } catch (e) {
      toast({ title: "خطأ في تحميل الفلتر", variant: "destructive" });
    }
  };

  const activeFiltersCount = [
    filters.status !== "all",
    filters.priceMin !== "",
    filters.priceMax !== "",
    filters.lastCheckFrom !== "",
    filters.lastCheckTo !== "",
    filters.needsInspection,
  ].filter(Boolean).length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-advanced-filters">
          <Filter className="w-4 h-4" />
          فلاتر متقدمة
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="mr-1">{activeFiltersCount}</Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>فلاتر البحث المتقدمة</SheetTitle>
          <SheetDescription>
            استخدم الفلاتر لتضييق نتائج البحث
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label>حالة الأصل</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
            >
              <SelectTrigger data-testid="filter-status">
                <SelectValue placeholder="اختر الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="good">جيد</SelectItem>
                <SelectItem value="maintenance">يحتاج صيانة</SelectItem>
                <SelectItem value="damaged">تالف</SelectItem>
                <SelectItem value="missing">مفقود</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>نطاق السعر (ريال)</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                placeholder="من"
                value={filters.priceMin}
                onChange={(e) => onFiltersChange({ ...filters, priceMin: e.target.value })}
                data-testid="filter-price-min"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="number"
                placeholder="إلى"
                value={filters.priceMax}
                onChange={(e) => onFiltersChange({ ...filters, priceMax: e.target.value })}
                data-testid="filter-price-max"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>تاريخ آخر فحص</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="date"
                value={filters.lastCheckFrom}
                onChange={(e) => onFiltersChange({ ...filters, lastCheckFrom: e.target.value })}
                data-testid="filter-date-from"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="date"
                value={filters.lastCheckTo}
                onChange={(e) => onFiltersChange({ ...filters, lastCheckTo: e.target.value })}
                data-testid="filter-date-to"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="needs-inspection"
              checked={filters.needsInspection}
              onChange={(e) => onFiltersChange({ ...filters, needsInspection: e.target.checked })}
              className="w-4 h-4"
              data-testid="filter-needs-inspection"
            />
            <Label htmlFor="needs-inspection" className="cursor-pointer">
              أصول تحتاج فحص (تجاوزت موعد الفحص)
            </Label>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={() => { onApply(); setOpen(false); }} className="flex-1" data-testid="button-apply-filters">
              تطبيق الفلاتر
            </Button>
            <Button variant="outline" onClick={() => { onClear(); onFiltersChange(defaultFilters); }} data-testid="button-clear-filters">
              <X className="w-4 h-4" />
            </Button>
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-save-filter">
                  <Save className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>حفظ الفلتر</DialogTitle>
                  <DialogDescription>اختر اسماً للفلتر لحفظه واستخدامه لاحقاً</DialogDescription>
                </DialogHeader>
                <Input
                  placeholder="اسم الفلتر"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  data-testid="input-filter-name"
                />
                <DialogFooter>
                  <Button onClick={handleSaveFilter} disabled={saveFilterMutation.isPending} data-testid="button-confirm-save-filter">
                    حفظ
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {savedFilters.length > 0 && (
            <div className="pt-4 border-t space-y-2">
              <Label className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />
                الفلاتر المحفوظة
              </Label>
              <div className="space-y-2">
                {savedFilters.map((filter) => (
                  <div
                    key={filter.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                  >
                    <Button
                      variant="ghost"
                      className="flex-1 justify-start"
                      onClick={() => handleLoadFilter(filter)}
                      data-testid={`button-load-filter-${filter.id}`}
                    >
                      {filter.name}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteFilterMutation.mutate(filter.id)}
                      data-testid={`button-delete-filter-${filter.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { defaultFilters };
