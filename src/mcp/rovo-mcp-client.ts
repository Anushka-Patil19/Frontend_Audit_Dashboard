// Shared helper for connecting to Atlassian's Rovo MCP as an authenticated
// client, reused by the CP10 Jira gate and any diagnostic scripts.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createAtlassianAuthProvider, ROVO_MCP_URL } from "../lib/atlassian-auth.js";

export async function connectRovoMcp(): Promise<Client> {
  const authProvider = await createAtlassianAuthProvider();
  const transport = new StreamableHTTPClientTransport(new URL(ROVO_MCP_URL), { authProvider });
  const client = new Client({ name: "cp10-cab-approval", version: "1.0.0" });
  await client.connect(transport);
  return client;
}
