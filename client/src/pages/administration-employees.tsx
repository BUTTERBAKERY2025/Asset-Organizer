import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, Loader2 } from "lucide-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/pagination";
import { ExportButtons } from "@/components/export-buttons";
import { usePermissions } from "@/hooks/usePermissions";

interface AdministrationEmployee {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  jobTitle: string | null;
  isActive: string | null;
  departmentName: string | null;
}

const columns = [
  { header: "الموظف", key: "name", width: 25 },
  { header: "اسم المستخدم", key: "username", width: 20 },
  { header: "الإدارة", key: "department", width: 20 },
  { header: "المسمى الوظيفي", key: "jobTitle", width: 20 },
  { header: "رقم الجوال", key: "phone", width: 18 },
  { header: "البريد الإلكتروني", key: "email", width: 28 },
  { header: "الحالة", key: "status", width: 14 },
];

export default function AdministrationEmployeesPage() {
  const { canView, canExport, isLoading: permissionsLoading } = usePermissions();
  const allowed = canView("users");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const { data: employees = [], isLoading, error } = useQuery<AdministrationEmployee[]>({
    queryKey: ["/api/administration-employees"],
    queryFn: async () => {
      const res = await fetch("/api/administration-employees", { credentials: "include" });
      if (!res.ok) throw new Error(`تعذر تحميل موظفي الإدارة العامة (${res.status}). تحقق من صلاحية الوصول وحاول مجدداً.`);
      return res.json();
    },
    enabled: !permissionsLoading && allowed,
  });

  useEffect(() => setPage(1), [search, status]);
  const term = search.trim().toLocaleLowerCase();
  const filtered = employees.filter(employee => {
    if (status !== "all" && employee.isActive !== status) return false;
    if (!term) return true;
    return [
      employee.firstName, employee.lastName,
      `${employee.firstName || ""} ${employee.lastName || ""}`,
      employee.username, employee.phone, employee.email, employee.jobTitle,
    ].some(value => value?.toLocaleLowerCase().includes(term));
  });
  const exportRows = filtered.map(employee => ({
    name: `${employee.firstName || ""} ${employee.lastName || ""}`.trim() || employee.username,
    username: employee.username,
    department: employee.departmentName || "غير محدد الإدارة",
    jobTitle: employee.jobTitle || "-",
    phone: employee.phone || "-",
    email: employee.email || "-",
    status: employee.isActive === "active" ? "نشط" : "غير نشط",
  }));

  return (
    <Layout>
      <div className="page-container space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">موظفو الإدارة العامة</h1>
            <p className="text-sm text-muted-foreground mt-1">دليل موظفي المركز الرئيسي — عرض فقط</p>
          </div>
          {allowed && (
            <Link href="/users">
              <Button variant="outline" className="h-11 sm:h-9">إدارة المستخدمين</Button>
            </Link>
          )}
        </div>
        {!permissionsLoading && !allowed ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">ليس لديك صلاحية للوصول لهذه الصفحة</CardContent></Card>
        ) : (
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />دليل الموظفين</CardTitle>
                <CardDescription className="mt-1">تظهر «غير محدد الإدارة» إلى حين اعتماد تعيين الإدارات صراحةً؛ لا يعني ذلك تعييناً تلقائياً.</CardDescription>
              </div>
              {canExport("users") && !isLoading && !error && (
                <ExportButtons data={exportRows} columns={columns} fileName="موظفو-الإدارة-العامة" title="موظفو الإدارة العامة" sheetName="الموظفون" />
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input className="h-11 sm:h-10 sm:max-w-sm" placeholder="بحث بالاسم أو اسم المستخدم أو الجوال..." value={search} onChange={event => setSearch(event.target.value)} aria-label="بحث الموظفين" />
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-11 sm:h-10 w-full sm:w-40" aria-label="تصفية الحالة"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="inactive">غير نشط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {permissionsLoading || isLoading ? (
                <div className="flex items-center justify-center min-h-40"><Loader2 className="w-7 h-7 animate-spin text-primary" aria-label="جار تحميل الموظفين" /></div>
              ) : error ? (
                <p role="alert" className="text-center py-8 text-destructive">{error instanceof Error ? error.message : "تعذر تحميل موظفي الإدارة العامة."}</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">إجمالي النتائج: {filtered.length}</p>
                  <div className="border rounded-lg overflow-x-auto">
                    <Table className="min-w-[650px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>الموظف</TableHead><TableHead>الإدارة</TableHead><TableHead>المسمى الوظيفي</TableHead>
                          <TableHead>الجوال</TableHead><TableHead>البريد الإلكتروني</TableHead><TableHead>الحالة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                            {employees.length ? "لا توجد نتائج تطابق البحث أو التصفية" : "لا يوجد موظفون في الإدارة العامة"}
                          </TableCell></TableRow>
                        ) : filtered.slice((page - 1) * 10, page * 10).map(employee => (
                          <TableRow key={employee.id}>
                            <TableCell>
                              <div className="font-medium">{`${employee.firstName || ""} ${employee.lastName || ""}`.trim() || employee.username}</div>
                              <div className="text-xs text-muted-foreground">{employee.username}</div>
                            </TableCell>
                            <TableCell>{employee.departmentName || "غير محدد الإدارة"}</TableCell>
                            <TableCell>{employee.jobTitle || "-"}</TableCell>
                            <TableCell dir="ltr" className="text-right">{employee.phone || "-"}</TableCell>
                            <TableCell>{employee.email || "-"}</TableCell>
                            <TableCell><Badge variant={employee.isActive === "active" ? "default" : "secondary"}>{employee.isActive === "active" ? "نشط" : "غير نشط"}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <TablePagination currentPage={page} totalItems={filtered.length} itemsPerPage={10} onPageChange={setPage} />
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}