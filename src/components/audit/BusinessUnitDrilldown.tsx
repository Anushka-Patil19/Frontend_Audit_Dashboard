import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import {
  ChevronRight,
  ArrowLeft,
  Building2,
  Layers,
  ExternalLink,
  PieChart as PieIcon,
  BarChart3,
} from "lucide-react";
import { complianceHierarchy } from "@/lib/compliance-hierarchy";

export type DrilldownLevel = "business" | "controlArea" | "project";
export type ChartType = "pie" | "bar";

// Maps project names in the hierarchy to their route IDs on the Projects page
const PROJECT_ROUTE_ID: Record<string, string> = {
  "PIT Armour": "project-a",
  "Project Alpha": "project-a",
  "Project Beta": "project-b",
  "Project Gamma": "project-c",
  "InsureCore": "project-a",
  "Claims Engine": "project-b",
  "Underwriting Portal": "project-c",
  "Merchant Gateway": "project-a",
  "Payment Switch": "project-b",
  "Settlement Engine": "project-c",
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function barFill(score: number) {
  if (score >= 85) return "var(--ok)";
  if (score >= 75) return "var(--primary)";
  return "var(--fail)";
}

function scoreToneClass(score: number) {
  if (score >= 85) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 75) return "text-primary";
  return "text-rose-600 dark:text-rose-400";
}

const chartAxis = {
  stroke: "var(--faint)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

// ─── Custom Clickable Tooltip ─────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, isProjectLevel }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const name = label || item?.name;
  const score = item?.value;
  const hint = item?.payload?.hint;
  return (
    <div className="rounded-lg border border-border bg-panel px-3.5 py-2.5 shadow-panel text-xs min-w-[170px] z-50">
      <p className="font-semibold text-foreground mb-1">{name}</p>
      <p className={`font-mono text-lg font-bold ${scoreToneClass(score)}`}>
        {score}%
      </p>
      {hint && <p className="text-muted-foreground mt-1 text-[11px]">{hint}</p>}
      <p className="text-primary mt-2 flex items-center gap-1 font-medium text-[11px]">
        {isProjectLevel ? (
          <>
            Open in Projects <ExternalLink className="h-3 w-3" />
          </>
        ) : (
          <>
            Click to drill down <ChevronRight className="h-3 w-3" />
          </>
        )}
      </p>
    </div>
  );
}

// ─── Chart Data Interface ──────────────────────────────────────────────────

interface ChartRow {
  name: string;
  score: number;
  hint?: string | undefined;
}

// ─── 1. Pie / Donut Chart View ─────────────────────────────────────────────

