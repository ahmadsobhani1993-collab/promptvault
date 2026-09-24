import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      status: "error",
      message: "کلید GEMINI_API_KEY در تنظیمات Vercel یافت نشد.",
    });
  }

  const modelName = "gemini-3.5-flash-lite";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const startTime = Date.now();

    const response = await ai.models.generateContent({
      model: modelName,
      contents: "ping",
    });

    const elapsed = Date.now() - startTime;

    return NextResponse.json({
      status: "success",
      message: "ارتباط ورسل با جمینای برقرار است.",
      model: modelName,
      elapsedMs: elapsed,
      responsePreview: response?.text || "پاسخ خالی",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "google_error",
        model: modelName,
        message: err?.message,
        code: err?.code,
        statusHttp: err?.status,
        details: err?.errorDetails || err?.details,
      },
      { status: 500 }
    );
  }
}
