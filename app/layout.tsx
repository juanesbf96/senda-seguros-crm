import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Senda Seguros CRM',
  description: 'CRM para agencia de seguros Senda Seguros',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50">
        {children}
      </body>
    </html>
  )
}
