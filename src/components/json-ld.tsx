export default function JsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "PromptsFA",
    "url": "https://promptsfa.ir",
    "description": "هزاران پرامپت حرفه‌ای هوش مصنوعی به فارسی",
    "inLanguage": "fa-IR",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://promptsfa.ir/explore?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
