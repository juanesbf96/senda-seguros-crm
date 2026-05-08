import Sidebar from '@/components/ui/Sidebar'
import { ToastProvider } from '@/components/ui/Toast'

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </ToastProvider>
  )
}
