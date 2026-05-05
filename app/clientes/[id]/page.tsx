import ClienteDetalle from '@/components/clientes/ClienteDetalle'

export default function ClienteDetallePage({ params }: { params: { id: string } }) {
  return <ClienteDetalle id={params.id} />
}
