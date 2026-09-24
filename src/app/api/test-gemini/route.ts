import { NextResponse } from "next/server";

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// تمام مدل‌های فعال و مجاز در پنل شما
const MODELS = [
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3-flash",
];

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ status: "error", message: "کلید یافت نشد." });
  }

  const results: Record<string, any> = {};

  for (const model of MODELS) {
    try {
      const startTime = Date.now();
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "hi" }] }],
          }),
        }
      );

      const elapsed = Date.now() - startTime;
      const data = await res.json();

      if (res.ok) {
        results[model] = {
          status: "OK",
          latencyMs: elapsed,
          text: data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim(),
        };
      } else {
        results[model] = {
          status: `HTTP ${res.status}`,
          error: data?.error?.message || data?.error?.status,
        };
      }
    } catch (e: any) {
      results[model] = { status: "NETWORK_ERROR", error: e?.message };
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    results,
  });
}
