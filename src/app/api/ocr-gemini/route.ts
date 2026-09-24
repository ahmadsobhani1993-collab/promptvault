import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

// مدل‌های معتبر فعال بر اساس جدول سهمیه شما (آبشاری از بالا به پایین)
const CASCADE_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3-flash",
];

async function callGeminiCascade(ai: any, contents: any[]) {
  let lastError = null;

  for (const model of CASCADE_MODELS) {
    try {
      const res = await ai.models.generateContent({ model, contents });
      if (res?.text) {
        return res.text;
      }
    } catch (err: any) {
      console.warn(`Model ${model} failed, switching to next. Error:`, err?.message);
      lastError = err;
    }
  }

  throw lastError || new Error("هیچ‌کدام از مدل‌های فعال جمینای پاسخ ندادند.");
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "کلید GEMINI_API_KEY در تنظیمات سرور یافت نشد." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { mode, items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: false, error: "داده‌ای ارسال نشده است." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });

    if (mode === "cleanup") {
      const combinedText = items
        .map((it: any) => `=== صفحه ${it.page} ===\n${it.text}`)
        .join("\n\n");

      const text = await callGeminiCascade(ai, [
        {
          role: "user",
          parts: [
            {
              text: `متن زیر شامل چندین صفحه از یک سند است.
تمام متون را از نظر املایی، پیوستگی و پاراگراف‌بندی تصحیح کن. حتماً عنوان "=== صفحه X ===" را قبل از متن هر صفحه دست‌نخورده نگه دار. فقط متن تصحیح‌شده را خروجی بده:\n\n${combinedText}`,
            },
          ],
        },
      ]);

      return NextResponse.json({ ok: true, text });
    }

    if (mode === "ocr") {
      const parts: any[] = [];
      for (const it of items) {
        const cleanBase64 = it.imageBase64.replace(/^data:image\/\w+;base64,/, "");
        parts.push({ text: `=== صفحه ${it.page} ===` });
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanBase64,
          },
        });
      }

      parts.push({
        text: "تمام متون موجود در این تصاویر اسکن‌شده را با دقت کامل استخراج کن. بالای متن هر صفحه همان شناسه '=== صفحه X ===' را درج کن.",
      });

      const text = await callGeminiCascade(ai, [{ role: "user", parts }]);
      return NextResponse.json({ ok: true, text });
    }

    return NextResponse.json({ ok: false, error: "حالت نامعتبر است." }, { status: 400 });
  } catch (err: any) {
    console.error("Gemini Cascade OCR Error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "خطای ارتباط با سرور جمینای" },
      { status: 500 }
    );
  }
}
