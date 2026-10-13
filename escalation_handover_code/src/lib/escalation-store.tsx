import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAudit } from "@/lib/audit-store";
import { projectsData, type Checkpoint, type ProjectId } from "@/lib/audit-data";
import {
  DAY_MS,
  LEVEL_LABEL,
  ageItem,
  ageLabel,
  daysSince,
  emptyConfig,
  seedItems,
  type ApprovalRecord,
  type ItemAge,
  type Level,
  type Notification,
  type OpenItem,
  type Policy,
  type ProjectConfig,
  type RunSummary,
} from "@/lib/escalation-data";

// Frontend-only store for deadlines, escalations, fixes, nudges and approvals.
// Persisted in localStorage and synced across tabs of the same browser. Each action below
// maps 1:1 to a planned backend endpoint (see the PRD), so wiring the API later replaces
// the bodies of these functions, not the screens.

const STORAGE_KEY = "audit-intelligence-escalations-v1";

type Persisted = {
  configs: Partial<Record<ProjectId, ProjectConfig>>;
  items: OpenItem[];
  notifications: Notification[];
  lastRun: Partial<Record<ProjectId, RunSummary>>;
};

const fresh = (): Persisted => ({ configs: {}, items: seedItems(Date.now()), notifications: [], lastRun: {} });

export type CheckpointMeta = { ref: string; name: string; category: string; ownerRole: string };

type Ctx = {
  ready: boolean;
  items: OpenItem[];
  notifications: Notification[];
  lastRun: Partial<Record<ProjectId, RunSummary>>;
  getConfig: (pid: ProjectId) => ProjectConfig;
  meta: (checkpointId: string) => CheckpointMeta;
  ageOf: (item: OpenItem) => ItemAge;
  // config (PUT /api/escalations/policy|limits/{projectId})
  setPolicy: (pid: ProjectId, patch: Partial<Policy>) => void;
  setPerson: (pid: ProjectId, level: Level, patch: Partial<{ name: string; email: string }>) => void;
  setDefaultLimit: (pid: ProjectId, days: number | undefined) => void;
  setCategoryLimit: (pid: ProjectId, category: string, days: number | undefined) => void;
  setCheckpointLimit: (pid: ProjectId, checkpointId: string, days: number | undefined) => void;
  resetProject: (pid: ProjectId) => void;
  // run (POST /api/escalations/run/{projectId})
  runEscalation: (pid: ProjectId) => RunSummary;
  // item actions (POST /api/items/{id}/fixed|nudge|approve|reject)
  markFixed: (itemId: string) => void;
  withdrawFix: (itemId: string) => void;
  canNudge: (item: OpenItem) => boolean;
  nudge: (itemId: string) => void;
  approve: (itemId: string, by: string) => void;
  reject: (itemId: string, by: string, reason: string) => void;
  // demo (POST /api/demo/seed/{projectId})
  resetDemo: () => void;
};

const EscalationContext = createContext<Ctx | null>(null);

