import { CTO, TEAMS, UAT_SIGNER, ownerFor, person } from "./people";
import { PROJECTS, TAT_DAYS, checkpointById, controlRule, periodicDue, isApplicable } from "./catalog";
import { DEMO_TODAY, QUARTERS, addDays, daysBetween, ist, quarterByKey, quarterOf } from "./quarters";
import type {
  AiReading,
  ChangeRequest,
  DirectCommit,
  Evidence,
  NcCase,
  NcDecision,
  NcEvent,
  NcKind,
  PeriodicResult,
  ProjectId,
  QuarterKey,
  Severity,
  SignOff,
} from "./types";

// Dated demo data for three quarters: Q1 FY27 signed off, Q2 FY27 ready for review (the
// walkthrough quarter) and Q3 FY27 open up to DEMO_TODAY. Generated deterministically,
// so every run tells the same story. Planted cases cover each NC kind for the demo.

/* ───────── deterministic random ───────── */
function rng(seedText: string) {
  let a = 0;
  for (const ch of seedText) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) >>> 0) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickFrom = <T,>(r: () => number, list: readonly T[]) => list[Math.floor(r() * list.length)]!;

/* ───────── projects: components, prefixes, CR titles ───────── */
const META: Record<ProjectId, { prefix: string; jira: string; repo: string; components: string[]; titles: string[]; startVer: [number, number] }> = {
  "project-a": {
    prefix: "PIT", jira: "PIT", repo: "acme/pit-armour", startVer: [2, 3],
    components: ["PIT Armour API", "PIT Armour Web", "Batch & Reports", "Integrations"],
    titles: ["Add maker-checker on limit changes", "Fix ledger rounding in EOD batch", "Upgrade Spring Boot to 3.3", "New GL reconciliation report", "Harden session timeout", "Jira webhook retry on 5xx", "Audit log for role changes", "Optimise account search query", "Mask PAN in statement export", "Add CAB link on release page", "Patch log4j-core to 2.24", "Move secrets to vault"],
  },
  "project-b": {
    prefix: "SAT", jira: "SAT", repo: "acme/saathi", startVer: [3, 0],
    components: ["Payment Gateway API", "Merchant Portal", "Settlement Engine", "Fraud Rules"],
    titles: ["UPI callback idempotency", "Merchant KYC document upload", "T+1 settlement file format change", "New velocity rule for card-not-present", "Refund API rate limiting", "Dispute workflow status emails", "Upgrade Node to 22 LTS", "Settlement mismatch alert", "Tokenise saved cards", "Merchant onboarding SLA dashboard"],
  },
  "project-c": {
    prefix: "MPS", jira: "MPS", repo: "acme/mps", startVer: [4, 1],
    components: ["Data Pipeline", "BI Dashboards", "PII Masking", "Risk Models"],
    titles: ["Daily exposure load to warehouse", "Mask Aadhaar in analyst views", "Credit risk model v7 recalibration", "Airflow DAG retry policy", "New NPA trend dashboard", "Row-level security on BI", "Upgrade Spark to 3.5", "Data quality checks on loan book", "Archive raw files after 90 days"],
  },
};

/** CRs per project per quarter (Q3 is up to DEMO_TODAY). MPS starts 20 Apr. */
const CR_COUNTS: Record<ProjectId, Record<QuarterKey, number>> = {
  "project-a": { "FY27-Q1": 46, "FY27-Q2": 52, "FY27-Q3": 6 },
  "project-b": { "FY27-Q1": 28, "FY27-Q2": 33, "FY27-Q3": 4 },
  "project-c": { "FY27-Q1": 24, "FY27-Q2": 38, "FY27-Q3": 5 },
};

