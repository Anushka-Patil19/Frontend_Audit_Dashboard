import { useState } from "react";
import { Download, Send, ShieldCheck } from "lucide-react";
import { ncsIn, periodicIn, quarterStats, sevOf, crById } from "@/data/api";
import { PROJECTS, checkpointById, projectById } from "@/data/catalog";
import { CTO, PEOPLE, TEAMS, person } from "@/data/people";
import { fmtDate, fmtDateTime, fullLabel, isCustomKey, previousQuarter, quarterByKey } from "@/data/quarters";
import { summariseQuarter } from "@/data/copilot";
import { useReview } from "@/state/review";
import { useQuarter } from "@/state/quarter";
import { Card, Empty, Mono } from "@/components/ui";
import { EvidenceCard } from "@/components/Evidence";
import { Dialog, Field, btnGhost, btnPrimary, inputCls } from "@/components/Dialog";
import type { QuarterKey, ReportRecord, ReportSection } from "@/data/types";

const SECTIONS: { id: ReportSection; label: string }[] = [
  { id: "summary", label: "Executive summary" },
  { id: "projects", label: "Scores by project" },
  { id: "register", label: "NC register" },
  { id: "observations", label: "Observations and management responses" },
  { id: "exceptions", label: "Exceptions" },
  { id: "carried", label: "Carried forward to next quarter" },
  { id: "after-period", label: "Remediated after the period" },
  { id: "periodic", label: "Periodic controls" },
  { id: "evidence", label: "Evidence index" },
  { id: "signoff", label: "Sign-off" },
];

