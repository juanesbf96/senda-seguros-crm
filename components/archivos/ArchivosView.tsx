'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Archivo, Cliente, Poliza, Prospecto } from '@/types'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import {
  Upload, Trash2, Download, Search, FileText,
  FileImage, File, Film, Music, X, Paperclip,
  FolderOpen, Shield, Users, UserCheck, SlidersHorizontal,
} from 'lucide-react'

function formatBytes(b: number | null): string {
  if (!b) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`
  return `${(b/1048576).toFixed(1)} MB`
}

function FileIcon({ mime }: { mime: string | null }) {
  if (!mime) return <File className="w-5 h-5 text-ink-400" />
  if (mime.startsWith('image/'))  return <FileImage className="w-5 h-5 text-info" />
  if (mime.startsWith('video/'))  return <Film      className="w-5 h-5 text-violet-400" />
  if (mime.startsWith('audio/'))  return <Music     className="w-5 h-5 text-pink-400" />
  if (mime.includes('pdf'))       return <FileText  className="w-5 h-5 text-error" />
  if (mime.includes('word') || mime.includes('document')) return <FileText className="w-5 h-5 text-info" />
  if (mime.includes('sheet') || mime.includes('excel'))   return <FileText className="w-5 h-5 text-primary-500" />
  return <File className="w-5 h-5 text-ink-400" />
}

type TabFilter = 'todos' | 'poliza' | 'cliente' | 'prospecto'

interface TabConfig { key: TabFilter; label: string; icon: React.ElementType; color: string }
const TABS: TabConfig[] = [
  { key: 'todos',     label: 'Todos',      icon: FolderOpen,  color: 'text-ink-500'   },
  { key: 'poliza',    label: 'Pólizas',    icon: Shield,      color: 'text-primary-500' },
  { key: 'cliente',   label: 'Clientes',   icon: Users,       color: 'text-info'    },
  { key: 'prospecto', label: 'Prospectos', icon: UserCheck,   color: 'text-violet-600'  },
]

function tabMatch(a: Archivo, tab: TabFilter): boolean {
  if (tab === 'todos')     return true
  if (tab === 'poliza')    return !!a.poliza_id
  if (tab === 'cliente')   return !!a.client_id && !a.poliza_id && !a.prospecto_id
  if (tab === 'prospecto') return !!a.prospecto_id
  return true
}

interface UploadForm {
  open: boolean
  file: File | null
  descripcion: string
  client_id: string
  poliza_id: string
  prospecto_id: string
}

export default function ArchivosView({ clienteId }: { clienteId?: string }) {
  const { currentWorkspace } = useWorkspace()
  const [archivos,    setArchivos]    = useState<Archivo[]>([])
  const [clientes,    setClientes]    = useState<Pick<Cliente,  'id'|'nombre'>[]>([])
  const [polizas,     setPolizas]     = useState<Pick<Poliza,   'id'|'numero_poliza'|'aseguradora'>[]>([])
  const [prospectos,  setProspectos]  = useState<Pick<Prospecto,'id'|'nombre'>[]>([])
  const [loading,     setLoading]     = useState(true)
  const [uploading,   setUploading]   = useState(false)
  const [search,      setSearch]      = useState('')
  const [activeTab,   setActiveTab]   = useState<TabFilter>('todos')
  const [filterTipo,  setFilterTipo]  = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [uploadForm,  setUploadForm]  = useState<UploadForm>({
    open: false, file: null, descripcion: '', client_id: clienteId || '', poliza_id: '', prospecto_id: '',
  })
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    if (!currentWorkspace) return
    const wid = currentWorkspace.id
    let archQ = supabase.from('archivos')
      .select('*, cliente:clientes(id,nombre), poliza:polizas(id,numero_poliza,aseguradora), prospecto:prospectos(id,nombre)')
      .eq('workspace_id', wid)
      .order('created_at', { ascending: false })
    if (clienteId) archQ = archQ.eq('client_id', clienteId)

    const [archRes, clRes, proRes] = await Promise.all([
      archQ,
      supabase.from('clientes').select('id,nombre').eq('workspace_id', wid).order('nombre'),
      supabase.from('prospectos').select('id,nombre').eq('workspace_id', wid).order('nombre'),
    ])
    setArchivos((archRes.data || []) as Archivo[])
    setClientes(clRes.data || [])
    setProspectos(proRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [clienteId, currentWorkspace])

  useEffect(() => {
    if (!uploadForm.client_id) { setPolizas([]); return }
    supabase.from('polizas').select('id,numero_poliza,aseguradora')
      .eq('client_id', uploadForm.client_id).eq('eliminada', false)
      .then(({ data }) => setPolizas(data || []))
  }, [uploadForm.client_id])

  function setUF(field: string, val: string | File | null) {
    setUploadForm(f => ({ ...f, [field]: val }))
  }

  async function handleUpload() {
    if (!uploadForm.file) { setError('Selecciona un archivo'); return }
    setUploading(true); setError('')

    const file = uploadForm.file
    const ext  = file.name.split('.').pop()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: storageErr } = await supabase.storage
      .from('archivos')
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (storageErr) { setError(storageErr.message); setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage.from('archivos').getPublicUrl(path)

    const { error: dbErr } = await supabase.from('archivos').insert({
      nombre:          path,
      nombre_original: file.name,
      url:             publicUrl,
      tipo_mime:       file.type || null,
      tamano:          file.size,
      descripcion:     uploadForm.descripcion.trim() || null,
      client_id:       uploadForm.client_id    || null,
      poliza_id:       uploadForm.poliza_id    || null,
      prospecto_id:    uploadForm.prospecto_id || null,
      workspace_id:    currentWorkspace?.id,
    })

    if (dbErr) { setError(dbErr.message); setUploading(false); return }

    setUploadForm({ open: false, file: null, descripcion: '', client_id: clienteId || '', poliza_id: '', prospecto_id: '' })
    load()
  }

  async function deleteArchivo(archivo: Archivo) {
    if (!confirm(`¿Eliminar "${archivo.nombre_original}"?`)) return
    await supabase.storage.from('archivos').remove([archivo.nombre])
    await supabase.from('archivos').delete().eq('id', archivo.id)
    setArchivos(prev => prev.filter(a => a.id !== archivo.id))
  }

  /* ── Filtering ─────────────────────────────────────── */
  const q = search.toLowerCase()
  const filtered = archivos.filter(a => {
    const matchSearch = !search ||
      a.nombre_original.toLowerCase().includes(q) ||
      a.descripcion?.toLowerCase().includes(q) ||
      a.cliente?.nombre?.toLowerCase().includes(q) ||
      a.prospecto?.nombre?.toLowerCase().includes(q) ||
      a.poliza?.aseguradora?.toLowerCase().includes(q) ||
      a.poliza?.numero_poliza?.toLowerCase().includes(q)
    const matchTipo = !filterTipo || a.tipo_mime?.includes(filterTipo)
    const matchTab  = tabMatch(a, activeTab)
    return matchSearch && matchTipo && matchTab
  })

  /* ── Tab counts ────────────────────────────────────── */
  const tabCounts: Record<TabFilter, number> = {
    todos:     archivos.length,
    poliza:    archivos.filter(a => !!a.poliza_id).length,
    cliente:   archivos.filter(a => !!a.client_id && !a.poliza_id && !a.prospecto_id).length,
    prospecto: archivos.filter(a => !!a.prospecto_id).length,
  }

  const totalSize = archivos.reduce((s, a) => s + (a.tamano || 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-ink-700">Archivos</h1>
          <p className="text-ink-400 text-sm mt-1">
            {archivos.length} archivos · {formatBytes(totalSize)} en total
          </p>
        </div>
        <button onClick={() => setUploadForm(f => ({ ...f, open: true }))}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Upload className="w-4 h-4" /> Subir archivo
        </button>
      </div>

      {/* Classification tabs */}
      {!clienteId && (
        <div className="flex gap-1 mb-5 border-b border-ink-200 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon, color }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                activeTab === key ? 'border-primary-500 text-primary-500' : 'border-transparent text-ink-400 hover:text-ink-600'
              }`}>
              <Icon className={`w-4 h-4 ${activeTab === key ? 'text-primary-500' : color}`} />
              {label}
              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                activeTab === key ? 'bg-primary-100 text-primary-700' : 'bg-cream-200 text-ink-400'
              }`}>
                {tabCounts[key]}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Search + Filters row */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cliente, aseguradora, póliza..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400" />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-500">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button onClick={() => setShowFilters(f => !f)}
          className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
            filterTipo ? 'border-primary-400 text-primary-500 bg-primary-50' : 'border-ink-200 text-ink-500 hover:bg-cream-100'
          }`}>
          <SlidersHorizontal className="w-4 h-4" />
          Tipo {filterTipo && <span className="w-1.5 h-1.5 rounded-full bg-primary-500 inline-block" />}
        </button>
      </div>

      {/* Tipo filter panel */}
      {showFilters && (
        <div className="mb-5 p-4 bg-cream-100 border border-ink-200 rounded-xl flex flex-wrap gap-2">
          {[
            { val: '',       label: 'Todos los tipos' },
            { val: 'pdf',    label: 'PDF' },
            { val: 'image',  label: 'Imágenes' },
            { val: 'word',   label: 'Word' },
            { val: 'sheet',  label: 'Excel' },
            { val: 'video',  label: 'Video' },
          ].map(({ val, label }) => (
            <button key={val} onClick={() => setFilterTipo(val)}
              className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                filterTipo === val
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-ink-500 border-ink-200 hover:border-ink-300'
              }`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Grid de archivos */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-ink-400">
          <Paperclip className="w-10 h-10 mx-auto mb-3 opacity-30" />
          {search || filterTipo ? (
            <p className="text-sm">Sin resultados para los filtros aplicados</p>
          ) : (
            <>
              <p className="text-sm">No hay archivos en esta sección</p>
              <button onClick={() => setUploadForm(f => ({ ...f, open: true }))}
                className="mt-4 text-sm text-primary-500 hover:text-primary-700 font-medium">
                Subir el primer archivo
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(archivo => (
            <div key={archivo.id}
              className="bg-white border border-ink-200 rounded-xl p-4 hover:border-ink-300 hover:shadow-sm transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-cream-100 rounded-lg flex items-center justify-center">
                  <FileIcon mime={archivo.tipo_mime} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={archivo.url} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 text-ink-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => deleteArchivo(archivo)}
                    className="p-1.5 text-ink-400 hover:text-error hover:bg-error-soft rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-sm font-medium text-ink-700 truncate mb-1" title={archivo.nombre_original}>
                {archivo.nombre_original}
              </p>
              {archivo.descripcion && (
                <p className="text-xs text-ink-400 truncate mb-2">{archivo.descripcion}</p>
              )}

              <div className="flex flex-wrap gap-1 mt-2">
                {archivo.cliente && (
                  <span className="inline-flex items-center gap-1 text-xs bg-info/10 text-info px-2 py-0.5 rounded-full">
                    <Users className="w-3 h-3" />
                    {archivo.cliente.nombre}
                  </span>
                )}
                {archivo.poliza && (
                  <span className="inline-flex items-center gap-1 text-xs bg-primary-50 text-primary-500 px-2 py-0.5 rounded-full">
                    <Shield className="w-3 h-3" />
                    {archivo.poliza.aseguradora}
                  </span>
                )}
                {archivo.prospecto && (
                  <span className="inline-flex items-center gap-1 text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">
                    <UserCheck className="w-3 h-3" />
                    {archivo.prospecto.nombre}
                  </span>
                )}
                {!archivo.client_id && !archivo.poliza_id && !archivo.prospecto_id && (
                  <span className="text-xs text-ink-300 italic">Sin vincular</span>
                )}
              </div>

              <p className="text-xs text-ink-300 mt-2">{formatBytes(archivo.tamano)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {uploadForm.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-cream-200">
              <h2 className="font-semibold text-ink-700">Subir archivo</h2>
              <button onClick={() => setUploadForm(f => ({ ...f, open: false }))}
                className="text-ink-400 hover:text-ink-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">

              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-ink-200 rounded-xl p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors">
                {uploadForm.file ? (
                  <div>
                    <div className="flex justify-center mb-2">
                      <FileIcon mime={uploadForm.file.type} />
                    </div>
                    <p className="text-sm font-medium text-ink-600">{uploadForm.file.name}</p>
                    <p className="text-xs text-ink-400">{formatBytes(uploadForm.file.size)}</p>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 mx-auto text-ink-300 mb-2" />
                    <p className="text-sm text-ink-400">Haz clic para seleccionar</p>
                    <p className="text-xs text-ink-400 mt-1">PDF, imágenes, Word, Excel...</p>
                  </div>
                )}
                <input ref={fileRef} type="file" className="hidden"
                  onChange={e => setUF('file', e.target.files?.[0] || null)} />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-500 mb-1">Descripción</label>
                <input value={uploadForm.descripcion} onChange={e => setUF('descripcion', e.target.value)}
                  placeholder="Ej: Póliza original firmada" className={cls} />
              </div>

              {!clienteId && (
                <div>
                  <label className="block text-xs font-medium text-ink-500 mb-1">Cliente (opcional)</label>
                  <select value={uploadForm.client_id} onChange={e => { setUF('client_id', e.target.value); setUF('poliza_id', '') }}
                    className={cls}>
                    <option value="">Sin cliente</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              )}

              {polizas.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-ink-500 mb-1">Póliza (opcional)</label>
                  <select value={uploadForm.poliza_id} onChange={e => setUF('poliza_id', e.target.value)}
                    className={cls}>
                    <option value="">Sin póliza</option>
                    {polizas.map(p => <option key={p.id} value={p.id}>{p.aseguradora} · {p.numero_poliza}</option>)}
                  </select>
                </div>
              )}

              {!clienteId && (
                <div>
                  <label className="block text-xs font-medium text-ink-500 mb-1">Prospecto (opcional)</label>
                  <select value={uploadForm.prospecto_id} onChange={e => setUF('prospecto_id', e.target.value)}
                    className={cls}>
                    <option value="">Sin prospecto</option>
                    {prospectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              )}

              {error && <p className="text-sm text-error bg-error-soft rounded-lg px-3 py-2">{error}</p>}
            </div>
            <div className="flex gap-3 p-5 border-t border-cream-200">
              <button onClick={() => setUploadForm(f => ({ ...f, open: false }))}
                className="flex-1 px-4 py-2 rounded-xl border border-ink-200 text-ink-500 text-sm hover:bg-cream-100">
                Cancelar
              </button>
              <button onClick={handleUpload} disabled={uploading || !uploadForm.file}
                className="flex-1 px-4 py-2 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60">
                {uploading ? 'Subiendo...' : 'Subir archivo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const cls = "w-full px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
