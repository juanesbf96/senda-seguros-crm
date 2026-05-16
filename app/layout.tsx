import type { Metadata } from 'next'
import './globals.css'
import { WorkspaceProvider } from '@/contexts/WorkspaceContext'

export const metadata: Metadata = {
  title: 'Senda Seguros CRM',
  description: 'CRM para agencia de seguros Senda Seguros',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50">
        <WorkspaceProvider>
          {children}
        </WorkspaceProvider>
      </body>
    </html>
  )
}
