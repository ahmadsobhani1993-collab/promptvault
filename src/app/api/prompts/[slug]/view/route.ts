export const dynamic = 'force-dynamic'

// Views are counted only by /api/track/batch.
// This stays as a harmless no-op so any old cached page that still calls it cannot double count.
export async function POST() {
  return new Response(null, { status: 204 })
}

export async function GET() {
  return new Response(null, { status: 204 })
}