/**
 * POST /api/explain — Gemini 2.5 Flash tutor endpoint.
 *
 * Returns either:
 *   - {steps:[{title, math, explanation},...], lesson} for mode="walkthrough"
 *   - {hint:"..."} for mode="hint"
 *   - {concept:"..."} for mode="concept" (asks: why does this formula matter?)
 *
 * Server-only — never exposed to the browser.
 */
import type { APIRoute } from "astro";

export const prerender = false;

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

interface ExplainBody {
  prompt: string;
  answer: string;
  solution: string;
  slug: string;
  formulaTitle: string;
  mode: "walkthrough" | "hint" | "concept";
  hintLevel?: 1 | 2 | 3;
  userAttempt?: string;
}

function buildPrompt(b: ExplainBody): string {
  if (b.mode === "hint") {
    const level = b.hintLevel ?? 1;
    const guide =
      level === 1
        ? "a CONCEPTUAL nudge: name the technique without doing it"
        : level === 2
          ? "the FIRST concrete step of the calculation, but don't finish"
          : "near-final guidance, leaving only the last arithmetic for the student";
    return `You are Wilson's math tutor at Drivia. Wilson is solving:
PROBLEM: ${b.prompt}
CANONICAL ANSWER (do NOT reveal): ${b.answer}
${b.userAttempt ? `WILSON'S ATTEMPT (might be wrong): ${b.userAttempt}` : ""}

Give ONE hint at level ${level} (${guide}).
Output STRICT JSON only: {"hint":"<one to two short sentences>"}`;
  }
  if (b.mode === "concept") {
    return `You are Wilson's math tutor at Drivia. He is studying ${b.formulaTitle} (chapter: ${b.slug}).
Explain in 2-3 sentences: why does this formula matter in real machine learning? What problem does it solve? Use one concrete example (e.g. "in image classification you use this when..."). Talk to Wilson like a smart 19-year-old, not a math professor.
Output STRICT JSON only: {"concept":"<2-3 sentences>"}`;
  }
  // walkthrough
  return `You are Wilson's math tutor at Drivia. Wilson is studying ${b.formulaTitle} (chapter: ${b.slug}). He just attempted:

PROBLEM: ${b.prompt}
CANONICAL ANSWER: ${b.answer}
ONE-LINE SOLUTION HINT: ${b.solution}
${b.userAttempt ? `WILSON'S ATTEMPT: ${b.userAttempt}` : ""}

Walk Wilson through the FULL solution in 4-7 numbered baby steps. Each step has:
- "title": short summary under 60 chars
- "math": LaTeX of the current state, formatted EXACTLY like "$<expression>$" (single dollars, inline)
- "explanation": 1-2 plain-English sentences talking to a smart 19-year-old, explaining WHY this step

Include EVERY arithmetic substitution. If the final value needs rounding to N decimals, show the unrounded value first, then explain the rounding.

End with a "lesson" field: ONE sentence summarizing the technique Wilson should remember.

Output STRICT JSON only. No preamble. Shape:
{"steps":[{"title":"...","math":"$...$","explanation":"..."}, ...], "lesson":"..."}`;
}

export const POST: APIRoute = async ({ request }) => {
  // @ts-ignore — Astro injects import.meta.env at runtime
  const key = (import.meta as any).env?.GEMINI_API_KEY || (globalThis as any).process?.env?.GEMINI_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: ExplainBody;
  try {
    body = (await request.json()) as ExplainBody;
  } catch {
    return new Response(JSON.stringify({ error: "bad json" }), { status: 400 });
  }
  if (!body?.prompt || !body?.mode) {
    return new Response(JSON.stringify({ error: "missing required fields" }), { status: 400 });
  }

  const prompt = buildPrompt(body);
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
          maxOutputTokens: 1600,
        },
      }),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: `fetch failed: ${(e as Error).message}` }), {
      status: 502,
    });
  }

  if (!res.ok) {
    const text = await res.text();
    return new Response(
      JSON.stringify({ error: `gemini ${res.status}: ${text.slice(0, 400)}` }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const txt = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  // Gemini occasionally wraps JSON in ```json fences despite responseMimeType.
  const cleaned = txt
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  let payload: unknown;
  try {
    payload = JSON.parse(cleaned);
  } catch {
    // Last-ditch: try to find the first {...} block
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { payload = JSON.parse(m[0]); } catch { payload = { error: "parse failed", raw: cleaned.slice(0, 600) }; }
    } else {
      payload = { error: "parse failed", raw: cleaned.slice(0, 600) };
    }
  }
  return new Response(
    JSON.stringify({ ...((payload as object) ?? {}), latencyMs: Date.now() - t0 }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
