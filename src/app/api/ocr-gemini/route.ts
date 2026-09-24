import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "کلید GEMINI_API_KEY در تنظیمات سرور یافت نشد." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const mode = formData.get("mode") as string;
    const imageBase64 = formData.get("imageBase64") as string | null;
    const rawText = formData.get("rawText") as string | null;

    const ai = new GoogleGenAI({ apiKey });
    const targetModel = "gemini-3.6-flash";

    // حالت اول: پاکسازی و مرتب‌سازی متون به‌هم‌ریخته
    if (mode === "cleanup" && rawText) {
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `متن زیر از یک سند PDF استخراج شده و ممکن است حروف، کلمات یا ترتیب جملات فارسی و انگلیسی آن جابه‌جا یا به‌هم‌ریخته باشد.
لطفاً متن را کاملاً تصحیح و مرتب کن، علائم نگارشی را منظم کن و پاراگراف‌بندی تمیز تحویل بده.
فقط و فقط متن تصحیح‌شده نهایی را برگردان و هیچ توضیح، سلام یا مقدمه‌ای ننویس:

${rawText}`,
              },
            ],
          },
        ],
      });

      return NextResponse.json({ ok: true, text: response.text || rawText });
    }

    // حالت دوم: خواندن تصویر اسکن‌شده با OCR بینایی
    if (mode === "ocr" && imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: cleanBase64,
                },
              },
              {
                text: "تمام متن‌های موجود در این صفحه اسکن‌شده را با دقت کامل، با املای درست و با همان ترتیب و ساختار پاراگراف‌ها تایپ کن. هیچ توضیح اضافه‌ای ننویس، فقط خود متن استخراج‌شده.",
              },
            ],
          },
        ],
      });

      return NextResponse.json({ ok: true, text: response.text || "" });
    }

    return NextResponse.json({ ok: false, error: "درخواست نامعتبر است" }, { status: 400 });
  } catch (err: any) {
    console.error("Gemini Route Error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "خطای ارتباط با جمینای" },
      { status: 500 }
    );
  }
}
