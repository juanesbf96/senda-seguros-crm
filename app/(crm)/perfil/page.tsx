'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { User, Mail, Save, CheckCircle } from 'lucide-react'

export default function PerfilPage() {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? '')
        setNombre(data.user.user_metadata?.nombre ?? '')
      }
      setLoading(false)
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.auth.updateUser({ data: { nombre } })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-700">Mi perfil</h1>
        <p className="text-ink-400 text-sm mt-1">Datos de tu cuenta</p>
      </div>

      <div className="bg-white rounded-xl border border-ink-200 p-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-primary-500" />
          </div>
          <div>
            <p className="font-semibold text-ink-700">{nombre || 'Sin nombre'}</p>
            <p className="text-sm text-ink-400">{email}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink-600 mb-1.5">
              Nombre completo
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Tu nombre"
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-600 mb-1.5">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input
                type="email"
                value={email}
                disabled
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-ink-200 rounded-lg bg-cream-100 text-ink-400 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-ink-400 mt-1">El correo no se puede cambiar desde aquí</p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-primary-500 hover:bg-primary-700 disabled:bg-primary-400 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {saved
                ? <><CheckCircle className="w-4 h-4" /> Guardado</>
                : saving
                  ? 'Guardando...'
                  : <><Save className="w-4 h-4" /> Guardar cambios</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
