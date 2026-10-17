const GEMINI_WS =
  "https://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

const DEFAULT_FIX_MODEL = "gemini-3.1-flash-lite";
const FALLBACK_FIX_MODEL = "gemini-2.5-flash";
const DEFAULT_FA_PROMPT = "این یک گفتار فارسی روان است که با املای درست و نیم‌فاصله نوشته می‌شود.";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

const JSON_HEADERS = { ...CORS, "Content-Type": "application/json" };
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });

function toBase64(bytes) {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function normalizeFa(s) {
  return (s || "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ───────────────────────── اصلاح املا با Gemini ─────────────────────────
async function callGeminiFix(apiKey, model, segments, audio) {
  const items = segments.map((s, i) => ({ id: i, text: s.text }));

  const promptText = `تو یک ویراستار و زیرنویس‌گذار حرفه‌ای زبان فارسی هستی.
متن‌های زیر خروجی خام تشخیص گفتار (Whisper) هستند و پر از غلط‌های املایی و آوایی‌اند (مثلاً «اشتیاغ» به‌جای «اشتیاق»، «جزب» به‌جای «جذب»، «کولبار» به‌جای «کوله‌بار»).
${audio ? "فایل صوتی همراه این پیام همان گفتار است؛ به آن گوش بده و کلمات اشتباه‌شنیده‌شده را بر اساس صدای واقعی درست کن." : "با توجه به معنی و بافت جمله، کلمات اشتباه را به نزدیک‌ترین کلمه درست اصلاح کن."}

قوانین الزامی:
- دقیقاً همان تعداد آیتم و همان id را برگردان؛ هیچ آیتمی را ادغام، حذف یا تقسیم نکن.
- معنا و لحن محاوره‌ی گوینده را تغییر نده و چیزی اضافه نکن.
- املای استاندارد و نیم‌فاصله‌ی درست را رعایت کن.
- از «ی» و «ک» فارسی استفاده کن.
- فقط JSON برگردان.

آیتم‌ها:
${JSON.stringify(items)}`;

  const parts = [];
  if (audio) parts.push({ inline_data: { mime_type: audio.mime, data: audio.base64 } });
  parts.push({ text: promptText });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { id: { type: "INTEGER" }, text: { type: "STRING" } },
              required: ["id", "text"],
            },
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Gemini(${model}) ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const raw = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
  if (!Array.isArray(parsed)) throw new Error("Gemini returned non-array");

  const byId = new Map();
  for (const p of parsed) {
    if (p && typeof p.id === "number" && typeof p.text === "string" && p.text.trim()) {
      byId.set(p.id, normalizeFa(p.text));
    }
  }
  return segments.map((s, i) => byId.get(i) || s.text);
}

async function correctSegments(env, segments, audio) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey || !segments.length) return { texts: segments.map((s) => s.text), refined: false };

  const models = [env.GEMINI_FIX_MODEL || DEFAULT_FIX_MODEL, FALLBACK_FIX_MODEL];

  for (const model of models) {
    let modelMissing = false;

    if (audio) {
      try {
        const texts = await callGeminiFix(apiKey, model, segments, audio);
        return { texts, refined: true, usedAudio: true, model };
      } catch (err) {
        console.error("[FIX audio]", err.message || String(err));
        if (err.status === 404) modelMissing = true;
      }
    }

    if (modelMissing) continue; // مدل وجود ندارد؛ برو سراغ مدل بعدی

    try {
      const texts = await callGeminiFix(apiKey, model, segments, null);
      return { texts, refined: true, usedAudio: false, model };
    } catch (err) {
      console.error("[FIX text]", err.message || String(err));
    }
  }

  return { texts: segments.map((s) => s.text), refined: false };
}

function retimeWords(origWords, newText, start, end) {
  const tokens = newText.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];

  if (origWords.length === tokens.length) {
    return tokens.map((w, i) => ({ word: w, start: origWords[i].start, end: origWords[i].end }));
  }

  const totalChars = tokens.reduce((a, w) => a + w.length, 0) || 1;
  const dur = Math.max(0, end - start);
  let cursor = start;
  return tokens.map((w) => {
    const d = (w.length / totalChars) * dur;
    const item = { word: w, start: cursor, end: cursor + d };
    cursor += d;
    return item;
  });
}

