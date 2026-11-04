import { CheckCircle2, XCircle, Circle, Undo2 } from "lucide-react";
import type { Cp20Gates, Cp20Result, GateState } from "@/lib/api-client";
import { Mono } from "./atoms";
import { Cp20Flows } from "./GithubTrace";

const GATE_ORDER: { key: keyof Cp20Gates; label: string }[] = [
  { key: "protection", label: "Rule on and enforced — PRs required, admins included, force push & deletion blocked" },
  { key: "commits", label: "Every commit since the rule start has a merged PR" },
  { key: "history", label: "No force pushes, deletions or reverted direct pushes" },
  { key: "review", label: "No PR merged by its own author (see #21)" },
];

const OUTCOME: Record<Cp20Result["outcome_id"], { label: string; tone: string; bar: string }> = {
  "CP20-C": { label: "Compliant", tone: "text-ok", bar: "bg-ok" },
  "CP20-CE": { label: "Compliant with exception", tone: "text-ok", bar: "bg-ok" },
  "CP20-OBS": { label: "Observation — passes, but a review gap", tone: "text-warn", bar: "bg-warn" },
  "CP20-NC": { label: "Non-compliant", tone: "text-fail", bar: "bg-fail" },
  "CP20-NE": { label: "Not evidenced — data couldn't be read", tone: "text-muted-foreground", bar: "bg-faint" },
};

const LEVEL_TONE: Record<string, string> = {
  nc: "text-fail",
  not_evidenced: "text-muted-foreground",
  observation: "text-warn",
  exception: "text-ok",
  info: "text-faint",
};

function GateIcon({ state }: { state: GateState }) {
  if (state === "passed") return <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />;
  if (state === "failed") return <XCircle className="h-4 w-4 shrink-0 text-fail" />;
  return <Circle className="h-4 w-4 shrink-0 text-faint" />;
}


const fmt = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

// CP20 stepper, per PRD_Pull_Request_Mandatory.pdf §5: rule → commits → history → review.
export function Cp20Progress({
  gates,
  result,
  onUndo,
}: {
  gates: Cp20Gates;
  result: Cp20Result | null;
  onUndo: () => void;
}) {
  const passed = GATE_ORDER.filter(({ key }) => gates[key] === "passed").length;
  const outcome = result ? OUTCOME[result.outcome_id] : null;

  return (
    <div className="rounded-lg border border-border bg-panel-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-muted-foreground">
          Pull request rule check{result ? ` — ${result.repo}` : ""}
        </p>
        {result && (
          <button
            onClick={onUndo}
            className="inline-flex items-center gap-1 text-[11px] text-faint underline decoration-dotted hover:text-foreground"
          >
            <Undo2 className="h-3 w-3" /> Undo
          </button>
        )}
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full transition-all ${outcome?.bar ?? "bg-ok"}`}
          style={{ width: `${(passed / GATE_ORDER.length) * 100}%` }}
        />
      </div>
      <p className={`mt-1 text-[10px] ${outcome?.tone ?? "text-faint"}`}>
        {outcome ? `${passed}/${GATE_ORDER.length} · ${outcome.label}` : "Not checked yet"}
      </p>

      <div className="mt-2 flex flex-col items-start">
        {GATE_ORDER.map(({ key, label }, i) => (
          <div key={key} className="flex w-full items-stretch gap-2">
            <div className="flex flex-col items-center">
              <GateIcon state={gates[key]} />
              {i < GATE_ORDER.length - 1 && <div className="my-0.5 h-5 w-px bg-border" />}
            </div>
            <span className={`pb-3 text-xs ${gates[key] === "pending" ? "text-faint" : "text-foreground"}`}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {result && (
        <div className="space-y-2 border-t border-border pt-2 text-xs">
          <ul className="space-y-0.5">
            {result.findings.map((f) => (
              <li key={f.text} className={LEVEL_TONE[f.level]}>
                • {f.text}
              </li>
            ))}
          </ul>

          <p className="text-muted-foreground">
            Period from <span className="text-foreground">{fmt(result.period_start)}</span> · rule start{" "}
            <span className="text-foreground">{result.rule_start_date ? fmt(result.rule_start_date) : "not evidenced"}</span>{" "}
            <span className="text-faint">({result.rule_start_source})</span>
          </p>

          {/* Same flows as the GitHub tracking page: branch rule, each PR's trace, each direct push. */}
          <Cp20Flows result={result} />
          {result.evidence_hash && (
            <p className="text-muted-foreground">
              Evidence <Mono className="text-foreground">{result.evidence_file}</Mono> · SHA-256{" "}
              <Mono className="break-all text-faint">{result.evidence_hash}</Mono>
            </p>
          )}
          {result.hash_log_file && (
            <p className="text-muted-foreground">
              Logged as entry #{result.hash_log_entry} in <Mono className="text-foreground">{result.hash_log_file}</Mono>{" "}
              · entry hash <Mono className="text-faint">{result.hash_log_entry_hash?.slice(0, 16)}…</Mono>
            </p>
          )}
          <a href={result.repo_url} target="_blank" rel="noreferrer" className="inline-block text-primary hover:underline">
            Open {result.repo} on GitHub
          </a>
        </div>
      )}
    </div>
  );
}
