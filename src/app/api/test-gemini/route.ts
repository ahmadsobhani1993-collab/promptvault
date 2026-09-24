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

  const modelName = "gemini-2.5-flash"; // یا gemini-3.5-flash-lite

  try {
    const startTime = Date.now();

    // ارسال مستقیم از طریق REST API با هدر Authorization
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "ping" }] }],
        }),
      }
    );

    const elapsed = Date.now() - startTime;
    const data = await res.json();

    if (!res.ok) {
      // در صورت عدم پذیرش Bearer، بررسی فرمت x-goog-api-key
      const fallbackRes = await fetch(
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
      const fallbackData = await fallbackRes.json();
      
      if (!fallbackRes.ok) {
        return NextResponse.json(
          {
            status: "google_error",
            primaryError: data,
            fallbackError: fallbackData,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        status: "success",
        methodUsed: "x-goog-api-key",
        elapsedMs: elapsed,
        text: fallbackData?.candidates?.[0]?.content?.parts?.[0]?.text,
      });
    }

    return NextResponse.json({
      status: "success",
      methodUsed: "Bearer",
      elapsedMs: elapsed,
      text: data?.candidates?.[0]?.content?.parts?.[0]?.text,
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: "fetch_error", message: err?.message },
      { status: 500 }
    );
  }
}
