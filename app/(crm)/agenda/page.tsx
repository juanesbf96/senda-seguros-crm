'use client'
import dynamic from 'next/dynamic'

const AgendaView = dynamic(() => import('@/components/agenda/AgendaView'), { ssr: false })

export default function AgendaPage() {
  return <AgendaView />
}
