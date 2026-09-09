import { NextResponse } from 'next/server'
import { generateText } from '@/lib/gemini'

export async function GET() {
  try {
    console.log('[Test Gemini] Starting...')
    const keysEnv = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || 'NOT_SET'
    console.log('[Test Gemini] Keys found:', keysEnv.length > 10 ? 'YES (' + keysEnv.split(',').length + ' keys)' : 'NO')
    
    const result = await generateText({
      instruction: 'Say "Hello, Gemini is working!" in one sentence.'
    })
    
    return NextResponse.json({
      ok: true,
      model: result.model,
      text: result.text
    })
  } catch (err: any) {
    console.error('[Test Gemini] Error:', err)
    return NextResponse.json({
      ok: false,
      error: err.message
    }, { status: 500 })
  }
}
