"use client"

import { usePathname } from "next/navigation"

export default function LangSwitch({ currentLocale }: { currentLocale: "fa" | "en" }) {
  const pathname = usePathname() || "/"

  const switchTo = (lang: "fa" | "en") => {
    if (lang === currentLocale) return

    // تنظیم کوکی صریح
    document.cookie = "locale=" + lang + "; path=/; max-age=" + (60 * 60 * 24 * 365) + "; SameSite=Lax"

    if (lang === "fa") {
      // پاک کردن پیشوند /en و هدایت مستقیم
      const target = pathname.startsWith("/en") ? pathname.replace(/^/en/, "") || "/" : pathname
      window.location.href = target
    } else {
      // اضافه کردن پیشوند /en
      const clean = pathname.startsWith("/en") ? pathname : ("/en" + (pathname === "/" ? "" : pathname))
      window.location.href = clean
    }
  }

  return (
    <div dir="ltr" className="flex items-center rounded-xl border border-white/10 bg-zinc-950/80 p-0.5 shadow-inner">
      <button
        type="button"
        onClick={() => switchTo("fa")}
        className={"rounded-lg px-2.5 py-1 text-xs font-semibold transition-all " + (
          currentLocale === "fa"
            ? "border border-amber-500/40 bg-amber-500/20 font-bold text-amber-300 shadow-sm"
            : "text-zinc-400 hover:text-white"
        )}
      >
        فارسی
      </button>

      <button
        type="button"
        onClick={() => switchTo("en")}
        className={"rounded-lg px-2.5 py-1 text-xs font-semibold transition-all " + (
          currentLocale === "en"
            ? "border border-amber-500/40 bg-amber-500/20 font-bold text-amber-300 shadow-sm"
            : "text-zinc-400 hover:text-white"
        )}
      >
        English
      </button>
    </div>
  )
}
