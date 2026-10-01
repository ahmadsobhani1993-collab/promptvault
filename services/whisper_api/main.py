import base64
import hashlib
import hmac
import json
import logging
import os
import tempfile
import threading
import time
import wave
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
LOCAL_ENV_FILE = REPOSITORY_ROOT / ".env.local"
if LOCAL_ENV_FILE.exists():
    load_dotenv(LOCAL_ENV_FILE, override=False)

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(250 * 1024 * 1024)))
TOKEN_SECRET = os.getenv("ALIGNMENT_TOKEN_SECRET", os.getenv("WHISPER_TOKEN_SECRET", ""))
configured_origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "").split(",") if origin.strip()]
ALLOWED_ORIGINS = configured_origins or (["http://localhost:3000", "http://127.0.0.1:3000"] if LOCAL_ENV_FILE.exists() else [])
SUPPORTED_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"}

app = FastAPI(title="PromptVault Local Forced Alignment API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

_align_models: dict[str, tuple[Any, Any]] = {}
_align_lock = threading.Lock()
_nltk_lock = threading.Lock()
NLTK_DATA_DIR = Path(__file__).resolve().parent / "nltk_data"


def ensure_nltk_punkt_data() -> None:
    import nltk
    from nltk import pathsec

    NLTK_DATA_DIR.mkdir(parents=True, exist_ok=True)
    nltk_path = str(NLTK_DATA_DIR)
    if nltk_path not in nltk.data.path:
        nltk.data.path.insert(0, nltk_path)

    try:
        nltk.data.find("tokenizers/punkt_tab/english/")
        return
    except LookupError:
        pass

    with _nltk_lock:
        try:
            nltk.data.find("tokenizers/punkt_tab/english/")
            return
        except LookupError:
            # Local Windows installs often use an HTTPS proxy. NLTK 3.10 blocks
            # downloader fetches through proxies unless the operator explicitly
            # opts in. The local launcher sets this flag; downloads stay scoped
            # to the fixed punkt_tab package and the service's private data dir.
            if os.getenv("NLTK_ALLOW_PROXIED_URLOPEN") == "1":
                pathsec.ALLOW_PROXIED_FETCH = True
            if not nltk.download("punkt_tab", download_dir=nltk_path, quiet=True):
                raise RuntimeError("دانلود دادهٔ NLTK punkt_tab ناموفق شد؛ اتصال اینترنت سرویس را بررسی کنید.")


def _decode_segment(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def verify_ticket(authorization: str | None) -> None:
    token_secret = TOKEN_SECRET
    if not token_secret and LOCAL_ENV_FILE.exists():
        try:
            token_secret = (REPOSITORY_ROOT / ".alignment-token-secret").read_text(encoding="utf-8").strip()
        except OSError:
            try:
                token_secret = (REPOSITORY_ROOT / ".whisper-token-secret").read_text(encoding="utf-8").strip()
            except OSError:
                token_secret = ""
    if not token_secret or len(token_secret) < 32:
        raise HTTPException(status_code=503, detail="ALIGNMENT_TOKEN_SECRET is not configured on the alignment service")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="A valid short-lived alignment ticket is required")

    token = authorization[7:].strip()
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=401, detail="Invalid bearer ticket")

    unsigned = f"{parts[0]}.{parts[1]}".encode("ascii", errors="ignore")
    expected = base64.urlsafe_b64encode(hmac.new(token_secret.encode(), unsigned, hashlib.sha256).digest()).rstrip(b"=").decode()
    if not hmac.compare_digest(expected, parts[2]):
        raise HTTPException(status_code=401, detail="Invalid bearer ticket signature")

    try:
        claims: dict[str, Any] = json.loads(_decode_segment(parts[1]))
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid bearer ticket claims") from exc

    now = int(time.time())
    if claims.get("aud") != "promptvault-alignment" or not claims.get("sub") or int(claims.get("exp", 0)) <= now:
        raise HTTPException(status_code=401, detail="Bearer ticket has expired or is not valid for this service")


def align_transcript(path: str, transcript: str, language: str) -> dict[str, Any]:
    ensure_nltk_punkt_data()
    try:
        import whisperx
    except ImportError as exc:
        raise RuntimeError("Local forced alignment is not installed. Install whisperx dependencies from requirements.txt.") from exc

    device = os.getenv("ALIGN_DEVICE", os.getenv("WHISPER_DEVICE", "cpu"))
    with _align_lock:
        if language not in _align_models:
            _align_models[language] = whisperx.load_align_model(language_code=language, device=device)
        align_model, metadata = _align_models[language]

    import numpy as np

    with wave.open(path, "rb") as wav_file:
        if wav_file.getframerate() != 16000 or wav_file.getnchannels() != 1 or wav_file.getsampwidth() != 2:
            raise ValueError("Audio must be mono 16 kHz PCM WAV")
        sample_count = wav_file.getnframes()
        audio = np.frombuffer(wav_file.readframes(sample_count), dtype="<i2").astype(np.float32) / 32768.0
    duration = len(audio) / 16000
    segments = [{"start": 0.0, "end": duration, "text": transcript}]
    aligned = whisperx.align(segments, align_model, metadata, audio, device, return_char_alignments=False)
    words = []
    for segment in aligned.get("segments", []):
        for word in segment.get("words", []):
            start, end = word.get("start"), word.get("end")
            text = str(word.get("word", "")).strip()
            if text and start is not None and end is not None and float(end) > float(start):
                words.append({"word": text, "start": round(float(start), 3), "end": round(float(end), 3)})
    return {"words": words, "language": language, "duration": round(duration, 3)}


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "gemini-transcript-forced-alignment",
        "alignment_models_loaded": str(len(_align_models)),
    }


@app.post("/align")
async def align(
    file: UploadFile = File(...),
    transcript: str = Form(...),
    language: str = Query(default="fa", pattern="^(fa|en)$"),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    verify_ticket(authorization)
    if not transcript.strip() or len(transcript) > 100_000:
        raise HTTPException(status_code=400, detail="A non-empty transcript under 100,000 characters is required")
    if (file.content_type or "").lower() != "audio/wav" and Path(file.filename or "").suffix.lower() != ".wav":
        raise HTTPException(status_code=415, detail="Forced alignment accepts the extracted audio WAV only")

    temporary_path: str | None = None
    total = 0
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temporary:
            temporary_path = temporary.name
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Extracted WAV exceeds the upload limit")
                temporary.write(chunk)
        if total == 0:
            raise HTTPException(status_code=400, detail="The extracted WAV is empty")
        return await run_in_threadpool(align_transcript, temporary_path, transcript.strip(), language)
    except HTTPException:
        raise
    except Exception as exc:
        logging.exception("Local forced alignment failed")
        raise HTTPException(status_code=500, detail=f"Local forced alignment failed: {exc}") from exc
    finally:
        await file.close()
        if temporary_path and os.path.exists(temporary_path):
            os.unlink(temporary_path)
