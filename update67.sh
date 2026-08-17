#!/bin/bash
set -e

# ---------- tag hero title + subtitle ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/hero.tsx'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('hero-title')) {
  s = s.replace(/<h1 className="/, '<h1 className="hero-title ')
  console.log('✅ hero: title tagged')
}
if (!s.includes('hero-sub')) {
  s = s.replace(/<p className="/, '<p className="hero-sub ')
  console.log('✅ hero: subtitle tagged')
}

fs.writeFileSync(p, s)
NODEEOF

# ---------- CSS: one-line title + readable subtitle ----------
cat >> src/app/globals.css << 'EOF'

/* hero fixes */
.hero-title {
  font-size: clamp(1.5rem, 4.2vw, 2.9rem) !important;
  white-space: nowrap;
  letter-spacing: -0.01em;
}
@media (max-width: 700px) {
  .hero-title { white-space: normal; }
}
.hero-sub {
  color: #d8cdb2 !important;
}
EOF

echo "✅ update67 done!"