import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const title = searchParams.get('title') || 'PromptsFA'
    const category = searchParams.get('category') || 'AI'
    const model = searchParams.get('model') || 'ChatGPT'

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backgroundColor: '#0c0a09',
            padding: '50px 60px',
            color: '#ffffff',
            border: '8px solid #f5b942',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#f5b942',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#000',
                  fontSize: '22px',
                  fontWeight: 'bold',
                }}
              >
                P
              </div>
              <span style={{ fontSize: '26px', fontWeight: 'bold', color: '#f5b942' }}>
                PromptsFA
              </span>
            </div>
            <div
              style={{
                padding: '6px 16px',
                borderRadius: '999px',
                backgroundColor: 'rgba(245, 185, 66, 0.2)',
                border: '1px solid rgba(245, 185, 66, 0.5)',
                color: '#f5b942',
                fontSize: '18px',
              }}
            >
              {category}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                fontSize: '44px',
                fontWeight: 'bold',
                lineHeight: 1.3,
                color: '#ffffff',
                maxHeight: '170px',
                overflow: 'hidden',
              }}
            >
              {title}
            </div>
            <div style={{ fontSize: '20px', color: '#d4d4d8' }}>
              Model: {model}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid rgba(255, 255, 255, 0.15)',
              paddingTop: '20px',
            }}
          >
            <span style={{ fontSize: '18px', color: '#a1a1aa' }}>promptsfa.ir</span>
            <span style={{ fontSize: '18px', color: '#f5b942' }}>بانک هوشمند پرامپت</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch {
    return new Response('Failed to generate image', { status: 500 })
  }
}
