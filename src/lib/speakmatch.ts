/**
 * Smart sentence matcher for SpeakBack — handles the cases that bit Wilson:
 *
 *   • Plurals & inflections — "test" ≡ "tests" ≡ "testing" ≡ "tested"
 *   • Acronyms in parens — "TDD (Test-Driven Development)" accepts any of:
 *       "TDD", "Test-Driven Development", "TDD Test-Driven Development".
 *   • Slash alternates — "Mock / Stub / Spy / Fake" accepts ANY of the four,
 *     or several, or all in any order.
 *   • "X vs Y" — accept either side, or both.
 *   • Em-dash / en-dash variants.
 *   • Contractions — "don't" ≡ "do not".
 *   • Common CS-domain abbreviations.
 *
 * Scoring: word-level edit distance (70%) blended with token-set overlap (30%),
 * computed against EVERY acceptable form of the target. We return the BEST
 * score and the form that produced it (for per-word diff display).
 */

// ─── Stemming (light, not Porter) ─────────────────────────────────────────
function stem(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";       // studies → study
  if (w.endsWith("ied")) return w.slice(0, -3) + "y";       // studied → study
  if (w.endsWith("ying")) return w.slice(0, -4) + "y";      // studying → study
  if (/(?:[sxz]es|[cs]hes)$/.test(w)) return w.slice(0, -2); // boxes → box, churches → church
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3); // running → runn
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);  // tested → test
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1); // tests → test
  return w;
}

// ─── Contractions & domain synonyms ──────────────────────────────────────
const CONTRACTIONS: Record<string, string> = {
  "don't": "do not", "doesn't": "does not", "didn't": "did not",
  "won't": "will not", "wouldn't": "would not", "shouldn't": "should not",
  "can't": "can not", "couldn't": "could not", "isn't": "is not",
  "aren't": "are not", "wasn't": "was not", "weren't": "were not",
  "haven't": "have not", "hasn't": "has not", "hadn't": "had not",
  "you're": "you are", "they're": "they are", "we're": "we are",
  "it's": "it is", "that's": "that is", "what's": "what is",
  "i'm": "i am", "i've": "i have", "i'll": "i will", "i'd": "i would",
  "let's": "let us",
};

// CS-domain abbreviations that often clash with their spoken-out form.
// Speech recognition will usually return the spoken form ("oop" vs "o o p" vs
// "object oriented programming"); we accept any of them.
const DOMAIN_SYNONYMS: Record<string, string[]> = {
  "tdd": ["test driven development"],
  "test driven development": ["tdd"],
  "ci": ["continuous integration"],
  "cd": ["continuous deployment", "continuous delivery"],
  "oop": ["object oriented programming"],
  "fp": ["functional programming"],
  "dry": ["do not repeat yourself", "dont repeat yourself"],
  "kiss": ["keep it simple stupid"],
  "yagni": ["you aint gonna need it", "you arent gonna need it"],
  "rest": ["representational state transfer"],
  "crud": ["create read update delete"],
  "acid": ["atomicity consistency isolation durability"],
  "cap": ["consistency availability partition tolerance"],
  "rls": ["row level security"],
  "sql": ["structured query language", "ess que el", "sequel"],
  "html": ["hypertext markup language"],
  "css": ["cascading style sheets"],
  "json": ["javascript object notation"],
  "api": ["application programming interface"],
  "url": ["uniform resource locator"],
  "uri": ["uniform resource identifier"],
  "tcp": ["transmission control protocol"],
  "ip": ["internet protocol"],
  "tls": ["transport layer security"],
  "ssl": ["secure sockets layer"],
  "dns": ["domain name system"],
  "http": ["hypertext transfer protocol"],
  "https": ["hypertext transfer protocol secure"],
  "jwt": ["json web token"],
  "oauth": ["open authorization"],
  "xss": ["cross site scripting"],
  "csrf": ["cross site request forgery"],
  "owasp": ["open web application security project"],
  "mttr": ["mean time to recovery", "mean time to repair"],
  "mtbf": ["mean time between failures"],
  "sla": ["service level agreement"],
  "slo": ["service level objective"],
  "sli": ["service level indicator"],
  "sev": ["severity"],
  "rfc": ["request for comments"],
  "mvp": ["minimum viable product"],
  "pr": ["pull request"],
  "ssr": ["server side rendering"],
  "ssg": ["static site generation"],
  "isr": ["incremental static regeneration"],
  "csr": ["client side rendering"],
  "cdn": ["content delivery network"],
  "llm": ["large language model"],
  "cot": ["chain of thought"],
  "rag": ["retrieval augmented generation"],
  "rlhf": ["reinforcement learning from human feedback"],
  "e2e": ["end to end", "end to end test"],
  "di": ["dependency injection"],
  "mvc": ["model view controller"],
  "lifo": ["last in first out"],
  "fifo": ["first in first out"],
  "n+1": ["n plus one"],
  "dfa": ["deterministic finite automaton"],
  "nfa": ["nondeterministic finite automaton"],
  "np": ["nondeterministic polynomial"],
  "p": ["polynomial time"],
};

