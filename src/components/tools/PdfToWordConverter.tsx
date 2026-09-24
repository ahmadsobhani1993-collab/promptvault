'use client'

import { useState, useRef, ChangeEvent } from "react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import ToolAuthGuard from "./ToolAuthGuard";

const CHUNK_SIZE = 20; // افزایش به دسته‌های ۲۰ صفحه‌ای
const MAX_ALLOWED_PAGES = 500;

function PdfConverterCore() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
      setProgress(0);
      setStatusText("");
      setErrorDetails(null);
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
      script.crossOrigin = "anonymous";
      script.onload = () => {
        const lib = (window as any).pdfjsLib;
        if (lib) {
          lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          resolve(lib);
        } else {
          reject(new Error("موتور PDF بارگذاری نشد"));
        }
      };
      script.onerror = () => reject(new Error("خطا در لود کتابخانه PDF"));
      document.head.appendChild(script);
    });
  };

  const convertToWord = async () => {
    if (!file) return;
    setLoading(true);
    setProgress(0);
    setErrorDetails(null);

    try {
      setStatusText("در حال بازخوانی سند...");
      const pdfjs = await loadPdfEngine();
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdfDoc.numPages;

      if (numPages > MAX_ALLOWED_PAGES) {
        throw new Error(`سند شامل ${numPages} صفحه است. سقف مجاز پردازش ${MAX_ALLOWED_PAGES} صفحه در روز است.`);
      }

      const docSections: Paragraph[] = [];

      for (let start = 1; start <= numPages; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE - 1, numPages);
        setStatusText(`پردازش دسته صفحات ${start} تا ${end} از ${numPages}...`);

        const textItems: { page: number; text: string }[] = [];
        const imageItems: { page: number; imageBase64: string }[] = [];

        for (let p = start; p <= end; p++) {
          const page = await pdfDoc.getPage(p);
          const textContent = await page.getTextContent();
          const pageText = (textContent.items || []).map((it: any) => it.str || "").join(" ").trim();

          if (pageText.length >= 25) {
            textItems.push({ page: p, text: pageText });
          } else {
            const viewport = page.getViewport({ scale: 1.0 });
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            if (ctx) {
              await page.render({ canvasContext: ctx, viewport }).promise;
              imageItems.push({ page: p, imageBase64: canvas.toDataURL("image/jpeg", 0.65) });
            }
          }
          page.cleanup();
        }

        if (textItems.length > 0) {
          const res = await fetch("/api/ocr-gemini", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "cleanup", items: textItems }),
          });
          const data = await res.json().catch(() => null);
          const rawResult = data?.ok && data.text ? data.text : textItems.map(t => `=== صفحه ${t.page} ===\n${t.text}`).join("\n\n");
          
          rawResult.split("\n").forEach((line: string) => {
            if (line.trim().startsWith("===")) {
              docSections.push(new Paragraph({ text: line.trim(), heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } }));
            } else if (line.trim()) {
              docSections.push(new Paragraph({ children: [new TextRun({ text: line, size: 24 })], bidirectional: true, spacing: { after: 100 } }));
            }
          });
        }

        if (imageItems.length > 0) {
          const res = await fetch("/api/ocr-gemini", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "ocr", items: imageItems }),
          });
          const data = await res.json().catch(() => null);
          if (data?.ok && data.text) {
            data.text.split("\n").forEach((line: string) => {
              if (line.trim().startsWith("===")) {
                docSections.push(new Paragraph({ text: line.trim(), heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } }));
              } else if (line.trim()) {
                docSections.push(new Paragraph({ children: [new TextRun({ text: line, size: 24 })], bidirectional: true, spacing: { after: 100 } }));
              }
            });
          }
        }

        const percent = Math.round((end / numPages) * 100);
        setProgress(percent);
      }

      setStatusText("در حال ایجاد فایل DOCX...");
      const doc = new Document({
        sections: [{ properties: {}, children: docSections }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, file.name.replace(/\.pdf$/i, "") + ".docx");
      setStatusText("تبدیل با موفقیت پایان یافت!");
    } catch (err: any) {
      console.error(err);
      setErrorDetails(err?.message || "خطا در پردازش فایل");
      setStatusText("فرآیند متوقف شد.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-6 text-white shadow-xl">
      <h2 className="mb-2 text-2xl font-black text-amber-400">تبدیل هوشمند PDF به فایل ورد</h2>
      <p className="mb-6 text-sm text-zinc-400">
        پردازش دسته‌ای سریع با مدل‌های آبشاری هوش مصنوعی (سقف مجاز روزانه ۵۰۰ صفحه)
      </p>

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

      {statusText && (
        <div className="mb-4">
          <div className="mb-1 flex justify-between text-xs text-zinc-400">
            <span>{statusText}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full bg-amber-500 transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {errorDetails && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
          ⚠️ {errorDetails}
        </div>
      )}

      <button
        type="button"
        disabled={!file || loading}
        onClick={convertToWord}
        className="w-full rounded-xl bg-amber-500 py-3 font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
      >
        {loading ? "در حال استخراج و تبدیل..." : "شروع تبدیل و دانلود DOCX"}
      </button>
    </div>
  );
}

export default function PdfToWordConverter() {
  return (
    <ToolAuthGuard toolName="تبدیل هوشمند PDF به ورد">
      <PdfConverterCore />
    </ToolAuthGuard>
  );
}
