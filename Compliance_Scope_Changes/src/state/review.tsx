import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NC_CASES, SEED_DECISIONS, SEED_SIGNOFFS } from "@/data/seed";
import { DEMO_TODAY, QUARTERS, addDays, fmtDate, isCustomKey, quarterByKey } from "@/data/quarters";
import { CTO, REVIEWER, TEAMS, person, setEmailOverrides } from "@/data/people";
import { projectById } from "@/data/catalog";
import { deliver } from "@/data/notify";
import { setSeverityOverrides } from "@/data/api";
import type {
  AuditEntry,
  Comment,
  InfoRequest,
  ManagementResponse,
  NcDecision,
  Notification,
  NotificationKind,
  Observation,
  ProjectId,
  QuarterKey,
  QuarterState,
  ReportRecord,
  Severity,
  SignOff,
} from "@/data/types";

// The reviewer's own record: decisions, observations, info requests, comments, the outbox,
// reports, sign-offs and the audit trail. Q1 arrives already reviewed and signed off.
// Saved in this browser until the backend is connected; each action maps to one future
// endpoint under /api/compliance (decisions, observations, info-requests, comments,
// notifications, reports, signoffs).

const KEY = "compliance-review-state-v2";

interface Persisted {
  decisions: Record<string, NcDecision>;
  signoffs: SignOff[];
  observations: Observation[];
  infoRequests: Record<string, InfoRequest>;
  comments: Comment[];
  notifications: Notification[];
  reports: ReportRecord[];
  audit: AuditEntry[];
  emails: Record<string, string>;
  reopened: Partial<Record<QuarterKey, string>>; // reason
  severity: Record<string, Severity>;
}

/** Observation due date by severity (days). */
export const OBS_DUE_DAYS: Record<Severity, number> = { Critical: 2, High: 5, Medium: 10, Low: 15 };
/** Info requests get their own SLA (gap 17). */
export const INFO_SLA_DAYS = 3;

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** Actions happen "today" in the demo: DEMO_TODAY with the real clock time. */
export const nowIso = () => {
  const d = new Date();
  return `${DEMO_TODAY}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00+05:30`;
};

function fresh(): Persisted {
  const q1Report: ReportRecord = {
    id: "RPT-Q1-final",
    quarter: "FY27-Q1",
    documentId: "AR-FY27-Q1-0001",
    final: true,
    sections: ["summary", "projects", "register", "observations", "exceptions", "carried", "after-period", "periodic", "evidence", "signoff"],
    coverNote: "Q1 FY27 compliance review across PIT Armour, SAATHI and MPS. One observation raised on CAB approvals; one exception accepted.",
    includeEvidence: true,
    generatedAt: "2026-07-18T17:25:00+05:30",
    by: REVIEWER,
    sentTo: [
      { personId: CTO, at: "2026-07-18T17:30:00+05:30" },
      { personId: "neha", at: "2026-07-18T17:30:00+05:30" },
    ],
  };
  const q1Obs: Observation = {
    id: "OBS-Q1-01",
    quarter: "FY27-Q1",
    projectId: "project-a",
    ncIds: ["NC-PIT-Q1-001"],
    title: "CAB approvals recorded after release",
    severity: "High",
    whatsWrong: "A release went to production before its CAB approval was recorded.",
    expected: "Release checklist must block deployment until the CR has a CAB approval link.",
    owner: "kunal",
    cc: ["neha"],
    dueAt: "2026-07-23T23:59:00+05:30",
    status: "verified",
    createdAt: "2026-07-16T11:00:00+05:30",
    by: REVIEWER,
    sentAt: "2026-07-16T11:05:00+05:30",
    response: { agree: true, plan: "Add a CAB-link gate to the release pipeline.", targetDate: "2026-07-31", by: "kunal", at: "2026-07-17T10:20:00+05:30" },
    fixedAt: "2026-07-29T16:00:00+05:30",
    fixNote: "Pipeline gate live from release v2.4.0.",
    verifiedAt: "2026-07-30T12:00:00+05:30",
    verifyNote: "Gate confirmed on two releases.",
  };
  return {
    decisions: Object.fromEntries(SEED_DECISIONS.map((d) => [d.ncId, d])),
    signoffs: SEED_SIGNOFFS,
    observations: [q1Obs],
    infoRequests: {},
    comments: [],
    notifications: [
      {
        id: "N-Q1-report",
        at: "2026-07-18T17:30:00+05:30",
        kind: "report",
        to: [CTO, "neha"],
        cc: [],
        subject: "Q1 FY27 compliance review report (AR-FY27-Q1-0001)",
        body: ["The Q1 FY27 compliance review is signed off.", "The report is attached."],
        related: ["RPT-Q1-final"],
        emailStatus: "demo",
      },
    ],
    reports: [q1Report],
    audit: [
      { id: "A-q1-1", at: "2026-07-16T11:00:00+05:30", actor: REVIEWER, quarter: "FY27-Q1", action: "Reviewed quarter", target: "Q1 FY27", detail: "All 31 NCs decided" },
      { id: "A-q1-2", at: "2026-07-18T17:20:00+05:30", actor: REVIEWER, quarter: "FY27-Q1", action: "Signed off", target: "Q1 FY27", detail: "AR-FY27-Q1-0001" },
      { id: "A-q1-3", at: "2026-07-18T17:30:00+05:30", actor: REVIEWER, quarter: "FY27-Q1", action: "Sent report", target: "AR-FY27-Q1-0001", detail: "To Rajiv Menon, Neha Gupta" },
    ],
    emails: {},
    reopened: {},
    severity: {},
  };
}

