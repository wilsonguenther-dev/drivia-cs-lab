/**
 * Drivia CS Lab v1 — client runtime.
 *
 * Architecture parity with Formula Lab v6:
 *   • Persistent IDB blob cache + Kokori TTS pipeline
 *   • SpeakBack v2 (sentence-grade, smart matcher)
 *   • StudyTimer (count-up today + lifetime, cross-tab synced)
 *   • Mastery toggle per topic, chapter pills mark mastered at 80%
 *   • Step-by-step animation with KaTeX swap + Kokori narration
 *   • Flashcard quiz overlay
 */
import "katex/dist/katex.min.css";
import confettiFn from "canvas-confetti";
import { kvGet, kvSet, blobGet, blobSet, onBus, emitBus } from "../lib/cache";
import { getStreak, bumpStreak } from "../lib/mastery";
import { scoreSpeakBack, speakDiffMarkup } from "../lib/speakmatch";
import { TOPICS, CHAPTERS } from "../data/cs";
import { fetchTTSBlob, webSpeechSpeak, getTTSConfig, type SpeechHandle } from "../lib/tts";

declare global { interface Window { confetti?: typeof confettiFn } }
if (typeof window !== "undefined" && !window.confetti) window.confetti = confettiFn;

// ──────────────────────────────────────────────────────────────────────
// AUDIO BUS + TTS ADAPTER
// ──────────────────────────────────────────────────────────────────────
const memCache: Record<string, string> = {};

async function hashKey(text: string): Promise<string> {
  const cfg = getTTSConfig();
  const enc = new TextEncoder().encode(`${cfg.backend}|${cfg.voice}|${text}`);
  try {
    const buf = await crypto.subtle.digest("SHA-1", enc);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 0x811c9dc5;
    for (let i = 0; i < enc.length; i++) { h ^= enc[i]; h = (h * 0x01000193) >>> 0; }
    return `fnv${h.toString(16)}`;
  }
}

let __webSpeechCurrent: SpeechHandle | null = null;

interface BusSource { audio: HTMLAudioElement; onStop: (() => void) | null; tag: string }
const AudioBus = {
  current: null as BusSource | null,
  paused: false,
  stop(): void {
    if (__webSpeechCurrent) {
      try { __webSpeechCurrent.stop(); } catch {}
      __webSpeechCurrent = null;
    }
    const c = this.current; if (!c) return;
    this.current = null; this.paused = false;
    try { c.audio.pause(); } catch {}
    c.audio.onended = null; c.audio.onerror = null;
    if (c.audio.src.startsWith("blob:")) { try { URL.revokeObjectURL(c.audio.src); } catch {} }
    c.audio.src = "";
    try { c.onStop?.(); } catch {}
    this.refreshBadge();
  },
  togglePause(): void {
    const c = this.current; if (!c) return;
    if (this.paused) { c.audio.play().catch(() => {}); this.paused = false; }
    else { c.audio.pause(); this.paused = true; }
    this.refreshBadge();
  },
  play(url: string, opts?: { onStop?: () => void; tag?: string }): Promise<void> {
    this.stop();
    return new Promise((resolve) => {
      const audio = new Audio(url);
      const src: BusSource = { audio, onStop: () => { try { opts?.onStop?.(); } catch {} resolve(); }, tag: opts?.tag || "" };
      this.current = src; this.paused = false;
      const cleanup = () => {
        if (this.current?.audio === audio) { this.current = null; this.paused = false; this.refreshBadge(); }
        resolve();
      };
      audio.onended = cleanup; audio.onerror = cleanup;
      this.refreshBadge();
      audio.play().catch(cleanup);
    });
  },
  refreshBadge(): void {
    const badge = document.getElementById("g-audio-stop");
    if (!badge) return;
    if (this.current) {
      badge.style.display = "";
      badge.textContent = this.paused ? "▶ Resume audio" : "■ Stop audio";
    } else badge.style.display = "none";
  },
};
(globalThis as any).__audio = AudioBus;

