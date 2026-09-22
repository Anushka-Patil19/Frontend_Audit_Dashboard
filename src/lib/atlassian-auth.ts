// File-backed OAuth 2.1 client provider for Atlassian's Rovo MCP
// (https://mcp.atlassian.com/v2/mcp). Uses Dynamic Client Registration — no
// manually-created Atlassian developer-console app or client secret needed;
// this registers itself as a public client (PKCE only) on first use.
//
// Run `npm run atlassian:login` once to authorize interactively (opens a
// browser for Atlassian login/consent). After that, access tokens refresh
// automatically via the stored refresh_token — no repeated login needed
// unless the refresh token itself is revoked/expired.
//
// Node built-ins are imported lazily (dynamic import) rather than at module
// top-level: this module is reachable from client-bundled code (via
// cp10-verify.ts -> a createServerFn handler, imported by the copilot
// widget), and Vite throws immediately on merely evaluating a top-level
// `node:child_process` import in a browser bundle, even if never called.
// This module must only ever actually be invoked server-side.
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationFull,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

export const ROVO_MCP_URL = "https://mcp.atlassian.com/v2/mcp";
export const REDIRECT_URI = "http://localhost:8934/callback";

type Store = {
  clientInformation?: OAuthClientInformationFull;
  tokens?: OAuthTokens;
  codeVerifier?: string;
};

async function getStorePath(): Promise<string> {
  const { dirname, resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../.atlassian-auth.json");
}

async function loadStore(): Promise<Store> {
  const { existsSync, readFileSync } = await import("node:fs");
  const storePath = await getStorePath();
  if (!existsSync(storePath)) return {};
  try {
    return JSON.parse(readFileSync(storePath, "utf8")) as Store;
  } catch {
    return {};
  }
}

async function saveStore(store: Store): Promise<void> {
  const { writeFileSync } = await import("node:fs");
  const storePath = await getStorePath();
  writeFileSync(storePath, JSON.stringify(store, null, 2));
}

async function openBrowser(url: string): Promise<void> {
  const { exec } = await import("node:child_process");
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {
    // Best-effort only — the printed URL below still works if this fails.
  });
}

export async function createAtlassianAuthProvider(): Promise<OAuthClientProvider> {
  const store = await loadStore();

  return {
    get redirectUrl() {
      return REDIRECT_URI;
    },
    get clientMetadata(): OAuthClientMetadata {
      return {
        client_name: "CP10 CAB Approval Verification (POC)",
        redirect_uris: [REDIRECT_URI],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      };
    },
    clientInformation() {
      return store.clientInformation;
    },
    saveClientInformation(info: OAuthClientInformationFull) {
      store.clientInformation = info;
      return saveStore(store);
    },
    tokens() {
      return store.tokens;
    },
    saveTokens(tokens: OAuthTokens) {
      store.tokens = tokens;
      return saveStore(store);
    },
    redirectToAuthorization(url: URL) {
      console.log("\nOpen this URL to authorize with Atlassian (attempting to open it for you too):\n");
      console.log(url.toString());
      console.log("");
      return openBrowser(url.toString());
    },
    saveCodeVerifier(codeVerifier: string) {
      store.codeVerifier = codeVerifier;
      return saveStore(store);
    },
    codeVerifier() {
      if (!store.codeVerifier) {
        throw new Error("No PKCE code verifier saved — run `npm run atlassian:login` again.");
      }
      return store.codeVerifier;
    },
  };
}
