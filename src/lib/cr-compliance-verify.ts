import { createServerFn } from "@tanstack/react-start";
import { extractRequiredMerger, getJiraIssue } from "./jira-client";
import {
  crComplianceConfigs,
  extractTicketKey,
  resolveCrComplianceProject,
  type CrComplianceProjectConfig,
} from "./cr-compliance-config";
import { findBranch, findPullRequestsForBranch, getPullRequest, type GithubPull } from "./github-client";

// Decision matrix (Jira and GitHub are always both checked — neither
// short-circuits the other, unlike CP10/CP38's blocking gates):
//   merged, approved, correct merger        -> CR-C        Compliant
//   merged, but not approved and/or          -> CR-NC       Non-Compliant
//     merged by someone other than the
//     ticket's required merger
//   not merged, approved                    -> CR-IP        In Progress
//   not merged, not approved                -> CR-Pending
export type CrOutcomeId = "CR-C" | "CR-NC" | "CR-IP" | "CR-Pending";

export type CrComplianceResult = {
  project_id: string;
  jira_ticket: string;
  outcome_id: CrOutcomeId;
  jira_status: string | null;
  jira_approved: boolean;
  required_merger: string | null; // e.g. "rahul", parsed from a Jira comment; null if none specified
  branch_found: boolean;
  pr_number: number | null;
  pr_state: string | null;
  pr_merged: boolean;
  pr_merged_by: string | null;
  merger_matches: boolean; // true when no merger is required, or the actual merger matches
  pr_url: string | null;
  timestamp: string;
};

export type GateState = "pending" | "passed" | "failed";
export type CrGateStatus = { jira: GateState; branch: GateState; pr: GateState };

export type CrVerifyResponse = {
  config: CrComplianceProjectConfig | null;
  ticketKey: string | null;
  result: CrComplianceResult | null;
  reply: string;
  gates: CrGateStatus;
};

function initialGates(): CrGateStatus {
  return { jira: "pending", branch: "pending", pr: "pending" };
}

function outcomeLabel(id: CrOutcomeId): string {
  switch (id) {
    case "CR-C":
      return "Compliant";
    case "CR-NC":
      return "Non-Compliant";
    case "CR-IP":
      return "In Progress";
    case "CR-Pending":
      return "Pending";
  }
}

function crReplyText(ticketKey: string, cfg: CrComplianceProjectConfig, result: CrComplianceResult): string {
  const header = `CR Compliance — ${ticketKey}: ${outcomeLabel(result.outcome_id)}`;
  const jiraPhrase = `Jira status "${result.jira_status}" (${result.jira_approved ? "approved" : "not yet approved"})`;

  if (!result.branch_found) {
    return `${header}\n${jiraPhrase}. No branch named "${ticketKey}" has been found in ${cfg.githubOwner}/${cfg.githubRepo} yet.`;
  }
  if (result.pr_number == null) {
    return `${header}\n${jiraPhrase}. Branch "${ticketKey}" exists in ${cfg.githubOwner}/${cfg.githubRepo}, but no pull request has been opened from it yet.`;
  }
  if (!result.pr_merged) {
    const mergerNote = result.required_merger ? ` (must be merged by "${result.required_merger}")` : "";
    return `${header}\n${jiraPhrase}. PR #${result.pr_number} is ${result.pr_state}, not yet merged${mergerNote}.`;
  }

  const mergedByPhrase = result.pr_merged_by ? `merged by ${result.pr_merged_by}` : "merged, but by an unknown user";
  const mergerNote = result.required_merger
    ? result.merger_matches
      ? ` — matches the required merger "${result.required_merger}"`
      : ` — but the ticket requires it to be merged by "${result.required_merger}"`
    : "";
  return `${header}\n${jiraPhrase}. PR #${result.pr_number} is ${mergedByPhrase}${mergerNote}.`;
}

