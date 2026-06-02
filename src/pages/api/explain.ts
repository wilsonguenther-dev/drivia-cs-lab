/**
 * POST /api/explain - local Q-learning tutor.
 *
 * This is intentionally not an AI-provider proxy. It spends $0, has no
 * provider key dependency, and returns the same JSON shapes the lab UI expects.
 */
import type { APIRoute } from "astro";

export const prerender = false;

type Mode = "walkthrough" | "hint" | "concept";
type TutorAction = "concept-nudge" | "first-step" | "worked-example" | "attempt-compare";
type QTable = Record<TutorAction, number>;

interface ExplainBody {
  prompt: string;
  answer: string;
  solution: string;
  slug: string;
  formulaTitle: string;
  mode: Mode;
  hintLevel?: 1 | 2 | 3;
  userAttempt?: string;
}

type CatchResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; code: string; message: string };

const ALPHA = 0.35;
const GAMMA = 0.7;
const MODES = new Set<Mode>(["walkthrough", "hint", "concept"]);

const BASE_Q: Record<Mode, QTable> = {
  hint: {
    "concept-nudge": 0.9,
    "first-step": 0.65,
    "worked-example": 0.25,
    "attempt-compare": 0.45,
  },
  walkthrough: {
    "concept-nudge": 0.25,
    "first-step": 0.55,
    "worked-example": 0.95,
    "attempt-compare": 0.7,
  },
  concept: {
    "concept-nudge": 0.95,
    "first-step": 0.25,
    "worked-example": 0.45,
    "attempt-compare": 0.2,
  },
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function catchUnknownError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "unknown endpoint failure";
  return jsonResponse({ error: "tutor_failed", message }, 500);
}

async function catchJsonBody(request: Request): Promise<CatchResult<unknown>> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false, status: 400, code: "bad_json", message: "Request body must be valid JSON." };
  }
}

function catchExplainBody(value: unknown): CatchResult<ExplainBody> {
  if (!value || typeof value !== "object") {
    return { ok: false, status: 400, code: "bad_payload", message: "Request body must be an object." };
  }

  const body = value as Partial<ExplainBody>;
  if (typeof body.prompt !== "string" || !body.prompt.trim()) {
    return { ok: false, status: 400, code: "missing_prompt", message: "Missing prompt." };
  }
  if (typeof body.mode !== "string" || !MODES.has(body.mode as Mode)) {
    return { ok: false, status: 400, code: "bad_mode", message: "Mode must be hint, concept, or walkthrough." };
  }

  return {
    ok: true,
    value: {
      prompt: catchText(body.prompt),
      answer: catchText(body.answer),
      solution: catchText(body.solution, "Apply the definition, substitute the values, then simplify."),
      slug: catchText(body.slug, "current-topic"),
      formulaTitle: catchText(body.formulaTitle, "this topic"),
      mode: body.mode as Mode,
      hintLevel: body.hintLevel === 2 || body.hintLevel === 3 ? body.hintLevel : 1,
      userAttempt: catchText(body.userAttempt),
    },
  };
}

function catchText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.replace(/\s+/g, " ").trim() || fallback;
}

