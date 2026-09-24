import { NextRequest, NextResponse } from "next/server";
import { Client, handle_file } from "@gradio/client";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const text = formData.get("text") as string;
    const audioFile = formData.get("audio") as Blob | null;

    if (!text || !text.trim()) {
      return NextResponse.json({ ok: false, error: "متن ورودی الزامی است." }, { status: 400 });
    }

    const app = await Client.connect("k2-fsa/OmniVoice");

    // آماده‌سازی فایل صوتی در صورت وجود
    const refAudio = audioFile && audioFile.size > 0 ? handle_file(audioFile) : null;

    // ارسال ۱۲ آرگومان دقیق و مطابق با سورس کد _clone_fn
    const result: any = await app.predict("/_clone_fn", [
      text,          // 1. text
      "Auto",        // 2. lang
      refAudio,      // 3. ref_aud
      "",            // 4. ref_text (optional)
      "",            // 5. instruct (style prompt)
      32,            // 6. ns (Inference steps: 32)
      3.0,           // 7. gs (Guidance scale: 3.0)
      0.8,           // 8. dn (Denoise ratio: 0.8)
      1.0,           // 9. sp (Speed: 1.0)
      0,             // 10. du (Duration: 0 = auto)
      true,          // 11. pp (Preprocess prompt)
      true           // 12. po (Postprocess output)
    ]);

    // داده‌های خروجی: ایندکس ۰ فایل صوت است
    let audioUrl = "";
    if (Array.isArray(result?.data)) {
      const first = result.data[0];
      audioUrl = typeof first === "string" ? first : first?.url || first?.path;
    } else if (result?.data?.url) {
      audioUrl = result.data.url;
    }

    if (!audioUrl) {
      console.error("OmniVoice Output missing:", result?.data);
      return NextResponse.json({ ok: false, error: "فایل خروجی تولید نشد." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: audioUrl });
  } catch (err: any) {
    console.error("OmniVoice Full Error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "خطا در پردازش با مدل صوتی" },
      { status: 500 }
    );
  }
}
