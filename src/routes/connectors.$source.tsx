import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { sourceEvents, sourceLabels, type SourceKey } from "@/lib/audit-data";
import { useAudit } from "@/lib/audit-store";
import { Mono, SectionHeading } from "@/components/audit/atoms";
import { PageHeader } from "@/components/layout/PageHeader";
import { connectorIcons, stateCopy } from "./connectors";

export const Route = createFileRoute("/connectors/$source")({
  head: ({ params }) => {
    const label = sourceLabels[params.source as SourceKey] ?? "Source";
    return {
      meta: [
        { title: `${label} connector — Audit Intelligence` },
        {
          name: "description",
          content: `Everything the ${label} connector has picked up: verified evidence, flagged items and checks awaiting human review.`,
        },
        { property: "og:title", content: `${label} connector — Audit Intelligence` },
        {
          property: "og:description",
          content: `Recent ${label} evidence feeding continuous compliance verification.`,
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: SourceDetail,
});

const outcomeStyle = {
  verified: { label: "verified", cls: "text-ok", bg: "bg-ok/10" },
  flagged: { label: "flagged", cls: "text-fail", bg: "bg-fail/10" },
  review: { label: "needs review", cls: "text-warn", bg: "bg-warn/10" },
} as const;

function SourceDetail() {
  const { source } = Route.useParams();
  const key = source as SourceKey;
  const { connectors, checkpoints, syncConnector } = useAudit();
  const events = sourceEvents[key];
  if (!events) throw notFound();

  const connector = connectors.find((c) => c.key === key) ?? null;
  const Icon = connectorIcons[key];
  const label = sourceLabels[key];
  const related = checkpoints.filter((c) =>
    c.kind === "automated" ? c.sources.includes(key) : key === "manual",
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title={`${label} connector`}
        subtitle={
          connector
            ? `Polls ${connector.intervalLabel} · last synced ${connector.lastSyncedMinutes}m ago`
            : "Human-driven workflows — no scheduled sync"
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/connectors"
          className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All connectors
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-2.5 py-1 text-xs text-primary">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          {label}
        </span>
        {connector && (
          <>
            <span
              className={`inline-flex items-center gap-2 text-xs ${stateCopy[connector.state].cls}`}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full bg-current ${
                  connector.state === "healthy" ? "pulse-dot" : ""
                }`}
              />
              {connector.syncing ? "syncing…" : stateCopy[connector.state].text}
            </span>
            <button
              onClick={() => syncConnector(key)}
              disabled={connector.syncing}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] text-foreground transition-colors hover:border-primary disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${connector.syncing ? "animate-spin" : ""}`} />
              {connector.syncing ? "Syncing…" : "Sync now"}
            </button>
          </>
        )}
      </div>

      {connector && (
        <p className="rounded-lg border border-border bg-panel px-4 py-3 text-sm text-muted-foreground shadow-card">
          {connector.message}
        </p>
      )}

      <section className="space-y-3">
        <SectionHeading>What this source picked up</SectionHeading>
        <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-card">
          <ul className="divide-y divide-border">
            {events.map((e) => {
              const o = outcomeStyle[e.outcome];
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Mono className="w-24 shrink-0 text-primary">{e.ref}</Mono>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{e.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{e.meta}</span>
                  </span>
                  <Mono className="text-faint">{e.at}</Mono>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] ${o.bg} ${o.cls}`}>
                    {o.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading>Checkpoints verified through {label}</SectionHeading>
        <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-card">
          <ul className="divide-y divide-border">
            {related.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Mono className="w-16 shrink-0 text-faint">{c.ref}</Mono>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{c.name}</span>
                <Mono className="text-muted-foreground">{c.category}</Mono>
                <Link to="/controls" className="text-[11px] text-primary hover:underline">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
