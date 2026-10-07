import { useMemo, useState } from "react";
import { Route as RouteIcon } from "lucide-react";
import { Mono } from "@/components/audit/atoms";
import { PageHeader } from "@/components/layout/PageHeader";
import { DevKpis } from "@/components/developer/DevKpis";
import { ActionBell } from "@/components/developer/ActionBell";
import { FixThese, MyActivity, ProjectRules, WaitingOnOthers } from "@/components/developer/DevSections";
import { useAudit } from "@/lib/audit-store";
import { useRole } from "@/lib/role-store";
import { DEV_PERSONA as DEV, buildDeveloperView, type DevActivity } from "@/lib/developer-data";

// Developer view. KPIs, the bell and the four lower sections are interactive; the journey
// tracker is still a placeholder. "Re-check" on mock items marks them fixed for this session
// (so the bell and KPIs update); live items (#10, #18, #38) change only via the real workflows.

function Section({
  title,
  icon: Icon,
  note,
  children,
}: {
  title: string;
  icon: React.ElementType;
  note: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-panel p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary-soft">
          <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
        </span>
        <h2 className="font-serif text-base text-foreground">{title}</h2>
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
      {children}
    </section>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-border bg-panel-2/40 px-4 py-6 text-center">
      <Mono className="text-faint">{text}</Mono>
    </div>
  );
}

export function DeveloperDashboard() {
  const { checkpoints, feed, clock } = useAudit();
  const { invite } = useRole();
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [local, setLocal] = useState<DevActivity[]>([]);

  const view = useMemo(() => buildDeveloperView(checkpoints, resolved), [checkpoints, resolved]);

  const log = (text: string) =>
    setLocal((l) => [{ id: `local-${Date.now()}-${l.length}`, at: `Today ${clock}`, kind: "you", text }, ...l]);
  const resolve = (id: string) => setResolved((s) => new Set(s).add(id));
  const undo = (id: string) =>
    setResolved((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="My work"
        subtitle={`${invite?.projectName ?? DEV.project} · signed in as ${invite?.email ?? DEV.name} (Developer) — only the processes you own or touch`}
        trailing={<ActionBell view={view} />}
      />

      <DevKpis view={view} />

      <Section
        title="My changes — journey"
        icon={RouteIcon}
        note="One tracker per change: CR approved → impact & rollback → branch → PR & review → scans → merged by the right person → CAB → deploy → UAT sign-off."
      >
        <Placeholder text="Step 3 — journey tracker per CR / PR" />
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FixThese view={view} onResolve={resolve} onUndo={undo} onLog={log} />
        <WaitingOnOthers view={view} onLog={log} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProjectRules />
        <MyActivity feed={feed} local={local} />
      </div>
    </div>
  );
}
