import { Fragment, useEffect, useState } from "react";
import { ArrowDown, ArrowRight, CheckCircle2, Circle, ExternalLink, Loader2, TriangleAlert, XCircle } from "lucide-react";
import {
  getProjectTracking,
  type Cp20Result,
  type ProjectTracking,
  type TraceState,
  type TraceStep,
  type TrackedPr,
} from "@/lib/api-client";

const fmt = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const STEP_STYLE: Record<TraceState, { border: string; icon: React.ReactNode }> = {
  passed: { border: "border-ok/40", icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" /> },
  failed: { border: "border-fail/50 bg-fail/5", icon: <XCircle className="h-4 w-4 shrink-0 text-fail" /> },
  warn: { border: "border-warn/50 bg-warn/5", icon: <TriangleAlert className="h-4 w-4 shrink-0 text-warn" /> },
  pending: { border: "border-border", icon: <Circle className="h-4 w-4 shrink-0 text-faint" /> },
};

type FlowStep = Omit<TraceStep, "key"> & { key: string };

/** A row of step cards joined by arrows. `compact` stacks them for narrow panels (chat, Simulate). */
export function FlowSteps({ steps, compact = false }: { steps: FlowStep[]; compact?: boolean }) {
  return (
    <div className={compact ? "flex flex-col items-stretch gap-1" : "flex flex-wrap items-stretch gap-1.5"}>
      {steps.map((s, i) => {
        const style = STEP_STYLE[s.state];
        const body = (
          <>
            <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              {style.icon} {s.label}
            </span>
            <span className="mt-1 block text-xs text-foreground">{s.title}</span>
            {s.detail && <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{s.detail}</span>}
          </>
        );
        const cls = `${compact ? "w-full" : "w-48"} rounded-lg border bg-panel p-2.5 ${style.border}`;
        return (
          <Fragment key={s.key}>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer" className={`${cls} hover:shadow-card`}>
                {body}
              </a>
            ) : (
              <div className={cls}>{body}</div>
            )}
            {i < steps.length - 1 &&
              (compact ? (
                <ArrowDown className="h-3.5 w-3.5 self-center text-faint" />
              ) : (
                <ArrowRight className="h-4 w-4 shrink-0 self-center text-faint" />
              ))}
          </Fragment>
        );
      })}
    </div>
  );
}

/** A pull request's flow: CR key → Jira approval → review → merge → deploy, from live data. */
export function PrTrace({ pr, compact = false }: { pr: TrackedPr; compact?: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Trace for <span className="text-foreground">#{pr.number}</span> {pr.title && <>“{pr.title}”</>} · {pr.head} → {pr.base} ·
        opened {fmt(pr.created_at)}
        {pr.release && <> · in release {pr.release}</>}
        {" · "}
        <a href={pr.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
          open on GitHub <ExternalLink className="h-3 w-3" />
        </a>
      </p>
      <FlowSteps steps={pr.trace} compact={compact} />
      {pr.flags.length > 0 && (
        <ul className="space-y-0.5 text-xs">
          {pr.flags.map((f) => (
            <li key={f.code} className={f.level === "fail" ? "text-fail" : "text-warn"}>
              • <span className="font-medium">{f.label}:</span> {f.why}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * CP20's result as flows, the same way the GitHub page shows them:
 * the branch rule, each PR the checked commits came through (full trace),
 * and each direct push. PR traces come from the live GitHub tracking data.
 */
export function Cp20Flows({ result, compact = false }: { result: Cp20Result; compact?: boolean }) {
  const [tracking, setTracking] = useState<ProjectTracking | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getProjectTracking(result.project_id)
      .then((d) => live && setTracking(d))
      .catch((e: unknown) => live && setTrackingError(e instanceof Error ? e.message : "Couldn't load PR traces."));
    return () => {
      live = false;
    };
  }, [result.project_id, result.timestamp]);

  const prNumbers = [...new Set(result.commits.filter((c) => c.pr_number).map((c) => c.pr_number as number))];
  const pushes = result.commits.filter((c) => c.direct_push);

  return (
    <div className="space-y-3">
      {result.branches.map((b) => (
        <div key={b.branch} className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">Branch rule · {b.branch}</p>
          <FlowSteps
            compact={compact}
            steps={[
              { key: "pr", label: "PR required", ok: b.pr_required },
              { key: "admins", label: "Admins enforced", ok: b.admins_enforced },
              { key: "force", label: "Force push blocked", ok: b.force_push_blocked },
              { key: "delete", label: "Deletion blocked", ok: b.deletion_blocked },
            ].map((s) => ({
              key: s.key,
              label: s.label,
              state: !b.readable ? ("pending" as const) : s.ok ? ("passed" as const) : ("failed" as const),
              title: !b.readable ? "Not readable" : s.ok ? "Yes" : "No",
              detail: s.key === "pr" ? b.source : null,
              url: null,
            }))}
          />
        </div>
      ))}

      {prNumbers.map((n) => {
        const tracked = tracking?.prs.find((p) => p.repo === result.repo && p.number === n);
        const commits = result.commits.filter((c) => c.pr_number === n);
        return (
          <div key={n} className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">
              Pull request #{n} · {commits.length} commit{commits.length > 1 ? "s" : ""} (
              {commits.map((c) => c.sha.slice(0, 7)).join(", ")})
            </p>
            {tracked ? (
              <PrTrace pr={tracked} compact={compact} />
            ) : trackingError ? (
              <p className="text-xs text-fail">{trackingError}</p>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading the PR's trace…
              </p>
            )}
          </div>
        );
      })}

      {pushes.map((c) => (
        <div key={c.sha} className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">Direct push · {c.sha.slice(0, 7)}</p>
          <FlowSteps
            compact={compact}
            steps={[
              { key: "commit", label: "Commit", state: "passed", title: c.sha.slice(0, 7), detail: `by ${c.author ?? "unknown"}${c.message ? ` · “${c.message}”` : ""}`, url: `${result.repo_url}/commit/${c.sha}` },
              { key: "pr", label: "Pull request", state: "failed", title: "None", detail: "no merged PR brought this commit in", url: null },
              { key: "push", label: `Pushed to ${c.branch}`, state: "failed", title: fmt(c.date), detail: "straight to the protected branch", url: null },
              c.exception_id
                ? { key: "exception", label: "Exception", state: "passed" as const, title: c.exception_id, detail: "approved, unexpired exception", url: null }
                : { key: "exception", label: "Exception", state: "failed" as const, title: "None", detail: "not in the exception register", url: null },
            ]}
          />
        </div>
      ))}

      {result.history_events.map((e) => (
        <div key={`${e.type}-${e.time}`} className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">{e.type.replace("_", " ")} · {e.branch}</p>
          <FlowSteps
            compact={compact}
            steps={[
              { key: "event", label: e.type.replace("_", " "), state: "failed", title: e.actor ?? "unknown", detail: fmt(e.time), url: null },
              { key: "exception", label: "Exception", state: e.exception_id ? "passed" : "failed", title: e.exception_id ?? "None", detail: null, url: null },
            ]}
          />
        </div>
      ))}
    </div>
  );
}
