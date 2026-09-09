var GEMINI_WS = "https://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
var redact = (s) => s.replace(/key=[^&"'\s]+/g, "key=REDACTED");
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type"
};
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/") return new Response("Gemini Live Proxy is running", { status: 200 });
    if (url.pathname === "/models") {
      const key = env.GEMINI_API_KEY;
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + key + "&pageSize=200");
      const data = await r.json();
      return Response.json((data.models || []).map((m) => ({ name: m.name, displayName: m.displayName })));
    }
    if (url.pathname === "/transcribe-stream" || url.pathname === "/transcribe") {
      if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
      if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: CORS });
      const key = env.GEMINI_API_KEY;
      if (!key) return Response.json({ error: "Worker missing GEMINI_API_KEY secret" }, { status: 500, headers: CORS });
      try {
        const body = await req.json();
        const model = body.model || "gemini-3.5-flash-lite";
        delete body.model;
        const g = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + key,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        );
        const txt = await g.text();
        console.log("[rest] status:", g.status, "model:", model, "body:", txt.slice(0, 300));
        return new Response(txt, { status: g.status, headers: CORS });
      } catch (e) {
        return Response.json({ error: redact(String((e && e.message) || e)) }, { status: 500, headers: CORS });
      }
    }
    if (url.pathname !== "/gemini-live") return new Response("Not found", { status: 404 });
    if (req.headers.get("Upgrade") !== "websocket") return new Response("Expected WebSocket", { status: 426 });
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) return new Response("Missing API key", { status: 500 });
    const sid = Math.random().toString(36).slice(2, 8);
    console.log("[" + sid + "] NEW connection");
    const pair = new WebSocketPair();
    const client = pair[0];
    const browser = pair[1];
    browser.accept();
    try {
      const up = await fetch(GEMINI_WS + "?key=" + apiKey, { headers: { Upgrade: "websocket" } });
      const gem = up.webSocket;
      console.log("[" + sid + "] upstream status:", up.status, "websocket:", !!gem);
      if (!gem) {
        browser.send(JSON.stringify({ proxyError: "upstream failed: " + up.status }));
        browser.close(1011, "upstream failed");
        return new Response(null, { status: 101, webSocket: client });
      }
      gem.accept();
      browser.addEventListener("message", (e) => { try { if (gem.readyState === 1) gem.send(e.data); } catch (err) {} });
      gem.addEventListener("message", async (e) => {
        try {
          if (browser.readyState !== 1) return;
          const data = e.data;
          let text;
          if (typeof data === "string") text = data;
          else { const buf = data instanceof Blob ? await data.arrayBuffer() : data; text = new TextDecoder().decode(buf); }
          browser.send(text);
        } catch (err) {}
      });
      browser.addEventListener("close", (e) => { console.log("[" + sid + "] browser closed: " + e.code); try { gem.close(); } catch (err) {} });
      gem.addEventListener("close", (e) => { console.log("[" + sid + "] GEM closed: " + e.code + " " + e.reason); try { browser.close(); } catch (err) {} });
      browser.addEventListener("error", () => console.log("[" + sid + "] browser error"));
      gem.addEventListener("error", () => console.log("[" + sid + "] GEM error"));
    } catch (e) {
      console.log("[" + sid + "] exception:", redact(String((e && e.message) || e)));
      browser.send(JSON.stringify({ proxyError: redact(String((e && e.message) || e)) }));
      browser.close(1011, "proxy error");
    }
    return new Response(null, { status: 101, webSocket: client });
  }
};
