'use client'

import { useState, useRef } from "react";

export default function OmniVoiceTool() {
  const [text, setText] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setGeneratedAudio(null);

    try {
      const fd = new FormData();
      fd.append("text", text);
      if (audioFile) {
        fd.append("audio", audioFile);
      }

      const res = await fetch("/api/tts-clone", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "خطا در پردازش صدا");
      }

      // هاگینگ فیس آدرس فایل خروجی را برمی‌گرداند
      const audioResult = json.data?.[0];
      const audioUrl = typeof audioResult === "string" ? audioResult : audioResult?.url;
      setGeneratedAudio(audioUrl);
    } catch (err: any) {
      alert("خطا: " + (err?.message || "مشکلی رخ داد"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-white shadow-xl">
      <h2 className="mb-2 text-2xl font-black text-amber-400">
        تبدیل متن به گفتار و شبیه‌سازی صدا (OmniVoice)
      </h2>
      <p className="mb-6 text-sm text-zinc-400">
        متن خود را بنویسید و در صورت تمایل یک نمونه صدای چند ثانیه‌ای آپلود کنید تا صدا با همان لحن شبیه‌سازی شود.
      </p>

      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium text-zinc-300">متن مورد نظر:</label>
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="متنی که می‌خواهید خوانده شود را اینجا بنویسید..."
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-white focus:border-amber-500 focus:outline-none"
        />
      </div>

      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-zinc-300">
          نمونه صدا برای کلون/شبیه‌سازی (اختیاری):
        </label>
        <input
          type="file"
          accept="audio/*"
          ref={fileInputRef}
          onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
          className="hidden"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/60 px-4 py-2 text-sm transition hover:border-amber-500 hover:text-amber-400"
          >
            {audioFile ? audioFile.name : "📁 انتخاب فایل صوتی (mp3, wav)"}
          </button>
          {audioFile && (
            <button
              onClick={() => setAudioFile(null)}
              className="text-xs text-red-400 hover:underline"
            >
              حذف
            </button>
          )}
        </div>
      </div>

      <button
        disabled={loading || !text.trim()}
        onClick={handleGenerate}
        className="w-full rounded-xl bg-amber-500 py-3 font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
      >
        {loading ? "در حال شبیه‌سازی و تبدیل به گفتار..." : "تولید صدا"}
      </button>

      {generatedAudio && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <span className="mb-2 block text-xs font-semibold text-zinc-400">نتیجه صوتی:</span>
          <audio controls src={generatedAudio} className="w-full" />
          <a
            href={generatedAudio}
            download="speech-output.wav"
            className="mt-3 inline-block text-xs text-amber-400 hover:underline"
          >
            دانلود فایل صوتی
          </a>
        </div>
      )}
    </div>
  );
}
