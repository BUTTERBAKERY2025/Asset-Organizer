import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Building, Globe, Briefcase, Users, Search, Filter, SlidersHorizontal } from "lucide-react";
import type { Branch, SettingsByCategory, EmployeeFiltersState } from "./types";

interface EmployeeFiltersProps {
  filters: EmployeeFiltersState;
  onFiltersChange: (filters: Partial<EmployeeFiltersState>) => void;
  branches: Branch[] | undefined;
  settingsByCategory: SettingsByCategory;
  showAdvancedFilters?: boolean;
}

export function EmployeeFilters({
  filters,
  onFiltersChange,
  branches,
  settingsByCategory,
  showAdvancedFilters = true,
}: EmployeeFiltersProps) {
  const handleResetFilters = () => {
    onFiltersChange({
      selectedBranch: "all",
      selectedNationality: "all",
      selectedJobTitle: "all",
      selectedStatus: "all",
      searchQuery: "",
      salaryMin: undefined,
      salaryMax: undefined,
      hireDateFrom: undefined,
      hireDateTo: undefined,
    });
  };

  const hasActiveFilters = 
    filters.selectedBranch !== "all" ||
    filters.selectedNationality !== "all" ||
    filters.selectedJobTitle !== "all" ||
    filters.selectedStatus !== "all" ||
    filters.searchQuery !== "" ||
    filters.salaryMin !== undefined ||
    filters.salaryMax !== undefined ||
    filters.hireDateFrom !== undefined ||
    filters.hireDateTo !== undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Building className="w-4 h-4 text-gray-500" />
          <Select 
            value={filters.selectedBranch} 
            onValueChange={(v) => onFiltersChange({ selectedBranch: v })}
          >
            <SelectTrigger className="w-48" data-testid="filter-branch">
              <SelectValue placeholder="جميع الفروع" />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              <SelectItem value="all">جميع الفروع</SelectItem>
              {branches?.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-500" />
          <Select 
            value={filters.selectedNationality} 
            onValueChange={(v) => onFiltersChange({ selectedNationality: v })}
          >
            <SelectTrigger className="w-40" data-testid="filter-nationality">
              <SelectValue placeholder="جميع الجنسيات" />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              <SelectItem value="all">جميع الجنسيات</SelectItem>
              {settingsByCategory.nationality?.filter(s => s.isActive).map((nat) => (
                <SelectItem key={nat.id} value={nat.labelAr}>{nat.labelAr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-gray-500" />
          <Select 
            value={filters.selectedJobTitle} 
            onValueChange={(v) => onFiltersChange({ selectedJobTitle: v })}
          >
            <SelectTrigger className="w-40" data-testid="filter-job">
              <SelectValue placeholder="جميع الوظائف" />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              <SelectItem value="all">جميع الوظائف</SelectItem>
              {settingsByCategory.job_title?.filter(s => s.isActive).map((job) => (
                <SelectItem key={job.id} value={job.labelAr}>{job.labelAr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500" />
          <Select 
            value={filters.selectedStatus} 
            onValueChange={(v) => onFiltersChange({ selectedStatus: v })}
          >
            <SelectTrigger className="w-36" data-testid="filter-status">
              <SelectValue placeholder="جميع الحالات" />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="inactive">غير نشط</SelectItem>
              <SelectItem value="terminated">منتهي</SelectItem>
              <SelectItem value="on_leave">في إجازة</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showAdvancedFilters && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                فلاتر متقدمة
                {hasActiveFilters && (
                  <span className="w-2 h-2 bg-amber-500 rounded-full" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-4">
                <h4 className="font-medium text-sm">فلاتر متقدمة</h4>
                
                <div className="space-y-2">
                  <Label className="text-xs">نطاق الراتب</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="من"
                      value={filters.salaryMin || ""}
                      onChange={(e) => onFiltersChange({ 
                        salaryMin: e.target.value ? Number(e.target.value) : undefined 
                      })}
                      className="text-sm"
                      data-testid="filter-salary-min"
                    />
                    <Input
                      type="number"
                      placeholder="إلى"
                      value={filters.salaryMax || ""}
                      onChange={(e) => onFiltersChange({ 
                        salaryMax: e.target.value ? Number(e.target.value) : undefined 
                      })}
                      className="text-sm"
                      data-testid="filter-salary-max"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">تاريخ التعيين</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={filters.hireDateFrom || ""}
                      onChange={(e) => onFiltersChange({ hireDateFrom: e.target.value || undefined })}
                      className="text-sm"
                      data-testid="filter-hire-from"
                    />
                    <Input
                      type="date"
                      value={filters.hireDateTo || ""}
                      onChange={(e) => onFiltersChange({ hireDateTo: e.target.value || undefined })}
                      className="text-sm"
                      data-testid="filter-hire-to"
                    />
                  </div>
                </div>

                {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleResetFilters}
                    className="w-full text-red-600 hover:text-red-700"
                  >
                    إعادة تعيين الفلاتر
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={filters.searchQuery}
            onChange={(e) => onFiltersChange({ searchQuery: e.target.value })}
            placeholder="بحث بالاسم أو الرقم الوظيفي..."
            className="pr-10"
            data-testid="input-search"
          />
        </div>
      </div>
    </div>
  );
}
