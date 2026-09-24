import { NextResponse } from "next/server";

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      status: "error",
      message: "کلید GEMINI_API_KEY یافت نشد.",
    });
  }

  // استفاده از مدل فعال و سهمیه‌دار جدول شما
  const modelName = "gemini-3.5-flash-lite";

  try {
    const startTime = Date.now();

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "ping" }] }],
        }),
      }
    );

    const elapsed = Date.now() - startTime;
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        {
          status: "google_error",
          model: modelName,
          error: data,
        },
        { status: res.status }
      );
    }

    return NextResponse.json({
      status: "success",
      model: modelName,
      elapsedMs: elapsed,
      reply: data?.candidates?.[0]?.content?.parts?.[0]?.text || "پاسخ خالی",
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: "fetch_error", message: err?.message },
      { status: 500 }
    );
  }
}
