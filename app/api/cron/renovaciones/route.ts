import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// ── Tipos ──────────────────────────────────────────────────────────────────
interface PolizaPorVencer {
  poliza_id:      string
  numero_poliza:  string | null
  aseguradora:    string
  ramo:           string
  prima_neta:     number | null
  fecha_fin:      string
  dias_restantes: number
  cliente_nombre: string
  workspace_id:   string
  workspace_name: string
  admin_email:    string
  admin_nombre:   string
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatCOP(v: number | null): string {
  if (!v) return '—'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

function urgencyColor(dias: number): string {
  if (dias <= 7)  return '#dc2626'  // red
  if (dias <= 15) return '#d97706'  // amber
  return '#059669'                   // emerald (30d)
}

function urgencyBg(dias: number): string {
  if (dias <= 7)  return '#fef2f2'
  if (dias <= 15) return '#fffbeb'
  return '#f0fdf4'
}

// ── Email template ─────────────────────────────────────────────────────────
function buildEmail(
  adminNombre: string,
  workspaceName: string,
  rows7:  PolizaPorVencer[],
  rows15: PolizaPorVencer[],
  rows30: PolizaPorVencer[],
): string {
  function table(rows: PolizaPorVencer[], dias: number): string {
    if (rows.length === 0) return ''
    const color = urgencyColor(dias)
    const bg    = urgencyBg(dias)
    const titulo = dias === 7 ? '🔴 Vencen en 7 días o menos' : dias === 15 ? '🟠 Vencen en 8–15 días' : '🟢 Vencen en 16–30 días'
    const filas = rows.map(p => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px">${p.cliente_nombre}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569">${p.aseguradora}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569">${p.ramo}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569">${p.numero_poliza || '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#059669;font-weight:600">${formatCOP(p.prima_neta)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569">${formatDate(p.fecha_fin)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center">
          <span style="background:${bg};color:${color};font-weight:700;padding:3px 8px;border-radius:9999px;font-size:12px">${p.dias_restantes}d</span>
        </td>
      </tr>`).join('')

    return `
      <h3 style="color:${color};margin:24px 0 8px;font-size:15px">${titulo}</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Cliente</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Aseguradora</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Ramo</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em">N° Póliza</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Prima</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Vence</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Días</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>`
  }

  const total = rows7.length + rows15.length + rows30.length

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:700px;margin:40px auto;padding:0 16px">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#059669,#047857);border-radius:12px 12px 0 0;padding:28px 32px">
      <p style="color:#a7f3d0;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.08em">Senda Seguros CRM</p>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">Alerta de Renovaciones</h1>
      <p style="color:#d1fae5;margin:6px 0 0;font-size:14px">${workspaceName} · ${new Date().toLocaleDateString('es-CO', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:32px">
      <p style="color:#1e293b;font-size:15px;margin:0 0 8px">Hola <strong>${adminNombre}</strong>,</p>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">
        Tienes <strong>${total} póliza${total !== 1 ? 's' : ''}</strong> que vence${total !== 1 ? 'n' : ''} en los próximos 30 días.
        Es momento de contactar a los clientes para gestionar la renovación.
      </p>

      ${table(rows7,  7)}
      ${table(rows15, 15)}
      ${table(rows30, 30)}

      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #f1f5f9;text-align:center">
        <a href="https://senda-seguros-crm.vercel.app/renovaciones"
           style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">
          Ver renovaciones en el CRM →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin:16px 0 40px">
      Este email fue enviado automáticamente por Senda Seguros CRM.<br>
      Recibirás alertas a los 30, 15 y 7 días antes del vencimiento.
    </p>
  </div>
</body>
</html>`
}

// ── Handler principal ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // 1. Verificar que viene de Vercel Cron (header Authorization: Bearer CRON_SECRET)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Variables de entorno requeridas
  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey      = process.env.RESEND_API_KEY
  const fromEmail      = process.env.RESEND_FROM_EMAIL || 'Senda Seguros CRM <notificaciones@sendaseguros.com>'

  if (!supabaseUrl || !serviceRoleKey || !resendKey) {
    console.error('Cron: faltan variables de entorno (SUPABASE_SERVICE_ROLE_KEY o RESEND_API_KEY)')
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
  }

  // 3. Cliente Supabase con service role (bypasea RLS)
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const resend   = new Resend(resendKey)

  // 4. Obtener todas las pólizas por vencer (próximos 30 días)
  const { data: polizas, error } = await supabase.rpc('get_polizas_por_vencer', { dias_max: 30 })
  if (error) {
    console.error('Cron: error consultando pólizas:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const todas = (polizas || []) as PolizaPorVencer[]
  if (todas.length === 0) {
    return NextResponse.json({ message: 'Sin pólizas por vencer hoy', sent: 0 })
  }

  // 5. Agrupar por workspace + filtrar por umbral (7, 15, 30 días)
  //    Para evitar duplicados: verificar tabla notificaciones_renovacion
  const umbrales = [7, 15, 30]
  const hoy = new Date().toISOString().split('T')[0]

  // Polizas que califican por umbral exacto
  const porUmbral = todas.filter(p =>
    umbrales.some(u => p.dias_restantes <= u)
  )

  // Verificar cuáles ya fueron notificadas hoy
  const polizaIds = porUmbral.map(p => p.poliza_id)
  const { data: yaEnviadas } = await supabase
    .from('notificaciones_renovacion')
    .select('poliza_id, dias_alerta')
    .in('poliza_id', polizaIds)
    .eq('fecha_envio', hoy)

  const enviadas = new Set((yaEnviadas || []).map(n => `${n.poliza_id}-${n.dias_alerta}`))

  // 6. Determinar umbral aplicable por póliza (el menor umbral que aún no se notificó)
  function umbralAplicable(dias: number): number | null {
    for (const u of [7, 15, 30]) {
      if (dias <= u && !enviadas.has(`${dias}-${u}`)) {
        return u
      }
    }
    return null
  }

  // Agrupar por workspace
  const porWorkspace = new Map<string, { polizas: Map<number, PolizaPorVencer[]>; admin: PolizaPorVencer }>()

  for (const p of todas) {
    const diasRestantes = p.dias_restantes
    const umbral = umbrales.find(u => diasRestantes <= u)
    if (!umbral) continue
    const key = `${p.poliza_id}-${umbral}`
    if (enviadas.has(key)) continue

    if (!porWorkspace.has(p.workspace_id)) {
      porWorkspace.set(p.workspace_id, { polizas: new Map(), admin: p })
    }
    const ws = porWorkspace.get(p.workspace_id)!
    if (!ws.polizas.has(umbral)) ws.polizas.set(umbral, [])
    ws.polizas.get(umbral)!.push(p)
  }

  if (porWorkspace.size === 0) {
    return NextResponse.json({ message: 'Todas las notificaciones de hoy ya fueron enviadas', sent: 0 })
  }

  // 7. Enviar un email por workspace y registrar
  let emailsSent = 0
  const logEntries: { workspace_id: string; poliza_id: string; dias_alerta: number; fecha_envio: string; email_destino: string }[] = []

  for (const [wsId, { polizas: mapaUmbral, admin }] of porWorkspace) {
    const rows7  = mapaUmbral.get(7)  || []
    const rows15 = mapaUmbral.get(15) || []
    const rows30 = mapaUmbral.get(30) || []

    const todas3 = [...rows7, ...rows15, ...rows30]
    if (todas3.length === 0) continue

    const html = buildEmail(admin.admin_nombre, admin.workspace_name, rows7, rows15, rows30)

    const { error: emailError } = await resend.emails.send({
      from:    fromEmail,
      to:      admin.admin_email,
      subject: `🔔 ${todas3.length} póliza${todas3.length !== 1 ? 's' : ''} por renovar — ${admin.workspace_name}`,
      html,
    })

    if (emailError) {
      console.error(`Cron: error enviando email a ${admin.admin_email}:`, emailError)
      continue
    }

    emailsSent++

    // Registrar cada póliza notificada
    for (const p of rows7)  logEntries.push({ workspace_id: wsId, poliza_id: p.poliza_id, dias_alerta: 7,  fecha_envio: hoy, email_destino: admin.admin_email })
    for (const p of rows15) logEntries.push({ workspace_id: wsId, poliza_id: p.poliza_id, dias_alerta: 15, fecha_envio: hoy, email_destino: admin.admin_email })
    for (const p of rows30) logEntries.push({ workspace_id: wsId, poliza_id: p.poliza_id, dias_alerta: 30, fecha_envio: hoy, email_destino: admin.admin_email })
  }

  // 8. Guardar log (con service role, ignora RLS)
  if (logEntries.length > 0) {
    const { error: logError } = await supabase
      .from('notificaciones_renovacion')
      .insert(logEntries)
    if (logError) console.error('Cron: error guardando log:', logError)
  }

  return NextResponse.json({
    message: `Cron ejecutado correctamente`,
    date:    hoy,
    polizasRevisadas:    todas.length,
    emailsEnviados:      emailsSent,
    notificacionesLog:   logEntries.length,
  })
}
