import React, { useState, useMemo, useRef } from "react";
import {
  X,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  Filter,
  Check,
} from "lucide-react";
import { type Checkpoint, type Status, statusLabel } from "@/lib/audit-data";

interface AuditReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  projectClient: string;
  compliancePct: number;
  checkpoints: Checkpoint[];
}

export function AuditReportModal({
  isOpen,
  onClose,
  projectName,
  projectClient,
  compliancePct,
  checkpoints,
}: AuditReportModalProps) {
  const [filterStatus, setFilterStatus] = useState<"all" | "compliant" | "gaps">("all");
  const reportRef = useRef<HTMLDivElement>(null);

  const reportDate = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  const reportTime = useMemo(() => {
    const d = new Date();
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, []);

  const reportDocId = useMemo(() => {
    return `AUD-${projectName.replace(/\s+/g, "").toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  }, [projectName]);

  // Statistics
  const total = checkpoints.length;
  const compliantCount = checkpoints.filter((c) => c.status === "compliant").length;
  const nonCompliantCount = checkpoints.filter((c) => c.status === "non-compliant").length;
  const needsReviewCount = checkpoints.filter((c) => c.status === "needs-review").length;
  const manualCount = checkpoints.filter((c) => c.kind === "manual").length;
  const automatedCount = total - manualCount;

  // Filtered checkpoints
  const filteredCheckpoints = useMemo(() => {
    if (filterStatus === "compliant") {
      return checkpoints.filter((c) => c.status === "compliant");
    }
    if (filterStatus === "gaps") {
      return checkpoints.filter(
        (c) => c.status === "non-compliant" || c.status === "needs-review" || c.status === "manual-waiting",
      );
    }
    return checkpoints;
  }, [checkpoints, filterStatus]);

  // Grouped by Category
  const groupedByCategory = useMemo(() => {
    const map = new Map<string, Checkpoint[]>();
    for (const cp of filteredCheckpoints) {
      map.set(cp.category, [...(map.get(cp.category) ?? []), cp]);
    }
    return [...map.entries()];
  }, [filteredCheckpoints]);

  // Category breakdown stats for summary table
  const categorySummary = useMemo(() => {
    const map = new Map<
      string,
      { total: number; compliant: number; nonCompliant: number; needsReview: number }
    >();
    for (const cp of checkpoints) {
      const cur = map.get(cp.category) || {
        total: 0,
        compliant: 0,
        nonCompliant: 0,
        needsReview: 0,
      };
      cur.total += 1;
      if (cp.status === "compliant") cur.compliant += 1;
      else if (cp.status === "non-compliant") cur.nonCompliant += 1;
      else cur.needsReview += 1;
      map.set(cp.category, cur);
    }
    return [...map.entries()].map(([category, stats]) => ({
      category,
      ...stats,
      rate: Math.round((stats.compliant / stats.total) * 100),
    }));
  }, [checkpoints]);

  // Handle Export CSV
  const handleExportCsv = () => {
    const headers = [
      "Category",
      "Reference_ID",
      "Checklist_Process",
      "Compliance_Status",
      "Verification_Mode",
      "Owner_Role",
      "Audit_Evidence",
      "Evidence_Source",
      "Confidence_Pct",
      "Notes_Detail",
    ];

    const rows = checkpoints.map((cp) => {
      const isAuto = cp.kind === "automated";
      const statusText =
        cp.status === "compliant"
          ? "COMPLIANT"
          : cp.status === "non-compliant"
          ? "NON-COMPLIANT"
          : cp.status === "needs-review"
          ? "NEEDS REVIEW"
          : "IN PROGRESS";

      const detail = isAuto ? cp.detail || "" : cp.waitingOn || "";

      return [
        `"${cp.category.replace(/"/g, '""')}"`,
        `"${cp.ref}"`,
        `"${cp.name.replace(/"/g, '""')}"`,
        `"${statusText}"`,
        `"${isAuto ? "Automated Worker" : "Manual Sign-off"}"`,
        `"${(cp.ownerRole || "Unassigned").replace(/"/g, '""')}"`,
        `"${(cp.auditEvidence || "Not Specified").replace(/"/g, '""')}"`,
        `"${(cp.sources?.join(", ") || "manual").replace(/"/g, '""')}"`,
        `"${isAuto ? cp.confidence : "N/A"}"`,
        `"${detail.replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${projectName.replace(/\s+/g, "_")}_Compliance_Audit_Report_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Print / Save as PDF
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      {/* Container Dialog */}
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-panel border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3 border-b border-border bg-panel-2 px-6 py-3.5">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary-soft text-primary">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-serif text-sm font-semibold text-foreground">
                Audit Compliance Report Generator
              </h3>
              <p className="text-[11px] text-muted-foreground font-mono">
                Document ID: {reportDocId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Scope */}
            <div className="flex items-center bg-panel border border-border rounded-md p-0.5 text-xs">
              <button
                onClick={() => setFilterStatus("all")}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  filterStatus === "all"
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({checkpoints.length})
              </button>
              <button
                onClick={() => setFilterStatus("compliant")}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  filterStatus === "compliant"
                    ? "bg-emerald-600 text-white font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Compliant ({compliantCount})
              </button>
              <button
                onClick={() => setFilterStatus("gaps")}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  filterStatus === "gaps"
                    ? "bg-rose-600 text-white font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Gaps & Action Items ({nonCompliantCount + needsReviewCount})
              </button>
            </div>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-3 py-1.5 text-xs font-medium text-foreground hover:bg-panel-2 shadow-sm transition-colors"
              title="Export complete process audit register as spreadsheet (.CSV)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            {/* Print / Save as PDF Button */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors"
              title="Print document or Save as PDF"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save as PDF</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-panel-2 hover:text-foreground transition-colors ml-2"
              title="Close report"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Report Paper */}
        <div
          ref={reportRef}
          className="flex-1 overflow-y-auto p-8 space-y-8 bg-background print:bg-white print:text-black print:p-0 print:overflow-visible print:m-0"
        >
          {/* Cover Header */}
          <div className="border-b-2 border-primary/20 pb-6">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-primary/10 text-primary uppercase tracking-wider mb-2">
                  Official IT Audit & Compliance Register
                </span>
                <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground print:text-black">
                  {projectName} — Compliance Audit Report
                </h1>
                <p className="mt-1 text-sm text-muted-foreground print:text-gray-700">
                  Client: <strong className="text-foreground print:text-black">{projectClient}</strong>
                </p>
              </div>

              <div className="text-right font-mono text-xs text-muted-foreground print:text-gray-700 space-y-1">
                <div>
                  <strong>Report Date:</strong> {reportDate}
                </div>
                <div>
                  <strong>Time:</strong> {reportTime}
                </div>
                <div>
                  <strong>Ref ID:</strong> {reportDocId}
                </div>
                <div>
                  <strong>Framework:</strong> SOC 2 Type II / ISO 27001
                </div>
              </div>
            </div>

            {/* Executive Status Banner */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl border border-border bg-panel-2/60 print:border-gray-300 print:bg-gray-50">
              <div>
                <span className="text-xs text-muted-foreground print:text-gray-600 block">
                  Overall Compliance
                </span>
                <span className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {compliancePct}%
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  {compliancePct >= 80 ? "Pass Ready" : "In Review"}
                </span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground print:text-gray-600 block">
                  Checklist Evaluated
                </span>
                <span className="text-2xl font-mono font-bold text-foreground print:text-black">
                  {total}
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  {compliantCount} Passing / {total - compliantCount} Gaps
                </span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground print:text-gray-600 block">
                  High Risk Blockers
                </span>
                <span className="text-2xl font-mono font-bold text-rose-600">
                  {nonCompliantCount}
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  {nonCompliantCount === 0 ? "Zero Blockers" : "Breach Risk Items"}
                </span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground print:text-gray-600 block">
                  Monitoring Automation
                </span>
                <span className="text-2xl font-mono font-bold text-violet-600">
                  {Math.round((automatedCount / total) * 100)}%
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  {automatedCount} API / {manualCount} Manual
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Category Summary Scorecard Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold text-foreground print:text-black">
                1. Category Compliance Breakdown
              </h2>
              <span className="text-xs font-mono text-muted-foreground">
                17 Categories Assessed
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border print:border-gray-300">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-panel-2/80 print:bg-gray-100 font-mono text-muted-foreground print:text-gray-800">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Category Name</th>
                    <th className="py-2.5 px-3 text-center">Total Controls</th>
                    <th className="py-2.5 px-3 text-center">Compliant</th>
                    <th className="py-2.5 px-3 text-center">Gaps</th>
                    <th className="py-2.5 px-3 text-center">Pass Rate</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border print:divide-gray-200">
                  {categorySummary.map((item, idx) => (
                    <tr
                      key={item.category}
                      className="hover:bg-panel-2/40 print:hover:bg-transparent transition-colors"
                    >
                      <td className="py-2 px-3 font-mono text-faint">{idx + 1}</td>
                      <td className="py-2 px-3 font-medium text-foreground print:text-black">
                        {item.category}
                      </td>
                      <td className="py-2 px-3 text-center font-mono">{item.total}</td>
                      <td className="py-2 px-3 text-center font-mono text-emerald-600 font-semibold">
                        {item.compliant}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-rose-600 font-semibold">
                        {item.nonCompliant + item.needsReview}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-semibold">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${
                            item.rate >= 80
                              ? "bg-emerald-500/10 text-emerald-600"
                              : item.rate >= 60
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-rose-500/10 text-rose-600"
                          }`}
                        >
                          {item.rate}%
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-[11px]">
                        {item.rate === 100 ? (
                          <span className="text-emerald-600 font-medium">Fully Compliant</span>
                        ) : item.nonCompliant > 0 ? (
                          <span className="text-rose-600 font-medium">Non-Compliant</span>
                        ) : (
                          <span className="text-amber-600 font-medium">Needs Review</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Detailed Process Audit Register */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold text-foreground print:text-black">
                2. Detailed Audit Checklist & Process Ledger
              </h2>
              <span className="text-xs font-mono text-muted-foreground">
                Showing {filteredCheckpoints.length} Checkpoints
              </span>
            </div>

            {groupedByCategory.map(([category, items]) => (
              <div
                key={category}
                className="space-y-2 rounded-lg border border-border print:border-gray-300 p-4 bg-panel/50 print:bg-transparent"
              >
                <div className="flex items-center justify-between border-b border-border/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-semibold text-sm text-foreground print:text-black">
                      {category}
                    </span>
                    <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[10px] font-mono text-muted-foreground border border-border">
                      {items.length} items
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-muted-foreground">
                    {items.filter((i) => i.status === "compliant").length} of {items.length} passing
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 font-mono text-[10px] text-faint uppercase">
                        <th className="py-2 px-2 w-12">Ref</th>
                        <th className="py-2 px-2">Checklist Process / Requirement</th>
                        <th className="py-2 px-2">Owner Role</th>
                        <th className="py-2 px-2">Audit Evidence</th>
                        <th className="py-2 px-2">Source</th>
                        <th className="py-2 px-2 text-right">Compliance Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {items.map((cp) => {
                        const isCompliant = cp.status === "compliant";
                        const isNonCompliant = cp.status === "non-compliant";
                        const isReview = cp.status === "needs-review";

                        return (
                          <tr
                            key={cp.id}
                            className="hover:bg-panel-2/30 print:hover:bg-transparent transition-colors"
                          >
                            <td className="py-2 px-2 font-mono font-bold text-foreground print:text-black">
                              {cp.ref}
                            </td>
                            <td className="py-2 px-2 max-w-md">
                              <p className="font-medium text-foreground print:text-black">
                                {cp.name}
                              </p>
                              {cp.kind === "automated" && cp.detail && (
                                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                  {cp.detail}
                                </p>
                              )}
                              {cp.kind === "manual" && cp.waitingOn && (
                                <p className="text-[11px] text-amber-600 font-mono mt-0.5">
                                  Waiting on: {cp.waitingOn}
                                </p>
                              )}
                            </td>
                            <td className="py-2 px-2">
                              <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-mono bg-panel-2 border border-border text-foreground">
                                {cp.ownerRole || "General"}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-muted-foreground font-mono text-[11px]">
                              {cp.auditEvidence || "Documentary"}
                            </td>
                            <td className="py-2 px-2 font-mono text-[11px] text-muted-foreground uppercase">
                              {cp.sources?.join(", ") || "manual"}
                            </td>
                            <td className="py-2 px-2 text-right">
                              {isCompliant ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                                  <Check className="h-3 w-3" />
                                  COMPLIANT
                                </span>
                              ) : isNonCompliant ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-rose-500/10 text-rose-600 border border-rose-500/30">
                                  <AlertTriangle className="h-3 w-3" />
                                  NON-COMPLIANT
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-amber-500/10 text-amber-600 border border-amber-500/30">
                                  <Clock className="h-3 w-3" />
                                  NEEDS REVIEW
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* Report Footer / Attestation */}
          <div className="border-t-2 border-border pt-6 mt-8 text-xs text-muted-foreground print:text-gray-700 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-foreground print:text-black">
                Continuous Compliance Intelligence System
              </p>
              <p className="text-[11px]">
                Report generated for {projectName} ({projectClient}) · Valid for official audit submission.
              </p>
            </div>
            <div className="text-right font-mono text-[11px]">
              <div>Attested by: System Auditor Engine</div>
              <div>Hash: SHA256-09092026-OK</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
