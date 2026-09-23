import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "کلید GEMINI_API_KEY در تنظیمات سرور (Environment Variables) تعریف نشده است." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const imageBase64 = formData.get("imageBase64") as string;

    if (!imageBase64) {
      return NextResponse.json({ ok: false, error: "تصویری ارسال نشد" }, { status: 400 });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
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
              text: "متن این تصویر را به فارسی دقیق و خوانا استخراج کن بدون هیچ توضیح اضافه‌ای.",
            },
          ],
        },
      ],
    });

    return NextResponse.json({ ok: true, text: response.text || "" });
  } catch (err: any) {
    console.error("Gemini Error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "خطای پردازش Gemini" },
      { status: 500 }
    );
  }
}