async function tryFetchLiveTTS(text: string): Promise<string | null> {
  const controller = new AbortController();
  const tHandle = setTimeout(() => controller.abort(), 12000);
  try {
    const blob = await fetchTTSBlob(text, controller.signal);
    clearTimeout(tHandle);
    if (!blob) return null;
    void hashKey(text).then((k) => blobSet(k, blob));
    return URL.createObjectURL(blob);
  } catch (e) {
    clearTimeout(tHandle);
    console.warn("TTS backend unavailable:", e);
    return null;
  }
}

async function fetchAudio(cacheKey: string, text: string): Promise<string | null> {
  if (memCache[cacheKey]) return memCache[cacheKey];
  const k = await hashKey(text);
  const cached = await blobGet(k);
  if (cached) { const u = URL.createObjectURL(cached); memCache[cacheKey] = u; return u; }
  const live = await tryFetchLiveTTS(text);
  if (live) memCache[cacheKey] = live;
  return live;
}

/**
 * Unified speak helper. For Web Speech backend, plays via SpeechSynthesis
 * (no blob, no cache). For URL-based backends, fetches a blob and routes
 * it through AudioBus. Always single-playback — starting one cancels the
 * previous one regardless of backend.
 */
async function speakViaConfig(
  cacheKey: string,
  text: string,
  opts: { tag: string; onStop?: () => void } = { tag: "" },
  onUnavailable?: () => void,
): Promise<void> {
  const cfg = getTTSConfig();
  if (cfg.backend === "webspeech") {
    AudioBus.stop();
    __webSpeechCurrent = webSpeechSpeak(text, cfg);
    try {
      await __webSpeechCurrent.ended;
    } finally {
      __webSpeechCurrent = null;
      try { opts.onStop?.(); } catch {}
    }
    return;
  }
  const url = await fetchAudio(cacheKey, text);
  if (!url) { onUnavailable?.(); return; }
  await AudioBus.play(url, opts);
}

function setStatus(idx: number, t: string): void {
  const el = document.getElementById(`st-${idx}`);
  if (el) el.textContent = t;
}

async function hearTopic(idx: number): Promise<void> {
  const topic = TOPICS[idx]; if (!topic) return;
  setStatus(idx, "loading…");
  const text = `${topic.title}. ${topic.plain}`;
  setStatus(idx, "▶ playing");
  await speakViaConfig(
    `topic-${idx}`,
    text,
    { tag: `topic-${idx}`, onStop: () => setStatus(idx, "stopped") },
    () => setStatus(idx, `${getTTSConfig().backend} unavailable — open Settings`),
  );
  setStatus(idx, "ready");
}

// ──────────────────────────────────────────────────────────────────────
// MASTERY
// ──────────────────────────────────────────────────────────────────────
type MasteryMap = Record<string, boolean>;
const MASTERY_KEY = "topicMastery";
function loadMastery(): MasteryMap { return kvGet<MasteryMap>(MASTERY_KEY, {}); }
function saveMastery(m: MasteryMap): void { kvSet(MASTERY_KEY, m); }

function applyMasteryToUI(): void {
  const m = loadMastery();
  let mastered = 0;
  TOPICS.forEach((t, i) => {
    const on = !!m[t.slug];
    if (on) mastered++;
    const card = document.getElementById(`t${i}`);
    if (card) card.classList.toggle("mastered", on);
  });
  const el = document.getElementById("g-mastered");
  if (el) el.textContent = `${mastered} / ${TOPICS.length}`;
  // Chapter pills: mastered when 80%+ of topics are done
  const byChapter: Record<number, { done: number; total: number }> = {};
  TOPICS.forEach((t) => {
    const ch = CHAPTERS.find((c) => c.topics.some((x) => x.slug === t.slug));
    if (!ch) return;
    const b = byChapter[ch.index] || (byChapter[ch.index] = { done: 0, total: 0 });
    b.total++;
    if (m[t.slug]) b.done++;
  });
  for (const [chIdx, c] of Object.entries(byChapter)) {
    const pill = document.getElementById(`pill-${chIdx}`);
    if (pill) pill.classList.toggle("mastered", c.total > 0 && c.done >= Math.ceil(c.total * 0.8));
  }
}