export interface ObservationInput {
  quarter: QuarterKey;
  projectId: ProjectId;
  ncIds: string[];
  title: string;
  severity: Severity;
  whatsWrong: string;
  expected: string;
  owner: string;
  dueAt: string;
}

interface Ctx extends Persisted {
  quarterState: (q: QuarterKey) => QuarterState;
  signoffOf: (q: QuarterKey) => SignOff | undefined;
  locked: (q: QuarterKey) => boolean;
  decide: (d: Omit<NcDecision, "at" | "by">, quarter: QuarterKey) => void;
  undoDecision: (ncId: string, quarter: QuarterKey) => void;
  approveExceptionAsCto: (ncId: string) => void;
  setSeverity: (ncId: string, severity: Severity, reason: string, quarter: QuarterKey) => void;
  createObservation: (o: ObservationInput) => Observation;
  sendAlerts: (quarter: QuarterKey, projectId?: ProjectId) => number;
  requestInfo: (ncId: string, question: string, owner: string, quarter: QuarterKey) => void;
  simulateInfoReply: (ncId: string) => void;
  simulateResponse: (obsId: string, agree: boolean) => void;
  simulateFixed: (obsId: string) => void;
  verifyObservation: (obsId: string, note: string) => void;
  addComment: (targetId: string, text: string, author?: string) => void;
  signOffQuarter: (q: QuarterKey, score: number, ncCount: number) => SignOff;
  reopenQuarter: (q: QuarterKey, reason: string) => void;
  saveReport: (r: Omit<ReportRecord, "id" | "generatedAt" | "by" | "sentTo">) => ReportRecord;
  sendReport: (reportId: string, to: string[], message: string) => void;
  setEmail: (personId: string, email: string) => void;
  resetDemo: () => void;
}

const ReviewContext = createContext<Ctx | null>(null);

