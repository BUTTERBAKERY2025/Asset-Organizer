import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, FileText, Loader2, Users, DollarSign, AlertCircle } from "lucide-react";
import type { Contractor } from "@shared/schema";

interface ContractorSummary {
  contractor: Contractor;
  contractsCount: number;
  contractsTotal: number;
  totalPaid: number;
  balance: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ar-SA-u-nu-latn", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export default function ContractorStatementsPage() {
  const [search, setSearch] = useState("");

  const { data: summaries = [], isLoading } = useQuery<ContractorSummary[]>({
    queryKey: ["/api/construction/contractors-statements/summary"],
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return summaries;
    const q = search.toLowerCase();
    return summaries.filter(
      (s) =>
        s.contractor.name?.toLowerCase().includes(q) ||
        s.contractor.phone?.toLowerCase().includes(q) ||
        s.contractor.email?.toLowerCase().includes(q),
    );
  }, [summaries, search]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, s) => {
        acc.contractsTotal += Number(s.contractsTotal || 0);
        acc.totalPaid += Number(s.totalPaid || 0);
        acc.balance += Number(s.balance || 0);
        acc.contractsCount += Number(s.contractsCount || 0);
        return acc;
      },
      { contractsTotal: 0, totalPaid: 0, balance: 0, contractsCount: 0 },
    );
  }, [filtered]);

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6" dir="rtl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">
              كشوف حساب المقاولين
            </h1>
            <p className="text-muted-foreground mt-1">
              عرض موحد لكشوف حسابات جميع المقاولين والعقود والمدفوعات والمصروفات
            </p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">عدد المقاولين</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-contractors">
                {filtered.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">إجمالي العقود</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-contracts-value">
                {formatCurrency(totals.contractsTotal)}
              </div>
              <p className="text-xs text-muted-foreground">
                {totals.contractsCount} عقد
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">إجمالي المدفوع</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-total-paid">
                {formatCurrency(totals.totalPaid)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">إجمالي المتبقي</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600" data-testid="text-total-balance">
                {formatCurrency(totals.balance)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle>قائمة المقاولين</CardTitle>
              <div className="relative w-full md:w-72">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالاسم أو الجوال..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10"
                  data-testid="input-search-contractors"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                لا توجد بيانات للعرض
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المقاول</TableHead>
                      <TableHead className="text-right">البريد</TableHead>
                      <TableHead className="text-right">الجوال</TableHead>
                      <TableHead className="text-right">عدد العقود</TableHead>
                      <TableHead className="text-right">قيمة العقود</TableHead>
                      <TableHead className="text-right">المدفوع</TableHead>
                      <TableHead className="text-right">المتبقي</TableHead>
                      <TableHead className="text-right">الإجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => (
                      <TableRow
                        key={s.contractor.id}
                        data-testid={`row-contractor-${s.contractor.id}`}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span data-testid={`text-contractor-name-${s.contractor.id}`}>
                              {s.contractor.name}
                            </span>
                            {s.contractor.specialization && (
                              <Badge variant="outline" className="text-xs">
                                {s.contractor.specialization}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{s.contractor.email || "-"}</TableCell>
                        <TableCell>{s.contractor.phone || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{s.contractsCount}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(s.contractsTotal)}</TableCell>
                        <TableCell className="text-green-600">
                          {formatCurrency(s.totalPaid)}
                        </TableCell>
                        <TableCell
                          className={
                            s.balance > 0 ? "text-orange-600 font-bold" : "text-green-600"
                          }
                          data-testid={`text-balance-${s.contractor.id}`}
                        >
                          {formatCurrency(s.balance)}
                        </TableCell>
                        <TableCell>
                          <Link href={`/contractors/${s.contractor.id}/statement`}>
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`button-view-statement-${s.contractor.id}`}
                            >
                              <FileText className="h-4 w-4 ml-1" />
                              كشف الحساب
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