function toggleMastery(idx: number): void {
  const t = TOPICS[idx]; if (!t) return;
  const m = loadMastery();
  m[t.slug] = !m[t.slug];
  if (m[t.slug]) {
    bumpStreak();
    if (window.confetti) window.confetti({ particleCount: 50, spread: 60, origin: { y: 0.75 } });
  }
  saveMastery(m);
  applyMasteryToUI();
  emitBus({ type: "mastery-change" });
}

// ──────────────────────────────────────────────────────────────────────
// STUDY TIMER
// ──────────────────────────────────────────────────────────────────────
interface StudySession { byDay: Record<string, number>; lifetime: number; }
const STUDY_KEY = "study.sessions";
const STREAK_MIN_SECONDS = 5 * 60;
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const TIMER = {
  running: false,
  lastTick: 0,
  sessions: kvGet<StudySession>(STUDY_KEY, { byDay: {}, lifetime: 0 }),
};
function todaySeconds(): number { return TIMER.sessions.byDay[todayISO()] || 0; }
function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function fmtTotal(sec: number): string {
  if (sec < 3600) return `total ${Math.floor(sec / 60)}m`;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return `total ${h}h ${m}m`;
}
function renderTimer(): void {
  const clock = document.getElementById("st-clock");
  const total = document.getElementById("st-total");
  const go = document.getElementById("st-go");
  const t = todaySeconds();
  if (clock) {
    clock.textContent = fmtClock(t);
    const milestone = t >= STREAK_MIN_SECONDS;
    clock.className = "st-clock" + (TIMER.running ? " running" : "") + (milestone ? " milestone" : "");
  }
  if (total) total.textContent = fmtTotal(TIMER.sessions.lifetime);
  if (go) { go.textContent = TIMER.running ? "⏸" : "▶"; go.classList.toggle("running", TIMER.running); }
}
function persistSessions(): void { kvSet(STUDY_KEY, TIMER.sessions); }
function tickTimer(): void {
  if (!TIMER.running) return;
  const now = Date.now();
  const dt = Math.floor((now - TIMER.lastTick) / 1000);
  if (dt <= 0) return;
  TIMER.lastTick = now;
  const day = todayISO();
  TIMER.sessions.byDay[day] = (TIMER.sessions.byDay[day] || 0) + dt;
  TIMER.sessions.lifetime += dt;
  if (TIMER.sessions.byDay[day] >= STREAK_MIN_SECONDS &&
      TIMER.sessions.byDay[day] - dt < STREAK_MIN_SECONDS) {
    bumpStreak();
  }
  persistSessions();
  renderTimer();
  emitBus({ type: "timer-tick", secondsToday: TIMER.sessions.byDay[day], totalSeconds: TIMER.sessions.lifetime });
}
function wireTimer(): void {
  document.getElementById("st-go")?.addEventListener("click", () => {
    TIMER.running = !TIMER.running;
    TIMER.lastTick = Date.now();
    renderTimer();
  });
  document.getElementById("st-rs")?.addEventListener("click", () => {
    if (!confirm("Reset today's study time? Lifetime preserved.")) return;
    TIMER.running = false;
    const d = todayISO();
    const lost = TIMER.sessions.byDay[d] || 0;
    TIMER.sessions.byDay[d] = 0;
    TIMER.sessions.lifetime = Math.max(0, TIMER.sessions.lifetime - lost);
    persistSessions();
    renderTimer();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && TIMER.running) tickTimer();
    TIMER.lastTick = Date.now();
  });
  onBus((e) => {
    if (e._local) {
      if (e.type === "streak-bump") renderStreak();
      if (e.type === "mastery-change") applyMasteryToUI();
      return;
    }
    if (e.type === "timer-tick" || e.type === "streak-bump" || (e.type === "kv-set" && e.key === STUDY_KEY)) {
      TIMER.sessions = kvGet<StudySession>(STUDY_KEY, { byDay: {}, lifetime: 0 });
      renderTimer(); renderStreak();
    }
    if (e.type === "mastery-change" || (e.type === "kv-set" && e.key === MASTERY_KEY)) {
      applyMasteryToUI();
    }
  });
  renderTimer();
  setInterval(tickTimer, 1000);
}
function renderStreak(): void {
  const s = getStreak();
  const el = document.getElementById("g-day-streak");
  if (el) el.textContent = `${s.count}🔥`;
}