export function ReviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? ({ ...fresh(), ...(JSON.parse(raw) as Persisted) }) : fresh();
    } catch {
      return fresh();
    }
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  setEmailOverrides(state.emails);
  setSeverityOverrides(state.severity);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage blocked: state lasts for this tab only */
    }
  }, [state]);

  const signoffOf = useCallback((q: QuarterKey) => state.signoffs.find((s) => s.quarter === q), [state.signoffs]);
  const quarterState = useCallback(
    (q: QuarterKey): QuarterState => (signoffOf(q) ? "signed-off" : quarterByKey(q).baseState === "open" ? "open" : "ready"),
    [signoffOf],
  );
  const locked = useCallback((q: QuarterKey) => quarterState(q) !== "ready", [quarterState]);

  const audit = (s: Persisted, a: Omit<AuditEntry, "id" | "at" | "actor"> & { actor?: string }): Persisted => ({
    ...s,
    audit: [{ id: uid("A"), at: nowIso(), actor: a.actor ?? REVIEWER, ...a }, ...s.audit],
  });

  /** Adds a notification and delivers it (demo mode: in-app only). */
  const notify = (kind: NotificationKind, to: string[], cc: string[], subject: string, body: string[], related: string[]) => {
    const n: Notification = { id: uid("N"), at: nowIso(), kind, to, cc, subject, body, related, emailStatus: "queued" };
    setState((s) => ({ ...s, notifications: [n, ...s.notifications] }));
    void deliver(n).then((r) =>
      setState((s) => ({ ...s, notifications: s.notifications.map((x) => (x.id === n.id ? { ...x, emailStatus: r.status, emailNote: r.note } : x)) })),
    );
    return n;
  };

  const value: Ctx = {
    ...state,
    quarterState,
    signoffOf,
    locked,

    decide: (d, quarter) => {
      const nc = NC_CASES.find((n) => n.id === d.ncId)!;
      const full: NcDecision = { ...d, at: nowIso(), by: REVIEWER };
      setState((s) =>
        audit(
          { ...s, decisions: { ...s.decisions, [d.ncId]: full } },
          { quarter, action: `Decision: ${d.decision}`, target: d.ncId, detail: [d.note, d.severity ? `severity set to ${d.severity}` : ""].filter(Boolean).join(" · ") },
        ),
      );
      if (d.decision === "exception" && (d.severity ?? nc.severity) === "Critical") {
        notify(
          "exception-approval",
          [CTO],
          [REVIEWER],
          `Approval needed: exception on Critical NC ${nc.id}`,
          [`${person(REVIEWER).name} proposes to accept a Critical non-compliance as an exception.`, `NC: ${nc.title} (${projectById(nc.projectId).name})`, `Reason: ${d.note}`, `Expires: ${d.exceptionExpiry ?? "—"}`],
          [nc.id],
        );
      }
    },

    undoDecision: (ncId, quarter) =>
      setState((s) => {
        const next = { ...s.decisions };
        delete next[ncId];
        const ir = { ...s.infoRequests };
        delete ir[ncId];
        return audit({ ...s, decisions: next, infoRequests: ir }, { quarter, action: "Decision undone", target: ncId, detail: "" });
      }),

    approveExceptionAsCto: (ncId) =>
      setState((s) => {
        const d = s.decisions[ncId];
        if (!d) return s;
        return audit({ ...s, decisions: { ...s.decisions, [ncId]: { ...d, ctoApprovedAt: nowIso() } } }, { actor: CTO, action: "CTO approved exception", target: ncId, detail: "" });
      }),

    setSeverity: (ncId, severity, reason, quarter) =>
      setState((s) => {
        const d = s.decisions[ncId];
        return audit(
          { ...s, severity: { ...s.severity, [ncId]: severity }, decisions: d ? { ...s.decisions, [ncId]: { ...d, severity, severityReason: reason } } : s.decisions },
          { quarter, action: "Changed severity", target: ncId, detail: `${severity}: ${reason}` },
        );
      }),

    createObservation: (o) => {
      const n = stateRef.current.observations.filter((x) => x.quarter === o.quarter).length + 1;
      const obs: Observation = {
        id: `OBS-${o.quarter.slice(-2)}-${String(n).padStart(2, "0")}`,
        ...o,
        cc: [TEAMS[o.projectId].appOwner, ...(o.severity === "Critical" ? [CTO] : [])].filter((x) => x !== o.owner),
        status: "queued",
        createdAt: nowIso(),
        by: REVIEWER,
      };
      setState((s) => {
        const decisions = { ...s.decisions };
        for (const id of o.ncIds) decisions[id] = { ncId: id, decision: "observation", note: obs.title, at: nowIso(), by: REVIEWER, observationId: obs.id };
        return audit({ ...s, observations: [...s.observations, obs], decisions }, { quarter: o.quarter, action: "Raised observation", target: obs.id, detail: `${obs.title} · ${o.ncIds.join(", ")}` });
      });
      return obs;
    },

    sendAlerts: (quarter, projectId) => {
      const queued = stateRef.current.observations.filter((o) => o.quarter === quarter && o.status === "queued" && (!projectId || o.projectId === projectId));
      const byProject = new Map<ProjectId, Observation[]>();
      queued.forEach((o) => byProject.set(o.projectId, [...(byProject.get(o.projectId) ?? []), o]));
      for (const [pid, list] of byProject) {
        const to = Array.from(new Set(list.map((o) => o.owner)));
        const cc = Array.from(new Set(list.flatMap((o) => o.cc))).filter((x) => !to.includes(x));
        notify(
          "observation-digest",
          to,
          cc,
          `${quarterByKey(quarter).label} compliance review: ${list.length} observation${list.length > 1 ? "s" : ""} for ${projectById(pid).name}`,
          [
            `${person(REVIEWER).name} (Compliance) reviewed ${quarterByKey(quarter).label} and raised the following for ${projectById(pid).name}:`,
            ...list.map((o) => `• ${o.id} [${o.severity}] ${o.title}. Owner: ${person(o.owner).name}. Due ${fmtDate(o.dueAt)}. Expected: ${o.expected}`),
            "Please add your management response (agree or disagree, action plan, target date) and mark each item fixed when done.",
          ],
          list.map((o) => o.id),
        );
      }
      const sentAt = nowIso();
      setState((s) =>
        audit(
          { ...s, observations: s.observations.map((o) => (queued.some((x) => x.id === o.id) ? { ...o, status: "sent", sentAt } : o)) },
          { quarter, action: "Sent alert digest", target: Array.from(byProject.keys()).map((p) => projectById(p).name).join(", "), detail: `${queued.length} observations` },
        ),
      );
      return queued.length;
    },

    requestInfo: (ncId, question, owner, quarter) => {
      const nc = NC_CASES.find((n) => n.id === ncId)!;
      const askedAt = nowIso();
      const ir: InfoRequest = { ncId, question, owner, askedAt, dueAt: addDays(askedAt, INFO_SLA_DAYS, "23:59") };
      setState((s) =>
        audit(
          { ...s, infoRequests: { ...s.infoRequests, [ncId]: ir }, decisions: { ...s.decisions, [ncId]: { ncId, decision: "info", note: question, at: askedAt, by: REVIEWER } } },
          { quarter, action: "Requested information", target: ncId, detail: question },
        ),
      );
      notify("info-request", [owner], [TEAMS[nc.projectId].appOwner], `Information requested on ${nc.id}: ${nc.title}`, [
        `${person(REVIEWER).name} (Compliance) needs more information before deciding on ${nc.id}.`,
        `Question: ${question}`,
        `Please reply by ${fmtDate(ir.dueAt)}.`,
      ], [ncId]);
    },

    simulateInfoReply: (ncId) =>
      setState((s) => {
        const ir = s.infoRequests[ncId];
        if (!ir) return s;
        const nc = NC_CASES.find((n) => n.id === ncId)!;
        const text = nc.likelyFalsePositive
          ? "The window was extended by emergency change ECR-118, approved by the CAB chair before the deployment. Attached the ECR."
          : "Attached the requested document. The gap was a process miss; the corrective action is described in the fix note.";
        return audit({ ...s, infoRequests: { ...s.infoRequests, [ncId]: { ...ir, reply: { text, at: nowIso(), by: ir.owner } } } }, { actor: ir.owner, action: "Replied to info request", target: ncId, detail: text });
      }),

    simulateResponse: (obsId, agree) =>
      setState((s) => {
        const o = s.observations.find((x) => x.id === obsId);
        if (!o) return s;
        const response: ManagementResponse = {
          agree,
          plan: agree ? `Root cause accepted. ${o.expected} Owner: ${person(o.owner).name}.` : "We disagree: the control was met through an alternative approval. Evidence attached for reconsideration.",
          targetDate: o.dueAt.slice(0, 10),
          by: o.owner,
          at: nowIso(),
        };
        return audit({ ...s, observations: s.observations.map((x) => (x.id === obsId ? { ...x, response, status: "responded" } : x)) }, { actor: o.owner, action: "Management response", target: obsId, detail: agree ? "Agreed" : "Disagreed" });
      }),

    simulateFixed: (obsId) =>
      setState((s) => {
        const o = s.observations.find((x) => x.id === obsId);
        if (!o) return s;
        return audit(
          { ...s, observations: s.observations.map((x) => (x.id === obsId ? { ...x, status: "fixed", fixedAt: nowIso(), fixNote: "Corrective action completed; evidence attached." } : x)) },
          { actor: o.owner, action: "Marked observation fixed", target: obsId, detail: "" },
        );
      }),

    verifyObservation: (obsId, note) => {
      const o = stateRef.current.observations.find((x) => x.id === obsId);
      if (!o) return;
      setState((s) => audit({ ...s, observations: s.observations.map((x) => (x.id === obsId ? { ...x, status: "verified", verifiedAt: nowIso(), verifyNote: note } : x)) }, { quarter: o.quarter, action: "Verified and closed observation", target: obsId, detail: note }));
      notify("verification", [o.owner], o.cc, `${o.id} verified and closed`, [`${person(REVIEWER).name} (Compliance) verified the fix for ${o.id}: ${o.title}.`, note ? `Note: ${note}` : "No further action needed."], [obsId]);
    },

    addComment: (targetId, text, author = REVIEWER) =>
      setState((s) => audit({ ...s, comments: [...s.comments, { id: uid("C"), targetId, author, text, at: nowIso() }] }, { actor: author, action: "Comment", target: targetId, detail: text })),

    signOffQuarter: (q, score, ncCount) => {
      const n = stateRef.current.signoffs.filter((x) => x.quarter === q).length + 1;
      // A custom period's id carries its dates, e.g. AR-2026-07-02-to-2026-07-31-0001.
      const tag = isCustomKey(q) ? q.slice("custom:".length).replace(":", "-to-") : q;
      const so: SignOff = { quarter: q, by: REVIEWER, at: nowIso(), score, ncCount, documentId: `AR-${tag}-${String(n).padStart(4, "0")}` };
      setState((s) => {
        const reopened = { ...s.reopened };
        delete reopened[q];
        return audit({ ...s, signoffs: [...s.signoffs.filter((x) => x.quarter !== q), so], reopened }, { quarter: q, action: "Signed off", target: quarterByKey(q).label, detail: `${so.documentId} · score ${score}% · ${ncCount} NCs` });
      });
      return so;
    },

    reopenQuarter: (q, reason) =>
      setState((s) => audit({ ...s, signoffs: s.signoffs.filter((x) => x.quarter !== q), reopened: { ...s.reopened, [q]: reason } }, { quarter: q, action: "Reopened quarter", target: quarterByKey(q).label, detail: reason })),

    saveReport: (r) => {
      const rec: ReportRecord = { ...r, id: uid("RPT"), generatedAt: nowIso(), by: REVIEWER, sentTo: [] };
      setState((s) => audit({ ...s, reports: [rec, ...s.reports] }, { quarter: r.quarter, action: r.final ? "Generated final report" : "Generated draft report", target: r.documentId, detail: `${r.sections.length} sections` }));
      return rec;
    },

    sendReport: (reportId, to, message) => {
      const r = stateRef.current.reports.find((x) => x.id === reportId);
      if (!r) return;
      const at = nowIso();
      setState((s) =>
        audit(
          { ...s, reports: s.reports.map((x) => (x.id === reportId ? { ...x, sentTo: [...x.sentTo, ...to.map((personId) => ({ personId, at }))] } : x)) },
          { quarter: r.quarter, action: "Sent report", target: r.documentId, detail: `To ${to.map((p) => person(p).name).join(", ")}` },
        ),
      );
      notify("report", to, [REVIEWER], `${quarterByKey(r.quarter).label} compliance review report (${r.documentId})${r.final ? "" : " – DRAFT"}`, [message || `Please find the ${quarterByKey(r.quarter).label} compliance review report attached.`, `Document: ${r.documentId}${r.final ? " (final, signed off)" : " (draft)"}`], [reportId]);
    },

    setEmail: (personId, email) => setState((s) => audit({ ...s, emails: { ...s.emails, [personId]: email } }, { action: "Updated email", target: person(personId).name, detail: email })),

    resetDemo: () => setState(fresh()),
  };

  const memo = useMemo(() => value, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  return <ReviewContext.Provider value={memo}>{children}</ReviewContext.Provider>;
}

export const useReview = () => {
  const c = useContext(ReviewContext);
  if (!c) throw new Error("useReview must be used inside ReviewProvider");
  return c;
};

export const QUARTER_KEYS = QUARTERS.map((q) => q.key);
