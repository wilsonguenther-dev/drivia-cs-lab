/**
 * Pluggable TTS adapter.
 *
 * Four backends:
 *
 *   1. webspeech    — browser-native `speechSynthesis`. Zero install, zero
 *                     API key, works everywhere. Voice quality depends on OS.
 *                     This is the default — the lab loads with speech that
 *                     works out of the box.
 *
 *   2. supersonic   — Supersonic2 ONNX TTS via a small local HTTP shim.
 *                     Wraps https://github.com/DavidValin/supersonic2-tts.
 *                     5 languages × 10 voices. ~234MB model, ONNX-fast.
 *                     Run the shim on localhost:8800.
 *
 *   3. kokori       — Kokoro-82M wrapper running on localhost:3000.
 *                     Mac-only convenience for the original maintainer.
 *
 *   4. gemini-baked — Google Gemini 2.5 Flash TTS (Charon voice), pre-baked
 *                     to WAV files served from /audio/<slug>/step-N.wav.
 *                     Requires GEMINI_API_KEY at bake time, not at runtime.
 *                     Fastest playback once baked. Handled outside this
 *                     adapter by the static-path lookup in main.ts.
 *
 * The adapter never speaks directly except for the webspeech path. For the
 * URL-based backends it returns a Blob the caller can pipe into AudioBus.
 */

export type TTSBackend = "webspeech" | "supersonic" | "kokori" | "gemini-baked";

export interface TTSConfig {
  backend: TTSBackend;
  kokoriUrl: string;
  supersonicUrl: string;
  voice: string;       // backend-specific name; ignored for webspeech
  speed: number;       // 1.0 = normal
  webSpeechVoiceName?: string;
}

const STORAGE_KEY = "tts.config.v1";

const DEFAULTS: TTSConfig = {
  backend: "webspeech",
  kokoriUrl: "http://localhost:3000/generate",
  supersonicUrl: "http://localhost:8800/synthesize",
  voice: "af_heart",
  speed: 1.0,
};

export function getTTSConfig(): TTSConfig {
  if (typeof localStorage === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setTTSConfig(patch: Partial<TTSConfig>): TTSConfig {
  const next = { ...getTTSConfig(), ...patch };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  try { window.dispatchEvent(new CustomEvent("tts:config", { detail: next })); } catch {}
  return next;
}

export const BACKEND_LABELS: Record<TTSBackend, string> = {
  "webspeech": "Browser (Web Speech) — no install",
  "supersonic": "Supersonic2 — localhost:8800",
  "kokori": "Kokori — localhost:3000",
  "gemini-baked": "Gemini Charon — pre-baked WAV",
};

/**
 * Fetch a TTS audio blob from a URL-based backend. Returns null if the
 * current backend doesn't use a URL (webspeech / gemini-baked) or the
 * request fails. Caller should fall back to webSpeechSpeak in those cases.
 */
export async function fetchTTSBlob(text: string, signal?: AbortSignal): Promise<Blob | null> {
  const cfg = getTTSConfig();
  if (cfg.backend === "webspeech" || cfg.backend === "gemini-baked") return null;
  const url = cfg.backend === "kokori" ? cfg.kokoriUrl : cfg.supersonicUrl;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: cfg.voice, speed: cfg.speed }),
      signal,
    });
    if (!r.ok) return null;
    return await r.blob();
  } catch {
    return null;
  }
}

export interface SpeechHandle {
  ended: Promise<void>;
  stop: () => void;
}

/** Speak via SpeechSynthesis. No download, no API key — works in any modern browser. */
export function webSpeechSpeak(text: string, cfg: TTSConfig = getTTSConfig()): SpeechHandle {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return { ended: Promise.resolve(), stop: () => {} };
  }
  try { window.speechSynthesis.cancel(); } catch {}
  const u = new SpeechSynthesisUtterance(text);
  u.rate = Math.max(0.5, Math.min(2.0, cfg.speed || 1.0));
  u.pitch = 1.0;
  const voices = window.speechSynthesis.getVoices();
  let chosen: SpeechSynthesisVoice | undefined;
  if (cfg.webSpeechVoiceName) {
    chosen = voices.find(v => v.name === cfg.webSpeechVoiceName);
  }
  if (!chosen) {
    // Prefer a higher-quality enhanced/premium voice when available
    chosen = voices.find(v => /(enhanced|premium|natural|samantha|siri|google)/i.test(v.name) && v.lang.toLowerCase().startsWith("en"));
  }
  if (!chosen) {
    chosen = voices.find(v => v.lang.toLowerCase().startsWith("en"));
  }
  if (chosen) u.voice = chosen;
  let resolveEnded: () => void = () => {};
  const ended = new Promise<void>(r => { resolveEnded = r; });
  u.onend = () => resolveEnded();
  u.onerror = () => resolveEnded();
  window.speechSynthesis.speak(u);
  return {
    ended,
    stop: () => { try { window.speechSynthesis.cancel(); } catch {} resolveEnded(); },
  };
}

/** Whether the current backend uses Web Speech (no blob fetch path). */
export function isWebSpeech(cfg: TTSConfig = getTTSConfig()): boolean {
  return cfg.backend === "webspeech";
}

/** Health check — does the URL backend respond? Used by the settings UI. */
export async function pingBackend(backend: TTSBackend, url: string): Promise<boolean> {
  if (backend !== "kokori" && backend !== "supersonic") return false;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "ok", voice: "af_heart", speed: 1.0 }),
      signal: AbortSignal.timeout(3000),
    });
    return r.ok;
  } catch {
    return false;
  }
}
