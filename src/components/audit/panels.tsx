import { Github, Mail, SquareKanban, FolderClosed, ArrowUpRight, RefreshCw } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { Connector, FeedEntry } from "@/lib/audit-data";
import { Mono, SectionHeading } from "./atoms";

export function StatCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 border-r border-border px-5 py-4 last:border-r-0">
      <p className="text-[11px] text-faint">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function Rollup({
  compliance,
  automated,
  manual,
  trendData,
}: {
  compliance: number;
  automated: number;
  manual: number;
  countdown?: string;
  healthy?: number;
  totalConnectors?: number;
  trendData?: { month: string; compliance: number; findings?: number }[];
}) {
  const autoPct = Math.round((automated / (automated + manual || 1)) * 100);
  const chartData = trendData ?? [
    { month: "Apr", compliance: 61 },
    { month: "May", compliance: 64 },
    { month: "Jun", compliance: 68 },
    { month: "Jul", compliance: 71 },
    { month: "Aug", compliance: 74 },
    { month: "Sep", compliance: compliance || 78 },
  ];

  return (
    <div className="flex flex-wrap border border-border bg-panel items-stretch">
      <StatCell label="Overall compliance">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl text-foreground">{compliance}%</span>
          <span className="inline-flex items-center text-xs text-ok">
            <ArrowUpRight className="h-3.5 w-3.5" />
            <Mono>+4</Mono>
          </span>
        </div>
      </StatCell>
      <StatCell label="Automated vs manual">
        <div className="space-y-2">
          <div className="flex h-1.5 w-40 overflow-hidden">
            <span className="bg-ok" style={{ width: `${autoPct}%` }} />
            <span className="flex-1 bg-manual" />
          </div>
          <Mono className="text-muted-foreground">
            {automated} automated · {manual} manual
          </Mono>
        </div>
      </StatCell>
      <StatCell label="Open findings">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl text-fail">2</span>
          <Mono className="text-muted-foreground">2 open · 1 high</Mono>
        </div>
      </StatCell>
      <div className="flex-[2] min-w-[280px] px-5 py-3 flex flex-col justify-center">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] text-faint">Compliance trend</p>
          <span className="text-[10px] font-mono text-ok font-medium">Apr – Sep</span>
        </div>
        <div className="h-20 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="rollupTrendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                stroke="var(--faint)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--panel)",
                  fontSize: 11,
                  padding: "4px 8px",
                }}
                labelFormatter={(label) => `Month: ${label}`}
                formatter={(val: number) => [`${val}%`, "Compliance"]}
              />
              <Area
                type="monotone"
                dataKey="compliance"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#rollupTrendGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

const connectorIcons = { github: Github, jira: SquareKanban, mail: Mail, manual: FolderClosed };

const stateCopy = {
  healthy: { text: "connected", cls: "text-ok" },
  stale: { text: "no sync recently — check connection", cls: "text-warn" },
  failed: { text: "last sync failed", cls: "text-fail" },
} as const;

export function Connectors({
  connectors,
  manualOpen,
  onSync,
}: {
  connectors: Connector[];
  manualOpen: number;
  onSync: (key: string) => void;
}) {
  return (
    <section className="space-y-3">
      <SectionHeading>Source connectors</SectionHeading>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {connectors.map((c) => {
          const Icon = connectorIcons[c.key];
          const s = stateCopy[c.state];
          return (
            <div key={c.key} className="border border-border bg-panel p-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
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
              <div className="mt-4 flex items-center justify-between">
                <Mono className="text-faint">
                  polls {c.intervalLabel} · last {c.lastSyncedMinutes}m ago
                </Mono>
                <button
                  onClick={() => onSync(c.key)}
                  disabled={c.syncing}
                  className="inline-flex items-center gap-1.5 border border-border bg-panel-2 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-ring disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${c.syncing ? "animate-spin" : ""}`} />
                  {c.syncing ? "Syncing…" : "Sync now"}
                </button>
              </div>
            </div>
          );
        })}
        <div className="border border-border border-l-2 border-l-manual bg-panel p-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-sm">
              <FolderClosed className="h-4 w-4 text-manual" strokeWidth={1.75} />
              Manual workflows
            </span>
            <span className="text-[11px] text-manual">always on</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Human-driven approval workflows — no sync required.
          </p>
          <div className="mt-4">
            <Mono className="text-faint">{manualOpen} open manual tasks</Mono>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ActivityFeed({ entries }: { entries: FeedEntry[] }) {
  return (
    <section className="space-y-3">
      <SectionHeading>Sync activity</SectionHeading>
      <div className="max-h-80 overflow-y-auto border border-border bg-panel">
        <ul>
          {entries.map((e) => (
            <li
              key={e.id}
              className={`flex gap-4 border-b border-border px-4 py-2.5 last:border-b-0 ${
                e.fresh ? "feed-enter" : ""
              }`}
            >
              <Mono className="shrink-0 text-faint">{e.at}</Mono>
              <Mono className="w-44 shrink-0 truncate text-muted-foreground">{e.source}</Mono>
              <span className="min-w-0 flex-1 text-xs text-muted-foreground">{e.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
