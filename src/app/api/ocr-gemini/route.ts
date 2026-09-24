import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

async function generateWithRetry(ai: any, model: string, contents: any[], retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent({ model, contents });
    } catch (err: any) {
      if ((err?.status === 503 || err?.code === 503) && i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
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
    const { mode, items } = body; // items: آرایه‌ای از متون یا تصاویر base64 همراه با شماره صفحه

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: false, error: "داده‌ای ارسال نشده است." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const targetModel = "gemini-3.5-flash-lite";

    if (mode === "cleanup") {
      // ترکیب چانک متنی برای صرفه‌جویی در درخواست
      const combinedText = items
        .map((it: any) => `=== صفحه ${it.page} ===\n${it.text}`)
        .join("\n\n");

      const response = await generateWithRetry(ai, targetModel, [
        {
          role: "user",
          parts: [
            {
              text: `متن زیر شامل چندین صفحه از یک سند است که حروف و کلمات آن به‌هم‌ریخته است. 
لطفاً متن هر صفحه را با حفظ عنوان "=== صفحه X ===" مرتب، ویراستاری و پاراگراف‌بندی کن. هیچ توضیح یا مقدمه‌ای ننویس:\n\n${combinedText}`,
            },
          ],
        },
      ]);

      return NextResponse.json({ ok: true, text: response?.text || combinedText });
    }

    if (mode === "ocr") {
      // ارسال چانک تصاویر در یک ریکوئست
      const parts: any[] = [];
      for (const it of items) {
        const cleanBase64 = it.imageBase64.replace(/^data:image\/\w+;base64,/, "");
        parts.push({
          text: `محتوای صفحه شماره ${it.page}:`,
        });
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanBase64,
          },
        });
      }

      parts.push({
        text: "تمام متون موجود در این صفحات اسکن‌شده را با دقت کامل، ساختار درست و تفکیک هر صفحه استخراج کن. برای هر صفحه عنوان '=== صفحه X ===' را درج کن.",
      });

      const response = await generateWithRetry(ai, targetModel, [
        {
          role: "user",
          parts: parts,
        },
      ]);

      return NextResponse.json({ ok: true, text: response?.text || "" });
    }

    return NextResponse.json({ ok: false, error: "حالت نامعتبر است." }, { status: 400 });
  } catch (err: any) {
    console.error("Gemini Chunk OCR Error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "خطای ارتباط با جمینای" },
      { status: 500 }
    );
  }
}
