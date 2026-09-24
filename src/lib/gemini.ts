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

const ACTIVE_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
];

let currentKeyIndex = 0;

function getAllApiKeys(): string[] {
  const keys: string[] = [];

  if (process.env.GEMINI_API_KEYS) {
    const splitKeys = process.env.GEMINI_API_KEYS.split(",").map((k) => k.trim()).filter(Boolean);
    keys.push(...splitKeys);
  }

  for (let i = 1; i <= 5; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k && !keys.includes(k.trim())) {
      keys.push(k.trim());
    }
  }

  if (process.env.GEMINI_API_KEY && !keys.includes(process.env.GEMINI_API_KEY.trim())) {
    keys.push(process.env.GEMINI_API_KEY.trim());
  }

  return keys;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function generateWithGeminiCascade(
  contents: GeminiContent[],
  systemInstruction?: string,
  jsonMode: boolean = false
): Promise<string> {
  const keys = getAllApiKeys();

  if (keys.length === 0) {
    throw new Error("هیچ کلید معتبری برای Gemini یافت نشد.");
  }

  let lastError: any = null;

  for (const model of ACTIVE_MODELS) {
    for (let i = 0; i < keys.length; i++) {
      const activeKey = keys[(currentKeyIndex + i) % keys.length];

      try {
        const bodyPayload: any = { contents };
        if (systemInstruction) {
          bodyPayload.systemInstruction = {
            parts: [{ text: systemInstruction }],
          };
        }
        if (jsonMode) {
          bodyPayload.generationConfig = {
            responseMimeType: "application/json",
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
            currentKeyIndex = (currentKeyIndex + 1) % keys.length;
            return reply;
          }
        }

        const errorData = await res.json().catch(() => ({}));
        lastError = new Error(
          `${model} HTTP ${res.status}: ${errorData?.error?.message || "Unavailable"}`
        );
        await sleep(400);
      } catch (err: any) {
        lastError = err;
      }
    }
  }

  throw lastError || new Error("همه مدل‌ها و کلیدهای جمینای ناموفق بودند.");
}

export async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
  return generateWithGeminiCascade(
    [{ parts: [{ text: prompt }] }],
    systemInstruction
  );
}

export async function normalizePrompt(rawText: string): Promise<string> {
  if (!rawText || !rawText.trim()) return "";

  const systemInstruction = 
    "You are a text cleaner for AI prompts. Clean the provided text by removing Telegram channel links, promotional usernames, emojis overload, and irrelevant footers, while keeping the main prompt text completely intact. Output ONLY the cleaned text.";

  try {
    const cleaned = await generateWithGeminiCascade(
      [{ parts: [{ text: rawText }] }],
      systemInstruction
    );
    return cleaned.trim() || rawText;
  } catch (err) {
    console.error("normalizePrompt error fallback to raw:", err);
    return rawText;
  }
}

export async function analyzeWithGemini(
  content: string | GeminiPart[],
  systemInstruction?: string,
  jsonMode: boolean = true
): Promise<any> {
  const parts: GeminiPart[] = typeof content === "string" ? [{ text: content }] : content;
  const rawResponse = await generateWithGeminiCascade([{ parts }], systemInstruction, jsonMode);

  if (jsonMode) {
    try {
      const cleaned = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      return { raw: rawResponse };
    }
  }

  return rawResponse;
}
