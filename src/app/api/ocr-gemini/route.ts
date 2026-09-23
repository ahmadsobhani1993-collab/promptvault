import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageBase64 = formData.get("imageBase64") as string;

    if (!imageBase64) {
      return NextResponse.json({ ok: false, error: "تصویر ارسال نشد" }, { status: 400 });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
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
              text: "تمام متون موجود در این تصویر را بدون کم و کاست، با دقت بالا و حفظ ساختار و پاراگراف‌ها استخراج کن. فقط خود متن استخراج‌شده را برگردان و هیچ توضیح اضافه‌ای ننویس.",
            },
          ],
        },
      ],
    });

    return NextResponse.json({ ok: true, text: response.text || "" });
  } catch (err: any) {
    console.error("Gemini OCR Error:", err);
    return NextResponse.json({ ok: false, error: err?.message || "خطا در پردازش با Gemini" }, { status: 500 });
  }
}
