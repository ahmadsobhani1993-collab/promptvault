#!/bin/bash
set -e

echo "===== Checking articles page structure ====="
if [ -f "src/app/admin/articles/page.tsx" ]; then
  echo "File exists. Checking for ArticleActions..."
  grep -n "ArticleActions" src/app/admin/articles/page.tsx || echo "ArticleActions not found"
  
  echo ""
  echo "Current file content around actions:"
  grep -A 3 -B 3 "حذف\|توقف\|منتشر" src/app/admin/articles/page.tsx | head -30
else
  echo "File not found!"
fi
echo "==========================================="

# ---------- Force add edit button ----------
node << 'NODEEOF'
const fs = require('fs')
const path = require('path')

// Try to find the articles page
const possiblePaths = [
  'src/app/admin/articles/page.tsx',
  'src/app/admin/articles/index.tsx',
]

let foundPath = null
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    foundPath = p
    break
  }
}

if (!foundPath) {
  console.log(' Articles page not found in expected locations')
  
  // Create it if doesn't exist
  const dir = 'src/app/admin/articles'
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  
  fs.writeFileSync(dir + '/page.tsx', `import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function AdminArticles() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/')

  const rows = await prisma.article.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <section className="container-app py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold"> مقالات</h1>
        <Link href="/admin" className="btn-secondary text-xs">← داشبورد</Link>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="divide-y divide-line">
          {rows.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-ink">{a.titleFa}</p>
                <p className="mt-1 text-[10px] text-ink-faint">{a.tagFa}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link 
                  href={'/admin/articles/' + a.id + '/edit'} 
                  className="rounded-full bg-blue-500/15 px-3 py-1 text-[10px] text-blue-400 hover:bg-blue-500/25"
                >
                  ✏️ ویرایش
                </Link>
                <span className={'rounded-full px-2 py-0.5 text-[9px] ' + (a.status === 'PUBLISHED' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400')}>
                  {a.status === 'PUBLISHED' ? 'منتشر' : 'در انتظار'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
`)
  console.log('✅ Created new articles page with edit button')
  process.exit(0)
}

console.log('Found articles page at:', foundPath)
let s = fs.readFileSync(foundPath, 'utf8')

// Check if edit button already exists
if (s.includes('/admin/articles/') && s.includes('/edit')) {
  console.log('✅ Edit button already exists')
  process.exit(0)
}

// Try to add edit button before ArticleActions or status badge
const editButton = '<Link href={\'/admin/articles/\' + a.id + \'/edit\'} className="rounded-full bg-blue-500/15 px-3 py-1 text-[10px] text-blue-400 transition-colors hover:bg-blue-500/25">✏️ ویرایش</Link>'

// Pattern 1: Before ArticleActions component
if (s.includes('<ArticleActions')) {
  s = s.replace(/<ArticleActions/g, editButton + '\n                <ArticleActions')
  console.log('✅ Edit button added before ArticleActions')
}
// Pattern 2: After status badge
else if (s.includes('bg-green-500/15') || s.includes('منتشر')) {
  s = s.replace(
    /(<span className=\{[^}]*bg-green-500\/15[^}]*\}>[^<]*<\/span>)/,
    '$1\n                ' + editButton
  )
  console.log('✅ Edit button added after status badge')
}
// Pattern 3: In actions div
else if (s.includes('flex shrink-0 gap-2')) {
  s = s.replace(
    /(<div className="flex shrink-0 gap-2">)/,
    '$1\n                ' + editButton
  )
  console.log('✅ Edit button added in actions div')
}
else {
  console.log('️ Could not find exact placement. Showing relevant section:')
  const match = s.match(/<div[^>]*className="[^"]*flex[^"]*gap[^"]*"[^>]*>[\s\S]{200,500}?<\/div>/)
  if (match) {
    console.log('Found section:', match[0].slice(0, 300))
  }
  process.exit(1)
}

// Ensure Link is imported
if (!s.includes("import Link from 'next/link'")) {
  s = "import Link from 'next/link'\n" + s
  console.log('✅ Added Link import')
}

fs.writeFileSync(foundPath, s)
console.log('✅ Edit button successfully added!')
NODEEOF

echo "✅ update189 done!"