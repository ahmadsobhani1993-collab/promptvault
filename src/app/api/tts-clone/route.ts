import { NextRequest, NextResponse } from "next/server";
import { Client } from "@gradio/client";

export const maxDuration = 60; // افزایش تایم‌اوت ورسل برای سنتز صدا

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const text = formData.get("text") as string;
    const audioFile = formData.get("audio") as Blob | null;

    if (!text || !text.trim()) {
      return NextResponse.json({ ok: false, error: "متن الزامی است" }, { status: 400 });
    }

    // اتصال به Space هاگینگ فیس OmniVoice
    const app = await Client.connect("k2-fsa/OmniVoice");

    // ارسال به اندپوینت پیش‌بینی (متن + فایل صوتی مرجع)
    const result = await app.predict(0, [
      text,
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
