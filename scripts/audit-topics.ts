/**
 * Drift guard for CS Lab. Every topic must:
 *   - have plain English
 *   - have at least one video
 *   - if it has `formal`, that must KaTeX-render without error
 * Run via `npm run audit`.
 */
import katex from "katex";
import { TOPICS, CHAPTERS } from "../src/data/cs";

let failures = 0;
for (const t of TOPICS) {
  if (!t.plain || t.plain.length < 20) {
    console.error(`  ✗ ${t.title} — missing/short plain English`); failures++;
  }
  if (!t.videos || t.videos.length === 0) {
    console.error(`  ✗ ${t.title} — no videos`); failures++;
  }
  if (t.formal) {
    try { katex.renderToString(t.formal, { displayMode: true, throwOnError: true, strict: "warn" }); }
    catch (e) { console.error(`  ✗ ${t.title} — KaTeX error: ${(e as Error).message}`); failures++; }
  }
  if (t.steps) {
    t.steps.forEach((s, i) => {
      if (s.math) {
        try { katex.renderToString(s.math, { displayMode: true, throwOnError: true, strict: "warn" }); }
        catch (e) { console.error(`  ✗ ${t.title} step ${i + 1} — KaTeX error: ${(e as Error).message}`); failures++; }
      }
    });
  }
}
console.log(`\nCS Lab audit — ${TOPICS.length} topics · ${CHAPTERS.length} chapters`);
if (failures === 0) { console.log(`All checks passed. ✓\n`); process.exit(0); }
else { console.error(`\n${failures} failure(s). ✗\n`); process.exit(1); }
