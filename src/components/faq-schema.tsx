export default function FAQSchema() {
  const faqData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "پرامپت هوش مصنوعی چیست؟",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "پرامپت هوش مصنوعی مجموعه‌ای از دستورات و کلمات کلیدی است که به ابزارهای هوش مصنوعی مانند Midjourney، ChatGPT و DALL-E داده می‌شود تا خروجی مورد نظر را تولید کنند."
        }
      },
      {
        "@type": "Question",
        "name": "چگونه از پرامپت‌های PromptsFA استفاده کنم؟",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "کافی است متن پرامپت را کپی کرده و در ابزار هوش مصنوعی مورد نظر خود (مانند Midjourney یا ChatGPT) paste کنید. می‌توانید پارامترها را بر اساس نیاز خود تنظیم کنید."
        }
      },
      {
        "@type": "Question",
        "name": "آیا پرامپت‌های PromptsFA رایگان هستند؟",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "بله، تمام پرامپت‌های موجود در PromptsFA به صورت رایگان در دسترس کاربران قرار دارند."
        }
      }
    ]
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
    />
  )
}
