import { NextRequest, NextResponse } from "next/server";
import { Client, handle_file } from "@gradio/client";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const text = formData.get("text") as string;
    const audioFile = formData.get("audio") as Blob | null;

    if (!text || !text.trim()) {
      return NextResponse.json({ ok: false, error: "لطفاً متن را وارد کنید." }, { status: 400 });
    }

    const app = await Client.connect("k2-fsa/OmniVoice");

    const refAudio = audioFile && audioFile.size > 0 ? handle_file(audioFile) : null;

    // ارسال ۱۲ آرگومان دقیق و الزامی اندپوینت /_clone_fn
    const result: any = await app.predict("/_clone_fn", [
      text,          // 1. text
      "Auto",        // 2. lang
      refAudio,      // 3. ref_aud
      "",            // 4. ref_text
      "",            // 5. instruct
      32,            // 6. ns
      3.0,           // 7. gs
      0.8,           // 8. dn
      1.0,           // 9. sp
      0,             // 10. du
      true,          // 11. pp
      true           // 12. po
    ]);

    let audioUrl = "";
    if (Array.isArray(result?.data)) {
      const first = result.data[0];
      audioUrl = typeof first === "string" ? first : first?.url || first?.path;
    } else if (result?.data?.url) {
      audioUrl = result.data.url;
    }

    if (!audioUrl) {
      return NextResponse.json({ ok: false, error: "مدل موفق به ساخت فایل صوتی نشد." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: audioUrl });
  } catch (err: any) {
    console.error("OmniVoice Error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "خطا در پردازش با سرور صوتی" },
      { status: 500 }
    );
  }
}
