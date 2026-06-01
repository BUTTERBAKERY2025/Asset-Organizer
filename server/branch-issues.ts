import { db } from "./db";
import { sql } from "drizzle-orm";

// ============================================================
// Branch data-quality issues (incomplete employee data + expiring docs)
// Mirrors the completeness logic used in employee-reports-dashboard.tsx
// so the targeted-message feature can surface each branch's own problems.
// ============================================================

export interface EmployeeIssue {
  employeeName: string;
  status: "incomplete" | "expired" | "expiring";
  issues: string[];
}

export interface BranchIssues {
  branchId: string;
  branchName: string;
  totalActive: number;
  incompleteCount: number;
  expiredCount: number;
  expiringCount: number;
  employees: EmployeeIssue[];
}

function daysUntil(dateStr: string, today: Date): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return NaN;
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Compute data-quality issues for the given branches.
 * Returns one entry per branch (only branches that exist in the result set).
 */
export async function computeBranchIssues(branchIds: string[]): Promise<BranchIssues[]> {
  if (!branchIds || branchIds.length === 0) return [];

  // drizzle serializes a bare JS array as a record tuple (a, b), which breaks
  // `= ANY(${arr})`. Expand into individual bound params and use `IN (...)`.
  const branchList = sql.join(branchIds.map((v) => sql`${v}`), sql`, `);

  const rows: any = await db.execute(sql`
    SELECT
      be.branch_id,
      COALESCE(b.name, be.branch_id) AS branch_name,
      be.employee_name,
      be.nationality,
      be.iqama_number,
      be.iqama_expiry,
      be.passport_number,
      be.passport_expiry,
      be.health_certificate,
      be.health_certificate_expiry,
      be.phone_number,
      be.bank_name,
      be.bank_account_number
    FROM branch_employees be
    LEFT JOIN branches b ON b.id = be.branch_id
    WHERE be.status = 'active'
      AND be.branch_id IN (${branchList})
    ORDER BY be.branch_id, be.employee_name
  `);

  const list = (rows.rows || rows) as any[];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const byBranch = new Map<string, BranchIssues>();

  const getBranch = (id: string, name: string): BranchIssues => {
    let entry = byBranch.get(id);
    if (!entry) {
      entry = {
        branchId: id,
        branchName: name,
        totalActive: 0,
        incompleteCount: 0,
        expiredCount: 0,
        expiringCount: 0,
        employees: [],
      };
      byBranch.set(id, entry);
    }
    return entry;
  };

  // Ensure every requested branch shows up even with zero employees
  for (const r of list) {
    getBranch(r.branch_id, r.branch_name).totalActive++;
  }

  for (const r of list) {
    const branch = getBranch(r.branch_id, r.branch_name);
    const issues: string[] = [];
    let status: "complete" | "incomplete" | "expired" | "expiring" = "complete";

    const escalate = (next: "incomplete" | "expired" | "expiring") => {
      // priority: expired > expiring > incomplete > complete
      const rank = { complete: 0, incomplete: 1, expiring: 2, expired: 3 } as const;
      if (rank[next] > rank[status]) status = next;
    };

    const isSaudi = r.nationality === "سعودي";

    // إقامة (لغير السعودي)
    if (!isSaudi) {
      if (!r.iqama_number) { issues.push("رقم الإقامة غير مسجل"); escalate("incomplete"); }
      if (!r.iqama_expiry) {
        issues.push("تاريخ انتهاء الإقامة غير مسجل");
        escalate("incomplete");
      } else {
        const d = daysUntil(r.iqama_expiry, today);
        if (d < 0) { issues.push("الإقامة منتهية"); escalate("expired"); }
        else if (d <= 60) { issues.push(`الإقامة تنتهي خلال ${d} يوم`); escalate("expiring"); }
      }
    }

    // جواز السفر
    if (!r.passport_number) { issues.push("رقم الجواز غير مسجل"); escalate("incomplete"); }
    if (!r.passport_expiry) {
      issues.push("تاريخ انتهاء الجواز غير مسجل");
      escalate("incomplete");
    } else {
      const d = daysUntil(r.passport_expiry, today);
      if (d < 0) { issues.push("الجواز منتهي"); escalate("expired"); }
      else if (d <= 60) { issues.push(`الجواز ينتهي خلال ${d} يوم`); escalate("expiring"); }
    }

    // الشهادة الصحية
    if (!r.health_certificate || r.health_certificate === "none") {
      issues.push("الشهادة الصحية غير مسجلة");
      escalate("incomplete");
    } else if (!r.health_certificate_expiry) {
      issues.push("تاريخ انتهاء الشهادة الصحية غير مسجل");
      escalate("incomplete");
    } else {
      const d = daysUntil(r.health_certificate_expiry, today);
      if (d < 0) { issues.push("الشهادة الصحية منتهية"); escalate("expired"); }
      else if (d <= 30) { issues.push(`الشهادة الصحية تنتهي خلال ${d} يوم`); escalate("expiring"); }
    }

    // بيانات أساسية
    if (!r.nationality) { issues.push("الجنسية غير محددة"); escalate("incomplete"); }
    if (!r.phone_number) { issues.push("رقم الهاتف غير مسجل"); escalate("incomplete"); }

    // بيانات بنكية (مهمة للرواتب)
    if (!r.bank_name || !r.bank_account_number) {
      issues.push("بيانات الحساب البنكي غير مكتملة");
      escalate("incomplete");
    }

    if (issues.length === 0 || status === "complete") continue;

    branch.employees.push({ employeeName: r.employee_name, status, issues });
    if (status === "expired") branch.expiredCount++;
    else if (status === "expiring") branch.expiringCount++;
    else branch.incompleteCount++;
  }

  return Array.from(byBranch.values());
}

/**
 * Build an Arabic WhatsApp/in-app message body summarizing a branch's issues.
 * Returns null when the branch has no issues worth sending.
 */
export function formatBranchIssuesMessage(branch: BranchIssues): string | null {
  const totalIssues = branch.incompleteCount + branch.expiredCount + branch.expiringCount;
  if (totalIssues === 0) return null;

  const lines: string[] = [];
  lines.push(`📋 بيانات تحتاج إكمالاً — فرع ${branch.branchName}`);
  lines.push("");
  lines.push(
    `الإجمالي النشط: ${branch.totalActive} • ناقص: ${branch.incompleteCount} • منتهي: ${branch.expiredCount} • يقترب الانتهاء: ${branch.expiringCount}`,
  );
  lines.push("");

  const icon = (s: EmployeeIssue["status"]) =>
    s === "expired" ? "🔴" : s === "expiring" ? "🟠" : "🟡";

  for (const emp of branch.employees) {
    lines.push(`${icon(emp.status)} ${emp.employeeName}: ${emp.issues.join("، ")}`);
  }

  lines.push("");
  lines.push("يرجى إكمال البيانات الناقصة في أقرب وقت.");
  return lines.join("\n");
}
