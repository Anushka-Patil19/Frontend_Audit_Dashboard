// Standalone MCP server exposing CP38 UAT sign-off verification as a tool
// callable from any MCP host (Claude Code, Claude Desktop, etc.) — not just
// the chat widget embedded in the web app.
//
// This wraps the SAME deterministic-then-LLM-gated flow used by the app
// (verifyCp38 in ../lib/cp38-verify.ts) — it does not give the calling agent
// any freedom over sender-checking or when the LLM runs. The tool just
// returns whatever that fixed pipeline decides, per the PRD.
//
// Run directly: npx tsx src/mcp/cp38-server.ts
// (Configure your MCP host to run that command; see README notes below.)

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// This process is launched by an MCP host from an arbitrary cwd, so resolve
// .env by this file's own location rather than trusting process.cwd().
const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "../../.env");
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // no .env at that path — fine, envs may already be set another way
  }
}

const { verifyCp38 } = await import("../lib/cp38-verify.js");
const { cp38Configs, findCp38Config } = await import("../lib/cp38-config.js");

const server = new McpServer({ name: "cp38-uat-signoff", version: "1.0.0" });

server.registerTool(
  "check_cp38_signoff",
  {
    title: "Check CP38 UAT sign-off status",
    description:
      "Checks CP38 (Business UAT sign-off) status for a project by searching the shared mailbox, per the " +
      "CP38 PRD's fixed flow: a deterministic sender-identity check runs first (never an LLM decision); the " +
      "LLM is only ever consulted afterward, and only to classify whether the authorized sender's email body " +
      "contains explicit sign-off language. Returns CP38-Compliant or CP38-Pending (with a reason: no_email, " +
      "wrong_sender, or ambiguous_language) — never a third status.",
    inputSchema: {
      project: z
        .string()
        .describe(`Project id or label. Known projects: ${cp38Configs.map((c) => `"${c.projectLabel}"`).join(", ")}`),
    },
  },
  async ({ project }) => {
    const cfg = findCp38Config(project);
    if (!cfg) {
      return {
        content: [
          {
            type: "text",
            text: `Unknown project "${project}". Known projects: ${cp38Configs
              .map((c) => c.projectLabel)
              .join(", ")}.`,
          },
        ],
        isError: true,
      };
    }

    const { result, reply } = await verifyCp38(cfg);
    return {
      content: [
        {
          type: "text",
          text: result ? `${reply}\n\n${JSON.stringify(result)}` : reply,
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
