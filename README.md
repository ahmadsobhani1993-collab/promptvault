# promptvault

## Video subtitle transcription

Video subtitles use audio-only Gemini transcription followed by local WhisperX forced alignment. The source video and its frames are never sent to Gemini; only extracted WAV chunks are. The separate Python service only aligns Gemini's transcript to the WAV and does not run Whisper ASR. Setup and environment variables are documented in [services/whisper_api/README.md](services/whisper_api/README.md).