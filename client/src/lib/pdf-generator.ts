import pdfMake from "pdfmake/build/pdfmake";
import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces";

interface PaymentRequestData {
  id: number;
  requestNumber?: string | null;
  requestType: string;
  amount: number;
  description: string;
  beneficiaryName?: string | null;
  beneficiaryBank?: string | null;
  beneficiaryIban?: string | null;
  status: string;
  priority?: string | null;
  dueDate?: string | null;
  invoiceNumber?: string | null;
  notes?: string | null;
  requestDate?: string | null;
  createdAt?: string | Date | null;
  projectId: number;
  categoryId?: number | null;
}

interface ProjectData {
  id: number;
  title: string;
  branchId: string;
}

interface BranchData {
  id: string;
  name: string;
}

interface CategoryData {
  id: number;
  name: string;
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  transfer: "حوالة",
  expense: "مصروف",
  advance: "سلفة",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  paid: "مدفوع",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "عاجل",
  high: "مرتفع",
  normal: "عادي",
  low: "منخفض",
};

export async function generatePaymentRequestsPDF(
  requests: PaymentRequestData[],
  projects: ProjectData[],
  branches: BranchData[],
  categories: CategoryData[],
  dateFilter: string
): Promise<Blob> {
  const projectMap = new Map(projects.map(p => [p.id, p]));
  const branchMap = new Map(branches.map(b => [b.id, b]));
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-SA', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    });
  };

  const getProjectName = (projectId: number) => {
    return projectMap.get(projectId)?.title || "-";
  };

  const getBranchName = (projectId: number) => {
    const project = projectMap.get(projectId);
    if (!project) return "-";
    return branchMap.get(project.branchId)?.name || "-";
  };

  const getCategoryName = (categoryId: number | null | undefined) => {
    if (!categoryId) return "-";
    return categoryMap.get(categoryId)?.name || "-";
  };

  const totalAmount = requests.reduce((sum, r) => sum + r.amount, 0);

  const tableBody: TableCell[][] = [
    [
      { text: "#", style: "tableHeader", alignment: "center" },
      { text: "رقم الطلب", style: "tableHeader", alignment: "center" },
      { text: "النوع", style: "tableHeader", alignment: "center" },
      { text: "المشروع", style: "tableHeader", alignment: "center" },
      { text: "الفرع", style: "tableHeader", alignment: "center" },
      { text: "المستفيد", style: "tableHeader", alignment: "center" },
      { text: "البنك", style: "tableHeader", alignment: "center" },
      { text: "المبلغ", style: "tableHeader", alignment: "center" },
      { text: "الحالة", style: "tableHeader", alignment: "center" },
    ],
    ...requests.map((req, index) => [
      { text: String(index + 1), alignment: "center" as const },
      { text: req.requestNumber || `#${req.id}`, alignment: "center" as const },
      { text: REQUEST_TYPE_LABELS[req.requestType] || req.requestType, alignment: "center" as const },
      { text: getProjectName(req.projectId), alignment: "right" as const },
      { text: getBranchName(req.projectId), alignment: "right" as const },
      { text: req.beneficiaryName || "-", alignment: "right" as const },
      { text: req.beneficiaryBank || "-", alignment: "right" as const },
      { text: `${req.amount.toLocaleString()} ر.س`, alignment: "center" as const },
      { text: STATUS_LABELS[req.status] || req.status, alignment: "center" as const },
    ]),
  ];

  const content: Content = [
    {
      text: "تقرير طلبات الدفع",
      style: "header",
      alignment: "center",
      margin: [0, 0, 0, 10],
    },
    {
      text: `التاريخ: ${formatDate(dateFilter)}`,
      style: "subheader",
      alignment: "center",
      margin: [0, 0, 0, 20],
    },
    {
      text: `عدد الطلبات: ${requests.length}`,
      alignment: "right",
      margin: [0, 0, 0, 5],
    },
    {
      text: `إجمالي المبالغ: ${totalAmount.toLocaleString()} ر.س`,
      alignment: "right",
      margin: [0, 0, 0, 15],
      bold: true,
    },
    {
      table: {
        headerRows: 1,
        widths: ["auto", "auto", "auto", "*", "auto", "*", "auto", "auto", "auto"],
        body: tableBody,
      },
      layout: {
        fillColor: (rowIndex: number) => {
          if (rowIndex === 0) return "#f3f4f6";
          return rowIndex % 2 === 0 ? "#ffffff" : "#f9fafb";
        },
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => "#e5e7eb",
        vLineColor: () => "#e5e7eb",
      },
    },
    {
      text: "",
      margin: [0, 20, 0, 0],
    },
    {
      text: "تفاصيل الطلبات:",
      style: "sectionHeader",
      alignment: "right",
      margin: [0, 0, 0, 10],
    },
    ...requests.map((req, index) => {
      const detailItems: Content[] = [
        {
          text: `${index + 1}. ${req.requestNumber || `طلب #${req.id}`}`,
          bold: true,
          alignment: "right",
          margin: [0, 10, 0, 5],
        } as Content,
        {
          columns: [
            {
              width: "*",
              stack: [
                { text: `الوصف: ${req.description}`, alignment: "right" },
                { text: `المشروع: ${getProjectName(req.projectId)}`, alignment: "right" },
                { text: `الفرع: ${getBranchName(req.projectId)}`, alignment: "right" },
                { text: `التصنيف: ${getCategoryName(req.categoryId)}`, alignment: "right" },
              ],
            },
            {
              width: "*",
              stack: [
                { text: `المستفيد: ${req.beneficiaryName || "-"}`, alignment: "right" },
                { text: `البنك: ${req.beneficiaryBank || "-"}`, alignment: "right" },
                { text: `رقم الحساب: ${req.beneficiaryIban || "-"}`, alignment: "right" },
                { text: `رقم الفاتورة: ${req.invoiceNumber || "-"}`, alignment: "right" },
              ],
            },
            {
              width: "auto",
              stack: [
                { text: `المبلغ: ${req.amount.toLocaleString()} ر.س`, alignment: "right", bold: true },
                { text: `الأولوية: ${PRIORITY_LABELS[req.priority || "normal"]}`, alignment: "right" },
                { text: `الحالة: ${STATUS_LABELS[req.status] || req.status}`, alignment: "right" },
                { text: `تاريخ الاستحقاق: ${req.dueDate || "-"}`, alignment: "right" },
              ],
            },
          ],
          columnGap: 10,
        } as Content,
      ];
      
      if (req.notes) {
        detailItems.push({ 
          text: `ملاحظات: ${req.notes}`, 
          alignment: "right", 
          italics: true, 
          color: "#6b7280", 
          margin: [0, 5, 0, 0] 
        } as Content);
      }
      
      detailItems.push({
        canvas: [{ type: "line", x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 0.5, lineColor: "#e5e7eb" }],
      } as Content);
      
      return { stack: detailItems } as Content;
    }),
  ];

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [40, 40, 40, 40],
    content,
    styles: {
      header: {
        fontSize: 18,
        bold: true,
      },
      subheader: {
        fontSize: 14,
        color: "#6b7280",
      },
      sectionHeader: {
        fontSize: 14,
        bold: true,
      },
      tableHeader: {
        bold: true,
        fontSize: 10,
        fillColor: "#f3f4f6",
      },
    },
    defaultStyle: {
      fontSize: 9,
    },
  };

  return new Promise((resolve, reject) => {
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    pdfDocGenerator.getBlob((blob) => {
      resolve(blob);
    });
  });
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function sharePDF(blob: Blob, filename: string, title: string): Promise<boolean> {
  const file = new File([blob], filename, { type: "application/pdf" });
  
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: title,
        files: [file],
      });
      return true;
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Share failed:", error);
      }
      return false;
    }
  }
  return false;
}
