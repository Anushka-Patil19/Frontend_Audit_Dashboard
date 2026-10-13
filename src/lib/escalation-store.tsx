import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ProjectId } from "@/lib/audit-data";
import {
  approveEscalationItem,
  escalationItemAction,
  getEscalationConfig,
  getLatestEscalationRuns,
  listEscalationItems,
  listEscalationNotifications,
  rejectEscalationItem,
  resetEscalationConfig,
  resetEscalationDemo,
  runEscalationApi,
  saveEscalationLimits,
  saveEscalationPolicy,
  type EscalationItemAction,
  type EscalationLimitsPatch,
} from "@/lib/api-client";
import {
  ageItem,
  daysSince,
  emptyConfig,
  type Level,
  type Notification,
  type OpenItem,
  type Person,
  type Policy,
  type ProjectConfig,
  type RunSummary,
} from "@/lib/escalation-data";
import { initialCheckpoints } from "@/lib/audit-data";

type StoreState = {
  configs: Partial<Record<ProjectId, ProjectConfig>>;
  items: OpenItem[];
  notifications: Notification[];
  lastRuns: Partial<Record<ProjectId, RunSummary>>;
  configVersions: Partial<Record<ProjectId, number>>;
};

const PROJECT_IDS: ProjectId[] = ["project-a", "project-b", "project-c"];
const CHECKPOINT_META = new Map(
  initialCheckpoints.map((checkpoint) => [
    checkpoint.id,
    { ref: checkpoint.ref, name: checkpoint.name, category: checkpoint.category },
  ]),
);

interface EscalationContextValue {
  state: StoreState;
  ready: boolean;
  getConfig: (projectId: ProjectId) => ProjectConfig;
  updatePolicy: (projectId: ProjectId, patch: Partial<Policy>) => void;
  setPerson: (projectId: ProjectId, level: Level, person: Person) => void;
  updateLimit: (projectId: ProjectId, checkpointId: string, days: number | null) => void;
  setDefaultLimit: (projectId: ProjectId, days: number | null | undefined) => void;
  setCategoryLimit: (
    projectId: ProjectId,
    category: string,
    days: number | null | undefined,
  ) => void;
  setCheckpointLimit: (
    projectId: ProjectId,
    checkpointId: string,
    days: number | null | undefined,
  ) => void;
  resetProject: (projectId: ProjectId) => Promise<void>;
  runEscalation: (projectId: ProjectId) => Promise<RunSummary>;
  markFixed: (itemId: string) => Promise<void>;
  withdrawFix: (itemId: string) => Promise<void>;
  nudge: (itemId: string) => Promise<void>;
  approve: (itemId: string, by: string) => Promise<void>;
  reject: (itemId: string, by: string, reason: string) => Promise<void>;
  resolveCheckpoint: (projectId: ProjectId, checkpointId: string) => void;
  resetDemo: () => Promise<void>;
  notificationsFor: (level: Level, projectId?: ProjectId) => Notification[];
  items: OpenItem[];
  notifications: Notification[];
  lastRun: Partial<Record<ProjectId, RunSummary>>;
  meta: (checkpointId: string) => { ref: string; name: string; category: string };
  ageOf: (item: OpenItem) => ReturnType<typeof ageItem>;
  canNudge: (item: OpenItem) => boolean;
  setPolicy: (projectId: ProjectId, policy: Policy) => void;
  error: string | null;
}

const EscalationContext = createContext<EscalationContextValue | null>(null);
const POLL_INTERVAL_MS = 30_000;

function notifyEmailStatus(response: EscalationItemAction) {
  const kind = response.notifications[0]?.kind;
  if (
    (kind === "fixed" || kind === "nudge") &&
    response.emailNote &&
    !isEmailSuccess(response.emailNote)
  ) {
    console.error(`Escalation action saved, but email delivery failed: ${response.emailNote}`);
  }
}

function isEmailSuccess(note: string) {
  const normalized = note.toLowerCase();
  return normalized.startsWith("email sent") && !normalized.includes("failed");
}

