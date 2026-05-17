'use client'
import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react'

/* ── Types ─────────────────────────────────────────── */
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

/* ── Context ────────────────────────────────────────── */
interface ToastCtx { toast: (item: Omit<ToastItem, 'id'>) => void }
const ToastContext = createContext<ToastCtx>({ toast: () => {} })

export function useToast() { return useContext(ToastContext) }

/* ── Config ─────────────────────────────────────────── */
const CFG: Record<ToastType, { icon: React.ElementType; bg: string; border: string; iconCls: string; titleCls: string }> = {
  success: { icon: CheckCircle,   bg: 'bg-white',     border: 'border-primary-200', iconCls: 'text-primary-500', titleCls: 'text-primary-800' },
  error:   { icon: AlertCircle,   bg: 'bg-white',     border: 'border-error/30',     iconCls: 'text-error',     titleCls: 'text-error'     },
  warning: { icon: AlertTriangle, bg: 'bg-white',     border: 'border-warning/30',   iconCls: 'text-warning',   titleCls: 'text-ink-700'   },
  info:    { icon: Info,          bg: 'bg-white',     border: 'border-info/30',    iconCls: 'text-info',    titleCls: 'text-info'    },
}

/* ── Single Toast ───────────────────────────────────── */
function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false)
  const { icon: Icon, bg, border, iconCls, titleCls } = CFG[item.type]

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(item.id), 300)
    }, item.duration ?? 4000)
    return () => clearTimeout(timer)
  }, [item.id, item.duration, onDismiss])

  return (
    <div className={`flex items-start gap-3 w-80 max-w-full ${bg} border ${border} rounded-xl shadow-lg px-4 py-3.5 transition-all duration-300 ${
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
    }`}>
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconCls}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${titleCls}`}>{item.title}</p>
        {item.message && <p className="text-xs text-ink-400 mt-0.5 line-clamp-2">{item.message}</p>}
      </div>
      <button onClick={() => { setVisible(false); setTimeout(() => onDismiss(item.id), 300) }}
        className="text-ink-400 hover:text-ink-500 flex-shrink-0 ml-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

/* ── Provider ───────────────────────────────────────── */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts(prev => [...prev.slice(-4), { ...item, id }]) // max 5 toasts
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container — bottom-right */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <Toast item={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
