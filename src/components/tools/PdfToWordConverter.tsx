'use client'

import { useState, useRef, ChangeEvent } from "react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import { createWorker } from "tesseract.js";

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
      alert("لطفاً یک فایل با پسوند PDF انتخاب کنید.");
    }
  };

  const convertToWord = async () => {
    if (!file) return;
    setLoading(true);
    setProgress(0);
    setStatusText("در حال راه‌اندازی موتورهای پردازش PDF و OCR...");

    let ocrWorker: any = null;

    try {
      // بارگذاری داینامیک موتور PDF
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;

      const docSections: Paragraph[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // شماره صفحه در فایل ورد
        docSections.push(
          new Paragraph({
            text: `--- صفحه ${i} ---`,
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
          })
        );

        // بررسی اینکه آیا صفحه متن قابل انتخاب دارد یا اسکن تصویری است
        const directText = (textContent.items as any[])
          .map((item) => item.str || "")
          .join(" ")
          .trim();

        if (directText.length > 20) {
          // صفحه دارای متن استاندارد است
          docSections.push(
            new Paragraph({
              children: [new TextRun({ text: directText, size: 24 })],
              bidirectional: true,
              spacing: { after: 120 },
            })
          );
        } else {
          // صفحه تصویری/اسکن است -> اجرای OCR با پشتیبانی فارسی و انگلیسی
          setStatusText(`صفحه ${i} اسکن تصویری است؛ در حال خواندن متن با OCR...`);

          if (!ocrWorker) {
            ocrWorker = await createWorker(["fas", "eng"]);
          }

          // رندر صفحه PDF روی یک بوم گرافیکی (Canvas)
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          if (ctx) {
            await page.render({ canvasContext: ctx, viewport }).promise;
            const imgDataUrl = canvas.toDataURL("image/png");

            // تشخیص کاراکترهای اسکن‌شده
            const ret = await ocrWorker.recognize(imgDataUrl);
            const recognizedText = ret.data.text.trim();

            docSections.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: recognizedText || "[متنی در این تصویر یافت نشد]",
                    size: 24,
                  }),
                ],
                bidirectional: true,
                spacing: { after: 120 },
              })
            );
          }
        }

        const percent = Math.round((i / numPages) * 100);
        setProgress(percent);
        setStatusText(`پردازش صفحه ${i} از ${numPages} (${percent}%)...`);

        page.cleanup();
      }

      setStatusText("در حال خروجی گرفتن فایل Word (.docx)...");

      const doc = new Document({
        sections: [{ properties: {}, children: docSections }],
      });

      const blob = await Packer.toBlob(doc);
      const outputFileName = file.name.replace(/\.pdf$/i, "") + ".docx";
      saveAs(blob, outputFileName);

      setStatusText("فایل ورد با موفقیت دانلود شد!");
    } catch (err: any) {
      console.error("OCR PDF to Word Error:", err);
      alert("خطا در پردازش فایل: " + (err?.message || "مشکلی پیش آمد"));
      setStatusText("خطا در تبدیل فایل.");
    } finally {
      if (ocrWorker) {
        await ocrWorker.terminate();
      }
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-white shadow-xl">
      <h2 className="mb-2 text-2xl font-black text-amber-400">
        تبدیل PDF به ورد هوشمند (پشتیبانی از اسکن و تصویر)
      </h2>
      <p className="mb-6 text-sm text-zinc-400">
        مجهز به موتور بینایی هوش مصنوعی (OCR) برای صفحات تصویری و اسکن‌شده بدون لایه متنی. ۱۰۰٪ پردازش روی مرورگر شما.
      </p>

      <div className="mb-6">
        <input
          type="file"
          accept=".pdf,application/pdf"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-xl border border-dashed border-zinc-700 bg-zinc-900/60 px-6 py-6 text-center font-medium transition hover:border-amber-500 hover:text-amber-400"
        >
          {file ? `📄 ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)` : "📁 انتخاب فایل PDF از سیستم"}
        </button>
      </div>

      {loading && (
        <div className="mb-6">
          <div className="mb-1 flex justify-between text-xs text-zinc-400">
            <span>{statusText}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-amber-500 transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {!loading && statusText && (
        <div className="mb-6 rounded-lg bg-zinc-900 p-3 text-xs text-amber-400">
          {statusText}
        </div>
      )}

      <button
        disabled={!file || loading}
        onClick={convertToWord}
        className="w-full rounded-xl bg-amber-500 py-3 font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
      >
        {loading ? "در حال استخراج متون اسکن‌شده..." : "شروع تبدیل و دانلود فایل DOCX"}
      </button>
    </div>
  );
}
