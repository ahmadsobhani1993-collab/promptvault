import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const title = searchParams.get('title') || 'PromptsFA'
  const category = searchParams.get('category') || 'AI Prompt'
  const model = searchParams.get('model') || 'ChatGPT / Midjourney'

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0a0805',
          backgroundImage: 'radial-gradient(circle at 85% 15%, rgba(245, 185, 66, 0.15), transparent 45%)',
          padding: '60px 70px',
          fontFamily: 'sans-serif',
          color: '#f4f4f5',
          border: '2px solid rgba(245, 185, 66, 0.3)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: '#f5b942',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000',
                fontSize: '24px',
                fontWeight: '900',
              }}
            >
              P
            </div>
            <span style={{ fontSize: '26px', fontWeight: '800', color: '#f5b942', letterSpacing: '1px' }}>
              PromptsFA
            </span>
          </div>
          <div
            style={{
              padding: '8px 18px',
              borderRadius: '999px',
              backgroundColor: 'rgba(245, 185, 66, 0.12)',
              border: '1px solid rgba(245, 185, 66, 0.4)',
              color: '#f5b942',
              fontSize: '18px',
              fontWeight: '600',
            }}
          >
            {category}
          </div>
        </div>

        {/* Title / Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              fontSize: '48px',
              fontWeight: '900',
              lineHeight: 1.3,
              color: '#ffffff',
              maxHeight: '190px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: '22px', color: '#a1a1aa' }}>
            مدل پیشنهادی: {model}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid rgba(255, 255, 255, 0.12)',
            paddingTop: '25px',
          }}
        >
          <span style={{ fontSize: '20px', color: '#71717a' }}>promptsfa.ir</span>
          <span style={{ fontSize: '20px', color: '#f5b942', fontWeight: 'bold' }}>
            بانک تخصصی پرامپت‌های هوش مصنوعی
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
