// One-time (or re-run-when-needed) interactive setup: authorizes this app
// against Atlassian's Rovo MCP via OAuth 2.1 + PKCE, dynamically registering
// a public client (no developer-console app or secret required). Opens a
// browser for you to log in and approve; after that, tokens refresh
// automatically and this script doesn't need to run again unless the
// refresh token is revoked or expires.
//
// Run: npm run atlassian:login
import { createServer } from "node:http";
import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { createAtlassianAuthProvider, REDIRECT_URI, ROVO_MCP_URL } from "../lib/atlassian-auth.js";

async function waitForCallback(): Promise<string> {
  const port = Number(new URL(REDIRECT_URI).port);
  return new Promise<string>((resolvePromise, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", REDIRECT_URI);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      res.setHeader("content-type", "text/html");

      if (error) {
        res.end(`<h1>Authorization failed</h1><p>${error}</p>`);
        server.close();
        reject(new Error(error));
        return;
      }
      if (!code) {
        res.end("<h1>Waiting for authorization…</h1>");
        return;
      }
      res.end("<h1>Authorized — you can close this tab.</h1>");
      server.close();
      resolvePromise(code);
    });
    server.listen(port, () => {
      console.log(`Waiting for the Atlassian OAuth callback on ${REDIRECT_URI} ...`);
    });
  });
}

async function main() {
  const provider = await createAtlassianAuthProvider();

  const first = await auth(provider, { serverUrl: ROVO_MCP_URL });
  if (first === "AUTHORIZED") {
    console.log("Already authorized (valid or refreshed tokens on file) — nothing more to do.");
    return;
  }

  const code = await waitForCallback();
  const second = await auth(provider, { serverUrl: ROVO_MCP_URL, authorizationCode: code });
  if (second !== "AUTHORIZED") {
    throw new Error(`Unexpected auth result after code exchange: ${second}`);
  }
  console.log("Authorized. Tokens saved to .atlassian-auth.json — CP10's Jira gate can now use Rovo MCP.");
}

main().catch((error) => {
  console.error("Atlassian login failed:", error);
  process.exit(1);
});
