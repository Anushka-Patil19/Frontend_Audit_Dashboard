import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  initialCheckpoints,
  initialConnectors,
  initialFeed,
  statusLabel,
  type AutoStatus,
  type Checkpoint,
  type Connector,
  type FeedEntry,
} from "./audit-data";
import { syncMailConnector } from "./mail-connector";
import type { Cp10GateStatus, Cp10Result } from "./cp10-verify";

const CP10_GATE_ORDER: (keyof Cp10GateStatus)[] = ["llm", "mail", "jira"];

type AuditContextValue = {
  checkpoints: Checkpoint[];
  connectors: Connector[];
  feed: FeedEntry[];
  clock: string;
  dateLabel: string;
  countdown: string;
  resolveCheckpoint: (id: string, next: AutoStatus, action: string, reason: string, actor?: string) => void;
  undoResolveCheckpoint: (id: string, actor?: string) => void;
  completeStep: (id: string, index: number, actor?: string) => void;
  undoStep: (id: string, index: number) => void;
  addComment: (id: string, text: string) => void;
  syncConnector: (key: string) => void;
  // Live CP10 gate status — shared between the copilot widget and the
  // cp-10 ledger card, so a check made from either place shows up in both.
  cp10Gates: Cp10GateStatus;
  cp10Result: Cp10Result | null;
  setCp10Verification: (result: Cp10Result | null, gates: Cp10GateStatus) => void;
  undoCp10Gate: (ledgerId: string, actor?: string) => void;
};

const AuditContext = createContext<AuditContextValue | null>(null);

