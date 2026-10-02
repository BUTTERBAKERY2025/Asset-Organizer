---
name: Employee account delegation
description: User-approved security boundary for operations-manager employee account administration.
---

Operations managers may administer employee-linked accounts only within their explicitly assigned branches. Delegatable permissions come from an administrator-approved allowlist, not automatically from the manager's own permissions. Both job templates and custom selections must obey that ceiling.

**Why:** The user explicitly chose administrator-approved permissions, and requires employee linkage before any account can be created. General user-administration authority would defeat this boundary.

**How to apply:** Preserve employee linkage, branch scoping, exclusion of protected accounts from management and server-generated noneditable credentials across all entry points, including legacy APIs. Keep display names tied to the employee record; compact usernames must not weaken generated passwords.

The delegation policy is prospective: disabling or narrowing it stops new grants, not existing employee access. Keep eligible accounts visible for suspension and reduction of permissions; require explicit action to remove existing access.

**Why:** Hiding accounts on policy withdrawal prevented managers from performing emergency suspension. Silent bulk revocation would be a different, destructive policy that the user did not request.

**How to apply:** Explain this distinction in policy controls. Allow safety suspension and reduction-only edits while the permission policy is disabled only if the manager still has individual employee delegation; do not relax branch or protected-account checks.

Session revocation must cover authentication already in progress, not just session IDs that already exist.

**Why:** Password verification can finish before a reset but issue a new session afterward; deleting or marking existing sessions alone does not stop this race.

**How to apply:** Carry the pre-verification revocation generation through password and OTP authentication, check it at issuance and on authenticated requests, and test paused authentication overlapping revocation.

Employee accounts are used daily by workers, so automatically generated usernames and passwords must be practical to type; the user explicitly rejected long random credentials while requiring generation to remain automatic.

**Why:** The user expects long credentials to cause repeated daily sign-in difficulties for workers.

**How to apply:** Use compact cryptographically generated credentials with unambiguous characters, retain secure password hashing and rate limiting, and do not silently change existing account credentials.

The user approved expanding delegation to branch requests and shipment receipt, branch stock and stocktaking, and attendance and schedules. Production was not selected.

**Why:** These are the operational duties the user explicitly chose when asked which additional employee permissions are needed.

**How to apply:** Offer narrowly scoped operational capabilities within the administrator-approved ceiling; do not grant broad inventory, financial, HR personnel, or global administration access merely to expose these workflows.

The directory should show all active employees in authorized branches, separated into linked-account and no-account tabs. Protected accounts must not hide the basic employee row: label it “حساب محمي — يتطلب مسؤول النظام”; distinguish “بلا حساب” and “حساب قابل للإدارة”.

**Why:** The user explicitly requested active employees only and separate linked/unlinked tabs, while retaining protected-account restrictions.

**How to apply:** Separate basic roster visibility from account-management authority; never expose protected account details merely to explain that management is blocked.

Administrators select individual employees independently for each operations manager, in addition to setting the allowed permission ceiling.

**Why:** The user explicitly chose “اختيار مستقل لكل مدير تشغيل” rather than a shared employee list.

**How to apply:** Require both explicit employee selection and current branch-management authority for every account-management action. Roster visibility is broader than this authority. Removing delegation must not silently disable the employee's account or revoke their own access.

The user states that the system serves multiple functions and departments, not just operations, and expects additional departments. They want to build on existing authorization, correct security flaws and maintain coherent, secure, expandable governance rather than a separate operations-only permission system. The proposed job matrix was not approved.

**Why:** The user is concerned that parallel authorization mechanisms would introduce conflicts and vulnerabilities as sectors and departments expand.

**How to apply:** Treat job templates as an assignment convenience within the existing shared authorization model. Preserve cross-department requirements and explain compatibility and migration effects before proposing broad changes; do not treat the earlier job matrix as approved permissions.

The user emphasizes that the system is live and has users; integrated governance work must preserve ongoing operations.

**Why:** The user explicitly requested extreme care because people currently use the system.

**How to apply:** Keep inventory read-only, distinguish external database evidence from verified live-runtime evidence, and require reviewed impact before changing existing access. Do not turn an inventory request into an account migration or service restart.

For non-admin accounts, the user approved that an explicit, currently applicable deny takes precedence over every grant source, within the deny's scope.

**Why:** The user selected this rule while approving the shared organization-wide governance policy.

**How to apply:** Include direct permissions, templates, assigned roles and automatic grants for non-admin accounts. The user subsequently directed preserving admin's existing full access without new policy restrictions for now, and deferred emergency-access policy. Policy approval is not permission to change current accounts; review impact before implementation.

Across all departments, the user approved granting authority for the administrator and explicitly bounded delegates. The administrator defines delegatable permissions, manageable accounts and scope; possessing a permission does not authorize granting it, and delegates cannot expand their own authority.

**Why:** The user selected bounded delegation as the shared organization-wide policy.

**How to apply:** Preserve the existing operations-specific safeguards. This approves the principle, not new delegates or changes to current delegations; review those separately before applying it.

The user approved explicit per-account base-permission modes: role inheritance or direct-only permissions. Approved additions and explicit denies stay separate from the base; an empty direct-only list must not restore inheritance.

**Why:** The user selected explicit modes to resolve conflicting permission-source behavior without silently merging existing access.

**How to apply:** Do not choose or migrate existing accounts' modes automatically. Present impact before changes and review employee self-service rights separately from operational permissions.

The user approved three shared governance rules: job-title or department changes do not automatically grant permissions; each grant stays bound to its action, scope and validity period; new template versions require a diff preview and explicit approval before application to existing accounts, preserving independent additions and denies.

**Why:** The user explicitly selected all three rules during policy approval.

**How to apply:** Keep organizational edits separate from approved security assignments, never extend action grants merely through broader viewing access, and never use template edits to silently rewrite current accounts. Review legacy behavior changes before application.

The user approved preventing self-approval and separating financial disbursement authority from HR editing, with transaction-specific separation and explicitly approved, recorded exceptions. Transfer or termination requires an HR/admin-coordinated, dated access review and removal/retention plan, with explicit decisions for other assignments and self-service access.

**Why:** The user approved these shared governance principles, not live transaction or account changes.

**How to apply:** Define the transaction responsibility matrix, approvers and employee transition plans before implementation; do not infer automatic blanket revocation.

The user approved rejecting permission, role and delegation changes when a durable audit record of actor, change, time and reason cannot be saved.

**Why:** Authority changes must not succeed without reliable traceability.

**How to apply:** Reject the affected change rather than stopping the whole application, subject to the user's subsequent instruction not to impose new policy restrictions on admin now. Emergency security suspension was explicitly deferred; retention duration and audit access/review ownership still need specification before implementation.

The user directed: «الادمن عنده كل شيء لا يخضع الان ل اي سياسه» and deferred both a new admin policy and the proposed emergency-suspension mechanism.

**Why:** The user requires keeping the existing full admin authority unchanged for now.

**How to apply:** Do not impose the newly approved governance restrictions on admin or implement the deferred recovery/emergency proposals. Preserve existing behavior; this is not authorization to remove existing safeguards or add new bypasses. Do not treat the deferral as approval of the recommended admin constraints.