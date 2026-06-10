import PolizaDetalle from '@/components/polizas/PolizaDetalle'

export default async function PolizaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PolizaDetalle id={id} />
}
