'use client'

import { useState, useRef, ChangeEvent } from "react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

export default function PdfToWordConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
      setProgress(0);
      setStatusText("");
    } else if (selected) {
      alert("لطفاً یک فایل معتبر PDF انتخاب کنید.");
    }
  };

  const loadPdfEngine = async (): Promise<any> => {
    if (typeof window === "undefined") return null;
    if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

    return new Promise((resolve, reject) => {
      const existing = document.getElementById("pdfjs-cdn-script");
      if (existing) {
        existing.addEventListener("load", () => resolve((window as any).pdfjsLib));
        return;
      }
      const script = document.createElement("script");
      script.id = "pdfjs-cdn-script";
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => {
        const lib = (window as any).pdfjsLib;
        lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(lib);
      };
      script.onerror = () => reject(new Error("خطا در دانلود اسکریپت PDF"));
      document.head.appendChild(script);
    });
  };

  const convertToWord = async () => {
    if (!file) return;
    setLoading(true);
    setProgress(5);
    setStatusText("آماده‌سازی موتور پردازش اسناد...");

    try {
      const pdfjs = await loadPdfEngine();
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdfDoc.numPages;

      const docSections: Paragraph[] = [];

      for (let i = 1; i <= numPages; i++) {
        setStatusText(`در حال استخراج صفحه ${i} از ${numPages} با هوش مصنوعی...`);
        const page = await pdfDoc.getPage(i);

        let pageText = "";
        const textContent = await page.getTextContent();
        pageText = (textContent.items || []).map((item: any) => item.str || "").join(" ").trim();

        // اگر صفحه لایه متنی نداشت (اسکن/تصویر بود)، با Gemini OCR خوانده می‌شود
        if (pageText.length < 10) {
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (ctx) {
            await page.render({ canvasContext: ctx, viewport }).promise;
            const base64 = canvas.toDataURL("image/jpeg", 0.85);

            const fd = new FormData();
            fd.append("imageBase64", base64);
            const res = await fetch("/api/ocr-gemini", { method: "POST", body: fd });
            const data = await res.json();
            if (data.ok && data.text) {
              pageText = data.text;
            }
          }
        }

        docSections.push(
          new Paragraph({
            text: `--- صفحه ${i} ---`,
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
          })
        );

        if (pageText.length > 0) {
          docSections.push(
            new Paragraph({
              children: [new TextRun({ text: pageText, size: 24 })],
              bidirectional: true,
              spacing: { after: 120 },
            })
          );
        }

        const percent = Math.round((i / numPages) * 100);
        setProgress(percent);
        page.cleanup();
      }

      setStatusText("در حال تولید فایل Word...");
      const doc = new Document({
        sections: [{ properties: {}, children: docSections }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, file.name.replace(/\.pdf$/i, "") + ".docx");
      setStatusText("انجام شد!");
    } catch (err: any) {
      console.error(err);
      alert("خطا: " + (err?.message || "مشکلی رخ داد"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-6 text-white shadow-xl">
      <h2 className="mb-2 text-2xl font-black text-amber-400">تبدیل هوشمند PDF به ورد با Gemini OCR</h2>
      <p className="mb-6 text-sm text-zinc-400">پشتیبانی کامل از صفحات اسکن‌شده و دست‌نویس فارسی</p>

      <div className="mb-6">
        <input type="file" accept=".pdf,application/pdf" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-xl border border-dashed border-zinc-700 bg-zinc-900/60 px-6 py-6 text-center font-medium transition hover:border-amber-500 hover:text-amber-400"
        >
          {file ? `📄 ${file.name}` : "📁 انتخاب فایل PDF"}
        </button>
      </div>

      {loading && (
        <div className="mb-6">
          <div className="mb-1 flex justify-between text-xs text-zinc-400">
            <span>{statusText}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full bg-amber-500 transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <button
        disabled={!file || loading}
        onClick={convertToWord}
        className="w-full rounded-xl bg-amber-500 py-3 font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
      >
        {loading ? "در حال پردازش..." : "شروع تبدیل و دانلود DOCX"}
      </button>
    </div>
  );
}