// ──────────────────────────────────────────────────────────────────────
// SPEAKBACK v2 (smart matcher)
// ──────────────────────────────────────────────────────────────────────
type SBStore = Record<string, { best: number; lastTranscript: string; lastAt: number }>;
const SB_KEY = "speakback";
function sbState(): SBStore { return kvGet<SBStore>(SB_KEY, {}); }
function sbSave(s: SBStore): void { kvSet(SB_KEY, s); }

function getSbTargets(idx: number): { label: string; text: string }[] {
  const el = document.getElementById(`sb-targets-${idx}`);
  if (!el) return [];
  try { return JSON.parse(el.textContent || "[]"); } catch { return []; }
}
function getSbActiveTarget(idx: number): { label: string; text: string } | null {
  const targets = getSbTargets(idx);
  if (!targets.length) return null;
  const host = document.getElementById(`sb-${idx}`);
  const pick = parseInt(host?.dataset.pick || "0", 10);
  return targets[pick] || targets[0];
}
function renderSbBest(idx: number, label: string): void {
  const best = sbState()[`${idx}:${label}`]?.best ?? 0;
  const el = document.getElementById(`sb-b-${idx}`);
  if (el) el.textContent = best > 0 ? `best ${best}%` : "";
}
function pickSbTarget(idx: number, pickIdx: number): void {
  const host = document.getElementById(`sb-${idx}`);
  if (!host) return;
  host.dataset.pick = String(pickIdx);
  const targets = getSbTargets(idx);
  const t = targets[pickIdx];
  if (!t) return;
  const targetEl = document.getElementById(`sb-target-${idx}`);
  if (targetEl) targetEl.textContent = t.text;
  host.querySelectorAll<HTMLElement>(".sb-pick").forEach((b, i) => b.classList.toggle("active", i === pickIdx));
  const meter = document.getElementById(`sb-m-${idx}`); if (meter) meter.hidden = true;
  const result = document.getElementById(`sb-r-${idx}`);
  if (result) { result.classList.remove("heard"); result.innerHTML = `Tap <b>Hear it first</b> to listen, then <b>Say it back</b>.`; }
  renderSbBest(idx, t.label);
}

