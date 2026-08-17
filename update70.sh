#!/bin/bash
set -e

node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/hero.tsx'
let s = fs.readFileSync(p, 'utf8')

// 1) badge: remove wrong hero-sub class
s = s.replace('className="hero-sub gold-badge', 'className="gold-badge')

// 2) delete the subtitle paragraph completely
s = s.replace(/<p className="anim-fade-up mx-auto mt-5 max-w-xl text-sm leading-8 text-ink-muted md:text-base"[^>]*>[\s\S]*?<\/p>/, '')

// 3) title: allow one line
s = s.replace('hero-title anim-fade-up mx-auto mt-6 max-w-3xl', 'hero-title anim-fade-up mx-auto mt-6 max-w-none')

fs.writeFileSync(p, s)
console.log('✅ hero fixed: subtitle removed, badge restored, title one-line')
NODEEOF

cat >> src/app/globals.css << 'EOF'

.hero-title {
  font-size: clamp(1.5rem, 4.2vw, 2.9rem) !important;
  white-space: nowrap;
}
@media (max-width: 700px) {
  .hero-title { white-space: normal; }
}
EOF

echo "✅ update70 done!"