// ───────────────────────── Whisper Alignment ─────────────────────────
async function handleAlign(req, env, url) {
  try {
    if (!env.AI) return json({ error: "AI binding not configured" }, 500);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") return json({ error: "No file provided" }, 400);

    const language = url.searchParams.get("language") || formData.get("language") || "fa";
    const offset = parseFloat(url.searchParams.get("offset") || formData.get("offset") || "0") || 0;
    const refineFlag = (url.searchParams.get("refine") || formData.get("refine") || "1").toString();
    const shouldRefine = refineFlag !== "0" && refineFlag !== "false";

    const rawPrompt = formData.get("prompt");
    let prompt = typeof rawPrompt === "string" ? rawPrompt.slice(0, 400) : "";
    if (!prompt && language === "fa") prompt = DEFAULT_FA_PROMPT;

    if (file.size > MAX_AUDIO_BYTES) return json({ error: "Audio too large" }, 413);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const audioBase64 = toBase64(bytes);

    const input = { audio: audioBase64, language, vad_filter: true };
    if (prompt) input.initial_prompt = prompt;

    // ۱. Whisper
    const result = await env.AI.run("@cf/openai/whisper-large-v3-turbo", input);

    const rawSegments = [];
    for (const s of result.segments || []) {
      const text = normalizeFa(s.text || "");
      if (!text) continue;
      const segWords = [];
      if (Array.isArray(s.words)) {
        for (const w of s.words) {
          const t = (w.word || w.text || "").trim();
          if (t) segWords.push({ word: t, start: w.start || 0, end: w.end || 0 });
        }
      }
      rawSegments.push({ text, start: s.start || 0, end: s.end || 0, words: segWords });
    }

    // ۲. اصلاح املا
    let refined = false;
    let usedAudio = false;
    let modelUsed = null;

    if (shouldRefine && language === "fa" && rawSegments.length) {
      const audio = file.type ? { mime: file.type.split(";")[0], base64: audioBase64 } : null;
      const out = await correctSegments(env, rawSegments, audio);
      refined = out.refined;
      usedAudio = !!out.usedAudio;
      modelUsed = out.model || null;

      if (out.refined) {
        out.texts.forEach((t, i) => {
          const seg = rawSegments[i];
          if (t !== seg.text) {
            seg.words = retimeWords(seg.words, t, seg.start, seg.end);
            seg.text = t;
          }
        });
      }
    }

    const segments = rawSegments.map((s) => ({
      text: s.text,
      start: s.start + offset,
      end: s.end + offset,
    }));

    const words = [];
    for (const s of rawSegments) {
      for (const w of s.words) {
        words.push({ word: normalizeFa(w.word), start: w.start + offset, end: w.end + offset });
      }
    }

    const fullText = refined
      ? segments.map((s) => s.text).join(" ")
      : normalizeFa(result.text || "");

    return json({
      text: fullText,
      correctedText: fullText,
      words,
      segments,
      language: (result.transcription_info && result.transcription_info.language) || language,
      hasWordTimestamps: words.length > 0,
      refined,
      refinedWithAudio: usedAudio,
      refineModel: modelUsed,
    });
  } catch (e) {
    console.error("[ALIGN] Error:", e && e.message ? e.message : String(e));
    return json({ error: "Alignment failed: " + ((e && e.message) || String(e)) }, 500);
  }
}

// ───────────────────────── Gemini Live WebSocket proxy ─────────────────────────
async function handleGeminiLive(req, env, ctx) {
  if (req.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected WebSocket", { status: 426, headers: CORS });
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return new Response("Missing API key", { status: 500, headers: CORS });

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();

  const safeCode = (c) =>
    c && c >= 1000 && c < 5000 && ![1004, 1005, 1006, 1015].includes(c) ? c : 1000;
  const safeClose = (sock, code, reason) => {
    try { sock.close(safeCode(code), (reason || "").slice(0, 100)); } catch {}
  };

  let upstream = null;
  let clientClosed = false;
  const pending = [];

  server.addEventListener("message", (e) => {
    if (upstream && upstream.readyState === 1) {
      try { upstream.send(e.data); } catch (err) { console.error("[WS] client -> gemini:", err); }
    } else {
      pending.push(e.data);
    }
  });

  server.addEventListener("close", (e) => {
    clientClosed = true;
    if (upstream) safeClose(upstream, e.code, e.reason);
  });

  server.addEventListener("error", () => {
    clientClosed = true;
    console.error("[WS] browser socket error");
    if (upstream) safeClose(upstream, 1011, "client error");
  });

  const connectUpstream = async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(`${GEMINI_WS}?key=${apiKey}`, {
        headers: { Upgrade: "websocket" },
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      const ws = res.webSocket;
      if (!ws) {
        const body = await res.text().catch(() => "");
        console.error("[WS] Handshake rejected:", res.status, body.slice(0, 300));
        safeClose(server, 1011, `Upstream rejected: ${res.status}`);
        return;
      }

      ws.accept();
      upstream = ws;

      if (clientClosed) {
        safeClose(ws, 1000, "client gone");
        return;
      }

      for (const m of pending) ws.send(m);
      pending.length = 0;

      ws.addEventListener("message", (e) => {
        try {
          if (server.readyState !== 1) return;
          if (typeof e.data === "string") {
            server.send(e.data);
          } else if (e.data instanceof ArrayBuffer) {
            server.send(new TextDecoder().decode(e.data));
          } else {
            server.send(e.data);
          }
        } catch (err) {
          console.error("[WS] gemini -> client:", err);
        }
      });

      ws.addEventListener("close", (e) => safeClose(server, e.code, e.reason));
      ws.addEventListener("error", () => {
        console.error("[WS] gemini socket error");
        safeClose(server, 1011, "gemini error");
      });
    } catch (err) {
      clearTimeout(timer);
      const timedOut = err && err.name === "AbortError";
      console.error("[WS] Connect failed:", timedOut ? "timeout" : (err && err.message) || String(err));
      safeClose(server, 1011, timedOut ? "Upstream timeout" : "Upstream connect failed");
    }
  };

  ctx.waitUntil(connectUpstream());

  return new Response(null, { status: 101, webSocket: client });
}

// ───────────────────────── Router ─────────────────────────
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === "/") {
      return new Response("OK - Worker is running", { status: 200, headers: CORS });
    }

    if (url.pathname === "/align" || url.pathname === "/whisper-align") {
      if (req.method !== "POST") return json({ error: "Use POST" }, 405);
      return handleAlign(req, env, url);
    }

    if (url.pathname === "/gemini-live") {
      return handleGeminiLive(req, env, ctx);
    }

    return new Response("Not found", { status: 404, headers: CORS });
  },
};