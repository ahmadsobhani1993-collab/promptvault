#!/bin/bash
set -e

# ---------- 1) Related Prompts Component ----------
cat > src/components/related-prompts.tsx << 'EOF'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { L } from '@/lib/data'
import { type Locale } from '@/lib/i18n'

export default async function RelatedPrompts({
  articleTags,
  articleSlug,
  locale,
}: {
  articleTags: string[]
  articleSlug: string
  locale: Locale
}) {
  // Find prompts with matching tags
  const related = await prisma.prompt.findMany({
    where: {
      status: 'PUBLISHED',
      tagsFa: { hasSome: articleTags },
      NOT: { slug: articleSlug },
    },
    include: { category: true },
    orderBy: { createdAt: 'desc' },
    take: 6,
  })

  if (related.length === 0) return null

  return (
    <section className="mt-16 border-t border-line pt-10">
      <h2 className="font-display text-xl font-extrabold text-gold-bright">
        {L(locale, 'پرامپت‌های مرتبط', 'Related Prompts')}
      </h2>

      <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-6">
        {related.map((item) => (
          <Link
            key={item.id}
            href={'/prompts/' + item.slug}
            className="group relative overflow-hidden rounded-2xl border border-line bg-elevated transition-all hover:-translate-y-1 hover:border-gold/40 hover:shadow-xl hover:shadow-gold/5"
          >
            <div className="aspect-square overflow-hidden bg-[#0f0d0a]">
              {item.img ? (
                <img
                  src={item.img}
                  alt={item.titleFa}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
              ) : (
                <div className="grid h-full w-full place-items-center">
                  <span className="text-4xl text-ink-faint">🎨</span>
                </div>
              )}
            </div>

            <div className="p-3">
              <p className="line-clamp-2 text-xs font-bold text-ink">{item.titleFa}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-ink-muted">{item.category?.nameFa}</span>
                <div className="flex items-center gap-1 text-[10px] text-ink-faint">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  <span>{item.likes ?? 0}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
EOF
echo "✅ RelatedPrompts component created"

# ---------- 2) Add to blog post page ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/blog/[slug]/page.tsx'
if (!fs.existsSync(p)) { console.log('⚠️ no blog page'); process.exit(0) }
let s = fs.readFileSync(p, 'utf8')

// Add import
if (!s.includes('RelatedPrompts')) {
  s = s.replace(
    "import ArticleActions from '@/components/article-actions'",
    "import ArticleActions from '@/components/article-actions'\nimport RelatedPrompts from '@/components/related-prompts'"
  )
  console.log('✅ import added')
}

// Add RelatedPrompts component before closing section
if (!s.includes('<RelatedPrompts')) {
  // Find the article variable name
  const match = s.match(/const (\w+) = await prisma\.article\.findUnique/)
  const articleVar = match ? match[1] : 'article'
  
  // Get tags array - handle both string and array
  const tagsCode = `
      {${articleVar}?.tagFa && (
        <RelatedPrompts
          articleTags={[${articleVar}.tagFa]}
          articleSlug={${articleVar}.slug}
          locale={locale}
        />
      )}`
  
  // Insert before closing section tag, after ArticleActions
  s = s.replace(
    /(<ArticleActions id=\{[^}]+\} status=\{[^}]+\} \/>)/,
    '$1\n' + tagsCode
  )
  
  fs.writeFileSync(p, s)
  console.log('✅ RelatedPrompts mounted')
} else {
  console.log('⚠️ already mounted')
}
NODEEOF

echo "✅ update133 done!"