export function EscalationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreState>({
    configs: {},
    items: [],
    notifications: [],
    lastRuns: {},
    configVersions: {},
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let loading = false;

    const refresh = async (includeConfigs: boolean) => {
      if (loading) return;
      loading = true;
      try {
        const [items, notifications, lastRuns, configs] = await Promise.all([
          listEscalationItems(),
          listEscalationNotifications(),
          getLatestEscalationRuns(),
          includeConfigs
            ? Promise.all(
                PROJECT_IDS.map(
                  async (projectId) => [projectId, await getEscalationConfig(projectId)] as const,
                ),
              )
            : Promise.resolve(null),
        ]);
        if (!active) return;
        setState((current) => ({
          ...current,
          items,
          notifications,
          lastRuns,
          ...(configs
            ? {
                configs: Object.fromEntries(configs),
                configVersions: Object.fromEntries(
                  configs.map(([projectId]) => [
                    projectId,
                    (current.configVersions[projectId] ?? 0) + 1,
                  ]),
                ),
              }
            : {}),
        }));
        setError(null);
        setReady(true);
      } catch (cause) {
        if (!active) return;
        const message = cause instanceof Error ? cause.message : "Could not load escalation data.";
        setError(message);
        console.error("Could not refresh escalation data:", cause);
      } finally {
        loading = false;
      }
    };

    const onFocus = () => void refresh(false);
    void refresh(true);
    const interval = window.setInterval(() => void refresh(false), POLL_INTERVAL_MS);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const applyAction = useCallback((response: EscalationItemAction) => {
    notifyEmailStatus(response);
    const kind = response.notifications[0]?.kind;
    if (
      (kind === "fixed" || kind === "nudge") &&
      response.emailNote &&
      !isEmailSuccess(response.emailNote)
    ) {
      setError(response.emailNote);
    } else {
      setError(null);
    }
    setState((current) => {
      const exists = current.items.some((item) => item.id === response.item.id);
      return {
        ...current,
        items: exists
          ? current.items.map((item) => (item.id === response.item.id ? response.item : item))
          : [...current.items, response.item],
        notifications: [...current.notifications, ...response.notifications],
      };
    });
  }, []);

  const performAction = useCallback(
    async (action: string, request: () => Promise<EscalationItemAction>) => {
      try {
        applyAction(await request());
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : `Could not ${action} escalation item.`;
        setError(message);
        console.error(`Could not ${action} escalation item:`, cause);
      }
    },
    [applyAction],
  );

  const getConfig = useCallback(
    (projectId: ProjectId) => state.configs[projectId] ?? emptyConfig(projectId),
    [state.configs],
  );

  const updatePolicy = useCallback(
    (projectId: ProjectId, patch: Partial<Policy>) => {
      const current = getConfig(projectId);
      const policy = { ...current.policy, ...patch };
      setState((s) => ({
        ...s,
        configs: { ...s.configs, [projectId]: { ...current, policy } },
      }));
      void saveEscalationPolicy(projectId, policy)
        .then((config) => {
          setState((s) => ({
            ...s,
            configs: { ...s.configs, [projectId]: config },
            configVersions: {
              ...s.configVersions,
              [projectId]: (s.configVersions[projectId] ?? 0) + 1,
            },
          }));
          setError(null);
        })
        .catch((cause: unknown) => {
          const message =
            cause instanceof Error ? cause.message : "Could not save escalation policy.";
          setError(message);
          console.error("Could not save escalation policy:", cause);
        });
    },
    [getConfig],
  );

  const setPolicy = useCallback(
    (projectId: ProjectId, policy: Policy) => updatePolicy(projectId, policy),
    [updatePolicy],
  );

  const setPerson = useCallback(
    (projectId: ProjectId, level: Level, person: Person) => {
      const current = getConfig(projectId);
      updatePolicy(projectId, {
        people: { ...current.policy.people, [level]: person },
      });
    },
    [getConfig, updatePolicy],
  );

  const updateLimits = useCallback(
    (projectId: ProjectId, patch: EscalationLimitsPatch) => {
      const current = getConfig(projectId);
      const categoryLimits = { ...current.categoryLimits };
      const checkpointLimits = { ...current.checkpointLimits };
      for (const [category, days] of Object.entries(patch.categoryLimits ?? {})) {
        if (days === null) delete categoryLimits[category];
        else if (days !== undefined) categoryLimits[category] = days;
      }
      for (const [checkpointId, days] of Object.entries(patch.checkpointLimits ?? {})) {
        if (days === null) delete checkpointLimits[checkpointId];
        else if (days !== undefined) checkpointLimits[checkpointId] = days;
      }
      const config: ProjectConfig = {
        ...current,
        categoryLimits,
        checkpointLimits,
        ...(patch.defaultLimitDays !== undefined
          ? { defaultLimitDays: patch.defaultLimitDays ?? undefined }
          : {}),
      };
      setState((s) => ({
        ...s,
        configs: { ...s.configs, [projectId]: config },
      }));
      void saveEscalationLimits(projectId, patch)
        .then((config) => {
          setState((s) => ({
            ...s,
            configs: { ...s.configs, [projectId]: config },
            configVersions: {
              ...s.configVersions,
              [projectId]: (s.configVersions[projectId] ?? 0) + 1,
            },
          }));
          setError(null);
        })
        .catch((cause: unknown) => {
          const message =
            cause instanceof Error ? cause.message : "Could not save escalation limits.";
          setError(message);
          console.error("Could not save escalation limits:", cause);
        });
    },
    [getConfig],
  );

  const updateLimit = useCallback(
    (projectId: ProjectId, checkpointId: string, days: number | null) =>
      updateLimits(projectId, { checkpointLimits: { [checkpointId]: days } }),
    [updateLimits],
  );

  const setDefaultLimit = useCallback(
    (projectId: ProjectId, days: number | null | undefined) =>
      updateLimits(projectId, { defaultLimitDays: days ?? null }),
    [updateLimits],
  );

  const setCategoryLimit = useCallback(
    (projectId: ProjectId, category: string, days: number | null | undefined) =>
      updateLimits(projectId, { categoryLimits: { [category]: days ?? null } }),
    [updateLimits],
  );

  const setCheckpointLimit = useCallback(
    (projectId: ProjectId, checkpointId: string, days: number | null | undefined) =>
      updateLimits(projectId, { checkpointLimits: { [checkpointId]: days ?? null } }),
    [updateLimits],
  );

  const resetProject = useCallback(async (projectId: ProjectId) => {
    try {
      const config = await resetEscalationConfig(projectId);
      setState((s) => ({
        ...s,
        configs: { ...s.configs, [projectId]: config },
        configVersions: {
          ...s.configVersions,
          [projectId]: (s.configVersions[projectId] ?? 0) + 1,
        },
      }));
      setError(null);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not reset project configuration.";
      setError(message);
      throw cause;
    }
  }, []);

  const runEscalation = useCallback(async (projectId: ProjectId) => {
    const summary = await runEscalationApi(projectId);
    const [items, notifications, lastRuns] = await Promise.all([
      listEscalationItems(),
      listEscalationNotifications(),
      getLatestEscalationRuns(),
    ]);
    setState((s) => ({ ...s, items, notifications, lastRuns }));
    if (
      summary.notifications.length > 0 &&
      summary.emailNote &&
      !isEmailSuccess(summary.emailNote)
    ) {
      console.error(`Escalation run completed, but email delivery failed: ${summary.emailNote}`);
      setError(summary.emailNote);
    } else {
      setError(null);
    }
    return summary;
  }, []);

  const markFixed = useCallback(
    (itemId: string) => performAction("mark fixed", () => escalationItemAction(itemId, "fixed")),
    [performAction],
  );

  const withdrawFix = useCallback(
    (itemId: string) => performAction("undo fix", () => escalationItemAction(itemId, "undo")),
    [performAction],
  );

  const nudge = useCallback(
    (itemId: string) => performAction("nudge Manager", () => escalationItemAction(itemId, "nudge")),
    [performAction],
  );

  const approve = useCallback(
    (itemId: string, by: string) =>
      performAction("approve fix", () => approveEscalationItem(itemId, by)),
    [performAction],
  );

  const reject = useCallback(
    (itemId: string, by: string, reason: string) =>
      performAction("reject fix", () => rejectEscalationItem(itemId, by, reason)),
    [performAction],
  );

  const resolveCheckpoint = useCallback((projectId: ProjectId, checkpointId: string) => {
    setState((s) => ({
      ...s,
      items: s.items.map((item) =>
        item.projectId === projectId && item.checkpointId === checkpointId
          ? { ...item, status: "compliant" as const }
          : item,
      ),
    }));
  }, []);

  const resetDemo = useCallback(async () => {
    await resetEscalationDemo();
    const [items, notifications, lastRuns] = await Promise.all([
      listEscalationItems(),
      listEscalationNotifications(),
      getLatestEscalationRuns(),
    ]);
    setState((s) => ({ ...s, items, notifications, lastRuns }));
    setError(null);
  }, []);

  const notificationsFor = useCallback(
    (level: Level, projectId?: ProjectId) =>
      state.notifications.filter(
        (notification) =>
          notification.recipient === level &&
          (projectId === undefined || notification.projectId === projectId),
      ),
    [state.notifications],
  );

  const meta = useCallback((checkpointId: string) => {
    const checkpoint = CHECKPOINT_META.get(checkpointId);
    if (!checkpoint) throw new Error(`Unknown escalation checkpoint: ${checkpointId}`);
    return checkpoint;
  }, []);

  const ageOf = useCallback(
    (item: OpenItem) =>
      ageItem(item, getConfig(item.projectId), meta(item.checkpointId).category, Date.now()),
    [getConfig, meta],
  );

  const canNudge = useCallback((item: OpenItem) => {
    if (item.status !== "pending-approval") return false;
    const lastNudge = item.nudges.at(-1);
    return !lastNudge || daysSince(lastNudge, Date.now()) >= 1;
  }, []);

  const value = useMemo<EscalationContextValue>(
    () => ({
      state,
      ready,
      getConfig,
      updatePolicy,
      setPolicy,
      setPerson,
      updateLimit,
      setDefaultLimit,
      setCategoryLimit,
      setCheckpointLimit,
      resetProject,
      runEscalation,
      markFixed,
      withdrawFix,
      nudge,
      approve,
      reject,
      resolveCheckpoint,
      resetDemo,
      notificationsFor,
      items: state.items,
      notifications: state.notifications,
      lastRun: state.lastRuns,
      meta,
      ageOf,
      canNudge,
      error,
    }),
    [
      state,
      ready,
      getConfig,
      updatePolicy,
      setPolicy,
      setPerson,
      updateLimit,
      setDefaultLimit,
      setCategoryLimit,
      setCheckpointLimit,
      resetProject,
      runEscalation,
      markFixed,
      withdrawFix,
      nudge,
      approve,
      reject,
      resolveCheckpoint,
      resetDemo,
      notificationsFor,
      meta,
      ageOf,
      canNudge,
      error,
    ],
  );

  return <EscalationContext.Provider value={value}>{children}</EscalationContext.Provider>;
}

export function useEscalations() {
  const context = useContext(EscalationContext);
  if (!context) throw new Error("useEscalations must be used within EscalationProvider");
  return context;
}

export function useRoleNotifications(level: Level, projectId?: ProjectId) {
  const { notificationsFor } = useEscalations();
  return notificationsFor(level, projectId);
}

export function checkpointForItem(item: OpenItem) {
  const checkpoint = CHECKPOINT_META.get(item.checkpointId);
  if (!checkpoint) throw new Error(`Unknown escalation checkpoint: ${item.checkpointId}`);
  return checkpoint;
}

export type { RunSummary };
