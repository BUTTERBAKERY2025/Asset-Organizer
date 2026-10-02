---
name: Employee account delegation
description: User-approved security boundary for operations-manager employee account administration.
---

Operations managers may administer employee-linked accounts only within their explicitly assigned branches. Delegatable permissions come from an administrator-approved allowlist, not automatically from the manager's own permissions. Both job templates and custom selections must obey that ceiling.

**Why:** The user explicitly chose administrator-approved permissions, and requires employee linkage before any account can be created. General user-administration authority would defeat this boundary.

**How to apply:** Preserve employee linkage, branch scoping, exclusion of protected accounts from management and server-generated noneditable credentials across all entry points, including legacy APIs. Keep display names tied to the employee record; compact usernames must not weaken generated passwords.

The delegation policy is prospective: disabling or narrowing it stops new grants, not existing employee access. Keep eligible accounts visible for suspension and reduction of permissions; require explicit action to remove existing access.

**Why:** Hiding accounts on policy withdrawal prevented managers from performing emergency suspension. Silent bulk revocation would be a different, destructive policy that the user did not request.

**How to apply:** Explain this distinction in policy controls. Allow safety suspension and reduction-only edits while disabled, without relaxing branch or protected-account checks.

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