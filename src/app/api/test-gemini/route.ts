import { NextResponse } from "next/server";
import { generateWithGeminiCascade } from "@/lib/gemini";

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const startTime = Date.now();
    const reply = await generateWithGeminiCascade([
      { parts: [{ text: "تست سلامت کلیدهای چرخشی" }] },
    ]);
    const elapsed = Date.now() - startTime;

    return NextResponse.json({
      status: "success",
      message: "درخواست با موفقیت از سیستم چرخشی کلیدها عبور کرد.",
      latencyMs: elapsed,
      reply,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        message: err?.message,
      },
      { status: 500 }
    );
  }
}
