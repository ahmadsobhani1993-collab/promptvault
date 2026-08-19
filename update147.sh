#!/bin/bash
set -e

# ---------- Remove non-existent PWAInstallButton import ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/header.tsx'
let s = fs.readFileSync(p, 'utf8')

// Remove the import
s = s.replace(/import PWAInstallButton from '@/components/pwa-install-button'\n/, '')

// Remove the component usage
s = s.replace(/<PWAInstallButton \/>/, '')

fs.writeFileSync(p, s)
console.log('✅ Removed PWAInstallButton from header')
NODEEOF

echo "✅ update147 done!"