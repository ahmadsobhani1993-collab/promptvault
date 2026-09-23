export async function generateText(opts: {
  instruction: string
  imgBase64?: string | null
  imgMime?: string
  expectJson?: boolean
}): Promise<{ text: string; model: string }> {
  const parts: any[] = [{ text: opts.instruction }]
  if (opts.imgBase64) {
    parts.push({
      inlineData: {
        mimeType: opts.imgMime || 'image/jpeg',
        data: opts.imgBase64.replace(/^data:[^;]+;base64,/, '').trim(),
      },
    })
  }

  const keys = getGeminiKeys()
  if (keys.length === 0) {
    throw new Error('GEMINI_FAILED: کلید API برای جمینای تنظیم نشده است.')
  }

  const errors: string[] = []

  for (const model of MODEL_CHAIN) {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const keyMasked = `${key.slice(0, 5)}...${key.slice(-3)}`

      try {
        const payload: any = { contents: [{ parts }] }
        if (opts.expectJson) {
          payload.generationConfig = { responseMimeType: 'application/json' }
        }

        // تایم‌اوت ۱۲ ثانیه؛ در صورت کندی سرور گوگل فوراً مدل بعدی تست می‌شود
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(12000),
          }
        )

        const bodyText = await res.text()

        if (!res.ok) {
          console.warn(`[GEMINI FAIL] ${model} (Key ${keyMasked}): Status ${res.status}`)
          errors.push(`${model}: HTTP ${res.status}`)
          continue // رفتن فوری به مدل بعدی
        }

        const json = JSON.parse(bodyText)
        const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

        if (!raw) {
          errors.push(`${model}: Empty content`)
          continue
        }

        return { text: raw, model }
      } catch (err: any) {
        const isTimeout = err?.name === 'TimeoutError' || String(err).includes('timeout')
        const msg = isTimeout ? 'Timeout (>12s)' : (err?.message || 'Network error')
        console.warn(`[GEMINI SWITCH] ${model}: ${msg}`)
        errors.push(`${model}: ${msg}`)
        continue
      }
    }
  }

  throw new Error(`GEMINI_FAILED: تمام مدل‌های لیست با خطا مواجه شدند -> [${errors.join(' | ')}]`)
}
