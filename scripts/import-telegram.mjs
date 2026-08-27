import 'dotenv/config';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL = '@promptsfa1';
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function getMessages() {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
  const data = await res.json();
  return data.result.filter(m => m.message?.chat?.username === CHANNEL.replace('@', '') || m.message?.chat?.title?.includes('promptsfa'));
}

async function getPhotoUrl(fileId) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
  const { result } = await res.json();
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${result.file_path}`;
}

async function analyzeWithGemini(promptText) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Analyze this prompt: "${promptText}". Return ONLY valid JSON: {"titleFa": "فارسی", "tagsEn": ["t1","t2","t3","t4"], "usageFa": "توضیح فارسی", "model": "Midjourney"}` }] }]
    })
  });
  const data = await res.json();
  const text = data.candidates[0].content.parts[0].text;
  return JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
}

async function submitToSite(data) {
  const res = await fetch(`${API_URL}/api/submit-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function main() {
  const messages = await getMessages();
  for (const msg of messages.slice(-10)) {
    const m = msg.message;
    const promptText = m.caption || m.reply_to_message?.text || m.reply_to_message?.caption;
    if (!promptText || !m.photo) continue;

    const fileId = m.photo[m.photo.length - 1].file_id;
    const imageUrl = await getPhotoUrl(fileId);
    const analysis = await analyzeWithGemini(promptText);

    const result = await submitToSite({
      title: analysis.titleFa,
      prompt: promptText,
      description: analysis.usageFa,
      category: 'general',
      tags: analysis.tagsEn.join(', '),
      imageUrl: imageUrl,
      email: 'auto-import@promptsfa.ir'
    });
    
    console.log(result.ok ? `✅ ${analysis.titleFa}` : `❌ Error`);
    await new Promise(r => setTimeout(r, 1500));
  }
}

main();