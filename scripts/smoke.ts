import { chromium } from "playwright";

const URL = process.env.SMOKE_URL || "http://localhost:4324/";

function ok(label: string, value: unknown): void {
  console.log(`  ✓ ${label}`, value === undefined ? "" : `→ ${JSON.stringify(value)}`);
}
let failures = 0;
function fail(label: string, value: unknown): void {
  console.error(`  ✗ ${label}`, value === undefined ? "" : `→ ${JSON.stringify(value)}`);
  failures++;
}
const errs: string[] = [];

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));

console.log(`Smoke test — ${URL}\n`);
await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(800);

const s = await page.evaluate(() => ({
  katex: document.querySelectorAll(".katex").length,
  cards: document.querySelectorAll(".card").length,
  chapters: document.querySelectorAll(".chapter-hdr").length,
  videos: document.querySelectorAll(".vid").length,
  clock: document.getElementById("st-clock")?.textContent,
}));
s.cards >= 30 ? ok("30+ topic cards", s.cards) : fail("card count", s.cards);
s.chapters >= 15 ? ok("15+ chapter headers", s.chapters) : fail("chapter count", s.chapters);
s.videos >= 20 ? ok("20+ video cards", s.videos) : fail("video count", s.videos);
s.katex >= 5 ? ok("KaTeX blocks SSR-rendered", s.katex) : fail("KaTeX count", s.katex);
s.clock ? ok("clock present", s.clock) : fail("clock missing", null);

await page.click("#st-go");
await page.waitForTimeout(2400);
const t = await page.evaluate(() => document.getElementById("st-clock")?.textContent);
parseInt(t!.split(":")[1], 10) >= 1 ? ok("timer ticked past 00:01", t) : fail("timer didn't tick", t);
await page.click("#st-go");

// Probe Kokori with a tiny real POST — OPTIONS handshakes can succeed while
// POST hangs (Kokori half-alive case). Cap the probe at 6 seconds.
const kokoriUp = await page.evaluate(async () => {
  try {
    const r = await fetch("http://localhost:3000/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "ping", voice: "af_heart", speed: 1.0 }),
      signal: AbortSignal.timeout(6000),
    });
    return r.ok;
  } catch { return false; }
});
if (!kokoriUp) {
  console.log("  • Kokori is down — skipping Hear/SpeakBack audio assertions (external dep).");
} else {
  // Default TTS backend is `webspeech` (bypasses AudioBus). Pin to kokori
  // for this assertion so we can check __audio.current, then reload so the
  // page picks up the new config.
  await page.evaluate(() => localStorage.setItem("tts.config.v1", JSON.stringify({ backend: "kokori" })));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.click('button[data-act="hear"][data-idx="0"]');
  let audio = false;
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(500);
    audio = await page.evaluate(() => !!(globalThis as any).__audio?.current);
    if (audio) break;
  }
  audio ? ok("Hear button started audio (kokori backend)") : fail("Hear didn't trigger audio bus", null);
}

// Gear button + TTSSettings panel basics — backend agnostic.
const gear = await page.evaluate(() => !!document.getElementById("tts-gear"));
gear ? ok("TTS gear rendered") : fail("TTS gear missing", null);

await page.evaluate(() => (globalThis as any).__audio?.stop());
await page.click('button[data-act="anim"][data-idx="0"]').catch(() => {});
await page.waitForTimeout(1200);
const narr = await page.evaluate(() => document.getElementById("narr-0")?.textContent || "");
narr.includes("Step") ? ok("Animate stepping", narr.slice(0, 60)) : fail("Animate didn't start", narr.slice(0, 60));

await page.evaluate(() => (globalThis as any).__audio?.stop());
await page.click('button[data-act="mark"][data-idx="0"]');
await page.waitForTimeout(400);
const m = await page.evaluate(() => ({
  mastered: document.getElementById("g-mastered")?.textContent,
  card: document.getElementById("t0")?.classList.contains("mastered"),
}));
m.card && m.mastered?.startsWith("1") ? ok("Mastery toggle updated", m) : fail("Mastery toggle UI", m);

if (errs.length) {
  console.error("\n  Page-level errors:");
  errs.forEach((e) => console.error("    " + e));
  failures += errs.length;
}
await browser.close();
console.log(`\n${failures === 0 ? "All smoke checks passed. ✓" : `${failures} smoke check(s) failed. ✗`}\n`);
process.exit(failures === 0 ? 0 : 1);
