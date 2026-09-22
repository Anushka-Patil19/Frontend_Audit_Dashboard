// Every Node/Playwright-specific import below is dynamic and lives inside a
// function body — never at module top level. This module is imported from
// cp10-verify.ts and cp38-verify.ts, which are plain modules with no
// "use server" boundary, so in dev Vite serves them to the browser
// unbundled, no dead-code elimination. A static top-level `import
// "playwright"` here would make the browser eagerly fetch and parse
// playwright-core, which isn't a valid browser ES module, and crash. A
// dynamic import is only ever resolved if the function is actually called —
// which only happens server-side.
//
// Shared by both CP10 (CAB approval) and CP38 (UAT sign-off) — both need the
// same "screenshot the verified approval email as evidence" step, just for
// a different mailbox search.

const SAFE_FILENAME = /^[A-Za-z0-9_-]+\.png$/;

export type CaptureApprovalEmailInput = {
  checkpoint: "cp10" | "cp38";
  projectId: string;
  messageId: string;
  mailbox: string;
  accessToken: string;
  subject: string;
  from: string;
  receivedDateTime: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Graph returns receivedDateTime in UTC (e.g. "2026-09-17T11:52:10Z") — the
// approver and auditors reading this screenshot are on IST, so render it in
// their timezone rather than as a raw UTC ISO string.
function formatIst(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return isoDateTime;
  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
  return `${formatted} IST`;
}

function mailEvidenceFileName(checkpoint: string, projectId: string, messageId: string): string {
  const safeMessageId = messageId.replace(/[^A-Za-z0-9_-]/g, "_");
  return `${checkpoint}-${projectId}-${safeMessageId}.png`;
}

async function evidenceDir(): Promise<string> {
  const path = await import("node:path");
  return path.join(process.cwd(), "evidence");
}

// Shared by both capture functions below: launch headless Chromium, render
// the given HTML, screenshot it, and save under evidence/<fileName>.
async function renderAndSave(html: string, fileName: string): Promise<string> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
    await page.setContent(html, { waitUntil: "networkidle" });
    const buffer = await page.screenshot({ fullPage: true });

    const { mkdir, writeFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = await evidenceDir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), buffer);
    return fileName;
  } finally {
    await browser.close();
  }
}

// Called only once the checkpoint's mail gate and LLM gate have both
// passed (i.e. only for a Compliant outcome) — this never runs off
// unverified mail. A failure here is logged and swallowed: the screenshot
// is an evidence nicety, not part of the compliance decision itself.
export async function captureApprovalEmailScreenshot(
  input: CaptureApprovalEmailInput,
): Promise<string | null> {
  try {
    const bodyRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(input.mailbox)}/messages/${encodeURIComponent(input.messageId)}?$select=body`,
      {
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          Prefer: 'outlook.body-content-type="html"',
        },
      },
    );
    const bodyData = (await bodyRes.json()) as {
      body?: { content?: string };
      error?: { message: string };
    };
    if (!bodyRes.ok || !bodyData.body?.content) {
      console.warn(
        `${input.checkpoint.toUpperCase()} screenshot: couldn't fetch HTML body for message ${input.messageId}: ${
          bodyData.error?.message ?? `HTTP ${bodyRes.status}`
        }`,
      );
      return null;
    }

    const page_html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; margin: 0; background: #fff; }
  .email-header { border-bottom: 1px solid #ddd; padding: 16px 20px; background: #f7f7f8; }
  .email-header .subject { font-size: 16px; font-weight: 600; color: #111; margin-bottom: 6px; }
  .email-header div { margin: 2px 0; font-size: 13px; color: #444; }
  .email-body { padding: 20px; font-size: 14px; color: #111; }
</style>
</head>
<body>
  <div class="email-header">
    <div class="subject">${escapeHtml(input.subject)}</div>
    <div>From: ${escapeHtml(input.from)}</div>
    <div>Received: ${escapeHtml(formatIst(input.receivedDateTime))}</div>
  </div>
  <div class="email-body">${bodyData.body.content}</div>
</body>
</html>`;

    return await renderAndSave(
      page_html,
      mailEvidenceFileName(input.checkpoint, input.projectId, input.messageId),
    );
  } catch (error) {
    console.warn(
      `${input.checkpoint.toUpperCase()} screenshot capture failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return null;
  }
}

export async function readEvidenceScreenshot(fileName: string): Promise<Buffer | null> {
  if (!SAFE_FILENAME.test(fileName)) return null;
  try {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = await evidenceDir();
    return await readFile(path.join(dir, fileName));
  } catch {
    return null;
  }
}
