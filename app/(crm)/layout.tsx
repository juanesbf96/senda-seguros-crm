import Sidebar from '@/components/ui/Sidebar'
import TopBar from '@/components/ui/TopBar'

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative">
        <TopBar />
        {children}
      </main>
    </div>
  )
}