// Core flow: fetch the Jira ticket (status + comments) and the GitHub
// branch/PR state independently (neither blocks the other), then run
// jira_approved + pr_merged + merger_matches through the decision matrix
// above. No LLM step: unlike CP10/CP38 there's no free-text language to
// classify — identity here is a deterministic mention-vs-login match, same
// spirit as CP10's sender-email match.
export async function verifyCrCompliance(
  ticketKey: string,
  cfg: CrComplianceProjectConfig,
): Promise<CrVerifyResponse> {
  const timestamp = new Date().toISOString();
  const gates = initialGates();

  // Jira side — direct REST (Basic auth), not Rovo MCP — no interactive
  // OAuth login required for this checkpoint.
  let issue;
  try {
    issue = await getJiraIssue(ticketKey);
  } catch (error) {
    return {
      config: cfg,
      ticketKey,
      result: null,
      gates,
      reply: `Copilot couldn't reach Jira: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
  if (!issue) {
    return { config: cfg, ticketKey, result: null, gates, reply: `Copilot couldn't find ${ticketKey} in Jira.` };
  }

  const statusName: string = issue.fields.status?.name ?? "Unknown";
  // statusCategory.key is Jira's own normalized bucket ("new" | "indeterminate"
  // | "done") — checked instead of matching on statusName so this doesn't
  // break if the workflow's status labels ever change.
  const statusCategoryKey: string = issue.fields.status?.statusCategory?.key ?? "";
  const jiraApproved = statusCategoryKey === "done";
  gates.jira = jiraApproved ? "passed" : "failed";
  const requiredMerger = extractRequiredMerger(issue);

  // GitHub side — always checked, regardless of the Jira outcome above,
  // since a merge without approval (or by the wrong person) is itself a
  // result this checkpoint needs to surface (CR-NC), not something to skip.
  let branch;
  try {
    branch = await findBranch(cfg.githubOwner, cfg.githubRepo, ticketKey);
  } catch (error) {
    return {
      config: cfg,
      ticketKey,
      result: null,
      gates,
      reply: `GitHub couldn't be reached: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
  gates.branch = branch ? "passed" : "failed";

  let pr: GithubPull | null = null;
  let mergedByLogin: string | null = null;
  if (branch) {
    let pulls: GithubPull[];
    try {
      pulls = await findPullRequestsForBranch(cfg.githubOwner, cfg.githubRepo, ticketKey);
    } catch (error) {
      return {
        config: cfg,
        ticketKey,
        result: null,
        gates,
        reply: `Branch found, but the pull request lookup failed: ${error instanceof Error ? error.message : "unknown error"}`,
      };
    }
    // Most recent PR from that branch, if more than one was ever opened.
    pulls.sort((a, b) => b.number - a.number);
    pr = pulls[0] ?? null;

    // merged_by isn't on the list response above — only fetched once we
    // know which PR, and only when it's actually merged (nothing to fetch
    // otherwise).
    if (pr?.merged_at) {
      try {
        const detail = await getPullRequest(cfg.githubOwner, cfg.githubRepo, pr.number);
        mergedByLogin = detail.merged_by?.login ?? null;
      } catch (error) {
        return {
          config: cfg,
          ticketKey,
          result: null,
          gates,
          reply: `PR found, but fetching who merged it failed: ${error instanceof Error ? error.message : "unknown error"}`,
        };
      }
    }
  }
  const prMerged = Boolean(pr?.merged_at);
  gates.pr = prMerged ? "passed" : "failed";

  // No requirement specified -> never blocks compliance. Requirement
  // specified -> the actual GitHub login must contain the mentioned name
  // (case-insensitive substring, since a Jira mention like "@rahul" is a
  // first name, not the GitHub login it maps to, e.g. "rahulnewel").
  const mergerMatches = !requiredMerger || (mergedByLogin?.toLowerCase().includes(requiredMerger.toLowerCase()) ?? false);

  const outcome_id: CrOutcomeId = prMerged
    ? jiraApproved && mergerMatches
      ? "CR-C"
      : "CR-NC"
    : jiraApproved
      ? "CR-IP"
      : "CR-Pending";

  const result: CrComplianceResult = {
    project_id: cfg.projectId,
    jira_ticket: ticketKey,
    outcome_id,
    jira_status: statusName,
    jira_approved: jiraApproved,
    required_merger: requiredMerger,
    branch_found: Boolean(branch),
    pr_number: pr?.number ?? null,
    pr_state: pr?.state ?? null,
    pr_merged: prMerged,
    pr_merged_by: mergedByLogin,
    merger_matches: mergerMatches,
    pr_url: pr?.html_url ?? null,
    timestamp,
  };
  return { config: cfg, ticketKey, result, gates, reply: crReplyText(ticketKey, cfg, result) };
}

export const runCrComplianceVerification = createServerFn({ method: "POST" })
  .validator((data: { question: string }) => data)
  .handler(async ({ data }): Promise<CrVerifyResponse> => {
    const ticketKey = extractTicketKey(data.question);
    if (!ticketKey) {
      return {
        config: null,
        ticketKey: null,
        result: null,
        gates: initialGates(),
        reply: 'I couldn\'t find a ticket ID in that question — ask like "Can you tell me if ticket CR-POC-4 is compliant?"',
      };
    }
    const cfg = resolveCrComplianceProject(ticketKey);
    if (!cfg) {
      return {
        config: null,
        ticketKey,
        result: null,
        gates: initialGates(),
        reply: `I don't have a GitHub repo configured for project "${ticketKey.split("-")[0]}". Known projects: ${crComplianceConfigs
          .map((c) => c.jiraProjectKey)
          .join(", ")}.`,
      };
    }
    return verifyCrCompliance(ticketKey, cfg);
  });
