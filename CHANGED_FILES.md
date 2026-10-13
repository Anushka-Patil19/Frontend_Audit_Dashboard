# Audit Intelligence — Escalations & Multi-project Manager: changed files

Frontend only. The backend still needs to be built for these features (see the end of this file).

**How to apply:** unzip `escalation_handover_code.zip` into the project root (the folder that has `package.json`). The paths inside the zip match the project, so files land where they belong. Then run `npm run dev` and check the result.

Do **not** commit `package-lock.json` or `backend/invites.json` from the local copy. They changed while the app was running and are not part of this work.

---

## New files (7)

| # | Path | Purpose |
|---|------|---------|
| 1 | `src/lib/escalation-data.ts` | Types (`Level`, `Policy`, `ProjectConfig`, `OpenItem`, `Notification`, `RunSummary`, `ApprovalRecord`). Default escalation matrix: reminder 1 day before the limit, Manager when overdue (+0), CTO at +2 days, approval limit 2 days. Open-day limit inheritance: checkpoint → category → project → org default (2 days). Demo items: PIT Armour 5, SAATHI 2, MPS 2. |
| 2 | `src/lib/escalation-store.tsx` | `EscalationProvider` / `useEscalations()`: the state and actions for config, Simulate run, Fixed, Undo, Nudge, Approve, Reject and Reset demo. It currently saves to localStorage (`audit-intelligence-escalations-v1`). **This is the file to wire to the backend.** |
| 3 | `src/routes/escalations.tsx` | `/escalations?project=` page: project folders, escalation matrix and people (Save / Discard), per-category and per-checkpoint open-day limits. |
| 4 | `src/components/developer/EscalatedWork.tsx` | Developer "Overdue & escalated" card with the **Fixed** button. `useEscalationActions()` feeds the developer bell and KPIs. |
| 5 | `src/components/manager/EscalationPanels.tsx` | "Escalated to you" (Manager and CTO) and "Fixes waiting for your approval" (Approve / Reject with reason, approval record). Accepts one project or `"all"`. |
| 6 | `src/components/manager/ManagerPortfolio.tsx` | Manager **All projects** tab: 4 question tiles, My projects table with Open, team across projects. |
| 7 | `src/components/manager/project-context.tsx` | `ManagerProjectProvider` / `useManagerProject()`: tells each Manager section which project tab it is on. |

## Modified files (15)

| # | Path | Change |
|---|------|--------|
| 8 | `src/routes/__root.tsx` | Wraps the app in `<EscalationProvider>` (inside `<AuditProvider>`). |
| 9 | `src/routeTree.gen.ts` | Auto-generated; adds the `/escalations` route. |
| 10 | `src/components/layout/AppSidebar.tsx` | "Escalations" nav item; hidden for the Developer role and invite links. |
| 11 | `src/components/audit/CopilotSimulate.tsx` | New `projectId` prop. Simulate runs the escalation and shows who was notified (Developer / Manager / CTO). |
| 12 | `src/routes/projects.tsx` | Passes the selected project to `CopilotSimulate`. |
| 13 | `src/lib/developer-data.ts` | `DevAction.source?: "escalation"`. |
| 14 | `src/components/developer/DevSections.tsx` | "Waiting on others": Nudge (once a day), Undo. "Fix these" leaves out escalation items. |
| 15 | `src/components/developer/DeveloperDashboard.tsx` | Merges escalation items into the bell, KPIs and lists; renders `EscalatedWork`. |
| 16 | `src/lib/manager-data.ts` | `buildManagerView(checkpoints, projectId)`; per-project datasets `MANAGER_PROJECTS` for PIT Armour, SAATHI and MPS. SAATHI and MPS use mock data. |
| 17 | `src/components/manager/ManagerDashboard.tsx` | Tabs: All projects (default), PIT Armour, SAATHI, MPS. |
| 18 | `src/components/manager/ManagerHeader.tsx` | Bell scrolls to the fix approvals. `Tile` and `Tone` are exported for reuse. Tool tooltip text no longer project-specific. |
| 19 | `src/components/manager/ManagerSections.tsx` | Reads the current project from context instead of hard-coded PIT Armour. |
| 20 | `src/components/manager/ManagerInsights.tsx` | Same: reads the current project from context. |
| 21 | `src/components/manager/RiskHeatmap.tsx` | Same: reads the current project from context. |
| 22 | `src/routes/index.tsx` | CTO home shows "Escalated to you" across all projects. |

---

## For the backend team: what the frontend expects

All escalation state currently lives in the browser (localStorage), so it is **not shared between users or browsers**.

Each action in `src/lib/escalation-store.tsx` maps to one endpoint. When you wire them, you replace the function bodies there; the screens do not change.

| Store action | Planned endpoint | Notes |
|---|---|---|
| `getConfig`, `setPolicy`, `setPerson` | `GET / PUT /api/escalations/policy/{projectId}` | Matrix (reminder, managerAfter, ctoAfter, approvalLimitDays) plus people (developer, manager, cto: name and email). |
| `setDefaultLimit`, `setCategoryLimit`, `setCheckpointLimit`, `resetProject` | `PUT /api/escalations/limits/{projectId}` | `undefined` means "inherit from the level above". |
| `items` | `GET /api/items?projectId=` | `OpenItem`: id, projectId, checkpointId, owner, openedAt, status (`open`, `pending-approval`, `compliant`), fixedAt, lastNudgeAt, rejectReason, approval. |
| `runEscalation(pid)` | `POST /api/escalations/run/{projectId}` | Works out each item's level and returns a `RunSummary` plus notifications. Every run notifies again. Email is off for now; when it is on, send only to test mailboxes in the demo. |
| `markFixed`, `withdrawFix` | `POST /api/items/{id}/fixed`, `POST /api/items/{id}/undo` | Fixed moves the item to `pending-approval`. |
| `nudge` | `POST /api/items/{id}/nudge` | At most once a day per item (`canNudge`). |
| `approve(id, by)` | `POST /api/items/{id}/approve` | Marks the item compliant and stores the approval record as evidence. The approval screenshot (PNG) should come from the screenshot agent. |
| `reject(id, by, reason)` | `POST /api/items/{id}/reject` | Reason is required; the item goes back to `open` and the clock restarts. |
| `notifications` | `GET /api/notifications?role=&projectId=` | The dashboards show notifications since each project's latest run. |
| `resetDemo` | `POST /api/demo/seed/{projectId}` | Demo only. |

The full flow and data model are in the PRD: https://claude.ai/code/artifact/efb642a8-5ac4-47f2-a636-917e0f82d260