interface SRType { new(): SRInstance; }
interface SRInstance extends EventTarget {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
  start(): void; stop(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
}
function getSR(): SRType | null {
  const w = window as any;
  return (w.SpeechRecognition || w.webkitSpeechRecognition) ?? null;
}
const sbActive: Record<number, SRInstance | null> = {};

async function speakBackHear(idx: number): Promise<void> {
  const host = document.getElementById(`sb-${idx}`); if (!host) return;
  const active = getSbActiveTarget(idx);
  const text = active?.text || "";
  await speakViaConfig(
    `sb-${idx}-${active?.label || "default"}`,
    text,
    { tag: `sb-hear-${idx}` },
    () => {
      const r = document.getElementById(`sb-r-${idx}`);
      if (r) r.textContent = `${getTTSConfig().backend} unavailable — open Settings.`;
    },
  );
}

async function speakBackListen(idx: number): Promise<void> {
  const host = document.getElementById(`sb-${idx}`);
  const result = document.getElementById(`sb-r-${idx}`);
  const meter = document.getElementById(`sb-m-${idx}`);
  const fill = document.getElementById(`sb-f-${idx}`);
  const score = document.getElementById(`sb-s-${idx}`);
  const btn = host?.querySelector<HTMLButtonElement>(`button[data-act="sb-listen"]`);
  if (!host || !result || !btn) return;
  if (sbActive[idx]) {
    try { sbActive[idx]!.stop(); } catch {}
    sbActive[idx] = null;
    btn.classList.remove("recording"); btn.textContent = "🎤 SAY IT BACK";
    return;
  }
  const SR = getSR();
  if (!SR) { result.textContent = "Browser doesn't support SpeechRecognition. Use Chrome / Safari."; return; }
  const rec = new SR();
  rec.lang = "en-US"; rec.interimResults = true; rec.maxAlternatives = 3; rec.continuous = true;
  const active = getSbActiveTarget(idx);
  const target = active?.text || "";
  const activeLabel = active?.label || "Target";
  let finalText = "";
  result.classList.remove("heard");
  result.textContent = "Listening — speak now…";
  btn.classList.add("recording"); btn.textContent = "■ STOP";
  rec.onresult = (e: any) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript + " ";
      else interim += r[0].transcript;
    }
    const heard = (finalText + interim).trim();
    if (heard) { result.classList.add("heard"); result.innerHTML = `Heard: ${heard}`; }
  };
  rec.onerror = (e: any) => {
    result.textContent = `Mic error: ${e.error || "unknown"}.`;
    btn.classList.remove("recording"); btn.textContent = "🎤 SAY IT BACK";
    sbActive[idx] = null;
  };
  rec.onend = () => {
    btn.classList.remove("recording"); btn.textContent = "🎤 SAY IT BACK";
    sbActive[idx] = null;
    const heard = finalText.trim();
    if (!heard) { result.textContent = "Nothing heard — try again."; return; }
    const matched = scoreSpeakBack(target, heard);
    const s = matched.score;
    if (meter && fill && score) { meter.hidden = false; fill.style.width = s + "%"; score.textContent = `${s}%`; }
    result.innerHTML = speakDiffMarkup(target, heard);
    const state = sbState();
    const key = `${idx}:${activeLabel}`;
    const prev = state[key]?.best ?? 0;
    state[key] = { best: Math.max(prev, s), lastTranscript: heard, lastAt: Date.now() };
    sbSave(state);
    renderSbBest(idx, activeLabel);
    if (s >= 85) {
      bumpStreak();
      if (window.confetti) window.confetti({ particleCount: 40, spread: 60, origin: { y: 0.75 }, colors: ["#f472b6", "#00d4ff"] });
    }
  };
  sbActive[idx] = rec;
  try { rec.start(); }
  catch (err) {
    result.textContent = `Couldn't start mic: ${(err as Error).message}`;
    btn.classList.remove("recording"); btn.textContent = "🎤 SAY IT BACK";
    sbActive[idx] = null;
  }
}

// ──────────────────────────────────────────────────────────────────────
// ANIMATION (step-by-step with KaTeX swap + Kokori narration)
// ──────────────────────────────────────────────────────────────────────
interface Step { math?: string; mathHtml?: string; text: string }
interface AnimState { running: boolean; currentStep: number; steps: Step[] }
const ANIM: Record<number, AnimState> = {};

function getSteps(idx: number): Step[] | null {
  const el = document.getElementById(`steps-${idx}`);
  if (!el) return null;
  try { return JSON.parse(el.textContent || "null"); } catch { return null; }
}

