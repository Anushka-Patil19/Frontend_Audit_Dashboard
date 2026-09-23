import { createServerFn } from "@tanstack/react-start";
import { fetchRepoFile } from "./github-client";
import { checkAllDependencies, type DependencyResult } from "./version-checker";

const OWNER = "Anushka-Patil19";
const REPO = "Frontend_Audit_Dashboard";
const BRANCH = "main";

export type DependencyMonitorResult = { ok: true; results: DependencyResult[] } | { ok: false; error: string };

export const checkRepoDependencies = createServerFn({ method: "GET" }).handler(
  async (): Promise<DependencyMonitorResult> => {
    const file = await fetchRepoFile(OWNER, REPO, "requirements.txt", BRANCH);
    if (!file.ok) return { ok: false, error: file.error };
    const results = await checkAllDependencies(file.content);
    return { ok: true, results };
  },
);