function DrilldownPieChart({
  data,
  onSliceClick,
  centerScore,
  centerLabel,
  isProjectLevel = false,
}: {
  data: ChartRow[];
  onSliceClick: (name: string) => void;
  centerScore?: number;
  centerLabel?: string;
  isProjectLevel?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const avgScore =
    centerScore ??
    Math.round(data.reduce((sum, d) => sum + d.score, 0) / (data.length || 1));

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center min-h-[220px]">
      {/* Donut Chart with Center Metric */}
      <div className="md:col-span-5 relative flex items-center justify-center h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="score"
              nameKey="name"
              innerRadius={50}
              outerRadius={78}
              paddingAngle={3}
              onClick={(entry: any) => {
                if (entry?.name) onSliceClick(entry.name);
              }}
              onMouseEnter={(_: any, index: number) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              style={{ cursor: "pointer" }}
            >
              {data.map((entry, index) => {
                const isHovered = activeIndex === index;
                return (
                  <Cell
                    key={`pie-${entry.name}`}
                    fill={barFill(entry.score)}
                    stroke="var(--panel)"
                    strokeWidth={2}
                    opacity={activeIndex === null || isHovered ? 1 : 0.45}
                    style={{
                      transform: isHovered ? "scale(1.04)" : "scale(1)",
                      transformOrigin: "center center",
                      transition: "transform 0.2s ease, opacity 0.2s ease",
                    }}
                  />
                );
              })}
            </Pie>
            <Tooltip content={<CustomTooltip isProjectLevel={isProjectLevel} />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Score inside Donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className={`font-mono text-xl font-bold leading-none ${scoreToneClass(avgScore)}`}>
            {avgScore}%
          </span>
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">
            {centerLabel ?? "Avg"}
          </span>
        </div>
      </div>

      {/* Interactive Legend Breakdown */}
      <div className="md:col-span-7 space-y-2">
        {data.map((entry, index) => {
          const isHovered = activeIndex === index;
          return (
            <div
              key={entry.name}
              onClick={() => onSliceClick(entry.name)}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSliceClick(entry.name);
              }}
              className={`group flex items-center justify-between gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${
                isHovered
                  ? "border-primary/50 bg-panel-2 shadow-xs"
                  : "border-border/80 bg-panel-2/30 hover:bg-panel-2/60 hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: barFill(entry.score) }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {entry.name}
                  </p>
                  {entry.hint && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {entry.hint}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={`font-mono text-xs font-bold ${scoreToneClass(entry.score)}`}>
                  {entry.score}%
                </span>
                {isProjectLevel ? (
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 2. Bar Chart View ─────────────────────────────────────────────────────

function DrilldownBarChart({
  data,
  onBarClick,
  activeBar,
  isProjectLevel = false,
  height = 220,
}: {
  data: ChartRow[];
  onBarClick: (name: string) => void;
  activeBar?: string | null;
  isProjectLevel?: boolean;
  height?: number;
}) {
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 0, right: 48, top: 8, bottom: 8 }}
        onClick={(e: any) => {
          if (e?.activePayload?.[0]?.payload?.name) {
            onBarClick(e.activePayload[0].payload.name);
          }
        }}
        style={{ cursor: "pointer" }}
      >
        <CartesianGrid stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          unit="%"
          {...chartAxis}
          tick={{ fontSize: 10, fill: "var(--faint)" }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          {...chartAxis}
          tick={{ fontSize: 11, fill: "var(--foreground)", fontWeight: 500 }}
        />
        <Tooltip
          content={<CustomTooltip isProjectLevel={isProjectLevel} />}
          cursor={{ fill: "var(--primary)", opacity: 0.06 }}
        />
        <ReferenceLine
          x={80}
          stroke="var(--ok)"
          strokeDasharray="4 3"
          strokeOpacity={0.6}
          label={{
            value: "Target 80%",
            position: "top",
            fill: "var(--ok)",
            fontSize: 9,
            fontWeight: 600,
          }}
        />
        <Bar
          dataKey="score"
          radius={[0, 6, 6, 0]}
          maxBarSize={28}
          onMouseEnter={(d: any) => setHoveredBar(d.name)}
          onMouseLeave={() => setHoveredBar(null)}
        >
          <LabelList
            dataKey="score"
            position="right"
            formatter={(v: number) => `${v}%`}
            style={{ fontSize: 11, fontWeight: 700, fill: "var(--foreground)" }}
          />
          {data.map((entry) => {
            const isHovered = hoveredBar === entry.name;
            const isActive = activeBar === entry.name;
            return (
              <Cell
                key={entry.name}
                fill={barFill(entry.score)}
                opacity={
                  activeBar
                    ? isActive
                      ? 1
                      : 0.35
                    : isHovered
                    ? 1
                    : 0.85
                }
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BusinessUnitDrilldown() {
  const navigate = useNavigate();
  const [drilldownLevel, setDrilldownLevel] = useState<DrilldownLevel>("business");
  const [chartType, setChartType] = useState<ChartType>("pie");
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);
  const [selectedControlArea, setSelectedControlArea] = useState<string | null>(null);

  const currentBusiness = selectedBusiness ? complianceHierarchy[selectedBusiness] : undefined;
  const currentControlArea = currentBusiness && selectedControlArea
    ? currentBusiness.controlAreas[selectedControlArea]
    : undefined;

  // ── Chart Data per level ─────────────────────────────────────────────────

  const buChartData = useMemo<ChartRow[]>(() =>
    Object.values(complianceHierarchy).map((bu) => ({
      name: bu.name,
      score: bu.compliance,
      hint: bu.description,
    })),
  []);

  const controlAreaChartData = useMemo<ChartRow[]>(() => {
    if (!currentBusiness) return [];
    return Object.values(currentBusiness.controlAreas).map((ca) => ({
      name: ca.name,
      score: ca.compliance,
      hint: `${Object.keys(ca.projects).length} projects monitored`,
    }));
  }, [currentBusiness]);

  const projectChartData = useMemo<ChartRow[]>(() => {
    if (!currentControlArea) return [];
    return Object.values(currentControlArea.projects).map((proj) => ({
      name: proj.name,
      score: proj.compliance,
      hint: `${proj.checkpoints.length} checkpoints · Click to open Projects Page`,
    }));
  }, [currentControlArea]);

  // ── Navigation ────────────────────────────────────────────────────────────

  const handleSelectBusiness = (name: string) => {
    setSelectedBusiness(name);
    setSelectedControlArea(null);
    setDrilldownLevel("controlArea");
  };

  const handleSelectControlArea = (name: string) => {
    setSelectedControlArea(name);
    setDrilldownLevel("project");
  };

  const handleSelectProject = (name: string) => {
    const projectId = PROJECT_ROUTE_ID[name] ?? "project-a";
    navigate({ to: "/projects", search: { project: projectId } });
  };

  const handleBack = () => {
    if (drilldownLevel === "project") {
      setSelectedControlArea(null);
      setDrilldownLevel("controlArea");
    } else if (drilldownLevel === "controlArea") {
      setSelectedBusiness(null);
      setDrilldownLevel("business");
    }
  };

  const handleReset = () => {
    setSelectedBusiness(null);
    setSelectedControlArea(null);
    setDrilldownLevel("business");
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const isDrilldown = drilldownLevel !== "business";

  const levelLabel = {
    business: "Business Unit",
    controlArea: selectedBusiness ?? "Control Area",
    project: selectedControlArea ?? "Control Area",
  }[drilldownLevel];

  const currentScore =
    drilldownLevel === "controlArea" ? currentBusiness?.compliance :
    drilldownLevel === "project" ? currentControlArea?.compliance :
    undefined;

  return (
    <section className="rounded-xl border border-border bg-panel p-5 shadow-card flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
            <Building2 className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-serif text-base font-medium text-foreground leading-tight">
              Compliance by Business Unit
            </h2>

            {/* Breadcrumb */}
            <nav className="mt-0.5 flex flex-wrap items-center gap-1 text-xs">
              <button
                onClick={handleReset}
                className={`transition-colors cursor-pointer ${
                  drilldownLevel === "business"
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                All Businesses
              </button>
              {selectedBusiness && (
                <>
                  <ChevronRight className="h-3 w-3 text-faint" />
                  <button
                    onClick={() => { setSelectedControlArea(null); setDrilldownLevel("controlArea"); }}
                    className={`transition-colors cursor-pointer ${
                      drilldownLevel === "controlArea"
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    {selectedBusiness}
                  </button>
                </>
              )}
              {selectedControlArea && (
                <>
                  <ChevronRight className="h-3 w-3 text-faint" />
                  <span className="font-semibold text-foreground">{selectedControlArea}</span>
                </>
              )}
            </nav>
          </div>
        </div>

        {/* Right side: score, chart switcher + back button */}
        <div className="flex items-center gap-2.5">
          {currentScore !== undefined && (
            <div className="text-right mr-1">
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide">
                {levelLabel} Score
              </p>
              <p className={`font-mono text-xl font-bold leading-tight ${scoreToneClass(currentScore)}`}>
                {currentScore}%
              </p>
            </div>
          )}

          {/* Chart Type Toggle: Pie / Donut vs Bar */}
          <div className="inline-flex rounded-lg border border-border bg-panel-2 p-0.5 text-xs">
            <button
              onClick={() => setChartType("pie")}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-all cursor-pointer ${
                chartType === "pie"
                  ? "bg-panel text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Donut / Pie View"
            >
              <PieIcon className="h-3.5 w-3.5" />
              <span>Pie</span>
            </button>
            <button
              onClick={() => setChartType("bar")}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-all cursor-pointer ${
                chartType === "bar"
                  ? "bg-panel text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Bar Chart View"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Bar</span>
            </button>
          </div>

          {isDrilldown && (
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-panel-2 px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/50 hover:bg-panel transition-all cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
              Back
            </button>
          )}
        </div>
      </div>

      {/* ── Chart Body ── */}
      <div>

        {/* LEVEL 1 — Business Unit Chart */}
        {drilldownLevel === "business" && (
          <div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Click any Business Unit segment or item to inspect Control Areas
            </p>
            {chartType === "pie" ? (
              <DrilldownPieChart
                data={buChartData}
                onSliceClick={handleSelectBusiness}
                centerLabel="Portfolio"
              />
            ) : (
              <DrilldownBarChart
                data={buChartData}
                onBarClick={handleSelectBusiness}
                height={Math.max(160, buChartData.length * 58)}
              />
            )}
          </div>
        )}

        {/* LEVEL 2 — Control Area Chart */}
        {drilldownLevel === "controlArea" && currentBusiness && (
          <div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Click a Control Area segment to see its monitored software projects
            </p>
            {chartType === "pie" ? (
              <DrilldownPieChart
                data={controlAreaChartData}
                onSliceClick={handleSelectControlArea}
                centerScore={currentBusiness.compliance}
                centerLabel={currentBusiness.name}
              />
            ) : (
              <DrilldownBarChart
                data={controlAreaChartData}
                onBarClick={handleSelectControlArea}
                height={Math.max(160, controlAreaChartData.length * 58)}
              />
            )}
          </div>
        )}

        {/* LEVEL 3 — Project Chart with Redirection to Projects Page */}
        {drilldownLevel === "project" && currentControlArea && (
          <div>
            <p className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1">
              <span>Click a project to open its complete ledger in the Projects Page</span>
              <ExternalLink className="h-3 w-3 text-primary" />
            </p>
            {chartType === "pie" ? (
              <DrilldownPieChart
                data={projectChartData}
                onSliceClick={handleSelectProject}
                centerScore={currentControlArea.compliance}
                centerLabel="Area Score"
                isProjectLevel={true}
              />
            ) : (
              <DrilldownBarChart
                data={projectChartData}
                onBarClick={handleSelectProject}
                isProjectLevel={true}
                height={Math.max(160, projectChartData.length * 58)}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-primary shrink-0" />
          <span className="font-mono text-faint">
            Business Unit → Control Area → Projects Page
          </span>
        </span>
        {isDrilldown && (
          <button
            onClick={handleReset}
            className="text-primary hover:underline cursor-pointer transition-colors"
          >
            Reset to All Businesses
          </button>
        )}
      </div>
    </section>
  );
}
