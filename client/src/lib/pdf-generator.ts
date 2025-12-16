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

export function generatePaymentRequestsPDF(
  requests: PaymentRequestData[],
  projects: ProjectData[],
  branches: BranchData[],
  categories: CategoryData[],
  dateFilter: string
): void {
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

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('يرجى السماح بفتح النوافذ المنبثقة لتحميل التقرير');
    return;
  }

  const logoUrl = '/attached_assets/logo_-5_1765206843638.png';
  
  const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تقرير طلبات الدفع - ${formatDate(dateFilter)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Cairo', sans-serif;
      direction: rtl;
      padding: 20px;
      background: white;
      color: #333;
      font-size: 12px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #d4a853;
      padding-bottom: 20px;
    }
    .header .logo {
      max-height: 80px;
      margin-bottom: 15px;
    }
    .header h1 {
      font-size: 24px;
      color: #333;
      margin-bottom: 10px;
    }
    .header .date {
      color: #666;
      font-size: 14px;
    }
    .summary {
      display: flex;
      justify-content: space-around;
      background: #f9f9f9;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 25px;
    }
    .summary-item {
      text-align: center;
    }
    .summary-item .label {
      color: #666;
      font-size: 12px;
    }
    .summary-item .value {
      font-size: 18px;
      font-weight: bold;
      color: #d4a853;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 10px 8px;
      text-align: right;
    }
    th {
      background: #f5f5f5;
      font-weight: 600;
      color: #333;
    }
    tr:nth-child(even) {
      background: #fafafa;
    }
    .details-section {
      margin-top: 30px;
    }
    .details-section h2 {
      font-size: 16px;
      margin-bottom: 15px;
      color: #333;
      border-bottom: 1px solid #ddd;
      padding-bottom: 10px;
    }
    .request-card {
      border: 1px solid #eee;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
      background: #fafafa;
    }
    .request-header {
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 10px;
      color: #333;
    }
    .request-details {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .detail-item {
      font-size: 11px;
    }
    .detail-item .label {
      color: #666;
    }
    .detail-item .value {
      font-weight: 600;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #888;
      font-size: 10px;
    }
    .amount {
      font-weight: bold;
      color: #2e7d32;
    }
    .status-pending { color: #f59e0b; }
    .status-approved { color: #3b82f6; }
    .status-rejected { color: #ef4444; }
    .status-paid { color: #22c55e; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
    .print-btn {
      position: fixed;
      top: 20px;
      left: 20px;
      background: #d4a853;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-family: 'Cairo', sans-serif;
      font-size: 14px;
      font-weight: bold;
    }
    .print-btn:hover {
      background: #c49843;
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">طباعة / حفظ PDF</button>
  
  <div class="header">
    <img src="${logoUrl}" alt="باتر بيكري" class="logo" />
    <h1>تقرير طلبات الدفع</h1>
    <div class="date">${formatDate(dateFilter)}</div>
  </div>

  <div class="summary">
    <div class="summary-item">
      <div class="label">عدد الطلبات</div>
      <div class="value">${requests.length}</div>
    </div>
    <div class="summary-item">
      <div class="label">إجمالي المبالغ</div>
      <div class="value">${totalAmount.toLocaleString()} ر.س</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>رقم الطلب</th>
        <th>النوع</th>
        <th>المشروع</th>
        <th>الفرع</th>
        <th>المستفيد</th>
        <th>البنك</th>
        <th>المبلغ</th>
        <th>الحالة</th>
      </tr>
    </thead>
    <tbody>
      ${requests.map((req, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${req.requestNumber || `#${req.id}`}</td>
          <td>${REQUEST_TYPE_LABELS[req.requestType] || req.requestType}</td>
          <td>${getProjectName(req.projectId)}</td>
          <td>${getBranchName(req.projectId)}</td>
          <td>${req.beneficiaryName || "-"}</td>
          <td>${req.beneficiaryBank || "-"}</td>
          <td class="amount">${req.amount.toLocaleString()} ر.س</td>
          <td class="status-${req.status}">${STATUS_LABELS[req.status] || req.status}</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr style="background: #f5f5f5; font-weight: bold;">
        <td colspan="7">الإجمالي</td>
        <td class="amount">${totalAmount.toLocaleString()} ر.س</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div class="details-section">
    <h2>تفاصيل الطلبات</h2>
    ${requests.map((req, index) => `
      <div class="request-card">
        <div class="request-header">${index + 1}. ${req.requestNumber || `طلب #${req.id}`}</div>
        <div class="request-details">
          <div class="detail-item">
            <span class="label">الوصف: </span>
            <span class="value">${req.description}</span>
          </div>
          <div class="detail-item">
            <span class="label">المشروع: </span>
            <span class="value">${getProjectName(req.projectId)}</span>
          </div>
          <div class="detail-item">
            <span class="label">الفرع: </span>
            <span class="value">${getBranchName(req.projectId)}</span>
          </div>
          <div class="detail-item">
            <span class="label">التصنيف: </span>
            <span class="value">${getCategoryName(req.categoryId)}</span>
          </div>
          <div class="detail-item">
            <span class="label">المستفيد: </span>
            <span class="value">${req.beneficiaryName || "-"}</span>
          </div>
          <div class="detail-item">
            <span class="label">البنك: </span>
            <span class="value">${req.beneficiaryBank || "-"}</span>
          </div>
          <div class="detail-item">
            <span class="label">رقم الحساب: </span>
            <span class="value">${req.beneficiaryIban || "-"}</span>
          </div>
          <div class="detail-item">
            <span class="label">رقم الفاتورة: </span>
            <span class="value">${req.invoiceNumber || "-"}</span>
          </div>
          <div class="detail-item">
            <span class="label">المبلغ: </span>
            <span class="value amount">${req.amount.toLocaleString()} ر.س</span>
          </div>
          <div class="detail-item">
            <span class="label">الأولوية: </span>
            <span class="value">${PRIORITY_LABELS[req.priority || "normal"]}</span>
          </div>
          <div class="detail-item">
            <span class="label">تاريخ الاستحقاق: </span>
            <span class="value">${req.dueDate || "-"}</span>
          </div>
          <div class="detail-item">
            <span class="label">الحالة: </span>
            <span class="value status-${req.status}">${STATUS_LABELS[req.status] || req.status}</span>
          </div>
          ${req.notes ? `
          <div class="detail-item" style="grid-column: span 3;">
            <span class="label">ملاحظات: </span>
            <span class="value">${req.notes}</span>
          </div>
          ` : ''}
        </div>
      </div>
    `).join('')}
  </div>

  <div class="footer">
    <p>تم إنشاء هذا التقرير بواسطة نظام إدارة المشروعات - باتر بيكري</p>
    <p>${new Date().toLocaleString('ar-SA')}</p>
  </div>
</body>
</html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

export function downloadPDF(
  requests: PaymentRequestData[],
  projects: ProjectData[],
  branches: BranchData[],
  categories: CategoryData[],
  dateFilter: string
): void {
  generatePaymentRequestsPDF(requests, projects, branches, categories, dateFilter);
}

export async function sharePDF(
  requests: PaymentRequestData[],
  projects: ProjectData[],
  branches: BranchData[],
  categories: CategoryData[],
  dateFilter: string
): Promise<boolean> {
  generatePaymentRequestsPDF(requests, projects, branches, categories, dateFilter);
  return true;
}
