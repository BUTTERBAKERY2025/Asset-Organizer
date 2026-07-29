---
name: Drizzle undefined select field crash
description: Selecting a non-existent schema property in db.select({...}) throws "Cannot convert undefined or null to object" at runtime
---

Referencing a schema property that doesn't exist (e.g. `branchEmployees.isActive` when the table only has `status`) compiles fine but crashes at runtime inside Drizzle's `orderSelectedFields` with **"Cannot convert undefined or null to object"** → route returns 500 in every environment.

**Why:** TypeScript never catches it here (`npm run check` OOMs and is skipped), and the error message gives no hint about which field is wrong — it looks like a data/DB problem. The cashier-deficits page was "broken on prod" for this reason while the DB was perfectly healthy.

**How to apply:**
- When a Drizzle route 500s with this message, grep the select object for fields missing from the table definition in `shared/schema.ts` — don't chase DB/schema drift first.
- `branch_employees` uses `status` ('active'/'inactive'/'terminated'/'on_leave'), NOT `isActive`. Activity checks = `status === "active"`.
- Passing an undefined field in plain object position (`e.isActive` on a full `select()` row) is silently `undefined`/falsy — same root cause, subtler symptom (wrong employee file picked instead of a crash).
