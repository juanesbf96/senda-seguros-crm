'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, Megaphone, ChevronLeft, ChevronRight,
  ChevronDown, Zap, GitBranch, BarChart3, FileText,
  MessageSquare, UserPlus, Filter, Settings, LogOut,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

const STORAGE_KEY        = 'senda-mkt-sidebar-collapsed'
const GROUPS_STORAGE_KEY = 'senda-mkt-sidebar-groups'

type NavItem  = { href: string; label: string; icon: React.ElementType; soon?: boolean }
type NavGroup = { id: string; label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'principal',
    label: 'Principal',
    items: [
      { href: '/mkt',          label: 'Dashboard',     icon: LayoutDashboard },
      { href: '/mkt/contactos',label: 'Contactos',     icon: Users,       soon: true },
    ],
  },
  {
    id: 'captacion',
    label: 'Captación',
    items: [
      { href: '/mkt/leads',    label: 'Leads',         icon: UserPlus,    soon: true },
      { href: '/mkt/segmentos',label: 'Segmentos',     icon: Filter,      soon: true },
      { href: '/mkt/funnel',   label: 'Follow-up Funnel', icon: GitBranch, soon: true },
    ],
  },
  {
    id: 'campanas',
    label: 'Campañas',
    items: [
      { href: '/mkt/campanas',       label: 'Campañas',       icon: Megaphone,    soon: true },
      { href: '/mkt/plantillas',     label: 'Plantillas',     icon: FileText,     soon: true },
      { href: '/mkt/mensajes',       label: 'Mensajes',       icon: MessageSquare,soon: true },
      { href: '/mkt/automatizaciones',label:'Automatizaciones',icon: Zap,          soon: true },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    items: [
      { href: '/mkt/metricas', label: 'Métricas',      icon: BarChart3,   soon: true },
    ],
  },
]

export default function MktSidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [collapsed, setCollapsed]   = useState(false)
  const [mounted, setMounted]       = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    principal: true, captacion: true, campanas: true, analytics: true,
  })

  useEffect(() => {
    const savedCollapsed = localStorage.getItem(STORAGE_KEY)
    if (savedCollapsed === 'true') setCollapsed(true)

    const savedGroups = localStorage.getItem(GROUPS_STORAGE_KEY)
    if (savedGroups) {
      try { setOpenGroups(JSON.parse(savedGroups)) } catch {}
    }
    setMounted(true)
  }, [])

  function toggle() {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  function toggleGroup(id: string) {
    setOpenGroups(prev => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!mounted) {
    return <aside className="w-60 flex-shrink-0 bg-violet-950" />
  }

  return (
    <aside className={[
      'flex-shrink-0 bg-violet-950 text-white flex flex-col h-full',
      'transition-[width] motion-reduce:transition-none duration-[220ms] ease-out',
      collapsed ? 'w-[60px]' : 'w-60',
    ].join(' ')}>

      {/* ── Header ── */}
      <div className="h-[60px] flex-shrink-0 border-b border-violet-800 flex items-center px-2.5 gap-2 overflow-hidden">
        {!collapsed && (
          <>
            <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
              <span className="text-base leading-none">🚀</span>
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="font-bold text-sm leading-tight whitespace-nowrap">MKT HQ</p>
              <p className="text-xs text-violet-400">Marketing Command</p>
            </div>
          </>
        )}
        <button onClick={toggle}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className={[
            'flex items-center justify-center rounded-lg flex-shrink-0 w-9 h-9',
            'text-violet-400 hover:text-white hover:bg-violet-800 active:bg-violet-700',
            'transition-colors duration-150',
            collapsed ? 'mx-auto' : '',
          ].join(' ')}>
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Navegación marketing">
        {NAV_GROUPS.map(group => {
          const isOpen = openGroups[group.id] ?? true

          return (
            <div key={group.id} className="mb-1">
              {!collapsed && (
                <button onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-500 hover:text-violet-300 transition-colors">
                  <span>{group.label}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${isOpen ? '' : '-rotate-90'}`} />
                </button>
              )}

              {(isOpen || collapsed) && (
                <div className="px-2 space-y-0.5">
                  {group.items.map(({ href, label, icon: Icon, soon }) => {
                    const active = href === '/mkt' ? pathname === '/mkt' : pathname.startsWith(href)
                    return (
                      <div key={href} className="relative group">
                        <Link href={soon ? '#' : href}
                          onClick={e => { if (soon) e.preventDefault() }}
                          aria-label={collapsed ? label : undefined}
                          className={[
                            'flex items-center rounded-lg text-sm font-medium min-h-[38px]',
                            'transition-colors duration-150',
                            collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                            soon ? 'opacity-50 cursor-default' : '',
                            active && !soon
                              ? 'bg-violet-600 text-white'
                              : 'text-violet-300 hover:bg-violet-800 hover:text-white',
                          ].join(' ')}>
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          {!collapsed && (
                            <span className="flex-1 whitespace-nowrap overflow-hidden text-sm">{label}</span>
                          )}
                          {!collapsed && soon && (
                            <span className="text-[9px] font-bold bg-violet-700 text-violet-300 px-1.5 py-0.5 rounded uppercase tracking-wide">
                              Soon
                            </span>
                          )}
                        </Link>
                        {/* Tooltip */}
                        {collapsed && (
                          <div role="tooltip" className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 bg-violet-900 border border-violet-700 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform] duration-150 ease-out">
                            <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-violet-700" />
                            {label}{soon ? ' (próximo)' : ''}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {collapsed && <div className="mx-3 my-1 border-t border-violet-800/50" />}
            </div>
          )
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="border-t border-violet-800 px-2 py-2 space-y-0.5">
        <div className="relative group">
          <Link href="/configuracion"
            className={[
              'flex items-center rounded-lg text-sm font-medium min-h-[38px] transition-colors duration-150',
              collapsed ? 'justify-center px-2' : 'gap-3 px-3',
              'text-violet-400 hover:bg-violet-800 hover:text-white',
            ].join(' ')}>
            <Settings className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="text-sm">Configuración</span>}
          </Link>
          {collapsed && (
            <div role="tooltip" className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 bg-violet-900 border border-violet-700 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform] duration-150">
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-violet-700" />
              Configuración
            </div>
          )}
        </div>

        <div className="relative group">
          <button onClick={handleLogout}
            className={[
              'w-full flex items-center rounded-lg text-sm font-medium min-h-[38px] transition-colors duration-150',
              collapsed ? 'justify-center px-2' : 'gap-3 px-3',
              'text-violet-500 hover:bg-violet-800 hover:text-red-400',
            ].join(' ')}>
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="text-sm">Cerrar sesión</span>}
          </button>
          {collapsed && (
            <div role="tooltip" className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 bg-violet-900 border border-violet-700 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform] duration-150">
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-violet-700" />
              Cerrar sesión
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
