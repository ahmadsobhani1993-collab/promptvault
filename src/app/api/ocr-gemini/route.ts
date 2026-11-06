import { NextRequest, NextResponse } from "next/server";
import { generateText, PDF_OCR_MODEL_CHAIN } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ITEMS = 20;
const MAX_TEXT_CHARS = 100_000;
const MAX_IMAGE_CHARS = 8_000_000;

type PdfTextItem = { page: number; text: string };
type PdfImageItem = { page: number; imageBase64: string; mimeType?: string };

function isPageNumber(page: unknown): page is number {
  return Number.isInteger(page) && Number(page) > 0;
}

function normalizeImage(item: PdfImageItem): { base64: string; mimeType: string } {
  const dataUrlMatch = item.imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s);
  const mimeType = item.mimeType || dataUrlMatch?.[1] || "image/jpeg";
  const base64 = (dataUrlMatch?.[2] || item.imageBase64).trim();
  if (!/^image\/(jpeg|png|webp)$/.test(mimeType) || !base64 || base64.length > MAX_IMAGE_CHARS) {
    throw new Error("تصویر صفحه نامعتبر یا بیش از حد بزرگ است.");
  }
  return { base64, mimeType };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = body?.mode;
    const items: unknown = body?.items;

    if ((mode !== "cleanup" && mode !== "ocr") || !Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
      return NextResponse.json({ ok: false, error: "درخواست صفحات PDF معتبر نیست." }, { status: 400 });
    }

    if (mode === "cleanup") {
      const textItems = items as Partial<PdfTextItem>[];
      if (textItems.some((item) => !isPageNumber(item.page) || typeof item.text !== "string")) {
        return NextResponse.json({ ok: false, error: "متن صفحات PDF معتبر نیست." }, { status: 400 });
      }

      const combinedText = textItems
        .map((item) => `=== صفحه ${item.page} ===\n${item.text}`)
        .join("\n\n");
      if (combinedText.length > MAX_TEXT_CHARS) {
        return NextResponse.json({ ok: false, error: "متن PDF از حد مجاز بزرگ‌تر است." }, { status: 413 });
      }

      const { text } = await generateText({
        instruction: `متن زیر شامل چندین صفحه از یک سند است.
متن را از نظر املایی، پیوستگی و پاراگراف‌بندی تصحیح کن. شناسهٔ "=== صفحه X ===" را قبل از متن هر صفحه بدون تغییر نگه دار. فقط متن تصحیح‌شده را خروجی بده:

${combinedText}`,
        modelChain: PDF_OCR_MODEL_CHAIN,
        timeoutMs: 18000,
        totalTimeoutMs: 55000,
      });
      return NextResponse.json({ ok: true, text });
    }

    const imageItems = items as Partial<PdfImageItem>[];
    if (imageItems.some((item) => !isPageNumber(item.page) || typeof item.imageBase64 !== "string")) {
      return NextResponse.json({ ok: false, error: "تصاویر صفحات PDF معتبر نیستند." }, { status: 400 });
    }

    let images: { base64: string; mimeType: string }[];
    try {
      images = imageItems.map((item) => normalizeImage(item as PdfImageItem));
    } catch (error) {
      const message = error instanceof Error ? error.message : "تصویر صفحه نامعتبر است.";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
    const markers = imageItems.map((item) => `=== صفحه ${item.page} ===`).join("\n");
    const { text } = await generateText({
      instruction: `تصاویر صفحه‌های یک PDF به همین ترتیب ارسال شده‌اند. متن هر تصویر را با دقت استخراج کن و شناسهٔ صفحهٔ متناظر را دقیقاً قبل از متن آن قرار بده.
${markers}
فقط متن استخراج‌شده را برگردان؛ چیزی را حدس نزن و توضیح اضافه نکن.`,
      imageParts: images,
      modelChain: PDF_OCR_MODEL_CHAIN,
      timeoutMs: 18000,
      totalTimeoutMs: 55000,
    });
    return NextResponse.json({ ok: true, text });
  } catch (error) {
    console.error("[PDF Gemini Gateway]", error);
    const message = error instanceof Error ? error.message : "خطای ارتباط با سرویس OCR";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
