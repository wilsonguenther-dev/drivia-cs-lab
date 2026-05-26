/**
 * Per-problem mastery state + spaced-repetition queue.
 * All state is localStorage-backed — keyed by `${slug}:${problemIdx}`.
 *
 * Mastery levels (worst → best):
 *   missed             — user wrong, hit Reveal, or AI walkthrough opened
 *   right_after_hint   — got it after one or more hints
 *   right_first        — got it on the first try (with no hints)
 *
 * Spaced-repetition:
 *   missed             → due tomorrow
 *   right_after_hint   → due in 3 days
 *   right_first conf>=4 → due in 7 days, next cycle doubles interval
 *   right_first conf<=2 → due in 2 days
 *
 * Confidence (1-5) is captured AFTER a correct answer.
 */

export type MasteryLevel =
  | "unseen"
  | "missed"
  | "right_after_hint"
  | "right_first";

export interface ProblemMastery {
  level: MasteryLevel;
  attempts: number;
  hintsUsed: number;
  walkthroughOpened: boolean;
  lastSeen: number;       // epoch ms
  nextDue: number;        // epoch ms
  intervalDays: number;   // current SR interval
  confidence: number;     // 1-5 (0 = never rated)
}

import { emitBus } from "./cache";

const KEY = "drivia.cs.lab.mastery.v1";
const STREAK_KEY = "drivia.cs.lab.streak.v1";

const DAY = 24 * 60 * 60 * 1000;

function load(): Record<string, ProblemMastery> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function save(state: Record<string, ProblemMastery>): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}
function keyOf(slug: string, idx: number): string {
  return `${slug}:${idx}`;
}
function blank(): ProblemMastery {
  return {
    level: "unseen",
    attempts: 0,
    hintsUsed: 0,
    walkthroughOpened: false,
    lastSeen: 0,
    nextDue: 0,
    intervalDays: 0,
    confidence: 0,
  };
}

export function getMastery(slug: string, idx: number): ProblemMastery {
  const state = load();
  return state[keyOf(slug, idx)] ?? blank();
}

export function recordAttempt(slug: string, idx: number): void {
  const state = load();
  const k = keyOf(slug, idx);
  const m = state[k] ?? blank();
  m.attempts++;
  m.lastSeen = Date.now();
  state[k] = m;
  save(state);
  bumpStreak();
}

export function recordHint(slug: string, idx: number): void {
  const state = load();
  const k = keyOf(slug, idx);
  const m = state[k] ?? blank();
  m.hintsUsed++;
  m.lastSeen = Date.now();
  state[k] = m;
  save(state);
  bumpStreak();
}

export function recordCorrect(slug: string, idx: number, confidence = 0): void {
  const state = load();
  const k = keyOf(slug, idx);
  const m = state[k] ?? blank();
  const now = Date.now();
  m.lastSeen = now;
  m.confidence = confidence || m.confidence;
  // Determine new mastery + next-due interval
  if (m.hintsUsed === 0 && !m.walkthroughOpened && m.level !== "missed") {
    m.level = "right_first";
    const conf = confidence >= 1 ? confidence : 3;
    const base = m.intervalDays > 0 ? m.intervalDays : 2;
    m.intervalDays = conf >= 4 ? base * 2 : conf <= 2 ? Math.max(2, base) : Math.max(3, Math.round(base * 1.5));
    m.nextDue = now + m.intervalDays * DAY;
  } else {
    m.level = m.walkthroughOpened ? "missed" : "right_after_hint";
    m.intervalDays = m.walkthroughOpened ? 1 : 3;
    m.nextDue = now + m.intervalDays * DAY;
  }
  state[k] = m;
  save(state);
  bumpStreak();
}

export function recordRevealOrWalkthrough(slug: string, idx: number): void {
  const state = load();
  const k = keyOf(slug, idx);
  const m = state[k] ?? blank();
  m.walkthroughOpened = true;
  m.level = "missed";
  m.intervalDays = 1;
  m.nextDue = Date.now() + DAY;
  m.lastSeen = Date.now();
  state[k] = m;
  save(state);
  bumpStreak();
}

export interface DueItem {
  slug: string;
  idx: number;
  daysOverdue: number;
}

/** All items due now or earlier, oldest-first. */
export function getDueItems(): DueItem[] {
  const state = load();
  const now = Date.now();
  return Object.entries(state)
    .filter(([, m]) => m.nextDue > 0 && m.nextDue <= now)
    .map(([k, m]) => {
      const [slug, idxS] = k.split(":");
      return { slug, idx: parseInt(idxS, 10), daysOverdue: Math.max(0, (now - m.nextDue) / DAY) };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/** Mastery counts per chapter slug — useful for visual progress. */
export function masteryByChapter(slug: string, total: number): {
  unseen: number; missed: number; right_after_hint: number; right_first: number;
} {
  const state = load();
  const counts = { unseen: 0, missed: 0, right_after_hint: 0, right_first: 0 };
  for (let i = 0; i < total; i++) {
    const m = state[keyOf(slug, i)];
    counts[m?.level ?? "unseen"]++;
  }
  return counts;
}

// ─── Streak ─────────────────────────────────────────────────────────────
interface Streak { count: number; lastDay: string; longest: number; }
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function loadStreak(): Streak {
  try {
    const s = JSON.parse(localStorage.getItem(STREAK_KEY) || "{}");
    return { count: s.count ?? 0, lastDay: s.lastDay ?? "", longest: s.longest ?? 0 };
  } catch {
    return { count: 0, lastDay: "", longest: 0 };
  }
}
function saveStreak(s: Streak): void {
  try { localStorage.setItem(STREAK_KEY, JSON.stringify(s)); } catch {}
}
export function bumpStreak(): void {
  const s = loadStreak();
  const today = todayKey();
  if (s.lastDay === today) return;
  // Yesterday?
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yKey = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`;
  if (s.lastDay === yKey) {
    s.count++;
  } else {
    s.count = 1;
  }
  if (s.count > s.longest) s.longest = s.count;
  s.lastDay = today;
  saveStreak(s);
  try { emitBus({ type: "streak-bump" }); } catch {}
}
export function getStreak(): Streak { return loadStreak(); }
