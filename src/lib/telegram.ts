export type TgMessage = {
  id: number
  text: string
  img: string | null
  reply: boolean
  isPromptPlaceholder: boolean
}

function decode(s: string) {
  return s
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim()
}

const PROMPT_HINT = /پرامپت در پیام بعد|prompt in next|see next|👇/i

function parseRaw(html: string): TgMessage[] {
  const parts = html.split('<div class="tgme_widget_message_wrap')
  const out: TgMessage[] = []
  for (const p of parts.slice(1)) {
    const idm = p.match(/data-post="[^"]*\/(\d+)"/)
    if (!idm) continue
    const textM = p.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)
    const imgM = p.match(/background-image:url\('([^']+)'\)/)
    let img: string | null = null
    if (imgM) img = imgM[1].startsWith('//') ? 'https:' + imgM[1] : imgM[1]
    const text = textM ? decode(textM[1]) : ''
    out.push({
      id: parseInt(idm[1], 10),
      text,
      img,
      reply: p.includes('tgme_widget_message_reply'),
      isPromptPlaceholder: PROMPT_HINT.test(text) && text.length < 200,
    })
  }
  return out
}

function mergePairs(raw: TgMessage[]): TgMessage[] {
  const sorted = [...raw].sort((a, b) => a.id - b.id)
  const out: TgMessage[] = []
  let i = 0
  while (i < sorted.length) {
    const cur = sorted[i]
    const next = sorted[i + 1]
    if (
      cur.isPromptPlaceholder &&
      cur.img &&
      next &&
      !next.img &&
      next.text.length > 200 &&
      next.id <= cur.id + 2
    ) {
      out.push({ ...cur, text: next.text, reply: false, isPromptPlaceholder: false })
      i += 2
      continue
    }
    out.push(cur)
    i += 1
  }
  return out
}

async function fetchText(url: string, ms: number): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    signal: AbortSignal.timeout(ms),
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return await res.text()
}

export async function fetchPage(username: string, before?: number): Promise<TgMessage[]> {
  const url = 'https://t.me/s/' + username + (before ? '?before=' + before : '')
  let html: string
  try {
    html = await fetchText(url, 7000)
  } catch {
    html = await fetchText('https://api.allorigins.win/raw?url=' + encodeURIComponent(url), 9000)
  }
  return mergePairs(parseRaw(html))
}

export async function diagnoseChannel(username: string) {
  try {
    const direct = await fetchText('https://t.me/s/' + username, 7000)
    return { via: 'direct', messages: mergePairs(parseRaw(direct)).length }
  } catch (e: any) {
    try {
      const proxied = await fetchText(
        'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://t.me/s/' + username),
        9000
      )
      return { via: 'allorigins', messages: mergePairs(parseRaw(proxied)).length, directError: String(e?.message ?? e) }
    } catch (e2: any) {
      return { via: 'none', directError: String(e?.message ?? e), proxyError: String(e2?.message ?? e2) }
    }
  }
}

const TG = () => 'https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN

export async function tgSendText(chat: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(TG() + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function tgSendPhoto(chat: string, photo: string, caption: string): Promise<boolean> {
  try {
    const res = await fetch(TG() + '/sendPhoto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, photo, caption }),
      signal: AbortSignal.timeout(10000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function tgSendCode(chat: string, code: string, footer?: string): Promise<boolean> {
  try {
    const body = code.length > 4000 ? code.slice(0, 4000) + '\n…' : code
    const text = body + (footer ?? '')
    const res = await fetch(TG() + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text,
        entities: [{ type: 'pre', offset: 0, length: body.length, language: '' }],
      }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function verifyImage(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(9000) })
    const ct = r.headers.get('content-type') ?? ''
    return r.ok && ct.startsWith('image')
  } catch {
    return false
  }
}
