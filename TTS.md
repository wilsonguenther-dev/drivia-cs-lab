# Text-to-speech setup

This lab supports **four** TTS backends. Pick one from the gear menu (bottom-right). Your choice persists in `localStorage`.

| Backend | Quality | Setup | Notes |
|---|---|---|---|
| **Web Speech** (default) | OK → great on macOS | none | Browser-native. Voice quality depends on the OS — macOS Siri/Samantha is solid, Linux espeak is robotic. |
| **Supersonic2** | Great | Run a local Rust HTTP shim, port `8800` | 234MB ONNX model, 5 languages × 10 voices. Best free open-source quality. |
| **Kokori** | Great | Run `localhost:3000` (macOS app or Kokoro-82M server) | Kokoro-82M wrapper. Fastest of the URL backends on Apple Silicon. |
| **Gemini Charon** | Excellent (baked) | `GEMINI_API_KEY` + `npm run bake` | Pre-renders WAVs to `public/audio/`. Zero-latency at runtime once baked. |

---

## Web Speech (default — no setup)

Works in any modern browser. Open the lab, click `Hear it`, audio plays.

On macOS, install the higher-quality voices for a noticeable bump: System Settings → Accessibility → Spoken Content → System voice → manage voices → download `Samantha (Enhanced)` or `Siri Voice 4`.

---

## Supersonic2

[`DavidValin/supersonic2-tts`](https://github.com/DavidValin/supersonic2-tts) ships as a Rust library, not an HTTP server. Wrap it in a tiny HTTP shim (axum or actix), expose `/synthesize` on port 8800, and the lab will use it.

Minimal shim (one file, ~30 lines):

```rust
// src/main.rs — wraps supersonic2-tts as an HTTP server
use axum::{routing::post, Router, Json, response::Response, http::header};
use serde::Deserialize;
use std::sync::Arc;
use supersonic2_tts::TtsEngine;

#[derive(Deserialize)]
struct Req { text: String, voice: Option<String>, speed: Option<f32> }

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let engine = Arc::new(TtsEngine::new("./supersonic2-model/onnx", "./supersonic2-model", false).await?);
    let app = Router::new().route("/synthesize", post({
        let engine = engine.clone();
        move |Json(req): Json<Req>| async move {
            let voice = req.voice.unwrap_or_else(|| "F4".into());
            let speed = req.speed.unwrap_or(1.0);
            let wav = engine.synthesize_with_options(&req.text, &voice, speed, 1.0, "en").await.unwrap();
            Response::builder()
                .header(header::CONTENT_TYPE, "audio/wav")
                .body(axum::body::Body::from(wav)).unwrap()
        }
    }));
    axum::serve(tokio::net::TcpListener::bind("127.0.0.1:8800").await?, app).await?;
    Ok(())
}
```

1. Clone `DavidValin/supersonic2-tts` and download the model: `tar xvf model/supersonic2-model.tgz`.
2. Add the shim above to your own `Cargo.toml` (depend on `supersonic2-tts`, `axum`, `tokio`, `anyhow`).
3. `cargo run --release` → listens on `localhost:8800`.
4. In the lab, open the TTS gear → select **Supersonic2** → done.

Voice IDs: `F1..F5` (female) · `M1..M5` (male). Languages: `en` `es` `fr` `ko` `pt`.

---

## Kokori (Mac convenience)

If you've already got Kokori or any Kokoro-82M HTTP wrapper on port 3000, the lab will use it. Voice names follow the Kokoro convention (`af_heart`, `af_bella`, `am_michael`, etc.).

Equivalent open-source server: [`hexgrad/Kokoro-82M`](https://huggingface.co/hexgrad/Kokoro-82M) + a tiny Flask wrapper.

---

## Gemini Charon (pre-baked)

```bash
export GEMINI_API_KEY=...    # from https://aistudio.google.com/apikey
npm run bake                 # writes WAVs to public/audio/<slug>/step-*.wav
```

Rate-limited at ~4s per request to stay under Gemini's preview RPM cap. Idempotent — only generates missing files. Once baked, the lab will prefer the static WAV over any live backend (instant playback).

---

## Switching backends

Click the gear button (bottom-right of any page) and select a backend. Audio cache is keyed on `(backend, voice, text)` so switching doesn't fight cached responses.

The same TTS config is used by every voice feature in the lab: chapter narration, SpeakBack hear-it-first, and the animated step walkthroughs.
