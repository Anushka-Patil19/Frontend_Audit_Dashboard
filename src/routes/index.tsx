import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  Cpu,
  FolderClosed,
  TriangleAlert,
  Plug,
  LayoutGrid,
  Table as TableIcon,
  CheckCircle2,
  ShieldCheck,
  GitBranch,
  KeyRound,
  Server,
  Activity,
  ShieldAlert,
  FileText,
  Database,
  LifeBuoy,
  Lock,
  Wrench,
  ChevronRight,
  Check,
  Clock,
  Zap,
  TrendingUp,
  Sparkles,
  Calendar,
  Users,
  FolderKanban,
} from "lucide-react";
import {
  complianceTrend,
  modules,
  statusLabel,
  verificationVolume,
  type Status,
} from "@/lib/audit-data";
import { useAudit } from "@/lib/audit-store";
import { moduleStats } from "@/components/audit/ModuleGrid";
import { Mono, SectionHeading, StatusPill } from "@/components/audit/atoms";
import { PageHeader } from "@/components/layout/PageHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Home — Audit Intelligence" },
      {
        name: "description",
        content:
          "Compliance synopsis with trend analytics, status mix, module scores, connector health and open findings across the audit programme.",
      },
      { property: "og:title", content: "Home — Audit Intelligence" },
      {
        property: "og:description",
        content: "Analytics overview of continuous compliance across automated and manual checks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const statusColor: Record<string, string> = {
  compliant: "var(--ok)",
  "non-compliant": "var(--fail)",
  "needs-review": "var(--warn)",
  "manual-in-progress": "var(--manual)",
  "manual-waiting": "var(--warn)",
};