export function AuditProvider({ children }: { children: ReactNode }) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(initialCheckpoints);
  const [connectors, setConnectors] = useState<Connector[]>(initialConnectors);
  const [feed, setFeed] = useState<FeedEntry[]>(initialFeed);
  const [now, setNow] = useState<Date | null>(null);
  const [secondsToSync, setSecondsToSync] = useState(14 * 60 + 12);
  const [cp10Gates, setCp10Gates] = useState<Cp10GateStatus>({ jira: "pending", mail: "pending", llm: "pending" });
  const [cp10Result, setCp10Result] = useState<Cp10Result | null>(null);
  const syncMail = useServerFn(syncMailConnector);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => {
      setNow(new Date());
      setSecondsToSync((s) => (s <= 0 ? 2 * 60 * 60 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const clock = now ? now.toLocaleTimeString("en-GB", { hour12: false }) : "--:--:--";
  const dateLabel = now
    ? now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "";
  const countdown = `${String(Math.floor(secondsToSync / 60)).padStart(2, "0")}:${String(
    secondsToSync % 60,
  ).padStart(2, "0")}`;
  const nowLabel = `${dateLabel.slice(0, 6)}, ${clock.slice(0, 5)}`;

  const pushFeed = (sourceName: string, text: string) =>
    setFeed((f) => [
      {
        id: `f-${Date.now()}-${Math.random()}`,
        at: (now ?? new Date()).toLocaleTimeString("en-GB", { hour12: false }),
        source: sourceName,
        text,
        fresh: true,
      },
      ...f.map((e) => ({ ...e, fresh: false })),
    ]);

  // Extracted (not inline in the memoized value) so undoCp10Gate can call it
  // directly when an undo cascades from CP10's LLM gate back to the ledger.
  const undoResolveCheckpoint = (id: string, actor = "Priya Rao") => {
    setCheckpoints((list) =>
      list.map((cp) =>
        cp.id === id && cp.kind === "automated"
          ? {
              ...cp,
              status: "needs-review" as const,
              history: [
                ...cp.history,
                {
                  at: nowLabel,
                  text: `${statusLabel[cp.status]} → ${statusLabel["needs-review"]} · Undo by ${actor}`,
                },
              ],
            }
          : cp,
      ),
    );
    const cp = checkpoints.find((c) => c.id === id);
    pushFeed("human-review", `${cp?.ref} status undone by ${actor}.`);
  };

  const value = useMemo<AuditContextValue>(
    () => ({
      checkpoints,
      connectors,
      feed,
      clock,
      dateLabel,
      countdown,
      resolveCheckpoint: (id, next, action, reason, actor = "Priya Rao") => {
        setCheckpoints((list) =>
          list.map((cp) =>
            cp.id === id && cp.kind === "automated"
              ? {
                  ...cp,
                  status: next,
                  history: [
                    ...cp.history,
                    {
                      at: nowLabel,
                      text: `${statusLabel[cp.status]} → ${statusLabel[next]} · ${action} by ${actor}: "${reason}"`,
                    },
                  ],
                }
              : cp,
          ),
        );
        const cp = checkpoints.find((c) => c.id === id);
        pushFeed("human-review", `${cp?.ref} ${action.toLowerCase()}d by ${actor} — "${reason}".`);
      },
      undoResolveCheckpoint,
      completeStep: (id, index, actor = "Priya Rao") => {
        setCheckpoints((list) =>
          list.map((cp) => {
            if (cp.id !== id || cp.kind !== "manual") return cp;
            const steps = cp.steps.map((s, i) => {
              if (i === index)
                return {
                  ...s,
                  state: "done" as const,
                  completedBy: actor,
                  completedAt: nowLabel,
                };
              if (i === index + 1 && s.state === "locked")
                return { ...s, state: "pending" as const };
              return s;
            });
            const nextPending = steps.find((s) => s.state === "pending");
            return {
              ...cp,
              steps,
              waitingOn: nextPending ? nextPending.role : "Complete",
              status: nextPending ? cp.status : "manual-in-progress",
              history: [
                ...cp.history,
                { at: nowLabel, text: `step ${index + 1} completed by ${actor}` },
              ],
            };
          }),
        );
        const cp = checkpoints.find((c) => c.id === id);
        pushFeed("manual-workflow", `${cp?.ref} step ${index + 1} marked done by ${actor}.`);
      },
      undoStep: (id, index) => {
        setCheckpoints((list) =>
          list.map((cp) => {
            if (cp.id !== id || cp.kind !== "manual") return cp;
            const steps = cp.steps.map((s, i) => {
              if (i === index)
                return {
                  ...s,
                  state: "pending" as const,
                  completedBy: undefined,
                  completedAt: undefined,
                };
              if (i === index + 1 && s.state === "pending") return { ...s, state: "locked" as const };
              return s;
            });
            const nextPending = steps.find((s) => s.state === "pending");
            return {
              ...cp,
              steps,
              waitingOn: nextPending ? nextPending.role : "Complete",
              status: "manual-in-progress",
              history: [
                ...cp.history,
                { at: nowLabel, text: `step ${index + 1} undone by Priya Rao` },
              ],
            };
          }),
        );
        const cp = checkpoints.find((c) => c.id === id);
        pushFeed("manual-workflow", `${cp?.ref} step ${index + 1} undone by Priya Rao.`);
      },
      addComment: (id, text) => {
        setCheckpoints((list) =>
          list.map((cp) =>
            cp.id === id && cp.kind === "manual"
              ? { ...cp, comments: [...cp.comments, { author: "Priya Rao", at: nowLabel, text }] }
              : cp,
          ),
        );
      },
      syncConnector: (key) => {
        setConnectors((cs) => cs.map((c) => (c.key === key ? { ...c, syncing: true } : c)));
        const name = connectors.find((c) => c.key === key)?.name ?? key;

        if (key === "mail") {
          syncMail()
            .then((result) => {
              setConnectors((cs) =>
                cs.map((c) =>
                  c.key === key
                    ? {
                        ...c,
                        syncing: false,
                        state: result.connected ? ("healthy" as const) : ("failed" as const),
                        lastSyncedMinutes: result.connected ? 0 : c.lastSyncedMinutes,
                        message: result.message,
                      }
                    : c,
                ),
              );
              pushFeed(
                `${key}-connector`,
                result.connected
                  ? `Manual sync completed for ${name} — connector healthy.`
                  : `Manual sync failed for ${name} — ${result.message}`,
              );
              if (result.connected) setSecondsToSync(2 * 60 * 60);
            })
            .catch((error) => {
              setConnectors((cs) =>
                cs.map((c) =>
                  c.key === key
                    ? {
                        ...c,
                        syncing: false,
                        state: "failed" as const,
                        message: error instanceof Error ? error.message : "Sync failed.",
                      }
                    : c,
                ),
              );
            });
          return;
        }

        setTimeout(() => {
          setConnectors((cs) =>
            cs.map((c) =>
              c.key === key
                ? {
                    ...c,
                    syncing: false,
                    state: "healthy" as const,
                    lastSyncedMinutes: 0,
                    message: "Connected — sync completed just now.",
                  }
                : c,
            ),
          );
          pushFeed(`${key}-connector`, `Manual sync completed for ${name} — connector healthy.`);
          setSecondsToSync(2 * 60 * 60);
        }, 1400);
      },
      cp10Gates,
      cp10Result,
      setCp10Verification: (result, gates) => {
        setCp10Result(result);
        setCp10Gates(gates);
      },
      undoCp10Gate: (ledgerId, actor = "CP10 Copilot (undo)") => {
        const lastResolvedKey = CP10_GATE_ORDER.find((k) => cp10Gates[k] !== "pending");
        if (!lastResolvedKey) return;
        if (lastResolvedKey === "llm" && cp10Result?.outcome_id === "CP10-C") {
          undoResolveCheckpoint(ledgerId, actor);
          setCp10Result(null);
        }
        setCp10Gates((gates) => ({ ...gates, [lastResolvedKey]: "pending" }));
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkpoints, connectors, feed, clock, dateLabel, countdown, cp10Gates, cp10Result],
  );

  return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>;
}

export function useAudit() {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error("useAudit must be used inside AuditProvider");
  return ctx;
}
