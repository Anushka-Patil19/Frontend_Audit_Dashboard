// Local dev only: populate process.env from .env for this server process.
// In production, real secrets should come from the platform's own env/secret
// store (e.g. Cloudflare Worker secrets), not a committed/deployed .env file.
if (typeof process !== "undefined" && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    // no .env file present — fine, envs may already be set another way
  }
}

export type GraphTokenResult = { ok: true; accessToken: string } | { ok: false; error: string };

// Server-only: client_id/client_secret never reach the browser bundle.
export async function getGraphAccessToken(): Promise<GraphTokenResult> {
  const tenantId = process.env.MS_TENANT_ID;
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    return { ok: false, error: "Missing MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET on the server (.env)." };
  }

  try {
    const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    });
    const data = (await res.json()) as { access_token?: string; error_description?: string };

    if (!res.ok || !data.access_token) {
      return { ok: false, error: data.error_description ?? `Token request failed (HTTP ${res.status}).` };
    }
    return { ok: true, accessToken: data.access_token };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error contacting Microsoft login." };
  }
}
