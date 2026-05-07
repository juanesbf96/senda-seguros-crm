'use client'
import dynamic from 'next/dynamic'

const InformesView = dynamic(() => import('@/components/informes/InformesView'), { ssr: false })

export default function InformesPage() {
  return <InformesView />
}
