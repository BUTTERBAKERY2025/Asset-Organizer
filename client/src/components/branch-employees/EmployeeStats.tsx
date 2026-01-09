import { Card, CardContent } from "@/components/ui/card";
import { Users, DollarSign, Globe, Briefcase } from "lucide-react";
import { formatCurrency, formatNumber } from "./utils";
import type { EmployeeStats as EmployeeStatsType } from "./types";

interface EmployeeStatsProps {
  stats: EmployeeStatsType | null | undefined;
}

export function EmployeeStats({ stats }: EmployeeStatsProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">إجمالي الموظفين</p>
              <p className="text-2xl font-bold" data-testid="text-total-employees">
                {formatNumber(stats?.totalEmployees || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">إجمالي الرواتب</p>
              <p className="text-2xl font-bold" data-testid="text-total-salaries">
                {formatCurrency(stats?.totalSalaries)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Globe className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">عدد الجنسيات</p>
              <p className="text-2xl font-bold" data-testid="text-nationalities-count">
                {formatNumber(stats?.byNationality?.length || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Briefcase className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">عدد الوظائف</p>
              <p className="text-2xl font-bold" data-testid="text-jobs-count">
                {formatNumber(stats?.byJobTitle?.length || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