function catchMath(value: unknown): string {
  const text = catchText(value, "\\text{Use the given information.}");
  if (text.startsWith("$") && text.endsWith("$")) return text;
  return `$${text.replace(/\$/g, "")}$`;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.+\-/*=]/g, "");
}

function scoreAttempt(body: ExplainBody): number {
  if (!body.userAttempt) return body.mode === "hint" ? 0.15 : 0.05;
  if (body.answer && normalize(body.userAttempt).includes(normalize(body.answer))) return 1;
  if (body.userAttempt.length > 3) return 0.45;
  return 0.1;
}

function updateQValue(current: number, reward: number, bestFuture: number): number {
  return Number((current + ALPHA * (reward + GAMMA * bestFuture - current)).toFixed(3));
}

function chooseAction(body: ExplainBody): { action: TutorAction; q: QTable } {
  const q: QTable = { ...BASE_Q[body.mode] };
  if (body.hintLevel === 2) q["first-step"] += 0.25;
  if (body.hintLevel === 3) q["attempt-compare"] += 0.3;
  if (body.userAttempt) q["attempt-compare"] += 0.2;

  const reward = scoreAttempt(body);
  const bestFuture = Math.max(...Object.values(q));
  for (const action of Object.keys(q) as TutorAction[]) {
    q[action] = updateQValue(q[action], reward, bestFuture);
  }

  const action = (Object.entries(q) as Array<[TutorAction, number]>)
    .sort((left, right) => right[1] - left[1])[0][0];
  return { action, q };
}

function buildHint(body: ExplainBody, action: TutorAction): string {
  const attemptMatches = body.userAttempt && body.answer && normalize(body.userAttempt).includes(normalize(body.answer));
  if (attemptMatches) {
    return "Your answer is lining up with the target. Now make sure you can explain the step that got you there.";
  }
  if (action === "attempt-compare" && body.userAttempt) {
    return `Compare your attempt against the known path: ${body.solution} Look for the first place your expression changes shape.`;
  }
  if ((body.hintLevel ?? 1) <= 1) {
    return `Use the core move for ${body.formulaTitle}: identify the inputs, then apply the definition before doing arithmetic.`;
  }
  if (body.hintLevel === 2 || action === "first-step") {
    return `Start here: ${body.solution} Do only that first move before trying to finish the whole problem.`;
  }
  return `You are close enough for a worked nudge: follow "${body.solution}", then check whether the simplified result matches ${body.answer || "the target answer"}.`;
}

function buildConcept(body: ExplainBody): string {
  const chapter = body.slug.replace(/-/g, " ");
  return `${body.formulaTitle} matters because it gives you a repeatable move instead of a guess. In ${chapter}, the point is to turn a messy question into a small set of inputs, operations, and checks. That is what production ML and software systems need: a method you can rerun, debug, and trust.`;
}

function buildWalkthrough(body: ExplainBody, action: TutorAction) {
  const steps = [
    {
      title: "Name the target",
      math: catchMath(body.prompt),
      explanation: "First pin down what the problem is asking for. The goal is not to guess; it is to choose the right operation.",
    },
    {
      title: "Use the known path",
      math: catchMath(body.solution),
      explanation: "The lab already gives the canonical route. Treat that as the recipe: substitute the inputs, then simplify one move at a time.",
    },
  ];

  if (action === "attempt-compare" && body.userAttempt) {
    steps.push({
      title: "Compare your attempt",
      math: catchMath(body.userAttempt),
      explanation: "Now compare your work to the canonical route. The first mismatch is the exact place to slow down.",
    });
  }

  steps.push(
    {
      title: "Check the result",
      math: catchMath(body.answer || "final answer"),
      explanation: "The final value has to match the target answer and the shape of the original question. If the units or dimensions changed unexpectedly, redo the previous step.",
    },
    {
      title: "Lock the pattern",
      math: catchMath(`${body.formulaTitle} \\rightarrow ${body.answer || "result"}`),
      explanation: "The point is the pattern, not this one answer. Learn the move so the next version of the problem feels familiar.",
    },
  );

  return {
    steps,
    lesson: `For ${body.formulaTitle}, slow down at the definition, substitute cleanly, and use the answer check as feedback.`,
  };
}

async function catchTutorResponse(request: Request): Promise<Response> {
  const parsed = await catchJsonBody(request);
  if (!parsed.ok) return jsonResponse({ error: parsed.code, message: parsed.message }, parsed.status);

  const bodyResult = catchExplainBody(parsed.value);
  if (!bodyResult.ok) return jsonResponse({ error: bodyResult.code, message: bodyResult.message }, bodyResult.status);

  const startedAt = Date.now();
  const body = bodyResult.value;
  const { action, q } = chooseAction(body);
  const meta = {
    provider: "local-q-learning",
    action,
    q,
    latencyMs: Date.now() - startedAt,
  };

  if (body.mode === "hint") return jsonResponse({ ...meta, hint: buildHint(body, action) });
  if (body.mode === "concept") return jsonResponse({ ...meta, concept: buildConcept(body) });
  return jsonResponse({ ...meta, ...buildWalkthrough(body, action) });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    return await catchTutorResponse(request);
  } catch (error) {
    return catchUnknownError(error);
  }
};
