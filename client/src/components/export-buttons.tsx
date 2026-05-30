import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { exportToExcel, exportToCSV, downloadAsPDF, ExportColumn } from "@/lib/export-utils";

interface ExportButtonsProps {
  data: any[];
  columns: ExportColumn[];
  fileName: string;
  title: string;
  subtitle?: string;
  sheetName?: string;
  disabled?: boolean;
  headerInfo?: { label: string; value: string }[];
  // When provided, the rows to export are fetched on demand (e.g. ALL rows
  // matching the current filters when the visible list is server-paginated).
  // Falls back to `data` if not provided.
  fetchData?: () => Promise<any[]>;
}

export function ExportButtons({
  data,
  columns,
  fileName,
  title,
  subtitle,
  sheetName = "البيانات",
  disabled = false,
  headerInfo,
  fetchData,
}: ExportButtonsProps) {
  const resolveRows = async (): Promise<any[]> => {
    if (fetchData) {
      try {
        return await fetchData();
      } catch {
        return [];
      }
    }
    return data;
  };

  const handleExcelExport = async () => {
    const rows = await resolveRows();
    if (rows.length === 0) return;
    exportToExcel(rows, columns, fileName, sheetName, headerInfo);
  };

  const handleCSVExport = async () => {
    const rows = await resolveRows();
    if (rows.length === 0) return;
    exportToCSV(rows, columns, fileName);
  };

  const handlePDFExport = async () => {
    const rows = await resolveRows();
    if (rows.length === 0) return;
    downloadAsPDF(rows, columns, fileName, title, subtitle, headerInfo);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={disabled || (!fetchData && data.length === 0)}
          className="gap-2"
          data-testid="btn-export"
        >
          <Download className="h-4 w-4" />
          تصدير
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleExcelExport} className="gap-2 cursor-pointer" data-testid="btn-export-excel">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          <span>تصدير Excel</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCSVExport} className="gap-2 cursor-pointer" data-testid="btn-export-csv">
          <FileText className="h-4 w-4 text-blue-600" />
          <span>تصدير CSV</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePDFExport} className="gap-2 cursor-pointer" data-testid="btn-export-pdf">
          <FileDown className="h-4 w-4 text-red-600" />
          <span>تصدير PDF</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