export function Reports() {
  const [q] = useQuarter();
  const r = useReview();
  const state = r.quarterState(q);
  const signoff = r.signoffOf(q);
  const [sections, setSections] = useState<ReportSection[]>(SECTIONS.map((s) => s.id));
  const [coverNote, setCoverNote] = useState("");
  const [includeEvidence, setIncludeEvidence] = useState(false);
  const [sending, setSending] = useState<ReportRecord | null>(null);
  const final = state === "signed-off";
  const documentId = final ? signoff!.documentId : `AR-${q}-DRAFT`;
  const history = r.reports.filter((x) => x.quarter === q);

  const generate = () => r.saveReport({ quarter: q, documentId, final, sections, coverNote, includeEvidence });

  if (state === "open") return <Empty text={`${fullLabel(q)} is still open. Reports can be drafted after it ends.`} />;

  return (
    <div className="space-y-6">
      <header className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Reports</p>
          <h1 className="mt-1 font-serif text-3xl">{fullLabel(q)} audit report</h1>
          <p className="mt-1 text-sm text-muted-foreground">{final ? `Final: signed off ${fmtDate(signoff!.at)} · ${documentId}` : `Draft: ${isCustomKey(q) ? "this period" : "the quarter"} is not signed off yet, so the report is watermarked DRAFT.`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnGhost} onClick={() => { generate(); setTimeout(() => window.print(), 50); }}><Download className="h-4 w-4" /> Download PDF</button>
          <button type="button" className={btnPrimary} onClick={() => setSending(generate())}><Send className="h-4 w-4" /> Generate and send</button>
        </div>
      </header>

      <div className="report-grid grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="no-print space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card title="Build the report" note="Choose what goes in. The preview updates as you change it.">
            <ul className="space-y-1.5">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={sections.includes(s.id)} onChange={(e) => setSections((x) => (e.target.checked ? SECTIONS.map((y) => y.id).filter((id) => x.includes(id) || id === s.id) : x.filter((id) => id !== s.id)))} />
                    {s.label}
                  </label>
                </li>
              ))}
            </ul>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeEvidence} onChange={(e) => setIncludeEvidence(e.target.checked)} />
              Include evidence snapshots
            </label>
            <div className="mt-3">
              <Field label="Cover note" htmlFor="cover"><textarea id="cover" rows={4} className={inputCls} value={coverNote} onChange={(e) => setCoverNote(e.target.value)} placeholder="Shown on the first page" /></Field>
            </div>
            <p className="mt-2 text-[11px] text-faint">Download PDF opens the print dialog: choose "Save as PDF". The text stays selectable.</p>
          </Card>
          <Card title="Report history" note="Every report generated and sent.">
            {history.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
              <ul className="space-y-2 text-sm">
                {history.map((h) => (
                  <li key={h.id} className="rounded-md border border-border p-2">
                    <p><Mono>{h.documentId}</Mono> <span className={h.final ? "text-ok" : "text-warn"}>{h.final ? "final" : "draft"}</span></p>
                    <p className="text-xs text-muted-foreground">Generated {fmtDateTime(h.generatedAt)}</p>
                    <p className="text-xs text-muted-foreground">{h.sentTo.length ? `Sent to ${Array.from(new Set(h.sentTo.map((s) => person(s.personId).name))).join(", ")}` : "Not sent"}</p>
                    <button type="button" className="mt-1 text-xs text-primary underline" onClick={() => setSending(h)}>Send</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <ReportDocument q={q} sections={sections} coverNote={coverNote} includeEvidence={includeEvidence} documentId={documentId} final={final} />
      </div>

      {sending && <SendDialog report={sending} onClose={() => setSending(null)} />}
    </div>
  );
}

function SendDialog({ report, onClose }: { report: ReportRecord; onClose: () => void }) {
  const r = useReview();
  const owners = Array.from(new Set(ncsIn(report.quarter).map((n) => n.owner)));
  const groups: { label: string; ids: string[] }[] = [
    { label: "CTO", ids: [CTO] },
    { label: "Application Owners", ids: Array.from(new Set(PROJECTS.map((p) => TEAMS[p.id].appOwner))) },
    ...PROJECTS.map((p) => ({ label: `${p.name} team (NC owners)`, ids: owners.filter((o) => ncsIn(report.quarter, p.id).some((n) => n.owner === o)) })),
  ];
  const [to, setTo] = useState<string[]>([CTO, "neha"]);
  const [message, setMessage] = useState(`Please find the ${quarterByKey(report.quarter).label} compliance review report${report.final ? "" : " (draft)"}.`);
  const toggle = (ids: string[], on: boolean) => setTo((t) => (on ? Array.from(new Set([...t, ...ids])) : t.filter((x) => !ids.includes(x))));
  return (
    <Dialog
      title={`Send ${report.documentId}`}
      onClose={onClose}
      footer={<><button type="button" className={btnGhost} onClick={onClose}>Cancel</button><button type="button" className={btnPrimary} disabled={!to.length} onClick={() => { r.sendReport(report.id, to, message); onClose(); }}><Send className="h-4 w-4" /> Send to {to.length}</button></>}
    >
      {!report.final && <p className="rounded-md bg-warn-soft px-3 py-2 text-xs text-warn">This is a draft. Recipients will see it marked DRAFT.</p>}
      <div className="space-y-2">
        {groups.map((g) => (
          <label key={g.label} className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={g.ids.length > 0 && g.ids.every((i) => to.includes(i))} onChange={(e) => toggle(g.ids, e.target.checked)} disabled={!g.ids.length} />
            <span><b className="font-medium">{g.label}</b><br /><span className="text-xs text-muted-foreground">{g.ids.map((i) => `${person(i).name} <${person(i).email}>`).join(", ") || "—"}</span></span>
          </label>
        ))}
      </div>
      <Field label="Add a person" htmlFor="add-p">
        <select id="add-p" className={inputCls} value="" onChange={(e) => e.target.value && toggle([e.target.value], true)}>
          <option value="">Choose…</option>
          {PEOPLE.filter((p) => !to.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}
        </select>
      </Field>
      <p className="text-xs text-muted-foreground">To: {to.map((i) => person(i).name).join(", ") || "nobody yet"}</p>
      <Field label="Message" htmlFor="msg"><textarea id="msg" rows={3} className={inputCls} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
    </Dialog>
  );
}

/* ───────── the document itself (also what prints) ───────── */

function ReportDocument({ q, sections, coverNote, includeEvidence, documentId, final }: { q: QuarterKey; sections: ReportSection[]; coverNote: string; includeEvidence: boolean; documentId: string; final: boolean }) {
  const r = useReview();
  const stats = quarterStats(q, r.decisions);
  const prevQ = previousQuarter(q);
  const prev = prevQ ? quarterStats(prevQ, r.decisions) : undefined;
  const all = ncsIn(q);
  const end = quarterByKey(q).end;
  const signoff = r.signoffOf(q);
  const has = (s: ReportSection) => sections.includes(s);
  const H = ({ s, children }: { s: ReportSection; children: string }) => <h2 className="mt-8 border-b border-border pb-1 font-serif text-xl">{sections.indexOf(s) + 1}. {children}</h2>;
  const dec = (id: string) => r.decisions[id];

  return (
    <article className="print-area relative overflow-hidden rounded-xl border border-border bg-white p-10 text-[13px] leading-relaxed text-[oklch(0.22_0.04_258)] shadow-card">
      {!final && <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center"><span className="-rotate-30 select-none font-serif text-[120px] font-semibold text-[oklch(0.6_0.17_30/0.08)]">DRAFT</span></div>}
      <header className="border-b-2 border-[oklch(0.26_0.07_165)] pb-4">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[oklch(0.45_0.09_165)]"><ShieldCheck className="h-3.5 w-3.5" /> Audit Intelligence · Compliance review report</p>
        <h1 className="mt-2 font-serif text-3xl">{fullLabel(q)}</h1>
        <p className="mt-1 text-sm">PIT Armour · SAATHI · MPS · Acme Capital</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
          <div><dt className="text-[oklch(0.55_0.04_260)]">Document</dt><dd className="font-mono">{documentId}</dd></div>
          <div><dt className="text-[oklch(0.55_0.04_260)]">Status</dt><dd>{final ? "Final, signed off" : "Draft"}</dd></div>
          <div><dt className="text-[oklch(0.55_0.04_260)]">Prepared by</dt><dd>{person("priya").name}, Compliance Head</dd></div>
          <div><dt className="text-[oklch(0.55_0.04_260)]">Period</dt><dd>{fmtDate(quarterByKey(q).start)} – {fmtDate(end)}</dd></div>
        </dl>
        {coverNote && <p className="mt-3 rounded bg-[oklch(0.97_0.01_165)] p-3 font-serif text-[15px]">{coverNote}</p>}
      </header>

      {has("summary") && (
        <section>
          <H s="summary">Executive summary</H>
          <div className="mt-2 space-y-2">{summariseQuarter(q, r.decisions, r.observations).map((l, i) => <p key={i}>{l}</p>)}</div>
        </section>
      )}

      {has("projects") && (
        <section>
          <H s="projects">Scores by project</H>
          <Table head={["Project", "Business unit", "Controls effective", "Prev. quarter", "NCs", "Critical / High", "Open at end", "After TAT", "Repeat"]}
            rows={stats.per.map((s) => { const p = projectById(s.projectId); const pp = prev?.per.find((x) => x.projectId === s.projectId); return [p.name + (s.partial ? " (partial quarter)" : ""), p.businessUnit, `${s.score}%`, pp ? `${pp.score}%` : "—", String(s.ncs), `${s.bySeverity.Critical} / ${s.bySeverity.High}`, String(s.openAtEnd), String(s.pastTat), String(s.repeat)]; })} />
          <p className="mt-2 text-xs">Controls effective: share of applicable controls with no confirmed non-compliance in the quarter. {stats.checksPerformed.toLocaleString("en-IN")} automated and manual checks were performed on {stats.crs} changes.</p>
        </section>
      )}

      {has("register") && (
        <section>
          <H s="register">NC register</H>
          <Table head={["NC", "Project", "Control", "Finding", "Severity", "At quarter end", "Decision"]}
            rows={all.map((x) => { const d = dec(x.id); const cp = checkpointById(x.checkpointId); return [x.id, projectById(x.projectId).name, `${cp.ref} ${cp.name}`, x.finding, sevOf(x, r.decisions), { closed: "Closed", "pending-approval": "Awaiting approval", open: "Open" }[x.statusAtEnd], d ? { confirm: x.statusAtEnd === "closed" ? "Confirmed" : "Carried forward", observation: `Observation ${d.observationId ?? ""}`, exception: "Exception", dismiss: "False positive (not counted)", info: "Info requested (undecided)" }[d.decision] : "Undecided"]; })} />
        </section>
      )}

      {has("observations") && (
        <section>
          <H s="observations">Observations and management responses</H>
          {r.observations.filter((o) => o.quarter === q).length === 0 ? <p className="mt-2">No observations raised.</p> : r.observations.filter((o) => o.quarter === q).map((o) => (
            <div key={o.id} className="mt-3 break-inside-avoid rounded border border-[oklch(0.9_0.01_260)] p-3">
              <p className="font-medium">{o.id} · {o.severity} · {o.title}</p>
              <p className="text-xs">{projectById(o.projectId).name} · owner {person(o.owner).name} · due {fmtDate(o.dueAt)} · status {o.status} · NCs {o.ncIds.join(", ")}</p>
              <p className="mt-1"><b>Observation:</b> {o.whatsWrong}</p>
              <p><b>Expected:</b> {o.expected}</p>
              <p><b>Management response:</b> {o.response ? `${o.response.agree ? "Agreed" : "Disagreed"} (${person(o.response.by).name}, ${fmtDate(o.response.at)}). ${o.response.plan} Target ${fmtDate(o.response.targetDate)}.` : "Awaited."}</p>
              {o.verifiedAt && <p><b>Verified:</b> {fmtDate(o.verifiedAt)} {o.verifyNote}</p>}
            </div>
          ))}
        </section>
      )}

      {has("exceptions") && (
        <section>
          <H s="exceptions">Exceptions</H>
          {all.filter((x) => dec(x.id)?.decision === "exception").length === 0 ? <p className="mt-2">No exceptions accepted.</p> : (
            <Table head={["NC", "Project", "Reason", "Expires", "CTO approval"]} rows={all.filter((x) => dec(x.id)?.decision === "exception").map((x) => { const d = dec(x.id)!; return [x.id, projectById(x.projectId).name, d.note, d.exceptionExpiry ? fmtDate(d.exceptionExpiry) : "—", sevOf(x, r.decisions) === "Critical" ? (d.ctoApprovedAt ? fmtDate(d.ctoApprovedAt) : "Pending") : "Not required"]; })} />
          )}
        </section>
      )}

      {has("carried") && (
        <section>
          <H s="carried">Carried forward to next quarter</H>
          {all.filter((x) => x.statusAtEnd !== "closed" && dec(x.id)?.decision !== "exception" && dec(x.id)?.decision !== "dismiss").length === 0 ? <p className="mt-2">Nothing carried forward.</p> : (
            <Table head={["NC", "Project", "Owner", "Status at quarter end"]} rows={all.filter((x) => x.statusAtEnd !== "closed" && dec(x.id)?.decision !== "exception" && dec(x.id)?.decision !== "dismiss").map((x) => [x.id, projectById(x.projectId).name, person(x.owner).name, x.statusAtEnd === "open" ? "Open" : "Fix awaiting approval"])} />
          )}
        </section>
      )}

      {has("after-period") && (
        <section>
          <H s="after-period">Remediated after the period</H>
          <p className="mt-1 text-xs">Fixed after {fmtDate(end)}. These do not count as compliant for {quarterByKey(q).label}.</p>
          {all.filter((x) => x.closedAt && x.closedAt.slice(0, 10) > end).length === 0 ? <p className="mt-2">None.</p> : (
            <Table head={["NC", "Project", "Closed on"]} rows={all.filter((x) => x.closedAt && x.closedAt.slice(0, 10) > end).map((x) => [x.id, projectById(x.projectId).name, fmtDate(x.closedAt!)])} />
          )}
        </section>
      )}

      {has("periodic") && (
        <section>
          <H s="periodic">Periodic controls</H>
          <Table head={["Project", "Control", "Due by", "Done on", "Status"]} rows={periodicIn(q).filter((x) => x.status !== "not-due").map((x) => [projectById(x.projectId).name, `${checkpointById(x.checkpointId).ref} ${checkpointById(x.checkpointId).name}`, fmtDate(x.dueBy), x.doneOn ? fmtDate(x.doneOn) : "—", { "on-time": "On time", late: "Late", missed: "Missed", "not-due": "Not due" }[x.status]])} />
        </section>
      )}

      {has("evidence") && (
        <section>
          <H s="evidence">Evidence index</H>
          <Table head={["Evidence", "NC", "Source", "Captured"]} rows={all.flatMap((x) => x.evidence.map((e) => [`${e.id} ${e.title}${e.missing ? " (not found)" : ""}`, x.id, e.source, fmtDateTime(e.capturedAt)]))} />
          {includeEvidence && (
            <div className="mt-4 space-y-3">
              {all.filter((x) => dec(x.id) && dec(x.id)!.decision !== "confirm").map((x) => (
                <div key={x.id} className="break-inside-avoid">
                  <p className="mb-1 text-xs font-medium">{x.id} · {x.title}{x.crId ? ` · ${crById(x.crId)?.release}` : ""}</p>
                  <div className="space-y-2">{x.evidence.map((e) => <EvidenceCard key={e.id} e={e} />)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {has("signoff") && (
        <section className="break-inside-avoid">
          <H s="signoff">Sign-off</H>
          {signoff ? (
            <div className="mt-3 rounded border-2 border-[oklch(0.56_0.12_162)] p-4">
              <p>I have reviewed the non-compliances recorded for {fullLabel(q)} and the decisions above.</p>
              <p className="mt-3 font-serif text-lg">{person(signoff.by).name}</p>
              <p className="text-xs">Compliance Head · signed {fmtDateTime(signoff.at)} · {signoff.documentId} · controls effective {signoff.score || stats.score}%</p>
            </div>
          ) : <p className="mt-2">Not signed off. This is a draft.</p>}
        </section>
      )}
      <footer className="mt-10 border-t border-border pt-2 text-[10px] text-[oklch(0.55_0.04_260)]">Audit Intelligence · Newel Technologies · {documentId} · generated from data as of {fmtDate("2026-10-09")} · every decision and action is recorded in the audit trail</footer>
    </article>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead><tr>{head.map((h) => <th key={h} className="border-b border-[oklch(0.85_0.01_260)] py-1.5 pr-3 text-left font-mono text-[9.5px] font-normal uppercase tracking-wide text-[oklch(0.5_0.04_260)]">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="break-inside-avoid">{r.map((c, j) => <td key={j} className="border-b border-[oklch(0.93_0.01_260)] py-1.5 pr-3 align-top">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