function renderStep(idx: number, stepIdx: number): void {
  const steps = ANIM[idx]?.steps;
  if (!steps || stepIdx < 0 || stepIdx >= steps.length) return;
  const s = steps[stepIdx];
  const target = document.getElementById(`math-${idx}`);
  const narr = document.getElementById(`narr-${idx}`)!;
  const dots = document.getElementById(`dots-${idx}`)!.children;
  if (target && s.mathHtml) target.innerHTML = s.mathHtml;
  narr.innerHTML = `<em>Step ${stepIdx + 1}/${steps.length}.</em> ${escapeHtml(s.text)}`;
  Array.from(dots).forEach((d, i) => {
    const dEl = d as HTMLElement;
    dEl.classList.toggle("passed",  i <  stepIdx);
    dEl.classList.toggle("current", i === stepIdx);
  });
  ANIM[idx].currentStep = stepIdx;
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function stopAnim(idx: number): void {
  const a = ANIM[idx]; if (!a) return;
  a.running = false;
  AudioBus.stop();
}
async function speakAndWait(idx: number, text: string): Promise<void> {
  await speakViaConfig(
    `step-${idx}-${text.slice(0, 24)}`,
    text,
    { tag: `anim-${idx}`, onStop: () => { if (ANIM[idx]) ANIM[idx].running = false; } },
    () => { /* TTS unavailable for animate step — silently pace */ },
  );
}
async function animPlay(idx: number): Promise<void> {
  const steps = getSteps(idx); if (!steps) return;
  stopAnim(idx);
  ANIM[idx] = { running: true, currentStep: -1, steps };
  for (let i = 0; i < steps.length; i++) {
    if (!ANIM[idx]?.running) return;
    renderStep(idx, i);
    await speakAndWait(idx, steps[i].text);
    if (!ANIM[idx]?.running) return;
    await new Promise(r => setTimeout(r, 350));
  }
  ANIM[idx].running = false;
}
async function animReplayStep(idx: number): Promise<void> {
  const a = ANIM[idx]; if (!a) return;
  const i = a.currentStep >= 0 ? a.currentStep : 0;
  if (!a.steps[i]) return;
  AudioBus.stop();
  await speakAndWait(idx, a.steps[i].text);
}
async function animJumpTo(idx: number, stepIdx: number): Promise<void> {
  const steps = getSteps(idx); if (!steps) return;
  stopAnim(idx);
  ANIM[idx] = { running: false, currentStep: stepIdx, steps };
  renderStep(idx, stepIdx);
  await speakAndWait(idx, steps[stepIdx].text);
}
function animReset(idx: number): void {
  stopAnim(idx);
  const steps = getSteps(idx);
  ANIM[idx] = { running: false, currentStep: -1, steps: steps || [] };
  document.getElementById(`narr-${idx}`)!.innerHTML = "click ANIMATE — Kokori narrates each step";
  Array.from(document.getElementById(`dots-${idx}`)!.children).forEach((d) => {
    (d as HTMLElement).classList.remove("passed", "current");
  });
}

// ──────────────────────────────────────────────────────────────────────
// CODE TABS
// ──────────────────────────────────────────────────────────────────────
function pickCode(idx: number, p: number): void {
  const host = document.getElementById(`code-${idx}`);
  if (!host) return;
  host.querySelectorAll<HTMLElement>(".tab").forEach((b, i) => b.classList.toggle("active", i === p));
  host.querySelectorAll<HTMLElement>(".src").forEach((s, i) => s.classList.toggle("active", i === p));
}

// ──────────────────────────────────────────────────────────────────────
// EVENT WIRING
// ──────────────────────────────────────────────────────────────────────
function wireEvents(): void {
  document.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const btn = t.closest<HTMLButtonElement>("button[data-act]");
    if (!btn) return;
    const idx = btn.dataset.idx ? parseInt(btn.dataset.idx, 10) : -1;
    const a = btn.dataset.act!;
    switch (a) {
      case "hear":        void hearTopic(idx); break;
      case "mark":        toggleMastery(idx); break;
      case "audio-stop":  AudioBus.stop(); break;
      case "anim":        void animPlay(idx); break;
      case "anim-replay": void animReplayStep(idx); break;
      case "anim-stop":   stopAnim(idx); break;
      case "anim-reset":  animReset(idx); break;
      case "anim-jump": {
        const step = parseInt(btn.dataset.step || "0", 10);
        void animJumpTo(idx, step);
        break;
      }
      case "sb-hear":     void speakBackHear(idx); break;
      case "sb-listen":   void speakBackListen(idx); break;
      case "sb-pick": {
        const p = parseInt(btn.dataset.pick || "0", 10);
        pickSbTarget(idx, p);
        break;
      }
      case "code-pick": {
        const p = parseInt(btn.dataset.pick || "0", 10);
        pickCode(idx, p);
        break;
      }
    }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement).matches("textarea, input")) return;
    if (e.key === " " && AudioBus.current) { e.preventDefault(); AudioBus.togglePause(); }
  });
}

// ──────────────────────────────────────────────────────────────────────
// BOOTSTRAP
// ──────────────────────────────────────────────────────────────────────
function boot(): void {
  applyMasteryToUI();
  renderStreak();
  wireEvents();
  wireTimer();
  setInterval(renderStreak, 5000);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
