import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Edit, Trash2, Eye, Loader2 } from "lucide-react";
import { formatCurrency, formatNumber, getStatusBadge, getHealthBadge } from "./utils";
import type { BranchEmployee, Branch } from "./types";

interface EmployeeTableProps {
  employees: BranchEmployee[];
  branches: Branch[] | undefined;
  isLoading: boolean;
  onView: (employee: BranchEmployee) => void;
  onEdit: (employee: BranchEmployee) => void;
  onDelete: (employee: BranchEmployee) => void;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function EmployeeTable({
  employees,
  branches,
  isLoading,
  onView,
  onEdit,
  onDelete,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: EmployeeTableProps) {
  const getBranchName = (branchId: string) => {
    const branch = branches?.find((b) => b.id === branchId);
    return branch?.name || branchId;
  };

  const totalPages = Math.ceil(employees.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedEmployees = employees.slice(startIndex, startIndex + pageSize);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>قائمة الموظفين</CardTitle>
            <CardDescription>عرض {formatNumber(employees.length)} موظف</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">عدد الصفوف:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm"
              data-testid="select-page-size"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>لا يوجد موظفين</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الرقم الوظيفي</TableHead>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الفرع</TableHead>
                  <TableHead className="text-right">الوظيفة</TableHead>
                  <TableHead className="text-right">الجنسية</TableHead>
                  <TableHead className="text-right">الراتب</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الشهادة الصحية</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEmployees.map((emp) => (
                  <TableRow key={emp.id} data-testid={`row-employee-${emp.id}`}>
                    <TableCell className="font-mono text-sm">{emp.employeeNumber || "--"}</TableCell>
                    <TableCell className="font-medium">{emp.employeeName}</TableCell>
                    <TableCell>{getBranchName(emp.branchId)}</TableCell>
                    <TableCell>{emp.jobTitle}</TableCell>
                    <TableCell>{emp.nationality}</TableCell>
                    <TableCell>{formatCurrency(emp.salary)}</TableCell>
                    <TableCell>{getStatusBadge(emp.status)}</TableCell>
                    <TableCell>{getHealthBadge(emp.healthCertificate || "none")}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onView(emp)}
                          data-testid={`button-view-${emp.id}`}
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(emp)}
                          data-testid={`button-edit-${emp.id}`}
                        >
                          <Edit className="w-4 h-4 text-amber-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(emp)}
                          data-testid={`button-delete-${emp.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-gray-500">
                  عرض {startIndex + 1} - {Math.min(startIndex + pageSize, employees.length)} من {employees.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    السابق
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => onPageChange(pageNum)}
                          className={currentPage === pageNum ? "bg-amber-600" : ""}
                          data-testid={`button-page-${pageNum}`}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    التالي
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
