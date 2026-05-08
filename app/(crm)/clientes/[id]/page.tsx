import ClienteDetalle from '@/components/clientes/ClienteDetalle'

export default async function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ClienteDetalle id={id} />
}
