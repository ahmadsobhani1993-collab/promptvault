import { NextRequest, NextResponse } from "next/server";
import { Client } from "@gradio/client";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const text = formData.get("text") as string;
    const audioFile = formData.get("audio") as Blob | null;

    if (!text || !text.trim()) {
      return NextResponse.json({ ok: false, error: "لطفاً متن را وارد کنید." }, { status: 400 });
    }

    // اتصال با timeout کنترل شده
    const app = await Client.connect("k2-fsa/OmniVoice");
    
    // اگر فایل آپلود نشده باشد مقدار undefined می‌فرستیم تا اسپیس ارور ندهد
    const params: any[] = [text, "Auto"];
    if (audioFile && audioFile.size > 0) {
      params.push(audioFile);
    } else {
      params.push(null);
    }

    const result: any = await app.predict(0, params);
    return NextResponse.json({ ok: true, data: result.data });
  } catch (err: any) {
    console.error("TTS Server Error:", err);
    return NextResponse.json(
      { ok: false, error: "خطا از سمت مدل صوتی: " + (err?.message || "پاسخی دریافت نشد") },
      { status: 500 }
    );
  }
}
