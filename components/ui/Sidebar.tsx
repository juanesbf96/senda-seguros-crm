'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, FileText, Kanban,
  Bell, Shield, ChevronLeft, ChevronRight, ChevronDown,
  User, LogOut, ClipboardList, CheckSquare, Send,
  DollarSign, Receipt, UserCog, Calculator, TrendingUp, CalendarDays,
  BarChart2, FolderOpen,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

const STORAGE_KEY       = 'senda-sidebar-collapsed'
const GROUPS_STORAGE_KEY = 'senda-sidebar-groups'

type NavItem = { href: string; label: string; icon: React.ElementType }
type NavGroup = { id: string; label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'principal',
    label: 'Principal',
    items: [
      { href: '/',        label: 'Dashboard', icon: LayoutDashboard },
      { href: '/leads',   label: 'Pipeline',  icon: Kanban },
      { href: '/clientes',label: 'Clientes',  icon: Users },
    ],
  },
  {
    id: 'polizas',
    label: 'Pólizas',
    items: [
      { href: '/polizas',      label: 'Pólizas',      icon: FileText },
      { href: '/solicitudes',  label: 'Solicitudes',  icon: ClipboardList },
      { href: '/remisiones',   label: 'Remisiones',   icon: Send },
      { href: '/renovaciones', label: 'Renovaciones', icon: Bell },
    ],
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    items: [
      { href: '/cobros',        label: 'Cobros',        icon: DollarSign },
      { href: '/caja',          label: 'Caja',          icon: Receipt },
      { href: '/liquidaciones', label: 'Liquidaciones', icon: Calculator },
    ],
  },
  {
    id: 'gestion',
    label: 'Gestión',
    items: [
      { href: '/agenda',     label: 'Agenda',     icon: CalendarDays },
      { href: '/tareas',     label: 'Tareas',     icon: CheckSquare },
      { href: '/vendedores', label: 'Vendedores', icon: UserCog },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    items: [
      { href: '/prospectos', label: 'Prospectos', icon: TrendingUp },
    ],
  },
  {
    id: 'reportes',
    label: 'Reportes',
    items: [
      { href: '/informes', label: 'Informes',  icon: BarChart2 },
      { href: '/archivos', label: 'Archivos',  icon: FolderOpen },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [collapsed, setCollapsed]   = useState(false)
  const [mounted, setMounted]       = useState(false)
  const [userName, setUserName]     = useState('')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    principal: true, polizas: true, finanzas: true, gestion: true, crm: true,
  })

  useEffect(() => {
    const savedCollapsed = localStorage.getItem(STORAGE_KEY)
    if (savedCollapsed === 'true') setCollapsed(true)

    const savedGroups = localStorage.getItem(GROUPS_STORAGE_KEY)
    if (savedGroups) {
      try { setOpenGroups(JSON.parse(savedGroups)) } catch {}
    }

    setMounted(true)
    supabase.auth.getUser().then(({ data }) => {
      setUserName(data.user?.user_metadata?.nombre ?? data.user?.email ?? '')
    })
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
    return <aside className="w-60 flex-shrink-0 bg-slate-900" />
  }

  return (
    <aside
      className={[
        'flex-shrink-0 bg-slate-900 text-white flex flex-col h-full',
        'transition-[width] motion-reduce:transition-none duration-[220ms] ease-out',
        collapsed ? 'w-[60px]' : 'w-60',
      ].join(' ')}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="h-[60px] flex-shrink-0 border-b border-slate-700 flex items-center px-2.5 gap-2 overflow-hidden">
        {!collapsed && (
          <>
            <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="font-bold text-sm leading-tight whitespace-nowrap">Senda Seguros</p>
              <p className="text-xs text-slate-400">CRM</p>
            </div>
          </>
        )}
        <button
          onClick={toggle}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className={[
            'flex items-center justify-center rounded-lg flex-shrink-0 w-9 h-9',
            'text-slate-400 hover:text-white hover:bg-slate-700 active:bg-slate-600',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-slate-900',
            collapsed ? 'mx-auto' : '',
          ].join(' ')}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Navigation ──────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Navegación principal">
        {NAV_GROUPS.map(group => {
          const isOpen = openGroups[group.id] ?? true
          const hasActive = group.items.some(item =>
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          )

          return (
            <div key={group.id} className="mb-1">
              {/* Group header — only visible when expanded */}
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    {hasActive && !isOpen && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    )}
                    {group.label}
                  </span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${isOpen ? '' : '-rotate-90'}`} />
                </button>
              )}

              {/* Group items */}
              {(isOpen || collapsed) && (
                <div className="px-2 space-y-0.5">
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
                    return (
                      <div key={href} className="relative group">
                        <Link
                          href={href}
                          aria-label={collapsed ? label : undefined}
                          aria-current={active ? 'page' : undefined}
                          className={[
                            'flex items-center rounded-lg text-sm font-medium min-h-[38px]',
                            'transition-colors duration-150',
                            'focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-slate-900',
                            collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                            active
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                          ].join(' ')}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          {!collapsed && <span className="whitespace-nowrap overflow-hidden text-sm">{label}</span>}
                          {active && collapsed && (
                            <span className="absolute right-1 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-400 rounded-full" />
                          )}
                        </Link>
                        {/* Tooltip when collapsed */}
                        {collapsed && (
                          <div
                            role="tooltip"
                            className={[
                              'pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50',
                              'bg-slate-800 border border-slate-600 text-white text-xs font-medium',
                              'px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap',
                              'opacity-0 translate-x-1',
                              'group-hover:opacity-100 group-hover:translate-x-0',
                              'transition-[opacity,transform] duration-150 ease-out',
                            ].join(' ')}
                          >
                            <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-600" />
                            {label}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Divider between groups when collapsed */}
              {collapsed && <div className="mx-3 my-1 border-t border-slate-700/50" />}
            </div>
          )
        })}
      </nav>

      {/* ── User / Footer ────────────────────────────────────── */}
      <div className="border-t border-slate-700 px-2 py-2 space-y-0.5">
        <div className="relative group">
          <Link
            href="/perfil"
            aria-label={collapsed ? 'Mi perfil' : undefined}
            aria-current={pathname === '/perfil' ? 'page' : undefined}
            className={[
              'flex items-center rounded-lg text-sm font-medium min-h-[38px]',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-slate-900',
              collapsed ? 'justify-center px-2' : 'gap-3 px-3',
              pathname === '/perfil'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            ].join(' ')}
          >
            <User className="w-4 h-4 flex-shrink-0" />
            {!collapsed && (
              <span className="whitespace-nowrap overflow-hidden truncate text-sm">
                {userName || 'Mi perfil'}
              </span>
            )}
          </Link>
          {collapsed && (
            <div role="tooltip" className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 bg-slate-800 border border-slate-600 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform] duration-150 ease-out">
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-600" />
              {userName || 'Mi perfil'}
            </div>
          )}
        </div>

        <div className="relative group">
          <button
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            className={[
              'w-full flex items-center rounded-lg text-sm font-medium min-h-[38px]',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-slate-900',
              collapsed ? 'justify-center px-2' : 'gap-3 px-3',
              'text-slate-400 hover:bg-slate-800 hover:text-red-400',
            ].join(' ')}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="whitespace-nowrap text-sm">Cerrar sesión</span>}
          </button>
          {collapsed && (
            <div role="tooltip" className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 bg-slate-800 border border-slate-600 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform] duration-150 ease-out">
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-600" />
              Cerrar sesión
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
