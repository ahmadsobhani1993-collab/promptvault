import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY, // اختیاری است؛ خود SDK هم به‌صورت خودکار پیدایش می‌کند
});

export async function askGroq(promptText: string) {
  const completion = await groq.chat.completions.create({
    // نام مدل را اینجا مشخص می‌کنید:
    model: "qwen/qwen3-32b", // یا "llama-3.3-70b-versatile"
    messages: [
      {
        role: "system",
        content: "تو یک دستیار هوشمند هستی. پاسخ‌ها را دقیق و به فارسی روان بده.",
      },
      {
        role: "user",
        content: promptText,
      },
    ],
    temperature: 0.2,
  });

  return completion.choices[0]?.message?.content || "";
}