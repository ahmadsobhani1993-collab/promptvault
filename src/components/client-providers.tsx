'use client'

import dynamic from 'next/dynamic'

const RouteLoader = dynamic(() => import('@/components/route-loader'), { ssr: false })
const PWAControls = dynamic(() => import('@/components/pwa-controls'), { ssr: false })

export default function ClientProviders() {
  return (
    <>
      <PWAControls />
      <RouteLoader />
    </>
  )
}
