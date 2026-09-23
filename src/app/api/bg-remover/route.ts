import { NextRequest, NextResponse } from "next/server";
import { HfInference } from "@huggingface/inference";

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY || "");

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as Blob | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "تصویر یافت نشد" }, { status: 400 });
    }

    // استفاده از قوی‌ترین مدل تفکیک پس‌زمینه (همانند Meigen)
    const resultBlob = await hf.imageToImage({
      model: "briaai/RMBG-1.4",
      inputs: file,
    });

    return new Response(resultBlob, {
      headers: {
        "Content-Type": "image/png",
      },
    });
  } catch (err: any) {
    console.error("RMBG API Error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "خطا در پردازش تصویر با مدل ابری" },
      { status: 500 }
    );
  }
}