function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-border bg-panel p-5 shadow-card ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-serif text-base text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "text-foreground",
  to,
  badge,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ElementType;
  tone?: string;
  to?: string;
  badge?: React.ReactNode;
}) {
  const card = (
    <div
      className={`rounded-xl border border-border bg-panel p-4 shadow-card transition-all ${
        to ? "hover:border-primary/50 hover:bg-panel-2/60 cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary-soft">
            <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
          </span>
          <p className="min-w-0 truncate text-xs text-muted-foreground">{label}</p>
        </div>
        {badge}
      </div>
      <p className={`mt-3 font-mono text-2xl ${tone}`}>{value}</p>
      <Mono className="mt-1 block text-faint">{hint}</Mono>
    </div>
  );

  if (to) {
    return <Link to={to}>{card}</Link>;
  }
  return card;
}

const axis = {
  stroke: "var(--faint)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const tooltipStyle = {
  contentStyle: {
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--panel)",
    fontSize: 12,
  },
} as const;

const DOMAIN_MAP: Record<string, { domain: string; icon: React.ElementType }> = {
  // SDLC & Engineering
  "change-management": { domain: "SDLC & Engineering", icon: GitBranch },
  "source-code": { domain: "SDLC & Engineering", icon: FileText },
  "secure-sdlc": { domain: "SDLC & Engineering", icon: ShieldCheck },
  "build-and-release": { domain: "SDLC & Engineering", icon: Cpu },
  testing: { domain: "SDLC & Engineering", icon: CheckCircle2 },
  deployment: { domain: "SDLC & Engineering", icon: Server },

  // Security & Access
  "access-control": { domain: "Security & Access", icon: KeyRound },
  "data-security": { domain: "Security & Access", icon: Lock },
  "patch-management": { domain: "Security & Access", icon: Wrench },

  // Operations & Reliability
  backup: { domain: "Operations & Reliability", icon: Database },
  "disaster-recovery": { domain: "Operations & Reliability", icon: LifeBuoy },
  logging: { domain: "Operations & Reliability", icon: Activity },
  "incident-management": { domain: "Operations & Reliability", icon: ShieldAlert },

  // Governance & Risk
  "application-governance": { domain: "Governance & Risk", icon: FileText },
  "vendor-management": { domain: "Governance & Risk", icon: FolderClosed },
  "business-continuity": { domain: "Governance & Risk", icon: LifeBuoy },
  compliance: { domain: "Governance & Risk", icon: ShieldCheck },
};

function HomePage() {
  const { checkpoints, connectors, feed, countdown } = useAudit();
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const automated = checkpoints.filter((c) => c.kind === "automated");
  const manual = checkpoints.filter((c) => c.kind === "manual");
  const compliant = automated.filter((c) => c.status === "compliant").length;
  const findings = checkpoints.filter(
    (c) => c.status === "non-compliant" || c.status === "needs-review",
  );
  const healthy = connectors.filter((c) => c.state === "healthy").length;
  const overall = Math.round(
    (checkpoints.reduce((sum, c) => {
      if (c.kind === "automated") return sum + (c.status === "compliant" ? 1 : 0);
      return sum + c.steps.filter((s) => s.state === "done").length / c.steps.length;
    }, 0) /
      checkpoints.length) *
      100,
  );

  const statusMix = Object.entries(
    checkpoints.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([status, value]) => ({ status, value }));

  // Executive Stakeholder Metrics
  const nonCompliant = checkpoints.filter((c) => c.status === "non-compliant");
  const needsReview = checkpoints.filter((c) => c.status === "needs-review");
  const criticalBlockersCount = nonCompliant.length;
  const criticalBlockerSample = nonCompliant[0];
  const passingCheckpointsCount = checkpoints.filter(
    (c) => c.status === "compliant" || (c.kind === "manual" && c.steps.every((s) => s.state === "done")),
  ).length;

  // Pending sign-offs by owner name
  const roleOwnerMap: Record<string, string> = {
    Security: "Priya Rao",
    DevOps: "Raj Mehta",
    Developer: "Neha Patil",
    CAB: "Amit Kumar",
    DBA: "Ananya Sharma",
    Infra: "Vikram Singh",
    QA: "Suresh Nair",
    BCM: "Rohan Verma",
  };

  const pendingByOwner = useMemo(() => {
    const counts: Record<string, number> = {};
    checkpoints.forEach((c) => {
      if (c.status === "non-compliant" || c.status === "needs-review" || c.status === "manual-waiting") {
        const ownerName = roleOwnerMap[c.ownerRole] || c.ownerRole;
        counts[ownerName] = (counts[ownerName] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [checkpoints]);

  // Project compliance stats to dynamically identify the least compliant project
  const projectStats = useMemo(() => {
    const pMap: Record<string, { total: number; compliant: number; highBlockers: number }> = {
      "project-a": { total: 0, compliant: 0, highBlockers: 0 },
      "project-b": { total: 0, compliant: 0, highBlockers: 0 },
      "project-c": { total: 0, compliant: 0, highBlockers: 0 },
    };

    checkpoints.forEach((c) => {
      const pid = c.projectId || "project-a";
      if (!pMap[pid]) pMap[pid] = { total: 0, compliant: 0, highBlockers: 0 };
      pMap[pid].total += 1;
      if (c.kind === "automated") {
        if (c.status === "compliant") pMap[pid].compliant += 1;
      } else {
        pMap[pid].compliant += c.steps.filter((s) => s.state === "done").length / c.steps.length;
      }
      if (c.status === "non-compliant") {
        pMap[pid].highBlockers += 1;
      }
    });

    const entries = Object.entries(pMap).map(([id, stats]) => ({
      id,
      name: id === "project-a" ? "PIT Armour" : id === "project-b" ? "SAATHI" : "MPS",
      score: Math.round((stats.compliant / (stats.total || 1)) * 100),
      highBlockers: stats.highBlockers,
    }));

    entries.sort((a, b) => a.score - b.score);
    return entries;
  }, [checkpoints]);

  const leastCompliant = projectStats[0] ?? {
    id: "project-a",
    name: "PIT Armour",
    score: 79,
    highBlockers: 1,
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Home"
        subtitle="Compliance synopsis across every module, worker and manual workflow — Acme Capital"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {/* KPI 1: Overall Compliance */}
        <KpiCard
          label="Overall Compliance"
          value={`${overall}%`}
          hint="+4% vs last month"
          icon={ArrowUpRight}
          tone="text-ok"
          badge={
            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              Live
            </span>
          }
        />

        {/* KPI 2: Audited Projects */}
        <KpiCard
          label="Audited Projects"
          value="3 Active"
          hint="3/3 In Sync & Monitored"
          icon={FolderKanban}
          tone="text-foreground"
          to="/projects"
          badge={
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono text-primary font-semibold">
              In Sync
            </span>
          }
        />

        {/* KPI 3: Least Compliant */}
        <KpiCard
          label="Least Compliant"
          value={leastCompliant.name}
          hint={`${leastCompliant.score}% · ${leastCompliant.highBlockers > 0 ? `${leastCompliant.highBlockers} High Severity Blocker` : "Needs Review"}`}
          icon={ShieldAlert}
          tone="text-fail font-semibold"
          to={`/findings?project=${leastCompliant.id}`}
          badge={
            <span className="rounded-full bg-fail/15 text-fail dark:text-rose-400 px-1.5 py-0.5 text-[10px] font-mono font-semibold">
              Priority Fix
            </span>
          }
        />

        {/* KPI 4: Open Findings */}
        <KpiCard
          label="Open Findings"
          value={`${findings.length} Issues`}
          hint={`${criticalBlockersCount} High · ${needsReview.length} Normal Reviews`}
          icon={TriangleAlert}
          tone="text-fail"
          to="/findings"
          badge={
            <span className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-mono font-semibold">
              Action Req
            </span>
          }
        />

        {/* KPI 5: Checkpoints Verified */}
        <KpiCard
          label="Checkpoints Verified"
          value={`${compliant}/${automated.length}`}
          hint={`Verified by Workers · ${manual.length} Manual`}
          icon={Cpu}
          tone="text-foreground"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Compliance trend" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={complianceTrend} margin={{ left: -20, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="fillCompliance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" {...axis} />
                <YAxis domain={[40, 100]} {...axis} />
                <Tooltip {...tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="compliance"
                  name="Compliance %"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#fillCompliance)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Checkpoint status mix">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusMix}
                  dataKey="value"
                  nameKey="status"
                  innerRadius={58}
                  outerRadius={86}
                  paddingAngle={2}
                >
                  {statusMix.map((s) => (
                    <Cell key={s.status} fill={statusColor[s.status]} stroke="var(--panel)" />
                  ))}
                </Pie>
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v: number, n: string) => [v, statusLabel[n as Status]]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5">
            {statusMix.map((s) => (
              <li key={s.status} className="flex items-center justify-between text-xs">
                <StatusPill status={s.status as Status} />
                <Mono className="text-muted-foreground">{s.value}</Mono>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Verification volume — passed vs failed">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={verificationVolume} margin={{ left: -20, right: 8, top: 4 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" {...axis} />
                <YAxis {...axis} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="passed" name="Passed" fill="var(--ok)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="failed" name="Failed" fill="var(--fail)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Open Findings by Owner"
          action={
            <Link to="/findings" className="text-xs text-primary hover:underline font-medium">
              View all findings →
            </Link>
          }
        >
          <p className="mb-3 text-[11px] text-muted-foreground">Which team member owns the remediation</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={pendingByOwner.map(([owner, count]) => ({ owner, count }))}
                layout="vertical"
                margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
              >
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  {...axis}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="owner"
                  width={105}
                  {...axis}
                  tick={{ fontSize: 11, fill: "var(--foreground)" }}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(val: number) => [val, "Open Findings"]}
                  labelFormatter={(label) => `Owner: ${label}`}
                />
                <Bar dataKey="count" name="Open Findings" fill="var(--primary)" radius={[0, 4, 4, 0]}>
                  {pendingByOwner.map(([owner]) => (
                    <Cell
                      key={owner}
                      fill={
                        owner.toLowerCase().includes("priya")
                          ? "var(--fail)"
                          : owner.toLowerCase().includes("raj") || owner.toLowerCase().includes("neha")
                          ? "var(--primary)"
                          : "var(--manual)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground border-t border-border pt-2">
            Owners sorted by open finding count · hover bars for details
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          title="Open findings"
          className="xl:col-span-2"
          action={
            <Link to="/findings" className="text-xs text-primary hover:underline font-medium">
              View all findings →
            </Link>
          }
        >
          <ul className="divide-y divide-border">
            {findings.map((f) => (
              <li key={f.id} className="group flex flex-wrap items-center gap-3 py-2.5 hover:bg-panel-2/50 px-1 rounded transition-colors">
                <StatusPill status={f.status} />
                <Mono className="text-faint">{f.ref}</Mono>
                <Link to="/findings" className="min-w-0 flex-1 truncate text-sm text-foreground hover:text-primary transition-colors">
                  {f.name}
                </Link>
                <Mono className="text-muted-foreground">{f.category}</Mono>
              </li>
            ))}
            {findings.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                No open findings — everything is verified.
              </li>
            )}
          </ul>
        </Panel>

        <Panel
          title="Latest activity"
          action={
            <Link to="/activity" className="text-xs text-primary hover:underline">
              View all
            </Link>
          }
        >
          <ul className="space-y-3">
            {feed.slice(0, 5).map((e) => (
              <li key={e.id} className={e.fresh ? "feed-enter" : ""}>
                <Mono className="text-faint">
                  {e.at} · {e.source}
                </Mono>
                <p className="mt-0.5 text-xs text-muted-foreground">{e.text}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* REDESIGNED MODULES & COMPLIANCE PILLARS SECTION */}
      {(() => {
        const modulesWithStats = modules.map((m) => {
          const stats = moduleStats(checkpoints, m.key);
          const domainInfo = DOMAIN_MAP[m.key] ?? {
            domain: "Other",
            icon: FolderClosed,
          };
          return {
            ...m,
            stats,
            domain: domainInfo.domain,
            Icon: domainInfo.icon,
          };
        });

        const attentionCount = modulesWithStats.filter(
          (m) => m.stats.attention > 0 || m.stats.pct < 80,
        ).length;

        const domainTabs = [
          { key: "all", label: "All Categories", count: modules.length },
          { key: "SDLC & Engineering", label: "SDLC & Engineering", count: 6 },
          { key: "Security & Access", label: "Security & Access", count: 3 },
          { key: "Operations & Reliability", label: "Operations", count: 4 },
          { key: "Governance & Risk", label: "Governance & Risk", count: 4 },
          {
            key: "attention",
            label: "Needs Attention",
            count: attentionCount,
            highlight: attentionCount > 0,
          },
        ];

        const filteredModules = modulesWithStats.filter((m) => {
          if (selectedDomain === "all") return true;
          if (selectedDomain === "attention") return m.stats.attention > 0 || m.stats.pct < 80;
          return m.domain === selectedDomain;
        });

        return (
          <div className="space-y-4">
            {/* Section Header with View Mode Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <SectionHeading>
                  Compliance Categories & Modules <Mono className="text-faint">({filteredModules.length})</Mono>
                </SectionHeading>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Live verification status across software engineering, access controls, operations, and governance.
                </p>
              </div>

              {/* View Toggle */}
              <div className="inline-flex rounded-lg border border-border bg-panel p-1 shadow-sm">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    viewMode === "grid"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Visual Card Grid"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>Grid</span>
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    viewMode === "table"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Executive Scorecard Table"
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  <span>Table</span>
                </button>
              </div>
            </div>

            {/* Domain Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {domainTabs.map((tab) => {
                const active = selectedDomain === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setSelectedDomain(tab.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      active
                        ? tab.highlight
                          ? "bg-warn text-white shadow-sm"
                          : "bg-primary text-primary-foreground shadow-sm"
                        : tab.highlight && tab.count > 0
                        ? "border border-warn/40 bg-warn/10 text-warn hover:bg-warn/20"
                        : "border border-border bg-panel text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                        active ? "bg-white/20 text-white" : "bg-panel-2 text-faint"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* VIEW 1: Modern Card Grid */}
            {viewMode === "grid" && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredModules.map((m) => {
                  const { stats, domain, Icon } = m;
                  const isAttention = stats.attention > 0 || stats.pct < 80;
                  const scoreTone =
                    stats.pct >= 80 ? "text-ok" : stats.pct >= 60 ? "text-warn" : "text-fail";
                  const barTone =
                    stats.pct >= 80 ? "bg-ok" : stats.pct >= 60 ? "bg-warn" : "bg-fail";

                  return (
                    <Link
                      key={m.key}
                      to="/projects"
                      search={{ project: "project-a" }}
                      className={`group relative flex flex-col justify-between rounded-xl border p-4 shadow-card transition-all hover:border-primary/50 hover:shadow-panel ${
                        isAttention
                          ? "border-warn/30 bg-panel hover:border-warn/60"
                          : "border-border bg-panel"
                      }`}
                    >
                      <div>
                        {/* Header: Icon + Domain tag + Status badge */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-soft text-primary transition-transform group-hover:scale-105">
                              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </span>
                            <span className="text-[10px] font-medium uppercase tracking-wider text-faint">
                              {domain}
                            </span>
                          </div>

                          {stats.attention > 0 ? (
                            <span className="rounded-full bg-warn/10 px-2 py-0.5 text-[10px] font-medium text-warn">
                              {stats.attention} finding{stats.attention > 1 ? "s" : ""}
                            </span>
                          ) : stats.pct === 100 ? (
                            <span className="rounded-full bg-ok/10 px-2 py-0.5 text-[10px] font-medium text-ok inline-flex items-center gap-0.5">
                              <Check className="h-2.5 w-2.5" /> 100%
                            </span>
                          ) : (
                            <span className="rounded-full bg-ok/10 px-2 py-0.5 text-[10px] font-medium text-ok">
                              healthy
                            </span>
                          )}
                        </div>

                        {/* Title & Description */}
                        <h3 className="mt-3 font-serif text-base font-medium text-foreground group-hover:text-primary transition-colors">
                          {m.name}
                        </h3>
                        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {m.description}
                        </p>
                      </div>

                      {/* Score & Progress Bar */}
                      <div className="mt-4 pt-3 border-t border-border/70">
                        <div className="flex items-baseline justify-between">
                          <span className={`font-mono text-xl font-semibold ${scoreTone}`}>
                            {stats.pct}%
                          </span>
                          <Mono className="text-[11px] text-faint">
                            {stats.items.length} checks
                          </Mono>
                        </div>

                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-accent">
                          <span
                            className={`block h-full rounded-full transition-all ${barTone}`}
                            style={{ width: `${stats.pct}%` }}
                          />
                        </div>

                        {/* Footer breakdown */}
                        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>
                            {stats.automated.length} auto · {stats.manual.length} manual
                          </span>
                          <span className="font-medium text-primary opacity-0 transition-all group-hover:opacity-100 flex items-center gap-0.5">
                            Open <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* VIEW 2: Executive Scorecard Table */}
            {viewMode === "table" && (
              <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-panel-2 font-mono text-[11px] text-muted-foreground">
                        <th className="px-4 py-3">Category & Scope</th>
                        <th className="px-4 py-3">Domain</th>
                        <th className="px-4 py-3 w-44">Compliance Score</th>
                        <th className="px-4 py-3">Breakdown</th>
                        <th className="px-4 py-3">Health Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredModules.map((m) => {
                        const { stats, domain, Icon } = m;
                        const scoreTone =
                          stats.pct >= 80 ? "text-ok" : stats.pct >= 60 ? "text-warn" : "text-fail";
                        const barTone =
                          stats.pct >= 80 ? "bg-ok" : stats.pct >= 60 ? "bg-warn" : "bg-fail";

                        return (
                          <tr
                            key={m.key}
                            className="group hover:bg-panel-2/50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                                  <Icon className="h-3.5 w-3.5" />
                                </span>
                                <div>
                                  <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                                    {m.name}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-sm">
                                    {m.description}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <span className="rounded-full bg-panel-2 px-2.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border">
                                {domain}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                <div className="flex items-baseline justify-between font-mono text-xs">
                                  <span className={`font-semibold ${scoreTone}`}>{stats.pct}%</span>
                                  <span className="text-[10px] text-faint">
                                    {stats.items.length} checks
                                  </span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
                                  <span
                                    className={`block h-full rounded-full ${barTone}`}
                                    style={{ width: `${stats.pct}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                              {stats.automated.length} auto · {stats.manual.length} manual
                            </td>

                            <td className="px-4 py-3">
                              {stats.attention > 0 ? (
                                <span className="rounded-full bg-warn/10 px-2 py-0.5 text-[11px] font-medium text-warn inline-flex items-center gap-1">
                                  <TriangleAlert className="h-3 w-3" />
                                  {stats.attention} open finding{stats.attention > 1 ? "s" : ""}
                                </span>
                              ) : (
                                <span className="rounded-full bg-ok/10 px-2 py-0.5 text-[11px] font-medium text-ok inline-flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Verified
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-right">
                              <Link
                                to="/projects"
                                search={{ project: "project-a" }}
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                              >
                                Open ledger →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