function workdays(start: string, end: string) {
  const out: string[] = [];
  for (let t = Date.parse(start + "T00:00:00Z"); t <= Date.parse(end + "T00:00:00Z"); t += 864e5) {
    const d = new Date(t);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** A PR merges after approval and before deployment. Every third one merges the next day,
 *  so some PRs straddle a quarter boundary on purpose. */
function mergeTime(approvedAt: string, deployedAt: string, n: number): string {
  const candidate = n % 3 === 0 ? addDays(approvedAt, 1) : approvedAt;
  return candidate < deployedAt ? candidate : ist(deployedAt.slice(0, 10), "09:30");
}

function buildCRs(): ChangeRequest[] {
  const out: ChangeRequest[] = [];
  for (const p of PROJECTS) {
    const m = META[p.id];
    const t = TEAMS[p.id];
    const r = rng("cr-" + p.id);
    let seq = 1001;
    let [maj, min] = m.startVer;
    let patch = 0;
    for (const q of QUARTERS) {
      const start = q.key === "FY27-Q1" && p.onboardedOn > q.start ? p.onboardedOn : q.start;
      const end = q.key === "FY27-Q3" ? addDays(DEMO_TODAY, -1).slice(0, 10) : q.end;
      const days = workdays(start, end);
      const count = CR_COUNTS[p.id][q.key];
      for (let i = 0; i < count; i++) {
        const day = days[Math.min(days.length - 1, Math.floor(((i + 0.5) / count) * days.length))]!;
        if (i % 4 === 0) {
          patch += 1;
          if (patch > 4) { patch = 0; min += 1; }
        }
        const release = `v${maj}.${min}.${patch}`;
        const n = seq++;
        // Same random-number order as before, so the existing demo story does not move.
        const title = pickFrom(r, m.titles);
        const component = pickFrom(r, m.components);
        const raisedAt = addDays(ist(day, "11:00"), -(4 + Math.floor(r() * 6)));
        let approvedAt = addDays(ist(day, "16:30"), -(1 + Math.floor(r() * 2)));
        let deployedAt = ist(day, pickFrom(r, ["19:30", "20:00", "21:15", "22:00"]));
        // Planted boundary case: approved 30 Sep, merged 1 Oct, deployed 2 Oct. It is open at the
        // end of Q2, so Q2's "open at end" list shows it and Q3 counts it.
        const planted = q.key === "FY27-Q3" && i === 0 && p.id === "project-a";
        if (planted) {
          approvedAt = ist("2026-09-30", "16:30");
          deployedAt = ist("2026-10-02", "20:00");
        }
        out.push({
          id: `CR-${m.prefix}-${n}`,
          projectId: p.id,
          title,
          jira: `${m.jira}-${n + 1200}`,
          release,
          component,
          raisedAt,
          approvedAt,
          mergedAt: planted ? ist("2026-10-01", "11:00") : mergeTime(approvedAt, deployedAt, n),
          deployedAt,
          requester: t.appOwner === "neha" ? t.business : t.appOwner,
          approver: "arjun",
          deployer: t.devops,
          pr: `#${100 + (n % 400)}`,
        });
      }
    }
    void maj;
  }
  return out;
}

export const CHANGE_REQUESTS: ChangeRequest[] = buildCRs();

/* Direct commits: pushed to a protected branch with no PR. Some name a CR in the message,
   some do not (a gap the scope check reports). Generated per project per quarter. */
const DIRECT_COUNTS: Record<ProjectId, Record<QuarterKey, number>> = {
  "project-a": { "FY27-Q1": 3, "FY27-Q2": 4, "FY27-Q3": 2 },
  "project-b": { "FY27-Q1": 2, "FY27-Q2": 3, "FY27-Q3": 1 },
  "project-c": { "FY27-Q1": 2, "FY27-Q2": 2, "FY27-Q3": 1 },
};
const HOTFIX_MESSAGES = ["hotfix: null check in settlement batch", "chore: bump base image", "fix typo in release notes template", "hotfix: revert feature flag default"];

function buildDirectCommits(): DirectCommit[] {
  const out: DirectCommit[] = [];
  for (const p of PROJECTS) {
    const m = META[p.id];
    const t = TEAMS[p.id];
    const r = rng("dc-" + p.id);
    const projectCrs = CHANGE_REQUESTS.filter((c) => c.projectId === p.id);
    for (const q of QUARTERS) {
      const start = q.key === "FY27-Q1" && p.onboardedOn > q.start ? p.onboardedOn : q.start;
      const end = q.key === "FY27-Q3" ? addDays(DEMO_TODAY, -1).slice(0, 10) : q.end;
      const days = workdays(start, end);
      for (let i = 0; i < DIRECT_COUNTS[p.id][q.key]; i++) {
        const day = days[Math.floor(r() * days.length)]!;
        const hex = Array.from({ length: 40 }, () => Math.floor(r() * 16).toString(16)).join("");
        const withCr = r() < 0.6 && projectCrs.length > 0;
        const cr = withCr ? pickFrom(r, projectCrs) : undefined;
        out.push({
          sha: hex,
          projectId: p.id,
          repo: m.repo,
          branch: "main",
          author: t.devops,
          pushedAt: ist(day, `${String(9 + Math.floor(r() * 9)).padStart(2, "0")}:${pickFrom(r, ["05", "25", "40"])}`),
          ...(cr ? { crKey: cr.jira } : {}),
          message: cr ? `${cr.jira}: ${pickFrom(r, HOTFIX_MESSAGES)}` : pickFrom(r, HOTFIX_MESSAGES),
        });
      }
    }
  }
  return out.sort((a, b) => a.pushedAt.localeCompare(b.pushedAt));
}

export const DIRECT_COMMITS: DirectCommit[] = buildDirectCommits();

const crsIn = (pid: ProjectId, q: QuarterKey) => CHANGE_REQUESTS.filter((c) => c.projectId === pid && quarterOf(c.deployedAt) === q);
const crByIndex = (pid: ProjectId, q: QuarterKey, i: number) => {
  const list = crsIn(pid, q);
  return list[Math.max(0, Math.min(list.length - 1, i < 0 ? list.length + i : i))]!;
};

/* ───────── NC builder: a "story" becomes a dated event trail ───────── */
interface Story {
  id: string;
  projectId: ProjectId;
  quarter: QuarterKey;
  checkpointId: string;
  cr?: ChangeRequest;
  raisedAt: string;
  owner: string;
  severity?: Severity;
  title: string;
  finding: string;
  kinds: NcKind[];
  evidence: Evidence[];
  ai?: AiReading;
  /** Days after raising when the owner marks it fixed (undefined = still open today). */
  fixedAfter?: number;
  fixNote?: string;
  /** Rejected once: days after raising of the first fix, then the reject reason. */
  rejectedFirst?: { firstFixAfter: number; reason: string };
  approveAfter?: number; // days after the fix
  likelyFalsePositive?: boolean;
  carriedFrom?: QuarterKey;
}

function buildNc(s: Story): NcCase {
  const sev = s.severity ?? controlRule(s.checkpointId).severity;
  const tat = TAT_DAYS[sev];
  const due = addDays(s.raisedAt, tat, "23:59");
  const t = TEAMS[s.projectId];
  const owner = person(s.owner).name;
  const appOwner = person(t.appOwner).name;
  const ev: NcEvent[] = [];
  const add = (at: string, type: NcEvent["type"], actor: string, text: string) => {
    if (at.slice(0, 10) <= DEMO_TODAY) ev.push({ at, type, actor, text });
  };

  add(s.raisedAt, "raised", "agent", `AI audit agent raised the NC: ${s.finding}`);
  add(addDays(s.raisedAt, 0, bump(s.raisedAt, 5)), "notified", "agent", `NC notification sent to ${owner} (in-app + email). TAT ${tat} ${tat === 1 ? "day" : "days"}, due ${due.slice(0, 10)}.`);

  const fixDay = s.fixedAfter !== undefined ? addDays(s.raisedAt, s.fixedAfter, "15:40") : undefined;
  const firstFix = s.rejectedFirst ? addDays(s.raisedAt, s.rejectedFirst.firstFixAfter, "12:10") : undefined;
  const settledBy = firstFix ?? fixDay;

  const reminder = addDays(due, -1, "09:00");
  if (tat > 1 && (!settledBy || settledBy > reminder)) add(reminder, "reminder", "agent", `Reminder to ${owner}: SLA due tomorrow.`);
  if (!settledBy || settledBy > due) add(addDays(due, 0, "23:59"), "escalated-owner", "agent", `TAT crossed. Escalated to ${appOwner} (Application Owner).`);
  const ctoAt = addDays(due, 2, "09:00");
  if (!settledBy || settledBy > ctoAt) add(ctoAt, "escalated-cto", "agent", `Still open 2 days after TAT. Escalated to ${person(CTO).name} (CTO).`);

  let approvedAt: string | undefined;
  if (firstFix && s.rejectedFirst) {
    add(firstFix, "fixed", s.owner, `${owner} marked it fixed.`);
    add(addDays(firstFix, 1, "11:20"), "rejected", t.appOwner, `${appOwner} rejected the fix: ${s.rejectedFirst.reason} SLA clock restarted.`);
  }
  if (fixDay) {
    add(fixDay, "fixed", s.owner, `${owner} marked it fixed${s.fixNote ? `: ${s.fixNote}` : "."}`);
    approvedAt = addDays(fixDay, s.approveAfter ?? 1, "10:45");
    add(approvedAt, "approved", t.appOwner, `${appOwner} approved the fix. NC closed.`);
  }
  ev.sort((a, b) => a.at.localeCompare(b.at));

  const end = quarterByKey(s.quarter).end;
  const closedAt = approvedAt && approvedAt.slice(0, 10) <= DEMO_TODAY ? approvedAt : undefined;
  const statusAtEnd = closedAt && closedAt.slice(0, 10) <= end ? "closed" : fixDay && fixDay.slice(0, 10) <= end ? "pending-approval" : "open";

  const kinds = new Set<NcKind>(s.kinds);
  const lastFix = fixDay ?? firstFix;
  if (lastFix && lastFix > due) kinds.add("sla-breach");
  if (!lastFix && DEMO_TODAY > due.slice(0, 10)) kinds.add("sla-breach");
  if (s.rejectedFirst) kinds.add("reopened");

  return {
    id: s.id,
    projectId: s.projectId,
    quarter: s.quarter,
    checkpointId: s.checkpointId,
    ...(s.cr ? { crId: s.cr.id } : {}),
    title: s.title,
    finding: s.finding,
    severity: sev,
    kinds: [...kinds],
    owner: s.owner,
    raisedAt: s.raisedAt,
    tatDays: tat,
    dueAt: due,
    events: ev,
    evidence: s.evidence,
    ...(s.ai ? { ai: s.ai } : {}),
    statusAtEnd,
    ...(closedAt ? { closedAt } : {}),
    ...(s.carriedFrom ? { carriedFrom: s.carriedFrom } : {}),
    ...(s.likelyFalsePositive ? { likelyFalsePositive: true } : {}),
  };
}

function bump(iso: string, minutes: number) {
  const [h, m] = [Number(iso.slice(11, 13)), Number(iso.slice(14, 16))];
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/* ───────── evidence snapshots ───────── */
let evSeq = 0;
const evid = (e: Omit<Evidence, "id">): Evidence => ({ id: `EV-${String(++evSeq).padStart(4, "0")}`, ...e });

const jiraEv = (cr: ChangeRequest, at: string, extra: [string, string][], missing?: string): Evidence =>
  evid({
    kind: "jira",
    title: `${cr.jira} · ${cr.title}`,
    source: "Jira",
    capturedAt: at,
    fields: [["Ticket", cr.jira], ["CR", cr.id], ["Component", cr.component], ["Release", cr.release], ["Requester", person(cr.requester).name], ...extra],
    ...(missing ? { highlight: missing, missing: true } : {}),
  });

const prEv = (cr: ChangeRequest, at: string, author: string, approvers: string, mergedAt: string, highlight?: string): Evidence =>
  evid({
    kind: "pr",
    title: `${META[cr.projectId].repo} ${cr.pr}`,
    source: "GitHub",
    capturedAt: at,
    fields: [["Repository", META[cr.projectId].repo], ["Pull request", `${cr.pr} · ${cr.title}`], ["Linked CR", cr.id], ["Author", author], ["Approved by", approvers], ["Merged", mergedAt]],
    ...(highlight ? { highlight } : {}),
  });

const mailEv = (title: string, at: string, from: string, to: string, sentAt: string, body: string[], highlight?: string): Evidence =>
  evid({ kind: "email", title, source: "Mail", capturedAt: at, fields: [["From", from], ["To", to], ["Sent", sentAt], ["Subject", title]], body, ...(highlight ? { highlight } : {}) });

const logEv = (title: string, source: string, at: string, lines: string[], highlight?: string, missing?: boolean): Evidence =>
  evid({ kind: "log", title, source, capturedAt: at, fields: [], body: lines, ...(highlight ? { highlight } : {}), ...(missing ? { missing } : {}) });

const docEv = (title: string, source: string, at: string, fields: [string, string][], highlight?: string, missing?: boolean): Evidence =>
  evid({ kind: "document", title, source, capturedAt: at, fields, ...(highlight ? { highlight } : {}), ...(missing ? { missing } : {}) });

const addr = (id: string) => `${person(id).name} <${person(id).email}>`;
const fmtT = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} IST`;

/* ───────── generic NCs for the per-change controls ───────── */
const FILLER_CONTROLS = ["cp-13", "cp-15", "cp-39", "cp-33", "cp-12", "cp-36", "cp-8", "cp-18", "cp-22", "cp-34", "cp-9", "cp-20", "cp-23", "cp-35", "cp-41"];

function fillerFinding(cp: string, cr: ChangeRequest): { title: string; finding: string; evidence: Evidence[]; kind: NcKind } {
  const at = addDays(cr.deployedAt, 0, "23:10");
  switch (cp) {
    case "cp-13":
      return { title: "PIR not completed", finding: `No Post Implementation Review attached to ${cr.jira} 5 days after deploying ${cr.release}.`, kind: "missing-evidence", evidence: [jiraEv(cr, addDays(cr.deployedAt, 5), [["Attachments", "Deployment checklist, Test summary"], ["PIR", "Not attached"]], "PIR: Not attached")] };
    case "cp-15":
      return { title: "Rollback plan missing", finding: `Rollback plan not attached to ${cr.id} before deployment.`, kind: "missing-evidence", evidence: [jiraEv(cr, at, [["Attachments", "Impact analysis, Test summary"], ["Rollback plan", "Not attached"]], "Rollback plan: Not attached")] };
    case "cp-39":
      return { title: "Smoke test not recorded", finding: `No smoke test result recorded after deploying ${cr.release}.`, kind: "missing-evidence", evidence: [logEv(`Pipeline run ${cr.release}`, "CI/CD", at, [`deploy ${cr.release} -> prod  OK`, "post-deploy: smoke-suite  SKIPPED (no runner)", "pipeline finished"], "post-deploy: smoke-suite  SKIPPED (no runner)")] };
    case "cp-33":
      return { title: "Release notes not published", finding: `Release notes for ${cr.release} were not published.`, kind: "missing-evidence", evidence: [docEv(`Release notes ${cr.release}`, "SharePoint", at, [["Library", "Releases / " + cr.component], ["Document", "Not found"]], "Document: Not found", true)] };
    case "cp-12":
      return { title: "Release version not set", finding: `Fix version not set on ${cr.jira} when it was deployed.`, kind: "failed-check", evidence: [jiraEv(cr, at, [["Fix version", "—"]], "Fix version: —")] };
    case "cp-36":
      return { title: "Regression run missing", finding: `No regression test run linked to ${cr.id}.`, kind: "missing-evidence", evidence: [jiraEv(cr, at, [["Test runs", "Functional only"], ["Regression", "Not linked"]], "Regression: Not linked")] };
    case "cp-8":
      return { title: "Impact analysis empty", finding: `Impact analysis was empty on ${cr.jira} when work started.`, kind: "failed-check", evidence: [jiraEv(cr, cr.raisedAt, [["Impact analysis", "(empty)"], ["Status", "In Progress"]], "Impact analysis: (empty)")] };
    case "cp-18":
      return { title: "Commits not traceable", finding: `3 commits on ${cr.pr} do not reference an approved CR.`, kind: "failed-check", evidence: [logEv(`git log ${cr.pr}`, "GitHub", at, [`a91f3c2  ${cr.id}: ${cr.title}`, "4be20d1  fix typo", "c77e9a0  wip", "e02b6f4  address review comments"], "4be20d1  fix typo")] };
    case "cp-22":
      return { title: "SAST High findings open", finding: `SAST scan on ${cr.release} has 2 unresolved High findings.`, kind: "failed-check", evidence: [logEv(`SAST report ${cr.release}`, "CI/CD", at, ["Scanner: SonarQube 10.6", "Critical: 0", "High: 2  (SQL injection risk, hard-coded IV)", "Medium: 7", "Quality gate: FAILED (overridden)"], "Quality gate: FAILED (overridden)")] };
    case "cp-34":
      return { title: "Deployment communication not sent", finding: `No deployment communication was sent for ${cr.release}.`, kind: "missing-evidence", evidence: [docEv("Release mailbox search", "Mail", at, [["Search", `subject:"${cr.release}"`], ["Results", "0 messages"]], "Results: 0 messages", true)] };
    case "cp-9":
      return { title: "Risk classification missing", finding: `Risk classification not set on ${cr.jira}.`, kind: "failed-check", evidence: [jiraEv(cr, cr.approvedAt, [["Risk", "—"]], "Risk: —")] };
    case "cp-20":
      return { title: "Merged without pull request", finding: `A change for ${cr.id} was pushed to main without a pull request.`, kind: "failed-check", evidence: [logEv("Branch protection audit", "GitHub", at, ["main: direct push by service account", `commit 7d1e0aa  ${cr.id}: ${cr.title}`, "required reviews: bypassed"], "required reviews: bypassed")] };
    case "cp-23":
      return { title: "DAST not run", finding: `DAST was not run before deploying ${cr.release}.`, kind: "missing-evidence", evidence: [logEv(`Pipeline run ${cr.release}`, "CI/CD", at, ["stage sast  OK", "stage dast  NOT CONFIGURED", `deploy ${cr.release} -> prod  OK`], "stage dast  NOT CONFIGURED")] };
    case "cp-35":
      return { title: "Functional test sign-off missing", finding: `Functional test sign-off missing for ${cr.id}.`, kind: "missing-evidence", evidence: [jiraEv(cr, at, [["QA sign-off", "Pending"]], "QA sign-off: Pending")] };
    default:
      return { title: "Unauthorised deployer", finding: `${cr.release} was deployed by a user outside the authorised DevOps group.`, kind: "failed-check", evidence: [logEv(`Deploy audit ${cr.release}`, "CI/CD", at, [`deploy ${cr.release} triggered by: release-bot-legacy`, "group: none"], "group: none")] };
  }
}

function fillers(pid: ProjectId, q: QuarterKey, count: number, startNo: number, openTail = 0): NcCase[] {
  const r = rng(`nc-${pid}-${q}`);
  const out: NcCase[] = [];
  const crs = crsIn(pid, q);
  // Each quarter draws from a different set, so only the planted cases read as repeats.
  const pool = q === "FY27-Q1" ? FILLER_CONTROLS.slice(0, 8) : q === "FY27-Q2" ? FILLER_CONTROLS.slice(8) : FILLER_CONTROLS.slice(9, 14);
  for (let i = 0; i < count; i++) {
    const cp = pickFrom(r, pool);
    const cr = crs[Math.floor(((i + 0.3) / count) * crs.length)]!;
    const f = fillerFinding(cp, cr);
    const sev = controlRule(cp).severity;
    const tat = TAT_DAYS[sev];
    // Most are fixed inside TAT; about a third are late. The last `openTail` are still open.
    const late = r() < 0.33;
    const isOpen = i >= count - openTail;
    const fixedAfter = isOpen ? undefined : late ? tat + 1 + Math.floor(r() * 3) : Math.max(0, Math.floor(r() * tat));
    out.push(
      buildNc({
        id: `NC-${META[pid].prefix}-${q.slice(-2)}-${String(startNo + i).padStart(3, "0")}`,
        projectId: pid,
        quarter: q,
        checkpointId: cp,
        cr,
        raisedAt: addDays(cr.deployedAt, cp === "cp-13" ? 5 : 0, "23:05"),
        owner: ownerFor(pid, checkpointById(cp).ownerRole, i),
        title: f.title,
        finding: f.finding,
        kinds: [f.kind],
        evidence: f.evidence,
        ...(fixedAfter !== undefined ? { fixedAfter, approveAfter: r() < 0.7 ? 1 : 2 } : {}),
      }),
    );
  }
  return out;
}

/* ───────── planted cases (the walkthrough) ───────── */
function planted(): NcCase[] {
  const out: NcCase[] = [];
  const A = "project-a", B = "project-b", C = "project-c";

  // ---- Q1 FY27 (signed off) ----
  {
    const cr = crByIndex(A, "FY27-Q1", 30);
    out.push(buildNc({
      id: "NC-PIT-Q1-001", projectId: A, quarter: "FY27-Q1", checkpointId: "cp-10", cr, raisedAt: addDays(cr.deployedAt, 0, "22:40"), owner: "arjun",
      title: "CAB approval missing at deployment", finding: `${cr.release} was deployed before CAB approval was recorded on ${cr.jira}.`, kinds: ["failed-check"],
      evidence: [jiraEv(cr, cr.deployedAt, [["CAB approval", "Pending"], ["Deployed", fmtT(cr.deployedAt)]], "CAB approval: Pending")],
      fixedAfter: 1, fixNote: "CAB approved in the next sitting; process reminder sent to release team.", approveAfter: 1,
    }));
  }
  {
    const cr = crByIndex(A, "FY27-Q1", 12);
    out.push(buildNc({
      id: "NC-PIT-Q1-002", projectId: A, quarter: "FY27-Q1", checkpointId: "cp-21", cr, raisedAt: addDays(cr.deployedAt, -1, "18:20"), owner: "rahul",
      title: "PR merged without independent review", finding: `${cr.pr} was approved only by its author before merge.`, kinds: ["failed-check"],
      evidence: [prEv(cr, cr.deployedAt, "Rahul Verma", "Rahul Verma (author)", fmtT(addDays(cr.deployedAt, -1, "18:05")), "Approved by: Rahul Verma (author)")],
      fixedAfter: 1, fixNote: "Post-merge review done by Tanvi Kulkarni.", approveAfter: 1,
    }));
  }
  {
    const cr = crByIndex(B, "FY27-Q1", 10);
    out.push(buildNc({
      id: "NC-SAT-Q1-001", projectId: B, quarter: "FY27-Q1", checkpointId: "cp-37", cr, raisedAt: addDays(cr.deployedAt, -1, "17:30"), owner: "ishita",
      title: "UAT not signed off before go-live", finding: `No UAT sign-off email found for ${cr.id} before go-live.`, kinds: ["missing-evidence"],
      evidence: [docEv("Approvals mailbox search", "Mail", cr.deployedAt, [["Search", `"${cr.id}" UAT sign-off`], ["Results", "0 messages"]], "Results: 0 messages", true)],
      fixedAfter: 2, approveAfter: 1,
    }));
  }
  {
    const cr = crByIndex(C, "FY27-Q1", 8);
    out.push(buildNc({
      id: "NC-MPS-Q1-001", projectId: C, quarter: "FY27-Q1", checkpointId: "cp-24", cr, raisedAt: addDays(cr.deployedAt, 0, "21:00"), owner: "sameer",
      title: "Dependency scan not run", finding: `SCA dependency scan was not run on ${cr.release}.`, kinds: ["missing-evidence"],
      evidence: [logEv(`Pipeline run ${cr.release}`, "CI/CD", cr.deployedAt, ["stage build  OK", "stage sca  SKIPPED", `deploy ${cr.release} -> prod  OK`], "stage sca  SKIPPED")],
      fixedAfter: 3, approveAfter: 1,
    }));
  }

  // ---- Q2 FY27 (ready for review): PIT Armour ----
  {
    const cr = crByIndex(A, "FY27-Q2", 26); // mid-August release
    const dep = ist(cr.deployedAt.slice(0, 10), "20:00");
    out.push(buildNc({
      id: "NC-PIT-Q2-001", projectId: A, quarter: "FY27-Q2", checkpointId: "cp-10", cr, raisedAt: ist(dep.slice(0, 10), "20:12"), owner: "arjun",
      title: "CAB approval dated after deployment", finding: `${cr.release} went to production on ${dep.slice(0, 10)} 20:00; the CAB approval email is dated 2 days later.`, kinds: ["failed-check"],
      evidence: [
        jiraEv(cr, ist(dep.slice(0, 10), "20:12"), [["Status history", "Approved for build → Deployed"], ["CAB approval", "—"], ["Deployed", fmtT(dep)]], "CAB approval: —"),
        mailEv(`CAB approval – ${cr.id} ${cr.release}`, addDays(dep, 2, "11:42"), addr("arjun"), addr("kunal"), fmtT(addDays(dep, 2, "11:40")), [
          "Hi Kunal,",
          `The CAB has reviewed ${cr.id} (${cr.title}) and approves the release ${cr.release}.`,
          "Regards, Arjun Singh, CAB Chair",
        ], `Sent: ${fmtT(addDays(dep, 2, "11:40"))}`),
      ],
      ai: { verdict: "Approval language: yes", confidence: 0.96, reasoning: "The email clearly approves the release, but the rule engine compared its sent time with the deployment time: the approval came 2 days after the release, so the control failed." },
      fixedAfter: 5, fixNote: "CAB approval obtained retroactively; release checklist now blocks deploys without CAB link.", approveAfter: 1,
    }));
  }
  {
    const cr = crByIndex(A, "FY27-Q2", 9);
    const merged = addDays(cr.deployedAt, -1, "17:48");
    out.push(buildNc({
      id: "NC-PIT-Q2-002", projectId: A, quarter: "FY27-Q2", checkpointId: "cp-21", cr, raisedAt: addDays(merged, 0, "17:55"), owner: "aditya",
      title: "PR self-approved before merge", finding: `${cr.pr} was approved by its own author, Aditya Sharma, and merged.`, kinds: ["failed-check"],
      evidence: [prEv(cr, addDays(merged, 0, "17:55"), "Aditya Sharma", "Aditya Sharma (author)", fmtT(merged), "Approved by: Aditya Sharma (author)")],
      fixedAfter: 1, fixNote: "Independent review completed by Tanvi Kulkarni; no code changes needed.", approveAfter: 1,
    }));
  }
  {
    const cr = crByIndex(A, "FY27-Q2", -3); // late September
    out.push(buildNc({
      id: "NC-PIT-Q2-003", projectId: A, quarter: "FY27-Q2", checkpointId: "cp-15", cr, raisedAt: addDays(cr.deployedAt, -1, "16:00"), owner: "farhan",
      title: "Rollback plan not attached", finding: `${cr.id} reached the deployment step without a rollback plan.`, kinds: ["missing-evidence"],
      evidence: [jiraEv(cr, addDays(cr.deployedAt, -1, "16:00"), [["Attachments", "Impact analysis, Test summary"], ["Rollback plan", "Not attached"]], "Rollback plan: Not attached")],
      fixedAfter: 13, fixNote: "Rollback plan written and attached; template added to the CR form.", approveAfter: 1,
    }));
  }
  {
    const cr = crByIndex(A, "FY27-Q2", 18);
    out.push(buildNc({
      id: "NC-PIT-Q2-004", projectId: A, quarter: "FY27-Q2", checkpointId: "cp-43", cr, raisedAt: addDays(cr.deployedAt, 0, "20:30"), owner: "farhan",
      title: "No backup before deployment", finding: `No pre-deployment database backup found for ${cr.release}.`, kinds: ["missing-evidence"],
      evidence: [logEv("Backup job log", "Backup system", addDays(cr.deployedAt, 0, "20:30"), [`${cr.deployedAt.slice(0, 10)} 02:00  nightly-full  pitarmour_prod  OK`, `${cr.deployedAt.slice(0, 10)} 19:10  pre-deploy   pitarmour_uat   OK`, "no pre-deploy job for pitarmour_prod"], "no pre-deploy job for pitarmour_prod")],
      rejectedFirst: { firstFixAfter: 2, reason: "The attached backup log is for the UAT database, not production." }, fixedAfter: 7, approveAfter: 1,
    }));
  }
  {
    const cr = crByIndex(A, "FY27-Q2", 33);
    out.push(buildNc({
      id: "NC-PIT-Q2-005", projectId: A, quarter: "FY27-Q2", checkpointId: "cp-42", cr, raisedAt: addDays(cr.deployedAt, 0, "23:30"), owner: "farhan",
      title: "Deployment outside approved window", finding: `${cr.release} deployment finished at 23:28, after the approved window (20:00–22:00).`, kinds: ["failed-check"],
      evidence: [
        logEv(`Deploy log ${cr.release}`, "CI/CD", addDays(cr.deployedAt, 0, "23:30"), ["window: 20:00–22:00 IST", "start 21:40", "db migration 22:05–23:20", "finish 23:28"], "finish 23:28"),
        docEv("Emergency change ECR-118", "Jira", addDays(cr.deployedAt, 0, "21:30"), [["Type", "Emergency change"], ["Window extension", "20:00–00:00 approved by CAB"], ["Approved by", "Arjun Singh"]], "Window extension: 20:00–00:00 approved by CAB"),
      ],
      fixedAfter: 1, fixNote: "Window was extended by approved emergency change ECR-118.", approveAfter: 1, likelyFalsePositive: true,
    }));
  }
  {
    const cr = crByIndex(A, "FY27-Q2", -2);
    out.push(buildNc({
      id: "NC-PIT-Q2-006", projectId: A, quarter: "FY27-Q2", checkpointId: "cp-83", cr: { ...cr, requester: "farhan" }, raisedAt: addDays(cr.deployedAt, 0, "21:50"), owner: "kunal",
      title: "Requester also deployed the change", finding: `Farhan Ali raised and deployed hotfix ${cr.release}; requester and deployer must differ.`, kinds: ["failed-check"],
      evidence: [jiraEv({ ...cr, requester: "farhan" }, addDays(cr.deployedAt, 0, "21:50"), [["Approver", "Arjun Singh"], ["Deployer", "Farhan Ali"]], "Deployer: Farhan Ali")],
      fixedAfter: 3, fixNote: "Deployment rights split; hotfix re-verified by Kunal.", approveAfter: 3,
    }));
  }
  {
    const cr = crByIndex(A, "FY27-Q2", 4);
    out.push(buildNc({
      id: "NC-PIT-Q2-007", projectId: A, quarter: "FY27-Q2", checkpointId: "cp-39", cr, raisedAt: addDays(cr.deployedAt, 0, "23:00"), owner: "tanvi",
      title: "Smoke test not recorded", finding: `No smoke test result recorded after deploying ${cr.release}.`, kinds: ["missing-evidence"],
      evidence: [logEv(`Pipeline run ${cr.release}`, "CI/CD", addDays(cr.deployedAt, 0, "23:00"), [`deploy ${cr.release} -> prod  OK`, "post-deploy: smoke-suite  SKIPPED", "pipeline finished"], "post-deploy: smoke-suite  SKIPPED")],
      fixedAfter: 2, approveAfter: 1,
    }));
  }

  // ---- Q2: SAATHI ----
  {
    const cr = crByIndex(B, "FY27-Q2", 20);
    const sent = addDays(cr.deployedAt, -1, "18:12");
    out.push(buildNc({
      id: "NC-SAT-Q2-001", projectId: B, quarter: "FY27-Q2", checkpointId: "cp-37", cr, raisedAt: addDays(sent, 0, "18:20"), owner: "ishita",
      title: "UAT sign-off from the wrong person", finding: `The UAT sign-off for ${cr.id} came from Pooja Reddy (DevOps); the authorised signer is Ishita Menon.`, kinds: ["failed-check"],
      evidence: [mailEv(`UAT sign-off – ${cr.id}`, addDays(sent, 0, "18:20"), addr("pooja"), addr("ritu"), fmtT(sent), [
        "Hi Ritu,",
        `UAT for ${cr.id} (${cr.title}) is complete and looks good. Approved from our side, please go ahead with the release.`,
        "Thanks, Pooja",
      ], `From: ${addr("pooja")}`)],
      ai: { verdict: "Approval language: yes", confidence: 0.94, reasoning: `The email clearly approves the UAT, but the rule engine checked the sender: Pooja Reddy is not the authorised business signer for SAATHI (${person(UAT_SIGNER[B]).name}). The control stays failed until the right person signs.` },
      fixedAfter: 5, fixNote: "Ishita Menon sent the formal sign-off.", approveAfter: 1,
    }));
  }
  out.push(buildNc({
    id: "NC-SAT-Q2-002", projectId: B, quarter: "FY27-Q2", checkpointId: "cp-25", raisedAt: ist("2026-09-10", "09:15"), owner: "nikhil",
    title: "High vulnerabilities past closure date", finding: "3 High vulnerabilities in the Payment Gateway API are past their closure date (raised in the July VA/PT).", kinds: ["failed-check"],
    evidence: [docEv("Vulnerability tracker", "Jira", ist("2026-09-10", "09:15"), [["Open High", "3 (SAT-SEC-41, SAT-SEC-44, SAT-SEC-47)"], ["Oldest", "62 days"], ["Target closure", "30 days"]], "Oldest: 62 days")],
  }));
  out.push(buildNc({
    id: "NC-SAT-Q2-003", projectId: B, quarter: "FY27-Q2", checkpointId: "cp-60", raisedAt: ist("2026-09-30", "23:59"), owner: "nikhil",
    title: "Half-yearly VA/PT done late", finding: "VA/PT for H1 was due by 30 Sep; the report was filed on 2 Oct.", kinds: ["missed-periodic"],
    evidence: [docEv("VA/PT report H1 FY27", "SharePoint", ist("2026-10-02", "16:00"), [["Due by", "2026-09-30"], ["Report date", "2026-10-02"], ["Vendor", "SecureLabs"]], "Report date: 2026-10-02")],
    fixedAfter: 2, fixNote: "Report filed; testing slot had slipped by vendor.", approveAfter: 1,
  }));

  // ---- Q2: MPS ----
  out.push(buildNc({
    id: "NC-MPS-Q2-001", projectId: C, quarter: "FY27-Q2", checkpointId: "cp-50", raisedAt: ist("2026-09-30", "23:59"), owner: "sameer",
    title: "Quarterly access review not done", finding: "The Q2 user access review for MPS (warehouse, BI and Airflow) was not done.", kinds: ["missed-periodic"],
    evidence: [docEv("Access reviews library", "SharePoint", ist("2026-10-01", "09:00"), [["Expected", "MPS access review Q2 FY27"], ["Found", "None (last: Q1 FY27, 2026-06-24)"]], "Found: None (last: Q1 FY27, 2026-06-24)", true)],
  }));
  out.push(buildNc({
    id: "NC-MPS-Q2-002", projectId: C, quarter: "FY27-Q2", checkpointId: "cp-71", raisedAt: ist("2026-09-22", "10:00"), owner: "suresh",
    title: "Security log review not recorded", finding: "No record of the security log review for August–September.", kinds: ["missing-evidence"],
    evidence: [docEv("SOC review register", "SharePoint", ist("2026-09-22", "10:00"), [["Last entry", "2026-07-28"], ["Expected", "Monthly"]], "Last entry: 2026-07-28", true)],
    fixedAfter: 7, fixNote: "Reviews for Aug and Sep completed and recorded.", approveAfter: 4,
  }));
  out.push(buildNc({
    id: "NC-MPS-Q2-003", projectId: C, quarter: "FY27-Q2", checkpointId: "cp-66", raisedAt: ist("2026-09-30", "23:59"), owner: "suresh",
    title: "Backup restoration test not done", finding: "No backup restoration test was recorded for Q2.", kinds: ["missed-periodic"],
    evidence: [docEv("DR / restore test log", "SharePoint", ist("2026-10-01", "09:00"), [["Expected", "Restore test Q2 FY27"], ["Found", "None"]], "Found: None", true)],
  }));
  {
    const cr = crByIndex(C, "FY27-Q2", 14);
    out.push(buildNc({
      id: "NC-MPS-Q2-004", projectId: C, quarter: "FY27-Q2", checkpointId: "cp-22", cr, raisedAt: addDays(cr.deployedAt, 0, "21:00"), owner: "sameer",
      title: "SAST High findings open", finding: `SAST on ${cr.release} had 2 High findings when it was released.`, kinds: ["failed-check"],
      evidence: [logEv(`SAST report ${cr.release}`, "CI/CD", addDays(cr.deployedAt, 0, "21:00"), ["Scanner: SonarQube 10.6", "High: 2  (path traversal, weak hash)", "Quality gate: FAILED (overridden by karan.mehta)"], "Quality gate: FAILED (overridden by karan.mehta)")],
      fixedAfter: 2, approveAfter: 1,
    }));
  }

  // ---- Q3 (open): carried-forward item from Q2 ----
  out.push(buildNc({
    id: "NC-MPS-Q3-001", projectId: C, quarter: "FY27-Q3", checkpointId: "cp-50", raisedAt: ist("2026-10-01", "09:00"), owner: "sameer",
    title: "Access review still outstanding", finding: "The Q2 access review is still not done; carried into Q3.", kinds: ["missed-periodic"], carriedFrom: "FY27-Q2",
    evidence: [docEv("Access reviews library", "SharePoint", ist("2026-10-01", "09:00"), [["Found", "None"]], "Found: None", true)],
  }));
  return out;
}

/** Target NC totals per project and quarter; fillers top up the planted cases. */
const TARGETS: Record<ProjectId, Record<QuarterKey, number>> = {
  "project-a": { "FY27-Q1": 17, "FY27-Q2": 14, "FY27-Q3": 3 },
  "project-b": { "FY27-Q1": 8, "FY27-Q2": 6, "FY27-Q3": 2 },
  "project-c": { "FY27-Q1": 6, "FY27-Q2": 9, "FY27-Q3": 3 },
};

function buildNcs(): NcCase[] {
  const plantedCases = planted();
  const all = [...plantedCases];
  for (const p of PROJECTS) {
    for (const q of QUARTERS) {
      const have = plantedCases.filter((n) => n.projectId === p.id && n.quarter === q.key).length;
      const need = TARGETS[p.id][q.key] - have;
      // Q3 is live: the newest ones are still open.
      if (need > 0) all.push(...fillers(p.id, q.key, need, have + 1, q.key === "FY27-Q3" ? 1 : q.key === "FY27-Q2" && p.id === "project-a" ? 1 : 0));
    }
  }
  return all.sort((a, b) => a.raisedAt.localeCompare(b.raisedAt));
}

export const NC_CASES: NcCase[] = buildNcs();

/* ───────── periodic controls per quarter ───────── */
function buildPeriodic(): PeriodicResult[] {
  const out: PeriodicResult[] = [];
  const special: Record<string, Partial<PeriodicResult>> = {
    "project-c|FY27-Q2|cp-50": { status: "missed" },
    "project-c|FY27-Q2|cp-66": { status: "missed" },
    "project-b|FY27-Q2|cp-60": { status: "late", doneOn: "2026-10-02" },
  };
  for (const p of PROJECTS) {
    const r = rng("periodic-" + p.id);
    for (const q of QUARTERS) {
      for (const cp of ["cp-50", "cp-60", "cp-66", "cp-71", "cp-78", "cp-79", "cp-82", "cp-84", "cp-67"]) {
        if (!isApplicable(p.id, cp)) continue;
        const qq = quarterByKey(q.key);
        if (!periodicDue(cp, q.key)) {
          out.push({ projectId: p.id, quarter: q.key, checkpointId: cp, dueBy: qq.end, status: "not-due" });
          continue;
        }
        const key = `${p.id}|${q.key}|${cp}`;
        if (q.key === "FY27-Q3") {
          // Live quarter: a few already done, the rest due by 31 Dec.
          const done = cp === "cp-84" || cp === "cp-71";
          out.push({ projectId: p.id, quarter: q.key, checkpointId: cp, dueBy: qq.end, status: "not-due", ...(done ? { doneOn: "2026-10-07" } : {}) });
          continue;
        }
        const offset = 20 + Math.floor(r() * 50);
        const doneOn = addDays(qq.start, offset).slice(0, 10);
        out.push({ projectId: p.id, quarter: q.key, checkpointId: cp, dueBy: qq.end, status: "on-time", doneOn, evidenceTitle: `${checkpointById(cp).name} – ${qq.label}`, ...special[key] });
      }
    }
  }
  return out;
}

export const PERIODIC_RESULTS: PeriodicResult[] = buildPeriodic();

/* ───────── Q1 was reviewed and signed off before the demo starts ───────── */
export const SEED_SIGNOFFS: SignOff[] = [
  { quarter: "FY27-Q1", by: "priya", at: ist("2026-07-18", "17:20"), score: 0, ncCount: 0, documentId: "AR-FY27-Q1-0001" },
];

export const SEED_DECISIONS: NcDecision[] = NC_CASES.filter((n) => n.quarter === "FY27-Q1").map((n, i) => ({
  ncId: n.id,
  decision: n.id === "NC-PIT-Q1-001" ? "observation" : i % 9 === 4 ? "exception" : "confirm",
  note:
    n.id === "NC-PIT-Q1-001"
      ? "CAB approvals are being recorded after release. Release checklist must block deployment without a CAB link."
      : i % 9 === 4
        ? "Accepted: low-risk internal tool change; control redesign planned for Q2."
        : "",
  at: ist(n.quarter === "FY27-Q1" ? "2026-07-16" : "2026-07-16", "11:00"),
  by: "priya",
  ...(n.id === "NC-PIT-Q1-001" ? { observationId: "OBS-Q1-01" } : {}),
  ...(i % 9 === 4 ? { exceptionExpiry: "2026-12-31" } : {}),
}));

void daysBetween;
