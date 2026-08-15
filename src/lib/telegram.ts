export type TgMessage = {
  id: number
  text: string
  img: string | null
  reply: boolean
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

export function parsePage(html: string): TgMessage[] {
  const parts = html.split('<div class="tgme_widget_message')
  const out: TgMessage[] = []
  for (const p of parts.slice(1)) {
    const idm = p.match(/data-post="[^"]*\/(\d+)"/)
    if (!idm) continue
    const textM = p.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)
    const imgM = p.match(/background-image:url\('([^']+)'\)/)
    let img: string | null = null
    if (imgM) img = imgM[1].startsWith('//') ? 'https:' + imgM[1] : imgM[1]
    out.push({
      id: parseInt(idm[1], 10),
      text: textM ? decode(textM[1]) : '',
      img,
      reply: p.includes('tgme_widget_message_reply'),
    })
  }
  return out
}

export async function fetchPage(username: string, before?: number): Promise<TgMessage[]> {
  const url = 'https://t.me/s/' + username + (before ? '?before=' + before : '')
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) return []
  return parsePage(await res.text())
}

const TG = () => 'https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN

export async function tgSendText(chat: string, text: string) {
  await fetch(TG() + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text }),
  })
}

export async function tgSendFile(chat: string, filename: string, content: string) {
  const form = new FormData()
  form.append('chat_id', chat)
  form.append('document', new Blob([content], { type: 'text/plain' }), filename)
  await fetch(TG() + '/sendDocument', { method: 'POST', body: form })
}
