import { NextRequest, NextResponse } from "next/server";
import { Client } from "@gradio/client";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const text = formData.get("text") as string;
    const audioFile = formData.get("audio") as Blob | null;

    if (!text || !text.trim()) {
      return NextResponse.json({ ok: false, error: "متن ورودی الزامی است" }, { status: 400 });
    }

    console.log("TTS Request received. Text length:", text.length, "Audio size:", audioFile?.size);

    const app = await Client.connect("k2-fsa/OmniVoice");
    
    // ارسال به endpoint پیش‌فرض
    const result: any = await app.predict(0, [
      text,
      "Auto",
      audioFile || null,
    ]);

    console.log("TTS Result:", result?.data);
    return NextResponse.json({ ok: true, data: result.data });
  } catch (err: any) {
    console.error("Full TTS Error Log:", err);
    return NextResponse.json(
      { 
        ok: false, 
        error: err?.message || "خطای ناشناخته در سرور صوتی",
        stack: err?.stack || null
      },
      { status: 500 }
    );
  }
}