const nid = () => `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const nowIso = () => new Date().toISOString();

export function EscalationProvider({ children }: { children: ReactNode }) {
  const { checkpoints, resolveCheckpoint } = useAudit();
  const [state, setState] = useState<Persisted>({ configs: {}, items: [], notifications: [], lastRun: {} });
  const [ready, setReady] = useState(false);
  const skipSave = useRef(true);

  // Load once on the client (avoids SSR/localStorage mismatch), and follow other tabs.
  useEffect(() => {
    const load = () => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return fresh();
        const saved = JSON.parse(raw) as Persisted;
        // Data saved before SAATHI / MPS were seeded: add their demo items.
        const have = new Set(saved.items.map((i) => i.id));
        const missing = seedItems(Date.now()).filter((i) => !have.has(i.id));
        return missing.length ? { ...saved, items: [...saved.items, ...missing] } : saved;
      } catch {
        return fresh();
      }
    };
    skipSave.current = false;
    setState(load());
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        skipSave.current = true;
        setState(JSON.parse(e.newValue) as Persisted);
      } catch {
        /* ignore malformed */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage blocked: state still works for this session */
    }
  }, [state, ready]);

  const byId = useMemo(() => new Map(checkpoints.map((c) => [c.id, c] as [string, Checkpoint])), [checkpoints]);
  const meta = useCallback(
    (id: string): CheckpointMeta => {
      const c = byId.get(id);
      return { ref: c?.ref ?? id, name: c?.name ?? id, category: c?.category ?? "", ownerRole: c?.ownerRole ?? "" };
    },
    [byId],
  );
  const getConfig = useCallback((pid: ProjectId) => state.configs[pid] ?? emptyConfig(pid), [state.configs]);
  const ageOf = useCallback(
    (item: OpenItem) => ageItem(item, getConfig(item.projectId), meta(item.checkpointId).category, Date.now()),
    [getConfig, meta],
  );

  const updateConfig = (pid: ProjectId, fn: (c: ProjectConfig) => ProjectConfig) =>
    setState((s) => ({ ...s, configs: { ...s.configs, [pid]: fn(s.configs[pid] ?? emptyConfig(pid)) } }));

  const updateItem = (itemId: string, fn: (i: OpenItem) => OpenItem, notes: Notification[] = []) =>
    setState((s) => ({
      ...s,
      items: s.items.map((i) => (i.id === itemId ? fn(i) : i)),
      notifications: [...notes, ...s.notifications].slice(0, 300),
    }));

  const label = (i: OpenItem) => {
    const m = meta(i.checkpointId);
    return `${m.ref} ${m.name}`;
  };

  const runEscalation = (pid: ProjectId): RunSummary => {
    const now = Date.now();
    const runAt = new Date(now).toISOString();
    const cfg = getConfig(pid);
    const notes: Notification[] = [];
    const historyAdds = new Map<string, string>();
    const push = (item: OpenItem, recipient: Level, kind: Notification["kind"], detail: string) =>
      notes.push({ id: nid(), runAt, projectId: pid, itemId: item.id, recipient, kind, title: label(item), detail });

    for (const item of state.items.filter((i) => i.projectId === pid)) {
      if (item.status === "open") {
        const a = ageItem(item, cfg, meta(item.checkpointId).category, now);
        if (!a.level) continue;
        const d = ageLabel(a);
        push(item, "developer", "escalation", d);
        if (a.level === "manager" || a.level === "cto") push(item, "manager", "escalation", `${d} · owner ${item.owner}`);
        if (a.level === "cto") push(item, "cto", "escalation", `${d} · owner ${item.owner} · Manager ${cfg.policy.people.manager.name}`);
        historyAdds.set(item.id, a.level === "developer" ? "Reminder sent to the developer (Simulate run)" : `Escalated to ${LEVEL_LABEL[a.level]} (Simulate run)`);
      } else if (item.status === "pending-approval" && item.fixedAt) {
        const waiting = daysSince(item.fixedAt, now);
        if (waiting >= cfg.policy.approvalLimitDays) {
          push(item, "cto", "approval-stalled", `Fix waiting ${waiting} days for ${cfg.policy.people.manager.name}'s approval (limit ${cfg.policy.approvalLimitDays} days)`);
          historyAdds.set(item.id, `Approval stalled ${waiting} days, CTO notified (Simulate run)`);
        }
      }
    }

    const counts: Record<Level, number> = { developer: 0, manager: 0, cto: 0 };
    notes.forEach((n) => (counts[n.recipient] += 1));
    const anyEmail = Object.values(cfg.policy.people).some((p) => p.email.trim());
    const summary: RunSummary = {
      runAt,
      projectId: pid,
      counts,
      notifications: notes,
      emailNote: anyEmail
        ? "Email not sent: the mail service is not connected to this dashboard yet. Notifications are on each dashboard."
        : "Email off: no recipient emails set in the Escalations tab. Notifications are on each dashboard.",
    };
    setState((s) => ({
      ...s,
      items: s.items.map((i) => (historyAdds.has(i.id) ? { ...i, history: [...i.history, { at: runAt, text: historyAdds.get(i.id)! }] } : i)),
      notifications: [...notes, ...s.notifications].slice(0, 300),
      lastRun: { ...s.lastRun, [pid]: summary },
    }));
    return summary;
  };

  const markFixed = (itemId: string) => {
    const item = state.items.find((i) => i.id === itemId);
    if (!item || item.status !== "open") return;
    const at = nowIso();
    const a = ageOf(item);
    const mgr = getConfig(item.projectId).policy.people.manager.name;
    updateItem(
      itemId,
      (i) => ({ ...i, status: "pending-approval", fixedAt: at, fixedBy: i.owner, overdueDaysAtFix: Math.max(0, a.overdueDays), rejectReason: undefined, nudges: [], history: [...i.history, { at, text: `Marked fixed by ${i.owner}, waiting for ${mgr}` }] }),
      [{ id: nid(), runAt: at, projectId: item.projectId, itemId, recipient: "manager", kind: "fixed", title: label(item), detail: `${item.owner} marked this fixed and needs your approval` }],
    );
  };

  // Developer takes a fix back before the Manager decides: item returns to Overdue & escalated
  // with its original opened date (unlike Reject, the clock does not restart).
  const withdrawFix = (itemId: string) => {
    const item = state.items.find((i) => i.id === itemId);
    if (!item || item.status !== "pending-approval") return;
    const at = nowIso();
    updateItem(itemId, (i) => ({ ...i, status: "open", fixedAt: undefined, fixedBy: undefined, overdueDaysAtFix: undefined, nudges: [], history: [...i.history, { at, text: `Fix withdrawn by ${i.owner}` }] }));
  };

  const canNudge = (item: OpenItem) => {
    const last = item.nudges.at(-1);
    return !last || Date.now() - Date.parse(last) >= DAY_MS;
  };

  const nudge = (itemId: string) => {
    const item = state.items.find((i) => i.id === itemId);
    if (!item || item.status !== "pending-approval" || !canNudge(item)) return;
    const at = nowIso();
    updateItem(
      itemId,
      (i) => ({ ...i, nudges: [...i.nudges, at], history: [...i.history, { at, text: `${i.owner} nudged the Manager` }] }),
      [{ id: nid(), runAt: at, projectId: item.projectId, itemId, recipient: "manager", kind: "nudge", title: label(item), detail: `${item.owner} is waiting on your approval (nudge ${item.nudges.length + 1})` }],
    );
  };

  const approve = (itemId: string, by: string) => {
    const item = state.items.find((i) => i.id === itemId);
    if (!item || item.status !== "pending-approval") return;
    const at = nowIso();
    const m = meta(item.checkpointId);
    const record: ApprovalRecord = {
      checkpointRef: m.ref,
      checkpointName: m.name,
      projectName: projectsData[item.projectId]?.name ?? item.projectId,
      fixedBy: item.fixedBy ?? item.owner,
      fixedAt: item.fixedAt ?? at,
      overdueDaysAtFix: item.overdueDaysAtFix ?? 0,
      nudges: item.nudges.length,
      approvedBy: by,
      approvedAt: at,
    };
    updateItem(itemId, (i) => ({ ...i, status: "compliant", approvedAt: at, approvedBy: by, approval: record, history: [...i.history, { at, text: `Approved by ${by}, now compliant` }] }), [
      { id: nid(), runAt: at, projectId: item.projectId, itemId, recipient: "developer", kind: "fixed", title: label(item), detail: `${by} approved your fix. It is now compliant.` },
    ]);
    resolveCheckpoint(item.checkpointId, "compliant", "Approved", `Fix approved by ${by} (escalation flow)`, by);
  };

  const reject = (itemId: string, by: string, reason: string) => {
    const item = state.items.find((i) => i.id === itemId);
    if (!item || item.status !== "pending-approval") return;
    const at = nowIso();
    updateItem(
      itemId,
      (i) => ({ ...i, status: "open", openedAt: at, fixedAt: undefined, fixedBy: undefined, nudges: [], rejectReason: reason, history: [...i.history, { at, text: `Rejected by ${by}: ${reason}. Clock restarted` }] }),
      [{ id: nid(), runAt: at, projectId: item.projectId, itemId, recipient: "developer", kind: "escalation", title: label(item), detail: `${by} rejected your fix: ${reason}` }],
    );
  };

  const value: Ctx = {
    ready,
    items: state.items,
    notifications: state.notifications,
    lastRun: state.lastRun,
    getConfig,
    meta,
    ageOf,
    setPolicy: (pid, patch) => updateConfig(pid, (c) => ({ ...c, policy: { ...c.policy, ...patch } })),
    setPerson: (pid, level, patch) =>
      updateConfig(pid, (c) => ({ ...c, policy: { ...c.policy, people: { ...c.policy.people, [level]: { ...c.policy.people[level], ...patch } } } })),
    setDefaultLimit: (pid, days) => updateConfig(pid, (c) => ({ ...c, defaultLimitDays: days })),
    setCategoryLimit: (pid, category, days) =>
      updateConfig(pid, (c) => {
        const next = { ...c.categoryLimits };
        if (days === undefined) delete next[category];
        else next[category] = days;
        return { ...c, categoryLimits: next };
      }),
    setCheckpointLimit: (pid, checkpointId, days) =>
      updateConfig(pid, (c) => {
        const next = { ...c.checkpointLimits };
        if (days === undefined) delete next[checkpointId];
        else next[checkpointId] = days;
        return { ...c, checkpointLimits: next };
      }),
    resetProject: (pid) =>
      setState((s) => {
        const configs = { ...s.configs };
        delete configs[pid];
        return { ...s, configs };
      }),
    runEscalation,
    markFixed,
    withdrawFix,
    canNudge,
    nudge,
    approve,
    reject,
    resetDemo: () => setState(fresh()),
  };

  return <EscalationContext.Provider value={value}>{children}</EscalationContext.Provider>;
}

export function useEscalations() {
  const ctx = useContext(EscalationContext);
  if (!ctx) throw new Error("useEscalations must be used inside EscalationProvider");
  return ctx;
}

/** Notifications for one role from the latest Simulate run plus anything newer (fixes, nudges, decisions). */
export function useRoleNotifications(role: Level, pid: ProjectId = "project-a") {
  const { notifications, lastRun } = useEscalations();
  const since = lastRun[pid]?.runAt;
  return notifications.filter((n) => n.projectId === pid && n.recipient === role && (!since || n.runAt >= since));
}
