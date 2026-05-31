'use client'
import { useState, useEffect } from 'react'
import { Cliente, ClienteHistorial, Etapa, TipoCliente } from '@/types'
import { X, UserCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { usePermissions } from '@/contexts/PermissionsContext'

interface Member { user_id: string; nombre: string; email: string; role: string }

interface Props {
  cliente?: Cliente
  members?: Member[]   // pasados desde el padre (ya cargados)
  onClose: () => void
  onSaved: () => void
}

const DEPARTAMENTOS = [
  'Amazonas','Antioquia','Arauca','Atlántico','Bolívar','Boyacá','Caldas','Caquetá',
  'Casanare','Cauca','Cesar','Chocó','Córdoba','Cundinamarca','Guainía','Guaviare',
  'Huila','La Guajira','Magdalena','Meta','Nariño','Norte de Santander','Putumayo',
  'Quindío','Risaralda','San Andrés y Providencia','Santander','Sucre','Tolima',
  'Valle del Cauca','Vaupés','Vichada',
]

const TIPO_LABELS: Record<TipoCliente, string> = {
  persona_natural: 'Persona Natural',
  empresa: 'Empresa',
  consorcio: 'Consorcio',
}

const CATEGORIAS = ['VIP','Preferencial','Estándar','Nuevo','Inactivo']

const FIELD_LABELS: Record<string, string> = {
  tipo_cliente:            'Tipo de cliente',
  nombre:                  'Nombre',
  razon_social:            'Razón social',
  sobrenombre:             'Sobrenombre',
  email:                   'Email',
  telefono:                'Teléfono',
  cedula:                  'Cédula',
  nit:                     'NIT',
  fecha_nacimiento:        'Fecha de nacimiento',
  fecha_expedicion_cedula: 'Fecha exp. cédula',
  fecha_constitucion:      'Fecha de constitución',
  genero:                  'Género',
  estado_civil:            'Estado civil',
  ciudad:                  'Ciudad',
  departamento:            'Departamento',
  etapa:                   'Etapa',
  categoria:               'Categoría',
  ocupacion:               'Ocupación',
  empresa_trabajo:         'Empresa',
  ingresos_aprox:          'Ingresos aprox.',
  tiene_vehiculo:          'Tiene vehículo',
  tiene_hijos:             'Tiene hijos',
  num_hijos:               'Número de hijos',
  autoriza_datos:          'Autorización datos',
  notas:                   'Notas',
  assigned_to:             'Asesor asignado',
}

function normalizeVal(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  return String(v)
}

export default function ClienteModal({ cliente, members = [], onClose, onSaved }: Props) {
  const { currentWorkspace, currentUserId, isSupervisor, isAdmin } = useWorkspace()
  const { can } = usePermissions()

  // RBAC: puede editar si tiene permiso global, O si tiene permiso de propios Y es el dueño
  const isOwner = !!cliente && cliente.assigned_to === currentUserId
  const canEdit = !cliente /* crear siempre OK */
    || can('clientes_editar_todos')
    || (can('clientes_editar_propios') && isOwner)
  const saveDisabled = !!cliente && !canEdit

  // Puede reasignar el cliente a otro usuario (admin/supervisor)
  const canReassign = isAdmin || isSupervisor

  const [tipo, setTipo] = useState<TipoCliente>(cliente?.tipo_cliente || 'persona_natural')
  const [assignedTo, setAssignedTo] = useState<string>(cliente?.assigned_to || '')
  const [form, setForm] = useState({
    nombre:                   cliente?.nombre || '',
    email:                    cliente?.email || '',
    telefono:                 cliente?.telefono || '',
    cedula:                   cliente?.cedula || '',
    nit:                      cliente?.nit || '',
    razon_social:             cliente?.razon_social || '',
    sobrenombre:              cliente?.sobrenombre || '',
    fecha_nacimiento:         cliente?.fecha_nacimiento || '',
    fecha_expedicion_cedula:  cliente?.fecha_expedicion_cedula || '',
    fecha_constitucion:       cliente?.fecha_constitucion || '',
    genero:                   cliente?.genero || '',
    estado_civil:             cliente?.estado_civil || '',
    ciudad:                   cliente?.ciudad || '',
    departamento:             cliente?.departamento || '',
    etapa:                    cliente?.etapa || ('nuevo' as Etapa),
    ocupacion:                cliente?.ocupacion || '',
    empresa_trabajo:          cliente?.empresa_trabajo || '',
    ingresos_aprox:           cliente?.ingresos_aprox?.toString() || '',
    categoria:                cliente?.categoria || '',
    notas:                    cliente?.notas || '',
    tiene_vehiculo:           cliente?.tiene_vehiculo ?? false,
    tiene_hijos:              cliente?.tiene_hijos ?? false,
    num_hijos:                cliente?.num_hijos?.toString() || '',
    autoriza_datos:           cliente?.autoriza_datos ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Pre-asignar al usuario actual cuando se crea un cliente nuevo
  useEffect(() => {
    if (!cliente && currentUserId && !assignedTo) {
      setAssignedTo(currentUserId)
    }
  }, [currentUserId])

  function set(field: string, val: string | boolean) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function save() {
    const nombreReq = tipo === 'persona_natural' ? form.nombre : form.razon_social
    if (!nombreReq.trim()) {
      setError(tipo === 'persona_natural' ? 'El nombre es obligatorio' : 'La razón social es obligatoria')
      return
    }
    setSaving(true)
    setError('')

    const payload: Record<string, unknown> = {
      tipo_cliente:             tipo,
      nombre:                   tipo === 'persona_natural' ? form.nombre.trim() : form.razon_social.trim(),
      razon_social:             tipo !== 'persona_natural' ? form.razon_social.trim() || null : null,
      sobrenombre:              form.sobrenombre.trim() || null,
      email:                    form.email.trim() || null,
      telefono:                 form.telefono.trim() || null,
      cedula:                   tipo === 'persona_natural' ? form.cedula.trim() || null : null,
      nit:                      tipo !== 'persona_natural' ? form.nit.trim() || null : null,
      fecha_nacimiento:         tipo === 'persona_natural' && form.fecha_nacimiento ? form.fecha_nacimiento : null,
      fecha_expedicion_cedula:  tipo === 'persona_natural' && form.fecha_expedicion_cedula ? form.fecha_expedicion_cedula : null,
      fecha_constitucion:       tipo !== 'persona_natural' && form.fecha_constitucion ? form.fecha_constitucion : null,
      genero:                   tipo === 'persona_natural' ? form.genero || null : null,
      estado_civil:             tipo === 'persona_natural' ? form.estado_civil || null : null,
      ciudad:                   form.ciudad.trim() || null,
      departamento:             form.departamento || null,
      etapa:                    form.etapa,
      ocupacion:                form.ocupacion.trim() || null,
      empresa_trabajo:          form.empresa_trabajo.trim() || null,
      ingresos_aprox:           form.ingresos_aprox ? parseFloat(form.ingresos_aprox.replace(/[^0-9.]/g, '')) : null,
      categoria:                form.categoria || null,
      notas:                    form.notas.trim() || null,
      tiene_vehiculo:           form.tiene_vehiculo,
      tiene_hijos:              form.tiene_hijos,
      num_hijos:                form.tiene_hijos && form.num_hijos ? parseInt(form.num_hijos) : null,
      autoriza_datos:           form.autoriza_datos,
      workspace_id:             currentWorkspace?.id,
      assigned_to:              assignedTo || currentUserId || null,
    }

    const { data: saved, error: err } = cliente
      ? await supabase.from('clientes').update(payload).eq('id', cliente.id).select('id').single()
      : await supabase.from('clientes').insert(payload).select('id').single()

    if (err) { setError(err.message); setSaving(false); return }

    const clienteId = saved?.id ?? cliente?.id
    if (clienteId && currentWorkspace?.id) {
      const batchId  = crypto.randomUUID()
      const userName = members.find(m => m.user_id === currentUserId)?.nombre || 'Usuario'
      const resolveUser = (uid: string) => members.find(m => m.user_id === uid)?.nombre || uid

      const entries: Omit<ClienteHistorial, 'id' | 'created_at'>[] = []

      if (!cliente) {
        entries.push({
          cliente_id:     clienteId,
          workspace_id:   currentWorkspace.id,
          batch_id:       batchId,
          tipo:           'creacion',
          campo:          null,
          label_campo:    null,
          valor_anterior: null,
          valor_nuevo:    null,
          usuario_id:     currentUserId,
          usuario_nombre: userName,
        })
      } else {
        for (const campo of Object.keys(FIELD_LABELS)) {
          const oldRaw = (cliente as unknown as Record<string, unknown>)[campo]
          const newRaw = payload[campo]
          let anterior = normalizeVal(oldRaw)
          let nuevo    = normalizeVal(newRaw)
          if (anterior === nuevo) continue

          if (campo === 'assigned_to') {
            anterior = anterior ? resolveUser(anterior) : ''
            nuevo    = nuevo    ? resolveUser(nuevo)    : ''
            if (anterior === nuevo) continue
          }

          entries.push({
            cliente_id:     clienteId,
            workspace_id:   currentWorkspace.id,
            batch_id:       batchId,
            tipo:           'actualizacion',
            campo,
            label_campo:    FIELD_LABELS[campo],
            valor_anterior: anterior || null,
            valor_nuevo:    nuevo    || null,
            usuario_id:     currentUserId,
            usuario_nombre: userName,
          })
        }
      }

      if (entries.length) await supabase.from('clientes_historial').insert(entries)
    }

    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-ink-200">
          <h2 className="font-semibold text-ink-700">
            {cliente ? 'Editar cliente' : 'Nuevo cliente'}
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* ── Tipo de cliente ── */}
          <Field label="Tipo de cliente *">
            <div className="grid grid-cols-3 gap-2">
              {(['persona_natural','empresa','consorcio'] as TipoCliente[]).map(t => (
                <button key={t} type="button" onClick={() => setTipo(t)}
                  className={[
                    'py-2 px-3 rounded-lg text-xs font-medium border transition-colors',
                    tipo === t
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : 'bg-white border-ink-200 text-ink-500 hover:border-primary-400',
                  ].join(' ')}>
                  {TIPO_LABELS[t]}
                </button>
              ))}
            </div>
          </Field>

          {/* ── Sección: Identificación ── */}
          <Section title="Identificación">
            {tipo === 'persona_natural' ? (
              <>
                <Field label="Nombre completo *">
                  <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                    placeholder="Ej: Carlos Mendoza" className={cls} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Cédula">
                    <input value={form.cedula} onChange={e => set('cedula', e.target.value)}
                      placeholder="12345678" className={cls} />
                  </Field>
                  <Field label="Fecha expedición cédula">
                    <input type="date" value={form.fecha_expedicion_cedula}
                      onChange={e => set('fecha_expedicion_cedula', e.target.value)} className={cls} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Fecha de nacimiento">
                    <input type="date" value={form.fecha_nacimiento}
                      onChange={e => set('fecha_nacimiento', e.target.value)} className={cls} />
                  </Field>
                  <Field label="Género">
                    <select value={form.genero} onChange={e => set('genero', e.target.value)} className={cls}>
                      <option value="">Seleccionar...</option>
                      <option value="masculino">Masculino</option>
                      <option value="femenino">Femenino</option>
                      <option value="otro">Otro</option>
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Estado civil">
                    <select value={form.estado_civil} onChange={e => set('estado_civil', e.target.value)} className={cls}>
                      <option value="">Seleccionar...</option>
                      <option value="soltero">Soltero/a</option>
                      <option value="casado">Casado/a</option>
                      <option value="union_libre">Unión libre</option>
                      <option value="divorciado">Divorciado/a</option>
                      <option value="viudo">Viudo/a</option>
                    </select>
                  </Field>
                  <Field label="Categoría">
                    <select value={form.categoria} onChange={e => set('categoria', e.target.value)} className={cls}>
                      <option value="">Sin categoría</option>
                      {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>
              </>
            ) : (
              <>
                <Field label="Razón social *">
                  <input value={form.razon_social} onChange={e => set('razon_social', e.target.value)}
                    placeholder={tipo === 'empresa' ? 'Ej: Comercializadora ABC S.A.S' : 'Ej: Consorcio Norte'} className={cls} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="NIT">
                    <input value={form.nit} onChange={e => set('nit', e.target.value)}
                      placeholder="900123456-7" className={cls} />
                  </Field>
                  <Field label="Fecha de constitución">
                    <input type="date" value={form.fecha_constitucion}
                      onChange={e => set('fecha_constitucion', e.target.value)} className={cls} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Categoría">
                    <select value={form.categoria} onChange={e => set('categoria', e.target.value)} className={cls}>
                      <option value="">Sin categoría</option>
                      {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Sobrenombre / Alias">
                    <input value={form.sobrenombre} onChange={e => set('sobrenombre', e.target.value)}
                      placeholder="Apodo o nombre comercial" className={cls} />
                  </Field>
                </div>
              </>
            )}

            {tipo === 'persona_natural' && (
              <Field label="Sobrenombre / Alias">
                <input value={form.sobrenombre} onChange={e => set('sobrenombre', e.target.value)}
                  placeholder="Apodo o nombre comercial" className={cls} />
              </Field>
            )}
          </Section>

          {/* ── Sección: Contacto ── */}
          <Section title="Contacto y ubicación">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Teléfono">
                <input value={form.telefono} onChange={e => set('telefono', e.target.value)}
                  placeholder="3001234567" className={cls} />
              </Field>
              <Field label="Email">
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="correo@ejemplo.com" className={cls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Ciudad">
                <input value={form.ciudad} onChange={e => set('ciudad', e.target.value)}
                  placeholder="Bogotá" className={cls} />
              </Field>
              <Field label="Departamento">
                <select value={form.departamento} onChange={e => set('departamento', e.target.value)} className={cls}>
                  <option value="">Seleccionar...</option>
                  {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          {/* ── Sección: Información laboral ── */}
          <Section title="Información laboral">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Ocupación">
                <input value={form.ocupacion} onChange={e => set('ocupacion', e.target.value)}
                  placeholder="Ej: Médico, Comerciante..." className={cls} />
              </Field>
              <Field label="Empresa donde trabaja">
                <input value={form.empresa_trabajo} onChange={e => set('empresa_trabajo', e.target.value)}
                  placeholder="Nombre de la empresa" className={cls} />
              </Field>
            </div>
            <Field label="Ingresos aproximados (COP/mes)">
              <input value={form.ingresos_aprox} onChange={e => set('ingresos_aprox', e.target.value)}
                placeholder="Ej: 5000000" type="number" min="0" className={cls} />
            </Field>
          </Section>

          {/* ── Sección: Perfil personal ── */}
          {tipo === 'persona_natural' && (
            <Section title="Perfil personal">
              <div className="grid grid-cols-2 gap-4">
                <Field label="¿Tiene vehículo?">
                  <Toggle value={form.tiene_vehiculo} onChange={v => set('tiene_vehiculo', v)}
                    yesLabel="Sí" noLabel="No" />
                </Field>
                <Field label="¿Tiene hijos?">
                  <Toggle value={form.tiene_hijos} onChange={v => set('tiene_hijos', v)}
                    yesLabel="Sí" noLabel="No" />
                </Field>
              </div>
              {form.tiene_hijos && (
                <Field label="Número de hijos">
                  <input value={form.num_hijos} onChange={e => set('num_hijos', e.target.value)}
                    type="number" min="1" max="20" placeholder="Ej: 2" className={cls} />
                </Field>
              )}
            </Section>
          )}

          {/* ── Sección: CRM ── */}
          <Section title="CRM">
            {/* Asignación — solo admin/supervisor pueden ver y cambiar */}
            {canReassign && (
              <Field label={<span className="flex items-center gap-1.5"><UserCircle2 className="w-3.5 h-3.5" />Asesor responsable</span>}>
                <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className={cls}>
                  <option value="">Sin asignar</option>
                  {members.map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.nombre}{m.user_id === currentUserId ? ' (yo)' : ''}
                    </option>
                  ))}
                </select>
                {members.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    Se asignará a ti automáticamente al guardar.
                  </p>
                )}
              </Field>
            )}
            {/* Para agentes: solo lectura — quién tiene el cliente */}
            {!canReassign && cliente?.assigned_to && (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                <UserCircle2 className="w-4 h-4 text-slate-400" />
                {isOwner ? 'Este cliente está asignado a ti' : 'Este cliente pertenece a otro asesor'}
              </div>
            )}
            <Field label="Etapa">
              <select value={form.etapa} onChange={e => set('etapa', e.target.value as Etapa)} className={cls}>
                <option value="nuevo">Nuevo</option>
                <option value="contactado">Contactado</option>
                <option value="cotizacion">Cotización</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </Field>
            <Field label="Autorización de datos">
              <Toggle value={form.autoriza_datos} onChange={v => set('autoriza_datos', v)}
                yesLabel="Autoriza" noLabel="No autoriza" />
            </Field>
            <Field label="Notas">
              <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
                placeholder="Observaciones, intereses, referencias..." rows={3} className={cls} />
            </Field>
          </Section>

          {error && <p className="text-sm text-error bg-error-soft rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 border-t border-ink-200">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-ink-200 text-ink-500 text-sm hover:bg-cream-100 transition-colors">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || saveDisabled}
            title={saveDisabled ? 'Sin permiso para editar clientes' : undefined}
            className={`flex-1 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors ${saveDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── helpers ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-3">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ value, onChange, yesLabel = 'Sí', noLabel = 'No' }: {
  value: boolean
  onChange: (v: boolean) => void
  yesLabel?: string
  noLabel?: string
}) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => onChange(true)}
        className={['flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors',
          value ? 'bg-primary-500 border-primary-500 text-white' : 'bg-white border-ink-200 text-ink-500 hover:border-primary-400',
        ].join(' ')}>
        {yesLabel}
      </button>
      <button type="button" onClick={() => onChange(false)}
        className={['flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors',
          !value ? 'bg-ink-400 border-ink-400 text-white' : 'bg-white border-ink-200 text-ink-500 hover:border-ink-400',
        ].join(' ')}>
        {noLabel}
      </button>
    </div>
  )
}

const cls = "w-full px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white"
