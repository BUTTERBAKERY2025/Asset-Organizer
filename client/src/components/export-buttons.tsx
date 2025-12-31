import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { exportToExcel, exportToCSV, printAsPDF, ExportColumn } from "@/lib/export-utils";

interface ExportButtonsProps {
  data: any[];
  columns: ExportColumn[];
  fileName: string;
  title: string;
  subtitle?: string;
  sheetName?: string;
  disabled?: boolean;
  headerInfo?: { label: string; value: string }[];
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
}: ExportButtonsProps) {
  const handleExcelExport = () => {
    exportToExcel(data, columns, fileName, sheetName, headerInfo);
  };

  const handleCSVExport = () => {
    exportToCSV(data, columns, fileName);
  };

  const handlePrint = () => {
    printAsPDF(data, columns, title, subtitle, headerInfo);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={disabled || data.length === 0}
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
        <DropdownMenuItem onClick={handlePrint} className="gap-2 cursor-pointer" data-testid="btn-export-pdf">
          <Printer className="h-4 w-4 text-red-600" />
          <span>طباعة PDF</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
