import Sidebar from '@/components/ui/Sidebar'
import TopBar from '@/components/ui/TopBar'
import { ToastProvider } from '@/components/ui/Toast'

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Gradient background — verde claro a casi blanco */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 0% 0%, rgba(111, 207, 151, 0.18) 0%, rgba(232, 247, 239, 0.5) 25%, #FEFDFB 60%, #FFFFFF 100%)',
            }}
          />
          <TopBar hq="seg" />
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
