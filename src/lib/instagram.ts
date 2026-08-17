export async function sendToInstagram(p: any) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  const igUserId = process.env.INSTAGRAM_USER_ID
  if (!token || !igUserId) return { skipped: 'instagram not configured yet' }
  if (!p) return { skipped: 'no prompt' }

  const caption =
    '✨ ' + p.titleFa + '\n\n📘 ' + (p.usageFa ?? '') + '\n\n' +
    (p.tagsFa ?? []).map((t: string) => '#' + t.replace(/\s+/g, '_')).join(' ') +
    '\n\n@Prompts_fa'

  try {
    const create = await (await fetch('https://graph.facebook.com/v19.0/' + igUserId + '/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: p.img, caption, media_type: 'IMAGE', access_token: token }),
      signal: AbortSignal.timeout(20000),
    })).json()
    if (!create.id) return { error: create.error?.message ?? 'create failed' }

    await new Promise((r) => setTimeout(r, 4000))

    const publish = await (await fetch('https://graph.facebook.com/v19.0/' + igUserId + '/media_publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: create.id, access_token: token }),
      signal: AbortSignal.timeout(20000),
    })).json()

    return publish.id ? { ok: true, igId: publish.id } : { error: publish.error?.message ?? 'publish failed' }
  } catch (e: any) {
    return { error: String(e?.message ?? e) }
  }
}
