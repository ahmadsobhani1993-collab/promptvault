# Local forced-alignment service (WhisperX aligner only)

This service does **not** transcribe audio and does **not** run Whisper/Faster-Whisper ASR. The transcription architecture has three distinct steps:

1. The browser uses FFmpeg/WAV decoding to extract **audio only** from the uploaded video. No video frames or video file are sent to Gemini.
2. The browser sends short WAV audio chunks to the existing Gemini API-key/model cascade. Gemini returns verbatim text only; it is not asked to invent word timestamps.
3. The browser sends only the extracted WAV and Gemini transcript directly to this local service. WhisperX's acoustic forced aligner maps the supplied text to the waveform and returns word timestamps. Only `whisperx.load_align_model()` and `whisperx.align()` are used; the WhisperX ASR/transcription method is not called.

The Next.js serverless API never proxies large media. It issues a 30-minute HMAC ticket to a signed-in user; the browser uses it to call `/align` directly.

## Run locally on Windows

From a second PowerShell terminal run `services/whisper_api/run-local.ps1`. This installs requirements and runs the alignment API on `http://localhost:8000`. The first `/align` request downloads the Persian or English Wav2Vec2 alignment model and may take several minutes. WhisperX/PyTorch require significant disk and memory. If a language has no available alignment model or speech is too different from Gemini's transcript, the service reports an alignment error instead of making up timestamps.

The local Next.js app creates a random 256-bit `.alignment-token-secret` file (Git-ignored). The service reads the same file. `ALIGNMENT_SERVICE_URL` and `ALIGNMENT_TOKEN_SECRET` are only required for production deployment; the old `WHISPER_*` env names remain accepted for migration compatibility.

## Production deployment

Deploy this as a long-running Python service (not a Vercel/Netlify function). Set the following on both the Next.js host and the alignment service:

- `ALIGNMENT_SERVICE_URL=https://<your-alignment-host>`
- `ALIGNMENT_TOKEN_SECRET=<same random secret, at least 32 characters>`
- `ALLOWED_ORIGINS=<exact app origins, comma-separated>` on the alignment service
- optionally `ALIGN_DEVICE=cpu` or a supported CUDA device

The API accepts only a WAV file plus the Gemini transcript at `POST /align?language=fa|en`; it does not accept the source video. `GET /health` reports the service and how many aligner models have been loaded.
