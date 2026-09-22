// Shared LLM classification step, reused by CP38 (UAT sign-off) and CP10
// (CAB approval) — both need the exact same narrow judgment: does this email
// body contain EXPLICIT approval language, or not. Never used for identity —
// callers must already have deterministically verified the sender first.
export type ApprovalClassification = { explicit: boolean; confidence: number };

export async function classifyApprovalLanguage(
  body: string,
  subjectForContext: string,
): Promise<{ ok: true; value: ApprovalClassification } | { ok: false; error: string }> {
  // Uses Groq's free-tier hosting of OpenAI's open-weight gpt-oss model via
  // an OpenAI-compatible chat completions API — no paid API required.
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Missing GROQ_API_KEY on the server (.env). Get a free key at console.groq.com." };
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        temperature: 0,
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content:
              `You classify a single email body (subject: "${subjectForContext}") for explicit approval/sign-off evidence. ` +
              'Reply with EXACTLY one line of strict JSON, no other text: {"explicit": boolean, "confidence": number} ' +
              "where confidence is 0-100. " +
              '"explicit" is true only if the email clearly and unconditionally confirms approval/sign-off ' +
              '(e.g. "approved for implementation", "UAT passed, approved for go-live", "I sign off on this release"). ' +
              '"explicit" is false for anything vague, conditional, a question, a partial approval, or unrelated content.',
          },
          { role: "user", content: body.slice(0, 6000) || "(empty email body)" },
        ],
      }),
    });
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message: string };
    };

    if (!res.ok) {
      return { ok: false, error: data.error?.message ?? `Groq API error (HTTP ${res.status}).` };
    }

    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    const match = text.match(/\{[^{}]*\}/);
    if (!match) {
      // Parse failure is treated as "couldn't confirm explicit language" —
      // the safe default, never silently promoted to Compliant.
      return { ok: true, value: { explicit: false, confidence: 0 } };
    }
    const parsed = JSON.parse(match[0]) as { explicit?: unknown; confidence?: unknown };
    return {
      ok: true,
      value: {
        explicit: parsed.explicit === true,
        confidence: typeof parsed.confidence === "number" ? Math.round(parsed.confidence) : 0,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to classify approval language." };
  }
}
