# Drivia CS Lab

**Read · Hear · Speak · Type · Master.** A computer-science curriculum that walks from undergrad-101 through PhD-level research, every topic with the same five-part vibe — history, formal definition, animated walkthrough, code in multiple languages, and the seminal papers that pinned it down.

Built solo, in a dorm room, by [Wilson Guenther](https://github.com/wilsonguenther-dev) — founder of [Drivia](https://drivia.consulting). The Drivia open-source layer — fork it, run it, learn from it.

Companion repos:
- [`drivia-formula-lab`](https://github.com/wilsonguenther-dev/drivia-formula-lab) — linear algebra + ML formulas
- `drivia-dev-lab` — developer vocabulary

---

## What's inside

Every topic is tagged `undergrad`, `grad`, or `research` — start at your level and walk up.

Each topic card contains:

- **History video** at the top (Computerphile / MIT OCW / 3Blue1Brown / Lex Fridman). The "where did this come from" framing.
- **Plain English** explanation in one paragraph.
- **Formal definition** in KaTeX. The thing a grad student would write on a chalkboard.
- **Animated step-by-step walkthrough** — math swaps in place as the TTS reads it.
- **Code samples** in multiple languages (Python primary, often with TypeScript / Rust / C side-by-side).
- **Seminal papers** — author + year + clickable link. The actual texts to read.
- **Practice problems** + a Say-It-Back drill (your mic transcribed and graded against the formal statement).
- **Mastery toggle** that propagates to the chapter pill — green pill when 80% of the topics are mastered.

Plus: persistent study timer, day-streak counter, spaced-repetition queue for missed problems, global keyboard shortcuts (`?` for help), and a single AudioBus that never lets two clips overlap.

---

## Getting started

### Requirements

- Node 20+
- (optional) `GEMINI_API_KEY` if you want to pre-bake the narration WAVs

The lab runs with **zero TTS setup** — the default backend is the browser's built-in Web Speech API.

### Install + run

```bash
git clone https://github.com/wilsonguenther-dev/drivia-cs-lab.git
cd drivia-cs-lab
npm install
npm run dev          # → http://localhost:4321
```

### TTS options

Click the gear icon (bottom-right) to switch between:

1. **Web Speech** (default) — browser native, zero install
2. **Supersonic2** — local ONNX TTS, [setup guide](./TTS.md#supersonic2)
3. **Kokori** — Kokoro-82M wrapper on `localhost:3000` (Mac convenience)
4. **Gemini Charon** — pre-baked WAVs (`npm run bake`, requires `GEMINI_API_KEY`)

See [TTS.md](./TTS.md) for the full setup matrix.

### Production build

```bash
npm run build        # SSR build in dist/
npm start            # serves dist/server/entry.mjs
npm run smoke        # real-browser Playwright smoke test
```

---

## Architecture

```
src/
├── components/
│   ├── TopicCard.astro          The undergrad→PhD topic shell
│   ├── CodeTabs.astro           Multi-language code switcher
│   ├── Citations.astro          Seminal-papers chip row
│   ├── VideoCards.astro         History-video stack
│   ├── SpeakBack.astro          Mic-graded say-it-back
│   ├── StudyTimer.astro         Persistent study counter
│   ├── TopRail.astro            Chapter pills + audio-stop badge
│   ├── KeyboardHelp.astro       `?` overlay
│   ├── Layout.astro             Page chrome + TTS gear injection
│   └── TTSSettings.astro        TTS backend picker (gear button)
├── data/
│   └── cs.ts                    Single source of truth for the curriculum
├── lib/
│   ├── tts.ts                   Pluggable TTS adapter (4 backends)
│   ├── cache.ts                 IDB blob + KV layer
│   ├── speakmatch.ts            Mic transcript → score
│   └── mastery.ts               Per-topic mastery + day-streak
├── pages/
│   ├── index.astro              The long-scroll lab
│   ├── audit.astro              Self-check: which topics need attention
│   └── api/
│       └── explain.ts           Gemini fallback for "explain this differently"
└── scripts/
    └── main.ts                  Client orchestrator — AudioBus, animations, mastery
```

### TTS pipeline

```
                 ┌────────────────────────────┐
   topic text →  │  lib/tts.ts                │
                 │  • getTTSConfig()          │  ← persisted in localStorage
                 │  • fetchTTSBlob() / Web    │
                 │    Speech direct           │
                 └──────┬─────────────────────┘
                        │
        ┌───────────────┼───────────────┬──────────────┐
        ▼               ▼               ▼              ▼
   webspeech       supersonic         kokori      gemini-baked
   (native)     :8800 ONNX shim    :3000 K-82M    /audio/*.wav
                        │               │              │
                        └────── Blob ───┴──── URL.createObjectURL ──┐
                                                                    ▼
                                                            AudioBus.play()
                                                          (single global track)
```

The same cache layer (`lib/cache.ts`) sits in front of all URL backends — IDB-persisted blobs keyed on `(backend, voice, text)` so switching doesn't fight stale cached responses.

---

## Tech stack

- **Astro 5** with React 18 islands
- **KaTeX 0.16** for math typesetting
- **Web Speech API** as the zero-install default
- **[Supersonic2](https://github.com/DavidValin/supersonic2-tts)** for high-quality offline ONNX TTS
- **[Kokoro 82M](https://huggingface.co/hexgrad/Kokoro-82M)** as the Mac-convenience backend
- **Gemini 2.5 Flash TTS** (Charon voice) for the baked path
- **MediaRecorder + SpeechRecognition** for SpeakBack
- **IndexedDB** for blob persistence, **localStorage** for KV / mastery / streak / TTS prefs

---

## Roadmap

- More research-tier topics: optimal transport, NTK theory, mechanistic interp circuits
- Light-mode theme
- Citation graph between topics (Pearson → Spearman → Cosine, the chain explained)
- Multi-language CodeTabs everywhere (currently uneven)

PRs welcome — especially adding new topic cards with `undergrad` / `grad` / `research` tags.

---

## Credits

The history-video lane leans on:

- [Computerphile](https://www.youtube.com/@Computerphile)
- [MIT OpenCourseWare](https://www.youtube.com/@mitocw)
- [3Blue1Brown](https://www.youtube.com/@3blue1brown)
- [Andrej Karpathy](https://www.youtube.com/@AndrejKarpathy)
- [Steve Brunton](https://www.youtube.com/@Eigensteve)
- [Lex Fridman MIT 6.S091](https://www.youtube.com/@lexfridman)

TTS backends:

- **[Supersonic2](https://github.com/DavidValin/supersonic2-tts)** by David Valin — ONNX-fast, MIT
- **[Kokoro 82M](https://huggingface.co/hexgrad/Kokoro-82M)** by Hexgrad — Apache 2.0
- **Web Speech API** — browser native

---

## License

MIT © 2026 Wilson Guenther / Drivia Consulting LLC.

Drivia is an AI education platform. The CS Lab is one of the open-source layers — the part anyone can read, fork, run, and learn from. Find Drivia at [drivia.consulting](https://drivia.consulting).
