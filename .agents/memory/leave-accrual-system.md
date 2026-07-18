---
name: Leave accrual (رصيد مستحق حتى تاريخه)
description: How the contract-based accrual layer coexists with the year-bucket leave balances and which system gates approval.
---

- Two balance systems coexist for annual leave: legacy year buckets (`leave_balances`, `getLeaveBalanceSummary`) and the accrual layer driven by 3 nullable `branch_employees` columns (annual_leave_days, leave_opening_balance, leave_opening_balance_date).
- **Approval gating rule:** the accrual balance is authoritative ONLY when `annualLeaveDays` is set on the employee; otherwise the year-bucket check applies. Unpaid stays exempt; `allowOverBalance` still overrides.
  **Why:** lets branches adopt the contract system per-employee without breaking existing year-bucket data.
- Accrual math: start = opening-balance date (opening balance covers everything up to and INCLUDING that date) else hire date; accrues daily at annualDays/365; deducts approved annual leave days strictly AFTER the start date (past = used, future = reserved) plus active settlements with settlementDate > start.
- `computeAccruedLeaveBalance` is pure (takes pre-fetched leaves/settlements) so bulk endpoints stay at 2 batched queries; `getAccruedLeaveBalance` is the single-employee wrapper. Never loop the wrapper over a list (N+1).
- HR list endpoints must scope via `getBranchScope` (hr-routes local helper with cross-branch HR read elevation), NOT raw `getEffectiveBranchFilter` — otherwise hr_manager sees empty data.

## قاعدة قيمة اليوم النقدية (2026-07-18، قرار المالك)
- بدل اليوم في التصفية النقدية/الحاسبة/المعاينة = الراتب الإجمالي ÷ 30 **دائماً** (أيام الشهر)، وليس ÷ أيام العقد (21/30).
- **Why:** المالك أكد أن أيام العقد تحدد الاستحقاق السنوي فقط؛ التسعير اليومي شهري ثابت (متسق مع قاعدة proration الرواتب gross/30).
- **How to apply:** أي مكان جديد يحسب dailyRate لرصيد الإجازات يجب أن يستخدم divisor=30؛ السجلات التاريخية المخزنة تحتفظ بقيمها كما صُرفت.
