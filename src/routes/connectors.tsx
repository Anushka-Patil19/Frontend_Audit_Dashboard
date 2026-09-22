import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Github,
  Mail,
  SquareKanban,
  FolderClosed,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { sourceEvents, type SourceKey } from "@/lib/audit-data";
import { useAudit } from "@/lib/audit-store";
import { Mono, SectionHeading } from "@/components/audit/atoms";
import { PageHeader } from "@/components/layout/PageHeader";

export const Route = createFileRoute("/connectors")({
  head: () => ({
    meta: [
      { title: "Connectors — Audit Intelligence" },
      {
        name: "description",
        content:
          "Health, poll interval and recent evidence for the GitHub, Jira and Mail connectors plus the manual workflow queue.",
      },
      { property: "og:title", content: "Connectors — Audit Intelligence" },
      {
        property: "og:description",
        content: "Connector health, sync controls and everything each source has picked up.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConnectorsPage,
});

export const connectorIcons = { github: Github, jira: SquareKanban, mail: Mail, manual: FolderClosed };

export const stateCopy = {
  healthy: { text: "connected", cls: "text-ok" },
  stale: { text: "no sync recently — check connection", cls: "text-warn" },
  failed: { text: "last sync failed", cls: "text-fail" },
} as const;

function ConnectorsPage() {
  const { connectors, checkpoints, syncConnector } = useAudit();
  const manualCount = checkpoints.filter((c) => c.kind === "manual").length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-7">
      <PageHeader
        title="Connectors"
        subtitle="Evidence sources feeding the automated verification workers"
      />

      <section className="space-y-3">
        <SectionHeading>Automated sources</SectionHeading>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {connectors.map((c) => {
            const Icon = connectorIcons[c.key];
            const s = stateCopy[c.state];
            const events = sourceEvents[c.key] ?? [];
            return (
              <div
                key={c.key}
                className="flex flex-col rounded-xl border border-border bg-panel p-5 shadow-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-sm text-foreground">
                    <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
                    {c.name}
                  </span>
                  <span className={`inline-flex items-center gap-2 text-[11px] ${s.cls}`}>
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full bg-current ${
                        c.state === "healthy" ? "pulse-dot" : ""
                      }`}
                    />
                    {c.syncing ? "syncing…" : s.text}
                  </span>
                </div>

                <p className="mt-3 text-xs text-muted-foreground">{c.message}</p>
                <Mono className="mt-3 block text-faint">
                  polls {c.intervalLabel} · last {c.lastSyncedMinutes}m ago · {events.length} recent
                  items
                </Mono>

                <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                  <Link
                    to="/connectors/$source"
                    params={{ source: c.key }}
                    className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2.5 py-1.5 text-[11px] text-primary hover:underline"
                  >
                    View activity
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                  <button
                    onClick={() => syncConnector(c.key)}
                    disabled={c.syncing}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] text-foreground transition-colors hover:border-primary disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${c.syncing ? "animate-spin" : ""}`} />
                    {c.syncing ? "Syncing…" : "Sync now"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading>Manual workflows</SectionHeading>
        <div className="rounded-xl border border-border border-l-4 border-l-manual bg-panel p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-sm text-foreground">
              <FolderClosed className="h-4 w-4 text-manual" strokeWidth={1.75} />
              Human-driven approval workflows
            </span>
            <span className="rounded-full bg-manual/10 px-2.5 py-0.5 text-[11px] text-manual">
              always on — no sync required
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {manualCount} open workflows are waiting on named roles. Steps unlock in order and every
            completion is written to the checkpoint history.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
            <Link
              to="/connectors/$source"
              params={{ source: "manual" as SourceKey }}
              className="inline-flex items-center gap-1 rounded-md bg-manual/10 px-2.5 py-1.5 text-[11px] text-manual hover:underline"
            >
              View workflow queue
              <ChevronRight className="h-3 w-3" />
            </Link>
            <Link
              to="/controls"
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[11px] text-foreground hover:border-primary"
            >
              Open in controls
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
