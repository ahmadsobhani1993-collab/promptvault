interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiContent {
  role?: string;
  parts: GeminiPart[];
}

// لیست مدل‌های معتبر به ترتیب اولویت و پایداری
const ACTIVE_MODELS = [
  "gemini-3.6-flash",      // سریع، پایدار و بدون ترافیک
  "gemini-3.5-flash-lite", // سهمیه بالا
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
];

// ایندکس سراسری برای چرخش نوبتی کلیدها
let currentKeyIndex = 0;

function getAllApiKeys(): string[] {
  const keys: string[] = [];

  // ۱. پشتیبانی از متغیر چندتایی با کاما
  if (process.env.GEMINI_API_KEYS) {
    const splitKeys = process.env.GEMINI_API_KEYS.split(",").map((k) => k.trim()).filter(Boolean);
    keys.push(...splitKeys);
  }

  // ۲. پشتیبانی از کلیدهای شماره‌دار مجزا
  for (let i = 1; i <= 5; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k && !keys.includes(k.trim())) {
      keys.push(k.trim());
    }
  }

  // ۳. کلید پیش‌فرض قبلی
  if (process.env.GEMINI_API_KEY && !keys.includes(process.env.GEMINI_API_KEY.trim())) {
    keys.push(process.env.GEMINI_API_KEY.trim());
  }

  return keys;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function generateWithGeminiCascade(
  contents: GeminiContent[],
  systemInstruction?: string
): Promise<string> {
  const keys = getAllApiKeys();

  if (keys.length === 0) {
    throw new Error("هیچ کلید معتبری برای Gemini یافت نشد.");
  }

  let lastError: any = null;

  // ابتدا مدل پایدار را انتخاب کرده و بین کلیدها می‌چرخیم
  for (const model of ACTIVE_MODELS) {
    // تلاش روی تک‌تک کلیدهای موجود به صورت چرخشی
    for (let i = 0; i < keys.length; i++) {
      const activeKey = keys[(currentKeyIndex + i) % keys.length];

      try {
        const bodyPayload: any = { contents };
        if (systemInstruction) {
          bodyPayload.systemInstruction = {
            parts: [{ text: systemInstruction }],
          };
        }

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": activeKey,
            },
            body: JSON.stringify(bodyPayload),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            // نوبت را برای درخواست بعدی به کلید بعدی منتقل می‌کنیم
            currentKeyIndex = (currentKeyIndex + 1) % keys.length;
            return reply;
          }
        }

        const errorData = await res.json().catch(() => ({}));
        const status = res.status;

        // اگر خطا 429 یا 503 بود، با کلید بعدی امتحان می‌شود
        lastError = new Error(
          `Key ending in ...${activeKey.slice(-5)} with ${model} returned HTTP ${status}: ${
            errorData?.error?.message || "Unavailable"
          }`
        );

        // وقفه بسیار کوتاه قبل از سوئیچ کلید
        await sleep(500);
      } catch (err: any) {
        lastError = err;
      }
    }
  }

  throw lastError || new Error("تمامی کلیدها و مدل‌های Gemini با خطا مواجه شدند.");
}
