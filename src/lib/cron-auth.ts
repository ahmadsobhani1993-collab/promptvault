export function isCronAuthorized(req: Request): boolean {
  const { searchParams } = new URL(req.url)
  const ua = req.headers.get('user-agent') ?? ''
  const auth = req.headers.get('authorization')
  const key = searchParams.get('key')

  // 1) Vercel Cron (User-Agent = vercel-cron/1.0)
  if (ua.includes('vercel-cron')) return true

  // 2) Authorization: Bearer <CRON_SECRET>
  if (process.env.CRON_SECRET && auth === 'Bearer ' + process.env.CRON_SECRET) return true

  // 3) ?key=<CRON_SECRET>  (دستی / cron-job.org)
  if (process.env.CRON_SECRET && key === process.env.CRON_SECRET) return true

  return false
}
