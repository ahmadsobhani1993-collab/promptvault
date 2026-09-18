export function generatePlaceholderCover(title: string, type: 'code' | 'audio' | 'general' = 'code'): string {
  const safeTitle = (title || 'Prompt').slice(0, 32)
  const isCode = type === 'code'
  const icon = isCode 
    ? `<path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke="#D4AF37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="M9 18V5l12-2v13M9 9l12-2" stroke="#D4AF37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" fill="#D4AF37"/><circle cx="18" cy="16" r="3" fill="#D4AF37"/>`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <rect width="600" height="600" fill="#0B0B0D"/>
    <radialGradient id="g" cx="50%" cy="30%" r="60%">
      <stop offset="0%" stop-color="#D4AF37" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0B0B0D" stop-opacity="0"/>
    </radialGradient>
    <rect width="600" height="600" fill="url(#g)"/>
    <rect x="20" y="20" width="560" height="560" rx="24" fill="none" stroke="#232329" stroke-width="2"/>
    <g transform="translate(268, 220) scale(2.6)">
      ${icon}
    </g>
    <text x="300" y="380" fill="#F7F1E3" font-size="26" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">${safeTitle}</text>
    <text x="300" y="420" fill="#D4AF37" font-size="14" letter-spacing="3" text-anchor="middle" font-family="system-ui, sans-serif">PROMPTSFA ${type.toUpperCase()}</text>
  </svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}