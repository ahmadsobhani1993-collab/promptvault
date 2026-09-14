"use client"

import { usePathname } from "next/navigation"

export default function LangSwitch({ currentLocale }: { currentLocale: "fa" | "en" }) {
  const pathname = usePathname() || "/"

  const switchTo = (lang: "fa" | "en") => {
    if (lang === currentLocale) return

    document.cookie = "locale=" + lang + "; path=/; max-age=31536000; SameSite=Lax"

    if (lang === "fa") {
      let target = pathname
      if (target === "/en") {
        target = "/"
      } else if (target.startsWith("/en/")) {
        target = target.slice(3)
      }
      window.location.href = target
    } else {
      let target = pathname
      if (!target.startsWith("/en")) {
        target = target === "/" ? "/en" : "/en" + target
      }
      window.location.href = target
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
