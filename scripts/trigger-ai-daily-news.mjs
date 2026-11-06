const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '')
const cronSecret = process.env.CRON_SECRET

if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not configured')
if (!cronSecret) throw new Error('CRON_SECRET is not configured')

const response = await fetch(`${appUrl}/api/cron/ai-daily-news`, {
  headers: { Authorization: `Bearer ${cronSecret}` },
  signal: AbortSignal.timeout(70000),
})
const body = await response.text()

if (!response.ok) {
  throw new Error(`AI Daily cron failed (${response.status}): ${body.slice(0, 1000)}`)
}

console.info(body)
