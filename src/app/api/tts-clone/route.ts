import { NextRequest, NextResponse } from "next/server";
import { Client } from "@gradio/client";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const text = formData.get("text") as string;
    const audioFile = formData.get("audio") as Blob | null;

    if (!text || !text.trim()) {
      return NextResponse.json({ ok: false, error: "متن الزامی است" }, { status: 400 });
    }

    const app = await Client.connect("k2-fsa/OmniVoice");

    // پارامترهای منطبق با ورودی‌های Gradio اسپیس OmniVoice:
    // آرگومان ۱: متن ورودی
    // آرگومان ۲: زبان (پیش‌فرض Auto)
    // آرگومان ۳: فایل نمونه صوتی
    const result = await app.predict(0, [
      text,
      "Auto",
      audioFile || null,
    ]);

    return NextResponse.json({ ok: true, data: result.data });
  } catch (err: any) {
    console.error("OmniVoice Error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "خطا در برقراری ارتباط با مدل صوتی" },
      { status: 500 }
    );
  }
}
