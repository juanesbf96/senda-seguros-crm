import MktDashboard from '@/components/mkt/MktDashboard'
import TopBar from '@/components/ui/TopBar'

export default function MktPage() {
  return (
    <>
      <TopBar hq="mkt" />
      <MktDashboard />
    </>
  )
}
