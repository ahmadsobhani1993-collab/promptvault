# promptvault

## Video subtitle transcription

Video subtitles use audio-only Gemini transcription followed by local WhisperX forced alignment. The source video and its frames are never sent to Gemini; only extracted WAV chunks are. The separate Python service only aligns Gemini's transcript to the WAV and does not run Whisper ASR. Setup and environment variables are documented in [services/whisper_api/README.md](services/whisper_api/README.md).

## Arvan server schedules and Gemini proxy

Deploy the updated `worker-fix/index.js` to the existing Cloudflare Worker. The app server sends Gemini requests to Cloudflare; only the Worker calls Google. Configure `GEMINI_API_KEY`, `GEMINI_API_KEYS`, or numbered `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, etc. on the Arvan app server. Also set the same long random `GEMINI_PROXY_SECRET` in Arvan's server environment and as a secret in the Worker. This secret authorizes the server-to-Worker request; Gemini API keys are sent only server-to-server and are never exposed to the browser. The browser-based `/gemini-live` route and optional Gemini correction in `/align` use keys configured on the Worker. Gemini text requests use `https://gemini-live-proxy.ahmadsobhani1993.workers.dev/gemini-generate` by default; optionally override it with `GEMINI_TEXT_PROXY_URL`.

General text, captions, bilingual news, and PDF OCR/cleanup use this model fallback order: `gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-3-flash-preview`, `gemini-3.6-flash`, `gemini-3.8-flash`. PDF uses the multimodal capability of these models. File transcription has its own chain, starting with `gemini-3.5-transcribe` before falling back through audio-capable Flash models. Real-time transcription uses the separate Live API model `gemini-3.5-transcribe-live`; TTS, embedding, robotics, and agent models are not mixed into text generation because they have different tasks/API behavior.

The news importer is triggered by the Arvan server's scheduler, not by `vercel.json`. Configure `NEXT_PUBLIC_APP_URL` and `CRON_SECRET` in the Arvan scheduler environment, then run `npm run cron:ai-daily-news` every 15 minutes. The command sends the shared secret in an `Authorization: Bearer` header; do not put the secret in a URL or commit it to the repository.

For a Linux crontab, use an entry like the following and replace the app path and secret. Keep the crontab private (`chmod 600`) or inject the variables from the scheduler's protected environment:

```cron
*/15 * * * * cd /path/to/app && NEXT_PUBLIC_APP_URL=https://promptsfa.ir CRON_SECRET='replace-with-a-long-random-secret' npm run cron:ai-daily-news >> /path/to/app/ai-daily-news-cron.log 2>&1
```

The API is also available for a manual check:

```sh
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$NEXT_PUBLIC_APP_URL/api/cron/ai-daily-news"
```

Successful calls return whether an article was imported. Failures are logged by the application as `[AI Daily news import failed]`.