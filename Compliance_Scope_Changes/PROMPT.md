# Prompt for another Claude

Copy the files in this folder over the matching paths in `Frontend_Timepass\Compliance_Review_Dashboard\` (same relative paths). Overwrite only these files. Then paste the prompt below.

```text
Project: Compliance Review Dashboard (React 19, TypeScript strict, Vite, React Router, Tailwind). Demo data only, no backend.

Goal: the whole dashboard follows one period, taken from the URL:
- ?q=FY27-Q2 is a quarter.
- ?from=YYYY-MM-DD&to=YYYY-MM-DD is a custom period (both ends inclusive, IST).
The period is a QuarterKey. Custom keys look like custom:<from>:<to>. quarterByKey() resolves both kinds.

Rules:
- NCs count by raisedAt in a custom period, and by n.quarter for a quarter.
- Changes count by deployedAt. PRs count by mergedAt. Direct commits count by pushedAt.
- Periodic checks count by dueBy in a custom period.
- Items still open at the period end count in the next period.
- A custom period gets its own sign-off, with a document ID that contains its dates.

Files in this change set:
src/data/types.ts, seed.ts, scope.ts (new), quarters.ts, api.ts
src/state/quarter.ts, review.tsx
src/components/RangeCalendar.tsx (new), PeriodPicker.tsx (new), Shell.tsx
src/main.tsx
src/pages/Scope.tsx (new), Overview.tsx, Reports.tsx

Checks:
1. npx tsc --noEmit -p . must be clean.
2. Run the dev server on 8082 and open:
   - http://localhost:8082/?q=FY27-Q2 (baseline: 90%, 29 NCs)
   - http://localhost:8082/?from=2026-07-02&to=2026-07-31 (8 NCs)
   - http://localhost:8082/scope?from=2026-07-02&to=2026-07-31
3. Login: priya.rao@acme-capital.test / Review@2026

Not done yet: some notes still say "quarter" (Overview cards, NC case text, copilot). Sign-off for a custom period and the PDF output are not yet verified.
```
