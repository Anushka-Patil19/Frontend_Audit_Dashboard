import { useState } from "react";
import { Github, Mail, FolderClosed, SquareKanban, ImageIcon } from "lucide-react";
import type { SourceKey, Status } from "@/lib/audit-data";
import { statusLabel, statusTone } from "@/lib/audit-data";
import { getCp10EvidenceScreenshot, getCp38EvidenceScreenshot } from "@/lib/api-client";

export const tone = {
  ok: { text: "text-ok", bg: "bg-ok", border: "border-l-ok" },
  fail: { text: "text-fail", bg: "bg-fail", border: "border-l-fail" },
  warn: { text: "text-warn", bg: "bg-warn", border: "border-l-warn" },
  manual: { text: "text-manual", bg: "bg-manual", border: "border-l-manual" },
} as const;

export function StatusDot({ status, className = "" }: { status: Status; className?: string }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${tone[statusTone[status]].bg} ${className}`}
    />
  );
}

export function StatusPill({ status }: { status: Status }) {
  const t = tone[statusTone[status]];
  return (
    <span className={`inline-flex items-center gap-2 text-xs ${t.text}`}>
      <StatusDot status={status} />
      {statusLabel[status]}
    </span>
  );
}

const icons = { github: Github, jira: SquareKanban, mail: Mail, manual: FolderClosed };

export function SourceBadge({ sources, label }: { sources: SourceKey[]; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-panel-2 px-2 py-0.5 text-[11px] text-muted-foreground">
      {sources.map((s) => {
        const Icon = icons[s];
        return <Icon key={s} className="h-3 w-3" strokeWidth={1.75} />;
      })}
      {label}
    </span>
  );
}

export function Mono({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`font-mono text-[11px] ${className}`}>{children}</span>;
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif text-lg text-foreground">{children}</h2>;
}

// Lazily fetched on click rather than eagerly — the screenshot is only ever
// needed when someone actually wants to inspect the evidence. Shared by CP10
// (CAB approval, mail + Jira screenshots) and CP38 (UAT sign-off, mail
// screenshot only), reused across the copilot chat, the CP10 gate panel, and
// the ledger's "View evidence" panel.
export function EvidenceScreenshot({
  fileName,
  source,
  label = "View approval email screenshot",
  alt = "Screenshot of the approved email",
}: {
  fileName: string;
  source: "cp10" | "cp38";
  label?: string;
  alt?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const load = async () => {
    setState("loading");
    const getScreenshot = source === "cp10" ? getCp10EvidenceScreenshot : getCp38EvidenceScreenshot;
    const res = await getScreenshot({ data: { fileName } });
    if (!res) {
      setState("error");
      return;
    }
    setDataUrl(res.dataUrl);
    setState("idle");
  };

  if (dataUrl) {
    return (
      <a href={dataUrl} target="_blank" rel="noreferrer" className="mt-2 block">
        <img
          src={dataUrl}
          alt={alt}
          className="max-h-64 w-full rounded border border-border object-contain object-left-top"
        />
      </a>
    );
  }

  return (
    <button
      onClick={load}
      disabled={state === "loading"}
      className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-manual hover:underline disabled:opacity-50"
    >
      <ImageIcon className="h-3.5 w-3.5" />
      {state === "loading"
        ? "Loading screenshot…"
        : state === "error"
          ? "Screenshot unavailable — click to retry"
          : label}
    </button>
  );
}

export function HistoryStrip({ items }: { items: { at: string; text: string }[] }) {
  return (
    <div className="border-t border-border pt-3">
      <p className="mb-2 text-[11px] text-faint">History</p>
      <ul className="space-y-1">
        {items.slice(-3).map((h, i) => (
          <li key={i} className="text-xs text-muted-foreground">
            <Mono className="text-faint">{h.at}</Mono> — {h.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