// ─── Normalize a string into a token stream ──────────────────────────────
export function normalize(s: string): string {
  // Expand contractions before stripping apostrophes
  let out = s.toLowerCase();
  for (const [k, v] of Object.entries(CONTRACTIONS)) {
    out = out.split(k).join(v);
  }
  return out
    .replace(/[^a-z0-9 +'-]+/g, " ")
    .replace(/['-]/g, "")          // drop apostrophes after contraction expansion
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean).map(stem);
}

// ─── Expand a target string into all acceptable forms ────────────────────
export function expandForms(target: string): string[] {
  const out = new Set<string>();
  const trimmed = target.trim();
  if (!trimmed) return [];
  out.add(trimmed);

  // Strip "(X)" parentheticals — both base and paren content are acceptable,
  // as is the combined "base X" / "X base".
  const paren = trimmed.match(/^([^()]+?)\s*\(([^)]+)\)\s*(.*)$/);
  if (paren) {
    const base = `${paren[1].trim()} ${paren[3].trim()}`.trim();
    const inner = paren[2].trim();
    out.add(base);
    out.add(inner);
    out.add(`${base} ${inner}`);
    out.add(`${inner} ${base}`);
  }

  // Slash alternates — any one or any combination is acceptable.
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/").map((p) => p.trim()).filter(Boolean);
    parts.forEach((p) => out.add(p));
    // Combined form (no slashes)
    out.add(parts.join(" "));
  }

  // "X vs Y" — either side is acceptable.
  const vs = trimmed.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (vs) {
    out.add(vs[1].trim());
    out.add(vs[2].trim());
    out.add(`${vs[1].trim()} ${vs[2].trim()}`);
  }

  // Em-dash / en-dash separated alternates ("Mock — Stub" etc.)
  if (/[—–]/.test(trimmed)) {
    trimmed.split(/[—–]/).forEach((p) => out.add(p.trim()));
  }

  // Apply domain-synonym expansion: if the normalized base matches a known
  // acronym/expansion key, add every synonym as an acceptable form.
  const seeded = Array.from(out);
  for (const f of seeded) {
    const norm = normalize(f);
    const syns = DOMAIN_SYNONYMS[norm];
    if (syns) syns.forEach((s) => out.add(s));
    // Also try the stripped-paren form keyed by inner-only
    const innerNorm = normalize(f.replace(/[()]/g, " "));
    const syns2 = DOMAIN_SYNONYMS[innerNorm];
    if (syns2) syns2.forEach((s) => out.add(s));
  }

  return Array.from(out);
}

// ─── Word-level edit distance ────────────────────────────────────────────
function wordEditDistance(a: string[], b: string[]): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0]; dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const tmp = dp[i];
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i - 1], dp[i]);
      prev = tmp;
    }
  }
  return dp[a.length];
}

// ─── Score a single form ─────────────────────────────────────────────────
function scoreOne(targetTokens: string[], heardTokens: string[]): number {
  if (!targetTokens.length || !heardTokens.length) return 0;
  const editSim = 1 - wordEditDistance(targetTokens, heardTokens) / Math.max(targetTokens.length, heardTokens.length);
  const A = new Set(targetTokens), B = new Set(heardTokens);
  let inter = 0; A.forEach((t) => { if (B.has(t)) inter++; });
  const setSim = inter / Math.max(A.size, B.size);
  // Bonus when heard is a clean superset of target (e.g., "TDD test driven
  // development" against target "TDD"): full credit.
  let supersetBonus = 0;
  if (targetTokens.every((t) => B.has(t))) supersetBonus = 0.15;
  return Math.min(1, editSim * 0.6 + setSim * 0.4 + supersetBonus);
}

// ─── Public: best score across all forms ─────────────────────────────────
export interface SpeakMatchResult {
  score: number;            // 0-100
  bestForm: string;         // human-readable form of the target that scored best
  matchedTokenIdx: Set<number>;   // indices into `targetTokens(bestForm)` that matched
  heardMatchedIdx: Set<number>;   // indices into tokens(heard) that matched
  heardTokens: string[];
  targetTokens: string[];
}

export function scoreSpeakBack(target: string, heard: string): SpeakMatchResult {
  const forms = expandForms(target);
  const heardTok = tokens(heard);
  let best: { score: number; form: string; targetTok: string[] } = { score: 0, form: target, targetTok: tokens(target) };
  for (const f of forms) {
    const tt = tokens(f);
    const s = scoreOne(tt, heardTok);
    if (s > best.score) best = { score: s, form: f, targetTok: tt };
  }
  // LCS backtrace against best form for per-word diff
  const a = best.targetTok, b = heardTok;
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  }
  const matched: { ai: number; bi: number }[] = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { matched.push({ ai: i - 1, bi: j - 1 }); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--;
  }
  return {
    score: Math.round(best.score * 100),
    bestForm: best.form,
    matchedTokenIdx: new Set(matched.map((p) => p.ai)),
    heardMatchedIdx: new Set(matched.map((p) => p.bi)),
    heardTokens: heardTok,
    targetTokens: a,
  };
}

// ─── Per-word diff markup ────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function speakDiffMarkup(target: string, heard: string): string {
  const r = scoreSpeakBack(target, heard);
  const heardLine = r.heardTokens.map((t, k) => r.heardMatchedIdx.has(k)
    ? `<span class="word-ok">${esc(t)}</span>`
    : `<span class="word-bad">${esc(t)}</span>`).join(" ");
  const missed = r.targetTokens.filter((_, k) => !r.matchedTokenIdx.has(k));
  const missedLine = missed.length
    ? `<div class="sb-missed">Missed: ${missed.map((t) => `<span class="word-missed">${esc(t)}</span>`).join(" ")}</div>`
    : "";
  const formNote = r.bestForm !== target
    ? `<div class="sb-form-note">scored against: <em>${esc(r.bestForm)}</em></div>`
    : "";
  return `<div>Heard: ${heardLine}</div>${missedLine}${formNote}`;
}
